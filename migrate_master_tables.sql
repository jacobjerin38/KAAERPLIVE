-- ==============================================================================
-- KAA ERP V1.1 - INCREMENTAL MIGRATION FOR MASTER DATA TABLES
-- Run this on existing database to ADD new master tables only
-- ==============================================================================

-- This script is safe to run on existing databases
-- It uses CREATE TABLE IF NOT EXISTS to avoid conflicts

-- ------------------------------------------------------------------------------
-- Core Organization Masters
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_designations (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_grades (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_employment_types (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

-- ------------------------------------------------------------------------------
-- HRMS-Specific Masters
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_probation_periods (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    duration_months INTEGER NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_confirmation_status (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_exit_reasons (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

-- ------------------------------------------------------------------------------
-- Payroll Masters
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_salary_components (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    component_type TEXT NOT NULL CHECK (component_type IN ('EARNING', 'DEDUCTION')),
    is_taxable BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_pay_groups (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    pay_frequency TEXT NOT NULL CHECK (pay_frequency IN ('WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY')),
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_bank_configs (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

-- ------------------------------------------------------------------------------
-- Leave Masters
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_leave_types (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    default_balance INTEGER DEFAULT 0,
    is_paid BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_leave_policies (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    leave_type_id BIGINT REFERENCES org_leave_types(id),
    max_consecutive_days INTEGER,
    can_carry_forward BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_holiday_calendar (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL,
    holiday_date DATE NOT NULL,
    is_mandatory BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- Attendance Masters
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_shift_timings (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_minutes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_weekoff_rules (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    weekdays TEXT[] NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_attendance_status (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    affects_salary BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_punch_rules (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    min_work_hours NUMERIC(4,2) DEFAULT 8.0,
    overtime_threshold_hours NUMERIC(4,2) DEFAULT 9.0,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

-- ------------------------------------------------------------------------------
-- Common Attribute Masters
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_faiths (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_marital_status (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_blood_groups (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS org_nationalities (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, code)
);

-- ------------------------------------------------------------------------------
-- Add New Columns to Existing Employees Table
-- ------------------------------------------------------------------------------

-- Add new columns IF they don't already exist
DO $$ 
BEGIN
    -- Personal Information
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='date_of_birth') THEN
        ALTER TABLE employees ADD COLUMN date_of_birth DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='age') THEN
        ALTER TABLE employees ADD COLUMN age INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='gender') THEN
        ALTER TABLE employees ADD COLUMN gender TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='faith_id') THEN
        ALTER TABLE employees ADD COLUMN faith_id BIGINT REFERENCES org_faiths(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='blood_group_id') THEN
        ALTER TABLE employees ADD COLUMN blood_group_id BIGINT REFERENCES org_blood_groups(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='marital_status_id') THEN
        ALTER TABLE employees ADD COLUMN marital_status_id BIGINT REFERENCES org_marital_status(id);
    END IF;
    
    -- Contact Information
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='personal_mobile') THEN
        ALTER TABLE employees ADD COLUMN personal_mobile TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='office_mobile') THEN
        ALTER TABLE employees ADD COLUMN office_mobile TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='personal_email') THEN
        ALTER TABLE employees ADD COLUMN personal_email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='office_email') THEN
        ALTER TABLE employees ADD COLUMN office_email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='current_address') THEN
        ALTER TABLE employees ADD COLUMN current_address TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='permanent_address') THEN
        ALTER TABLE employees ADD COLUMN permanent_address TEXT;
    END IF;
    
    -- Job Information
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='department_id') THEN
        ALTER TABLE employees ADD COLUMN department_id UUID REFERENCES departments(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='designation_id') THEN
        ALTER TABLE employees ADD COLUMN designation_id BIGINT REFERENCES org_designations(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='grade_id') THEN
        ALTER TABLE employees ADD COLUMN grade_id BIGINT REFERENCES org_grades(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='location_id') THEN
        ALTER TABLE employees ADD COLUMN location_id UUID REFERENCES locations(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='employment_type_id') THEN
        ALTER TABLE employees ADD COLUMN employment_type_id BIGINT REFERENCES org_employment_types(id);
    END IF;
    
    -- Payroll Information
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='pay_group_id') THEN
        ALTER TABLE employees ADD COLUMN pay_group_id BIGINT REFERENCES org_pay_groups(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='bank_name') THEN
        ALTER TABLE employees ADD COLUMN bank_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='account_number') THEN
        ALTER TABLE employees ADD COLUMN account_number TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='ifsc_code') THEN
        ALTER TABLE employees ADD COLUMN ifsc_code TEXT;
    END IF;
    
    -- Documents & System
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='profile_photo_url') THEN
        ALTER TABLE employees ADD COLUMN profile_photo_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='documents') THEN
        ALTER TABLE employees ADD COLUMN documents JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='user_account_linked') THEN
        ALTER TABLE employees ADD COLUMN user_account_linked BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='employee_code') THEN
        ALTER TABLE employees ADD COLUMN employee_code TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='role_id') THEN
        ALTER TABLE employees ADD COLUMN role_id UUID REFERENCES roles(id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- RLS Policies for Master Tables
-- ------------------------------------------------------------------------------

-- Enable RLS on all master tables
ALTER TABLE org_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_employment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_probation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_confirmation_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_exit_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pay_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_bank_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_holiday_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_shift_timings ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_weekoff_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_attendance_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_punch_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_faiths ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_marital_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_blood_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_nationalities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (use DO block to handle if policies already exist)
DO $$ 
BEGIN
    -- Designations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_designations' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_designations USING (company_id = get_my_company_id());
    END IF;
    
    -- Grades
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_grades' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_grades USING (company_id = get_my_company_id());
    END IF;
    
    -- Employment Types
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_employment_types' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_employment_types USING (company_id = get_my_company_id());
    END IF;
    
    -- (Continue for all other tables...)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_probation_periods' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_probation_periods USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_confirmation_status' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_confirmation_status USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_exit_reasons' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_exit_reasons USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_salary_components' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_salary_components USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_pay_groups' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_pay_groups USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_bank_configs' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_bank_configs USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_leave_types' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_leave_types USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_leave_policies' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_leave_policies USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_holiday_calendar' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_holiday_calendar USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_shift_timings' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_shift_timings USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_weekoff_rules' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_weekoff_rules USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_attendance_status' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_attendance_status USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_punch_rules' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_punch_rules USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_faiths' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_faiths USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_marital_status' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_marital_status USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_blood_groups' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_blood_groups USING (company_id = get_my_company_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_nationalities' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON org_nationalities USING (company_id = get_my_company_id());
    END IF;
END $$;

-- ==============================================================================
-- MIGRATION COMPLETE
-- ==============================================================================
