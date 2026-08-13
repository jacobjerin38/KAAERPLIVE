-- Migration: 20260813_shift_night_handling.sql
-- Description: Add shift_type and is_overnight to org_shift_timings and update cross-midnight attendance punch logic

-- 1. Add shift_type and is_overnight columns to org_shift_timings if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'org_shift_timings' 
        AND column_name = 'shift_type'
    ) THEN
        ALTER TABLE public.org_shift_timings 
        ADD COLUMN shift_type text DEFAULT 'DAY';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'org_shift_timings' 
        AND column_name = 'is_overnight'
    ) THEN
        ALTER TABLE public.org_shift_timings 
        ADD COLUMN is_overnight boolean DEFAULT false;
    END IF;
END $$;

-- 2. Auto-migrate existing shift timings where start_time > end_time
UPDATE public.org_shift_timings
SET is_overnight = true,
    shift_type = 'NIGHT'
WHERE start_time > end_time;

-- 3. Create helper function for planned shift duration
CREATE OR REPLACE FUNCTION public.fn_calculate_shift_duration(
    p_start_time time without time zone,
    p_end_time time without time zone,
    p_is_overnight boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    v_diff numeric;
BEGIN
    IF p_start_time IS NULL OR p_end_time IS NULL THEN
        RETURN 0;
    END IF;

    IF p_is_overnight OR p_start_time > p_end_time THEN
        v_diff := EXTRACT(EPOCH FROM (p_end_time + INTERVAL '24 hours' - p_start_time)) / 3600.0;
    ELSE
        v_diff := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 3600.0;
    END IF;

    RETURN ROUND(GREATEST(0, v_diff)::numeric, 2);
END;
$$;

-- 4. Update rpc_sync_device_attendance for cross-midnight hardware punch pairing
CREATE OR REPLACE FUNCTION public.rpc_sync_device_attendance(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_log RECORD;
  v_employee_id UUID;
  v_att_record_id UUID;
  v_open_att_record_id UUID;
  v_synced INT := 0;
  v_failed INT := 0;
  v_skipped INT := 0;
  v_date DATE;
  v_check_in_ts TIMESTAMPTZ;
  v_diff_hours NUMERIC;
BEGIN
  FOR v_log IN
    SELECT * FROM device_attendance_logs
    WHERE company_id = p_company_id
      AND sync_status = 'pending'
    ORDER BY punch_time ASC
    LIMIT 500
  LOOP
    BEGIN
      -- Try to match employee by identifier (employee code, badge number, or name)
      SELECT e.id INTO v_employee_id
      FROM employees e
      WHERE e.company_id = p_company_id
        AND (
          e.employee_code = v_log.employee_identifier
          OR e.id::text = v_log.employee_identifier
          OR e.name ILIKE v_log.employee_identifier
        )
      LIMIT 1;

      IF v_employee_id IS NULL THEN
        UPDATE device_attendance_logs
        SET sync_status = 'failed',
            sync_error = 'Employee not found for identifier: ' || v_log.employee_identifier,
            synced_at = now()
        WHERE id = v_log.id;
        v_failed := v_failed + 1;
        CONTINUE;
      END IF;

      -- Update employee_id on the log
      UPDATE device_attendance_logs SET employee_id = v_employee_id WHERE id = v_log.id;

      v_date := (v_log.punch_time AT TIME ZONE 'UTC')::date;

      -- Check if there is an open attendance record (check_out IS NULL) created within the past 16 hours
      SELECT id, check_in INTO v_open_att_record_id, v_check_in_ts
      FROM attendance
      WHERE company_id = p_company_id
        AND employee_id = v_employee_id
        AND check_out IS NULL
        AND check_in IS NOT NULL
        AND check_in <= v_log.punch_time
        AND v_log.punch_time <= check_in + INTERVAL '16 hours'
      ORDER BY check_in DESC
      LIMIT 1;

      IF v_open_att_record_id IS NOT NULL AND (v_log.punch_type = 'OUT' OR v_log.punch_type = 'check_out' OR v_log.punch_type = 'auto') THEN
        -- Calculate total duration
        v_diff_hours := ROUND(GREATEST(0, EXTRACT(EPOCH FROM (v_log.punch_time - v_check_in_ts)) / 3600.0)::numeric, 2);
        
        UPDATE attendance
        SET check_out = v_log.punch_time,
            total_hours = v_diff_hours,
            duration = v_diff_hours,
            status = 'Present'
        WHERE id = v_open_att_record_id;

        v_att_record_id := v_open_att_record_id;
      ELSE
        -- Check if record already exists for exact date
        SELECT id INTO v_att_record_id
        FROM attendance
        WHERE company_id = p_company_id
          AND employee_id = v_employee_id
          AND date = v_date;

        IF v_att_record_id IS NULL THEN
          -- Create new attendance record
          INSERT INTO attendance (
            company_id, employee_id, date, 
            check_in, status, source, punch_method
          ) VALUES (
            p_company_id, v_employee_id, v_date, 
            v_log.punch_time, 'Present', 'device', 'device'
          )
          RETURNING id INTO v_att_record_id;
        ELSE
          -- Update existing record
          IF v_log.punch_type = 'IN' OR v_log.punch_type = 'check_in' THEN
            UPDATE attendance
            SET check_in = COALESCE(check_in, v_log.punch_time),
                status = 'Present'
            WHERE id = v_att_record_id;
          ELSE
            SELECT check_in INTO v_check_in_ts FROM attendance WHERE id = v_att_record_id;
            IF v_check_in_ts IS NOT NULL THEN
              v_diff_hours := ROUND(GREATEST(0, EXTRACT(EPOCH FROM (v_log.punch_time - v_check_in_ts)) / 3600.0)::numeric, 2);
            ELSE
              v_diff_hours := 0;
            END IF;

            UPDATE attendance
            SET check_out = v_log.punch_time,
                total_hours = v_diff_hours,
                duration = v_diff_hours,
                status = 'Present'
            WHERE id = v_att_record_id;
          END IF;
        END IF;
      END IF;

      UPDATE device_attendance_logs
      SET sync_status = 'synced',
          attendance_record_id = v_att_record_id,
          synced_at = now()
      WHERE id = v_log.id;

      v_synced := v_synced + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE device_attendance_logs
      SET sync_status = 'failed',
          sync_error = SQLERRM,
          synced_at = now()
      WHERE id = v_log.id;
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'synced', v_synced,
    'failed', v_failed,
    'skipped', v_skipped
  );
END;
$function$;
