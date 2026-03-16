-- ==============================================================================
-- KAA ERP V1.1 - SEED DATA FUNCTION
-- Reusable function to populate master data for ANY company
-- ==============================================================================

CREATE OR REPLACE FUNCTION rpc_seed_company_data(v_company_id UUID)
RETURNS VOID AS $$
BEGIN
    RAISE NOTICE 'Seeding master data for company_id: %', v_company_id;
    
    -- ------------------------------------------------------------------------------
    -- Common Attribute Masters
    -- ------------------------------------------------------------------------------
    
    -- Faiths / Religions
    INSERT INTO org_faiths (code, name, company_id) VALUES
    ('HINDU', 'Hinduism', v_company_id),
    ('MUSLIM', 'Islam', v_company_id),
    ('CHRISTIAN', 'Christianity', v_company_id),
    ('SIKH', 'Sikhism', v_company_id),
    ('BUDDHIST', 'Buddhism', v_company_id),
    ('JAIN', 'Jainism', v_company_id),
    ('OTHER', 'Other', v_company_id),
    ('PREFER_NOT_TO_SAY', 'Prefer not to say', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Marital Status
    INSERT INTO org_marital_status (code, name, company_id) VALUES
    ('SINGLE', 'Single', v_company_id),
    ('MARRIED', 'Married', v_company_id),
    ('DIVORCED', 'Divorced', v_company_id),
    ('WIDOWED', 'Widowed', v_company_id),
    ('SEPARATED', 'Separated', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Blood Groups
    INSERT INTO org_blood_groups (code, name, company_id) VALUES
    ('A_POSITIVE', 'A+', v_company_id),
    ('A_NEGATIVE', 'A-', v_company_id),
    ('B_POSITIVE', 'B+', v_company_id),
    ('B_NEGATIVE', 'B-', v_company_id),
    ('O_POSITIVE', 'O+', v_company_id),
    ('O_NEGATIVE', 'O-', v_company_id),
    ('AB_POSITIVE', 'AB+', v_company_id),
    ('AB_NEGATIVE', 'AB-', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Nationalities
    INSERT INTO org_nationalities (code, name, company_id) VALUES
    ('IN', 'Indian', v_company_id),
    ('US', 'American', v_company_id),
    ('GB', 'British', v_company_id),
    ('CA', 'Canadian', v_company_id),
    ('AU', 'Australian', v_company_id),
    ('UAE', 'Emirati', v_company_id),
    ('SG', 'Singaporean', v_company_id),
    ('OTHER', 'Other', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- ------------------------------------------------------------------------------
    -- Core Organization Masters
    -- ------------------------------------------------------------------------------
    
    -- Designations
    INSERT INTO org_designations (code, name, description, company_id) VALUES
    ('TL', 'Team Lead', 'Team leadership position', v_company_id),
    ('MGR', 'Manager', 'Department manager', v_company_id),
    ('SMGR', 'Senior Manager', 'Senior management role', v_company_id),
    ('DIR', 'Director', 'Directorial position', v_company_id),
    ('VP', 'Vice President', 'VP level position', v_company_id),
    ('SWE', 'Software Engineer', 'Software development role', v_company_id),
    ('SSWE', 'Senior Software Engineer', 'Senior software development role', v_company_id),
    ('ANALYST', 'Business Analyst', 'Business analysis role', v_company_id),
    ('HR', 'HR Executive', 'Human resources role', v_company_id),
    ('SALES', 'Sales Executive', 'Sales position', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Grades
    INSERT INTO org_grades (code, name, description, company_id) VALUES
    ('G1', 'Grade 1', 'Entry level', v_company_id),
    ('G2', 'Grade 2', 'Junior level', v_company_id),
    ('G3', 'Grade 3', 'Mid level', v_company_id),
    ('G4', 'Grade 4', 'Senior level', v_company_id),
    ('G5', 'Grade 5', 'Principal level', v_company_id),
    ('G6', 'Grade 6', 'Director level', v_company_id),
    ('G7', 'Grade 7', 'Executive level', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Employment Types
    INSERT INTO org_employment_types (code, name, description, company_id) VALUES
    ('FT', 'Full-time', 'Full-time permanent employee', v_company_id),
    ('PT', 'Part-time', 'Part-time employee', v_company_id),
    ('CONTRACT', 'Contract', 'Contract-based employment', v_company_id),
    ('INTERN', 'Intern', 'Internship position', v_company_id),
    ('CONSULTANT', 'Consultant', 'External consultant', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- ------------------------------------------------------------------------------
    -- HRMS-Specific Masters
    -- ------------------------------------------------------------------------------
    
    -- Probation Periods
    INSERT INTO org_probation_periods (code, name, duration_months, company_id) VALUES
    ('PROB_3', '3 Months', 3, v_company_id),
    ('PROB_6', '6 Months', 6, v_company_id),
    ('PROB_12', '12 Months', 12, v_company_id),
    ('NO_PROB', 'No Probation', 0, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Confirmation Status
    INSERT INTO org_confirmation_status (code, name, company_id) VALUES
    ('PROBATION', 'On Probation', v_company_id),
    ('CONFIRMED', 'Confirmed', v_company_id),
    ('PENDING_CONF', 'Pending Confirmation', v_company_id),
    ('EXTENDED_PROB', 'Extended Probation', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Exit Reasons
    INSERT INTO org_exit_reasons (code, name, company_id) VALUES
    ('RESIGNATION', 'Resignation', v_company_id),
    ('TERMINATION', 'Termination', v_company_id),
    ('RETIREMENT', 'Retirement', v_company_id),
    ('END_OF_CONTRACT', 'End of Contract', v_company_id),
    ('MUTUAL_SEPARATION', 'Mutual Separation', v_company_id),
    ('HEALTH_REASONS', 'Health Reasons', v_company_id),
    ('RELOCATION', 'Relocation', v_company_id),
    ('HIGHER_STUDIES', 'Higher Studies', v_company_id),
    ('BETTER_OPPORTUNITY', 'Better Opportunity', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- ------------------------------------------------------------------------------
    -- Payroll Masters
    -- ------------------------------------------------------------------------------
    
    -- Salary Components
    INSERT INTO org_salary_components (code, name, component_type, is_taxable, company_id) VALUES
    ('BASIC', 'Basic Salary', 'EARNING', true, v_company_id),
    ('HRA', 'House Rent Allowance', 'EARNING', true, v_company_id),
    ('DA', 'Dearness Allowance', 'EARNING', true, v_company_id),
    ('TA', 'Transport Allowance', 'EARNING', false, v_company_id),
    ('MEDICAL', 'Medical Allowance', 'EARNING', false, v_company_id),
    ('SPECIAL', 'Special Allowance', 'EARNING', true, v_company_id),
    ('BONUS', 'Performance Bonus', 'EARNING', true, v_company_id),
    ('PF', 'Provident Fund', 'DEDUCTION', false, v_company_id),
    ('ESI', 'Employee State Insurance', 'DEDUCTION', false, v_company_id),
    ('PT', 'Professional Tax', 'DEDUCTION', false, v_company_id),
    ('TDS', 'Tax Deducted at Source', 'DEDUCTION', false, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Pay Groups
    INSERT INTO org_pay_groups (code, name, pay_frequency, company_id) VALUES
    ('MONTHLY', 'Monthly Payroll', 'MONTHLY', v_company_id),
    ('WEEKLY', 'Weekly Payroll', 'WEEKLY', v_company_id),
    ('BI_WEEKLY', 'Bi-weekly Payroll', 'BI_WEEKLY', v_company_id),
    ('CONTRACT', 'Contract Payroll', 'MONTHLY', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Bank Configs
    INSERT INTO org_bank_configs (code, name, bank_name, company_id) VALUES
    ('HDFC', 'HDFC Bank', 'HDFC Bank', v_company_id),
    ('ICICI', 'ICICI Bank', 'ICICI Bank', v_company_id),
    ('SBI', 'State Bank of India', 'State Bank of India', v_company_id),
    ('AXIS', 'Axis Bank', 'Axis Bank', v_company_id),
    ('KOTAK', 'Kotak Mahindra Bank', 'Kotak Mahindra Bank', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- ------------------------------------------------------------------------------
    -- Leave Masters
    -- ------------------------------------------------------------------------------
    
    -- Leave Types
    INSERT INTO org_leave_types (code, name, default_balance, is_paid, requires_approval, company_id) VALUES
    ('CL', 'Casual Leave', 12, true, true, v_company_id),
    ('SL', 'Sick Leave', 10, true, false, v_company_id),
    ('PL', 'Privilege Leave', 15, true, true, v_company_id),
    ('EL', 'Earned Leave', 15, true, true, v_company_id),
    ('ML', 'Maternity Leave', 180, true, true, v_company_id),
    ('PL_PATERNITY', 'Paternity Leave', 15, true, true, v_company_id),
    ('COMP_OFF', 'Compensatory Off', 0, true, true, v_company_id),
    ('LWP', 'Leave Without Pay', 0, false, true, v_company_id),
    ('BEREAVEMENT', 'Bereavement Leave', 5, true, false, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Leave Policies
    INSERT INTO org_leave_policies (code, name, leave_type_id, max_consecutive_days, can_carry_forward, company_id) 
    SELECT 'CL_POLICY', 'Casual Leave Policy', id, 3, false, v_company_id 
    FROM org_leave_types WHERE code = 'CL' AND company_id = v_company_id LIMIT 1
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_leave_policies (code, name, leave_type_id, max_consecutive_days, can_carry_forward, company_id) 
    SELECT 'PL_POLICY', 'Privilege Leave Policy', id, 15, true, v_company_id 
    FROM org_leave_types WHERE code = 'PL' AND company_id = v_company_id LIMIT 1
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Holiday Calendar
    INSERT INTO org_holiday_calendar (name, holiday_date, is_mandatory, company_id) VALUES
    ('Republic Day', '2026-01-26', true, v_company_id),
    ('Holi', '2026-03-14', true, v_company_id),
    ('Good Friday', '2026-04-03', false, v_company_id),
    ('Independence Day', '2026-08-15', true, v_company_id),
    ('Gandhi Jayanti', '2026-10-02', true, v_company_id),
    ('Diwali', '2026-10-20', true, v_company_id),
    ('Christmas', '2026-12-25', true, v_company_id);
    
    -- ------------------------------------------------------------------------------
    -- Attendance Masters
    -- ------------------------------------------------------------------------------
    
    -- Shift Timings
    INSERT INTO org_shift_timings (code, name, start_time, end_time, grace_period_minutes, company_id) VALUES
    ('GENERAL', 'General Shift (9 AM - 6 PM)', '09:00:00', '18:00:00', 15, v_company_id),
    ('MORNING', 'Morning Shift (7 AM - 4 PM)', '07:00:00', '16:00:00', 10, v_company_id),
    ('EVENING', 'Evening Shift (2 PM - 11 PM)', '14:00:00', '23:00:00', 10, v_company_id),
    ('NIGHT', 'Night Shift (10 PM - 7 AM)', '22:00:00', '07:00:00', 15, v_company_id),
    ('FLEXIBLE', 'Flexible Shift', '00:00:00', '23:59:59', 0, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Week-off Rules
    INSERT INTO org_weekoff_rules (code, name, weekdays, company_id) VALUES
    ('SAT_SUN', 'Saturday & Sunday', ARRAY['SATURDAY', 'SUNDAY'], v_company_id),
    ('SUN_ONLY', 'Sunday Only', ARRAY['SUNDAY'], v_company_id),
    ('FRI_SAT', 'Friday & Saturday', ARRAY['FRIDAY', 'SATURDAY'], v_company_id),
    ('ALT_SAT', 'Alternate Saturdays', ARRAY['SUNDAY'], v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Attendance Status
    INSERT INTO org_attendance_status (code, name, affects_salary, company_id) VALUES
    ('PRESENT', 'Present', false, v_company_id),
    ('ABSENT', 'Absent', true, v_company_id),
    ('HALF_DAY', 'Half Day', true, v_company_id),
    ('ON_LEAVE', 'On Leave', false, v_company_id),
    ('WEEK_OFF', 'Week Off', false, v_company_id),
    ('HOLIDAY', 'Holiday', false, v_company_id),
    ('WORK_FROM_HOME', 'Work From Home', false, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    -- Punch Rules
    INSERT INTO org_punch_rules (code, name, min_work_hours, overtime_threshold_hours, company_id) VALUES
    ('STANDARD', 'Standard 8-hour rule', 8.0, 9.0, v_company_id),
    ('RELAXED', 'Relaxed 7-hour rule', 7.0, 10.0, v_company_id),
    ('STRICT', 'Strict 9-hour rule', 9.0, 10.0, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
