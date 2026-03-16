-- =================================================================================
-- Migration: 20260221_finance_erp_improvements
-- Description: Creates the 6 RPC functions required for the ERP Dashboards
--   1. rpc_global_dashboard
--   2. rpc_finance_dashboard_summary
--   3. rpc_ar_aging
--   4. rpc_revenue_expense_trend
--   5. rpc_inventory_dashboard_summary
--   6. rpc_stock_movement_trend
-- =================================================================================

-- 1. Global Dashboard Summary
-- Returns { "hr": {...}, "finance": {...}, "inventory": {...}, "approvals": {...} }
CREATE OR REPLACE FUNCTION rpc_global_dashboard(p_company_id UUID)
RETURNS JSON AS $$
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

    -- Finance (Using Sales Invoices and Purchase Orders)
    SELECT COALESCE(SUM(grand_total - COALESCE(amount_paid, 0)), 0) INTO v_receivables
    FROM crm_sales_invoices
    WHERE company_id = p_company_id AND status IN ('Sent', 'Overdue', 'Partially Paid');

    SELECT COALESCE(SUM(total_amount), 0) INTO v_payables
    FROM purchase_orders 
    WHERE company_id = p_company_id AND state IN ('purchase', 'done'); -- rough proxy for payables if no bills table

    SELECT COUNT(*) INTO v_overdue_invoices
    FROM crm_sales_invoices
    WHERE company_id = p_company_id AND status = 'Overdue' AND due_date < CURRENT_DATE;

    v_finance := json_build_object(
        'receivables', v_receivables,
        'payables', v_payables,
        'overdue_invoices', v_overdue_invoices
    );

    -- Inventory
    -- Stock Value proxy: Sum of on-hand qty * buying_price from item_master / stock_movements
    SELECT COALESCE(SUM(sm.quantity * COALESCE(im.buying_price, 0)), 0) INTO v_stock_value
    FROM stock_movements sm
    JOIN item_master im ON sm.item_id = im.id
    WHERE sm.company_id = p_company_id;

    -- Actual low stock items calculation
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Finance Dashboard Summary
-- Combines AR, AP, Bank, Revenue, Expenses
CREATE OR REPLACE FUNCTION rpc_finance_dashboard_summary(p_company_id UUID)
RETURNS JSON AS $$
DECLARE
    v_receivables NUMERIC := 0;
    v_payables NUMERIC := 0;
    v_bank_balance NUMERIC := 0;
    v_revenue NUMERIC := 0;
    v_expenses NUMERIC := 0;
BEGIN
    -- Receivables
    SELECT COALESCE(SUM(grand_total - COALESCE(amount_paid, 0)), 0) INTO v_receivables
    FROM crm_sales_invoices
    WHERE company_id = p_company_id AND status IN ('Sent', 'Overdue', 'Partially Paid');

    -- Payables
    SELECT COALESCE(SUM(total_amount), 0) INTO v_payables
    FROM purchase_orders 
    WHERE company_id = p_company_id AND state IN ('purchase', 'done');

    -- Bank Balance (from bank_statement_lines)
    SELECT COALESCE(SUM(amount), 0) INTO v_bank_balance
    FROM bank_statement_lines
    WHERE company_id = p_company_id;

    -- Revenue (Paid/Completed Sales this month)
    SELECT COALESCE(SUM(amount_paid), 0) INTO v_revenue
    FROM crm_sales_invoices
    WHERE company_id = p_company_id AND date_trunc('month', invoice_date) = date_trunc('month', CURRENT_DATE);

    -- Expenses (Purchase orders this month)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_expenses
    FROM purchase_orders
    WHERE company_id = p_company_id AND state = 'purchase' AND date_trunc('month', order_date) = date_trunc('month', CURRENT_DATE);

    RETURN json_build_object(
        'receivables', v_receivables,
        'payables', v_payables,
        'bankBalance', v_bank_balance,
        'revenue', v_revenue,
        'expenses', v_expenses,
        'netProfit', v_revenue - v_expenses
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. AR Aging
-- Returns array of objects { period: '0-30', amount: 1000 }
CREATE OR REPLACE FUNCTION rpc_ar_aging(p_company_id UUID)
RETURNS JSON AS $$
BEGIN
    RETURN COALESCE(
        (SELECT json_agg(row_to_json(t))
         FROM (
             SELECT 
                 CASE 
                     WHEN CURRENT_DATE - due_date <= 30 THEN '0-30 days'
                     WHEN CURRENT_DATE - due_date <= 60 THEN '31-60 days'
                     WHEN CURRENT_DATE - due_date <= 90 THEN '61-90 days'
                     ELSE '90+ days'
                 END AS period,
                 SUM(grand_total - COALESCE(amount_paid, 0)) AS amount
             FROM crm_sales_invoices
             WHERE company_id = p_company_id AND status != 'Paid' AND due_date IS NOT NULL AND due_date < CURRENT_DATE
             GROUP BY period
             ORDER BY period
         ) t),
        '[]'::json
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Revenue/Expense Trend
-- Last 6 months trend
CREATE OR REPLACE FUNCTION rpc_revenue_expense_trend(p_company_id UUID)
RETURNS JSON AS $$
BEGIN
    RETURN COALESCE(
        (SELECT json_agg(row_to_json(t))
         FROM (
             WITH months AS (
                 SELECT generate_series(
                     date_trunc('month', CURRENT_DATE - interval '5 months'),
                     date_trunc('month', CURRENT_DATE),
                     '1 month'::interval
                 ) AS month_date
             ),
             revenue AS (
                 SELECT date_trunc('month', invoice_date) as month_date, SUM(amount_paid) as revenue
                 FROM crm_sales_invoices
                 WHERE company_id = p_company_id
                 GROUP BY date_trunc('month', invoice_date)
             ),
             expense AS (
                 SELECT date_trunc('month', order_date) as month_date, SUM(total_amount) as expense
                 FROM purchase_orders
                 WHERE company_id = p_company_id AND state IN ('purchase', 'done')
                 GROUP BY date_trunc('month', order_date)
             )
             SELECT 
                 to_char(m.month_date, 'Mon') as month,
                 COALESCE(r.revenue, 0) as revenue,
                 COALESCE(e.expense, 0) as expense
             FROM months m
             LEFT JOIN revenue r ON m.month_date = r.month_date
             LEFT JOIN expense e ON m.month_date = e.month_date
             ORDER BY m.month_date
         ) t),
        '[]'::json
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Inventory Dashboard Summary
CREATE OR REPLACE FUNCTION rpc_inventory_dashboard_summary(p_company_id UUID)
RETURNS JSON AS $$
DECLARE
    v_stock_value NUMERIC := 0;
    v_reserved NUMERIC := 0;
    v_scrap NUMERIC := 0;
    v_low_stock_items INT := 0;
BEGIN
    -- Value
    SELECT COALESCE(SUM(sm.quantity * COALESCE(im.buying_price, 0)), 0) INTO v_stock_value
    FROM stock_movements sm
    JOIN item_master im ON sm.item_id = im.id
    WHERE sm.company_id = p_company_id;

    -- Reserved
    SELECT COALESCE(SUM(reserved_qty), 0) INTO v_reserved
    FROM inventory_reservations
    WHERE company_id = p_company_id AND status = 'Active';

    -- Low Stock
    SELECT COUNT(*) INTO v_low_stock_items
    FROM (
        SELECT sm.item_id, SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE -sm.quantity END) AS net_qty
        FROM stock_movements sm
        WHERE sm.company_id = p_company_id
        GROUP BY sm.item_id
    ) inventory
    JOIN item_master im ON inventory.item_id = im.id
    WHERE inventory.net_qty <= COALESCE(im.reorder_level, 10);

    -- Scrap
    SELECT COALESCE(SUM(quantity), 0) INTO v_scrap
    FROM stock_movements
    WHERE company_id = p_company_id AND movement_type = 'SCRAP';

    RETURN json_build_object(
        'stockValue', v_stock_value,
        'lowStock', v_low_stock_items,
        'reserved', v_reserved,
        'scrap', v_scrap
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Stock Movement Trend
CREATE OR REPLACE FUNCTION rpc_stock_movement_trend(p_company_id UUID)
RETURNS JSON AS $$
BEGIN
    RETURN COALESCE(
        (SELECT json_agg(row_to_json(t))
         FROM (
             SELECT 
                 to_char(date_trunc('day', created_at), 'DD Mon') as date,
                 SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END) as in_qty,
                 SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END) as out_qty
             FROM stock_movements
             WHERE company_id = p_company_id AND created_at >= CURRENT_DATE - interval '30 days'
             GROUP BY date_trunc('day', created_at)
             ORDER BY date_trunc('day', created_at)
         ) t),
        '[]'::json
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
