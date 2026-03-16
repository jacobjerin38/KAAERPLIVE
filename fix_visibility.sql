-- ==============================================================================
-- FIX VISIBILITY & DIAGNOSTICS
-- Priority: Critical
-- Description: Re-defines get_my_company_id to ensure auth.uid() visibility and provides diagnostics.
-- ==============================================================================

-- 1. Fix get_my_company_id
-- We remove 'SET search_path = public' to ensure extensions/auth schemas (where auth.uid() might rely) are accessible.
-- We also ensure it returns NULL if no profile found (safe default).

CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Direct lookup using SECURITY DEFINER (runs as database owner/postgres)
  -- This ignores RLS on the profiles table itself to prevent recursion.
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = auth.uid();
  
  RETURN v_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- NOTE: Removed 'SET search_path' to rely on default path which includes extensions/auth usually.
-- If this still fails, explicit path 'public, extensions, auth' might be needed, but default is safer for now.

-- 2. Diagnostic Query (Run this part separately in SQL Editor to check data)
/*
-- Uncomment lines below to debug:

-- Check your Auth ID
SELECT auth.uid() as my_auth_id;

-- Check your Profile
SELECT * FROM profiles WHERE id = auth.uid();

-- Check what the function returns
SELECT get_my_company_id() as my_company_id;

-- Check visible Employees
SELECT count(*) as visible_employees FROM employees;
*/
