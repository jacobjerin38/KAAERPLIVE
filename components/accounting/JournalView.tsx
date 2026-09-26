import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PeriodFilter, PeriodPreset, getDatesForPreset } from './common/PeriodFilter';

interface AccountingEntry {
    id: string;
    transaction_date: string;
    reference_type: string;
    reference_id: string;
    debit_account: string;
    credit_account: string;
    amount: number;
    description: string;
    created_at: string;
}

export const JournalView: React.FC = () => {
    const { user } = useAuth();
    const [entries, setEntries] = useState<AccountingEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [preset, setPreset] = useState<PeriodPreset>('this_month');
    const [startDate, setStartDate] = useState<string>(() => getDatesForPreset('this_month').startDate);
    const [endDate, setEndDate] = useState<string>(() => getDatesForPreset('this_month').endDate);

    useEffect(() => {
        fetchEntries();
    }, []);

    const fetchEntries = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('accounting_entries')
                .select('*')
                .order('transaction_date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(500);

            if (error) throw error;
            setEntries(data || []);
        } catch (error) {
            console.error('Error fetching journal entries:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredEntries = entries.filter(entry => {
        if (preset !== 'all') {
            const eDate = entry.transaction_date;
            if (startDate && eDate < startDate) return false;
            if (endDate && eDate > endDate) return false;
        }
        return (
            entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.reference_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.debit_account.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.credit_account.toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Journal Entries (Audit View)</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">System-generated financial records. Read-only for audit.</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3 no-print">
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

                <div className="relative pt-1 border-t border-slate-100 dark:border-zinc-800">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search description, accounts, reference..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white text-xs md:text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                </div>
            </div>

            {/* Journal Table */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-zinc-700 text-xs">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Reference</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Debit Account</th>
                                <th className="px-6 py-4">Credit Account</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading entries...</td></tr>
                            ) : filteredEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">No journal entries found</p>
                                        <p className="text-xs text-slate-400">
                                            No records match in the selected period ({startDate} to {endDate}). Try selecting{' '}
                                            <button type="button" onClick={() => { const { startDate: s, endDate: e } = getDatesForPreset('all'); setStartDate(s); setEndDate(e); setPreset('all'); }} className="text-violet-600 font-bold hover:underline cursor-pointer">All Dates</button> or{' '}
                                            <button type="button" onClick={() => { const { startDate: s, endDate: e } = getDatesForPreset('august_2026'); setStartDate(s); setEndDate(e); setPreset('august_2026'); }} className="text-violet-600 font-bold hover:underline cursor-pointer">August 2026</button>.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredEntries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono text-xs">
                                            {entry.transaction_date}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded text-xs text-slate-600 dark:text-slate-400 font-mono">
                                                {entry.reference_type} #{entry.reference_id?.substring(0, 8)}...
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-white">
                                            {entry.description}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                            {entry.debit_account}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                            {entry.credit_account}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-white font-mono">
                                            QAR {entry.amount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
