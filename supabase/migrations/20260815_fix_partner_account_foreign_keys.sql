-- ==============================================================================
-- KAA ERP - Fix Partner and Item Master Account Foreign Keys
-- Migration: 20260815_fix_partner_account_foreign_keys.sql
-- ==============================================================================

-- 1. Drop stale legacy foreign keys pointing to old chart_of_accounts table
ALTER TABLE public.accounting_partners DROP CONSTRAINT IF EXISTS accounting_partners_property_account_payable_id_fkey;
ALTER TABLE public.accounting_partners DROP CONSTRAINT IF EXISTS accounting_partners_property_account_receivable_id_fkey;
ALTER TABLE public.item_master DROP CONSTRAINT IF EXISTS item_master_expense_account_id_fkey;
ALTER TABLE public.item_master DROP CONSTRAINT IF EXISTS item_master_income_account_id_fkey;
ALTER TABLE public.journals DROP CONSTRAINT IF EXISTS journals_default_account_id_fkey;
ALTER TABLE public.taxes DROP CONSTRAINT IF EXISTS taxes_account_id_fkey;
ALTER TABLE public.taxes DROP CONSTRAINT IF EXISTS taxes_refund_account_id_fkey;
ALTER TABLE public.fixed_assets DROP CONSTRAINT IF EXISTS fixed_assets_account_id_fkey;
ALTER TABLE public.fixed_assets DROP CONSTRAINT IF EXISTS fixed_assets_depreciation_account_id_fkey;

-- 2. Add proper foreign keys pointing to authoritative accounting_chart_of_accounts table
ALTER TABLE public.accounting_partners 
  ADD CONSTRAINT accounting_partners_property_account_payable_id_fkey 
  FOREIGN KEY (property_account_payable_id) REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.accounting_partners 
  ADD CONSTRAINT accounting_partners_property_account_receivable_id_fkey 
  FOREIGN KEY (property_account_receivable_id) REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.item_master 
  ADD CONSTRAINT item_master_expense_account_id_fkey 
  FOREIGN KEY (expense_account_id) REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.item_master 
  ADD CONSTRAINT item_master_income_account_id_fkey 
  FOREIGN KEY (income_account_id) REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL;
