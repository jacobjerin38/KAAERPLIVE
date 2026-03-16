-- Phase 15: Configuration & Company Profile

-- 1. Companies Table (The Entity/Tenant Definition)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY, -- Matches the company_id used everywhere
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Identity
    code TEXT,
    display_name TEXT,
    legal_name TEXT,
    
    -- Contact
    email TEXT,
    phone TEXT,
    website TEXT,
    
    -- Address
    address_line_1 TEXT,
    address_line_2 TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    zip_code TEXT,
    
    -- Financial / Legal
    tax_id TEXT, -- PAN/GST/Tax ID
    currency TEXT DEFAULT 'USD',
    timezone TEXT,
    
    -- Branding
    logo_url TEXT,
    theme_color TEXT
);

-- 2. RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Note: company_id is the PK itself here.
DROP POLICY IF EXISTS "Tenant Isolation" ON companies;
CREATE POLICY "Tenant Isolation" ON companies
    USING (id = get_my_company_id())
    WITH CHECK (id = get_my_company_id());

-- 3. Trigger to Update Timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_companies_timestamp ON companies;
CREATE TRIGGER update_companies_timestamp BEFORE UPDATE ON companies FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
