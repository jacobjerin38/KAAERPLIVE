-- ==============================================================================
-- KAA ERP REMEDIATION - PRIORITY 0: TENANT ISOLATION, AUTHORIZATION & SECURITY
-- Migration: 20260923180000_remediation_p0_tenant_isolation_and_security.sql
-- Description: 
--   1. Protects profiles.company_id, role, and employee_id from unauthorized user edits.
--   2. Provides secure rpc_switch_active_company validating user_company_access.
--   3. Revokes broad anon privileges from ERP modules (projects, MRP, workflows, CRM).
--   4. Replaces open USING (true) policies on project management tables with company-scoped policies.
--   5. Enables RLS and tenant isolation on workflow_* tables.
--   6. Locks down user_company_access mutations to company administrators only.
--   7. Hardens SECURITY DEFINER RPCs (admin_update_user, admin_delete_user, approve_job_transition)
--      with fixed search_path and server-side role verification.
--   8. Converts CRM views to security_invoker = true and revokes anon access.
-- Rollback: Revert policies, drop trigger, restore security_invoker to false.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Profiles Protection & Company Switch RPC (0.1)
-- ------------------------------------------------------------------------------

-- Trigger function to prevent non-admins from mutating privileged profile columns
CREATE OR REPLACE FUNCTION public.fn_protect_profile_privileged_fields()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_is_admin BOOLEAN := false;
BEGIN
    -- Allow service role or database background triggers
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check caller role
    SELECT lower(role) INTO v_caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_role IN ('admin', 'super admin', 'superadmin', 'managing director') THEN
        v_is_admin := true;
    END IF;

    -- Prevent non-admins from changing role
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only system administrators can change user roles.';
    END IF;

    -- Prevent non-admins from changing employee linkage
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can modify employee profile linkage.';
    END IF;

    -- If company_id is being changed by an authenticated user who is not admin, verify membership
    IF NEW.company_id IS DISTINCT FROM OLD.company_id AND NOT v_is_admin THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_company_access
            WHERE user_id = auth.uid() 
              AND company_id = NEW.company_id 
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Cannot switch to a company without an active membership assignment.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_protect_profile_privileged_fields();

-- Drop insecure anon policies on profiles
DROP POLICY IF EXISTS "Anon can insert unlinked profile" ON public.profiles;
DROP POLICY IF EXISTS "Anon can update unlinked profile" ON public.profiles;

-- Restrict user update policy with explicit WITH CHECK
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Controlled RPC for switching active tenant context
CREATE OR REPLACE FUNCTION public.rpc_switch_active_company(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify active company membership or superadmin role
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_user_id AND lower(role) IN ('super admin', 'superadmin', 'admin')
    ) OR EXISTS (
        SELECT 1 FROM public.user_company_access
        WHERE user_id = v_user_id AND company_id = p_company_id AND status = 'active'
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: You do not have active access to the specified company.';
    END IF;

    UPDATE public.profiles
    SET company_id = p_company_id,
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'company_id', p_company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_switch_active_company(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_switch_active_company(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. Revoke Broad Anon Grants on ERP Tables (0.2)
-- ------------------------------------------------------------------------------

-- Revoke anon privileges from project management tables
REVOKE ALL ON 
    public.pm_projects,
    public.org_project_categories,
    public.org_project_types,
    public.org_issue_categories,
    public.org_risk_categories,
    public.project_proposals,
    public.project_proposal_revisions,
    public.project_proposal_audit,
    public.project_required_documents,
    public.project_supervisors,
    public.project_daily_activities,
    public.project_daily_activity_documents,
    public.project_issues,
    public.project_risks,
    public.project_safety_observations,
    public.project_completion_requests,
    public.project_audit_log
FROM anon;

-- Revoke anon privileges from MRP / Manufacturing tables
REVOKE ALL ON 
    public.mrp_bom,
    public.mrp_bom_lines,
    public.mrp_work_centers,
    public.mrp_routing,
    public.mrp_routing_lines,
    public.mrp_production_orders,
    public.mrp_production_moves
FROM anon;

-- Revoke anon privileges from CRM operational tables
REVOKE ALL ON 
    public.crm_documents,
    public.crm_deals,
    public.crm_quotations,
    public.crm_quotation_lines,
    public.crm_sales_invoices,
    public.crm_sales_invoice_lines,
    public.crm_delivery_notes,
    public.crm_delivery_note_lines,
    public.crm_attachments
FROM anon;

-- Tighten CRM documents RLS policy
DROP POLICY IF EXISTS "crm_documents_access" ON public.crm_documents;
CREATE POLICY "crm_documents_company_isolation" ON public.crm_documents
    FOR ALL TO authenticated
    USING (company_id = get_my_company_id())
    WITH CHECK (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- 3. Replace Permissive Project Management RLS Policies (0.2 & 6.1)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'org_project_categories', 'org_project_types', 'org_issue_categories', 'org_risk_categories',
        'project_proposals', 'project_proposal_revisions', 'project_proposal_audit',
        'project_required_documents', 'project_supervisors', 'project_daily_activities',
        'project_daily_activity_documents', 'project_issues', 'project_risks',
        'project_safety_observations', 'project_completion_requests', 'project_audit_log'
    ];
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS p_%I_all ON public.%I;', t, t);
        EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I;', t, t);
        EXECUTE format('
            CREATE POLICY %I_tenant_isolation ON public.%I
            FOR ALL TO authenticated
            USING (company_id = get_my_company_id())
            WITH CHECK (company_id = get_my_company_id());
        ', t, t);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Enable RLS and Tenant Isolation on Workflow Tables (0.2)
-- ------------------------------------------------------------------------------

ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_levels ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON 
    public.workflow_instances,
    public.workflow_requests,
    public.workflow_action_logs,
    public.workflows,
    public.workflow_steps,
    public.workflow_levels
FROM anon;

DROP POLICY IF EXISTS "workflow_instances_isolation" ON public.workflow_instances;
CREATE POLICY "workflow_instances_isolation" ON public.workflow_instances
    FOR ALL TO authenticated
    USING (company_id = get_my_company_id())
    WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "workflow_requests_isolation" ON public.workflow_requests;
CREATE POLICY "workflow_requests_isolation" ON public.workflow_requests
    FOR ALL TO authenticated
    USING (company_id = get_my_company_id())
    WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "workflows_isolation" ON public.workflows;
CREATE POLICY "workflows_isolation" ON public.workflows
    FOR ALL TO authenticated
    USING (company_id = get_my_company_id())
    WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "workflow_steps_isolation" ON public.workflow_steps;
CREATE POLICY "workflow_steps_isolation" ON public.workflow_steps
    FOR ALL TO authenticated
    USING (workflow_id IN (SELECT id FROM public.workflows WHERE company_id = get_my_company_id()))
    WITH CHECK (workflow_id IN (SELECT id FROM public.workflows WHERE company_id = get_my_company_id()));

DROP POLICY IF EXISTS "workflow_levels_isolation" ON public.workflow_levels;
CREATE POLICY "workflow_levels_isolation" ON public.workflow_levels
    FOR ALL TO authenticated
    USING (workflow_id IN (SELECT id FROM public.workflows WHERE company_id = get_my_company_id()))
    WITH CHECK (workflow_id IN (SELECT id FROM public.workflows WHERE company_id = get_my_company_id()));

DROP POLICY IF EXISTS "workflow_action_logs_isolation" ON public.workflow_action_logs;
CREATE POLICY "workflow_action_logs_isolation" ON public.workflow_action_logs
    FOR ALL TO authenticated
    USING (instance_id IN (SELECT id FROM public.workflow_instances WHERE company_id = get_my_company_id()))
    WITH CHECK (instance_id IN (SELECT id FROM public.workflow_instances WHERE company_id = get_my_company_id()));

-- ------------------------------------------------------------------------------
-- 5. Lock Down user_company_access Policies (0.2)
-- ------------------------------------------------------------------------------

REVOKE ALL ON public.user_company_access FROM anon;

DROP POLICY IF EXISTS "Users can insert own access" ON public.user_company_access;
DROP POLICY IF EXISTS "Users can update own access" ON public.user_company_access;
DROP POLICY IF EXISTS "Users can delete own access" ON public.user_company_access;
DROP POLICY IF EXISTS "Users can see own access" ON public.user_company_access;

-- Users can only read their own access memberships
CREATE POLICY "Users can see own access" ON public.user_company_access
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Administrators can view and manage company access
CREATE POLICY "Admins can manage company access" ON public.user_company_access
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
              AND (
                  lower(role) IN ('super admin', 'superadmin')
                  OR (lower(role) IN ('admin', 'managing director') AND company_id = user_company_access.company_id)
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
              AND (
                  lower(role) IN ('super admin', 'superadmin')
                  OR (lower(role) IN ('admin', 'managing director') AND company_id = user_company_access.company_id)
              )
        )
    );

-- ------------------------------------------------------------------------------
-- 6. Harden SECURITY DEFINER RPCs (0.3)
-- ------------------------------------------------------------------------------

-- Harden admin_update_user
CREATE OR REPLACE FUNCTION public.admin_update_user(
    p_user_id UUID, 
    p_full_name TEXT, 
    p_role TEXT, 
    p_employee_id UUID DEFAULT NULL::UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_company UUID;
    v_target_company UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT lower(role), company_id INTO v_caller_role, v_caller_company
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_role NOT IN ('admin', 'super admin', 'superadmin', 'managing director') THEN
        RAISE EXCEPTION 'Unauthorized: Only system administrators can update user accounts.';
    END IF;

    SELECT company_id INTO v_target_company
    FROM public.profiles
    WHERE id = p_user_id;

    -- Non-superadmins can only update users in their own company
    IF v_caller_role NOT IN ('super admin', 'superadmin') THEN
        IF v_target_company IS NULL OR v_caller_company IS NULL OR v_target_company != v_caller_company THEN
            RAISE EXCEPTION 'Unauthorized: Cannot update a user belonging to another company.';
        END IF;
    END IF;

    UPDATE public.profiles
    SET full_name = COALESCE(p_full_name, full_name),
        role = COALESCE(p_role, role),
        employee_id = COALESCE(p_employee_id, employee_id),
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user(UUID, TEXT, TEXT, UUID) TO authenticated;

-- Harden admin_delete_user
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_company_id UUID;
    v_target_company_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF auth.uid() = p_user_id THEN
        RAISE EXCEPTION 'You cannot delete your own account';
    END IF;

    SELECT lower(role), company_id INTO v_caller_role, v_caller_company_id
    FROM public.profiles 
    WHERE id = auth.uid();

    IF v_caller_role NOT IN ('admin', 'super admin', 'superadmin', 'managing director') THEN
        RAISE EXCEPTION 'Unauthorized: Only system administrators can delete user accounts.';
    END IF;

    SELECT company_id INTO v_target_company_id 
    FROM public.profiles 
    WHERE id = p_user_id;

    IF v_caller_role NOT IN ('super admin', 'superadmin') THEN
        IF v_target_company_id IS NULL OR v_caller_company_id IS NULL OR v_target_company_id != v_caller_company_id THEN
            RAISE EXCEPTION 'Unauthorized: Cannot delete a user belonging to another company.';
        END IF;
    END IF;

    DELETE FROM public.user_permissions WHERE user_id = p_user_id;
    DELETE FROM public.user_company_access WHERE user_id = p_user_id;
    UPDATE public.employees SET profile_id = NULL WHERE profile_id = p_user_id;
    DELETE FROM public.profiles WHERE id = p_user_id;
    DELETE FROM auth.identities WHERE user_id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'deleted_user_id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- Harden approve_job_transition
CREATE OR REPLACE FUNCTION public.approve_job_transition(p_transition_id UUID, p_approver_notes TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_emp_id UUID;
    v_caller_role TEXT;
    v_caller_company UUID;
    v_trans_company UUID;
    v_updated BOOLEAN := false;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id, company_id INTO v_caller_emp_id, v_caller_company
    FROM public.employees
    WHERE profile_id = auth.uid()
    LIMIT 1;

    SELECT lower(role) INTO v_caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    SELECT company_id INTO v_trans_company
    FROM public.employee_job_transitions
    WHERE id = p_transition_id;

    IF v_trans_company IS NULL THEN
        RAISE EXCEPTION 'Job transition record not found.';
    END IF;

    IF v_caller_role NOT IN ('admin', 'super admin', 'superadmin', 'hr manager') AND v_caller_company != v_trans_company THEN
        RAISE EXCEPTION 'Unauthorized to approve this transition.';
    END IF;

    UPDATE public.employee_job_transitions
    SET status = 'APPROVED',
        approver_id = v_caller_emp_id,
        approval_date = NOW(),
        remarks = COALESCE(remarks, '') || E'\nApprover Note: ' || COALESCE(p_approver_notes, '')
    WHERE id = p_transition_id AND status = 'PENDING';

    v_updated := FOUND;
    RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_job_transition(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_job_transition(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. Convert CRM Views to security_invoker = true and Revoke Anon (0.4)
-- ------------------------------------------------------------------------------

ALTER VIEW public.vw_crm_opportunities SET (security_invoker = true);
ALTER VIEW public.vw_crm_leads SET (security_invoker = true);
ALTER VIEW public.vw_crm_customers SET (security_invoker = true);
ALTER VIEW public.customers SET (security_invoker = true);

REVOKE SELECT ON public.vw_crm_opportunities, public.vw_crm_leads, public.vw_crm_customers, public.customers FROM anon, PUBLIC;
GRANT SELECT ON public.vw_crm_opportunities, public.vw_crm_leads, public.vw_crm_customers, public.customers TO authenticated;
