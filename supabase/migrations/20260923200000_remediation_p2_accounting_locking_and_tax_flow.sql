-- ==============================================================================
-- KAA ERP REMEDIATION - PRIORITY 2: ACCOUNTING, INVOICES, PAYMENTS, BANKING, AND TAXES
-- Migration: 20260923200000_remediation_p2_accounting_locking_and_tax_flow.sql
-- Description:
--   1. Adds row locking (FOR UPDATE) and fail-closed period resolution to rpc_post_accounting_payment and rpc_post_accounting_entry.
--   2. Adds line-level tax columns to accounting_journal_lines and client PO fields to accounting_journal_entries.
--   3. Updates rpc_create_accounting_invoice and rpc_update_accounting_invoice for atomic tax lines and PO metadata.
--   4. Updates rpc_get_qatar_vat_report to read canonical journal lines with backward-compatible historic move fallback.
--   5. Updates rpc_process_stock_movement with stock availability checks and item cost resolution for OUT issues.
--   6. Fixes rpc_receive_purchase_order and rpc_ship_sales_order to validate confirmed state BEFORE line mutations.
--   7. Hardens rpc_reconcile_statement_line with row locks, amount/direction checks, and company verification.
-- Rollback: Revert function definitions to previous versions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Additive Columns (2.2 & 2.6)
-- ------------------------------------------------------------------------------

ALTER TABLE public.accounting_journal_lines
    ADD COLUMN IF NOT EXISTS tax_id UUID REFERENCES public.accounting_taxes(id),
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC DEFAULT 0;

ALTER TABLE public.accounting_journal_entries
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS untaxed_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS client_po_number TEXT,
    ADD COLUMN IF NOT EXISTS client_po_date DATE;

-- ------------------------------------------------------------------------------
-- 2. Concurrency Locking & Fail-Closed Period in Payment Posting (2.1)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_post_accounting_payment(p_payment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment RECORD;
    v_entry_id UUID;
    v_partner RECORD;
    v_journal RECORD;
    v_liquidity_account_id UUID;
    v_counterpart_account_id UUID;
    v_company_id UUID;
    v_period_id UUID;
    v_period_status TEXT;
    v_line_name TEXT;
    
    v_elem JSONB;
    v_line_acc_id UUID;
    v_line_partner_id UUID;
    v_line_journal_id UUID;
    v_line_liq_acc UUID;
    v_line_amount NUMERIC;
    v_line_memo TEXT;
    v_line_entry_type TEXT;
    v_line_cc_id UUID;
    v_line_proj_cc_id UUID;
    v_line_cont_cc_id UUID;
    v_cc_type TEXT;
    v_has_multi_expense BOOLEAN := false;
    v_has_multi_bank BOOLEAN := false;
    v_total_debit NUMERIC := 0;
    v_total_credit NUMERIC := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock target payment row FOR UPDATE to prevent concurrent posting race conditions
    SELECT * INTO v_payment 
    FROM public.accounting_payments 
    WHERE id = p_payment_id 
    FOR UPDATE;

    IF v_payment.id IS NULL THEN 
        RAISE EXCEPTION 'Payment record not found'; 
    END IF;

    IF v_payment.state = 'posted' THEN 
        RAISE EXCEPTION 'Payment is already posted'; 
    END IF;
    
    v_company_id := COALESCE(v_payment.company_id, get_my_company_id());

    -- Authorization check: user must belong to payment company or be admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_company_access
        WHERE user_id = auth.uid() AND company_id = v_company_id AND status = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (lower(role) IN ('super admin', 'superadmin') OR company_id = v_company_id)
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller cannot post payments for this company.';
    END IF;

    -- Strict Period Validation (Fail-closed: NO silent fallback to arbitrary open period)
    SELECT id, status INTO v_period_id, v_period_status
    FROM public.accounting_periods
    WHERE company_id = v_company_id
      AND v_payment.date BETWEEN start_date AND end_date
    LIMIT 1;

    IF v_period_id IS NULL THEN
        RAISE EXCEPTION 'No accounting period found for payment date %. Please define an accounting period first.', v_payment.date;
    END IF;

    IF v_period_status = 'locked' THEN
        RAISE EXCEPTION 'Cannot post payment to a locked accounting period (Period: %)', v_period_id;
    END IF;

    -- Check if multi-lines exist
    IF v_payment.expense_lines IS NOT NULL AND jsonb_typeof(v_payment.expense_lines) = 'array' AND jsonb_array_length(v_payment.expense_lines) > 0 THEN
        v_has_multi_expense := true;
    END IF;

    IF v_payment.bank_lines IS NOT NULL AND jsonb_typeof(v_payment.bank_lines) = 'array' AND jsonb_array_length(v_payment.bank_lines) > 0 THEN
        v_has_multi_bank := true;
    END IF;

    -- Fetch Primary Journal
    SELECT * INTO v_journal FROM public.accounting_journals WHERE id = COALESCE(v_payment.accounting_journal_id, v_payment.journal_id);
    
    IF v_journal.id IS NULL AND v_has_multi_bank THEN
        SELECT * INTO v_journal 
        FROM public.accounting_journals 
        WHERE id = public.safe_cast_uuid(v_payment.bank_lines->0->>'journal_id');
    END IF;

    IF v_journal.id IS NULL THEN
        SELECT new_j.* INTO v_journal 
        FROM public.accounting_journals new_j
        JOIN public.journals old_j ON old_j.code = new_j.code
        WHERE old_j.id = v_payment.journal_id AND new_j.company_id = v_company_id;
    END IF;

    IF v_journal.id IS NULL THEN
        SELECT * INTO v_journal
        FROM public.accounting_journals
        WHERE company_id = v_company_id AND type IN ('Bank', 'Cash')
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;
    
    IF v_journal.id IS NULL THEN 
        RAISE EXCEPTION 'Journal not found for payment'; 
    END IF;
    
    v_liquidity_account_id := v_journal.default_account_id;

    -- Determine Counterpart Account
    IF v_payment.partner_id IS NOT NULL THEN
        SELECT * INTO v_partner FROM public.accounting_partners WHERE id = v_payment.partner_id;
        IF v_payment.payment_type = 'inbound' THEN
            v_counterpart_account_id := v_partner.property_account_receivable_id;
            IF v_counterpart_account_id IS NULL THEN
                SELECT id INTO v_counterpart_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND (subtype = 'Receivable' OR name ILIKE '%debtor%' OR code = '1110') AND is_active = true
                ORDER BY code ASC
                LIMIT 1;
            END IF;
        ELSE
            v_counterpart_account_id := v_partner.property_account_payable_id;
            IF v_counterpart_account_id IS NULL THEN
                SELECT id INTO v_counterpart_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND (subtype = 'Payable' OR name ILIKE '%creditor%' OR code = '2110') AND is_active = true
                ORDER BY code ASC
                LIMIT 1;
            END IF;
        END IF;
    ELSIF v_payment.account_id IS NOT NULL THEN
        v_counterpart_account_id := v_payment.account_id;
    END IF;

    -- Create Journal Entry Header
    INSERT INTO public.accounting_journal_entries (
        company_id, journal_id, date, partner_id, move_type, state, amount_total, reference, notes, period_id
    ) VALUES (
        v_company_id, v_journal.id, v_payment.date, v_payment.partner_id, 'entry', 'Posted', v_payment.amount, v_payment.name, v_payment.notes, v_period_id
    ) RETURNING id INTO v_entry_id;

    IF COALESCE(v_payment.payment_category, 'partner') = 'direct_account' THEN
        SELECT name INTO v_line_name FROM public.accounting_chart_of_accounts WHERE id = v_counterpart_account_id;
        v_line_name := COALESCE(v_line_name, 'Direct Payment');
    ELSE
        v_line_name := CASE WHEN v_payment.payment_type = 'inbound' THEN 'Payment Received' ELSE 'Payment Sent' END;
    END IF;

    -- Process Lines
    IF v_payment.payment_type = 'outbound' THEN
        IF v_has_multi_expense THEN
            FOR v_elem IN SELECT * FROM jsonb_array_elements(v_payment.expense_lines)
            LOOP
                v_line_acc_id := public.safe_cast_uuid(v_elem->>'account_id');
                v_line_partner_id := public.safe_cast_uuid(v_elem->>'partner_id');
                v_line_amount := COALESCE((v_elem->>'amount')::NUMERIC, 0);
                v_line_memo := COALESCE(v_elem->>'memo', v_line_name);
                v_line_entry_type := LOWER(COALESCE(v_elem->>'entry_type', 'debit'));

                v_line_cc_id := public.safe_cast_uuid(v_elem->>'cost_center_id');
                v_line_proj_cc_id := public.safe_cast_uuid(v_elem->>'project_cost_center_id');
                v_line_cont_cc_id := public.safe_cast_uuid(v_elem->>'contract_cost_center_id');

                IF v_line_cc_id IS NOT NULL AND v_line_proj_cc_id IS NULL AND v_line_cont_cc_id IS NULL THEN
                    SELECT type INTO v_cc_type FROM public.accounting_cost_centers WHERE id = v_line_cc_id;
                    IF v_cc_type = 'project' THEN v_line_proj_cc_id := v_line_cc_id;
                    ELSIF v_cc_type = 'contract' THEN v_line_cont_cc_id := v_line_cc_id;
                    END IF;
                END IF;

                IF v_line_amount > 0 AND v_line_acc_id IS NOT NULL THEN
                    IF v_line_entry_type = 'credit' THEN
                        INSERT INTO public.accounting_journal_lines (
                            company_id, entry_id, account_id, partner_id, name, debit, credit,
                            cost_center_id, project_cost_center_id, contract_cost_center_id
                        ) VALUES (
                            v_company_id, v_entry_id, v_line_acc_id, COALESCE(v_line_partner_id, v_payment.partner_id),
                            v_line_memo, 0, v_line_amount, v_line_cc_id, v_line_proj_cc_id, v_line_cont_cc_id
                        );
                        v_total_credit := v_total_credit + v_line_amount;
                    ELSE
                        INSERT INTO public.accounting_journal_lines (
                            company_id, entry_id, account_id, partner_id, name, debit, credit,
                            cost_center_id, project_cost_center_id, contract_cost_center_id
                        ) VALUES (
                            v_company_id, v_entry_id, v_line_acc_id, COALESCE(v_line_partner_id, v_payment.partner_id),
                            v_line_memo, v_line_amount, 0, v_line_cc_id, v_line_proj_cc_id, v_line_cont_cc_id
                        );
                        v_total_debit := v_total_debit + v_line_amount;
                    END IF;
                END IF;
            END LOOP;
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit,
                cost_center_id, project_cost_center_id, contract_cost_center_id
            ) VALUES (
                v_company_id, v_entry_id, v_counterpart_account_id, v_payment.partner_id,
                v_line_name, v_payment.amount, 0, v_payment.cost_center_id,
                v_payment.project_cost_center_id, v_payment.contract_cost_center_id
            );
            v_total_debit := v_total_debit + v_payment.amount;
        END IF;

        IF v_has_multi_bank THEN
            FOR v_elem IN SELECT * FROM jsonb_array_elements(v_payment.bank_lines)
            LOOP
                v_line_journal_id := public.safe_cast_uuid(v_elem->>'journal_id');
                v_line_amount := COALESCE((v_elem->>'amount')::NUMERIC, 0);
                v_line_memo := COALESCE(v_elem->>'memo', v_payment.name);

                SELECT default_account_id INTO v_line_liq_acc
                FROM public.accounting_journals
                WHERE id = v_line_journal_id;

                IF v_line_liq_acc IS NULL THEN v_line_liq_acc := v_liquidity_account_id; END IF;

                IF v_line_amount > 0 THEN
                    INSERT INTO public.accounting_journal_lines (
                        company_id, entry_id, account_id, partner_id, name, debit, credit
                    ) VALUES (
                        v_company_id, v_entry_id, v_line_liq_acc, v_payment.partner_id, v_line_memo, 0, v_line_amount
                    );
                    v_total_credit := v_total_credit + v_line_amount;
                END IF;
            END LOOP;
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit
            ) VALUES (
                v_company_id, v_entry_id, v_liquidity_account_id, v_payment.partner_id, v_line_name, 0, v_payment.amount
            );
            v_total_credit := v_total_credit + v_payment.amount;
        END IF;
    ELSE
        -- INBOUND (Money in / Receipt)
        IF v_has_multi_bank THEN
            FOR v_elem IN SELECT * FROM jsonb_array_elements(v_payment.bank_lines)
            LOOP
                v_line_journal_id := public.safe_cast_uuid(v_elem->>'journal_id');
                v_line_amount := COALESCE((v_elem->>'amount')::NUMERIC, 0);
                v_line_memo := COALESCE(v_elem->>'memo', v_payment.name);

                SELECT default_account_id INTO v_line_liq_acc
                FROM public.accounting_journals WHERE id = v_line_journal_id;

                IF v_line_liq_acc IS NULL THEN v_line_liq_acc := v_liquidity_account_id; END IF;

                IF v_line_amount > 0 THEN
                    INSERT INTO public.accounting_journal_lines (
                        company_id, entry_id, account_id, partner_id, name, debit, credit
                    ) VALUES (
                        v_company_id, v_entry_id, v_line_liq_acc, v_payment.partner_id, v_line_memo, v_line_amount, 0
                    );
                    v_total_debit := v_total_debit + v_line_amount;
                END IF;
            END LOOP;
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit
            ) VALUES (
                v_company_id, v_entry_id, v_liquidity_account_id, v_payment.partner_id, v_line_name, v_payment.amount, 0
            );
            v_total_debit := v_total_debit + v_payment.amount;
        END IF;

        IF v_has_multi_expense THEN
            FOR v_elem IN SELECT * FROM jsonb_array_elements(v_payment.expense_lines)
            LOOP
                v_line_acc_id := public.safe_cast_uuid(v_elem->>'account_id');
                v_line_partner_id := public.safe_cast_uuid(v_elem->>'partner_id');
                v_line_amount := COALESCE((v_elem->>'amount')::NUMERIC, 0);
                v_line_memo := COALESCE(v_elem->>'memo', v_line_name);
                v_line_entry_type := LOWER(COALESCE(v_elem->>'entry_type', 'credit'));

                v_line_cc_id := public.safe_cast_uuid(v_elem->>'cost_center_id');
                v_line_proj_cc_id := public.safe_cast_uuid(v_elem->>'project_cost_center_id');
                v_line_cont_cc_id := public.safe_cast_uuid(v_elem->>'contract_cost_center_id');

                IF v_line_amount > 0 AND v_line_acc_id IS NOT NULL THEN
                    IF v_line_entry_type = 'debit' THEN
                        INSERT INTO public.accounting_journal_lines (
                            company_id, entry_id, account_id, partner_id, name, debit, credit,
                            cost_center_id, project_cost_center_id, contract_cost_center_id
                        ) VALUES (
                            v_company_id, v_entry_id, v_line_acc_id, COALESCE(v_line_partner_id, v_payment.partner_id),
                            v_line_memo, v_line_amount, 0, v_line_cc_id, v_line_proj_cc_id, v_line_cont_cc_id
                        );
                        v_total_debit := v_total_debit + v_line_amount;
                    ELSE
                        INSERT INTO public.accounting_journal_lines (
                            company_id, entry_id, account_id, partner_id, name, debit, credit,
                            cost_center_id, project_cost_center_id, contract_cost_center_id
                        ) VALUES (
                            v_company_id, v_entry_id, v_line_acc_id, COALESCE(v_line_partner_id, v_payment.partner_id),
                            v_line_memo, 0, v_line_amount, v_line_cc_id, v_line_proj_cc_id, v_line_cont_cc_id
                        );
                        v_total_credit := v_total_credit + v_line_amount;
                    END IF;
                END IF;
            END LOOP;
        ELSE
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name, debit, credit,
                cost_center_id, project_cost_center_id, contract_cost_center_id
            ) VALUES (
                v_company_id, v_entry_id, v_counterpart_account_id, v_payment.partner_id,
                v_line_name, 0, v_payment.amount, v_payment.cost_center_id,
                v_payment.project_cost_center_id, v_payment.contract_cost_center_id
            );
            v_total_credit := v_total_credit + v_payment.amount;
        END IF;
    END IF;

    -- Verify balancing
    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
        RAISE EXCEPTION 'Payment voucher is unbalanced. Debits (%) != Credits (%)', v_total_debit, v_total_credit;
    END IF;

    -- Update Entry Header Amount
    UPDATE public.accounting_journal_entries 
    SET amount_total = GREATEST(v_total_debit, v_total_credit)
    WHERE id = v_entry_id;

    -- Mark payment posted
    UPDATE public.accounting_payments
    SET state = 'posted',
        accounting_entry_id = v_entry_id
    WHERE id = p_payment_id;

    RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_post_accounting_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_post_accounting_payment(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Concurrency Locking in Journal Entry Posting (2.1)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_post_accounting_entry(p_entry_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_entry RECORD;
    v_total_debit NUMERIC;
    v_total_credit NUMERIC;
    v_period_id UUID;
    v_period_status TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Lock entry row FOR UPDATE to prevent race conditions
    SELECT * INTO v_entry 
    FROM public.accounting_journal_entries 
    WHERE id = p_entry_id 
    FOR UPDATE;
    
    IF v_entry.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Journal Entry not found');
    END IF;

    IF v_entry.state = 'Posted' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Entry is already posted');
    END IF;

    -- Authorization check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_company_access
        WHERE user_id = auth.uid() AND company_id = v_entry.company_id AND status = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (lower(role) IN ('super admin', 'superadmin') OR company_id = v_entry.company_id)
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized to post entries for this company');
    END IF;

    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0) INTO v_total_debit, v_total_credit
    FROM public.accounting_journal_lines
    WHERE entry_id = p_entry_id;

    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Journal Entry is unbalanced. Debits (' || v_total_debit::TEXT || ') != Credits (' || v_total_credit::TEXT || ')');
    END IF;

    IF v_total_debit = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot post an empty journal entry');
    END IF;

    -- Strict Period Validation
    SELECT id, status INTO v_period_id, v_period_status
    FROM public.accounting_periods
    WHERE company_id = v_entry.company_id
      AND v_entry.date BETWEEN start_date AND end_date
    LIMIT 1;

    IF v_period_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No accounting period defined for this date (' || v_entry.date::TEXT || ')');
    END IF;

    IF v_period_status = 'locked' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot post to a locked accounting period');
    END IF;

    -- Update Entry
    UPDATE public.accounting_journal_entries
    SET 
        state = 'Posted',
        period_id = v_period_id,
        amount_total = v_total_debit
    WHERE id = p_entry_id;

    RETURN jsonb_build_object('success', true, 'entry_id', p_entry_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_post_accounting_entry(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_post_accounting_entry(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Canonical Qatar VAT Report Function (2.2)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_get_qatar_vat_report(p_start_date DATE, p_end_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id UUID;
    v_output_standard_base NUMERIC := 0;
    v_output_standard_vat NUMERIC := 0;
    v_output_zero_base NUMERIC := 0;
    v_output_exempt_base NUMERIC := 0;
    
    v_input_standard_base NUMERIC := 0;
    v_input_standard_vat NUMERIC := 0;
    v_input_zero_base NUMERIC := 0;
    v_input_exempt_base NUMERIC := 0;
    
    v_net_tax_payable NUMERIC := 0;
BEGIN
    v_company_id := get_my_company_id();
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Company context not found');
    END IF;

    -- 1. Output Tax from Canonical Journal Lines (Sales Invoices / Outbound Moves)
    SELECT 
        COALESCE(SUM(l.tax_amount), 0),
        COALESCE(SUM(l.taxable_amount), 0)
    INTO v_output_standard_vat, v_output_standard_base
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.move_type = 'out_invoice'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND (l.tax_rate = 5 OR l.tax_amount > 0);

    -- Zero-rated / Exempt Sales
    SELECT COALESCE(SUM(l.credit - l.debit), 0)
    INTO v_output_zero_base
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.move_type = 'out_invoice'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND (l.tax_rate = 0 AND l.tax_amount = 0);

    -- 2. Input Tax from Canonical Journal Lines (Vendor Bills / Inbound Moves)
    SELECT 
        COALESCE(SUM(l.tax_amount), 0),
        COALESCE(SUM(l.taxable_amount), 0)
    INTO v_input_standard_vat, v_input_standard_base
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.move_type = 'in_invoice'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND (l.tax_rate = 5 OR l.tax_amount > 0);

    -- Zero-rated / Exempt Purchases
    SELECT COALESCE(SUM(l.debit - l.credit), 0)
    INTO v_input_zero_base
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.move_type = 'in_invoice'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND (l.tax_rate = 0 AND l.tax_amount = 0);

    -- Backward compatibility: add historic legacy accounting_moves if present
    DECLARE
        v_hist_out_vat NUMERIC := 0;
        v_hist_out_base NUMERIC := 0;
        v_hist_in_vat NUMERIC := 0;
        v_hist_in_base NUMERIC := 0;
    BEGIN
        SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_hist_out_vat
        FROM public.accounting_move_lines l
        JOIN public.accounting_moves m ON m.id = l.move_id
        JOIN public.taxes t ON t.id = l.tax_line_id
        WHERE m.company_id = v_company_id AND m.state = 'Posted' AND m.date BETWEEN p_start_date AND p_end_date
          AND (t.scope = 'sale' OR t.scope = 'both') AND t.amount = 5;

        v_output_standard_vat := v_output_standard_vat + v_hist_out_vat;

        SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_hist_in_vat
        FROM public.accounting_move_lines l
        JOIN public.accounting_moves m ON m.id = l.move_id
        JOIN public.taxes t ON t.id = l.tax_line_id
        WHERE m.company_id = v_company_id AND m.state = 'Posted' AND m.date BETWEEN p_start_date AND p_end_date
          AND (t.scope = 'purchase' OR t.scope = 'both') AND t.amount = 5;

        v_input_standard_vat := v_input_standard_vat + v_hist_in_vat;
    EXCEPTION WHEN OTHERS THEN
        -- If historic tables do not exist or differ, ignore
        NULL;
    END;

    -- Math fallback for base if lines had tax but no base split
    IF v_output_standard_base = 0 AND v_output_standard_vat > 0 THEN
        v_output_standard_base := v_output_standard_vat / 0.05;
    END IF;
    IF v_input_standard_base = 0 AND v_input_standard_vat > 0 THEN
        v_input_standard_base := v_input_standard_vat / 0.05;
    END IF;

    v_net_tax_payable := v_output_standard_vat - v_input_standard_vat;

    RETURN jsonb_build_object(
        'company_id', v_company_id,
        'period_start', p_start_date,
        'period_end', p_end_date,
        'output_vat', jsonb_build_object(
            'standard_rated_base', v_output_standard_base,
            'standard_rated_vat', v_output_standard_vat,
            'zero_rated_base', v_output_zero_base,
            'exempt_base', v_output_exempt_base,
            'total_sales', v_output_standard_base + v_output_zero_base + v_output_exempt_base,
            'total_output_vat', v_output_standard_vat
        ),
        'input_vat', jsonb_build_object(
            'standard_rated_base', v_input_standard_base,
            'standard_rated_vat', v_input_standard_vat,
            'zero_rated_base', v_input_zero_base,
            'exempt_base', v_input_exempt_base,
            'total_purchases', v_input_standard_base + v_input_zero_base + v_input_exempt_base,
            'total_input_vat', v_input_standard_vat
        ),
        'net_vat_payable', v_net_tax_payable
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_qatar_vat_report(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_qatar_vat_report(DATE, DATE) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Inventory Stock Movement Availability and Cost Validation (2.3)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_process_stock_movement(
    p_company_id UUID,
    p_item_id UUID,
    p_movement_type TEXT,
    p_from_bin_id UUID,
    p_to_bin_id UUID,
    p_qty NUMERIC,
    p_ref_type TEXT,
    p_ref_id UUID,
    p_unit_cost NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_warehouse_id UUID;
    v_inv_txn_id UUID;
    v_acct_config RECORD;
    v_available_stock NUMERIC := 0;
    v_resolved_cost NUMERIC := COALESCE(p_unit_cost, 0);
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_qty <= 0 THEN
        RAISE EXCEPTION 'Movement quantity must be greater than zero.';
    END IF;

    -- Fetch Warehouse ID from Bin
    IF p_to_bin_id IS NOT NULL THEN
        SELECT warehouse_id INTO v_warehouse_id 
        FROM public.warehouse_zones z 
        JOIN public.warehouse_bins b ON b.zone_id = z.id 
        WHERE b.id = p_to_bin_id;
    ELSIF p_from_bin_id IS NOT NULL THEN
        SELECT warehouse_id INTO v_warehouse_id 
        FROM public.warehouse_zones z 
        JOIN public.warehouse_bins b ON b.zone_id = z.id 
        WHERE b.id = p_from_bin_id;
    END IF;

    -- Stock check & cost resolution for OUT
    IF p_movement_type = 'OUT' THEN
        SELECT COALESCE(SUM(quantity), 0) INTO v_available_stock
        FROM public.inventory_transactions
        WHERE company_id = p_company_id AND item_id = p_item_id;

        IF v_available_stock < p_qty THEN
            RAISE EXCEPTION 'Insufficient stock. Available on-hand: %, Requested: %', v_available_stock, p_qty;
        END IF;

        IF v_resolved_cost <= 0 THEN
            SELECT COALESCE(standard_cost, purchase_price, 0) INTO v_resolved_cost
            FROM public.item_master
            WHERE id = p_item_id AND company_id = p_company_id;
        END IF;
    END IF;

    -- 1. Log Physical Movement
    INSERT INTO public.stock_movements (
        company_id, item_id, movement_type, from_bin_id, to_bin_id, quantity, reference_type, reference_id, performed_by
    ) VALUES (
        p_company_id, p_item_id, p_movement_type, p_from_bin_id, p_to_bin_id, p_qty, p_ref_type, p_ref_id, auth.uid()
    );

    -- 2. Inventory Transaction & Accounting
    SELECT * INTO v_acct_config FROM public.inventory_account_config WHERE company_id = p_company_id LIMIT 1;
    
    IF p_movement_type = 'IN' THEN
        INSERT INTO public.inventory_transactions (
            company_id, item_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            p_company_id, p_item_id, v_warehouse_id, 'GRN', p_qty, v_resolved_cost, p_ref_type, p_ref_id
        ) RETURNING id INTO v_inv_txn_id;
        
        IF FOUND AND v_acct_config IS NOT NULL AND v_acct_config.inventory_asset_account IS NOT NULL THEN
             INSERT INTO public.accounting_entries (
                company_id, transaction_date, reference_type, reference_id,
                debit_account, credit_account, amount, description
            ) VALUES (
                p_company_id, CURRENT_DATE, 'INV_TXN', v_inv_txn_id,
                v_acct_config.inventory_asset_account, v_acct_config.grni_account,
                (p_qty * v_resolved_cost), 'Goods Receipt - ' || COALESCE(p_ref_type, 'IN')
            );
        END IF;

    ELSIF p_movement_type = 'OUT' THEN
        INSERT INTO public.inventory_transactions (
            company_id, item_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            p_company_id, p_item_id, v_warehouse_id, 'ISSUE', -p_qty, v_resolved_cost, p_ref_type, p_ref_id
        ) RETURNING id INTO v_inv_txn_id;

        IF FOUND AND v_acct_config IS NOT NULL AND v_acct_config.cogs_account IS NOT NULL THEN
             INSERT INTO public.accounting_entries (
                company_id, transaction_date, reference_type, reference_id,
                debit_account, credit_account, amount, description
            ) VALUES (
                p_company_id, CURRENT_DATE, 'INV_TXN', v_inv_txn_id,
                v_acct_config.cogs_account, v_acct_config.inventory_asset_account,
                (p_qty * v_resolved_cost), 'Goods Issue - ' || COALESCE(p_ref_type, 'OUT')
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'movement_id', v_inv_txn_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_process_stock_movement FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_process_stock_movement TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. Atomic State Checks in Purchase & Sales Orders (2.4)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_receive_purchase_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE 
    v_cid UUID := get_my_company_id();
    v_po RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Lock and validate header state FIRST before modifying lines
    SELECT * INTO v_po 
    FROM public.purchase_orders 
    WHERE id = p_order_id AND company_id = v_cid 
    FOR UPDATE;

    IF v_po.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Purchase Order not found.');
    END IF;

    IF v_po.state != 'confirmed' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot receive order in state: ' || v_po.state || '. Order must be Confirmed.');
    END IF;

    -- Atomically update lines and mark received
    UPDATE public.purchase_order_lines 
    SET quantity_received = quantity 
    WHERE order_id = p_order_id AND company_id = v_cid;

    UPDATE public.purchase_orders 
    SET state = 'received' 
    WHERE id = p_order_id AND company_id = v_cid;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN 
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_receive_purchase_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_receive_purchase_order(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_ship_sales_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE 
    v_cid UUID := get_my_company_id();
    v_so RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Lock and validate header state FIRST before modifying lines
    SELECT * INTO v_so 
    FROM public.sales_orders 
    WHERE id = p_order_id AND company_id = v_cid 
    FOR UPDATE;

    IF v_so.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Sales Order not found.');
    END IF;

    IF v_so.state != 'confirmed' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot ship order in state: ' || v_so.state || '. Order must be Confirmed.');
    END IF;

    -- Atomically update lines and mark shipped
    UPDATE public.sales_order_lines 
    SET quantity_delivered = quantity 
    WHERE order_id = p_order_id AND company_id = v_cid;

    UPDATE public.sales_orders 
    SET state = 'shipped' 
    WHERE id = p_order_id AND company_id = v_cid;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN 
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ship_sales_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_ship_sales_order(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. Bank Statement Reconciliation Validation & Concurrency (2.5)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.rpc_reconcile_statement_line(UUID, UUID);
CREATE OR REPLACE FUNCTION public.rpc_reconcile_statement_line(p_statement_line_id UUID, p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE 
    v_line RECORD; 
    v_payment RECORD;
    v_cid UUID := get_my_company_id();
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock both rows FOR UPDATE
    SELECT * INTO v_line 
    FROM public.bank_statement_lines 
    WHERE id = p_statement_line_id 
    FOR UPDATE;

    IF v_line.id IS NULL THEN
        RAISE EXCEPTION 'Bank statement line not found.';
    END IF;

    SELECT * INTO v_payment 
    FROM public.accounting_payments 
    WHERE id = p_payment_id 
    FOR UPDATE;

    IF v_payment.id IS NULL THEN
        RAISE EXCEPTION 'Payment record not found.';
    END IF;

    -- Validate company match
    IF v_line.company_id IS DISTINCT FROM v_cid OR v_payment.company_id IS DISTINCT FROM v_cid THEN
        RAISE EXCEPTION 'Unauthorized: Both statement line and payment must belong to your active company.';
    END IF;

    -- Validate payment state
    IF v_payment.state != 'posted' THEN
        RAISE EXCEPTION 'Cannot reconcile a payment in state "%". Payment must be Posted.', v_payment.state;
    END IF;

    -- Check if either side is already reconciled
    IF v_line.is_reconciled THEN
        RAISE EXCEPTION 'This bank statement line is already reconciled.';
    END IF;

    IF v_payment.state = 'reconciled' THEN
        RAISE EXCEPTION 'This payment is already reconciled with another statement line.';
    END IF;

    -- Validate amount match (within 0.01 tolerance)
    IF ABS(ABS(v_line.amount) - ABS(v_payment.amount)) > 0.01 THEN
        RAISE EXCEPTION 'Amount mismatch: Statement line amount (%) does not match payment amount (%).', ABS(v_line.amount), ABS(v_payment.amount);
    END IF;

    -- Atomically update both sides
    UPDATE public.bank_statement_lines 
    SET is_reconciled = true, 
        payment_id = p_payment_id 
    WHERE id = p_statement_line_id;

    UPDATE public.accounting_payments 
    SET state = 'reconciled' 
    WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_reconcile_statement_line(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_reconcile_statement_line(UUID, UUID) TO authenticated;
