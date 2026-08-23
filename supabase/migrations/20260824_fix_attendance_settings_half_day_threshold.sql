-- ==============================================================================
-- Migration: 20260824_fix_attendance_settings_half_day_threshold.sql
-- Description: Ensure half_day_threshold and late_half_day_threshold columns exist
--              in attendance_settings table to prevent schema cache lookup errors.
-- ==============================================================================

ALTER TABLE public.attendance_settings 
ADD COLUMN IF NOT EXISTS half_day_threshold INTEGER DEFAULT 3;

ALTER TABLE public.attendance_settings 
ADD COLUMN IF NOT EXISTS late_half_day_threshold INTEGER DEFAULT 3;

UPDATE public.attendance_settings 
SET half_day_threshold = COALESCE(late_half_day_threshold, 3) 
WHERE half_day_threshold IS NULL;

UPDATE public.attendance_settings 
SET late_half_day_threshold = COALESCE(half_day_threshold, 3) 
WHERE late_half_day_threshold IS NULL;

NOTIFY pgrst, 'reload schema';
