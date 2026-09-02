-- Migration: 20260903_attendance_payroll_hardening.sql
-- Description: Additive schema, triggers, and RPCs for Attendance Month Lock & Payroll Integration

-- ========================================================
-- 1. EXTEND ATTENDANCE_PERIODS
-- ========================================================
ALTER TABLE public.attendance_periods
    ADD COLUMN IF NOT EXISTS year INT,
    ADD COLUMN IF NOT EXISTS month INT,
    ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lock_reason TEXT,
    ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reopen_reason TEXT,
    ADD COLUMN IF NOT EXISTS payroll_transfer_status TEXT DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS payroll_transfer_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS summary_snapshot JSONB DEFAULT '{}'::jsonb;

-- Drop old check constraint and add comprehensive lifecycle check
ALTER TABLE public.attendance_periods 
    DROP CONSTRAINT IF EXISTS attendance_periods_status_check;

ALTER TABLE public.attendance_periods 
    ADD CONSTRAINT attendance_periods_status_check 
    CHECK (status IN (
        'OPEN', 'DRAFT', 'PROCESSING', 'REVIEW', 
        'READY_FOR_FINALIZATION', 'FINALIZED', 'LOCKED', 'REOPENED', 'PROCESSED'
    ));

-- Backfill year & month if missing
UPDATE public.attendance_periods
SET 
    year = EXTRACT(YEAR FROM start_date)::INT,
    month = EXTRACT(MONTH FROM start_date)::INT
WHERE year IS NULL AND start_date IS NOT NULL;

-- Unique constraint on (company_id, year, month) where year and month are not null
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uk_attendance_periods_company_year_month'
    ) THEN
        ALTER TABLE public.attendance_periods
            ADD CONSTRAINT uk_attendance_periods_company_year_month UNIQUE (company_id, year, month);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Constraint uk_attendance_periods_company_year_month already exists or duplicate detected';
END $$;


-- ========================================================
-- 2. ATTENDANCE CORRECTIONS AUDIT LOG TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.attendance_corrections_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
    attendance_period_id UUID REFERENCES public.attendance_periods(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    correction_reason TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.attendance_corrections_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'attendance_corrections_log' AND policyname = 'Tenant Isolation'
    ) THEN
        CREATE POLICY "Tenant Isolation" ON public.attendance_corrections_log 
            USING (company_id = get_my_company_id());
    END IF;
END $$;


-- ========================================================
-- 3. HARD DB-LEVEL MONTH LOCK TRIGGER ON ATTENDANCE
-- ========================================================
CREATE OR REPLACE FUNCTION public.fn_enforce_attendance_month_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_date DATE;
    v_company_id UUID;
    v_is_locked BOOLEAN := false;
BEGIN
    -- Determine target date & company based on operation
    IF TG_OP = 'DELETE' THEN
        v_target_date := OLD.date;
        v_company_id := OLD.company_id;
    ELSE
        v_target_date := NEW.date;
        v_company_id := NEW.company_id;
    END IF;

    -- Check if target date falls within any LOCKED attendance period
    SELECT EXISTS (
        SELECT 1 FROM public.attendance_periods
        WHERE company_id = v_company_id
          AND v_target_date BETWEEN start_date AND end_date
          AND status = 'LOCKED'
    ) INTO v_is_locked;

    IF v_is_locked THEN
        RAISE EXCEPTION 'Attendance for this month is locked and cannot be modified.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_attendance_month_lock ON public.attendance;

CREATE TRIGGER trg_enforce_attendance_month_lock
    BEFORE INSERT OR UPDATE OR DELETE ON public.attendance
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_attendance_month_lock();


-- ========================================================
-- 4. PAYROLL ATTENDANCE SNAPSHOT LAYER
-- ========================================================
CREATE TABLE IF NOT EXISTS public.payroll_attendance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    attendance_period_id UUID NOT NULL REFERENCES public.attendance_periods(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    year INT NOT NULL,
    month INT NOT NULL,
    month_year TEXT NOT NULL, -- 'YYYY-MM'
    
    calendar_days NUMERIC DEFAULT 0,
    working_days NUMERIC DEFAULT 0,
    present_days NUMERIC DEFAULT 0,
    absent_days NUMERIC DEFAULT 0,
    half_days NUMERIC DEFAULT 0,
    leave_days NUMERIC DEFAULT 0,
    paid_leave_days NUMERIC DEFAULT 0,
    unpaid_leave_days NUMERIC DEFAULT 0,
    weekly_off_days NUMERIC DEFAULT 0,
    holiday_days NUMERIC DEFAULT 0,
    lop_days NUMERIC DEFAULT 0,
    
    worked_hours NUMERIC DEFAULT 0,
    regular_hours NUMERIC DEFAULT 0,
    ot_hours NUMERIC DEFAULT 0,
    approved_ot_hours NUMERIC DEFAULT 0,
    
    late_minutes INT DEFAULT 0,
    late_count INT DEFAULT 0,
    early_minutes INT DEFAULT 0,
    early_count INT DEFAULT 0,
    missing_punch_count INT DEFAULT 0,
    
    status_summary JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),

    CONSTRAINT uk_payroll_attendance_snapshot UNIQUE (company_id, attendance_period_id, employee_id)
);

ALTER TABLE public.payroll_attendance_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payroll_attendance_snapshots' AND policyname = 'Tenant Isolation'
    ) THEN
        CREATE POLICY "Tenant Isolation" ON public.payroll_attendance_snapshots 
            USING (company_id = get_my_company_id());
    END IF;
END $$;


-- ========================================================
-- 5. VARIABLE INPUTS (ALLOWANCES & DEDUCTIONS) TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.payroll_variable_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
    month_year TEXT NOT NULL, -- 'YYYY-MM'
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_code TEXT,
    employee_name TEXT,
    input_type TEXT NOT NULL CHECK (input_type IN ('ALLOWANCE', 'DEDUCTION')),
    component_id BIGINT REFERENCES public.org_salary_components(id) ON DELETE SET NULL,
    component_code TEXT NOT NULL,
    component_name TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    effective_date DATE DEFAULT CURRENT_DATE,
    reference TEXT,
    remarks TEXT,
    status TEXT DEFAULT 'VALID' CHECK (status IN ('VALID', 'INVALID', 'WARNING')),
    validation_notes TEXT,
    is_locked BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.payroll_variable_inputs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payroll_variable_inputs' AND policyname = 'Tenant Isolation'
    ) THEN
        CREATE POLICY "Tenant Isolation" ON public.payroll_variable_inputs 
            USING (company_id = get_my_company_id());
    END IF;
END $$;


-- ========================================================
-- 6. EXTEND PAYROLL_RUNS & PAYROLL_RECORDS
-- ========================================================
ALTER TABLE public.payroll_runs
    ADD COLUMN IF NOT EXISTS month_year TEXT,
    ADD COLUMN IF NOT EXISTS attendance_period_id UUID REFERENCES public.attendance_periods(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS total_gross NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_basic NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_fixed_allowances NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_variable_allowances NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_variable_deductions NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_lop_deductions NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_ot_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_loan_deductions NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_net_pay NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS preprocessed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS preprocessed_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS lock_reason TEXT;

ALTER TABLE public.payroll_records
    ADD COLUMN IF NOT EXISTS payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS attendance_snapshot_id UUID REFERENCES public.payroll_attendance_snapshots(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS working_days NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS present_days NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gross_salary NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS variable_deduction NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lop_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS approved_ot_hours NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS salary_breakdown JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS exceptions JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS has_exception BOOLEAN DEFAULT false;


-- ========================================================
-- 7. AUDIT TRAIL TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.payroll_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    module TEXT NOT NULL, -- 'ATTENDANCE' or 'PAYROLL'
    period_id UUID,
    month_year TEXT,
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE public.payroll_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payroll_audit_logs' AND policyname = 'Tenant Isolation'
    ) THEN
        CREATE POLICY "Tenant Isolation" ON public.payroll_audit_logs 
            USING (company_id = get_my_company_id());
    END IF;
END $$;


-- ========================================================
-- 8. RPC: EXECUTE ATTENDANCE PROCESSING
-- ========================================================
CREATE OR REPLACE FUNCTION public.rpc_execute_attendance_processing(
    p_company_id UUID,
    p_month_year TEXT, -- 'YYYY-MM'
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year INT;
    v_month INT;
    v_start_date DATE;
    v_end_date DATE;
    v_period_id UUID;
    v_period_code TEXT;
    v_period_name TEXT;
    v_recalc_res JSONB;
    v_prev_status TEXT := 'DRAFT';
BEGIN
    v_year := split_part(p_month_year, '-', 1)::INT;
    v_month := split_part(p_month_year, '-', 2)::INT;
    v_start_date := make_date(v_year, v_month, 1);
    v_end_date := (v_start_date + interval '1 month' - interval '1 day')::DATE;
    v_period_code := 'ATT-' || p_month_year;
    v_period_name := to_char(v_start_date, 'FMMonth YYYY');

    -- Check or create attendance period
    SELECT id, status INTO v_period_id, v_prev_status
    FROM public.attendance_periods
    WHERE company_id = p_company_id AND code = v_period_code
    LIMIT 1;

    IF v_period_id IS NOT NULL AND v_prev_status = 'LOCKED' THEN
        RAISE EXCEPTION 'Cannot process attendance: Month is LOCKED.' USING ERRCODE = 'P0001';
    END IF;

    IF v_period_id IS NULL THEN
        INSERT INTO public.attendance_periods (
            company_id, name, code, start_date, end_date, year, month,
            status, processed_by, processed_at
        ) VALUES (
            p_company_id, v_period_name, v_period_code, v_start_date, v_end_date, v_year, v_month,
            'PROCESSING', p_user_id, now()
        )
        RETURNING id INTO v_period_id;
    ELSE
        UPDATE public.attendance_periods SET
            status = 'PROCESSING',
            processed_by = p_user_id,
            processed_at = now()
        WHERE id = v_period_id;
    END IF;

    -- Execute core calculation engine
    v_recalc_res := public.rpc_recalculate_attendance_shift_rules(p_company_id, v_start_date, v_end_date);

    -- Mark records as evaluated & assign period id
    UPDATE public.attendance SET
        is_processed = true,
        attendance_period_id = v_period_id
    WHERE company_id = p_company_id 
      AND date BETWEEN v_start_date AND v_end_date;

    -- Transition period to REVIEW
    UPDATE public.attendance_periods SET
        status = 'REVIEW'
    WHERE id = v_period_id;

    -- Audit Log
    INSERT INTO public.payroll_audit_logs (
        company_id, module, period_id, month_year, action,
        previous_status, new_status, metadata, user_id
    ) VALUES (
        p_company_id, 'ATTENDANCE', v_period_id, p_month_year, 'ATTENDANCE_PROCESSED',
        v_prev_status, 'REVIEW', v_recalc_res, p_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'period_id', v_period_id,
        'status', 'REVIEW',
        'recalc_details', v_recalc_res
    );
END;
$$;


-- ========================================================
-- 9. RPC: FINALIZE ATTENDANCE PERIOD
-- ========================================================
CREATE OR REPLACE FUNCTION public.rpc_finalize_attendance_period(
    p_company_id UUID,
    p_period_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period RECORD;
    v_summary JSONB;
    v_total_emp INT := 0;
    v_total_present INT := 0;
    v_total_absent INT := 0;
    v_total_leave INT := 0;
    v_total_half INT := 0;
    v_total_off INT := 0;
    v_total_holiday INT := 0;
    v_total_hours NUMERIC := 0;
    v_total_ot NUMERIC := 0;
    v_missing_punches INT := 0;
BEGIN
    SELECT * INTO v_period
    FROM public.attendance_periods
    WHERE id = p_period_id AND company_id = p_company_id;

    IF v_period IS NULL THEN
        RAISE EXCEPTION 'Attendance period not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_period.status = 'LOCKED' THEN
        RAISE EXCEPTION 'Period is already locked.' USING ERRCODE = 'P0001';
    END IF;

    -- Aggregate summary
    SELECT 
        COUNT(DISTINCT employee_id),
        COUNT(*) FILTER (WHERE status = 'Present'),
        COUNT(*) FILTER (WHERE status = 'Absent'),
        COUNT(*) FILTER (WHERE status IN ('On Leave', 'Leave')),
        COUNT(*) FILTER (WHERE status = 'Half Day'),
        COUNT(*) FILTER (WHERE status = 'Weekend'),
        COUNT(*) FILTER (WHERE status = 'Holiday'),
        COALESCE(SUM(total_hours), 0),
        COALESCE(SUM(ot_hours), 0),
        COUNT(*) FILTER (WHERE check_in IS NOT NULL AND check_out IS NULL)
    INTO 
        v_total_emp, v_total_present, v_total_absent, v_total_leave,
        v_total_half, v_total_off, v_total_holiday, v_total_hours,
        v_total_ot, v_missing_punches
    FROM public.attendance
    WHERE company_id = p_company_id AND date BETWEEN v_period.start_date AND v_period.end_date;

    v_summary := jsonb_build_object(
        'total_employees', v_total_emp,
        'present_days', v_total_present,
        'absent_days', v_total_absent,
        'leave_days', v_total_leave,
        'half_days', v_total_half,
        'weekly_off_days', v_total_off,
        'holiday_days', v_total_holiday,
        'total_worked_hours', v_total_hours,
        'total_ot_hours', v_total_ot,
        'missing_punches', v_missing_punches
    );

    UPDATE public.attendance_periods SET
        status = 'FINALIZED',
        finalized_by = p_user_id,
        finalized_at = now(),
        summary_snapshot = v_summary
    WHERE id = p_period_id;

    -- Audit Log
    INSERT INTO public.payroll_audit_logs (
        company_id, module, period_id, month_year, action,
        previous_status, new_status, metadata, user_id
    ) VALUES (
        p_company_id, 'ATTENDANCE', p_period_id, v_period.code, 'ATTENDANCE_FINALIZED',
        v_period.status, 'FINALIZED', v_summary, p_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'period_id', p_period_id,
        'status', 'FINALIZED',
        'summary', v_summary
    );
END;
$$;


-- ========================================================
-- 10. RPC: LOCK ATTENDANCE PERIOD
-- ========================================================
CREATE OR REPLACE FUNCTION public.rpc_lock_attendance_period(
    p_company_id UUID,
    p_period_id UUID,
    p_lock_reason TEXT DEFAULT 'Final approved for Payroll',
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period RECORD;
BEGIN
    SELECT * INTO v_period
    FROM public.attendance_periods
    WHERE id = p_period_id AND company_id = p_company_id;

    IF v_period IS NULL THEN
        RAISE EXCEPTION 'Attendance period not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_period.status != 'FINALIZED' AND v_period.status != 'PROCESSED' THEN
        RAISE EXCEPTION 'Only finalized attendance periods can be locked.' USING ERRCODE = 'P0003';
    END IF;

    UPDATE public.attendance_periods SET
        status = 'LOCKED',
        locked_by = p_user_id,
        locked_at = now(),
        lock_reason = p_lock_reason
    WHERE id = p_period_id;

    -- Audit Log
    INSERT INTO public.payroll_audit_logs (
        company_id, module, period_id, month_year, action,
        previous_status, new_status, reason, user_id
    ) VALUES (
        p_company_id, 'ATTENDANCE', p_period_id, v_period.code, 'ATTENDANCE_LOCKED',
        v_period.status, 'LOCKED', p_lock_reason, p_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'period_id', p_period_id,
        'status', 'LOCKED'
    );
END;
$$;


-- ========================================================
-- 11. RPC: REOPEN ATTENDANCE PERIOD
-- ========================================================
CREATE OR REPLACE FUNCTION public.rpc_reopen_attendance_period(
    p_company_id UUID,
    p_period_id UUID,
    p_reopen_reason TEXT,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period RECORD;
    v_payroll_finalized BOOLEAN := false;
BEGIN
    IF p_reopen_reason IS NULL OR length(trim(p_reopen_reason)) < 5 THEN
        RAISE EXCEPTION 'A mandatory reopen reason (minimum 5 characters) is required.' USING ERRCODE = 'P0004';
    END IF;

    SELECT * INTO v_period
    FROM public.attendance_periods
    WHERE id = p_period_id AND company_id = p_company_id;

    IF v_period IS NULL THEN
        RAISE EXCEPTION 'Attendance period not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Protect against reopening if Payroll has already been finalized!
    SELECT EXISTS (
        SELECT 1 FROM public.payroll_runs
        WHERE company_id = p_company_id
          AND (attendance_period_id = p_period_id OR month_year = to_char(v_period.start_date, 'YYYY-MM'))
          AND status IN ('FINALIZED', 'LOCKED', 'COMPLETED', 'PAID')
    ) INTO v_payroll_finalized;

    IF v_payroll_finalized THEN
        RAISE EXCEPTION 'Cannot reopen attendance: Payroll for this period has already been FINALIZED. Reverse payroll first.'
            USING ERRCODE = 'P0005';
    END IF;

    UPDATE public.attendance_periods SET
        status = 'REOPENED',
        reopened_by = p_user_id,
        reopened_at = now(),
        reopen_reason = p_reopen_reason
    WHERE id = p_period_id;

    -- Audit Log
    INSERT INTO public.payroll_audit_logs (
        company_id, module, period_id, month_year, action,
        previous_status, new_status, reason, user_id
    ) VALUES (
        p_company_id, 'ATTENDANCE', p_period_id, v_period.code, 'ATTENDANCE_REOPENED',
        v_period.status, 'REOPENED', p_reopen_reason, p_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'period_id', p_period_id,
        'status', 'REOPENED'
    );
END;
$$;


-- ========================================================
-- 12. RPC: TRANSFER ATTENDANCE TO PAYROLL (SNAPSHOT LAYER)
-- ========================================================
CREATE OR REPLACE FUNCTION public.rpc_transfer_attendance_to_payroll(
    p_company_id UUID,
    p_attendance_period_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period RECORD;
    v_month_year_text TEXT;
    v_year INT;
    v_month INT;
    v_days_in_month INT;
    v_run_id UUID;
    v_emp RECORD;
    v_emp_count INT := 0;
    
    -- Metrics per employee
    v_cal_days NUMERIC;
    v_work_days NUMERIC;
    v_pres_days NUMERIC;
    v_abs_days NUMERIC;
    v_half_days NUMERIC;
    v_leave_days NUMERIC;
    v_paid_leave NUMERIC;
    v_unpaid_leave NUMERIC;
    v_off_days NUMERIC;
    v_holiday_days NUMERIC;
    v_lop_days NUMERIC;
    v_worked_hrs NUMERIC;
    v_ot_hrs NUMERIC;
    v_approved_ot_hrs NUMERIC;
    v_late_mins INT;
    v_late_cnt INT;
    v_early_mins INT;
    v_early_cnt INT;
    v_miss_cnt INT;
BEGIN
    SELECT * INTO v_period
    FROM public.attendance_periods
    WHERE id = p_attendance_period_id AND company_id = p_company_id;

    IF v_period IS NULL THEN
        RAISE EXCEPTION 'Attendance period not found.' USING ERRCODE = 'P0002';
    END IF;

    -- CRITICAL BUSINESS RULE: Attendance must be FINALIZED or LOCKED!
    IF v_period.status NOT IN ('FINALIZED', 'LOCKED', 'PROCESSED') THEN
        RAISE EXCEPTION 'Cannot transfer attendance: Period must be FINALIZED or LOCKED by HR first. Current status is %.', v_period.status
            USING ERRCODE = 'P0006';
    END IF;

    v_year := EXTRACT(YEAR FROM v_period.start_date)::INT;
    v_month := EXTRACT(MONTH FROM v_period.start_date)::INT;
    v_month_year_text := to_char(v_period.start_date, 'YYYY-MM');
    v_days_in_month := EXTRACT(DAY FROM v_period.end_date)::INT;

    -- 1. Create or Find Payroll Run
    SELECT id INTO v_run_id
    FROM public.payroll_runs
    WHERE company_id = p_company_id 
      AND (attendance_period_id = p_attendance_period_id OR month_year = v_month_year_text)
    LIMIT 1;

    IF v_run_id IS NULL THEN
        INSERT INTO public.payroll_runs (
            company_id, name, period_start, period_end, month_year,
            attendance_period_id, status
        ) VALUES (
            p_company_id, to_char(v_period.start_date, 'FMMonth YYYY') || ' Payroll',
            v_period.start_date, v_period.end_date, v_month_year_text,
            p_attendance_period_id, 'ATTENDANCE_IMPORTED'
        )
        RETURNING id INTO v_run_id;
    ELSE
        UPDATE public.payroll_runs SET
            attendance_period_id = p_attendance_period_id,
            status = 'ATTENDANCE_IMPORTED'
        WHERE id = v_run_id;
    END IF;

    -- 2. Snapshot attendance data for all active employees
    FOR v_emp IN 
        SELECT id, name, employee_code, join_date
        FROM public.employees
        WHERE company_id = p_company_id 
          AND status = 'Active'
          AND join_date <= v_period.end_date
    LOOP
        v_cal_days := v_days_in_month;

        -- Count categorized days
        SELECT 
            COUNT(*) FILTER (WHERE status = 'Present'),
            COUNT(*) FILTER (WHERE status = 'Absent'),
            COUNT(*) FILTER (WHERE status = 'Half Day'),
            COUNT(*) FILTER (WHERE status IN ('On Leave', 'Leave')),
            COUNT(*) FILTER (WHERE status = 'Weekend'),
            COUNT(*) FILTER (WHERE status = 'Holiday'),
            COALESCE(SUM(total_hours), 0),
            COALESCE(SUM(ot_hours), 0),
            COALESCE(SUM(late_minutes), 0),
            COUNT(*) FILTER (WHERE late_minutes > 0),
            COALESCE(SUM(early_minutes), 0),
            COUNT(*) FILTER (WHERE early_minutes > 0),
            COUNT(*) FILTER (WHERE check_in IS NOT NULL AND check_out IS NULL)
        INTO 
            v_pres_days, v_abs_days, v_half_days, v_leave_days,
            v_off_days, v_holiday_days, v_worked_hrs, v_ot_hrs,
            v_late_mins, v_late_cnt, v_early_mins, v_early_cnt, v_miss_cnt
        FROM public.attendance
        WHERE company_id = p_company_id 
          AND employee_id = v_emp.id 
          AND date BETWEEN v_period.start_date AND v_period.end_date;

        -- Paid vs Unpaid Leaves
        SELECT 
            COALESCE(SUM(CASE WHEN lt.is_paid = true THEN l.days ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN lt.is_paid = false THEN l.days ELSE 0 END), 0)
        INTO v_paid_leave, v_unpaid_leave
        FROM public.leaves l
        LEFT JOIN public.leave_types lt ON l.leave_type_id = lt.id
        WHERE l.employee_id = v_emp.id 
          AND l.status = 'Approved'
          AND l.start_date <= v_period.end_date 
          AND l.end_date >= v_period.start_date;

        -- Approved Overtime
        SELECT COALESCE(SUM(approved_hours), 0)
        INTO v_approved_ot_hrs
        FROM public.overtime_requests
        WHERE employee_id = v_emp.id 
          AND company_id = p_company_id
          AND status = 'Approved'
          AND request_date BETWEEN v_period.start_date AND v_period.end_date;

        -- LOP Days = Absent + Half Days * 0.5 + Unpaid Leaves
        v_lop_days := v_abs_days + (v_half_days * 0.5) + v_unpaid_leave;

        -- Pro-rate for mid-month joinees
        IF v_emp.join_date > v_period.start_date THEN
            v_lop_days := v_lop_days + (EXTRACT(DAY FROM v_emp.join_date)::INT - 1);
        END IF;

        v_work_days := GREATEST(0, v_cal_days - v_off_days - v_holiday_days);

        -- Upsert snapshot
        INSERT INTO public.payroll_attendance_snapshots (
            company_id, attendance_period_id, employee_id, year, month, month_year,
            calendar_days, working_days, present_days, absent_days, half_days,
            leave_days, paid_leave_days, unpaid_leave_days, weekly_off_days, holiday_days,
            lop_days, worked_hours, ot_hours, approved_ot_hours,
            late_minutes, late_count, early_minutes, early_count, missing_punch_count,
            created_by
        ) VALUES (
            p_company_id, p_attendance_period_id, v_emp.id, v_year, v_month, v_month_year_text,
            v_cal_days, v_work_days, v_pres_days, v_abs_days, v_half_days,
            v_leave_days, v_paid_leave, v_unpaid_leave, v_off_days, v_holiday_days,
            v_lop_days, v_worked_hrs, v_ot_hrs, v_approved_ot_hrs,
            v_late_mins, v_late_cnt, v_early_mins, v_early_cnt, v_miss_cnt,
            p_user_id
        )
        ON CONFLICT (company_id, attendance_period_id, employee_id)
        DO UPDATE SET
            calendar_days = EXCLUDED.calendar_days,
            working_days = EXCLUDED.working_days,
            present_days = EXCLUDED.present_days,
            absent_days = EXCLUDED.absent_days,
            half_days = EXCLUDED.half_days,
            leave_days = EXCLUDED.leave_days,
            paid_leave_days = EXCLUDED.paid_leave_days,
            unpaid_leave_days = EXCLUDED.unpaid_leave_days,
            weekly_off_days = EXCLUDED.weekly_off_days,
            holiday_days = EXCLUDED.holiday_days,
            lop_days = EXCLUDED.lop_days,
            worked_hours = EXCLUDED.worked_hours,
            ot_hours = EXCLUDED.ot_hours,
            approved_ot_hours = EXCLUDED.approved_ot_hours,
            late_minutes = EXCLUDED.late_minutes,
            late_count = EXCLUDED.late_count,
            early_minutes = EXCLUDED.early_minutes,
            early_count = EXCLUDED.early_count,
            missing_punch_count = EXCLUDED.missing_punch_count;

        v_emp_count := v_emp_count + 1;
    END LOOP;

    -- Update Period transfer status
    UPDATE public.attendance_periods SET
        payroll_transfer_status = 'TRANSFERRED',
        payroll_transfer_date = now()
    WHERE id = p_attendance_period_id;

    -- Audit Log
    INSERT INTO public.payroll_audit_logs (
        company_id, module, period_id, month_year, action,
        previous_status, new_status, metadata, user_id
    ) VALUES (
        p_company_id, 'PAYROLL', v_run_id, v_month_year_text, 'PAYROLL_ATTENDANCE_IMPORTED',
        v_period.status, 'ATTENDANCE_IMPORTED', 
        jsonb_build_object('employees_snapshotted', v_emp_count, 'payroll_run_id', v_run_id),
        p_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'payroll_run_id', v_run_id,
        'attendance_period_id', p_attendance_period_id,
        'employees_snapshotted', v_emp_count,
        'status', 'ATTENDANCE_IMPORTED'
    );
END;
$$;


-- ========================================================
-- 13. RPC: SALARY PRE-PROCESSING (PREVIEW & EXCEPTIONS)
-- ========================================================
CREATE OR REPLACE FUNCTION public.rpc_preprocess_salary(
    p_company_id UUID,
    p_payroll_run_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_run RECORD;
    v_snap RECORD;
    v_emp RECORD;
    v_base_salary NUMERIC;
    v_daily_rate NUMERIC;
    v_payable_days NUMERIC;
    v_lop_deduction NUMERIC;
    v_fixed_allowance NUMERIC;
    v_var_allowance NUMERIC;
    v_var_deduction NUMERIC;
    v_ot_amount NUMERIC;
    v_loan_deduction NUMERIC;
    v_gross_pay NUMERIC;
    v_net_pay NUMERIC;
    
    v_exceptions JSONB;
    v_has_exception BOOLEAN;
    v_record_id UUID;
    v_tot_processed INT := 0;
    v_tot_exceptions INT := 0;
BEGIN
    SELECT * INTO v_run
    FROM public.payroll_runs
    WHERE id = p_payroll_run_id AND company_id = p_company_id;

    IF v_run IS NULL THEN
        RAISE EXCEPTION 'Payroll run not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Verify attendance snapshot exists
    IF NOT EXISTS (
        SELECT 1 FROM public.payroll_attendance_snapshots
        WHERE company_id = p_company_id AND month_year = v_run.month_year
    ) THEN
        RAISE EXCEPTION 'Cannot preprocess salary: Attendance snapshot does not exist. Import locked attendance first.'
            USING ERRCODE = 'P0007';
    END IF;

    -- Loop through active employees with snapshots
    FOR v_snap IN
        SELECT s.*, e.name, e.employee_code, e.salary_amount, e.bank_name, e.account_number
        FROM public.payroll_attendance_snapshots s
        JOIN public.employees e ON s.employee_id = e.id
        WHERE s.company_id = p_company_id AND s.month_year = v_run.month_year
    LOOP
        v_exceptions := '[]'::jsonb;
        v_has_exception := false;

        v_base_salary := COALESCE(v_snap.salary_amount, 0);
        IF v_base_salary <= 0 THEN
            v_exceptions := v_exceptions || jsonb_build_object('type', 'ZERO_SALARY', 'message', 'Basic salary is 0 or unassigned in employee master');
            v_has_exception := true;
        END IF;

        IF v_snap.account_number IS NULL OR length(trim(v_snap.account_number)) = 0 THEN
            v_exceptions := v_exceptions || jsonb_build_object('type', 'MISSING_BANK', 'message', 'Bank account missing for WPS export');
        END IF;

        v_daily_rate := CASE WHEN v_snap.calendar_days > 0 THEN v_base_salary / v_snap.calendar_days ELSE 0 END;
        v_payable_days := GREATEST(0, v_snap.calendar_days - v_snap.lop_days);
        v_lop_deduction := ROUND((v_daily_rate * v_snap.lop_days)::numeric, 2);

        -- Fixed allowances
        SELECT COALESCE(SUM(amount), 0) INTO v_fixed_allowance
        FROM public.employee_salary_components
        WHERE employee_id = v_snap.employee_id 
          AND company_id = p_company_id 
          AND component_type = 'EARNING' 
          AND is_active = true;

        -- Variable allowances
        SELECT COALESCE(SUM(amount), 0) INTO v_var_allowance
        FROM public.payroll_variable_inputs
        WHERE employee_id = v_snap.employee_id 
          AND company_id = p_company_id 
          AND month_year = v_run.month_year 
          AND input_type = 'ALLOWANCE';

        -- Variable deductions
        SELECT COALESCE(SUM(amount), 0) INTO v_var_deduction
        FROM public.payroll_variable_inputs
        WHERE employee_id = v_snap.employee_id 
          AND company_id = p_company_id 
          AND month_year = v_run.month_year 
          AND input_type = 'DEDUCTION';

        -- OT Calculation (1.5x on normal days from snapshot)
        v_ot_amount := ROUND((v_snap.ot_hours * (v_daily_rate / 8.0) * 1.5)::numeric, 2);

        -- Loan EMI
        SELECT COALESCE(SUM(LEAST(emi_amount, balance)), 0) INTO v_loan_deduction
        FROM public.payroll_loans
        WHERE employee_id = v_snap.employee_id
          AND company_id = p_company_id
          AND status = 'Active'
          AND start_date <= v_run.period_end;

        v_gross_pay := ROUND((v_daily_rate * v_payable_days)::numeric, 2) + v_fixed_allowance + v_var_allowance + v_ot_amount;
        v_net_pay := v_gross_pay - v_var_deduction - v_loan_deduction;

        IF v_net_pay < 0 THEN
            v_exceptions := v_exceptions || jsonb_build_object('type', 'NEGATIVE_NET', 'message', 'Deductions exceed earnings resulting in negative net pay');
            v_has_exception := true;
        END IF;

        -- Upsert into payroll_records
        SELECT id INTO v_record_id
        FROM public.payroll_records
        WHERE company_id = p_company_id AND employee_id = v_snap.employee_id AND month_year = v_run.month_year
        LIMIT 1;

        IF v_record_id IS NULL THEN
            INSERT INTO public.payroll_records (
                company_id, employee_id, month_year, payroll_run_id, attendance_snapshot_id,
                basic_salary, gross_earning, total_deduction, net_pay,
                status, ot_amount, ot_hours, loan_deduction, payable_days, lop_days,
                fixed_allowance, variable_allowance, variable_deduction, lop_amount,
                working_days, present_days, exceptions, has_exception
            ) VALUES (
                p_company_id, v_snap.employee_id, v_run.month_year, p_payroll_run_id, v_snap.id,
                v_base_salary, v_gross_pay, (v_var_deduction + v_loan_deduction), v_net_pay,
                'PREPROCESSED', v_ot_amount, v_snap.ot_hours, v_loan_deduction, v_payable_days, v_snap.lop_days,
                v_fixed_allowance, v_var_allowance, v_var_deduction, v_lop_deduction,
                v_snap.working_days, v_snap.present_days, v_exceptions, v_has_exception
            );
        ELSE
            UPDATE public.payroll_records SET
                payroll_run_id = p_payroll_run_id,
                attendance_snapshot_id = v_snap.id,
                basic_salary = v_base_salary,
                gross_earning = v_gross_pay,
                total_deduction = (v_var_deduction + v_loan_deduction),
                net_pay = v_net_pay,
                status = 'PREPROCESSED',
                ot_amount = v_ot_amount,
                ot_hours = v_snap.ot_hours,
                loan_deduction = v_loan_deduction,
                payable_days = v_payable_days,
                lop_days = v_snap.lop_days,
                fixed_allowance = v_fixed_allowance,
                variable_allowance = v_var_allowance,
                variable_deduction = v_var_deduction,
                lop_amount = v_lop_deduction,
                working_days = v_snap.working_days,
                present_days = v_snap.present_days,
                exceptions = v_exceptions,
                has_exception = v_has_exception
            WHERE id = v_record_id;
        END IF;

        v_tot_processed := v_tot_processed + 1;
        IF v_has_exception THEN v_tot_exceptions := v_tot_exceptions + 1; END IF;
    END LOOP;

    -- Update Run totals
    UPDATE public.payroll_runs SET
        status = 'PREPROCESSING',
        preprocessed_at = now(),
        preprocessed_by = p_user_id,
        total_amount = (SELECT COALESCE(SUM(net_pay), 0) FROM public.payroll_records WHERE payroll_run_id = p_payroll_run_id),
        total_gross = (SELECT COALESCE(SUM(gross_earning), 0) FROM public.payroll_records WHERE payroll_run_id = p_payroll_run_id),
        total_net_pay = (SELECT COALESCE(SUM(net_pay), 0) FROM public.payroll_records WHERE payroll_run_id = p_payroll_run_id)
    WHERE id = p_payroll_run_id;

    -- Audit Log
    INSERT INTO public.payroll_audit_logs (
        company_id, module, period_id, month_year, action,
        previous_status, new_status, metadata, user_id
    ) VALUES (
        p_company_id, 'PAYROLL', p_payroll_run_id, v_run.month_year, 'SALARY_PREPROCESSED',
        v_run.status, 'PREPROCESSING',
        jsonb_build_object('total_employees', v_tot_processed, 'exceptions_count', v_tot_exceptions),
        p_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'payroll_run_id', p_payroll_run_id,
        'employees_processed', v_tot_processed,
        'exceptions_count', v_tot_exceptions,
        'status', 'PREPROCESSING'
    );
END;
$$;


-- ========================================================
-- 14. RPC: PROCESS FINAL SALARY
-- ========================================================
CREATE OR REPLACE FUNCTION public.rpc_process_payroll_final(
    p_company_id UUID,
    p_payroll_run_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_run RECORD;
BEGIN
    SELECT * INTO v_run
    FROM public.payroll_runs
    WHERE id = p_payroll_run_id AND company_id = p_company_id;

    IF v_run IS NULL THEN
        RAISE EXCEPTION 'Payroll run not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_run.status IN ('FINALIZED', 'LOCKED', 'COMPLETED', 'PAID') THEN
        RAISE EXCEPTION 'Cannot reprocess: Payroll run is already finalized or locked.' USING ERRCODE = 'P0008';
    END IF;

    -- Mark records as CALCULATED
    UPDATE public.payroll_records SET
        status = 'CALCULATED'
    WHERE payroll_run_id = p_payroll_run_id;

    -- Update run status to SALARY_PROCESSED
    UPDATE public.payroll_runs SET
        status = 'SALARY_PROCESSED',
        total_amount = (SELECT COALESCE(SUM(net_pay), 0) FROM public.payroll_records WHERE payroll_run_id = p_payroll_run_id),
        total_net_pay = (SELECT COALESCE(SUM(net_pay), 0) FROM public.payroll_records WHERE payroll_run_id = p_payroll_run_id),
        total_gross = (SELECT COALESCE(SUM(gross_earning), 0) FROM public.payroll_records WHERE payroll_run_id = p_payroll_run_id)
    WHERE id = p_payroll_run_id;

    -- Audit Log
    INSERT INTO public.payroll_audit_logs (
        company_id, module, period_id, month_year, action,
        previous_status, new_status, user_id
    ) VALUES (
        p_company_id, 'PAYROLL', p_payroll_run_id, v_run.month_year, 'SALARY_PROCESSED',
        v_run.status, 'SALARY_PROCESSED', p_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'payroll_run_id', p_payroll_run_id,
        'status', 'SALARY_PROCESSED'
    );
END;
$$;


-- ========================================================
-- 15. RPC: FINALIZE & LOCK PAYROLL RUN
-- ========================================================
CREATE OR REPLACE FUNCTION public.rpc_finalize_payroll_run(
    p_company_id UUID,
    p_payroll_run_id UUID,
    p_lock_reason TEXT DEFAULT 'Executive finalized and locked for payout',
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_run RECORD;
BEGIN
    SELECT * INTO v_run
    FROM public.payroll_runs
    WHERE id = p_payroll_run_id AND company_id = p_company_id;

    IF v_run IS NULL THEN
        RAISE EXCEPTION 'Payroll run not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Lock variable inputs for this run
    UPDATE public.payroll_variable_inputs SET
        is_locked = true,
        payroll_run_id = p_payroll_run_id
    WHERE company_id = p_company_id AND month_year = v_run.month_year;

    -- Lock payroll records
    UPDATE public.payroll_records SET
        status = 'LOCKED'
    WHERE payroll_run_id = p_payroll_run_id;

    -- Finalize run
    UPDATE public.payroll_runs SET
        status = 'FINALIZED',
        finalized_at = now(),
        finalized_by = p_user_id,
        locked_at = now(),
        locked_by = p_user_id,
        lock_reason = p_lock_reason
    WHERE id = p_payroll_run_id;

    -- Audit Log
    INSERT INTO public.payroll_audit_logs (
        company_id, module, period_id, month_year, action,
        previous_status, new_status, reason, user_id
    ) VALUES (
        p_company_id, 'PAYROLL', p_payroll_run_id, v_run.month_year, 'PAYROLL_FINALIZED',
        v_run.status, 'FINALIZED', p_lock_reason, p_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'payroll_run_id', p_payroll_run_id,
        'status', 'FINALIZED'
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
