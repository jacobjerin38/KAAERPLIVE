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

// System/Tenant tables that should NOT be wiped or backed up directly to prevent locking out the user
const EXCLUDED_TABLES = [
  'companies',
  'group_companies',
  'user_company_access',
  'profiles',
  'roles', // Often tied to user_company_access
  'workflow_action_logs', // Huge logs
  'device_attendance_logs' // Huge logs
];

/**
 * Performs a topological sort of the tables based on foreign key dependencies.
 * Returns an array of table names where parents come before children.
 */
function computeTopologicalOrder(schema: SchemaInfo): string[] {
  const { tables, foreign_keys } = schema;
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
    if (parent !== child && tables.includes(parent) && tables.includes(child)) {
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

    adj[current].forEach(child => {
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
  const { data, error } = await (supabase.rpc as any)('get_database_schema_info');
  if (error || !data) {
    throw new Error('Failed to fetch database schema topology. ' + (error?.message || ''));
  }
  
  const schemaInfo = data as unknown as SchemaInfo;
  const orderedTables = computeTopologicalOrder(schemaInfo);
  
  return orderedTables.filter(t => !EXCLUDED_TABLES.includes(t));
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
  for (const table of tablesOrder) {
    onProgress(`Exporting ${table}...`);
    let allRows: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await (supabase.from as any)(table)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.warn(`Error backing up table ${table}:`, error.message);
        break; // Skip and continue
      }

      if (data && data.length > 0) {
        allRows = allRows.concat(data);
        page++;
      } else {
        hasMore = false;
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
  Object.keys(data.localStorageData).forEach((key) => {
    localStorage.setItem(key, data.localStorageData[key]);
  });

  // 2. Delete Supabase data in REVERSE topological order
  const reversedTables = [...targetTablesOrder].reverse();
  for (const table of reversedTables) {
    if (table === 'employees') continue; // Employees might be deeply tied to users; upsert is safer
    
    // Only attempt to clear tables that exist in the target schema AND we have backup data for
    // (Or maybe we want to clear everything even if not in backup? Best to clear what we know)
    if (!data.supabaseData[table]) continue;

    onProgress(`Clearing existing ${table}...`);
    const { error } = await (supabase.from as any)(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Always true condition
    
    if (error) {
      console.warn(`Error clearing table ${table}:`, error.message);
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
      
      const { error } = await (supabase.from as any)(table)
        .upsert(chunk, { onConflict: 'id' });
        
      if (error) {
        console.error(`Error restoring chunk for ${table}:`, error.message);
        throw new Error(`Failed to restore ${table}: ${error.message}`);
      }
    }
  }

  onProgress('Restore complete!');
}
