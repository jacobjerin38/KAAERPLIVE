-- ==============================================================================
-- CREATE ALL ORG MASTER TABLES
-- Already applied to production via MCP migration
-- ==============================================================================

CREATE TABLE IF NOT EXISTS org_designations (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, description TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_grades (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, description TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_employment_types (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, description TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_salary_components (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, component_type TEXT DEFAULT 'EARNING', is_taxable BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_pay_groups (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, pay_frequency TEXT DEFAULT 'MONTHLY', salary_day INTEGER DEFAULT 28, attendance_required BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_financial_years (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, code TEXT NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_payroll_months (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, financial_year_id UUID REFERENCES org_financial_years(id), month_year DATE NOT NULL, status TEXT DEFAULT 'OPEN', created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_leave_calendar_years (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, year INTEGER NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_shift_timings (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, grace_period_minutes INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_leave_types (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, default_balance INTEGER DEFAULT 0, is_paid BOOLEAN DEFAULT true, requires_approval BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_bank_configs (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, bank_name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_faiths (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_marital_status (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_blood_groups (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS org_nationalities (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS master_kudos_categories (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, icon TEXT, points INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS surveys (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, expiration_date DATE, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());

-- RLS Policies
DO $$ DECLARE tbl TEXT; tables TEXT[] := ARRAY['org_designations','org_grades','org_employment_types','org_salary_components','org_pay_groups','org_financial_years','org_payroll_months','org_leave_calendar_years','org_shift_timings','org_leave_types','org_bank_configs','org_faiths','org_marital_status','org_blood_groups','org_nationalities','master_kudos_categories','surveys'];
BEGIN FOREACH tbl IN ARRAY tables LOOP
EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
EXECUTE format('DROP POLICY IF EXISTS "Users can view %1$s" ON %1$I', tbl);
EXECUTE format('DROP POLICY IF EXISTS "Users can insert %1$s" ON %1$I', tbl);
EXECUTE format('DROP POLICY IF EXISTS "Users can update %1$s" ON %1$I', tbl);
EXECUTE format('DROP POLICY IF EXISTS "Users can delete %1$s" ON %1$I', tbl);
EXECUTE format('CREATE POLICY "Users can view %1$s" ON %1$I FOR SELECT USING (company_id = get_my_company_id())', tbl);
EXECUTE format('CREATE POLICY "Users can insert %1$s" ON %1$I FOR INSERT WITH CHECK (company_id = get_my_company_id())', tbl);
EXECUTE format('CREATE POLICY "Users can update %1$s" ON %1$I FOR UPDATE USING (company_id = get_my_company_id())', tbl);
EXECUTE format('CREATE POLICY "Users can delete %1$s" ON %1$I FOR DELETE USING (company_id = get_my_company_id())', tbl);
END LOOP; END $$;
