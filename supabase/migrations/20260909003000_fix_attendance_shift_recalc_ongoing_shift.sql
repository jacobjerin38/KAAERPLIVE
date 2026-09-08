-- Migration: 20260909003000_fix_attendance_shift_recalc_ongoing_shift.sql
-- Description: Prevent ongoing day shifts from being marked 'Absent' when attendance rules are recalculated mid-day

CREATE OR REPLACE FUNCTION public.rpc_recalculate_attendance_shift_rules(p_company_id uuid, p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $
DECLARE
    v_updated_count INT := 0;
    v_grace_late INT := 15;
    v_grace_early INT := 15;
    v_standard_hours NUMERIC := 8.0;
    v_half_day_hours NUMERIC := 4.0;
    v_default_off_days TEXT := '5';
    v_rec RECORD;
    v_pair RECORD;
    v_shift_start TIME;
    v_shift_end TIME;
    v_shift_hours NUMERIC;
    v_is_overnight BOOLEAN;
    v_checkin_local TIMESTAMP;
    v_checkout_local TIMESTAMP;
    v_effective_checkout TIMESTAMP;
    v_worked_hours NUMERIC;
    v_late_mins INT;
    v_early_mins INT;
    v_ot_hrs NUMERIC;
    v_status TEXT;
    v_effective_shift_id BIGINT;
    v_is_off_day BOOLEAN;
    v_is_holiday BOOLEAN;
BEGIN
    -- Fetch company attendance settings
    SELECT 
        COALESCE(grace_minutes_late, 15),
        COALESCE(grace_minutes_early, 15),
        COALESCE(standard_hours, 8.0),
        COALESCE(half_day_hours, 4.0)
    INTO v_grace_late, v_grace_early, v_standard_hours, v_half_day_hours
    FROM public.attendance_settings
    WHERE company_id = p_company_id
    LIMIT 1;

    SELECT COALESCE(default_weekly_off_days, '5')
    INTO v_default_off_days
    FROM public.org_attendance_settings
    WHERE company_id = p_company_id
    LIMIT 1;

    IF v_default_off_days IS NULL THEN v_default_off_days := '5'; END IF;

    -- PRE-PASS: Automatically pair any cross-midnight night shift punches across the date range
    FOR v_pair IN (
        SELECT 
            prev.id AS prev_id,
            curr.id AS curr_id,
            COALESCE(curr.check_out, curr.check_in) AS checkout_ts,
            COALESCE(curr.check_out_location, curr.check_in_location) AS checkout_loc,
            COALESCE(curr.check_out_lat, curr.check_in_lat) AS checkout_lat,
            COALESCE(curr.check_out_lng, curr.check_in_lng) AS checkout_lng
        FROM public.attendance prev
        JOIN public.attendance curr ON prev.company_id = curr.company_id 
                                   AND prev.employee_id = curr.employee_id 
                                   AND curr.date = prev.date + interval '1 day'
        WHERE prev.company_id = p_company_id
          AND prev.date BETWEEN (p_start_date - interval '1 day') AND p_end_date
          AND prev.check_in IS NOT NULL
          AND (prev.check_in AT TIME ZONE 'Asia/Qatar')::time >= '15:00:00'::time
          AND curr.check_in IS NOT NULL
          AND (curr.check_in AT TIME ZONE 'Asia/Qatar')::time <= '11:00:00'::time
          AND (curr.total_hours < 1.0 OR curr.check_in = curr.check_out OR prev.check_out IS NULL OR prev.check_out > prev.date + interval '1 day 12 hours')
    ) LOOP
        UPDATE public.attendance SET
            check_out = v_pair.checkout_ts,
            check_out_location = COALESCE(check_out_location, v_pair.checkout_loc),
            check_out_lat = COALESCE(check_out_lat, v_pair.checkout_lat),
            check_out_lng = COALESCE(check_out_lng, v_pair.checkout_lng)
        WHERE id = v_pair.prev_id;

        UPDATE public.attendance SET
            check_in = NULL,
            check_out = NULL,
            total_hours = 0,
            duration = 0,
            status = CASE 
                WHEN (EXTRACT(DOW FROM date)::text = ANY(string_to_array(v_default_off_days, ',')) OR EXTRACT(DOW FROM date) = 5) THEN 'Weekend'
                ELSE 'Absent'
            END
        WHERE id = v_pair.curr_id;
    END LOOP;

    -- MAIN PASS: Loop through all attendance records in range, prioritizing duty_roster
    FOR v_rec IN 
        SELECT 
            a.id,
            a.employee_id,
            a.date,
            a.check_in,
            a.check_out,
            COALESCE(dr.shift_id, a.shift_id, e.shift_timing_id, 1) AS resolved_shift_id,
            COALESCE(e.ot_applicable, true) as ot_applicable,
            st.name AS shift_name,
            st.start_time,
            st.end_time,
            COALESCE(st.is_overnight, (st.start_time > st.end_time), false) AS is_overnight,
            COALESCE(st.full_day_hours, 8.0) as full_day_hours,
            COALESCE(st.grace_period_minutes, v_grace_late) as shift_grace,
            dr.shift_id AS roster_shift_id
        FROM public.attendance a
        JOIN public.employees e ON a.employee_id = e.id
        LEFT JOIN public.duty_roster dr ON dr.employee_id = a.employee_id AND dr.date = a.date AND dr.company_id = a.company_id
        LEFT JOIN public.org_shift_timings st ON COALESCE(dr.shift_id, a.shift_id, e.shift_timing_id, 1) = st.id
        WHERE a.company_id = p_company_id
        AND a.date BETWEEN p_start_date AND p_end_date
    LOOP
        v_effective_shift_id := v_rec.resolved_shift_id;
        v_shift_start := COALESCE(v_rec.start_time, '08:00:00'::time);
        v_shift_end := COALESCE(v_rec.end_time, '16:00:00'::time);
        v_is_overnight := COALESCE(v_rec.is_overnight, (v_shift_start > v_shift_end), false);
        v_shift_hours := COALESCE(v_rec.full_day_hours, 8.0);
        v_grace_late := COALESCE(v_rec.shift_grace, 15);
        
        -- Check if day is weekend / off-day or holiday
        v_is_off_day := (EXTRACT(DOW FROM v_rec.date)::text = ANY(string_to_array(v_default_off_days, ',')) OR EXTRACT(DOW FROM v_rec.date) = 5);
        v_is_holiday := EXISTS(SELECT 1 FROM public.org_holidays h WHERE h.company_id = p_company_id AND h.date = v_rec.date);

        v_late_mins := 0;
        v_early_mins := 0;
        v_worked_hours := 0;
        v_ot_hrs := 0;

        IF v_rec.check_in IS NOT NULL THEN
            -- Convert to local timezone (Qatar is UTC+3)
            v_checkin_local := v_rec.check_in AT TIME ZONE 'Asia/Qatar';
            
            -- Calculate Late Minutes
            IF NOT v_is_off_day AND NOT v_is_holiday AND v_checkin_local::time > (v_shift_start + (v_grace_late || ' minutes')::interval) THEN
                v_late_mins := EXTRACT(EPOCH FROM (v_checkin_local::time - v_shift_start)) / 60;
                IF v_late_mins < 0 THEN v_late_mins := 0; END IF;
            ELSE
                v_late_mins := 0;
            END IF;

            IF v_rec.check_out IS NOT NULL THEN
                v_checkout_local := v_rec.check_out AT TIME ZONE 'Asia/Qatar';
                v_effective_checkout := v_checkout_local;

                -- Overnight shift handling
                IF v_is_overnight THEN
                    IF v_effective_checkout <= v_checkin_local THEN
                        v_effective_checkout := v_effective_checkout + interval '1 day';
                    ELSIF v_effective_checkout > (v_checkin_local::date + v_shift_end + interval '1 day 4 hours') THEN
                        v_effective_checkout := (v_checkin_local::date + v_shift_end + interval '1 day 4 hours');
                    END IF;
                ELSE
                    -- Standard Day Shift handling
                    IF v_effective_checkout::date > v_checkin_local::date THEN
                        v_effective_checkout := (v_checkin_local::date + v_shift_end + interval '4 hours');
                    END IF;
                END IF;

                -- Calculate Worked Hours
                v_worked_hours := ROUND((EXTRACT(EPOCH FROM (v_effective_checkout - v_checkin_local)) / 3600.0)::numeric, 2);
                IF v_worked_hours < 0 THEN v_worked_hours := 0; END IF;
                IF v_worked_hours > 16.0 THEN v_worked_hours := 16.0; END IF;

                -- Calculate Early Departure Minutes
                IF NOT v_is_off_day AND NOT v_is_holiday THEN
                    IF v_is_overnight THEN
                        IF v_effective_checkout::time < (v_shift_end - (v_grace_early || ' minutes')::interval) AND v_effective_checkout::time >= '00:00:00'::time THEN
                            v_early_mins := EXTRACT(EPOCH FROM (v_shift_end - v_effective_checkout::time)) / 60;
                            IF v_early_mins < 0 THEN v_early_mins := 0; END IF;
                        ELSE
                            v_early_mins := 0;
                        END IF;
                    ELSE
                        IF v_effective_checkout::time < (v_shift_end - (v_grace_early || ' minutes')::interval) THEN
                            v_early_mins := EXTRACT(EPOCH FROM (v_shift_end - v_effective_checkout::time)) / 60;
                            IF v_early_mins < 0 THEN v_early_mins := 0; END IF;
                        ELSE
                            v_early_mins := 0;
                        END IF;
                    END IF;
                END IF;

                -- Calculate Overtime Hours
                IF v_rec.ot_applicable THEN
                    IF v_is_off_day OR v_is_holiday THEN
                        v_ot_hrs := v_worked_hours; -- Full weekend/holiday OT
                    ELSIF v_worked_hours > v_shift_hours THEN
                        v_ot_hrs := ROUND((v_worked_hours - v_shift_hours)::numeric, 2);
                    ELSE
                        v_ot_hrs := 0;
                    END IF;
                ELSE
                    v_ot_hrs := 0;
                END IF;

                -- Determine Status based on hours worked
                IF v_worked_hours < 1.0 THEN
                    IF v_is_off_day THEN
                        v_status := 'Weekend';
                    ELSIF v_is_holiday THEN
                        v_status := 'Holiday';
                    ELSE
                        v_status := 'Absent';
                    END IF;
                ELSIF v_worked_hours < v_half_day_hours THEN
                    v_status := 'Half Day';
                ELSE
                    v_status := 'Present';
                END IF;
            ELSE
                -- Missing Check Out
                IF v_is_off_day THEN
                    v_status := 'Weekend';
                ELSIF v_is_holiday THEN
                    v_status := 'Holiday';
                ELSIF v_rec.date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Qatar')::date THEN
                    -- Today's ongoing shift: Employee is currently clocked in / on duty!
                    v_status := 'Present';
                ELSE
                    v_worked_hours := 0;
                    v_status := 'Absent';
                END IF;
            END IF;
        ELSE
            -- No Check In
            v_worked_hours := 0;
            IF v_is_off_day THEN
                v_status := 'Weekend';
            ELSIF v_is_holiday THEN
                v_status := 'Holiday';
            ELSE
                v_status := 'Absent';
            END IF;
        END IF;

        -- Update attendance record with resolved shift_id and computed stats
        UPDATE public.attendance SET
            total_hours = v_worked_hours,
            duration = v_worked_hours,
            late_minutes = v_late_mins,
            early_minutes = v_early_mins,
            ot_hours = v_ot_hrs,
            status = v_status,
            shift_id = v_effective_shift_id
        WHERE id = v_rec.id;

        v_updated_count := v_updated_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'updated_records', v_updated_count,
        'start_date', p_start_date,
        'end_date', p_end_date
    );
END;
$;
