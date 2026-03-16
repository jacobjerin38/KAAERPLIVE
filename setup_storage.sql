-- Phase 16: Setup Supabase Storage
-- This script creates a 'company-assets' bucket and configures RLS policies for secure access.

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on objects (It is enabled by default, but good practice to allow policies to control access)

-- 3. Policy: Allow Public Read Access (Since logos are public)
-- Everyone can view company assets (logos needed for login screens, etc.)
DROP POLICY IF EXISTS "Public Access to Company Assets" ON storage.objects;
CREATE POLICY "Public Access to Company Assets"
ON storage.objects FOR SELECT
USING ( bucket_id = 'company-assets' );

-- 4. Policy: Allow Authenticated Users to Upload
-- Employees can upload files to their company folder: company-assets/{company_id}/*
DROP POLICY IF EXISTS "Employees can upload company assets" ON storage.objects;
CREATE POLICY "Employees can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'company-assets' AND
    (storage.foldername(name))[1] = (SELECT company_id::text FROM profiles WHERE id = auth.uid())
);

-- 5. Policy: Allow Employees to Update/Delete their company assets
DROP POLICY IF EXISTS "Employees can update company assets" ON storage.objects;
CREATE POLICY "Employees can update company assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'company-assets' AND
    (storage.foldername(name))[1] = (SELECT company_id::text FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Employees can delete company assets" ON storage.objects;
CREATE POLICY "Employees can delete company assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'company-assets' AND
    (storage.foldername(name))[1] = (SELECT company_id::text FROM profiles WHERE id = auth.uid())
);

-- Note: We use public bucket for simplicity of serving logos without signed URLs for every request.
-- This is acceptable for logos and branding assets. Confidential docs should go in a private bucket.
