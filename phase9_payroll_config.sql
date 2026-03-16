-- Phase 9: Payroll Configuration & Employee Mapping

-- 1. Update Payroll Groups
ALTER TABLE public.org_pay_groups 
ADD COLUMN IF NOT EXISTS pay_frequency TEXT CHECK (pay_frequency IN ('MONTHLY', 'WEEKLY', 'BI_WEEKLY')) DEFAULT 'MONTHLY',
ADD COLUMN IF NOT EXISTS salary_day INTEGER CHECK (salary_day BETWEEN 1 AND 31),
ADD COLUMN IF NOT EXISTS attendance_required BOOLEAN DEFAULT true;

-- 2. Employee Salary Components Mapping
CREATE TABLE IF NOT EXISTS public.employee_salary_components (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    salary_component_id UUID NOT NULL REFERENCES public.org_salary_components(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT uk_emp_salary_comp UNIQUE (employee_id, salary_component_id, effective_from)
);

-- RLS
ALTER TABLE public.employee_salary_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users in same company" ON public.employee_salary_components
    FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable write access for admins in same company" ON public.employee_salary_components
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable update access for admins in same company" ON public.employee_salary_components
    FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable delete access for admins in same company" ON public.employee_salary_components
    FOR DELETE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
