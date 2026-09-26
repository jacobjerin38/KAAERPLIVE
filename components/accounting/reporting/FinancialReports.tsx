import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
    Calendar, Filter, FileText, TrendingUp, TrendingDown, ChevronDown, ChevronRight,
    Search, AlertCircle, Clock, CheckCircle2, Layers, Receipt, ArrowRight, ChevronUp, RefreshCw
} from 'lucide-react';
import { QatarVATReport } from './QatarVATReport';
import { PrintButton } from '../../ui/PrintButton';
import { formatLocalDate } from '../../../lib/dateFormat';
import { PeriodFilter, PeriodPreset, getDatesForPreset } from '../common/PeriodFilter';


export const FinancialReports: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [activeReport, setActiveReport] = useState<'bs' | 'pl' | 'tb' | 'sl' | 'pl_report' | 'ea' | 'aging' | 'vat'>('bs');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [companyCurrency, setCompanyCurrency] = useState('QAR');
    const [partnerType, setPartnerType] = useState<'Customer' | 'Vendor'>('Customer');

    // Collapsed sections for ledger reports
    const [expandedLedgers, setExpandedLedgers] = useState<Record<string, boolean>>({});

    // Expanded rows for Aging report invoice drill-down
    const [expandedAgingPartners, setExpandedAgingPartners] = useState<Record<string, boolean>>({});
    const [agingSearch, setAgingSearch] = useState('');

    // Cost Centers for filtering (only for P&L)
    const [costCenters, setCostCenters] = useState<any[]>([]);
    const [selectedCC, setSelectedCC] = useState('');
    const [selectedProjectCC, setSelectedProjectCC] = useState('');
    const [selectedContractCC, setSelectedContractCC] = useState('');

    // Filters
    const [preset, setPreset] = useState<PeriodPreset>('this_month');
    const [startDate, setStartDate] = useState<string>(() => getDatesForPreset('this_month').startDate);
    const [endDate, setEndDate] = useState<string>(() => getDatesForPreset('this_month').endDate);


    useEffect(() => {
        if (currentCompanyId) {
            fetchCompanyCurrency();
            fetchCostCenters();
        }
    }, [currentCompanyId]);

    const fetchCompanyCurrency = async () => {
        if (!currentCompanyId) return;
        try {
            const { data } = await supabase.from('companies').select('currency').eq('id', currentCompanyId).maybeSingle();
            if (data?.currency) setCompanyCurrency(data.currency);
        } catch (e) {
            console.error('Error fetching currency:', e);
        }
    };

    const fetchCostCenters = async () => {
        if (!currentCompanyId) return;
        const { data } = await supabase.from('accounting_cost_centers')
            .select('id, name, code, type')
            .eq('company_id', currentCompanyId)
            .eq('is_active', true);
        setCostCenters(data || []);
    };

    useEffect(() => { 
        setReportData(null);
        if (currentCompanyId) fetchReport(); 
    }, [activeReport, startDate, endDate, partnerType, selectedCC, selectedProjectCC, selectedContractCC, currentCompanyId]);

    const fetchReport = async () => {
        if (!currentCompanyId) return;
        if (activeReport === 'vat') return;
        setLoading(true);
        try {
            let data: any = null;
            let error: any = null;

            if (activeReport === 'bs') {
                const res = await supabase.rpc('rpc_get_accounting_balance_sheet', { p_date: endDate, p_company_id: currentCompanyId || null });
                data = res.data; error = res.error;
            } else if (activeReport === 'pl') {
                const res = await supabase.rpc('rpc_get_accounting_profit_loss', { 
                    p_start_date: startDate, 
                    p_end_date: endDate,
                    p_cost_center_id: selectedCC || null,
                    p_project_cost_center_id: selectedProjectCC || null,
                    p_contract_cost_center_id: selectedContractCC || null,
                    p_company_id: currentCompanyId || null
                });
                data = res.data; error = res.error;
            } else if (activeReport === 'tb') {
                const res = await supabase.rpc('rpc_get_accounting_trial_balance', { p_date: endDate, p_company_id: currentCompanyId || null });
                data = res.data; error = res.error;
            } else if (activeReport === 'aging') {
                const targetMoveType = partnerType === 'Customer' ? 'out_invoice' : 'in_invoice';
                const [agingRes, invRes] = await Promise.all([
                    supabase.rpc('rpc_get_accounting_partner_aging', {
                        p_partner_type: partnerType,
                        p_date: endDate,
                        p_company_id: currentCompanyId || null
                    }),
                    supabase
                        .from('accounting_journal_entries')
                        .select(`
                            id, reference, supplier_invoice_number, client_po_number,
                            date, due_date, move_type, state, amount_total, amount_residual,
                            partner_id, notes,
                            partner:accounting_partners!partner_id(name)
                        `)
                        .eq('company_id', currentCompanyId)
                        .eq('state', 'Posted')
                        .gt('amount_residual', 0)
                        .order('date', { ascending: false })
                ]);

                if (agingRes.error) throw agingRes.error;
                const agingRows = agingRes.data || [];
                const openInvoices = invRes.data || [];

                // Group open invoices by partner_id
                const invoicesByPartner = new Map<string, any[]>();
                const targetDate = new Date(endDate);

                openInvoices.forEach((inv: any) => {
                    const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.date);
                    const diffTime = targetDate.getTime() - dueDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const overdueDays = diffDays > 0 ? diffDays : 0;

                    let bucket = 'Current';
                    if (overdueDays > 90) bucket = '90+ Days';
                    else if (overdueDays > 60) bucket = '61-90 Days';
                    else if (overdueDays > 30) bucket = '31-60 Days';
                    else if (overdueDays > 0) bucket = '1-30 Days';

                    const enrichedInv = {
                        ...inv,
                        partner_name: inv.partner?.name || '',
                        days_overdue: overdueDays,
                        bucket: bucket,
                        is_overdue: overdueDays > 0,
                        paid_amount: Math.max(0, (Number(inv.amount_total) || 0) - (Number(inv.amount_residual) || 0))
                    };

                    if (inv.partner_id) {
                        if (!invoicesByPartner.has(inv.partner_id)) {
                            invoicesByPartner.set(inv.partner_id, []);
                        }
                        invoicesByPartner.get(inv.partner_id)!.push(enrichedInv);
                    }
                });

                const enrichedAging = agingRows.map((row: any) => {
                    const pInvs = (row.partner_id ? invoicesByPartner.get(row.partner_id) : []) || [];
                    return {
                        ...row,
                        invoices: pInvs
                    };
                });

                // Include any partners who have open invoices of matching move_type but not present in agingRows
                const includedPartnerIds = new Set(enrichedAging.map((r: any) => r.partner_id).filter(Boolean));
                invoicesByPartner.forEach((invs, pId) => {
                    const relevantInvs = invs.filter(i => !i.move_type || i.move_type === targetMoveType);
                    if (!includedPartnerIds.has(pId) && relevantInvs.length > 0) {
                        let current = 0, b30 = 0, b60 = 0, b90 = 0, b90p = 0, total = 0;
                        relevantInvs.forEach(i => {
                            const res = Number(i.amount_residual) || 0;
                            total += res;
                            if (i.days_overdue === 0) current += res;
                            else if (i.days_overdue <= 30) b30 += res;
                            else if (i.days_overdue <= 60) b60 += res;
                            else if (i.days_overdue <= 90) b90 += res;
                            else b90p += res;
                        });

                        enrichedAging.push({
                            partner_id: pId,
                            partner_name: relevantInvs[0].partner_name || 'Partner',
                            current,
                            bucket_30: b30,
                            bucket_60: b60,
                            bucket_90: b90,
                            bucket_90_plus: b90p,
                            total_overdue: total,
                            invoices: relevantInvs
                        });
                    }
                });

                data = enrichedAging;
                error = null;
            } else if (activeReport === 'sl') {
                const res = await supabase.rpc('rpc_get_accounting_sales_ledger_report', { p_start_date: startDate, p_end_date: endDate });
                data = res.data; error = res.error;
            } else if (activeReport === 'pl_report') {
                const res = await supabase.rpc('rpc_get_accounting_purchase_ledger_report', { p_start_date: startDate, p_end_date: endDate });
                data = res.data; error = res.error;
            } else if (activeReport === 'ea') {
                const res = await supabase.rpc('rpc_get_accounting_expense_analysis', { p_start_date: startDate, p_end_date: endDate, p_company_id: currentCompanyId || null });
                data = res.data; error = res.error;
            }

            if (error) throw error;
            setReportData(data);
        } catch (err: any) {
            console.error('Report fetch error:', err);
            setReportData(null);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        try {
            return new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: companyCurrency || 'QAR',
                maximumFractionDigits: 2
            }).format(amount || 0);
        } catch {
            return (companyCurrency || 'QAR') + ' ' + (amount || 0).toLocaleString();
        }
    };

    const toggleLedgerExpand = (name: string) => {
        setExpandedLedgers(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const toggleAgingPartnerExpand = (partnerKey: string) => {
        setExpandedAgingPartners(prev => ({ ...prev, [partnerKey]: !prev[partnerKey] }));
    };

    const handleToggleAllAging = (expand: boolean) => {
        if (!Array.isArray(reportData)) return;
        const newState: Record<string, boolean> = {};
        reportData.forEach((r: any, idx: number) => {
            const key = r.partner_id || r.partner_name || `partner-${idx}`;
            newState[key] = expand;
        });
        setExpandedAgingPartners(newState);
    };

    const AccountSection = ({ title, accounts, total, color = 'text-slate-800' }: any) => (
        <div className="space-y-3 mb-6">
            <h3 className={`font-bold text-lg border-b pb-2 ${color}`}>{title}</h3>
            <div className="space-y-1">
                {accounts && accounts.length > 0 ? (
                    accounts.map((acc: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm py-1 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded px-1">
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-700 dark:text-slate-300">{acc.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{acc.code}</span>
                            </div>
                            <span className="font-mono font-semibold">{formatCurrency(acc.balance)}</span>
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-slate-400 italic px-1">No activity.</p>
                )}
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-slate-100 dark:border-zinc-800 px-1 mt-2">
                <span className="text-slate-500 uppercase text-[10px] tracking-wider">Total {title}</span>
                <span className={color}>{formatCurrency(total)}</span>
            </div>
        </div>
    );

    const ReportSection = ({ title, items, color, total }: any) => {
        const calculatedTotal = total !== undefined ? total : (items?.reduce((sum: number, i: any) => sum + (Number(i.balance) || 0), 0) || 0);
        return (
            <div className="space-y-4">
                <div className={`flex items-center justify-between border-b-2 pb-2 ${color}`}>
                    <h3 className="font-bold text-lg">{title}</h3>
                    <span className="text-xl font-black">{formatCurrency(calculatedTotal)}</span>
                </div>
                <div className="space-y-1">
                    {items && items.length > 0 ? (
                        items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm py-2 px-2 hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-lg transition-colors">
                                <div>
                                    <p className="font-bold text-slate-700 dark:text-slate-200">{item.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{item.code} • {item.subtype}</p>
                                </div>
                                <p className="font-mono font-bold text-slate-600 dark:text-slate-400">{formatCurrency(item.balance)}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-slate-400 italic text-center py-4">No data available for this period.</p>
                    )}
                </div>
            </div>
        );
    };

    const genericCC = costCenters.filter(cc => cc.type === 'GENERIC');
    const projectCC = costCenters.filter(cc => cc.type === 'PROJECT');
    const contractCC = costCenters.filter(cc => cc.type === 'CONTRACT');

    return (
        <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm animate-page-enter">
                <div className="flex flex-wrap gap-2 no-print">
                    {[
                        { id: 'bs', label: 'Balance Sheet' },
                        { id: 'pl', label: 'Profit & Loss' },
                        { id: 'tb', label: 'Trial Balance' },
                        { id: 'sl', label: 'Sales Ledger' },
                        { id: 'pl_report', label: 'Purchase Ledger' },
                        { id: 'ea', label: 'Expense Analysis' },
                        { id: 'aging', label: 'Aging Report' },
                        { id: 'vat', label: 'Qatar VAT' }
                    ].map(r => (
                        <button
                            key={r.id}
                            onClick={() => setActiveReport(r.id as any)}
                            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${activeReport === r.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end no-print">
                    {activeReport === 'aging' && (
                        <select 
                            value={partnerType} 
                            onChange={e => setPartnerType(e.target.value as any)}
                            className="p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold focus:ring-2 ring-indigo-500/20 outline-none"
                        >
                            <option value="Customer">Receivables</option>
                            <option value="Vendor">Payables</option>
                        </select>
                    )}
                    <PrintButton className="w-full md:w-auto justify-center" />
                </div>
            </div>

            {/* Period Filter Card */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3 no-print">
                <PeriodFilter
                    preset={preset}
                    startDate={startDate}
                    endDate={endDate}
                    showDateInputs={true}
                    onPeriodChange={(newStart, newEnd, newPreset) => {
                        setStartDate(newStart);
                        setEndDate(newEnd);
                        setPreset(newPreset);
                    }}
                />
            </div>

            {/* Cost Center Filters for Profit & Loss */}
            {activeReport === 'pl' && (
                <div className="flex flex-wrap gap-4 bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 text-sm no-print">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-500 uppercase text-xs">Project:</span>
                        <select
                            value={selectedProjectCC}
                            onChange={e => setSelectedProjectCC(e.target.value)}
                            className="p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-xs outline-none"
                        >
                            <option value="">All Projects</option>
                            {projectCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-500 uppercase text-xs">Contract:</span>
                        <select
                            value={selectedContractCC}
                            onChange={e => setSelectedContractCC(e.target.value)}
                            className="p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-xs outline-none"
                        >
                            <option value="">All Contracts</option>
                            {contractCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-500 uppercase text-xs">Cost Center:</span>
                        <select
                            value={selectedCC}
                            onChange={e => setSelectedCC(e.target.value)}
                            className="p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-xs outline-none"
                        >
                            <option value="">All Generic</option>
                            {genericCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>)}
                        </select>
                    </div>
                </div>
            )}

            <div className="flex-1 bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-y-auto shadow-sm min-h-[500px]">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-full text-slate-400 animate-pulse">
                        <FileText className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-bold tracking-widest uppercase text-xs">Generating Report...</p>
                    </div>
                ) : activeReport === 'vat' ? (
                    <QatarVATReport 
                        currentCompanyId={currentCompanyId} 
                        startDate={startDate} 
                        endDate={endDate} 
                        formatCurrency={formatCurrency} 
                    />
                ) : !reportData ? (
                    <div className="flex flex-col justify-center items-center h-full text-slate-400 py-12">
                         <FileText className="w-16 h-16 mb-4 opacity-10" />
                         <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">No data found for the selected period</p>
                         <p className="text-xs text-slate-400">
                             Selected range: {startDate} to {endDate}. Try selecting{' '}
                             <button type="button" onClick={() => { const { startDate: s, endDate: e } = getDatesForPreset('all'); setStartDate(s); setEndDate(e); setPreset('all'); }} className="text-violet-600 font-bold hover:underline cursor-pointer">All Dates</button> or{' '}
                             <button type="button" onClick={() => { const { startDate: s, endDate: e } = getDatesForPreset('august_2026'); setStartDate(s); setEndDate(e); setPreset('august_2026'); }} className="text-violet-600 font-bold hover:underline cursor-pointer">August 2026</button>.
                         </p>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white mb-2">
                                {activeReport === 'bs' ? 'Balance Sheet' : 
                                 activeReport === 'pl' ? 'Profit & Loss Statement' :
                                 activeReport === 'tb' ? 'Trial Balance' : 
                                 activeReport === 'sl' ? 'Sales Ledger Report' : 
                                 activeReport === 'pl_report' ? 'Purchase Ledger Report' : 
                                 activeReport === 'ea' ? 'Expense Analysis Report' : 'Aging Analysis'}
                            </h2>
                            <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
                                <Calendar className="w-4 h-4" />
                                {endDate} {(activeReport === 'pl' || activeReport === 'sl' || activeReport === 'pl_report' || activeReport === 'ea') && `(From ${startDate})`}
                            </div>
                        </div>

                        {activeReport === 'bs' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div>
                                    <AccountSection
                                        title="Assets"
                                        accounts={reportData.assets}
                                        total={reportData.assets?.reduce((sum: number, a: any) => sum + (Number(a.balance) || 0), 0)}
                                        color="text-emerald-600"
                                    />
                                </div>
                                <div className="space-y-8">
                                    <AccountSection
                                        title="Liabilities"
                                        accounts={reportData.liabilities}
                                        total={reportData.liabilities?.reduce((sum: number, a: any) => sum + (Number(a.balance) || 0), 0)}
                                        color="text-rose-600"
                                    />
                                    <AccountSection
                                        title="Equity"
                                        accounts={reportData.equity}
                                        total={reportData.equity?.reduce((sum: number, a: any) => sum + (Number(a.balance) || 0), 0)}
                                        color="text-indigo-600"
                                    />
                                    <div className="mt-8 p-4 bg-slate-900 dark:bg-black rounded-2xl flex justify-between items-center shadow-xl">
                                        <span className="text-white font-bold uppercase tracking-widest text-xs">Total Liab + Equity</span>
                                        <span className="text-white text-2xl font-black">{formatCurrency(
                                            (reportData.liabilities?.reduce((sum: number, a: any) => sum + (Number(a.balance) || 0), 0) || 0) +
                                            (reportData.equity?.reduce((sum: number, a: any) => sum + (Number(a.balance) || 0), 0) || 0)
                                        )}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeReport === 'pl' && (
                            <div className="space-y-8">
                                <ReportSection 
                                    title="1. Revenue" 
                                    items={reportData.revenue || []} 
                                    total={reportData.total_revenue}
                                    color="border-emerald-500 text-emerald-600" 
                                />

                                <ReportSection 
                                    title="2. Less: Cost of Sales" 
                                    items={reportData.cogs || []} 
                                    total={reportData.total_cogs}
                                    color="border-rose-500 text-rose-600" 
                                />

                                <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl flex justify-between items-center border border-slate-200 dark:border-zinc-700">
                                    <span className="font-bold uppercase tracking-wider text-sm text-slate-700 dark:text-slate-300">Gross Profit</span>
                                    <span className={`text-xl font-extrabold ${reportData.gross_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {formatCurrency(reportData.gross_profit)}
                                    </span>
                                </div>

                                <ReportSection 
                                    title="3. Add: Indirect Income" 
                                    items={reportData.indirect_income || []} 
                                    total={reportData.total_indirect_income}
                                    color="border-indigo-500 text-indigo-600" 
                                />

                                <ReportSection 
                                    title="4. Less: Indirect Expenses" 
                                    items={reportData.indirect_expense || []} 
                                    total={reportData.total_indirect_expense}
                                    color="border-amber-500 text-amber-600" 
                                />

                                <div className="mt-12 p-6 bg-indigo-600 rounded-3xl flex justify-between items-center shadow-2xl shadow-indigo-500/30 text-white">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Net Profit / (Loss)</p>
                                        <p className="text-3xl font-black mt-1">
                                            {formatCurrency(reportData.net_profit)}
                                        </p>
                                    </div>
                                    {reportData.net_profit >= 0 ? <TrendingUp className="w-12 h-12 opacity-20" /> : <TrendingDown className="w-12 h-12 opacity-20" />}
                                </div>
                            </div>
                        )}

                        {activeReport === 'tb' && Array.isArray(reportData) && (
                            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-zinc-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">Account Details</th>
                                            <th className="px-6 py-4 text-right">Debit</th>
                                            <th className="px-6 py-4 text-right">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {reportData.map((row: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-700 dark:text-slate-200">{row.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono">{row.code} • {row.type}</p>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-medium">{row.total_debit > 0 ? formatCurrency(row.total_debit) : '—'}</td>
                                                <td className="px-6 py-4 text-right font-mono font-medium">{row.total_credit > 0 ? formatCurrency(row.total_credit) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-900 dark:bg-black text-white font-bold">
                                        <tr>
                                            <td className="px-6 py-4 text-right uppercase text-[10px] tracking-widest">Totals</td>
                                            <td className="px-6 py-4 text-right font-mono text-lg">
                                                {formatCurrency(reportData.reduce((s: number, r: any) => s + (Number(r.total_debit) || 0), 0))}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-lg">
                                                {formatCurrency(reportData.reduce((s: number, r: any) => s + (Number(r.total_credit) || 0), 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {activeReport === 'aging' && Array.isArray(reportData) && (() => {
                            const filteredAgingRows = reportData.filter((r: any) => {
                                if (!agingSearch.trim()) return true;
                                const term = agingSearch.toLowerCase();
                                const matchPartner = (r.partner_name || '').toLowerCase().includes(term);
                                const matchInvoice = (r.invoices || []).some((inv: any) =>
                                    (inv.reference || '').toLowerCase().includes(term) ||
                                    (inv.supplier_invoice_number || '').toLowerCase().includes(term) ||
                                    (inv.client_po_number || '').toLowerCase().includes(term)
                                );
                                return matchPartner || matchInvoice;
                            });

                            const totalAll = filteredAgingRows.reduce((s: number, r: any) => s + (Number(r.total_overdue) || 0), 0);
                            const totalCurrent = filteredAgingRows.reduce((s: number, r: any) => s + (Number(r.current) || 0), 0);
                            const total30 = filteredAgingRows.reduce((s: number, r: any) => s + (Number(r.bucket_30) || 0), 0);
                            const total60 = filteredAgingRows.reduce((s: number, r: any) => s + (Number(r.bucket_60) || 0), 0);
                            const total90Plus = filteredAgingRows.reduce((s: number, r: any) => s + (Number(r.bucket_90) || 0) + (Number(r.bucket_90_plus) || 0), 0);
                            const totalInvoicesCount = filteredAgingRows.reduce((s: number, r: any) => s + (r.invoices?.length || 0), 0);

                            return (
                                <div className="space-y-4">
                                    {/* Aging KPI Summary Cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 no-print">
                                        <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                Total {partnerType === 'Customer' ? 'AR' : 'AP'} Balance
                                            </span>
                                            <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                                                {formatCurrency(totalAll)}
                                            </span>
                                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                                                {totalInvoicesCount} open {totalInvoicesCount === 1 ? 'invoice' : 'invoices'}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-2xs">
                                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                                                Current (Not Due)
                                            </span>
                                            <span className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                                                {formatCurrency(totalCurrent)}
                                            </span>
                                            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-0.5 block">
                                                Within payment terms
                                            </span>
                                        </div>
                                        <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30 shadow-2xs">
                                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                                                1 - 30 Days
                                            </span>
                                            <span className="text-base font-black text-amber-700 dark:text-amber-300 mt-0.5 block">
                                                {formatCurrency(total30)}
                                            </span>
                                            <span className="text-[10px] text-amber-600/80 dark:text-amber-400 mt-0.5 block">
                                                Recently overdue
                                            </span>
                                        </div>
                                        <div className="p-3 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl border border-orange-100 dark:border-orange-900/30 shadow-2xs">
                                            <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 uppercase tracking-wider block">
                                                31 - 60 Days
                                            </span>
                                            <span className="text-base font-black text-orange-700 dark:text-orange-300 mt-0.5 block">
                                                {formatCurrency(total60)}
                                            </span>
                                            <span className="text-[10px] text-orange-600/80 dark:text-orange-400 mt-0.5 block">
                                                Action required
                                            </span>
                                        </div>
                                        <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30 shadow-2xs col-span-2 md:col-span-1">
                                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">
                                                61+ Days Overdue
                                            </span>
                                            <span className="text-base font-black text-rose-700 dark:text-rose-300 mt-0.5 block">
                                                {formatCurrency(total90Plus)}
                                            </span>
                                            <span className="text-[10px] text-rose-600/80 dark:text-rose-400 mt-0.5 block">
                                                Critical follow-up
                                            </span>
                                        </div>
                                    </div>

                                    {/* Search & Bulk Toggle Controls */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
                                        <div className="relative w-full sm:w-72">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={agingSearch}
                                                onChange={e => setAgingSearch(e.target.value)}
                                                placeholder="Search partner or invoice reference..."
                                                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:ring-2 ring-indigo-500/20"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleAllAging(true)}
                                                className="px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                            >
                                                Expand All Invoices
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleAllAging(false)}
                                                className="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                            >
                                                Collapse All
                                            </button>
                                        </div>
                                    </div>

                                    {/* Main Table with Nested Invoices Sub-Table */}
                                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead className="bg-slate-50 dark:bg-zinc-800 font-black uppercase text-[9px] text-slate-400 tracking-widest">
                                                <tr>
                                                    <th className="px-4 py-4 min-w-[220px]">Partner & Open Invoices</th>
                                                    <th className="px-4 py-4 text-right">Current</th>
                                                    <th className="px-4 py-4 text-right">1-30 Days</th>
                                                    <th className="px-4 py-4 text-right">31-60 Days</th>
                                                    <th className="px-4 py-4 text-right">61-90 Days</th>
                                                    <th className="px-4 py-4 text-right">90+ Days</th>
                                                    <th className="px-4 py-4 text-right">Total Outstanding</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                {filteredAgingRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-400 italic">
                                                            No partner aging records found matching your filters.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredAgingRows.map((row: any, idx: number) => {
                                                        const partnerKey = row.partner_id || row.partner_name || `partner-${idx}`;
                                                        const isExpanded = !!expandedAgingPartners[partnerKey];
                                                        const invoices = row.invoices || [];

                                                        return (
                                                            <React.Fragment key={partnerKey}>
                                                                <tr
                                                                    className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                                                                    onClick={() => toggleAgingPartnerExpand(partnerKey)}
                                                                >
                                                                    <td className="px-4 py-4 font-bold text-slate-800 dark:text-slate-200">
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                type="button"
                                                                                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleAgingPartnerExpand(partnerKey);
                                                                                }}
                                                                            >
                                                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4" />}
                                                                            </button>
                                                                            <span className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                                                                                {row.partner_name}
                                                                            </span>
                                                                            {invoices.length > 0 ? (
                                                                                <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                                                                                    {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 text-[10px] font-medium">
                                                                                    On-Account
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-4 text-right font-mono text-slate-600 dark:text-slate-300">{formatCurrency(row.current)}</td>
                                                                    <td className="px-4 py-4 text-right font-mono text-slate-600 dark:text-slate-300">{formatCurrency(row.bucket_30)}</td>
                                                                    <td className="px-4 py-4 text-right font-mono text-slate-600 dark:text-slate-300">{formatCurrency(row.bucket_60)}</td>
                                                                    <td className="px-4 py-4 text-right font-mono text-slate-600 dark:text-slate-300">{formatCurrency(row.bucket_90)}</td>
                                                                    <td className="px-4 py-4 text-right font-mono text-slate-600 dark:text-slate-300">{formatCurrency(row.bucket_90_plus)}</td>
                                                                    <td className="px-4 py-4 text-right font-black font-mono text-slate-900 dark:text-white bg-slate-50/40 dark:bg-zinc-800/40">
                                                                        {formatCurrency(row.total_overdue)}
                                                                    </td>
                                                                </tr>

                                                                {/* Expanded Invoices Sub-Table */}
                                                                {isExpanded && (
                                                                    <tr>
                                                                        <td colSpan={7} className="p-0 bg-slate-50/70 dark:bg-zinc-900/60 border-y border-indigo-100 dark:border-indigo-900/30">
                                                                            <div className="p-4 space-y-2">
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                                        <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                                                                                        <span>Outstanding Invoices Breakdown for {row.partner_name}</span>
                                                                                    </div>
                                                                                    <span className="text-[11px] text-slate-400">
                                                                                        Aging calculated as of {endDate}
                                                                                    </span>
                                                                                </div>

                                                                                {invoices.length === 0 ? (
                                                                                    <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg text-xs text-slate-400 italic text-center">
                                                                                        No individual unsettled invoice lines recorded. The balance is held on general account or advance credits.
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800">
                                                                                        <table className="w-full text-xs text-left border-collapse">
                                                                                            <thead className="bg-slate-50 dark:bg-zinc-850 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-750">
                                                                                                <tr>
                                                                                                    <th className="px-3 py-2">Invoice Ref</th>
                                                                                                    <th className="px-3 py-2">Supplier Inv / PO</th>
                                                                                                    <th className="px-3 py-2">Invoice Date</th>
                                                                                                    <th className="px-3 py-2">Due Date</th>
                                                                                                    <th className="px-3 py-2 text-center">Overdue Status</th>
                                                                                                    <th className="px-3 py-2 text-right">Original Total</th>
                                                                                                    <th className="px-3 py-2 text-right">Paid to Date</th>
                                                                                                    <th className="px-3 py-2 text-right font-bold">Balance Due</th>
                                                                                                    <th className="px-3 py-2 text-center">Aging Bucket</th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-750">
                                                                                                {invoices.map((inv: any, iIdx: number) => {
                                                                                                    const overdueDays = inv.days_overdue || 0;
                                                                                                    return (
                                                                                                        <tr key={inv.id || iIdx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-700/20">
                                                                                                            <td className="px-3 py-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                                                                {inv.reference || '—'}
                                                                                                            </td>
                                                                                                            <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">
                                                                                                                {inv.supplier_invoice_number || inv.client_po_number || '—'}
                                                                                                            </td>
                                                                                                            <td className="px-3 py-2 text-slate-500">
                                                                                                                {inv.date || '—'}
                                                                                                            </td>
                                                                                                            <td className="px-3 py-2 text-slate-500">
                                                                                                                {inv.due_date || '—'}
                                                                                                            </td>
                                                                                                            <td className="px-3 py-2 text-center">
                                                                                                                {overdueDays === 0 ? (
                                                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                                                                                                        <CheckCircle2 className="w-2.5 h-2.5" /> Current
                                                                                                                    </span>
                                                                                                                ) : overdueDays <= 30 ? (
                                                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                                                                                                        <Clock className="w-2.5 h-2.5" /> {overdueDays}d overdue
                                                                                                                    </span>
                                                                                                                ) : overdueDays <= 60 ? (
                                                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                                                                                                                        <AlertCircle className="w-2.5 h-2.5" /> {overdueDays}d overdue
                                                                                                                    </span>
                                                                                                                ) : (
                                                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                                                                                                                        <AlertCircle className="w-2.5 h-2.5" /> {overdueDays}d overdue
                                                                                                                    </span>
                                                                                                                )}
                                                                                                            </td>
                                                                                                            <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                                                                                                {formatCurrency(Number(inv.amount_total) || 0)}
                                                                                                            </td>
                                                                                                            <td className="px-3 py-2 text-right font-mono text-slate-500">
                                                                                                                {formatCurrency(inv.paid_amount || 0)}
                                                                                                            </td>
                                                                                                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                                                                {formatCurrency(Number(inv.amount_residual) || 0)}
                                                                                                            </td>
                                                                                                            <td className="px-3 py-2 text-center">
                                                                                                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded text-[10px] font-semibold">
                                                                                                                    {inv.bucket}
                                                                                                                </span>
                                                                                                            </td>
                                                                                                        </tr>
                                                                                                    );
                                                                                                })}
                                                                                            </tbody>
                                                                                            <tfoot className="bg-slate-50 dark:bg-zinc-850 font-bold border-t border-slate-200 dark:border-zinc-700">
                                                                                                <tr>
                                                                                                    <td colSpan={7} className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-slate-500">
                                                                                                        Total Open Invoices for {row.partner_name}
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2 text-right font-mono font-black text-slate-900 dark:text-white">
                                                                                                        {formatCurrency(invoices.reduce((s: number, i: any) => s + (Number(i.amount_residual) || 0), 0))}
                                                                                                    </td>
                                                                                                    <td></td>
                                                                                                </tr>
                                                                                            </tfoot>
                                                                                        </table>
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
                                            <tfoot className="bg-slate-100 dark:bg-zinc-800 font-bold border-t-2">
                                                <tr>
                                                    <td className="px-4 py-4 uppercase text-[10px] tracking-widest">Grand Total</td>
                                                    <td className="px-4 py-4 text-right font-mono">{formatCurrency(totalCurrent)}</td>
                                                    <td className="px-4 py-4 text-right font-mono">{formatCurrency(total30)}</td>
                                                    <td className="px-4 py-4 text-right font-mono">{formatCurrency(total60)}</td>
                                                    <td className="px-4 py-4 text-right font-mono">{formatCurrency(filteredAgingRows.reduce((s: number, r: any) => s + (r.bucket_90 || 0), 0))}</td>
                                                    <td className="px-4 py-4 text-right font-mono">{formatCurrency(filteredAgingRows.reduce((s: number, r: any) => s + (r.bucket_90_plus || 0), 0))}</td>
                                                    <td className="px-4 py-4 text-right font-black font-mono text-lg">{formatCurrency(totalAll)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Sales Ledger & Purchase Ledger reports */}
                        {(activeReport === 'sl' || activeReport === 'pl_report') && Array.isArray(reportData) && (
                            <div className="space-y-6">
                                {reportData.map((row: any, idx: number) => {
                                    const isExpanded = !!expandedLedgers[row.ledger_name];
                                    return (
                                        <div key={idx} className="bg-slate-50 dark:bg-zinc-850 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                                            <div 
                                                className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 cursor-pointer hover:bg-slate-50/50"
                                                onClick={() => toggleLedgerExpand(row.ledger_name)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                                                    <div>
                                                        <h3 className="font-bold text-slate-800 dark:text-white">{row.ledger_name}</h3>
                                                        <p className="text-[10px] text-slate-400 font-mono">Account: {row.account_code} · {row.account_name}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(row.total_amount)}</span>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="p-4 bg-slate-50 dark:bg-zinc-900/50">
                                                    {row.transactions?.length === 0 ? (
                                                        <p className="text-xs text-slate-400 italic text-center py-4">No transactions recorded in this period.</p>
                                                    ) : (
                                                        <table className="w-full text-xs text-left border-collapse">
                                                            <thead>
                                                                <tr className="border-b border-slate-200 dark:border-zinc-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                    <th className="py-2">Date</th>
                                                                    <th className="py-2">Reference</th>
                                                                    <th className="py-2">Partner</th>
                                                                    <th className="py-2">Description</th>
                                                                    <th className="py-2 text-right">Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                                {row.transactions.map((tx: any, tIdx: number) => (
                                                                    <tr key={tIdx} className="hover:bg-slate-100/30">
                                                                        <td className="py-2 text-slate-500">{tx.date}</td>
                                                                        <td className="py-2 font-mono text-slate-600 dark:text-slate-400">{tx.reference || '—'}</td>
                                                                        <td className="py-2 text-slate-700 dark:text-slate-300">{tx.partner_name || '—'}</td>
                                                                        <td className="py-2 text-slate-700 dark:text-slate-300">{tx.description || '—'}</td>
                                                                        <td className="py-2 text-right font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(tx.amount)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Expense Analysis Report */}
                        {activeReport === 'ea' && Array.isArray(reportData) && (
                            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-zinc-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">Expense Type / Category</th>
                                            <th className="px-6 py-4">Account Details</th>
                                            <th className="px-6 py-4 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {reportData.map((row: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mr-2 ${row.type === 'Direct' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {row.type}
                                                    </span>
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">{row.category}</span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                    {row.account_code} — {row.account_name}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-rose-600">{formatCurrency(Number(row.amount))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-900 dark:bg-black text-white font-bold">
                                        <tr>
                                            <td colSpan={2} className="px-6 py-4 text-right uppercase text-[10px] tracking-widest">Total Expense Analyzed</td>
                                            <td className="px-6 py-4 text-right font-mono text-lg">
                                                {formatCurrency(reportData.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
