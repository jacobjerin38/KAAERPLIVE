-- Migration: 20261007010000_fix_attendance_punch_in_repunch_safeguard.sql
-- Description:
-- Fix punch-in failure when an employee punches in after a previous checkout on the same day.
-- If an employee re-punches (new check_in provided, check_out unchanged), automatically clear check_out
-- rather than violating the chronology constraint (check_out cannot be earlier than check_in).

CREATE OR REPLACE FUNCTION public.fn_validate_attendance_punches()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If this is an UPDATE and neither check_in nor check_out was changed, do not block recalculations
    IF TG_OP = 'UPDATE' AND (NEW.check_in IS NOT DISTINCT FROM OLD.check_in) AND (NEW.check_out IS NOT DISTINCT FROM OLD.check_out) THEN
        RETURN NEW;
    END IF;

    -- If this is an UPDATE where check_in changed to a later time and check_out is earlier than check_in:
    -- Check if check_out was unchanged from OLD (e.g. caller performed a new punch-in and omitted check_out)
    IF TG_OP = 'UPDATE' AND NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL AND NEW.check_out < NEW.check_in THEN
        IF OLD.check_out IS NOT NULL AND NEW.check_out = OLD.check_out AND NEW.check_in <> OLD.check_in THEN
            -- Automatically clear previous check_out for the new active punch-in session!
            NEW.check_out := NULL;
            NEW.check_out_location := NULL;
            NEW.check_out_lat := NULL;
            NEW.check_out_lng := NULL;
            RETURN NEW;
        END IF;
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
