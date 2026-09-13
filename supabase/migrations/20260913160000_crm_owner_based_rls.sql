-- ====================================================================
-- Migration: CRM Owner-Based Row Level Security (RLS)
-- Description: Enforce private pipeline visibility for CRM Leads, Opportunities,
--              Customers, Deals, and Contacts. Non-admin users only see records
--              they created or own; Admins/Management retain full company visibility.
-- ====================================================================

-- 1. Helper Function to check if user is a CRM Admin / Executive Management
CREATE OR REPLACE FUNCTION public.is_crm_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT LOWER(role) INTO v_role
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN v_role IN ('admin', 'super admin', 'managing director', 'manager', 'general manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Helper Function to check if the current user has access to a CRM record
CREATE OR REPLACE FUNCTION public.can_access_crm_record(
  p_company_id UUID,
  p_created_by UUID,
  p_owner_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Apply Owner-Based RLS on crm_leads
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.crm_leads;
DROP POLICY IF EXISTS "CRM Leads Access Policy" ON public.crm_leads;

CREATE POLICY "CRM Leads Access Policy" ON public.crm_leads
FOR ALL
USING (
  public.can_access_crm_record(company_id, created_by, lead_owner_id)
)
WITH CHECK (
  company_id = public.get_my_company_id() AND
  (public.is_crm_admin(auth.uid()) OR created_by = auth.uid() OR lead_owner_id = auth.uid())
);

-- 4. Apply Owner-Based RLS on crm_opportunities
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.crm_opportunities;
DROP POLICY IF EXISTS "CRM Opportunities Access Policy" ON public.crm_opportunities;

CREATE POLICY "CRM Opportunities Access Policy" ON public.crm_opportunities
FOR ALL
USING (
  public.can_access_crm_record(company_id, created_by, owner_id)
)
WITH CHECK (
  company_id = public.get_my_company_id() AND
  (public.is_crm_admin(auth.uid()) OR created_by = auth.uid() OR owner_id = auth.uid())
);

-- 5. Apply Owner-Based RLS on crm_customers
ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.crm_customers;
DROP POLICY IF EXISTS "CRM Customers Access Policy" ON public.crm_customers;

CREATE POLICY "CRM Customers Access Policy" ON public.crm_customers
FOR ALL
USING (
  public.can_access_crm_record(company_id, created_by, owner_id)
)
WITH CHECK (
  company_id = public.get_my_company_id() AND
  (public.is_crm_admin(auth.uid()) OR created_by = auth.uid() OR owner_id = auth.uid())
);

-- 6. Apply Owner-Based RLS on crm_deals
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.crm_deals;
DROP POLICY IF EXISTS "CRM Deals Access Policy" ON public.crm_deals;

CREATE POLICY "CRM Deals Access Policy" ON public.crm_deals
FOR ALL
USING (
  public.can_access_crm_record(company_id, created_by, owner_id) OR
  (employee_owner_id IS NOT NULL AND employee_owner_id IN (SELECT id FROM public.employees WHERE profile_id = auth.uid()))
)
WITH CHECK (
  company_id = public.get_my_company_id() AND
  (public.is_crm_admin(auth.uid()) OR created_by = auth.uid() OR owner_id = auth.uid())
);

-- 7. Apply Owner-Based RLS on crm_contacts
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.crm_contacts;
DROP POLICY IF EXISTS "CRM Contacts Access Policy" ON public.crm_contacts;

CREATE POLICY "CRM Contacts Access Policy" ON public.crm_contacts
FOR ALL
USING (
  public.can_access_crm_record(company_id, created_by, owner_id)
)
WITH CHECK (
  company_id = public.get_my_company_id() AND
  (public.is_crm_admin(auth.uid()) OR created_by = auth.uid() OR owner_id = auth.uid())
);
