-- ==============================================================================
-- CRM RESTRUCTURE: LEADS -> OPPORTUNITIES -> CUSTOMERS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. LEADS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    -- Identification
    series TEXT, -- e.g. CRM-LEAD-2024-001
    status TEXT DEFAULT 'New', -- New, Contacted, Qualified, Converted, Disqualified
    
    -- Personal Info
    salutation TEXT,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT,
    gender TEXT,
    job_title TEXT,
    
    -- Contact Info
    email TEXT,
    mobile TEXT,
    phone TEXT,
    phone_ext TEXT,
    whatsapp TEXT,
    website TEXT,
    
    -- Classification
    lead_type TEXT, -- Hot, Cold, Warm
    request_type TEXT, -- Product Info, Demo, Quote
    lead_source_id BIGINT REFERENCES org_lead_sources(id),
    lead_owner_id UUID REFERENCES auth.users(id), -- The auth user
    
    -- Organization Info (For B2B leads)
    organization_name TEXT,
    no_of_employees TEXT, -- 1-10, 11-50 etc
    annual_revenue NUMERIC,
    industry TEXT,
    market_segment TEXT,
    territory TEXT,
    fax TEXT,
    
    -- Address
    address_line_1 TEXT,
    address_line_2 TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    zip_code TEXT,
    
    -- Qualification / Notes
    qualification_notes TEXT,
    is_converted BOOLEAN DEFAULT false,
    converted_customer_id UUID, -- If converted
    converted_opportunity_id UUID -- If converted
);

ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation" ON crm_leads USING (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- 2. CUSTOMERS (Organizations or Individuals)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    -- Basic Info
    name TEXT NOT NULL, -- Company name or full name
    customer_type TEXT DEFAULT 'Company', -- Company, Individual
    lifecycle_stage TEXT DEFAULT 'Customer', -- Lead, Opportunity, Customer, Churned
    
    -- Primary Contact
    primary_email TEXT,
    primary_phone TEXT,
    
    -- Primary Address
    billing_address_line_1 TEXT,
    billing_address_line_2 TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_country TEXT,
    billing_zip_code TEXT,
    
    -- Additional
    website TEXT,
    industry TEXT,
    tax_id TEXT,
    owner_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'Active'
);

ALTER TABLE crm_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation" ON crm_customers USING (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- 3. OPPORTUNITIES (Potential Deals)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    -- Basics
    title TEXT NOT NULL, -- Opportunity Name
    series TEXT, -- CRM-OPP-2024-001
    
    -- Relations
    customer_id UUID REFERENCES crm_customers(id),
    lead_id UUID REFERENCES crm_leads(id), -- Optional link to origin
    
    -- Status & Stage
    stage_id BIGINT REFERENCES org_crm_stages(id),
    status TEXT DEFAULT 'Open', -- Open, Won, Lost
    probability NUMERIC DEFAULT 0, -- %
    
    -- Details
    type TEXT DEFAULT 'Sales', -- Sales, Maintenance, etc.
    source_id BIGINT REFERENCES org_lead_sources(id),
    expected_closing_date DATE,
    
    -- Value
    currency TEXT DEFAULT 'USD',
    amount NUMERIC DEFAULT 0,
    
    -- Ownership
    owner_id UUID REFERENCES auth.users(id),
    
    -- Win/Loss
    loss_reason TEXT,
    campaign_id TEXT -- Placeholder for future
);

ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation" ON crm_opportunities USING (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- 4. ASSOCIATIONS (Optional Contacts/Items per Opp)
-- ------------------------------------------------------------------------------
-- Could use existing crm_contacts, but adding a specific link table if M:N needed. 
-- For now, relying on crm_contacts generic link or customer_id.

-- Add triggers for updated_at if needed, but skipping for brevity.
