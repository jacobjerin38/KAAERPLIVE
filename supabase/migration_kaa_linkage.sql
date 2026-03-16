-- ==============================================================================
-- KAA ERP Migration - Link Data to 'KAA' Company & Group
-- Run this in Supabase SQL Editor
-- ==============================================================================

DO $$
DECLARE
    v_group_id UUID;
    v_company_id UUID;
BEGIN
    -- 1. Create or Get 'KAA Group'
    SELECT id INTO v_group_id FROM group_companies WHERE code = 'KAA';
    
    IF v_group_id IS NULL THEN
        INSERT INTO group_companies (name, code, status, description)
        VALUES ('KAA Group', 'KAA', 'active', 'Primary Holding Group')
        RETURNING id INTO v_group_id;
        RAISE NOTICE 'Created KAA Group: %', v_group_id;
    ELSE
        RAISE NOTICE 'Found existing KAA Group: %', v_group_id;
    END IF;

    -- 2. Create or Get 'KAA Company' (and link to Group)
    -- Assuming we are using 'company_master' table based on previous steps
    SELECT id INTO v_company_id FROM company_master WHERE name = 'KAA Company';

    IF v_company_id IS NULL THEN
        INSERT INTO company_master (name, code, status, group_company_id, currency, country)
        VALUES ('KAA Company', 'KAA-MAIN', 'active', v_group_id, 'USD', 'US')
        RETURNING id INTO v_company_id;
        RAISE NOTICE 'Created KAA Company: %', v_company_id;
    ELSE
        -- Update existing to link to group
        UPDATE company_master 
        SET group_company_id = v_group_id 
        WHERE id = v_company_id;
        RAISE NOTICE 'Updated existing KAA Company linked to Group';
    END IF;

    -- 3. Link ALL existing data to this KAA Company
    -- This is a broad update to ensure migration from "No Company" or "Old Company" state
    
    -- 3.1 Link Employees (profiles)
    UPDATE profiles 
    SET company_id = v_company_id 
    WHERE company_id IS NULL;

    -- 3.2 Update User Access (New Table)
    -- Ensure all users have access to KAA Company
    INSERT INTO user_company_access (user_id, company_id, role_id, is_default, status)
    SELECT 
        id, 
        v_company_id, 
        (SELECT id FROM roles WHERE name = 'Admin' LIMIT 1), -- Default to Admin for safety in dev, or specific logic
        true, 
        'active'
    FROM auth.users
    ON CONFLICT (user_id, company_id) DO NOTHING;

    -- 3.3 Link Masters (Departments, Designations, etc.)
    -- Assuming these tables have company_id
    
    -- Update Departments
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'param_departments' AND column_name = 'company_id') THEN
        UPDATE param_departments SET company_id = v_company_id WHERE company_id IS NULL;
    END IF;

    -- Update Designations
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'param_designations' AND column_name = 'company_id') THEN
        UPDATE param_designations SET company_id = v_company_id WHERE company_id IS NULL;
    END IF;

    -- Update Financial Years
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'org_financial_years' AND column_name = 'company_id') THEN
        UPDATE org_financial_years SET company_id = v_company_id WHERE company_id IS NULL;
    END IF;
    
    RAISE NOTICE 'Migration Complete. All orphan data linked to KAA Company.';

END $$;
