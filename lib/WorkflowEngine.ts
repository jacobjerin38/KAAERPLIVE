import { supabase } from './supabase';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export class WorkflowEngine {

    /**
     * Start a new workflow for a specific entity (e.g., Leave Request)
     */
    static async startWorkflow(companyId: string, triggerType: string, entityId: string, requesterId: string, module: string) {
        // 1. Find the Active Workflow for this Trigger
        const { data: workflow } = await supabase.from('workflows')
            .select('id')
            .eq('company_id', companyId)
            .eq('trigger_type', triggerType)
            .eq('is_active', true)
            .single();

        if (!workflow) {
            console.warn(`No active workflow found for ${triggerType}. Auto-approving if applicable, or leaving orphan.`);
            return null;
        }

        // 2. Find the First Step
        const { data: firstStep } = await supabase.from('workflow_steps')
            .select('*')
            .eq('workflow_id', workflow.id)
            .order('step_order', { ascending: true })
            .limit(1)
            .single();

        if (!firstStep) {
            console.error("Workflow exists but has no steps.");
            return null;
        }

        // 3. Determine Assignee (Approver)
        // Simple Logic: If step is 'Manager', find requester's manager.
        let assignedUser = null;
        let assignedRole = null;

        if (firstStep.name.toLowerCase().includes('manager')) {
            const { data: emp } = await supabase.from('employees').select('reporting_manager_id').eq('id', requesterId).single();
            assignedUser = emp?.reporting_manager_id;
        } else {
            // Assign to role (e.g. HR Admin)
            // This requires mapping Step Role to DB Role ID. For now, we might leave it open to role.
            assignedRole = firstStep.role_id; // Assuming step has role_id, or we infer it.
        }

        // 4. Create Instance
        const { data: instance, error } = await supabase.from('workflow_instances').insert([{
            company_id: companyId,
            workflow_id: workflow.id,
            module,
            trigger_type: triggerType,
            entity_id: entityId,
            current_step_id: firstStep.id,
            status: 'PENDING',
            requester_id: requesterId,
            assigned_to_user_id: assignedUser,
            assigned_to_role_id: assignedRole
        }]).select().single();

        if (error) throw error;
        return instance;
    }

    /**
     * Fetch all pending approvals for a user
     */
    static async getMyApprovals(userId: string) {
        // 1. Get User's Roles to check role-based assignments
        // For simplified V1.2, we mainly check direct assignment or Manager logic.

        const { data: requests, error } = await supabase.from('workflow_instances')
            .select(`
                *,
                workflow:workflows(name),
                requester:employees!requester_id(name, profile_photo_url, designation, department)
            `)
            .eq('status', 'PENDING')
            .or(`assigned_to_user_id.eq.${userId}`);
        // .or(`assigned_to_role_id.in.(${userRoleIds})`) -- Add this for role based

        if (error) throw error;
        return requests;
    }

    /**
     * Process an Approval
     */
    static async approve(instanceId: string, actorId: string, comment?: string) {
        // 1. Get Current Instance
        const { data: instance } = await supabase.from('workflow_instances').select('*').eq('id', instanceId).single();
        if (!instance) throw new Error("Instance not found");

        // 2. Log Action
        await supabase.from('workflow_action_logs').insert([{
            instance_id: instanceId,
            step_id: instance.current_step_id,
            actor_id: actorId,
            action: 'APPROVE',
            comment
        }]);

        // 3. Find Next Step
        const { data: currentStep } = await supabase.from('workflow_steps').select('step_order, workflow_id').eq('id', instance.current_step_id).single();

        const { data: nextStep } = await supabase.from('workflow_steps')
            .select('*')
            .eq('workflow_id', currentStep.workflow_id)
            .gt('step_order', currentStep.step_order)
            .order('step_order', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (nextStep) {
            // Move to Next Step
            // Determine Assignee again... (Simplified for now: keep assigned to null or same)
            await supabase.from('workflow_instances').update({
                current_step_id: nextStep.id,
                updated_at: new Date().toISOString()
            }).eq('id', instanceId);
        } else {
            // Workflow Complete
            await supabase.from('workflow_instances').update({
                current_step_id: null,
                status: 'APPROVED',
                updated_at: new Date().toISOString()
            }).eq('id', instanceId);

            // TODO: Trigger Final Success Hook (e.g. Update Leave Table status to 'Approved')
            await this.finalizeEntity(instance.trigger_type, instance.entity_id, 'APPROVED');
        }
    }

    static async reject(instanceId: string, actorId: string, comment?: string) {
        const { data: instance } = await supabase.from('workflow_instances').select('*').eq('id', instanceId).single();

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
     * Helper to update the actual record (Leave, Expense, etc.)
     */
    private static async finalizeEntity(type: string, entityId: string, status: string) {
        const tableMap: Record<string, string> = {
            'LEAVE_REQUEST': 'leaves',
            'RESIGNATION': 'resignations',
            'EXPENSE_CLAIM': 'expenses'
        };

        const tableName = tableMap[type];
        if (!tableName) return;

        // Map 'APPROVED'/'REJECTED' to title case if needed, but DB usually uses Capitalized
        const dbStatus = status.charAt(0) + status.slice(1).toLowerCase(); // 'Approved'

        await supabase.from(tableName).update({ status: dbStatus }).eq('id', entityId);
    }
}
