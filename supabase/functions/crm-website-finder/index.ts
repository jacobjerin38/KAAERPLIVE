import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { prompt, companyName } = await req.json()
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // 1. Get API Key from Settings
        // We assume the user calling this has access to their company's settings (RLS should handle this, 
        // but here we trust the auth context of the caller)
        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabaseClient.from('profiles').select('company_id').eq('id', user.id).single();
        if (!profile) throw new Error("No profile found");

        const { data: settings } = await supabaseClient
            .from('org_ai_settings')
            .select('api_key_encrypted')
            .eq('company_id', profile.company_id)
            .single();

        if (!settings?.api_key_encrypted) {
            throw new Error("Gemini API Key not configured for this organization.");
        }

        const GEMINI_API_KEY = settings.api_key_encrypted;

        // 2. Call Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        })

        const data = await response.json()

        // Parse result
        const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResult) throw new Error("No response from AI");

        const jsonResult = JSON.parse(textResult);

        return new Response(
            JSON.stringify(jsonResult),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
    }
})
