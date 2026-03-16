-- FIX RLS INFINITE RECURSION
-- 1. Allow users to see their own profile without checking company_id (breaks the loop)
DROP POLICY IF EXISTS "Users can see own profile" ON profiles;
CREATE POLICY "Users can see own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

-- 2. Ensure Buzz Tables have correct policies
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation" ON announcements;
CREATE POLICY "Tenant Isolation" ON announcements
    FOR ALL USING (company_id = get_my_company_id());

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation Polls" ON polls;
CREATE POLICY "Tenant Isolation Polls" ON polls
    FOR ALL USING (company_id = get_my_company_id());

-- 3. Poll Options/Votes
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation Poll Options" ON poll_options;
CREATE POLICY "Tenant Isolation Poll Options" ON poll_options
    FOR ALL USING (poll_id IN (SELECT id FROM polls));

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation Poll Votes" ON poll_votes;
CREATE POLICY "Tenant Isolation Poll Votes" ON poll_votes
    FOR ALL USING (poll_id IN (SELECT id FROM polls));
