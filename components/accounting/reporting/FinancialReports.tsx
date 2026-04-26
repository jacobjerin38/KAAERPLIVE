import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Calendar, Filter, Download, FileText } from 'lucide-react';

interface ReportData {
    assets: any[];
    liabilities: any[];
    equity: any[];
    income: any[];
    expense: any[];
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    net_profit: number;
}

export const FinancialReports: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [activeReport, setActiveReport] = useState<'bs' | 'pl' | 'tb' | 'aging'>('bs');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [companyCurrency, setCompanyCurrency] = useState('QAR');
    const [partnerType, setPartnerType] = useState<'Customer' | 'Vendor'>('Customer');

    // Filters
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchCompanyCurrency();
            fetchReport();
        }
    }, [currentCompanyId, activeReport, startDate, endDate, partnerType]);

    const fetchCompanyCurrency = async () => {
        if (!currentCompanyId) return;
        try {
            const { data } = await supabase.from('companies').select('currency').eq('id', currentCompanyId).maybeSingle();
            if (data?.currency) setCompanyCurrency(data.currency);
        } catch (e) {
            console.error('Error fetching currency:', e);
        }
    };

    const fetchReport = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            if (activeReport === 'bs') {
                const { data, error } = await supabase.rpc('rpc_get_balance_sheet', { p_date: endDate });
                if (error) throw error;
                setReportData(data);
            } else if (activeReport === 'pl') {
                const { data, error } = await supabase.rpc('rpc_get_profit_loss', { p_start_date: startDate, p_end_date: endDate });
                if (error) throw error;
                setReportData(data);
            } else if (activeReport === 'tb') {
                const { data, error } = await supabase.rpc('rpc_get_trial_balance', { p_date: endDate });
                if (error) throw error;
                setReportData(data);
            } else if (activeReport === 'aging') {
                const { data, error } = await supabase.rpc('rpc_get_partner_aging', { p_partner_type: partnerType, p_date: endDate });
                if (error) throw error;
                setReportData(data);
            }
        } catch (err: any) {
            console.error(err);
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

    const ReportSection = ({ title, items, color }: any) => {
        const total = items?.reduce((sum: number, i: any) => sum + (Number(i.balance) || 0), 0) || 0;
        return (
            <div className="space-y-4">
                <div className={`flex items-center justify-between border-b-2 pb-2 ${color}`}>
                    <h3 className="font-bold text-lg">{title}</h3>
                    <span className="text-xl font-black">{formatCurrency(total)}</span>
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

    return (
        <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                <div className="flex flex-wrap gap-2">
                    {[
                        { id: 'bs', label: 'Balance Sheet' },
                        { id: 'pl', label: 'Profit & Loss' },
                        { id: 'tb', label: 'Trial Balance' },
                        { id: 'aging', label: 'Aging Report' }
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

                <div className="flex items-center gap-2 w-full md:w-auto">
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
                    {activeReport === 'pl' && (
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 ring-indigo-500/20 outline-none" />
                    )}
                    <span className="text-slate-400 hidden md:block">→</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 ring-indigo-500/20 outline-none" />
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-y-auto shadow-sm min-h-[500px]">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-full text-slate-400 animate-pulse">
                        <FileText className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-bold tracking-widest uppercase text-xs">Generating Report...</p>
                    </div>
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
                                 activeReport === 'tb' ? 'Trial Balance' : 'Aging Analysis'}
                            </h2>
                            <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
                                <Calendar className="w-4 h-4" />
                                {endDate} {activeReport === 'pl' && `(From ${startDate})`}
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
                            <div className="space-y-12">
                                <ReportSection title="Income / Revenue" items={reportData.income || []} color="border-emerald-500 text-emerald-600" />
                                <ReportSection title="Expenses" items={reportData.expense || []} color="border-rose-500 text-rose-600" />
                                <div className="mt-12 p-6 bg-indigo-600 rounded-3xl flex justify-between items-center shadow-2xl shadow-indigo-500/30 text-white">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Net Profit / (Loss)</p>
                                        <p className="text-3xl font-black mt-1">
                                            {formatCurrency(
                                                (reportData.income?.reduce((s: number, a: any) => s + (Number(a.balance) || 0), 0) || 0) -
                                                (reportData.expense?.reduce((s: number, a: any) => s + Math.abs(Number(a.balance) || 0), 0) || 0)
                                            )}
                                        </p>
                                    </div>
                                    <TrendingUp className="w-12 h-12 opacity-20" />
                                </div>
                            </div>
                        )}

                        {activeReport === 'tb' && (
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

                        {activeReport === 'aging' && (
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
                                        {(reportData as any[]).map((row: any, idx: number) => (
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
                    </div>
                )}
            </div>
        </div>
    );
};
