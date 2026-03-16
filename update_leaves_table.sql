-- Add leave_type_id to leaves table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leaves' AND column_name='leave_type_id') THEN
        ALTER TABLE leaves ADD COLUMN leave_type_id BIGINT REFERENCES org_leave_types(id);
    END IF;
END $$;
