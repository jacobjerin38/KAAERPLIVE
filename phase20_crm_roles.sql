-- ==============================================================================
-- KAA ERP V1.2 - CRM ROLES & RBAC MIGRATION
-- PHASE E: ROLE OPTIMIZATION
-- ==============================================================================

-- 1. Helper Functions for RLS
-- We need these to avoid complex joins in every Policy

CREATE OR REPLACE FUNCTION get_my_employee_id()
RETURNS UUID AS $$
  SELECT id FROM employees WHERE profile_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_my_role_name()
RETURNS TEXT AS $$
DECLARE
    role_name TEXT;
BEGIN
    SELECT r.name INTO role_name
    FROM employees e
    JOIN roles r ON e.role_id = r.id
    WHERE e.profile_id = auth.uid()
    LIMIT 1;
    
    RETURN role_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Seed CRM Roles
-- Insert if they don't exist
DO $$
DECLARE
    company_id_val UUID;
BEGIN
    -- We assume the running user has a company_id, or we pick one active company if this is a global seed (which it shouldn't be for multi-tenant, but for this project structure it seems we mix tenant/user context in seeds).
    -- However, roles has company_id. We'll use get_my_company_id() context if available, or just skip if we want to let the app handle creation.
    -- Better: Insert for the current tenant context.
    
    company_id_val := get_my_company_id();
    
    IF company_id_val IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Sales Manager' AND company_id = company_id_val) THEN
            INSERT INTO roles (company_id, name, description, permissions, status)
            VALUES (company_id_val, 'Sales Manager', 'Head of Sales. Can view all deals.', ARRAY['crm.view_all', 'crm.edit_all'], 'Active');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Sales Representative' AND company_id = company_id_val) THEN
            INSERT INTO roles (company_id, name, description, permissions, status)
            VALUES (company_id_val, 'Sales Representative', 'Sales Rep. Can view own deals.', ARRAY['crm.view_own', 'crm.edit_own'], 'Active');
        END IF;
    END IF;
END $$;


-- 3. Update RLS on crm_deals
-- Drop existing tenant isolation to replace with stricter one
DROP POLICY IF EXISTS "Tenant Isolation" ON crm_deals;

CREATE POLICY "CRM Deal Visibility" ON crm_deals
AS PERMISSIVE
FOR ALL
USING (
    company_id = get_my_company_id()
    AND (
        -- 1. Managers/Admins see all
        get_my_role_name() IN ('Sales Manager', 'Admin', 'Super Admin')
        OR
        -- 2. Owners see their own
        employee_owner_id = get_my_employee_id()
        OR
        -- 3. Unassigned deals (optional: visible to all for claiming? Let's restrict to Managers to assign)
        (employee_owner_id IS NULL AND get_my_role_name() IN ('Sales Manager', 'Admin'))
    )
);
