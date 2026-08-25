import { supabase } from '../../lib/supabase';

// ============================================================================
// STORAGE & LOGGING HELPERS
// ============================================================================

export async function uploadProjectFile(
    companyId: string, 
    subfolder: string, 
    file: File
): Promise<string> {
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `projects/${companyId}/${subfolder}/${timestamp}_${sanitizedName}`;

    const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.warn('Storage upload notice:', error.message);
    }

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
    return publicUrl || filePath;
}

export async function sendNotification(payload: {
    companyId: string;
    userId: string;
    title: string;
    message: string;
    type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    link?: string;
}) {
    try {
        await supabase.from('notifications').insert([{
            company_id: payload.companyId,
            user_id: payload.userId,
            title: payload.title,
            message: payload.message,
            type: payload.type || 'INFO',
            link: payload.link || '/projects',
            is_read: false
        }]);
    } catch (err) {
        console.error('Failed to dispatch notification:', err);
    }
}

export async function logProposalAudit(payload: {
    companyId: string;
    proposalId: string;
    revisionId?: string | null;
    action: string;
    actorId: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    remarks?: string | null;
}) {
    try {
        await supabase.from('project_proposal_audit').insert([{
            company_id: payload.companyId,
            proposal_id: payload.proposalId,
            revision_id: payload.revisionId || null,
            action: payload.action,
            actor_id: payload.actorId,
            previous_status: payload.previousStatus || null,
            new_status: payload.newStatus || null,
            remarks: payload.remarks || null
        }]);
    } catch (err) {
        console.error('Failed to write proposal audit log:', err);
    }
}

export async function logProjectAudit(payload: {
    companyId: string;
    projectId: string;
    entityType: 'PROJECT' | 'PROPOSAL' | 'ACTIVITY' | 'ISSUE' | 'RISK' | 'COMPLETION' | 'SUPERVISOR';
    entityId?: string | null;
    action: string;
    actorId: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    remarks?: string | null;
}) {
    try {
        await supabase.from('project_audit_log').insert([{
            company_id: payload.companyId,
            project_id: payload.projectId,
            entity_type: payload.entityType,
            entity_id: payload.entityId || null,
            action: payload.action,
            actor_id: payload.actorId,
            previous_status: payload.previousStatus || null,
            new_status: payload.newStatus || null,
            remarks: payload.remarks || null
        }]);
    } catch (err) {
        console.error('Failed to write project audit log:', err);
    }
}

// ============================================================================
// PROPOSALS MANAGEMENT
// ============================================================================

export interface ProposalPayload {
    companyId: string;
    proposalType: 'TECHNICAL' | 'COMMERCIAL';
    title: string;
    clientId?: string | null;
    dealId?: number | null;
    rfqReference?: string | null;
    submissionDeadline?: string | null;
    currency?: string;
    quotationReference?: string | null;
    remarks?: string | null;
    firstReviewerId: string;
    technicalFile?: File | null;
    quotationFile?: File | null;
    costingSheetFile?: File | null;
    createdBy: string;
}

export async function fetchProposals(companyId: string, type?: 'TECHNICAL' | 'COMMERCIAL') {
    let query = supabase.from('project_proposals')
        .select(`
            *,
            client:client_id(id, name),
            first_reviewer:first_reviewer_id(id, name, email),
            revisions:project_proposal_revisions(
                id, revision_number, technical_file_url, quotation_file_url, costing_sheet_file_url,
                status, return_reason, rejection_reason, remarks, created_at,
                submitter:submitted_by(id, name)
            ),
            audit:project_proposal_audit(
                id, action, previous_status, new_status, remarks, created_at,
                actor:actor_id(id, full_name)
            )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

    if (type) {
        query = query.eq('proposal_type', type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function createProposal(payload: ProposalPayload) {
    if (!payload.firstReviewerId) {
        throw new Error('First Reviewer must be selected.');
    }
    if (payload.firstReviewerId === payload.createdBy) {
        throw new Error('Uploader cannot select themselves as the reviewer.');
    }

    // 1. Upload files
    let techUrl: string | null = null;
    let quoteUrl: string | null = null;
    let costingUrl: string | null = null;

    if (payload.proposalType === 'TECHNICAL') {
        if (!payload.technicalFile) throw new Error('Technical Proposal document is mandatory.');
        techUrl = await uploadProjectFile(payload.companyId, 'proposals/technical', payload.technicalFile);
    } else {
        if (!payload.quotationFile || !payload.costingSheetFile) {
            throw new Error('Both Quotation and Costing Sheet are mandatory for Commercial Proposals.');
        }
        quoteUrl = await uploadProjectFile(payload.companyId, 'proposals/commercial', payload.quotationFile);
        costingUrl = await uploadProjectFile(payload.companyId, 'proposals/commercial', payload.costingSheetFile);
    }

    // 2. Insert Proposal
    const { data: prop, error: propErr } = await supabase.from('project_proposals').insert([{
        company_id: payload.companyId,
        proposal_type: payload.proposalType,
        title: payload.title,
        client_id: payload.clientId || null,
        deal_id: payload.dealId || null,
        rfq_reference: payload.rfqReference || null,
        submission_deadline: payload.submissionDeadline || null,
        currency: payload.currency || 'QAR',
        quotation_reference: payload.quotationReference || null,
        remarks: payload.remarks || null,
        status: 'PENDING_FIRST_REVIEW',
        current_revision: 1,
        first_reviewer_id: payload.firstReviewerId,
        created_by: payload.createdBy
    }]).select().single();

    if (propErr) throw propErr;

    // 3. Insert Revision 1
    const { data: rev, error: revErr } = await supabase.from('project_proposal_revisions').insert([{
        company_id: payload.companyId,
        proposal_id: prop.id,
        revision_number: 1,
        technical_file_url: techUrl,
        quotation_file_url: quoteUrl,
        costing_sheet_file_url: costingUrl,
        submitted_by: payload.createdBy,
        submitted_at: new Date().toISOString(),
        reviewer_id: payload.firstReviewerId,
        status: 'PENDING_FIRST_REVIEW',
        remarks: payload.remarks
    }]).select().single();

    if (revErr) throw revErr;

    // 4. Audit Log
    await logProposalAudit({
        companyId: payload.companyId,
        proposalId: prop.id,
        revisionId: rev.id,
        action: 'CREATED_AND_SUBMITTED',
        actorId: payload.createdBy,
        previousStatus: 'DRAFT',
        newStatus: 'PENDING_FIRST_REVIEW',
        remarks: `Initial revision 1 registered and submitted to reviewer`
    });

    // 5. Notify Reviewer
    await sendNotification({
        companyId: payload.companyId,
        userId: payload.firstReviewerId,
        title: `New ${payload.proposalType === 'TECHNICAL' ? 'Technical' : 'Commercial'} Proposal Assigned`,
        message: `Proposal "${payload.title}" has been assigned to you for review.`,
        type: 'INFO',
        link: '/projects'
    });

    return prop;
}

export async function submitProposalRevision(payload: {
    companyId: string;
    proposalId: string;
    reviewerId: string;
    technicalFile?: File | null;
    quotationFile?: File | null;
    costingSheetFile?: File | null;
    remarks?: string | null;
    submittedBy: string;
}) {
    const { data: prop, error: propErr } = await supabase.from('project_proposals')
        .select('*')
        .eq('id', payload.proposalId)
        .single();
    if (propErr || !prop) throw new Error('Proposal not found');

    if (prop.is_locked) {
        throw new Error('This proposal is locked and cannot be revised.');
    }

    const nextRevNum = (prop.current_revision || 1) + 1;

    let techUrl: string | null = null;
    let quoteUrl: string | null = null;
    let costingUrl: string | null = null;

    if (prop.proposal_type === 'TECHNICAL') {
        if (!payload.technicalFile) throw new Error('New technical document is mandatory for revision.');
        techUrl = await uploadProjectFile(payload.companyId, 'proposals/technical', payload.technicalFile);
    } else {
        if (!payload.quotationFile || !payload.costingSheetFile) {
            throw new Error('Both Quotation and Costing Sheet are mandatory for commercial revision.');
        }
        quoteUrl = await uploadProjectFile(payload.companyId, 'proposals/commercial', payload.quotationFile);
        costingUrl = await uploadProjectFile(payload.companyId, 'proposals/commercial', payload.costingSheetFile);
    }

    const { data: rev, error: revErr } = await supabase.from('project_proposal_revisions').insert([{
        company_id: payload.companyId,
        proposal_id: prop.id,
        revision_number: nextRevNum,
        technical_file_url: techUrl,
        quotation_file_url: quoteUrl,
        costing_sheet_file_url: costingUrl,
        submitted_by: payload.submittedBy,
        submitted_at: new Date().toISOString(),
        reviewer_id: payload.reviewerId || prop.first_reviewer_id,
        status: 'PENDING_FIRST_REVIEW',
        remarks: payload.remarks
    }]).select().single();

    if (revErr) throw revErr;

    await supabase.from('project_proposals').update({
        current_revision: nextRevNum,
        status: 'PENDING_FIRST_REVIEW',
        first_reviewer_id: payload.reviewerId || prop.first_reviewer_id,
        updated_at: new Date().toISOString(),
        updated_by: payload.submittedBy
    }).eq('id', prop.id);

    await logProposalAudit({
        companyId: payload.companyId,
        proposalId: prop.id,
        revisionId: rev.id,
        action: 'REVISION_UPLOADED',
        actorId: payload.submittedBy,
        previousStatus: prop.status,
        newStatus: 'PENDING_FIRST_REVIEW',
        remarks: `Revision ${nextRevNum} submitted: ${payload.remarks || 'Updated proposal documents'}`
    });

    await sendNotification({
        companyId: payload.companyId,
        userId: payload.reviewerId || prop.first_reviewer_id,
        title: `Proposal Revision ${nextRevNum} Submitted`,
        message: `Proposal "${prop.title}" has a new revision pending your review.`,
        type: 'INFO',
        link: '/projects'
    });

    return rev;
}

export async function processProposalReview(payload: {
    companyId: string;
    proposalId: string;
    action: 'APPROVE' | 'RETURN' | 'REJECT';
    remarks: string;
    actorId: string;
    currentStage: 'FIRST_REVIEW' | 'FINANCE_REVIEW' | 'FINAL_APPROVAL';
}) {
    const { data: prop } = await supabase.from('project_proposals')
        .select('*')
        .eq('id', payload.proposalId)
        .single();
    if (!prop) throw new Error('Proposal not found');

    if (prop.is_locked) {
        throw new Error('This proposal is already approved and locked.');
    }

    if ((payload.action === 'RETURN' || payload.action === 'REJECT') && !payload.remarks.trim()) {
        throw new Error('Mandatory remarks/reason required for return or rejection.');
    }

    let nextStatus = prop.status;
    let isLocked = false;

    if (payload.action === 'RETURN') {
        nextStatus = 'RETURNED';
    } else if (payload.action === 'REJECT') {
        nextStatus = 'REJECTED';
    } else if (payload.action === 'APPROVE') {
        if (prop.proposal_type === 'TECHNICAL') {
            if (payload.currentStage === 'FIRST_REVIEW') {
                nextStatus = 'PENDING_FINAL_APPROVAL';
            } else {
                nextStatus = 'APPROVED';
                isLocked = true;
            }
        } else {
            if (payload.currentStage === 'FIRST_REVIEW') {
                nextStatus = 'PENDING_FINANCE_APPROVAL';
            } else if (payload.currentStage === 'FINANCE_REVIEW') {
                nextStatus = 'PENDING_FINAL_APPROVAL';
            } else {
                nextStatus = 'APPROVED';
                isLocked = true;
            }
        }
    }

    await supabase.from('project_proposals').update({
        status: nextStatus,
        is_locked: isLocked,
        locked_at: isLocked ? new Date().toISOString() : null,
        locked_by: isLocked ? payload.actorId : null,
        updated_at: new Date().toISOString(),
        updated_by: payload.actorId
    }).eq('id', prop.id);

    const { data: latestRev } = await supabase.from('project_proposal_revisions')
        .select('id')
        .eq('proposal_id', prop.id)
        .eq('revision_number', prop.current_revision)
        .maybeSingle();

    if (latestRev) {
        const revUpdates: any = { status: nextStatus };
        if (payload.action === 'RETURN') revUpdates.return_reason = payload.remarks;
        if (payload.action === 'REJECT') revUpdates.rejection_reason = payload.remarks;
        await supabase.from('project_proposal_revisions').update(revUpdates).eq('id', latestRev.id);
    }

    await logProposalAudit({
        companyId: payload.companyId,
        proposalId: prop.id,
        revisionId: latestRev?.id,
        action: `${payload.currentStage}_${payload.action}`,
        actorId: payload.actorId,
        previousStatus: prop.status,
        newStatus: nextStatus,
        remarks: payload.remarks
    });

    if (payload.action === 'RETURN' || payload.action === 'REJECT') {
        await sendNotification({
            companyId: payload.companyId,
            userId: prop.created_by,
            title: `Proposal ${payload.action === 'RETURN' ? 'Returned for Correction' : 'Rejected'}`,
            message: `Proposal "${prop.title}" was ${payload.action === 'RETURN' ? 'returned' : 'rejected'}: ${payload.remarks}`,
            type: payload.action === 'RETURN' ? 'WARNING' : 'ERROR',
            link: '/projects'
        });
    } else if (isLocked) {
        await sendNotification({
            companyId: payload.companyId,
            userId: prop.created_by,
            title: 'Proposal Approved & Locked',
            message: `Proposal "${prop.title}" has received final approval and is now locked for execution.`,
            type: 'SUCCESS',
            link: '/projects'
        });
    }

    return nextStatus;
}

export async function reassignProposalReviewer(payload: {
    companyId: string;
    proposalId: string;
    newReviewerId: string;
    reason: string;
    actorId: string;
}) {
    if (!payload.reason.trim()) throw new Error('Mandatory reason required for reviewer reassignment.');

    const { data: prop } = await supabase.from('project_proposals').select('*').eq('id', payload.proposalId).single();
    if (!prop) throw new Error('Proposal not found');

    const oldReviewerId = prop.first_reviewer_id;

    await supabase.from('project_proposals').update({
        first_reviewer_id: payload.newReviewerId,
        updated_at: new Date().toISOString(),
        updated_by: payload.actorId
    }).eq('id', prop.id);

    await logProposalAudit({
        companyId: payload.companyId,
        proposalId: prop.id,
        action: 'REVIEWER_REASSIGNED',
        actorId: payload.actorId,
        previousStatus: prop.status,
        newStatus: prop.status,
        remarks: `Reassigned from ${oldReviewerId} to ${payload.newReviewerId}. Reason: ${payload.reason}`
    });

    await sendNotification({
        companyId: payload.companyId,
        userId: payload.newReviewerId,
        title: 'Proposal Review Reassigned to You',
        message: `Proposal "${prop.title}" has been reassigned to you for review.`,
        type: 'INFO',
        link: '/projects'
    });
}

// ============================================================================
// PROJECTS CREATION & EXECUTION
// ============================================================================

export const MANDATORY_PROJECT_DOCUMENTS = [
    { type: 'METHOD_STATEMENT', label: 'Method Statement' },
    { type: 'ITP', label: 'Inspection & Test Plan (ITP)' },
    { type: 'EXECUTION_PLAN', label: 'Execution Plan / Project Schedule' },
    { type: 'JHA', label: 'Job Hazard Analysis (JHA)' },
    { type: 'TECHNICAL_DATA_SHEET', label: 'Technical Data Sheet' },
    { type: 'SDS', label: 'Safety Data Sheet (SDS)' },
];

export async function fetchProjects(companyId: string) {
    const { data, error } = await supabase.from('pm_projects')
        .select(`
            *,
            client:client_id(id, name),
            deal:deal_id(id, title),
            manager:project_manager_id(id, name, email),
            category:project_category_id(id, name),
            project_type:project_type_id(id, name),
            cost_center:cost_center_id(id, name, code),
            technical_proposal:technical_proposal_id(id, title, status),
            commercial_proposal:commercial_proposal_id(id, title, status),
            documents:project_required_documents(
                id, document_type, file_url, file_name, version, confirmed, uploaded_at,
                uploader:uploaded_by(id, name)
            ),
            supervisors:project_supervisors(
                id, responsibilities, start_date, end_date, is_active,
                employee:employee_id(id, name, designation, email)
            ),
            activities:project_daily_activities(
                id, activity_date, work_area, activity_description, progress_pct, worker_count,
                status, remarks, created_at,
                supervisor:supervisor_id(id, name)
            ),
            issues:project_issues(id, title, severity, status, due_date),
            risks:project_risks(id, title, probability, impact, status),
            completion_request:project_completion_requests(
                id, actual_completion_date, final_completion_pct, completion_summary,
                completion_report_url, handover_document_url, testing_records_url, status
            )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function fetchProjectDetails(projectId: string) {
    const { data, error } = await supabase.from('pm_projects')
        .select(`
            *,
            client:client_id(id, name, primary_email, primary_phone),
            deal:deal_id(id, title, value),
            manager:project_manager_id(id, name, email, designation),
            category:project_category_id(id, name),
            project_type:project_type_id(id, name),
            cost_center:cost_center_id(id, name, code),
            technical_proposal:technical_proposal_id(id, title, status, quotation_reference),
            commercial_proposal:commercial_proposal_id(id, title, status, quotation_reference),
            documents:project_required_documents(
                id, document_type, file_url, file_name, version, confirmed, confirmed_at, uploaded_at,
                uploader:uploaded_by(id, name)
            ),
            supervisors:project_supervisors(
                id, responsibilities, start_date, end_date, is_active,
                employee:employee_id(id, name, designation, email)
            ),
            activities:project_daily_activities(
                id, activity_date, work_area, activity_description, planned_work, completed_work,
                planned_quantity, completed_quantity, progress_pct, worker_count, issues,
                delay_reason, risk, safety_observation, status, return_reason, remarks, created_at,
                supervisor:supervisor_id(id, name),
                docs:project_daily_activity_documents(id, file_url, file_name, file_type)
            ),
            issues:project_issues(
                id, title, issue_date, category, severity, description, impact, action_required, due_date, status, resolution,
                assignee:assigned_to(id, name)
            ),
            risks:project_risks(
                id, title, probability, impact, risk_score, mitigation, status,
                owner:owner_id(id, name)
            ),
            safety:project_safety_observations(
                id, observation_type, description, corrective_action, due_date, closure_status, closed_at,
                responsible_person:responsible_person_id(id, name)
            ),
            completion_request:project_completion_requests(
                id, actual_completion_date, final_completion_pct, completion_summary, outstanding_work, final_remarks,
                completion_report_url, handover_document_url, testing_records_url, status, return_reason, submitted_at,
                submitter:submitted_by(id, name)
            ),
            audit:project_audit_log(
                id, action, previous_status, new_status, remarks, created_at,
                actor:actor_id(id, full_name)
            )
        `)
        .eq('id', projectId)
        .single();

    if (error) throw error;
    return data;
}

export async function createProjectRecord(payload: {
    companyId: string;
    name: string;
    clientId?: string | null;
    dealId?: number | null;
    lpoNumber: string;
    lpoFile?: File | null;
    lpoCost: number;
    startDate: string;
    endDate: string;
    projectManagerId: string;
    projectCategoryId?: string | null;
    projectTypeId?: string | null;
    costCenterId?: string | null;
    technicalProposalId?: string | null;
    commercialProposalId?: string | null;
    remarks?: string | null;
    createdBy: string;
}) {
    if (!payload.name || !payload.lpoNumber || !payload.projectManagerId || !payload.startDate || !payload.endDate) {
        throw new Error('Mandatory project fields missing.');
    }

    if (new Date(payload.startDate) > new Date(payload.endDate)) {
        throw new Error('Project Start Date cannot be after End Date.');
    }

    let lpoDocUrl: string | null = null;
    if (payload.lpoFile) {
        lpoDocUrl = await uploadProjectFile(payload.companyId, 'lpo', payload.lpoFile);
    }

    const { data: proj, error: projErr } = await supabase.from('pm_projects').insert([{
        company_id: payload.companyId,
        name: payload.name,
        client_id: payload.clientId || null,
        deal_id: payload.dealId || null,
        lpo_number: payload.lpoNumber,
        lpo_document_url: lpoDocUrl,
        lpo_cost: payload.lpoCost || 0,
        budget: payload.lpoCost || 0,
        start_date: payload.startDate,
        end_date: payload.endDate,
        project_manager_id: payload.projectManagerId,
        project_category_id: payload.projectCategoryId || null,
        project_type_id: payload.projectTypeId || null,
        cost_center_id: payload.costCenterId || null,
        technical_proposal_id: payload.technicalProposalId || null,
        commercial_proposal_id: payload.commercialProposalId || null,
        remarks: payload.remarks || null,
        status: 'DRAFT',
        created_by: payload.createdBy
    }]).select().single();

    if (projErr) throw projErr;

    // Initialize 6 mandatory document rows
    for (const doc of MANDATORY_PROJECT_DOCUMENTS) {
        await supabase.from('project_required_documents').insert([{
            company_id: payload.companyId,
            project_id: proj.id,
            document_type: doc.type,
            version: 1,
            confirmed: false
        }]);
    }

    await logProjectAudit({
        companyId: payload.companyId,
        projectId: proj.id,
        entityType: 'PROJECT',
        entityId: proj.id,
        action: 'PROJECT_CREATED',
        actorId: payload.createdBy,
        previousStatus: null,
        newStatus: 'DRAFT',
        remarks: `Project "${payload.name}" draft created with LPO #${payload.lpoNumber}`
    });

    return proj;
}

export async function uploadRequiredDoc(payload: {
    companyId: string;
    projectId: string;
    documentType: string;
    file: File;
    uploadedBy: string;
}) {
    const url = await uploadProjectFile(payload.companyId, `documents/${payload.documentType}`, payload.file);

    const { data, error } = await supabase.from('project_required_documents').upsert({
        company_id: payload.companyId,
        project_id: payload.projectId,
        document_type: payload.documentType,
        file_url: url,
        file_name: payload.file.name,
        uploaded_by: payload.uploadedBy,
        uploaded_at: new Date().toISOString(),
        confirmed: true,
        confirmed_by: payload.uploadedBy,
        confirmed_at: new Date().toISOString()
    }, {
        onConflict: 'project_id,document_type'
    }).select().single();

    if (error) throw error;
    return data;
}

export async function submitProjectForHeadApproval(payload: {
    companyId: string;
    projectId: string;
    actorId: string;
}) {
    const proj = await fetchProjectDetails(payload.projectId);
    if (!proj) throw new Error('Project not found');

    if (!proj.lpo_document_url) {
        throw new Error('LPO Document must be uploaded before submission.');
    }

    const docs = proj.documents || [];
    for (const mandatory of MANDATORY_PROJECT_DOCUMENTS) {
        const found = docs.find((d: any) => d.document_type === mandatory.type);
        if (!found || !found.file_url) {
            throw new Error(`Mandatory document "${mandatory.label}" is missing.`);
        }
        if (!found.confirmed) {
            throw new Error(`Mandatory document "${mandatory.label}" must be confirmed.`);
        }
    }

    await supabase.from('pm_projects').update({
        status: 'PENDING_PROJECT_HEAD_APPROVAL',
        updated_at: new Date().toISOString(),
        updated_by: payload.actorId
    }).eq('id', payload.projectId);

    await logProjectAudit({
        companyId: payload.companyId,
        projectId: payload.projectId,
        entityType: 'PROJECT',
        entityId: payload.projectId,
        action: 'SUBMITTED_FOR_APPROVAL',
        actorId: payload.actorId,
        previousStatus: 'DRAFT',
        newStatus: 'PENDING_PROJECT_HEAD_APPROVAL',
        remarks: 'Project and all 6 mandatory documents confirmed and submitted for Project Head approval'
    });

    return 'PENDING_PROJECT_HEAD_APPROVAL';
}

export async function reviewProjectHeadApproval(payload: {
    companyId: string;
    projectId: string;
    action: 'APPROVE' | 'RETURN' | 'REJECT';
    remarks: string;
    actorId: string;
}) {
    if ((payload.action === 'RETURN' || payload.action === 'REJECT') && !payload.remarks.trim()) {
        throw new Error('Mandatory remarks required for return or rejection.');
    }

    const nextStatus = payload.action === 'APPROVE' 
        ? 'APPROVED' 
        : payload.action === 'RETURN' ? 'CORRECTION_REQUIRED' : 'REJECTED';

    await supabase.from('pm_projects').update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
        updated_by: payload.actorId
    }).eq('id', payload.projectId);

    await logProjectAudit({
        companyId: payload.companyId,
        projectId: payload.projectId,
        entityType: 'PROJECT',
        entityId: payload.projectId,
        action: `PROJECT_HEAD_${payload.action}`,
        actorId: payload.actorId,
        previousStatus: 'PENDING_PROJECT_HEAD_APPROVAL',
        newStatus: nextStatus,
        remarks: payload.remarks
    });

    return nextStatus;
}

export async function assignSupervisor(payload: {
    companyId: string;
    projectId: string;
    employeeId: string;
    responsibilities?: string;
    startDate?: string;
    endDate?: string;
    assignedBy: string;
}) {
    const { data, error } = await supabase.from('project_supervisors').insert([{
        company_id: payload.companyId,
        project_id: payload.projectId,
        employee_id: payload.employeeId,
        responsibilities: payload.responsibilities || 'Site Execution & Daily Activity Logging',
        start_date: payload.startDate || new Date().toISOString().split('T')[0],
        end_date: payload.endDate || null,
        is_active: true,
        assigned_by: payload.assignedBy
    }]).select().single();

    if (error) throw error;

    await supabase.from('pm_projects').update({
        status: 'SUPERVISOR_ASSIGNED'
    }).eq('id', payload.projectId).eq('status', 'APPROVED');

    await logProjectAudit({
        companyId: payload.companyId,
        projectId: payload.projectId,
        entityType: 'SUPERVISOR',
        entityId: data.id,
        action: 'SUPERVISOR_ASSIGNED',
        actorId: payload.assignedBy,
        remarks: `Assigned supervisor ${payload.employeeId}: ${payload.responsibilities}`
    });

    return data;
}

export async function removeSupervisor(supervisorAssignmentId: string, projectId: string, companyId: string, actorId: string) {
    await supabase.from('project_supervisors').update({
        is_active: false,
        end_date: new Date().toISOString().split('T')[0]
    }).eq('id', supervisorAssignmentId);

    await logProjectAudit({
        companyId,
        projectId,
        entityType: 'SUPERVISOR',
        entityId: supervisorAssignmentId,
        action: 'SUPERVISOR_REMOVED',
        actorId,
        remarks: 'Supervisor assignment ended'
    });
}

export async function createDailyActivity(payload: {
    companyId: string;
    projectId: string;
    supervisorId: string;
    activityDate: string;
    workArea: string;
    activityDescription: string;
    plannedWork?: string;
    completedWork?: string;
    plannedQuantity?: number;
    completedQuantity?: number;
    workerCount: number;
    progressPct: number;
    issues?: string;
    delayReason?: string;
    risk?: string;
    safetyObservation?: string;
    remarks?: string;
    photos?: File[];
    documents?: File[];
    createdBy: string;
}) {
    const { data: act, error: actErr } = await supabase.from('project_daily_activities').insert([{
        company_id: payload.companyId,
        project_id: payload.projectId,
        supervisor_id: payload.supervisorId,
        activity_date: payload.activityDate,
        work_area: payload.workArea,
        activity_description: payload.activityDescription,
        planned_work: payload.plannedWork || null,
        completed_work: payload.completedWork || null,
        planned_quantity: payload.plannedQuantity || 0,
        completed_quantity: payload.completedQuantity || 0,
        worker_count: payload.workerCount || 0,
        progress_pct: payload.progressPct || 0,
        issues: payload.issues || null,
        delay_reason: payload.delayReason || null,
        risk: payload.risk || null,
        safety_observation: payload.safetyObservation || null,
        remarks: payload.remarks || null,
        status: 'SUBMITTED',
        created_by: payload.createdBy
    }]).select().single();

    if (actErr) throw actErr;

    if (payload.photos && payload.photos.length > 0) {
        for (const p of payload.photos) {
            const url = await uploadProjectFile(payload.companyId, `activities/${act.id}/photos`, p);
            await supabase.from('project_daily_activity_documents').insert([{
                company_id: payload.companyId,
                activity_id: act.id,
                file_url: url,
                file_name: p.name,
                file_type: 'PHOTO',
                uploaded_by: payload.createdBy
            }]);
        }
    }

    if (payload.documents && payload.documents.length > 0) {
        for (const d of payload.documents) {
            const url = await uploadProjectFile(payload.companyId, `activities/${act.id}/docs`, d);
            await supabase.from('project_daily_activity_documents').insert([{
                company_id: payload.companyId,
                activity_id: act.id,
                file_url: url,
                file_name: d.name,
                file_type: 'DOCUMENT',
                uploaded_by: payload.createdBy
            }]);
        }
    }

    await supabase.from('pm_projects').update({
        status: 'IN_PROGRESS',
        completion_pct: payload.progressPct,
        actual_start_date: payload.activityDate
    }).eq('id', payload.projectId);

    await logProjectAudit({
        companyId: payload.companyId,
        projectId: payload.projectId,
        entityType: 'ACTIVITY',
        entityId: act.id,
        action: 'DAILY_ACTIVITY_SUBMITTED',
        actorId: payload.createdBy,
        remarks: `Activity for ${payload.activityDate} in ${payload.workArea}: ${payload.progressPct}% progress`
    });

    return act;
}

export async function reviewDailyActivity(payload: {
    companyId: string;
    projectId: string;
    activityId: string;
    action: 'REVIEWED' | 'RETURNED' | 'APPROVED';
    remarks?: string;
    actorId: string;
}) {
    await supabase.from('project_daily_activities').update({
        status: payload.action,
        return_reason: payload.action === 'RETURNED' ? payload.remarks : null,
        reviewed_by: payload.actorId,
        reviewed_at: new Date().toISOString()
    }).eq('id', payload.activityId);

    await logProjectAudit({
        companyId: payload.companyId,
        projectId: payload.projectId,
        entityType: 'ACTIVITY',
        entityId: payload.activityId,
        action: `ACTIVITY_${payload.action}`,
        actorId: payload.actorId,
        remarks: payload.remarks || `Daily activity marked as ${payload.action}`
    });
}

// ============================================================================
// ISSUES, RISKS & SAFETY
// ============================================================================

export async function createProjectIssue(payload: {
    companyId: string;
    projectId: string;
    title: string;
    category?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description?: string;
    impact?: string;
    assignedTo?: string | null;
    actionRequired?: string;
    dueDate?: string | null;
    createdBy: string;
}) {
    const { data, error } = await supabase.from('project_issues').insert([{
        company_id: payload.companyId,
        project_id: payload.projectId,
        title: payload.title,
        category: payload.category || 'Technical',
        severity: payload.severity || 'MEDIUM',
        description: payload.description || null,
        impact: payload.impact || null,
        assigned_to: payload.assignedTo || null,
        action_required: payload.actionRequired || null,
        due_date: payload.dueDate || null,
        status: 'OPEN',
        created_by: payload.createdBy
    }]).select().single();

    if (error) throw error;
    return data;
}

export async function updateProjectIssue(payload: {
    issueId: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
    resolution?: string;
    updatedBy: string;
}) {
    const { data, error } = await supabase.from('project_issues').update({
        status: payload.status,
        resolution: payload.resolution || null,
        updated_at: new Date().toISOString(),
        updated_by: payload.updatedBy
    }).eq('id', payload.issueId).select().single();

    if (error) throw error;
    return data;
}

export async function createProjectRisk(payload: {
    companyId: string;
    projectId: string;
    title: string;
    probability: 'LOW' | 'MEDIUM' | 'HIGH';
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
    riskScore?: string;
    mitigation?: string;
    ownerId?: string | null;
    createdBy: string;
}) {
    const { data, error } = await supabase.from('project_risks').insert([{
        company_id: payload.companyId,
        project_id: payload.projectId,
        title: payload.title,
        probability: payload.probability || 'MEDIUM',
        impact: payload.impact || 'MEDIUM',
        risk_score: payload.riskScore || `${payload.probability} x ${payload.impact}`,
        mitigation: payload.mitigation || null,
        owner_id: payload.ownerId || null,
        status: 'OPEN',
        created_by: payload.createdBy
    }]).select().single();

    if (error) throw error;
    return data;
}

export async function updateProjectRisk(payload: {
    riskId: string;
    status: 'OPEN' | 'MITIGATED' | 'CLOSED';
    mitigation?: string;
    updatedBy: string;
}) {
    const { data, error } = await supabase.from('project_risks').update({
        status: payload.status,
        mitigation: payload.mitigation || null,
        updated_at: new Date().toISOString(),
        updated_by: payload.updatedBy
    }).eq('id', payload.riskId).select().single();

    if (error) throw error;
    return data;
}

export async function createSafetyObservation(payload: {
    companyId: string;
    projectId: string;
    activityId?: string | null;
    observationType: 'OBSERVATION' | 'UNSAFE_CONDITION' | 'NEAR_MISS';
    description: string;
    correctiveAction?: string;
    responsiblePersonId?: string | null;
    dueDate?: string | null;
    createdBy: string;
}) {
    const { data, error } = await supabase.from('project_safety_observations').insert([{
        company_id: payload.companyId,
        project_id: payload.projectId,
        activity_id: payload.activityId || null,
        observation_type: payload.observationType,
        description: payload.description,
        corrective_action: payload.correctiveAction || null,
        responsible_person_id: payload.responsiblePersonId || null,
        due_date: payload.dueDate || null,
        closure_status: 'OPEN',
        created_by: payload.createdBy
    }]).select().single();

    if (error) throw error;
    return data;
}

// ============================================================================
// PROJECT COMPLETION WORKFLOW
// ============================================================================

export async function submitProjectCompletion(payload: {
    companyId: string;
    projectId: string;
    actualCompletionDate: string;
    finalCompletionPct: number;
    completionSummary: string;
    outstandingWork?: string;
    finalRemarks?: string;
    completionReportFile: File;
    handoverFile?: File | null;
    testingRecordsFile?: File | null;
    submittedBy: string;
}) {
    if (!payload.completionReportFile) {
        throw new Error('Completion Report file is mandatory.');
    }

    const reportUrl = await uploadProjectFile(payload.companyId, 'completion/reports', payload.completionReportFile);
    let handoverUrl: string | null = null;
    let testingUrl: string | null = null;

    if (payload.handoverFile) {
        handoverUrl = await uploadProjectFile(payload.companyId, 'completion/handover', payload.handoverFile);
    }
    if (payload.testingRecordsFile) {
        testingUrl = await uploadProjectFile(payload.companyId, 'completion/testing', payload.testingRecordsFile);
    }

    const { data: req, error } = await supabase.from('project_completion_requests').insert([{
        company_id: payload.companyId,
        project_id: payload.projectId,
        actual_completion_date: payload.actualCompletionDate,
        final_completion_pct: payload.finalCompletionPct || 100,
        completion_summary: payload.completionSummary,
        outstanding_work: payload.outstandingWork || null,
        final_remarks: payload.finalRemarks || null,
        completion_report_url: reportUrl,
        handover_document_url: handoverUrl,
        testing_records_url: testingUrl,
        status: 'SUBMITTED',
        submitted_by: payload.submittedBy
    }]).select().single();

    if (error) throw error;

    await supabase.from('pm_projects').update({
        status: 'COMPLETION_REQUESTED'
    }).eq('id', payload.projectId);

    await logProjectAudit({
        companyId: payload.companyId,
        projectId: payload.projectId,
        entityType: 'COMPLETION',
        entityId: req.id,
        action: 'COMPLETION_REQUESTED',
        actorId: payload.submittedBy,
        previousStatus: 'IN_PROGRESS',
        newStatus: 'COMPLETION_REQUESTED',
        remarks: payload.completionSummary
    });

    return req;
}

export async function reviewProjectCompletion(payload: {
    companyId: string;
    projectId: string;
    completionRequestId: string;
    action: 'APPROVE' | 'RETURN' | 'REJECT';
    remarks: string;
    actorId: string;
}) {
    if ((payload.action === 'RETURN' || payload.action === 'REJECT') && !payload.remarks.trim()) {
        throw new Error('Mandatory remarks required.');
    }

    const reqStatus = payload.action === 'APPROVE' ? 'APPROVED' : payload.action === 'RETURN' ? 'RETURNED' : 'REJECTED';
    const projStatus = payload.action === 'APPROVE' ? 'COMPLETED' : payload.action === 'RETURN' ? 'CORRECTION_REQUIRED' : 'IN_PROGRESS';
    const isLocked = payload.action === 'APPROVE';

    await supabase.from('project_completion_requests').update({
        status: reqStatus,
        return_reason: payload.action === 'RETURN' ? payload.remarks : null,
        reviewed_by: payload.actorId,
        reviewed_at: new Date().toISOString()
    }).eq('id', payload.completionRequestId);

    await supabase.from('pm_projects').update({
        status: projStatus,
        is_locked: isLocked,
        locked_at: isLocked ? new Date().toISOString() : null,
        locked_by: isLocked ? payload.actorId : null,
        completion_pct: isLocked ? 100 : undefined
    }).eq('id', payload.projectId);

    await logProjectAudit({
        companyId: payload.companyId,
        projectId: payload.projectId,
        entityType: 'COMPLETION',
        entityId: payload.completionRequestId,
        action: `COMPLETION_${payload.action}`,
        actorId: payload.actorId,
        previousStatus: 'COMPLETION_REQUESTED',
        newStatus: projStatus,
        remarks: payload.remarks || `Project completion ${payload.action.toLowerCase()}`
    });
}

export async function reopenProject(payload: {
    companyId: string;
    projectId: string;
    reason: string;
    actorId: string;
}) {
    if (!payload.reason.trim()) throw new Error('Mandatory reason required to reopen project.');

    await supabase.from('pm_projects').update({
        status: 'IN_PROGRESS',
        is_locked: false,
        locked_at: null,
        locked_by: null
    }).eq('id', payload.projectId);

    await logProjectAudit({
        companyId: payload.companyId,
        projectId: payload.projectId,
        entityType: 'PROJECT',
        entityId: payload.projectId,
        action: 'PROJECT_REOPENED',
        actorId: payload.actorId,
        previousStatus: 'COMPLETED',
        newStatus: 'IN_PROGRESS',
        remarks: `Reopened by authorized manager: ${payload.reason}`
    });
}

export async function fetchProjectHubData(companyId: string) {
    const [
        proposalsRes,
        projectsRes,
        clientsRes,
        dealsRes,
        employeesRes,
        activitiesRes,
        issuesRes,
        risksRes
    ] = await Promise.all([
        fetchProposals(companyId),
        fetchProjects(companyId),
        supabase.from('accounting_partners').select('id, name, email, phone, partner_type').eq('company_id', companyId).order('name', { ascending: true }),
        supabase.from('crm_deals').select('id, title, value').eq('company_id', companyId),
        supabase.from('employees').select('id, name, email, designation').eq('company_id', companyId).eq('status', 'Active'),
        supabase.from('project_daily_activities')
            .select(`
                *,
                supervisor:supervisor_id(id, name)
            `)
            .eq('company_id', companyId)
            .order('activity_date', { ascending: false }),
        supabase.from('project_issues')
            .select(`
                *,
                assignee:assigned_to(id, name)
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false }),
        supabase.from('project_risks')
            .select(`
                *,
                owner:owner_id(id, name)
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
    ]);

    return {
        proposals: proposalsRes || [],
        projects: projectsRes || [],
        clients: clientsRes.data || [],
        deals: dealsRes.data || [],
        employees: employeesRes.data || [],
        activities: activitiesRes.data || [],
        issues: issuesRes.data || [],
        risks: risksRes.data || []
    };
}



