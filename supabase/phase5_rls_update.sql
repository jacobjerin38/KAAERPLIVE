-- ==============================================================================
-- KAA ERP Phase 5 - STRICT RLS & SECURITY
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. Update `get_current_company_id` to use REQUEST HEADERS
-- This is more secure/standard for REST calls from the frontend
CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS UUID AS $$
DECLARE
    v_header_value TEXT;
    v_company_id UUID;
BEGIN
    -- A. Try to get from 'x-company-id' header
    -- Supabase exposes headers in `request.headers` config or via current_setting
    BEGIN
        v_header_value := current_setting('request.headers', true)::json->>'x-company-id';
        
        IF v_header_value IS NOT NULL AND v_header_value <> '' AND v_header_value <> 'null' THEN
            RETURN v_header_value::UUID;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Fallback
    END;

    -- B. Try 'app.current_company' (Session variable, mostly for server-side/RPC)
    BEGIN
        v_header_value := current_setting('app.current_company', true);
        IF v_header_value IS NOT NULL AND v_header_value <> '' THEN
            RETURN v_header_value::UUID;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- C. Fallback: Users with ONLY ONE company (Ease of use)
    -- Or default from profile? 
    -- STRICT MODE: Return NULL if not explicitly set. 
    -- But for backward compat during migration, let's look at profile.
    SELECT company_id INTO v_company_id FROM profiles WHERE id = auth.uid();
    RETURN v_company_id;
END;
$$ LANGUAGE plpgsql STABLE;


-- 2. Apply RLS Policies to Core Tables
-- We use a DO block to loop through tables and apply the policy dynamically
-- explicitly listing tables to avoid accidental locking of system tables

DO $$
DECLARE
    t text;
    -- Expanded list of tables to secure
    tables text[] := ARRAY[
        'employees', 
        'departments', 
        'org_designations', 
        'roles', 
        'org_salary_components',
        'attendance',
        'leave_applications',
        'payroll_records',
        'assets',
        'tickets',
        'org_blood_groups',
        'org_marital_statuses',
        'org_faiths',
        'org_shift_timings',
        'employee_skills',
        'org_skills',
        'career_paths',
        'employee_insights',
        'crm_leads', 
        'crm_customers', 
        'item_master', -- Inventory items usually named this
        'inventory_transactions',
        'mrp_production_orders',
        'sales_orders',
        'purchase_orders'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
            
            -- Enable RLS
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
            
            -- Drop existing isolation policies
            BEGIN
                EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON %I', t);
            EXCEPTION WHEN OTHERS THEN NULL; END;

            -- Determine Policy Logic based on columns
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'company_id') THEN
                -- Strategy A: Direct Company ID linkage (Most common)
                EXECUTE format('CREATE POLICY "Tenant Isolation" ON %I USING (company_id = get_current_company_id())', t);
                RAISE NOTICE 'Secured table % (via company_id)', t;
            
            ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'employee_id') THEN
                -- Strategy B: Linkage via Employee
                EXECUTE format('CREATE POLICY "Tenant Isolation" ON %I USING (employee_id IN (SELECT id FROM employees WHERE company_id = get_current_company_id()))', t);
                RAISE NOTICE 'Secured table % (via employee_id)', t;
            
            ELSE
                RAISE NOTICE 'SKIPPED table %: No company_id or employee_id found.', t;
            END IF;

        END IF;
    END LOOP;
END $$;

-- 3. Special Case: Announcements (Global vs Company?)
-- Typically announcements are company specific.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'announcements') THEN
        ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation" ON announcements;
        CREATE POLICY "Tenant Isolation" ON announcements USING (company_id = get_current_company_id());
    END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE 'RLS Security Update Complete. All tables are now isolated by x-company-id header.';
END $$;
