-- Migration: 20260927094954_crm_strict_user_data_isolation_and_work_orders_rls.sql
-- Enforce strict data isolation for CRM normal sales users in Supabase RLS
-- Managers and Admins retain corporate visibility across all company records

CREATE OR REPLACE FUNCTION public.is_crm_admin(p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
  v_has_perm BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Check user_permissions table if present
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = p_user_id
        AND permission IN ('*', 'crm.admin', 'crm.view_all', 'crm.manage_all')
    ) INTO v_has_perm;
    IF v_has_perm THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 2. Check profile role
  SELECT LOWER(role) INTO v_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_role IN ('admin', 'super admin', 'managing director', 'general manager', 'ceo', 'coo', 'cto', 'owner', 'director')
     OR v_role LIKE '%admin%'
     OR v_role LIKE '%director%'
     OR v_role LIKE '%manager%'
     OR v_role LIKE '%head%'
     OR v_role LIKE '%lead%';
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_crm_record(p_company_id uuid, p_created_by uuid, p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_my_cid UUID;
  v_emp_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Tenant isolation: Must belong to user's company
  v_my_cid := public.get_my_company_id();
  IF p_company_id IS NOT NULL AND v_my_cid IS NOT NULL AND p_company_id != v_my_cid THEN
    RETURN FALSE;
  END IF;

  -- Admins and Managers have access to all records in their company
  IF public.is_crm_admin(v_uid) THEN
    RETURN TRUE;
  END IF;

  -- Direct ownership or creator by Auth UID
  IF p_created_by IS NOT NULL AND p_created_by = v_uid THEN
    RETURN TRUE;
  END IF;

  IF p_owner_id IS NOT NULL AND p_owner_id = v_uid THEN
    RETURN TRUE;
  END IF;

  -- Ownership or creator by linked Employee ID
  SELECT id INTO v_emp_id FROM public.employees WHERE profile_id = v_uid LIMIT 1;
  IF v_emp_id IS NOT NULL THEN
    IF (p_owner_id IS NOT NULL AND p_owner_id = v_emp_id) OR
       (p_created_by IS NOT NULL AND p_created_by = v_emp_id) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_crm_work_order(
  p_company_id uuid,
  p_created_by uuid,
  p_assigned_to uuid DEFAULT NULL::uuid,
  p_employee_id uuid DEFAULT NULL::uuid,
  p_customer_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_my_cid UUID;
  v_emp_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  v_my_cid := public.get_my_company_id();
  IF p_company_id IS NOT NULL AND v_my_cid IS NOT NULL AND p_company_id != v_my_cid THEN
    RETURN FALSE;
  END IF;

  IF public.is_crm_admin(v_uid) THEN
    RETURN TRUE;
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by = v_uid THEN
    RETURN TRUE;
  END IF;

  IF p_assigned_to IS NOT NULL AND p_assigned_to = v_uid THEN
    RETURN TRUE;
  END IF;

  SELECT id INTO v_emp_id FROM public.employees WHERE profile_id = v_uid LIMIT 1;
  IF v_emp_id IS NOT NULL THEN
    IF (p_employee_id IS NOT NULL AND p_employee_id = v_emp_id) OR
       (p_assigned_to IS NOT NULL AND p_assigned_to = v_emp_id) OR
       (p_created_by IS NOT NULL AND p_created_by = v_emp_id) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Also check if user has access to the customer
  IF p_customer_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.crm_customers c
      WHERE c.id = p_customer_id
        AND public.can_access_crm_record(c.company_id, c.created_by, c.owner_id)
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$function$;

DROP POLICY IF EXISTS "Tenant Isolation crm_customer_work_orders" ON public.crm_customer_work_orders;
DROP POLICY IF EXISTS "CRM Work Orders Access Policy" ON public.crm_customer_work_orders;

CREATE POLICY "CRM Work Orders Access Policy" ON public.crm_customer_work_orders
  FOR ALL
  TO public
  USING (can_access_crm_work_order(company_id, created_by, assigned_to, employee_id, customer_id))
  WITH CHECK (
    (company_id = get_my_company_id() OR get_my_company_id() IS NULL)
    AND (
      is_crm_admin(auth.uid())
      OR created_by = auth.uid()
      OR assigned_to = auth.uid()
      OR employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    )
  );
