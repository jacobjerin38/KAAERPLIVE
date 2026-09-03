-- Migration: Add missing is_pinned and author_id columns to announcements table
-- Fixes: "Could not find the 'is_pinned' column of 'announcements' in the schema cache"

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'announcements' 
          AND column_name = 'is_pinned'
    ) THEN
        ALTER TABLE public.announcements ADD COLUMN is_pinned BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'announcements' 
          AND column_name = 'author_id'
    ) THEN
        ALTER TABLE public.announcements ADD COLUMN author_id UUID;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
