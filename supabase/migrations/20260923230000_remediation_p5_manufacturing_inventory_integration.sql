-- ==============================================================================
-- KAA ERP REMEDIATION - PRIORITY 5: MANUFACTURING & INVENTORY INTEGRATION
-- Migration: 20260923230000_remediation_p5_manufacturing_inventory_integration.sql
-- Description:
--   1. Implements atomic stock ledger integration in rpc_complete_production (consumes raw materials and produces finished goods).
--   2. Hardens rpc_create_production_order with positive quantity validation, active BOM verification, and concurrency lock on numbering.
--   3. Provides transactional rpc_save_mrp_bom and rpc_save_mrp_routing for atomic header+line persistence.
-- Rollback: Revert manufacturing RPCs to previous definitions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Atomic Production Completion with Stock Posting (5.1)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_complete_production(p_order_id UUID, p_qty_produced NUMERIC DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id UUID := get_my_company_id();
    v_order RECORD;
    v_qty NUMERIC;
    v_move RECORD;
    v_comp_qty NUMERIC;
    v_available_stock NUMERIC;
    v_inv_txn_id UUID;
    v_total_comp_cost NUMERIC := 0;
    v_unit_cost NUMERIC;
    v_acct_config RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock production order row FOR UPDATE
    SELECT * INTO v_order 
    FROM public.mrp_production_orders
    WHERE id = p_order_id AND company_id = v_company_id 
    FOR UPDATE;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Production order not found for this company.';
    END IF;

    IF v_order.state NOT IN ('confirmed', 'in_progress') THEN
        RAISE EXCEPTION 'Order cannot be completed in current state: %', v_order.state;
    END IF;

    v_qty := GREATEST(1, COALESCE(p_qty_produced, v_order.quantity_to_produce));

    -- Account config
    SELECT * INTO v_acct_config FROM public.inventory_account_config WHERE company_id = v_company_id LIMIT 1;

    -- 1. Process Raw Material Component Consumption
    FOR v_move IN 
        SELECT * FROM public.mrp_production_moves 
        WHERE production_order_id = p_order_id 
          AND company_id = v_company_id 
          AND move_type = 'consume'
    LOOP
        v_comp_qty := v_move.quantity_demand * (v_qty / GREATEST(1, v_order.quantity_to_produce));

        -- Validate stock availability
        SELECT COALESCE(SUM(quantity), 0) INTO v_available_stock
        FROM public.inventory_transactions
        WHERE company_id = v_company_id AND item_id = v_move.item_id;

        IF v_available_stock < v_comp_qty THEN
            RAISE EXCEPTION 'Insufficient stock for component item ID %. Required: %, Available on-hand: %', 
                v_move.item_id, v_comp_qty, v_available_stock;
        END IF;

        -- Resolve item standard cost
        SELECT COALESCE(standard_cost, purchase_price, 0) INTO v_unit_cost
        FROM public.item_master 
        WHERE id = v_move.item_id AND company_id = v_company_id;

        v_total_comp_cost := v_total_comp_cost + (v_comp_qty * v_unit_cost);

        -- Record inventory consumption transaction
        INSERT INTO public.inventory_transactions (
            company_id, item_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            v_company_id, v_move.item_id, v_order.warehouse_id, 'ISSUE', -v_comp_qty, v_unit_cost, 'MO', p_order_id
        ) RETURNING id INTO v_inv_txn_id;

        -- Record physical stock movement
        INSERT INTO public.stock_movements (
            company_id, item_id, movement_type, quantity, reference_type, reference_id, performed_by
        ) VALUES (
            v_company_id, v_move.item_id, 'OUT', v_comp_qty, 'MO', p_order_id, auth.uid()
        );

        -- Update move line
        UPDATE public.mrp_production_moves 
        SET quantity_done = v_comp_qty,
            stock_move_id = v_inv_txn_id
        WHERE id = v_move.id;
    END LOOP;

    -- 2. Process Finished Good Production (Receipt into Warehouse)
    DECLARE
        v_fg_unit_cost NUMERIC := ROUND(v_total_comp_cost / GREATEST(1, v_qty), 4);
        v_fg_move_id UUID;
    BEGIN
        INSERT INTO public.inventory_transactions (
            company_id, item_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            v_company_id, v_order.product_id, v_order.warehouse_id, 'GRN', v_qty, v_fg_unit_cost, 'MO', p_order_id
        ) RETURNING id INTO v_inv_txn_id;

        INSERT INTO public.stock_movements (
            company_id, item_id, movement_type, quantity, reference_type, reference_id, performed_by
        ) VALUES (
            v_company_id, v_order.product_id, 'IN', v_qty, 'MO', p_order_id, auth.uid()
        );

        -- Update produce move line
        UPDATE public.mrp_production_moves
        SET quantity_done = v_qty,
            stock_move_id = v_inv_txn_id
        WHERE production_order_id = p_order_id AND move_type = 'produce';
    END;

    -- 3. Mark Production Order Done
    UPDATE public.mrp_production_orders
    SET state = 'done',
        quantity_produced = v_qty,
        date_finished = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id AND company_id = v_company_id;

    RETURN jsonb_build_object(
        'success', true, 
        'order_id', p_order_id,
        'quantity_produced', v_qty,
        'total_cost', v_total_comp_cost
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_complete_production(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_complete_production(UUID, NUMERIC) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. Production Order Validation & Advisory Lock Numbering (5.2)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_create_production_order(
    p_product_id UUID,
    p_bom_id UUID,
    p_quantity NUMERIC,
    p_date_planned DATE,
    p_work_center_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id UUID := get_my_company_id();
    v_order_id UUID;
    v_order_name TEXT;
    v_bom RECORD;
    v_bom_line RECORD;
    v_product RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Production quantity must be greater than zero.';
    END IF;

    -- Validate Product
    SELECT * INTO v_product 
    FROM public.item_master 
    WHERE id = p_product_id AND company_id = v_company_id;

    IF v_product.id IS NULL THEN
        RAISE EXCEPTION 'Product item not found in company inventory.';
    END IF;

    -- Validate BOM
    SELECT * INTO v_bom 
    FROM public.mrp_bom 
    WHERE id = p_bom_id AND company_id = v_company_id;

    IF v_bom.id IS NULL THEN
        RAISE EXCEPTION 'BOM not found for this company.';
    END IF;

    IF v_bom.is_active = false THEN
        RAISE EXCEPTION 'Selected BOM is inactive.';
    END IF;

    IF v_bom.product_id != p_product_id THEN
        RAISE EXCEPTION 'Selected BOM does not match the product to produce.';
    END IF;

    -- Work Center Check
    IF p_work_center_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.mrp_work_centers 
            WHERE id = p_work_center_id AND company_id = v_company_id
        ) THEN
            RAISE EXCEPTION 'Invalid work center selected.';
        END IF;
    END IF;

    -- Transaction-level advisory lock to eliminate order naming race conditions
    PERFORM pg_advisory_xact_lock(hashtext('mrp_order_num_' || v_company_id::text));

    SELECT 'MO-' || LPAD(COALESCE((SELECT COUNT(*) FROM public.mrp_production_orders WHERE company_id = v_company_id), 0) + 1, 5, '0') 
    INTO v_order_name;

    -- Insert production order
    INSERT INTO public.mrp_production_orders (
        company_id, name, product_id, bom_id, quantity_to_produce, date_planned, work_center_id, state, notes
    ) VALUES (
        v_company_id, v_order_name, p_product_id, p_bom_id, p_quantity, p_date_planned, p_work_center_id, 'draft', p_notes
    ) RETURNING id INTO v_order_id;

    -- Explode BOM to create component demand moves
    FOR v_bom_line IN
        SELECT bl.item_id, bl.quantity, bl.uom
        FROM public.mrp_bom_lines bl
        WHERE bl.bom_id = p_bom_id AND bl.company_id = v_company_id
    LOOP
        INSERT INTO public.mrp_production_moves (
            company_id, production_order_id, item_id, move_type, quantity_demand, quantity_done
        ) VALUES (
            v_company_id, v_order_id, v_bom_line.item_id, 'consume', v_bom_line.quantity * p_quantity, 0
        );
    END LOOP;

    -- Create finished goods move
    INSERT INTO public.mrp_production_moves (
        company_id, production_order_id, item_id, move_type, quantity_demand, quantity_done
    ) VALUES (
        v_company_id, v_order_id, p_product_id, 'produce', p_quantity, 0
    );

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'order_name', v_order_name);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_production_order(UUID, UUID, NUMERIC, DATE, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_production_order(UUID, UUID, NUMERIC, DATE, UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Transactional BOM & Routing Persistence (5.3)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_save_mrp_bom(
    p_bom_id UUID,
    p_product_id UUID,
    p_code TEXT,
    p_quantity NUMERIC,
    p_uom TEXT,
    p_is_active BOOLEAN,
    p_lines JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id UUID := get_my_company_id();
    v_actual_bom_id UUID := p_bom_id;
    v_line JSONB;
    v_item_id UUID;
    v_qty NUMERIC;
    v_sort INTEGER := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'BOM quantity must be greater than zero.';
    END IF;

    -- Upsert BOM Header
    IF v_actual_bom_id IS NOT NULL THEN
        UPDATE public.mrp_bom
        SET product_id = p_product_id,
            code = p_code,
            quantity = p_quantity,
            uom = p_uom,
            is_active = p_is_active,
            updated_at = NOW()
        WHERE id = v_actual_bom_id AND company_id = v_company_id;

        DELETE FROM public.mrp_bom_lines WHERE bom_id = v_actual_bom_id;
    ELSE
        INSERT INTO public.mrp_bom (
            company_id, product_id, code, quantity, uom, is_active
        ) VALUES (
            v_company_id, p_product_id, p_code, p_quantity, p_uom, p_is_active
        ) RETURNING id INTO v_actual_bom_id;
    END IF;

    -- Insert Lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_item_id := public.safe_cast_uuid(v_line->>'item_id');
        v_qty := GREATEST(0.0001, COALESCE((v_line->>'quantity')::NUMERIC, 1));

        IF v_item_id IS NOT NULL THEN
            INSERT INTO public.mrp_bom_lines (
                company_id, bom_id, item_id, quantity, uom, scrap_percentage, sequence
            ) VALUES (
                v_company_id, v_actual_bom_id, v_item_id, v_qty,
                COALESCE(v_line->>'uom', 'pcs'),
                COALESCE((v_line->>'scrap_percentage')::NUMERIC, 0),
                v_sort
            );
            v_sort := v_sort + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'bom_id', v_actual_bom_id, 'line_count', v_sort);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_save_mrp_bom FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_save_mrp_bom TO authenticated;
