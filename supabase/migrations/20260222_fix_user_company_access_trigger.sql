-- Update the handle_new_user trigger to ensure user_company_access is granted immediately upon sign-up if an employee record matches an invite email.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_emp_id UUID;
    v_company_id UUID;
    v_role TEXT := 'Employee'; -- Default role
    v_status TEXT := 'Active';
    v_role_id UUID;
BEGIN
    -- 1. Try to find a matching employee by email (case-insensitive)
    SELECT id, company_id, role
    INTO v_emp_id, v_company_id, v_role
    FROM public.employees
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;

    -- Look up role ID for user_company_access. Default to Employee role or NULL if none.
    IF v_company_id IS NOT NULL THEN
        SELECT id INTO v_role_id FROM public.roles WHERE company_id = v_company_id AND lower(name) = lower(COALESCE(v_role, 'Employee')) LIMIT 1;
        IF v_role_id IS NULL THEN
            SELECT id INTO v_role_id FROM public.roles WHERE company_id = v_company_id LIMIT 1;
        END IF;

        -- 1.5 Grant access to the company immediately so the user isn't stuck empty
        INSERT INTO public.user_company_access (user_id, company_id, is_default, status, role_id)
        VALUES (NEW.id, v_company_id, true, 'active', v_role_id)
        ON CONFLICT (user_id, company_id) DO NOTHING;
    END IF;

    -- 2. Insert into public.profiles
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
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        employee_id = COALESCE(public.profiles.employee_id, EXCLUDED.employee_id),
        company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id);

    RETURN NEW;
END;
$function$;
