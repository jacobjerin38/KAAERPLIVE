-- Migration: fix_all_users_admin (v3 - handles all null constraints)

DO $$
DECLARE
    default_company_id UUID;
    admin_role_id UUID;
    comp RECORD;
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
    -- 1. Get Default Company
    SELECT id INTO default_company_id FROM companies LIMIT 1;
    IF default_company_id IS NULL THEN
        INSERT INTO companies (name, code, status, subscription_status)
        VALUES ('Primary Company', 'PRI', 'active', 'active')
        RETURNING id INTO default_company_id;
    END IF;

    -- 2. Sync missing users from auth.users (handle ALL nulls)
    INSERT INTO public.profiles (id, email, full_name, created_at, company_id, role)
    SELECT 
        id, 
        COALESCE(email, 'unknown@unknown.com'),
        COALESCE(raw_user_meta_data->>'full_name', email, 'Unknown'),
        COALESCE(created_at, now()),
        default_company_id,
        'Admin'
    FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.profiles);

    -- 3. Fix any existing profiles with null company_id
    UPDATE profiles SET company_id = default_company_id WHERE company_id IS NULL;

    -- 4. Ensure Admin Role for ALL companies
    FOR comp IN SELECT id FROM companies LOOP
        SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin' AND company_id = comp.id LIMIT 1;
        IF admin_role_id IS NULL THEN
            INSERT INTO roles (name, description, permissions, status, company_id)
            VALUES ('Admin', 'System Administrator', all_perms, 'Active', comp.id)
            RETURNING id INTO admin_role_id;
        ELSE
            UPDATE roles SET permissions = all_perms WHERE id = admin_role_id;
        END IF;

        -- 5. Make ALL profiles in this company Admin
        UPDATE profiles SET role = 'Admin', role_id = admin_role_id WHERE company_id = comp.id;
    END LOOP;

    RAISE NOTICE 'Done. All users are now Admin.';
END $$;
