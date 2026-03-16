-- ==============================================================================
-- FIX: Organization Visibility & Access
-- ==============================================================================

-- 1. Robust Backfill of user_company_access
--    This ensures every user in 'profiles' has an entry in 'user_company_access'
--    matching their profile's company_id.
DO $$
DECLARE
    r RECORD;
    v_role_id UUID;
BEGIN
    FOR r IN SELECT * FROM profiles WHERE company_id IS NOT NULL LOOP
        -- Try to find a role ID that matches their profile role name
        SELECT id INTO v_role_id FROM roles 
        WHERE company_id = r.company_id 
        AND name ILIKE r.role
        LIMIT 1;

        -- If no match, try to find ANY role for that company (e.g. 'Employee' or 'Admin')
        IF v_role_id IS NULL THEN
            SELECT id INTO v_role_id FROM roles WHERE company_id = r.company_id LIMIT 1;
        END IF;

        -- Insert if not exists
        INSERT INTO user_company_access (user_id, company_id, role_id, is_default, status)
        VALUES (r.id, r.company_id, v_role_id, true, 'active')
        ON CONFLICT (user_id, company_id) DO NOTHING;
    END LOOP;
END $$;


-- 2. Update RPC to be more permissive
--    If user has access in `user_company_access`, use it.
--    Fallback: If table is empty for user, try to use `profiles.company_id`.
CREATE OR REPLACE FUNCTION rpc_get_user_companies()
RETURNS TABLE (
    company_id UUID,
    company_name TEXT,
    company_code TEXT,
    group_name TEXT,
    role_name TEXT,
    is_default BOOLEAN
) AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check if user has explicit access
    SELECT COUNT(*) INTO v_count FROM user_company_access WHERE user_id = auth.uid();

    IF v_count > 0 THEN
        RETURN QUERY
        SELECT 
            c.id,
            c.name,
            c.code,
            g.name,
            r.name,
            uca.is_default
        FROM 
            user_company_access uca
        JOIN 
            companies c ON c.id = uca.company_id
        LEFT JOIN 
            group_companies g ON g.id = c.group_company_id
        LEFT JOIN 
            roles r ON r.id = uca.role_id
        WHERE 
            uca.user_id = auth.uid() 
            AND uca.status = 'active';
    ELSE
        -- Fallback: Return the company from roles/profiles directly if possible
        -- Or just query companies matching profiles.company_id
        RETURN QUERY
        SELECT 
            c.id,
            c.name,
            c.code,
            NULL::TEXT as group_name,
            p.role as role_name,
            true as is_default
        FROM 
            profiles p
        JOIN 
            companies c ON c.id = p.company_id
        WHERE 
            p.id = auth.uid();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
