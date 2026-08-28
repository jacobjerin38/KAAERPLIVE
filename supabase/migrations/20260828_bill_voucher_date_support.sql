-- Migration: Support Voucher Date (Keying Date) and Bill Date (Supplier Invoice Date)
-- Date: 2026-08-28

-- 1. Update rpc_create_accounting_invoice to support p_invoice_date
CREATE OR REPLACE FUNCTION public.rpc_create_accounting_invoice(
    p_partner_id UUID,
    p_journal_id UUID,
    p_date DATE,
    p_due_date DATE,
    p_move_type TEXT,
    p_lines JSONB,
    p_company_id UUID DEFAULT NULL,
    p_reference TEXT DEFAULT NULL,
    p_invoice_date DATE DEFAULT NULL
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
BEGIN
    -- Determine Company Context securely
    v_company_id := COALESCE(p_company_id, get_my_company_id());
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Company context could not be identified.';
    END IF;

    -- Validate Journal belongs to current company
    IF NOT EXISTS (
        SELECT 1 FROM public.accounting_journals 
        WHERE id = p_journal_id AND company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Invalid Journal selected for this company.';
    END IF;

    -- 1. Get Partner Details & AR/AP Account
    SELECT * INTO v_partner FROM public.accounting_partners WHERE id = p_partner_id AND company_id = v_company_id;
    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'Partner not found for this company.';
    END IF;

    IF p_move_type = 'out_invoice' THEN
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

    ELSIF p_move_type = 'in_invoice' THEN
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
    END IF;

    IF v_receivable_payable_account_id IS NULL THEN
        RAISE EXCEPTION 'Partner % is missing a valid Receivable/Payable posting account in your Chart of Accounts.', v_partner.name;
    END IF;

    -- 2. Create Header (Draft State) in accounting_journal_entries with voucher date (date) and bill date (invoice_date)
    INSERT INTO public.accounting_journal_entries (
        company_id, journal_id, date, invoice_date, due_date, 
        partner_id, move_type, state, amount_total, reference
    ) VALUES (
        v_company_id, p_journal_id, p_date, COALESCE(p_invoice_date, p_date), p_due_date,
        p_partner_id, p_move_type, 'Draft', 0, NULLIF(TRIM(p_reference), '')
    ) RETURNING id INTO v_entry_id;

    -- 3. Process Lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_account_id := NULL;
        v_line_name := NULL;
        v_line_qty := COALESCE((v_line->>'quantity')::numeric, 1);
        v_line_price := COALESCE((v_line->>'unit_price')::numeric, 0);

        IF NULLIF(v_line->>'account_id', '') IS NOT NULL THEN
            SELECT id, name INTO v_account_id, v_line_name
            FROM public.accounting_chart_of_accounts
            WHERE id = (v_line->>'account_id')::UUID 
              AND company_id = v_company_id 
              AND is_group = false;
        END IF;

        IF v_account_id IS NULL THEN
            IF p_move_type = 'out_invoice' AND NULLIF(v_line->>'sales_ledger_id', '') IS NOT NULL THEN
                SELECT account_id, name INTO v_account_id, v_line_name
                FROM public.accounting_sales_ledgers
                WHERE id = (v_line->>'sales_ledger_id')::UUID AND company_id = v_company_id;
            ELSIF p_move_type = 'in_invoice' AND NULLIF(v_line->>'purchase_ledger_id', '') IS NOT NULL THEN
                SELECT account_id, name INTO v_account_id, v_line_name
                FROM public.accounting_purchase_ledgers
                WHERE id = (v_line->>'purchase_ledger_id')::UUID AND company_id = v_company_id;
            END IF;
        END IF;

        IF v_account_id IS NULL AND NULLIF(v_line->>'item_id', '') IS NOT NULL THEN
            SELECT * INTO v_item FROM public.item_master WHERE id = (v_line->>'item_id')::UUID AND company_id = v_company_id;
            IF FOUND THEN
                v_line_name := COALESCE(v_line_name, v_item.name);
                IF p_move_type = 'out_invoice' AND v_item.income_account_id IS NOT NULL THEN
                    SELECT id INTO v_account_id
                    FROM public.accounting_chart_of_accounts
                    WHERE id = v_item.income_account_id AND company_id = v_company_id AND is_group = false;
                ELSIF p_move_type = 'in_invoice' AND v_item.expense_account_id IS NOT NULL THEN
                    SELECT id INTO v_account_id
                    FROM public.accounting_chart_of_accounts
                    WHERE id = v_item.expense_account_id AND company_id = v_company_id AND is_group = false;
                END IF;
            END IF;
        END IF;

        IF v_account_id IS NULL THEN
            IF p_move_type = 'out_invoice' THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id 
                  AND type = 'Income' 
                  AND is_group = false
                ORDER BY code ASC
                LIMIT 1;
            ELSIF p_move_type = 'in_invoice' THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id 
                  AND type = 'Expense' 
                  AND is_group = false
                ORDER BY code ASC
                LIMIT 1;
            END IF;
        END IF;

        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'No valid account could be determined for invoice/bill line %', COALESCE(v_line->>'description', 'item');
        END IF;

        v_line_name := COALESCE(NULLIF(v_line->>'description', ''), v_line_name, 'Line Item');

        -- Insert Line Item
        IF p_move_type = 'out_invoice' THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name,
                debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id,
                item_id, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_account_id, p_partner_id, v_line_name,
                0, v_line_qty * v_line_price,
                NULLIF(v_line->>'cost_center_id', '')::UUID, 
                NULLIF(v_line->>'project_cost_center_id', '')::UUID, 
                NULLIF(v_line->>'contract_cost_center_id', '')::UUID,
                NULLIF(v_line->>'item_id', '')::UUID,
                v_line_qty,
                v_line_price
            );
        ELSIF p_move_type = 'in_invoice' THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name,
                debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id,
                item_id, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_account_id, p_partner_id, v_line_name,
                v_line_qty * v_line_price, 0,
                NULLIF(v_line->>'cost_center_id', '')::UUID, 
                NULLIF(v_line->>'project_cost_center_id', '')::UUID, 
                NULLIF(v_line->>'contract_cost_center_id', '')::UUID,
                NULLIF(v_line->>'item_id', '')::UUID,
                v_line_qty,
                v_line_price
            );
        END IF;

        v_total_amount := v_total_amount + (v_line_qty * v_line_price);
    END LOOP;

    -- Balancing Line
    IF p_move_type = 'out_invoice' THEN
        INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, COALESCE(NULLIF(TRIM(p_reference), ''), 'Customer Invoice'),
            v_total_amount, 0
        );
    ELSIF p_move_type = 'in_invoice' THEN
         INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, COALESCE(NULLIF(TRIM(p_reference), ''), 'Vendor Bill'),
            0, v_total_amount
        );
    END IF;

    -- Update Total Amount
    UPDATE public.accounting_journal_entries SET amount_total = v_total_amount WHERE id = v_entry_id;

    RETURN v_entry_id;
END;
$$;

-- 2. Update rpc_update_accounting_invoice to support p_invoice_date
CREATE OR REPLACE FUNCTION public.rpc_update_accounting_invoice(
    p_entry_id UUID,
    p_partner_id UUID,
    p_journal_id UUID,
    p_date DATE,
    p_due_date DATE,
    p_lines JSONB,
    p_company_id UUID DEFAULT NULL,
    p_reference TEXT DEFAULT NULL,
    p_invoice_date DATE DEFAULT NULL
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
BEGIN
    v_company_id := COALESCE(p_company_id, get_my_company_id());
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Company context could not be identified.';
    END IF;
    
    -- Check if entry exists, matches company, and is in Draft state
    SELECT state, move_type INTO v_state, v_move_type 
    FROM public.accounting_journal_entries 
    WHERE id = p_entry_id AND company_id = v_company_id;
    
    IF v_state IS NULL THEN
        RAISE EXCEPTION 'Invoice/Bill not found for this company.';
    END IF;
    
    IF v_state != 'Draft' THEN
        RAISE EXCEPTION 'Only Draft entries can be edited.';
    END IF;
    
    -- Get Partner Details & AR/AP Account
    SELECT * INTO v_partner FROM public.accounting_partners WHERE id = p_partner_id AND company_id = v_company_id;
    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'Partner not found for this company.';
    END IF;

    IF v_move_type = 'out_invoice' THEN
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

    ELSIF v_move_type = 'in_invoice' THEN
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

        IF NULLIF(v_line->>'account_id', '') IS NOT NULL THEN
            SELECT id, name INTO v_account_id, v_line_name
            FROM public.accounting_chart_of_accounts
            WHERE id = (v_line->>'account_id')::UUID 
              AND company_id = v_company_id 
              AND is_group = false;
        END IF;

        IF v_account_id IS NULL THEN
            IF v_move_type = 'out_invoice' AND NULLIF(v_line->>'sales_ledger_id', '') IS NOT NULL THEN
                SELECT account_id, name INTO v_account_id, v_line_name
                FROM public.accounting_sales_ledgers
                WHERE id = (v_line->>'sales_ledger_id')::UUID AND company_id = v_company_id;
            ELSIF v_move_type = 'in_invoice' AND NULLIF(v_line->>'purchase_ledger_id', '') IS NOT NULL THEN
                SELECT account_id, name INTO v_account_id, v_line_name
                FROM public.accounting_purchase_ledgers
                WHERE id = (v_line->>'purchase_ledger_id')::UUID AND company_id = v_company_id;
            END IF;
        END IF;

        IF v_account_id IS NULL AND NULLIF(v_line->>'item_id', '') IS NOT NULL THEN
            SELECT * INTO v_item FROM public.item_master WHERE id = (v_line->>'item_id')::UUID AND company_id = v_company_id;
            IF FOUND THEN
                v_line_name := COALESCE(v_line_name, v_item.name);
                IF v_move_type = 'out_invoice' AND v_item.income_account_id IS NOT NULL THEN
                    SELECT id INTO v_account_id
                    FROM public.accounting_chart_of_accounts
                    WHERE id = v_item.income_account_id AND company_id = v_company_id AND is_group = false;
                ELSIF v_move_type = 'in_invoice' AND v_item.expense_account_id IS NOT NULL THEN
                    SELECT id INTO v_account_id
                    FROM public.accounting_chart_of_accounts
                    WHERE id = v_item.expense_account_id AND company_id = v_company_id AND is_group = false;
                END IF;
            END IF;
        END IF;

        IF v_account_id IS NULL THEN
            IF v_move_type = 'out_invoice' THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id 
                  AND type = 'Income' 
                  AND is_group = false
                ORDER BY code ASC
                LIMIT 1;
            ELSIF v_move_type = 'in_invoice' THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id 
                  AND type = 'Expense' 
                  AND is_group = false
                ORDER BY code ASC
                LIMIT 1;
            END IF;
        END IF;

        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'No valid account could be determined for invoice/bill line %', COALESCE(v_line->>'description', 'item');
        END IF;

        v_line_name := COALESCE(NULLIF(v_line->>'description', ''), v_line_name, 'Line Item');

        -- Insert Line Item
        IF v_move_type = 'out_invoice' THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name,
                debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id,
                item_id, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_account_id, p_partner_id, v_line_name,
                0, v_line_qty * v_line_price,
                NULLIF(v_line->>'cost_center_id', '')::UUID, 
                NULLIF(v_line->>'project_cost_center_id', '')::UUID, 
                NULLIF(v_line->>'contract_cost_center_id', '')::UUID,
                NULLIF(v_line->>'item_id', '')::UUID,
                v_line_qty,
                v_line_price
            );
        ELSIF v_move_type = 'in_invoice' THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name,
                debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id,
                item_id, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_account_id, p_partner_id, v_line_name,
                v_line_qty * v_line_price, 0,
                NULLIF(v_line->>'cost_center_id', '')::UUID, 
                NULLIF(v_line->>'project_cost_center_id', '')::UUID, 
                NULLIF(v_line->>'contract_cost_center_id', '')::UUID,
                NULLIF(v_line->>'item_id', '')::UUID,
                v_line_qty,
                v_line_price
            );
        END IF;

        v_total_amount := v_total_amount + (v_line_qty * v_line_price);
    END LOOP;

    -- Balancing Line
    IF v_move_type = 'out_invoice' THEN
        INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, COALESCE(NULLIF(TRIM(p_reference), ''), 'Customer Invoice'),
            v_total_amount, 0
        );
    ELSIF v_move_type = 'in_invoice' THEN
         INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, COALESCE(NULLIF(TRIM(p_reference), ''), 'Vendor Bill'),
            0, v_total_amount
        );
    END IF;

    -- Update Header including manual reference, date (voucher date) and invoice_date (bill date)
    UPDATE public.accounting_journal_entries 
    SET partner_id = p_partner_id,
        journal_id = p_journal_id,
        date = p_date,
        invoice_date = COALESCE(p_invoice_date, invoice_date, p_date),
        due_date = p_due_date,
        amount_total = v_total_amount,
        reference = COALESCE(NULLIF(TRIM(p_reference), ''), reference)
    WHERE id = p_entry_id;

END;
$$;
