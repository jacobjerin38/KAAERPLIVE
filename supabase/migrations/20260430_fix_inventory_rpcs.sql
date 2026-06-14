-- Fix rpc_global_dashboard to not reference im.buying_price
CREATE OR REPLACE FUNCTION public.rpc_global_dashboard(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

    -- Finance
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
    SELECT COALESCE(SUM(total_value), 0) INTO v_stock_value
    FROM inventory_transactions
    WHERE company_id = p_company_id;

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

    RETURN jsonb_build_object(
        'hr', v_hr,
        'finance', v_finance,
        'inventory', v_inventory,
        'approvals', v_approvals
    );
END;
$function$;

-- Fix rpc_inventory_dashboard_summary to not reference im.buying_price
CREATE OR REPLACE FUNCTION public.rpc_inventory_dashboard_summary(p_company_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_stock_value NUMERIC := 0;
    v_reserved NUMERIC := 0;
    v_scrap NUMERIC := 0;
    v_low_stock_items INT := 0;
BEGIN
    -- Value
    SELECT COALESCE(SUM(total_value), 0) INTO v_stock_value
    FROM inventory_transactions
    WHERE company_id = p_company_id;

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
$function$;

-- Create missing rpc_get_inventory_valuation
CREATE OR REPLACE FUNCTION public.rpc_get_inventory_valuation(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_valuation json;
BEGIN
    SELECT json_agg(t) INTO v_valuation
    FROM (
        SELECT 
            i.code,
            i.name,
            i.category,
            COALESCE(SUM(t.quantity), 0) as quantity_on_hand,
            COALESCE(AVG(t.unit_cost), 0) as avg_unit_cost,
            COALESCE(SUM(t.total_value), 0) as total_value
        FROM item_master i
        LEFT JOIN inventory_transactions t ON i.id = t.item_id
        WHERE i.company_id = p_company_id
        GROUP BY i.id, i.code, i.name, i.category
        HAVING COALESCE(SUM(t.quantity), 0) != 0 OR COALESCE(SUM(t.total_value), 0) != 0
    ) t;

    RETURN COALESCE(v_valuation, '[]'::json);
END;
$function$;

-- Ensure privileges
GRANT EXECUTE ON FUNCTION public.rpc_global_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_inventory_dashboard_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_inventory_valuation(uuid) TO authenticated;

-- Reload schema cache to ensure frontend gets updated signatures immediately
NOTIFY pgrst, 'reload schema';
