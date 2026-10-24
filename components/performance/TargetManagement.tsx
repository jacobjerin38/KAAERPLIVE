import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Target,
  Users,
  Calendar,
  DollarSign,
  Percent,
  Save,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  TrendingUp,
  Layers
} from 'lucide-react';
import { fetchEmployeeTargetAchievementData } from '../../lib/targetAchievementService';

interface TargetManagementProps {
  isOpen?: boolean;
  onClose?: () => void;
  preSelectedEmployeeId?: string;
  onTargetSaved?: () => void;
}

export const TargetManagement: React.FC<TargetManagementProps> = ({
  isOpen = true,
  onClose,
  preSelectedEmployeeId,
  onTargetSaved
}) => {
  const { currentCompanyId, user, userRole, hasPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [targetsList, setTargetsList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(preSelectedEmployeeId || '');
  const [targetPeriod, setTargetPeriod] = useState<'Monthly' | 'Yearly'>('Monthly');
  const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear());
  const [targetMonth, setTargetMonth] = useState<number>(new Date().getMonth() + 1);
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [incentiveRate, setIncentiveRate] = useState<string>('2.5');

  // Live Performance Context for selected employee in the selected period
  const [employeePerformanceContext, setEmployeePerformanceContext] = useState<{
    actualAchievement: number;
    workOrdersCount: number;
    wonOpportunitiesCount: number;
  }>({ actualAchievement: 0, workOrdersCount: 0, wonOpportunitiesCount: 0 });

  const months = [
    { val: 1, name: 'January' },
    { val: 2, name: 'February' },
    { val: 3, name: 'March' },
    { val: 4, name: 'April' },
    { val: 5, name: 'May' },
    { val: 6, name: 'June' },
    { val: 7, name: 'July' },
    { val: 8, name: 'August' },
    { val: 9, name: 'September' },
    { val: 10, name: 'October' },
    { val: 11, name: 'November' },
    { val: 12, name: 'December' }
  ];

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    if (currentCompanyId) {
      loadInitialData();
    }
  }, [currentCompanyId]);

  useEffect(() => {
    if (preSelectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(preSelectedEmployeeId);
      loadEmployeeExistingTarget(preSelectedEmployeeId, targetPeriod, targetYear, targetMonth);
    }
  }, [preSelectedEmployeeId, employees]);

  useEffect(() => {
    if (selectedEmployeeId && currentCompanyId) {
      loadEmployeeExistingTarget(selectedEmployeeId, targetPeriod, targetYear, targetMonth);
      loadLivePerformanceContext(selectedEmployeeId, targetPeriod, targetYear, targetMonth);
    }
  }, [selectedEmployeeId, targetPeriod, targetYear, targetMonth]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch active employees
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('id, employee_code, name, designation, department')
        .eq('company_id', currentCompanyId)
        .neq('status', 'Resigned')
        .order('name');

      if (empErr) throw empErr;
      const emps = empData || [];
      setEmployees(emps);
      if (!selectedEmployeeId && emps.length > 0) {
        setSelectedEmployeeId(emps[0].id);
      }

      // 2. Fetch all existing targets for company
      const { data: targData, error: targErr } = await supabase
        .from('employee_targets')
        .select(`
          *,
          employee:employees(id, name, employee_code, designation, department)
        `)
        .eq('company_id', currentCompanyId)
        .order('target_year', { ascending: false })
        .order('target_period_val', { ascending: false });

      if (targErr) throw targErr;
      setTargetsList(targData || []);
    } catch (err: any) {
      console.error('Error loading target management data:', err);
      showNotification('error', err.message || 'Failed to load targets');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeExistingTarget = (
    empId: string,
    period: 'Monthly' | 'Yearly',
    year: number,
    month: number
  ) => {
    const periodVal = period === 'Monthly' ? month : 0;
    const match = targetsList.find(
      t =>
        t.employee_id === empId &&
        t.target_period === period &&
        Number(t.target_year) === Number(year) &&
        Number(t.target_period_val) === Number(periodVal)
    );

    if (match) {
      setTargetAmount(String(match.target_amount || ''));
      setIncentiveRate(String(match.incentive_rate || '2.5'));
    } else {
      setTargetAmount('');
      setIncentiveRate('2.5');
    }
  };

  const loadLivePerformanceContext = async (
    empId: string,
    period: 'Monthly' | 'Yearly',
    year: number,
    month: number
  ) => {
    try {
      if (!currentCompanyId) return;
      const data = await fetchEmployeeTargetAchievementData(
        currentCompanyId,
        period,
        year,
        period === 'Monthly' ? month : undefined
      );
      const row = data.rows.find(r => r.employeeId === empId);
      if (row) {
        setEmployeePerformanceContext({
          actualAchievement: row.actualAchievement,
          workOrdersCount: row.workOrdersCount,
          wonOpportunitiesCount: row.wonOpportunitiesCount
        });
      } else {
        setEmployeePerformanceContext({
          actualAchievement: 0,
          workOrdersCount: 0,
          wonOpportunitiesCount: 0
        });
      }
    } catch (err) {
      console.warn('Could not fetch performance context:', err);
    }
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !currentCompanyId) {
      showNotification('error', 'Please select an employee');
      return;
    }

    const numericTarget = parseFloat(targetAmount);
    if (isNaN(numericTarget) || numericTarget < 0) {
      showNotification('error', 'Please enter a valid target amount (greater than or equal to 0)');
      return;
    }

    const numericRate = parseFloat(incentiveRate) || 0;
    const periodVal = targetPeriod === 'Monthly' ? targetMonth : 0;

    setSaving(true);
    try {
      const payload = {
        company_id: currentCompanyId,
        employee_id: selectedEmployeeId,
        target_period: targetPeriod,
        target_year: targetYear,
        target_period_val: periodVal,
        target_amount: numericTarget,
        incentive_rate: numericRate,
        achieved_amount: employeePerformanceContext.actualAchievement // mirror actual verified achievement into record
      };

      // Upsert using unique constraint (company_id, employee_id, target_period, target_year, target_period_val)
      const { error: upsertError } = await supabase
        .from('employee_targets')
        .upsert([payload], {
          onConflict: 'company_id, employee_id, target_period, target_year, target_period_val'
        });

      if (upsertError) throw upsertError;

      showNotification('success', 'Target successfully saved and updated in system records!');
      await loadInitialData();
      if (onTargetSaved) onTargetSaved();
    } catch (err: any) {
      console.error('Error saving target:', err);
      showNotification('error', err.message || 'Failed to save target record');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTarget = async (targetId: string) => {
    if (!confirm('Are you sure you want to remove this assigned target record?')) return;
    try {
      const { error } = await supabase.from('employee_targets').delete().eq('id', targetId);
      if (error) throw error;
      showNotification('success', 'Target record deleted');
      await loadInitialData();
      if (onTargetSaved) onTargetSaved();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete target');
    }
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  const formatQAR = (val: number | string | undefined | null) => {
    const num = Number(val) || 0;
    return `QAR ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredTargetsList = targetsList.filter(t => {
    const empName = t.employee?.name || '';
    const empCode = t.employee?.employee_code || '';
    return (
      empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      empCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Target Management Form
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Assign and manage formal performance targets and incentive rates for employees.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadInitialData}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`p-3 px-6 text-xs font-bold flex items-center gap-2 border-b ${
              notification.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        <div className="p-6 md:p-8 overflow-y-auto space-y-8 flex-1">
          {/* Section 1: Target Assignment Form */}
          <form onSubmit={handleSaveTarget} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Select Employee *
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={e => setSelectedEmployeeId(e.target.value)}
                  required
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="" disabled>
                    -- Choose an Employee --
                  </option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_code}) - {emp.designation || 'Staff'}
                    </option>
                  ))}
                </select>

                {selectedEmployee && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 text-[11px] text-slate-500">
                    <span>Department: <strong>{selectedEmployee.department || 'General'}</strong></span>
                    <span className="mx-2">•</span>
                    <span>Role: <strong>{selectedEmployee.designation || 'Staff'}</strong></span>
                  </div>
                )}
              </div>

              {/* Target Period & Year/Month */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                  Target Period & Cycle *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={targetPeriod}
                    onChange={e => setTargetPeriod(e.target.value as any)}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>

                  <select
                    value={targetYear}
                    onChange={e => setTargetYear(Number(e.target.value))}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                    <option value={2024}>2024</option>
                  </select>

                  {targetPeriod === 'Monthly' && (
                    <select
                      value={targetMonth}
                      onChange={e => setTargetMonth(Number(e.target.value))}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {months.map(m => (
                        <option key={m.val} value={m.val}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Target Amount & Incentive Rate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Target Amount (QAR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    QAR
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 500000.00"
                    value={targetAmount}
                    onChange={e => setTargetAmount(e.target.value)}
                    required
                    className="w-full pl-14 pr-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Incentive / Commission Rate (%) *
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    %
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="e.g. 2.5"
                    value={incentiveRate}
                    onChange={e => setIncentiveRate(e.target.value)}
                    required
                    className="w-full pl-4 pr-10 py-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Live Operational Context Box (Read-only, grounded in actual DB transactions) */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-2">
                Live Performance Context (Actual Records from Database)
              </span>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Actual Achievement</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {formatQAR(employeePerformanceContext.actualAchievement)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Work Orders</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {employeePerformanceContext.workOrdersCount} Orders
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Won Opportunities</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {employeePerformanceContext.wonOpportunitiesCount} Deals
                  </span>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Assigned Target'}</span>
              </button>
            </div>
          </form>

          {/* Section 2: Table of Existing Assigned Targets */}
          <div className="pt-6 border-t border-slate-100 dark:border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Existing Assigned Targets ({targetsList.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Historical and active targets assigned across company staff.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter targets..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-zinc-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-100 dark:border-zinc-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3 text-right">Target (QAR)</th>
                    <th className="py-2.5 px-3 text-right">Incentive Rate</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
                  {filteredTargetsList.length > 0 ? (
                    filteredTargetsList.map(t => {
                      const periodLabel =
                        t.target_period === 'Monthly'
                          ? `${months[(t.target_period_val || 1) - 1]?.name || ''} ${t.target_year}`
                          : `FY ${t.target_year}`;

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                            {t.employee?.name || 'Unknown'}
                            <span className="text-[10px] text-slate-400 font-normal ml-1">
                              ({t.employee?.employee_code || '-'})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 font-semibold">
                            {periodLabel}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                            {formatQAR(t.target_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 dark:text-zinc-300 font-bold">
                            {t.incentive_rate || 0}%
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEmployeeId(t.employee_id);
                                  setTargetPeriod(t.target_period);
                                  setTargetYear(t.target_year);
                                  if (t.target_period === 'Monthly') {
                                    setTargetMonth(t.target_period_val || 1);
                                  }
                                  setTargetAmount(String(t.target_amount || ''));
                                  setIncentiveRate(String(t.incentive_rate || '2.5'));
                                }}
                                className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                title="Edit target in form"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTarget(t.id)}
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Delete target record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No target records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
