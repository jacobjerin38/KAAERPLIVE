-- ==============================================================================
-- KAA ERP Phase 2.2 - Qatar VAT Report Master Data & Demo Seeding
-- ==============================================================================

-- A helper function to safely provision VAT master data and seed demo records.
-- Can be triggered from UI when the transaction ledger is completely empty.
CREATE OR REPLACE FUNCTION rpc_seed_vat_demo_data(p_target_company_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_acc_rec_id UUID;
    v_acc_pay_id UUID;
    v_input_vat_id UUID;
    v_output_vat_id UUID;
    v_sales_id UUID;
    v_purchases_id UUID;
    v_bank_id UUID;
    
    v_tax_sale_5 UUID;
    v_tax_purch_5 UUID;
    v_tax_sale_0 UUID;
    v_tax_purch_0 UUID;
    v_tax_sale_ex UUID;
    v_tax_purch_ex UUID;
    
    v_journal_sale UUID;
    v_journal_purch UUID;
    
    v_move_id UUID;
    v_moves_created INT := 0;
    v_date DATE;
BEGIN
    -- Determine company_id: prioritizes p_target_company_id, then get_my_company_id(), falls back to Power Engineering Corp
    IF p_target_company_id IS NOT NULL THEN
        v_company_id := p_target_company_id;
    ELSE
        v_company_id := get_my_company_id();
        IF v_company_id IS NULL THEN
            v_company_id := '0c0b0d78-4531-412e-8fa3-bbc74b7145ae'; -- Power Engineering Corporation
        END IF;
    END IF;

    -- Safety check: Ensure no posted accounting moves exist for this company
    IF EXISTS (
        SELECT 1 FROM accounting_moves 
        WHERE company_id = v_company_id 
          AND state = 'Posted'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Demo seeding aborted: Company already has posted accounting entries in the database.'
        );
    END IF;

    -- --------------------------------------------------------------------------
    -- 1. Provision standard Accounts in Chart of Accounts
    -- --------------------------------------------------------------------------
    
    -- Accounts Receivable (Asset)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '110000', 'Accounts Receivable', 'Asset', 'Receivable', true, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_acc_rec_id;

    -- Main Bank Account (Asset)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '100100', 'Main Bank Account', 'Asset', 'Bank', true, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_bank_id;

    -- Input VAT Receivable (Asset)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '120300', 'Input VAT Receivable', 'Asset', 'Other', false, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_input_vat_id;

    -- Accounts Payable (Liability)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '210000', 'Accounts Payable', 'Liability', 'Payable', true, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_acc_pay_id;

    -- Output VAT Payable (Liability)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '220300', 'Output VAT Payable', 'Liability', 'Other', false, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_output_vat_id;

    -- Product Sales Revenue (Income)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '400000', 'Product Sales Revenue', 'Income', 'Revenue', false, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_sales_id;

    -- Purchases / Cost of Goods Sold (Expense)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '500000', 'Cost of Goods Sold / Purchases', 'Expense', 'COGS', false, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_purchases_id;

    -- --------------------------------------------------------------------------
    -- 2. Provision standard VAT Tax Codes
    -- --------------------------------------------------------------------------
    
    -- VAT 5% (Standard Sales)
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT 5% (Standard Sales)', 'Percent', 'sale', 5.0, v_output_vat_id, true)
    RETURNING id INTO v_tax_sale_5;

    -- VAT 5% (Standard Purchases)
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT 5% (Standard Purchases)', 'Percent', 'purchase', 5.0, v_input_vat_id, true)
    RETURNING id INTO v_tax_purch_5;

    -- VAT 0% (Zero-Rated Sales)
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT 0% (Zero-Rated Sales)', 'Percent', 'sale', 0.0, NULL, true)
    RETURNING id INTO v_tax_sale_0;

    -- VAT 0% (Zero-Rated Purchases)
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT 0% (Zero-Rated Purchases)', 'Percent', 'purchase', 0.0, NULL, true)
    RETURNING id INTO v_tax_purch_0;

    -- VAT Exempt Sales
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT Exempt Sales', 'Percent', 'sale', 0.0, NULL, true)
    RETURNING id INTO v_tax_sale_ex;

    -- VAT Exempt Purchases
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT Exempt Purchases', 'Percent', 'purchase', 0.0, NULL, true)
    RETURNING id INTO v_tax_purch_ex;

    -- --------------------------------------------------------------------------
    -- 3. Provision standard Journals
    -- --------------------------------------------------------------------------
    
    INSERT INTO journals (company_id, name, code, type, default_account_id)
    VALUES (v_company_id, 'Customer Invoices', 'INV', 'Sale', v_acc_rec_id)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_journal_sale;

    INSERT INTO journals (company_id, name, code, type, default_account_id)
    VALUES (v_company_id, 'Vendor Bills', 'BILL', 'Purchase', v_acc_pay_id)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_journal_purch;

    -- --------------------------------------------------------------------------
    -- 4. Seed realistic transactions for VAT visual validation
    -- --------------------------------------------------------------------------
    
    v_date := CURRENT_DATE;

    -- Transaction A: Standard Sale (QAR 10,000 Base, QAR 500 VAT)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_sale, v_date - 15, 'INV/2026/001', 'Sale to Doha Trading Co.', 'Posted', 10500)
    RETURNING id INTO v_move_id;
    
    -- Debit Receivables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 15, v_acc_rec_id, 'Receivable - Doha Trading Co.', 10500, 0);
    
    -- Credit Income
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 15, v_sales_id, 'Standard Product Sales', 0, 10000);
    
    -- Credit Tax
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 15, v_output_vat_id, 'VAT 5% Sales', 0, 500, v_tax_sale_5);
    
    v_moves_created := v_moves_created + 1;


    -- Transaction B: Zero-Rated Export Sale (QAR 5,000 Base)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_sale, v_date - 10, 'INV/2026/002', 'Export Sale to Riyadh Ent.', 'Posted', 5000)
    RETURNING id INTO v_move_id;
    
    -- Debit Receivables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 10, v_acc_rec_id, 'Receivable - Riyadh Ent.', 5000, 0);
    
    -- Credit Income
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 10, v_sales_id, 'Zero-Rated Export Sales', 0, 5000);
    
    -- Tax reference line (Credit 0)
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 10, v_output_vat_id, 'VAT 0% Zero-Rated Sales Link', 0, 0, v_tax_sale_0);

    v_moves_created := v_moves_created + 1;


    -- Transaction C: Exempt Medical Services Sale (QAR 3,000 Base)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_sale, v_date - 5, 'INV/2026/003', 'Exempt Sale to Qatar Health', 'Posted', 3000)
    RETURNING id INTO v_move_id;
    
    -- Debit Receivables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 5, v_acc_rec_id, 'Receivable - Qatar Health', 3000, 0);
    
    -- Credit Income
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 5, v_sales_id, 'Exempt Local Services Sales', 0, 3000);
    
    -- Tax reference line (Credit 0)
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 5, v_output_vat_id, 'VAT Exempt Sales Link', 0, 0, v_tax_sale_ex);

    v_moves_created := v_moves_created + 1;


    -- Transaction D: Standard Purchase / Supplies (QAR 6,000 Base, QAR 300 VAT)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_purch, v_date - 12, 'BILL/2026/001', 'Supplies from Qatar Steel', 'Posted', 6300)
    RETURNING id INTO v_move_id;
    
    -- Credit Payables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 12, v_acc_pay_id, 'Payable - Qatar Steel', 0, 6300);
    
    -- Debit Expenses
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 12, v_purchases_id, 'Standard Rated Raw Materials', 6000, 0);
    
    -- Debit Tax
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 12, v_input_vat_id, 'VAT 5% Purchases', 300, 0, v_tax_purch_5);

    v_moves_created := v_moves_created + 1;


    -- Transaction E: Zero-Rated Import Purchase (QAR 2,500 Base)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_purch, v_date - 8, 'BILL/2026/002', 'Imported Tools from Global Tech', 'Posted', 2500)
    RETURNING id INTO v_move_id;
    
    -- Credit Payables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 8, v_acc_pay_id, 'Payable - Global Tech', 0, 2500);
    
    -- Debit Expenses
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 8, v_purchases_id, 'Zero-Rated Imported Supplies', 2500, 0);
    
    -- Tax reference line (Debit 0)
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 8, v_input_vat_id, 'VAT 0% Zero-Rated Purchases Link', 0, 0, v_tax_purch_0);

    v_moves_created := v_moves_created + 1;


    -- Transaction F: Exempt Financial Services Purchase (QAR 1,500 Base)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_purch, v_date - 4, 'BILL/2026/003', 'Exempt Services from QNB', 'Posted', 1500)
    RETURNING id INTO v_move_id;
    
    -- Credit Payables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 4, v_acc_pay_id, 'Payable - QNB', 0, 1500);
    
    -- Debit Expenses
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 4, v_purchases_id, 'Exempt Financial Service Fees', 1500, 0);
    
    -- Tax reference line (Debit 0)
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 4, v_input_vat_id, 'VAT Exempt Purchases Link', 0, 0, v_tax_purch_ex);

    v_moves_created := v_moves_created + 1;


    RETURN jsonb_build_object(
        'success', true,
        'message', format('Successfully provisioned accounts, taxes, journals, and seeded %s posted double-entry moves.', v_moves_created)
    );
END;
$$;
