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
    static async getEmployeeApprovers(companyId: string, employeeId: string): Promise<ApproverSequence> {
        // 1. Check employee_leave_authority table for active mapping
        const { data: auth } = await (supabase as any).from('employee_leave_authority')
            .select('approver_level_1, approver_level_2, approver_level_3')
            .eq('company_id', companyId)
            .eq('employee_id', employeeId)
            .eq('is_active', true)
            .lte('effective_from', new Date().toISOString().split('T')[0])
            .maybeSingle();

        // 2. Fetch employee manager as default fallback
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

        // Strategy 2: Fallback to employee_leave_authority / manager hierarchy
        if (!initialApprover) {
            const approvers = await this.getEmployeeApprovers(companyId, requesterId);
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
    static async getMyApprovals(userId: string) {
        const { data: requests, error } = await supabase.from('workflow_instances')
            .select(`
                *,
                workflow:workflows(name),
                requester:employees!requester_id(id, name, profile_photo_url, designation, department)
            `)
            .eq('status', 'PENDING')
            .or(`assigned_to_user_id.eq.${userId}`);

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

        // Fallback: advance through employee_leave_authority hierarchy
        if (!advanced) {
            const approvers = await this.getEmployeeApprovers(instance.company_id, instance.requester_id);

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
    private static async finalizeEntity(type: string, entityId: string, status: string) {
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
        }
    }
}
