import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Filter, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { PrintButton } from '../../ui/PrintButton';


export const BankStatements: React.FC = () => {
    const { currentCompanyId } = useAuth();
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
        if (currentCompanyId) {
            fetchStatements();
            fetchJournals();
        }
    }, [currentCompanyId]);

    const fetchStatements = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('bank_statements')
            .select('*, journal:accounting_journals(name, code), lines:bank_statement_lines(count)')
            .eq('company_id', currentCompanyId)
            .order('date', { ascending: false });
        if (error) console.error(error);
        else setStatements(data || []);
        setLoading(false);
    };

    const fetchJournals = async () => {
        if (!currentCompanyId) return;
        const { data } = await supabase.from('accounting_journals').select('id, name').eq('company_id', currentCompanyId).eq('type', 'Bank');
        setJournals(data || []);
    };

    const fetchStatementDetails = async (id: string) => {
        const { data, error } = await supabase
            .from('bank_statements')
            .select(`
                *,
                journal:accounting_journals(name, code),
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
        if (!currentCompanyId) return alert('No company context');
        try {
            const { data, error } = await supabase.from('bank_statements').insert([{
                name, date, journal_id: journalId, state: 'open', company_id: currentCompanyId
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

    // Add Line Form State
    const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
    const [lineDate, setLineDate] = useState(new Date().toISOString().split('T')[0]);
    const [lineAmount, setLineAmount] = useState('');
    const [linePartner, setLinePartner] = useState('');
    const [lineRef, setLineRef] = useState('');

    const handleSaveLine = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStatement) return;
        if (!currentCompanyId) return alert('No company context');
        const numAmt = Number(lineAmount);
        if (isNaN(numAmt) || numAmt === 0) return alert('Please enter a valid non-zero amount');

        try {
            const { error } = await supabase.from('bank_statement_lines').insert([{
                statement_id: selectedStatement.id,
                date: lineDate,
                amount: numAmt,
                partner_name: linePartner.trim() || 'Direct Entry',
                payment_ref: lineRef.trim() || null,
                company_id: currentCompanyId
            }]);

            if (error) throw error;
            setIsAddLineModalOpen(false);
            setLineAmount('');
            setLinePartner('');
            setLineRef('');
            fetchStatementDetails(selectedStatement.id);
        } catch (err: any) {
            alert('Failed to add transaction line: ' + (err.message || 'Unknown error'));
        }
    };

    const openReconcileModal = async (line: any) => {
        if (!currentCompanyId) return;
        setReconcileLine(line);
        // Fetch unreconciled payments
        const { data } = await supabase
            .from('accounting_payments')
            .select('*, partner:accounting_partners(name)')
            .eq('company_id', currentCompanyId)
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
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedStatement(null)} className="text-sm text-slate-500 hover:text-slate-800 no-print">
                            &larr; Back to Statements
                        </button>
                        <h2 className="text-2xl font-bold">{selectedStatement.name}</h2>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase no-print">{selectedStatement.state}</span>
                    </div>
                    <PrintButton />
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 flex-1 flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50">
                        <button onClick={() => setIsAddLineModalOpen(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors">
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
                                            <span className="font-bold">QAR {pay.amount}</span>
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
                <div className="flex items-center gap-3 no-print">
                    <PrintButton />
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Create Statement
                    </button>
                </div>
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

            {isAddLineModalOpen && (
                <Modal title="Add Transaction Line" onClose={() => setIsAddLineModalOpen(false)}>
                    <form onSubmit={handleSaveLine} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                            <input type="date" required value={lineDate} onChange={e => setLineDate(e.target.value)} className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Partner / Description</label>
                            <input value={linePartner} onChange={e => setLinePartner(e.target.value)} className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" placeholder="e.g. Al Rayan Trading / Direct Deposit" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (QAR)</label>
                            <input type="number" step="0.01" required value={lineAmount} onChange={e => setLineAmount(e.target.value)} className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" placeholder="Positive for Deposit, Negative for Withdrawal" />
                            <p className="text-[11px] text-slate-400 mt-1">Use positive numbers for inbound deposits and negative for outbound expenses.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payment / Cheque Reference</label>
                            <input value={lineRef} onChange={e => setLineRef(e.target.value)} className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" placeholder="e.g. CHQ-449102" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setIsAddLineModalOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold">Add Transaction</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
