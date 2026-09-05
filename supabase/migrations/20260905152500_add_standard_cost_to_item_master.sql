-- Migration: 20260905152500_add_standard_cost_to_item_master.sql
-- Description: Add standard_cost column to item_master table to allow unit price auto-population on Vendor Bills and Purchase entries

ALTER TABLE public.item_master 
ADD COLUMN IF NOT EXISTS standard_cost NUMERIC(15,2) DEFAULT 0.00;

COMMENT ON COLUMN public.item_master.standard_cost IS 'Standard procurement / purchase unit cost for the item';

-- Notify PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';
