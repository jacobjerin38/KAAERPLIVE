-- ==============================================================================
-- CLEANUP: Delete 'Company of arathyh8' and Ensure KAA Company Exists
-- Run this in Supabase SQL Editor
-- ==============================================================================

DO $$
DECLARE
    v_bad_company_id UUID;
    v_kaa_company_id UUID;
    v_group_id UUID;
    v_admin_role_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    -- 1. Ensure KAA Company Exists FIRST (so we can move users to it)
    SELECT id INTO v_kaa_company_id FROM companies WHERE code = 'KAA-MAIN';
    
    IF v_kaa_company_id IS NULL THEN
        -- Create Group if missing
        INSERT INTO group_companies (name, code, status, description)
        VALUES ('KAA Group', 'KAA', 'active', 'Primary Group')
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_group_id;

        -- Create Company
        INSERT INTO companies (name, code, status, group_company_id, currency, country)
        VALUES ('KAA Company', 'KAA-MAIN', 'active', v_group_id, 'USD', 'US')
        RETURNING id INTO v_kaa_company_id;
        
        RAISE NOTICE 'Created KAA Company: %', v_kaa_company_id;
    END IF;

    -- 2. Identify the unwanted company
    SELECT id INTO v_bad_company_id FROM companies 
    WHERE code = 'ARAT' OR name ILIKE '%arathyh8%';

    IF v_bad_company_id IS NOT NULL THEN
        RAISE NOTICE 'Found unwanted company: %', v_bad_company_id;
        
        -- Prevent deleting the target company if it matched 'ARAT' by mistake (safety check)
        IF v_bad_company_id = v_kaa_company_id THEN
             RAISE EXCEPTION 'Safety abort: Target company is same as KAA Company';
        END IF;

        -- 3. Delete related data (Manual Cleanup)
        
        -- Access
        DELETE FROM user_company_access WHERE company_id = v_bad_company_id;
        DELETE FROM user_company_access WHERE role_id IN (SELECT id FROM roles WHERE company_id = v_bad_company_id);
        
        -- HR / Payroll
        DELETE FROM payroll_records WHERE company_id = v_bad_company_id;
        DELETE FROM leave_applications WHERE company_id = v_bad_company_id;
        DELETE FROM attendance WHERE company_id = v_bad_company_id;
        DELETE FROM employee_skills WHERE employee_id IN (SELECT id FROM employees WHERE company_id = v_bad_company_id);
        DELETE FROM employee_career_timeline WHERE employee_id IN (SELECT id FROM employees WHERE company_id = v_bad_company_id);
        DELETE FROM employee_insights WHERE employee_id IN (SELECT id FROM employees WHERE company_id = v_bad_company_id);
        DELETE FROM assets WHERE company_id = v_bad_company_id; 
        DELETE FROM tickets WHERE company_id = v_bad_company_id;
        DELETE FROM employee_salary_components WHERE company_id = v_bad_company_id;
        DELETE FROM employees WHERE company_id = v_bad_company_id;
        
        -- Masters
        DELETE FROM departments WHERE company_id = v_bad_company_id;
        DELETE FROM org_designations WHERE company_id = v_bad_company_id;
        DELETE FROM roles WHERE company_id = v_bad_company_id;
        DELETE FROM org_salary_components WHERE company_id = v_bad_company_id;
        DELETE FROM org_leave_policies WHERE leave_type_id IN (SELECT id FROM org_leave_types WHERE company_id = v_bad_company_id);
        -- Removed employee_leave_balances deletion as table likely doesn't exist or handled by cascade
        DELETE FROM org_leave_types WHERE company_id = v_bad_company_id;
        DELETE FROM org_shift_timings WHERE company_id = v_bad_company_id;
        
        -- 4. Move Profiles to KAA Company (Fixes NOT NULL constraint)
        UPDATE profiles SET company_id = v_kaa_company_id WHERE company_id = v_bad_company_id;

        -- Finally Delete Company
        DELETE FROM companies WHERE id = v_bad_company_id;
        
        RAISE NOTICE 'Deleted Company of arathyh8 and moved users to KAA Company.';
    ELSE
        RAISE NOTICE 'Company of arathyh8 not found. Skipping deletion.';
    END IF;

    -- 5. Ensure User Admin Access to KAA Company
    -- Find Admin Role
    SELECT id INTO v_admin_role_id FROM roles WHERE name ILIKE '%Admin%' AND company_id IS NULL LIMIT 1; 
    IF v_admin_role_id IS NULL THEN
         SELECT id INTO v_admin_role_id FROM roles WHERE name ILIKE '%Admin%' AND company_id = v_kaa_company_id LIMIT 1;
    END IF;
    
    -- Fallback: Create Admin Role for KAA if missing
    IF v_admin_role_id IS NULL THEN
        INSERT INTO roles (name, company_id, scope) VALUES ('Admin', v_kaa_company_id, 'COMPANY') RETURNING id INTO v_admin_role_id;
    END IF;

    -- Grant Access
    INSERT INTO user_company_access (user_id, company_id, role_id, is_default, status)
    SELECT id, v_kaa_company_id, v_admin_role_id, true, 'active'
    FROM auth.users
    ON CONFLICT (user_id, company_id) DO NOTHING;

    RAISE NOTICE 'Ensured all users have access to KAA Company (%)', v_kaa_company_id;

END $$;
