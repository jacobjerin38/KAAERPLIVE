import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { FileText } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PrintButton } from '../../ui/PrintButton';
import { PeriodFilter, PeriodPreset, getDatesForPreset } from '../common/PeriodFilter';

export const CashBook: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);
    
    // Filters
    const [preset, setPreset] = useState<PeriodPreset>('this_month');
    const [startDate, setStartDate] = useState<string>(() => getDatesForPreset('this_month').startDate);
    const [endDate, setEndDate] = useState<string>(() => getDatesForPreset('this_month').endDate);

    useEffect(() => {
        if (currentCompanyId) {
            fetchCashBook();
        }
    }, [startDate, endDate, currentCompanyId]);

    const fetchCashBook = async () => {
        if (!currentCompanyId) return;
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
        <div className="space-y-6 print:space-y-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Cash Book</h2>
                    </div>
                    <PrintButton />
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 no-print">
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
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm print:border-none print:shadow-none">
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
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">No cash transactions in this period</p>
                                    <p className="text-xs text-slate-400">
                                        No records match in the selected period ({startDate} to {endDate}). Try selecting{' '}
                                        <button type="button" onClick={() => { const { startDate: s, endDate: e } = getDatesForPreset('all'); setStartDate(s); setEndDate(e); setPreset('all'); }} className="text-violet-600 font-bold hover:underline cursor-pointer">All Dates</button> or{' '}
                                        <button type="button" onClick={() => { const { startDate: s, endDate: e } = getDatesForPreset('august_2026'); setStartDate(s); setEndDate(e); setPreset('august_2026'); }} className="text-violet-600 font-bold hover:underline cursor-pointer">August 2026</button>.
                                    </p>
                                </td>
                            </tr>
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
