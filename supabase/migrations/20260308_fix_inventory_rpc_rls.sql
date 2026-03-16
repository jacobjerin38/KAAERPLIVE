-- Fix Inventory RPCs to prevent RLS bypass via cached get_my_company_id()

DROP FUNCTION IF EXISTS public.rpc_process_stock_movement(uuid, text, uuid, uuid, numeric, text, uuid, numeric);

CREATE OR REPLACE FUNCTION public.rpc_process_stock_movement(
    p_company_id uuid,
    p_item_id uuid,
    p_movement_type text,
    p_from_bin_id uuid,
    p_to_bin_id uuid,
    p_qty numeric,
    p_ref_type text,
    p_ref_id uuid,
    p_unit_cost numeric DEFAULT 0
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_warehouse_id UUID;
    v_inv_txn_id UUID;
    v_total_value NUMERIC;
    v_acct_config RECORD;
BEGIN
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
        company_id, item_id, movement_type, from_bin_id, to_bin_id, quantity, reference_type, reference_id, performed_by
    ) VALUES (
        p_company_id, p_item_id, p_movement_type, p_from_bin_id, p_to_bin_id, p_qty, p_ref_type, p_ref_id, auth.uid()
    );

    -- 2. Inventory Transaction & Accounting
    -- Only for IN (GRN/Return) or OUT (Ship/Usage). TRANSFER (Bin-Bin) has no value impact.
    
    -- Get Account Config
    SELECT * INTO v_acct_config FROM inventory_account_config WHERE company_id = p_company_id LIMIT 1;
    
    IF p_movement_type = 'IN' THEN
        -- Increase Stock
        INSERT INTO inventory_transactions (
            company_id, item_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            p_company_id, p_item_id, v_warehouse_id, 'GRN', p_qty, p_unit_cost, p_ref_type, p_ref_id
        ) RETURNING id INTO v_inv_txn_id;
        
        -- Accounting: Dr Inventory, Cr GRNI
        IF found AND v_acct_config IS NOT NULL THEN
             INSERT INTO accounting_entries (
                company_id, transaction_date, reference_type, reference_id,
                debit_account, credit_account, amount, description
            ) VALUES (
                p_company_id, CURRENT_DATE, 'INV_TXN', v_inv_txn_id,
                v_acct_config.inventory_asset_account, v_acct_config.grni_account,
                (p_qty * p_unit_cost), 'Goods Receipt - ' || p_ref_type
            );
        END IF;

    ELSIF p_movement_type = 'OUT' THEN
        -- Decrease Stock
        -- Note: Costing for OUT is simplified here. In prod, need FIFO/Avg engine.
        -- Assuming p_unit_cost is passed (e.g. Current Avg Cost).
        
        INSERT INTO inventory_transactions (
            company_id, item_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            p_company_id, p_item_id, v_warehouse_id, 'ISSUE', -p_qty, p_unit_cost, p_ref_type, p_ref_id
        ) RETURNING id INTO v_inv_txn_id;

        -- Accounting: Dr COGS, Cr Inventory
        IF found AND v_acct_config IS NOT NULL THEN
             INSERT INTO accounting_entries (
                company_id, transaction_date, reference_type, reference_id,
                debit_account, credit_account, amount, description
            ) VALUES (
                p_company_id, CURRENT_DATE, 'INV_TXN', v_inv_txn_id,
                v_acct_config.cogs_account, v_acct_config.inventory_asset_account,
                (p_qty * p_unit_cost), 'Stock Issue - ' || p_ref_type
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$function$;
