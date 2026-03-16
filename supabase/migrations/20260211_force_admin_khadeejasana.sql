-- Migration: force_admin_khadeejasana
-- Explicitly make user matching 'khadeejasana457' an Admin

DO $$
DECLARE
    search_term text := 'khadeejasana457';
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
    wildcard_perm text[] := ARRAY['*'];
BEGIN
    -- 1. Find the user profile (Using ILIKE for partial match on email or name)
    SELECT id, company_id INTO target_profile_id, target_company_id
    FROM profiles
    WHERE email ILIKE '%' || search_term || '%'
       OR full_name ILIKE '%' || search_term || '%'
    LIMIT 1;

    IF target_profile_id IS NULL THEN
        RAISE EXCEPTION 'User matching "%" not found in profiles table', search_term;
    END IF;

    -- 2. Ensure Company ID (Assign to first company if null)
    IF target_company_id IS NULL THEN
        SELECT id INTO target_company_id FROM companies LIMIT 1;
        IF target_company_id IS NOT NULL THEN
            UPDATE profiles SET company_id = target_company_id WHERE id = target_profile_id;
        ELSE
             RAISE EXCEPTION 'No companies found to assign to user';
        END IF;
    END IF;

    -- 3. Ensure Admin Role Exists for this company
    SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin' AND company_id = target_company_id;

    IF admin_role_id IS NULL THEN
        INSERT INTO roles (name, description, permissions, status, company_id)
        VALUES ('Admin', 'System Administrator', all_perms, 'Active', target_company_id)
        RETURNING id INTO admin_role_id;
    ELSE
        -- Update permissions to be sure
        UPDATE roles SET permissions = all_perms WHERE id = admin_role_id;
    END IF;

    -- 4. Assign Role to User
    UPDATE profiles
    SET role = 'Admin',
        role_id = admin_role_id
    WHERE id = target_profile_id;
    
END $$;
