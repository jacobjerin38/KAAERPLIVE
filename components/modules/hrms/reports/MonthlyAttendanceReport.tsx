import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import {
    Calendar, Download, Search, Loader2, ChevronRight, ChevronDown,
    Printer, Filter, RefreshCw, Users, Clock, AlertTriangle, CheckCircle2,
    XCircle, Award, FileSpreadsheet, Building2, MapPin, Layers
} from 'lucide-react';
import { utils, write } from 'xlsx';

export const MonthlyAttendanceReport: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState<string>('');
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [selectedShift, setSelectedShift] = useState<string>('');
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

    // Master Data for Dropdowns
    const [departments, setDepartments] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);

    // Report Data State
    const [reportData, setReportData] = useState<any>(null);
    const [expandedEmpIds, setExpandedEmpIds] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (currentCompanyId) {
            fetchMasters();
        }
    }, [currentCompanyId]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchReport();
        }
    }, [currentCompanyId, selectedMonth, selectedDept, selectedLocation, selectedShift]);

    const isValidMonthFormat = (val: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(val || '');

    const fetchMasters = async () => {
        try {
            const [deptRes, locRes, shiftRes] = await Promise.all([
                supabase.from('departments').select('id, name').eq('company_id', currentCompanyId).order('name'),
                supabase.from('locations').select('id, name').eq('company_id', currentCompanyId).order('name'),
                supabase.from('org_shift_timings').select('id, name, code').eq('company_id', currentCompanyId).order('name')
            ]);
            setDepartments(deptRes.data || []);
            setLocations(locRes.data || []);
            setShifts(shiftRes.data || []);
        } catch (e) {
            console.error('Error fetching masters:', e);
        }
    };

    const fetchReport = async () => {
        if (!currentCompanyId) return;
        if (!isValidMonthFormat(selectedMonth)) return; // Guard against partial typing like '2026-0'
        setLoading(true);
        try {
            const [yearStr, monthStr] = selectedMonth.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const formattedMonth = String(month).padStart(2, '0');
            const startDate = `${year}-${formattedMonth}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${formattedMonth}-${String(lastDay).padStart(2, '0')}`;

            const { data, error } = await (supabase as any).rpc('rpc_get_monthly_attendance_report', {
                p_company_id: currentCompanyId,
                p_start_date: startDate,
                p_end_date: endDate,
                p_department_id: selectedDept ? Number(selectedDept) : null,
                p_location_id: selectedLocation ? Number(selectedLocation) : null,
                p_employee_id: null,
                p_shift_id: selectedShift ? Number(selectedShift) : null
            });

            if (error) throw error;
            setReportData(data);
        } catch (err: any) {
            console.error('Error loading Monthly Attendance Report:', err);
            if (!err.message?.includes('out of range')) {
                alert('Failed to load Monthly Attendance Report: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const [evaluating, setEvaluating] = useState(false);

    const handleRecalculateShiftRules = async () => {
        if (!currentCompanyId) return;
        if (!isValidMonthFormat(selectedMonth)) {
            alert('Please select a valid month (YYYY-MM) first.');
            return;
        }
        setEvaluating(true);
        try {
            const [yearStr, monthStr] = selectedMonth.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const formattedMonth = String(month).padStart(2, '0');
            const startDate = `${year}-${formattedMonth}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${formattedMonth}-${String(lastDay).padStart(2, '0')}`;

            const { data, error } = await (supabase as any).rpc('rpc_recalculate_attendance_shift_rules', {
                p_company_id: currentCompanyId,
                p_start_date: startDate,
                p_end_date: endDate
            });

            if (error) throw error;
            await fetchReport();
            alert(`Shift Evaluation Completed: ${data?.updated_records || 0} attendance punch records synchronized against shift schedules!`);
        } catch (err: any) {
            console.error('Error recalculating shift rules:', err);
            alert('Failed to evaluate shift rules: ' + err.message);
        } finally {
            setEvaluating(false);
        }
    };

    const toggleExpand = (empId: string) => {
        setExpandedEmpIds(prev => ({ ...prev, [empId]: !prev[empId] }));
    };

    const expandAll = () => {
        if (!reportData?.employees) return;
        const all: Record<string, boolean> = {};
        reportData.employees.forEach((item: any) => {
            all[item.summary.employee_id] = true;
        });
        setExpandedEmpIds(all);
    };

    const collapseAll = () => {
        setExpandedEmpIds({});
    };

    // Filter employees by search & status
    const filteredEmployees = useMemo(() => {
        if (!reportData?.employees) return [];
        return reportData.employees.filter((item: any) => {
            const s = item.summary;
            const matchesSearch = !searchTerm ||
                s.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.department_name?.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;
            if (selectedStatus === 'PERFECT') return s.absent_days === 0 && s.late_days === 0;
            if (selectedStatus === 'HAS_ABSENT') return s.absent_days > 0;
            if (selectedStatus === 'HAS_LATE') return s.late_days > 0;
            if (selectedStatus === 'HAS_OT') return s.ot_days > 0;
            return true;
        });
    }, [reportData, searchTerm, selectedStatus]);

    // KPI Summary Calculations
    const kpiSummary = useMemo(() => {
        const list = filteredEmployees;
        const totalEmployees = list.length;
        const totalPresent = list.reduce((sum, item) => sum + (item.summary.present_days || 0), 0);
        const totalAbsent = list.reduce((sum, item) => sum + (item.summary.absent_days || 0), 0);
        const totalLeave = list.reduce((sum, item) => sum + (item.summary.leave_days || 0), 0);
        const totalHalf = list.reduce((sum, item) => sum + (item.summary.half_days || 0), 0);
        const totalWorkedHours = list.reduce((sum, item) => sum + (Number(item.summary.total_worked_hours) || 0), 0);
        const totalOtHours = list.reduce((sum, item) => sum + (Number(item.summary.total_ot_hours) || 0), 0);
        const totalLop = totalAbsent + (totalHalf * 0.5);

        let daysInMonth = 30;
        if (isValidMonthFormat(selectedMonth)) {
            const [y, m] = selectedMonth.split('-').map(Number);
            daysInMonth = new Date(y, m, 0).getDate();
        }
        const totalPotentialDays = totalEmployees * daysInMonth;
        const avgAttendancePct = totalPotentialDays > 0 ? ((totalPresent + totalLeave) / totalPotentialDays) * 100 : 0;

        return {
            totalEmployees,
            daysInMonth,
            totalPresent,
            totalAbsent,
            totalLeave,
            totalHalf,
            totalLop,
            totalWorkedHours: totalWorkedHours.toFixed(1),
            totalOtHours: totalOtHours.toFixed(1),
            avgAttendancePct: avgAttendancePct.toFixed(1)
        };
    }, [filteredEmployees, selectedMonth]);

    // Export to Excel
    const handleExportExcel = () => {
        if (!filteredEmployees.length) return alert('No data to export.');
        
        // Summary Sheet
        const summaryRows = filteredEmployees.map(item => {
            const s = item.summary;
            const lopDays = (s.absent_days || 0) + ((s.half_days || 0) * 0.5);
            const paidDays = Math.max(0, Number(s.calendar_days || kpiSummary.daysInMonth) - lopDays);
            return {
                'Employee Code': s.employee_code || '—',
                'Employee Name': s.employee_name || '—',
                'Department': s.department_name || '—',
                'Designation': s.designation || '—',
                'Location': s.location_name || '—',
                'Manager': s.manager_name || '—',
                'Calendar Days': s.calendar_days || kpiSummary.daysInMonth,
                'Present Days': s.present_days || 0,
                'Absent Days': s.absent_days || 0,
                'Half Days': s.half_days || 0,
                'Leave Days': s.leave_days || 0,
                'Missing Punch': s.missing_punch_days || 0,
                'Late Days': s.late_days || 0,
                'Early Days': s.early_days || 0,
                'OT Days': s.ot_days || 0,
                'Total OT Hours': s.total_ot_hours || 0,
                'Total Worked Hours': Number(s.total_worked_hours || 0).toFixed(1),
                'Avg Hours/Day': Number(s.avg_worked_hours || 0).toFixed(1),
                'Paid Days': paidDays,
                'LOP Days': lopDays
            };
        });

        // Daily Punches Sheet
        const dailyRows: any[] = [];
        filteredEmployees.forEach(item => {
            const s = item.summary;
            (item.records || []).forEach((r: any) => {
                dailyRows.push({
                    'Employee Code': s.employee_code,
                    'Employee Name': s.employee_name,
                    'Department': s.department_name,
                    'Date': r.date,
                    'Shift': r.shift_name || 'Standard',
                    'Scheduled Start': r.shift_start || '08:00',
                    'Scheduled End': r.shift_end || '16:00',
                    'Check In': r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
                    'Check Out': r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
                    'Total Hours': r.total_hours || 0,
                    'Status': r.status || '—',
                    'Late Minutes': r.late_minutes || 0,
                    'Early Minutes': r.early_minutes || 0,
                    'OT Hours': r.ot_hours || 0,
                    'Source': r.source || 'MANUAL',
                    'Remarks': r.edit_reason || '—'
                });
            });
        });

        const wb = utils.book_new();
        const wsSummary = utils.json_to_sheet(summaryRows);
        const wsDaily = utils.json_to_sheet(dailyRows);

        utils.book_append_sheet(wb, wsSummary, 'Monthly Summary');
        utils.book_append_sheet(wb, wsDaily, 'Daily Punches');

        const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Monthly_Attendance_Report_${selectedMonth}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Print Report
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 animate-page-enter print:space-y-3 print:m-0 print:p-0">
            {/* Embedded Print Stylesheet for Landscape Full A4 Layout */}
            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 8mm 6mm 8mm 6mm;
                    }
                    html, body {
                        background: white !important;
                        color: #0f172a !important;
                        font-size: 8.5pt !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    aside, nav, header, .no-print, button, input, select, svg.lucide-search {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    .overflow-x-auto, .overflow-hidden, .overflow-y-auto {
                        overflow: visible !important;
                        max-height: none !important;
                        height: auto !important;
                    }
                    .rounded-\\[2rem\\], .rounded-2xl, .rounded-xl, .shadow-sm, .shadow-lg {
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 8pt !important;
                        page-break-inside: auto !important;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                        page-break-after: auto !important;
                    }
                    th {
                        background-color: #f1f5f9 !important;
                        color: #1e293b !important;
                        font-weight: 700 !important;
                        font-size: 7.5pt !important;
                        padding: 3px 4px !important;
                        border: 1px solid #cbd5e1 !important;
                    }
                    td {
                        padding: 2.5px 4px !important;
                        border: 1px solid #e2e8f0 !important;
                        color: #0f172a !important;
                        font-size: 8pt !important;
                    }
                    .badge-print {
                        border: 1px solid #cbd5e1 !important;
                        padding: 1px 3px !important;
                    }
                }
            `}</style>

            {/* Print-Only Executive Header */}
            <div className="hidden print:block mb-3 pb-2 border-b-2 border-slate-800">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">KAA ERP — MONTHLY ATTENDANCE STATEMENT</h1>
                        <p className="text-xs font-bold text-slate-600">
                            Statement Period: <span className="font-black text-cyan-800">{selectedMonth}</span> | Generated: {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                    <div className="text-right text-[10px] text-slate-500 font-mono">
                        <div>Filtered Staff: <strong>{filteredEmployees.length} of {reportData?.employees?.length || 0}</strong></div>
                        <div>Dept: <strong>{departments.find(d => String(d.id) === selectedDept)?.name || 'All'}</strong> | Loc: <strong>{locations.find(l => String(l.id) === selectedLocation)?.name || 'All'}</strong></div>
                    </div>
                </div>
            </div>

            {/* Print-Only Compact KPI Summary Bar */}
            <div className="hidden print:grid grid-cols-6 gap-2 mb-2 p-1.5 bg-slate-50 border border-slate-300 rounded text-[9px]">
                <div><span className="text-slate-500">Total Staff:</span> <strong>{kpiSummary.totalEmployees}</strong></div>
                <div><span className="text-slate-500">Present Days:</span> <strong className="text-emerald-700">{kpiSummary.totalPresent}</strong> ({kpiSummary.avgAttendancePct}%)</div>
                <div><span className="text-slate-500">Absent / LOP:</span> <strong className="text-rose-700">{kpiSummary.totalLop}</strong></div>
                <div><span className="text-slate-500">Approved Leaves:</span> <strong className="text-indigo-700">{kpiSummary.totalLeave}</strong></div>
                <div><span className="text-slate-500">Worked Hours:</span> <strong className="text-cyan-800">{kpiSummary.totalWorkedHours}h</strong></div>
                <div><span className="text-slate-500">Overtime Hours:</span> <strong className="text-amber-800">{kpiSummary.totalOtHours}h</strong></div>
            </div>

            {/* Header & Main Controls (Screen Only) */}
            <div className="no-print bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-cyan-600" />
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Monthly Attendance Report</h2>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Comprehensive employee-wise monthly statement with shifts, leaves, working days, and daily punch audit trail.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {/* Month Picker */}
                    <div className="relative">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500/20 outline-none"
                        />
                    </div>

                    <button
                        onClick={handleRecalculateShiftRules}
                        disabled={evaluating || loading}
                        className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
                        title="Recalculate all punches against shift start/end times, grace period, and overtime rules"
                    >
                        <Clock className={`w-4 h-4 ${evaluating ? 'animate-spin' : ''}`} />
                        <span>{evaluating ? 'Evaluating...' : 'Run Shift Evaluation'}</span>
                    </button>

                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="p-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 rounded-xl transition-all font-bold text-sm flex items-center gap-2"
                        title="Refresh Report"
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
                        onClick={handlePrint}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                    >
                        <Printer className="w-4 h-4" /> Print
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="no-print bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search */}
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search employee / code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                </div>

                {/* Department */}
                <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none"
                >
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>

                {/* Location */}
                <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none"
                >
                    <option value="">All Locations</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>

                {/* Shift */}
                <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none"
                >
                    <option value="">All Shifts</option>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>

                {/* Attendance Status Filter */}
                <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none"
                >
                    <option value="ALL">All Statuses</option>
                    <option value="PERFECT">100% Present (Zero Absent/Late)</option>
                    <option value="HAS_ABSENT">With Absent Days</option>
                    <option value="HAS_LATE">With Late Arrivals</option>
                    <option value="HAS_OT">With Overtime</option>
                </select>
            </div>

            {/* KPI Summary Cards (Screen Only) */}
            <div className="no-print grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Staff</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{kpiSummary.totalEmployees}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{kpiSummary.daysInMonth} calendar days</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Present Days</p>
                    <h3 className="text-2xl font-black text-emerald-600 mt-1">{kpiSummary.totalPresent}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Attendance: {kpiSummary.avgAttendancePct}%</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Absent / LOP</p>
                    <h3 className="text-2xl font-black text-rose-600 mt-1">{kpiSummary.totalLop}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{kpiSummary.totalAbsent} full, {kpiSummary.totalHalf} half</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Approved Leaves</p>
                    <h3 className="text-2xl font-black text-indigo-600 mt-1">{kpiSummary.totalLeave}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Paid leave days</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider">Worked Hours</p>
                    <h3 className="text-2xl font-black text-cyan-600 mt-1">{kpiSummary.totalWorkedHours}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Regular hours logged</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Overtime Hours</p>
                    <h3 className="text-2xl font-black text-amber-600 mt-1">{kpiSummary.totalOtHours}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Eligible OT hours</p>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0">
                <div className="no-print p-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/30">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            Showing {filteredEmployees.length} of {reportData?.employees?.length || 0} Employees
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={expandAll}
                            className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"
                        >
                            Expand All Days
                        </button>
                        <button
                            onClick={collapseAll}
                            className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"
                        >
                            Collapse All
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-cyan-600 animate-spin mb-3" />
                        <p className="text-sm font-bold text-slate-500">Calculating monthly attendance statement...</p>
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 font-semibold">
                        No attendance records found for this period and filter selection.
                    </div>
                ) : (
                    <div className="overflow-x-auto print:overflow-visible">
                        <table className="w-full text-left text-xs border-collapse print:text-[8pt]">
                            <thead>
                                <tr className="bg-slate-100/70 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-zinc-700 print:bg-slate-100">
                                    <th className="p-3 w-10 no-print"></th>
                                    <th className="p-3">Employee</th>
                                    <th className="p-3">Department / Role</th>
                                    <th className="p-3 text-center">Calendar</th>
                                    <th className="p-3 text-center text-emerald-600">Present</th>
                                    <th className="p-3 text-center text-rose-600">Absent</th>
                                    <th className="p-3 text-center text-indigo-600">Leaves</th>
                                    <th className="p-3 text-center text-amber-600">Half</th>
                                    <th className="p-3 text-center text-slate-500">Missing</th>
                                    <th className="p-3 text-center text-orange-600">Late</th>
                                    <th className="p-3 text-center text-amber-500">OT Hrs</th>
                                    <th className="p-3 text-center">Worked Hrs</th>
                                    <th className="p-3 text-center font-black text-emerald-700 dark:text-emerald-400">Paid Days</th>
                                    <th className="p-3 text-center font-black text-rose-700 dark:text-rose-400">LOP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {filteredEmployees.map((item: any) => {
                                    const s = item.summary;
                                    const isExpanded = !!expandedEmpIds[s.employee_id];
                                    const lopDays = (s.absent_days || 0) + ((s.half_days || 0) * 0.5);
                                    const paidDays = Math.max(0, Number(s.calendar_days || kpiSummary.daysInMonth) - lopDays);

                                    return (
                                        <React.Fragment key={s.employee_id}>
                                            <tr className={`hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors ${isExpanded ? 'bg-cyan-50/30 dark:bg-cyan-950/10' : ''}`}>
                                                <td className="p-3 text-center no-print">
                                                    <button
                                                        onClick={() => toggleExpand(s.employee_id)}
                                                        className="p-1 text-slate-400 hover:text-cyan-600 rounded transition-colors"
                                                    >
                                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-cyan-600" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-900 dark:text-white">{s.employee_name}</div>
                                                    <div className="text-[11px] text-slate-400 font-mono">{s.employee_code}</div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="text-slate-700 dark:text-slate-300 font-medium">{s.department_name}</div>
                                                    <div className="text-[11px] text-slate-400">{s.designation || '—'}</div>
                                                </td>
                                                <td className="p-3 text-center font-semibold text-slate-600 dark:text-slate-400">{s.calendar_days || kpiSummary.daysInMonth}</td>
                                                <td className="p-3 text-center font-bold text-emerald-600">{s.present_days || 0}</td>
                                                <td className="p-3 text-center font-bold text-rose-600">{s.absent_days || 0}</td>
                                                <td className="p-3 text-center font-bold text-indigo-600">{s.leave_days || 0}</td>
                                                <td className="p-3 text-center font-bold text-amber-600">{s.half_days || 0}</td>
                                                <td className="p-3 text-center font-bold text-slate-400">{s.missing_punch_days || 0}</td>
                                                <td className="p-3 text-center font-bold text-orange-600">{s.late_days || 0}</td>
                                                <td className="p-3 text-center font-bold text-amber-600">{Number(s.total_ot_hours || 0).toFixed(1)}</td>
                                                <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">{Number(s.total_worked_hours || 0).toFixed(1)}</td>
                                                <td className="p-3 text-center font-black bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-lg">{paidDays}</td>
                                                <td className="p-3 text-center font-black bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-lg">{lopDays}</td>
                                            </tr>

                                            {/* Expandable Daily Drill-Down */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={14} className="p-0 bg-slate-50/80 dark:bg-zinc-950/40">
                                                        <div className="p-4 pl-12 border-y border-slate-200 dark:border-zinc-800 space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <h4 className="font-bold text-slate-800 dark:text-white text-xs flex items-center gap-2">
                                                                    <Clock className="w-3.5 h-3.5 text-cyan-600" /> Daily Punches & Status Breakdown for {s.employee_name} ({selectedMonth})
                                                                </h4>
                                                                <span className="text-[11px] text-slate-400">
                                                                    Manager: <strong className="text-slate-600 dark:text-slate-300">{s.manager_name || 'Unassigned'}</strong>
                                                                </span>
                                                            </div>

                                                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                                                                <table className="w-full text-left text-[11px]">
                                                                    <thead>
                                                                        <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-zinc-700">
                                                                            <th className="p-2.5">Date</th>
                                                                            <th className="p-2.5">Shift</th>
                                                                            <th className="p-2.5">Scheduled</th>
                                                                            <th className="p-2.5">Check In</th>
                                                                            <th className="p-2.5">Check Out</th>
                                                                            <th className="p-2.5 text-center">Hours</th>
                                                                            <th className="p-2.5">Status</th>
                                                                            <th className="p-2.5 text-center">Late / Early</th>
                                                                            <th className="p-2.5 text-center">OT Hrs</th>
                                                                            <th className="p-2.5">Punch Source</th>
                                                                            <th className="p-2.5">Remarks</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                                        {(item.records && item.records.length > 0) ? (
                                                                            item.records.map((r: any) => {
                                                                                const dateObj = new Date(r.date);
                                                                                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                                                                                const isLate = (r.late_minutes || 0) > 0;
                                                                                const isEarly = (r.early_minutes || 0) > 0;

                                                                                return (
                                                                                    <tr key={r.id || r.date} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                                                                        <td className="p-2.5 font-bold whitespace-nowrap">
                                                                                            {r.date} <span className="text-[10px] text-slate-400 font-normal">({dayName})</span>
                                                                                        </td>
                                                                                        <td className="p-2.5 font-medium">{r.shift_name || 'Standard'}</td>
                                                                                        <td className="p-2.5 text-slate-500 font-mono">
                                                                                            {r.shift_start ? `${r.shift_start.slice(0, 5)} - ${r.shift_end.slice(0, 5)}` : '08:00 - 16:00'}
                                                                                        </td>
                                                                                        <td className="p-2.5 font-mono">
                                                                                            {r.check_in ? (
                                                                                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                                                                                    {new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                                </span>
                                                                                            ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                                                        </td>
                                                                                        <td className="p-2.5 font-mono">
                                                                                            {r.check_out ? (
                                                                                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                                                                                    {new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                                </span>
                                                                                            ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                                                        </td>
                                                                                        <td className="p-2.5 text-center font-bold text-slate-700 dark:text-slate-300">
                                                                                            {Number(r.total_hours || 0).toFixed(1)}
                                                                                        </td>
                                                                                        <td className="p-2.5">
                                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                                                r.status === 'Present' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' :
                                                                                                r.status === 'Absent' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30' :
                                                                                                r.status === 'Half Day' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30' :
                                                                                                r.status === 'On Leave' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30' :
                                                                                                r.status === 'Weekend' ? 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' :
                                                                                                r.status === 'Holiday' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/30' :
                                                                                                'bg-slate-100 text-slate-600 dark:bg-zinc-800'
                                                                                            }`}>
                                                                                                {r.status || 'Present'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="p-2.5 text-center">
                                                                                            {isLate && <span className="text-rose-600 font-bold mr-1">+{r.late_minutes}m Late</span>}
                                                                                            {isEarly && <span className="text-amber-600 font-bold">-{r.early_minutes}m Early</span>}
                                                                                            {!isLate && !isEarly && <span className="text-slate-300 dark:text-slate-600">On Time</span>}
                                                                                        </td>
                                                                                        <td className="p-2.5 text-center font-bold text-amber-600">
                                                                                            {(r.ot_hours || 0) > 0 ? `${Number(r.ot_hours).toFixed(1)}h` : '—'}
                                                                                        </td>
                                                                                        <td className="p-2.5 text-slate-500 font-mono uppercase text-[10px]">
                                                                                            {r.source || 'MANUAL'}
                                                                                        </td>
                                                                                        <td className="p-2.5 text-slate-400 truncate max-w-[150px]" title={r.edit_reason || ''}>
                                                                                            {r.edit_reason || '—'}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            <tr>
                                                                                <td colSpan={11} className="p-4 text-center text-slate-400">
                                                                                    No punch transactions logged for this employee this month.
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Print-Only Signature & Approval Block */}
            <div className="hidden print:flex justify-between items-end pt-10 mt-6 border-t border-slate-400 text-[8.5pt] font-bold text-slate-800">
                <div className="text-center w-48">
                    <div className="border-b border-slate-700 pb-8 mb-1"></div>
                    <div>Prepared By (HR)</div>
                </div>
                <div className="text-center w-48">
                    <div className="border-b border-slate-700 pb-8 mb-1"></div>
                    <div>Verified By (Department Head)</div>
                </div>
                <div className="text-center w-48">
                    <div className="border-b border-slate-700 pb-8 mb-1"></div>
                    <div>Approved By (Managing Director)</div>
                </div>
            </div>
        </div>
    );
};
