-- ============================================================================
-- Migration: Upgrade Profit & Loss and Financial Report RPCs
-- Adds: Cost Center filters, explicit company_id support, and correct subtype matching
-- ============================================================================

-- 1. Upgrade rpc_get_accounting_profit_loss
CREATE OR REPLACE FUNCTION public.rpc_get_accounting_profit_loss(
    p_start_date DATE,
    p_end_date DATE,
    p_cost_center_id UUID DEFAULT NULL,
    p_project_cost_center_id UUID DEFAULT NULL,
    p_contract_cost_center_id UUID DEFAULT NULL,
    p_company_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_revenue JSONB;
    v_cogs JSONB;
    v_indirect_income JSONB;
    v_indirect_expense JSONB;
    v_total_revenue NUMERIC := 0;
    v_total_cogs NUMERIC := 0;
    v_total_indirect_income NUMERIC := 0;
    v_total_indirect_expense NUMERIC := 0;
    v_gross_profit NUMERIC := 0;
    v_net_profit NUMERIC := 0;
BEGIN
    v_company_id := COALESCE(p_company_id, get_my_company_id());
    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.accounting_journal_entries WHERE state = 'Posted' LIMIT 1;
    END IF;

    -- 1. Revenue (Operating Revenue / Income: Credit - Debit)
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_total_revenue
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Income' 
      AND (a.subtype ILIKE '%Revenue%' OR a.subtype = 'Operating Revenue' OR a.subtype = 'Revenue' OR a.subtype IS NULL)
      AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
      AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
      AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id);

    SELECT jsonb_agg(t) INTO v_revenue FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Income' 
          AND (a.subtype ILIKE '%Revenue%' OR a.subtype = 'Operating Revenue' OR a.subtype = 'Revenue' OR a.subtype IS NULL)
          AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
          AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
          AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id)
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- 2. Cost of Goods Sold / Direct Cost (Expense with COGS subtype or in direct expense ledgers: Debit - Credit)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_total_cogs
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Expense' 
      AND (
          a.subtype = 'COGS' 
          OR a.subtype ILIKE '%Direct%' 
          OR a.id IN (SELECT account_id FROM public.accounting_direct_expense_ledgers WHERE company_id = v_company_id)
      )
      AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
      AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
      AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id);

    SELECT jsonb_agg(t) INTO v_cogs FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Expense' 
          AND (
              a.subtype = 'COGS' 
              OR a.subtype ILIKE '%Direct%' 
              OR a.id IN (SELECT account_id FROM public.accounting_direct_expense_ledgers WHERE company_id = v_company_id)
          )
          AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
          AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
          AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id)
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    v_gross_profit := v_total_revenue - v_total_cogs;

    -- 3. Indirect Income (Non-Operating Income: Credit - Debit)
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_total_indirect_income
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Income' 
      AND NOT (a.subtype ILIKE '%Revenue%' OR a.subtype = 'Operating Revenue' OR a.subtype = 'Revenue')
      AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
      AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
      AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id);

    SELECT jsonb_agg(t) INTO v_indirect_income FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Income' 
          AND NOT (a.subtype ILIKE '%Revenue%' OR a.subtype = 'Operating Revenue' OR a.subtype = 'Revenue')
          AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
          AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
          AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id)
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- 4. Indirect / Operating Expenses (Debit - Credit)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_total_indirect_expense
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Expense' 
      AND NOT (
          a.subtype = 'COGS' 
          OR a.subtype ILIKE '%Direct%' 
          OR a.id IN (SELECT account_id FROM public.accounting_direct_expense_ledgers WHERE company_id = v_company_id)
      )
      AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
      AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
      AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id);

    SELECT jsonb_agg(t) INTO v_indirect_expense FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Expense' 
          AND NOT (
              a.subtype = 'COGS' 
              OR a.subtype ILIKE '%Direct%' 
              OR a.id IN (SELECT account_id FROM public.accounting_direct_expense_ledgers WHERE company_id = v_company_id)
          )
          AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
          AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
          AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id)
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    v_net_profit := v_gross_profit + v_total_indirect_income - v_total_indirect_expense;

    RETURN jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'revenue', COALESCE(v_revenue, '[]'::jsonb),
        'cogs', COALESCE(v_cogs, '[]'::jsonb),
        'indirect_income', COALESCE(v_indirect_income, '[]'::jsonb),
        'indirect_expense', COALESCE(v_indirect_expense, '[]'::jsonb),
        'total_revenue', v_total_revenue,
        'total_cogs', v_total_cogs,
        'gross_profit', v_gross_profit,
        'total_indirect_income', v_total_indirect_income,
        'total_indirect_expense', v_total_indirect_expense,
        'net_profit', v_net_profit
    );
END;
$$;

-- 2. Upgrade rpc_get_accounting_balance_sheet
CREATE OR REPLACE FUNCTION public.rpc_get_accounting_balance_sheet(
    p_date DATE,
    p_company_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_assets JSONB;
    v_liabilities JSONB;
    v_equity JSONB;
    v_current_year_earnings NUMERIC;
BEGIN
    v_company_id := COALESCE(p_company_id, get_my_company_id());
    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.accounting_journal_entries WHERE state = 'Posted' LIMIT 1;
    END IF;

    -- Calculate Current Year Earnings (Net Profit/Loss up to p_date)
    SELECT COALESCE(SUM(l.credit - l.debit), 0)
    INTO v_current_year_earnings
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date <= p_date
      AND a.type IN ('Income', 'Expense');

    -- Assets (Debit - Credit)
    SELECT jsonb_agg(t) INTO v_assets FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Asset'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    -- Liabilities (Credit - Debit)
    SELECT jsonb_agg(t) INTO v_liabilities FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Liability'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- Equity (Credit - Debit)
    SELECT jsonb_agg(t) INTO v_equity FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Equity'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        
        UNION ALL
        
        SELECT 
            '999999' as code, 
            'Current Year Earnings' as name, 
            'Retained Earnings' as subtype, 
            v_current_year_earnings as balance
        WHERE v_current_year_earnings != 0
        
        ORDER BY code
    ) t;

    RETURN jsonb_build_object(
        'date', p_date,
        'assets', COALESCE(v_assets, '[]'::jsonb),
        'liabilities', COALESCE(v_liabilities, '[]'::jsonb),
        'equity', COALESCE(v_equity, '[]'::jsonb)
    );
END;
$$;

-- 3. Upgrade rpc_get_accounting_trial_balance
CREATE OR REPLACE FUNCTION public.rpc_get_accounting_trial_balance(
    p_date DATE,
    p_company_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := COALESCE(p_company_id, get_my_company_id());
    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.accounting_journal_entries WHERE state = 'Posted' LIMIT 1;
    END IF;

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            a.code,
            a.name,
            a.type,
            SUM(l.debit) as total_debit,
            SUM(l.credit) as total_credit,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
        GROUP BY a.code, a.name, a.type
        HAVING SUM(l.debit) != 0 OR SUM(l.credit) != 0
        ORDER BY a.code
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;

-- 4. Upgrade rpc_get_accounting_expense_analysis
CREATE OR REPLACE FUNCTION public.rpc_get_accounting_expense_analysis(
    p_start_date DATE,
    p_end_date DATE,
    p_company_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := COALESCE(p_company_id, get_my_company_id());
    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.accounting_journal_entries WHERE state = 'Posted' LIMIT 1;
    END IF;

    SELECT jsonb_agg(t) INTO v_data FROM (
        -- Direct Expenses
        SELECT 
            del.name as category,
            a.code as account_code,
            a.name as account_name,
            COALESCE(SUM(l.debit - l.credit), 0) as amount,
            'Direct' as type
        FROM public.accounting_direct_expense_ledgers del
        JOIN public.accounting_chart_of_accounts a ON a.id = del.account_id
        LEFT JOIN public.accounting_journal_lines l ON l.account_id = a.id
        LEFT JOIN public.accounting_journal_entries e ON e.id = l.entry_id AND e.state = 'Posted' AND e.date BETWEEN p_start_date AND p_end_date
        WHERE del.company_id = v_company_id
        GROUP BY del.name, a.code, a.name
        
        UNION ALL
        
        -- Indirect Expenses
        SELECT 
            'Indirect Expense' as category,
            a.code as account_code,
            a.name as account_name,
            COALESCE(SUM(l.debit - l.credit), 0) as amount,
            'Indirect' as type
        FROM public.accounting_chart_of_accounts a
        LEFT JOIN public.accounting_journal_lines l ON l.account_id = a.id
        LEFT JOIN public.accounting_journal_entries e ON e.id = l.entry_id AND e.state = 'Posted' AND e.date BETWEEN p_start_date AND p_end_date
        WHERE a.company_id = v_company_id
          AND a.type = 'Expense'
          AND a.subtype != 'COGS'
          AND a.id NOT IN (SELECT account_id FROM public.accounting_direct_expense_ledgers WHERE company_id = v_company_id)
        GROUP BY a.code, a.name
        
        ORDER BY type, category, account_code
    ) t WHERE t.amount != 0;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;
