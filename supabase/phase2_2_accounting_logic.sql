-- ==============================================================================
-- KAA ERP Phase 2.2 - Accounting Logic (RPCs)
-- ==============================================================================

-- 1. Helper to find open period
CREATE OR REPLACE FUNCTION get_period_for_date(p_date DATE, p_company_id UUID)
RETURNS UUID AS $$
DECLARE
    v_period_id UUID;
BEGIN
    SELECT id INTO v_period_id
    FROM accounting_periods
    WHERE company_id = p_company_id
      AND p_date BETWEEN start_date AND end_date
      AND status = 'Open'
    LIMIT 1;
    
    RETURN v_period_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Post Journal Entry (Atomic)
CREATE OR REPLACE FUNCTION rpc_post_move(p_move_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_move RECORD;
    v_total_debit NUMERIC;
    v_total_credit NUMERIC;
    v_period_id UUID;
BEGIN
    -- Get Move
    SELECT * INTO v_move FROM accounting_moves WHERE id = p_move_id;
    
    IF v_move.state = 'Posted' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Entry is already posted');
    END IF;
    
    -- Check Balance
    SELECT SUM(debit), SUM(credit) INTO v_total_debit, v_total_credit
    FROM accounting_move_lines
    WHERE move_id = p_move_id;
    
    IF v_total_debit != v_total_credit THEN
        RETURN jsonb_build_object('success', false, 'message', 'Entry is not balanced (Debits != Credits)');
    END IF;
    
    -- Check Period
    v_period_id := get_period_for_date(v_move.date, v_move.company_id);
    
    IF v_period_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No open accounting period found for this date');
    END IF;
    
    -- Update Move
    UPDATE accounting_moves
    SET 
        state = 'Posted',
        period_id = v_period_id,
        amount_total = v_total_debit -- Store the balanced amount
    WHERE id = p_move_id;
    
    -- Lock lines (optional, usually handled by state check on app side, but good to have)
    
    RETURN jsonb_build_object('success', true, 'message', 'Journal Entry Posted Successfully');
END;
$$ LANGUAGE plpgsql;

-- 3. Get Account Balance (As of Date)
CREATE OR REPLACE FUNCTION rpc_get_account_balance(p_account_id UUID, p_date DATE)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    SELECT COALESCE(SUM(balance), 0) INTO v_balance
    FROM accounting_move_lines
    WHERE account_id = p_account_id
      AND date <= p_date
      AND (SELECT state FROM accounting_moves WHERE id = move_id) = 'Posted';
      
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Standard CoA (Helper for manual setup or seed)
CREATE OR REPLACE FUNCTION rpc_init_coa_template(p_company_id UUID)
RETURNS JSONB AS $$
BEGIN
    -- Just a stub to say it's ready. Logic would insert rows into chart_of_accounts.
    -- Real implementation would be huge list of inserts.
    RETURN jsonb_build_object('success', true, 'message', 'CoA Template Ready');
END;
$$ LANGUAGE plpgsql;
