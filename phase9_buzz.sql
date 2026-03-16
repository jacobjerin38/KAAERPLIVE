-- Add is_pinned to announcements if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'is_pinned') THEN
        ALTER TABLE announcements ADD COLUMN is_pinned BOOLEAN DEFAULT false;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- POLLS MODULE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    question TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    vote_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT uk_poll_vote_employee UNIQUE (poll_id, employee_id)
);

-- RLS POLICIES
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls: Isolation
DROP POLICY IF EXISTS "Tenant Isolation Polls" ON public.polls;
CREATE POLICY "Tenant Isolation Polls" ON public.polls
    FOR ALL USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Tenant Isolation Poll Options" ON public.poll_options;
CREATE POLICY "Tenant Isolation Poll Options" ON public.poll_options
    FOR ALL USING (poll_id IN (SELECT id FROM public.polls WHERE company_id = get_my_company_id()));

DROP POLICY IF EXISTS "Tenant Isolation Poll Votes" ON public.poll_votes;
CREATE POLICY "Tenant Isolation Poll Votes" ON public.poll_votes
    FOR ALL USING (poll_id IN (SELECT id FROM public.polls WHERE company_id = get_my_company_id()));

-- RPC: Vote on Poll
CREATE OR REPLACE FUNCTION public.rpc_vote_poll(
    p_poll_id UUID,
    p_option_id UUID,
    p_employee_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check if already voted
    SELECT count(*) INTO v_count FROM public.poll_votes 
    WHERE poll_id = p_poll_id AND employee_id = p_employee_id;
    
    IF v_count > 0 THEN
        RAISE EXCEPTION 'You have already voted on this poll.';
    END IF;

    -- Insert Vote
    INSERT INTO public.poll_votes (poll_id, option_id, employee_id)
    VALUES (p_poll_id, p_option_id, p_employee_id);

    -- Increment Count
    UPDATE public.poll_options
    SET vote_count = vote_count + 1
    WHERE id = p_option_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
