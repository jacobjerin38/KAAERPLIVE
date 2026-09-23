-- ==============================================================================
-- KAA ERP REMEDIATION - PRIORITY 1: STORAGE BUCKET POLICIES & PATH COMPATIBILITY
-- Migration: 20260923190000_remediation_p1_storage_policies_and_crm_paths.sql
-- Description:
--   1. Implements tenant-scoped storage policies for sensitive buckets (documents, attachments, company-assets).
--   2. Resolves path convention mismatch by supporting both root UUID (${companyId}/...) and
--      module-prefixed paths (crm/${companyId}/..., projects/${companyId}/...) compatibly.
--   3. Restricts storage mutations (insert, update, delete) to authenticated tenant members.
--   4. Preserves careers portal application upload flow under safe prefix rules.
-- Rollback: Revert storage.objects policies to previous permissive definitions.
-- ==============================================================================

-- 1. Helper function to validate storage path tenant ownership without modifying existing files
CREATE OR REPLACE FUNCTION public.fn_storage_company_matches(p_name TEXT, p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cid_text TEXT := p_company_id::TEXT;
    v_parts TEXT[];
BEGIN
    IF p_company_id IS NULL OR p_name IS NULL THEN
        RETURN false;
    END IF;

    v_parts := string_to_array(p_name, '/');
    
    -- Case 1: First segment is company UUID (e.g. "<company_id>/leaves/file.pdf")
    IF array_length(v_parts, 1) >= 1 AND v_parts[1] = v_cid_text THEN
        RETURN true;
    END IF;

    -- Case 2: Second segment is company UUID (e.g. "crm/<company_id>/...", "projects/<company_id>/...")
    IF array_length(v_parts, 1) >= 2 AND v_parts[1] IN ('crm', 'projects', 'company', 'assets', 'proposals', 'activities') AND v_parts[2] = v_cid_text THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- 2. Drop existing overly broad or conflicting storage policies
DROP POLICY IF EXISTS "Public Access to Company Assets" ON storage.objects;
DROP POLICY IF EXISTS "Employees can upload company assets" ON storage.objects;
DROP POLICY IF EXISTS "Employees can update company assets" ON storage.objects;
DROP POLICY IF EXISTS "Employees can delete company assets" ON storage.objects;

DROP POLICY IF EXISTS "Company Read Document Objects" ON storage.objects;
DROP POLICY IF EXISTS "Company Upload Document Objects" ON storage.objects;
DROP POLICY IF EXISTS "Company Manage Document Objects" ON storage.objects;
DROP POLICY IF EXISTS "Company Delete Document Objects" ON storage.objects;

DROP POLICY IF EXISTS "Attachments Tenant Isolation Select" ON storage.objects;
DROP POLICY IF EXISTS "Attachments Tenant Isolation Insert" ON storage.objects;
DROP POLICY IF EXISTS "Attachments Tenant Isolation Delete" ON storage.objects;

DROP POLICY IF EXISTS "storage_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "storage_tenant_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_tenant_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_tenant_delete" ON storage.objects;

-- 3. Tenant-Isolated Read Policy (documents, attachments, company-assets)
CREATE POLICY "storage_tenant_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id IN ('documents', 'attachments', 'company-assets', 'employee-documents')
        AND public.fn_storage_company_matches(name, get_my_company_id())
    );

-- 4. Tenant-Isolated Insert Policy
CREATE POLICY "storage_tenant_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id IN ('documents', 'attachments', 'company-assets', 'employee-documents')
        AND public.fn_storage_company_matches(name, get_my_company_id())
    );

-- 5. Tenant-Isolated Update Policy
CREATE POLICY "storage_tenant_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id IN ('documents', 'attachments', 'company-assets', 'employee-documents')
        AND public.fn_storage_company_matches(name, get_my_company_id())
    )
    WITH CHECK (
        bucket_id IN ('documents', 'attachments', 'company-assets', 'employee-documents')
        AND public.fn_storage_company_matches(name, get_my_company_id())
    );

-- 6. Tenant-Isolated Delete Policy
CREATE POLICY "storage_tenant_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id IN ('documents', 'attachments', 'company-assets', 'employee-documents')
        AND public.fn_storage_company_matches(name, get_my_company_id())
    );

-- 7. Public Careers Portal Applicant Resume Upload Policy (preserves candidate application flow)
DROP POLICY IF EXISTS "careers_portal_resume_upload" ON storage.objects;
CREATE POLICY "careers_portal_resume_upload" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        bucket_id = 'documents' 
        AND (name LIKE 'recruitment/%' OR name LIKE 'careers/%')
    );
