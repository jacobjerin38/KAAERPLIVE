-- Phase 13: Payroll Settings

-- 1. Create org_payroll_settings table
CREATE TABLE IF NOT EXISTS public.org_payroll_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    calculation_basis TEXT NOT NULL CHECK (calculation_basis IN ('CALENDAR_DAYS', 'FIXED_30_DAYS')),
    rounding_method TEXT NOT NULL CHECK (rounding_method IN ('NEAREST_INTEGER', 'ROUND_UP', 'ROUND_DOWN', 'NO_ROUNDING')),
    pf_employer_contribution NUMERIC DEFAULT 12.00,
    esi_employer_contribution NUMERIC DEFAULT 3.25,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Ensure one active setting per company (optional, but good practice. For now, assume just one row per company)
    CONSTRAINT uk_payroll_settings_company UNIQUE (company_id)
);

-- RLS
ALTER TABLE public.org_payroll_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users in same company" ON public.org_payroll_settings
    FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable insert access for users in same company" ON public.org_payroll_settings
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable update access for users in same company" ON public.org_payroll_settings
    FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- No Delete needed really, just update. But standard:
CREATE POLICY "Enable delete access for users in same company" ON public.org_payroll_settings
    FOR DELETE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
