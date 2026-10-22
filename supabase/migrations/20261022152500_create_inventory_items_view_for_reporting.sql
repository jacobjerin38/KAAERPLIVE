-- Migration: 20261022152500_create_inventory_items_view_for_reporting.sql
-- Description: Creates the public.inventory_items and public.vw_inventory_items views for the Inventory Stock & Valuation reports.

CREATE OR REPLACE VIEW public.inventory_items AS
SELECT 
    im.id,
    im.company_id,
    im.code,
    im.code AS item_code,
    im.code AS sku,
    im.name,
    COALESCE(im.category, 'General') AS category,
    COALESCE(im.uom, 'Nos') AS uom,
    COALESCE(im.barcode, '') AS barcode,
    COALESCE(im.status, 'Active') AS status,
    COALESCE(im.weight, 0) AS weight,
    COALESCE(im.reorder_level, 0) AS reorder_level,
    COALESCE(im.reorder_qty, 0) AS reorder_qty,
    COALESCE(stock.qty_on_hand, 0) AS quantity_on_hand,
    COALESCE(im.standard_cost, 0) AS unit_cost,
    COALESCE(im.standard_cost, 0) AS buying_price,
    COALESCE(im.standard_cost, 0) AS selling_price,
    COALESCE(stock.total_val, 0) AS total_value,
    im.created_at
FROM public.item_master im
LEFT JOIN (
    SELECT 
        it.item_id,
        it.company_id,
        SUM(it.quantity) AS qty_on_hand,
        SUM(it.total_value) AS total_val
    FROM public.inventory_transactions it
    GROUP BY it.item_id, it.company_id
) stock ON stock.item_id = im.id AND stock.company_id = im.company_id;

CREATE OR REPLACE VIEW public.vw_inventory_items AS 
SELECT * FROM public.inventory_items;

GRANT SELECT ON public.inventory_items TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_inventory_items TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
