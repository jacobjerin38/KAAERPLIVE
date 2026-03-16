-- Migration: grant_admin_access_to_all
-- 1. Ensure Admin Role exists with ALL permissions
-- 2. Update all profiles to be Admin

DO $$
DECLARE
    admin_role_id UUID;
    all_perms text[] := ARRAY[
        -- HRMS
        'hrms.employees.view', 'hrms.employees.manage', 
        'hrms.attendance.view', 'hrms.attendance.manage', 
        'hrms.leave.view', 'hrms.leave.manage', 
        'hrms.payroll.manage', 
        'hrms.assets.view', 'hrms.assets.manage', 
        'hrms.helpdesk.view', 'hrms.helpdesk.manage', 
        'hrms.reports.view',
        -- CRM
        'crm.dashboard.view', 
        'crm.leads.view', 'crm.leads.manage', 
        'crm.deals.view', 'crm.deals.manage', 
        'crm.tasks.manage', 'crm.contacts.manage', 
        'crm.pipeline.manage', 'crm.settings.manage',
        -- ORGANISATION
        'org.structure.view', 'org.company.manage', 
        'org.masters.manage', 'org.roles.manage', 
        'org.users.manage', 'org.workflows.manage', 
        'org.settings.manage',
        -- FINANCE
        'finance.dashboard.view', 'finance.setup.manage', 
        'finance.payroll.manage', 'finance.invoices.manage', 
        'finance.expenses.manage',
        -- INVENTORY
        'inventory.view', 'inventory.manage',
        -- MANUFACTURING
        'manufacturing.view', 'manufacturing.manage',
        -- PROCUREMENT
        'procurement.view', 'procurement.manage',
        -- ESSP
        'essp.view', 'essp.profile.manage'
    ];
BEGIN
    -- 1. Upsert Admin Role
    -- Check if exists by name
    SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin' LIMIT 1;

    IF admin_role_id IS NOT NULL THEN
        -- Update permissions
        UPDATE roles SET permissions = all_perms WHERE id = admin_role_id;
    ELSE
        -- Insert new
        INSERT INTO roles (name, description, permissions, status, company_id)
        SELECT 'Admin', 'Full System Access', all_perms, 'Active', id FROM companies LIMIT 1
        RETURNING id INTO admin_role_id;
    END IF;

    -- 2. Update All Profiles
    -- We'll just take the first company ID if multiple exist, or current user's company
    -- Ideally this runs per-tenant, but for this request "all existing users" implies a system-wide reset or single-tenant context.
    
    UPDATE profiles 
    SET 
        role = 'Admin',
        role_id = admin_role_id;

END $$;
