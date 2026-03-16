-- ==============================================================================
-- KAA ERP Phase 5 - Data Linkage Migration
-- Creates KAA Group/Company and links all orphan data
-- ==============================================================================

DO $$
DECLARE
    v_group_id UUID;
    v_company_id UUID;
    v_admin_role_id UUID;
    v_user_record RECORD;
BEGIN
    -- 1. Create or Get 'KAA Group'
    SELECT id INTO v_group_id FROM group_companies WHERE code = 'KAA';
    
    IF v_group_id IS NULL THEN
        INSERT INTO group_companies (name, code, status, description)
        VALUES ('KAA Group', 'KAA', 'active', 'Primary Holding Group')
        RETURNING id INTO v_group_id;
        RAISE NOTICE 'Created KAA Group: %', v_group_id;
    END IF;

    -- 2. Create or Get 'KAA Company'
    SELECT id INTO v_company_id FROM companies WHERE code = 'KAA-MAIN';
    
    IF v_company_id IS NULL THEN
        -- Check if a company exists to update, otherwise insert
        IF EXISTS (SELECT 1 FROM companies LIMIT 1) THEN
             -- Use the first existing company as the main one if it has no group
             SELECT id INTO v_company_id FROM companies LIMIT 1;
             UPDATE companies 
             SET group_company_id = v_group_id, code = 'KAA-MAIN', name = 'KAA Company' 
             WHERE id = v_company_id;
             RAISE NOTICE 'Updated existing company to KAA Company: %', v_company_id;
        ELSE
            INSERT INTO companies (name, code, status, group_company_id, currency, country)
            VALUES ('KAA Company', 'KAA-MAIN', 'active', v_group_id, 'USD', 'US')
            RETURNING id INTO v_company_id;
            RAISE NOTICE 'Created KAA Company: %', v_company_id;
        END IF;
    ELSE
         -- Ensure it's linked to the group
         UPDATE companies SET group_company_id = v_group_id WHERE id = v_company_id;
    END IF;

    -- 3. Get Admin Role ID (or first available role)
    SELECT id INTO v_admin_role_id FROM roles WHERE name ILIKE '%Admin%' LIMIT 1;
    IF v_admin_role_id IS NULL THEN
        SELECT id INTO v_admin_role_id FROM roles LIMIT 1;
    END IF;

    -- 4. Link Profiles
    UPDATE profiles SET company_id = v_company_id WHERE company_id IS NULL;

    -- 5. Grant Access to All Users
    FOR v_user_record IN SELECT id FROM auth.users LOOP
        INSERT INTO user_company_access (user_id, company_id, role_id, is_default, status)
        VALUES (v_user_record.id, v_company_id, v_admin_role_id, true, 'active')
        ON CONFLICT (user_id, company_id) DO UPDATE
        SET is_default = true; -- Ensure it's default
    END LOOP;

    -- 6. Link Master Data (Dynamic Checks)
    -- Financial Years
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'org_financial_years') THEN
        UPDATE org_financial_years SET company_id = v_company_id WHERE company_id IS NULL;
    END IF;
    
    -- Departments
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'param_departments') THEN
        UPDATE param_departments SET company_id = v_company_id WHERE company_id IS NULL;
    END IF;

    -- Designations
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'param_designations') THEN
        UPDATE param_designations SET company_id = v_company_id WHERE company_id IS NULL;
    END IF;
    
    -- Employees
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'employees') THEN
        UPDATE employees SET company_id = v_company_id WHERE company_id IS NULL;
    END IF;

    RAISE NOTICE 'Data successfully linked to KAA Company (%) and Group (%)', v_company_id, v_group_id;
END $$;
