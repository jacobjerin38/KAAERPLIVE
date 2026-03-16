-- Phase 11: Payroll Engine

-- 1. Payroll Runs Table
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    financial_year_id UUID REFERENCES public.org_financial_years(id), -- Optional link
    month_year DATE NOT NULL, -- 1st of the month
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PROCESSING', 'COMPLETED', 'PAID')),
    total_net_pay NUMERIC DEFAULT 0,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT uk_payroll_run_month UNIQUE (company_id, month_year)
);

-- RLS
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users in same company" ON public.payroll_runs
    FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable write access for admins in same company" ON public.payroll_runs
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable update access for admins in same company" ON public.payroll_runs
    FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- 2. Payroll Records Table (Per Employee)
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    
    -- Attendance Data Snapshot
    total_days NUMERIC DEFAULT 0,
    payable_days NUMERIC DEFAULT 0,
    lop_days NUMERIC DEFAULT 0,
    
    -- Salary Snapshot
    base_salary NUMERIC DEFAULT 0, -- Monthly CTC/Base
    gross_earning NUMERIC DEFAULT 0,
    total_deduction NUMERIC DEFAULT 0,
    net_pay NUMERIC DEFAULT 0,
    
    -- Detailed Breakdown (JSONB for flexibility)
    components_breakdown JSONB DEFAULT '{}'::jsonb, 
    -- Structure: { "earnings": [{name, amount}], "deductions": [{name, amount}] }
    
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'APPROVED', 'PAID')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT uk_payroll_record_employee UNIQUE (payroll_run_id, employee_id)
);

-- RLS
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users in same company" ON public.payroll_records
    FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable write access for admins in same company" ON public.payroll_records
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable update access for admins in same company" ON public.payroll_records
    FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable delete access for admins in same company" ON public.payroll_records
    FOR DELETE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
