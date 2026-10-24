import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchEmployeeTargetAchievementData,
  TargetAchievementRecord,
  AchievementSummary
} from '../../lib/targetAchievementService';
import {
  FileText,
  Calendar,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  TrendingUp,
  Target,
  Award,
  DollarSign,
  Briefcase,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowUpRight,
  X,
  Plus
} from 'lucide-react';
import { TargetManagement } from '../performance/TargetManagement';

interface EmployeeTargetIncentiveReportProps {
  companyId?: string;
  onOpenTargetManagement?: (empId?: string) => void;
}

export const EmployeeTargetIncentiveReport: React.FC<EmployeeTargetIncentiveReportProps> = ({
  companyId: propCompanyId,
  onOpenTargetManagement
}) => {
  const navigate = useNavigate();
  const { currentCompanyId, hasPermission } = useAuth();
  const companyId = propCompanyId || currentCompanyId || '';

  // Period State
  const [period, setPeriod] = useState<'Monthly' | 'Yearly'>('Monthly');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);

  // Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportRows, setReportRows] = useState<TargetAchievementRecord[]>([]);
  const [summary, setSummary] = useState<AchievementSummary | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACHIEVED' | 'ON_TRACK' | 'IN_PROGRESS' | 'BEHIND' | 'NO_TARGET'
  >('ALL');

  // Drilldown Modal State
  const [selectedDrilldownRecord, setSelectedDrilldownRecord] =
    useState<TargetAchievementRecord | null>(null);

  // Target Management Modal State
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [targetModalEmpId, setTargetModalEmpId] = useState<string | undefined>(undefined);

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

  const loadReportData = async (isSilent = false) => {
    if (!companyId) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await fetchEmployeeTargetAchievementData(
        companyId,
        period,
        year,
        period === 'Monthly' ? month : undefined
      );
      setReportRows(data.rows);
      setSummary(data.summary);
    } catch (err) {
      console.error('Error fetching employee target incentive report:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [companyId, period, year, month]);

  const formatQAR = (val: number | string | undefined | null) => {
    if (val === null || val === undefined) return '—';
    const num = Number(val) || 0;
    return `QAR ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    return reportRows.filter(r => {
      const matchesSearch =
        r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.department.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (statusFilter === 'ALL') return true;
      return r.statusBadge === statusFilter;
    });
  }, [reportRows, searchQuery, statusFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Designation',
      'Period',
      'Assigned Target (QAR)',
      'Actual Achievement (QAR)',
      'Achievement Percentage (%)',
      'Incentive Rate (%)',
      'Calculated Incentive (QAR)',
      'Work Orders Value (QAR)',
      'Won Deals Value (QAR)'
    ];

    const periodStr =
      period === 'Monthly' ? `${months[month - 1]?.name} ${year}` : `FY ${year}`;

    const csvRows = filteredRows.map(r => [
      `"${r.employeeCode}"`,
      `"${r.employeeName}"`,
      `"${r.department}"`,
      `"${r.designation}"`,
      `"${periodStr}"`,
      r.targetAmount !== null ? r.targetAmount : '"Not Set"',
      r.actualAchievement,
      r.completionPercentage !== null ? `${r.completionPercentage}%` : '"—"',
      `${r.incentiveRate}%`,
      r.calculatedIncentive,
      r.workOrdersValue,
      r.wonOpportunitiesValue
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Employee_Target_Incentive_Report_${period}_${year}_${period === 'Monthly' ? month : 'Annual'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Target Management Modal */}
      {isTargetModalOpen && (
        <TargetManagement
          isOpen={isTargetModalOpen}
          onClose={() => setIsTargetModalOpen(false)}
          preSelectedEmployeeId={targetModalEmpId}
          onTargetSaved={() => loadReportData(true)}
        />
      )}

      {/* Report Controls Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Award className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Employee vs Target vs Incentive Report
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Consolidated operational report grounded strictly in live database transactions and assigned targets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Period Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl border border-slate-200 dark:border-zinc-700">
            <button
              onClick={() => setPeriod('Monthly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === 'Monthly'
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400'
              }`}
            >
              Monthly View
            </button>
            <button
              onClick={() => setPeriod('Yearly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === 'Yearly'
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400'
              }`}
            >
              Yearly View
            </button>
          </div>

          {/* Month Selector */}
          {period === 'Monthly' && (
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer shadow-sm"
            >
              {months.map(m => (
                <option key={m.val} value={m.val}>
                  {m.name}
                </option>
              ))}
            </select>
          )}

          {/* Year Selector */}
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer shadow-sm"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
          </select>

          {/* Actions */}
          <button
            onClick={() => {
              setTargetModalEmpId(undefined);
              setIsTargetModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
            title="Open Target Management Form"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Target Management</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="p-2 rounded-2xl bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 transition-all shadow-sm"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => loadReportData(true)}
            disabled={refreshing}
            className="p-2 rounded-2xl bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 transition-all shadow-sm"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Total Assigned Target
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {formatQAR(summary.totalTarget)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              {summary.employeesWithTargetCount} of {summary.totalActiveEmployeesCount} employees assigned
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Actual Achievement (Live DB)
            </span>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {formatQAR(summary.totalActualAchievement)}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
              <span>WO: {formatQAR(summary.totalWorkOrdersDeliveredValue)}</span>
              <span>•</span>
              <span>Won: {formatQAR(summary.totalWonDealsValue)}</span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Overall Achievement Rate
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {summary.overallCompletionPercentage !== null
                ? `${summary.overallCompletionPercentage}%`
                : '—'}
            </h3>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{
                  width: `${Math.min(summary.overallCompletionPercentage || 0, 100)}%`
                }}
              />
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Total Calculated Incentive
            </span>
            <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {formatQAR(summary.totalCalculatedIncentive)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Calculated dynamically from verified transactions
            </p>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
        {/* Table Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff, code, role..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACHIEVED">🏆 Achieved (&ge;100%)</option>
              <option value="ON_TRACK">⚡ On Track (75-99%)</option>
              <option value="IN_PROGRESS">⏳ In Progress (50-74%)</option>
              <option value="BEHIND">⚠️ Behind (&lt;50%)</option>
              <option value="NO_TARGET">No Target Set</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-zinc-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department & Role</th>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4 text-right">Assigned Target</th>
                <th className="py-3 px-4 text-right">Actual Achievement</th>
                <th className="py-3 px-4 text-center">Achievement %</th>
                <th className="py-3 px-4 text-right">Calculated Incentive</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
              {filteredRows.length > 0 ? (
                filteredRows.map(row => {
                  const periodLabel =
                    period === 'Monthly'
                      ? `${months[(row.month || 1) - 1]?.name} ${row.year}`
                      : `FY ${row.year}`;

                  let badgeClass = 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400';
                  let badgeText = 'No Target';
                  if (row.hasTargetAssigned && row.completionPercentage !== null) {
                    if (row.completionPercentage >= 100) {
                      badgeClass =
                        'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
                      badgeText = '🏆 Achieved';
                    } else if (row.completionPercentage >= 75) {
                      badgeClass =
                        'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
                      badgeText = '⚡ On Track';
                    } else if (row.completionPercentage >= 50) {
                      badgeClass =
                        'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
                      badgeText = '⏳ In Progress';
                    } else {
                      badgeClass =
                        'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800';
                      badgeText = '⚠️ Behind';
                    }
                  }

                  return (
                    <tr
                      key={row.employeeId}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Employee Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                            {row.employeeName.substring(0, 2)}
                          </div>
                          <div>
                            <button
                              onClick={() => navigate(`/employees?id=${row.employeeId}`)}
                              className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline text-left block"
                              title="Open Employee Profile"
                            >
                              {row.employeeName}
                            </button>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {row.employeeCode}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department & Designation */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                        <p className="font-semibold">{row.designation}</p>
                        <span className="text-[10px] text-slate-400">{row.department}</span>
                      </td>

                      {/* Period */}
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {periodLabel}
                      </td>

                      {/* Assigned Target */}
                      <td className="py-3.5 px-4 text-right">
                        {row.hasTargetAssigned ? (
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {formatQAR(row.targetAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not Assigned</span>
                        )}
                      </td>

                      {/* Actual Achievement (Clickable Drilldown) */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedDrilldownRecord(row)}
                          className="group inline-flex items-center gap-1.5 font-black text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Click to view underlying transactions"
                        >
                          <span>{formatQAR(row.actualAchievement)}</span>
                          {(row.workOrdersCount > 0 || row.wonOpportunitiesCount > 0) && (
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                          )}
                        </button>
                        <div className="text-[10px] text-slate-400">
                          {row.workOrdersCount} WOs • {row.wonOpportunitiesCount} Won Deals
                        </div>
                      </td>

                      {/* Achievement % */}
                      <td className="py-3.5 px-4 text-center">
                        {row.completionPercentage !== null ? (
                          <div className="flex flex-col items-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${badgeClass}`}>
                              {badgeText} ({row.completionPercentage}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>

                      {/* Calculated Incentive */}
                      <td className="py-3.5 px-4 text-right">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {formatQAR(row.calculatedIncentive)}
                        </p>
                        {row.incentiveRate > 0 && (
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {row.incentiveRate}% Rate
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setTargetModalEmpId(row.employeeId);
                              setIsTargetModalOpen(true);
                            }}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-indigo-950/40 text-slate-600 hover:text-indigo-600 dark:text-zinc-300 transition-all text-xs font-bold"
                            title="Set or Edit Target"
                          >
                            <Target className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedDrilldownRecord(row)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-all text-xs font-bold"
                            title="View Transaction Drilldown"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No employee records match the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drilldown Modal: Real Underlying Transactions */}
      {selectedDrilldownRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 md:p-8 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">
                  Transaction Audit & Drilldown
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {selectedDrilldownRecord.employeeName}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedDrilldownRecord.designation} • {selectedDrilldownRecord.department}
                </p>
              </div>

              <button
                onClick={() => setSelectedDrilldownRecord(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-6 overflow-y-auto flex-1">
              {/* Summary Pill */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Achievement</span>
                  <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {formatQAR(selectedDrilldownRecord.actualAchievement)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Work Orders</span>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatQAR(selectedDrilldownRecord.workOrdersValue)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Won Opportunities</span>
                  <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {formatQAR(selectedDrilldownRecord.wonOpportunitiesValue)}
                  </p>
                </div>
              </div>

              {/* Work Orders List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-500" />
                  Customer Work Orders ({selectedDrilldownRecord.underlyingWorkOrders.length})
                </h4>

                {selectedDrilldownRecord.underlyingWorkOrders.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDrilldownRecord.underlyingWorkOrders.map((wo: any) => (
                      <div
                        key={wo.id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-zinc-800/80 border border-slate-100 dark:border-zinc-700 flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                              {wo.wo_number}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                wo.status === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-amber-50 text-amber-600'
                              }`}
                            >
                              {wo.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 line-clamp-1">
                            {wo.description || wo.contract_ref}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            Client: {wo.customer?.name || 'Direct'} • Date: {wo.issue_date || wo.start_date}
                          </span>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="font-black text-xs text-slate-900 dark:text-white">
                            {formatQAR(wo.amountQAR)}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedDrilldownRecord(null);
                              navigate('/crm');
                            }}
                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mt-1 justify-end"
                          >
                            Open in CRM <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No work orders recorded for this period.</p>
                )}
              </div>

              {/* Won Opportunities List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Won Opportunities ({selectedDrilldownRecord.underlyingOpportunities.length})
                </h4>

                {selectedDrilldownRecord.underlyingOpportunities.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDrilldownRecord.underlyingOpportunities.map((opp: any) => (
                      <div
                        key={opp.id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-zinc-800/80 border border-slate-100 dark:border-zinc-700 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="font-bold text-xs text-slate-900 dark:text-white">
                            {opp.title}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            Client: {opp.customer?.name || 'Direct'} • Won Date:{' '}
                            {opp.expected_closing_date || opp.created_at?.split('T')[0]}
                          </span>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="font-black text-xs text-slate-900 dark:text-white">
                            {formatQAR(opp.amountQAR)}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedDrilldownRecord(null);
                              navigate('/crm');
                            }}
                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mt-1 justify-end"
                          >
                            Open in CRM <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No won deals recorded for this period.</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedDrilldownRecord(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
