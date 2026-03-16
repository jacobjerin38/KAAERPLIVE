-- Phase 16: Employee Schema Updates
-- Add profile_photo_url and ensure employee_code exists

DO $$
BEGIN
    -- Profile Photo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='profile_photo_url') THEN
        ALTER TABLE employees ADD COLUMN profile_photo_url TEXT;
    END IF;

    -- Employee Code (If not exists)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='employee_code') THEN
        ALTER TABLE employees ADD COLUMN employee_code TEXT;
    END IF;

    -- Add a unique constraint to employee_code if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_employee_code_key') THEN
        ALTER TABLE employees ADD CONSTRAINT employees_employee_code_key UNIQUE (company_id, employee_code);
    END IF;

END $$;
