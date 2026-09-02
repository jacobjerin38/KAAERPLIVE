-- ========================================================
-- KAA ERP ENTERPRISE RECRUITMENT & ATS MODULE UPGRADE
-- Migration: 20260903030000_enterprise_recruitment_ats.sql
-- Strictly Additive, Tenant-Isolated, RLS-Enforced
-- ========================================================

-- 1. Non-destructive enhancements to recruitment_jobs
ALTER TABLE public.recruitment_jobs
  ADD COLUMN IF NOT EXISTS requisition_id uuid,
  ADD COLUMN IF NOT EXISTS vacancies integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS min_experience_years numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_experience_years numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS education_level text,
  ADD COLUMN IF NOT EXISTS required_skills text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_skills text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS application_deadline date,
  ADD COLUMN IF NOT EXISTS hiring_manager_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recruiter_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'QAR',
  ADD COLUMN IF NOT EXISTS responsibilities text;

-- 2. Job Requisitions (Manpower Requests & Approval)
CREATE TABLE IF NOT EXISTS public.recruitment_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requisition_no text NOT NULL,
  department_id bigint REFERENCES departments(id) ON DELETE SET NULL,
  position_title text NOT NULL,
  vacancies integer NOT NULL DEFAULT 1,
  employment_type text NOT NULL DEFAULT 'Full-time',
  location text NOT NULL,
  hiring_manager_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  reporting_manager_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  required_date date,
  priority text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  min_experience numeric DEFAULT 0,
  max_experience numeric DEFAULT 10,
  salary_min numeric,
  salary_max numeric,
  currency text DEFAULT 'QAR',
  education text,
  required_skills text[] DEFAULT '{}',
  preferred_skills text[] DEFAULT '{}',
  job_description text,
  business_justification text,
  is_replacement boolean DEFAULT false,
  replacement_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED')),
  workflow_instance_id uuid,
  rejection_reason text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- 3. Central Candidate Database
CREATE TABLE IF NOT EXISTS public.recruitment_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_code text,
  first_name text NOT NULL,
  last_name text,
  email text NOT NULL,
  phone text,
  current_location text,
  current_title text,
  current_company text,
  total_experience_years numeric DEFAULT 0,
  relevant_experience_years numeric DEFAULT 0,
  notice_period_days integer DEFAULT 30,
  current_salary numeric,
  expected_salary numeric,
  currency text DEFAULT 'QAR',
  highest_education text,
  education_degree text,
  education_institution text,
  linkedin_url text,
  portfolio_url text,
  photo_url text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TALENT_POOL', 'HIRED', 'ARCHIVED', 'DO_NOT_CONTACT')),
  pool_category text,
  source_name text,
  tags text[] DEFAULT '{}',
  rating integer DEFAULT 3 CHECK (rating >= 1 AND rating <= 5),
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  notes text
);

-- 4. Candidate Document & Resume Storage (Multi-Version)
CREATE TABLE IF NOT EXISTS public.recruitment_candidate_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size bigint,
  version_number integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  document_category text NOT NULL DEFAULT 'RESUME' CHECK (document_category IN ('RESUME', 'COVER_LETTER', 'CERTIFICATE', 'ID_PROOF', 'OTHER')),
  extracted_text text,
  parser_data jsonb DEFAULT '{}'::jsonb,
  parser_status text DEFAULT 'PENDING' CHECK (parser_status IN ('PENDING', 'PARSED', 'PARTIAL', 'FAILED')),
  parser_confidence text DEFAULT 'NOT_DETECTED' CHECK (parser_confidence IN ('HIGH', 'MEDIUM', 'LOW', 'NOT_DETECTED')),
  content_hash text,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- 5. Applications (Candidate linked to Job Opening)
CREATE TABLE IF NOT EXISTS public.recruitment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES recruitment_jobs(id) ON DELETE CASCADE,
  requisition_id uuid REFERENCES recruitment_requisitions(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'APPLIED' CHECK (stage IN (
    'APPLIED', 'RESUME_SCREENING', 'SHORTLISTED', 'PHONE_SCREEN', 'INTERVIEW',
    'TECHNICAL_INTERVIEW', 'MANAGER_INTERVIEW', 'HR_INTERVIEW', 'OFFER',
    'OFFER_ACCEPTED', 'HIRED', 'REJECTED', 'WITHDRAWN', 'ON_HOLD'
  )),
  stage_entered_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  match_score numeric DEFAULT 0,
  match_details jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'HIRED', 'REJECTED', 'WITHDRAWN', 'ON_HOLD')),
  rejection_reason text,
  source_name text,
  cover_letter text,
  applied_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Stage Movement Audit History
CREATE TABLE IF NOT EXISTS public.recruitment_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES recruitment_applications(id) ON DELETE CASCADE,
  old_stage text,
  new_stage text NOT NULL,
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reason_or_notes text
);

-- 7. Skills Master Dictionary
CREATE TABLE IF NOT EXISTS public.recruitment_skills_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text DEFAULT 'General',
  aliases text[] DEFAULT '{}',
  is_active boolean DEFAULT true
);

-- 8. Candidate Skills
CREATE TABLE IF NOT EXISTS public.recruitment_candidate_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  proficiency text DEFAULT 'INTERMEDIATE' CHECK (proficiency IN ('BEGINNER', 'INTERMEDIATE', 'EXPERT')),
  years_of_experience numeric DEFAULT 0,
  source text DEFAULT 'PARSED' CHECK (source IN ('PARSED', 'MANUAL'))
);

-- 9. Evaluation Scorecard Templates
CREATE TABLE IF NOT EXISTS public.recruitment_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  department_id bigint REFERENCES departments(id) ON DELETE SET NULL,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true
);

-- 10. Interview Schedules
CREATE TABLE IF NOT EXISTS public.recruitment_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES recruitment_applications(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  round_name text NOT NULL DEFAULT 'Round 1',
  interview_type text NOT NULL DEFAULT 'TECHNICAL' CHECK (interview_type IN ('PHONE', 'VIDEO', 'TECHNICAL', 'HR', 'MANAGER', 'FINAL')),
  scheduled_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  meeting_link text,
  location text,
  interviewer_ids uuid[] DEFAULT '{}',
  scorecard_id uuid REFERENCES recruitment_scorecards(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED')),
  notes text
);

-- 11. Interview Panel Evaluations
CREATE TABLE IF NOT EXISTS public.recruitment_interview_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  interview_id uuid NOT NULL REFERENCES recruitment_interviews(id) ON DELETE CASCADE,
  interviewer_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  criteria_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  overall_rating integer CHECK (overall_rating >= 1 AND overall_rating <= 5),
  recommendation text NOT NULL DEFAULT 'HOLD' CHECK (recommendation IN ('STRONG_HIRE', 'HIRE', 'HOLD', 'NO_HIRE')),
  comments text
);

-- 12. Offer Management
CREATE TABLE IF NOT EXISTS public.recruitment_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES recruitment_applications(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES recruitment_jobs(id) ON DELETE CASCADE,
  offer_number text NOT NULL,
  designation_id bigint REFERENCES org_designations(id) ON DELETE SET NULL,
  department_id bigint REFERENCES departments(id) ON DELETE SET NULL,
  basic_salary numeric NOT NULL DEFAULT 0,
  allowances jsonb DEFAULT '[]'::jsonb,
  total_salary numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'QAR',
  joining_date date NOT NULL,
  probation_months integer DEFAULT 6,
  notice_period_days integer DEFAULT 30,
  offer_expiry_date date,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED')),
  workflow_instance_id uuid,
  remarks text
);

-- 13. Recruitment Sources
CREATE TABLE IF NOT EXISTS public.recruitment_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel_type text NOT NULL DEFAULT 'JOB_BOARD' CHECK (channel_type IN ('PORTAL', 'REFERRAL', 'JOB_BOARD', 'AGENCY', 'CAMPUS', 'DIRECT', 'OTHER')),
  is_active boolean DEFAULT true
);

-- 14. Employee Referrals
CREATE TABLE IF NOT EXISTS public.recruitment_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  referrer_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  job_id uuid REFERENCES recruitment_jobs(id) ON DELETE SET NULL,
  referral_date date DEFAULT CURRENT_DATE,
  bonus_amount numeric DEFAULT 0,
  bonus_paid boolean DEFAULT false,
  notes text,
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'IN_REVIEW', 'HIRED', 'REJECTED'))
);

-- 15. Candidate Notes & Activity
CREATE TABLE IF NOT EXISTS public.recruitment_candidate_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  note_type text DEFAULT 'GENERAL',
  content text NOT NULL,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- 16. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.recruitment_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_skills_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_interview_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_candidate_notes ENABLE ROW LEVEL SECURITY;

-- 17. Multi-tenant isolation policies (company_id = get_my_company_id())
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'recruitment_requisitions',
    'recruitment_candidates',
    'recruitment_candidate_documents',
    'recruitment_applications',
    'recruitment_stage_history',
    'recruitment_skills_master',
    'recruitment_candidate_skills',
    'recruitment_scorecards',
    'recruitment_interviews',
    'recruitment_interview_evaluations',
    'recruitment_offers',
    'recruitment_sources',
    'recruitment_referrals',
    'recruitment_candidate_notes'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tenant_select_%I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_insert_%I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_update_%I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_delete_%I" ON public.%I', tbl, tbl);

    EXECUTE format('CREATE POLICY "tenant_select_%I" ON public.%I FOR SELECT USING (company_id = get_my_company_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "tenant_insert_%I" ON public.%I FOR INSERT WITH CHECK (company_id = get_my_company_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "tenant_update_%I" ON public.%I FOR UPDATE USING (company_id = get_my_company_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "tenant_delete_%I" ON public.%I FOR DELETE USING (company_id = get_my_company_id())', tbl, tbl);
  END LOOP;
END $$;

-- 18. Allow anon/public to insert into recruitment_applications and recruitment_candidates for Careers Portal
DROP POLICY IF EXISTS "careers_portal_insert_candidate" ON public.recruitment_candidates;
CREATE POLICY "careers_portal_insert_candidate" ON public.recruitment_candidates FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "careers_portal_insert_application" ON public.recruitment_applications;
CREATE POLICY "careers_portal_insert_application" ON public.recruitment_applications FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "careers_portal_insert_document" ON public.recruitment_candidate_documents;
CREATE POLICY "careers_portal_insert_document" ON public.recruitment_candidate_documents FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 19. Indexes for lightning-fast performance
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_email ON public.recruitment_candidates(company_id, email);
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_phone ON public.recruitment_candidates(company_id, phone);
CREATE INDEX IF NOT EXISTS idx_recruitment_applications_job ON public.recruitment_applications(company_id, job_id, stage);
CREATE INDEX IF NOT EXISTS idx_recruitment_applications_candidate ON public.recruitment_applications(company_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_interviews_app ON public.recruitment_interviews(company_id, application_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_offers_app ON public.recruitment_offers(company_id, application_id);
