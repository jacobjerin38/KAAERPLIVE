-- KAA ERP V1.2 Manual Deployment Package
-- Contains: Workflow Engine, Report Engine, CRM Automations, People Intelligence
-- Run this entire script in the Supabase Dashboard SQL Editor

-- SECTION 1: WORKFLOW ENGINE (UNIFIED)
--------------------------------------------------------------------------------

-- Ensure Roles exists (Minimal definition if missing)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    company_id UUID
);

-- 1. Workflow Definitions
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name TEXT NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Workflow Steps
CREATE TABLE IF NOT EXISTS workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    name TEXT NOT NULL, -- 'Manager Approval', 'HR Verification'
    approver_role_id UUID REFERENCES roles(id),
    is_final_step BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Workflow Instances
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

-- 4. Workflow Action Logs
CREATE TABLE IF NOT EXISTS workflow_action_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_id UUID REFERENCES workflow_steps(id),
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'APPROVE', 'REJECT', 'COMMENT'
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Workflow Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_instances_assigned_user ON workflow_instances(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_assigned_role ON workflow_instances(assigned_to_role_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_requester ON workflow_instances(requester_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);


-- SECTION 2: REPORT ENGINE
--------------------------------------------------------------------------------

-- 1. Report Schema Registry
CREATE TABLE IF NOT EXISTS report_schema_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module TEXT NOT NULL, -- 'EMPLOYEE', 'ATTENDANCE', 'CRM'
    field_key TEXT NOT NULL, -- 'email', 'department.name'
    field_label TEXT NOT NULL, -- 'Email Address', 'Department'
    data_type TEXT NOT NULL, -- 'text', 'number', 'date', 'boolean'
    is_filterable BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Report Definitions
CREATE TABLE IF NOT EXISTS report_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    module TEXT NOT NULL,
    config JSONB NOT NULL, -- { columns: [], filters: [], sort: [] }
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Data for Employees Module
INSERT INTO report_schema_registry (module, field_key, field_label, data_type) VALUES
('EMPLOYEE', 'employee_code', 'Employee ID', 'text'),
('EMPLOYEE', 'name', 'Full Name', 'text'),
('EMPLOYEE', 'email', 'Email Address', 'text'),
('EMPLOYEE', 'designation.name', 'Designation', 'text'),
('EMPLOYEE', 'department.name', 'Department', 'text'),
('EMPLOYEE', 'join_date', 'Date of Joining', 'date'),
('EMPLOYEE', 'status', 'Status', 'text'),
('EMPLOYEE', 'office_mobile', 'Mobile Number', 'text'),
('EMPLOYEE', 'manager.name', 'Reporting Manager', 'text')
ON CONFLICT DO NOTHING;

-- Seed Data for Attendance Module
INSERT INTO report_schema_registry (module, field_key, field_label, data_type) VALUES
('ATTENDANCE', 'date', 'Date', 'date'),
('ATTENDANCE', 'employee.name', 'Employee Name', 'text'),
('ATTENDANCE', 'status', 'Attendance Status', 'text'),
('ATTENDANCE', 'check_in', 'Check In Time', 'text'),
('ATTENDANCE', 'check_out', 'Check Out Time', 'text'),
('ATTENDANCE', 'duration', 'Duration (Hrs)', 'number')
ON CONFLICT DO NOTHING;


-- SECTION 3: CRM AUTOMATIONS
--------------------------------------------------------------------------------

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

CREATE INDEX IF NOT EXISTS idx_crm_automations_company ON crm_automations(company_id);


-- SECTION 4: PEOPLE INTELLIGENCE PLATFORM
--------------------------------------------------------------------------------

-- 1. Skills Master
CREATE TABLE IF NOT EXISTS org_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name TEXT NOT NULL,
    category TEXT, -- 'Technical', 'Soft Skill', 'Leadership'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Employee Skills
CREATE TABLE IF NOT EXISTS employee_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES org_skills(id),
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5), -- 1=Novice, 5=Expert
    verification_status TEXT DEFAULT 'Self-Declared', -- 'Self-Declared', 'Manager-Verified', 'Certified'
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, skill_id)
);

-- 3. Career Paths
CREATE TABLE IF NOT EXISTS career_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    title TEXT NOT NULL, -- e.g. 'Software Engineering Track'
    description TEXT,
    steps JSONB DEFAULT '[]', -- Array of { "role_id": "...", "step_name": "Senior Eng", "required_skills": ["..."] }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Employee Insights (The Intelligence Layer)
CREATE TABLE IF NOT EXISTS employee_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'ATTRITION_RISK', 'OVERTIME_ALERT', 'SKILL_GAP', 'PROMOTION_READINESS'
    score NUMERIC, -- e.g. 0.85 (High Risk) or 4 (Hours OT)
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'
    data JSONB DEFAULT '{}', -- Context e.g. { "reason": "Consistent late checkouts", "trend": "UP" }
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ -- Optional expiry for insights
);

-- Indexes for People Intelligence
CREATE INDEX IF NOT EXISTS idx_employee_skills_emp ON employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_insights_emp ON employee_insights(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_insights_type ON employee_insights(type);
