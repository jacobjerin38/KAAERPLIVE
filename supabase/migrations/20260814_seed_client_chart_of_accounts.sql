-- ==============================================================================
-- KAA ERP - Seed Client Authoritative Chart of Accounts (PEC)
-- Migration: 20260814_seed_client_chart_of_accounts.sql
-- Description: Idempotently seeds 24 Header Groups and 106 Posting Accounts for PEC
-- ==============================================================================

-- 1. Ensure columns exist on public.accounting_chart_of_accounts
ALTER TABLE public.accounting_chart_of_accounts 
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS balance_type TEXT DEFAULT 'Debit balance',
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Drop legacy subtype constraint if it exists to allow flexible categories
ALTER TABLE public.accounting_chart_of_accounts 
DROP CONSTRAINT IF EXISTS accounting_chart_of_accounts_subtype_check;

-- 3. Create Idempotent Seed Function per Company
CREATE OR REPLACE FUNCTION public.fn_seed_client_chart_of_accounts(p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_hdr_id UUID;
BEGIN
    IF p_company_id IS NULL THEN
        RETURN;
    END IF;

    -- =========================================================================
    -- A. INSERT / UPDATE 24 HEADER / GROUP ACCOUNTS (is_group = true)
    -- =========================================================================
    
    -- Assets Headers
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, is_active)
    VALUES 
        (p_company_id, '1000', 'Cash on Hand', 'Asset', 'Current Assets', 'Debit balance', true, true),
        (p_company_id, '1005', 'Cash in Bank', 'Asset', 'Current Assets', 'Debit balance', true, true),
        (p_company_id, '1025', 'Fixed Deposits', 'Asset', 'Current Assets', 'Debit balance', true, true),
        (p_company_id, '1035', 'Bank Guarantee Margins', 'Asset', 'Current Assets', 'Debit balance', true, true),
        (p_company_id, '1100', 'Accounts Receivables', 'Asset', 'Current Assets', 'Debit balance', true, true),
        (p_company_id, '1200', 'Other Current Assets', 'Asset', 'Current Assets', 'Debit balance', true, true),
        (p_company_id, '1300', 'Inventories', 'Asset', 'Current Assets', 'Debit balance', true, true),
        (p_company_id, '1400', 'Contract Assets', 'Asset', 'Current Assets', 'Debit balance', true, true),
        (p_company_id, '1500', 'Fixed Assets', 'Asset', 'Fixed Assets', 'Debit balance', true, true),
    -- Liabilities Headers
        (p_company_id, '2000', 'Accounts Payables', 'Liability', 'Current Liabilities', 'Credit balance', true, true),
        (p_company_id, '2035', 'Staff Payables', 'Liability', 'Current Liabilities', 'Credit balance', true, true),
        (p_company_id, '2200', 'Due to Related Parties', 'Liability', 'Current Liabilities', 'Credit balance', true, true),
        (p_company_id, '2300', 'Unsecured Loans', 'Liability', 'Current Liabilities', 'Credit balance', true, true),
        (p_company_id, '2400', 'Other Current Liabilities', 'Liability', 'Current Liabilities', 'Credit balance', true, true),
    -- Equity Headers
        (p_company_id, '3000', 'Capital Account', 'Equity', 'Owner''s Equity', 'Credit balance', true, true),
    -- Revenue Headers
        (p_company_id, '4000', 'Sales Income', 'Income', 'Operating Revenue', 'Credit balance', true, true),
        (p_company_id, '4100', 'Service Income-Manpower', 'Income', 'Operating Revenue', 'Credit balance', true, true),
        (p_company_id, '4200', 'Service Income-Projects', 'Income', 'Operating Revenue', 'Credit balance', true, true),
        (p_company_id, '4300', 'Other Income', 'Income', 'Non-Operating Revenue', 'Credit balance', true, true),
    -- Expense Headers
        (p_company_id, '5000', 'Cost of Sales', 'Expense', 'Operating Expense', 'Debit balance', true, true),
        (p_company_id, '5200', 'Cost of Service-Projects', 'Expense', 'Operating Expense', 'Debit balance', true, true),
        (p_company_id, '5300', 'Cost of Service-Manpower', 'Expense', 'Operating Expense', 'Debit balance', true, true),
        (p_company_id, '5500', 'General & Administrative Expenses', 'Expense', 'Non-Operating Expense', 'Debit balance', true, true),
        (p_company_id, '5900', 'Finance Cost', 'Expense', 'Non-Operating Expense', 'Debit balance', true, true)
    ON CONFLICT (company_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        subtype = EXCLUDED.subtype,
        balance_type = EXCLUDED.balance_type,
        is_group = true;

    -- =========================================================================
    -- B. INSERT / UPDATE 106 POSTING ACCOUNTS WITH PARENT MAPPING
    -- =========================================================================

    -- Helpermacro logic using SQL subqueries for parent_id lookup by code/name

    -- Assets: Cash on Hand
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active)
    VALUES (p_company_id, '1010', 'Petty Cash', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1000' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Assets: Cash in Bank
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '1020', 'Cash in Bank - QIIB', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1005' LIMIT 1), true),
    (p_company_id, '1021', 'Cash in Bank - CBQ', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1005' LIMIT 1), true),
    (p_company_id, '1022', 'Cash in Bank - QNB', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1005' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Assets: Fixed Deposits
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '1030', 'Fixed Deposits - QIIB', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1025' LIMIT 1), true),
    (p_company_id, '1031', 'Fixed Deposits - CBQ', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1025' LIMIT 1), true),
    (p_company_id, '1032', 'Fixed Deposits - QNB', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1025' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Assets: Bank Guarantee Margins
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '1040', 'Cash Margin on Bank Guarantees - QIIB', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1035' LIMIT 1), true),
    (p_company_id, '1041', 'Cash Margin on Bank Guarantees - CBQ', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1035' LIMIT 1), true),
    (p_company_id, '1042', 'Cash Margin on Bank Guarantees - QNB', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1035' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Assets: Accounts Receivables
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '1110', 'Sundry Debtors', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Assets: Other Current Assets
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '1210', 'Accrued Income Receivables', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1200' LIMIT 1), true),
    (p_company_id, '1220', 'Employee Advances', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1200' LIMIT 1), true),
    (p_company_id, '1230', 'Other Receivables', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1200' LIMIT 1), true),
    (p_company_id, '1240', 'Prepaid Expenses', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1200' LIMIT 1), true),
    (p_company_id, '1250', 'Advances to Suppliers', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1200' LIMIT 1), true),
    (p_company_id, '1260', 'Security Deposit', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1200' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Assets: Inventories & Contract Assets
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '1310', 'Inventories', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1300' LIMIT 1), true),
    (p_company_id, '1410', 'Work In Process (WIP)', 'Asset', 'Current Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1400' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Assets: Fixed Assets (Property, Plant & Equipment + Accum. Depn)
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '1510', 'Computer Hardware, Software & Office Eqpt', 'Asset', 'Fixed Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1500' LIMIT 1), true),
    (p_company_id, '1520', 'Furniture & Fixtures', 'Asset', 'Fixed Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1500' LIMIT 1), true),
    (p_company_id, '1530', 'Leasehold Improvements', 'Asset', 'Fixed Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1500' LIMIT 1), true),
    (p_company_id, '1540', 'Tools', 'Asset', 'Fixed Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1500' LIMIT 1), true),
    (p_company_id, '1550', 'Vehicles', 'Asset', 'Fixed Assets', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1500' LIMIT 1), true),
    (p_company_id, '1610', 'Accum. Depn - Computer Hardware, Software & Office Eqpt', 'Asset', 'Fixed Assets', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1500' LIMIT 1), true),
    (p_company_id, '1620', 'Accum. Depn - Furniture & Fixtures', 'Asset', 'Fixed Assets', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1500' LIMIT 1), true),
    (p_company_id, '1630', 'Accum. Depn - Leasehold Improvements', 'Asset', 'Fixed Assets', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1500' LIMIT 1), true),
    (p_company_id, '1640', 'Accum. Depn - Tools', 'Asset', 'Fixed Assets', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1500' LIMIT 1), true),
    (p_company_id, '1650', 'Accum. Depn - Vehicles', 'Asset', 'Fixed Assets', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1500' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Liabilities: Current Liabilities (Accounts Payables, Provisions)
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '2010', 'Sundry Creditors', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2000' LIMIT 1), true),
    (p_company_id, '2020', 'Provision for Doubtful Accounts', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1), true),
    (p_company_id, '2021', 'Provision for Obsolete Inventory', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '1300' LIMIT 1), true),
    (p_company_id, '2030', 'Accrued Expense Payable', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2400' LIMIT 1), true),
    (p_company_id, '2031', 'Commission Payable', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2400' LIMIT 1), true),
    (p_company_id, '2032', 'Advances from Customers', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2400' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Liabilities: Staff Payables
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '2110', 'Employee Salary Payable', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2035' LIMIT 1), true),
    (p_company_id, '2111', 'Employee Leave Benefit Payable', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2035' LIMIT 1), true),
    (p_company_id, '2112', 'Employee Leave Ticket Benefit Payable', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2035' LIMIT 1), true),
    (p_company_id, '2113', 'Employee End of Service Benefit Payable', 'Liability', 'Long-Term Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2035' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Liabilities: Related Parties, Loans, Taxes & Other Payables
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '2210', 'Due to/from Imperial Holdings', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2200' LIMIT 1), true),
    (p_company_id, '2211', 'Due to/from Dr. Rana Sajjad Ali', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2200' LIMIT 1), true),
    (p_company_id, '2212', 'Due to/from KCTC Mena', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2200' LIMIT 1), true),
    (p_company_id, '2213', 'Due to/from KazGlobal LLP', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2200' LIMIT 1), true),
    (p_company_id, '2310', 'Working Capital Loan - CSC Advisory UAE', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2300' LIMIT 1), true),
    (p_company_id, '2410', 'Rental Payable', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2400' LIMIT 1), true),
    (p_company_id, '2420', 'Income Tax Payable', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2400' LIMIT 1), true),
    (p_company_id, '2421', 'Withholding Tax Payable', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2400' LIMIT 1), true),
    (p_company_id, '2510', 'Credit Card Payable - PEC QNB', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2400' LIMIT 1), true),
    (p_company_id, '2511', 'Credit Card Payable - Dr. Rana Ali Doha Bank', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2400' LIMIT 1), true),
    (p_company_id, '2610', 'Other Payables', 'Liability', 'Current Liabilities', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '2400' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Equity: Capital & Reserves
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '3010', 'Current Account - Imperial Holdings', 'Equity', 'Owner''s Equity', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '3000' LIMIT 1), true),
    (p_company_id, '3110', 'Legal Reserve', 'Equity', 'Owner''s Equity', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '3000' LIMIT 1), true),
    (p_company_id, '3210', 'Paid In Capital', 'Equity', 'Owner''s Equity', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '3000' LIMIT 1), true),
    (p_company_id, '3310', 'Retained Earnings', 'Equity', 'Owner''s Equity', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '3000' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Revenue: Sales, Service & Non-Operating Income
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '4010', 'Trading - 3X Engineering Income', 'Income', 'Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1), true),
    (p_company_id, '4011', 'Trading - Chesterton Income', 'Income', 'Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1), true),
    (p_company_id, '4012', 'Trading - Import Materials Income', 'Income', 'Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1), true),
    (p_company_id, '4013', 'Trading - Local Materials Income', 'Income', 'Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1), true),
    (p_company_id, '4014', 'Trading - Piping Income', 'Income', 'Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1), true),
    (p_company_id, '4015', 'Trading - PPE Income', 'Income', 'Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1), true),
    (p_company_id, '4016', 'Sales Discount / Rebate', 'Income', 'Operating Revenue', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4000' LIMIT 1), true),
    (p_company_id, '4110', 'Manpower Contracts Income', 'Income', 'Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4100' LIMIT 1), true),
    (p_company_id, '4210', 'Projects Income', 'Income', 'Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4200' LIMIT 1), true),
    (p_company_id, '4310', 'Rental Income', 'Income', 'Non-Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4300' LIMIT 1), true),
    (p_company_id, '4320', 'Interest Income', 'Income', 'Non-Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4300' LIMIT 1), true),
    (p_company_id, '4330', 'Exchange Fluctuation Gain', 'Income', 'Non-Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4300' LIMIT 1), true),
    (p_company_id, '4340', 'Other Indirect Income', 'Income', 'Non-Operating Revenue', 'Credit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '4300' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Expenses: Cost of Sales & Cost of Services
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '5010', 'Purchase - 3X Bobipreg & Consumables', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5011', 'Purchase - 3X Reinforcekit 4D', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5012', 'Purchase - 3X Rollerkit & Accessories', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5013', 'Purchase - 3X Stopkit', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5020', 'Purchase - Chesterton ARC Industrial Coatings', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5021', 'Purchase - Chesterton Industrial Lubricants & MRO Chemicals', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5022', 'Purchase - Chesterton Mechanical Packing & Gasketing', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5023', 'Purchase - Chesterton Mechanical Seals', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5024', 'Purchase - Chesterton Smart/IOOT Products', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5030', 'Purchase - Import Material Items', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5040', 'Purchase - Local Material Items', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5050', 'Purchase - Piping Items', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5060', 'Purchase - PPE Items', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5110', 'COS - Packaging', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5120', 'Freight Charges', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5130', 'Customs duty & Other Legalization Charges', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5140', 'Warehousing Charges', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5000' LIMIT 1), true),
    (p_company_id, '5210', 'COS - Projects', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Expenses: Manpower Cost of Service
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '5310', 'Manpower Salaries & Wages', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5300' LIMIT 1), true),
    (p_company_id, '5311', 'Manpower Emp Benefits_Accomodation/Laundry', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5300' LIMIT 1), true),
    (p_company_id, '5312', 'Manpower Emp Benefits_Air Ticket', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5300' LIMIT 1), true),
    (p_company_id, '5313', 'Manpower Emp Benefits_Annual Leave Salary', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5300' LIMIT 1), true),
    (p_company_id, '5314', 'Manpower Emp Benefits_EOS Salary', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5300' LIMIT 1), true),
    (p_company_id, '5315', 'Manpower Emp Benefits_Gatepass', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5300' LIMIT 1), true),
    (p_company_id, '5316', 'Manpower Emp Benefits_Insurance', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5300' LIMIT 1), true),
    (p_company_id, '5317', 'Manpower Emp Benefits_Medical', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5300' LIMIT 1), true),
    (p_company_id, '5318', 'Manpower Emp Benefits_PPE Items', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5300' LIMIT 1), true),
    (p_company_id, '5319', 'Manpower Emp Benefits_QID/Visa Legalization', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5300' LIMIT 1), true),
    (p_company_id, '5320', 'Manpower Emp Benefits_Transportation', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5300' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Expenses: Project Cost of Service
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '5410', 'Project Salaries & Wages', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true),
    (p_company_id, '5411', 'Project Emp Benefits_Accomodation/Laundry', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true),
    (p_company_id, '5412', 'Project Emp Benefits_Air Ticket', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true),
    (p_company_id, '5413', 'Project Emp Benefits_Annual Leave Salary', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true),
    (p_company_id, '5414', 'Project Emp Benefits_EOS Salary', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true),
    (p_company_id, '5415', 'Project Emp Benefits_Gatepass', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true),
    (p_company_id, '5416', 'Project Emp Benefits_Insurance', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true),
    (p_company_id, '5417', 'Project Emp Benefits_Medical', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true),
    (p_company_id, '5418', 'Project Emp Benefits_PPE Items', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true),
    (p_company_id, '5419', 'Project Emp Benefits_QID/Visa Legalization', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true),
    (p_company_id, '5420', 'Project Emp Benefits_Transportation', 'Expense', 'Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5200' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Expenses: General & Administrative Expenses
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '5510', 'Office Rental/Lease Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5520', 'Vehicle Rental/Lease Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5530', 'Utilities Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5610', 'Staff Salaries & Wages', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5611', 'Staff Emp Benefits_Accomodation/Laundry', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5612', 'Staff Emp Benefits_Air Ticket', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5613', 'Staff Emp Benefits_Annual Leave Salary', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5614', 'Staff Emp Benefits_EOS Salary', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5615', 'Staff Emp Benefits_Gatepass', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5616', 'Staff Emp Benefits_Insurance', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5617', 'Staff Emp Benefits_Medical', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5618', 'Staff Emp Benefits_PPE Items', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5619', 'Staff Emp Benefits_QID/Visa Legalization', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5620', 'Staff Emp Benefits_Transportation', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5710', 'Training Expenses', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5720', 'Advertising Charges', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5730', 'Bank Charges', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5740', 'Commission Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5750', 'Depreciation Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5760', 'Doubtful Account Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5770', 'Exchange Fluctuation Loss', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5780', 'Fuel & Lubricants', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5790', 'Government Fees', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5800', 'Insurance Fees', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5810', 'Income Tax Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5811', 'Withholding Tax Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5820', 'Inventory Write-Down Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5830', 'Telephone & Postage', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5840', 'Printing & Stationery', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5850', 'Professional Fees', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5860', 'Repairs & Maintenance', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5870', 'Rounding-Off Difference', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5880', 'Donation Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5890', 'Staff & Guest Welfare', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5900', 'Liquidated Damage Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true),
    (p_company_id, '5910', 'Other Expense', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5500' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

    -- Expenses: Finance Cost
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, balance_type, is_group, parent_id, is_active) VALUES
    (p_company_id, '5920', 'Interest on Borrowings', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5900' LIMIT 1), true),
    (p_company_id, '5921', 'Interest on Lease Liability', 'Expense', 'Non-Operating Expense', 'Debit balance', false, (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = p_company_id AND code = '5900' LIMIT 1), true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, subtype = EXCLUDED.subtype, balance_type = EXCLUDED.balance_type, parent_id = EXCLUDED.parent_id;

END;
$$;

-- 4. Execute seed function for all existing companies in public.companies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.companies LOOP
        PERFORM public.fn_seed_client_chart_of_accounts(r.id);
    END LOOP;
END $$;
