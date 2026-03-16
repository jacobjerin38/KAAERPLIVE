-- Phase 8: Foundational Financial Masters

-- 1. Financial Years Table
CREATE TABLE IF NOT EXISTS public.org_financial_years (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- e.g., 'FY2025-26'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT uk_financial_year_code UNIQUE (company_id, code)
);

-- Partial index to ensure only one active financial year per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_fy_per_company 
ON public.org_financial_years (company_id) 
WHERE (is_active = true);

-- RLS
ALTER TABLE public.org_financial_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users in same company" ON public.org_financial_years
    FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable write access for admins in same company" ON public.org_financial_years
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable update access for admins in same company" ON public.org_financial_years
    FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable delete access for admins in same company" ON public.org_financial_years
    FOR DELETE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));


-- 2. Payroll Months Table
CREATE TABLE IF NOT EXISTS public.org_payroll_months (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    financial_year_id UUID NOT NULL REFERENCES public.org_financial_years(id) ON DELETE CASCADE,
    month_year DATE NOT NULL, -- Stored as 1st of the month, e.g., '2025-04-01'
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'LOCKED', 'PROCESSED')),
    is_payroll_run BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT uk_payroll_month UNIQUE (company_id, month_year)
);

-- RLS
ALTER TABLE public.org_payroll_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users in same company" ON public.org_payroll_months
    FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable write access for admins in same company" ON public.org_payroll_months
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable update access for admins in same company" ON public.org_payroll_months
    FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable delete access for admins in same company" ON public.org_payroll_months
    FOR DELETE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));


-- 3. Leave Calendar Years Table
CREATE TABLE IF NOT EXISTS public.org_leave_calendar_years (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    year INTEGER NOT NULL, -- e.g., 2026
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT uk_leave_calendar_year UNIQUE (company_id, year)
);

-- Partial index for active leave calendar
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_lc_per_company 
ON public.org_leave_calendar_years (company_id) 
WHERE (is_active = true);

-- RLS
ALTER TABLE public.org_leave_calendar_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users in same company" ON public.org_leave_calendar_years
    FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable write access for admins in same company" ON public.org_leave_calendar_years
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable update access for admins in same company" ON public.org_leave_calendar_years
    FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable delete access for admins in same company" ON public.org_leave_calendar_years
    FOR DELETE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
