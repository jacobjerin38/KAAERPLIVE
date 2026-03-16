-- People Intelligence Platform Schema

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_skills_emp ON employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_insights_emp ON employee_insights(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_insights_type ON employee_insights(type);
