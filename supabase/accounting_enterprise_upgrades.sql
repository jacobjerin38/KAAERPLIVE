-- ==============================================================================
-- KAA ERP Advanced Accounting Enhancements
-- ==============================================================================

-- 1. Schema Updates
ALTER TABLE public.accounting_partners 
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0;

ALTER TABLE public.accounting_moves
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved'; -- Default approved for existing compatibility

-- 2. Trial Balance Function
CREATE OR REPLACE FUNCTION rpc_get_trial_balance(p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            a.code,
            a.name,
            a.type,
            SUM(l.debit) as total_debit,
            SUM(l.credit) as total_credit,
            SUM(l.debit - l.credit) as balance
        FROM accounting_move_lines l
        JOIN accounting_moves m ON m.id = l.move_id
        JOIN chart_of_accounts a ON a.id = l.account_id
        WHERE m.company_id = v_company_id
          AND m.state = 'Posted'
          AND m.date <= p_date
        GROUP BY a.code, a.name, a.type
        HAVING SUM(l.debit) != 0 OR SUM(l.credit) != 0
        ORDER BY a.code
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;

-- 3. Partner Aging Report Function
CREATE OR REPLACE FUNCTION rpc_get_partner_aging(p_partner_type TEXT, p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            p.name as partner_name,
            SUM(CASE WHEN (p_date - m.due_date) <= 0 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as current,
            SUM(CASE WHEN (p_date - m.due_date) BETWEEN 1 AND 30 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_30,
            SUM(CASE WHEN (p_date - m.due_date) BETWEEN 31 AND 60 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_60,
            SUM(CASE WHEN (p_date - m.due_date) BETWEEN 61 AND 90 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_90,
            SUM(CASE WHEN (p_date - m.due_date) > 90 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_90_plus,
            SUM(CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) as total_overdue
        FROM accounting_move_lines l
        JOIN accounting_moves m ON m.id = l.move_id
        JOIN accounting_partners p ON p.id = m.partner_id
        JOIN chart_of_accounts a ON a.id = l.account_id
        WHERE m.company_id = v_company_id
          AND m.state = 'Posted'
          AND m.date <= p_date
          AND a.subtype IN ('Receivable', 'Payable')
          AND p.partner_type IN (p_partner_type, 'Both')
        GROUP BY p.name
        HAVING SUM(CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) != 0
        ORDER BY p.name
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;

-- 4. Cash Book Function
CREATE OR REPLACE FUNCTION rpc_get_cash_book(p_start_date DATE, p_end_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            l.date,
            l.name as description,
            a.name as account_name,
            l.debit,
            l.credit,
            SUM(l.debit - l.credit) OVER (ORDER BY l.date, l.created_at) as running_balance
        FROM accounting_move_lines l
        JOIN accounting_moves m ON m.id = l.move_id
        JOIN chart_of_accounts a ON a.id = l.account_id
        WHERE m.company_id = v_company_id
          AND m.state = 'Posted'
          AND l.date BETWEEN p_start_date AND p_end_date
          AND a.subtype = 'Cash'
        ORDER BY l.date, l.created_at
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;

-- 5. Update Posting Logic to enforce Approvals
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

    -- Check Approval for Bills (in_invoice)
    IF v_move.move_type = 'in_invoice' AND v_move.approval_status != 'approved' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bill must be approved before posting');
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
    
    RETURN jsonb_build_object('success', true, 'message', 'Journal Entry Posted Successfully');
END;
$$ LANGUAGE plpgsql;
