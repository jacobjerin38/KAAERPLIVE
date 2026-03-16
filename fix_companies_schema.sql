-- Fix for missing columns in companies table
-- This script ensures all required columns exist, even if the table was created previously.

DO $$
BEGIN
    -- Timestamps (Critical for triggers)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='created_at') THEN
        ALTER TABLE companies ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='updated_at') THEN
        ALTER TABLE companies ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;

    -- Identity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='code') THEN
        ALTER TABLE companies ADD COLUMN code TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='display_name') THEN
        ALTER TABLE companies ADD COLUMN display_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='legal_name') THEN
        ALTER TABLE companies ADD COLUMN legal_name TEXT;
    END IF;

    -- Contact
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='email') THEN
        ALTER TABLE companies ADD COLUMN email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='phone') THEN
        ALTER TABLE companies ADD COLUMN phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='website') THEN
        ALTER TABLE companies ADD COLUMN website TEXT;
    END IF;

    -- Address
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='address_line_1') THEN
        ALTER TABLE companies ADD COLUMN address_line_1 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='address_line_2') THEN
        ALTER TABLE companies ADD COLUMN address_line_2 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='city') THEN
        ALTER TABLE companies ADD COLUMN city TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='state') THEN
        ALTER TABLE companies ADD COLUMN state TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='country') THEN
        ALTER TABLE companies ADD COLUMN country TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='zip_code') THEN
        ALTER TABLE companies ADD COLUMN zip_code TEXT;
    END IF;

    -- Financial
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='tax_id') THEN
        ALTER TABLE companies ADD COLUMN tax_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='currency') THEN
        ALTER TABLE companies ADD COLUMN currency TEXT DEFAULT 'USD';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='timezone') THEN
        ALTER TABLE companies ADD COLUMN timezone TEXT;
    END IF;

    -- Branding
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='logo_url') THEN
        ALTER TABLE companies ADD COLUMN logo_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='theme_color') THEN
        ALTER TABLE companies ADD COLUMN theme_color TEXT;
    END IF;

END $$;
