import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Calendar, Filter, Download } from 'lucide-react';

export const FinancialReports: React.FC = () => {
    const [activeReport, setActiveReport] = useState<'bs' | 'pl' | 'tb' | 'aging'>('bs');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [companyCurrency, setCompanyCurrency] = useState('USD');
    const [partnerType, setPartnerType] = useState<'Customer' | 'Vendor'>('Customer');

    // Filters
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        fetchCompanyCurrency();
    }, []);

    useEffect(() => {
        fetchReport();
    }, [activeReport, startDate, endDate, partnerType]);

    const fetchCompanyCurrency = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle();
                if (profile?.company_id) {
                    const { data } = await supabase.from('companies').select('currency').eq('id', profile.company_id).maybeSingle();
                    if (data?.currency) setCompanyCurrency(data.currency);
                }
            }
        } catch (e) {
            console.error('Error fetching currency:', e);
        }
    };

    const fetchReport = async () => {
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
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: companyCurrency }).format(amount);
        } catch {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
        }
    };

    const AccountSection = ({ title, accounts, total, color = 'text-slate-800' }: any) => (
        <div className="space-y-3 mb-6">
            <h3 className={`font-bold text-lg border-b pb-2 ${color}`}>{title}</h3>
            <div className="space-y-1">
                {accounts && accounts.length > 0 ? (
                    accounts.map((acc: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm py-1 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded">
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-700 dark:text-slate-300">{acc.name}</span>
                                <span className="text-xs text-slate-400">{acc.code}</span>
                            </div>
                            <span className="font-mono">{formatCurrency(acc.balance)}</span>
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-slate-400 italic">No activity.</p>
                )}
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span>Total {title}</span>
                <span>{formatCurrency(total)}</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col">
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveReport('bs')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeReport === 'bs'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                    >
                        Balance Sheet
                    </button>
                    <button
                        onClick={() => setActiveReport('pl')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeReport === 'pl'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                    >
                        Profit & Loss
                    </button>
                    <button
                        onClick={() => setActiveReport('tb')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeReport === 'tb'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                    >
                        Trial Balance
                    </button>
                    <button
                        onClick={() => setActiveReport('aging')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeReport === 'aging'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                    >
                        Aging Report
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {activeReport === 'aging' && (
                        <select 
                            value={partnerType} 
                            onChange={e => setPartnerType(e.target.value as any)}
                            className="p-2 border rounded-lg text-sm bg-slate-50 font-bold"
                        >
                            <option value="Customer">Receivables</option>
                            <option value="Vendor">Payables</option>
                        </select>
                    )}
                    {activeReport === 'pl' && (
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg text-sm" />
                    )}
                    <span className="text-slate-400">to</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg text-sm" />
                    <button onClick={fetchReport} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg">
                        <Filter className="w-4 h-4 text-slate-600" />
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-zinc-900 p-8 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-y-auto shadow-sm">
                {loading ? (
                    <div className="flex justify-center items-center h-40 text-slate-500">Generating Report...</div>
                ) : !reportData ? (
                    <div className="text-center text-slate-500">Select a report to view details.</div>
                ) : (
                    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold uppercase tracking-wide text-slate-800 dark:text-white">
                                {activeReport === 'bs' ? 'Balance Sheet' : 'Profit & Loss Statement'}
                            </h2>
                            <p className="text-slate-500 text-sm">
                                As of {endDate} {activeReport === 'pl' && `(From ${startDate})`}
                            </p>
                        </div>

                        {activeReport === 'bs' && (
                            <div className="grid grid-cols-2 gap-12">
                                <div>
                                    <AccountSection
                                        title="Assets"
                                        accounts={reportData.assets}
                                        total={reportData.assets?.reduce((sum: number, a: any) => sum + a.balance, 0)}
                                        color="text-emerald-600"
                                    />
                                </div>
                                <div>
                                    <AccountSection
                                        title="Liabilities"
                                        accounts={reportData.liabilities}
                                        total={reportData.liabilities?.reduce((sum: number, a: any) => sum + a.balance, 0)}
                                        color="text-rose-600"
                                    />
                                    <AccountSection
                                        title="Equity"
                                        accounts={reportData.equity}
                                        total={reportData.equity?.reduce((sum: number, a: any) => sum + a.balance, 0)}
                                        color="text-indigo-600"
                                    />
                                    <div className="mt-4 pt-4 border-t-2 border-slate-800 dark:border-white flex justify-between font-bold text-lg">
                                        <span>Total Liab + Equity</span>
                                        <span>{formatCurrency(
                                            (reportData.liabilities?.reduce((sum: number, a: any) => sum + a.balance, 0) || 0) +
                                            (reportData.equity?.reduce((sum: number, a: any) => sum + a.balance, 0) || 0)
                                        )}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeReport === 'pl' && (
                            <div className="space-y-8">
                                <ReportSection title="Revenue" items={reportData.income || []} color="text-emerald-600" />
                                <ReportSection title="Expenses" items={reportData.expenses || []} color="text-rose-600" />
                                <div className="mt-4 pt-4 border-t-2 border-slate-800 dark:border-white flex justify-between font-bold text-lg">
                                    <span>Net Profit / (Loss)</span>
                                    <span>{formatCurrency(
                                        (reportData.income?.reduce((s: number, a: any) => s + a.balance, 0) || 0) -
                                        (reportData.expenses?.reduce((s: number, a: any) => s + Math.abs(a.balance), 0) || 0)
                                    )}</span>
                                </div>
                            </div>
                        )}

                        {activeReport === 'tb' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-zinc-800 border-b-2">
                                        <tr>
                                            <th className="px-4 py-3">Account</th>
                                            <th className="px-4 py-3 text-right">Debit</th>
                                            <th className="px-4 py-3 text-right">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {reportData.map((row: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium">
                                                    {row.code} - {row.name}
                                                    <span className="ml-2 text-[10px] uppercase text-slate-400">({row.type})</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono">{row.total_debit > 0 ? formatCurrency(row.total_debit) : '-'}</td>
                                                <td className="px-4 py-3 text-right font-mono">{row.total_credit > 0 ? formatCurrency(row.total_credit) : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-100 font-bold border-t-2">
                                        <tr>
                                            <td className="px-4 py-3 text-right uppercase tracking-wider">Total</td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {formatCurrency(reportData.reduce((s: number, r: any) => s + Number(r.total_debit), 0))}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {formatCurrency(reportData.reduce((s: number, r: any) => s + Number(r.total_credit), 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {activeReport === 'aging' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-zinc-800 border-b-2 font-bold uppercase text-[10px] text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">Partner</th>
                                            <th className="px-4 py-3 text-right">Current</th>
                                            <th className="px-4 py-3 text-right">1-30 Days</th>
                                            <th className="px-4 py-3 text-right">31-60 Days</th>
                                            <th className="px-4 py-3 text-right">61-90 Days</th>
                                            <th className="px-4 py-3 text-right">90+ Days</th>
                                            <th className="px-4 py-3 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {reportData.map((row: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-bold text-indigo-600 underline cursor-pointer">{row.partner_name}</td>
                                                <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.current)}</td>
                                                <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.bucket_30)}</td>
                                                <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.bucket_60)}</td>
                                                <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.bucket_90)}</td>
                                                <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.bucket_90_plus)}</td>
                                                <td className="px-4 py-3 text-right font-bold font-mono">{formatCurrency(row.total_overdue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-100 font-bold border-t-2">
                                        <tr>
                                            <td className="px-4 py-3">Total</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(reportData.reduce((s: number, r: any) => s + r.current, 0))}</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(reportData.reduce((s: number, r: any) => s + r.bucket_30, 0))}</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(reportData.reduce((s: number, r: any) => s + r.bucket_60, 0))}</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(reportData.reduce((s: number, r: any) => s + r.bucket_90, 0))}</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(reportData.reduce((s: number, r: any) => s + r.bucket_90_plus, 0))}</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(reportData.reduce((s: number, r: any) => s + r.total_overdue, 0))}</td>
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
