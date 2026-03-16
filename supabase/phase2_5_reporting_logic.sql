-- ==============================================================================
-- KAA ERP Phase 2.5 - Financial Reporting Logic
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. GET BALANCE SHEET
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_get_balance_sheet(
    p_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_assets JSON;
    v_liabilities JSON;
    v_equity JSON;
    v_current_year_earnings NUMERIC;
BEGIN
    v_company_id := get_my_company_id();

    -- 1. Calculate Current Year Earnings (Net Profit/Loss up to p_date)
    -- This is Revenue - Expenses. (Credit - Debit).
    -- If Credit > Debit, it's Profit (Positive).
    SELECT COALESCE(SUM(l.credit - l.debit), 0)
    INTO v_current_year_earnings
    FROM accounting_move_lines l
    JOIN accounting_moves m ON m.id = l.move_id
    JOIN chart_of_accounts a ON a.id = l.account_id
    WHERE m.company_id = v_company_id
      AND m.state = 'posted'
      AND m.date <= p_date
      AND a.type IN ('Income', 'Expense');

    -- 2. Assets (Debit - Credit)
    SELECT json_agg(t) INTO v_assets FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM accounting_move_lines l
        JOIN accounting_moves m ON m.id = l.move_id
        JOIN chart_of_accounts a ON a.id = l.account_id
        WHERE m.company_id = v_company_id
          AND m.state = 'posted'
          AND m.date <= p_date
          AND a.type = 'Asset'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    -- 3. Liabilities (Credit - Debit)
    SELECT json_agg(t) INTO v_liabilities FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM accounting_move_lines l
        JOIN accounting_moves m ON m.id = l.move_id
        JOIN chart_of_accounts a ON a.id = l.account_id
        WHERE m.company_id = v_company_id
          AND m.state = 'posted'
          AND m.date <= p_date
          AND a.type = 'Liability'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- 4. Equity (Credit - Debit)
    -- Must include calculated Current Year Earnings
    SELECT json_agg(t) INTO v_equity FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM accounting_move_lines l
        JOIN accounting_moves m ON m.id = l.move_id
        JOIN chart_of_accounts a ON a.id = l.account_id
        WHERE m.company_id = v_company_id
          AND m.state = 'posted'
          AND m.date <= p_date
          AND a.type = 'Equity'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        
        UNION ALL
        
        -- Add Dynamic Current Year Earnings Line
        SELECT 
            '999999' as code, 
            'Current Year Earnings' as name, 
            'Retained Earnings' as subtype, 
            v_current_year_earnings as balance
        WHERE v_current_year_earnings != 0
        
        ORDER BY code
    ) t;

    RETURN json_build_object(
        'date', p_date,
        'assets', COALESCE(v_assets, '[]'::json),
        'liabilities', COALESCE(v_liabilities, '[]'::json),
        'equity', COALESCE(v_equity, '[]'::json)
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. GET PROFIT & LOSS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_get_profit_loss(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_income JSON;
    v_expense JSON;
    v_net_profit NUMERIC;
BEGIN
    v_company_id := get_my_company_id();

    -- 1. Income (Credit - Debit)
    SELECT json_agg(t) INTO v_income FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM accounting_move_lines l
        JOIN accounting_moves m ON m.id = l.move_id
        JOIN chart_of_accounts a ON a.id = l.account_id
        WHERE m.company_id = v_company_id
          AND m.state = 'posted'
          AND m.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Income'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- 2. Expense (Debit - Credit)
    SELECT json_agg(t) INTO v_expense FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM accounting_move_lines l
        JOIN accounting_moves m ON m.id = l.move_id
        JOIN chart_of_accounts a ON a.id = l.account_id
        WHERE m.company_id = v_company_id
          AND m.state = 'posted'
          AND m.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Expense'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;
    
    -- 3. Net Profit (Total Income - Total Expense)
    -- Since Income is (Cr-Dr) and Expense is (Dr-Cr), Net Profit in Accounting terms is simple Sum(Cr-Dr) of all P&L accounts.
    SELECT COALESCE(SUM(l.credit - l.debit), 0)
    INTO v_net_profit
    FROM accounting_move_lines l
    JOIN accounting_moves m ON m.id = l.move_id
    JOIN chart_of_accounts a ON a.id = l.account_id
    WHERE m.company_id = v_company_id
      AND m.state = 'posted'
      AND m.date BETWEEN p_start_date AND p_end_date
      AND a.type IN ('Income', 'Expense');

    RETURN json_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'income', COALESCE(v_income, '[]'::json),
        'expense', COALESCE(v_expense, '[]'::json),
        'net_profit', v_net_profit
    );
END;
$$;
