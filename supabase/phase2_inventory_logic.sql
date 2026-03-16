-- ==============================================================================
-- KAA ERP Phase 2 - Inventory & WMS Business Logic (RPCs)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RESERVATION LOGIC
-- ------------------------------------------------------------------------------

-- Reserve Stock (e.g., for Sales Order)
CREATE OR REPLACE FUNCTION rpc_reserve_stock(
    p_item_id UUID,
    p_warehouse_id UUID,
    p_qty NUMERIC,
    p_ref_type TEXT, -- 'SO', 'WO'
    p_ref_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_available_qty NUMERIC;
    v_reserved_qty NUMERIC;
    v_on_hand_qty NUMERIC;
    v_reservation_id UUID;
BEGIN
    -- Calculate Current Stock
    -- On Hand = Sum of Inventory Transactions
    SELECT COALESCE(SUM(quantity), 0) INTO v_on_hand_qty
    FROM inventory_transactions
    WHERE item_id = p_item_id AND warehouse_id = p_warehouse_id;

    -- Reserved = Sum of Active Reservations
    SELECT COALESCE(SUM(reserved_qty), 0) INTO v_reserved_qty
    FROM inventory_reservations
    WHERE item_id = p_item_id AND warehouse_id = p_warehouse_id AND status = 'Active';

    v_available_qty := v_on_hand_qty - v_reserved_qty;

    -- Check Availability
    IF v_available_qty < p_qty THEN
        RAISE EXCEPTION 'Insufficient stock available. Have %, Requested %', v_available_qty, p_qty;
    END IF;

    -- Create Reservation
    INSERT INTO inventory_reservations (
        item_id, warehouse_id, reserved_qty, reference_type, reference_id, status
    ) VALUES (
        p_item_id, p_warehouse_id, p_qty, p_ref_type, p_ref_id, 'Active'
    ) RETURNING id INTO v_reservation_id;

    RETURN jsonb_build_object('success', true, 'reservation_id', v_reservation_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Release Reservation (e.g., Order Cancelled or Shipped)
CREATE OR REPLACE FUNCTION rpc_release_reservation(
    p_reservation_id UUID,
    p_reduce_served_qty NUMERIC DEFAULT 0 -- If shipped, we reduce; if cancelled, we just release
)
RETURNS JSONB AS $$
DECLARE
    v_reserved_qty NUMERIC;
BEGIN
    SELECT reserved_qty INTO v_reserved_qty FROM inventory_reservations WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;

    -- If fully served/cancelled, mark as Released/Fulfilled
    
    IF p_reduce_served_qty > 0 THEN
        UPDATE inventory_reservations
        SET reserved_qty = reserved_qty - p_reduce_served_qty
        WHERE id = p_reservation_id;
        
        -- If 0, mark as Fulfilled
        UPDATE inventory_reservations
        SET status = 'Fulfilled'
        WHERE id = p_reservation_id AND reserved_qty <= 0;
    ELSE
         -- Full Cancellation
        UPDATE inventory_reservations
        SET status = 'Released'
        WHERE id = p_reservation_id;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 2. STOCK MOVEMENT CORE LOGIC
-- ------------------------------------------------------------------------------

-- Process Stock Movement (The Big One)
CREATE OR REPLACE FUNCTION rpc_process_stock_movement(
    p_item_id UUID,
    p_movement_type TEXT, -- 'IN' (GRN), 'OUT' (Ship), 'TRANSFER' (Bin-Bin)
    p_from_bin_id UUID,
    p_to_bin_id UUID,
    p_qty NUMERIC,
    p_ref_type TEXT,
    p_ref_id UUID,
    p_unit_cost NUMERIC DEFAULT 0 -- Required for IN
)
RETURNS JSONB AS $$
DECLARE
    v_warehouse_id UUID;
    v_inv_txn_id UUID;
    v_total_value NUMERIC;
    v_acct_config RECORD;
    v_company_id UUID;
BEGIN
    -- Get Context
    v_company_id := get_my_company_id();
    
    -- Validate Bins & Get Warehouse
    -- Fetch Warehouse ID from Bin
    IF p_to_bin_id IS NOT NULL THEN
        SELECT warehouse_id INTO v_warehouse_id 
        FROM warehouse_zones z JOIN warehouse_bins b ON b.zone_id = z.id 
        WHERE b.id = p_to_bin_id;
    ELSIF p_from_bin_id IS NOT NULL THEN
        SELECT warehouse_id INTO v_warehouse_id 
        FROM warehouse_zones z JOIN warehouse_bins b ON b.zone_id = z.id 
        WHERE b.id = p_from_bin_id;
    END IF;

    -- 1. Log Physical Movement
    INSERT INTO stock_movements (
        item_id, movement_type, from_bin_id, to_bin_id, quantity, reference_type, reference_id, performed_by
    ) VALUES (
        p_item_id, p_movement_type, p_from_bin_id, p_to_bin_id, p_qty, p_ref_type, p_ref_id, auth.uid()
    );

    -- 2. Inventory Transaction & Accounting
    -- Only for IN (GRN/Return) or OUT (Ship/Usage). TRANSFER (Bin-Bin) has no value impact.
    
    -- Get Account Config
    SELECT * INTO v_acct_config FROM inventory_account_config WHERE company_id = v_company_id LIMIT 1;
    
    IF p_movement_type = 'IN' THEN
        -- Increase Stock
        INSERT INTO inventory_transactions (
            item_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            p_item_id, v_warehouse_id, 'GRN', p_qty, p_unit_cost, p_ref_type, p_ref_id
        ) RETURNING id INTO v_inv_txn_id;
        
        -- Accounting: Dr Inventory, Cr GRNI
        IF found AND v_acct_config IS NOT NULL THEN
            INSERT INTO accounting_entries (
                company_id, transaction_date, reference_type, reference_id,
                debit_account, credit_account, amount, description
            ) VALUES (
                v_company_id, CURRENT_DATE, 'INV_TXN', v_inv_txn_id,
                v_acct_config.inventory_asset_account, v_acct_config.grni_account,
                (p_qty * p_unit_cost), 'Goods Receipt - ' || p_ref_type
            );
        END IF;

    ELSIF p_movement_type = 'OUT' THEN
        -- Decrease Stock
        -- Note: Costing for OUT is simplified here. In prod, need FIFO/Avg engine.
        -- Assuming p_unit_cost is passed (e.g. Current Avg Cost).
        
        INSERT INTO inventory_transactions (
            item_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            p_item_id, v_warehouse_id, 'ISSUE', -p_qty, p_unit_cost, p_ref_type, p_ref_id
        ) RETURNING id INTO v_inv_txn_id;

        -- Accounting: Dr COGS, Cr Inventory
        IF found AND v_acct_config IS NOT NULL THEN
             INSERT INTO accounting_entries (
                company_id, transaction_date, reference_type, reference_id,
                debit_account, credit_account, amount, description
            ) VALUES (
                v_company_id, CURRENT_DATE, 'INV_TXN', v_inv_txn_id,
                v_acct_config.cogs_account, v_acct_config.inventory_asset_account,
                (p_qty * p_unit_cost), 'Stock Issue - ' || p_ref_type
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 3. REPORTING / RECONCILIATION
-- ------------------------------------------------------------------------------

-- Get Inventory Valuation vs GL Report
CREATE OR REPLACE FUNCTION rpc_get_inventory_valuation()
RETURNS JSONB AS $$
DECLARE
    v_inventory_value NUMERIC;
    v_gl_balance NUMERIC;
    v_difference NUMERIC;
    v_company_id UUID;
BEGIN
    v_company_id := get_my_company_id();

    -- 1. Calculate Inventory Value from Transactions (Mock/Simple sum for now)
    -- Value = Sum (Qty * UnitCost) of handling transactions
    -- Note: This is a simplification. Real systems use weighted average cost tables.
    -- We assume transaction_type 'GRN' adds value, 'ISSUE' removes value.
    SELECT COALESCE(SUM(quantity * unit_cost), 0) INTO v_inventory_value
    FROM inventory_transactions
    WHERE warehouse_id IN (SELECT id FROM warehouses WHERE company_id = v_company_id);

    -- 2. Get GL Balance for Inventory Asset Account
    -- Fetch account ID from config
    -- We need to know which account is the asset account.
    -- We'll just sum all debits to the asset account minus credits.
    
    SELECT COALESCE(SUM(
        CASE WHEN ae.debit_account = cfg.inventory_asset_account THEN ae.amount ELSE 0 END
        -
        CASE WHEN ae.credit_account = cfg.inventory_asset_account THEN ae.amount ELSE 0 END
    ), 0) INTO v_gl_balance
    FROM accounting_entries ae
    CROSS JOIN inventory_account_config cfg
    WHERE ae.company_id = v_company_id AND cfg.company_id = v_company_id;

    v_difference := v_inventory_value - v_gl_balance;

    RETURN jsonb_build_object(
        'inventory_value', v_inventory_value,
        'gl_balance', v_gl_balance,
        'difference', v_difference,
        'last_updated', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
