-- ==============================================================================
-- KAA ERP - CRM REPORT BUILDER VIEWS & SCHEMA REGISTRY FIX
-- Fixes CRM Deals & Opportunities, Leads, and Customers report datasets
-- ==============================================================================

-- 1. Create robust reporting views with rich joined labels and compatibility aliases
CREATE OR REPLACE VIEW vw_crm_opportunities AS
SELECT 
    o.id,
    o.company_id,
    o.owner_id,
    o.created_by,
    o.title,
    o.title AS name,
    o.amount,
    o.amount AS value,
    o.currency,
    o.status,
    o.type,
    o.probability,
    o.expected_closing_date,
    o.expected_closing_date AS expected_close_date,
    COALESCE(s.name, 'Unassigned') AS stage,
    COALESCE(s.name, 'Unassigned') AS stage_name,
    c.name AS customer_name,
    l.organization_name AS lead_company,
    COALESCE(e.name, p.full_name, 'Unassigned') AS owner_name,
    o.created_at
FROM crm_opportunities o
LEFT JOIN org_crm_stages s ON o.stage_id = s.id
LEFT JOIN crm_customers c ON o.customer_id = c.id
LEFT JOIN crm_leads l ON o.lead_id = l.id
LEFT JOIN employees e ON o.owner_id = e.id
LEFT JOIN profiles p ON o.owner_id = p.id;

CREATE OR REPLACE VIEW vw_crm_leads AS
SELECT 
    l.id,
    l.company_id,
    l.lead_owner_id,
    l.created_by,
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', l.first_name, l.last_name)), ''), l.organization_name, 'Unnamed Lead') AS name,
    l.first_name,
    l.last_name,
    l.organization_name,
    l.organization_name AS company_name,
    l.email,
    l.phone,
    l.mobile,
    l.status,
    l.lead_type,
    COALESCE(src.name, 'Direct') AS source,
    l.city,
    l.country,
    l.industry,
    l.annual_revenue,
    COALESCE(e.name, p.full_name, 'Unassigned') AS owner_name,
    l.is_converted,
    l.created_at
FROM crm_leads l
LEFT JOIN org_lead_sources src ON l.lead_source_id = src.id
LEFT JOIN employees e ON l.lead_owner_id = e.id
LEFT JOIN profiles p ON l.lead_owner_id = p.id;

CREATE OR REPLACE VIEW vw_crm_customers AS
SELECT 
    c.id,
    c.company_id,
    c.owner_id,
    c.created_by,
    c.name,
    COALESCE(c.contract_number, '') AS code,
    c.customer_type,
    c.lifecycle_stage,
    c.primary_email AS email,
    c.primary_phone AS phone,
    c.billing_city AS city,
    c.billing_country AS country,
    c.billing_state AS state,
    c.industry,
    c.website,
    c.status,
    0::numeric AS credit_limit,
    COALESCE(e.name, p.full_name, 'Unassigned') AS owner_name,
    c.created_at
FROM crm_customers c
LEFT JOIN employees e ON c.owner_id = e.id
LEFT JOIN profiles p ON c.owner_id = p.id;

CREATE OR REPLACE VIEW customers AS 
SELECT * FROM vw_crm_customers;

GRANT SELECT ON vw_crm_opportunities TO authenticated, anon;
GRANT SELECT ON vw_crm_leads TO authenticated, anon;
GRANT SELECT ON vw_crm_customers TO authenticated, anon;
GRANT SELECT ON customers TO authenticated, anon;

-- 2. Update report_schema_registry for CRM module
DELETE FROM report_schema_registry WHERE module = 'CRM';

INSERT INTO report_schema_registry (module, source_table, field_key, field_label, data_type, is_filterable, is_sortable) VALUES
-- Deals & Opportunities
('CRM', 'crm_opportunities', 'title', 'Deal Title', 'text', true, true),
('CRM', 'crm_opportunities', 'amount', 'Deal Amount', 'currency', true, true),
('CRM', 'crm_opportunities', 'stage', 'Stage', 'text', true, true),
('CRM', 'crm_opportunities', 'status', 'Status', 'text', true, true),
('CRM', 'crm_opportunities', 'expected_closing_date', 'Expected Close Date', 'date', true, true),
('CRM', 'crm_opportunities', 'customer_name', 'Customer Name', 'text', true, true),
('CRM', 'crm_opportunities', 'owner_name', 'Sales Owner', 'text', true, true),
('CRM', 'crm_opportunities', 'probability', 'Win Probability (%)', 'number', true, true),
('CRM', 'crm_opportunities', 'type', 'Opportunity Type', 'text', true, true),
('CRM', 'crm_opportunities', 'currency', 'Currency', 'text', true, true),
('CRM', 'crm_opportunities', 'created_at', 'Created Date', 'date', true, true),

-- Leads & Prospects
('CRM', 'crm_leads', 'name', 'Lead Name', 'text', true, true),
('CRM', 'crm_leads', 'first_name', 'First Name', 'text', true, true),
('CRM', 'crm_leads', 'last_name', 'Last Name', 'text', true, true),
('CRM', 'crm_leads', 'company_name', 'Company', 'text', true, true),
('CRM', 'crm_leads', 'organization_name', 'Organization Name', 'text', true, true),
('CRM', 'crm_leads', 'email', 'Email', 'text', true, true),
('CRM', 'crm_leads', 'phone', 'Phone', 'text', true, true),
('CRM', 'crm_leads', 'mobile', 'Mobile', 'text', true, true),
('CRM', 'crm_leads', 'source', 'Lead Source', 'text', true, true),
('CRM', 'crm_leads', 'status', 'Lead Status', 'text', true, true),
('CRM', 'crm_leads', 'city', 'City', 'text', true, true),
('CRM', 'crm_leads', 'country', 'Country', 'text', true, true),
('CRM', 'crm_leads', 'industry', 'Industry', 'text', true, true),
('CRM', 'crm_leads', 'annual_revenue', 'Annual Revenue', 'currency', true, true),
('CRM', 'crm_leads', 'owner_name', 'Lead Owner', 'text', true, true),
('CRM', 'crm_leads', 'created_at', 'Created Date', 'date', true, true),

-- Customers & Contacts
('CRM', 'crm_customers', 'name', 'Customer Name', 'text', true, true),
('CRM', 'crm_customers', 'code', 'Contract / Customer Code', 'text', true, true),
('CRM', 'crm_customers', 'customer_type', 'Customer Type', 'text', true, true),
('CRM', 'crm_customers', 'lifecycle_stage', 'Lifecycle Stage', 'text', true, true),
('CRM', 'crm_customers', 'email', 'Email', 'text', true, true),
('CRM', 'crm_customers', 'phone', 'Phone', 'text', true, true),
('CRM', 'crm_customers', 'city', 'City', 'text', true, true),
('CRM', 'crm_customers', 'country', 'Country', 'text', true, true),
('CRM', 'crm_customers', 'industry', 'Industry', 'text', true, true),
('CRM', 'crm_customers', 'website', 'Website', 'text', true, true),
('CRM', 'crm_customers', 'status', 'Status', 'text', true, true),
('CRM', 'crm_customers', 'owner_name', 'Account Owner', 'text', true, true),
('CRM', 'crm_customers', 'created_at', 'Created Date', 'date', true, true);
