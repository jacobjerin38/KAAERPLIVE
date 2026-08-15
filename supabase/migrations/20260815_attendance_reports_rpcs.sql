-- Migration: 20260815_attendance_reports_rpcs.sql
-- Description: Additive PostgreSQL reporting RPCs for Attendance Reports Suite
-- Live Data Safety: 100% Read-Only aggregation queries. Zero data mutations.

-- 1. Monthly Attendance Report RPC
CREATE OR REPLACE FUNCTION public.rpc_get_monthly_attendance_report(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_department_id BIGINT DEFAULT NULL,
    p_location_id BIGINT DEFAULT NULL,
    p_employee_id UUID DEFAULT NULL,
    p_shift_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_default_off_days TEXT;
    v_standard_hours NUMERIC;
BEGIN
    -- Fetch default weekly off days from org_attendance_settings
    SELECT COALESCE(oas.default_weekly_off_days, '5,6')
    INTO v_default_off_days
    FROM public.org_attendance_settings oas
    WHERE oas.company_id = p_company_id
    LIMIT 1;

    -- Fetch standard working hours from attendance_settings
    SELECT COALESCE(ast.standard_hours, 8.0)
    INTO v_standard_hours
    FROM public.attendance_settings ast
    WHERE ast.company_id = p_company_id
    LIMIT 1;

    IF v_default_off_days IS NULL THEN
        v_default_off_days := '5,6';
    END IF;
    IF v_standard_hours IS NULL THEN
        v_standard_hours := 8.0;
    END IF;

    WITH emp_list AS (
        SELECT 
            e.id,
            e.employee_code,
            e.name,
            e.status,
            e.department_id,
            COALESCE(d.name, e.department, 'General') AS department_name,
            COALESCE(e.designation, '') AS designation,
            COALESCE(loc.name, '') AS location_name,
            e.manager_id,
            m.name AS manager_name,
            e.salary_amount,
            e.shift_timing_id
        FROM public.employees e
        LEFT JOIN public.departments d ON e.department_id = d.id
        LEFT JOIN public.locations loc ON e.location_id = loc.id
        LEFT JOIN public.employees m ON e.manager_id = m.id
        WHERE e.company_id = p_company_id
          AND (p_employee_id IS NULL OR e.id = p_employee_id)
          AND (p_department_id IS NULL OR e.department_id = p_department_id)
          AND (p_location_id IS NULL OR e.location_id = p_location_id)
    ),
    holidays AS (
        SELECT date, name
        FROM public.org_holidays
        WHERE company_id = p_company_id
          AND date BETWEEN p_start_date AND p_end_date
    ),
    emp_leaves AS (
        SELECT 
            l.employee_id,
            l.start_date,
            l.end_date,
            l.type,
            l.status,
            COALESCE(lt.is_paid, true) AS is_paid
        FROM public.leaves l
        LEFT JOIN public.org_leave_types lt ON l.leave_type_id = lt.id
        WHERE l.company_id = p_company_id
          AND l.status = 'Approved'
          AND l.start_date <= p_end_date
          AND l.end_date >= p_start_date
    ),
    att_records AS (
        SELECT 
            a.id,
            a.employee_id,
            a.date,
            a.check_in,
            a.check_out,
            a.status,
            COALESCE(a.total_hours, a.duration, 0) AS total_hours,
            COALESCE(a.late_minutes, 0) AS late_minutes,
            COALESCE(a.early_minutes, 0) AS early_minutes,
            COALESCE(a.ot_hours, 0) AS ot_hours,
            COALESCE(a.punch_method, a.source, 'MANUAL') AS source,
            a.edit_reason,
            a.is_processed,
            a.shift_id,
            st.name AS shift_name,
            st.start_time AS shift_start,
            st.end_time AS shift_end,
            COALESCE(st.full_day_hours, v_standard_hours) AS scheduled_hours
        FROM public.attendance a
        LEFT JOIN public.org_shift_timings st ON a.shift_id = st.id
        WHERE a.company_id = p_company_id
          AND a.date BETWEEN p_start_date AND p_end_date
          AND (p_employee_id IS NULL OR a.employee_id = p_employee_id)
          AND (p_shift_id IS NULL OR a.shift_id = p_shift_id)
    ),
    emp_summaries AS (
        SELECT 
            e.id AS employee_id,
            e.employee_code,
            e.name AS employee_name,
            e.department_name,
            e.designation,
            e.location_name,
            e.manager_name,
            (p_end_date - p_start_date + 1) AS calendar_days,
            COUNT(CASE WHEN ar.status = 'Present' THEN 1 END) AS present_days,
            COUNT(CASE WHEN ar.status = 'Absent' THEN 1 END) AS absent_days,
            COUNT(CASE WHEN ar.status = 'Half Day' THEN 1 END) AS half_days,
            COUNT(CASE WHEN ar.status = 'On Leave' OR ar.status = 'Leave' THEN 1 END) AS leave_days,
            COUNT(CASE WHEN ar.late_minutes > 0 THEN 1 END) AS late_days,
            COUNT(CASE WHEN ar.early_minutes > 0 THEN 1 END) AS early_days,
            COUNT(CASE WHEN ar.ot_hours > 0 THEN 1 END) AS ot_days,
            COALESCE(SUM(ar.ot_hours), 0) AS total_ot_hours,
            COALESCE(SUM(ar.total_hours), 0) AS total_worked_hours,
            COALESCE(AVG(NULLIF(ar.total_hours, 0)), 0) AS avg_worked_hours,
            COUNT(CASE WHEN ar.check_in IS NOT NULL AND ar.check_out IS NULL THEN 1 END) AS missing_punch_days
        FROM emp_list e
        LEFT JOIN att_records ar ON e.id = ar.employee_id
        GROUP BY e.id, e.employee_code, e.name, e.department_name, e.designation, e.location_name, e.manager_name
    )
    SELECT jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'default_off_days', v_default_off_days,
        'standard_hours', v_standard_hours,
        'holidays', (SELECT COALESCE(jsonb_agg(h), '[]'::jsonb) FROM holidays h),
        'employees', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'summary', to_jsonb(s),
                    'records', (
                        SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.date), '[]'::jsonb)
                        FROM att_records r
                        WHERE r.employee_id = s.employee_id
                    )
                )
            ), '[]'::jsonb)
            FROM emp_summaries s
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;


-- 2. Overtime Report RPC
CREATE OR REPLACE FUNCTION public.rpc_get_overtime_report(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_employee_id UUID DEFAULT NULL,
    p_department_id BIGINT DEFAULT NULL,
    p_approval_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_ot_threshold NUMERIC;
    v_ot_multiplier NUMERIC;
    v_weekend_multiplier NUMERIC;
    v_holiday_multiplier NUMERIC;
    v_max_daily_ot NUMERIC;
    v_approval_required BOOLEAN;
    v_default_off_days TEXT;
BEGIN
    -- Fetch attendance & OT settings
    SELECT 
        COALESCE(s.ot_threshold_hours, 8.0),
        COALESCE(s.ot_multiplier, 1.5),
        COALESCE(s.weekend_ot_multiplier, 2.0),
        COALESCE(s.holiday_ot_multiplier, 2.0),
        COALESCE(s.max_ot_hours_per_day, 4.0),
        COALESCE(s.ot_approval_required, true)
    INTO 
        v_ot_threshold, v_ot_multiplier, v_weekend_multiplier, 
        v_holiday_multiplier, v_max_daily_ot, v_approval_required
    FROM public.attendance_settings s
    WHERE s.company_id = p_company_id
    LIMIT 1;

    IF v_ot_threshold IS NULL THEN v_ot_threshold := 8.0; END IF;
    IF v_ot_multiplier IS NULL THEN v_ot_multiplier := 1.5; END IF;
    IF v_weekend_multiplier IS NULL THEN v_weekend_multiplier := 2.0; END IF;
    IF v_holiday_multiplier IS NULL THEN v_holiday_multiplier := 2.0; END IF;
    IF v_max_daily_ot IS NULL THEN v_max_daily_ot := 4.0; END IF;
    IF v_approval_required IS NULL THEN v_approval_required := true; END IF;

    SELECT COALESCE(default_weekly_off_days, '5,6')
    INTO v_default_off_days
    FROM public.org_attendance_settings
    WHERE company_id = p_company_id
    LIMIT 1;
    IF v_default_off_days IS NULL THEN v_default_off_days := '5,6'; END IF;

    WITH raw_ot AS (
        SELECT 
            a.id,
            a.employee_id,
            e.employee_code,
            e.name AS employee_name,
            COALESCE(d.name, e.department, 'General') AS department_name,
            e.salary_amount,
            a.date,
            a.check_in,
            a.check_out,
            COALESCE(a.total_hours, a.duration, 0) AS total_worked_hours,
            st.name AS shift_name,
            st.start_time AS scheduled_start,
            st.end_time AS scheduled_end,
            COALESCE(st.full_day_hours, v_ot_threshold) AS regular_hours,
            -- Raw OT calculation: if stored ot_hours > 0, use it, else worked - regular
            GREATEST(COALESCE(a.ot_hours, 0), GREATEST(COALESCE(a.total_hours, a.duration, 0) - COALESCE(st.full_day_hours, v_ot_threshold), 0)) AS raw_ot_hours,
            -- Determine if date is holiday or weekend
            (EXISTS (SELECT 1 FROM public.org_holidays h WHERE h.company_id = p_company_id AND h.date = a.date)) AS is_holiday,
            (EXTRACT(DOW FROM a.date)::text = ANY(string_to_array(v_default_off_days, ','))) AS is_weekend,
            -- Overtime requests lookup
            otr.status AS req_status,
            otr.approved_hours AS req_approved_hours,
            approver.name AS approver_name,
            otr.approved_at,
            otr.reason AS ot_reason
        FROM public.attendance a
        JOIN public.employees e ON a.employee_id = e.id
        LEFT JOIN public.departments d ON e.department_id = d.id
        LEFT JOIN public.org_shift_timings st ON a.shift_id = st.id
        LEFT JOIN public.overtime_requests otr ON a.employee_id = otr.employee_id AND a.date = otr.request_date
        LEFT JOIN public.employees approver ON otr.approved_by = approver.id
        WHERE a.company_id = p_company_id
          AND a.date BETWEEN p_start_date AND p_end_date
          AND (p_employee_id IS NULL OR a.employee_id = p_employee_id)
          AND (p_department_id IS NULL OR e.department_id = p_department_id)
    ),
    calculated_ot AS (
        SELECT 
            r.*,
            -- Eligible OT capped by max_ot_hours_per_day
            LEAST(r.raw_ot_hours, v_max_daily_ot) AS eligible_ot_hours,
            -- OT Classification & Multiplier
            CASE 
                WHEN r.is_holiday THEN 'Holiday OT'
                WHEN r.is_weekend THEN 'Weekend OT'
                ELSE 'Regular Day OT'
            END AS ot_type,
            CASE 
                WHEN r.is_holiday THEN v_holiday_multiplier
                WHEN r.is_weekend THEN v_weekend_multiplier
                ELSE v_ot_multiplier
            END AS multiplier,
            -- Approval status
            CASE 
                WHEN NOT v_approval_required THEN 'Not Required'
                WHEN r.req_status IS NOT NULL THEN r.req_status
                ELSE 'Approved' -- Default to Approved if pre-calculated/processed
            END AS final_approval_status,
            -- Estimated Hourly Rate & OT Amount: (Salary / (30 * 8)) * eligible_ot * multiplier
            ROUND(
                (COALESCE(r.salary_amount, 0) / (30.0 * v_ot_threshold)) * LEAST(r.raw_ot_hours, v_max_daily_ot) * 
                CASE WHEN r.is_holiday THEN v_holiday_multiplier WHEN r.is_weekend THEN v_weekend_multiplier ELSE v_ot_multiplier END, 
                2
            ) AS estimated_ot_amount
        FROM raw_ot r
        WHERE r.raw_ot_hours > 0
    ),
    filtered_ot AS (
        SELECT *
        FROM calculated_ot
        WHERE (p_approval_status IS NULL OR final_approval_status = p_approval_status)
    ),
    dept_summaries AS (
        SELECT 
            COALESCE(department_name, 'Unassigned') AS department,
            COUNT(DISTINCT employee_id) AS employees_count,
            COUNT(*) AS ot_days,
            ROUND(SUM(eligible_ot_hours), 2) AS total_ot_hours,
            ROUND(SUM(CASE WHEN final_approval_status IN ('Approved', 'Not Required') THEN eligible_ot_hours ELSE 0 END), 2) AS approved_ot_hours,
            ROUND(SUM(estimated_ot_amount), 2) AS total_ot_cost
        FROM filtered_ot
        GROUP BY department_name
    )
    SELECT jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'rules', jsonb_build_object(
            'threshold_hours', v_ot_threshold,
            'standard_multiplier', v_ot_multiplier,
            'weekend_multiplier', v_weekend_multiplier,
            'holiday_multiplier', v_holiday_multiplier,
            'max_daily_cap', v_max_daily_ot,
            'approval_required', v_approval_required
        ),
        'summary', jsonb_build_object(
            'total_employees', (SELECT COUNT(DISTINCT employee_id) FROM filtered_ot),
            'total_ot_days', (SELECT COUNT(*) FROM filtered_ot),
            'total_ot_hours', (SELECT COALESCE(ROUND(SUM(eligible_ot_hours), 2), 0) FROM filtered_ot),
            'approved_ot_hours', (SELECT COALESCE(ROUND(SUM(CASE WHEN final_approval_status IN ('Approved', 'Not Required') THEN eligible_ot_hours ELSE 0 END), 2), 0) FROM filtered_ot),
            'pending_ot_hours', (SELECT COALESCE(ROUND(SUM(CASE WHEN final_approval_status = 'Pending' THEN eligible_ot_hours ELSE 0 END), 2), 0) FROM filtered_ot),
            'rejected_ot_hours', (SELECT COALESCE(ROUND(SUM(CASE WHEN final_approval_status = 'Rejected' THEN eligible_ot_hours ELSE 0 END), 2), 0) FROM filtered_ot),
            'total_estimated_cost', (SELECT COALESCE(ROUND(SUM(estimated_ot_amount), 2), 0) FROM filtered_ot)
        ),
        'department_summary', (SELECT COALESCE(jsonb_agg(to_jsonb(ds)), '[]'::jsonb) FROM dept_summaries ds),
        'records', (SELECT COALESCE(jsonb_agg(to_jsonb(fo) ORDER BY fo.date DESC, fo.employee_name), '[]'::jsonb) FROM filtered_ot fo)
    ) INTO v_result;

    RETURN v_result;
END;
$$;


-- 3. Late In / Early Out Report RPC
CREATE OR REPLACE FUNCTION public.rpc_get_late_early_report(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_employee_id UUID DEFAULT NULL,
    p_department_id BIGINT DEFAULT NULL,
    p_min_late_minutes INT DEFAULT 0,
    p_min_early_minutes INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_grace_late INT;
    v_grace_early INT;
BEGIN
    -- Fetch grace settings
    SELECT 
        COALESCE(s.grace_minutes_late, 15),
        COALESCE(s.grace_minutes_early, 15)
    INTO v_grace_late, v_grace_early
    FROM public.attendance_settings s
    WHERE s.company_id = p_company_id
    LIMIT 1;

    IF v_grace_late IS NULL THEN v_grace_late := 15; END IF;
    IF v_grace_early IS NULL THEN v_grace_early := 15; END IF;

    WITH base_records AS (
        SELECT 
            a.id,
            a.employee_id,
            e.employee_code,
            e.name AS employee_name,
            COALESCE(d.name, e.department, 'General') AS department_name,
            a.date,
            a.check_in,
            a.check_out,
            a.status,
            COALESCE(a.total_hours, a.duration, 0) AS total_worked_hours,
            COALESCE(a.punch_method, a.source, 'MANUAL') AS punch_source,
            a.edit_reason,
            st.name AS shift_name,
            st.start_time AS scheduled_start,
            st.end_time AS scheduled_end,
            COALESCE(st.grace_period_minutes, v_grace_late) AS effective_grace_late,
            v_grace_early AS effective_grace_early,
            st.is_overnight,
            -- Calculated or stored late minutes
            COALESCE(a.late_minutes, 0) AS stored_late_minutes,
            COALESCE(a.early_minutes, 0) AS stored_early_minutes
        FROM public.attendance a
        JOIN public.employees e ON a.employee_id = e.id
        LEFT JOIN public.departments d ON e.department_id = d.id
        LEFT JOIN public.org_shift_timings st ON a.shift_id = st.id
        WHERE a.company_id = p_company_id
          AND a.date BETWEEN p_start_date AND p_end_date
          AND (p_employee_id IS NULL OR a.employee_id = p_employee_id)
          AND (p_department_id IS NULL OR e.department_id = p_department_id)
          AND (a.check_in IS NOT NULL OR a.check_out IS NOT NULL)
    ),
    calculated_incidents AS (
        SELECT 
            b.*,
            -- Dynamic calculation if stored is 0 but actual check-in is after scheduled start + grace
            CASE 
                WHEN b.stored_late_minutes > 0 THEN b.stored_late_minutes
                WHEN b.check_in IS NOT NULL AND b.scheduled_start IS NOT NULL THEN
                    GREATEST(
                        0,
                        EXTRACT(EPOCH FROM (b.check_in::time - b.scheduled_start))::int / 60 - b.effective_grace_late
                    )
                ELSE 0
            END AS computed_late_minutes,
            -- Dynamic calculation for early out
            CASE 
                WHEN b.stored_early_minutes > 0 THEN b.stored_early_minutes
                WHEN b.check_out IS NOT NULL AND b.scheduled_end IS NOT NULL AND NOT COALESCE(b.is_overnight, false) THEN
                    GREATEST(
                        0,
                        EXTRACT(EPOCH FROM (b.scheduled_end - b.check_out::time))::int / 60 - b.effective_grace_early
                    )
                ELSE 0
            END AS computed_early_minutes
        FROM base_records b
    ),
    filtered_incidents AS (
        SELECT *
        FROM calculated_incidents
        WHERE (computed_late_minutes >= p_min_late_minutes AND computed_late_minutes > 0)
           OR (computed_early_minutes >= p_min_early_minutes AND computed_early_minutes > 0)
    ),
    emp_summary AS (
        SELECT 
            employee_id,
            employee_code,
            employee_name,
            department_name,
            COUNT(CASE WHEN computed_late_minutes > 0 THEN 1 END) AS late_occurrences,
            COALESCE(SUM(computed_late_minutes), 0) AS total_late_minutes,
            COUNT(CASE WHEN computed_early_minutes > 0 THEN 1 END) AS early_occurrences,
            COALESCE(SUM(computed_early_minutes), 0) AS total_early_minutes
        FROM filtered_incidents
        GROUP BY employee_id, employee_code, employee_name, department_name
    )
    SELECT jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'grace_late', v_grace_late,
        'grace_early', v_grace_early,
        'summary', jsonb_build_object(
            'total_late_employees', (SELECT COUNT(DISTINCT employee_id) FROM filtered_incidents WHERE computed_late_minutes > 0),
            'total_late_occurrences', (SELECT COUNT(*) FROM filtered_incidents WHERE computed_late_minutes > 0),
            'total_late_minutes', (SELECT COALESCE(SUM(computed_late_minutes), 0) FROM filtered_incidents),
            'avg_late_minutes', (SELECT COALESCE(ROUND(AVG(computed_late_minutes), 1), 0) FROM filtered_incidents WHERE computed_late_minutes > 0),
            'total_early_employees', (SELECT COUNT(DISTINCT employee_id) FROM filtered_incidents WHERE computed_early_minutes > 0),
            'total_early_occurrences', (SELECT COUNT(*) FROM filtered_incidents WHERE computed_early_minutes > 0),
            'total_early_minutes', (SELECT COALESCE(SUM(computed_early_minutes), 0) FROM filtered_incidents),
            'avg_early_minutes', (SELECT COALESCE(ROUND(AVG(computed_early_minutes), 1), 0) FROM filtered_incidents WHERE computed_early_minutes > 0)
        ),
        'employee_summary', (SELECT COALESCE(jsonb_agg(to_jsonb(es) ORDER BY es.total_late_minutes DESC, es.total_early_minutes DESC), '[]'::jsonb) FROM emp_summary es),
        'records', (SELECT COALESCE(jsonb_agg(to_jsonb(fi) ORDER BY fi.date DESC, fi.computed_late_minutes DESC), '[]'::jsonb) FROM filtered_incidents fi)
    ) INTO v_result;

    RETURN v_result;
END;
$$;
