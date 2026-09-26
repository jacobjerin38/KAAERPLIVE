-- Migration: 20260926150000_accounting_account_breakdown_drilldown.sql
-- Description: Adds account drill-down breakdown RPC for reporting and enhances Balance Sheet, P&L, and Trial Balance with account_id

-- 1. Create or replace rpc_get_accounting_account_breakdown
CREATE OR REPLACE FUNCTION public.rpc_get_accounting_account_breakdown(
    p_company_id UUID DEFAULT NULL,
    p_account_id UUID DEFAULT NULL,
    p_account_code TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_cost_center_id UUID DEFAULT NULL,
    p_project_cost_center_id UUID DEFAULT NULL,
    p_contract_cost_center_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_account RECORD;
    v_normal_side TEXT;
    v_opening_balance NUMERIC := 0;
    v_total_debit NUMERIC := 0;
    v_total_credit NUMERIC := 0;
    v_closing_balance NUMERIC := 0;
    v_transactions JSONB := '[]'::jsonb;
    v_account_info JSONB;
BEGIN
    v_company_id := COALESCE(p_company_id, get_my_company_id());
    IF v_company_id IS NULL AND p_account_id IS NOT NULL THEN
        SELECT company_id INTO v_company_id FROM public.accounting_chart_of_accounts WHERE id = p_account_id LIMIT 1;
    END IF;
    IF v_company_id IS NULL AND p_account_code IS NOT NULL THEN
        SELECT company_id INTO v_company_id FROM public.accounting_chart_of_accounts WHERE code = p_account_code LIMIT 1;
    END IF;
    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.accounting_journal_entries WHERE state = 'Posted' LIMIT 1;
    END IF;

    -- Handle synthetic Current Year Earnings (Code 999999)
    IF p_account_code = '999999' THEN
        v_normal_side := 'credit';
        v_account_info := jsonb_build_object(
            'id', NULL,
            'code', '999999',
            'name', 'Current Year Earnings',
            'type', 'Equity',
            'subtype', 'Retained Earnings',
            'normal_side', v_normal_side
        );

        IF p_start_date IS NOT NULL THEN
            SELECT COALESCE(SUM(l.credit - l.debit), 0)
            INTO v_opening_balance
            FROM public.accounting_journal_lines l
            JOIN public.accounting_journal_entries e ON e.id = l.entry_id
            JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
            WHERE e.company_id = v_company_id
              AND e.state = 'Posted'
              AND e.date < p_start_date
              AND a.type IN ('Income', 'Expense')
              AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
              AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
              AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id);
        END IF;

        WITH tx AS (
            SELECT 
                l.id as line_id,
                e.id as entry_id,
                e.date,
                COALESCE(e.reference, 'JV') as voucher_ref,
                e.move_type,
                j.code as journal_code,
                j.name as journal_name,
                COALESCE(p_line.name, p_entry.name, '') as partner_name,
                COALESCE(NULLIF(l.name, ''), NULLIF(e.notes, ''), e.reference, 'Journal Entry') as description,
                a.code as account_code,
                a.name as account_name,
                l.debit,
                l.credit,
                (v_opening_balance + SUM(l.credit - l.debit) OVER (ORDER BY e.date ASC, e.created_at ASC, l.id ASC)) as running_balance,
                cc.name as cost_center_name
            FROM public.accounting_journal_lines l
            JOIN public.accounting_journal_entries e ON e.id = l.entry_id
            JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
            LEFT JOIN public.accounting_journals j ON j.id = e.journal_id
            LEFT JOIN public.accounting_partners p_line ON p_line.id = l.partner_id
            LEFT JOIN public.accounting_partners p_entry ON p_entry.id = e.partner_id
            LEFT JOIN public.accounting_cost_centers cc ON cc.id = l.cost_center_id
            WHERE e.company_id = v_company_id
              AND e.state = 'Posted'
              AND a.type IN ('Income', 'Expense')
              AND (p_start_date IS NULL OR e.date >= p_start_date)
              AND (p_end_date IS NULL OR e.date <= p_end_date)
              AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
              AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
              AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id)
            ORDER BY e.date ASC, e.created_at ASC, l.id ASC
        )
        SELECT 
            COALESCE(jsonb_agg(to_jsonb(tx)), '[]'::jsonb),
            COALESCE(SUM(debit), 0),
            COALESCE(SUM(credit), 0)
        INTO v_transactions, v_total_debit, v_total_credit
        FROM tx;

        v_closing_balance := v_opening_balance + (v_total_credit - v_total_debit);

        RETURN jsonb_build_object(
            'success', true,
            'account', v_account_info,
            'opening_balance', v_opening_balance,
            'total_debit', v_total_debit,
            'total_credit', v_total_credit,
            'net_movement', v_total_credit - v_total_debit,
            'closing_balance', v_closing_balance,
            'transaction_count', jsonb_array_length(v_transactions),
            'transactions', v_transactions
        );
    END IF;

    -- Standard Account lookup
    IF p_account_id IS NOT NULL THEN
        SELECT * INTO v_account FROM public.accounting_chart_of_accounts 
        WHERE id = p_account_id AND (v_company_id IS NULL OR company_id = v_company_id) 
        LIMIT 1;
    ELSIF p_account_code IS NOT NULL THEN
        SELECT * INTO v_account FROM public.accounting_chart_of_accounts 
        WHERE code = p_account_code AND (v_company_id IS NULL OR company_id = v_company_id) 
        LIMIT 1;
    END IF;

    IF v_account.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Account not found'
        );
    END IF;

    IF v_account.type IN ('Asset', 'Expense') THEN
        v_normal_side := 'debit';
    ELSE
        v_normal_side := 'credit';
    END IF;

    v_account_info := jsonb_build_object(
        'id', v_account.id,
        'code', v_account.code,
        'name', v_account.name,
        'type', v_account.type,
        'subtype', v_account.subtype,
        'normal_side', v_normal_side
    );

    IF p_start_date IS NOT NULL THEN
        SELECT COALESCE(SUM(
            CASE WHEN v_normal_side = 'debit' THEN l.debit - l.credit ELSE l.credit - l.debit END
        ), 0)
        INTO v_opening_balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        WHERE l.account_id = v_account.id
          AND e.state = 'Posted'
          AND (v_company_id IS NULL OR e.company_id = v_company_id)
          AND e.date < p_start_date
          AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
          AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
          AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id);
    END IF;

    WITH tx AS (
        SELECT 
            l.id as line_id,
            e.id as entry_id,
            e.date,
            COALESCE(e.reference, 'JV') as voucher_ref,
            e.move_type,
            j.code as journal_code,
            j.name as journal_name,
            COALESCE(p_line.name, p_entry.name, '') as partner_name,
            COALESCE(NULLIF(l.name, ''), NULLIF(e.notes, ''), e.reference, 'Journal Entry') as description,
            v_account.code as account_code,
            v_account.name as account_name,
            l.debit,
            l.credit,
            (v_opening_balance + SUM(
                CASE WHEN v_normal_side = 'debit' THEN l.debit - l.credit ELSE l.credit - l.debit END
            ) OVER (ORDER BY e.date ASC, e.created_at ASC, l.id ASC)) as running_balance,
            cc.name as cost_center_name
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        LEFT JOIN public.accounting_journals j ON j.id = e.journal_id
        LEFT JOIN public.accounting_partners p_line ON p_line.id = l.partner_id
        LEFT JOIN public.accounting_partners p_entry ON p_entry.id = e.partner_id
        LEFT JOIN public.accounting_cost_centers cc ON cc.id = l.cost_center_id
        WHERE l.account_id = v_account.id
          AND e.state = 'Posted'
          AND (v_company_id IS NULL OR e.company_id = v_company_id)
          AND (p_start_date IS NULL OR e.date >= p_start_date)
          AND (p_end_date IS NULL OR e.date <= p_end_date)
          AND (p_cost_center_id IS NULL OR l.cost_center_id = p_cost_center_id)
          AND (p_project_cost_center_id IS NULL OR l.project_cost_center_id = p_project_cost_center_id)
          AND (p_contract_cost_center_id IS NULL OR l.contract_cost_center_id = p_contract_cost_center_id)
        ORDER BY e.date ASC, e.created_at ASC, l.id ASC
    )
    SELECT 
        COALESCE(jsonb_agg(to_jsonb(tx)), '[]'::jsonb),
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0)
    INTO v_transactions, v_total_debit, v_total_credit
    FROM tx;

    IF v_normal_side = 'debit' THEN
        v_closing_balance := v_opening_balance + (v_total_debit - v_total_credit);
    ELSE
        v_closing_balance := v_opening_balance + (v_total_credit - v_total_debit);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'account', v_account_info,
        'opening_balance', v_opening_balance,
        'total_debit', v_total_debit,
        'total_credit', v_total_credit,
        'net_movement', CASE WHEN v_normal_side = 'debit' THEN (v_total_debit - v_total_credit) ELSE (v_total_credit - v_total_debit) END,
        'closing_balance', v_closing_balance,
        'transaction_count', jsonb_array_length(v_transactions),
        'transactions', v_transactions
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_accounting_account_breakdown TO authenticated, anon;

-- 2. Upgrade rpc_get_accounting_balance_sheet to include account_id
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
            a.id as account_id,
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Asset'
        GROUP BY a.id, a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    -- Liabilities (Credit - Debit)
    SELECT jsonb_agg(t) INTO v_liabilities FROM (
        SELECT 
            a.id as account_id,
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Liability'
        GROUP BY a.id, a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- Equity (Credit - Debit)
    SELECT jsonb_agg(t) INTO v_equity FROM (
        SELECT 
            a.id as account_id,
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Equity'
        GROUP BY a.id, a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        
        UNION ALL
        
        SELECT 
            NULL::uuid as account_id,
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

GRANT EXECUTE ON FUNCTION public.rpc_get_accounting_balance_sheet(DATE, UUID) TO authenticated, anon;

-- 3. Upgrade rpc_get_accounting_profit_loss to include account_id
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
    v_total_revenue NUMERIC;
    v_total_cogs NUMERIC;
    v_gross_profit NUMERIC;
    v_total_indirect_income NUMERIC;
    v_total_indirect_expense NUMERIC;
    v_net_profit NUMERIC;
    v_revenue JSONB;
    v_cogs JSONB;
    v_indirect_income JSONB;
    v_indirect_expense JSONB;
BEGIN
    v_company_id := COALESCE(p_company_id, get_my_company_id());
    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.accounting_journal_entries WHERE state = 'Posted' LIMIT 1;
    END IF;

    -- 1. Revenue (Credit - Debit)
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
            a.id as account_id,
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
        GROUP BY a.id, a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- 2. Cost of Goods Sold / Direct Cost (Debit - Credit)
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
            a.id as account_id,
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
        GROUP BY a.id, a.code, a.name, a.subtype
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
            a.id as account_id,
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
        GROUP BY a.id, a.code, a.name, a.subtype
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
            a.id as account_id,
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
        GROUP BY a.id, a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    v_net_profit := (v_gross_profit + v_total_indirect_income) - v_total_indirect_expense;

    RETURN jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'total_revenue', v_total_revenue,
        'total_cogs', v_total_cogs,
        'gross_profit', v_gross_profit,
        'total_indirect_income', v_total_indirect_income,
        'total_indirect_expense', v_total_indirect_expense,
        'net_profit', v_net_profit,
        'revenue', COALESCE(v_revenue, '[]'::jsonb),
        'cogs', COALESCE(v_cogs, '[]'::jsonb),
        'indirect_income', COALESCE(v_indirect_income, '[]'::jsonb),
        'indirect_expense', COALESCE(v_indirect_expense, '[]'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_accounting_profit_loss(DATE, DATE, UUID, UUID, UUID, UUID) TO authenticated, anon;

-- 4. Upgrade rpc_get_accounting_trial_balance to include account_id
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
            a.id as account_id,
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
        GROUP BY a.id, a.code, a.name, a.type
        HAVING (SUM(l.debit) != 0 OR SUM(l.credit) != 0)
        ORDER BY a.code
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_accounting_trial_balance(DATE, UUID) TO authenticated, anon;
