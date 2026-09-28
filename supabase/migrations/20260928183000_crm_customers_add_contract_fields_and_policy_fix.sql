-- Migration: 20260928183000_crm_customers_add_contract_fields_and_policy_fix.sql
-- Description:
-- 1. Ensures contract, start_date, remarks, and created_by columns exist on crm_customers.
-- 2. Updates RLS policy to allow unassigned or newly provisioned customer accounts to be saved and assigned smoothly.

ALTER TABLE public.crm_customers
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_number TEXT,
  ADD COLUMN IF NOT EXISTS contract_title TEXT,
  ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'Call-Off / Work Order Basis',
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Update RLS policy on crm_customers to permit insert/write by linked employee IDs and unassigned accounts
DROP POLICY IF EXISTS "CRM Customers Access Policy" ON public.crm_customers;

CREATE POLICY "CRM Customers Access Policy" ON public.crm_customers
FOR ALL
TO public
USING (
  public.can_access_crm_record(company_id, created_by, owner_id)
)
WITH CHECK (
  company_id = public.get_my_company_id() AND
  (
    public.is_crm_admin(auth.uid()) OR 
    created_by IS NULL OR
    created_by = auth.uid() OR 
    owner_id IS NULL OR
    owner_id = auth.uid() OR 
    owner_id IN (SELECT id FROM public.employees WHERE profile_id = auth.uid()) OR 
    created_by IN (SELECT id FROM public.employees WHERE profile_id = auth.uid())
  )
);
