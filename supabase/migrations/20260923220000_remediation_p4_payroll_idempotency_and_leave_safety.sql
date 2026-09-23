-- ==============================================================================
-- KAA ERP REMEDIATION - PRIORITY 4: HR, ATTENDANCE, LEAVE, AND PAYROLL SAFETY
-- Migration: 20260923220000_remediation_p4_payroll_idempotency_and_leave_safety.sql
-- Description:
--   1. Protects finalized/paid payroll runs from accidental rerun/reset in rpc_generate_payroll.
--   2. Introduces leave_accrual_batches to guarantee idempotent leave accrual without inflating balances.
--   3. Database trigger trg_validate_attendance_punches to prevent check-out before check-in without overnight flags.
--   4. Database trigger trg_validate_leave_no_overlap to prevent duplicate/overlapping leave applications.
-- Rollback: Drop triggers and helper tables, restore previous rpc_generate_payroll.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Leave Accrual Batches & Idempotency (4.2)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.leave_accrual_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    rule_id UUID REFERENCES public.leave_accrual_rules(id) ON DELETE CASCADE,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    executed_by UUID,
    CONSTRAINT uq_leave_accrual_batch UNIQUE (company_id, year, rule_id)
);

ALTER TABLE public.leave_accrual_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_accrual_batches_tenant" ON public.leave_accrual_batches
    FOR ALL TO authenticated
    USING (company_id = get_my_company_id())
    WITH CHECK (company_id = get_my_company_id());

CREATE OR REPLACE FUNCTION public.rpc_run_leave_accrual(
    p_company_id UUID, 
    p_year INTEGER DEFAULT (EXTRACT(YEAR FROM CURRENT_DATE))::INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rule RECORD;
    v_emp RECORD;
    v_accrued_count INTEGER := 0;
    v_skipped_rules INTEGER := 0;
    v_caller_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify caller HR / Admin role
    SELECT lower(role) INTO v_caller_role
    FROM public.profiles 
    WHERE id = auth.uid();

    IF v_caller_role NOT IN ('admin', 'super admin', 'superadmin', 'hr manager') THEN
        RAISE EXCEPTION 'Unauthorized: Only HR Managers or Administrators can execute leave accruals.';
    END IF;

    FOR v_rule IN
        SELECT * FROM public.leave_accrual_rules 
        WHERE company_id = p_company_id AND is_active = true
    LOOP
        -- Check if this rule was already accrued for this year
        IF EXISTS (
            SELECT 1 FROM public.leave_accrual_batches 
            WHERE company_id = p_company_id AND year = p_year AND rule_id = v_rule.id
        ) THEN
            v_skipped_rules := v_skipped_rules + 1;
            CONTINUE;
        END IF;

        -- Record batch execution to prevent duplicate accrual
        INSERT INTO public.leave_accrual_batches (company_id, year, rule_id, executed_by)
        VALUES (p_company_id, p_year, v_rule.id, auth.uid());

        -- Accrue for all active employees
        FOR v_emp IN
            SELECT id FROM public.employees 
            WHERE company_id = p_company_id AND status = 'Active'
        LOOP
            INSERT INTO public.leave_balances (company_id, employee_id, leave_type_id, year, accrued)
            VALUES (p_company_id, v_emp.id, v_rule.leave_type_id, p_year, v_rule.accrual_amount)
            ON CONFLICT (company_id, employee_id, leave_type_id, year)
            DO UPDATE SET 
                accrued = leave_balances.accrued + v_rule.accrual_amount,
                updated_at = NOW();

            v_accrued_count := v_accrued_count + 1;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'year', p_year,
        'employees_accrued', v_accrued_count,
        'rules_skipped_already_accrued', v_skipped_rules
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_run_leave_accrual(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_run_leave_accrual(UUID, INTEGER) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. Payroll Rerun Concurrency & State Protection (4.1)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_generate_payroll(p_company_id UUID, p_month_year DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_run RECORD;
    v_run_id UUID;
    v_start_date DATE := p_month_year;
    v_end_date DATE := (p_month_year + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    v_month_year_text TEXT := TO_CHAR(v_start_date, 'Mon YYYY');
    v_days_in_month NUMERIC;
    v_emp RECORD;
    v_payable_days NUMERIC;
    v_lop_days NUMERIC;
    v_gross_pay NUMERIC;
    v_base_salary NUMERIC;
    v_daily_rate NUMERIC;
    
    v_ot_hours NUMERIC;
    v_ot_amount NUMERIC;
    v_loan_deduction NUMERIC;
    v_record_id UUID;
    v_caller_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify HR/Admin authorization
    SELECT lower(role) INTO v_caller_role
    FROM public.profiles 
    WHERE id = auth.uid();

    IF v_caller_role NOT IN ('admin', 'super admin', 'superadmin', 'hr manager') THEN
        RAISE EXCEPTION 'Unauthorized: Only HR or Administrators can generate payroll.';
    END IF;

    -- 1. Check for existing run and lock it FOR UPDATE
    SELECT * INTO v_run 
    FROM public.payroll_runs 
    WHERE company_id = p_company_id AND period_start = v_start_date AND period_end = v_end_date
    FOR UPDATE;

    IF v_run.id IS NOT NULL THEN
        -- Never overwrite or reset finalized/approved payroll runs
        IF v_run.status IN ('APPROVED', 'PROCESSED', 'PAID', 'FINALIZED') THEN
            RAISE EXCEPTION 'Cannot regenerate payroll for %: Run is already % and locked.', v_month_year_text, v_run.status;
        END IF;
        v_run_id := v_run.id;
    ELSE
        INSERT INTO public.payroll_runs (company_id, name, period_start, period_end, status)
        VALUES (p_company_id, v_month_year_text || ' Payroll', v_start_date, v_end_date, 'DRAFT')
        RETURNING id INTO v_run_id;
    END IF;

    v_days_in_month := DATE_PART('day', v_end_date);

    -- 2. Loop through active employees
    FOR v_emp IN 
        SELECT id, salary_amount, join_date 
        FROM public.employees 
        WHERE company_id = p_company_id 
          AND status = 'Active' 
          AND join_date <= v_end_date
    LOOP
        -- Calculate Payable Days
        SELECT COALESCE(COUNT(*), 0) INTO v_lop_days
        FROM public.attendance
        WHERE employee_id = v_emp.id 
          AND date BETWEEN v_start_date AND v_end_date
          AND status = 'Absent';

        IF v_emp.join_date > v_start_date THEN
            v_lop_days := v_lop_days + (DATE_PART('day', v_emp.join_date::timestamp) - 1);
        END IF;

        v_payable_days := GREATEST(0, v_days_in_month - v_lop_days);

        v_base_salary := COALESCE(v_emp.salary_amount, 0);
        v_daily_rate := v_base_salary / GREATEST(1, v_days_in_month);
        
        -- OVERTIME AUTOMATION
        SELECT COALESCE(SUM(total_hours - 8), 0) INTO v_ot_hours
        FROM public.attendance
        WHERE employee_id = v_emp.id 
          AND date BETWEEN v_start_date AND v_end_date
          AND total_hours > 8;
        
        v_ot_amount := ROUND((v_ot_hours * (v_daily_rate / 8) * 1.5)::numeric, 2);

        -- LOAN DEDUCTION AUTOMATION
        SELECT COALESCE(SUM(LEAST(emi_amount, balance)), 0) INTO v_loan_deduction
        FROM public.payroll_loans
        WHERE employee_id = v_emp.id
          AND company_id = p_company_id
          AND status = 'Active'
          AND start_date <= v_end_date;

        -- Gross and Net
        v_gross_pay := ROUND((v_daily_rate * v_payable_days)::numeric, 2) + v_ot_amount;
        
        DECLARE
           v_net_pay NUMERIC := v_gross_pay - v_loan_deduction;
        BEGIN
            SELECT id INTO v_record_id FROM public.payroll_records
            WHERE company_id = p_company_id AND employee_id = v_emp.id AND month_year = v_month_year_text
            LIMIT 1;

            IF v_record_id IS NULL THEN
                INSERT INTO public.payroll_records (
                    company_id, employee_id, month_year,
                    basic_salary, gross_earning, total_deduction, net_pay,
                    status, ot_amount, loan_deduction,
                    payable_days, lop_days, fixed_allowance, variable_allowance
                ) VALUES (
                    p_company_id, v_emp.id, v_month_year_text,
                    v_base_salary, v_gross_pay, v_loan_deduction, v_net_pay,
                    'CALCULATED', v_ot_amount, v_loan_deduction,
                    v_payable_days, v_lop_days, 0, 0
                );
            ELSE
                UPDATE public.payroll_records
                SET basic_salary = v_base_salary,
                    gross_earning = v_gross_pay,
                    total_deduction = v_loan_deduction,
                    net_pay = v_net_pay,
                    ot_amount = v_ot_amount,
                    loan_deduction = v_loan_deduction,
                    payable_days = v_payable_days,
                    lop_days = v_lop_days,
                    status = 'CALCULATED',
                    updated_at = NOW()
                WHERE id = v_record_id;
            END IF;
        END;
    END LOOP;

    RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_generate_payroll(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_generate_payroll(UUID, DATE) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Attendance Punch Chronology Validation Trigger (4.3)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_validate_attendance_punches()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
        -- If check_out is earlier than check_in and neither shift is marked overnight
        IF NEW.check_out < NEW.check_in THEN
            -- Check if an overnight shift rule allows it
            IF NOT EXISTS (
                SELECT 1 FROM public.org_shift_timings s
                WHERE s.id = NEW.shift_id AND s.is_night_shift = true
            ) THEN
                RAISE EXCEPTION 'Invalid attendance: Check-out time (%) cannot be earlier than check-in time (%).', NEW.check_out, NEW.check_in;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_attendance_punches ON public.attendance;
CREATE TRIGGER trg_validate_attendance_punches
    BEFORE INSERT OR UPDATE ON public.attendance
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_validate_attendance_punches();

-- ------------------------------------------------------------------------------
-- 4. Leave Request Overlap Prevention Trigger (4.4)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_validate_leave_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.end_date < NEW.start_date THEN
        RAISE EXCEPTION 'End date cannot be earlier than start date.';
    END IF;

    -- Only validate non-cancelled/non-rejected applications
    IF NEW.status IN ('Pending', 'Approved') THEN
        IF EXISTS (
            SELECT 1 FROM public.leaves
            WHERE employee_id = NEW.employee_id
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
              AND status IN ('Pending', 'Approved')
              AND daterange(start_date, end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
        ) THEN
            RAISE EXCEPTION 'This leave request overlaps with an existing pending or approved leave application for the employee.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_leave_no_overlap ON public.leaves;
CREATE TRIGGER trg_validate_leave_no_overlap
    BEFORE INSERT OR UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_validate_leave_no_overlap();
