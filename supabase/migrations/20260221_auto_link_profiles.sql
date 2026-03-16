-- Migration: 20260221_auto_link_profiles.sql
-- Description: Updates the handle_new_user trigger on auth.users to automatically map to public.employees by email.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_emp_id UUID;
    v_company_id UUID;
    v_role TEXT := 'Employee'; -- Default role
    v_status TEXT := 'Active';
BEGIN
    -- 1. Try to find a matching employee by email (case-insensitive)
    SELECT id, company_id, role
    INTO v_emp_id, v_company_id, v_role
    FROM public.employees
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;

    -- 2. Insert into public.profiles
    --    If v_emp_id is null, it just creates a standard unlinked profile.
    --    If it found a match, it injects the ID and specific role securely.
    INSERT INTO public.profiles (
        id, 
        email, 
        role, 
        employee_id, 
        company_id
    )
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(v_role, 'Employee'), 
        v_emp_id, 
        v_company_id
    )
    -- If a profile somehow already exists, update it instead of failing
    ON CONFLICT (id) DO UPDATE 
    SET 
        email = EXCLUDED.email,
        employee_id = COALESCE(public.profiles.employee_id, EXCLUDED.employee_id),
        company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Ensure the trigger uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
