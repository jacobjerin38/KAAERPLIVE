-- 1. Add amount_residual to accounting_moves if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_moves' AND column_name = 'amount_residual') THEN
        ALTER TABLE accounting_moves ADD COLUMN amount_residual NUMERIC DEFAULT 0;
        -- Initialize with amount_total for existing rows (rough assumption)
        UPDATE accounting_moves SET amount_residual = amount_total;
    END IF;
END $$;

-- 2. Fix rpc_ar_aging
OR REPLACE FUNCTION rpc_ar_aging(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now DATE := CURRENT_DATE;
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'current', COALESCE(SUM(CASE WHEN due_date >= v_now THEN amount_residual ELSE 0 END), 0),
            'days_1_30', COALESCE(SUM(CASE WHEN v_now - due_date BETWEEN 1 AND 30 THEN amount_residual ELSE 0 END), 0),
            'days_31_60', COALESCE(SUM(CASE WHEN v_now - due_date BETWEEN 31 AND 60 THEN amount_residual ELSE 0 END), 0),
            'days_61_90', COALESCE(SUM(CASE WHEN v_now - due_date BETWEEN 61 AND 90 THEN amount_residual ELSE 0 END), 0),
            'days_over_90', COALESCE(SUM(CASE WHEN v_now - due_date > 90 THEN amount_residual ELSE 0 END), 0),
            'total', COALESCE(SUM(amount_residual), 0)
        )
        FROM accounting_moves
        WHERE company_id = p_company_id AND move_type = 'out_invoice' AND state = 'Posted' AND amount_residual > 0
    );
END;
$$;

-- 3. Fix rpc_finance_dashboard_summary
OR REPLACE FUNCTION rpc_finance_dashboard_summary(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receivables NUMERIC; v_payables NUMERIC; v_bank NUMERIC;
    v_revenue NUMERIC; v_expenses NUMERIC;
BEGIN
    SELECT COALESCE(SUM(amount_residual), 0) INTO v_receivables FROM accounting_moves WHERE company_id = p_company_id AND move_type = 'out_invoice' AND state = 'Posted';
    SELECT COALESCE(SUM(amount_residual), 0) INTO v_payables FROM accounting_moves WHERE company_id = p_company_id AND move_type = 'in_invoice' AND state = 'Posted';
    
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_bank 
    FROM accounting_move_lines l 
    JOIN chart_of_accounts a ON a.id = l.account_id 
    JOIN accounting_moves m ON m.id = l.move_id 
    WHERE m.company_id = p_company_id AND m.state = 'Posted' AND a.type = 'Asset' AND a.subtype IN ('Bank', 'Cash');
    
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_revenue 
    FROM accounting_move_lines l 
    JOIN chart_of_accounts a ON a.id = l.account_id 
    JOIN accounting_moves m ON m.id = l.move_id 
    WHERE m.company_id = p_company_id AND m.state = 'Posted' AND a.type = 'Income' AND EXTRACT(YEAR FROM m.date) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_expenses 
    FROM accounting_move_lines l 
    JOIN chart_of_accounts a ON a.id = l.account_id 
    JOIN accounting_moves m ON m.id = l.move_id 
    WHERE m.company_id = p_company_id AND m.state = 'Posted' AND a.type = 'Expense' AND EXTRACT(YEAR FROM m.date) = EXTRACT(YEAR FROM CURRENT_DATE);

    RETURN jsonb_build_object(
        'receivables', v_receivables,
        'payables', v_payables,
        'bank_balance', v_bank,
        'revenue', v_revenue,
        'expenses', v_expenses,
        'net_profit', v_revenue - v_expenses
    );
END;
$$;

-- 4. Fix rpc_global_dashboard
OR REPLACE FUNCTION rpc_global_dashboard(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hr JSON;
    v_finance JSON;
    v_inventory JSON;
    v_approvals JSON;

    -- HR Variables
    v_active_employees INT := 0;
    v_attendance_pct INT := 0;
    v_present_today INT := 0;

    -- Finance Variables
    v_receivables NUMERIC := 0;
    v_payables NUMERIC := 0;
    v_overdue_invoices INT := 0;

    -- Inventory Variables
    v_stock_value NUMERIC := 0;
    v_low_stock_items INT := 0;
    
    -- Approvals Variables
    v_pending_leaves INT := 0;
    v_pending_transitions INT := 0;
BEGIN
    -- HR
    SELECT COUNT(*) INTO v_active_employees 
    FROM employees 
    WHERE company_id = p_company_id AND status = 'Active';

    SELECT COUNT(*) INTO v_present_today
    FROM attendance
    WHERE company_id = p_company_id AND date = CURRENT_DATE AND status = 'Present';

    IF v_active_employees > 0 THEN
        v_attendance_pct := ROUND((v_present_today::NUMERIC / v_active_employees::NUMERIC) * 100);
    END IF;

    v_hr := json_build_object(
        'active_employees', v_active_employees,
        'attendance_pct', v_attendance_pct
    );

    -- Finance (Using Accounting Moves as the source of truth)
    SELECT COALESCE(SUM(amount_residual), 0) INTO v_receivables
    FROM accounting_moves
    WHERE company_id = p_company_id AND move_type = 'out_invoice' AND state = 'Posted' AND amount_residual > 0;

    SELECT COALESCE(SUM(amount_residual), 0) INTO v_payables
    FROM accounting_moves
    WHERE company_id = p_company_id AND move_type = 'in_invoice' AND state = 'Posted' AND amount_residual > 0;

    SELECT COUNT(*) INTO v_overdue_invoices
    FROM accounting_moves
    WHERE company_id = p_company_id AND move_type = 'out_invoice' AND state = 'Posted' AND due_date < CURRENT_DATE AND amount_residual > 0;

    v_finance := json_build_object(
        'receivables', v_receivables,
        'payables', v_payables,
        'overdue_invoices', v_overdue_invoices
    );

    -- Inventory
    SELECT COALESCE(SUM(sm.quantity * COALESCE(im.buying_price, 0)), 0) INTO v_stock_value
    FROM stock_movements sm
    JOIN item_master im ON sm.item_id = im.id
    WHERE sm.company_id = p_company_id;

    SELECT COUNT(*) INTO v_low_stock_items
    FROM (
        SELECT sm.item_id, SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE -sm.quantity END) AS net_qty
        FROM stock_movements sm
        WHERE sm.company_id = p_company_id
        GROUP BY sm.item_id
    ) inventory
    JOIN item_master im ON inventory.item_id = im.id
    WHERE inventory.net_qty <= COALESCE(im.reorder_level, 10);

    v_inventory := json_build_object(
        'stock_value', v_stock_value,
        'low_stock_items', v_low_stock_items
    );

    -- Approvals
    SELECT COUNT(*) INTO v_pending_leaves
    FROM leaves
    WHERE company_id = p_company_id AND status = 'Pending';
    
    SELECT COUNT(*) INTO v_pending_transitions
    FROM employee_job_transitions
    WHERE company_id = p_company_id AND status = 'Pending';

    v_approvals := json_build_object(
        'pending_leaves', v_pending_leaves,
        'pending_transitions', v_pending_transitions
    );

    RETURN json_build_object(
        'hr', v_hr,
        'finance', v_finance,
        'inventory', v_inventory,
        'approvals', v_approvals
    );
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
