-- =================================================================================
-- Migration: 20260425_pending_features.sql
-- Description: Creates tables for Payroll Loans, Document Management, and Project Management
-- =================================================================================

-- 1. Payroll Enhancements (Loans & Overtime)
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS ot_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS loan_deduction NUMERIC(15,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS payroll_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    loan_type TEXT NOT NULL, -- e.g., 'Personal', 'Advance'
    amount NUMERIC(15,2) NOT NULL,
    emi_amount NUMERIC(15,2) NOT NULL,
    balance NUMERIC(15,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Paid'
    start_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE payroll_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company loans" ON payroll_loans FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company loans" ON payroll_loans FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company loans" ON payroll_loans FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company loans" ON payroll_loans FOR DELETE USING (company_id = get_my_company_id());

-- 2. Document Management
CREATE TABLE IF NOT EXISTS doc_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- 'Corporate', 'HR', 'Legal', etc.
    file_url TEXT NOT NULL,
    expiry_date DATE,
    access_level TEXT DEFAULT 'All', -- 'All', 'Management', 'HR'
    last_updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE doc_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company documents" ON doc_documents FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company documents" ON doc_documents FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company documents" ON doc_documents FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company documents" ON doc_documents FOR DELETE USING (company_id = get_my_company_id());

-- 3. Project Management Module
CREATE TABLE IF NOT EXISTS pm_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Planning', -- 'Planning', 'In Progress', 'Completed', 'On Hold'
    budget NUMERIC(15,2) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE pm_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company projects" ON pm_projects FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company projects" ON pm_projects FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company projects" ON pm_projects FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company projects" ON pm_projects FOR DELETE USING (company_id = get_my_company_id());

CREATE TABLE IF NOT EXISTS pm_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    assignee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'To Do', -- 'To Do', 'In Progress', 'Done'
    progress_pct INTEGER DEFAULT 0,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE pm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company tasks" ON pm_tasks FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company tasks" ON pm_tasks FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company tasks" ON pm_tasks FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company tasks" ON pm_tasks FOR DELETE USING (company_id = get_my_company_id());

CREATE TABLE IF NOT EXISTS pm_timesheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    hours NUMERIC(5,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE pm_timesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company timesheets" ON pm_timesheets FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company timesheets" ON pm_timesheets FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company timesheets" ON pm_timesheets FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company timesheets" ON pm_timesheets FOR DELETE USING (company_id = get_my_company_id());
