-- Migration: 20260912150000_project_proposals_reviewer_and_approver_workflow.sql
-- Description: Add final approver and two-stage review/approval tracking for Project Proposals

ALTER TABLE public.project_proposals 
    ADD COLUMN IF NOT EXISTS final_approver_id UUID REFERENCES public.employees(id),
    ADD COLUMN IF NOT EXISTS first_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_reviewed_by UUID REFERENCES public.employees(id),
    ADD COLUMN IF NOT EXISTS final_approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS final_approved_by UUID REFERENCES public.employees(id);

ALTER TABLE public.project_proposal_revisions 
    ADD COLUMN IF NOT EXISTS approver_id UUID REFERENCES public.employees(id);
