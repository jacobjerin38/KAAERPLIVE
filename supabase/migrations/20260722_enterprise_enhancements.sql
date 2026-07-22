-- ==============================================================================
-- KAA ERP ENTERPRISE ENHANCEMENTS MIGRATION
-- Migration Date: 2026-07-22
-- Description: Additive migration for Employee Leave Authority, PRO Module (Madoob),
--              HRMS Separation Management, and Workflow Engine Support.
-- Production Safe: All operations are strictly additive.
-- ==============================================================================

-- 1. EMPLOYEE LEAVE AUTHORITY MAPPING TABLE
CREATE TABLE IF NOT EXISTS public.employee_leave_authority (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    approver_level_1 UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    approver_level_2 UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    approver_level_3 UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    CONSTRAINT chk_no_self_approval_l1 CHECK (employee_id <> approver_level_1),
    CONSTRAINT chk_no_self_approval_l2 CHECK (employee_id <> approver_level_2),
    CONSTRAINT chk_no_self_approval_l3 CHECK (employee_id <> approver_level_3),
    CONSTRAINT chk_diff_l1_l2 CHECK (approver_level_1 IS NULL OR approver_level_2 IS NULL OR approver_level_1 <> approver_level_2),
    CONSTRAINT chk_diff_l2_l3 CHECK (approver_level_2 IS NULL OR approver_level_3 IS NULL OR approver_level_2 <> approver_level_3),
    CONSTRAINT chk_diff_l1_l3 CHECK (approver_level_1 IS NULL OR approver_level_3 IS NULL OR approver_level_1 <> approver_level_3)
);

CREATE INDEX IF NOT EXISTS idx_emp_leave_auth_company ON public.employee_leave_authority(company_id);
CREATE INDEX IF NOT EXISTS idx_emp_leave_auth_employee ON public.employee_leave_authority(employee_id);

ALTER TABLE public.employee_leave_authority ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'employee_leave_authority' AND policyname = 'Tenant Isolation'
    ) THEN
        CREATE POLICY "Tenant Isolation" ON public.employee_leave_authority FOR ALL TO public USING (company_id = get_my_company_id());
    END IF;
END $$;


-- 2. PRO MODULE (PUBLIC RELATIONS OFFICE / MADOOB) TABLES
CREATE TABLE IF NOT EXISTS public.pro_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    title TEXT NOT NULL,
    application_number TEXT,
    applicant_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    application_type TEXT NOT NULL,
    sponsor_entity TEXT,
    submission_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED'
    cost NUMERIC DEFAULT 0,
    government_fees NUMERIC DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

ALTER TABLE public.pro_applications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'pro_applications' AND policyname = 'Tenant Isolation'
    ) THEN
        CREATE POLICY "Tenant Isolation" ON public.pro_applications FOR ALL TO public USING (company_id = get_my_company_id());
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pro_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    license_name TEXT NOT NULL,
    license_number TEXT NOT NULL,
    issuing_authority TEXT,
    issue_date DATE,
    expiry_date DATE,
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED'
    fee_amount NUMERIC DEFAULT 0,
    document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pro_licenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'pro_licenses' AND policyname = 'Tenant Isolation'
    ) THEN
        CREATE POLICY "Tenant Isolation" ON public.pro_licenses FOR ALL TO public USING (company_id = get_my_company_id());
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pro_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    document_name TEXT NOT NULL,
    document_type TEXT NOT NULL,
    document_number TEXT,
    entity_type TEXT DEFAULT 'EMPLOYEE', -- 'EMPLOYEE', 'COMPANY', 'VEHICLE'
    entity_id UUID,
    issue_date DATE,
    expiry_date DATE,
    status TEXT DEFAULT 'VALID', -- 'VALID', 'EXPIRING', 'EXPIRED'
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pro_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'pro_documents' AND policyname = 'Tenant Isolation'
    ) THEN
        CREATE POLICY "Tenant Isolation" ON public.pro_documents FOR ALL TO public USING (company_id = get_my_company_id());
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pro_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_name TEXT NOT NULL,
    renewal_due_date DATE NOT NULL,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'RENEWED'
    cost NUMERIC DEFAULT 0,
    assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pro_renewals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'pro_renewals' AND policyname = 'Tenant Isolation'
    ) THEN
        CREATE POLICY "Tenant Isolation" ON public.pro_renewals FOR ALL TO public USING (company_id = get_my_company_id());
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pro_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    task_name TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    priority TEXT DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED'
    assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    related_application_id UUID REFERENCES public.pro_applications(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pro_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'pro_tasks' AND policyname = 'Tenant Isolation'
    ) THEN
        CREATE POLICY "Tenant Isolation" ON public.pro_tasks FOR ALL TO public USING (company_id = get_my_company_id());
    END IF;
END $$;


-- 3. ADDITIVE ENHANCEMENTS TO RESIGNATIONS / SEPARATION TABLE
ALTER TABLE public.resignations ADD COLUMN IF NOT EXISTS separation_type TEXT DEFAULT 'RESIGNATION';
ALTER TABLE public.resignations ADD COLUMN IF NOT EXISTS notice_period_days INTEGER DEFAULT 0;
ALTER TABLE public.resignations ADD COLUMN IF NOT EXISTS relieving_date DATE;
ALTER TABLE public.resignations ADD COLUMN IF NOT EXISTS exit_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.resignations ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.resignations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.resignations ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'PENDING';

-- Done
