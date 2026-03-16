-- ==============================================================================
-- KAA ERP Phase 3.1 - Core Manufacturing Schema
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. WORK CENTERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mrp_work_centers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    name TEXT NOT NULL, -- e.g., 'Assembly Line 1', 'Drill Station'
    code TEXT, -- 'WC-001'
    
    capacity_per_day NUMERIC DEFAULT 8, -- Hours/Day usually
    cost_per_hour NUMERIC DEFAULT 0, -- Overhead cost
    
    is_active BOOLEAN DEFAULT true,
    UNIQUE(company_id, name)
);

-- ------------------------------------------------------------------------------
-- 2. BILL OF MATERIALS (BOM)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mrp_bom (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    name TEXT NOT NULL, -- 'Table v1 BOM'
    product_id UUID REFERENCES item_master(id) NOT NULL, -- The finished good
    quantity NUMERIC DEFAULT 1, -- Output quantity (e.g. 1 Table)
    
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false -- Default BOM for this product
);

CREATE TABLE IF NOT EXISTS mrp_bom_lines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    bom_id UUID REFERENCES mrp_bom(id) ON DELETE CASCADE,
    
    item_id UUID REFERENCES item_master(id) NOT NULL, -- Raw Material
    quantity NUMERIC NOT NULL CHECK (quantity > 0), -- Qty required per BOM output
    
    uom TEXT -- Unit of Measure snapshot
);

-- ------------------------------------------------------------------------------
-- 3. PRODUCTION ORDERS (Work Orders)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mrp_production_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    name TEXT NOT NULL, -- 'MO/2026/001'
    
    product_id UUID REFERENCES item_master(id) NOT NULL,
    bom_id UUID REFERENCES mrp_bom(id), -- Optional, can mean ad-hoc
    
    quantity_to_produce NUMERIC NOT NULL CHECK (quantity_to_produce > 0),
    quantity_produced NUMERIC DEFAULT 0,
    
    date_planned DATE DEFAULT CURRENT_DATE,
    date_start TIMESTAMP WITH TIME ZONE,
    date_finished TIMESTAMP WITH TIME ZONE,
    
    work_center_id UUID REFERENCES mrp_work_centers(id), -- Main WC
    warehouse_id UUID REFERENCES warehouses(id), -- Where stock is taken/placed
    
    state TEXT DEFAULT 'draft' CHECK (state IN ('draft', 'confirmed', 'in_progress', 'done', 'cancelled')),
    
    notes TEXT
);

-- ------------------------------------------------------------------------------
-- 4. PRODUCTION MOVES (Planning & Execution)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mrp_production_moves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    production_order_id UUID REFERENCES mrp_production_orders(id) ON DELETE CASCADE,
    
    item_id UUID REFERENCES item_master(id) NOT NULL,
    
    move_type TEXT NOT NULL CHECK (move_type IN ('consumed', 'produced')),
    
    quantity_demand NUMERIC DEFAULT 0, -- Planned
    quantity_done NUMERIC DEFAULT 0, -- Actual
    
    -- Link to core inventory (The "Contract")
    -- This ID is populated ONLY when the move is actually processed via Logic
    stock_move_id UUID -- REFERENCES stock_movements(id) or inventory_transactions(id)
);

-- ------------------------------------------------------------------------------
-- 5. ITEM MASTER UPDATES
-- ------------------------------------------------------------------------------
ALTER TABLE item_master 
ADD COLUMN IF NOT EXISTS is_manufactured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_subcontracted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS default_bom_id UUID REFERENCES mrp_bom(id);


-- ------------------------------------------------------------------------------
-- 6. RLS POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE mrp_work_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrp_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrp_bom_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrp_production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrp_production_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation" ON mrp_work_centers USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON mrp_bom USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON mrp_bom_lines USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON mrp_production_orders USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON mrp_production_moves USING (company_id = get_my_company_id());
