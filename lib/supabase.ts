import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// These environment variables will be provided by the user
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase Environment Variables. Database features will not work.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
