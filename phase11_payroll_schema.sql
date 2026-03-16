-- Phase 11: Payroll Engine Schema & Logic

-- 1. Payroll Runs (Batch Header)
CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
    status TEXT DEFAULT 'Draft', -- 'Draft', 'Locked', 'Paid'
    total_net_amount NUMERIC DEFAULT 0,
    processed_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT uk_payroll_run_month UNIQUE (company_id, month_year)
);

-- 2. Payroll Records (Employee Line Items)
CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id),
    
    -- Snapshot of Master Configs
    pay_group_name TEXT,
    base_salary NUMERIC, -- The fixed CTC/Gross from employee profile
    
    -- Calculated Days
    total_days NUMERIC,
    payable_days NUMERIC,
    lop_days NUMERIC, -- Loss of Pay (Absent)
    
    -- Financials
    gross_earnings NUMERIC DEFAULT 0,
    total_deductions NUMERIC DEFAULT 0,
    net_salary NUMERIC DEFAULT 0,
    
    -- Detailed Breakdown (JSONB for flexibility)
    -- Structure: { "earnings": [{name: "Basic", amount: 5000}, ...], "deductions": [...] }
    salary_breakdown JSONB DEFAULT '{}'::jsonb
);

-- RLS Policies
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Payroll Runs Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payroll_runs' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON payroll_runs USING (company_id = get_my_company_id());
    END IF;
    
    -- Payroll Records Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payroll_records' AND policyname = 'Tenant Isolation') THEN
        CREATE POLICY "Tenant Isolation" ON payroll_records USING (company_id = get_my_company_id());
    END IF;
END
$$;


-- 3. Core Logic: Generate Payroll RPC
CREATE OR REPLACE FUNCTION rpc_generate_payroll(
    p_company_id UUID,
    p_month_year TEXT -- 'YYYY-MM'
) 
RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
    v_run_id UUID;
    v_year INT;
    v_month INT;
    v_days_in_month INT;
    v_start_date DATE;
    v_end_date DATE;
    emp RECORD;
    v_lop_days NUMERIC;
    v_payable_days NUMERIC;
    v_gross_earnings NUMERIC;
    v_total_deductions NUMERIC;
    v_net_salary NUMERIC;
    v_emp_daily_rate NUMERIC;
    v_emp_gross NUMERIC;
    v_components JSONB;
    comp RECORD;
    v_comp_amount NUMERIC;
    v_earnings_list JSONB;
    v_deductions_list JSONB;
BEGIN
    -- Parse Month/Year
    v_year := split_part(p_month_year, '-', 1)::INT;
    v_month := split_part(p_month_year, '-', 2)::INT;
    
    -- Calculate Days in Month
    v_start_date := make_date(v_year, v_month, 1);
    v_end_date := (v_start_date + interval '1 month' - interval '1 day')::DATE;
    v_days_in_month := DATE_PART('days', date_trunc('month', v_start_date) + '1 month - 1 day'::interval);

    -- 1. Create or Get Draft Run
    SELECT id INTO v_run_id FROM payroll_runs 
    WHERE company_id = p_company_id AND month_year = p_month_year;

    IF v_run_id IS NOT NULL THEN
        -- Cleanup existing records to re-process
        DELETE FROM payroll_records WHERE payroll_run_id = v_run_id;
    ELSE
        INSERT INTO payroll_runs (company_id, month_year, status, processed_by)
        VALUES (p_company_id, p_month_year, 'Draft', auth.uid())
        RETURNING id INTO v_run_id;
    END IF;

    -- 2. Loop Active Employees
    FOR emp IN 
        SELECT e.*, pg.name as pay_group_name 
        FROM employees e
        LEFT JOIN org_pay_groups pg ON e.pay_group_id = pg.id
        WHERE e.company_id = p_company_id 
        AND e.status = 'Active'
    LOOP
        -- A. Calculate LOP (Loss of Pay)
        -- Logic: Count Absents (1) and Half Days (0.5) in the attendance table for this month
        SELECT COALESCE(SUM(
            CASE 
                WHEN status = 'Absent' THEN 1 
                WHEN status = 'Half Day' THEN 0.5 
                ELSE 0 
            END
        ), 0) INTO v_lop_days
        FROM attendance 
        WHERE employee_id = emp.id 
        AND date BETWEEN v_start_date AND v_end_date;

        -- B. Calculate Payable Days (Basic Logic: Total - LOP)
        v_payable_days := v_days_in_month - v_lop_days;
        IF v_payable_days < 0 THEN v_payable_days := 0; END IF;

        -- C. Calculate Component Amounts
        v_earnings_list := '[]'::jsonb;
        v_deductions_list := '[]'::jsonb;
        v_gross_earnings := 0;
        v_total_deductions := 0;

        -- Fetch Mapped Components
        FOR comp IN 
            SELECT esc.amount, osc.name, osc.component_type, osc.is_taxable 
            FROM employee_salary_components esc
            JOIN org_salary_components osc ON esc.salary_component_id = osc.id
            WHERE esc.employee_id = emp.id AND esc.is_active = true
        LOOP
            -- Pro-rate calculation: (FixedAmount / DaysInMonth) * PayableDays
            v_comp_amount := ROUND((comp.amount / v_days_in_month) * v_payable_days, 2);
            
            IF comp.component_type = 'Earning' THEN
                v_gross_earnings := v_gross_earnings + v_comp_amount;
                v_earnings_list := v_earnings_list || jsonb_build_object('name', comp.name, 'amount', v_comp_amount);
            ELSIF comp.component_type = 'Deduction' THEN
                v_total_deductions := v_total_deductions + v_comp_amount;
                v_deductions_list := v_deductions_list || jsonb_build_object('name', comp.name, 'amount', v_comp_amount);
            END IF;
        END LOOP;
        
        -- Fallback: If no components mapped, use base_salary as "Basic"
        IF jsonb_array_length(v_earnings_list) = 0 AND emp.salary_amount > 0 THEN
             v_emp_gross := ROUND((emp.salary_amount / v_days_in_month) * v_payable_days, 2);
             v_gross_earnings := v_emp_gross;
             v_earnings_list := v_earnings_list || jsonb_build_object('name', 'Basic Salary', 'amount', v_emp_gross);
        END IF;

        v_net_salary := v_gross_earnings - v_total_deductions;

        -- D. Insert Record
        INSERT INTO payroll_records (
            company_id, payroll_run_id, employee_id,
            pay_group_name, base_salary,
            total_days, payable_days, lop_days,
            gross_earnings, total_deductions, net_salary,
            salary_breakdown
        ) VALUES (
            p_company_id, v_run_id, emp.id,
            emp.pay_group_name, emp.salary_amount,
            v_days_in_month, v_payable_days, v_lop_days,
            v_gross_earnings, v_total_deductions, v_net_salary,
            jsonb_build_object('earnings', v_earnings_list, 'deductions', v_deductions_list)
        );

    END LOOP;

    -- Update Total
    UPDATE payroll_runs 
    SET total_net_amount = (SELECT COALESCE(SUM(net_salary), 0) FROM payroll_records WHERE payroll_run_id = v_run_id)
    WHERE id = v_run_id;

    RETURN v_run_id;
END;
$$;
