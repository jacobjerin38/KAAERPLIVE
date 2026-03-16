-- Migration: debug_user_sync_and_admin
-- 1. Sync missing users from auth.users to public.profiles (in case triggers failed)
-- 2. Force Admin for khadeejasana (broader match)

-- 1. Sync Logic
INSERT INTO public.profiles (id, email, full_name, created_at)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', email) as full_name, 
    created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. Force Admin Assignment
DO $$
DECLARE
    -- Broader search term to catch 'khadeejasana457@gmail.com' or variants
    search_term text := 'khadeejasana'; 
    target_profile_id UUID;
    target_company_id UUID;
    admin_role_id UUID;
    all_perms text[] := ARRAY[
        'hrms.employees.view', 'hrms.employees.manage', 'hrms.attendance.view', 'hrms.attendance.manage', 
        'hrms.leave.view', 'hrms.leave.manage', 'hrms.payroll.manage', 'hrms.assets.view', 'hrms.assets.manage', 
        'hrms.helpdesk.view', 'hrms.helpdesk.manage', 'hrms.reports.view',
        'crm.dashboard.view', 'crm.leads.view', 'crm.leads.manage', 'crm.deals.view', 'crm.deals.manage', 
        'crm.tasks.manage', 'crm.contacts.manage', 'crm.pipeline.manage', 'crm.settings.manage',
        'org.structure.view', 'org.company.manage', 'org.masters.manage', 'org.roles.manage', 'org.users.manage', 'org.workflows.manage', 'org.settings.manage',
        'finance.dashboard.view', 'finance.setup.manage', 'finance.payroll.manage', 'finance.invoices.manage', 'finance.expenses.manage',
        'inventory.view', 'inventory.manage',
        'manufacturing.view', 'manufacturing.manage',
        'procurement.view', 'procurement.manage',
        'essp.view', 'essp.profile.manage'
    ];
BEGIN
    -- Find user (try email first, then name)
    SELECT id, company_id INTO target_profile_id, target_company_id
    FROM profiles
    WHERE email ILIKE '%' || search_term || '%'
       OR full_name ILIKE '%' || search_term || '%'
    LIMIT 1;

    IF target_profile_id IS NULL THEN
        RAISE NOTICE 'Still could not find user matching %. Please check auth.users table.', search_term;
        RETURN;
    END IF;

    RAISE NOTICE 'Found User ID: %, Company: %', target_profile_id, target_company_id;

    -- Ensure Company (Assign to first found company if user has none)
    IF target_company_id IS NULL THEN
        SELECT id INTO target_company_id FROM companies LIMIT 1;
        
        IF target_company_id IS NOT NULL THEN
             UPDATE profiles SET company_id = target_company_id WHERE id = target_profile_id;
        ELSE
             -- Create a default company if mostly empty DB
             INSERT INTO companies (name, code, status, subscription_status)
             VALUES ('Default Company', 'DEF', 'active', 'active')
             RETURNING id INTO target_company_id;
             UPDATE profiles SET company_id = target_company_id WHERE id = target_profile_id;
        END IF;
    END IF;

    -- Ensure Admin Role exists for this company
    SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin' AND company_id = target_company_id;
    
    IF admin_role_id IS NULL THEN
        INSERT INTO roles (name, description, permissions, status, company_id)
        VALUES ('Admin', 'System Administrator', all_perms, 'Active', target_company_id)
        RETURNING id INTO admin_role_id;
    ELSE
        UPDATE roles SET permissions = all_perms WHERE id = admin_role_id;
    END IF;

    -- Update Profile with new Role and Link
    UPDATE profiles
    SET role = 'Admin', role_id = admin_role_id
    WHERE id = target_profile_id;
    
    RAISE NOTICE 'Successfully made user Admin.';
END $$;
