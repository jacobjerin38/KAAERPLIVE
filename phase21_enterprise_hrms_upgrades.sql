-- Phase 21: Enterprise HRMS Upgrades (Attendance, Leaves, Settings)
-- Safe, non-destructive ALTERS

-- 1. Mobile Attendance Location
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS check_in_location TEXT,
ADD COLUMN IF NOT EXISTS check_out_location TEXT;

-- 2. Leave Multi-level Approvals
ALTER TABLE leaves
ADD COLUMN IF NOT EXISTS level1_status TEXT DEFAULT 'Pending', -- e.g., Dept Head
ADD COLUMN IF NOT EXISTS level2_status TEXT DEFAULT 'Pending'; -- e.g., HR

-- 3. Overtime and Grace Timing Settings
CREATE TABLE IF NOT EXISTS org_attendance_settings (
    id SERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    grace_timing_minutes INTEGER DEFAULT 15,
    overtime_min_minutes INTEGER DEFAULT 60,
    overtime_multiplier NUMERIC DEFAULT 1.5,
    enable_mobile_attendance BOOLEAN DEFAULT true,
    enable_biometric BOOLEAN DEFAULT false,
    biometric_api_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_org_att_settings UNIQUE (company_id)
);

-- Enable RLS for settings
ALTER TABLE org_attendance_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'org_attendance_settings' AND policyname = 'Tenant Isolation Settings'
    ) THEN
        CREATE POLICY "Tenant Isolation Settings" ON org_attendance_settings 
            USING (company_id = get_my_company_id());
    END IF;
END
$$;

-- 4. Holiday Calendar
CREATE TABLE IF NOT EXISTS org_holidays (
    id SERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    is_recurring BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE org_holidays ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'org_holidays' AND policyname = 'Tenant Isolation Holidays'
    ) THEN
        CREATE POLICY "Tenant Isolation Holidays" ON org_holidays 
            USING (company_id = get_my_company_id());
    END IF;
END
$$;
