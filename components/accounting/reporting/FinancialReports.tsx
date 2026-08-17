import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Calendar, Filter, FileText, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import { QatarVATReport } from './QatarVATReport';
import { PrintButton } from '../../ui/PrintButton';


export const FinancialReports: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [activeReport, setActiveReport] = useState<'bs' | 'pl' | 'tb' | 'sl' | 'pl_report' | 'ea' | 'aging' | 'vat'>('bs');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [companyCurrency, setCompanyCurrency] = useState('QAR');
    const [partnerType, setPartnerType] = useState<'Customer' | 'Vendor'>('Customer');

    // Collapsed sections for ledger reports
    const [expandedLedgers, setExpandedLedgers] = useState<Record<string, boolean>>({});

    // Cost Centers for filtering (only for P&L)
    const [costCenters, setCostCenters] = useState<any[]>([]);
    const [selectedCC, setSelectedCC] = useState('');
    const [selectedProjectCC, setSelectedProjectCC] = useState('');
    const [selectedContractCC, setSelectedContractCC] = useState('');

    // Filters
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

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
                const res = await supabase.rpc('rpc_get_accounting_balance_sheet', { p_date: endDate });
                data = res.data; error = res.error;
            } else if (activeReport === 'pl') {
                const res = await supabase.rpc('rpc_get_accounting_profit_loss', { 
                    p_start_date: startDate, 
                    p_end_date: endDate,
                    p_cost_center_id: selectedCC || null,
                    p_project_cost_center_id: selectedProjectCC || null,
                    p_contract_cost_center_id: selectedContractCC || null
                });
                data = res.data; error = res.error;
            } else if (activeReport === 'tb') {
                const res = await supabase.rpc('rpc_get_accounting_trial_balance', { p_date: endDate });
                data = res.data; error = res.error;
            } else if (activeReport === 'aging') {
                const res = await supabase.rpc('rpc_get_accounting_partner_aging', { p_partner_type: partnerType, p_date: endDate });
                data = res.data; error = res.error;
            } else if (activeReport === 'sl') {
                const res = await supabase.rpc('rpc_get_accounting_sales_ledger_report', { p_start_date: startDate, p_end_date: endDate });
                data = res.data; error = res.error;
            } else if (activeReport === 'pl_report') {
                const res = await supabase.rpc('rpc_get_accounting_purchase_ledger_report', { p_start_date: startDate, p_end_date: endDate });
                data = res.data; error = res.error;
            } else if (activeReport === 'ea') {
                const res = await supabase.rpc('rpc_get_accounting_expense_analysis', { p_start_date: startDate, p_end_date: endDate });
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

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto no-print">
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
                    {(activeReport === 'pl' || activeReport === 'vat' || activeReport === 'sl' || activeReport === 'pl_report' || activeReport === 'ea') && (
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 ring-indigo-500/20 outline-none" />
                    )}
                    {(activeReport === 'tb' || activeReport === 'bs') ? null : <span className="text-slate-400 hidden md:block">→</span>}
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 ring-indigo-500/20 outline-none" />
                </div>
                <PrintButton className="w-full md:w-auto justify-center" />
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
                    <div className="flex flex-col justify-center items-center h-full text-slate-400">
                         <FileText className="w-16 h-16 mb-4 opacity-10" />
                         <p className="font-medium">No data found for the selected criteria.</p>
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

                        {activeReport === 'aging' && Array.isArray(reportData) && (
                            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-zinc-800 font-black uppercase text-[9px] text-slate-400 tracking-widest">
                                        <tr>
                                            <th className="px-4 py-4 min-w-[200px]">Partner</th>
                                            <th className="px-4 py-4 text-right">Current</th>
                                            <th className="px-4 py-4 text-right">1-30 Days</th>
                                            <th className="px-4 py-4 text-right">31-60 Days</th>
                                            <th className="px-4 py-4 text-right">61-90 Days</th>
                                            <th className="px-4 py-4 text-right">90+ Days</th>
                                            <th className="px-4 py-4 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {reportData.map((row: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-4 font-bold text-indigo-600 dark:text-indigo-400 underline decoration-indigo-500/30 underline-offset-4 cursor-pointer">{row.partner_name}</td>
                                                <td className="px-4 py-4 text-right font-mono">{formatCurrency(row.current)}</td>
                                                <td className="px-4 py-4 text-right font-mono">{formatCurrency(row.bucket_30)}</td>
                                                <td className="px-4 py-4 text-right font-mono">{formatCurrency(row.bucket_60)}</td>
                                                <td className="px-4 py-4 text-right font-mono">{formatCurrency(row.bucket_90)}</td>
                                                <td className="px-4 py-4 text-right font-mono">{formatCurrency(row.bucket_90_plus)}</td>
                                                <td className="px-4 py-4 text-right font-black font-mono text-slate-800 dark:text-white bg-slate-50/30 dark:bg-zinc-800/30">{formatCurrency(row.total_overdue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-100 dark:bg-zinc-800 font-bold border-t-2">
                                        <tr>
                                            <td className="px-4 py-4 uppercase text-[10px] tracking-widest">Grand Total</td>
                                            <td className="px-4 py-4 text-right font-mono">{formatCurrency(reportData.reduce((s: number, r: any) => s + (r.current || 0), 0))}</td>
                                            <td className="px-4 py-4 text-right font-mono">{formatCurrency(reportData.reduce((s: number, r: any) => s + (r.bucket_30 || 0), 0))}</td>
                                            <td className="px-4 py-4 text-right font-mono">{formatCurrency(reportData.reduce((s: number, r: any) => s + (r.bucket_60 || 0), 0))}</td>
                                            <td className="px-4 py-4 text-right font-mono">{formatCurrency(reportData.reduce((s: number, r: any) => s + (r.bucket_90 || 0), 0))}</td>
                                            <td className="px-4 py-4 text-right font-mono">{formatCurrency(reportData.reduce((s: number, r: any) => s + (r.bucket_90_plus || 0), 0))}</td>
                                            <td className="px-4 py-4 text-right font-black font-mono text-lg">{formatCurrency(reportData.reduce((s: number, r: any) => s + (r.total_overdue || 0), 0))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

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
