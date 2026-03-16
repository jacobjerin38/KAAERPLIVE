-- GLOBAL PROFILE FIX SCRIPT
-- Run this in the Supabase SQL Editor to automatically link ALL users to their employee records based on email matching.

DO $$ 
DECLARE
    rec RECORD;
    v_updated_count INT := 0;
BEGIN
    RAISE NOTICE '--- STARTING GLOBAL PROFILE FIX ---';

    FOR rec IN (
        SELECT 
            au.id AS auth_id, 
            au.email, 
            e.id AS emp_id, 
            e.company_id,
            p.employee_id AS current_emp_id
        FROM auth.users au
        JOIN public.employees e ON lower(e.email) = lower(au.email)
        JOIN public.profiles p ON p.id = au.id
        WHERE p.employee_id IS NULL OR p.employee_id != e.id
    ) LOOP
        -- Update the profile to link to the corresponding employee record
        UPDATE public.profiles 
        SET employee_id = rec.emp_id, 
            company_id = rec.company_id 
        WHERE id = rec.auth_id;
        
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE 'Linked email: % | Auth ID: % -> Employee ID: %', rec.email, rec.auth_id, rec.emp_id;
    END LOOP;
    
    RAISE NOTICE '--- SCRIPT COMPLETE ---';
    RAISE NOTICE 'Total profiles newly linked: %', v_updated_count;
END $$;
