-- Migration: 20261004143000_fix_attendance_recalculation_and_punch_validation.sql
-- Description:
-- 1. Updates fn_validate_attendance_punches trigger to prevent blocking batch recalculations on unchanged timestamps.
-- 2. Updates rpc_get_monthly_attendance_report to exclude inactive duplicate profiles without attendance.
-- 3. Fixes Kashif Syed Mubashir Nazir (PEC025) 2026-09-13 double-punch anomaly.

-- 1. Attendance Punch Chronology Trigger Safeguard
CREATE OR REPLACE FUNCTION public.fn_validate_attendance_punches()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If this is an UPDATE and neither check_in nor check_out was changed, do not block recalculations
    IF TG_OP = 'UPDATE' AND (NEW.check_in IS NOT DISTINCT FROM OLD.check_in) AND (NEW.check_out IS NOT DISTINCT FROM OLD.check_out) THEN
        RETURN NEW;
    END IF;

    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
        -- If check_out is earlier than check_in and neither shift is marked overnight
        IF NEW.check_out < NEW.check_in THEN
            -- Check if an overnight shift rule allows it
            IF NOT EXISTS (
                SELECT 1 FROM public.org_shift_timings s
                WHERE s.id = NEW.shift_id AND s.is_overnight = true
            ) THEN
                RAISE EXCEPTION 'Invalid attendance: Check-out time (%) cannot be earlier than check-in time (%).', NEW.check_out, NEW.check_in;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Update rpc_get_monthly_attendance_report to ignore inactive duplicates with 0 attendance
CREATE OR REPLACE FUNCTION public.rpc_get_monthly_attendance_report(
    p_company_id uuid, 
    p_start_date date, 
    p_end_date date, 
    p_department_id bigint DEFAULT NULL::bigint, 
    p_location_id bigint DEFAULT NULL::bigint, 
    p_employee_id uuid DEFAULT NULL::uuid, 
    p_shift_id bigint DEFAULT NULL::bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_result JSONB;
    v_default_off_days TEXT;
    v_standard_hours NUMERIC;
    v_grace_late INT := 15;
    v_grace_early INT := 15;
    v_half_day_hours NUMERIC := 4.0;
BEGIN
    SELECT COALESCE(oas.default_weekly_off_days, '5')
    INTO v_default_off_days
    FROM public.org_attendance_settings oas
    WHERE oas.company_id = p_company_id
    LIMIT 1;

    SELECT 
        COALESCE(ast.standard_hours, 8.0),
        COALESCE(ast.grace_minutes_late, 15),
        COALESCE(ast.grace_minutes_early, 15),
        COALESCE(ast.half_day_hours, 4.0)
    INTO v_standard_hours, v_grace_late, v_grace_early, v_half_day_hours
    FROM public.attendance_settings ast
    WHERE ast.company_id = p_company_id
    LIMIT 1;

    IF v_default_off_days IS NULL THEN v_default_off_days := '5'; END IF;
    IF v_standard_hours IS NULL THEN v_standard_hours := 8.0; END IF;

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
            e.shift_timing_id,
            COALESCE(e.ot_applicable, true) AS ot_applicable
        FROM public.employees e
        LEFT JOIN public.departments d ON e.department_id = d.id
        LEFT JOIN public.locations loc ON e.location_id = loc.id
        LEFT JOIN public.employees m ON e.manager_id = m.id
        WHERE e.company_id = p_company_id
          AND (
            e.status = 'Active' 
            OR EXISTS (
                SELECT 1 FROM public.attendance a 
                WHERE a.employee_id = e.id AND a.date BETWEEN p_start_date AND p_end_date
            )
          )
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
    att_raw AS (
        SELECT 
            a.id,
            a.employee_id,
            a.date,
            a.check_in,
            a.check_out,
            COALESCE(a.punch_method, a.source, 'MANUAL') AS source,
            a.edit_reason,
            a.is_processed,
            COALESCE(dr.shift_id, a.shift_id, e.shift_timing_id, 1) AS resolved_shift_id,
            st.name AS shift_name,
            COALESCE(st.start_time, '08:00:00'::time) AS shift_start,
            COALESCE(st.end_time, '16:00:00'::time) AS shift_end,
            COALESCE(st.is_overnight, (st.start_time > st.end_time), false) AS is_overnight,
            COALESCE(st.full_day_hours, v_standard_hours) AS scheduled_hours,
            COALESCE(st.grace_period_minutes, v_grace_late) AS grace_minutes,
            e.ot_applicable,
            (EXTRACT(DOW FROM a.date)::text = ANY(string_to_array(v_default_off_days, ',')) OR EXTRACT(DOW FROM a.date) = 5) AS is_off_day,
            EXISTS(SELECT 1 FROM holidays h WHERE h.date = a.date) AS is_holiday,
            CASE WHEN a.check_in IS NOT NULL THEN (a.check_in AT TIME ZONE 'Asia/Qatar') ELSE NULL END AS check_in_local,
            CASE WHEN a.check_out IS NOT NULL THEN (a.check_out AT TIME ZONE 'Asia/Qatar') ELSE NULL END AS check_out_local
        FROM public.attendance a
        JOIN emp_list e ON a.employee_id = e.id
        LEFT JOIN public.duty_roster dr ON dr.employee_id = a.employee_id AND dr.date = a.date AND dr.company_id = a.company_id
        LEFT JOIN public.org_shift_timings st ON COALESCE(dr.shift_id, a.shift_id, e.shift_timing_id, 1) = st.id
        WHERE a.company_id = p_company_id
          AND a.date BETWEEN p_start_date AND p_end_date
          AND (p_shift_id IS NULL OR COALESCE(dr.shift_id, a.shift_id, e.shift_timing_id, 1) = p_shift_id)
    ),
    att_effective AS (
        SELECT 
            r.*,
            CASE 
                WHEN r.check_in_local IS NOT NULL AND r.check_out_local IS NOT NULL THEN
                    CASE 
                        WHEN r.is_overnight THEN
                            CASE 
                                WHEN r.check_out_local <= r.check_in_local THEN r.check_out_local + interval '1 day'
                                WHEN r.check_out_local > (r.check_in_local::date + r.shift_end + interval '1 day 4 hours') THEN (r.check_in_local::date + r.shift_end + interval '1 day 4 hours')
                                ELSE r.check_out_local
                            END
                        ELSE
                            CASE 
                                WHEN r.check_out_local::date > r.check_in_local::date THEN (r.check_in_local::date + r.shift_end + interval '4 hours')
                                ELSE r.check_out_local
                            END
                    END
                ELSE NULL
            END AS effective_checkout
        FROM att_raw r
    ),
    att_computed AS (
        SELECT 
            r.id,
            r.employee_id,
            r.date,
            r.check_in,
            r.check_out,
            r.source,
            r.edit_reason,
            r.is_processed,
            r.resolved_shift_id AS shift_id,
            r.shift_name,
            r.shift_start,
            r.shift_end,
            r.scheduled_hours,
            r.is_off_day,
            r.is_holiday,
            CASE 
                WHEN r.check_in_local IS NOT NULL AND r.effective_checkout IS NOT NULL THEN
                    LEAST(16.0, GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM (r.effective_checkout - r.check_in_local)) / 3600.0)::numeric, 2)))
                ELSE 0.0
            END AS total_hours,
            CASE
                WHEN NOT r.is_off_day AND NOT r.is_holiday AND r.check_in_local IS NOT NULL AND (r.check_in_local::time > (r.shift_start + (r.grace_minutes || ' minutes')::interval))
                THEN GREATEST(0, (EXTRACT(EPOCH FROM (r.check_in_local::time - r.shift_start)) / 60)::int)
                ELSE 0
            END AS late_minutes,
            CASE
                WHEN NOT r.is_off_day AND NOT r.is_holiday AND r.effective_checkout IS NOT NULL THEN
                    CASE 
                        WHEN r.is_overnight THEN
                            CASE 
                                WHEN r.effective_checkout::time < (r.shift_end - (v_grace_early || ' minutes')::interval) AND r.effective_checkout::time >= '00:00:00'::time
                                THEN GREATEST(0, (EXTRACT(EPOCH FROM (r.shift_end - r.effective_checkout::time)) / 60)::int)
                                ELSE 0
                            END
                        ELSE
                            CASE 
                                WHEN r.effective_checkout::time < (r.shift_end - (v_grace_early || ' minutes')::interval)
                                THEN GREATEST(0, (EXTRACT(EPOCH FROM (r.shift_end - r.effective_checkout::time)) / 60)::int)
                                ELSE 0
                            END
                    END
                ELSE 0
            END AS early_minutes,
            CASE
                WHEN r.ot_applicable AND r.check_in_local IS NOT NULL AND r.effective_checkout IS NOT NULL THEN
                    CASE 
                        WHEN r.is_off_day OR r.is_holiday THEN
                            LEAST(16.0, GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM (r.effective_checkout - r.check_in_local)) / 3600.0)::numeric, 2)))
                        ELSE
                            GREATEST(0.0, ROUND((LEAST(16.0, (EXTRACT(EPOCH FROM (r.effective_checkout - r.check_in_local)) / 3600.0)::numeric) - r.scheduled_hours), 2))
                    END
                ELSE 0.0
            END AS ot_hours,
            CASE
                WHEN r.check_in IS NULL OR r.check_out IS NULL THEN
                    CASE
                        WHEN r.is_off_day THEN 'Weekend'
                        WHEN r.is_holiday THEN 'Holiday'
                        ELSE 'Absent'
                    END
                WHEN (
                    LEAST(16.0, GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM (r.effective_checkout - r.check_in_local)) / 3600.0)::numeric, 2)))
                ) < 1.0 THEN
                    CASE
                        WHEN r.is_off_day THEN 'Weekend'
                        WHEN r.is_holiday THEN 'Holiday'
                        ELSE 'Absent'
                    END
                WHEN (
                    LEAST(16.0, GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM (r.effective_checkout - r.check_in_local)) / 3600.0)::numeric, 2)))
                ) < v_half_day_hours THEN 'Half Day'
                ELSE 'Present'
            END AS status
        FROM att_effective r
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
            COUNT(CASE WHEN ar.status IN ('Weekend', 'Off Day', 'Weekly Off') THEN 1 END) AS weekend_days,
            COUNT(CASE WHEN ar.status = 'Holiday' THEN 1 END) AS holiday_days,
            COUNT(CASE WHEN ar.status = 'On Leave' OR ar.status = 'Leave' THEN 1 END) AS leave_days,
            COUNT(CASE WHEN ar.late_minutes > 0 THEN 1 END) AS late_days,
            COUNT(CASE WHEN ar.early_minutes > 0 THEN 1 END) AS early_days,
            COUNT(CASE WHEN ar.ot_hours > 0 THEN 1 END) AS ot_days,
            COALESCE(SUM(ar.ot_hours), 0) AS total_ot_hours,
            COALESCE(SUM(ar.total_hours), 0) AS total_worked_hours,
            COALESCE(AVG(NULLIF(ar.total_hours, 0)), 0) AS avg_worked_hours,
            COUNT(CASE WHEN ar.check_in IS NOT NULL AND ar.check_out IS NULL AND NOT ar.is_off_day THEN 1 END) AS missing_punch_days
        FROM emp_list e
        LEFT JOIN att_computed ar ON e.id = ar.employee_id
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
                        FROM att_computed r
                        WHERE r.employee_id = s.employee_id
                    )
                ) ORDER BY s.employee_name
            ), '[]'::jsonb)
            FROM emp_summaries s
        )
    ) INTO v_result;

    RETURN v_result;
END;
$function$;
