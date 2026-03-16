-- Migration: fix_roles_rls
-- Ensure users can read roles to load permissions

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it conflicts or is too restrictive
DROP POLICY IF EXISTS "Users can view roles" ON roles;

-- Allow all authenticated users to read roles (simplest fix for visibility)
-- Alternatively, we could restrict to company, but if the Admin role is seeded in a different company this blocks access.
-- For this "fix everything" migration, we'll allow broad read access to roles.
CREATE POLICY "Users can view roles" ON roles FOR SELECT TO authenticated USING (true);
