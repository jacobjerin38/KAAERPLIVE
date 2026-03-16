-- Add is_active column to announcements if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'is_active') THEN
        ALTER TABLE announcements ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;
