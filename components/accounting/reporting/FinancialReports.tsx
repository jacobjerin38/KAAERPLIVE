import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Calendar, Filter, Download } from 'lucide-react';

export const FinancialReports: React.FC = () => {
    const [activeReport, setActiveReport] = useState<'bs' | 'pl'>('bs');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [companyCurrency, setCompanyCurrency] = useState('USD');

    // Filters
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        fetchCompanyCurrency();
    }, []);

    useEffect(() => {
        fetchReport();
    }, [activeReport, startDate, endDate]);

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
            } else {
                const { data, error } = await supabase.rpc('rpc_get_profit_loss', { p_start_date: startDate, p_end_date: endDate });
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
                </div>

                <div className="flex items-center gap-3">
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
                                <AccountSection
                                    title="Income"
                                    accounts={reportData.income}
                                    total={reportData.income?.reduce((sum: number, a: any) => sum + a.balance, 0)}
                                    color="text-emerald-600"
                                />
                                <AccountSection
                                    title="Expenses"
                                    accounts={reportData.expense}
                                    total={reportData.expense?.reduce((sum: number, a: any) => sum + a.balance, 0)}
                                    color="text-rose-600"
                                />
                                <div className="mt-8 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl flex justify-between items-center text-xl font-bold border border-slate-200 dark:border-zinc-700">
                                    <span>Net Profit / (Loss)</span>
                                    <span className={reportData.net_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                        {formatCurrency(reportData.net_profit)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
