import { supabase } from './supabase';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ApproverSequence {
    level1?: string | null;
    level2?: string | null;
    level3?: string | null;
}

export class WorkflowEngine {

    /**
     * Helper to get the employee leave authority or manager hierarchy for a given employee.
     * Used as fallback when no workflow_levels are configured for a workflow.
     */
    static async getEmployeeApprovers(companyId: string, employeeId: string, triggerType?: string): Promise<ApproverSequence> {
        let auth: any = null;

        // 1. Check trigger-specific authority mapping
        if (triggerType === 'OVERTIME_REQUEST') {
            const { data: otAuth } = await (supabase as any).from('employee_ot_authority')
                .select('approver_level_1, approver_level_2, approver_level_3')
                .eq('company_id', companyId)
                .eq('employee_id', employeeId)
                .eq('is_active', true)
                .lte('effective_from', new Date().toISOString().split('T')[0])
                .maybeSingle();

            if (otAuth) auth = otAuth;
        }

        // 2. Fallback to employee_leave_authority mapping
        if (!auth) {
            const { data: leaveAuth } = await (supabase as any).from('employee_leave_authority')
                .select('approver_level_1, approver_level_2, approver_level_3')
                .eq('company_id', companyId)
                .eq('employee_id', employeeId)
                .eq('is_active', true)
                .lte('effective_from', new Date().toISOString().split('T')[0])
                .maybeSingle();
            
            if (leaveAuth) auth = leaveAuth;
        }

        // 3. Fetch employee manager as default fallback
        const { data: emp } = await supabase.from('employees')
            .select('manager_id')
            .eq('id', employeeId)
            .maybeSingle();

        const managerId = emp?.manager_id || null;

        const level1 = auth?.approver_level_1 || managerId;
        const level2 = auth?.approver_level_2 || null;
        const level3 = auth?.approver_level_3 || null;

        return {
            level1: level1 !== employeeId ? level1 : null, // Prevent self approval
            level2: (level2 !== employeeId && level2 !== level1) ? level2 : null,
            level3: (level3 !== employeeId && level3 !== level1 && level3 !== level2) ? level3 : null
        };
    }

    /**
     * Resolve the initial approver from workflow_levels configuration.
     * Returns the first level's approver user ID, or null if levels are not configured.
     */
    private static async resolveApproverFromLevels(workflowId: string, requesterId: string): Promise<{ approverId: string | null; levelId: string | null; levelOrder: number }> {
        const { data: levels } = await (supabase as any).from('workflow_levels')
            .select('*')
            .eq('workflow_id', workflowId)
            .order('level_order', { ascending: true });

        if (!levels || levels.length === 0) {
            return { approverId: null, levelId: null, levelOrder: 0 };
        }

        const firstLevel = levels[0];
        const approverId = await this.resolveApproverFromLevel(firstLevel, requesterId);

        return { approverId, levelId: firstLevel.id, levelOrder: firstLevel.level_order };
    }

    /**
     * Resolve an approver user ID from a single workflow_level record.
     * Handles both ROLE-based and USER-based approver types.
     */
    private static async resolveApproverFromLevel(level: any, requesterId: string): Promise<string | null> {
        if (!level?.approver_ids || level.approver_ids.length === 0) return null;

        if (level.approver_type === 'USER') {
            // approver_ids contains user/employee IDs directly
            // Pick the first that is not the requester
            for (const uid of level.approver_ids) {
                if (uid !== requesterId) return uid;
            }
            return level.approver_ids[0] !== requesterId ? level.approver_ids[0] : null;
        } else if (level.approver_type === 'ROLE') {
            // approver_ids contains role IDs — resolve to user IDs via user_company_access
            const { data: usersWithRole } = await (supabase as any).from('user_company_access')
                .select('user_id')
                .in('role_id', level.approver_ids)
                .eq('status', 'active');

            if (!usersWithRole || usersWithRole.length === 0) return null;

            // Pick the first user that is not the requester
            for (const u of usersWithRole) {
                if (u.user_id !== requesterId) return u.user_id;
            }
            return null;
        }

        return null;
    }

    /**
     * Start a new workflow for a specific entity (e.g., Leave Request, Resignation, Missed Punch, Support Ticket)
     */
    static async startWorkflow(companyId: string, triggerType: string, entityId: string, requesterId: string, module: string) {
        // Find active workflow definition if configured
        const { data: workflow } = await supabase.from('workflows')
            .select('id')
            .eq('company_id', companyId)
            .eq('trigger_type', triggerType)
            .eq('is_active', true)
            .maybeSingle();

        let initialApprover: string | null = null;
        let firstStepId: string | null = null;

        // Strategy 1: Use admin-configured workflow_levels if available
        if (workflow) {
            const levelResult = await this.resolveApproverFromLevels(workflow.id, requesterId);
            if (levelResult.approverId) {
                initialApprover = levelResult.approverId;
                firstStepId = levelResult.levelId;
            }
        }

        // Strategy 2: Fallback to employee authority / manager hierarchy
        if (!initialApprover) {
            const approvers = await this.getEmployeeApprovers(companyId, requesterId, triggerType);
            initialApprover = approvers.level1 || approvers.level2 || approvers.level3;

            // Also try workflow_steps as legacy fallback
            if (workflow) {
                const { data: step } = await supabase.from('workflow_steps')
                    .select('id')
                    .eq('workflow_id', workflow.id)
                    .order('step_order', { ascending: true })
                    .limit(1)
                    .maybeSingle();
                firstStepId = step?.id || null;
            }
        }

        // Create Workflow Instance
        const { data: instance, error } = await supabase.from('workflow_instances').insert([{
            company_id: companyId,
            workflow_id: workflow?.id || null,
            module,
            trigger_type: triggerType,
            entity_id: entityId,
            current_step_id: firstStepId,
            status: initialApprover ? 'PENDING' : 'APPROVED',
            requester_id: requesterId,
            assigned_to_user_id: initialApprover
        }]).select().single();

        if (error) {
            console.error("Error creating workflow instance:", error);
            throw error;
        }

        // If no approvers configured at all, auto-approve
        if (!initialApprover) {
            await this.finalizeEntity(triggerType, entityId, 'APPROVED');
        }

        return instance;
    }

    /**
     * Fetch pending approvals for a specific employee/user.
     * Enriches each request with entity details from the source table.
     */
    static async getMyApprovals(userId: string, companyId?: string, isHRorAdmin: boolean = false) {
        let query = supabase.from('workflow_instances')
            .select(`
                *,
                workflow:workflows(name),
                requester:employees!requester_id(id, name, profile_photo_url, designation, department)
            `)
            .eq('status', 'PENDING');

        if (isHRorAdmin && companyId) {
            query = query.eq('company_id', companyId);
        } else {
            const { data: emp } = await supabase.from('employees').select('id, profile_id').or(`id.eq.${userId},profile_id.eq.${userId}`).maybeSingle();
            const empId = emp?.id || userId;
            const profId = emp?.profile_id || userId;
            query = query.or(`assigned_to_user_id.eq.${empId},assigned_to_user_id.eq.${profId}`);
        }

        const { data: requests, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching approvals:", error);
            throw error;
        }

        if (!requests || requests.length === 0) return [];

        // Enrich each request with entity-specific details
        const enriched = await Promise.all(requests.map(async (req: any) => {
            try {
                const details = await this.fetchEntityDetails(req.trigger_type, req.entity_id);
                return { ...req, entity_details: details };
            } catch {
                return { ...req, entity_details: null };
            }
        }));

        return enriched;
    }

    /**
     * Fetch entity-specific details based on trigger type.
     * Returns a normalized object with common fields: reason, dates, type_label, extra.
     */
    private static async fetchEntityDetails(triggerType: string, entityId: string): Promise<any> {
        if (triggerType === 'LEAVE_REQUEST') {
            const { data } = await (supabase as any).from('leaves')
                .select('*, leave_type:leave_type_id(name)')
                .eq('id', entityId)
                .maybeSingle();
            if (!data) return null;
            return {
                reason: data.reason,
                start_date: data.start_date,
                end_date: data.end_date,
                type_label: data.leave_type?.name || data.type || 'Leave',
                status: data.status
            };
        } else if (triggerType === 'RESIGNATION') {
            const { data } = await (supabase as any).from('resignations')
                .select('*')
                .eq('id', entityId)
                .maybeSingle();
            if (!data) return null;
            return {
                reason: data.reason_text,
                type_label: data.reason_category || 'Resignation',
                proposed_last_working_date: data.proposed_last_working_date,
                status: data.status
            };
        } else if (triggerType === 'MISSED_PUNCH') {
            const { data } = await (supabase as any).from('missed_punch_requests')
                .select('*')
                .eq('id', entityId)
                .maybeSingle();
            if (!data) return null;
            return {
                reason: data.reason,
                request_date: data.request_date,
                punch_type: data.punch_type === 'check_in' ? 'Check In' : 'Check Out',
                requested_time: data.requested_time,
                type_label: 'Missed Punch',
                status: data.status
            };
        } else if (triggerType === 'SUPPORT_TICKET') {
            const { data } = await (supabase as any).from('tickets')
                .select('*')
                .eq('id', entityId)
                .maybeSingle();
            if (!data) return null;
            return {
                reason: data.description,
                subject: data.subject,
                category: data.category,
                priority: data.priority,
                type_label: data.category || 'Support Ticket',
                status: data.status
            };
        } else if (triggerType === 'PRO_SERVICE_REQUEST' || triggerType === 'PRO') {
            const { data } = await (supabase as any).from('pro_applications')
                .select('*, applicant:employees!applicant_employee_id(name)')
                .eq('id', entityId)
                .maybeSingle();
            if (!data) return null;
            return {
                reason: data.remarks || data.title,
                subject: data.title,
                applicant_name: data.applicant?.name,
                service_category: data.service_category || data.application_type,
                qid_number: data.qid_number,
                passport_number: data.passport_number,
                urgent: data.urgent_flag,
                type_label: data.application_type || 'PRO Service',
                status: data.status
            };
        } else if (triggerType === 'EXPENSE_CLAIM') {
            const { data } = await (supabase as any).from('expenses')
                .select('*')
                .eq('id', entityId)
                .maybeSingle();
            if (!data) return null;
            return {
                reason: data.description || data.reason,
                type_label: 'Expense Claim',
                amount: data.amount,
                status: data.status
            };
        } else if (triggerType === 'OVERTIME_REQUEST') {
            const { data } = await (supabase as any).from('overtime_requests')
                .select('*, employee:employees!employee_id(name)')
                .eq('id', entityId)
                .maybeSingle();
            if (!data) return null;
            return {
                reason: data.reason,
                request_date: data.request_date,
                ot_hours: data.ot_hours,
                approved_hours: data.approved_hours,
                employee_name: data.employee?.name,
                type_label: 'Overtime Request',
                status: data.status
            };
        } else if (triggerType === 'TECHNICAL_PROPOSAL' || triggerType === 'COMMERCIAL_PROPOSAL') {
            const { data } = await (supabase as any).from('project_proposals')
                .select('*, client:client_id(name), first_reviewer:first_reviewer_id(name)')
                .eq('id', entityId)
                .maybeSingle();
            if (!data) return null;
            return {
                reason: data.remarks || data.title,
                subject: data.title,
                proposal_type: data.proposal_type,
                client_name: data.client?.name,
                rfq_reference: data.rfq_reference,
                currency: data.currency,
                submission_deadline: data.submission_deadline,
                current_revision: data.current_revision,
                type_label: data.proposal_type === 'TECHNICAL' ? 'Technical Proposal' : 'Commercial Proposal',
                status: data.status
            };
        } else if (triggerType === 'PROJECT_APPROVAL') {
            const { data } = await (supabase as any).from('pm_projects')
                .select('*, client:client_id(name), project_manager:project_manager_id(name)')
                .eq('id', entityId)
                .maybeSingle();
            if (!data) return null;
            return {
                reason: data.remarks || data.name,
                subject: data.name,
                client_name: data.client?.name,
                lpo_number: data.lpo_number,
                lpo_cost: data.lpo_cost,
                project_manager: data.project_manager?.name,
                start_date: data.start_date,
                end_date: data.end_date,
                type_label: 'Project Approval',
                status: data.status
            };
        } else if (triggerType === 'PROJECT_COMPLETION') {
            const { data } = await (supabase as any).from('project_completion_requests')
                .select('*, project:project_id(name, client:client_id(name))')
                .eq('id', entityId)
                .maybeSingle();
            if (!data) return null;
            return {
                reason: data.completion_summary,
                subject: `Completion: ${data.project?.name || 'Project'}`,
                project_name: data.project?.name,
                client_name: data.project?.client?.name,
                actual_completion_date: data.actual_completion_date,
                final_completion_pct: data.final_completion_pct,
                outstanding_work: data.outstanding_work,
                type_label: 'Project Completion',
                status: data.status
            };
        }
        return null;
    }

    /**
     * Process an Approval & Route to Next Approver Level.
     * Uses workflow_levels if configured, otherwise falls back to employee_leave_authority.
     */
    static async approve(instanceId: string, actorId: string, comment?: string) {
        const { data: instance } = await supabase.from('workflow_instances').select('*').eq('id', instanceId).single();
        if (!instance) throw new Error("Workflow instance not found");

        // Log Action to audit trail
        await supabase.from('workflow_action_logs').insert([{
            instance_id: instanceId,
            step_id: instance.current_step_id,
            actor_id: actorId,
            action: 'APPROVE',
            comment
        }]);

        // Try to advance through workflow_levels first
        let advanced = false;
        if (instance.workflow_id) {
            advanced = await this.advanceThroughLevels(instance, instanceId);
        }

        // Fallback: advance through employee authority hierarchy
        if (!advanced) {
            const approvers = await this.getEmployeeApprovers(instance.company_id, instance.requester_id, instance.trigger_type);

            let nextApprover: string | null = null;
            if (instance.assigned_to_user_id === approvers.level1 && approvers.level2) {
                nextApprover = approvers.level2;
            } else if ((instance.assigned_to_user_id === approvers.level1 || instance.assigned_to_user_id === approvers.level2) && approvers.level3) {
                nextApprover = approvers.level3;
            }

            if (nextApprover) {
                await supabase.from('workflow_instances').update({
                    assigned_to_user_id: nextApprover,
                    updated_at: new Date().toISOString()
                }).eq('id', instanceId);

                // Update entity partial level status if leave request
                if (instance.trigger_type === 'LEAVE_REQUEST') {
                    if (instance.assigned_to_user_id === approvers.level1) {
                        await supabase.from('leaves').update({ level1_status: 'Approved' }).eq('id', instance.entity_id);
                    } else if (instance.assigned_to_user_id === approvers.level2) {
                        await supabase.from('leaves').update({ level2_status: 'Approved' }).eq('id', instance.entity_id);
                    }
                }
            } else {
                // Workflow Completed & Fully Approved
                await supabase.from('workflow_instances').update({
                    status: 'APPROVED',
                    updated_at: new Date().toISOString()
                }).eq('id', instanceId);

                await this.finalizeEntity(instance.trigger_type, instance.entity_id, 'APPROVED');
            }
        }
    }

    /**
     * Advance a workflow instance through admin-configured workflow_levels.
     * Returns true if routing was handled (either advanced or finalized), false to use fallback.
     */
    private static async advanceThroughLevels(instance: any, instanceId: string): Promise<boolean> {
        const { data: levels } = await (supabase as any).from('workflow_levels')
            .select('*')
            .eq('workflow_id', instance.workflow_id)
            .order('level_order', { ascending: true });

        if (!levels || levels.length === 0) return false; // No levels configured, use fallback

        // Find the current level index based on current_step_id
        const currentIdx = levels.findIndex((l: any) => l.id === instance.current_step_id);

        // If we can't find current level in the levels list, fall back
        if (currentIdx === -1) return false;

        const nextIdx = currentIdx + 1;

        if (nextIdx < levels.length) {
            // Advance to the next level
            const nextLevel = levels[nextIdx];
            const nextApprover = await this.resolveApproverFromLevel(nextLevel, instance.requester_id);

            if (nextApprover) {
                await supabase.from('workflow_instances').update({
                    assigned_to_user_id: nextApprover,
                    current_step_id: nextLevel.id,
                    updated_at: new Date().toISOString()
                }).eq('id', instanceId);

                // Update partial level status for leave requests
                if (instance.trigger_type === 'LEAVE_REQUEST') {
                    if (currentIdx === 0) {
                        await supabase.from('leaves').update({ level1_status: 'Approved' }).eq('id', instance.entity_id);
                    } else if (currentIdx === 1) {
                        await supabase.from('leaves').update({ level2_status: 'Approved' }).eq('id', instance.entity_id);
                    }
                }
                return true;
            }
        }

        // No more levels or no valid approver found — finalize
        await supabase.from('workflow_instances').update({
            status: 'APPROVED',
            updated_at: new Date().toISOString()
        }).eq('id', instanceId);

        await this.finalizeEntity(instance.trigger_type, instance.entity_id, 'APPROVED');
        return true;
    }

    /**
     * Process a Rejection
     */
    static async reject(instanceId: string, actorId: string, comment?: string) {
        const { data: instance } = await supabase.from('workflow_instances').select('*').eq('id', instanceId).single();
        if (!instance) throw new Error("Workflow instance not found");

        await supabase.from('workflow_action_logs').insert([{
            instance_id: instanceId,
            step_id: instance.current_step_id,
            actor_id: actorId,
            action: 'REJECT',
            comment
        }]);

        await supabase.from('workflow_instances').update({
            status: 'REJECTED',
            updated_at: new Date().toISOString()
        }).eq('id', instanceId);

        await this.finalizeEntity(instance.trigger_type, instance.entity_id, 'REJECTED');
    }

    /**
     * Helper to update the entity record status after workflow completes.
     * Supports: Leaves, Resignations, Expenses, Missed Punch, Support Tickets.
     */
    public static async finalizeEntity(type: string, entityId: string, status: string) {
        const dbStatus = status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : status;

        if (type === 'LEAVE_REQUEST') {
            await supabase.from('leaves').update({
                status: dbStatus,
                level1_status: dbStatus,
                level2_status: dbStatus
            }).eq('id', entityId);
        } else if (type === 'RESIGNATION') {
            await supabase.from('resignations').update({
                status: dbStatus,
                exit_status: dbStatus
            }).eq('id', entityId);
        } else if (type === 'EXPENSE_CLAIM') {
            await (supabase as any).from('expenses').update({
                status: dbStatus
            }).eq('id', entityId);
        } else if (type === 'MISSED_PUNCH') {
            await (supabase as any).from('missed_punch_requests').update({
                status: dbStatus,
                reviewed_at: new Date().toISOString()
            }).eq('id', entityId);

            if (status === 'APPROVED') {
                const { data: mpReq } = await (supabase as any).from('missed_punch_requests')
                    .select('*')
                    .eq('id', entityId)
                    .maybeSingle();

                if (mpReq && mpReq.employee_id && mpReq.request_date) {
                    const reqTime = mpReq.requested_time || new Date().toISOString();
                    const { data: existingAtt } = await (supabase as any).from('attendance')
                        .select('id, check_in, check_out')
                        .eq('employee_id', mpReq.employee_id)
                        .eq('date', mpReq.request_date)
                        .maybeSingle();

                    if (existingAtt) {
                        const updatePayload: any = {};
                        if (mpReq.punch_type === 'check_in') {
                            updatePayload.check_in = reqTime;
                        } else {
                            updatePayload.check_out = reqTime;
                        }

                        const cin = mpReq.punch_type === 'check_in' ? new Date(reqTime) : (existingAtt.check_in ? new Date(existingAtt.check_in) : null);
                        const cout = mpReq.punch_type === 'check_out' ? new Date(reqTime) : (existingAtt.check_out ? new Date(existingAtt.check_out) : null);
                        if (cin && cout && !isNaN(cin.getTime()) && !isNaN(cout.getTime())) {
                            const diffMs = cout.getTime() - cin.getTime();
                            updatePayload.total_hours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
                        }

                        await (supabase as any).from('attendance').update(updatePayload).eq('id', existingAtt.id);
                    } else {
                        const insertPayload: any = {
                            company_id: mpReq.company_id,
                            employee_id: mpReq.employee_id,
                            date: mpReq.request_date,
                            status: 'Present',
                            source: 'manual',
                            punch_method: 'ONLINE'
                        };
                        if (mpReq.punch_type === 'check_in') {
                            insertPayload.check_in = reqTime;
                        } else {
                            insertPayload.check_out = reqTime;
                        }
                        await (supabase as any).from('attendance').insert([insertPayload]);
                    }
                }
            }
        } else if (type === 'SUPPORT_TICKET') {
            // Map: Approved → Resolved, Rejected → Closed
            const ticketStatus = status === 'APPROVED' ? 'Resolved' : status === 'REJECTED' ? 'Closed' : dbStatus;
            await (supabase as any).from('tickets').update({
                status: ticketStatus
            }).eq('id', entityId);
        } else if (type === 'PRO_SERVICE_REQUEST' || type === 'PRO') {
            const appStatus = status === 'APPROVED' ? 'IN_PROGRESS' : 'REJECTED';
            const stage = status === 'APPROVED' ? 'MANAGER_APPROVED' : 'REJECTED';
            await (supabase as any).from('pro_applications').update({
                status: appStatus,
                stage: stage
            }).eq('id', entityId);

            const { data: appData } = await (supabase as any).from('pro_applications')
                .select('*, applicant:employees!applicant_employee_id(name)')
                .eq('id', entityId)
                .maybeSingle();

            if (status === 'APPROVED') {
                if (appData) {
                    await (supabase as any).from('pro_tasks').insert([{
                        company_id: appData.company_id,
                        task_name: `Process ${appData.application_type || 'PRO Request'}: ${appData.title}`,
                        description: `Approved request for ${appData.applicant?.name || 'employee'}. QID: ${appData.qid_number || 'N/A'}, Passport: ${appData.passport_number || 'N/A'}. Notes: ${appData.remarks || 'None'}`,
                        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        priority: appData.urgent_flag ? 'HIGH' : 'MEDIUM',
                        status: 'PENDING',
                        related_application_id: entityId
                    }]);

                    // Log approval to activity log
                    await (supabase as any).from('pro_activity_log').insert([{
                        company_id: appData.company_id,
                        application_id: entityId,
                        action_type: 'STATUS_CHANGE',
                        old_status: 'PENDING',
                        new_status: 'IN_PROGRESS',
                        comment: 'Request approved via workflow. PRO field task auto-created.',
                        created_by_name: 'Workflow Engine',
                        created_by_role: 'SYSTEM'
                    }]);
                }
            } else {
                await (supabase as any).from('pro_activity_log').insert([{
                    company_id: appData?.company_id || null,
                    application_id: entityId,
                    action_type: 'STATUS_CHANGE',
                    old_status: 'PENDING',
                    new_status: 'REJECTED',
                    comment: 'Request rejected via workflow engine.',
                    created_by_name: 'Workflow Engine',
                    created_by_role: 'SYSTEM'
                }]);
            }
        } else if (type === 'OVERTIME_REQUEST') {
            // Get the original request to know the requested hours
            const { data: otReq } = await (supabase as any).from('overtime_requests')
                .select('ot_hours')
                .eq('id', entityId)
                .maybeSingle();
            
            const updateData: any = {
                status: dbStatus,
                approved_at: new Date().toISOString()
            };
            if (dbStatus === 'Approved') {
                updateData.approved_hours = otReq?.ot_hours || 0;
            }
            await (supabase as any).from('overtime_requests').update(updateData).eq('id', entityId);
        } else if (type === 'TECHNICAL_PROPOSAL' || type === 'COMMERCIAL_PROPOSAL') {
            const propStatus = status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : status;
            await (supabase as any).from('project_proposals').update({
                status: propStatus,
                is_locked: status === 'APPROVED',
                locked_at: status === 'APPROVED' ? new Date().toISOString() : null
            }).eq('id', entityId);

            // Audit log
            const { data: prop } = await (supabase as any).from('project_proposals').select('company_id, current_revision').eq('id', entityId).maybeSingle();
            if (prop) {
                await (supabase as any).from('project_proposal_audit').insert([{
                    company_id: prop.company_id,
                    proposal_id: entityId,
                    action: status === 'APPROVED' ? 'FINAL_APPROVED' : 'REJECTED',
                    actor_id: (await supabase.auth.getUser()).data.user?.id || '00000000-0000-0000-0000-000000000000',
                    previous_status: 'PENDING_FINAL_APPROVAL',
                    new_status: propStatus,
                    remarks: `Proposal ${status === 'APPROVED' ? 'fully approved and locked' : 'rejected via workflow'}`
                }]);
            }
        } else if (type === 'PROJECT_APPROVAL') {
            const projStatus = status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : status;
            await (supabase as any).from('pm_projects').update({
                status: projStatus
            }).eq('id', entityId);

            const { data: proj } = await (supabase as any).from('pm_projects').select('company_id').eq('id', entityId).maybeSingle();
            if (proj) {
                await (supabase as any).from('project_audit_log').insert([{
                    company_id: proj.company_id,
                    project_id: entityId,
                    entity_type: 'PROJECT',
                    entity_id: entityId,
                    action: status === 'APPROVED' ? 'PROJECT_APPROVED' : 'PROJECT_REJECTED',
                    actor_id: (await supabase.auth.getUser()).data.user?.id || '00000000-0000-0000-0000-000000000000',
                    previous_status: 'PENDING_PROJECT_HEAD_APPROVAL',
                    new_status: projStatus,
                    remarks: `Project ${status === 'APPROVED' ? 'approved by Project Head' : 'rejected'}`
                }]);
            }
        } else if (type === 'PROJECT_COMPLETION') {
            const compStatus = status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : status;
            await (supabase as any).from('project_completion_requests').update({
                status: compStatus,
                reviewed_at: new Date().toISOString()
            }).eq('id', entityId);

            const { data: compReq } = await (supabase as any).from('project_completion_requests').select('company_id, project_id').eq('id', entityId).maybeSingle();
            if (compReq) {
                if (status === 'APPROVED') {
                    await (supabase as any).from('pm_projects').update({
                        status: 'COMPLETED',
                        is_locked: true,
                        locked_at: new Date().toISOString(),
                        completion_pct: 100
                    }).eq('id', compReq.project_id);
                }
                await (supabase as any).from('project_audit_log').insert([{
                    company_id: compReq.company_id,
                    project_id: compReq.project_id,
                    entity_type: 'COMPLETION',
                    entity_id: entityId,
                    action: status === 'APPROVED' ? 'COMPLETION_APPROVED' : 'COMPLETION_REJECTED',
                    actor_id: (await supabase.auth.getUser()).data.user?.id || '00000000-0000-0000-0000-000000000000',
                    previous_status: 'COMPLETION_REVIEW',
                    new_status: compStatus,
                    remarks: `Project completion ${status === 'APPROVED' ? 'approved and project locked' : 'rejected'}`
                }]);
            }
        }
    }
}
