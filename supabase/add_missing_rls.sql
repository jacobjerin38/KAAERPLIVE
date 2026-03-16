-- ==============================================================================
-- SECURITY PATCH: Add Missing RLS Policies
-- Run this in Supabase SQL Editor
-- ==============================================================================

DO $$
DECLARE
    t text;
    -- List of tables identified as missing RLS in the review
    tables text[] := ARRAY[
        'org_ai_settings',
        'employee_salary_components',
        'employee_career_timeline',
        'employee_docs', -- Legacy name check
        'employee_documents', -- Just to be sure (though fixed separately)
        'job_openings', -- Recruitment module?
        'candidates'   -- Recruitment module?
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
            
            RAISE NOTICE 'Securing table: %', t;

            -- 1. Enable RLS
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
            
            -- 2. Drop existing policies to avoid conflicts
            BEGIN
                EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON %I', t);
                EXECUTE format('DROP POLICY IF EXISTS "Enable all access" ON %I', t);
                EXECUTE format('DROP POLICY IF EXISTS "Public Access" ON %I', t);
            EXCEPTION WHEN OTHERS THEN NULL; END;

            -- 3. Create Policy based on column structure
             IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'company_id') THEN
                -- Type A: Direct Company Link
                EXECUTE format('CREATE POLICY "Tenant Isolation" ON %I USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id())', t);
                RAISE NOTICE ' -> Applied company_id policy';
            
            ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'employee_id') THEN
                -- Type B: Indirect via Employee
                EXECUTE format('CREATE POLICY "Tenant Isolation" ON %I USING (employee_id IN (SELECT id FROM employees WHERE company_id = get_current_company_id()))', t);
                RAISE NOTICE ' -> Applied employee_id policy';
            
            ELSE
                RAISE NOTICE ' -> ⚠️ SKIPPED: Could not find company_id or employee_id column';
            END IF;

        ELSE
            RAISE NOTICE 'Table not found (skipping): %', t;
        END IF;
    END LOOP;
END $$;
