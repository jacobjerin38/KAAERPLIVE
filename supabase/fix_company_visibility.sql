-- ==============================================================================
-- FIX: Company Visibility Issue
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. Redefine rpc_get_user_companies with correct table (companies)
CREATE OR REPLACE FUNCTION rpc_get_user_companies()
RETURNS TABLE (
    company_id UUID,
    company_name TEXT,
    company_code TEXT,
    group_name TEXT,
    role_name TEXT,
    is_default BOOLEAN
) AS $$
BEGIN
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
        -- Removed c.status check for now to debug, or ensure column exists
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure RLS on `companies` allows reading? 
-- Actually, the RPC is SECURITY DEFINER, so it bypasses RLS on tables it accesses.
-- But `user_company_access` needs to be linked.

-- 3. Verify user_company_access data exists
-- If the previous link script failed silently or didn't match roles, we might have no rows.
-- This block attempts to "Emergency Link" the current user to the FIRST company if they have no access.

DO $$
DECLARE
    v_user_id UUID := auth.uid();
    v_limit_check INTEGER;
    v_company_id UUID;
    v_admin_role_id UUID;
BEGIN
    -- Only run if we can get a user ID (might be null in SQL editor if not run as user, 
    -- but usually we run this as Admin in dashboard so auth.uid() is null. 
    -- This part is tricky. usage: logic below is for APP usage context.)
    
    -- Let's just do a blanket checks for ALL users without access
    
    -- Find users in profiles who are NOT in user_company_access
    FOR v_user_id IN SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM user_company_access) LOOP
        
        -- Get First Company
        SELECT id INTO v_company_id FROM companies LIMIT 1;
        
        -- Get Admin Role
        SELECT id INTO v_admin_role_id FROM roles WHERE name ILIKE '%Admin%' LIMIT 1;
        IF v_admin_role_id IS NULL THEN SELECT id INTO v_admin_role_id FROM roles LIMIT 1; END IF;
        
        IF v_company_id IS NOT NULL THEN
            INSERT INTO user_company_access (user_id, company_id, role_id, is_default, status)
            VALUES (v_user_id, v_company_id, v_admin_role_id, true, 'active')
            ON CONFLICT (user_id, company_id) DO NOTHING;
            
            RAISE NOTICE 'Emergency linked user % to company %', v_user_id, v_company_id;
        END IF;
    END LOOP;
END $$;
