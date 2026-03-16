-- ==============================================================================
-- KAA ERP V1.1 - REPAIR ORPHAN USERS & SEED DATA
-- Loops through users without profiles, creates them, and seeds data.
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
    v_company_id UUID;
    v_company_name TEXT;
    v_company_code TEXT;
BEGIN
    FOR r IN (
        SELECT id, email 
        FROM auth.users 
        WHERE id NOT IN (SELECT id FROM profiles)
    )
    LOOP
        v_company_id := gen_random_uuid();
        v_company_name := 'Company of ' || split_part(r.email, '@', 1);
        v_company_code := upper(substring(split_part(r.email, '@', 1) from 1 for 4));
        
        RAISE NOTICE 'Fixing orphan user: % (Company: %, Code: %)', r.email, v_company_name, v_company_code;

        -- 1. Create Company
        INSERT INTO companies (id, name, code, status)
        VALUES (v_company_id, v_company_name, v_company_code, 'Active');

        -- 2. Create Profile
        INSERT INTO profiles (id, full_name, role, company_id, email)
        VALUES (r.id, split_part(r.email, '@', 1), 'admin', v_company_id, r.email);

        -- 3. Seed Master Data (Call the function provided the company_id)
        PERFORM rpc_seed_company_data(v_company_id);

    END LOOP;
END $$;
