import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import {
    Clock, Calendar, Download, Search, Loader2, ChevronRight, ChevronDown,
    Printer, Filter, RefreshCw, Users, AlertCircle, CheckCircle2,
    XCircle, Award, FileSpreadsheet, Building2, DollarSign, ShieldAlert
} from 'lucide-react';
import { utils, write } from 'xlsx';

export const OvertimeReport: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [loading, setLoading] = useState(true);

    // Filters
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}-01`;
    });
    const [endDate, setEndDate] = useState(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const lastDay = new Date(y, m, 0).getDate();
        return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState<string>('');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [selectedOtType, setSelectedOtType] = useState<string>('ALL');

    // Master Data
    const [departments, setDepartments] = useState<any[]>([]);
    const [reportData, setReportData] = useState<any>(null);

    useEffect(() => {
        if (currentCompanyId) {
            fetchDepartments();
        }
    }, [currentCompanyId]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchReport();
        }
    }, [currentCompanyId, startDate, endDate, selectedDept, selectedStatus]);

    const fetchDepartments = async () => {
        const { data } = await supabase.from('departments').select('id, name').eq('company_id', currentCompanyId).order('name');
        setDepartments(data || []);
    };

    const fetchReport = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            const { data, error } = await (supabase as any).rpc('rpc_get_overtime_report', {
                p_company_id: currentCompanyId,
                p_start_date: startDate,
                p_end_date: endDate,
                p_employee_id: null,
                p_department_id: selectedDept ? Number(selectedDept) : null,
                p_approval_status: selectedStatus || null
            });

            if (error) throw error;
            setReportData(data);
        } catch (err: any) {
            console.error('Error fetching Overtime Report:', err);
            alert('Failed to load Overtime Report: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Filtered Records
    const filteredRecords = useMemo(() => {
        if (!reportData?.records) return [];
        return reportData.records.filter((r: any) => {
            const matchesSearch = !searchTerm ||
                r.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.department_name?.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;
            if (selectedOtType !== 'ALL' && r.ot_type !== selectedOtType) return false;
            return true;
        });
    }, [reportData, searchTerm, selectedOtType]);

    // Format Currency
    const formatQar = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR' }).format(amount || 0);
    };

    // Export Excel
    const handleExportExcel = () => {
        if (!filteredRecords.length) return alert('No overtime records to export.');

        // Main Overtime Sheet
        const rows = filteredRecords.map((r: any) => ({
            'Employee Code': r.employee_code || '—',
            'Employee Name': r.employee_name || '—',
            'Department': r.department_name || '—',
            'Date': r.date,
            'Shift': r.shift_name || 'Standard',
            'Scheduled Start': r.scheduled_start || '08:00',
            'Scheduled End': r.scheduled_end || '16:00',
            'Check In': r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
            'Check Out': r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
            'Total Worked Hours': Number(r.total_worked_hours || 0).toFixed(1),
            'Regular Hours': r.regular_hours || 8,
            'Raw OT Hours': Number(r.raw_ot_hours || 0).toFixed(1),
            'Eligible OT Hours': Number(r.eligible_ot_hours || 0).toFixed(1),
            'OT Type': r.ot_type || 'Regular Day OT',
            'Multiplier': `${r.multiplier || 1.5}x`,
            'Estimated OT Amount (QAR)': r.estimated_ot_amount || 0,
            'Approval Status': r.final_approval_status || 'Approved',
            'Approver': r.approver_name || '—',
            'Approved At': r.approved_at ? new Date(r.approved_at).toLocaleDateString() : '—',
            'Remarks': r.ot_reason || '—'
        }));

        // Department Summary Sheet
        const deptRows = (reportData?.department_summary || []).map((d: any) => ({
            'Department': d.department,
            'Employees with OT': d.employees_count,
            'OT Days': d.ot_days,
            'Total OT Hours': d.total_ot_hours,
            'Approved OT Hours': d.approved_ot_hours,
            'Total OT Cost (QAR)': d.total_ot_cost
        }));

        const wb = utils.book_new();
        const wsMain = utils.json_to_sheet(rows);
        const wsDept = utils.json_to_sheet(deptRows);

        utils.book_append_sheet(wb, wsMain, 'Overtime Details');
        utils.book_append_sheet(wb, wsDept, 'Department Summary');

        const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Overtime_Report_${startDate}_to_${endDate}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 animate-page-enter">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Clock className="w-6 h-6 text-amber-500" />
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Overtime Report</h2>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Employee-wise & date-wise overtime statements calculated with company multipliers (1.5x/2.0x), daily caps, and approval workflows.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 p-1.5 rounded-xl border border-slate-200 dark:border-zinc-700">
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none px-2"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none px-2"
                        />
                    </div>

                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="p-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 rounded-xl transition-all font-bold text-sm"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                        onClick={handleExportExcel}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                    >
                        <FileSpreadsheet className="w-4 h-4" /> Export Excel
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                    >
                        <Printer className="w-4 h-4" /> Print
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search employee / code / dept..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                </div>

                <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none"
                >
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>

                <select
                    value={selectedOtType}
                    onChange={(e) => setSelectedOtType(e.target.value)}
                    className="p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none"
                >
                    <option value="ALL">All OT Types</option>
                    <option value="Regular Day OT">Regular Day OT (1.5x)</option>
                    <option value="Weekend OT">Weekend OT (2.0x)</option>
                    <option value="Holiday OT">Holiday OT (2.0x)</option>
                </select>

                <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none"
                >
                    <option value="">All Approval Statuses</option>
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Not Required">Not Required</option>
                </select>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">OT Staff</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                        {reportData?.summary?.total_employees || 0}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{reportData?.summary?.total_ot_days || 0} OT shifts</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Total OT Hours</p>
                    <h3 className="text-2xl font-black text-amber-500 mt-1">
                        {reportData?.summary?.total_ot_hours || 0} hrs
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Eligible capped OT</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Approved OT</p>
                    <h3 className="text-2xl font-black text-emerald-600 mt-1">
                        {reportData?.summary?.approved_ot_hours || 0} hrs
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Ready for payroll</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending OT</p>
                    <h3 className="text-2xl font-black text-amber-600 mt-1">
                        {reportData?.summary?.pending_ot_hours || 0} hrs
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Awaiting manager approval</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Rejected OT</p>
                    <h3 className="text-2xl font-black text-rose-600 mt-1">
                        {reportData?.summary?.rejected_ot_hours || 0} hrs
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Declined requests</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Est. OT Cost</p>
                    <h3 className="text-2xl font-black text-indigo-600 mt-1">
                        {formatQar(reportData?.summary?.total_estimated_cost || 0)}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Salary-linked estimate</p>
                </div>
            </div>

            {/* Department Summary Table (Collapsible) */}
            {reportData?.department_summary && reportData.department_summary.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm space-y-3">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-500" /> Department-Level Overtime Summary
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-zinc-700">
                                    <th className="p-2.5">Department</th>
                                    <th className="p-2.5 text-center">Employees with OT</th>
                                    <th className="p-2.5 text-center">OT Days</th>
                                    <th className="p-2.5 text-center">Total OT Hours</th>
                                    <th className="p-2.5 text-center text-emerald-600">Approved OT Hours</th>
                                    <th className="p-2.5 text-right font-black">Estimated Cost (QAR)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {reportData.department_summary.map((d: any) => (
                                    <tr key={d.department} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{d.department}</td>
                                        <td className="p-2.5 text-center font-medium">{d.employees_count}</td>
                                        <td className="p-2.5 text-center font-medium">{d.ot_days}</td>
                                        <td className="p-2.5 text-center font-bold text-amber-500">{d.total_ot_hours}h</td>
                                        <td className="p-2.5 text-center font-bold text-emerald-600">{d.approved_ot_hours}h</td>
                                        <td className="p-2.5 text-right font-black text-slate-900 dark:text-white">{formatQar(d.total_ot_cost)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detailed Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Showing {filteredRecords.length} Overtime Records
                    </span>
                    <span className="text-xs text-slate-400">
                        Cap: Max {reportData?.rules?.max_daily_cap || 4.0}h/day • Standard: {reportData?.rules?.standard_multiplier || 1.5}x • Weekend/Holiday: {reportData?.rules?.weekend_multiplier || 2.0}x
                    </span>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
                        <p className="text-sm font-bold text-slate-500">Calculating overtime statement...</p>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 font-semibold">
                        No overtime hours recorded for the selected date range and filters.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100/70 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-zinc-700">
                                    <th className="p-3">Employee</th>
                                    <th className="p-3">Department</th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Shift & Hours</th>
                                    <th className="p-3 font-mono">Actual In / Out</th>
                                    <th className="p-3 text-center">Worked</th>
                                    <th className="p-3 text-center">Raw OT</th>
                                    <th className="p-3 text-center text-amber-500 font-black">Eligible OT</th>
                                    <th className="p-3">OT Type</th>
                                    <th className="p-3 text-right">Est. Pay</th>
                                    <th className="p-3 text-center">Approval Status</th>
                                    <th className="p-3">Approver / Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {filteredRecords.map((r: any) => (
                                    <tr key={r.id || `${r.employee_id}_${r.date}`} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                        <td className="p-3">
                                            <div className="font-bold text-slate-900 dark:text-white">{r.employee_name}</div>
                                            <div className="text-[11px] text-slate-400 font-mono">{r.employee_code}</div>
                                        </td>
                                        <td className="p-3 font-medium text-slate-600 dark:text-slate-300">{r.department_name}</td>
                                        <td className="p-3 font-bold whitespace-nowrap">
                                            {r.date} <span className="text-[10px] text-slate-400 font-normal">({new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' })})</span>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-medium text-slate-800 dark:text-slate-200">{r.shift_name || 'Standard'}</div>
                                            <div className="text-[11px] text-slate-400 font-mono">
                                                {r.scheduled_start ? `${r.scheduled_start.slice(0, 5)} - ${r.scheduled_end.slice(0, 5)}` : '08:00 - 16:00'}
                                            </div>
                                        </td>
                                        <td className="p-3 font-mono text-[11px]">
                                            <div>In: <strong className="text-slate-800 dark:text-slate-200">{r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
                                            <div>Out: <strong className="text-slate-800 dark:text-slate-200">{r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
                                        </td>
                                        <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">{Number(r.total_worked_hours || 0).toFixed(1)}h</td>
                                        <td className="p-3 text-center font-semibold text-slate-500">{Number(r.raw_ot_hours || 0).toFixed(1)}h</td>
                                        <td className="p-3 text-center font-black text-amber-500 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg">
                                            {Number(r.eligible_ot_hours || 0).toFixed(1)}h
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                r.ot_type === 'Holiday OT' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30' :
                                                r.ot_type === 'Weekend OT' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/30' :
                                                'bg-amber-50 text-amber-600 dark:bg-amber-950/30'
                                            }`}>
                                                {r.ot_type} ({r.multiplier}x)
                                            </span>
                                        </td>
                                        <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                                            {formatQar(r.estimated_ot_amount)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                                r.final_approval_status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20' :
                                                r.final_approval_status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20' :
                                                r.final_approval_status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20' :
                                                'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800'
                                            }`}>
                                                {r.final_approval_status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-500 text-[11px]">
                                            <div>{r.approver_name || '—'}</div>
                                            {r.ot_reason && <div className="text-[10px] text-slate-400 italic truncate max-w-[140px]">{r.ot_reason}</div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
