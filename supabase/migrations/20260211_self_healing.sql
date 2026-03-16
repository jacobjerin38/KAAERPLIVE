-- ==============================================================================
-- SELF-HEALING: Fix My Access
-- ==============================================================================

CREATE OR REPLACE FUNCTION rpc_fix_my_access()
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID;
    v_profile_exists BOOLEAN;
    v_access_exists BOOLEAN;
BEGIN
    -- 1. Check Profile
    SELECT company_id INTO v_company_id FROM profiles WHERE id = v_user_id;
    
    IF v_company_id IS NULL THEN
        RETURN 'Error: No profile found or no company linked in profile.';
    END IF;

    -- 2. Check if Company Exists
    IF NOT EXISTS (SELECT 1 FROM companies WHERE id = v_company_id) THEN
        RETURN 'Error: Linked company does not exist in database.';
    END IF;

    -- 3. Fix User Company Access
    INSERT INTO user_company_access (user_id, company_id, is_default, status)
    VALUES (v_user_id, v_company_id, true, 'active')
    ON CONFLICT (user_id, company_id) 
    DO UPDATE SET status = 'active';

    -- 4. Fix Company Status (Just in case)
    UPDATE companies SET status = 'active' WHERE id = v_company_id AND (status IS NULL OR status != 'active');

    RETURN 'Success: Access repaired. Please reload.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
