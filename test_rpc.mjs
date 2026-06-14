import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testMoreRPCs() {
  const companyId = '0c0b0d78-4531-412e-8fa3-bbc74b7145ae';
  const today = new Date().toISOString().split('T')[0];

  const tests = [
    { name: 'rpc_ar_aging', args: { p_company_id: companyId } },
    { name: 'rpc_finance_dashboard_summary', args: { p_company_id: companyId } },
    { name: 'rpc_generate_payroll', args: { p_company_id: companyId, p_month_year: today } },
    { name: 'rpc_run_leave_accrual', args: { p_company_id: companyId, p_year: 2026 } }
  ];

  for (const test of tests) {
    const { data, error } = await supabase.rpc(test.name, test.args);
    if (error) {
      console.error(`❌ [FAILED] ${test.name}:`, error.message);
    } else {
      console.log(`✅ [OK] ${test.name}`);
    }
  }
}

testMoreRPCs();
