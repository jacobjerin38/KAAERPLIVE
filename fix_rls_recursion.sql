-- ==============================================================================
-- FIX RLS INFINITE RECURSION
-- Priority: Critical
-- Description: Breaks the circular dependency between profiles table RLS and get_my_company_id()
-- ==============================================================================

-- 1. Redefine get_my_company_id to be robust and set search_path
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Direct lookup with security definer to bypass RLS for this specific query
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = auth.uid();
  
  RETURN v_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop existing problematic policy
DROP POLICY IF EXISTS "Users can only see profiles in their company" ON profiles;

-- 3. Create optimized policies
-- A. Users can ALWAYS see their own profile (Base case for recursion breaking)
CREATE POLICY "Users can see own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

-- B. Users can see other profiles in the same company
-- The function get_my_company_id() is SECURITY DEFINER, so it runs without hitting RLS constraints recursively
CREATE POLICY "Users can see colleagues" ON profiles
    FOR SELECT USING (company_id = get_my_company_id());

-- 4. Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
