CREATE OR REPLACE FUNCTION public.rpc_generate_payroll(p_company_id uuid, p_month_year date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_run_id UUID;
    v_start_date DATE := p_month_year;
    v_end_date DATE := (p_month_year + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    v_days_in_month NUMERIC;
    v_emp RECORD;
    v_attendance_count NUMERIC;
    v_leave_count NUMERIC;
    v_payable_days NUMERIC;
    v_lop_days NUMERIC;
    v_gross_pay NUMERIC;
    v_base_salary NUMERIC;
    v_daily_rate NUMERIC;
    
    v_ot_hours NUMERIC;
    v_ot_amount NUMERIC;
    v_loan_deduction NUMERIC;
BEGIN
    -- 1. Validate / Create Payroll Run
    v_days_in_month := DATE_PART('day', v_end_date);
    
    SELECT id INTO v_run_id FROM public.payroll_runs 
    WHERE company_id = p_company_id AND period_start = v_start_date AND period_end = v_end_date
    LIMIT 1;

    IF v_run_id IS NULL THEN
        INSERT INTO public.payroll_runs (company_id, name, period_start, period_end, status)
        VALUES (p_company_id, TO_CHAR(v_start_date, 'Mon YYYY') || ' Payroll', v_start_date, v_end_date, 'DRAFT')
        RETURNING id INTO v_run_id;
    END IF;

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

        v_payable_days := v_days_in_month - v_lop_days;
        IF v_payable_days < 0 THEN v_payable_days := 0; END IF;

        -- Calculate Base Salary & Daily Rate
        v_base_salary := COALESCE(v_emp.salary_amount, 0);
        v_daily_rate := v_base_salary / v_days_in_month;
        
        -- OVERTIME AUTOMATION
        -- Assuming 8 hours standard. Summing any hours > 8. Rate = 1.5x hourly.
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

        -- Calculate Gross and Net
        -- Gross = Standard Prorated Salary + OT
        v_gross_pay := ROUND((v_daily_rate * v_payable_days)::numeric, 2) + v_ot_amount;
        
        -- Net = Gross - Deductions
        DECLARE
           v_net_pay NUMERIC := v_gross_pay - v_loan_deduction;
        BEGIN
            -- 7. Insert Record
            INSERT INTO public.payroll_records (
                company_id, payroll_run_id, employee_id,
                total_days, payable_days, lop_days,
                base_salary, gross_earning, total_deduction, net_pay,
                status, ot_amount, loan_deduction
            )
            VALUES (
                p_company_id, v_run_id, v_emp.id,
                v_days_in_month, v_payable_days, v_lop_days,
                v_base_salary, v_gross_pay, v_loan_deduction, v_net_pay,
                'CALCULATED', v_ot_amount, v_loan_deduction
            )
            ON CONFLICT (payroll_run_id, employee_id)
            DO UPDATE SET
                payable_days = EXCLUDED.payable_days,
                lop_days = EXCLUDED.lop_days,
                gross_earning = EXCLUDED.gross_earning,
                total_deduction = EXCLUDED.total_deduction,
                net_pay = EXCLUDED.net_pay,
                ot_amount = EXCLUDED.ot_amount,
                loan_deduction = EXCLUDED.loan_deduction,
                updated_at = now();
        END;
            
    END LOOP;

    -- Update Total
    UPDATE public.payroll_runs 
    SET total_amount = (SELECT SUM(net_pay) FROM public.payroll_records WHERE payroll_run_id = v_run_id)
    WHERE id = v_run_id;

    RETURN v_run_id;
END;
$function$;

NOTIFY pgrst, 'reload schema';
