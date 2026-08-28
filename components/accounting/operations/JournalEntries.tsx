import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Filter, ArrowRight, Save, Trash2, Edit, Eye } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { PrintButton } from '../../ui/PrintButton';


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
    id?: string;
    account_id: string;
    description: string;
    debit: number;
    credit: number;
    partner_id?: string;
    name?: string;
    cost_center_id?: string;
    project_cost_center_id?: string;
    contract_cost_center_id?: string;
}

export const JournalEntries: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentEntry, setCurrentEntry] = useState<Partial<JournalEntry>>({ lines: [] });
    
    // Masters
    const [journals, setJournals] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [costCenters, setCostCenters] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (currentCompanyId) {
            fetchEntries();
            fetchMasters();
        }
    }, [currentCompanyId]);

    const fetchEntries = async () => {
        if (!currentCompanyId) return;
        const { data, error } = await supabase
            .from('accounting_journal_entries')
            .select(`
                *,
                journal:accounting_journals(name)
            `)
            .eq('company_id', currentCompanyId)
            .order('date', { ascending: false });
        if (error) console.error(error);
        else setEntries((data || []) as any);
    };

    const fetchMasters = async () => {
        if (!currentCompanyId) return;
        const [jRes, aRes, ccRes] = await Promise.all([
            supabase.from('accounting_journals').select('*').eq('company_id', currentCompanyId).eq('is_active', true),
            supabase.from('accounting_chart_of_accounts').select('*').eq('company_id', currentCompanyId).eq('is_active', true).eq('is_group', false).order('code'),
            supabase.from('accounting_cost_centers').select('*').eq('company_id', currentCompanyId).eq('is_active', true)
        ]);
        if (jRes.data) setJournals(jRes.data);
        if (aRes.data) setAccounts(aRes.data.filter((a: any) => !a.is_group && a.is_active !== false));
        if (ccRes.data) setCostCenters(ccRes.data);
    };

    const handleOpenCreate = () => {
        const defaultJournal = journals.find(j => j.type === 'General') || journals[0];
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

    const handleOpenEdit = async (entry: JournalEntry) => {
        setLoading(true);
        try {
            const { data: lines, error } = await supabase
                .from('accounting_journal_lines')
                .select('*')
                .eq('entry_id', entry.id);
            if (error) throw error;

            const mappedLines = (lines || []).map(line => ({
                id: line.id,
                account_id: line.account_id,
                description: line.name || '',
                debit: Number(line.debit) || 0,
                credit: Number(line.credit) || 0,
                cost_center_id: line.cost_center_id || undefined,
                project_cost_center_id: line.project_cost_center_id || undefined,
                contract_cost_center_id: line.contract_cost_center_id || undefined
            }));

            setCurrentEntry({
                id: entry.id,
                date: entry.date,
                journal_id: entry.journal_id,
                reference: entry.reference,
                notes: entry.notes,
                state: entry.state,
                lines: mappedLines
            });
            setIsModalOpen(true);
        } catch (err: any) {
            alert("Error loading entry lines: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateLine = (index: number, field: keyof JournalEntryLine, value: any) => {
        const newLines = [...(currentEntry.lines || [])];
        newLines[index] = { ...newLines[index], [field]: value };
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
        return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0 };
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
            if (!currentCompanyId) throw new Error('No company context');
            
            const moveData = {
                journal_id: currentEntry.journal_id,
                date: currentEntry.date,
                reference: currentEntry.reference,
                notes: currentEntry.notes,
                state: 'Draft',
                amount_total: totals.totalDebit,
                company_id: currentCompanyId
            };

            let entryId = currentEntry.id;

            if (entryId) {
                const { error: moveError } = await supabase
                    .from('accounting_journal_entries')
                    .update(moveData)
                    .eq('id', entryId);

                if (moveError) throw moveError;

                const { error: deleteError } = await supabase
                    .from('accounting_journal_lines')
                    .delete()
                    .eq('entry_id', entryId);

                if (deleteError) throw deleteError;
            } else {
                const { data: move, error: moveError } = await supabase
                    .from('accounting_journal_entries')
                    .insert([moveData])
                    .select()
                    .single();

                if (moveError) throw moveError;
                entryId = move.id;
            }

            const linesData = currentEntry.lines?.map(line => ({
                entry_id: entryId,
                account_id: line.account_id,
                name: line.description,
                debit: line.debit,
                credit: line.credit,
                cost_center_id: line.cost_center_id || null,
                project_cost_center_id: line.project_cost_center_id || null,
                contract_cost_center_id: line.contract_cost_center_id || null,
                company_id: currentCompanyId
            }));

            const { error: linesError } = await supabase
                .from('accounting_journal_lines')
                .insert(linesData as any[]);

            if (linesError) throw linesError;

            setIsModalOpen(false);
            fetchEntries();

        } catch (error: any) {
            console.error(error);
            alert('Error saving entry: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePost = async (id: string) => {
        if (!confirm('Are you sure you want to POST this entry? This cannot be undone.')) return;

        const { data, error } = await supabase.rpc('rpc_post_accounting_entry', { p_entry_id: id });

        if (error) alert('Error: ' + error.message);
        else {
            const res = data as any;
            if (res?.success) {
                alert('Posted Successfully');
                fetchEntries();
            } else {
                alert('Post Failed: ' + (res?.message || 'Unknown error'));
            }
        }
    };

    const handleDelete = async (id: string) => {
        const { data: { user: currentAuthUser } } = await supabase.auth.getUser();
        
        setLoading(true);
        try {
            const { data: entry } = await supabase
                .from('accounting_journal_entries')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (entry && entry.state !== 'Draft') {
                alert('Only Draft entries can be deleted.');
                setLoading(false);
                return;
            }

            if (!confirm('Are you sure you want to delete this journal entry? This will permanently delete the transaction and all its ledger lines from the database.')) {
                setLoading(false);
                return;
            }

            if (currentAuthUser && entry) {
                await supabase.from('delete_audit_logs').insert([{
                    deleted_by_email: currentAuthUser.email || 'unknown',
                    deleted_by_uid: currentAuthUser.id,
                    record_type: 'journal_entry',
                    record_id: id,
                    record_name: `Date: ${entry.date}, Ref: ${entry.reference || '-'}, Amount: ${entry.amount_total}`
                }]);
            }

            const { error } = await supabase
                .from('accounting_journal_entries')
                .delete()
                .eq('id', id);

            if (error) throw error;
            alert('Journal Entry deleted successfully.');
            fetchEntries();
        } catch (error: any) {
            console.error('Error deleting move:', error);
            alert('Failed to delete entry: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCostCenterInline = async (type: 'GENERIC' | 'PROJECT' | 'CONTRACT', idx: number) => {
        if (!currentCompanyId) return;
        const typeLabels = {
            GENERIC: 'Cost Center',
            PROJECT: 'Project Cost Center',
            CONTRACT: 'Contract Cost Center'
        };
        const defaultCode = type === 'PROJECT' ? 'PROJECT-' : type === 'CONTRACT' ? 'MANPOWER-' : 'CC-';
        const code = prompt(`Enter ${typeLabels[type]} Code (e.g. ${defaultCode}XYZ):`);
        if (!code || !code.trim()) return;
        const name = prompt(`Enter ${typeLabels[type]} Name:`);
        if (!name || !name.trim()) return;

        try {
            const { data, error } = await supabase
                .from('accounting_cost_centers')
                .insert([{
                    company_id: currentCompanyId,
                    code: code.trim().toUpperCase(),
                    name: name.trim(),
                    type: type,
                    is_active: true
                }])
                .select();
            if (error) throw error;
            if (data && data.length > 0) {
                setCostCenters(prev => [...prev, data[0]]);
                const fieldMap: { [key in 'GENERIC' | 'PROJECT' | 'CONTRACT']: keyof JournalEntryLine } = {
                    GENERIC: 'cost_center_id',
                    PROJECT: 'project_cost_center_id',
                    CONTRACT: 'contract_cost_center_id'
                };
                updateLine(idx, fieldMap[type], data[0].id);
            }
        } catch (err: any) {
            console.error(err);
            alert("Error creating Cost Center: " + err.message);
        }
    };

    // Filter cost centers by type
    const genericCC = costCenters.filter(cc => cc.type === 'GENERIC');
    const projectCC = costCenters.filter(cc => cc.type === 'PROJECT');
    const contractCC = costCenters.filter(cc => cc.type === 'CONTRACT');

    return (
        <div className="space-y-6 animate-page-enter">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Journal Entries</h3>
                    <p className="text-sm text-slate-500">Record and manage financial transactions.</p>
                </div>
                <div className="flex items-center gap-3 no-print">
                    <PrintButton />
                    <button onClick={handleOpenCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        <Plus className="w-4 h-4" /> New Entry
                    </button>
                </div>
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
                                    <div className="flex items-center justify-end gap-2">
                                        {entry.state === 'Draft' ? (
                                            <>
                                                <button
                                                    onClick={() => handleOpenEdit(entry)}
                                                    className="p-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 rounded transition"
                                                    title="Edit Entry"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handlePost(entry.id)}
                                                    className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition font-bold"
                                                >
                                                    POST
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry.id)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition"
                                                    title="Delete Entry"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleOpenEdit(entry)}
                                                className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 rounded transition flex items-center gap-1 text-xs font-bold"
                                                title="View Entry"
                                            >
                                                <Eye className="w-4 h-4" /> VIEW
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <Modal title={currentEntry.state === 'Posted' ? "View Journal Entry" : currentEntry.id ? "Edit Journal Entry" : "New Journal Entry"} onClose={() => setIsModalOpen(false)} maxWidth="6xl">
                    <div className="space-y-6">
                        {/* Header Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Journal</label>
                                <select
                                    disabled={currentEntry.state === 'Posted'}
                                    className="w-full p-2 border rounded dark:bg-zinc-900 dark:border-zinc-700 disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-zinc-800"
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
                                    disabled={currentEntry.state === 'Posted'}
                                    type="date"
                                    className="w-full p-2 border rounded dark:bg-zinc-900 dark:border-zinc-700 disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-zinc-800"
                                    value={currentEntry.date}
                                    onChange={e => setCurrentEntry({ ...currentEntry, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reference</label>
                                <input
                                    disabled={currentEntry.state === 'Posted'}
                                    className="w-full p-2 border rounded dark:bg-zinc-900 dark:border-zinc-700 disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-zinc-800"
                                    placeholder="e.g. JV/2026/001"
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
                                        <th className="p-2 w-[18%] text-left">Account</th>
                                        <th className="p-2 w-[18%] text-left">Description</th>
                                        <th className="p-2 w-[14%] text-left">Cost Center</th>
                                        <th className="p-2 w-[14%] text-left">Project CC</th>
                                        <th className="p-2 w-[14%] text-left">Contract CC</th>
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
                                                    disabled={currentEntry.state === 'Posted'}
                                                    className="w-full p-1 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded text-xs disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-zinc-800"
                                                    value={line.account_id}
                                                    onChange={e => updateLine(idx, 'account_id', e.target.value)}
                                                >
                                                    <option value="">Select Account</option>
                                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    disabled={currentEntry.state === 'Posted'}
                                                    className="w-full p-1 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded text-xs disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-zinc-800"
                                                    placeholder="Label"
                                                    value={line.description}
                                                    onChange={e => updateLine(idx, 'description', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <select
                                                    disabled={currentEntry.state === 'Posted'}
                                                    className="w-full p-1 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded text-xs font-mono disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-zinc-800"
                                                    value={line.cost_center_id || ''}
                                                    onChange={e => {
                                                        if (e.target.value === 'NEW') handleCreateCostCenterInline('GENERIC', idx);
                                                        else updateLine(idx, 'cost_center_id', e.target.value || undefined);
                                                    }}
                                                >
                                                    <option value="">None</option>
                                                    {genericCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>)}
                                                    <option value="NEW" className="font-semibold text-indigo-600 dark:text-indigo-400">+ New Cost Center...</option>
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <select
                                                    disabled={currentEntry.state === 'Posted'}
                                                    className="w-full p-1 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded text-xs font-mono disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-zinc-800"
                                                    value={line.project_cost_center_id || ''}
                                                    onChange={e => {
                                                        if (e.target.value === 'NEW') handleCreateCostCenterInline('PROJECT', idx);
                                                        else updateLine(idx, 'project_cost_center_id', e.target.value || undefined);
                                                    }}
                                                >
                                                    <option value="">None</option>
                                                    {projectCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>)}
                                                    <option value="NEW" className="font-semibold text-indigo-600 dark:text-indigo-400">+ New Project CC...</option>
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <select
                                                    disabled={currentEntry.state === 'Posted'}
                                                    className="w-full p-1 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded text-xs font-mono disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-zinc-800"
                                                    value={line.contract_cost_center_id || ''}
                                                    onChange={e => {
                                                        if (e.target.value === 'NEW') handleCreateCostCenterInline('CONTRACT', idx);
                                                        else updateLine(idx, 'contract_cost_center_id', e.target.value || undefined);
                                                    }}
                                                >
                                                    <option value="">None</option>
                                                    {contractCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>)}
                                                    <option value="NEW" className="font-semibold text-indigo-600 dark:text-indigo-400">+ New Contract CC...</option>
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    disabled={currentEntry.state === 'Posted'}
                                                    type="number" step="0.01"
                                                    className="w-full p-1 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded text-right text-xs disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-zinc-800"
                                                    value={line.debit}
                                                    onChange={e => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    disabled={currentEntry.state === 'Posted'}
                                                    type="number" step="0.01"
                                                    className="w-full p-1 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded text-right text-xs disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-zinc-800"
                                                    value={line.credit}
                                                    onChange={e => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                {currentEntry.state !== 'Posted' && (
                                                    <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-600">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 dark:bg-zinc-800 font-bold">
                                    <tr>
                                        <td colSpan={5} className="p-2">
                                            {currentEntry.state !== 'Posted' && (
                                                <button onClick={addNewLine} className="text-indigo-600 hover:underline text-xs flex items-center gap-1 font-bold">
                                                    <Plus className="w-3 h-3" /> Add Line
                                                </button>
                                            )}
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

                        <div className="flex justify-end pt-4 gap-2">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium"
                            >
                                Close
                            </button>
                            {currentEntry.state !== 'Posted' && (
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Draft'}
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
