-- Migration: 20260926140000_party_payment_invoice_settlement_and_aging.sql
-- Description:
-- 1. Updates rpc_post_accounting_payment to support party payment multi-line entries (invoice allocations against ref + additional bank charges/deductions) and automatically update amount_residual on allocated invoices.
-- 2. Updates rpc_get_accounting_partner_aging to accept optional p_company_id, match Sundry Debtors (1110) & Creditors (2010), and return partner_id for invoice drill-down.

-- ------------------------------------------------------------------------------
-- 1. rpc_post_accounting_payment with invoice residual settlement & charges
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_post_accounting_payment(p_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    v_inv_id UUID;
    v_inv_ref TEXT;
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
                WHERE company_id = v_company_id AND (subtype = 'Payable' OR name ILIKE '%creditor%' OR code IN ('2010', '2110')) AND is_active = true
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
                v_line_memo := COALESCE(NULLIF(v_elem->>'memo', ''), NULLIF(v_elem->>'notes', ''), v_line_name);
                v_line_entry_type := LOWER(COALESCE(v_elem->>'entry_type', 'debit'));

                -- Fallback account_id if omitted for partner allocation line
                IF v_line_acc_id IS NULL THEN
                    IF v_line_partner_id IS NOT NULL OR v_payment.partner_id IS NOT NULL THEN
                        SELECT property_account_payable_id INTO v_line_acc_id 
                        FROM public.accounting_partners 
                        WHERE id = COALESCE(v_line_partner_id, v_payment.partner_id);
                        IF v_line_acc_id IS NULL THEN
                            v_line_acc_id := v_counterpart_account_id;
                        END IF;
                    ELSE
                        v_line_acc_id := v_counterpart_account_id;
                    END IF;
                END IF;

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

                    -- Settle allocated invoice residual if invoice_id is provided
                    v_inv_id := public.safe_cast_uuid(v_elem->>'invoice_id');
                    IF v_inv_id IS NOT NULL THEN
                        UPDATE public.accounting_journal_entries
                        SET amount_residual = GREATEST(0, amount_residual - v_line_amount)
                        WHERE id = v_inv_id AND company_id = v_company_id;
                    ELSE
                        -- Fallback match by invoice_ref if provided
                        v_inv_ref := TRIM(COALESCE(v_elem->>'invoice_ref', ''));
                        IF v_inv_ref <> '' THEN
                            UPDATE public.accounting_journal_entries
                            SET amount_residual = GREATEST(0, amount_residual - v_line_amount)
                            WHERE reference = v_inv_ref AND company_id = v_company_id AND partner_id = COALESCE(v_line_partner_id, v_payment.partner_id);
                        END IF;
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
                v_line_memo := COALESCE(NULLIF(v_elem->>'memo', ''), NULLIF(v_elem->>'reference', ''), v_payment.name);

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
                v_line_memo := COALESCE(NULLIF(v_elem->>'memo', ''), NULLIF(v_elem->>'reference', ''), v_payment.name);

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
                v_line_memo := COALESCE(NULLIF(v_elem->>'memo', ''), NULLIF(v_elem->>'notes', ''), v_line_name);
                v_line_entry_type := LOWER(COALESCE(v_elem->>'entry_type', 'credit'));

                -- Fallback account_id if omitted for partner allocation line
                IF v_line_acc_id IS NULL THEN
                    IF v_line_partner_id IS NOT NULL OR v_payment.partner_id IS NOT NULL THEN
                        SELECT property_account_receivable_id INTO v_line_acc_id 
                        FROM public.accounting_partners 
                        WHERE id = COALESCE(v_line_partner_id, v_payment.partner_id);
                        IF v_line_acc_id IS NULL THEN
                            v_line_acc_id := v_counterpart_account_id;
                        END IF;
                    ELSE
                        v_line_acc_id := v_counterpart_account_id;
                    END IF;
                END IF;

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

                    -- Settle allocated invoice residual if invoice_id is provided
                    v_inv_id := public.safe_cast_uuid(v_elem->>'invoice_id');
                    IF v_inv_id IS NOT NULL THEN
                        UPDATE public.accounting_journal_entries
                        SET amount_residual = GREATEST(0, amount_residual - v_line_amount)
                        WHERE id = v_inv_id AND company_id = v_company_id;
                    ELSE
                        -- Fallback match by invoice_ref if provided
                        v_inv_ref := TRIM(COALESCE(v_elem->>'invoice_ref', ''));
                        IF v_inv_ref <> '' THEN
                            UPDATE public.accounting_journal_entries
                            SET amount_residual = GREATEST(0, amount_residual - v_line_amount)
                            WHERE reference = v_inv_ref AND company_id = v_company_id AND partner_id = COALESCE(v_line_partner_id, v_payment.partner_id);
                        END IF;
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
$function$;

REVOKE ALL ON FUNCTION public.rpc_post_accounting_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_post_accounting_payment(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. Enhanced rpc_get_accounting_partner_aging with company_id, Sundry accounts, and partner_id
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_accounting_partner_aging(
    p_partner_type text, 
    p_date date,
    p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := COALESCE(p_company_id, get_my_company_id());

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            p.id as partner_id,
            p.name as partner_name,
            p.reference_code,
            p.code as partner_code,
            SUM(CASE WHEN (p_date - COALESCE(e.invoice_date, e.date)) <= 0 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as current,
            SUM(CASE WHEN (p_date - COALESCE(e.invoice_date, e.date)) BETWEEN 1 AND 30 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_30,
            SUM(CASE WHEN (p_date - COALESCE(e.invoice_date, e.date)) BETWEEN 31 AND 60 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_60,
            SUM(CASE WHEN (p_date - COALESCE(e.invoice_date, e.date)) BETWEEN 61 AND 90 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_90,
            SUM(CASE WHEN (p_date - COALESCE(e.invoice_date, e.date)) > 90 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_90_plus,
            SUM(CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) as total_overdue
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_partners p ON p.id = e.partner_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND (
              (p_partner_type = 'Customer' AND (a.subtype = 'Receivable' OR a.code = '1110' OR a.name ILIKE '%debtor%'))
              OR
              (p_partner_type = 'Vendor' AND (a.subtype = 'Payable' OR a.code IN ('2010', '2110') OR a.name ILIKE '%creditor%'))
          )
          AND (p.partner_type IN (p_partner_type, 'Both') OR p.partner_type IS NULL)
        GROUP BY p.id, p.name, p.reference_code, p.code
        HAVING SUM(CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) != 0
        ORDER BY p.name
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_accounting_partner_aging(text, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_accounting_partner_aging(text, date, uuid) TO authenticated;
