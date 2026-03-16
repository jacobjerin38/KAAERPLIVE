-- ==============================================================================
-- KAA ERP Phase 4.1 - Procurement & Sales Schema
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PARTNER UPDATES (Credit Limits, Payment Terms)
-- ------------------------------------------------------------------------------
ALTER TABLE accounting_partners
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_term_days INTEGER DEFAULT 30;

-- ------------------------------------------------------------------------------
-- 2. PURCHASE ORDERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    name TEXT NOT NULL, -- 'PO/2026/001'
    partner_id UUID REFERENCES accounting_partners(id) NOT NULL, -- Vendor
    
    order_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE, -- Expected Delivery
    
    warehouse_id UUID REFERENCES warehouses(id), -- Destination
    
    state TEXT DEFAULT 'draft' CHECK (state IN ('draft', 'confirmed', 'received', 'cancelled')),
    
    notes TEXT,
    
    -- Totals (Calculated on confirm/update)
    total_amount NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    
    item_id UUID REFERENCES item_master(id) NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC DEFAULT 0,
    
    quantity_received NUMERIC DEFAULT 0, -- Track partial receipts
    
    subtotal NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ------------------------------------------------------------------------------
-- 3. SALES ORDERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    name TEXT NOT NULL, -- 'SO/2026/001'
    partner_id UUID REFERENCES accounting_partners(id) NOT NULL, -- Customer
    
    order_date DATE DEFAULT CURRENT_DATE,
    commitment_date DATE, -- Promised Delivery
    
    warehouse_id UUID REFERENCES warehouses(id), -- Source
    
    state TEXT DEFAULT 'draft' CHECK (state IN ('draft', 'confirmed', 'shipped', 'invoiced', 'cancelled')),
    
    notes TEXT,
    
    -- Totals
    total_amount NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    
    order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE,
    
    item_id UUID REFERENCES item_master(id) NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC DEFAULT 0,
    
    quantity_delivered NUMERIC DEFAULT 0, -- Track partial shipments
    
    -- Reservation reference (Links to inventory_reservations)
    reservation_id UUID, -- REFERENCES inventory_reservations(id)
    
    subtotal NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ------------------------------------------------------------------------------
-- 4. RLS POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation" ON purchase_orders USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON purchase_order_lines USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON sales_orders USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON sales_order_lines USING (company_id = get_my_company_id());
