import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { error: authErr } = await supabase.auth.signInWithPassword({
        email: 'admin@kaa.com',
        password: 'password123'
    });
    if (authErr) {
        console.error('Auth error:', authErr);
        return;
    }

    const { data: user } = await supabase.auth.getUser();
    console.log('Logged in as:', user.user.id);

    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.user.id).single();
    console.log('Company ID:', profile.company_id);

    const { data, error } = await supabase.from('item_master').insert([{
        company_id: profile.company_id,
        name: 'Test RLS',
        code: 'TEST-RLS',
        uom: 'PCS',
        is_stockable: true,
        valuation_method: 'FIFO',
        status: 'Active'
    }]);

    console.log('Insert result:', error ? error.message : 'Success');
}

test();
