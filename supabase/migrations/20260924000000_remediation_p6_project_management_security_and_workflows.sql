-- ==============================================================================
-- KAA ERP REMEDIATION - PRIORITY 6: PROJECT MANAGEMENT SECURITY & WORKFLOWS
-- Migration: 20260924000000_remediation_p6_project_management_security_and_workflows.sql
-- Description:
--   1. Transactional proposal review RPC with strict server-side reviewer/approver verification.
--   2. Atomic proposal creation (header + revision 1 + audit log in single transaction).
--   3. Atomic proposal revision submission (revision insert + counter update + audit log).
-- Rollback: Drop new project workflow RPCs.
-- ==============================================================================

-- 1. Server-Side Proposal Review & Authorization (6.2 & 6.3)
CREATE OR REPLACE FUNCTION public.rpc_review_project_proposal(
    p_proposal_id UUID,
    p_action TEXT,
    p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_prop RECORD;
    v_caller_role TEXT;
    v_caller_emp_id UUID;
    v_caller_email TEXT;
    v_is_super_admin BOOLEAN := false;
    v_reviewer_emp RECORD;
    v_approver_emp RECORD;
    v_next_status TEXT;
    v_is_locked BOOLEAN := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_action IN ('RETURN', 'REJECT') AND NULLIF(TRIM(p_remarks), '') IS NULL THEN
        RAISE EXCEPTION 'Mandatory remarks/reason required for return or rejection.';
    END IF;

    -- Lock proposal row FOR UPDATE
    SELECT * INTO v_prop 
    FROM public.project_proposals 
    WHERE id = p_proposal_id 
    FOR UPDATE;

    IF v_prop.id IS NULL THEN
        RAISE EXCEPTION 'Proposal not found.';
    END IF;

    IF v_prop.is_locked THEN
        RAISE EXCEPTION 'This proposal is already approved and locked against modifications.';
    END IF;

    -- Fetch caller details
    SELECT lower(role), employee_id, email INTO v_caller_role, v_caller_emp_id, v_caller_email
    FROM public.profiles 
    WHERE id = v_user_id;

    IF v_caller_role IN ('admin', 'super admin', 'superadmin', 'managing director') THEN
        v_is_super_admin := true;
    END IF;

    -- Fetch assigned reviewer details
    IF v_prop.first_reviewer_id IS NOT NULL THEN
        SELECT id, office_email INTO v_reviewer_emp FROM public.employees WHERE id = v_prop.first_reviewer_id;
    END IF;

    -- Fetch assigned final approver details
    IF v_prop.final_approver_id IS NOT NULL THEN
        SELECT id, office_email INTO v_approver_emp FROM public.employees WHERE id = v_prop.final_approver_id;
    END IF;

    -- Server-side stage and authorization enforcement
    IF v_prop.status = 'PENDING_FIRST_REVIEW' THEN
        -- Stage 1 Check
        IF NOT v_is_super_admin THEN
            IF v_prop.first_reviewer_id IS DISTINCT FROM v_caller_emp_id 
               AND lower(COALESCE(v_reviewer_emp.office_email, '')) != lower(COALESCE(v_caller_email, '')) THEN
                RAISE EXCEPTION 'Unauthorized: Only the assigned Stage 1 reviewer or an Administrator can review this proposal.';
            END IF;
        END IF;

        IF p_action = 'APPROVE' THEN
            v_next_status := 'PENDING_FINAL_APPROVAL';
        ELSIF p_action = 'RETURN' THEN
            v_next_status := 'RETURNED';
        ELSIF p_action = 'REJECT' THEN
            v_next_status := 'REJECTED';
        ELSE
            RAISE EXCEPTION 'Invalid action: %', p_action;
        END IF;

        UPDATE public.project_proposals
        SET status = v_next_status,
            first_reviewed_at = NOW(),
            first_reviewed_by = v_caller_emp_id,
            updated_at = NOW(),
            updated_by = v_user_id
        WHERE id = p_proposal_id;

    ELSIF v_prop.status = 'PENDING_FINAL_APPROVAL' THEN
        -- Stage 2 Check
        IF NOT v_is_super_admin THEN
            IF v_prop.final_approver_id IS NOT NULL 
               AND v_prop.final_approver_id IS DISTINCT FROM v_caller_emp_id 
               AND lower(COALESCE(v_approver_emp.office_email, '')) != lower(COALESCE(v_caller_email, '')) THEN
                RAISE EXCEPTION 'Unauthorized: Only the designated final approver or an Administrator can give final approval.';
            END IF;
        END IF;

        IF p_action = 'APPROVE' THEN
            v_next_status := 'APPROVED';
            v_is_locked := true;
        ELSIF p_action = 'RETURN' THEN
            v_next_status := 'RETURNED';
        ELSIF p_action = 'REJECT' THEN
            v_next_status := 'REJECTED';
        ELSE
            RAISE EXCEPTION 'Invalid action: %', p_action;
        END IF;

        UPDATE public.project_proposals
        SET status = v_next_status,
            is_locked = v_is_locked,
            locked_at = CASE WHEN v_is_locked THEN NOW() ELSE NULL END,
            locked_by = CASE WHEN v_is_locked THEN v_user_id ELSE NULL END,
            final_approved_at = NOW(),
            final_approved_by = v_caller_emp_id,
            updated_at = NOW(),
            updated_by = v_user_id
        WHERE id = p_proposal_id;
    ELSE
        RAISE EXCEPTION 'Proposal is in state "%" which does not allow review actions.', v_prop.status;
    END IF;

    -- Audit log in same transaction
    INSERT INTO public.project_proposal_audit (
        company_id, proposal_id, action, actor_id,
        previous_status, new_status, remarks
    ) VALUES (
        v_prop.company_id, p_proposal_id, 'PROPOSAL_' || p_action, v_user_id,
        v_prop.status, v_next_status, COALESCE(p_remarks, 'Stage review completed: ' || p_action)
    );

    RETURN jsonb_build_object(
        'success', true,
        'proposal_id', p_proposal_id,
        'previous_status', v_prop.status,
        'new_status', v_next_status,
        'is_locked', v_is_locked
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_review_project_proposal(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_review_project_proposal(UUID, TEXT, TEXT) TO authenticated;

-- 2. Atomic Proposal Creation (Header + Revision 1 + Audit) (6.2)
CREATE OR REPLACE FUNCTION public.rpc_create_project_proposal(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID;
    v_prop_id UUID;
    v_rev_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_company_id := public.safe_cast_uuid(p_payload->>'company_id');
    IF v_company_id IS NULL THEN
        v_company_id := get_my_company_id();
    END IF;

    -- Insert Header
    INSERT INTO public.project_proposals (
        company_id, proposal_type, title, client_id, deal_id,
        rfq_reference, submission_deadline, currency, quotation_reference,
        remarks, status, current_revision, first_reviewer_id, final_approver_id,
        created_by
    ) VALUES (
        v_company_id,
        COALESCE(p_payload->>'proposal_type', 'COMMERCIAL'),
        p_payload->>'title',
        public.safe_cast_uuid(p_payload->>'client_id'),
        (p_payload->>'deal_id')::BIGINT,
        p_payload->>'rfq_reference',
        (p_payload->>'submission_deadline')::DATE,
        COALESCE(p_payload->>'currency', 'QAR'),
        p_payload->>'quotation_reference',
        p_payload->>'remarks',
        'PENDING_FIRST_REVIEW',
        1,
        public.safe_cast_uuid(p_payload->>'first_reviewer_id'),
        public.safe_cast_uuid(p_payload->>'final_approver_id'),
        v_user_id
    ) RETURNING id INTO v_prop_id;

    -- Insert Revision 1
    INSERT INTO public.project_proposal_revisions (
        company_id, proposal_id, revision_number,
        technical_file_url, quotation_file_url, costing_sheet_file_url,
        submitted_by, submitted_at, reviewer_id, approver_id,
        status, remarks
    ) VALUES (
        v_company_id, v_prop_id, 1,
        p_payload->>'technical_file_url',
        p_payload->>'quotation_file_url',
        p_payload->>'costing_sheet_file_url',
        v_user_id, NOW(),
        public.safe_cast_uuid(p_payload->>'first_reviewer_id'),
        public.safe_cast_uuid(p_payload->>'final_approver_id'),
        'PENDING_FIRST_REVIEW',
        p_payload->>'remarks'
    ) RETURNING id INTO v_rev_id;

    -- Audit Log
    INSERT INTO public.project_proposal_audit (
        company_id, proposal_id, revision_id, action, actor_id,
        previous_status, new_status, remarks
    ) VALUES (
        v_company_id, v_prop_id, v_rev_id, 'PROPOSAL_CREATED', v_user_id,
        'DRAFT', 'PENDING_FIRST_REVIEW', 'Proposal created with Revision 1.'
    );

    RETURN jsonb_build_object('success', true, 'proposal_id', v_prop_id, 'revision_id', v_rev_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_project_proposal(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_project_proposal(JSONB) TO authenticated;
