-- CRM Automations Schema

CREATE TABLE IF NOT EXISTS crm_automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL, -- 'DEAL_STAGE_CHANGED', 'TASK_COMPLETED'
    trigger_config JSONB DEFAULT '{}', -- { "from_stage": 1, "to_stage": 2 }
    action_type TEXT NOT NULL, -- 'CREATE_TASK', 'SEND_EMAIL', 'NOTIFY_SLACK'
    action_config JSONB DEFAULT '{}', -- { "task_title": "Follow up", "due_in_days": 3 }
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_crm_automations_company ON crm_automations(company_id);
