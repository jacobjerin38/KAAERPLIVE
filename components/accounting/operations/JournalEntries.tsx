import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Filter, ArrowRight, Save, Trash2 } from 'lucide-react';
import { Modal } from '../../ui/Modal';

// Reusing types roughly, but ideally should be in types.ts
interface JournalEntry {
    id: string;
    date: string;
    journal_id: string;
    reference: string;
    notes: string;
    state: 'Draft' | 'Posted' | 'Cancelled';
    amount_total: number;
    lines: JournalEntryLine[];
}

interface JournalEntryLine {
    id?: string; // Optional for new lines
    account_id: string;
    description: string;
    debit: number;
    credit: number;
    partner_id?: string;
    name?: string; // For display
}

export const JournalEntries: React.FC = () => {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentEntry, setCurrentEntry] = useState<Partial<JournalEntry>>({ lines: [] });
    // Masters
    const [journals, setJournals] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchEntries();
        fetchMasters();
    }, []);

    const fetchEntries = async () => {
        const { data, error } = await supabase
            .from('accounting_moves')
            .select(`
                *,
                journal:journals(name)
            `)
            .order('date', { ascending: false });
        if (error) console.error(error);
        else setEntries(data || []);
    };

    const fetchMasters = async () => {
        const [jRes, aRes] = await Promise.all([
            supabase.from('journals').select('*'),
            supabase.from('chart_of_accounts').select('*').order('code')
        ]);
        if (jRes.data) setJournals(jRes.data);
        if (aRes.data) setAccounts(aRes.data);
    };

    const handleOpenCreate = () => {
        const defaultJournal = journals.find(j => j.type === 'General');
        setCurrentEntry({
            date: new Date().toISOString().split('T')[0],
            journal_id: defaultJournal?.id || '',
            state: 'Draft',
            lines: [
                { account_id: '', description: '', debit: 0, credit: 0 },
                { account_id: '', description: '', debit: 0, credit: 0 }
            ]
        });
        setIsModalOpen(true);
    };

    const updateLine = (index: number, field: keyof JournalEntryLine, value: any) => {
        const newLines = [...(currentEntry.lines || [])];
        newLines[index] = { ...newLines[index], [field]: value };

        // Auto-balance logic (simple)
        // If updating debit on line 1, suggest credit on line 2 if balanced?
        // Let's keep it manual for now.

        setCurrentEntry({ ...currentEntry, lines: newLines });
    };

    const addNewLine = () => {
        setCurrentEntry({
            ...currentEntry,
            lines: [...(currentEntry.lines || []), { account_id: '', description: '', debit: 0, credit: 0 }]
        });
    };

    const removeLine = (index: number) => {
        const newLines = [...(currentEntry.lines || [])];
        newLines.splice(index, 1);
        setCurrentEntry({ ...currentEntry, lines: newLines });
    };

    const calculateTotals = () => {
        const totalDebit = currentEntry.lines?.reduce((sum, line) => sum + (Number(line.debit) || 0), 0) || 0;
        const totalCredit = currentEntry.lines?.reduce((sum, line) => sum + (Number(line.credit) || 0), 0) || 0;
        return { totalDebit, totalCredit, balanced: totalDebit === totalCredit && totalDebit > 0 };
    };

    const handleSave = async () => {
        setLoading(true);
        const totals = calculateTotals();

        if (!totals.balanced) {
            alert(`Entry is not balanced! Debit: ${totals.totalDebit}, Credit: ${totals.totalCredit}`);
            setLoading(false);
            return;
        }

        if (!currentEntry.journal_id || !currentEntry.date) {
            alert('Journal and Date are required');
            setLoading(false);
            return;
        }

        try {
            // 1. Insert Header
            const moveData = {
                journal_id: currentEntry.journal_id,
                date: currentEntry.date,
                reference: currentEntry.reference,
                notes: currentEntry.notes,
                state: 'Draft', // Always start draft
                amount_total: totals.totalDebit
            };

            const { data: move, error: moveError } = await supabase
                .from('accounting_moves')
                .insert([moveData])
                .select()
                .single();

            if (moveError) throw moveError;

            // 2. Insert Lines
            const linesData = currentEntry.lines?.map(line => ({
                move_id: move.id,
                journal_id: currentEntry.journal_id, // denormalized
                date: currentEntry.date, // denormalized
                account_id: line.account_id,
                name: line.description,
                debit: line.debit,
                credit: line.credit
            }));

            const { error: linesError } = await supabase
                .from('accounting_move_lines')
                .insert(linesData as any[]);

            if (linesError) throw linesError;

            // Success
            setIsModalOpen(false);
            fetchEntries();

        } catch (error: any) {
            console.error(error);
            alert('Error creating entry: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePost = async (id: string) => {
        if (!confirm('Are you sure you want to POST this entry? This cannot be undone.')) return;

        const { data, error } = await supabase.rpc('rpc_post_move', { p_move_id: id, p_user_id: (await supabase.auth.getUser()).data.user?.id });

        if (error) alert('Error: ' + error.message);
        else {
            if (data.success) {
                alert('Posted Successfully');
                fetchEntries();
            } else {
                alert('Post Failed: ' + data.message);
            }
        }
    };

    return (
        <div className="space-y-6 animate-page-enter">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Journal Entries</h3>
                    <p className="text-sm text-slate-500">Record and manage financial transactions.</p>
                </div>
                <button onClick={handleOpenCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    <Plus className="w-4 h-4" /> New Entry
                </button>
            </div>

            {/* List View */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                        <tr>
                            <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                            <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Number</th>
                            <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Journal</th>
                            <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Reference</th>
                            <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-right">Amount</th>
                            <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                            <th className="p-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {entries.map(entry => (
                            <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                <td className="p-4 text-slate-800 dark:text-white">{entry.date}</td>
                                <td className="p-4 text-slate-500 font-mono text-xs">{entry.id.slice(0, 8)}...</td>
                                <td className="p-4 text-slate-800 dark:text-white">{(entry as any).journal?.name}</td>
                                <td className="p-4 text-slate-600 dark:text-slate-400">{entry.reference || '-'}</td>
                                <td className="p-4 text-right font-medium text-slate-800 dark:text-white">{entry.amount_total?.toFixed(2)}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${entry.state === 'Posted' ? 'bg-blue-100 text-blue-700' :
                                            entry.state === 'Draft' ? 'bg-slate-100 text-slate-600' :
                                                'bg-red-100 text-red-700'
                                        }`}>
                                        {entry.state.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    {entry.state === 'Draft' && (
                                        <button
                                            onClick={() => handlePost(entry.id)}
                                            className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition"
                                        >
                                            POST
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <Modal title="New Journal Entry" onClose={() => setIsModalOpen(false)} maxWidth="4xl">
                    <div className="space-y-6">
                        {/* Header Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Journal</label>
                                <select
                                    className="w-full p-2 border rounded dark:bg-zinc-900 dark:border-zinc-700"
                                    value={currentEntry.journal_id}
                                    onChange={e => setCurrentEntry({ ...currentEntry, journal_id: e.target.value })}
                                >
                                    <option value="">Select Journal</option>
                                    {journals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                                <input
                                    type="date"
                                    className="w-full p-2 border rounded dark:bg-zinc-900 dark:border-zinc-700"
                                    value={currentEntry.date}
                                    onChange={e => setCurrentEntry({ ...currentEntry, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reference</label>
                                <input
                                    className="w-full p-2 border rounded dark:bg-zinc-900 dark:border-zinc-700"
                                    placeholder="e.g. INV/2026/001"
                                    value={currentEntry.reference || ''}
                                    onChange={e => setCurrentEntry({ ...currentEntry, reference: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Lines Grid */}
                        <div className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 dark:bg-zinc-800">
                                    <tr>
                                        <th className="p-2 w-1/3 text-left">Account</th>
                                        <th className="p-2 w-1/3 text-left">Description</th>
                                        <th className="p-2 w-24 text-right">Debit</th>
                                        <th className="p-2 w-24 text-right">Credit</th>
                                        <th className="p-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {currentEntry.lines?.map((line, idx) => (
                                        <tr key={idx}>
                                            <td className="p-2">
                                                <select
                                                    className="w-full p-1 border-0 bg-transparent focus:ring-1 focus:ring-indigo-500 rounded"
                                                    value={line.account_id}
                                                    onChange={e => updateLine(idx, 'account_id', e.target.value)}
                                                >
                                                    <option value="">Select Account</option>
                                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    className="w-full p-1 border-0 bg-transparent focus:ring-1 focus:ring-indigo-500 rounded"
                                                    placeholder="Label"
                                                    value={line.description}
                                                    onChange={e => updateLine(idx, 'description', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number" step="0.01"
                                                    className="w-full p-1 border-0 bg-transparent focus:ring-1 focus:ring-indigo-500 rounded text-right"
                                                    value={line.debit}
                                                    onChange={e => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number" step="0.01"
                                                    className="w-full p-1 border-0 bg-transparent focus:ring-1 focus:ring-indigo-500 rounded text-right"
                                                    value={line.credit}
                                                    onChange={e => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-600">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 dark:bg-zinc-800 font-bold">
                                    <tr>
                                        <td colSpan={2} className="p-2">
                                            <button onClick={addNewLine} className="text-indigo-600 hover:underline text-xs flex items-center gap-1">
                                                <Plus className="w-3 h-3" /> Add Line
                                            </button>
                                        </td>
                                        <td className="p-2 text-right">{calculateTotals().totalDebit.toFixed(2)}</td>
                                        <td className="p-2 text-right">{calculateTotals().totalCredit.toFixed(2)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Errors */}
                        {!calculateTotals().balanced && (
                            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                                <span className="font-bold">Unbalanced:</span>
                                Difference of {(calculateTotals().totalDebit - calculateTotals().totalCredit).toFixed(2)}
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Save Draft'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
