import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  Filter, 
  Calendar, 
  Eye, 
  X, 
  CheckCircle, 
  User, 
  Database, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock
} from 'lucide-react';

interface ActivityLog {
  id: string;
  company_id: string;
  user_id: string | null;
  user_email: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  table_name: string | null;
  record_id: string | null;
  old_data: any;
  new_data: any;
  description: string | null;
  created_at: string;
}

export const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(15);
  
  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL'); // ALL, TODAY, WEEK, MONTH
  
  // Details Modal
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query: any = supabase
        .from('activity_logs' as any)
        .select('*', { count: 'exact' });

      // Apply search filter
      if (search.trim()) {
        const searchPattern = `%${search.trim()}%`;
        query = query.or(
          `description.ilike.${searchPattern},user_email.ilike.${searchPattern},table_name.ilike.${searchPattern}`
        );
      }

      // Apply action filter
      if (actionFilter !== 'ALL') {
        query = query.eq('action', actionFilter);
      }

      // Apply date filter
      if (dateFilter !== 'ALL') {
        const now = new Date();
        let startDate = new Date();
        if (dateFilter === 'TODAY') {
          startDate.setHours(0, 0, 0, 0);
        } else if (dateFilter === 'WEEK') {
          startDate.setDate(now.getDate() - 7);
        } else if (dateFilter === 'MONTH') {
          startDate.setMonth(now.getMonth() - 1);
        }
        query = query.gte('created_at', startDate.toISOString());
      }

      // Pagination & Ordering
      query = query
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      setLogs((data as ActivityLog[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, dateFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchLogs();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'LOGOUT':
        return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20';
      case 'INSERT':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'UPDATE':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="bg-white dark:bg-zinc-900/50 backdrop-blur-xl rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden flex flex-col h-[75vh] animate-scale-in">
      {/* Header Panel */}
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-500" />
            Activity Audit Logs
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time track of user operations, data edits, logins, and deletions.
          </p>
        </div>
        
        <button 
          onClick={() => { setPage(0); fetchLogs(); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-semibold transition-colors duration-200 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters Area */}
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-transparent grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="md:col-span-5 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, table, description..."
            className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent focus:border-indigo-500/30 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none transition-all duration-200"
          />
        </form>

        {/* Action type */}
        <div className="md:col-span-3 flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
            className="w-full py-3 px-4 bg-zinc-50 dark:bg-zinc-800/50 border border-transparent focus:border-indigo-500/30 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none transition-all duration-200"
          >
            <option value="ALL">All Actions</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="INSERT">INSERT (Create)</option>
            <option value="UPDATE">UPDATE (Edit)</option>
            <option value="DELETE">DELETE (Remove)</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="md:col-span-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setPage(0); }}
            className="w-full py-3 px-4 bg-zinc-50 dark:bg-zinc-800/50 border border-transparent focus:border-indigo-500/30 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none transition-all duration-200"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today Only</option>
            <option value="WEEK">Last 7 Days</option>
            <option value="MONTH">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Logs Table Area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-sm font-medium">Loading audit trail...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 p-8">
            <Clock className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No logs found</h3>
            <p className="text-xs text-slate-500 max-w-sm text-center">
              Try adjusting your search criteria or filters to locate target activity.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-900/10 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                <th className="p-4 pl-6">Timestamp</th>
                <th className="p-4">User</th>
                <th className="p-4">Action</th>
                <th className="p-4">Module / Table</th>
                <th className="p-4">Description</th>
                <th className="p-4 pr-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {logs.map((log) => (
                <tr 
                  key={log.id} 
                  className="hover:bg-zinc-50/30 dark:hover:bg-zinc-800/10 text-slate-700 dark:text-slate-300 text-sm transition-colors duration-150 group"
                >
                  {/* Timestamp */}
                  <td className="p-4 pl-6 font-medium text-slate-500 dark:text-slate-400 text-xs">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  
                  {/* User Email */}
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {log.user_email ? log.user_email[0].toUpperCase() : 'U'}
                      </div>
                      <span className="font-semibold text-xs truncate max-w-[150px]" title={log.user_email || 'System'}>
                        {log.user_email || 'System / Trigger'}
                      </span>
                    </div>
                  </td>
                  
                  {/* Action Badge */}
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  
                  {/* Table Name */}
                  <td className="p-4 font-mono text-xs text-indigo-600 dark:text-indigo-400">
                    {log.table_name || '-'}
                  </td>
                  
                  {/* Description */}
                  <td className="p-4 max-w-[280px] truncate font-medium text-xs">
                    {log.description}
                  </td>
                  
                  {/* View Details Button */}
                  <td className="p-4 pr-6 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="inline-flex items-center justify-center p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all duration-200"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer / Pagination */}
      {totalPages > 1 && (
        <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Showing {page * limit + 1} to {Math.min((page + 1) * limit, totalCount)} of {totalCount} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-3">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Details Drawer / Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl h-full bg-white dark:bg-zinc-950 shadow-2xl flex flex-col animate-slide-left border-l border-zinc-200 dark:border-zinc-800">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/10">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Log Event Inspection</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">ID: {selectedLog.id}</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Event Overview Card */}
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getActionColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </span>
                </div>
                
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  {selectedLog.description}
                </h4>
                
                <div className="h-px bg-zinc-200/50 dark:bg-zinc-800/50 my-2" />

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <div>
                    <p className="text-[10px] uppercase text-slate-400 tracking-wider">Performer</p>
                    <p className="text-slate-800 dark:text-slate-200 mt-0.5 truncate">{selectedLog.user_email || 'System Service'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-400 tracking-wider">Entity / Table</p>
                    <p className="text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono">{selectedLog.table_name || '-'}</p>
                  </div>
                  {selectedLog.record_id && (
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase text-slate-400 tracking-wider">Record Primary Key</p>
                      <p className="text-slate-700 dark:text-slate-300 font-mono mt-0.5 select-all">{selectedLog.record_id}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Data payload differences / Diffs */}
              {selectedLog.action !== 'LOGIN' && selectedLog.action !== 'LOGOUT' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-500" />
                      Payload Inspection & Differences
                    </h4>
                  </div>
                  
                  <JSONDiffViewer oldData={selectedLog.old_data} newData={selectedLog.new_data} />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end bg-zinc-50/50 dark:bg-zinc-900/10">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs hover:-translate-y-0.5 transition-all shadow-md active:scale-95"
              >
                Close Audit Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Rich Subcomponent for JSON Diffs
interface DiffViewerProps {
  oldData: any;
  newData: any;
}

const JSONDiffViewer: React.FC<DiffViewerProps> = ({ oldData, newData }) => {
  const [activeTab, setActiveTab] = useState<'diff' | 'raw_new' | 'raw_old'>('diff');

  if (!oldData && !newData) {
    return <p className="text-xs text-slate-400 italic">No data values recorded.</p>;
  }

  // Get all unique keys from both objects
  const oObj = oldData && typeof oldData === 'object' ? oldData : {};
  const nObj = newData && typeof newData === 'object' ? newData : {};
  const allKeys = Array.from(new Set([...Object.keys(oObj), ...Object.keys(nObj)])).sort();

  // Exclude boilerplate metadata columns to declutter the diff
  const filteredKeys = allKeys.filter(
    k => !['created_at', 'updated_at', 'company_id', 'id'].includes(k)
  );

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950">
      {/* Tabs */}
      <div className="flex bg-zinc-900 text-zinc-400 text-xs font-semibold border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('diff')}
          className={`px-4 py-2.5 hover:text-white transition-colors border-b-2 ${activeTab === 'diff' ? 'border-indigo-500 text-white bg-zinc-950' : 'border-transparent'}`}
        >
          Key-Value Differences
        </button>
        {newData && (
          <button
            onClick={() => setActiveTab('raw_new')}
            className={`px-4 py-2.5 hover:text-white transition-colors border-b-2 ${activeTab === 'raw_new' ? 'border-indigo-500 text-white bg-zinc-950' : 'border-transparent'}`}
          >
            New Object Payload
          </button>
        )}
        {oldData && (
          <button
            onClick={() => setActiveTab('raw_old')}
            className={`px-4 py-2.5 hover:text-white transition-colors border-b-2 ${activeTab === 'raw_old' ? 'border-indigo-500 text-white bg-zinc-950' : 'border-transparent'}`}
          >
            Old Object Payload
          </button>
        )}
      </div>

      <div className="p-4 max-h-[350px] overflow-y-auto font-mono text-[11px] leading-relaxed">
        {activeTab === 'diff' ? (
          <div className="space-y-2.5">
            {filteredKeys.length === 0 ? (
              <p className="text-zinc-500 italic text-center py-4">No payload differences detected.</p>
            ) : (
              filteredKeys.map(key => {
                const hasOld = key in oObj;
                const hasNew = key in nObj;
                const oldVal = JSON.stringify(oObj[key]);
                const newVal = JSON.stringify(nObj[key]);
                
                // Unchanged
                if (hasOld && hasNew && oldVal === newVal) {
                  return null; // Skip unchanged properties to focus on modifications
                }

                // Added Property
                if (!hasOld && hasNew) {
                  return (
                    <div key={key} className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/10 flex flex-col gap-0.5">
                      <span className="text-emerald-400 font-bold text-xs">{key}</span>
                      <span className="text-[10px] text-zinc-400">Value Added:</span>
                      <span className="text-emerald-300 break-all">{newVal}</span>
                    </div>
                  );
                }

                // Removed Property
                if (hasOld && !hasNew) {
                  return (
                    <div key={key} className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/10 flex flex-col gap-0.5">
                      <span className="text-rose-400 font-bold text-xs">{key}</span>
                      <span className="text-[10px] text-zinc-400">Value Removed:</span>
                      <span className="text-rose-300 line-through break-all">{oldVal}</span>
                    </div>
                  );
                }

                // Value Modified
                return (
                  <div key={key} className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col gap-1.5">
                    <span className="text-indigo-400 font-bold text-xs">{key}</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-rose-500/5 p-1.5 rounded-lg border border-rose-500/10 flex flex-col">
                        <span className="text-rose-400 font-bold uppercase text-[8px] tracking-wider mb-0.5">Original Value</span>
                        <span className="text-rose-300 break-all">{oldVal}</span>
                      </div>
                      <div className="bg-emerald-500/5 p-1.5 rounded-lg border border-emerald-500/10 flex flex-col">
                        <span className="text-emerald-400 font-bold uppercase text-[8px] tracking-wider mb-0.5">Updated Value</span>
                        <span className="text-emerald-300 break-all">{newVal}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            
            {/* Show message for hidden values */}
            <p className="text-[10px] text-zinc-500 text-center border-t border-zinc-900 pt-2 mt-2">
              Note: Unchanged configuration keys and system timestamps (id, created_at, updated_at) are hidden for readability.
            </p>
          </div>
        ) : activeTab === 'raw_new' ? (
          <pre className="text-zinc-300 whitespace-pre-wrap select-all">{JSON.stringify(nObj, null, 2)}</pre>
        ) : (
          <pre className="text-zinc-300 whitespace-pre-wrap select-all">{JSON.stringify(oObj, null, 2)}</pre>
        )}
      </div>
    </div>
  );
};
