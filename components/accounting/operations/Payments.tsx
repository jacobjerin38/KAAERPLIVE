import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, CheckCircle, Clock, BookOpen, Users } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { PrintButton } from '../../ui/PrintButton';


export const Payments: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Masters
    const [partners, setPartners] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]); // Bank/Cash Journals
    const [accounts, setAccounts] = useState<any[]>([]); // Chart of accounts ledgers

    // Form State
    const [paymentCategory, setPaymentCategory] = useState<'partner' | 'direct_account'>('partner'); // partner, direct_account
    const [paymentType, setPaymentType] = useState('outbound'); // inbound (Money In), outbound (Money Out)
    const [selectedPartner, setSelectedPartner] = useState('');
    const [selectedAccount, setSelectedAccount] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedJournal, setSelectedJournal] = useState('');
    const [notes, setNotes] = useState('');

    // Edit/View State
    const [editMode, setEditMode] = useState(false);
    const [viewMode, setViewMode] = useState(false);
    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

    useEffect(() => {
        if (currentCompanyId) {
            fetchPayments();
            fetchMasters();
        }
    }, [currentCompanyId]);

    const fetchPayments = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('accounting_payments')
            .select(`
                *,
                partner:accounting_partners(name),
                account:accounting_chart_of_accounts!account_id(code, name, type),
                journal:accounting_journals!accounting_journal_id(code)
            `)
            .eq('company_id', currentCompanyId)
            .order('date', { ascending: false });

        if (error) console.error(error);
        else setPayments(data || []);
        setLoading(false);
    };

    const fetchMasters = async () => {
        if (!currentCompanyId) return;
        const { data: pData } = await supabase.from('accounting_partners').select('id, name, partner_type').eq('company_id', currentCompanyId);
        setPartners(pData || []);

        // Fetch Bank/Cash journals
        const { data: jData } = await supabase.from('accounting_journals').select('id, name, type, code').eq('company_id', currentCompanyId).in('type', ['Bank', 'Cash']);
        setJournals(jData || []);
        if (jData && jData.length > 0) setSelectedJournal(jData[0].id);

        // Fetch Chart of Accounts Ledgers
        const { data: aData } = await supabase
            .from('accounting_chart_of_accounts')
            .select('id, code, name, type, subtype')
            .eq('company_id', currentCompanyId)
            .eq('is_active', true)
            .order('code', { ascending: true });
        setAccounts(aData || []);
    };

    const handleOpenModal = (pay?: any, readonly = false) => {
        if (pay) {
            setEditingPaymentId(pay.id);
            setPaymentCategory(pay.payment_category === 'direct_account' || pay.account_id ? 'direct_account' : 'partner');
            setPaymentType(pay.payment_type || 'outbound');
            setSelectedPartner(pay.partner_id || '');
            setSelectedAccount(pay.account_id || '');
            setAmount(String(pay.amount || ''));
            setDate(pay.date || '');
            setSelectedJournal(pay.accounting_journal_id || '');
            setNotes(pay.notes || '');
            setEditMode(!readonly);
            setViewMode(readonly);
            setIsModalOpen(true);
        } else {
            setEditingPaymentId(null);
            setPaymentCategory('partner');
            setPaymentType('outbound');
            setSelectedPartner('');
            setSelectedAccount('');
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            if (journals.length > 0) setSelectedJournal(journals[0].id);
            setNotes('');
            setEditMode(false);
            setViewMode(false);
            setIsModalOpen(true);
        }
    };

    const handleSavePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (viewMode) {
            setIsModalOpen(false);
            return;
        }
        if (!currentCompanyId) return alert('No company context');
        try {
            if (!selectedJournal || !amount) throw new Error('Missing required fields (Journal or Amount)');
            
            if (paymentCategory === 'partner' && !selectedPartner) {
                throw new Error('Please select a Partner for Party Payment');
            }
            if (paymentCategory === 'direct_account' && !selectedAccount) {
                throw new Error('Please select an Account/Expense Ledger for Direct Payment');
            }

            const payload = {
                company_id: currentCompanyId,
                payment_category: paymentCategory,
                payment_type: paymentType,
                partner_type: paymentType === 'inbound' ? 'customer' : 'vendor',
                partner_id: selectedPartner || null,
                account_id: paymentCategory === 'direct_account' ? selectedAccount : (selectedAccount || null),
                amount: Number(amount),
                date: date,
                accounting_journal_id: selectedJournal,
                notes: notes,
                state: 'draft'
            };

            if (editMode && editingPaymentId) {
                const { error } = await supabase
                    .from('accounting_payments')
                    .update({
                        payment_category: paymentCategory,
                        payment_type: paymentType,
                        partner_type: paymentType === 'inbound' ? 'customer' : 'vendor',
                        partner_id: selectedPartner || null,
                        account_id: paymentCategory === 'direct_account' ? selectedAccount : (selectedAccount || null),
                        amount: Number(amount),
                        date: date,
                        accounting_journal_id: selectedJournal,
                        notes: notes
                    })
                    .eq('id', editingPaymentId);

                if (error) throw error;
                alert('Payment Updated!');
            } else {
                const { error } = await supabase.from('accounting_payments').insert([payload]);
                if (error) throw error;
                alert('Payment Created!');
            }

            setIsModalOpen(false);
            setAmount('');
            setNotes('');
            fetchPayments();

        } catch (err: any) {
            console.error(err);
            alert('Error saving payment: ' + err.message);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this draft payment? This action cannot be undone.')) return;

        const { error } = await supabase
            .from('accounting_payments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(error);
            alert('Error deleting payment: ' + error.message);
        } else {
            alert('Payment deleted successfully');
            fetchPayments();
        }
    };

    const handlePost = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Confirm Post? This will generate a Journal Entry.')) return;

        const { error } = await supabase.rpc('rpc_post_accounting_payment', { p_payment_id: id });
        if (error) alert('Error posting: ' + error.message);
        else fetchPayments();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Payments</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Register customer receipts, vendor payments, or direct expense & operational payments.</p>
                </div>
                <div className="flex items-center gap-3 no-print">
                    <PrintButton />
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Payment
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Number</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Partner / Account Ledger</th>
                            <th className="px-6 py-4">Journal</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {loading ? (
                            <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : payments.length === 0 ? (
                            <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400">No payments registered yet.</td></tr>
                        ) : payments.map(pay => {
                            const isDirect = pay.payment_category === 'direct_account' || !!pay.account_id;
                            const displayName = isDirect 
                                ? (pay.account ? `${pay.account.code} - ${pay.account.name}` : 'Expense Ledger')
                                : (pay.partner?.name || 'Party Payment');
                            const partnerSubtext = isDirect && pay.partner?.name ? ` (Partner: ${pay.partner.name})` : '';

                            return (
                                <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4 text-slate-500">{pay.date}</td>
                                    <td className="px-6 py-4 font-medium">{pay.name || `PAY-${pay.id.slice(0, 5).toUpperCase()}`}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                                            isDirect 
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                                        }`}>
                                            {isDirect ? <BookOpen className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                                            {isDirect ? 'Direct Expense/Ledger' : 'Party Payment'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                                        {displayName}
                                        {partnerSubtext && <span className="text-xs text-slate-400 font-normal">{partnerSubtext}</span>}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{pay.journal?.code || 'Bank/Cash'}</td>
                                    <td className={`px-6 py-4 text-right font-bold ${pay.payment_type === 'inbound' ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                        <div className="flex items-center justify-end gap-1">
                                            {pay.payment_type === 'inbound' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                            QAR {Number(pay.amount).toFixed(2)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${pay.state === 'posted'
                                                 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                 : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                            {pay.state === 'posted' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                            {pay.state}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex gap-2 justify-center items-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenModal(pay, true); }}
                                                className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded transition-colors"
                                            >
                                                View
                                            </button>
                                            {pay.state === 'draft' && (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenModal(pay, false); }}
                                                        className="px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded transition-colors"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(pay.id, e)}
                                                        className="px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition-colors"
                                                    >
                                                        Delete
                                                    </button>
                                                    <button
                                                        onClick={(e) => handlePost(pay.id, e)}
                                                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                                                    >
                                                        POST
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Create / Edit Modal */}
            {isModalOpen && (
                <Modal title={viewMode ? "View Payment" : (editMode ? "Edit Payment" : "Register Payment")} onClose={() => setIsModalOpen(false)}>
                    <form onSubmit={handleSavePayment} className="space-y-5">
                        
                        {/* Money In vs Money Out */}
                        <div className="flex gap-4 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setPaymentType('inbound')}
                                disabled={viewMode}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${paymentType === 'inbound'
                                        ? 'bg-white dark:bg-zinc-700 text-emerald-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    } ${viewMode ? 'opacity-80' : ''}`}
                            >
                                Money In (Receipt)
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentType('outbound')}
                                disabled={viewMode}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${paymentType === 'outbound'
                                        ? 'bg-white dark:bg-zinc-700 text-rose-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    } ${viewMode ? 'opacity-80' : ''}`}
                            >
                                Money Out (Vendor / Expense)
                            </button>
                        </div>

                        {/* Category Selector: Party Payment vs Direct Expense Ledger */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Payment Mode / Counterpart</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPaymentCategory('partner')}
                                    disabled={viewMode}
                                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition-all ${
                                        paymentCategory === 'partner'
                                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                                            : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                    }`}
                                >
                                    <Users className="w-4 h-4" />
                                    Party Payment (Customer/Vendor)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentCategory('direct_account')}
                                    disabled={viewMode}
                                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition-all ${
                                        paymentCategory === 'direct_account'
                                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                                            : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                    }`}
                                >
                                    <BookOpen className="w-4 h-4" />
                                    Expense / Account Ledger
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* If Direct Account Ledger selected */}
                            {paymentCategory === 'direct_account' && (
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                        Expense / Account Ledger <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        required
                                        value={selectedAccount}
                                        onChange={e => setSelectedAccount(e.target.value)}
                                        disabled={viewMode}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium"
                                    >
                                        <option value="">Select Account Ledger (Rent, Salary, Project Costs, etc.)</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.code} - {acc.name} ({acc.type})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Partner selection */}
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Partner {paymentCategory === 'partner' ? <span className="text-rose-500">*</span> : <span className="text-slate-400 font-normal">(Optional Tag)</span>}
                                </label>
                                <select
                                    required={paymentCategory === 'partner'}
                                    value={selectedPartner}
                                    onChange={e => setSelectedPartner(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium"
                                >
                                    <option value="">Select Partner</option>
                                    {partners.map(p => <option key={p.id} value={p.id}>{p.name} ({p.partner_type})</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                                <input type="date" required value={date} onChange={e => setDate(e.target.value)} disabled={viewMode} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bank/Cash Journal</label>
                                <select
                                    required
                                    value={selectedJournal}
                                    onChange={e => setSelectedJournal(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                                >
                                    <option value="">Select Journal</option>
                                    {journals.map(j => <option key={j.id} value={j.id}>{j.name} ({j.type})</option>)}
                                </select>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Memo / Notes</label>
                                <input value={notes} onChange={e => setNotes(e.target.value)} disabled={viewMode} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" placeholder="e.g. Office rent payment for August, Salary disbursement..." />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                            <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors">
                                {viewMode ? "Close" : (editMode ? "Save Changes" : "Confirm Payment")}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

