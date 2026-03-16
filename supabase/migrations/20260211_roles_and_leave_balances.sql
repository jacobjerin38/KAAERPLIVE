-- Migration: seed_default_roles_and_leave_balances
-- Sets existing profiles to admin role and creates employee_leave_balances table

-- 1. Set existing profiles to admin role
UPDATE profiles SET role = 'admin' WHERE role IS NULL OR role = 'member';

-- 2. Create employee_leave_balances table
CREATE TABLE IF NOT EXISTS employee_leave_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL,
    calendar_year_id UUID,
    total_balance NUMERIC DEFAULT 0,
    used NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(employee_id, leave_type_id, calendar_year_id)
);

ALTER TABLE employee_leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view employee_leave_balances" ON employee_leave_balances FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert employee_leave_balances" ON employee_leave_balances FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update employee_leave_balances" ON employee_leave_balances FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete employee_leave_balances" ON employee_leave_balances FOR DELETE USING (company_id = get_my_company_id());
