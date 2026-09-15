-- ==============================================================================
-- Migration: CRM Customer Provision and Visibility
-- Description:
-- 1. Updates can_access_crm_record to allow company members to access unassigned
--    (owner_id IS NULL) records within their active company.
-- 2. Updates RLS policy on crm_customers to permit insert/write by linked employee IDs.
-- 3. Grants crm.contacts.view permission to SALES USER role.
-- ==============================================================================

-- 1. Add crm.contacts.view to SALES USER role if missing
UPDATE public.roles
SET permissions = array_append(permissions, 'crm.contacts.view')
WHERE name = 'SALES USER' AND NOT ('crm.contacts.view' = ANY(permissions));

-- 2. Update can_access_crm_record
CREATE OR REPLACE FUNCTION public.can_access_crm_record(
  p_company_id uuid,
  p_created_by uuid,
  p_owner_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_emp_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Must belong to the user's active company
  IF p_company_id != public.get_my_company_id() THEN
    RETURN FALSE;
  END IF;

  -- Admins and Executive Management have access to all records in the company
  IF public.is_crm_admin(v_uid) THEN
    RETURN TRUE;
  END IF;

  -- If unassigned (owner_id is null), accessible to all authenticated users in this company
  IF p_owner_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Record was created by the logged-in user
  IF p_created_by IS NOT NULL AND p_created_by = v_uid THEN
    RETURN TRUE;
  END IF;

  -- Record is directly owned by the logged-in user (auth UUID)
  IF p_owner_id IS NOT NULL AND p_owner_id = v_uid THEN
    RETURN TRUE;
  END IF;

  -- Record is owned by or created by the user's linked employee profile
  SELECT id INTO v_emp_id FROM public.employees WHERE profile_id = v_uid LIMIT 1;
  IF v_emp_id IS NOT NULL THEN
    IF (p_owner_id IS NOT NULL AND p_owner_id = v_emp_id) OR
       (p_created_by IS NOT NULL AND p_created_by = v_emp_id) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

-- 3. Update RLS policy on crm_customers
DROP POLICY IF EXISTS "CRM Customers Access Policy" ON public.crm_customers;

CREATE POLICY "CRM Customers Access Policy" ON public.crm_customers
FOR ALL
USING (
  public.can_access_crm_record(company_id, created_by, owner_id)
)
WITH CHECK (
  company_id = public.get_my_company_id() AND
  (
    public.is_crm_admin(auth.uid()) OR 
    created_by = auth.uid() OR 
    owner_id = auth.uid() OR
    owner_id IN (SELECT id FROM public.employees WHERE profile_id = auth.uid()) OR
    created_by IN (SELECT id FROM public.employees WHERE profile_id = auth.uid())
  )
);
