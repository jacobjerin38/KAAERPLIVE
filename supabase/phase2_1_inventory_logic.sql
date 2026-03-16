-- ==============================================================================
-- KAA ERP Phase 2.1 - Inventory Logic (RPCs)
-- ==============================================================================

-- 1. RPC: Find Putaway Bin (Smart Bin Selection)
CREATE OR REPLACE FUNCTION rpc_find_putaway_bin(
    p_item_id UUID,
    p_warehouse_id UUID,
    p_qty NUMERIC DEFAULT 1
)
RETURNS UUID AS $$
DECLARE
    v_storage_category_id UUID;
    v_target_bin_id UUID;
    v_rule RECORD;
BEGIN
    -- 1. Get Item's Storage Category
    SELECT storage_category_id INTO v_storage_category_id
    FROM item_master
    WHERE id = p_item_id;

    -- 2. Find matching rules
    -- Priority: Specific Storage Category -> Generic (NULL category)
    FOR v_rule IN
        SELECT target_zone_id
        FROM putaway_rules
        WHERE warehouse_id = p_warehouse_id
        AND (storage_category_id = v_storage_category_id OR storage_category_id IS NULL)
        AND is_active = true
        ORDER BY priority ASC
    LOOP
        -- 3. Find an available bin in this zone
        -- Simple logic: First active bin. Future: Check capacity.
        SELECT id INTO v_target_bin_id
        FROM warehouse_bins
        WHERE zone_id = v_rule.target_zone_id
        AND is_active = true
        LIMIT 1;

        IF v_target_bin_id IS NOT NULL THEN
            RETURN v_target_bin_id;
        END IF;
    END LOOP;

    -- 4. Fallback: Any bin in STORAGE zone
    SELECT b.id INTO v_target_bin_id
    FROM warehouse_bins b
    JOIN warehouse_zones z ON b.zone_id = z.id
    WHERE z.warehouse_id = p_warehouse_id
    AND z.zone_type = 'STORAGE'
    LIMIT 1;

    -- 5. Fallback: Any bin in Warehouse
    IF v_target_bin_id IS NULL THEN
        SELECT b.id INTO v_target_bin_id
        FROM warehouse_bins b
        JOIN warehouse_zones z ON b.zone_id = z.id
        WHERE z.warehouse_id = p_warehouse_id
        LIMIT 1;
    END IF;

    RETURN v_target_bin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. RPC: Apply Inventory Adjustment (Stock Correction + Accounting)
CREATE OR REPLACE FUNCTION rpc_apply_adjustment(
    p_adjustment_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_adj RECORD;
    v_line RECORD;
    v_account_config RECORD;
    v_total_value NUMERIC;
    v_unit_cost NUMERIC;
    v_txn_type TEXT;
    v_new_txn_id UUID;
BEGIN
    -- 1. Get Adjustment Header
    SELECT * INTO v_adj FROM inventory_adjustments WHERE id = p_adjustment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Adjustment not found');
    END IF;

    IF v_adj.status != 'DRAFT' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Adjustment is not in DRAFT status');
    END IF;

    -- 2. Loop Lines
    FOR v_line IN SELECT * FROM inventory_adjustment_lines WHERE adjustment_id = p_adjustment_id LOOP
        
        -- Skip if no difference
        IF v_line.difference_qty = 0 THEN
            CONTINUE;
        END IF;

        -- Get Unit Cost (Simplified: Average or Standard Cost from Item Master or Last Txn)
        -- For now, let's assume standard cost or placeholder.
        v_unit_cost := 10; -- Placeholder cost
        
        -- Insert Inventory Transaction
        INSERT INTO inventory_transactions (
            company_id, transaction_type, item_id, warehouse_id, 
            quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            v_adj.company_id, 'ADJUSTMENT', v_line.item_id, v_adj.warehouse_id,
            v_line.difference_qty, v_unit_cost, 'INV_ADJ', p_adjustment_id
        ) RETURNING id INTO v_new_txn_id;

        -- Insert Stock Movement
        INSERT INTO stock_movements (
            company_id, item_id, movement_type, 
            from_bin_id, to_bin_id, quantity, 
            reference_type, reference_id, performed_by
        ) VALUES (
            v_adj.company_id, v_line.item_id, 
            CASE WHEN v_line.difference_qty > 0 THEN 'IN' ELSE 'OUT' END,
            CASE WHEN v_line.difference_qty < 0 THEN v_line.bin_id ELSE NULL END, -- From Bin (if OUT)
            CASE WHEN v_line.difference_qty > 0 THEN v_line.bin_id ELSE NULL END, -- To Bin (if IN)
            ABS(v_line.difference_qty),
            'INV_ADJ', p_adjustment_id, p_user_id
        );

        -- Accounting Entry (If configured)
        SELECT * INTO v_account_config 
        FROM inventory_account_config 
        WHERE company_id = v_adj.company_id 
        LIMIT 1;

        IF FOUND AND v_unit_cost > 0 THEN
            -- Value = Qty * Cost
            v_total_value := ABS(v_line.difference_qty) * v_unit_cost;

            IF v_line.difference_qty > 0 THEN
                -- GAIN: Debit Inventory Asset, Credit Stock Adjustment (Gain)
                INSERT INTO accounting_entries (
                    company_id, transaction_date, description, reference_type, reference_id,
                    debit_account, credit_account, amount
                ) VALUES (
                    v_adj.company_id, CURRENT_DATE, 'Inventory Adjustment Gain', 'INV_TXN', v_new_txn_id,
                    v_account_config.inventory_asset_account, v_account_config.stock_adjustment_account, v_total_value
                );
            ELSE
                -- LOSS: Debit Stock Adjustment (Loss), Credit Inventory Asset
                INSERT INTO accounting_entries (
                    company_id, transaction_date, description, reference_type, reference_id,
                    debit_account, credit_account, amount
                ) VALUES (
                    v_adj.company_id, CURRENT_DATE, 'Inventory Adjustment Loss', 'INV_TXN', v_new_txn_id,
                    v_account_config.stock_adjustment_account, v_account_config.inventory_asset_account, v_total_value
                );
            END IF;
        END IF;

    END LOOP;

    -- 3. Update Status
    UPDATE inventory_adjustments 
    SET status = 'APPROVED', approved_by = p_user_id, approved_at = now() 
    WHERE id = p_adjustment_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
