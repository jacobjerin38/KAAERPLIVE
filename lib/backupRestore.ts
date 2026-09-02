import { supabase } from './supabase';

export interface BackupData {
  version: string;
  timestamp: string;
  localStorageData: Record<string, string>;
  supabaseData: Record<string, any[]>;
}

interface SchemaInfo {
  tables: string[];
  foreign_keys: { child: string; parent: string }[];
}

// System/Tenant tables that should NOT be wiped or backed up directly to prevent locking out the user or huge log bloat
const EXCLUDED_TABLES = [
  'companies',
  'group_companies',
  'user_company_access',
  'profiles',
  'roles', // Often tied to user_company_access
  'workflow_action_logs', // Huge logs
  'device_attendance_logs', // Huge logs
  'activity_logs', // Huge logs
  'delete_audit_logs', // Huge logs
  'schema_migrations',
  'supabase_migrations',
  'attendance_corrections_log',
  'payroll_audit_logs',
  'project_audit_log'
];

// Fallback curated table list in case dynamic schema RPC cannot be reached
const CORE_ERP_TABLES = [
  'org_faiths', 'org_blood_groups', 'org_marital_status', 'org_nationalities',
  'org_visa_types', 'org_employee_statuses', 'org_leave_plans', 'org_leave_types',
  'org_pay_groups', 'org_salary_components', 'org_shift_timings', 'org_attendance_status',
  'org_punch_rules', 'org_attendance_settings', 'org_weekoff_rules', 'org_holiday_calendar',
  'departments', 'org_designations', 'org_grades', 'org_employment_types', 'org_bank_configs',
  'locations', 'employees', 'employee_locations', 'employee_salary_components',
  'financial_masters_currencies', 'financial_masters_exchange_rates', 'fiscal_years',
  'accounting_periods', 'account_groups', 'chart_of_accounts', 'accounting_chart_of_accounts',
  'journals', 'accounting_journals', 'taxes', 'accounting_taxes', 'accounting_cost_centers',
  'accounting_partners', 'item_master', 'warehouses', 'warehouse_zones', 'warehouse_bins',
  'stock_movements', 'inventory_transactions', 'purchase_orders', 'purchase_order_lines',
  'sales_orders', 'sales_order_lines', 'fixed_assets', 'accounting_journal_entries',
  'accounting_journal_lines', 'accounting_payments', 'crm_customers', 'crm_leads',
  'crm_opportunities', 'crm_deals', 'crm_quotations', 'crm_quotation_lines',
  'pm_projects', 'pm_tasks', 'pm_timesheets', 'project_proposals', 'project_proposal_revisions',
  'attendance_periods', 'attendance', 'payroll_runs', 'payroll_records', 'payslips',
  'leave_applications', 'leave_balances', 'overtime_requests'
];

/**
 * Performs a topological sort of the tables based on foreign key dependencies.
 * Returns an array of table names where parents come before children.
 */
function computeTopologicalOrder(schema: SchemaInfo): string[] {
  const tables = schema?.tables || [];
  const foreign_keys = schema?.foreign_keys || [];
  const adj: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  // Initialize
  tables.forEach(t => {
    adj[t] = [];
    inDegree[t] = 0;
  });

  // Build graph: Parent -> Child
  foreign_keys.forEach(({ parent, child }) => {
    // Ignore self-references or missing tables
    if (parent && child && parent !== child && tables.includes(parent) && tables.includes(child)) {
      if (!adj[parent].includes(child)) {
        adj[parent].push(child);
        inDegree[child]++;
      }
    }
  });

  const queue: string[] = [];
  tables.forEach(t => {
    if (inDegree[t] === 0) queue.push(t);
  });

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    (adj[current] || []).forEach(child => {
      inDegree[child]--;
      if (inDegree[child] === 0) {
        queue.push(child);
      }
    });
  }

  // Any remaining tables in `tables` not in `order` means there's a cycle (e.g. self-referencing FK).
  // We'll append them at the end.
  const remaining = tables.filter(t => !order.includes(t));
  return [...order, ...remaining];
}

async function getOrderedTables(): Promise<string[]> {
  try {
    const { data, error } = await (supabase.rpc as any)('get_database_schema_info');
    if (!error && data && Array.isArray(data.tables) && data.tables.length > 0) {
      const schemaInfo = data as unknown as SchemaInfo;
      const orderedTables = computeTopologicalOrder(schemaInfo);
      return orderedTables.filter(t => !EXCLUDED_TABLES.includes(t));
    }
    if (error) {
      console.warn('Dynamic topology fetch notice, using fallback:', error.message);
    }
  } catch (err: any) {
    console.warn('Failed to fetch dynamic topology, falling back to core tables:', err?.message);
  }

  // Fallback to curated table list
  return CORE_ERP_TABLES.filter(t => !EXCLUDED_TABLES.includes(t));
}

export async function createFullBackup(onProgress: (status: string) => void): Promise<BackupData> {
  const backup: BackupData = {
    version: '1.1',
    timestamp: new Date().toISOString(),
    localStorageData: {},
    supabaseData: {}
  };

  onProgress('Analyzing database schema topology...');
  const tablesOrder = await getOrderedTables();

  // 1. Backup Local Storage
  onProgress('Backing up local settings...');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      backup.localStorageData[key] = localStorage.getItem(key) || '';
    }
  }

  // 2. Backup Supabase Tables dynamically
  const total = tablesOrder.length;
  for (let i = 0; i < total; i++) {
    const table = tablesOrder[i];
    onProgress(`Exporting ${table} (${i + 1}/${total})...`);
    let allRows: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      try {
        const { data, error } = await (supabase.from as any)(table)
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.warn(`Notice backing up table ${table}:`, error.message);
          break; // Skip this table and continue
        }

        if (data && data.length > 0) {
          allRows = allRows.concat(data);
          // If fewer records than pageSize, we have reached the end of this table
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      } catch (err: any) {
        console.warn(`Exception on table ${table}:`, err?.message);
        break;
      }
    }

    if (allRows.length > 0) {
      backup.supabaseData[table] = allRows;
    }
  }

  onProgress('Backup complete!');
  return backup;
}

export async function restoreFullBackup(data: BackupData, onProgress: (status: string) => void): Promise<void> {
  if (!data.version || !data.supabaseData) {
    throw new Error('Invalid backup file format.');
  }

  onProgress('Analyzing target database schema topology...');
  const targetTablesOrder = await getOrderedTables();

  // 1. Restore Local Storage
  onProgress('Restoring local settings...');
  localStorage.clear();
  Object.keys(data.localStorageData || {}).forEach((key) => {
    localStorage.setItem(key, data.localStorageData[key]);
  });

  // 2. Delete Supabase data in REVERSE topological order
  const reversedTables = [...targetTablesOrder].reverse();
  for (const table of reversedTables) {
    if (table === 'employees') continue; // Employees might be deeply tied to users; upsert is safer
    
    // Only attempt to clear tables that exist in the target schema AND we have backup data for
    if (!data.supabaseData[table]) continue;

    onProgress(`Clearing existing ${table}...`);
    try {
      const { error } = await (supabase.from as any)(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Always true condition
      
      if (error) {
        console.warn(`Error clearing table ${table}:`, error.message);
      }
    } catch (err: any) {
      console.warn(`Exception clearing table ${table}:`, err?.message);
    }
  }

  // 3. Insert Supabase data in forward topological order
  for (const table of targetTablesOrder) {
    const rows = data.supabaseData[table];
    if (!rows || rows.length === 0) continue;

    onProgress(`Restoring ${table} (${rows.length} records)...`);
    
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      
      try {
        const { error } = await (supabase.from as any)(table)
          .upsert(chunk, { onConflict: 'id' });
          
        if (error) {
          // Fallback to standard insert if onConflict fails on non-id table
          const { error: insertErr } = await (supabase.from as any)(table).insert(chunk);
          if (insertErr) {
            console.warn(`Notice restoring ${table}:`, insertErr.message);
          }
        }
      } catch (err: any) {
        console.warn(`Exception restoring ${table}:`, err?.message);
      }
    }
  }

  onProgress('Restore complete!');
}
