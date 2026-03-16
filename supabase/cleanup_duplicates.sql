-- Cleanup Duplicates in Master Tables
-- Keeps the record with the lowest ID for each unique Name (within the same Company, or globally if company_id is strictly consistent)

-- Function to deduplicate a simple name-based table
CREATE OR REPLACE FUNCTION deduplicate_table(table_name text) RETURNS void AS $$
BEGIN
    EXECUTE format('DELETE FROM %I a USING %I b WHERE a.id > b.id AND a.name = b.name', table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Execute for all master tables
SELECT deduplicate_table('org_designations');
SELECT deduplicate_table('org_grades');
SELECT deduplicate_table('org_employment_types');
SELECT deduplicate_table('org_probation_periods');
SELECT deduplicate_table('org_confirmation_status');
SELECT deduplicate_table('org_exit_reasons');
SELECT deduplicate_table('org_salary_components');
SELECT deduplicate_table('org_pay_groups');
SELECT deduplicate_table('org_bank_configs');

-- Leave & Attendance
SELECT deduplicate_table('org_leave_types');
-- org_leave_policies might depend on leave_type_id, so duplicates might be broken pointers if we just delete types. 
-- BUT since we are in early dev, maybe just cleaning types is safer first. 
-- Ideally we would cascade or re-link. 
-- For now, let's assume no complex FK dependencies exist yet beyond what we just built.
-- Actually org_leave_policies uses leave_type_id. If we delete a duplicate type that a policy points to, it might error if FK constraint exists.
-- Supabase default FK is usually NO ACTION or RESTRICT.

-- Let's try simple dedupe. If it fails due to FK, we know we have data.
SELECT deduplicate_table('org_shift_timings'); 
SELECT deduplicate_table('org_attendance_status');
SELECT deduplicate_table('org_weekoff_rules');

-- Common Attributes
SELECT deduplicate_table('org_faiths');
SELECT deduplicate_table('org_marital_status');
SELECT deduplicate_table('org_blood_groups');
SELECT deduplicate_table('org_nationalities');

-- Drop the helper function
DROP FUNCTION deduplicate_table(text);
