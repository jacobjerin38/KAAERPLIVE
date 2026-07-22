import { supabase } from './supabase';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ApproverSequence {
    level1?: string | null;
    level2?: string | null;
    level3?: string | null;
}

export class WorkflowEngine {

    /**
     * Helper to get the employee leave authority or manager hierarchy for a given employee
     */
    static async getEmployeeApprovers(companyId: string, employeeId: string): Promise<ApproverSequence> {
        // 1. Check employee_leave_authority table for active mapping
        const { data: auth } = await supabase.from('employee_leave_authority')
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
     * Start a new workflow for a specific entity (e.g., Leave Request, Resignation)
     */
    static async startWorkflow(companyId: string, triggerType: string, entityId: string, requesterId: string, module: string) {
        // 1. Determine approver hierarchy
        const approvers = await this.getEmployeeApprovers(companyId, requesterId);

        // Find active workflow definition if configured
        const { data: workflow } = await supabase.from('workflows')
            .select('id')
            .eq('company_id', companyId)
            .eq('trigger_type', triggerType)
            .eq('is_active', true)
            .maybeSingle();

        // Find initial step / level
        let firstStepId: string | null = null;
        if (workflow) {
            const { data: step } = await supabase.from('workflow_steps')
                .select('id')
                .eq('workflow_id', workflow.id)
                .order('step_order', { ascending: true })
                .limit(1)
                .maybeSingle();
            firstStepId = step?.id || null;
        }

        // Target initial assigned user
        const initialApprover = approvers.level1 || approvers.level2 || approvers.level3;

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
     * Fetch pending approvals for a specific employee/user
     */
    static async getMyApprovals(userId: string) {
        const { data: requests, error } = await supabase.from('workflow_instances')
            .select(`
                *,
                workflow:workflows(name),
                requester:employees!requester_id(name, profile_photo_url, designation, department)
            `)
            .eq('status', 'PENDING')
            .or(`assigned_to_user_id.eq.${userId}`);

        if (error) {
            console.error("Error fetching approvals:", error);
            throw error;
        }
        return requests || [];
    }

    /**
     * Process an Approval & Route to Next Approver Level
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

        // Get hierarchy for requester
        const approvers = await this.getEmployeeApprovers(instance.company_id, instance.requester_id);

        // Determine next level
        let nextApprover: string | null = null;
        if (instance.assigned_to_user_id === approvers.level1 && approvers.level2) {
            nextApprover = approvers.level2;
        } else if ((instance.assigned_to_user_id === approvers.level1 || instance.assigned_to_user_id === approvers.level2) && approvers.level3) {
            nextApprover = approvers.level3;
        }

        if (nextApprover) {
            // Advance to next approval level
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
     * Helper to update the entity record (Leaves, Resignations, Expenses)
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
            await supabase.from('expenses').update({
                status: dbStatus
            }).eq('id', entityId);
        }
    }
}
