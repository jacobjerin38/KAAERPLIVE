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

    // Master Data for Dropdowns & Company Info
    const [departments, setDepartments] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [companyInfo, setCompanyInfo] = useState<{ name: string; display_name: string; logo_url: string | null } | null>(null);

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
            const [deptRes, locRes, shiftRes, compRes] = await Promise.all([
                supabase.from('departments').select('id, name').eq('company_id', currentCompanyId).order('name'),
                supabase.from('locations').select('id, name').eq('company_id', currentCompanyId).order('name'),
                supabase.from('org_shift_timings').select('id, name, code').eq('company_id', currentCompanyId).order('name'),
                supabase.from('companies').select('name, display_name, logo_url').eq('id', currentCompanyId).maybeSingle()
            ]);
            setDepartments(deptRes.data || []);
            setLocations(locRes.data || []);
            setShifts(shiftRes.data || []);
            if (compRes.data) setCompanyInfo(compRes.data);
        } catch (e) {
            console.error('Error fetching masters:', e);
        }
    };

    // Synthesize full 30/31 calendar days for an employee so timesheets are 100% complete
    const getFullMonthRecords = (item: any, rData: any, selMonth: string) => {
        if (!selMonth || !/^\d{4}-\d{2}$/.test(selMonth)) return item?.records || [];
        const [yearStr, monthStr] = selMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const totalDays = new Date(year, month, 0).getDate();

        const existingRecordsMap: Record<string, any> = {};
        (item?.records || []).forEach((r: any) => {
            if (r.date) existingRecordsMap[r.date] = r;
        });

        const holidaysMap: Record<string, string> = {};
        (rData?.holidays || []).forEach((h: any) => {
            if (h.date) holidaysMap[h.date] = h.name;
        });

        const offDays = (rData?.default_off_days || '5,6')
            .split(',')
            .map((d: string) => parseInt(d.trim(), 10));

        const todayStr = new Date().toISOString().split('T')[0];

        const fullRecords = [];
        for (let day = 1; day <= totalDays; day++) {
            const dayStr = String(day).padStart(2, '0');
            const dateKey = `${yearStr}-${monthStr}-${dayStr}`;
            const dateObj = new Date(year, month - 1, day);
            const dayOfWeek = dateObj.getDay();

            if (existingRecordsMap[dateKey]) {
                fullRecords.push(existingRecordsMap[dateKey]);
            } else {
                const isHoliday = holidaysMap[dateKey];
                const isWeekend = offDays.includes(dayOfWeek);
                const isFuture = dateKey > todayStr;

                let status = 'Absent';
                let remarks = 'No Punch Logged';
                if (isHoliday) {
                    status = 'Holiday';
                    remarks = isHoliday;
                } else if (isWeekend) {
                    status = 'Weekend';
                    remarks = 'Weekly Off';
                } else if (isFuture) {
                    status = 'Scheduled';
                    remarks = 'Upcoming';
                }

                fullRecords.push({
                    id: `auto_${dateKey}`,
                    date: dateKey,
                    shift_name: 'Standard',
                    shift_start: '08:00:00',
                    shift_end: '16:00:00',
                    scheduled_hours: 8.0,
                    check_in: null,
                    check_out: null,
                    total_hours: 0,
                    status: status,
                    late_minutes: 0,
                    early_minutes: 0,
                    ot_hours: 0,
                    source: 'SYSTEM',
                    edit_reason: remarks
                });
            }
        }

        return fullRecords;
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
            const fullRecords = getFullMonthRecords(item, reportData, selectedMonth);
            fullRecords.forEach((r: any) => {
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

    // Print Menu State
    const [showPrintMenu, setShowPrintMenu] = useState(false);

    // Standalone HTML Generator for 100% Reliable Multi-Page Landscape Printing
    const generatePrintHTML = (mode: 'summary' | 'detailed_all' | 'current') => {
        const listToPrint = mode === 'current' ? filteredEmployees : (reportData?.employees || filteredEmployees);
        const monthTitle = selectedMonth;
        const generatedDate = new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        let contentHtml = '';

        if (mode === 'summary' || (mode === 'current' && Object.keys(expandedEmpIds).length === 0)) {
            // SUMMARY TABLE FOR ALL EMPLOYEES
            const rowsHtml = listToPrint.map((item: any, idx: number) => {
                const s = item.summary;
                const lopDays = (s.absent_days || 0) + ((s.half_days || 0) * 0.5);
                const paidDays = Math.max(0, Number(s.calendar_days || kpiSummary.daysInMonth) - lopDays);
                return `
                    <tr>
                        <td style="text-align: center; color: #64748b;">${idx + 1}</td>
                        <td style="font-family: monospace; font-weight: bold;">${s.employee_code || '—'}</td>
                        <td style="font-weight: bold; color: #0f172a;">${s.employee_name || '—'}</td>
                        <td>${s.department_name || '—'}</td>
                        <td style="color: #475569;">${s.designation || '—'}</td>
                        <td style="text-align: center;">${s.calendar_days || kpiSummary.daysInMonth}</td>
                        <td style="text-align: center; font-weight: bold; color: #059669;">${s.present_days || 0}</td>
                        <td style="text-align: center; font-weight: bold; color: #dc2626;">${s.absent_days || 0}</td>
                        <td style="text-align: center; font-weight: bold; color: #4f46e5;">${s.leave_days || 0}</td>
                        <td style="text-align: center; font-weight: bold; color: #d97706;">${s.half_days || 0}</td>
                        <td style="text-align: center; color: #94a3b8;">${s.missing_punch_days || 0}</td>
                        <td style="text-align: center; color: #ea580c; font-weight: bold;">${s.late_days || 0}</td>
                        <td style="text-align: center; color: #b45309; font-weight: bold;">${Number(s.total_ot_hours || 0).toFixed(1)}</td>
                        <td style="text-align: center; font-weight: bold;">${Number(s.total_worked_hours || 0).toFixed(1)}</td>
                        <td style="text-align: center; font-weight: 900; background: #ecfdf5; color: #065f46;">${paidDays}</td>
                        <td style="text-align: center; font-weight: 900; background: #fff1f2; color: #9f1239;">${lopDays}</td>
                    </tr>
                `;
            }).join('');

            contentHtml = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 30px; text-align: center;">#</th>
                            <th style="width: 70px;">Emp Code</th>
                            <th>Employee Name</th>
                            <th>Department</th>
                            <th>Designation</th>
                            <th style="text-align: center; width: 45px;">Cal</th>
                            <th style="text-align: center; width: 45px; color: #059669;">Pres</th>
                            <th style="text-align: center; width: 45px; color: #dc2626;">Abs</th>
                            <th style="text-align: center; width: 45px; color: #4f46e5;">Leave</th>
                            <th style="text-align: center; width: 45px; color: #d97706;">Half</th>
                            <th style="text-align: center; width: 45px;">Miss</th>
                            <th style="text-align: center; width: 45px; color: #ea580c;">Late</th>
                            <th style="text-align: center; width: 50px; color: #b45309;">OT Hrs</th>
                            <th style="text-align: center; width: 60px;">Worked</th>
                            <th style="text-align: center; width: 55px; background: #d1fae5; color: #065f46;">Paid Days</th>
                            <th style="text-align: center; width: 45px; background: #ffe4e6; color: #9f1239;">LOP</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            `;
        } else {
            // DETAILED DAILY TIMESHEET DOSSIER FOR EMPLOYEES
            contentHtml = listToPrint.map((item: any, empIdx: number) => {
                const s = item.summary;
                const lopDays = (s.absent_days || 0) + ((s.half_days || 0) * 0.5);
                const paidDays = Math.max(0, Number(s.calendar_days || kpiSummary.daysInMonth) - lopDays);

                const fullRecords = getFullMonthRecords(item, reportData, selectedMonth);

                const dailyRows = fullRecords.map((r: any) => {
                    const dateObj = new Date(r.date);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const isLate = (r.late_minutes || 0) > 0;
                    const isEarly = (r.early_minutes || 0) > 0;

                    const cin = r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                    const cout = r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                    const sched = r.shift_start ? `${r.shift_start.slice(0, 5)} - ${r.shift_end.slice(0, 5)}` : '08:00 - 16:00';

                    let statusClass = 'badge-present';
                    if (r.status === 'Absent') statusClass = 'badge-absent';
                    else if (r.status === 'Half Day') statusClass = 'badge-half';
                    else if (r.status === 'On Leave' || r.status === 'Leave') statusClass = 'badge-leave';
                    else if (r.status === 'Weekend') statusClass = 'badge-weekend';
                    else if (r.status === 'Holiday') statusClass = 'badge-holiday';
                    else if (r.status === 'Scheduled') statusClass = 'badge-scheduled';

                    let lateEarlyText = 'On Time';
                    if (isLate) lateEarlyText = `+${r.late_minutes}m Late`;
                    if (isEarly) lateEarlyText = isLate ? `${lateEarlyText}, -${r.early_minutes}m Early` : `-${r.early_minutes}m Early`;
                    if (r.status === 'Weekend' || r.status === 'Holiday' || r.status === 'Scheduled' || r.status === 'On Leave') {
                        lateEarlyText = '—';
                    }

                    return `
                        <tr>
                            <td style="font-weight: bold; white-space: nowrap;">${r.date} <span style="font-weight: normal; color: #64748b;">(${dayName})</span></td>
                            <td>${r.shift_name || 'Standard'}</td>
                            <td style="font-family: monospace; color: #64748b;">${sched}</td>
                            <td style="font-family: monospace; font-weight: bold;">${cin}</td>
                            <td style="font-family: monospace; font-weight: bold;">${cout}</td>
                            <td style="text-align: center; font-weight: bold;">${Number(r.total_hours || 0).toFixed(1)}</td>
                            <td><span class="badge ${statusClass}">${r.status || 'Present'}</span></td>
                            <td style="text-align: center; font-size: 8pt; color: ${isLate ? '#dc2626' : isEarly ? '#d97706' : '#64748b'};">${lateEarlyText}</td>
                            <td style="text-align: center; font-weight: bold; color: #b45309;">${(r.ot_hours || 0) > 0 ? Number(r.ot_hours).toFixed(1) + 'h' : '—'}</td>
                            <td style="font-size: 7.5pt; color: #64748b; text-transform: uppercase;">${r.source || 'MANUAL'}</td>
                            <td style="font-size: 8pt; color: #475569;">${r.edit_reason || '—'}</td>
                        </tr>
                    `;
                }).join('');

                return `
                    <div class="employee-page" style="${empIdx > 0 ? 'page-break-before: always;' : ''}">
                        <div class="emp-header-card">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <span class="emp-name">${s.employee_name || '—'}</span>
                                    <span class="emp-code">(${s.employee_code || '—'})</span>
                                    <span class="emp-meta">· Dept: <strong>${s.department_name || '—'}</strong> · Role: <strong>${s.designation || '—'}</strong></span>
                                </div>
                                <div class="emp-stats-pill">
                                    <span>Present: <strong>${s.present_days || 0}</strong></span> |
                                    <span>Absent: <strong style="color: #dc2626;">${s.absent_days || 0}</strong></span> |
                                    <span>Half: <strong style="color: #d97706;">${s.half_days || 0}</strong></span> |
                                    <span>Worked: <strong>${Number(s.total_worked_hours || 0).toFixed(1)}h</strong></span> |
                                    <span>OT: <strong style="color: #b45309;">${Number(s.total_ot_hours || 0).toFixed(1)}h</strong></span> |
                                    <span style="background: #ecfdf5; color: #065f46; padding: 2px 6px; border-radius: 4px;">Paid Days: <strong>${paidDays}</strong></span>
                                </div>
                            </div>
                        </div>

                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 85px;">Date</th>
                                    <th style="width: 75px;">Shift</th>
                                    <th style="width: 85px;">Scheduled</th>
                                    <th style="width: 65px;">Check In</th>
                                    <th style="width: 65px;">Check Out</th>
                                    <th style="width: 45px; text-align: center;">Hours</th>
                                    <th style="width: 65px;">Status</th>
                                    <th style="width: 80px; text-align: center;">Late / Early</th>
                                    <th style="width: 50px; text-align: center;">OT Hrs</th>
                                    <th style="width: 65px;">Source</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${dailyRows || '<tr><td colspan="11" style="text-align: center; padding: 12px; color: #94a3b8;">No records logged</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
            }).join('');
        }

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Monthly Attendance Report - ${monthTitle}</title>
                <meta charset="utf-8" />
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 8mm 6mm 8mm 6mm;
                    }
                    * { box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        color: #0f172a;
                        background: white;
                        margin: 0;
                        padding: 0;
                        font-size: 8.5pt;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .report-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 6px;
                        margin-bottom: 6px;
                    }
                    .company-name {
                        font-size: 13pt;
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: -0.3px;
                        color: #0f172a;
                        margin: 0;
                    }
                    .report-subtitle {
                        font-size: 8.5pt;
                        font-weight: 700;
                        color: #475569;
                        margin-top: 2px;
                    }
                    .header-meta {
                        text-align: right;
                        font-size: 8pt;
                        color: #64748b;
                        font-family: monospace;
                    }
                    .kpi-strip {
                        display: grid;
                        grid-template-columns: repeat(6, 1fr);
                        gap: 6px;
                        background: #f8fafc;
                        border: 1px solid #cbd5e1;
                        border-radius: 4px;
                        padding: 4px 8px;
                        margin-bottom: 8px;
                        font-size: 8pt;
                    }
                    .kpi-item span { color: #64748b; }
                    .kpi-item strong { color: #0f172a; font-size: 8.5pt; }

                    .emp-header-card {
                        background: #f1f5f9;
                        border: 1px solid #cbd5e1;
                        border-bottom: none;
                        border-radius: 4px 4px 0 0;
                        padding: 4px 8px;
                        margin-top: 8px;
                    }
                    .emp-name { font-weight: 900; font-size: 9.5pt; color: #0f172a; }
                    .emp-code { font-family: monospace; font-weight: bold; color: #475569; margin-left: 4px; }
                    .emp-meta { font-size: 8pt; color: #64748b; margin-left: 8px; }
                    .emp-stats-pill { font-size: 7.5pt; color: #475569; }

                    table.data-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 8pt;
                        margin-bottom: 8px;
                    }
                    table.data-table thead {
                        display: table-header-group;
                    }
                    table.data-table tr {
                        page-break-inside: avoid;
                    }
                    table.data-table th {
                        background-color: #f1f5f9;
                        color: #1e293b;
                        font-weight: 700;
                        font-size: 7.5pt;
                        text-transform: uppercase;
                        padding: 3.5px 4px;
                        border: 1px solid #cbd5e1;
                        text-align: left;
                    }
                    table.data-table td {
                        padding: 2.5px 4px;
                        border: 1px solid #e2e8f0;
                        color: #0f172a;
                    }
                    table.data-table tbody tr:nth-child(even) {
                        background-color: #f8fafc;
                    }

                    .badge {
                        display: inline-block;
                        padding: 1px 4px;
                        border-radius: 3px;
                        font-size: 7pt;
                        font-weight: bold;
                        text-transform: uppercase;
                    }
                    .badge-present { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
                    .badge-absent { background: #ffe4e6; color: #9f1239; border: 1px solid #fecdd3; }
                    .badge-half { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
                    .badge-leave { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
                    .badge-weekend { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
                    .badge-holiday { background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
                    .badge-scheduled { background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; }

                    .signature-block {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        padding-top: 30px;
                        margin-top: 15px;
                        border-top: 1px solid #cbd5e1;
                        page-break-inside: avoid;
                    }
                    .sig-box {
                        text-align: center;
                        width: 180px;
                    }
                    .sig-line {
                        border-bottom: 1px solid #475569;
                        padding-bottom: 25px;
                        margin-bottom: 4px;
                    }
                    .sig-title {
                        font-size: 8pt;
                        font-weight: bold;
                        color: #1e293b;
                    }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${companyInfo?.logo_url ? `<img src="${companyInfo.logo_url}" alt="Logo" style="height: 36px; width: auto; max-width: 140px; object-fit: contain; border-radius: 4px; background: white; padding: 1px;" />` : ''}
                        <div>
                            <div class="company-name">${companyInfo?.display_name || companyInfo?.name || 'POWER ENGINEERING CORPORATION'}</div>
                            <div class="report-subtitle">Monthly Attendance Statement — Period: ${monthTitle}</div>
                        </div>
                    </div>
                    <div class="header-meta">
                        <div>Generated: ${generatedDate}</div>
                        <div>Total Staff: ${listToPrint.length} Employees</div>
                    </div>
                </div>

                <div class="kpi-strip">
                    <div class="kpi-item"><span>Staff:</span> <strong>${kpiSummary.totalEmployees}</strong></div>
                    <div class="kpi-item"><span>Present:</span> <strong style="color: #059669;">${kpiSummary.totalPresent}</strong> (${kpiSummary.avgAttendancePct}%)</div>
                    <div class="kpi-item"><span>Absent / LOP:</span> <strong style="color: #dc2626;">${kpiSummary.totalLop}</strong></div>
                    <div class="kpi-item"><span>Approved Leaves:</span> <strong style="color: #4f46e5;">${kpiSummary.totalLeave}</strong></div>
                    <div class="kpi-item"><span>Worked Hours:</span> <strong>${kpiSummary.totalWorkedHours}h</strong></div>
                    <div class="kpi-item"><span>Overtime:</span> <strong style="color: #b45309;">${kpiSummary.totalOtHours}h</strong></div>
                </div>

                ${contentHtml}

                <div class="signature-block">
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        <div class="sig-title">Prepared By (HR)</div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        <div class="sig-title">Verified By (Department Head)</div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        <div class="sig-title">Approved By (Managing Director)</div>
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    // Print Execution using Clean Isolated Iframe (Generates Full Multi-Page Document)
    const handlePrintAction = (mode: 'summary' | 'detailed_all' | 'current') => {
        setShowPrintMenu(false);
        const html = generatePrintHTML(mode);

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
            doc.open();
            doc.write(html);
            doc.close();

            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, 2000);
            }, 300);
        }
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
                    .print-employee-breakdown {
                        page-break-inside: avoid !important;
                        margin-top: 4px !important;
                        margin-bottom: 8px !important;
                    }
                }
            `}</style>

            {/* Print-Only Executive Header */}
            <div className="hidden print:block mb-3 pb-2 border-b-2 border-slate-800">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        {companyInfo?.logo_url && (
                            <img
                                src={companyInfo.logo_url}
                                alt="Company Logo"
                                className="h-9 w-auto max-w-[130px] object-contain rounded bg-white p-0.5 border border-slate-300"
                            />
                        )}
                        <div>
                            <h1 className="text-base font-black uppercase tracking-tight text-slate-900">
                                {companyInfo?.display_name || companyInfo?.name || 'POWER ENGINEERING CORPORATION'}
                            </h1>
                            <p className="text-xs font-bold text-slate-600">
                                Monthly Attendance Statement — Period: <span className="font-black text-cyan-800">{selectedMonth}</span> | Generated: {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <div className="text-right text-[10px] text-slate-500 font-mono">
                        <div>Total Filtered Staff: <strong>{filteredEmployees.length} of {reportData?.employees?.length || 0}</strong></div>
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
                    <div className="flex items-center gap-3">
                        {companyInfo?.logo_url ? (
                            <img
                                src={companyInfo.logo_url}
                                alt="Company Logo"
                                className="h-10 w-auto max-w-[140px] object-contain rounded-xl border border-slate-200 dark:border-zinc-700 bg-white p-1 shadow-sm"
                            />
                        ) : (
                            <div className="p-2 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 rounded-xl">
                                <Calendar className="w-6 h-6" />
                            </div>
                        )}
                        <div>
                            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                {companyInfo?.display_name || companyInfo?.name || 'POWER ENGINEERING CORPORATION'}
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Monthly Attendance Report</h2>
                        </div>
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

                    {/* Print Dropdown Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowPrintMenu(!showPrintMenu)}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print Report</span>
                            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                        </button>

                        {showPrintMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowPrintMenu(false)} />
                                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 py-2 z-50 animate-in fade-in zoom-in-95">
                                    <div className="px-4 py-2 border-b border-slate-100 dark:border-zinc-700 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                        Select Print Format
                                    </div>

                                    <button
                                        onClick={() => handlePrintAction('summary')}
                                        className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-700/50 flex items-start gap-3 transition-colors"
                                    >
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded-xl mt-0.5">
                                            <FileSpreadsheet className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-800 dark:text-white">Print Monthly Summary Statement</div>
                                            <div className="text-[11px] text-slate-500">Clean landscape matrix for all {reportData?.employees?.length || 0} employees</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => handlePrintAction('detailed_all')}
                                        className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-700/50 flex items-start gap-3 transition-colors"
                                    >
                                        <div className="p-2 bg-purple-50 dark:bg-purple-950/30 text-purple-600 rounded-xl mt-0.5">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-800 dark:text-white">Print Complete Detailed Dossier</div>
                                            <div className="text-[11px] text-slate-500">Full 31-day punch breakdown for all {reportData?.employees?.length || 0} employees</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => handlePrintAction('current')}
                                        className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-700/50 flex items-start gap-3 transition-colors"
                                    >
                                        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl mt-0.5">
                                            <Printer className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-800 dark:text-white">Print Current Screen Selection</div>
                                            <div className="text-[11px] text-slate-500">Prints only the active filtered/viewing employees</div>
                                        </div>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
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
                                                                        {(() => {
                                                                            const fullRecords = getFullMonthRecords(item, reportData, selectedMonth);
                                                                            if (!fullRecords || fullRecords.length === 0) {
                                                                                return (
                                                                                    <tr>
                                                                                        <td colSpan={11} className="p-4 text-center text-slate-400">
                                                                                            No punch transactions logged for this employee this month.
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            }

                                                                            return fullRecords.map((r: any) => {
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
                                                                                                (r.status === 'On Leave' || r.status === 'Leave') ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30' :
                                                                                                r.status === 'Weekend' ? 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' :
                                                                                                r.status === 'Holiday' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/30' :
                                                                                                r.status === 'Scheduled' ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800' :
                                                                                                'bg-slate-100 text-slate-600 dark:bg-zinc-800'
                                                                                            }`}>
                                                                                                {r.status || 'Present'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="p-2.5 text-center">
                                                                                            {isLate && <span className="text-rose-600 font-bold mr-1">+{r.late_minutes}m Late</span>}
                                                                                            {isEarly && <span className="text-amber-600 font-bold">-{r.early_minutes}m Early</span>}
                                                                                            {!isLate && !isEarly && (r.status === 'Weekend' || r.status === 'Holiday' || r.status === 'Scheduled' || r.status === 'On Leave' ? <span className="text-slate-300 dark:text-slate-600">—</span> : <span className="text-slate-300 dark:text-slate-600">On Time</span>)}
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
                                                                            });
                                                                        })()}
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
