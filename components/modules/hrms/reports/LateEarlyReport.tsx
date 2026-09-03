import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import {
    AlertTriangle, Clock, Calendar, Download, Search, Loader2,
    ChevronRight, ChevronDown, Printer, Filter, RefreshCw, Users,
    TrendingDown, ArrowUpRight, ArrowDownRight, FileSpreadsheet, Building2
} from 'lucide-react';
import { utils, write } from 'xlsx';

export const LateEarlyReport: React.FC = () => {
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
    const [modeToggle, setModeToggle] = useState<'BOTH' | 'LATE_ONLY' | 'EARLY_ONLY'>('BOTH');
    const [minLateMinutes, setMinLateMinutes] = useState<number>(0);
    const [minEarlyMinutes, setMinEarlyMinutes] = useState<number>(0);
    const [summarySortBy, setSummarySortBy] = useState<'LATE_MINS' | 'EARLY_MINS' | 'LATE_OCCUR' | 'NAME'>('LATE_MINS');
    const [showPrintMenu, setShowPrintMenu] = useState(false);

    // Master Data
    const [departments, setDepartments] = useState<any[]>([]);
    const [reportData, setReportData] = useState<any>(null);
    const [companyInfo, setCompanyInfo] = useState<{ name: string; display_name: string; logo_url: string | null } | null>(null);

    useEffect(() => {
        if (currentCompanyId) {
            fetchDepartments();
            supabase.from('companies').select('name, display_name, logo_url').eq('id', currentCompanyId).maybeSingle().then(({ data }) => {
                if (data) setCompanyInfo(data);
            });
        }
    }, [currentCompanyId]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchReport();
        }
    }, [currentCompanyId, startDate, endDate, selectedDept]);

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
                p_department_id: selectedDept ? Number(selectedDept) : null
            });

            if (error) throw error;
            setReportData(data);
        } catch (err: any) {
            console.error('Error fetching Late/Early Report:', err);
            alert('Failed to load Late / Early Report: ' + err.message);
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

            const isLate = (r.computed_late_minutes || 0) > 0;
            const isEarly = (r.computed_early_minutes || 0) > 0;

            if (modeToggle === 'LATE_ONLY' && !isLate) return false;
            if (modeToggle === 'EARLY_ONLY' && !isEarly) return false;

            if (minLateMinutes > 0 && (r.computed_late_minutes || 0) < minLateMinutes) return false;
            if (minEarlyMinutes > 0 && (r.computed_early_minutes || 0) < minEarlyMinutes) return false;

            return true;
        });
    }, [reportData, searchTerm, modeToggle, minLateMinutes, minEarlyMinutes]);

    // Sorted Employee Summary
    const sortedEmployeeSummary = useMemo(() => {
        if (!reportData?.employee_summary) return [];
        const copy = [...reportData.employee_summary];

        copy.sort((a, b) => {
            if (summarySortBy === 'LATE_MINS') return (b.total_late_minutes || 0) - (a.total_late_minutes || 0);
            if (summarySortBy === 'EARLY_MINS') return (b.total_early_minutes || 0) - (a.total_early_minutes || 0);
            if (summarySortBy === 'LATE_OCCUR') return (b.late_occurrences || 0) - (a.late_occurrences || 0);
            if (summarySortBy === 'NAME') return (a.employee_name || '').localeCompare(b.employee_name || '');
            return 0;
        });

        return copy;
    }, [reportData, summarySortBy]);

    // Export Excel
    const handleExportExcel = () => {
        if (!filteredRecords.length) return alert('No incident records to export.');

        // Incidents Sheet
        const rows = filteredRecords.map((r: any) => ({
            'Employee Code': r.employee_code || '—',
            'Employee Name': r.employee_name || '—',
            'Department': r.department_name || '—',
            'Date': r.date,
            'Shift': r.shift_name || 'Standard',
            'Overnight Shift': r.is_overnight ? 'Yes' : 'No',
            'Scheduled Start': r.scheduled_start || '08:00',
            'Scheduled End': r.scheduled_end || '16:00',
            'Check In': r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
            'Check Out': r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
            'Late Arrival (Minutes)': r.computed_late_minutes || 0,
            'Early Departure (Minutes)': r.computed_early_minutes || 0,
            'Total Worked Hours': Number(r.total_worked_hours || 0).toFixed(1),
            'Punch Source': r.punch_source || 'MANUAL',
            'Remarks / Reason': r.edit_reason || '—'
        }));

        // Employee Summary Sheet
        const summaryRows = (reportData?.employee_summary || []).map((es: any) => ({
            'Employee Code': es.employee_code,
            'Employee Name': es.employee_name,
            'Department': es.department_name,
            'Late Occurrences': es.late_occurrences,
            'Total Late Minutes': es.total_late_minutes,
            'Early Occurrences': es.early_occurrences,
            'Total Early Minutes': es.total_early_minutes
        }));

        const wb = utils.book_new();
        const wsIncidents = utils.json_to_sheet(rows);
        const wsSummary = utils.json_to_sheet(summaryRows);

        utils.book_append_sheet(wb, wsIncidents, 'Punctuality Incidents');
        utils.book_append_sheet(wb, wsSummary, 'Employee Summary');

        const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Late_Early_Report_${startDate}_to_${endDate}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ==========================================
    // Standalone Clean Multi-Page Print Generator
    // ==========================================
    const generatePrintHTML = (mode: 'detailed_all' | 'summary' | 'current') => {
        const recordsToPrint = mode === 'current'
            ? filteredRecords
            : (reportData?.records || []);

        const generatedDate = new Date().toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });

        const summary = reportData?.summary || {
            total_late_employees: 0,
            total_late_occurrences: 0,
            total_late_minutes: 0,
            avg_late_minutes: 0,
            total_early_employees: 0,
            total_early_occurrences: 0,
            total_early_minutes: 0,
            avg_early_minutes: 0
        };

        const empSummaryList = sortedEmployeeSummary || [];

        // Build Employee Punctuality Summary Table HTML
        let summaryHtml = '';
        if (empSummaryList.length > 0 && (mode === 'summary' || mode === 'detailed_all')) {
            summaryHtml = `
                <div style="margin-bottom: 12px;">
                    <div style="font-weight: 800; font-size: 8.5pt; text-transform: uppercase; color: #1e293b; margin-bottom: 4px;">
                        Employee Punctuality Summary (${empSummaryList.length} Staff)
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 25px;">#</th>
                                <th>Employee</th>
                                <th>Department</th>
                                <th style="text-align: center; color: #b91c1c;">Late Incidents</th>
                                <th style="text-align: center; color: #b91c1c;">Total Late (mins)</th>
                                <th style="text-align: center; color: #b45309;">Early Out Incidents</th>
                                <th style="text-align: center; color: #b45309;">Total Early Out (mins)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${empSummaryList.map((es: any, idx: number) => `
                                <tr>
                                    <td style="color: #64748b; text-align: center;">${idx + 1}</td>
                                    <td>
                                        <div style="font-weight: bold; color: #0f172a;">${es.employee_name}</div>
                                        <div style="font-size: 7pt; color: #64748b; font-family: monospace;">${es.employee_code}</div>
                                    </td>
                                    <td style="color: #334155;">${es.department_name}</td>
                                    <td style="text-align: center; font-weight: bold; color: #b91c1c;">${es.late_occurrences || 0}</td>
                                    <td style="text-align: center; font-weight: 800; color: #b91c1c; background: #fef2f2;">${es.total_late_minutes || 0}m</td>
                                    <td style="text-align: center; font-weight: bold; color: #b45309;">${es.early_occurrences || 0}</td>
                                    <td style="text-align: center; font-weight: 800; color: #b45309; background: #fffbeb;">${es.total_early_minutes || 0}m</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Build Detailed Table HTML
        let detailsHtml = '';
        if (mode === 'detailed_all' || mode === 'current') {
            detailsHtml = `
                <div>
                    <div style="font-weight: 800; font-size: 8.5pt; text-transform: uppercase; color: #1e293b; margin-bottom: 4px; display: flex; justify-content: space-between;">
                        <span>Detailed Punctuality Incidents (${recordsToPrint.length} Records)</span>
                        <span style="font-size: 7.5pt; color: #64748b;">Configured Grace: Late ${reportData?.grace_late || 15}m • Early ${reportData?.grace_early || 15}m</span>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 25px;">#</th>
                                <th>Employee</th>
                                <th>Department</th>
                                <th>Date</th>
                                <th>Shift</th>
                                <th style="font-family: monospace;">Scheduled</th>
                                <th style="font-family: monospace;">Actual In / Out</th>
                                <th style="text-align: center; color: #b91c1c;">Late Duration</th>
                                <th style="text-align: center; color: #b45309;">Early Departure</th>
                                <th style="text-align: center;">Worked</th>
                                <th>Source</th>
                                <th>Remarks / Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recordsToPrint.map((r: any, idx: number) => {
                                const inTime = r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                                const outTime = r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                                const dayName = new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' });
                                
                                const isLate = (r.computed_late_minutes || 0) > 0;
                                const isEarly = (r.computed_early_minutes || 0) > 0;

                                return `
                                    <tr>
                                        <td style="color: #64748b; text-align: center;">${idx + 1}</td>
                                        <td>
                                            <div style="font-weight: bold; color: #0f172a;">${r.employee_name || '—'}</div>
                                            <div style="font-size: 7pt; color: #64748b; font-family: monospace;">${r.employee_code || ''}</div>
                                        </td>
                                        <td style="color: #334155;">${r.department_name || '—'}</td>
                                        <td style="white-space: nowrap; font-weight: 600;">
                                            ${r.date} <span style="font-size: 6.5pt; color: #64748b;">(${dayName})</span>
                                        </td>
                                        <td>
                                            <div style="font-weight: 500;">${r.shift_name || 'Standard'}</div>
                                            ${r.is_overnight ? '<div style="font-size: 6.5pt; color: #4338ca; font-weight: bold;">Overnight</div>' : ''}
                                        </td>
                                        <td style="font-family: monospace; font-size: 7pt; color: #475569;">
                                            ${r.scheduled_start ? `${r.scheduled_start.slice(0, 5)} - ${r.scheduled_end.slice(0, 5)}` : '08:00 - 16:00'}
                                        </td>
                                        <td style="font-family: monospace; font-size: 7pt;">
                                            <div>In: <strong style="color: ${isLate ? '#b91c1c' : '#0f172a'};">${inTime}</strong></div>
                                            <div>Out: <strong style="color: ${isEarly ? '#b45309' : '#0f172a'};">${outTime}</strong></div>
                                        </td>
                                        <td style="text-align: center;">
                                            ${isLate ? `<span class="badge badge-late">+${r.computed_late_minutes}m</span>` : '<span style="color: #cbd5e1;">—</span>'}
                                        </td>
                                        <td style="text-align: center;">
                                            ${isEarly ? `<span class="badge badge-early">-${r.computed_early_minutes}m</span>` : '<span style="color: #cbd5e1;">—</span>'}
                                        </td>
                                        <td style="text-align: center; font-weight: 600;">${Number(r.total_worked_hours || 0).toFixed(1)}h</td>
                                        <td style="font-family: monospace; font-size: 6.5pt; color: #64748b; text-transform: uppercase;">
                                            ${r.punch_source || 'MANUAL'}
                                        </td>
                                        <td style="font-size: 7pt; color: #64748b; font-style: italic;">
                                            ${r.edit_reason || '—'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            ${recordsToPrint.length === 0 ? `
                                <tr>
                                    <td colspan="12" style="text-align: center; padding: 16px; color: #64748b;">
                                        No late arrival or early departure incidents found for this period and filter selection.
                                    </td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
            `;
        }

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Late In / Early Out Report — ${companyInfo?.display_name || companyInfo?.name || 'KAA ERP'}</title>
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
                        font-size: 7.5pt;
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
                        font-size: 7.5pt;
                        color: #64748b;
                        font-family: monospace;
                    }
                    .kpi-strip {
                        display: grid;
                        grid-template-columns: repeat(8, 1fr);
                        gap: 4px;
                        background: #f8fafc;
                        border: 1px solid #cbd5e1;
                        border-radius: 4px;
                        padding: 4px 6px;
                        margin-bottom: 8px;
                        font-size: 7.5pt;
                    }
                    .kpi-item span { color: #64748b; font-size: 6.8pt; display: block; }
                    .kpi-item strong { color: #0f172a; font-size: 8pt; }

                    table.data-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 7.2pt;
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
                        font-size: 7pt;
                        text-transform: uppercase;
                        padding: 3px 4px;
                        border: 1px solid #cbd5e1;
                        text-align: left;
                    }
                    table.data-table td {
                        padding: 2px 4px;
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
                        font-size: 6.5pt;
                        font-weight: bold;
                    }
                    .badge-late { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
                    .badge-early { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }

                    .signature-block {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        padding-top: 25px;
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
                        padding-bottom: 20px;
                        margin-bottom: 4px;
                    }
                    .sig-title {
                        font-size: 7.5pt;
                        font-weight: bold;
                        color: #1e293b;
                    }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${companyInfo?.logo_url ? `<img src="${companyInfo.logo_url}" alt="Logo" style="height: 36px; width: auto; max-width: 140px; object-fit: contain; border-radius: 4px; background: white; padding: 1px;" />` : ''}
                        <div>
                            <div class="company-name">${companyInfo?.display_name || companyInfo?.name || 'POWER ENGINEERING CORPORATION'}</div>
                            <div class="report-subtitle">Late In / Early Out Punctuality Audit — Period: ${startDate} to ${endDate}</div>
                        </div>
                    </div>
                    <div class="header-meta">
                        <div>Generated: ${generatedDate}</div>
                        <div>Total Incidents: ${recordsToPrint.length} | Format: ${mode.toUpperCase()}</div>
                    </div>
                </div>

                <div class="kpi-strip">
                    <div class="kpi-item"><span>Late Staff:</span> <strong style="color: #b91c1c;">${summary.total_late_employees}</strong></div>
                    <div class="kpi-item"><span>Late Incidents:</span> <strong style="color: #b91c1c;">${summary.total_late_occurrences}</strong></div>
                    <div class="kpi-item"><span>Total Late Mins:</span> <strong style="color: #b91c1c;">${summary.total_late_minutes}m</strong></div>
                    <div class="kpi-item"><span>Avg Late / Event:</span> <strong>${summary.avg_late_minutes}m</strong></div>
                    <div class="kpi-item"><span>Early Out Staff:</span> <strong style="color: #b45309;">${summary.total_early_employees}</strong></div>
                    <div class="kpi-item"><span>Early Out Events:</span> <strong style="color: #b45309;">${summary.total_early_occurrences}</strong></div>
                    <div class="kpi-item"><span>Total Early Mins:</span> <strong style="color: #b45309;">${summary.total_early_minutes}m</strong></div>
                    <div class="kpi-item"><span>Avg Early / Event:</span> <strong>${summary.avg_early_minutes}m</strong></div>
                </div>

                ${summaryHtml}
                ${detailsHtml}

                <div class="signature-block">
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        <div class="sig-title">Prepared By (Timekeeper / HR)</div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        <div class="sig-title">Verified By (Department Head)</div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        <div class="sig-title">Approved By (Operations / MD)</div>
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    // Print Execution using Clean Isolated Iframe (Generates Full Multi-Page Document)
    const handlePrintAction = (mode: 'detailed_all' | 'summary' | 'current') => {
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
                        font-size: 8pt !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    aside, nav, header, .no-print, button, input, select {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                }
            `}</style>

            {/* Header */}
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
                            <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-xl">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                        )}
                        <div>
                            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                {companyInfo?.display_name || companyInfo?.name || 'POWER ENGINEERING CORPORATION'}
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Late In / Early Out Report</h2>
                        </div>
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
                                        onClick={() => handlePrintAction('detailed_all')}
                                        className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-700/50 flex items-start gap-3 transition-colors"
                                    >
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded-xl mt-0.5">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-800 dark:text-white">Print Full Incidents Dossier</div>
                                            <div className="text-[11px] text-slate-500">Full multi-page statement for all {reportData?.records?.length || 0} incidents</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => handlePrintAction('summary')}
                                        className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-700/50 flex items-start gap-3 transition-colors"
                                    >
                                        <div className="p-2 bg-purple-50 dark:bg-purple-950/30 text-purple-600 rounded-xl mt-0.5">
                                            <Users className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-800 dark:text-white">Print Punctuality Leaderboard</div>
                                            <div className="text-[11px] text-slate-500">Executive summary of employee late/early totals</div>
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
                                            <div className="text-xs font-bold text-slate-800 dark:text-white">Print Filtered Screen Selection</div>
                                            <div className="text-[11px] text-slate-500">Full multi-page list for current filters ({filteredRecords.length} records)</div>
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
            <div className="no-print grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
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
                <div className="no-print bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm space-y-3">
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
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
                <div className="no-print p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex justify-between items-center">
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
                    <div className="overflow-x-auto print:overflow-visible">
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
