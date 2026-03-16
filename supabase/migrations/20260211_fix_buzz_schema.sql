-- Fix Announcements Schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'is_active') THEN
        ALTER TABLE announcements ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Fix Polls Schema
DO $$
BEGIN
    -- Add created_by column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'polls' AND column_name = 'created_by') THEN
        ALTER TABLE polls ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;

    -- Add is_active column if missing (Frontend uses it)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'polls' AND column_name = 'is_active') THEN
        ALTER TABLE polls ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;
