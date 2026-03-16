-- ==============================================================================
-- FIX: Employee Document Upload RLS (Table & Storage)
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. Fix Table RLS for `employee_documents`
-- Use the new header-aware `get_current_company_id()` function
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_documents') THEN
        ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
        
        -- Drop old policies
        DROP POLICY IF EXISTS "Tenant Isolation" ON employee_documents;
        DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_documents;
        
        -- Create new strict policy
        CREATE POLICY "Tenant Isolation" ON employee_documents 
        USING (company_id = get_current_company_id())
        WITH CHECK (company_id = get_current_company_id());
        
        RAISE NOTICE 'Updated RLS for employee_documents table.';
    END IF;
END $$;


-- 2. Fix Storage RLS for `employee-documents` bucket

-- A. Ensure bucket exists and is private
INSERT INTO storage.buckets (id, name, public) 
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- B. Enable RLS on objects (Usually already enabled, skipping to avoid ownership error)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- C. Create Policies for this specific bucket
-- We use unique names to avoid conflicts with other bucket policies

-- Policy: READ (Select)
-- Allow users to read files if the folder structure starts with their company_id
DROP POLICY IF EXISTS "Company Read Document Objects" ON storage.objects;
CREATE POLICY "Company Read Document Objects" ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'employee-documents' 
    AND (storage.foldername(name))[1] = get_current_company_id()::text
);

-- Policy: INSERT (Upload)
-- Allow users to upload files if they place them in their company folder
DROP POLICY IF EXISTS "Company Upload Document Objects" ON storage.objects;
CREATE POLICY "Company Upload Document Objects" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'employee-documents' 
    AND (storage.foldername(name))[1] = get_current_company_id()::text
);

-- Policy: UPDATE/DELETE (Manage)
-- Allow users to modify files in their company folder
DROP POLICY IF EXISTS "Company Manage Document Objects" ON storage.objects;
CREATE POLICY "Company Manage Document Objects" ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'employee-documents' 
    AND (storage.foldername(name))[1] = get_current_company_id()::text
)
WITH CHECK (
    bucket_id = 'employee-documents' 
    AND (storage.foldername(name))[1] = get_current_company_id()::text
);

DROP POLICY IF EXISTS "Company Delete Document Objects" ON storage.objects;
CREATE POLICY "Company Delete Document Objects" ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'employee-documents' 
    AND (storage.foldername(name))[1] = get_current_company_id()::text
);

DO $$
BEGIN
    RAISE NOTICE 'Storage RLS for employee-documents bucket updated.';
END $$;
