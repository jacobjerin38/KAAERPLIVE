-- ==============================================================================
-- KAA ERP - Fix Frontend to Database Schema Mismatches
-- Migration: 20260813_fix_schema_mismatches.sql
-- ==============================================================================

-- 1. accounting_payments: Add missing fields used by Payments.tsx
ALTER TABLE public.accounting_payments
ADD COLUMN IF NOT EXISTS payment_category TEXT,
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account TEXT;

-- 2. employees: Add attendance/OT/geolocation settings used by EmployeeFormModal.tsx
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS punch_mode TEXT DEFAULT 'Any',
ADD COLUMN IF NOT EXISTS ot_applicable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS gps_punch_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS geo_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS geo_longitude NUMERIC,
ADD COLUMN IF NOT EXISTS geofence_radius_meters NUMERIC DEFAULT 100;

-- 3. attendance: Add missing geolocation, punch method, and duration fields
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS check_in_lat NUMERIC,
ADD COLUMN IF NOT EXISTS check_in_lng NUMERIC,
ADD COLUMN IF NOT EXISTS check_out_lat NUMERIC,
ADD COLUMN IF NOT EXISTS check_out_lng NUMERIC,
ADD COLUMN IF NOT EXISTS punch_method TEXT DEFAULT 'web',
ADD COLUMN IF NOT EXISTS attendance_status_id BIGINT,
ADD COLUMN IF NOT EXISTS duration NUMERIC DEFAULT 0;

-- 4. crm_contacts: Add created_by column used by CRM.tsx
ALTER TABLE public.crm_contacts
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
