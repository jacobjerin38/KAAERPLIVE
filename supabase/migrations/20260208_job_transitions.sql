-- ==============================================================================
-- JOB TRANSITION & COMPENSATION MODULE
-- ==============================================================================

DROP TABLE IF EXISTS employee_job_transitions CASCADE;
DROP TABLE IF EXISTS employee_compensation_versions CASCADE;
DROP TABLE IF EXISTS employee_career_timeline CASCADE;

-- 1. Employee Job Transitions Table
CREATE TABLE IF NOT EXISTS employee_job_transitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    
    transition_type TEXT NOT NULL, -- 'PROMOTION', 'TRANSFER', 'ROLE_CHANGE', 'EXIT', 'CONFIRMATION'
    
    -- Snapshots of data
    current_data JSONB DEFAULT '{}'::jsonb, -- Snapshot of current design/dept/manager etc.
    new_data JSONB DEFAULT '{}'::jsonb, -- The proposed changes
    
    effective_date DATE NOT NULL,
    reason TEXT,
    remarks TEXT,
    
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED'
    
    requester_id UUID REFERENCES employees(id),
    approver_id UUID REFERENCES employees(id),
    approval_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT
);

-- 2. Employee Compensation Versions Table
CREATE TABLE IF NOT EXISTS employee_compensation_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    
    effective_date DATE NOT NULL,
    
    ctc NUMERIC NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    
    -- Detailed breakdown of salary components
    component_breakdown JSONB DEFAULT '[]'::jsonb, -- Array of { component_id, amount, type }
    
    is_active BOOLEAN DEFAULT false, -- Only one active version per employee usually (the current one)
    reason TEXT, -- 'INCREMENT', 'CORRECTION', 'JOINING'
    
    transition_id UUID REFERENCES employee_job_transitions(id) -- Link if part of a formal transition
);

-- 3. Employee Career Timeline Table (ReadOnly Log)
CREATE TABLE IF NOT EXISTS employee_career_timeline (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL, -- 'JOINED', 'PROMOTION', 'TRANSFER', 'APPRAISAL', 'EXIT'
    
    title TEXT NOT NULL, -- Short headline e.g. "Promoted to Senior Analyst"
    description TEXT, -- Detailed text
    
    metadata JSONB DEFAULT '{}'::jsonb, -- Store "From -> To" details here for UI rendering
    
    visibility TEXT DEFAULT 'ALL' -- 'ALL', 'ADMIN_ONLY', 'MANAGER_AND_ABOVE'
);

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

-- Transitions
ALTER TABLE employee_job_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation" ON employee_job_transitions
    USING (company_id = get_my_company_id());

CREATE POLICY "Employees can view their own transitions" ON employee_job_transitions
    FOR SELECT USING (employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid()));

-- Compensation Versions
ALTER TABLE employee_compensation_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation" ON employee_compensation_versions
    USING (company_id = get_my_company_id());

CREATE POLICY "Employees can view their own compensation history" ON employee_compensation_versions
    FOR SELECT USING (employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid()));

-- Career Timeline
ALTER TABLE employee_career_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation" ON employee_career_timeline
    USING (company_id = get_my_company_id());

CREATE POLICY "Employees can view their own timeline" ON employee_career_timeline
    FOR SELECT USING (employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid()));
    
-- ==============================================================================
-- RPC FUNCTIONS
-- ==============================================================================

-- Function to Submit a Transition Request
CREATE OR REPLACE FUNCTION submit_job_transition(
    p_employee_id UUID,
    p_transition_type TEXT,
    p_current_data JSONB,
    p_new_data JSONB,
    p_effective_date DATE,
    p_reason TEXT,
    p_remarks TEXT
)
RETURNS UUID AS $$
DECLARE
    v_transition_id UUID;
    v_company_id UUID;
BEGIN
    -- Get Company ID
    SELECT company_id INTO v_company_id FROM employees WHERE id = p_employee_id;
    
    INSERT INTO employee_job_transitions (
        company_id,
        employee_id,
        transition_type,
        current_data,
        new_data,
        effective_date,
        reason,
        remarks,
        requester_id,
        status
    ) VALUES (
        v_company_id,
        p_employee_id,
        p_transition_type,
        p_current_data,
        p_new_data,
        p_effective_date,
        p_reason,
        p_remarks,
        (SELECT id FROM employees WHERE profile_id = auth.uid() LIMIT 1),
        'PENDING'
    ) RETURNING id INTO v_transition_id;
    
    RETURN v_transition_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to Approve Transition (Updates Status only - real application happens via scheduled job or apply function)
CREATE OR REPLACE FUNCTION approve_job_transition(
    p_transition_id UUID,
    p_approver_notes TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE employee_job_transitions
    SET 
        status = 'APPROVED',
        approver_id = (SELECT id FROM employees WHERE profile_id = auth.uid() LIMIT 1),
        approval_date = now(),
        remarks = COALESCE(remarks, '') || E'\nApprover Note: ' || p_approver_notes
    WHERE id = p_transition_id AND status = 'PENDING';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to Apply a Transition (Executes the changes)
-- This can be called immediately if effective date is today/past, or via chron
CREATE OR REPLACE FUNCTION apply_job_transition(p_transition_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_transition RECORD;
    v_new_data JSONB;
BEGIN
    SELECT * INTO v_transition FROM employee_job_transitions WHERE id = p_transition_id;
    
    IF v_transition.status != 'APPROVED' THEN
        RETURN FALSE;
    END IF;
    
    v_new_data := v_transition.new_data;
    
    -- Update Employee Master
    -- Note: We use COALESCE to only update fields that are present in the new_data JSON
    -- Casting JSONB values to text/int requires care.
    
    UPDATE employees
    SET 
        designation_id = COALESCE((v_new_data->>'designation_id')::BIGINT, designation_id),
        department_id = COALESCE((v_new_data->>'department_id')::BIGINT, department_id),
        manager_id = COALESCE((v_new_data->>'manager_id')::UUID, manager_id),
        location_id = COALESCE((v_new_data->>'location_id')::BIGINT, location_id),
        employment_type_id = COALESCE((v_new_data->>'employment_type_id')::BIGINT, employment_type_id)
    WHERE id = v_transition.employee_id;
    
    -- Create Timeline Entry
    INSERT INTO employee_career_timeline (
        company_id,
        employee_id,
        event_date,
        event_type,
        title,
        description,
        metadata
    ) VALUES (
        v_transition.company_id,
        v_transition.employee_id,
        v_transition.effective_date,
        v_transition.transition_type,
        CASE 
            WHEN v_transition.transition_type = 'PROMOTION' THEN 'Promoted'
            WHEN v_transition.transition_type = 'TRANSFER' THEN 'Department Transfer'
            ELSE initcap(replace(v_transition.transition_type, '_', ' '))
        END,
        v_transition.reason,
        jsonb_build_object(
            'from', v_transition.current_data,
            'to', v_transition.new_data
        )
    );
    
    -- Update Transition Status
    UPDATE employee_job_transitions
    SET status = 'APPLIED'
    WHERE id = p_transition_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
