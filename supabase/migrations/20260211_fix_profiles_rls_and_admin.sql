-- Migration: fix_profiles_rls_and_admin
-- 1. Fix Profiles RLS: Ensure users can view their own profile
-- 2. Ensure Admin Role exists for ALL companies to prevent FK issues

-- Part 1: Fix Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Part 2: Ensure Admin Role exists for ALL companies
-- (In case the user is in a company that didn't get an Admin role in the previous 1-limit migration)
DO $$
DECLARE
    comp RECORD;
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
    FOR comp IN SELECT id FROM companies LOOP
        -- Check if Admin role exists
        SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin' AND company_id = comp.id LIMIT 1;
        
        IF admin_role_id IS NOT NULL THEN
            -- Update existing
            UPDATE roles SET permissions = all_perms WHERE id = admin_role_id;
        ELSE
            -- Insert new
            INSERT INTO roles (name, description, permissions, status, company_id)
            VALUES ('Admin', 'System Administrator', all_perms, 'Active', comp.id)
            RETURNING id INTO admin_role_id;
        END IF;
        
        -- Update profiles in this company to be Admin
        -- Note: strict link by company_id if profile has it
        UPDATE profiles 
        SET role = 'Admin', role_id = admin_role_id
        WHERE company_id = comp.id OR (company_id IS NULL); 
    END LOOP;
END $$;
