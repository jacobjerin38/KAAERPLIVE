-- Phase 15: Seed Company Profile
-- This script attempts to seed a default company profile for the current user's company.

DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- 1. Attempt to find a company_id from an existing profile.
    -- We assume the first profile found belongs to the main tenant for this seed operation.
    SELECT company_id INTO v_company_id FROM profiles LIMIT 1;

    -- If no profile exists, check employees
    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM employees LIMIT 1;
    END IF;
    
    IF v_company_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding company profile for ID: %', v_company_id;
        
        INSERT INTO companies (
            id, 
            name, -- Legacy field required by existing schema
            code, 
            display_name, 
            legal_name, 
            email, 
            phone, 
            website, 
            address_line_1, 
            city, 
            country, 
            tax_id, 
            currency, 
            logo_url
        )
        VALUES (
            v_company_id,
            'Kaa ERP Demo', -- Populating legacy name field
            'KAA-HQ',
            'Kaa ERP Demo',
            'Kaa Enterprise Solutions Ltd.',
            'admin@kaa-erp.com',
            '+1-555-0123',
            'https://kaa-erp.com',
            '123 Innovation Drive, Tech Park',
            'Nairobi',
            'Kenya',
            'P051234567Z',
            'KES',
            'https://ui-avatars.com/api/?name=Kaa+ERP&background=4F46E5&color=fff&size=256'
        )
        ON CONFLICT (id) DO UPDATE SET
            logo_url = COALESCE(companies.logo_url, EXCLUDED.logo_url); 
            -- Only update logo if it's currently null
            
    ELSE
        RAISE NOTICE 'No existing company_id found in profiles or employees. Skipping seed.';
    END IF;
END $$;
