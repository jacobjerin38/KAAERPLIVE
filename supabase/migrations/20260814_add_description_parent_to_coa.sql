-- ==============================================================================
-- KAA ERP - Add Missing Columns to Chart of Accounts
-- Migration: 20260814_add_description_parent_to_coa.sql
-- ==============================================================================

ALTER TABLE public.accounting_chart_of_accounts
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL;
