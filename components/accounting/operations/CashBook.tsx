import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Filter, Search, Printer, FileText } from 'lucide-react';

export const CashBook: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);
    
    // Filters
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        fetchCashBook();
    }, [startDate, endDate]);

    const fetchCashBook = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('rpc_get_cash_book', {
                p_start_date: startDate,
                p_end_date: endDate
            });
            if (error) throw error;
            setRecords((data as any) || []);
        } catch (err: any) {
            console.error('Error fetching cash book:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Cash Book</h2>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">From:</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg text-sm bg-slate-50" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">To:</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg text-sm bg-slate-50" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Account</th>
                            <th className="px-6 py-4 text-right text-emerald-600">Cash In (Debit)</th>
                            <th className="px-6 py-4 text-right text-rose-600">Cash Out (Credit)</th>
                            <th className="px-6 py-4 text-right">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading Cash Book...</td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No cash transactions in this period.</td></tr>
                        ) : records.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{row.date}</td>
                                <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{row.description}</td>
                                <td className="px-6 py-4 text-xs font-bold uppercase text-slate-400">{row.account_name}</td>
                                <td className="px-6 py-4 text-right font-mono text-emerald-600">
                                    {row.debit > 0 ? `+${Number(row.debit).toLocaleString()}` : '-'}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-rose-600">
                                    {row.credit > 0 ? `-${Number(row.credit).toLocaleString()}` : '-'}
                                </td>
                                <td className="px-6 py-4 text-right font-bold font-mono text-slate-800 dark:text-white">
                                    {Number(row.running_balance).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
