-- Migration: enhance_profiles_schema
-- Adds role_id and employee_id to profiles for robust linking

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- Migrate existing Role Names to Role IDs
DO $$
BEGIN
    UPDATE profiles p 
    SET role_id = r.id 
    FROM roles r 
    WHERE lower(p.role) = lower(r.name) 
    AND p.role_id IS NULL;
END $$;

-- Migrate existing Email Links to Employee IDs
DO $$
BEGIN
    UPDATE profiles p 
    SET employee_id = e.id 
    FROM employees e 
    WHERE p.email = e.email
    AND p.employee_id IS NULL;
END $$;
