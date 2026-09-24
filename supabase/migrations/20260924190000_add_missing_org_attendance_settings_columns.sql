-- Migration: 20260924190000_add_missing_org_attendance_settings_columns.sql
-- Description: Add missing configuration columns to org_attendance_settings for HRMS settings & biometric device sync

ALTER TABLE public.org_attendance_settings 
ADD COLUMN IF NOT EXISTS grace_timing_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS overtime_min_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS overtime_multiplier NUMERIC DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS enable_mobile_attendance BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_biometric BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS biometric_api_key TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
