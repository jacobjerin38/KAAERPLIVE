import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import {
    AlertTriangle, Calendar, Download, Search, Loader2, ChevronRight,
    Printer, Filter, RefreshCw, Users, Clock, ArrowDownRight, ArrowUpRight,
    FileSpreadsheet, Building2, SlidersHorizontal, ArrowUpDown
} from 'lucide-react';
import { utils, write } from 'xlsx';

export const LateEarlyReport: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [loading, setLoading] = useState(true);

    // Date Range
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

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState<string>('');
    const [minLateMinutes, setMinLateMinutes] = useState<number>(0);
    const [minEarlyMinutes, setMinEarlyMinutes] = useState<number>(0);
    const [modeToggle, setModeToggle] = useState<'BOTH' | 'LATE_ONLY' | 'EARLY_ONLY'>('BOTH');
    const [summarySortBy, setSummarySortBy] = useState<'LATE_MINS' | 'EARLY_MINS' | 'LATE_OCCUR' | 'NAME'>('LATE_MINS');

    // Data State
    const [departments, setDepartments] = useState<any[]>([]);
    const [reportData, setReportData] = useState<any>(null);

    useEffect(() => {
        if (currentCompanyId) fetchDepartments();
    }, [currentCompanyId]);

    useEffect(() => {
        if (currentCompanyId) fetchReport();
    }, [currentCompanyId, startDate, endDate, selectedDept, minLateMinutes, minEarlyMinutes]);

    const fetchDepartments = async () => {
        const { data } = await supabase.from('departments').select('id, name').eq('company_id', currentCompanyId).order('name');
        setDepartments(data || []);
    };

    const fetchReport = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            const { data, error } = await (supabase as any).rpc('rpc_get_late_early_report', {
                p_company_id: currentCompanyId,
                p_start_date: startDate,
                p_end_date: endDate,
                p_employee_id: null,
                p_department_id: selectedDept ? Number(selectedDept) : null,
                p_min_late_minutes: minLateMinutes || 0,
                p_min_early_minutes: minEarlyMinutes || 0
            });

            if (error) throw error;
            setReportData(data);
        } catch (err: any) {
            console.error('Error fetching Late/Early Report:', err);
            alert('Failed to load Late In / Early Out Report: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Filtered Incidents
    const filteredRecords = useMemo(() => {
        if (!reportData?.records) return [];
        return reportData.records.filter((r: any) => {
            const matchesSearch = !searchTerm ||
                r.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.department_name?.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            const hasLate = (r.computed_late_minutes || 0) > 0;
            const hasEarly = (r.computed_early_minutes || 0) > 0;

            if (modeToggle === 'LATE_ONLY') return hasLate;
            if (modeToggle === 'EARLY_ONLY') return hasEarly;
            return hasLate || hasEarly;
        });
    }, [reportData, searchTerm, modeToggle]);

    // Sorted Employee Summary
    const sortedEmployeeSummary = useMemo(() => {
        if (!reportData?.employee_summary) return [];
        const list = [...reportData.employee_summary].filter((es: any) => {
            if (!searchTerm) return true;
            return es.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                es.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                es.department_name?.toLowerCase().includes(searchTerm.toLowerCase());
        });

        if (summarySortBy === 'LATE_MINS') {
            return list.sort((a, b) => (b.total_late_minutes || 0) - (a.total_late_minutes || 0));
        }
        if (summarySortBy === 'EARLY_MINS') {
            return list.sort((a, b) => (b.total_early_minutes || 0) - (a.total_early_minutes || 0));
        }
        if (summarySortBy === 'LATE_OCCUR') {
            return list.sort((a, b) => (b.late_occurrences || 0) - (a.late_occurrences || 0));
        }
        return list.sort((a, b) => (a.employee_name || '').localeCompare(b.employee_name || ''));
    }, [reportData, searchTerm, summarySortBy]);

    // Export Excel
    const handleExportExcel = () => {
        if (!filteredRecords.length) return alert('No incident records to export.');

        // Detailed Incidents Sheet
        const rows = filteredRecords.map((r: any) => ({
            'Employee Code': r.employee_code || '—',
            'Employee Name': r.employee_name || '—',
            'Department': r.department_name || '—',
            'Date': r.date,
            'Shift': r.shift_name || 'Standard',
            'Scheduled Start': r.scheduled_start || '08:00',
            'Scheduled End': r.scheduled_end || '16:00',
            'Grace Period (mins)': r.effective_grace_late || 15,
            'Actual Check In': r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
            'Actual Check Out': r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
            'Late Minutes': r.computed_late_minutes || 0,
            'Early Out Minutes': r.computed_early_minutes || 0,
            'Worked Hours': Number(r.total_worked_hours || 0).toFixed(1),
            'Status': r.status || 'Present',
            'Punch Source': r.punch_source || 'MANUAL',
            'Remarks': r.edit_reason || '—'
        }));

        // Employee Summary Sheet
        const summaryRows = sortedEmployeeSummary.map((es: any) => ({
            'Employee Code': es.employee_code || '—',
            'Employee Name': es.employee_name || '—',
            'Department': es.department_name || '—',
            'Late Occurrences': es.late_occurrences || 0,
            'Total Late Minutes': es.total_late_minutes || 0,
            'Early Out Occurrences': es.early_occurrences || 0,
            'Total Early Out Minutes': es.total_early_minutes || 0
        }));

        const wb = utils.book_new();
        const wsIncidents = utils.json_to_sheet(rows);
        const wsSummary = utils.json_to_sheet(summaryRows);

        utils.book_append_sheet(wb, wsSummary, 'Punctuality Summary');
        utils.book_append_sheet(wb, wsIncidents, 'Daily Incidents');

        const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Late_Early_Report_${startDate}_to_${endDate}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 animate-page-enter">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6 text-rose-600" />
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Late In / Early Out Report</h2>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Punctuality tracking analyzing scheduled shift timings, configured grace periods, and actual punch timestamps.
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
            <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search employee / code / dept..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500/20"
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

                {/* Mode Toggle */}
                <div className="flex bg-slate-200/80 dark:bg-zinc-800 p-1 rounded-xl">
                    <button
                        onClick={() => setModeToggle('BOTH')}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${modeToggle === 'BOTH' ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setModeToggle('LATE_ONLY')}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${modeToggle === 'LATE_ONLY' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500'}`}
                    >
                        Late In
                    </button>
                    <button
                        onClick={() => setModeToggle('EARLY_ONLY')}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${modeToggle === 'EARLY_ONLY' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500'}`}
                    >
                        Early Out
                    </button>
                </div>

                {/* Min Late Filter */}
                <select
                    value={minLateMinutes}
                    onChange={(e) => setMinLateMinutes(Number(e.target.value))}
                    className="p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none"
                >
                    <option value={0}>Late: Any Duration</option>
                    <option value={10}>Late: &gt;= 10 mins</option>
                    <option value={15}>Late: &gt;= 15 mins</option>
                    <option value={30}>Late: &gt;= 30 mins</option>
                    <option value={60}>Late: &gt;= 1 hour</option>
                </select>

                {/* Min Early Filter */}
                <select
                    value={minEarlyMinutes}
                    onChange={(e) => setMinEarlyMinutes(Number(e.target.value))}
                    className="p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none"
                >
                    <option value={0}>Early Out: Any Duration</option>
                    <option value={10}>Early Out: &gt;= 10 mins</option>
                    <option value={15}>Early Out: &gt;= 15 mins</option>
                    <option value={30}>Early Out: &gt;= 30 mins</option>
                    <option value={60}>Early Out: &gt;= 1 hour</option>
                </select>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Late Staff</p>
                    <h3 className="text-xl font-black text-rose-600 mt-1">{reportData?.summary?.total_late_employees || 0}</h3>
                    <p className="text-[10px] text-slate-500">Employees</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Late Occurrences</p>
                    <h3 className="text-xl font-black text-rose-600 mt-1">{reportData?.summary?.total_late_occurrences || 0}</h3>
                    <p className="text-[10px] text-slate-500">Incidents</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Total Late Mins</p>
                    <h3 className="text-xl font-black text-rose-600 mt-1">{reportData?.summary?.total_late_minutes || 0} m</h3>
                    <p className="text-[10px] text-slate-500">Lost time</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Avg Late / Incident</p>
                    <h3 className="text-xl font-black text-rose-600 mt-1">{reportData?.summary?.avg_late_minutes || 0} m</h3>
                    <p className="text-[10px] text-slate-500">Per occurrence</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Early Out Staff</p>
                    <h3 className="text-xl font-black text-amber-600 mt-1">{reportData?.summary?.total_early_employees || 0}</h3>
                    <p className="text-[10px] text-slate-500">Employees</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Early Occurrences</p>
                    <h3 className="text-xl font-black text-amber-600 mt-1">{reportData?.summary?.total_early_occurrences || 0}</h3>
                    <p className="text-[10px] text-slate-500">Incidents</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Total Early Mins</p>
                    <h3 className="text-xl font-black text-amber-600 mt-1">{reportData?.summary?.total_early_minutes || 0} m</h3>
                    <p className="text-[10px] text-slate-500">Lost time</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Avg Early / Incident</p>
                    <h3 className="text-xl font-black text-amber-600 mt-1">{reportData?.summary?.avg_early_minutes || 0} m</h3>
                    <p className="text-[10px] text-slate-500">Per occurrence</p>
                </div>
            </div>

            {/* Employee Punctuality Summary (Leaderboard) */}
            {sortedEmployeeSummary.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                            <Users className="w-4 h-4 text-rose-600" /> Employee Punctuality Summary
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Sort by:</span>
                            <select
                                value={summarySortBy}
                                onChange={(e) => setSummarySortBy(e.target.value as any)}
                                className="p-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold"
                            >
                                <option value="LATE_MINS">Highest Late Minutes</option>
                                <option value="EARLY_MINS">Highest Early Minutes</option>
                                <option value="LATE_OCCUR">Most Late Incidents</option>
                                <option value="NAME">Employee Name</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-zinc-700">
                                    <th className="p-2.5">Employee</th>
                                    <th className="p-2.5">Department</th>
                                    <th className="p-2.5 text-center text-rose-600">Late Incidents</th>
                                    <th className="p-2.5 text-center text-rose-600 font-black">Total Late (mins)</th>
                                    <th className="p-2.5 text-center text-amber-600">Early Out Incidents</th>
                                    <th className="p-2.5 text-center text-amber-600 font-black">Total Early Out (mins)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {sortedEmployeeSummary.map((es: any) => (
                                    <tr key={es.employee_id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                                            {es.employee_name} <span className="text-[10px] text-slate-400 font-mono">({es.employee_code})</span>
                                        </td>
                                        <td className="p-2.5 font-medium text-slate-600 dark:text-slate-300">{es.department_name}</td>
                                        <td className="p-2.5 text-center font-bold text-rose-600">{es.late_occurrences || 0}</td>
                                        <td className="p-2.5 text-center font-black text-rose-600 bg-rose-50/50 dark:bg-rose-950/20 rounded-lg">
                                            {es.total_late_minutes || 0}m
                                        </td>
                                        <td className="p-2.5 text-center font-bold text-amber-600">{es.early_occurrences || 0}</td>
                                        <td className="p-2.5 text-center font-black text-amber-600 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg">
                                            {es.total_early_minutes || 0}m
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detailed Incidents Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Showing {filteredRecords.length} Detailed Incident Records
                    </span>
                    <span className="text-xs text-slate-400">
                        Grace Period: Late {reportData?.grace_late || 15}m • Early {reportData?.grace_early || 15}m
                    </span>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-rose-600 animate-spin mb-3" />
                        <p className="text-sm font-bold text-slate-500">Calculating punctuality logs...</p>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 font-semibold">
                        No late arrival or early departure incidents found for this period and filter selection.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100/70 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-zinc-700">
                                    <th className="p-3">Employee</th>
                                    <th className="p-3">Department</th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Shift</th>
                                    <th className="p-3 font-mono">Scheduled</th>
                                    <th className="p-3 font-mono">Actual In / Out</th>
                                    <th className="p-3 text-center text-rose-600 font-black">Late Duration</th>
                                    <th className="p-3 text-center text-amber-600 font-black">Early Departure</th>
                                    <th className="p-3 text-center">Worked Hours</th>
                                    <th className="p-3">Source</th>
                                    <th className="p-3">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {filteredRecords.map((r: any) => {
                                    const isLate = (r.computed_late_minutes || 0) > 0;
                                    const isEarly = (r.computed_early_minutes || 0) > 0;

                                    return (
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
                                                {r.is_overnight && <span className="text-[10px] text-indigo-500 font-bold">Overnight Shift</span>}
                                            </td>
                                            <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                                {r.scheduled_start ? `${r.scheduled_start.slice(0, 5)} - ${r.scheduled_end.slice(0, 5)}` : '08:00 - 16:00'}
                                            </td>
                                            <td className="p-3 font-mono text-[11px]">
                                                <div>In: <strong className="text-slate-800 dark:text-slate-200">{r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
                                                <div>Out: <strong className="text-slate-800 dark:text-slate-200">{r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
                                            </td>
                                            <td className="p-3 text-center">
                                                {isLate ? (
                                                    <span className="px-2 py-1 bg-rose-50 dark:bg-rose-950/30 text-rose-600 font-black rounded-lg text-xs">
                                                        +{r.computed_late_minutes} mins
                                                    </span>
                                                ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                            </td>
                                            <td className="p-3 text-center">
                                                {isEarly ? (
                                                    <span className="px-2 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-600 font-black rounded-lg text-xs">
                                                        -{r.computed_early_minutes} mins
                                                    </span>
                                                ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                            </td>
                                            <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                                {Number(r.total_worked_hours || 0).toFixed(1)}h
                                            </td>
                                            <td className="p-3 font-mono uppercase text-[10px] text-slate-500">{r.punch_source || 'MANUAL'}</td>
                                            <td className="p-3 text-slate-400 italic text-[11px] truncate max-w-[150px]" title={r.edit_reason || ''}>
                                                {r.edit_reason || '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
