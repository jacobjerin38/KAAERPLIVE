import { supabase } from '../../lib/supabase';
import { WebsiteFinderJob, WebsiteFinderResult, OrgAISettings } from '../../types';

// Rate limiting & Concurrency constants
const MAX_CONCURRENCY = 3;
const DELAY_BETWEEN_REQUESTS_MS = 2000; // 2 seconds to be safe with rate limits

export class WebsiteFinderService {
    private static isProcessing = false;

    // --- Job Management ---

    static async createJob(companyId: string, userId: string, companies: { name: string }[], countries: string[]): Promise<WebsiteFinderJob | null> {
        try {
            // 1. Create Job
            const { data: job, error } = await supabase
                .from('crm_website_finder_jobs')
                .insert([{
                    company_id: companyId,
                    created_by: userId,
                    status: 'DRAFT',
                    countries_checked: countries,
                    total_records: companies.length,
                    processed_records: 0
                }])
                .select()
                .single();

            if (error) throw error;
            if (!job) return null;

            // 2. Create Initial Results
            const resultsPayload = companies.map(c => ({
                job_id: job.id,
                company_name: c.name,
                status: 'PENDING',
                attempts: 0
            }));

            const { error: resultsError } = await supabase
                .from('crm_website_finder_results')
                .insert(resultsPayload);

            if (resultsError) throw resultsError;

            return job as WebsiteFinderJob;
        } catch (error) {
            console.error('Error creating job:', error);
            return null;
        }
    }

    static async startJob(jobId: string) {
        // Update status to RUNNING
        await supabase
            .from('crm_website_finder_jobs')
            .update({ status: 'RUNNING' })
            .eq('id', jobId);

        // Trigger processing
        this.processJob(jobId);
    }

    // --- Processing Engine ---

    private static async processJob(jobId: string) {
        if (this.isProcessing) return; // Simple mutex
        this.isProcessing = true;

        try {
            // 1. Get Job & Settings
            const { data: job } = await supabase.from('crm_website_finder_jobs').select('*').eq('id', jobId).single();
            if (!job || job.status !== 'RUNNING') {
                this.isProcessing = false;
                return;
            }

            const { data: settings } = await supabase.from('org_ai_settings').select('*').eq('company_id', job.company_id).single();

            if (!settings || !settings.api_key_encrypted || settings.status !== 'ACTIVE') {
                // Fail the job if no settings
                await supabase.from('crm_website_finder_jobs').update({ status: 'FAILED' }).eq('id', jobId);
                this.isProcessing = false;
                return;
            }

            const apiKey = settings.api_key_encrypted; // In a real app, decrypt here

            // 2. Worker Loop
            let hasPending = true;

            while (hasPending) {
                // Fetch next batch
                const { data: batch } = await supabase
                    .from('crm_website_finder_results')
                    .select('*')
                    .eq('job_id', jobId)
                    .eq('status', 'PENDING')
                    .limit(MAX_CONCURRENCY);

                if (!batch || batch.length === 0) {
                    hasPending = false;
                    break;
                }

                // Process batch in parallel
                await Promise.all(batch.map(item => this.processItem(item, job.countries_checked, apiKey)));

                // Update Progress
                const { count } = await supabase
                    .from('crm_website_finder_results')
                    .select('*', { count: 'exact', head: true })
                    .eq('job_id', jobId)
                    .eq('status', 'SUCCESS');

                // Also count failed as processed for progress bar
                const { count: failedCount } = await supabase
                    .from('crm_website_finder_results')
                    .select('*', { count: 'exact', head: true })
                    .eq('job_id', jobId)
                    .neq('status', 'PENDING');

                await supabase
                    .from('crm_website_finder_jobs')
                    .update({ processed_records: failedCount })
                    .eq('id', jobId);

                // Small delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
            }

            // 3. Mark Complete
            await supabase.from('crm_website_finder_jobs').update({ status: 'COMPLETED' }).eq('id', jobId);

        } catch (error) {
            console.error('Job processing error:', error);
            await supabase.from('crm_website_finder_jobs').update({ status: 'FAILED' }).eq('id', jobId);
        } finally {
            this.isProcessing = false;
        }
    }

    private static async processItem(item: WebsiteFinderResult, countries: string[], apiKey: string) {
        try {
            // Construct Prompt
            const prompt = `Identify the official website for company "${item.company_name}".
            Also check check if they have active branches in these countries: ${countries.join(', ')}.
            
            Return JSON only:
            {
                "website": "url or null",
                "branches": { "CountryCode": true/false }
            }
            Use Google Grounding.
            `;

            // Call Gemini API (Mocking the fetch here as I don't have the full Gemini client setup in this snippet, 
            // but this is where the fetch to https://generativelanguage.googleapis.com... would go)
            // For now, we simulate a successful call

            // SIMULATED FETCH
            const response = await this.mockGeminiCall(apiKey, prompt, item.company_name);

            // Update Result
            await supabase
                .from('crm_website_finder_results')
                .update({
                    status: 'SUCCESS',
                    website_url: response.website,
                    branch_presence: response.branches,
                    raw_response: JSON.stringify(response)
                })
                .eq('id', item.id);

        } catch (error) {
            console.error('Item error:', error);
            await supabase
                .from('crm_website_finder_results')
                .update({
                    status: 'FAILED',
                    attempts: item.attempts + 1
                })
                .eq('id', item.id);
        }
    }

    // Real Edge Function Call
    private static async mockGeminiCall(apiKey: string, prompt: string, companyName: string): Promise<any> {
        try {
            const { data, error } = await supabase.functions.invoke('crm-website-finder', {
                body: { prompt, companyName }
            });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Edge Function Call Failed:", error);
            throw error;
        }
    }

    // helper to get all jobs
    static async getJobs() {
        return supabase.from('crm_website_finder_jobs').select('*').order('created_at', { ascending: false });
    }
}
