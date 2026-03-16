import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Filter, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Modal } from '../../ui/Modal';

export const BankStatements: React.FC = () => {
    const [statements, setStatements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatement, setSelectedStatement] = useState<any | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Create Form
    const [name, setName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [journalId, setJournalId] = useState('');
    const [journals, setJournals] = useState<any[]>([]);

    // Reconciliation
    const [reconcileLine, setReconcileLine] = useState<any | null>(null);
    const [availablePayments, setAvailablePayments] = useState<any[]>([]);

    useEffect(() => {
        fetchStatements();
        fetchJournals();
    }, []);

    const fetchStatements = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('bank_statements')
            .select('*, journal:journals(name, code), lines:bank_statement_lines(count)')
            .order('date', { ascending: false });
        if (error) console.error(error);
        else setStatements(data || []);
        setLoading(false);
    };

    const fetchJournals = async () => {
        const { data } = await supabase.from('journals').select('id, name').eq('type', 'Bank');
        setJournals(data || []);
    };

    const fetchStatementDetails = async (id: string) => {
        const { data, error } = await supabase
            .from('bank_statements')
            .select(`
                *,
                journal:journals(name, code),
                lines:bank_statement_lines(
                    *,
                    payment:accounting_payments(name, amount)
                )
            `)
            .eq('id', id)
            .single();

        if (data) setSelectedStatement(data);
    };

    const handleCreateStatement = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data, error } = await supabase.from('bank_statements').insert([{
                name, date, journal_id: journalId, state: 'open'
            }]).select().single();

            if (error) throw error;
            setIsCreateModalOpen(false);
            fetchStatements();
            // Automatically open detail view
            fetchStatementDetails(data.id);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleAddLine = async (statementId: string) => {
        // Simplified: Add a dummy line for testing
        const amount = prompt('Amount (Positive for Deposit, Negative for Withdrawal):');
        if (!amount) return;

        const { error } = await supabase.from('bank_statement_lines').insert([{
            statement_id: statementId,
            date: new Date().toISOString().split('T')[0],
            amount: Number(amount),
            partner_name: 'Unknown',
            payment_ref: 'REF-' + Math.floor(Math.random() * 1000)
        }]);

        if (error) alert(error.message);
        else fetchStatementDetails(statementId);
    };

    const openReconcileModal = async (line: any) => {
        setReconcileLine(line);
        // Fetch unreconciled payments
        const { data } = await supabase
            .from('accounting_payments')
            .select('*, partner:accounting_partners(name)')
            .neq('state', 'reconciled')
            .order('date', { ascending: false });

        setAvailablePayments(data || []);
    };

    const confirmReconcile = async (paymentId: string) => {
        try {
            const { error } = await supabase.rpc('rpc_reconcile_statement_line', {
                p_statement_line_id: reconcileLine.id,
                p_payment_id: paymentId
            });

            if (error) throw error;

            setReconcileLine(null);
            if (selectedStatement) fetchStatementDetails(selectedStatement.id);

        } catch (error: any) {
            alert('Error reconciling: ' + error.message);
        }
    };

    if (selectedStatement) {
        return (
            <div className="flex flex-col h-full space-y-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedStatement(null)} className="text-sm text-slate-500 hover:text-slate-800">
                        &larr; Back to Statements
                    </button>
                    <h2 className="text-2xl font-bold">{selectedStatement.name}</h2>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase">{selectedStatement.state}</span>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 flex-1 flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50">
                        <h3 className="font-bold">Transactions (Lines)</h3>
                        <button onClick={() => handleAddLine(selectedStatement.id)} className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg text-xs font-bold">
                            + Add Line
                        </button>
                    </div>

                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Label</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Matched Payment</th>
                                    <th className="px-4 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {selectedStatement.lines?.map((line: any) => (
                                    <tr key={line.id}>
                                        <td className="px-4 py-3 text-slate-500">{line.date}</td>
                                        <td className="px-4 py-3 font-medium">{line.partner_name} <span className="text-xs text-slate-400">({line.payment_ref})</span></td>
                                        <td className={`px-4 py-3 text-right font-bold ${line.amount > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                                            {Number(line.amount).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {line.is_reconciled ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">
                                            {line.payment ? `${line.payment.name} (${Number(line.payment.amount).toFixed(2)})` : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {!line.is_reconciled && (
                                                <button
                                                    onClick={() => openReconcileModal(line)}
                                                    className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-md text-xs font-bold hover:bg-indigo-100"
                                                >
                                                    Reconcile
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {reconcileLine && (
                    <Modal title={`Reconcile Line: ${reconcileLine.amount}`} onClose={() => setReconcileLine(null)}>
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">Select a payment to match logic for specific line.</p>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {availablePayments.length === 0 && <p className="text-center text-slate-400 py-4">No matching payments found.</p>}
                                {availablePayments.map(pay => (
                                    <div
                                        key={pay.id}
                                        onClick={() => confirmReconcile(pay.id)}
                                        className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex justify-between items-center group"
                                    >
                                        <div>
                                            <div className="font-bold text-sm">{pay.name}</div>
                                            <div className="text-xs text-slate-500">{pay.partner?.name} • {pay.date}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">${pay.amount}</span>
                                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Bank Statements</h2>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create Statement
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? <p>Loading...</p> : statements.map(stm => (
                    <div
                        key={stm.id}
                        onClick={() => fetchStatementDetails(stm.id)}
                        className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 hover:shadow-lg transition-all cursor-pointer group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg group-hover:text-indigo-600 transition-colors">{stm.name}</h3>
                                <p className="text-sm text-slate-500">{stm.journal?.name}</p>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase">{stm.state}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-slate-500">
                            <span>{stm.date}</span>
                            <span>{stm.lines[0]?.count || 0} Transactions</span>
                        </div>
                    </div>
                ))}
            </div>

            {isCreateModalOpen && (
                <Modal title="New Bank Statement" onClose={() => setIsCreateModalOpen(false)}>
                    <form onSubmit={handleCreateStatement} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statement Name / Ref</label>
                            <input required value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded" placeholder="e.g. BNK1/2026/02" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Journal</label>
                            <select required value={journalId} onChange={e => setJournalId(e.target.value)} className="w-full p-2 border rounded">
                                <option value="">Select Journal</option>
                                {journals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                            </select>
                        </div>
                        <button className="w-full py-2 bg-indigo-600 text-white rounded font-bold">Create</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
