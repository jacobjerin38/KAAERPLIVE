-- ==============================================================================
-- Migration: 20260926163000_fix_10arg_accounting_invoice_dr_cr.sql
-- Description:
--   1. Drop obsolete 7-argument overload of rpc_create_accounting_invoice and rpc_update_accounting_invoice
--   2. Update the canonical 10-argument rpc_create_accounting_invoice and rpc_update_accounting_invoice
--      to properly handle mixed item purchase and expense lines, including negative amounts:
--        * Vendor Bill (in_invoice):
--            - Positive lines: DR Account (debit = amt, credit = 0)
--            - Negative lines (deduction/discount): CR Account (debit = 0, credit = ABS(amt))
--            - Balancing line: CR Vendor Accounts Payable (net amount)
--        * Vendor Debit Note (in_refund):
--            - Positive lines: CR Account (debit = 0, credit = amt)
--            - Negative lines: DR Account (debit = ABS(amt), credit = 0)
--            - Balancing line: DR Vendor Accounts Payable (net amount)
--        * Customer Invoice (out_invoice):
--            - Positive lines: CR Revenue (debit = 0, credit = amt)
--            - Negative lines (discount): DR Revenue (debit = ABS(amt), credit = 0)
--            - Balancing line: DR Customer Accounts Receivable (net amount)
--        * Customer Credit Note (out_refund):
--            - Positive lines: DR Revenue (debit = amt, credit = 0)
--            - Negative lines: CR Revenue (debit = 0, credit = ABS(amt))
--            - Balancing line: CR Customer Accounts Receivable (net amount)
-- ==============================================================================

-- Drop the 7-argument overloads that conflict with the 10-argument versions
DROP FUNCTION IF EXISTS public.rpc_create_accounting_invoice(uuid, uuid, date, date, text, jsonb, uuid);
DROP FUNCTION IF EXISTS public.rpc_update_accounting_invoice(uuid, uuid, uuid, date, date, jsonb, uuid);

-- ------------------------------------------------------------------------------
-- 1. Canonical 10-argument rpc_create_accounting_invoice
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_create_accounting_invoice(
    p_partner_id UUID,
    p_journal_id UUID,
    p_date DATE,
    p_due_date DATE,
    p_move_type TEXT,
    p_lines JSONB,
    p_company_id UUID DEFAULT NULL,
    p_reference TEXT DEFAULT NULL,
    p_invoice_date DATE DEFAULT NULL,
    p_supplier_invoice_number TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entry_id UUID;
    v_company_id UUID;
    v_line JSONB;
    v_item RECORD;
    v_partner RECORD;
    v_account_id UUID;
    v_receivable_payable_account_id UUID;
    v_total_amount NUMERIC := 0;
    v_line_name TEXT;
    v_line_qty NUMERIC;
    v_line_price NUMERIC;
    v_line_amt NUMERIC;
    v_line_debit NUMERIC;
    v_line_credit NUMERIC;
BEGIN
    v_company_id := COALESCE(p_company_id, get_my_company_id());
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Company context could not be identified.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.accounting_journals 
        WHERE id = p_journal_id AND company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Invalid Journal selected for this company.';
    END IF;

    SELECT * INTO v_partner FROM public.accounting_partners WHERE id = p_partner_id AND company_id = v_company_id;
    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'Partner not found for this company.';
    END IF;

    IF p_move_type IN ('out_invoice', 'out_refund') THEN
        IF v_partner.property_account_receivable_id IS NOT NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE id = v_partner.property_account_receivable_id 
              AND company_id = v_company_id 
              AND is_group = false;
        END IF;

        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id 
              AND code = '1110' 
              AND is_group = false
            LIMIT 1;
        END IF;

        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id 
              AND (subtype ILIKE '%Receivable%' OR type = 'Asset')
              AND is_group = false
            ORDER BY code ASC
            LIMIT 1;
        END IF;

    ELSIF p_move_type IN ('in_invoice', 'in_refund') THEN
        IF v_partner.property_account_payable_id IS NOT NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE id = v_partner.property_account_payable_id 
              AND company_id = v_company_id 
              AND is_group = false;
        END IF;

        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id 
              AND code IN ('2010', '2001') 
              AND is_group = false
            ORDER BY code DESC
            LIMIT 1;
        END IF;

        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id 
              AND (subtype ILIKE '%Payable%' OR type = 'Liability')
              AND is_group = false
            ORDER BY code ASC
            LIMIT 1;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unsupported move type: %', p_move_type;
    END IF;

    IF v_receivable_payable_account_id IS NULL THEN
        RAISE EXCEPTION 'Partner % is missing a valid Receivable/Payable posting account.', v_partner.name;
    END IF;

    -- Create Header
    INSERT INTO public.accounting_journal_entries (
        company_id, journal_id, date, invoice_date, due_date, 
        partner_id, move_type, state, amount_total,
        reference, supplier_invoice_number
    ) VALUES (
        v_company_id, p_journal_id, p_date, COALESCE(p_invoice_date, p_date), p_due_date,
        p_partner_id, p_move_type, 'Draft', 0,
        NULLIF(TRIM(p_reference), ''), NULLIF(TRIM(p_supplier_invoice_number), '')
    ) RETURNING id INTO v_entry_id;

    -- Process Line Items
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_account_id := NULL;
        v_line_name := NULL;
        v_line_qty := COALESCE((v_line->>'quantity')::numeric, 1);
        v_line_price := COALESCE((v_line->>'unit_price')::numeric, 0);
        v_line_amt := v_line_qty * v_line_price;

        -- Step A: Direct Account ID passed
        IF NULLIF(v_line->>'account_id', '') IS NOT NULL THEN
            SELECT id, name INTO v_account_id, v_line_name
            FROM public.accounting_chart_of_accounts
            WHERE id = (v_line->>'account_id')::UUID 
              AND company_id = v_company_id 
              AND is_group = false;
        END IF;

        -- Step B: Direct Purchase/Sales Ledger ID passed
        IF v_account_id IS NULL THEN
            IF p_move_type IN ('out_invoice', 'out_refund') AND NULLIF(v_line->>'sales_ledger_id', '') IS NOT NULL THEN
                SELECT account_id, name INTO v_account_id, v_line_name
                FROM public.accounting_sales_ledgers
                WHERE id = (v_line->>'sales_ledger_id')::UUID AND company_id = v_company_id;
            ELSIF p_move_type IN ('in_invoice', 'in_refund') AND NULLIF(v_line->>'purchase_ledger_id', '') IS NOT NULL THEN
                SELECT account_id, name INTO v_account_id, v_line_name
                FROM public.accounting_purchase_ledgers
                WHERE id = (v_line->>'purchase_ledger_id')::UUID AND company_id = v_company_id;
            END IF;
        END IF;

        -- Step C: Fallback to Item Master
        IF v_account_id IS NULL AND NULLIF(v_line->>'item_id', '') IS NOT NULL THEN
            SELECT * INTO v_item FROM public.item_master WHERE id = (v_line->>'item_id')::UUID AND company_id = v_company_id;
            IF FOUND THEN
                v_line_name := COALESCE(v_line_name, v_item.name);
                IF p_move_type IN ('out_invoice', 'out_refund') AND v_item.income_account_id IS NOT NULL THEN
                    SELECT id INTO v_account_id
                    FROM public.accounting_chart_of_accounts
                    WHERE id = v_item.income_account_id AND company_id = v_company_id AND is_group = false;
                ELSIF p_move_type IN ('in_invoice', 'in_refund') AND v_item.expense_account_id IS NOT NULL THEN
                    SELECT id INTO v_account_id
                    FROM public.accounting_chart_of_accounts
                    WHERE id = v_item.expense_account_id AND company_id = v_company_id AND is_group = false;
                END IF;
            END IF;
        END IF;

        -- Step D: Standard fallback accounts
        IF v_account_id IS NULL THEN
            IF p_move_type IN ('out_invoice', 'out_refund') THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND type = 'Income' AND is_group = false
                ORDER BY code ASC LIMIT 1;
            ELSIF p_move_type IN ('in_invoice', 'in_refund') THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND type = 'Expense' AND is_group = false
                ORDER BY code ASC LIMIT 1;
            END IF;
        END IF;

        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'No valid account could be determined for invoice/bill line %', COALESCE(v_line->>'description', 'item');
        END IF;

        v_line_name := COALESCE(NULLIF(v_line->>'description', ''), v_line_name, 'Line Item');

        -- Double-Entry DR/CR assignment handling positive and negative amounts
        IF p_move_type = 'in_invoice' THEN
            -- Normal vendor bill line: DR Expense/Asset. If negative (deduction/reversal) -> CR Expense/Asset
            IF v_line_amt >= 0 THEN
                v_line_debit := v_line_amt;
                v_line_credit := 0;
            ELSE
                v_line_debit := 0;
                v_line_credit := ABS(v_line_amt);
            END IF;
        ELSIF p_move_type = 'in_refund' THEN
            -- Purchase debit note: CR Expense. If negative -> DR Expense
            IF v_line_amt >= 0 THEN
                v_line_debit := 0;
                v_line_credit := v_line_amt;
            ELSE
                v_line_debit := ABS(v_line_amt);
                v_line_credit := 0;
            END IF;
        ELSIF p_move_type = 'out_invoice' THEN
            -- Customer invoice line: CR Revenue. If negative (discount/deduction) -> DR Revenue
            IF v_line_amt >= 0 THEN
                v_line_debit := 0;
                v_line_credit := v_line_amt;
            ELSE
                v_line_debit := ABS(v_line_amt);
                v_line_credit := 0;
            END IF;
        ELSIF p_move_type = 'out_refund' THEN
            -- Customer credit note: DR Revenue. If negative -> CR Revenue
            IF v_line_amt >= 0 THEN
                v_line_debit := v_line_amt;
                v_line_credit := 0;
            ELSE
                v_line_debit := 0;
                v_line_credit := ABS(v_line_amt);
            END IF;
        END IF;

        INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id,
            item_id, quantity, unit_price
        ) VALUES (
            v_company_id, v_entry_id, v_account_id, p_partner_id, v_line_name,
            v_line_debit, v_line_credit,
            NULLIF(v_line->>'cost_center_id', '')::UUID, 
            NULLIF(v_line->>'project_cost_center_id', '')::UUID, 
            NULLIF(v_line->>'contract_cost_center_id', '')::UUID,
            NULLIF(v_line->>'item_id', '')::UUID,
            v_line_qty,
            v_line_price
        );

        v_total_amount := v_total_amount + v_line_amt;
    END LOOP;

    -- Balancing Line (Accounts Payable / Accounts Receivable)
    IF p_move_type = 'in_invoice' THEN
        -- Net Vendor Payable
        IF v_total_amount >= 0 THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Vendor Bill'),
                0, v_total_amount, NULL, NULL
            );
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Vendor Bill'),
                ABS(v_total_amount), 0, NULL, NULL
            );
        END IF;
    ELSIF p_move_type = 'in_refund' THEN
        IF v_total_amount >= 0 THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Vendor Debit Note / Purchase Return'),
                v_total_amount, 0, NULL, NULL
            );
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Vendor Debit Note / Purchase Return'),
                0, ABS(v_total_amount), NULL, NULL
            );
        END IF;
    ELSIF p_move_type = 'out_invoice' THEN
        -- Net Customer Receivable
        IF v_total_amount >= 0 THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Customer Invoice'),
                v_total_amount, 0, NULL, NULL
            );
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Customer Invoice'),
                0, ABS(v_total_amount), NULL, NULL
            );
        END IF;
    ELSIF p_move_type = 'out_refund' THEN
        IF v_total_amount >= 0 THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Customer Credit Note / Sales Return'),
                0, v_total_amount, NULL, NULL
            );
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Customer Credit Note / Sales Return'),
                ABS(v_total_amount), 0, NULL, NULL
            );
        END IF;
    END IF;

    -- Update Entry Header Amount Total
    UPDATE public.accounting_journal_entries 
    SET amount_total = v_total_amount 
    WHERE id = v_entry_id;

    RETURN v_entry_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Canonical 10-argument rpc_update_accounting_invoice
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_update_accounting_invoice(
    p_entry_id UUID,
    p_partner_id UUID,
    p_journal_id UUID,
    p_date DATE,
    p_due_date DATE,
    p_lines JSONB,
    p_company_id UUID DEFAULT NULL,
    p_reference TEXT DEFAULT NULL,
    p_invoice_date DATE DEFAULT NULL,
    p_supplier_invoice_number TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_state TEXT;
    v_line JSONB;
    v_item RECORD;
    v_partner RECORD;
    v_account_id UUID;
    v_receivable_payable_account_id UUID;
    v_total_amount NUMERIC := 0;
    v_line_name TEXT;
    v_move_type TEXT;
    v_line_qty NUMERIC;
    v_line_price NUMERIC;
    v_line_amt NUMERIC;
    v_line_debit NUMERIC;
    v_line_credit NUMERIC;
BEGIN
    v_company_id := COALESCE(p_company_id, get_my_company_id());
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Company context could not be identified.';
    END IF;
    
    SELECT state, move_type INTO v_state, v_move_type 
    FROM public.accounting_journal_entries 
    WHERE id = p_entry_id AND company_id = v_company_id;
    
    IF v_state IS NULL THEN
        RAISE EXCEPTION 'Invoice/Bill not found for this company.';
    END IF;
    
    IF v_state != 'Draft' THEN
        RAISE EXCEPTION 'Only Draft entries can be edited.';
    END IF;
    
    SELECT * INTO v_partner FROM public.accounting_partners WHERE id = p_partner_id AND company_id = v_company_id;
    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'Partner not found for this company.';
    END IF;

    IF v_move_type IN ('out_invoice', 'out_refund') THEN
        IF v_partner.property_account_receivable_id IS NOT NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE id = v_partner.property_account_receivable_id 
              AND company_id = v_company_id 
              AND is_group = false;
        END IF;

        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id 
              AND code = '1110' 
              AND is_group = false
            LIMIT 1;
        END IF;

        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id 
              AND (subtype ILIKE '%Receivable%' OR type = 'Asset')
              AND is_group = false
            ORDER BY code ASC
            LIMIT 1;
        END IF;

    ELSIF v_move_type IN ('in_invoice', 'in_refund') THEN
        IF v_partner.property_account_payable_id IS NOT NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE id = v_partner.property_account_payable_id 
              AND company_id = v_company_id 
              AND is_group = false;
        END IF;

        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id 
              AND code IN ('2010', '2001') 
              AND is_group = false
            ORDER BY code DESC
            LIMIT 1;
        END IF;

        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id 
              AND (subtype ILIKE '%Payable%' OR type = 'Liability')
              AND is_group = false
            ORDER BY code ASC
            LIMIT 1;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unsupported move type: %', v_move_type;
    END IF;
    
    IF v_receivable_payable_account_id IS NULL THEN
        RAISE EXCEPTION 'Partner % is missing a valid Receivable/Payable posting account.', v_partner.name;
    END IF;
    
    -- Delete existing lines safely
    DELETE FROM public.accounting_journal_lines WHERE entry_id = p_entry_id;
    
    -- Process and Insert new Lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_account_id := NULL;
        v_line_name := NULL;
        v_line_qty := COALESCE((v_line->>'quantity')::numeric, 1);
        v_line_price := COALESCE((v_line->>'unit_price')::numeric, 0);
        v_line_amt := v_line_qty * v_line_price;

        -- Step A: Direct Account ID passed
        IF NULLIF(v_line->>'account_id', '') IS NOT NULL THEN
            SELECT id, name INTO v_account_id, v_line_name
            FROM public.accounting_chart_of_accounts
            WHERE id = (v_line->>'account_id')::UUID 
              AND company_id = v_company_id 
              AND is_group = false;
        END IF;

        -- Step B: Direct Purchase/Sales Ledger ID passed
        IF v_account_id IS NULL THEN
            IF v_move_type IN ('out_invoice', 'out_refund') AND NULLIF(v_line->>'sales_ledger_id', '') IS NOT NULL THEN
                SELECT account_id, name INTO v_account_id, v_line_name
                FROM public.accounting_sales_ledgers
                WHERE id = (v_line->>'sales_ledger_id')::UUID AND company_id = v_company_id;
            ELSIF v_move_type IN ('in_invoice', 'in_refund') AND NULLIF(v_line->>'purchase_ledger_id', '') IS NOT NULL THEN
                SELECT account_id, name INTO v_account_id, v_line_name
                FROM public.accounting_purchase_ledgers
                WHERE id = (v_line->>'purchase_ledger_id')::UUID AND company_id = v_company_id;
            END IF;
        END IF;

        -- Step C: Fallback to Item Master
        IF v_account_id IS NULL AND NULLIF(v_line->>'item_id', '') IS NOT NULL THEN
            SELECT * INTO v_item FROM public.item_master WHERE id = (v_line->>'item_id')::UUID AND company_id = v_company_id;
            IF FOUND THEN
                v_line_name := COALESCE(v_line_name, v_item.name);
                IF v_move_type IN ('out_invoice', 'out_refund') AND v_item.income_account_id IS NOT NULL THEN
                    SELECT id INTO v_account_id
                    FROM public.accounting_chart_of_accounts
                    WHERE id = v_item.income_account_id AND company_id = v_company_id AND is_group = false;
                ELSIF v_move_type IN ('in_invoice', 'in_refund') AND v_item.expense_account_id IS NOT NULL THEN
                    SELECT id INTO v_account_id
                    FROM public.accounting_chart_of_accounts
                    WHERE id = v_item.expense_account_id AND company_id = v_company_id AND is_group = false;
                END IF;
            END IF;
        END IF;

        -- Step D: Standard fallback accounts
        IF v_account_id IS NULL THEN
            IF v_move_type IN ('out_invoice', 'out_refund') THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND type = 'Income' AND is_group = false
                ORDER BY code ASC LIMIT 1;
            ELSIF v_move_type IN ('in_invoice', 'in_refund') THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND type = 'Expense' AND is_group = false
                ORDER BY code ASC LIMIT 1;
            END IF;
        END IF;

        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'No valid account could be determined for invoice/bill line %', COALESCE(v_line->>'description', 'item');
        END IF;

        v_line_name := COALESCE(NULLIF(v_line->>'description', ''), v_line_name, 'Line Item');

        -- Double-Entry DR/CR assignment handling positive and negative amounts
        IF v_move_type = 'in_invoice' THEN
            IF v_line_amt >= 0 THEN
                v_line_debit := v_line_amt;
                v_line_credit := 0;
            ELSE
                v_line_debit := 0;
                v_line_credit := ABS(v_line_amt);
            END IF;
        ELSIF v_move_type = 'in_refund' THEN
            IF v_line_amt >= 0 THEN
                v_line_debit := 0;
                v_line_credit := v_line_amt;
            ELSE
                v_line_debit := ABS(v_line_amt);
                v_line_credit := 0;
            END IF;
        ELSIF v_move_type = 'out_invoice' THEN
            IF v_line_amt >= 0 THEN
                v_line_debit := 0;
                v_line_credit := v_line_amt;
            ELSE
                v_line_debit := ABS(v_line_amt);
                v_line_credit := 0;
            END IF;
        ELSIF v_move_type = 'out_refund' THEN
            IF v_line_amt >= 0 THEN
                v_line_debit := v_line_amt;
                v_line_credit := 0;
            ELSE
                v_line_debit := 0;
                v_line_credit := ABS(v_line_amt);
            END IF;
        END IF;

        INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id,
            item_id, quantity, unit_price
        ) VALUES (
            v_company_id, p_entry_id, v_account_id, p_partner_id, v_line_name,
            v_line_debit, v_line_credit,
            NULLIF(v_line->>'cost_center_id', '')::UUID, 
            NULLIF(v_line->>'project_cost_center_id', '')::UUID, 
            NULLIF(v_line->>'contract_cost_center_id', '')::UUID,
            NULLIF(v_line->>'item_id', '')::UUID,
            v_line_qty,
            v_line_price
        );

        v_total_amount := v_total_amount + v_line_amt;
    END LOOP;

    -- Balancing Line (Accounts Payable / Accounts Receivable)
    IF v_move_type = 'in_invoice' THEN
        IF v_total_amount >= 0 THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Vendor Bill'),
                0, v_total_amount, NULL, NULL
            );
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Vendor Bill'),
                ABS(v_total_amount), 0, NULL, NULL
            );
        END IF;
    ELSIF v_move_type = 'in_refund' THEN
        IF v_total_amount >= 0 THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Vendor Debit Note / Purchase Return'),
                v_total_amount, 0, NULL, NULL
            );
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Vendor Debit Note / Purchase Return'),
                0, ABS(v_total_amount), NULL, NULL
            );
        END IF;
    ELSIF v_move_type = 'out_invoice' THEN
        IF v_total_amount >= 0 THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Customer Invoice'),
                v_total_amount, 0, NULL, NULL
            );
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Customer Invoice'),
                0, ABS(v_total_amount), NULL, NULL
            );
        END IF;
    ELSIF v_move_type = 'out_refund' THEN
        IF v_total_amount >= 0 THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Customer Credit Note / Sales Return'),
                0, v_total_amount, NULL, NULL
            );
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, 
                COALESCE(NULLIF(TRIM(p_reference), ''), 'Customer Credit Note / Sales Return'),
                ABS(v_total_amount), 0, NULL, NULL
            );
        END IF;
    END IF;

    -- Update Header
    UPDATE public.accounting_journal_entries 
    SET partner_id = p_partner_id,
        journal_id = p_journal_id,
        date = p_date,
        invoice_date = COALESCE(p_invoice_date, invoice_date, p_date),
        due_date = p_due_date,
        amount_total = v_total_amount,
        reference = COALESCE(NULLIF(TRIM(p_reference), ''), reference),
        supplier_invoice_number = NULLIF(TRIM(p_supplier_invoice_number), '')
    WHERE id = p_entry_id;

END;
$$;
