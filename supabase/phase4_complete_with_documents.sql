-- ==============================================================================
-- KAA ERP Phase 4 - Complete Procurement & Sales Migration
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART 1: PARTNER UPDATES
-- ------------------------------------------------------------------------------
ALTER TABLE accounting_partners
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_term_days INTEGER DEFAULT 30;

-- ------------------------------------------------------------------------------
-- PART 2: PURCHASE ORDERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL,
    partner_id UUID REFERENCES accounting_partners(id) NOT NULL,
    order_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE,
    warehouse_id UUID REFERENCES warehouses(id),
    state TEXT DEFAULT 'draft' CHECK (state IN ('draft', 'confirmed', 'received', 'cancelled')),
    notes TEXT,
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
    quantity_received NUMERIC DEFAULT 0,
    subtotal NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- RLS for Purchase Orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON purchase_orders;
DROP POLICY IF EXISTS "Tenant Isolation" ON purchase_order_lines;
CREATE POLICY "Tenant Isolation" ON purchase_orders USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON purchase_order_lines USING (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- PART 3: SALES ORDERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL,
    partner_id UUID REFERENCES accounting_partners(id) NOT NULL,
    order_date DATE DEFAULT CURRENT_DATE,
    commitment_date DATE,
    warehouse_id UUID REFERENCES warehouses(id),
    state TEXT DEFAULT 'draft' CHECK (state IN ('draft', 'confirmed', 'shipped', 'invoiced', 'cancelled')),
    notes TEXT,
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
    quantity_delivered NUMERIC DEFAULT 0,
    reservation_id UUID,
    subtotal NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- RLS for Sales Orders
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON sales_orders;
DROP POLICY IF EXISTS "Tenant Isolation" ON sales_order_lines;
CREATE POLICY "Tenant Isolation" ON sales_orders USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON sales_order_lines USING (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- PART 4: EMPLOYEE DOCUMENTS TABLE (Bug #10 Fix)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
    
    document_type TEXT NOT NULL, -- 'ID_PROOF', 'ADDRESS_PROOF', 'EDUCATION', 'EXPERIENCE', 'OTHER'
    document_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Supabase Storage path
    file_size INTEGER,
    mime_type TEXT,
    
    issue_date DATE,
    expiry_date DATE,
    verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    
    notes TEXT,
    is_active BOOLEAN DEFAULT true
);

ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON employee_documents;
CREATE POLICY "Tenant Isolation" ON employee_documents USING (company_id = get_my_company_id());

-- Create Storage Bucket for Employee Documents (run this separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', false);
