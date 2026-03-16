import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handler(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Check for Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized: Missing Authorization header" }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        // Authentication Check
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { action, payload } = await req.json();

        // Fetch Company API Key
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!profile?.company_id) {
            throw new Error("User does not belong to any company");
        }

        const { data: settings } = await supabaseClient
            .from('org_ai_settings')
            .select('api_key_encrypted')
            .eq('company_id', profile.company_id)
            .single();

        // Fallback to Env var if company setting missing (optional, for backward compat or admin ease)
        const apiKey = settings?.api_key_encrypted || Deno.env.get('GEMINI_API_KEY');

        if (!apiKey) {
            throw new Error("Gemini API Key not configured for this organization.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        let resultData;

        if (action === 'analyze-lead') {
            // payload: { contact: ... }
            const prompt = `Analyze this CRM contact and provide a lead score (0-100), reasoning, and a suggested next action.
        Output ONLY valid JSON.
        Contact Data: ${JSON.stringify(payload.contact)}`;

            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            // cleanse json (remove markdown code blocks if any)
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            try {
                resultData = JSON.parse(jsonStr);
            } catch (e) {
                // Fallback if JSON parsing fails, return raw text or empty object
                console.error("Failed to parse JSON from AI:", jsonStr);
                resultData = { raw_output: text };
            }

        } else if (action === 'pipeline-insight') {
            // payload: { deals: ... }
            const stats = payload; // pre-calculated stats passed from client to save bandwidth, or raw deals
            const prompt = `You are a Sales Manager. Generate a 2-sentence motivating summary based on this pipeline data:
        ${JSON.stringify(stats)}
        Focus on the opportunity.`;

            const result = await model.generateContent(prompt);
            resultData = result.response.text();

        } else if (action === 'draft-email') {
            const { contact } = payload;
            const prompt = `Draft a short, professional sales email to ${contact.name} at ${contact.company}. 
        Context: ${contact.notes}
        Keep it under 100 words.`;

            const result = await model.generateContent(prompt);
            resultData = result.response.text();
        } else {
            throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify(resultData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}
