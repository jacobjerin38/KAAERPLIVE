-- Migration: 20261024170000_admin_reset_user_password.sql
-- Description: Adds admin_reset_user_password RPC to allow authorized administrators
-- to securely reset a user's password in auth.users using bcrypt encryption.

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
    p_user_id UUID,
    p_new_password TEXT DEFAULT '654321'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_company_id UUID;
    v_target_company_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    -- 1. Ensure caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Verify caller role
    SELECT lower(role), company_id INTO v_caller_role, v_caller_company_id
    FROM public.profiles 
    WHERE id = auth.uid();

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'super admin', 'superadmin', 'managing director', 'ceo') THEN
        RAISE EXCEPTION 'Unauthorized: Only system administrators can reset user passwords.';
    END IF;

    -- 3. Verify company membership (unless super admin)
    SELECT company_id INTO v_target_company_id 
    FROM public.profiles 
    WHERE id = p_user_id;

    IF v_caller_role NOT IN ('super admin', 'superadmin') THEN
        IF v_target_company_id IS NOT NULL AND v_caller_company_id IS NOT NULL AND v_target_company_id != v_caller_company_id THEN
            RAISE EXCEPTION 'Unauthorized: Cannot reset password for a user in another company.';
        END IF;
    END IF;

    -- 4. Hash password with bcrypt and update auth.users
    v_encrypted_pw := extensions.crypt(p_new_password, extensions.gen_salt('bf'));

    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw,
        updated_at = now()
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found in authentication system.';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password successfully reset'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;
