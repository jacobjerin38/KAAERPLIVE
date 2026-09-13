-- Migration: Enhance crm_documents to support generic text/UUID related_id and file metadata
ALTER TABLE crm_documents ALTER COLUMN related_id TYPE TEXT USING related_id::text;
ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
