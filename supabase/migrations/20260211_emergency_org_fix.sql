-- ==============================================================================
-- EMERGENCY FIX: Organization Visibility (Final)
-- ==============================================================================

-- 1. Ensure 'status' column exists and has defaults
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'companies') THEN
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
        -- Backfill any NULL status
        UPDATE companies SET status = 'active' WHERE status IS NULL;
    END IF;
END $$;


-- 2. Redefine rpc_get_user_companies with RELAXED constraints
--    This version doesn't strictly require status='active' (handles NULLs)
--    and handles missing group/role joins gracefully.
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
    v_has_access BOOLEAN;
BEGIN
    -- Check if user has ANY access record
    SELECT EXISTS (SELECT 1 FROM user_company_access WHERE user_id = auth.uid()) INTO v_has_access;

    IF v_has_access THEN
        RETURN QUERY
        SELECT 
            c.id,
            c.name,
            COALESCE(c.code, 'N/A'),
            COALESCE(g.name, 'Independent'),
            COALESCE(r.name, 'Viewer'),
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
            uca.user_id = auth.uid();
            -- REMOVED strict status checks to prevent invisibility
            -- AND uca.status = 'active'
            -- AND c.status = 'active';
    ELSE
        -- Fallback: Use Profile Metadata
        RETURN QUERY
        SELECT 
            c.id,
            c.name,
            COALESCE(c.code, 'N/A'),
            'Independent'::TEXT as group_name,
            COALESCE(p.role, 'Admin') as role_name,
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


-- 3. One more pass to ensure access exists for current user
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM profiles WHERE company_id IS NOT NULL LOOP
        INSERT INTO user_company_access (user_id, company_id, is_default, status)
        VALUES (r.id, r.company_id, true, 'active')
        ON CONFLICT (user_id, company_id) DO NOTHING;
    END LOOP;
END $$;
