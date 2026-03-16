-- Enable RLS on all tables
-- Create org_ai_settings table
CREATE TABLE IF NOT EXISTS public.org_ai_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('GEMINI')),
    api_key_encrypted TEXT NOT NULL,
    model TEXT DEFAULT 'gemini-2.5-flash',
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(company_id, provider)
);

-- RLS for org_ai_settings
ALTER TABLE public.org_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage AI settings" ON public.org_ai_settings
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE profiles.company_id = org_ai_settings.company_id 
            AND profiles.role IN ('Bit', 'Admin', 'Super Admin')
        )
    );

-- Create crm_website_finder_jobs table
CREATE TABLE IF NOT EXISTS public.crm_website_finder_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'RUNNING', 'COMPLETED', 'FAILED')),
    countries_checked JSONB DEFAULT '[]'::jsonb,
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS for crm_website_finder_jobs
ALTER TABLE public.crm_website_finder_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view jobs for their company" ON public.crm_website_finder_jobs
    FOR SELECT
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can create jobs for their company" ON public.crm_website_finder_jobs
    FOR INSERT
    WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can update their own jobs" ON public.crm_website_finder_jobs
    FOR UPDATE
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

-- Create crm_website_finder_results table
CREATE TABLE IF NOT EXISTS public.crm_website_finder_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.crm_website_finder_jobs(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    website_url TEXT,
    branch_presence JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'RATE_LIMITED')),
    attempts INTEGER DEFAULT 0,
    raw_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS for crm_website_finder_results
ALTER TABLE public.crm_website_finder_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view results for their company jobs" ON public.crm_website_finder_results
    FOR SELECT
    USING (
        job_id IN (
            SELECT id FROM public.crm_website_finder_jobs 
            WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can insert results for their company jobs" ON public.crm_website_finder_results
    FOR INSERT
    WITH CHECK (
        job_id IN (
            SELECT id FROM public.crm_website_finder_jobs 
            WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can update results for their company jobs" ON public.crm_website_finder_results
    FOR UPDATE
    USING (
        job_id IN (
            SELECT id FROM public.crm_website_finder_jobs 
            WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        )
    );
