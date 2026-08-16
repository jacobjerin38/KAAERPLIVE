-- Migration: 20260816_multiline_payments_upgrade.sql
-- Description: Additive support for multi-expense lines and multi-bank payment sources in accounting_payments
-- Live Data Safety: 100% Backward Compatible. Adds nullable JSONB columns. Preserves existing single-line records.

-- 1. Add additive JSONB columns for multi-expense and multi-bank lines
ALTER TABLE public.accounting_payments 
ADD COLUMN IF NOT EXISTS expense_lines JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS bank_lines JSONB DEFAULT '[]'::jsonb;

-- 2. Upgrade rpc_post_accounting_payment to support multi-line expense and multi-bank posting
CREATE OR REPLACE FUNCTION public.rpc_post_accounting_payment(p_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_payment RECORD;
    v_entry_id UUID;
    v_partner RECORD;
    v_journal RECORD;
    v_liquidity_account_id UUID; -- Default Bank/Cash Account
    v_counterpart_account_id UUID; -- Default AR/AP or Direct Expense Account
    v_company_id UUID;
    v_period_id UUID;
    v_period_status TEXT;
    v_line_name TEXT;
    
    -- Multi-line loop variables
    v_elem JSONB;
    v_line_acc_id UUID;
    v_line_partner_id UUID;
    v_line_journal_id UUID;
    v_line_liq_acc UUID;
    v_line_amount NUMERIC;
    v_line_memo TEXT;
    v_has_multi_expense BOOLEAN := false;
    v_has_multi_bank BOOLEAN := false;
BEGIN
    -- 1. Fetch Payment
    SELECT * INTO v_payment FROM public.accounting_payments WHERE id = p_payment_id;
    IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment record not found'; END IF;
    IF v_payment.state = 'posted' THEN RAISE EXCEPTION 'Payment already posted'; END IF;
    
    v_company_id := COALESCE(v_payment.company_id, get_my_company_id());

    -- Check if multi-lines exist
    IF v_payment.expense_lines IS NOT NULL AND jsonb_typeof(v_payment.expense_lines) = 'array' AND jsonb_array_length(v_payment.expense_lines) > 0 THEN
        v_has_multi_expense := true;
    END IF;

    IF v_payment.bank_lines IS NOT NULL AND jsonb_typeof(v_payment.bank_lines) = 'array' AND jsonb_array_length(v_payment.bank_lines) > 0 THEN
        v_has_multi_bank := true;
    END IF;

    -- 2. Fetch Primary Journal
    SELECT * INTO v_journal FROM public.accounting_journals WHERE id = COALESCE(v_payment.accounting_journal_id, v_payment.journal_id);
    
    IF v_journal.id IS NULL AND v_has_multi_bank THEN
        SELECT * INTO v_journal 
        FROM public.accounting_journals 
        WHERE id = (v_payment.bank_lines->0->>'journal_id')::uuid;
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
    
    IF v_journal.id IS NULL THEN RAISE EXCEPTION 'Journal not found for payment'; END IF;
    
    v_liquidity_account_id := v_journal.default_account_id;

    -- 3. Determine Counterpart Account (for single legacy fallback)
    IF v_payment.partner_id IS NOT NULL THEN
        SELECT * INTO v_partner FROM public.accounting_partners WHERE id = v_payment.partner_id;
    END IF;

    IF COALESCE(v_payment.payment_category, 'partner') = 'direct_account' AND v_payment.account_id IS NOT NULL THEN
        v_counterpart_account_id := v_payment.account_id;
    ELSIF v_payment.partner_id IS NOT NULL THEN
        IF v_payment.payment_type = 'inbound' THEN
            SELECT new_acc.id INTO v_counterpart_account_id
            FROM public.accounting_chart_of_accounts new_acc
            JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
            WHERE old_acc.id = v_partner.property_account_receivable_id AND new_acc.company_id = v_company_id;
            
            IF v_counterpart_account_id IS NULL THEN
                SELECT id INTO v_counterpart_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND subtype = 'Receivable' AND is_active = true
                LIMIT 1;
            END IF;
        ELSE
            SELECT new_acc.id INTO v_counterpart_account_id
            FROM public.accounting_chart_of_accounts new_acc
            JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
            WHERE old_acc.id = v_partner.property_account_payable_id AND new_acc.company_id = v_company_id;
            
            IF v_counterpart_account_id IS NULL THEN
                SELECT id INTO v_counterpart_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND subtype = 'Payable' AND is_active = true
                LIMIT 1;
            END IF;
        END IF;
    ELSIF v_payment.account_id IS NOT NULL THEN
        v_counterpart_account_id := v_payment.account_id;
    END IF;

    -- Validate Period
    SELECT id, status INTO v_period_id, v_period_status
    FROM public.accounting_periods
    WHERE company_id = v_company_id
      AND v_payment.date BETWEEN start_date AND end_date
    LIMIT 1;

    IF v_period_id IS NULL THEN
        SELECT id, status INTO v_period_id, v_period_status
        FROM public.accounting_periods
        WHERE company_id = v_company_id AND status != 'locked'
        ORDER BY start_date DESC
        LIMIT 1;
    END IF;

    IF v_period_status = 'locked' THEN
        RAISE EXCEPTION 'Cannot post to a locked accounting period';
    END IF;

    -- 4. Create Journal Entry Header
    INSERT INTO public.accounting_journal_entries (
        company_id, journal_id, date, partner_id, move_type, state, amount_total, reference, notes, period_id
    ) VALUES (
        v_company_id, v_journal.id, v_payment.date, v_payment.partner_id, 'entry', 'Posted', v_payment.amount, v_payment.name, v_payment.notes, v_period_id
    ) RETURNING id INTO v_entry_id;

    -- Description line name fallback
    IF COALESCE(v_payment.payment_category, 'partner') = 'direct_account' THEN
        SELECT name INTO v_line_name FROM public.accounting_chart_of_accounts WHERE id = v_counterpart_account_id;
        v_line_name := COALESCE(v_line_name, 'Direct Payment');
    ELSE
        v_line_name := CASE WHEN v_payment.payment_type = 'inbound' THEN 'Payment Received' ELSE 'Payment Sent' END;
    END IF;

    -- 5. Create Lines
    IF v_payment.payment_type = 'outbound' THEN
        -- MONEY OUT (Vendor / Expense Payment):
        
        -- 5A. DEBIT: Expense / Account Ledgers
        IF v_has_multi_expense THEN
            FOR v_elem IN SELECT * FROM jsonb_array_elements(v_payment.expense_lines)
            LOOP
                v_line_acc_id := NULLIF(v_elem->>'account_id', '')::uuid;
                v_line_partner_id := NULLIF(v_elem->>'partner_id', '')::uuid;
                v_line_amount := COALESCE((v_elem->>'amount')::numeric, 0);
                v_line_memo := COALESCE(NULLIF(v_elem->>'notes', ''), (SELECT name FROM public.accounting_chart_of_accounts WHERE id = v_line_acc_id), v_line_name);

                IF v_line_acc_id IS NOT NULL AND v_line_amount > 0 THEN
                    INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
                    VALUES (v_company_id, v_entry_id, v_line_acc_id, COALESCE(v_line_partner_id, v_payment.partner_id), v_line_memo, v_line_amount, 0);
                END IF;
            END LOOP;
        ELSE
            IF v_counterpart_account_id IS NULL THEN 
                RAISE EXCEPTION 'Missing counterpart account for payment. Please select a Partner or Account Ledger.'; 
            END IF;
            INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
            VALUES (v_company_id, v_entry_id, v_counterpart_account_id, v_payment.partner_id, v_line_name, v_payment.amount, 0);
        END IF;

        -- 5B. CREDIT: Bank / Cash Accounts (Liquidity)
        IF v_has_multi_bank THEN
            FOR v_elem IN SELECT * FROM jsonb_array_elements(v_payment.bank_lines)
            LOOP
                v_line_journal_id := NULLIF(v_elem->>'journal_id', '')::uuid;
                v_line_amount := COALESCE((v_elem->>'amount')::numeric, 0);
                v_line_memo := COALESCE(NULLIF(v_elem->>'reference', ''), NULLIF(v_elem->>'bank_name', ''), 'Bank Disbursement');

                SELECT default_account_id INTO v_line_liq_acc 
                FROM public.accounting_journals 
                WHERE id = v_line_journal_id;

                IF v_line_liq_acc IS NULL THEN
                    v_line_liq_acc := v_liquidity_account_id;
                END IF;

                IF v_line_liq_acc IS NOT NULL AND v_line_amount > 0 THEN
                    INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
                    VALUES (v_company_id, v_entry_id, v_line_liq_acc, v_payment.partner_id, v_line_memo, 0, v_line_amount);
                END IF;
            END LOOP;
        ELSE
            IF v_liquidity_account_id IS NULL THEN 
                RAISE EXCEPTION 'Journal % has no default account in the chart of accounts', v_journal.name; 
            END IF;
            INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
            VALUES (v_company_id, v_entry_id, v_liquidity_account_id, v_payment.partner_id, v_line_name, 0, v_payment.amount);
        END IF;

    ELSE
        -- MONEY IN (Customer Receipt / Revenue / Income):
        
        -- 5A. DEBIT: Bank / Cash Accounts (Liquidity)
        IF v_has_multi_bank THEN
            FOR v_elem IN SELECT * FROM jsonb_array_elements(v_payment.bank_lines)
            LOOP
                v_line_journal_id := NULLIF(v_elem->>'journal_id', '')::uuid;
                v_line_amount := COALESCE((v_elem->>'amount')::numeric, 0);
                v_line_memo := COALESCE(NULLIF(v_elem->>'reference', ''), NULLIF(v_elem->>'bank_name', ''), 'Bank Receipt');

                SELECT default_account_id INTO v_line_liq_acc 
                FROM public.accounting_journals 
                WHERE id = v_line_journal_id;

                IF v_line_liq_acc IS NULL THEN
                    v_line_liq_acc := v_liquidity_account_id;
                END IF;

                IF v_line_liq_acc IS NOT NULL AND v_line_amount > 0 THEN
                    INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
                    VALUES (v_company_id, v_entry_id, v_line_liq_acc, v_payment.partner_id, v_line_memo, v_line_amount, 0);
                END IF;
            END LOOP;
        ELSE
            IF v_liquidity_account_id IS NULL THEN 
                RAISE EXCEPTION 'Journal % has no default account in the chart of accounts', v_journal.name; 
            END IF;
            INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
            VALUES (v_company_id, v_entry_id, v_liquidity_account_id, v_payment.partner_id, v_line_name, v_payment.amount, 0);
        END IF;

        -- 5B. CREDIT: Counterpart / Revenue / Customer Account
        IF v_has_multi_expense THEN
            FOR v_elem IN SELECT * FROM jsonb_array_elements(v_payment.expense_lines)
            LOOP
                v_line_acc_id := NULLIF(v_elem->>'account_id', '')::uuid;
                v_line_partner_id := NULLIF(v_elem->>'partner_id', '')::uuid;
                v_line_amount := COALESCE((v_elem->>'amount')::numeric, 0);
                v_line_memo := COALESCE(NULLIF(v_elem->>'notes', ''), (SELECT name FROM public.accounting_chart_of_accounts WHERE id = v_line_acc_id), v_line_name);

                IF v_line_acc_id IS NOT NULL AND v_line_amount > 0 THEN
                    INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
                    VALUES (v_company_id, v_entry_id, v_line_acc_id, COALESCE(v_line_partner_id, v_payment.partner_id), v_line_memo, 0, v_line_amount);
                END IF;
            END LOOP;
        ELSE
            IF v_counterpart_account_id IS NULL THEN 
                RAISE EXCEPTION 'Missing counterpart account for payment. Please select a Partner or Account Ledger.'; 
            END IF;
            INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
            VALUES (v_company_id, v_entry_id, v_counterpart_account_id, v_payment.partner_id, v_line_name, 0, v_payment.amount);
        END IF;

    END IF;

    -- 6. Update Payment Record
    UPDATE public.accounting_payments 
    SET state = 'posted', 
        accounting_journal_id = v_journal.id,
        accounting_entry_id = v_entry_id 
    WHERE id = p_payment_id;

    RETURN v_entry_id;
END;
$function$;
