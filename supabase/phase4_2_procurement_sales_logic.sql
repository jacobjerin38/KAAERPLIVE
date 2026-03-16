-- ==============================================================================
-- KAA ERP Phase 4.2 - Procurement & Sales Logic (RPCs)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC: Create Purchase Order
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_create_purchase_order(
    p_partner_id UUID,
    p_warehouse_id UUID,
    p_lines JSONB, -- [{ "item_id": "...", "quantity": 10, "unit_price": 50 }, ...]
    p_expected_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order_id UUID;
    v_company_id UUID;
    v_order_name TEXT;
    v_line JSONB;
    v_total NUMERIC := 0;
BEGIN
    v_company_id := get_my_company_id();
    v_order_name := 'PO/' || to_char(now(), 'YYYY') || '/' || floor(random() * 10000)::text;

    -- Create Header
    INSERT INTO purchase_orders (company_id, name, partner_id, warehouse_id, expected_date, state)
    VALUES (v_company_id, v_order_name, p_partner_id, p_warehouse_id, COALESCE(p_expected_date, CURRENT_DATE + INTERVAL '7 days'), 'draft')
    RETURNING id INTO v_order_id;

    -- Create Lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        INSERT INTO purchase_order_lines (company_id, order_id, item_id, quantity, unit_price)
        VALUES (
            v_company_id, v_order_id, 
            (v_line->>'item_id')::UUID, 
            (v_line->>'quantity')::NUMERIC, 
            COALESCE((v_line->>'unit_price')::NUMERIC, 0)
        );
        v_total := v_total + ((v_line->>'quantity')::NUMERIC * COALESCE((v_line->>'unit_price')::NUMERIC, 0));
    END LOOP;

    UPDATE purchase_orders SET total_amount = v_total WHERE id = v_order_id;

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'name', v_order_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 2. RPC: Confirm Purchase Order
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_confirm_purchase_order(p_order_id UUID)
RETURNS JSONB AS $$
BEGIN
    UPDATE purchase_orders SET state = 'confirmed' WHERE id = p_order_id AND state = 'draft';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found or not in draft state');
    END IF;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 3. RPC: Receive Purchase Order (Creates GRN & Updates Stock)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_receive_purchase_order(
    p_order_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_line RECORD;
    v_target_bin_id UUID;
BEGIN
    SELECT * INTO v_order FROM purchase_orders WHERE id = p_order_id;
    
    IF v_order.state != 'confirmed' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order must be confirmed first');
    END IF;

    FOR v_line IN SELECT * FROM purchase_order_lines WHERE order_id = p_order_id LOOP
        IF v_line.quantity_received >= v_line.quantity THEN
            CONTINUE; -- Already fully received
        END IF;

        -- Find Putaway Bin
        v_target_bin_id := rpc_find_putaway_bin(v_line.item_id, v_order.warehouse_id, v_line.quantity);

        -- Inventory Transaction (IN)
        INSERT INTO inventory_transactions (company_id, transaction_type, item_id, warehouse_id, quantity, unit_cost, reference_type, reference_id)
        VALUES (v_order.company_id, 'GRN', v_line.item_id, v_order.warehouse_id, v_line.quantity, v_line.unit_price, 'PO', p_order_id);

        -- Stock Movement (IN)
        INSERT INTO stock_movements (company_id, item_id, movement_type, to_bin_id, quantity, reference_type, reference_id, performed_by)
        VALUES (v_order.company_id, v_line.item_id, 'IN', v_target_bin_id, v_line.quantity, 'PO', p_order_id, p_user_id);

        -- Update Line
        UPDATE purchase_order_lines SET quantity_received = v_line.quantity WHERE id = v_line.id;
    END LOOP;

    UPDATE purchase_orders SET state = 'received' WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- SALES LOGIC
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 4. RPC: Create Sales Order
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_create_sales_order(
    p_partner_id UUID,
    p_warehouse_id UUID,
    p_lines JSONB, -- [{ "item_id": "...", "quantity": 10, "unit_price": 100 }, ...]
    p_commitment_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order_id UUID;
    v_company_id UUID;
    v_order_name TEXT;
    v_line JSONB;
    v_total NUMERIC := 0;
BEGIN
    v_company_id := get_my_company_id();
    v_order_name := 'SO/' || to_char(now(), 'YYYY') || '/' || floor(random() * 10000)::text;

    -- Create Header
    INSERT INTO sales_orders (company_id, name, partner_id, warehouse_id, commitment_date, state)
    VALUES (v_company_id, v_order_name, p_partner_id, p_warehouse_id, p_commitment_date, 'draft')
    RETURNING id INTO v_order_id;

    -- Create Lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        INSERT INTO sales_order_lines (company_id, order_id, item_id, quantity, unit_price)
        VALUES (
            v_company_id, v_order_id, 
            (v_line->>'item_id')::UUID, 
            (v_line->>'quantity')::NUMERIC, 
            COALESCE((v_line->>'unit_price')::NUMERIC, 0)
        );
        v_total := v_total + ((v_line->>'quantity')::NUMERIC * COALESCE((v_line->>'unit_price')::NUMERIC, 0));
    END LOOP;

    UPDATE sales_orders SET total_amount = v_total WHERE id = v_order_id;

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'name', v_order_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 5. RPC: Confirm Sales Order (Creates Reservations)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_confirm_sales_order(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_line RECORD;
    v_available NUMERIC;
    v_reservation_id UUID;
BEGIN
    SELECT * INTO v_order FROM sales_orders WHERE id = p_order_id;

    IF v_order.state != 'draft' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order is not in draft state');
    END IF;

    -- Check availability and create reservations
    FOR v_line IN SELECT * FROM sales_order_lines WHERE order_id = p_order_id LOOP
        v_available := rpc_get_warehouse_stock(v_order.warehouse_id, v_line.item_id);
        IF v_available < v_line.quantity THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient stock for item: ' || v_line.item_id);
        END IF;

        -- Create reservation (if inventory_reservations table exists)
        INSERT INTO inventory_reservations (company_id, item_id, warehouse_id, quantity, reference_type, reference_id, status)
        VALUES (v_order.company_id, v_line.item_id, v_order.warehouse_id, v_line.quantity, 'SO', p_order_id, 'RESERVED')
        RETURNING id INTO v_reservation_id;

        UPDATE sales_order_lines SET reservation_id = v_reservation_id WHERE id = v_line.id;
    END LOOP;

    UPDATE sales_orders SET state = 'confirmed' WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 6. RPC: Ship Sales Order (Delivers Stock & Creates Invoice)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_ship_sales_order(
    p_order_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_line RECORD;
    v_source_bin_id UUID;
BEGIN
    SELECT * INTO v_order FROM sales_orders WHERE id = p_order_id;

    IF v_order.state != 'confirmed' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order must be confirmed first');
    END IF;

    FOR v_line IN SELECT * FROM sales_order_lines WHERE order_id = p_order_id LOOP
        IF v_line.quantity_delivered >= v_line.quantity THEN
            CONTINUE; -- Already shipped
        END IF;

        -- Find Source Bin (Simplified: First STORAGE bin)
        SELECT b.id INTO v_source_bin_id
        FROM warehouse_bins b JOIN warehouse_zones z ON b.zone_id = z.id
        WHERE z.warehouse_id = v_order.warehouse_id AND z.zone_type = 'STORAGE' LIMIT 1;

        -- Inventory Transaction (OUT)
        INSERT INTO inventory_transactions (company_id, transaction_type, item_id, warehouse_id, quantity, unit_cost, reference_type, reference_id)
        VALUES (v_order.company_id, 'DELIVERY', v_line.item_id, v_order.warehouse_id, v_line.quantity, v_line.unit_price, 'SO', p_order_id);

        -- Stock Movement (OUT)
        INSERT INTO stock_movements (company_id, item_id, movement_type, from_bin_id, quantity, reference_type, reference_id, performed_by)
        VALUES (v_order.company_id, v_line.item_id, 'OUT', v_source_bin_id, v_line.quantity, 'SO', p_order_id, p_user_id);

        -- Release reservation
        UPDATE inventory_reservations SET status = 'COMPLETED' WHERE id = v_line.reservation_id;

        -- Update Line
        UPDATE sales_order_lines SET quantity_delivered = v_line.quantity WHERE id = v_line.id;
    END LOOP;

    UPDATE sales_orders SET state = 'shipped' WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
