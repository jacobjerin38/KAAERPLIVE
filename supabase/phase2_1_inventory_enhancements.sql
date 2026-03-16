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

CREATE POLICY "Tenant Isolation" ON storage_categories USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON inventory_reasons USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON putaway_rules USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON inventory_adjustments USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON inventory_adjustment_lines USING (company_id = get_my_company_id());
