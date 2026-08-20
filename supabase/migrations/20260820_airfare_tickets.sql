-- ==============================================================================
-- Migration: 20260820_airfare_tickets.sql
-- Description: Airfare Ticket Management table with employee linkage, 
--              departure/arrival routes, trip types (One Way / Two Way),
--              costs in QAR, airline references, and RLS policies.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.hrms_airfare_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    departure TEXT NOT NULL,
    arrival TEXT NOT NULL,
    trip_type TEXT NOT NULL DEFAULT 'ONE_WAY', -- 'ONE_WAY' or 'ROUND_TRIP' / 'TWO_WAY'
    departure_date DATE NOT NULL,
    return_date DATE,
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    airline TEXT,
    ticket_number TEXT,
    ticket_doc_url TEXT,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'BOOKED' -- 'BOOKED', 'CONFIRMED', 'PENDING', 'CANCELLED'
);

CREATE INDEX IF NOT EXISTS idx_hrms_airfare_tickets_company ON public.hrms_airfare_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_hrms_airfare_tickets_employee ON public.hrms_airfare_tickets(employee_id);

ALTER TABLE public.hrms_airfare_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their company airfare tickets" ON public.hrms_airfare_tickets;
CREATE POLICY "Users can view their company airfare tickets" 
ON public.hrms_airfare_tickets FOR SELECT 
USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can insert their company airfare tickets" ON public.hrms_airfare_tickets;
CREATE POLICY "Users can insert their company airfare tickets" 
ON public.hrms_airfare_tickets FOR INSERT 
WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can update their company airfare tickets" ON public.hrms_airfare_tickets;
CREATE POLICY "Users can update their company airfare tickets" 
ON public.hrms_airfare_tickets FOR UPDATE 
USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can delete their company airfare tickets" ON public.hrms_airfare_tickets;
CREATE POLICY "Users can delete their company airfare tickets" 
ON public.hrms_airfare_tickets FOR DELETE 
USING (company_id = get_my_company_id());
