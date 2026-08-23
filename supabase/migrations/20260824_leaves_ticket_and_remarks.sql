-- Migration: Add Ticket Upload and Remarks fields to leaves table
ALTER TABLE public.leaves 
ADD COLUMN IF NOT EXISTS ticket_url TEXT,
ADD COLUMN IF NOT EXISTS ticket_name TEXT,
ADD COLUMN IF NOT EXISTS ticket_number TEXT,
ADD COLUMN IF NOT EXISTS airline TEXT,
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

