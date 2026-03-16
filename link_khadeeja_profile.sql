-- Diagnostic Script: Run this in Supabase SQL Editor to see what exists

DO $$ 
DECLARE
    v_emp_id UUID;
    v_profile_id UUID;
    v_email TEXT := 'khadeejasana457@gmail.com';
    v_count_emp INT;
    v_count_prof INT;
BEGIN
    SELECT COUNT(*) INTO v_count_emp FROM employees WHERE email ILIKE v_email;
    SELECT COUNT(*) INTO v_count_prof FROM profiles WHERE email ILIKE v_email;
    
    RAISE NOTICE 'Found % employee records for %', v_count_emp, v_email;
    RAISE NOTICE 'Found % profile records for %', v_count_prof, v_email;
    
    IF v_count_emp = 0 THEN
       RAISE NOTICE 'ERROR: Employee record completely missing!';
    END IF;
    
    IF v_count_prof = 0 THEN
       RAISE NOTICE 'ERROR: Profile record completely missing in public.profiles! This means the Auth hook failed.';
    END IF;
    
    IF v_count_emp > 0 OR v_count_prof > 0 THEN
       SELECT id INTO v_emp_id FROM employees WHERE email ILIKE v_email LIMIT 1;
       SELECT id INTO v_profile_id FROM profiles WHERE email ILIKE v_email LIMIT 1;
       RAISE NOTICE 'Employee ID: % | Profile ID: %', v_emp_id, v_profile_id;
    END IF;
END $$;
