-- ==============================================================================
-- KAA ERP Phase 2 - Inventory, WMS, Accounting
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. INVENTORY MODULE
-- ------------------------------------------------------------------------------

-- Item Master (Global Catalog)
CREATE TABLE IF NOT EXISTS item_master (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- Can be linked to a master later
    uom TEXT NOT NULL, -- Unit of Measure (e.g., 'PCS', 'KG')
    valuation_method TEXT DEFAULT 'FIFO', -- 'FIFO', 'AVG'
    is_stockable BOOLEAN DEFAULT true,
    is_batch_tracked BOOLEAN DEFAULT false,
    is_serial_tracked BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'Active',
    UNIQUE(company_id, code)
);

-- Inventory Transactions (The Source of Truth)
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    posting_date DATE DEFAULT CURRENT_DATE,
    transaction_type TEXT NOT NULL, -- 'GRN', 'ISSUE', 'TRANSFER', 'ADJUSTMENT'
    item_id UUID REFERENCES item_master(id),
    warehouse_id UUID, -- References warehouses(id) - defined below
    quantity NUMERIC NOT NULL, -- Positive for IN, Negative for OUT
    unit_cost NUMERIC DEFAULT 0,
    total_value NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    reference_type TEXT, -- 'PO', 'SO', 'WO', 'ADJ'
    reference_id UUID, -- Link to source doc
    batch_number TEXT,
    serial_number TEXT
);

-- Inventory Reservations (Hard Allocation)
CREATE TABLE IF NOT EXISTS inventory_reservations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    item_id UUID REFERENCES item_master(id),
    warehouse_id UUID, -- References warehouses(id)
    reserved_qty NUMERIC NOT NULL,
    reference_type TEXT NOT NULL, -- 'SO', 'WO'
    reference_id UUID NOT NULL,
    status TEXT DEFAULT 'Active' -- 'Active', 'Released', 'Fulfilled'
);

-- ------------------------------------------------------------------------------
-- 2. WAREHOUSE MANAGEMENT SYSTEM (WMS)
-- ------------------------------------------------------------------------------

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(company_id, code)
);

-- Zones
CREATE TABLE IF NOT EXISTS warehouse_zones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    zone_type TEXT DEFAULT 'STORAGE', -- 'STORAGE', 'RECEIVING', 'SHIPPING'
    UNIQUE(warehouse_id, code)
);

-- Bins
CREATE TABLE IF NOT EXISTS warehouse_bins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    zone_id UUID REFERENCES warehouse_zones(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    capacity NUMERIC,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(zone_id, code)
);

-- Stock Movements (Physical Log)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    item_id UUID REFERENCES item_master(id),
    movement_type TEXT NOT NULL, -- 'IN', 'OUT', 'TRANSFER'
    from_bin_id UUID REFERENCES warehouse_bins(id),
    to_bin_id UUID REFERENCES warehouse_bins(id),
    quantity NUMERIC NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    performed_by UUID REFERENCES auth.users(id)
);

-- Add foreign key constraints for Inventory tables that reference warehouses
-- Safely add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inv_txn_warehouse') THEN
        ALTER TABLE inventory_transactions
        ADD CONSTRAINT fk_inv_txn_warehouse
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inv_res_warehouse') THEN
        ALTER TABLE inventory_reservations
        ADD CONSTRAINT fk_inv_res_warehouse
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 3. ACCOUNTING MODULE
-- ------------------------------------------------------------------------------

-- Financial Mapping for Items/Categories
CREATE TABLE IF NOT EXISTS inventory_account_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    category TEXT, -- Matches item_master.category or specific logic
    inventory_asset_account TEXT NOT NULL, -- GL Code
    cogs_account TEXT NOT NULL,
    stock_adjustment_account TEXT NOT NULL,
    grni_account TEXT NOT NULL
);

-- Accounting Entries (Immutable Journal Sub-ledger)
CREATE TABLE IF NOT EXISTS accounting_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    transaction_date DATE NOT NULL,
    description TEXT,
    reference_type TEXT, -- 'INV_TXN'
    reference_id UUID REFERENCES inventory_transactions(id),
    
    debit_account TEXT NOT NULL,
    credit_account TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    
    status TEXT DEFAULT 'POSTED',
    is_reversed BOOLEAN DEFAULT false,
    reversal_reason TEXT
);

-- GRNI Reconciliation (Goods Received Not Invoiced)
CREATE TABLE IF NOT EXISTS grni_reconciliation (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    po_reference TEXT NOT NULL,
    grn_reference_id UUID REFERENCES inventory_transactions(id),
    invoice_reference_id UUID, -- Future link to AP Invoice
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'OPEN' -- 'OPEN', 'MATCHED'
);


-- ------------------------------------------------------------------------------
-- 4. RLS POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE item_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_account_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE grni_reconciliation ENABLE ROW LEVEL SECURITY;

-- Apply Tenant Isolation Policies
-- Apply Tenant Isolation Policies (Drop first to ensure idempotency)
DROP POLICY IF EXISTS "Tenant Isolation" ON item_master;
CREATE POLICY "Tenant Isolation" ON item_master USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON inventory_transactions;
CREATE POLICY "Tenant Isolation" ON inventory_transactions USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON inventory_reservations;
CREATE POLICY "Tenant Isolation" ON inventory_reservations USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON warehouses;
CREATE POLICY "Tenant Isolation" ON warehouses USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON warehouse_zones;
CREATE POLICY "Tenant Isolation" ON warehouse_zones USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON warehouse_bins;
CREATE POLICY "Tenant Isolation" ON warehouse_bins USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON stock_movements;
CREATE POLICY "Tenant Isolation" ON stock_movements USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON inventory_account_config;
CREATE POLICY "Tenant Isolation" ON inventory_account_config USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON accounting_entries;
CREATE POLICY "Tenant Isolation" ON accounting_entries USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON grni_reconciliation;
CREATE POLICY "Tenant Isolation" ON grni_reconciliation USING (company_id = get_my_company_id());

-- ==============================================================================
-- KAA ERP Phase 2.1 - Advanced Inventory Operations
-- ==============================================================================

-- 1. Storage Categories (Cold, Dry, Hazardous, etc.)
CREATE TABLE IF NOT EXISTS storage_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(company_id, name)
);

-- 2. Inventory Adjustment Reasons (Damage, Theft, Cycle Count, etc.)
CREATE TABLE IF NOT EXISTS inventory_reasons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'ADJUSTMENT', 'SCRAP', 'RETURN'
    description TEXT,
    UNIQUE(company_id, name)
);

-- 3. Extend Item Master with Strategy Fields
-- Note: 'item_master' was created in phase2_inventory_wms_accounting.sql
ALTER TABLE item_master
ADD COLUMN IF NOT EXISTS storage_category_id UUID REFERENCES storage_categories(id),
ADD COLUMN IF NOT EXISTS putaway_strategy TEXT DEFAULT 'FIFO', -- 'FIFO', 'LIFO', 'FEFO'
ADD COLUMN IF NOT EXISTS picking_method TEXT DEFAULT 'FIFO'; -- 'FIFO', 'FEFO'

-- 4. Putaway Rules (Smart Bin Selection)
CREATE TABLE IF NOT EXISTS putaway_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
    storage_category_id UUID REFERENCES storage_categories(id), -- Matches item's storage category
    target_zone_id UUID REFERENCES warehouse_zones(id) NOT NULL,
    priority INTEGER DEFAULT 1, -- Lower number = Higher priority
    is_active BOOLEAN DEFAULT true
);

-- 5. Inventory Adjustments (Cycle Counts & Corrections)
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
    reason_id UUID REFERENCES inventory_reasons(id) NOT NULL,
    reference_number TEXT,
    adjustment_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'DRAFT', -- 'DRAFT', 'APPROVED', 'REJECTED'
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS inventory_adjustment_lines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    adjustment_id UUID REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
    item_id UUID REFERENCES item_master(id) NOT NULL,
    bin_id UUID REFERENCES warehouse_bins(id), -- Specific bin being adjusted
    batch_number TEXT,
    system_qty NUMERIC NOT NULL DEFAULT 0, -- Snapshot of what system thought
    counted_qty NUMERIC NOT NULL DEFAULT 0, -- Actual physical count
    difference_qty NUMERIC GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
    justification TEXT
);

-- 6. RLS Policies
ALTER TABLE storage_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE putaway_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustment_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation" ON storage_categories;
CREATE POLICY "Tenant Isolation" ON storage_categories USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON inventory_reasons;
CREATE POLICY "Tenant Isolation" ON inventory_reasons USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON putaway_rules;
CREATE POLICY "Tenant Isolation" ON putaway_rules USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON inventory_adjustments;
CREATE POLICY "Tenant Isolation" ON inventory_adjustments USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation" ON inventory_adjustment_lines;
CREATE POLICY "Tenant Isolation" ON inventory_adjustment_lines USING (company_id = get_my_company_id());

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
