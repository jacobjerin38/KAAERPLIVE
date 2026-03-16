import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, Search, Filter, Hash } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

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
                .limit(100);

            if (error) throw error;
            setEntries(data || []);
        } catch (error) {
            console.error('Error fetching journal entries:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredEntries = entries.filter(entry =>
        entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.reference_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.debit_account.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.credit_account.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Journal Entries</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">System-generated financial records. Read-only for audit.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search description, accounts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                </div>
            </div>

            {/* Journal Table */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-zinc-700">
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
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No journal entries found.</td></tr>
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
                                            ${entry.amount.toFixed(2)}
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
