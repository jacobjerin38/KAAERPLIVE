-- ==============================================================================
-- KAA ERP Phase 2.2 - Advanced Accounting Schema
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ACCOUNTING MASTERS
-- ------------------------------------------------------------------------------

-- Fiscal Years
CREATE TABLE IF NOT EXISTS fiscal_years (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL, -- e.g., 'FY 2026-2027'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    UNIQUE(company_id, name)
);

-- Accounting Periods (Months)
CREATE TABLE IF NOT EXISTS accounting_periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    fiscal_year_id UUID REFERENCES fiscal_years(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., 'Jan 2026'
    code TEXT, -- '01/2026'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'Open', -- 'Open', 'Closed', 'Locked'
    UNIQUE(company_id, code)
);

-- Account Groups (Hierarchy)
CREATE TABLE IF NOT EXISTS account_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL,
    code_prefix_start TEXT,
    code_prefix_end TEXT,
    type TEXT, -- 'Asset', 'Liability', 'Equity', 'Income', 'Expense'
    parent_id UUID REFERENCES account_groups(id)
);

-- Chart of Accounts (Enhanced)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Asset', 'Liability', 'Equity', 'Income', 'Expense'
    subtype TEXT, -- 'Receivable', 'Payable', 'Bank', 'Cash', 'COGS', 'Revenue', 'Other'
    account_group_id UUID REFERENCES account_groups(id),
    currency_id UUID, -- For multi-currency accounts
    is_reconcilable BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(company_id, code)
);

-- Journals (Entry Types)
CREATE TABLE IF NOT EXISTS journals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL, -- 'Customer Invoices', 'Vendor Bills'
    code TEXT NOT NULL, -- 'INV', 'BILL', 'BNK1'
    type TEXT NOT NULL, -- 'Sale', 'Purchase', 'Cash', 'Bank', 'General'
    default_account_id UUID REFERENCES chart_of_accounts(id), -- Default Debit/Credit account
    sequence_prefix TEXT, -- 'INV/2026/'
    UNIQUE(company_id, code)
);

-- Taxes
CREATE TABLE IF NOT EXISTS taxes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL, -- 'GST 18%'
    type TEXT DEFAULT 'Percent', -- 'Percent', 'Fixed', 'Group'
    scope TEXT DEFAULT 'Sales', -- 'Sales', 'Purchase', 'None'
    amount NUMERIC NOT NULL, -- 18.0
    account_id UUID REFERENCES chart_of_accounts(id), -- Account to post tax to
    refund_account_id UUID REFERENCES chart_of_accounts(id), -- Account for refunds (optional)
    is_active BOOLEAN DEFAULT true
);

-- ------------------------------------------------------------------------------
-- 2. TRANSACTIONS (Double Entry System)
-- ------------------------------------------------------------------------------

-- Accounting Moves (Journal Entry Headers)
CREATE TABLE IF NOT EXISTS accounting_moves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    journal_id UUID REFERENCES journals(id) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_id UUID REFERENCES accounting_periods(id), -- Auto-filled via trigger/RPC
    
    reference TEXT, -- Internal Ref 'INV/2026/001'
    notes TEXT,
    
    partner_id UUID, -- Link to Customer/Vendor (Profile or Org Master)
    -- We can link to profiles table for now, or a new partners table if CRM is separate.
    -- For now, explicit checking or loose UUID. Let's assume loose UUID managed by app for CRM/HRMS.
    
    state TEXT DEFAULT 'Draft', -- 'Draft', 'Posted', 'Cancelled'
    
    amount_total NUMERIC DEFAULT 0, -- Sum of debits (should equal credits)
    
    -- Links to source documents
    invoice_id UUID, 
    payment_id UUID,
    inventory_txn_id UUID REFERENCES inventory_transactions(id),
    
    auto_generated BOOLEAN DEFAULT false
);

-- Accounting Move Lines (The Ledger Items)
CREATE TABLE IF NOT EXISTS accounting_move_lines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    move_id UUID REFERENCES accounting_moves(id) ON DELETE CASCADE,
    journal_id UUID REFERENCES journals(id), -- Denormalized for speed
    date DATE NOT NULL,
    account_id UUID REFERENCES chart_of_accounts(id) NOT NULL,
    
    partner_id UUID,
    
    name TEXT, -- Line description
    
    debit NUMERIC DEFAULT 0 CHECK (debit >= 0),
    credit NUMERIC DEFAULT 0 CHECK (credit >= 0),
    balance NUMERIC GENERATED ALWAYS AS (debit - credit) STORED,
    
    -- Currency
    amount_currency NUMERIC, -- Amount in foreign currency
    currency_id UUID,
    
    -- Matching
    full_reconcile_id UUID, -- Future: Link to reconciliation record
    tax_line_id UUID REFERENCES taxes(id), -- If this line is a tax amount
    
    -- Analytic
    analytic_account_id UUID
);

-- ------------------------------------------------------------------------------
-- 3. RLS Policies
-- ------------------------------------------------------------------------------

ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_move_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation" ON fiscal_years USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON accounting_periods USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON account_groups USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON chart_of_accounts USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON journals USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON taxes USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON accounting_moves USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON accounting_move_lines USING (company_id = get_my_company_id());
