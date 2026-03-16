-- ==============================================================================
-- KAA ERP Phase 2.4 - Payments Logic
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Post Payment (Generates Journal Entry)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_post_payment(
    p_payment_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment RECORD;
    v_move_id UUID;
    v_partner RECORD;
    v_journal RECORD;
    v_liquidity_account_id UUID; -- Bank/Cash Account
    v_counterpart_account_id UUID; -- AR/AP Account
    v_company_id UUID;
BEGIN
    v_company_id := get_my_company_id();
    
    -- 1. Fetch Payment
    SELECT * INTO v_payment FROM accounting_payments WHERE id = p_payment_id;
    IF v_payment.state = 'posted' THEN RAISE EXCEPTION 'Payment already posted'; END IF;

    -- 2. Fetch Partner & Journal
    SELECT * INTO v_partner FROM accounting_partners WHERE id = v_payment.partner_id;
    SELECT * INTO v_journal FROM journals WHERE id = v_payment.journal_id;
    
    v_liquidity_account_id := v_journal.default_account_id;
    IF v_liquidity_account_id IS NULL THEN RAISE EXCEPTION 'Journal % has no default account', v_journal.name; END IF;

    -- 3. Determine Counterpart Account (AR/AP)
    IF v_payment.payment_type = 'inbound' THEN
        v_counterpart_account_id := v_partner.property_account_receivable_id;
    ELSE
        v_counterpart_account_id := v_partner.property_account_payable_id;
    END IF;
    
    IF v_counterpart_account_id IS NULL THEN RAISE EXCEPTION 'Partner % missing AR/AP account', v_partner.name; END IF;

    -- 4. Create Journal Entry Header
    INSERT INTO accounting_moves (
        company_id, journal_id, date, partner_id, move_type, state, amount_total, reference, notes
    ) VALUES (
        v_company_id, v_payment.journal_id, v_payment.date, v_payment.partner_id, 'entry', 'Posted', v_payment.amount, v_payment.name, v_payment.notes
    ) RETURNING id INTO v_move_id;

    -- 5. Create Lines
    IF v_payment.payment_type = 'inbound' THEN
        -- Customer Pays Us:
        -- Dr Bank (Liquidity)
        INSERT INTO accounting_move_lines (move_id, journal_id, date, account_id, partner_id, name, debit, credit)
        VALUES (v_move_id, v_payment.journal_id, v_payment.date, v_liquidity_account_id, v_payment.partner_id, 'Payment Received', v_payment.amount, 0);
        
        -- Cr AR (Counterpart)
        INSERT INTO accounting_move_lines (move_id, journal_id, date, account_id, partner_id, name, debit, credit)
        VALUES (v_move_id, v_payment.journal_id, v_payment.date, v_counterpart_account_id, v_payment.partner_id, 'Payment Received', 0, v_payment.amount);
        
    ELSE
        -- We Pay Vendor:
        -- Dr AP (Counterpart)
        INSERT INTO accounting_move_lines (move_id, journal_id, date, account_id, partner_id, name, debit, credit)
        VALUES (v_move_id, v_payment.journal_id, v_payment.date, v_counterpart_account_id, v_payment.partner_id, 'Payment Sent', v_payment.amount, 0);

        -- Cr Bank (Liquidity)
        INSERT INTO accounting_move_lines (move_id, journal_id, date, account_id, partner_id, name, debit, credit)
        VALUES (v_move_id, v_payment.journal_id, v_payment.date, v_liquidity_account_id, v_payment.partner_id, 'Payment Sent', 0, v_payment.amount);
    END IF;

    -- 6. Update Payment Record
    UPDATE accounting_payments 
    SET state = 'posted', move_id = v_move_id 
    WHERE id = p_payment_id;

    RETURN v_move_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- Reconcile Statement Line
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_reconcile_statement_line(
    p_statement_line_id UUID,
    p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_line RECORD;
    v_payment RECORD;
BEGIN
    -- 1. Fetch Line & Payment
    SELECT * INTO v_line FROM bank_statement_lines WHERE id = p_statement_line_id;
    SELECT * INTO v_payment FROM accounting_payments WHERE id = p_payment_id;
    
    IF v_line.is_reconciled THEN RAISE EXCEPTION 'Line already reconciled'; END IF;
    IF v_payment.state = 'reconciled' THEN RAISE EXCEPTION 'Payment already reconciled'; END IF;
    
    -- 2. Validation (Optional: Check amounts match)
    IF v_line.amount != v_payment.amount THEN 
        -- In future, allow partial match or write-off
        RAISE NOTICE 'Amounts do not match exactly: % vs %', v_line.amount, v_payment.amount;
    END IF;

    -- 3. Link Them
    UPDATE bank_statement_lines 
    SET is_reconciled = true, payment_id = p_payment_id
    WHERE id = p_statement_line_id;
    
    UPDATE accounting_payments
    SET state = 'reconciled'
    WHERE id = p_payment_id;
END;
$$;
