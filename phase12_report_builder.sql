-- Phase 12: Unified Report Builder

-- 1. Report Definitions Table (Saved Reports)
CREATE TABLE IF NOT EXISTS public.report_definitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    module TEXT NOT NULL, -- e.g., 'EMPLOYEE', 'ATTENDANCE'
    config JSONB NOT NULL DEFAULT '{}'::jsonb, 
    -- Config Example: { "columns": ["name", "email"], "filters": { "dept": "Sales" }, "sort": "name" }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),

    CONSTRAINT uk_report_name_company UNIQUE (company_id, name)
);

-- RLS
ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users in same company" ON public.report_definitions
    FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable write access for users in same company" ON public.report_definitions
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable update access for users in same company" ON public.report_definitions
    FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Enable delete access for users in same company" ON public.report_definitions
    FOR DELETE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));


-- 2. Report Schema Registry (Metadata for UI Picker)
CREATE TABLE IF NOT EXISTS public.report_schema_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module TEXT NOT NULL, -- e.g., 'EMPLOYEE'
    field_key TEXT NOT NULL, -- 'name', 'joining_date', 'department.name'
    field_label TEXT NOT NULL, -- 'Employee Name'
    data_type TEXT NOT NULL, -- 'string', 'date', 'number', 'currency', 'boolean'
    is_filterable BOOLEAN DEFAULT true,
    is_sortable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Public Read, Admin Write)
ALTER TABLE public.report_schema_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON public.report_schema_registry
    FOR SELECT TO authenticated USING (true);

-- Seed Initial Data for Employee Module
INSERT INTO public.report_schema_registry (module, field_key, field_label, data_type)
VALUES 
('EMPLOYEE', 'employee_code', 'Employee ID', 'string'),
('EMPLOYEE', 'name', 'Full Name', 'string'),
('EMPLOYEE', 'email', 'Email Address', 'string'),
('EMPLOYEE', 'designation.name', 'Designation', 'string'),
('EMPLOYEE', 'department.name', 'Department', 'string'),
('EMPLOYEE', 'join_date', 'Joining Date', 'date'),
('EMPLOYEE', 'mobile', 'Phone Number', 'string'),
('EMPLOYEE', 'status', 'Status', 'string')
ON CONFLICT DO NOTHING;

-- Seed Initial Data for Attendance Module
INSERT INTO public.report_schema_registry (module, field_key, field_label, data_type)
VALUES 
('ATTENDANCE', 'date', 'Date', 'date'),
('ATTENDANCE', 'employee.name', 'Employee Name', 'string'),
('ATTENDANCE', 'status', 'Status', 'string'), -- Present, Absent
('ATTENDANCE', 'check_in', 'Check In Time', 'time'),
('ATTENDANCE', 'check_out', 'Check Out Time', 'time'),
('ATTENDANCE', 'work_hours', 'Work Hours', 'number')
ON CONFLICT DO NOTHING;
