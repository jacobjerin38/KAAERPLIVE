-- Report Engine Schema

-- 1. Report Schema Registry: Defines available columns for the builder
CREATE TABLE IF NOT EXISTS report_schema_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module TEXT NOT NULL, -- 'EMPLOYEE', 'ATTENDANCE', 'CRM'
    field_key TEXT NOT NULL, -- 'email', 'department.name'
    field_label TEXT NOT NULL, -- 'Email Address', 'Department'
    data_type TEXT NOT NULL, -- 'text', 'number', 'date', 'boolean'
    is_filterable BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Report Definitions: Saved reports
CREATE TABLE IF NOT EXISTS report_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    module TEXT NOT NULL,
    config JSONB NOT NULL, -- { columns: [], filters: [], sort: [] }
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Data for Employees Module
INSERT INTO report_schema_registry (module, field_key, field_label, data_type) VALUES
('EMPLOYEE', 'employee_code', 'Employee ID', 'text'),
('EMPLOYEE', 'name', 'Full Name', 'text'),
('EMPLOYEE', 'email', 'Email Address', 'text'),
('EMPLOYEE', 'designation.name', 'Designation', 'text'),
('EMPLOYEE', 'department.name', 'Department', 'text'),
('EMPLOYEE', 'join_date', 'Date of Joining', 'date'),
('EMPLOYEE', 'status', 'Status', 'text'),
('EMPLOYEE', 'office_mobile', 'Mobile Number', 'text'),
('EMPLOYEE', 'manager.name', 'Reporting Manager', 'text');

-- Seed Data for Attendance Module
INSERT INTO report_schema_registry (module, field_key, field_label, data_type) VALUES
('ATTENDANCE', 'date', 'Date', 'date'),
('ATTENDANCE', 'employee.name', 'Employee Name', 'text'),
('ATTENDANCE', 'status', 'Attendance Status', 'text'),
('ATTENDANCE', 'check_in', 'Check In Time', 'text'),
('ATTENDANCE', 'check_out', 'Check Out Time', 'text'),
('ATTENDANCE', 'duration', 'Duration (Hrs)', 'number');
