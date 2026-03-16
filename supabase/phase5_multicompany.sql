-- ==============================================================================
-- KAA ERP Phase 5 - Multi-Company & Group Architecture
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMA CHANGES
-- ------------------------------------------------------------------------------

-- 1.1 Group Companies (New Table)
CREATE TABLE IF NOT EXISTS group_companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    logo_url TEXT,
    description TEXT
);

ALTER TABLE group_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Active Groups" ON group_companies FOR SELECT USING (status = 'active');

-- 1.2 Update Companies Table (Add Group Link, Currency, Country, Status)
-- Checking if 'companies' or 'company_master' exists - assuming 'companies' based on user request but checking for 'company_master' too.
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'company_master') THEN
        ALTER TABLE company_master 
        ADD COLUMN IF NOT EXISTS group_company_id UUID REFERENCES group_companies(id),
        ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
        ADD COLUMN IF NOT EXISTS country TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'companies') THEN
        ALTER TABLE companies 
        ADD COLUMN IF NOT EXISTS group_company_id UUID REFERENCES group_companies(id),
        ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
        ADD COLUMN IF NOT EXISTS country TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
    END IF;
END $$;

-- 1.3 User Company Access (New Table)
CREATE TABLE IF NOT EXISTS user_company_access (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID NOT NULL, -- FK added below dynamically
    role_id UUID REFERENCES roles(id),
    is_default BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    UNIQUE(user_id, company_id)
);

-- Add dynamic FK for company_id
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'company_master') THEN
        ALTER TABLE user_company_access 
        ADD CONSTRAINT fk_uca_company FOREIGN KEY (company_id) REFERENCES company_master(id) ON DELETE CASCADE;
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'companies') THEN
        ALTER TABLE user_company_access 
        ADD CONSTRAINT fk_uca_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE user_company_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own access" ON user_company_access FOR SELECT USING (auth.uid() = user_id);

-- 1.4 Update Roles Table (Add Scope)
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'COMPANY' CHECK (scope IN ('COMPANY', 'GROUP'));

-- ------------------------------------------------------------------------------
-- 2. AUTHENTICATION & CONTEXT
-- ------------------------------------------------------------------------------

-- 2.1 Get accessible companies for current user
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
        c.code, -- Assuming code column exists
        g.name,
        r.name,
        uca.is_default
    FROM 
        user_company_access uca
    JOIN 
        (SELECT id, name, code, group_company_id, status FROM company_master 
         UNION ALL 
         SELECT id, name, code, group_company_id, status FROM companies WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_master')) c ON c.id = uca.company_id
    LEFT JOIN 
        group_companies g ON g.id = c.group_company_id
    LEFT JOIN 
        roles r ON r.id = uca.role_id
    WHERE 
        uca.user_id = auth.uid() 
        AND uca.status = 'active'
        AND c.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.3 Get Current Company ID (Helper for RLS)
CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS UUID AS $$
BEGIN
    -- 1. Try to get from config setting (set by client header or wrapper)
    BEGIN
        DECLARE
            v_setting_text TEXT;
        BEGIN
            v_setting_text := current_setting('app.current_company', true);
            IF v_setting_text IS NOT NULL AND v_setting_text <> '' THEN
                RETURN v_setting_text::UUID;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END;

    -- 2. Fallback: Check if we can get it from profiles (Legacy/Default)
    DECLARE
        v_company_id UUID;
    BEGIN
        SELECT company_id INTO v_company_id FROM profiles WHERE id = auth.uid();
        RETURN v_company_id;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- 3. MIGRATION DATA (Run once)
-- ------------------------------------------------------------------------------

-- Backfill user_company_access from profiles
-- Fix for missing role_id: Join with roles table on name and company_id
INSERT INTO user_company_access (user_id, company_id, role_id, is_default, status)
SELECT 
    p.id as user_id, 
    p.company_id, 
    r.id as role_id, 
    true as is_default, 
    'active' as status
FROM profiles p
LEFT JOIN roles r ON r.name = p.role -- Assuming profiles.role contains the role name
    AND (r.company_id = p.company_id OR r.company_id IS NULL) -- Match company specific or global roles
WHERE p.company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;
