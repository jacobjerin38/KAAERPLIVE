-- ==============================================================================
-- KAA ERP: Missing Master Data Tables (Bug Fix)
-- Run this SQL in Supabase to create missing organisation master data tables.
-- Uses DROP POLICY IF EXISTS to handle re-runs without errors.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Pay Groups (org_pay_groups)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_pay_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    pay_frequency TEXT DEFAULT 'MONTHLY', -- MONTHLY, WEEKLY, BI_WEEKLY
    salary_day INTEGER DEFAULT 28,
    attendance_required BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(company_id, code)
);
ALTER TABLE org_pay_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON org_pay_groups;
CREATE POLICY "Tenant Isolation" ON org_pay_groups USING (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- 2. Payroll Months (org_payroll_months)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_payroll_months (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    financial_year_id UUID REFERENCES org_financial_years(id),
    month_year DATE NOT NULL, -- First day of the payroll month (e.g., 2026-02-01)
    status TEXT DEFAULT 'OPEN', -- OPEN, PROCESSED, LOCKED
    is_active BOOLEAN DEFAULT true,
    UNIQUE(company_id, month_year)
);
ALTER TABLE org_payroll_months ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON org_payroll_months;
CREATE POLICY "Tenant Isolation" ON org_payroll_months USING (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- 3. Leave Calendar Years (org_leave_calendar_years)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_leave_calendar_years (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    year INTEGER NOT NULL, -- e.g., 2026
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    UNIQUE(company_id, year)
);
ALTER TABLE org_leave_calendar_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON org_leave_calendar_years;
CREATE POLICY "Tenant Isolation" ON org_leave_calendar_years USING (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- 4. Bank Configurations (org_bank_configs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_bank_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT,
    ifsc_code TEXT,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(company_id, code)
);
ALTER TABLE org_bank_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON org_bank_configs;
CREATE POLICY "Tenant Isolation" ON org_bank_configs USING (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- 5. Announcements (announcements)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'News', -- News, Event, Alert
    is_pinned BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    author_id UUID REFERENCES auth.users(id)
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON announcements;
CREATE POLICY "Tenant Isolation" ON announcements USING (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- 6. Polls (polls)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    question TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON polls;
CREATE POLICY "Tenant Isolation" ON polls USING (company_id = get_my_company_id());

-- Poll Options
CREATE TABLE IF NOT EXISTS poll_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    vote_count INTEGER DEFAULT 0
);
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON poll_options;
CREATE POLICY "Tenant Isolation" ON poll_options USING (
    EXISTS (SELECT 1 FROM polls WHERE polls.id = poll_options.poll_id AND polls.company_id = get_my_company_id())
);

-- Poll Votes
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    UNIQUE(poll_id, user_id) -- One vote per user per poll
);
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON poll_votes;
CREATE POLICY "Tenant Isolation" ON poll_votes USING (
    EXISTS (SELECT 1 FROM polls WHERE polls.id = poll_votes.poll_id AND polls.company_id = get_my_company_id())
);

-- ------------------------------------------------------------------------------
-- 7. Surveys (surveys)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surveys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    title TEXT NOT NULL,
    description TEXT,
    expiration_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON surveys;
CREATE POLICY "Tenant Isolation" ON surveys USING (company_id = get_my_company_id());

-- Survey Questions
CREATE TABLE IF NOT EXISTS survey_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'TEXT', -- TEXT, MULTIPLE_CHOICE, RATING
    options JSONB, -- For MC questions: ["Option A", "Option B"]
    is_required BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0
);
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON survey_questions;
CREATE POLICY "Tenant Isolation" ON survey_questions USING (
    EXISTS (SELECT 1 FROM surveys WHERE surveys.id = survey_questions.survey_id AND surveys.company_id = get_my_company_id())
);

-- Survey Responses
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    is_complete BOOLEAN DEFAULT false
);
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON survey_responses;
CREATE POLICY "Tenant Isolation" ON survey_responses USING (
    EXISTS (SELECT 1 FROM surveys WHERE surveys.id = survey_responses.survey_id AND surveys.company_id = get_my_company_id())
);

-- Survey Answers
CREATE TABLE IF NOT EXISTS survey_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    response_id UUID REFERENCES survey_responses(id) ON DELETE CASCADE,
    question_id UUID REFERENCES survey_questions(id) ON DELETE CASCADE,
    answer TEXT
);
ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON survey_answers;
CREATE POLICY "Tenant Isolation" ON survey_answers USING (
    EXISTS (SELECT 1 FROM survey_responses sr WHERE sr.id = survey_answers.response_id AND EXISTS (SELECT 1 FROM surveys WHERE surveys.id = sr.survey_id AND surveys.company_id = get_my_company_id()))
);

-- ------------------------------------------------------------------------------
-- 8. Kudos Categories (master_kudos_categories)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS master_kudos_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- Emoji or Lucide icon name
    points INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(company_id, name)
);
ALTER TABLE master_kudos_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON master_kudos_categories;
CREATE POLICY "Tenant Isolation" ON master_kudos_categories USING (company_id = get_my_company_id());

-- ------------------------------------------------------------------------------
-- 9. Financial Years (org_financial_years) - May already exist, IF NOT EXISTS protects
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_financial_years (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    code TEXT NOT NULL, -- e.g., 'FY2025-26'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    UNIQUE(company_id, code)
);
ALTER TABLE org_financial_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON org_financial_years;
CREATE POLICY "Tenant Isolation" ON org_financial_years USING (company_id = get_my_company_id());
