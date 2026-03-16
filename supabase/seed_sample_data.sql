-- ==============================================================================
-- SEED SAMPLE DATA (Employees, Salary, Attendance)
-- Run this in Supabase SQL Editor
-- ==============================================================================

DO $$
DECLARE
    v_company_id UUID;
    
    -- Department IDs
    v_dept_sales UUID;
    v_dept_eng UUID;
    v_dept_hr UUID;
    v_dept_mkt UUID;
    v_dept_ops UUID;
    v_dept_mgmt UUID;
    v_dept_supp UUID;
    
    -- Designation IDs (BIGINT)
    v_desig_mgr BIGINT;
    v_desig_ceo BIGINT;
    v_desig_intern BIGINT;
    v_desig_eng BIGINT;
    v_desig_exec BIGINT;
    v_desig_supp BIGINT;

    -- Role IDs (UUID)
    v_role_admin UUID;
    v_role_mgr UUID;
    v_role_emp UUID;
    
    -- Employee IDs
    v_emp_phil UUID;
    v_emp_clair UUID;
    v_emp_ariel UUID;
    v_emp_john UUID;
    v_emp_sam UUID;
    v_emp_fred UUID;
    v_emp_sera UUID;
    
    -- Salary Component IDs (BIGINT)
    v_comp_basic BIGINT;
    v_comp_hra BIGINT;
    v_comp_sa BIGINT;
    v_comp_pf BIGINT;
    v_comp_pt BIGINT;
    
    -- User ID for Jerin
    v_user_jerin UUID;
    
    -- Loop variables
    v_date DATE;
    v_start_date DATE := '2026-01-01';
    v_end_date DATE := '2026-02-28';
    v_emp_rec RECORD;
    v_random_min INT;
BEGIN
    -- 1. Get Company ID
    -- Priority 1: Try to find company for 'jerin@kaa.com' if they exist as an employee
    SELECT company_id INTO v_company_id FROM employees WHERE email = 'jerin@kaa.com' LIMIT 1;

    -- Priority 2: If not found, just pick the first company in the list
    IF v_company_id IS NULL THEN
        SELECT id INTO v_company_id FROM companies LIMIT 1;
    END IF;
    
    -- Fallback if no company exists
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No company found. Please create a company first.';
    ELSE
        RAISE NOTICE 'Seeding data for Company ID: %', v_company_id;
    END IF;

    -- 1b. Link 'jerin@kaa.com' to this company (if auth user exists)
    SELECT id INTO v_user_jerin FROM auth.users WHERE email = 'jerin@kaa.com';
    
    IF v_user_jerin IS NOT NULL THEN
        -- Ensure profile exists (to satisfy FK)
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_jerin) THEN
            -- Fix: Use correct columns based on Login.tsx (id, company_id, full_name, role)
            INSERT INTO profiles (id, company_id, full_name, role)
            VALUES (v_user_jerin, v_company_id, 'Jerin (Admin)', 'admin');
            RAISE NOTICE 'Created missing profile for Jerin';
        ELSE
            -- Update existing profile company_id
            UPDATE profiles SET company_id = v_company_id WHERE id = v_user_jerin;
        END IF;

        -- Check if employee exists
        IF NOT EXISTS (SELECT 1 FROM employees WHERE email = 'jerin@kaa.com') THEN
             INSERT INTO employees (company_id, name, email, department_id, designation_id, status, salary_amount, join_date, gender, role, role_id, profile_id)
             VALUES (v_company_id, 'Jerin (Admin)', 'jerin@kaa.com', v_dept_mgmt, v_desig_ceo, 'Active', 200000, '2023-01-01', 'Male', 'Admin', v_role_admin, v_user_jerin);
             RAISE NOTICE 'Created employee record for Jerin linked to Company %', v_company_id;
        ELSE
             -- Update existing employee to ensure company match (optional, but good for visibility)
             UPDATE employees SET company_id = v_company_id, profile_id = v_user_jerin WHERE email = 'jerin@kaa.com';
             RAISE NOTICE 'Updated existing employee Jerin to Company %', v_company_id;
        END IF;
    ELSE
        RAISE NOTICE 'User jerin@kaa.com not found in auth.users. Skipping linkage.';
    END IF;

    -- 2. Upsert Departments (UUID) - Safe Insert
    IF NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Sales' AND company_id = v_company_id) THEN
        INSERT INTO departments (company_id, name, code) VALUES (v_company_id, 'Sales', 'SAL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Engineering' AND company_id = v_company_id) THEN
        INSERT INTO departments (company_id, name, code) VALUES (v_company_id, 'Engineering', 'ENG');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Human Resources' AND company_id = v_company_id) THEN
        INSERT INTO departments (company_id, name, code) VALUES (v_company_id, 'Human Resources', 'HR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Marketing' AND company_id = v_company_id) THEN
        INSERT INTO departments (company_id, name, code) VALUES (v_company_id, 'Marketing', 'MKT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Operations' AND company_id = v_company_id) THEN
        INSERT INTO departments (company_id, name, code) VALUES (v_company_id, 'Operations', 'OPS');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Management' AND company_id = v_company_id) THEN
        INSERT INTO departments (company_id, name, code) VALUES (v_company_id, 'Management', 'MGMT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Customer Support' AND company_id = v_company_id) THEN
        INSERT INTO departments (company_id, name, code) VALUES (v_company_id, 'Customer Support', 'SUP');
    END IF;
    
    SELECT id INTO v_dept_sales FROM departments WHERE name = 'Sales' AND company_id = v_company_id;
    SELECT id INTO v_dept_eng FROM departments WHERE name = 'Engineering' AND company_id = v_company_id;
    SELECT id INTO v_dept_hr FROM departments WHERE name = 'Human Resources' AND company_id = v_company_id;
    SELECT id INTO v_dept_mkt FROM departments WHERE name = 'Marketing' AND company_id = v_company_id;
    SELECT id INTO v_dept_ops FROM departments WHERE name = 'Operations' AND company_id = v_company_id;
    SELECT id INTO v_dept_mgmt FROM departments WHERE name = 'Management' AND company_id = v_company_id;
    SELECT id INTO v_dept_supp FROM departments WHERE name = 'Customer Support' AND company_id = v_company_id;

    -- 3. Upsert Designations (BIGINT) - Safe Insert
    IF NOT EXISTS (SELECT 1 FROM org_designations WHERE name = 'Manager' AND company_id = v_company_id) THEN
        INSERT INTO org_designations (company_id, name, code) VALUES (v_company_id, 'Manager', 'MGR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM org_designations WHERE name = 'CEO' AND company_id = v_company_id) THEN
        INSERT INTO org_designations (company_id, name, code) VALUES (v_company_id, 'CEO', 'CEO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM org_designations WHERE name = 'Intern' AND company_id = v_company_id) THEN
        INSERT INTO org_designations (company_id, name, code) VALUES (v_company_id, 'Intern', 'INT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM org_designations WHERE name = 'Software Engineer' AND company_id = v_company_id) THEN
        INSERT INTO org_designations (company_id, name, code) VALUES (v_company_id, 'Software Engineer', 'SWE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM org_designations WHERE name = 'Executive' AND company_id = v_company_id) THEN
        INSERT INTO org_designations (company_id, name, code) VALUES (v_company_id, 'Executive', 'EXEC');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM org_designations WHERE name = 'Support Specialist' AND company_id = v_company_id) THEN
        INSERT INTO org_designations (company_id, name, code) VALUES (v_company_id, 'Support Specialist', 'SUP');
    END IF;

    SELECT id INTO v_desig_mgr FROM org_designations WHERE name = 'Manager' AND company_id = v_company_id;
    SELECT id INTO v_desig_ceo FROM org_designations WHERE name = 'CEO' AND company_id = v_company_id;
    SELECT id INTO v_desig_intern FROM org_designations WHERE name = 'Intern' AND company_id = v_company_id;
    SELECT id INTO v_desig_eng FROM org_designations WHERE name = 'Software Engineer' AND company_id = v_company_id;
    SELECT id INTO v_desig_exec FROM org_designations WHERE name = 'Executive' AND company_id = v_company_id;
    SELECT id INTO v_desig_supp FROM org_designations WHERE name = 'Support Specialist' AND company_id = v_company_id;

    -- 4. Upsert Roles (UUID) - Safe Insert
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Admin' AND company_id = v_company_id) THEN
        INSERT INTO roles (company_id, name) VALUES (v_company_id, 'Admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Manager' AND company_id = v_company_id) THEN
        INSERT INTO roles (company_id, name) VALUES (v_company_id, 'Manager');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Employee' AND company_id = v_company_id) THEN
        INSERT INTO roles (company_id, name) VALUES (v_company_id, 'Employee');
    END IF;

    SELECT id INTO v_role_admin FROM roles WHERE name = 'Admin' AND company_id = v_company_id;
    SELECT id INTO v_role_mgr FROM roles WHERE name = 'Manager' AND company_id = v_company_id;
    SELECT id INTO v_role_emp FROM roles WHERE name = 'Employee' AND company_id = v_company_id;


    -- 5. Upsert Employees
    -- Phil Dumphy (Manager)
    SELECT id INTO v_emp_phil FROM employees WHERE email = 'phil@example.com';
    IF v_emp_phil IS NULL THEN
        INSERT INTO employees (company_id, name, email, department_id, designation_id, status, salary_amount, join_date, gender, role, role_id)
        VALUES (v_company_id, 'Phil Dumphy', 'phil@example.com', v_dept_sales, v_desig_mgr, 'Active', 85000, '2024-01-15', 'Male', 'Manager', v_role_mgr)
        RETURNING id INTO v_emp_phil;
    END IF;

    -- Clair Mathew (CEO/Admin)
    SELECT id INTO v_emp_clair FROM employees WHERE email = 'clair@example.com';
    IF v_emp_clair IS NULL THEN
        INSERT INTO employees (company_id, name, email, department_id, designation_id, status, salary_amount, join_date, gender, role, role_id)
        VALUES (v_company_id, 'Clair Mathew', 'clair@example.com', v_dept_mgmt, v_desig_ceo, 'Active', 150000, '2023-06-01', 'Female', 'Admin', v_role_admin)
        RETURNING id INTO v_emp_clair;
    END IF;

    -- Ariel Winter (Intern/Employee)
    SELECT id INTO v_emp_ariel FROM employees WHERE email = 'ariel@example.com';
    IF v_emp_ariel IS NULL THEN
        INSERT INTO employees (company_id, name, email, department_id, designation_id, status, salary_amount, join_date, gender, role, role_id)
        VALUES (v_company_id, 'Ariel Winter', 'ariel@example.com', v_dept_eng, v_desig_intern, 'Active', 25000, '2026-01-05', 'Female', 'Employee', v_role_emp)
        RETURNING id INTO v_emp_ariel;
    END IF;

    -- John Doe (Engineer/Employee)
    SELECT id INTO v_emp_john FROM employees WHERE email = 'john.doe@example.com';
    IF v_emp_john IS NULL THEN
        INSERT INTO employees (company_id, name, email, department_id, designation_id, status, salary_amount, join_date, gender, role, role_id)
        VALUES (v_company_id, 'John Doe', 'john.doe@example.com', v_dept_eng, v_desig_eng, 'Active', 75000, '2025-03-10', 'Male', 'Employee', v_role_emp)
        RETURNING id INTO v_emp_john;
    END IF;

    -- Samuel Jackson (HR/Manager)
    SELECT id INTO v_emp_sam FROM employees WHERE email = 'sam@example.com';
    IF v_emp_sam IS NULL THEN
        INSERT INTO employees (company_id, name, email, department_id, designation_id, status, salary_amount, join_date, gender, role, role_id)
        VALUES (v_company_id, 'Samuel Jackson', 'sam@example.com', v_dept_hr, v_desig_mgr, 'Active', 90000, '2024-11-01', 'Male', 'Manager', v_role_mgr)
        RETURNING id INTO v_emp_sam;
    END IF;

    -- Freddy Nicholas (Marketing/Employee)
    SELECT id INTO v_emp_fred FROM employees WHERE email = 'freddy@example.com';
    IF v_emp_fred IS NULL THEN
        INSERT INTO employees (company_id, name, email, department_id, designation_id, status, salary_amount, join_date, gender, role, role_id)
        VALUES (v_company_id, 'Freddy Nicholas', 'freddy@example.com', v_dept_mkt, v_desig_exec, 'Active', 55000, '2025-07-20', 'Male', 'Employee', v_role_emp)
        RETURNING id INTO v_emp_fred;
    END IF;

    -- Sera Abharam (Support/Employee)
    SELECT id INTO v_emp_sera FROM employees WHERE email = 'sera@example.com';
    IF v_emp_sera IS NULL THEN
        INSERT INTO employees (company_id, name, email, department_id, designation_id, status, salary_amount, join_date, gender, role, role_id)
        VALUES (v_company_id, 'Sera Abharam', 'sera@example.com', v_dept_supp, v_desig_supp, 'Active', 45000, '2025-09-15', 'Female', 'Employee', v_role_emp)
        RETURNING id INTO v_emp_sera;
    END IF;


    -- 6. Upsert Salary Components (BIGINT) - Safe Insert
    IF NOT EXISTS (SELECT 1 FROM org_salary_components WHERE code = 'BASIC' AND company_id = v_company_id) THEN
        INSERT INTO org_salary_components (company_id, name, code, component_type, is_taxable) VALUES (v_company_id, 'Basic Salary', 'BASIC', 'EARNING', true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM org_salary_components WHERE code = 'HRA' AND company_id = v_company_id) THEN
        INSERT INTO org_salary_components (company_id, name, code, component_type, is_taxable) VALUES (v_company_id, 'House Rent Allowance', 'HRA', 'EARNING', true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM org_salary_components WHERE code = 'SPL' AND company_id = v_company_id) THEN
        INSERT INTO org_salary_components (company_id, name, code, component_type, is_taxable) VALUES (v_company_id, 'Special Allowance', 'SPL', 'EARNING', true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM org_salary_components WHERE code = 'PF' AND company_id = v_company_id) THEN
        INSERT INTO org_salary_components (company_id, name, code, component_type, is_taxable) VALUES (v_company_id, 'Provident Fund', 'PF', 'DEDUCTION', true); -- Usually tax exempt but let's set true for valid bool
    END IF;
    IF NOT EXISTS (SELECT 1 FROM org_salary_components WHERE code = 'PT' AND company_id = v_company_id) THEN
        INSERT INTO org_salary_components (company_id, name, code, component_type, is_taxable) VALUES (v_company_id, 'Professional Tax', 'PT', 'DEDUCTION', true);
    END IF;

    SELECT id INTO v_comp_basic FROM org_salary_components WHERE code = 'BASIC' AND company_id = v_company_id;
    SELECT id INTO v_comp_hra FROM org_salary_components WHERE code = 'HRA' AND company_id = v_company_id;
    SELECT id INTO v_comp_sa FROM org_salary_components WHERE code = 'SPL' AND company_id = v_company_id;
    SELECT id INTO v_comp_pf FROM org_salary_components WHERE code = 'PF' AND company_id = v_company_id;
    SELECT id INTO v_comp_pt FROM org_salary_components WHERE code = 'PT' AND company_id = v_company_id;

    -- 6b. Upsert Leave Types (New Table)
    IF NOT EXISTS (SELECT 1 FROM org_leave_types WHERE name = 'Sick Leave' AND company_id = v_company_id) THEN
        INSERT INTO org_leave_types (company_id, name, code, default_balance, is_paid) VALUES (v_company_id, 'Sick Leave', 'SL', 12, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM org_leave_types WHERE name = 'Casual Leave' AND company_id = v_company_id) THEN
        INSERT INTO org_leave_types (company_id, name, code, default_balance, is_paid) VALUES (v_company_id, 'Casual Leave', 'CL', 12, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM org_leave_types WHERE name = 'Privilege Leave' AND company_id = v_company_id) THEN
        INSERT INTO org_leave_types (company_id, name, code, default_balance, is_paid) VALUES (v_company_id, 'Privilege Leave', 'PL', 18, true);
    END IF;

    -- 6c. Upsert HR Masters (Blood Group, Marital, Faith, Shift)
    -- Note: Tables might have 'code' as NOT NULL based on user error. Providing codes.
    INSERT INTO org_blood_groups (name, code, company_id) VALUES ('O+', 'O_POS', v_company_id), ('A+', 'A_POS', v_company_id) ON CONFLICT DO NOTHING;
    INSERT INTO org_marital_statuses (name, code, company_id) VALUES ('Single', 'SINGLE', v_company_id), ('Married', 'MARRIED', v_company_id) ON CONFLICT DO NOTHING;
    INSERT INTO org_faiths (name, code, company_id) VALUES ('Christianity', 'CHRISTIANITY', v_company_id), ('Hinduism', 'HINDUISM', v_company_id) ON CONFLICT DO NOTHING;
    
    INSERT INTO org_shift_timings (company_id, name, code, start_time, end_time) 
    VALUES (v_company_id, 'General Shift', 'GS', '09:00:00', '18:00:00') 
    ON CONFLICT DO NOTHING;

    -- Helper to insert component for employee
    FOR v_emp_rec IN SELECT id, salary_amount FROM employees WHERE id IN (v_emp_phil, v_emp_clair, v_emp_ariel, v_emp_john, v_emp_sam, v_emp_fred, v_emp_sera, (SELECT id FROM employees WHERE email = 'jerin@kaa.com')) LOOP

        -- Clean up existing (simple way for seed script)
        DELETE FROM employee_salary_components WHERE employee_id = v_emp_rec.id;

        -- Basic (50%)
        INSERT INTO employee_salary_components (company_id, employee_id, salary_component_id, amount, effective_from) 
        VALUES (v_company_id, v_emp_rec.id, v_comp_basic, v_emp_rec.salary_amount * 0.5, '2024-01-01');
        
        -- HRA (20%)
        INSERT INTO employee_salary_components (company_id, employee_id, salary_component_id, amount, effective_from) 
        VALUES (v_company_id, v_emp_rec.id, v_comp_hra, v_emp_rec.salary_amount * 0.2, '2024-01-01');
        
        -- Special (30%)
        INSERT INTO employee_salary_components (company_id, employee_id, salary_component_id, amount, effective_from) 
        VALUES (v_company_id, v_emp_rec.id, v_comp_sa, v_emp_rec.salary_amount * 0.3, '2024-01-01');
        
        -- Deductions (Fixed approx)
        INSERT INTO employee_salary_components (company_id, employee_id, salary_component_id, amount, effective_from) 
        VALUES (v_company_id, v_emp_rec.id, v_comp_pf, 1800, '2024-01-01');
        
        INSERT INTO employee_salary_components (company_id, employee_id, salary_component_id, amount, effective_from) 
        VALUES (v_company_id, v_emp_rec.id, v_comp_pt, 200, '2024-01-01');
    END LOOP;


    -- 7. Generate Attendance (Jan 1 to Feb 8, 2026)
    v_start_date := '2026-01-01';
    v_end_date := '2026-02-08'; -- Explicitly requested date

    -- Clean up first
    DELETE FROM attendance WHERE employee_id IN (v_emp_phil, v_emp_clair, v_emp_ariel, v_emp_john, v_emp_sam, v_emp_fred, v_emp_sera, (SELECT id FROM employees WHERE email = 'jerin@kaa.com')) AND date BETWEEN v_start_date AND v_end_date;

    v_date := v_start_date;
    
    WHILE v_date <= v_end_date LOOP
        -- Skip Sundays (0)
        IF EXTRACT(DOW FROM v_date) != 0 THEN
            
            -- Loop through our employees including Jerin
            FOR v_emp_rec IN SELECT id FROM employees WHERE id IN (v_emp_phil, v_emp_clair, v_emp_ariel, v_emp_john, v_emp_sam, v_emp_fred, v_emp_sera, (SELECT id FROM employees WHERE email = 'jerin@kaa.com')) LOOP
                
                -- Randomize Check-in between 08:30 and 09:30
                -- Randomize Check-out between 17:30 and 18:30
                
                INSERT INTO attendance (
                    company_id, 
                    employee_id, 
                    date, 
                    check_in, 
                    check_out, 
                    status, 
                    duration,
                    attendance_status_id
                ) VALUES (
                    v_company_id,
                    v_emp_rec.id,
                    v_date,
                    (v_date || ' ' || (8 + floor(random() * 2))::text || ':' || (10 + floor(random() * 40))::text || ':00')::timestamptz, -- ~08:30 - ~09:50
                    (v_date || ' ' || (17 + floor(random() * 2))::text || ':' || (10 + floor(random() * 40))::text || ':00')::timestamptz, -- ~17:30 - ~18:50
                    'Present',
                    9, -- Approx duration
                    (SELECT id FROM org_attendance_status WHERE name = 'Present' AND company_id = v_company_id LIMIT 1)
                );
                
            END LOOP;
        ELSE
             -- Log Weekend Status for Completeness (Optional but good for "all data")
             FOR v_emp_rec IN SELECT id FROM employees WHERE id IN (v_emp_phil, v_emp_clair, v_emp_ariel, v_emp_john, v_emp_sam, v_emp_fred, v_emp_sera, (SELECT id FROM employees WHERE email = 'jerin@kaa.com')) LOOP
                INSERT INTO attendance (company_id, employee_id, date, status, attendance_status_id)
                VALUES (v_company_id, v_emp_rec.id, v_date, 'Weekend', (SELECT id FROM org_attendance_status WHERE name = 'Weekend' LIMIT 1));
             END LOOP;
        END IF;
        
        v_date := v_date + 1;
    END LOOP;

    -- 8. Additional Data for Jerin (Full Profile Update)
    SELECT id INTO v_emp_rec FROM employees WHERE email = 'jerin@kaa.com' LIMIT 1;
    
    IF v_emp_rec.id IS NOT NULL THEN
        -- A. Update Full Profile (Bank, Address, Personal)
        -- Attempting to update columns if they exist (Postgres ignores extra columns in UPDATE usually? No, it errors.
        -- Assuming columns exist based on types.ts. If not, user will report error and we fix migration.)
        BEGIN
            UPDATE employees SET
                mobile = '9876543210', -- office_mobile in types mapped? Check types.ts again. types.ts has mobile and office_mobile.
                office_mobile = '9876543210',
                personal_mobile = '9876543211',
                email = 'jerin@kaa.com',
                personal_email = 'jerin.personal@example.com',
                current_address = '123, Tech Park, Bangalore, India',
                permanent_address = '456, Hometown, Kerala, India',
                bank_name = 'HDFC Bank',
                account_number = '123456789012',
                ifsc_code = 'HDFC0001234',
                date_of_birth = '1990-05-15',
                gender = 'Male',
                blood_group_id = (SELECT id FROM org_blood_groups WHERE name = 'O+' LIMIT 1),
                marital_status_id = (SELECT id FROM org_marital_statuses WHERE name = 'Married' LIMIT 1),
                faith_id = (SELECT id FROM org_faiths WHERE name = 'Christianity' LIMIT 1),
                shift_timing_id = (SELECT id FROM org_shift_timings WHERE name = 'General Shift' LIMIT 1)
            WHERE id = v_emp_rec.id;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping detailed employee update: %', SQLERRM;
        END;

        -- B. Leave Applications (Approved)
        -- Clean up first
        DELETE FROM leave_applications WHERE employee_id = v_emp_rec.id;
        
        INSERT INTO leave_applications (company_id, employee_id, leave_type_id, start_date, end_date, reason, status, applied_on)
        VALUES 
        (v_company_id, v_emp_rec.id, (SELECT id FROM org_leave_types WHERE name = 'Sick Leave' LIMIT 1), '2026-01-10', '2026-01-10', 'Not feeling well', 'Approved', '2026-01-09'),
        (v_company_id, v_emp_rec.id, (SELECT id FROM org_leave_types WHERE name = 'Casual Leave' LIMIT 1), '2026-02-05', '2026-02-06', 'Personal work', 'Approved', '2026-02-01');

        -- C. Career Timeline
        DELETE FROM employee_career_timeline WHERE employee_id = v_emp_rec.id;
        
        INSERT INTO employee_career_timeline (company_id, employee_id, event_date, event_type, title, description)
        VALUES 
        (v_company_id, v_emp_rec.id, '2023-01-01', 'JOINED', 'Joined as CEO', 'Started journey at KAA ERP'),
        (v_company_id, v_emp_rec.id, '2024-01-01', 'PROMOTION', 'Promoted to Admin', 'Took over administrative responsibilities');

        -- D. Payroll Records (Last Month)
        DELETE FROM payroll_records WHERE employee_id = v_emp_rec.id;
        
        INSERT INTO payroll_records (company_id, employee_id, month_year, basic_salary, net_pay, status, created_at)
        VALUES 
        (v_company_id, v_emp_rec.id, '2026-01', 100000, 185000, 'PAID', '2026-01-31 10:00:00');
        
        -- E. Assets
        DELETE FROM assets WHERE assigned_to = v_emp_rec.id;
        INSERT INTO assets (company_id, name, type, serial_number, status, assigned_to, purchase_date)
        VALUES 
        (v_company_id, 'MacBook Pro M3', 'Laptop', 'MBP-2024-001', 'In Use', v_emp_rec.id, '2024-01-15'),
        (v_company_id, 'Dell 27 Monitor', 'Monitor', 'DELL-27-099', 'In Use', v_emp_rec.id, '2024-01-15');

    END IF;

    RAISE NOTICE 'Sample data generation completed successfully!';
END;
$$;
