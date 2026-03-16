-- Phase 11: Payroll Logic (RPC)

CREATE OR REPLACE FUNCTION public.rpc_generate_payroll(
    p_company_id UUID,
    p_month_year DATE -- First of the month, e.g., '2025-04-01'
)
RETURNS UUID -- Returns the ID of the payroll run
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
BEGIN
    -- 1. Validate / Create Payroll Run
    v_days_in_month := DATE_PART('day', v_end_date);
    
    INSERT INTO public.payroll_runs (company_id, month_year, status)
    VALUES (p_company_id, p_month_year, 'DRAFT')
    ON CONFLICT (company_id, month_year) 
    DO UPDATE SET updated_at = now()
    RETURNING id INTO v_run_id;

    -- 2. Loop through active employees
    FOR v_emp IN 
        SELECT id, salary_amount, join_date 
        FROM public.employees 
        WHERE company_id = p_company_id 
        AND status = 'Active' 
        AND join_date <= v_end_date
    LOOP
        -- 3. Calculate Attendance
        -- Count Present, Half Day (0.5), etc.
        SELECT COALESCE(SUM(
            CASE 
                WHEN status = 'Present' THEN 1
                WHEN status = 'Half Day' THEN 0.5
                ELSE 0
            END
        ), 0) INTO v_attendance_count
        FROM public.attendance
        WHERE employee_id = v_emp.id 
        AND date BETWEEN v_start_date AND v_end_date;

        -- 4. Calculate Approved Paid Leaves
        SELECT COALESCE(SUM(days), 0) INTO v_leave_count
        FROM public.leaves
        WHERE employee_id = v_emp.id 
        AND status = 'Approved'
        AND start_date >= v_start_date AND end_date <= v_end_date;  -- Simplified overlap logic

        -- 5. Calculate Payable Days
        -- Logic: Start with Days in Month. Subtract Unpaid/Absent.
        -- OR: Start with 0. Add Present + Leaves + Weekoffs/Holidays.
        -- SIMPLIFIED APPROACH for Phase 11: 
        -- Payable = Attendance + Leaves + (DaysInMonth - (Attendance+Leaves) IF NOT Absent?)
        -- Let's use specific "LOP" logic: DaysInMonth - LOP. 
        -- For now, let's assume standard month - absent days.
        -- We need to know "Absent" days explicitly or assume everything else is paid (Weekoff/Holiday).
        -- Let's assume everything is paid unless marked 'Absent' or 'Unpaid Leave'.
        
        -- Count explicit Absent days
        SELECT COALESCE(COUNT(*), 0) INTO v_lop_days
        FROM public.attendance
        WHERE employee_id = v_emp.id 
        AND date BETWEEN v_start_date AND v_end_date
        AND status IN ('Absent', 'On Leave'); -- If 'On Leave' check if it matches an approved paid leave? 
        -- This is complex. Let's simplify: 
        -- Payable = DaysInMonth - (Explicit Absent + Unpaid Leaves)
        
        -- Refined LOP Logic:
        -- 1. Count 'Absent' in attendance.
        -- 2. Count 'LOP' leaves.
        
        -- For MVP: Payable = v_days_in_month; (Assume full pay by default minus deviations)
        -- We don't have full holiday/weekoff calendar logic in logic yet. 
        -- Let's rely on 'Attendance Count' + 'Weekoffs'.
        -- Actually, cleanest for MVP: 
        -- Payable = v_attendance_count + v_leave_count + (v_days_in_month - (count of records)); 
        -- Wait, missing records = Present? Or Absent? Usually Absent if strict.
        -- Let's go with: Payable = v_days_in_month - v_lop_days.
        -- We need to calculate v_lop_days accurately.
        
        -- Let's set Payable Days = v_days_in_month (Optimistic)
        -- Then subtract days where attendance status = 'Absent'.
        SELECT COALESCE(COUNT(*), 0) INTO v_lop_days
        FROM public.attendance
        WHERE employee_id = v_emp.id 
        AND date BETWEEN v_start_date AND v_end_date
        AND status = 'Absent';

        -- Adjust for joining mid-month
        IF v_emp.join_date > v_start_date THEN
            v_lop_days := v_lop_days + (DATE_PART('day', v_emp.join_date::timestamp) - 1);
        END IF;

        v_payable_days := v_days_in_month - v_lop_days;
        
        IF v_payable_days < 0 THEN v_payable_days := 0; END IF;

        -- 6. Calculate Salary
        v_base_salary := COALESCE(v_emp.salary_amount, 0);
        v_daily_rate := v_base_salary / v_days_in_month;
        v_gross_pay := ROUND((v_daily_rate * v_payable_days)::numeric, 2);

        -- 7. Insert Record
        INSERT INTO public.payroll_records (
            company_id, payroll_run_id, employee_id,
            total_days, payable_days, lop_days,
            base_salary, gross_earning, total_deduction, net_pay,
            status
        )
        VALUES (
            p_company_id, v_run_id, v_emp.id,
            v_days_in_month, v_payable_days, v_lop_days,
            v_base_salary, v_gross_pay, 0, v_gross_pay, -- Deductions 0 for now
            'CALCULATED'
        )
        ON CONFLICT (payroll_run_id, employee_id)
        DO UPDATE SET
            payable_days = EXCLUDED.payable_days,
            lop_days = EXCLUDED.lop_days,
            gross_earning = EXCLUDED.gross_earning,
            net_pay = EXCLUDED.net_pay,
            updated_at = now();
            
    END LOOP;

    -- Update Total
    UPDATE public.payroll_runs 
    SET total_net_pay = (SELECT SUM(net_pay) FROM public.payroll_records WHERE payroll_run_id = v_run_id)
    WHERE id = v_run_id;

    RETURN v_run_id;
END;
$$;
