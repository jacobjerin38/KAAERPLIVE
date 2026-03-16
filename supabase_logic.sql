-- ==============================================================================
-- KAA ERP V1.1 - BUSINESS LOGIC (RPC & TRIGGERS)
-- PHASE B: MIGRATE LOGIC
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ATTENDANCE LOGIC
-- ------------------------------------------------------------------------------

-- RPC: Punch In / Punch Out Action
-- Handles the logic to toggle attendance state safely
DROP FUNCTION IF EXISTS rpc_punch_action;
CREATE OR REPLACE FUNCTION rpc_punch_action(p_employee_id UUID, p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_active_record_id UUID;
    v_current_status TEXT;
BEGIN
    -- Check for an open session (checked in but not checked out) for today
    SELECT id INTO v_active_record_id
    FROM attendance
    WHERE employee_id = p_employee_id
      AND date = v_today
      AND check_out IS NULL
    LIMIT 1;

    IF v_active_record_id IS NOT NULL THEN
        -- CLOCK OUT
        UPDATE attendance
        SET check_out = NOW(),
            total_hours = ROUND(EXTRACT(EPOCH FROM (NOW() - check_in))::numeric / 3600, 2)
        WHERE id = v_active_record_id;
        
        RETURN 'OUT';
    ELSE
        -- CLOCK IN
        INSERT INTO attendance (company_id, employee_id, date, check_in, status)
        VALUES (p_company_id, p_employee_id, v_today, NOW(), 'Present');
        
        RETURN 'IN';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: Mark All Present
-- Bulk inserts attendance for all active employees who don't have a record for the date
DROP FUNCTION IF EXISTS rpc_mark_all_present;
CREATE OR REPLACE FUNCTION rpc_mark_all_present(p_date DATE, p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Insert for employees who don't have a record for p_date
    WITH active_employees AS (
        SELECT id FROM employees
        WHERE company_id = p_company_id 
          AND status = 'Active'
    ),
    missing_attendance AS (
        SELECT ae.id 
        FROM active_employees ae
        WHERE NOT EXISTS (
            SELECT 1 FROM attendance a 
            WHERE a.employee_id = ae.id 
              AND a.date = p_date
        )
    )
    INSERT INTO attendance (company_id, employee_id, date, check_in, check_out, status, total_hours)
    SELECT 
        p_company_id,
        id,
        p_date,
        (p_date || ' 09:00:00')::TIMESTAMP WITH TIME ZONE, -- Default 9 AM
        (p_date || ' 18:00:00')::TIMESTAMP WITH TIME ZONE, -- Default 6 PM
        'Present',
        9.0
    FROM missing_attendance;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN 'Marked ' || v_count || ' employees as Present.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 2. LEAVE MANAGEMENT LOGIC
-- ------------------------------------------------------------------------------

-- Trigger Function: Update Leave Balance
DROP FUNCTION IF EXISTS handle_leave_approval CASCADE;
CREATE OR REPLACE FUNCTION handle_leave_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_days INTEGER;
    v_leave_type TEXT;
BEGIN
    -- Only proceed if status changed to Approved
    IF NEW.status = 'Approved' AND OLD.status != 'Approved' THEN
        
        -- simple calc: include start and end date
        v_days := (NEW.end_date - NEW.start_date) + 1;
        v_leave_type := LOWER(NEW.type); -- assuming 'casual', 'sick', 'privilege'

        -- Validate positive days
        IF v_days <= 0 THEN v_days := 1; END IF;

        -- Update Employee Balance
        -- Note: This assumes leave_balance is JSONB like {"casual": 10, ...}
        UPDATE employees
        SET leave_balance = jsonb_set(
            leave_balance,
            ARRAY[v_leave_type], 
            (COALESCE((leave_balance->>v_leave_type)::int, 0) - v_days)::text::jsonb
        )
        WHERE id = NEW.employee_id;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Definition
DROP TRIGGER IF EXISTS trigger_update_leave_balance ON leaves;
CREATE TRIGGER trigger_update_leave_balance
AFTER UPDATE ON leaves
FOR EACH ROW
EXECUTE FUNCTION handle_leave_approval();


-- ------------------------------------------------------------------------------
-- 3. WORKFLOW LOGIC (FOUNDATION)
-- ------------------------------------------------------------------------------

-- RPC: Submit Workflow Request
DROP FUNCTION IF EXISTS rpc_submit_workflow_request CASCADE;
CREATE OR REPLACE FUNCTION rpc_submit_workflow_request(p_workflow_id UUID, p_source_id TEXT, p_requester_id UUID)
RETURNS UUID AS $$
DECLARE
    v_req_id UUID;
    v_company_id UUID;
BEGIN
    SELECT company_id INTO v_company_id FROM workflows WHERE id = p_workflow_id;

    INSERT INTO workflow_requests (
        workflow_id, source_id, current_step, status, requester_id, company_id
    )
    VALUES (
        p_workflow_id, p_source_id, 1, 'PENDING', p_requester_id, v_company_id
    )
    RETURNING id INTO v_req_id;

    RETURN v_req_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Workflow Action (Approve/Reject)
DROP FUNCTION IF EXISTS rpc_workflow_action CASCADE;
CREATE OR REPLACE FUNCTION rpc_workflow_action(
    p_request_id UUID,
    p_action TEXT,
    p_comment TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_req RECORD;
    v_module TEXT;
    v_source_id UUID;
BEGIN
    SELECT * INTO v_req FROM workflow_requests WHERE id = p_request_id;
    
    IF v_req IS NULL THEN RETURN 'Request not found'; END IF;
    
    -- Update Workflow Request
    UPDATE workflow_requests 
    SET status = p_action 
    WHERE id = p_request_id;
    
    -- Sync to Source Table
    SELECT module INTO v_module FROM workflows WHERE id = v_req.workflow_id;
    v_source_id := v_req.source_id::UUID;

    IF v_module = 'Leaves' OR v_module = 'HRMS' THEN
        -- Try updating leaves first (if it matches)
        UPDATE leaves SET status = p_action, manager_comment = p_comment WHERE id = v_source_id;
    END IF;
    
    IF v_module = 'Resignation' OR v_module = 'Resignations' OR v_module = 'Exit' THEN
        UPDATE resignations SET status = p_action, manager_comment = p_comment WHERE id = v_source_id;
    END IF;

    RETURN 'Success';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER: Auto-start Workflow for Leaves
DROP FUNCTION IF EXISTS trigger_start_leave_workflow CASCADE;
CREATE OR REPLACE FUNCTION trigger_start_leave_workflow()
RETURNS TRIGGER AS $$
DECLARE
    v_workflow_id UUID;
BEGIN
    -- Attempt to find a workflow for 'Leaves'
    SELECT id INTO v_workflow_id FROM workflows 
    WHERE (module = 'Leaves' OR module = 'HRMS') 
      AND company_id = NEW.company_id 
      AND is_active = true 
    LIMIT 1;

    IF v_workflow_id IS NOT NULL THEN
        PERFORM rpc_submit_workflow_request(v_workflow_id, NEW.id::text, NEW.employee_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_start_leave_workflow ON leaves;
CREATE TRIGGER trg_start_leave_workflow
AFTER INSERT ON leaves
FOR EACH ROW
EXECUTE FUNCTION trigger_start_leave_workflow();

-- TRIGGER: Auto-start Workflow for Resignations
DROP FUNCTION IF EXISTS trigger_start_resignation_workflow CASCADE;
CREATE OR REPLACE FUNCTION trigger_start_resignation_workflow()
RETURNS TRIGGER AS $$
DECLARE
    v_workflow_id UUID;
BEGIN
    SELECT id INTO v_workflow_id FROM workflows 
    WHERE (module = 'Resignation' OR module = 'Exit') 
      AND company_id = NEW.company_id 
      AND is_active = true 
    LIMIT 1;

    IF v_workflow_id IS NOT NULL THEN
        PERFORM rpc_submit_workflow_request(v_workflow_id, NEW.id::text, NEW.employee_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_start_resignation_workflow ON resignations;
CREATE TRIGGER trg_start_resignation_workflow
AFTER INSERT ON resignations
FOR EACH ROW
EXECUTE FUNCTION trigger_start_resignation_workflow();

-- RPC: Get My Approvals
DROP FUNCTION IF EXISTS rpc_get_my_approvals CASCADE;
CREATE OR REPLACE FUNCTION rpc_get_my_approvals(p_user_id UUID)
RETURNS TABLE (
    request_id UUID,
    workflow_name TEXT,
    module TEXT,
    source_id TEXT,
    status TEXT,
    requester_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wr.id AS request_id,
        w.name AS workflow_name,
        w.module,
        wr.source_id,
        wr.status,
        p.full_name AS requester_name,
        wr.created_at
    FROM workflow_requests wr
    JOIN workflows w ON wr.workflow_id = w.id
    JOIN workflow_levels wl ON w.id = wl.workflow_id AND wr.current_step = wl.level_order
    JOIN profiles p ON wr.requester_id = p.id
    WHERE wr.status = 'PENDING'
      AND (
          -- 1. Direct User Assignment
          (wl.approver_type = 'USER' AND p_user_id::text = ANY(wl.approver_ids))
          OR
          -- 2. Role Assignment
          (wl.approver_type = 'ROLE' AND EXISTS (
              SELECT 1 FROM profiles up 
              WHERE up.id = p_user_id AND up.role = ANY(wl.approver_ids)
          ))
          OR
          -- 3. Reporting Manager (Dynamic)
          (wl.approver_type = 'MANAGER' AND EXISTS (
               SELECT 1 FROM employees requester_emp 
               WHERE requester_emp.profile_id = p.id -- requester's employee record
                 AND requester_emp.manager_id = (
                     SELECT cur_emp.id FROM employees cur_emp WHERE cur_emp.profile_id = p_user_id LIMIT 1
                 )
          ))
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
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
