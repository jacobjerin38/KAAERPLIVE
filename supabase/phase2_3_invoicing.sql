-- ==============================================================================
-- KAA ERP Phase 2.3 - Invoicing & Partners
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PARTNERS (Customers & Vendors)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS accounting_partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    tax_id TEXT, -- VAT/GST Number
    street TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    
    partner_type TEXT DEFAULT 'Customer', -- 'Customer', 'Vendor', 'Both'
    
    -- Accounting Defaults
    property_account_receivable_id UUID REFERENCES chart_of_accounts(id),
    property_account_payable_id UUID REFERENCES chart_of_accounts(id),
    
    is_active BOOLEAN DEFAULT true,
    UNIQUE(company_id, name)
);

-- RLS
ALTER TABLE accounting_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation" ON accounting_partners USING (company_id = get_my_company_id());


-- ------------------------------------------------------------------------------
-- 2. SCHEMA ENHANCEMENTS
-- ------------------------------------------------------------------------------

-- Add Income/Expense Accounts to Item Master for auto-gl mapping
ALTER TABLE item_master 
ADD COLUMN IF NOT EXISTS income_account_id UUID REFERENCES chart_of_accounts(id),
ADD COLUMN IF NOT EXISTS expense_account_id UUID REFERENCES chart_of_accounts(id);


-- Add Move Type to Accounting Moves for easier filtering
ALTER TABLE accounting_moves
ADD COLUMN IF NOT EXISTS move_type TEXT DEFAULT 'entry'; 
-- Types: 'entry' (Manual), 'out_invoice' (Cust Inv), 'in_invoice' (Vendor Bill), 'out_refund', 'in_refund'

-- Add Payment Teams/Terms (Optional for now, but good placeholder)
ALTER TABLE accounting_moves
ADD COLUMN IF NOT EXISTS invoice_date DATE,
ADD COLUMN IF NOT EXISTS due_date DATE;

-- Update Accounting Move Lines to link to Partners (if not already strictly linked)
-- (Already exists in previous schema, but ensuring FK checks if we use this new table)
ALTER TABLE accounting_move_lines
ADD CONSTRAINT fk_move_line_partner 
FOREIGN KEY (partner_id) REFERENCES accounting_partners(id);

ALTER TABLE accounting_moves
ADD CONSTRAINT fk_move_partner
FOREIGN KEY (partner_id) REFERENCES accounting_partners(id);
