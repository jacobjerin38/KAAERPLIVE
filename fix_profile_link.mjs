import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hcpywrxdabaqyyijoxtf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjcHl3cnhkYWJhcXl5aWpveHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NjYxNTEsImV4cCI6MjA4MzQ0MjE1MX0.IYzQAKGRzU97oyPQGs1j7-qhp0Gi3aH_ePljAXX-AH0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const email = 'khadeejasana457@gmail.com';

    console.log('--- DIAGNOSTIC CHECK ---');

    // 1. Check Profiles table
    const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('id, employee_id, role, company_id')
        .ilike('email', email);

    console.log('Profile Record:', profs);

    // 2. Check Employees table
    const { data: emps, error: empErr } = await supabase
        .from('employees')
        .select('id, company_id, role, status, email')
        .ilike('email', email);

    console.log('Employee Record:', emps);

    // 3. See if she is an admin in 'roles'
    if (emps && emps.length > 0) {
        const { data: roles } = await supabase.from('roles').select('name').eq('id', emps[0].role_id || '');
        console.log('Employee Role Table Ref:', roles);
    }
}

checkData();
