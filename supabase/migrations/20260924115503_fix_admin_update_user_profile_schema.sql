-- Replace admin_update_user with a schema-compatible version.
-- The live profiles table has no updated_at column, so attempting to set it
-- caused the entire profile update to fail. This function-only change does not
-- modify or remove any existing rows.
CREATE OR REPLACE FUNCTION public.admin_update_user(
    p_user_id UUID,
    p_full_name TEXT,
    p_role TEXT,
    p_employee_id UUID DEFAULT NULL::UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_company UUID;
    v_target_company UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT lower(role), company_id INTO v_caller_role, v_caller_company
    FROM public.profiles
    WHERE id = auth.uid();

    IF NOT FOUND OR v_caller_role IS NULL
       OR v_caller_role NOT IN ('admin', 'super admin', 'superadmin', 'managing director') THEN
        RAISE EXCEPTION 'Unauthorized: Only system administrators can update user accounts.';
    END IF;

    SELECT company_id INTO v_target_company
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found.';
    END IF;

    -- Non-superadmins can only update users in their own company
    IF v_caller_role NOT IN ('super admin', 'superadmin') THEN
        IF v_target_company IS NULL OR v_caller_company IS NULL OR v_target_company != v_caller_company THEN
            RAISE EXCEPTION 'Unauthorized: Cannot update a user belonging to another company.';
        END IF;
    END IF;

    UPDATE public.profiles
    SET full_name = COALESCE(p_full_name, full_name),
        role = COALESCE(p_role, role),
        employee_id = COALESCE(p_employee_id, employee_id)
    WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user(UUID, TEXT, TEXT, UUID) TO authenticated;
