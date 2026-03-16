-- ==============================================================================
-- AUDIT: Verify Row Level Security (RLS) Coverage
-- Run this in Supabase SQL Editor to identify insecure tables
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
    v_missing_rls_count INT := 0;
    v_missing_policy_count INT := 0;
BEGIN
    RAISE NOTICE '--------------------------------------------------------------------------------';
    RAISE NOTICE 'STARTING RLS AUDIT';
    RAISE NOTICE '--------------------------------------------------------------------------------';

    -- 1. Check tables with RLS DISABLED
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND rowsecurity = false
    LOOP
        RAISE NOTICE '⚠️  RLS DISABLED on table: %', r.tablename;
        v_missing_rls_count := v_missing_rls_count + 1;
    END LOOP;

    IF v_missing_rls_count = 0 THEN
        RAISE NOTICE '✅  All public tables have RLS enabled.';
    ELSE
        RAISE NOTICE '❌  Found % tables with RLS DISABLED.', v_missing_rls_count;
    END IF;

    RAISE NOTICE '--------------------------------------------------------------------------------';

    -- 2. Check tables with RLS ENABLED but NO POLICIES
    FOR r IN 
        SELECT t.tablename 
        FROM pg_tables t
        LEFT JOIN pg_policies p ON t.tablename = p.tablename
        WHERE t.schemaname = 'public' 
          AND t.rowsecurity = true
        GROUP BY t.tablename
        HAVING count(p.policyname) = 0
    LOOP
        RAISE NOTICE '⚠️  RLS ENABLED but NO POLICIES on table: %', r.tablename;
        v_missing_policy_count := v_missing_policy_count + 1;
    END LOOP;

    IF v_missing_policy_count = 0 THEN
        RAISE NOTICE '✅  All RLS-enabled tables have at least one policy.';
    ELSE
        RAISE NOTICE '❌  Found % tables with NO POLICIES.', v_missing_policy_count;
    END IF;

    RAISE NOTICE '--------------------------------------------------------------------------------';
    RAISE NOTICE 'AUDIT COMPLETE';
    RAISE NOTICE '--------------------------------------------------------------------------------';
END $$;
