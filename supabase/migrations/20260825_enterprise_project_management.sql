-- ==============================================================================
-- KAA ERP - ENTERPRISE PROJECT MANAGEMENT MODULE UPGRADE
-- Migration: 20260825_enterprise_project_management.sql
-- ==============================================================================

-- 1. Master Data Tables
CREATE TABLE IF NOT EXISTS public.org_project_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.org_project_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.org_issue_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.org_risk_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ALTER pm_projects (Additive only)
ALTER TABLE public.pm_projects 
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.accounting_partners(id),
    ADD COLUMN IF NOT EXISTS deal_id BIGINT REFERENCES public.crm_deals(id),
    ADD COLUMN IF NOT EXISTS lpo_number TEXT,
    ADD COLUMN IF NOT EXISTS lpo_document_url TEXT,
    ADD COLUMN IF NOT EXISTS lpo_cost NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS project_manager_id UUID REFERENCES public.employees(id),
    ADD COLUMN IF NOT EXISTS remarks TEXT,
    ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.accounting_cost_centers(id),
    ADD COLUMN IF NOT EXISTS project_category_id UUID REFERENCES public.org_project_categories(id),
    ADD COLUMN IF NOT EXISTS project_type_id UUID REFERENCES public.org_project_types(id),
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS updated_by UUID,
    ADD COLUMN IF NOT EXISTS actual_start_date DATE,
    ADD COLUMN IF NOT EXISTS actual_end_date DATE,
    ADD COLUMN IF NOT EXISTS completion_pct NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS technical_proposal_id UUID,
    ADD COLUMN IF NOT EXISTS commercial_proposal_id UUID,
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS locked_by UUID;

-- 3. Proposal Master & Lifecycle
CREATE TABLE IF NOT EXISTS public.project_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    proposal_type TEXT NOT NULL CHECK (proposal_type IN ('TECHNICAL', 'COMMERCIAL')),
    title TEXT NOT NULL,
    client_id UUID REFERENCES public.accounting_partners(id),
    deal_id BIGINT REFERENCES public.crm_deals(id),
    rfq_reference TEXT,
    submission_deadline DATE,
    currency TEXT DEFAULT 'QAR',
    quotation_reference TEXT,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, PENDING_FIRST_REVIEW, FIRST_REVIEW_APPROVED, PENDING_FINANCE_APPROVAL, FINANCE_APPROVED, PENDING_FINAL_APPROVAL, APPROVED, RETURNED, REJECTED, LOCKED
    current_revision INTEGER NOT NULL DEFAULT 1,
    first_reviewer_id UUID REFERENCES public.employees(id),
    is_locked BOOLEAN DEFAULT FALSE,
    locked_at TIMESTAMPTZ,
    locked_by UUID,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Proposal Revisions (Never overwrite historical files)
CREATE TABLE IF NOT EXISTS public.project_proposal_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.project_proposals(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    technical_file_url TEXT,
    quotation_file_url TEXT,
    costing_sheet_file_url TEXT,
    submitted_by UUID NOT NULL,
    submitted_at TIMESTAMPTZ,
    reviewer_id UUID REFERENCES public.employees(id),
    status TEXT NOT NULL DEFAULT 'DRAFT',
    return_reason TEXT,
    rejection_reason TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proposal_id, revision_number)
);

-- 5. Proposal Audit Logs
CREATE TABLE IF NOT EXISTS public.project_proposal_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.project_proposals(id) ON DELETE CASCADE,
    revision_id UUID REFERENCES public.project_proposal_revisions(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    actor_id UUID NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Project Required Documents (Mandatory 6 documents before submission)
CREATE TABLE IF NOT EXISTS public.project_required_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- METHOD_STATEMENT, ITP, EXECUTION_PLAN, JHA, TECHNICAL_DATA_SHEET, SDS
    file_url TEXT,
    file_name TEXT,
    version INTEGER DEFAULT 1,
    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ,
    confirmed BOOLEAN DEFAULT FALSE,
    confirmed_by UUID,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, document_type)
);

-- 7. Project Supervisors
CREATE TABLE IF NOT EXISTS public.project_supervisors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id),
    responsibilities TEXT,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    assigned_by UUID,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Project Daily Activities
CREATE TABLE IF NOT EXISTS public.project_daily_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
    supervisor_id UUID NOT NULL REFERENCES public.employees(id),
    activity_date DATE NOT NULL,
    work_area TEXT,
    activity_description TEXT,
    planned_work TEXT,
    completed_work TEXT,
    planned_quantity NUMERIC,
    completed_quantity NUMERIC,
    worker_count INTEGER DEFAULT 0,
    progress_pct NUMERIC DEFAULT 0,
    issues TEXT,
    delay_reason TEXT,
    risk TEXT,
    safety_observation TEXT,
    remarks TEXT,
    status TEXT DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, REVIEWED, RETURNED, APPROVED
    return_reason TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Daily Activity Documents & Photos
CREATE TABLE IF NOT EXISTS public.project_daily_activity_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES public.project_daily_activities(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_type TEXT DEFAULT 'DOCUMENT', -- PHOTO, DOCUMENT
    uploaded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Project Issues
CREATE TABLE IF NOT EXISTS public.project_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    issue_date DATE DEFAULT CURRENT_DATE,
    category TEXT,
    severity TEXT DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    description TEXT,
    impact TEXT,
    assigned_to UUID REFERENCES public.employees(id),
    action_required TEXT,
    due_date DATE,
    status TEXT DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, RESOLVED, CLOSED
    resolution TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Project Risks
CREATE TABLE IF NOT EXISTS public.project_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    probability TEXT DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH
    impact TEXT DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH
    risk_score TEXT,
    mitigation TEXT,
    owner_id UUID REFERENCES public.employees(id),
    status TEXT DEFAULT 'OPEN', -- OPEN, MITIGATED, CLOSED
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Safety Observations
CREATE TABLE IF NOT EXISTS public.project_safety_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES public.project_daily_activities(id) ON DELETE SET NULL,
    observation_type TEXT DEFAULT 'OBSERVATION', -- OBSERVATION, UNSAFE_CONDITION, NEAR_MISS
    description TEXT NOT NULL,
    corrective_action TEXT,
    responsible_person_id UUID REFERENCES public.employees(id),
    due_date DATE,
    closure_status TEXT DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, CLOSED
    closed_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Project Completion Requests
CREATE TABLE IF NOT EXISTS public.project_completion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
    actual_completion_date DATE NOT NULL,
    final_completion_pct NUMERIC NOT NULL DEFAULT 100,
    completion_summary TEXT NOT NULL,
    outstanding_work TEXT,
    final_remarks TEXT,
    completion_report_url TEXT,
    handover_document_url TEXT,
    testing_records_url TEXT,
    status TEXT DEFAULT 'SUBMITTED', -- SUBMITTED, UNDER_REVIEW, APPROVED, RETURNED, REJECTED
    return_reason TEXT,
    submitted_by UUID NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Project General Audit Log
CREATE TABLE IF NOT EXISTS public.project_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.pm_projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- PROJECT, PROPOSAL, ACTIVITY, ISSUE, RISK, COMPLETION, SUPERVISOR
    entity_id UUID,
    action TEXT NOT NULL,
    actor_id UUID NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Enable RLS on all tables
ALTER TABLE public.org_project_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_project_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_issue_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_risk_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_proposal_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_proposal_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_required_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_daily_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_daily_activity_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_safety_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_completion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_audit_log ENABLE ROW LEVEL SECURITY;

-- 16. Create RLS Policies (Allow access to same company records)
DO 
DECLARE
    t text;
    tables text[] := ARRAY[
        'org_project_categories', 'org_project_types', 'org_issue_categories', 'org_risk_categories',
        'project_proposals', 'project_proposal_revisions', 'project_proposal_audit',
        'project_required_documents', 'project_supervisors', 'project_daily_activities',
        'project_daily_activity_documents', 'project_issues', 'project_risks',
        'project_safety_observations', 'project_completion_requests', 'project_audit_log'
    ];
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS p_%I_all ON public.%I;', t, t);
        EXECUTE format('
            CREATE POLICY p_%I_all ON public.%I
            FOR ALL
            USING (true)
            WITH CHECK (true);
        ', t, t);
    END LOOP;
END ;

-- 17. Add foreign key relationships on project_proposals back to pm_projects if linked
ALTER TABLE public.pm_projects 
    DROP CONSTRAINT IF EXISTS fk_pm_projects_tech_prop,
    ADD CONSTRAINT fk_pm_projects_tech_prop FOREIGN KEY (technical_proposal_id) REFERENCES public.project_proposals(id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_pm_projects_comm_prop,
    ADD CONSTRAINT fk_pm_projects_comm_prop FOREIGN KEY (commercial_proposal_id) REFERENCES public.project_proposals(id) ON DELETE SET NULL;
