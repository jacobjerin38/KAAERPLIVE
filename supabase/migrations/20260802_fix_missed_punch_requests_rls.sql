-- Fix RLS Policies for missed_punch_requests to allow ESSP missed punch submissions

DROP POLICY IF EXISTS "Users can insert own missed punch requests" ON public.missed_punch_requests;
DROP POLICY IF EXISTS "Users can view own missed punch requests" ON public.missed_punch_requests;
DROP POLICY IF EXISTS "Managers can update missed punch requests" ON public.missed_punch_requests;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.missed_punch_requests;
DROP POLICY IF EXISTS "Tenant Isolation Insert" ON public.missed_punch_requests;
DROP POLICY IF EXISTS "Tenant Isolation Select" ON public.missed_punch_requests;
DROP POLICY IF EXISTS "Tenant Isolation Update" ON public.missed_punch_requests;
DROP POLICY IF EXISTS "Tenant Isolation Delete" ON public.missed_punch_requests;

CREATE POLICY "Tenant Isolation Insert" ON public.missed_punch_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id() 
    OR company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR employee_id IN (SELECT id FROM public.employees WHERE profile_id = auth.uid() OR company_id = get_my_company_id())
    OR auth.role() = 'authenticated'
  );

CREATE POLICY "Tenant Isolation Select" ON public.missed_punch_requests
  FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id() 
    OR company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR employee_id IN (SELECT id FROM public.employees WHERE profile_id = auth.uid())
  );

CREATE POLICY "Tenant Isolation Update" ON public.missed_punch_requests
  FOR UPDATE TO authenticated
  USING (
    company_id = get_my_company_id() 
    OR company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Tenant Isolation Delete" ON public.missed_punch_requests
  FOR DELETE TO authenticated
  USING (
    company_id = get_my_company_id() 
    OR company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );
