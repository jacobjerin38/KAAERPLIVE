-- Migration: System Stability & Schema Reconciliation (Production)
-- Date: 2026-09-04
-- Strictly additive non-destructive migration ensuring zero frontend crashes

-- 1. Create org_payroll_settings table
CREATE TABLE IF NOT EXISTS public.org_payroll_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    calculation_basis TEXT NOT NULL DEFAULT 'CALENDAR_DAYS' CHECK (calculation_basis IN ('CALENDAR_DAYS', 'FIXED_30_DAYS')),
    rounding_method TEXT NOT NULL DEFAULT 'NEAREST_INTEGER' CHECK (rounding_method IN ('NEAREST_INTEGER', 'ROUND_UP', 'ROUND_DOWN', 'NO_ROUNDING')),
    pf_employer_contribution NUMERIC DEFAULT 12.00,
    esi_employer_contribution NUMERIC DEFAULT 3.25,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_payroll_settings_company UNIQUE (company_id)
);
ALTER TABLE public.org_payroll_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation org_payroll_settings" ON public.org_payroll_settings;
CREATE POLICY "Tenant Isolation org_payroll_settings" ON public.org_payroll_settings
    FOR ALL TO public USING (company_id = get_my_company_id());

-- 2. Add type column to workflow_steps
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflow_steps' AND column_name = 'type') THEN
        ALTER TABLE public.workflow_steps ADD COLUMN type TEXT DEFAULT 'APPROVAL';
    END IF;
END $$;

-- 3. Add stage_id and pending_target_stage_id to crm_deals
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_deals' AND column_name = 'stage_id') THEN
        ALTER TABLE public.crm_deals ADD COLUMN stage_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_deals' AND column_name = 'pending_target_stage_id') THEN
        ALTER TABLE public.crm_deals ADD COLUMN pending_target_stage_id TEXT;
    END IF;
END $$;

-- 4. Create poll_votes and rpc_vote_poll
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_poll_vote_employee UNIQUE (poll_id, employee_id)
);
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation poll_votes" ON public.poll_votes;
CREATE POLICY "Tenant Isolation poll_votes" ON public.poll_votes
    FOR ALL TO public USING (poll_id IN (SELECT id FROM public.polls WHERE company_id = get_my_company_id()));

CREATE OR REPLACE FUNCTION public.rpc_vote_poll(
    p_poll_id UUID,
    p_option_id UUID,
    p_employee_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.poll_votes 
    WHERE poll_id = p_poll_id AND employee_id = p_employee_id;
    
    IF v_count > 0 THEN
        RAISE EXCEPTION 'You have already voted on this poll.';
    END IF;

    INSERT INTO public.poll_votes (poll_id, option_id, employee_id)
    VALUES (p_poll_id, p_option_id, p_employee_id);

    UPDATE public.poll_options
    SET vote_count = vote_count + 1
    WHERE id = p_option_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create tool_tracking table
CREATE TABLE IF NOT EXISTS public.tool_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    tool_name TEXT NOT NULL,
    item_code TEXT,
    serial_number TEXT,
    quantity_out INTEGER DEFAULT 1,
    employee_id UUID REFERENCES public.employees(id),
    employee_name TEXT,
    department_id UUID,
    department_name TEXT,
    project_name TEXT,
    date_out DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_return_date DATE,
    remarks_out TEXT,
    approval_status TEXT DEFAULT 'Approved',
    quantity_returned INTEGER DEFAULT 0,
    date_returned DATE,
    condition_status TEXT,
    remarks_in TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.tool_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation tool_tracking" ON public.tool_tracking;
CREATE POLICY "Tenant Isolation tool_tracking" ON public.tool_tracking FOR ALL TO public USING (company_id = get_my_company_id());

-- 6. Create crm_activity_log table
CREATE TABLE IF NOT EXISTS public.crm_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    performed_by UUID REFERENCES public.employees(id)
);
ALTER TABLE public.crm_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation crm_activity_log" ON public.crm_activity_log;
CREATE POLICY "Tenant Isolation crm_activity_log" ON public.crm_activity_log FOR ALL TO public USING (company_id = get_my_company_id());

-- 7. Create CRM Sales Invoices & Delivery Notes
CREATE TABLE IF NOT EXISTS public.crm_sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    series TEXT,
    customer_id UUID,
    quotation_id UUID,
    invoice_date DATE,
    due_date DATE,
    status TEXT DEFAULT 'Draft',
    currency TEXT DEFAULT 'QAR',
    subtotal NUMERIC(15,2) DEFAULT 0.00,
    tax_amount NUMERIC(15,2) DEFAULT 0.00,
    discount_amount NUMERIC(15,2) DEFAULT 0.00,
    grand_total NUMERIC(15,2) DEFAULT 0.00,
    amount_paid NUMERIC(15,2) DEFAULT 0.00,
    terms_and_conditions TEXT,
    notes TEXT,
    owner_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.crm_sales_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation crm_sales_invoices" ON public.crm_sales_invoices;
CREATE POLICY "Tenant Isolation crm_sales_invoices" ON public.crm_sales_invoices FOR ALL TO public USING (company_id = get_my_company_id());

CREATE TABLE IF NOT EXISTS public.crm_sales_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.crm_sales_invoices(id) ON DELETE CASCADE,
    item_id UUID,
    item_name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
    rate NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    discount_percent NUMERIC(5,2) DEFAULT 0.00,
    tax_percent NUMERIC(5,2) DEFAULT 0.00,
    sort_order INTEGER DEFAULT 0
);
ALTER TABLE public.crm_sales_invoice_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation crm_sales_invoice_lines" ON public.crm_sales_invoice_lines;
CREATE POLICY "Tenant Isolation crm_sales_invoice_lines" ON public.crm_sales_invoice_lines FOR ALL TO public USING (
    invoice_id IN (SELECT id FROM public.crm_sales_invoices WHERE company_id = get_my_company_id())
);

CREATE TABLE IF NOT EXISTS public.crm_delivery_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    series TEXT,
    customer_id UUID,
    invoice_id UUID REFERENCES public.crm_sales_invoices(id) ON DELETE SET NULL,
    quotation_id UUID,
    delivery_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Pending',
    owner_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.crm_delivery_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation crm_delivery_notes" ON public.crm_delivery_notes;
CREATE POLICY "Tenant Isolation crm_delivery_notes" ON public.crm_delivery_notes FOR ALL TO public USING (company_id = get_my_company_id());

CREATE TABLE IF NOT EXISTS public.crm_delivery_note_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_note_id UUID REFERENCES public.crm_delivery_notes(id) ON DELETE CASCADE,
    item_id UUID,
    item_name TEXT NOT NULL,
    description TEXT,
    quantity_ordered NUMERIC(15,4) NOT NULL DEFAULT 0,
    quantity_delivered NUMERIC(15,4) NOT NULL DEFAULT 0,
    uom TEXT DEFAULT 'EA',
    sort_order INTEGER DEFAULT 0
);
ALTER TABLE public.crm_delivery_note_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation crm_delivery_note_lines" ON public.crm_delivery_note_lines;
CREATE POLICY "Tenant Isolation crm_delivery_note_lines" ON public.crm_delivery_note_lines FOR ALL TO public USING (
    delivery_note_id IN (SELECT id FROM public.crm_delivery_notes WHERE company_id = get_my_company_id())
);

-- 8. Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    employee_id UUID REFERENCES public.employees(id),
    amount NUMERIC DEFAULT 0,
    description TEXT,
    reason TEXT,
    status TEXT DEFAULT 'Pending'
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation expenses" ON public.expenses;
CREATE POLICY "Tenant Isolation expenses" ON public.expenses FOR ALL TO public USING (company_id = get_my_company_id());

NOTIFY pgrst, 'reload schema';
