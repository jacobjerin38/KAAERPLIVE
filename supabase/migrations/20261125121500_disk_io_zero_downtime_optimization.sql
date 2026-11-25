-- Migration: 20261125121500_disk_io_zero_downtime_optimization.sql
-- Purpose: Eliminate unnecessary WAL writes, audit log amplification, missing FK 400 errors,
--          and RLS per-row auth InitPlan overhead without altering or deleting live production data.
-- Safety: Transactional DDL only (functions, NOT VALID/VALIDATE FK constraint, RLS policies).
--         Non-transactional CONCURRENTLY index builds and VACUUM live in:
--         supabase/20261125_phase_a_indexes_vacuum_and_phase_b_cleanup.sql

-- ============================================================================
-- 1. Optimize public.get_my_company_id() as SQL STABLE SECURITY DEFINER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT company_id
  FROM public.profiles
  WHERE id = (select auth.uid())
  LIMIT 1;
$function$;

-- ============================================================================
-- 2. Make rpc_recalculate_attendance_shift_rules idempotent (skip no-op UPDATEs)
--    Prevents rewriting all 1,900+ attendance rows & firing audit triggers when nothing changed.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_recalculate_attendance_shift_rules(
    p_company_id uuid,
    p_start_date date,
    p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

    -- PRE-PASS: Automatically pair cross-midnight night shift punches across the date range ONLY for genuine overnight shifts
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
          AND (prev.check_in AT TIME ZONE 'Asia/Qatar')::time >= '17:00:00'::time
          AND curr.check_in IS NOT NULL
          AND (curr.check_in AT TIME ZONE 'Asia/Qatar')::time <= '11:00:00'::time
          AND (curr.total_hours < 1.0 OR curr.check_in = curr.check_out OR prev.check_out IS NULL OR prev.check_out > prev.date + interval '1 day 12 hours')
          AND (
              EXISTS (
                  SELECT 1 FROM public.duty_roster dr
                  JOIN public.org_shift_timings st ON dr.shift_id = st.id
                  WHERE dr.employee_id = prev.employee_id AND dr.date = prev.date
                    AND (st.is_overnight = true OR st.start_time > st.end_time OR st.start_time >= '17:00:00'::time)
              )
              OR EXISTS (
                  SELECT 1 FROM public.employees e
                  JOIN public.org_shift_timings st ON e.shift_timing_id = st.id
                  WHERE e.id = prev.employee_id
                    AND (st.is_overnight = true OR st.start_time > st.end_time OR st.start_time >= '17:00:00'::time)
              )
              OR (prev.check_in AT TIME ZONE 'Asia/Qatar')::time >= '17:30:00'::time
          )
    ) LOOP
        UPDATE public.attendance SET
            check_out = v_pair.checkout_ts,
            check_out_location = COALESCE(check_out_location, v_pair.checkout_loc),
            check_out_lat = COALESCE(check_out_lat, v_pair.checkout_lat),
            check_out_lng = COALESCE(check_out_lng, v_pair.checkout_lng)
        WHERE id = v_pair.prev_id
          AND (
              check_out IS DISTINCT FROM v_pair.checkout_ts
              OR check_out_location IS DISTINCT FROM COALESCE(check_out_location, v_pair.checkout_loc)
              OR check_out_lat IS DISTINCT FROM COALESCE(check_out_lat, v_pair.checkout_lat)
              OR check_out_lng IS DISTINCT FROM COALESCE(check_out_lng, v_pair.checkout_lng)
          );

        UPDATE public.attendance SET
            check_in = NULL,
            check_out = NULL,
            total_hours = 0,
            duration = 0,
            status = CASE
                WHEN (EXTRACT(DOW FROM date)::text = ANY(string_to_array(v_default_off_days, ',')) OR EXTRACT(DOW FROM date) = 5) THEN 'Weekend'
                ELSE 'Absent'
            END
        WHERE id = v_pair.curr_id
          AND (check_in IS NOT NULL OR check_out IS NOT NULL OR total_hours IS DISTINCT FROM 0);
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
                    IF v_effective_checkout::date = v_checkin_local::date THEN
                        v_effective_checkout := v_checkout_local;
                    ELSE
                        IF v_checkin_local::time >= '17:00:00'::time THEN
                            v_effective_checkout := v_checkout_local;
                        ELSE
                            v_effective_checkout := (v_checkin_local::date + v_shift_end + interval '4 hours');
                        END IF;
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
                        v_ot_hrs := v_worked_hours;
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

        -- Only write rows when at least one evaluated column actually changed
        UPDATE public.attendance SET
            total_hours = v_worked_hours,
            duration = v_worked_hours,
            late_minutes = v_late_mins,
            early_minutes = v_early_mins,
            ot_hours = v_ot_hrs,
            status = v_status,
            shift_id = v_effective_shift_id
        WHERE id = v_rec.id
          AND (
              total_hours IS DISTINCT FROM v_worked_hours
              OR duration IS DISTINCT FROM v_worked_hours
              OR late_minutes IS DISTINCT FROM v_late_mins
              OR early_minutes IS DISTINCT FROM v_early_mins
              OR ot_hours IS DISTINCT FROM v_ot_hrs
              OR status IS DISTINCT FROM v_status
              OR shift_id IS DISTINCT FROM v_effective_shift_id
          );

        IF FOUND THEN
            v_updated_count := v_updated_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'updated_records', v_updated_count,
        'start_date', p_start_date,
        'end_date', p_end_date
    );
END;
$function$;

-- ============================================================================
-- 3. Suppress no-op UPDATE noise in public.log_user_activity()
--    Skips querying auth.users & inserting activity_logs when only updated_at changed (or zero fields changed).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_user_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_user_email VARCHAR(255);
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_record_id VARCHAR(100);
    v_description TEXT;
    v_action VARCHAR(50);
BEGIN
    -- Exception block to ensure logging errors NEVER block the original transaction
    BEGIN
        -- Fast short-circuit for no-op UPDATEs (e.g. idempotent saves or updated_at-only touches)
        IF TG_OP = 'UPDATE' THEN
            v_old_data := to_jsonb(OLD);
            v_new_data := to_jsonb(NEW);
            IF (v_old_data - 'updated_at') = (v_new_data - 'updated_at') THEN
                RETURN NEW;
            END IF;
        END IF;

        -- Determine user_id
        v_user_id := auth.uid();

        -- Fetch email if user exists
        IF v_user_id IS NOT NULL THEN
            SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
        END IF;

        -- Determine company_id from row or fallback
        IF TG_OP = 'DELETE' THEN
            BEGIN
                v_company_id := OLD.company_id;
            EXCEPTION WHEN OTHERS THEN
                v_company_id := public.get_my_company_id();
            END;
        ELSE
            BEGIN
                v_company_id := NEW.company_id;
            EXCEPTION WHEN OTHERS THEN
                v_company_id := public.get_my_company_id();
            END;
        END IF;

        IF v_company_id IS NULL THEN
            v_company_id := public.get_my_company_id();
        END IF;

        -- Determine record ID
        IF TG_OP = 'DELETE' THEN
            BEGIN
                v_record_id := OLD.id::TEXT;
            EXCEPTION WHEN OTHERS THEN
                v_record_id := NULL;
            END;
        ELSE
            BEGIN
                v_record_id := NEW.id::TEXT;
            EXCEPTION WHEN OTHERS THEN
                v_record_id := NULL;
            END;
        END IF;

        -- Setup old and new JSON data & description
        IF TG_OP = 'INSERT' THEN
            v_action := 'INSERT';
            v_new_data := to_jsonb(NEW);

            IF TG_TABLE_NAME = 'employees' THEN
                v_description := 'Added employee: ' || COALESCE(NEW.name, 'Unknown');
            ELSIF TG_TABLE_NAME = 'leaves' THEN
                v_description := 'Submitted leave request for type: ' || COALESCE(NEW.type, 'Leave');
            ELSIF TG_TABLE_NAME = 'crm_deals' THEN
                v_description := 'Created deal: ' || COALESCE(NEW.title, 'New Deal');
            ELSIF TG_TABLE_NAME = 'crm_contacts' THEN
                v_description := 'Added contact: ' || COALESCE(NEW.name, 'New Contact');
            ELSIF TG_TABLE_NAME = 'crm_tasks' THEN
                v_description := 'Added CRM task: ' || COALESCE(NEW.title, 'New Task');
            ELSIF TG_TABLE_NAME = 'attendance' THEN
                v_description := 'Marked attendance';
            ELSIF TG_TABLE_NAME = 'payroll' THEN
                v_description := 'Created payroll draft for employee';
            ELSIF TG_TABLE_NAME = 'assets' THEN
                v_description := 'Registered asset: ' || COALESCE(NEW.name, 'New Asset');
            ELSIF TG_TABLE_NAME = 'tickets' THEN
                v_description := 'Created support ticket: ' || COALESCE(NEW.subject, 'New Ticket');
            ELSIF TG_TABLE_NAME = 'announcements' THEN
                v_description := 'Published announcement: ' || COALESCE(NEW.title, 'New Announcement');
            ELSE
                v_description := 'Added new record to ' || TG_TABLE_NAME;
            END IF;

        ELSIF TG_OP = 'UPDATE' THEN
            v_action := 'UPDATE';

            IF TG_TABLE_NAME = 'employees' THEN
                v_description := 'Updated employee details: ' || COALESCE(NEW.name, 'Unknown');
            ELSIF TG_TABLE_NAME = 'leaves' THEN
                v_description := 'Updated leave request status: ' || COALESCE(NEW.type, 'Leave') || ' (Status: ' || COALESCE(NEW.status, 'Pending') || ')';
            ELSIF TG_TABLE_NAME = 'crm_deals' THEN
                v_description := 'Updated deal: ' || COALESCE(NEW.title, 'Deal') || ' (Stage: ' || COALESCE(NEW.stage, 'Stage') || ')';
            ELSIF TG_TABLE_NAME = 'attendance' THEN
                v_description := 'Updated attendance record';
            ELSIF TG_TABLE_NAME = 'payroll' THEN
                v_description := 'Updated payroll record (Status: ' || COALESCE(NEW.status, 'Draft') || ')';
            ELSIF TG_TABLE_NAME = 'assets' THEN
                v_description := 'Updated asset: ' || COALESCE(NEW.name, 'Asset') || ' (Status: ' || COALESCE(NEW.status, 'Available') || ')';
            ELSIF TG_TABLE_NAME = 'tickets' THEN
                v_description := 'Updated ticket: ' || COALESCE(NEW.subject, 'Ticket') || ' (Status: ' || COALESCE(NEW.status, 'Open') || ')';
            ELSE
                v_description := 'Updated record in ' || TG_TABLE_NAME;
            END IF;

        ELSIF TG_OP = 'DELETE' THEN
            v_action := 'DELETE';
            v_old_data := to_jsonb(OLD);

            IF TG_TABLE_NAME = 'employees' THEN
                v_description := 'Removed employee: ' || COALESCE(OLD.name, 'Unknown');
            ELSIF TG_TABLE_NAME = 'leaves' THEN
                v_description := 'Deleted leave request';
            ELSIF TG_TABLE_NAME = 'crm_deals' THEN
                v_description := 'Deleted deal: ' || COALESCE(OLD.title, 'Deal');
            ELSIF TG_TABLE_NAME = 'crm_contacts' THEN
                v_description := 'Deleted contact: ' || COALESCE(OLD.name, 'Contact');
            ELSIF TG_TABLE_NAME = 'assets' THEN
                v_description := 'Removed asset: ' || COALESCE(OLD.name, 'Asset');
            ELSIF TG_TABLE_NAME = 'announcements' THEN
                v_description := 'Removed announcement: ' || COALESCE(OLD.title, 'Announcement');
            ELSE
                v_description := 'Deleted record from ' || TG_TABLE_NAME;
            END IF;
        END IF;

        -- Insert the audit log row
        IF v_company_id IS NOT NULL THEN
            INSERT INTO public.activity_logs (
                company_id,
                user_id,
                user_email,
                action,
                table_name,
                record_id,
                old_data,
                new_data,
                description
            ) VALUES (
                v_company_id,
                v_user_id,
                v_user_email,
                v_action,
                TG_TABLE_NAME,
                v_record_id,
                v_old_data,
                v_new_data,
                v_description
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$;

-- ============================================================================
-- 4. Fix missing FK on overtime_requests.employee_id -> public.employees(id)
--    Uses NOT VALID + VALIDATE CONSTRAINT to avoid write locks; fixes PostgREST HTTP 400s.
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.overtime_requests'::regclass
          AND conname = 'overtime_requests_employee_id_fkey'
    ) THEN
        ALTER TABLE public.overtime_requests
            ADD CONSTRAINT overtime_requests_employee_id_fkey
            FOREIGN KEY (employee_id) REFERENCES public.employees(id) NOT VALID;
    END IF;
END $$;

ALTER TABLE public.overtime_requests
    VALIDATE CONSTRAINT overtime_requests_employee_id_fkey;

-- ============================================================================
-- 5. RLS InitPlan & Duplicate Permissive Policy Consolidation
--    Wraps auth.uid()/auth.role()/get_my_company_id() in (select ...) and removes
--    overlapping permissive policies on hot tables while preserving exact access rules.
-- ============================================================================

-- accounting_journal_entries (consolidate 4 overlapping policies into 1)
DROP POLICY IF EXISTS "Tenant Isolation" ON public.accounting_journal_entries;
DROP POLICY IF EXISTS "Permissive Tenant Delete" ON public.accounting_journal_entries;
DROP POLICY IF EXISTS "Permissive Tenant Insert" ON public.accounting_journal_entries;
DROP POLICY IF EXISTS "Permissive Tenant Update" ON public.accounting_journal_entries;
CREATE POLICY "Tenant Isolation"
    ON public.accounting_journal_entries
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

-- accounting_journal_lines (consolidate 4 overlapping policies into 1)
DROP POLICY IF EXISTS "Tenant Isolation" ON public.accounting_journal_lines;
DROP POLICY IF EXISTS "Permissive Tenant Delete" ON public.accounting_journal_lines;
DROP POLICY IF EXISTS "Permissive Tenant Insert" ON public.accounting_journal_lines;
DROP POLICY IF EXISTS "Permissive Tenant Update" ON public.accounting_journal_lines;
CREATE POLICY "Tenant Isolation"
    ON public.accounting_journal_lines
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

-- org_leave_types (consolidate 5 overlapping policies into 1)
DROP POLICY IF EXISTS "Tenant Isolation" ON public.org_leave_types;
DROP POLICY IF EXISTS "Users can delete org_leave_types" ON public.org_leave_types;
DROP POLICY IF EXISTS "Users can insert org_leave_types" ON public.org_leave_types;
DROP POLICY IF EXISTS "Users can view org_leave_types" ON public.org_leave_types;
DROP POLICY IF EXISTS "Users can update org_leave_types" ON public.org_leave_types;
CREATE POLICY "Tenant Isolation"
    ON public.org_leave_types
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

-- Single-policy tenant tables (wrap InitPlan + restrict to authenticated)
DROP POLICY IF EXISTS "Tenant Isolation" ON public.activity_logs;
CREATE POLICY "Tenant Isolation"
    ON public.activity_logs
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

DROP POLICY IF EXISTS "Tenant Isolation" ON public.announcements;
CREATE POLICY "Tenant Isolation"
    ON public.announcements
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

DROP POLICY IF EXISTS "Tenant Isolation" ON public.attendance;
CREATE POLICY "Tenant Isolation"
    ON public.attendance
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

DROP POLICY IF EXISTS "Tenant Isolation" ON public.employees;
CREATE POLICY "Tenant Isolation"
    ON public.employees
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

DROP POLICY IF EXISTS "Tenant Isolation" ON public.leaves;
CREATE POLICY "Tenant Isolation"
    ON public.leaves
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

DROP POLICY IF EXISTS "Tenant Isolation" ON public.notifications;
CREATE POLICY "Tenant Isolation"
    ON public.notifications
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

DROP POLICY IF EXISTS "Tenant Isolation chat_rooms" ON public.chat_rooms;
CREATE POLICY "Tenant Isolation chat_rooms"
    ON public.chat_rooms
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

DROP POLICY IF EXISTS "Tenant Isolation chat_messages" ON public.chat_messages;
CREATE POLICY "Tenant Isolation chat_messages"
    ON public.chat_messages
    FOR ALL
    TO authenticated
    USING (
        room_id IN (
            SELECT chat_rooms.id
            FROM public.chat_rooms
            WHERE chat_rooms.company_id = (select public.get_my_company_id())
        )
    )
    WITH CHECK (
        room_id IN (
            SELECT chat_rooms.id
            FROM public.chat_rooms
            WHERE chat_rooms.company_id = (select public.get_my_company_id())
        )
    );

DROP POLICY IF EXISTS "Company admin manages permissions" ON public.user_permissions;
CREATE POLICY "Company admin manages permissions"
    ON public.user_permissions
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

DROP POLICY IF EXISTS "workflow_instances_isolation" ON public.workflow_instances;
CREATE POLICY "workflow_instances_isolation"
    ON public.workflow_instances
    FOR ALL
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));

-- overtime_requests
DROP POLICY IF EXISTS "Company access overtime_requests" ON public.overtime_requests;
CREATE POLICY "Company access overtime_requests"
    ON public.overtime_requests
    FOR ALL
    TO authenticated
    USING (
        company_id IN (
            SELECT user_company_access.company_id
            FROM public.user_company_access
            WHERE user_company_access.user_id = (select auth.uid())
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT user_company_access.company_id
            FROM public.user_company_access
            WHERE user_company_access.user_id = (select auth.uid())
        )
    );

-- missed_punch_requests (preserve existing access semantics with InitPlan wrappers)
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.missed_punch_requests;
CREATE POLICY "Tenant Isolation Select"
    ON public.missed_punch_requests
    FOR SELECT
    TO authenticated
    USING (
        (company_id = (select public.get_my_company_id()))
        OR (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = (select auth.uid())))
        OR (employee_id IN (SELECT employees.id FROM public.employees WHERE employees.profile_id = (select auth.uid())))
    );

DROP POLICY IF EXISTS "Tenant Isolation Insert" ON public.missed_punch_requests;
CREATE POLICY "Tenant Isolation Insert"
    ON public.missed_punch_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (company_id = (select public.get_my_company_id()))
        OR (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = (select auth.uid())))
        OR (
            employee_id IN (
                SELECT employees.id
                FROM public.employees
                WHERE (employees.profile_id = (select auth.uid()))
                   OR (employees.company_id = (select public.get_my_company_id()))
            )
        )
        OR ((select auth.role()) = 'authenticated'::text)
    );

DROP POLICY IF EXISTS "Tenant Isolation Update" ON public.missed_punch_requests;
CREATE POLICY "Tenant Isolation Update"
    ON public.missed_punch_requests
    FOR UPDATE
    TO authenticated
    USING (
        (company_id = (select public.get_my_company_id()))
        OR (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = (select auth.uid())))
    );

DROP POLICY IF EXISTS "Tenant Isolation Delete" ON public.missed_punch_requests;
CREATE POLICY "Tenant Isolation Delete"
    ON public.missed_punch_requests
    FOR DELETE
    TO authenticated
    USING (
        (company_id = (select public.get_my_company_id()))
        OR (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = (select auth.uid())))
    );

-- payroll_records (split write vs combined SELECT so there is only 1 SELECT policy)
DROP POLICY IF EXISTS "Tenant Isolation" ON public.payroll_records;
DROP POLICY IF EXISTS "Employees can view own payroll" ON public.payroll_records;
CREATE POLICY "Tenant and self view payroll"
    ON public.payroll_records
    FOR SELECT
    TO authenticated
    USING (
        (company_id = (select public.get_my_company_id()))
        OR (
            employee_id IN (
                SELECT employees.id
                FROM public.employees
                WHERE employees.profile_id = (select auth.uid())
            )
        )
    );
CREATE POLICY "Tenant Insert payroll"
    ON public.payroll_records
    FOR INSERT
    TO authenticated
    WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Tenant Update payroll"
    ON public.payroll_records
    FOR UPDATE
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Tenant Delete payroll"
    ON public.payroll_records
    FOR DELETE
    TO authenticated
    USING (company_id = (select public.get_my_company_id()));

-- profiles (consolidate 3 overlapping SELECT policies into 1 + InitPlan INSERT/UPDATE)
DROP POLICY IF EXISTS "Users can see colleagues" ON public.profiles;
DROP POLICY IF EXISTS "Users can see own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own and colleague profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        (id = (select auth.uid()))
        OR (company_id = (select public.get_my_company_id()))
    );

CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = (select auth.uid()))
    WITH CHECK (id = (select auth.uid()));

-- roles (separate read vs tenant write so SELECT doesn't evaluate both)
DROP POLICY IF EXISTS "Tenant Isolation" ON public.roles;
DROP POLICY IF EXISTS "Users can view roles" ON public.roles;
CREATE POLICY "Users can view roles"
    ON public.roles
    FOR SELECT
    TO authenticated
    USING (true);
CREATE POLICY "Tenant Insert roles"
    ON public.roles
    FOR INSERT
    TO authenticated
    WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Tenant Update roles"
    ON public.roles
    FOR UPDATE
    TO authenticated
    USING (company_id = (select public.get_my_company_id()))
    WITH CHECK (company_id = (select public.get_my_company_id()));
CREATE POLICY "Tenant Delete roles"
    ON public.roles
    FOR DELETE
    TO authenticated
    USING (company_id = (select public.get_my_company_id()));

-- user_company_access (consolidate SELECT & wrap auth.uid())
DROP POLICY IF EXISTS "Admins can manage company access" ON public.user_company_access;
DROP POLICY IF EXISTS "Users can see own access" ON public.user_company_access;

CREATE POLICY "Users and admins can view company access"
    ON public.user_company_access
    FOR SELECT
    TO authenticated
    USING (
        (user_id = (select auth.uid()))
        OR EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = (select auth.uid())
              AND (
                  (lower(profiles.role) = ANY (ARRAY['super admin'::text, 'superadmin'::text]))
                  OR (
                      (lower(profiles.role) = ANY (ARRAY['admin'::text, 'managing director'::text]))
                      AND profiles.company_id = user_company_access.company_id
                  )
              )
        )
    );

CREATE POLICY "Admins can insert company access"
    ON public.user_company_access
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = (select auth.uid())
              AND (
                  (lower(profiles.role) = ANY (ARRAY['super admin'::text, 'superadmin'::text]))
                  OR (
                      (lower(profiles.role) = ANY (ARRAY['admin'::text, 'managing director'::text]))
                      AND profiles.company_id = user_company_access.company_id
                  )
              )
        )
    );

CREATE POLICY "Admins can update company access"
    ON public.user_company_access
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = (select auth.uid())
              AND (
                  (lower(profiles.role) = ANY (ARRAY['super admin'::text, 'superadmin'::text]))
                  OR (
                      (lower(profiles.role) = ANY (ARRAY['admin'::text, 'managing director'::text]))
                      AND profiles.company_id = user_company_access.company_id
                  )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = (select auth.uid())
              AND (
                  (lower(profiles.role) = ANY (ARRAY['super admin'::text, 'superadmin'::text]))
                  OR (
                      (lower(profiles.role) = ANY (ARRAY['admin'::text, 'managing director'::text]))
                      AND profiles.company_id = user_company_access.company_id
                  )
              )
        )
    );

CREATE POLICY "Admins can delete company access"
    ON public.user_company_access
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = (select auth.uid())
              AND (
                  (lower(profiles.role) = ANY (ARRAY['super admin'::text, 'superadmin'::text]))
                  OR (
                      (lower(profiles.role) = ANY (ARRAY['admin'::text, 'managing director'::text]))
                      AND profiles.company_id = user_company_access.company_id
                  )
              )
        )
    );
