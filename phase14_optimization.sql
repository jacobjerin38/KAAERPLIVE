-- Phase 14: Database Optimization & Indexing

-- 1. Payroll Records: optimize for fetching by run (Dashboard) and by employee (History)
CREATE INDEX IF NOT EXISTS idx_payroll_records_run_id ON payroll_records(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_id ON payroll_records(employee_id);

-- 2. Employees: optimize for "Fetch Active Employees" loop in Payroll Engine
CREATE INDEX IF NOT EXISTS idx_employees_company_status ON employees(company_id, status) WHERE status = 'Active';

-- 3. Attendance: optimize for admin reports / bulk fetch by date
-- Note: (employee_id, date) is already a UNIQUE constraint, so lookup by employee is fast.
-- This index helps when querying "Absent" people across the company for a date.
CREATE INDEX IF NOT EXISTS idx_attendance_company_date ON attendance(company_id, date);

-- 4. CRM: optimize for pipeline filters (if volume grows)
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(company_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assignee ON crm_tasks(company_id, assignee);

-- 5. Audit Logs: if large
CREATE INDEX IF NOT EXISTS idx_attendance_audit_date ON attendance(edited_at) WHERE edited_at IS NOT NULL;
