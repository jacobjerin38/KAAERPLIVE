import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
    Users, User, Briefcase, FileCheck, DollarSign, TrendingUp,
    Download, Printer, Search, Filter, Calendar, CheckCircle2,
    Clock, AlertCircle, ChevronDown, ChevronRight, Eye, RefreshCw,
    Building2, Award, ArrowUpRight, BarChart2
} from 'lucide-react';
import { getPersonResolver, getSalesReps } from '../services';
import { formatLocalDate } from '../../../lib/dateFormat';

interface EmployeeWiseCrmReportProps {
    companyId?: string;
}

interface EmployeeMetrics {
    id: string; // employee or profile ID
    profileId?: string;
    name: string;
    employee_code?: string;
    designation?: string;
    department?: string;
    email?: string;
    // Customer accounts
    totalCustomers: number;
    customersList: any[];
    // Call-off work orders
    totalWorkOrders: number;
    inProgressWOs: number;
    completedWOs: number;
    totalWOValueQAR: number;
    workOrdersList: any[];
    // Opportunities
    totalOpportunities: number;
    wonOpportunities: number;
    lostOpportunities: number;
    openOpportunities: number;
    pipelineValueQAR: number;
    wonValueQAR: number;
    opportunitiesList: any[];
    // Leads
    totalLeads: number;
    convertedLeads: number;
    leadsList: any[];
}

export const EmployeeWiseCrmReport: React.FC<EmployeeWiseCrmReportProps> = ({ companyId: propCompanyId }) => {
    const { currentCompanyId } = useAuth();
    const companyId = propCompanyId || currentCompanyId || '';

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [employees, setEmployees] = useState<any[]>([]);
    const [allCustomers, setAllCustomers] = useState<any[]>([]);
    const [allWorkOrders, setAllWorkOrders] = useState<any[]>([]);
    const [allOpportunities, setAllOpportunities] = useState<any[]>([]);
    const [allLeads, setAllLeads] = useState<any[]>([]);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('ALL');
    const [periodFilter, setPeriodFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR'>('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Drill-down State
    const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<'WORK_ORDERS' | 'OPPORTUNITIES' | 'CUSTOMERS' | 'LEADS'>('WORK_ORDERS');

    useEffect(() => {
        if (companyId) {
            fetchReportData();
        }
    }, [companyId]);

    const fetchReportData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            // 1. Fetch Employees
            const { data: emps } = await supabase
                .from('employees')
                .select('id, name, employee_code, designation, department, profile_id, status')
                .eq('company_id', companyId)
                .neq('status', 'Resigned')
                .order('name');

            // 2. Fetch Profiles for fallback
            const { data: profs } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .order('full_name');

            // 3. Fetch Customers
            const { data: custs } = await supabase
                .from('crm_customers')
                .select('id, name, contract_number, contract_title, owner_id, created_by, status, created_at')
                .eq('company_id', companyId);

            // 4. Fetch Work Orders
            const { data: wos } = await supabase
                .from('crm_customer_work_orders')
                .select(`
                    id, customer_id, wo_number, contract_ref, description, amount, currency,
                    issue_date, start_date, completion_date, status, remarks, created_by,
                    assigned_to, employee_id, created_at,
                    customer:crm_customers(id, name, contract_number, owner_id)
                `)
                .eq('company_id', companyId);

            // 5. Fetch Opportunities
            const { data: opps } = await supabase
                .from('crm_opportunities')
                .select(`
                    id, title, amount, currency, status, probability, owner_id, created_by,
                    expected_closing_date, created_at, customer_id,
                    customer:crm_customers(name)
                `)
                .eq('company_id', companyId);

            // 6. Fetch Leads
            const { data: leads } = await supabase
                .from('crm_leads')
                .select('id, first_name, last_name, organization_name, lead_owner_id, created_by, status, created_at')
                .eq('company_id', companyId);

            setEmployees(emps || []);
            setAllCustomers(custs || []);
            setAllWorkOrders(wos || []);
            setAllOpportunities(opps || []);
            setAllLeads(leads || []);
        } catch (err) {
            console.error('Error fetching Employee CRM Report data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Date range helper
    const isWithinPeriod = (dateStr?: string) => {
        if (periodFilter === 'ALL' && !startDate && !endDate) return true;
        if (!dateStr) return false;

        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return true;

        const now = new Date();
        if (periodFilter === 'THIS_MONTH') {
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }
        if (periodFilter === 'LAST_MONTH') {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth();
        }
        if (periodFilter === 'THIS_QUARTER') {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            const dateQuarter = Math.floor(d.getMonth() / 3);
            return d.getFullYear() === now.getFullYear() && currentQuarter === dateQuarter;
        }
        if (periodFilter === 'THIS_YEAR') {
            return d.getFullYear() === now.getFullYear();
        }
        if (startDate && d < new Date(`${startDate}T00:00:00`)) return false;
        if (endDate && d > new Date(`${endDate}T23:59:59`)) return false;

        return true;
    };

    // Aggregate metrics per employee
    const employeeMetrics = useMemo(() => {
        // Map of identifier (profile_id or employee_id) -> Employee Record
        const map = new Map<string, EmployeeMetrics>();

        // Create entries for each employee
        employees.forEach(emp => {
            const record: EmployeeMetrics = {
                id: emp.id,
                profileId: emp.profile_id,
                name: emp.name || 'Unnamed Employee',
                employee_code: emp.employee_code || '',
                designation: emp.designation || 'Staff',
                department: emp.department || 'General',
                totalCustomers: 0,
                customersList: [],
                totalWorkOrders: 0,
                inProgressWOs: 0,
                completedWOs: 0,
                totalWOValueQAR: 0,
                workOrdersList: [],
                totalOpportunities: 0,
                wonOpportunities: 0,
                lostOpportunities: 0,
                openOpportunities: 0,
                pipelineValueQAR: 0,
                wonValueQAR: 0,
                opportunitiesList: [],
                totalLeads: 0,
                convertedLeads: 0,
                leadsList: []
            };
            map.set(emp.id, record);
            if (emp.profile_id) {
                map.set(emp.profile_id, record);
            }
        });

        // Add an Unassigned pool for items not linked to an employee
        const unassignedRecord: EmployeeMetrics = {
            id: 'UNASSIGNED',
            name: 'Unassigned / Direct',
            employee_code: '—',
            designation: 'Unallocated',
            department: 'Corporate Pool',
            totalCustomers: 0,
            customersList: [],
            totalWorkOrders: 0,
            inProgressWOs: 0,
            completedWOs: 0,
            totalWOValueQAR: 0,
            workOrdersList: [],
            totalOpportunities: 0,
            wonOpportunities: 0,
            lostOpportunities: 0,
            openOpportunities: 0,
            pipelineValueQAR: 0,
            wonValueQAR: 0,
            opportunitiesList: [],
            totalLeads: 0,
            convertedLeads: 0,
            leadsList: []
        };
        map.set('UNASSIGNED', unassignedRecord);

        // Helper to match an ID to a record
        const findRecord = (id?: string | null): EmployeeMetrics => {
            if (!id) return unassignedRecord;
            return map.get(id) || unassignedRecord;
        };

        // 1. Process Customers
        allCustomers.forEach(c => {
            if (!isWithinPeriod(c.created_at)) return;
            const rec = findRecord(c.owner_id || c.created_by);
            rec.totalCustomers++;
            rec.customersList.push(c);
        });

        // 2. Process Work Orders
        allWorkOrders.forEach(wo => {
            if (!isWithinPeriod(wo.issue_date || wo.created_at)) return;
            // Assignee priority: explicit employee_id -> explicit assigned_to -> customer.owner_id -> created_by
            const repId = wo.employee_id || wo.assigned_to || wo.customer?.owner_id || wo.created_by;
            const rec = findRecord(repId);

            rec.totalWorkOrders++;
            if (wo.status === 'In Progress' || wo.status === 'Pending') rec.inProgressWOs++;
            if (wo.status === 'Completed' || wo.status === 'Billed') rec.completedWOs++;

            const rawAmt = Number(wo.amount) || 0;
            const amtQAR = wo.currency === 'USD' ? rawAmt * 3.64 : rawAmt;
            rec.totalWOValueQAR += amtQAR;
            rec.workOrdersList.push({ ...wo, amountQAR: amtQAR });
        });

        // 3. Process Opportunities
        allOpportunities.forEach(opp => {
            if (!isWithinPeriod(opp.created_at)) return;
            const rec = findRecord(opp.owner_id || opp.created_by);
            rec.totalOpportunities++;

            const rawAmt = Number(opp.amount) || 0;
            const amtQAR = opp.currency === 'USD' ? rawAmt * 3.64 : rawAmt;
            rec.pipelineValueQAR += amtQAR;

            const st = (opp.status || '').toLowerCase();
            if (st === 'won') {
                rec.wonOpportunities++;
                rec.wonValueQAR += amtQAR;
            } else if (st === 'lost') {
                rec.lostOpportunities++;
            } else {
                rec.openOpportunities++;
            }
            rec.opportunitiesList.push({ ...opp, amountQAR: amtQAR });
        });

        // 4. Process Leads
        allLeads.forEach(lead => {
            if (!isWithinPeriod(lead.created_at)) return;
            const rec = findRecord(lead.lead_owner_id || lead.created_by);
            rec.totalLeads++;
            const st = (lead.status || '').toLowerCase();
            if (st === 'converted' || st === 'won' || st === 'customer') {
                rec.convertedLeads++;
            }
            rec.leadsList.push(lead);
        });

        // Deduplicate records (since both emp.id and emp.profile_id point to the same object)
        const uniqueSet = new Set<EmployeeMetrics>();
        Array.from(map.values()).forEach(item => {
            // Keep unassigned only if it has items
            if (item.id === 'UNASSIGNED') {
                if (item.totalCustomers > 0 || item.totalWorkOrders > 0 || item.totalOpportunities > 0 || item.totalLeads > 0) {
                    uniqueSet.add(item);
                }
            } else {
                uniqueSet.add(item);
            }
        });

        return Array.from(uniqueSet).sort((a, b) => b.totalWOValueQAR - a.totalWOValueQAR || b.totalOpportunities - a.totalOpportunities || a.name.localeCompare(b.name));
    }, [employees, allCustomers, allWorkOrders, allOpportunities, allLeads, periodFilter, startDate, endDate]);

    // Filter by search & selected employee dropdown
    const filteredMetrics = useMemo(() => {
        return employeeMetrics.filter(m => {
            if (selectedEmployeeFilter !== 'ALL' && m.id !== selectedEmployeeFilter && m.profileId !== selectedEmployeeFilter) {
                return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matches =
                    m.name.toLowerCase().includes(q) ||
                    (m.employee_code || '').toLowerCase().includes(q) ||
                    (m.designation || '').toLowerCase().includes(q) ||
                    (m.department || '').toLowerCase().includes(q);
                if (!matches) return false;
            }
            return true;
        });
    }, [employeeMetrics, selectedEmployeeFilter, searchQuery]);

    // Active expanded employee for drilldown
    const activeEmployee = useMemo(() => {
        if (!expandedEmployeeId) return null;
        return employeeMetrics.find(m => m.id === expandedEmployeeId || m.profileId === expandedEmployeeId) || null;
    }, [employeeMetrics, expandedEmployeeId]);

    // Overall Totals
    const overallStats = useMemo(() => {
        let totalWOs = 0;
        let inProgressWOs = 0;
        let completedWOs = 0;
        let totalWOValue = 0;
        let totalOpps = 0;
        let wonOpps = 0;
        let totalPipelineVal = 0;
        let totalWonVal = 0;
        let totalLeads = 0;
        let convertedLeads = 0;

        filteredMetrics.forEach(m => {
            totalWOs += m.totalWorkOrders;
            inProgressWOs += m.inProgressWOs;
            completedWOs += m.completedWOs;
            totalWOValue += m.totalWOValueQAR;
            totalOpps += m.totalOpportunities;
            wonOpps += m.wonOpportunities;
            totalPipelineVal += m.pipelineValueQAR;
            totalWonVal += m.wonValueQAR;
            totalLeads += m.totalLeads;
            convertedLeads += m.convertedLeads;
        });

        const winRate = totalOpps > 0 ? (wonOpps / totalOpps) * 100 : 0;
        const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

        return {
            totalReps: filteredMetrics.filter(m => m.id !== 'UNASSIGNED').length,
            totalWOs,
            inProgressWOs,
            completedWOs,
            totalWOValue,
            totalOpps,
            wonOpps,
            totalPipelineVal,
            totalWonVal,
            winRate,
            totalLeads,
            convertedLeads,
            conversionRate
        };
    }, [filteredMetrics]);

    // Export to CSV
    const handleExportCSV = () => {
        const headers = [
            "SL.NO", "Employee Name", "Employee Code", "Designation", "Department",
            "Managed Clients", "Total Work Orders", "WOs In Progress", "WOs Completed",
            "Total WO Value (QAR)", "Total Opportunities", "Won Opportunities",
            "Pipeline Value (QAR)", "Won Value (QAR)", "Win Rate (%)",
            "Total Leads", "Converted Leads", "Lead Conversion (%)"
        ];

        const rows = filteredMetrics.map((m, idx) => {
            const winRate = m.totalOpportunities > 0 ? ((m.wonOpportunities / m.totalOpportunities) * 100).toFixed(1) : '0.0';
            const convRate = m.totalLeads > 0 ? ((m.convertedLeads / m.totalLeads) * 100).toFixed(1) : '0.0';
            return [
                idx + 1,
                `"${m.name.replace(/"/g, '""')}"`,
                `"${(m.employee_code || '').replace(/"/g, '""')}"`,
                `"${(m.designation || '').replace(/"/g, '""')}"`,
                `"${(m.department || '').replace(/"/g, '""')}"`,
                m.totalCustomers,
                m.totalWorkOrders,
                m.inProgressWOs,
                m.completedWOs,
                m.totalWOValueQAR.toFixed(2),
                m.totalOpportunities,
                m.wonOpportunities,
                m.pipelineValueQAR.toFixed(2),
                m.wonValueQAR.toFixed(2),
                `${winRate}%`,
                m.totalLeads,
                m.convertedLeads,
                `${convRate}%`
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `CRM_Employee_Wise_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatCurrency = (val: number) => {
        if (!val) return '0.00 QAR';
        return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} QAR`;
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:m-0 print:max-w-full">
            {/* Printable Report Header (Hidden on screen, visible on print) */}
            <div className="hidden print:block mb-6 border-b-2 border-slate-800 pb-4 text-center print:break-inside-avoid">
                <h1 className="text-2xl font-black tracking-wider uppercase text-slate-900">KAA ENTERPRISE ERP — CRM & SALES PERFORMANCE</h1>
                <h2 className="text-lg font-bold text-slate-700 uppercase tracking-wide mt-1">EMPLOYEE-WISE PERFORMANCE & CALL-OFF ORDER REGISTER</h2>
                <p className="text-xs text-slate-500 mt-1">
                    Period: <span className="font-semibold text-slate-800">{periodFilter.replace(/_/g, ' ')}</span> | Currency: <span className="font-semibold text-slate-800">QAR (Qatar Riyal)</span> | Date Generated: <span className="font-semibold text-slate-800">{new Date().toLocaleDateString('en-GB')}</span>
                </p>
            </div>

            {/* Top Header Card */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white shadow-inner">
                        <Users className="w-6 h-6 text-indigo-300" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">Employee-Wise CRM & Sales Report</h2>
                            <span className="px-2.5 py-0.5 text-xs font-bold bg-white/20 rounded-full text-indigo-200">
                                Corporate Performance
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-blue-200 mt-1">
                            Breakdown of Call-Off Contracts, Work Orders, Pipeline Deals, and Client Accounts per Employee
                        </p>
                    </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 shadow-sm cursor-pointer"
                        title="Print clean multi-page document"
                    >
                        <Printer size={15} />
                        <span>Print Report</span>
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 shadow-sm cursor-pointer"
                        title="Download CSV spreadsheet"
                    >
                        <Download size={15} />
                        <span>Export CSV</span>
                    </button>
                    <button
                        onClick={() => fetchReportData(true)}
                        disabled={refreshing}
                        className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-all cursor-pointer"
                        title="Reload report data"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-3 no-print">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* Live Search */}
                    <div className="relative min-w-[220px] flex-1 max-w-sm">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search employee by name, code, role…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-200 font-medium"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                                ×
                            </button>
                        )}
                    </div>

                    {/* Employee Selector Dropdown */}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">Employee:</span>
                        <select
                            value={selectedEmployeeFilter}
                            onChange={e => setSelectedEmployeeFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                            <option value="ALL">All Employees ({employeeMetrics.length})</option>
                            {employeeMetrics.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.name} {m.employee_code ? `(${m.employee_code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Period Selector */}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">Period:</span>
                        <select
                            value={periodFilter}
                            onChange={e => setPeriodFilter(e.target.value as any)}
                            className="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                            <option value="ALL">All Dates</option>
                            <option value="THIS_MONTH">This Month</option>
                            <option value="LAST_MONTH">Last Month</option>
                            <option value="THIS_QUARTER">This Quarter</option>
                            <option value="THIS_YEAR">This Year</option>
                        </select>
                    </div>
                </div>

                <span className="text-xs text-slate-500 font-semibold">
                    Showing <strong className="text-slate-800 dark:text-white font-bold">{filteredMetrics.length}</strong> active profiles
                </span>
            </div>

            {/* KPI Executive Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 no-print">
                {/* Total Work Orders */}
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Call-Off Work Orders</span>
                        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                            <FileCheck size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{overallStats.totalWOs}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        <span className="text-amber-600 font-bold">{overallStats.inProgressWOs} in progress</span> · <span className="text-emerald-600 font-bold">{overallStats.completedWOs} completed</span>
                    </p>
                </div>

                {/* Total Logged Value (QAR) */}
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Work Order Value</span>
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(overallStats.totalWOValue)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">Total revenue booked on call-off basis</p>
                </div>

                {/* Total Pipeline & Won Value */}
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deals Pipeline</span>
                        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(overallStats.totalPipelineVal)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        Won: <strong className="text-emerald-600">{formatCurrency(overallStats.totalWonVal)}</strong> ({overallStats.winRate.toFixed(1)}% win rate)
                    </p>
                </div>

                {/* Leads & Conversion */}
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Leads & Accounts</span>
                        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                            <Award size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                        {overallStats.totalLeads} <span className="text-xs text-slate-400 font-semibold font-sans">Leads</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        <span className="text-emerald-600 font-bold">{overallStats.convertedLeads} converted</span> ({overallStats.conversionRate.toFixed(1)}% conversion)
                    </p>
                </div>
            </div>

            {/* Main Employee Performance Comparison Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden print:border print:border-slate-800 print:shadow-none print:rounded-none">
                <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left text-xs border-collapse print:text-[11px] print:w-full">
                        <thead className="print:table-header-group">
                            <tr className="bg-slate-100 dark:bg-zinc-800/90 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-zinc-700 text-[11px] font-bold uppercase tracking-wider print:bg-slate-200 print:text-black">
                                <th className="py-3 px-3 w-12 text-center">#</th>
                                <th className="py-3 px-4 min-w-[200px]">Employee / Sales Rep</th>
                                <th className="py-3 px-3 text-center min-w-[90px]">Clients</th>
                                <th className="py-3 px-3 text-center min-w-[100px]">Work Orders</th>
                                <th className="py-3 px-3 text-center min-w-[90px]">In Progress</th>
                                <th className="py-3 px-3 text-center min-w-[90px]">Completed</th>
                                <th className="py-3 px-4 text-right min-w-[130px]">WO Value (QAR)</th>
                                <th className="py-3 px-3 text-center min-w-[90px]">Deals</th>
                                <th className="py-3 px-4 text-right min-w-[130px]">Pipeline (QAR)</th>
                                <th className="py-3 px-3 text-center min-w-[90px]">Win Rate</th>
                                <th className="py-3 px-3 text-center min-w-[90px]">Leads</th>
                                <th className="py-3 px-3 w-20 text-center no-print">Action</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 print:divide-slate-300">
                            {loading ? (
                                <tr>
                                    <td colSpan={12} className="py-16 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                                            <span className="font-semibold text-slate-600 dark:text-slate-400">Compiling Employee CRM metrics…</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredMetrics.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="py-16 text-center text-slate-400">
                                        <Users className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-zinc-700" />
                                        <p className="font-bold text-slate-600 dark:text-slate-400">No employee records match the filter criteria</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredMetrics.map((emp, idx) => {
                                    const isExpanded = expandedEmployeeId === emp.id;
                                    const winRate = emp.totalOpportunities > 0 ? (emp.wonOpportunities / emp.totalOpportunities) * 100 : 0;

                                    return (
                                        <React.Fragment key={emp.id}>
                                            <tr
                                                onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                                                className={`cursor-pointer transition-colors hover:bg-indigo-50/40 dark:hover:bg-zinc-800/60 print:break-inside-avoid print:text-black ${
                                                    idx % 2 === 1 ? 'bg-slate-50/40 dark:bg-zinc-900/40 print:bg-slate-50/50' : 'print:bg-white'
                                                } ${isExpanded ? 'bg-indigo-50/60 dark:bg-indigo-950/20' : ''}`}
                                            >
                                                {/* Index / Expand indicator */}
                                                <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className="no-print">
                                                            {isExpanded ? (
                                                                <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                                                            ) : (
                                                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                                            )}
                                                        </span>
                                                        <span>{idx + 1}</span>
                                                    </div>
                                                </td>

                                                {/* Employee Name & Title */}
                                                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                                                            {emp.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold leading-tight">{emp.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-normal">
                                                                {emp.employee_code ? `${emp.employee_code} · ` : ''}{emp.designation || 'Sales Representative'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Managed Clients */}
                                                <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                                    {emp.totalCustomers}
                                                </td>

                                                {/* Total Work Orders */}
                                                <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                                                    {emp.totalWorkOrders}
                                                </td>

                                                {/* In Progress */}
                                                <td className="py-3 px-3 text-center font-bold text-amber-600 dark:text-amber-400">
                                                    {emp.inProgressWOs}
                                                </td>

                                                {/* Completed */}
                                                <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                                    {emp.completedWOs}
                                                </td>

                                                {/* Work Order Value */}
                                                <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                                    {emp.totalWOValueQAR > 0 ? formatCurrency(emp.totalWOValueQAR) : '—'}
                                                </td>

                                                {/* Opportunities */}
                                                <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                                    {emp.totalOpportunities}
                                                </td>

                                                {/* Pipeline Value */}
                                                <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                    {emp.pipelineValueQAR > 0 ? formatCurrency(emp.pipelineValueQAR) : '—'}
                                                </td>

                                                {/* Win Rate */}
                                                <td className="py-3 px-3 text-center font-bold">
                                                    {emp.totalOpportunities > 0 ? (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            winRate >= 50 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                                            winRate > 0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                                                            'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400'
                                                        }`}>
                                                            {winRate.toFixed(0)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">—</span>
                                                    )}
                                                </td>

                                                {/* Leads */}
                                                <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                                    {emp.totalLeads}
                                                </td>

                                                {/* Action */}
                                                <td className="py-3 px-3 text-center no-print">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setExpandedEmployeeId(isExpanded ? null : emp.id);
                                                        }}
                                                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 transition-colors"
                                                    >
                                                        {isExpanded ? 'Hide' : 'Details'}
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Drill-down Detail Panel for Expanded Employee */}
                                            {isExpanded && (
                                                <tr className="bg-indigo-50/30 dark:bg-zinc-950/60 border-y border-indigo-100 dark:border-zinc-800 print:break-inside-avoid">
                                                    <td colSpan={12} className="py-4 px-6">
                                                        <div className="space-y-4">
                                                            {/* Sub-Tabs for Drill-down */}
                                                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 dark:border-zinc-800 pb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDetailTab('WORK_ORDERS')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                            detailTab === 'WORK_ORDERS'
                                                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                                                : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50'
                                                                        }`}
                                                                    >
                                                                        Call-Off Work Orders ({emp.workOrdersList.length})
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDetailTab('OPPORTUNITIES')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                            detailTab === 'OPPORTUNITIES'
                                                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                                                : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50'
                                                                        }`}
                                                                    >
                                                                        Opportunities / Deals ({emp.opportunitiesList.length})
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDetailTab('CUSTOMERS')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                            detailTab === 'CUSTOMERS'
                                                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                                                : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50'
                                                                        }`}
                                                                    >
                                                                        Managed Accounts ({emp.customersList.length})
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDetailTab('LEADS')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                            detailTab === 'LEADS'
                                                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                                                : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50'
                                                                        }`}
                                                                    >
                                                                        Leads ({emp.leadsList.length})
                                                                    </button>
                                                                </div>

                                                                <span className="text-xs text-slate-500 font-medium">
                                                                    Viewing records assigned to <strong className="text-slate-800 dark:text-white">{emp.name}</strong>
                                                                </span>
                                                            </div>

                                                            {/* TAB 1: WORK ORDERS LIST */}
                                                            {detailTab === 'WORK_ORDERS' && (
                                                                <div>
                                                                    {emp.workOrdersList.length === 0 ? (
                                                                        <p className="text-xs text-slate-400 italic py-3 text-center">No call-off work orders assigned to this employee</p>
                                                                    ) : (
                                                                        <div className="overflow-x-auto bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                                                                            <table className="w-full text-xs">
                                                                                <thead>
                                                                                    <tr className="bg-slate-50 dark:bg-zinc-800/80 font-bold border-b border-slate-200 dark:border-zinc-700 text-slate-600">
                                                                                        <th className="py-2 px-3">PO / WO Number</th>
                                                                                        <th className="py-2 px-3">Client</th>
                                                                                        <th className="py-2 px-3">Description</th>
                                                                                        <th className="py-2 px-3">Contract Ref</th>
                                                                                        <th className="py-2 px-3 text-right">Amount (QAR)</th>
                                                                                        <th className="py-2 px-3 text-center">Status</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                                                    {emp.workOrdersList.map((wo: any) => (
                                                                                        <tr key={wo.id}>
                                                                                            <td className="py-2 px-3 font-mono font-bold text-indigo-600">{wo.wo_number}</td>
                                                                                            <td className="py-2 px-3 font-semibold">{wo.customer?.name || '—'}</td>
                                                                                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{wo.description}</td>
                                                                                            <td className="py-2 px-3 text-slate-500">{wo.contract_ref || '—'}</td>
                                                                                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                                                {formatCurrency(wo.amountQAR)}
                                                                                            </td>
                                                                                            <td className="py-2 px-3 text-center">
                                                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                                                    wo.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                                                                                    wo.status === 'In Progress' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                                                                                }`}>
                                                                                                    {wo.status}
                                                                                                </span>
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* TAB 2: OPPORTUNITIES LIST */}
                                                            {detailTab === 'OPPORTUNITIES' && (
                                                                <div>
                                                                    {emp.opportunitiesList.length === 0 ? (
                                                                        <p className="text-xs text-slate-400 italic py-3 text-center">No opportunities assigned to this employee</p>
                                                                    ) : (
                                                                        <div className="overflow-x-auto bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                                                                            <table className="w-full text-xs">
                                                                                <thead>
                                                                                    <tr className="bg-slate-50 dark:bg-zinc-800/80 font-bold border-b border-slate-200 dark:border-zinc-700 text-slate-600">
                                                                                        <th className="py-2 px-3">Opportunity Title</th>
                                                                                        <th className="py-2 px-3">Client</th>
                                                                                        <th className="py-2 px-3 text-right">Amount (QAR)</th>
                                                                                        <th className="py-2 px-3 text-center">Probability</th>
                                                                                        <th className="py-2 px-3 text-center">Status</th>
                                                                                        <th className="py-2 px-3 text-right">Closing Date</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                                                    {emp.opportunitiesList.map((opp: any) => (
                                                                                        <tr key={opp.id}>
                                                                                            <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{opp.title}</td>
                                                                                            <td className="py-2 px-3">{opp.customer?.name || '—'}</td>
                                                                                            <td className="py-2 px-3 text-right font-mono font-bold text-indigo-600">
                                                                                                {formatCurrency(opp.amountQAR)}
                                                                                            </td>
                                                                                            <td className="py-2 px-3 text-center font-bold">{opp.probability || 0}%</td>
                                                                                            <td className="py-2 px-3 text-center">
                                                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                                                    opp.status === 'Won' ? 'bg-emerald-100 text-emerald-800' :
                                                                                                    opp.status === 'Lost' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                                                                                                }`}>
                                                                                                    {opp.status || 'Open'}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-2 px-3 text-right text-slate-500">
                                                                                                {opp.expected_closing_date ? formatLocalDate(opp.expected_closing_date) : '—'}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* TAB 3: CUSTOMERS LIST */}
                                                            {detailTab === 'CUSTOMERS' && (
                                                                <div>
                                                                    {emp.customersList.length === 0 ? (
                                                                        <p className="text-xs text-slate-400 italic py-3 text-center">No corporate accounts mapped to this representative</p>
                                                                    ) : (
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                                                            {emp.customersList.map((c: any) => (
                                                                                <div key={c.id} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{c.name}</p>
                                                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                                                                            c.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                                                        }`}>
                                                                                            {c.status}
                                                                                        </span>
                                                                                    </div>
                                                                                    {c.contract_number && (
                                                                                        <p className="text-[11px] font-mono text-blue-600 mt-1">Contract: {c.contract_number}</p>
                                                                                    )}
                                                                                    {c.contract_title && (
                                                                                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{c.contract_title}</p>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* TAB 4: LEADS LIST */}
                                                            {detailTab === 'LEADS' && (
                                                                <div>
                                                                    {emp.leadsList.length === 0 ? (
                                                                        <p className="text-xs text-slate-400 italic py-3 text-center">No leads assigned to this employee</p>
                                                                    ) : (
                                                                        <div className="overflow-x-auto bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                                                                            <table className="w-full text-xs">
                                                                                <thead>
                                                                                    <tr className="bg-slate-50 dark:bg-zinc-800/80 font-bold border-b border-slate-200 dark:border-zinc-700 text-slate-600">
                                                                                        <th className="py-2 px-3">Lead / Contact Name</th>
                                                                                        <th className="py-2 px-3">Organization</th>
                                                                                        <th className="py-2 px-3 text-center">Status</th>
                                                                                        <th className="py-2 px-3 text-right">Created Date</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                                                    {emp.leadsList.map((lead: any) => (
                                                                                        <tr key={lead.id}>
                                                                                            <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                                                                                                {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unnamed Lead'}
                                                                                            </td>
                                                                                            <td className="py-2 px-3">{lead.organization_name || '—'}</td>
                                                                                            <td className="py-2 px-3 text-center">
                                                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                                                                                    {lead.status}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-2 px-3 text-right text-slate-500">
                                                                                                {lead.created_at ? formatLocalDate(lead.created_at) : '—'}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>

                        {/* Totals Footer */}
                        {filteredMetrics.length > 0 && (
                            <tfoot className="print:table-footer-group">
                                <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white font-extrabold border-t-2 border-slate-300 dark:border-zinc-700 text-xs print:bg-slate-200 print:text-black print:break-inside-avoid">
                                    <td className="py-3 px-3 text-center"></td>
                                    <td className="py-3 px-4 uppercase tracking-wider">
                                        Total ({overallStats.totalReps} Representatives)
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                        {filteredMetrics.reduce((s, m) => s + m.totalCustomers, 0)}
                                    </td>
                                    <td className="py-3 px-3 text-center font-mono">{overallStats.totalWOs}</td>
                                    <td className="py-3 px-3 text-center text-amber-600 dark:text-amber-400">{overallStats.inProgressWOs}</td>
                                    <td className="py-3 px-3 text-center text-emerald-600 dark:text-emerald-400">{overallStats.completedWOs}</td>
                                    <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(overallStats.totalWOValue)}
                                    </td>
                                    <td className="py-3 px-3 text-center font-mono">{overallStats.totalOpps}</td>
                                    <td className="py-3 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">
                                        {formatCurrency(overallStats.totalPipelineVal)}
                                    </td>
                                    <td className="py-3 px-3 text-center font-bold">
                                        {overallStats.winRate.toFixed(1)}%
                                    </td>
                                    <td className="py-3 px-3 text-center font-mono">{overallStats.totalLeads}</td>
                                    <td className="py-3 px-3 no-print"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Printable Sign-off Block */}
            <div className="hidden print:grid grid-cols-3 gap-8 mt-12 pt-8 border-t border-slate-300 text-center text-xs text-slate-600 print:break-inside-avoid">
                <div>
                    <div className="border-b border-slate-400 pb-12 mb-2"></div>
                    <p className="font-bold">Prepared By</p>
                    <p className="text-[10px] text-slate-400">Sales Coordinator / Operations</p>
                </div>
                <div>
                    <div className="border-b border-slate-400 pb-12 mb-2"></div>
                    <p className="font-bold">Verified By</p>
                    <p className="text-[10px] text-slate-400">CRM Manager / Commercial Lead</p>
                </div>
                <div>
                    <div className="border-b border-slate-400 pb-12 mb-2"></div>
                    <p className="font-bold">Approved By</p>
                    <p className="text-[10px] text-slate-400">Managing Director / CFO</p>
                </div>
            </div>
        </div>
    );
};
