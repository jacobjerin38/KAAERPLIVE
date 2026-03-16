-- Create attendance table with audit columns
CREATE TABLE IF NOT EXISTS attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    employee_id UUID REFERENCES employees(id),
    date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status TEXT DEFAULT 'Absent',
    attendance_status_id BIGINT REFERENCES org_attendance_status(id),
    duration NUMERIC, -- hours
    
    -- Audit columns (Phase 10)
    edited_by UUID REFERENCES auth.users(id),
    edited_at TIMESTAMP WITH TIME ZONE,
    edit_reason TEXT,
    
    CONSTRAINT uk_attendance_emp_date UNIQUE (employee_id, date)
);

-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'attendance'
        AND policyname = 'Tenant Isolation'
    ) THEN
        CREATE POLICY "Tenant Isolation" ON attendance
            USING (company_id = get_my_company_id());
    END IF;
END
$$;

-- Allow insert/update for authenticated users (for now, refine later to Admins only)
CREATE POLICY "Users can insert attendance" ON attendance FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update attendance" ON attendance FOR UPDATE USING (company_id = get_my_company_id());
