-- Phase 10: Attendance Operational Hardening

-- Add Audit Columns to Attendance Table
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS edit_reason TEXT;

-- Verify if RLS policies cover updates (usually yes, but good to check if specific columns need protection)
-- For now, standard RLS on attendance table should suffice.
