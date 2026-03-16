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
ALTER TABLE inventory_transactions
ADD CONSTRAINT fk_inv_txn_warehouse
FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

ALTER TABLE inventory_reservations
ADD CONSTRAINT fk_inv_res_warehouse
FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);


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
CREATE POLICY "Tenant Isolation" ON item_master USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON inventory_transactions USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON inventory_reservations USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON warehouses USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON warehouse_zones USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON warehouse_bins USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON stock_movements USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON inventory_account_config USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON accounting_entries USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON grni_reconciliation USING (company_id = get_my_company_id());
