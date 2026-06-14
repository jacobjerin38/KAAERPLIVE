-- =================================================================================
-- Migration: 20260613_gap_features.sql
-- Description: Creates tables and RLS policies for missing competitor HRMS modules:
--              Benefits, Travel & Expenses, Performance & OKRs, and Recruitment (ATS)
-- =================================================================================

-- 1. BENEFITS & CLAIMS MANAGEMENT
CREATE TABLE IF NOT EXISTS hrms_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('MEDICAL_INSURANCE', 'AIR_TICKET', 'HOUSING', 'TRANSPORT', 'OTHER')),
    tier_name TEXT NOT NULL, -- e.g., 'Gold', 'Grade A Limit'
    coverage_details JSONB DEFAULT '{}'::jsonb,
    company_contribution NUMERIC(15, 2) DEFAULT 0.00,
    employee_contribution NUMERIC(15, 2) DEFAULT 0.00,
    annual_limit NUMERIC(15, 2),
    balance NUMERIC(15, 2),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED'))
);

ALTER TABLE hrms_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company benefits" ON hrms_benefits FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company benefits" ON hrms_benefits FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company benefits" ON hrms_benefits FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company benefits" ON hrms_benefits FOR DELETE USING (company_id = get_my_company_id());

CREATE TABLE IF NOT EXISTS hrms_benefit_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    benefit_id UUID REFERENCES hrms_benefits(id) ON DELETE SET NULL,
    claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
    claim_amount NUMERIC(15, 2) NOT NULL,
    receipt_url TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    workflow_instance_id UUID
);

ALTER TABLE hrms_benefit_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company benefit claims" ON hrms_benefit_claims FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company benefit claims" ON hrms_benefit_claims FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company benefit claims" ON hrms_benefit_claims FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company benefit claims" ON hrms_benefit_claims FOR DELETE USING (company_id = get_my_company_id());


-- 2. TRAVEL & EXPENSES MANAGEMENT
CREATE TABLE IF NOT EXISTS hrms_travel_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    estimated_cost NUMERIC(15, 2) DEFAULT 0.00,
    need_flight BOOLEAN DEFAULT false,
    need_hotel BOOLEAN DEFAULT false,
    flight_details TEXT,
    hotel_details TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
    workflow_instance_id UUID
);

ALTER TABLE hrms_travel_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company travel requests" ON hrms_travel_requests FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company travel requests" ON hrms_travel_requests FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company travel requests" ON hrms_travel_requests FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company travel requests" ON hrms_travel_requests FOR DELETE USING (company_id = get_my_company_id());

CREATE TABLE IF NOT EXISTS hrms_travel_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    travel_request_id UUID REFERENCES hrms_travel_requests(id) ON DELETE CASCADE,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL CHECK (category IN ('FLIGHT', 'HOTEL', 'MEAL', 'LOCAL_TRANSPORT', 'PER_DIEM', 'MISC')),
    amount NUMERIC(15, 2) NOT NULL,
    currency TEXT DEFAULT 'QAR',
    exchange_rate NUMERIC(10, 6) DEFAULT 1.000000,
    receipt_url TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID'))
);

ALTER TABLE hrms_travel_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company travel expenses" ON hrms_travel_expenses FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company travel expenses" ON hrms_travel_expenses FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company travel expenses" ON hrms_travel_expenses FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company travel expenses" ON hrms_travel_expenses FOR DELETE USING (company_id = get_my_company_id());


-- 3. PERFORMANCE & OKR MANAGEMENT
CREATE TABLE IF NOT EXISTS hrms_perf_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_value NUMERIC(15, 2) NOT NULL,
    current_value NUMERIC(15, 2) DEFAULT 0.00,
    unit TEXT DEFAULT '%',
    due_date DATE NOT NULL,
    weightage NUMERIC(5, 2) DEFAULT 1.00,
    status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'MISSED'))
);

ALTER TABLE hrms_perf_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company perf goals" ON hrms_perf_goals FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company perf goals" ON hrms_perf_goals FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company perf goals" ON hrms_perf_goals FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company perf goals" ON hrms_perf_goals FOR DELETE USING (company_id = get_my_company_id());

CREATE TABLE IF NOT EXISTS hrms_perf_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED'))
);

ALTER TABLE hrms_perf_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company perf cycles" ON hrms_perf_cycles FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company perf cycles" ON hrms_perf_cycles FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company perf cycles" ON hrms_perf_cycles FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company perf cycles" ON hrms_perf_cycles FOR DELETE USING (company_id = get_my_company_id());

CREATE TABLE IF NOT EXISTS hrms_perf_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES hrms_perf_cycles(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    self_rating NUMERIC(3, 2),
    self_comments TEXT,
    manager_rating NUMERIC(3, 2),
    manager_comments TEXT,
    final_rating NUMERIC(3, 2),
    status TEXT NOT NULL DEFAULT 'PENDING_SELF' CHECK (status IN ('PENDING_SELF', 'PENDING_MANAGER', 'COMPLETED'))
);

ALTER TABLE hrms_perf_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company perf reviews" ON hrms_perf_reviews FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company perf reviews" ON hrms_perf_reviews FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company perf reviews" ON hrms_perf_reviews FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company perf reviews" ON hrms_perf_reviews FOR DELETE USING (company_id = get_my_company_id());


-- 4. RECRUITMENT & TALENT ACQUISITION
CREATE TABLE IF NOT EXISTS recruitment_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
    location TEXT NOT NULL,
    employment_type TEXT NOT NULL, -- e.g., 'Full-time', 'Part-time', 'Contract'
    description TEXT NOT NULL,
    requirements TEXT,
    salary_range_min NUMERIC(15, 2),
    salary_range_max NUMERIC(15, 2),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
    views INTEGER DEFAULT 0
);

ALTER TABLE recruitment_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company jobs" ON recruitment_jobs FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company jobs" ON recruitment_jobs FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company jobs" ON recruitment_jobs FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company jobs" ON recruitment_jobs FOR DELETE USING (company_id = get_my_company_id());

CREATE TABLE IF NOT EXISTS recruitment_applicants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES recruitment_jobs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    resume_url TEXT NOT NULL,
    cover_letter TEXT,
    stage TEXT NOT NULL DEFAULT 'APPLIED' CHECK (stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER_MADE', 'HIRED', 'REJECTED')),
    interview_date TIMESTAMP WITH TIME ZONE,
    interviewer_notes TEXT,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5)
);

ALTER TABLE recruitment_applicants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company applicants" ON recruitment_applicants FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "Users can insert their company applicants" ON recruitment_applicants FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Users can update their company applicants" ON recruitment_applicants FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Users can delete their company applicants" ON recruitment_applicants FOR DELETE USING (company_id = get_my_company_id());
