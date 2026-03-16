-- Workflow Engine Schema

-- 1. Workflow Instances: Tracks the lifecycle of a single request
CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    workflow_id UUID REFERENCES workflows(id),
    module TEXT NOT NULL, -- 'HRMS', 'CRM', etc.
    trigger_type TEXT NOT NULL, -- 'LEAVE_REQUEST', 'EXPENSE_CLAIM', etc.
    entity_id UUID NOT NULL, -- The ID of the leave/expense record
    current_step_id UUID REFERENCES workflow_steps(id), -- Null if completed/not started
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
    requester_id UUID REFERENCES auth.users(id), -- Who initiated it
    assigned_to_user_id UUID REFERENCES auth.users(id), -- Specific approver if known
    assigned_to_role_id UUID REFERENCES roles(id), -- Role that can approve (e.g. 'Manager')
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Workflow Action Logs: Audit trail of who did what
CREATE TABLE IF NOT EXISTS workflow_action_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_id UUID REFERENCES workflow_steps(id),
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'APPROVE', 'REJECT', 'COMMENT'
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_instances_assigned_user ON workflow_instances(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_assigned_role ON workflow_instances(assigned_to_role_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_requester ON workflow_instances(requester_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
