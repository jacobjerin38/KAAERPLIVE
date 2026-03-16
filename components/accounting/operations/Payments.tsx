import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, CheckCircle, Clock } from 'lucide-react';
import { Modal } from '../../ui/Modal';

export const Payments: React.FC = () => {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Masters
    const [partners, setPartners] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]); // Bank/Cash Journals

    // Form State
    const [paymentType, setPaymentType] = useState('inbound'); // inbound, outbound
    const [selectedPartner, setSelectedPartner] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedJournal, setSelectedJournal] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        fetchPayments();
        fetchMasters();
    }, []);

    const fetchPayments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('accounting_payments')
            .select(`
                *,
                partner:accounting_partners(name),
                journal:journals(code)
            `)
            .order('date', { ascending: false });

        if (error) console.error(error);
        else setPayments(data || []);
        setLoading(false);
    };

    const fetchMasters = async () => {
        const { data: pData } = await supabase.from('accounting_partners').select('id, name, partner_type');
        setPartners(pData || []);

        // Fetch only Bank/Cash journals
        const { data: jData } = await supabase.from('journals').select('id, name, type').in('type', ['Bank', 'Cash']);
        setJournals(jData || []);
        if (jData && jData.length > 0) setSelectedJournal(jData[0].id);
    };

    const handleCreatePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!selectedPartner || !selectedJournal || !amount) throw new Error('Missing required fields');

            const payload = {
                payment_type: paymentType,
                partner_type: 'customer', // Default for now, ideally derived from partner
                partner_id: selectedPartner,
                amount: Number(amount),
                date: date,
                journal_id: selectedJournal,
                notes: notes,
                state: 'draft'
            };

            const { error } = await supabase.from('accounting_payments').insert([payload]);

            if (error) throw error;

            setIsModalOpen(false);
            setAmount('');
            setNotes('');
            fetchPayments();

        } catch (err: any) {
            console.error(err);
            alert('Error creating payment: ' + err.message);
        }
    };

    const handlePost = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Confirm Post? This will generate a Journal Entry.')) return;

        const { error } = await supabase.rpc('rpc_post_payment', { p_payment_id: id });
        if (error) alert('Error posting: ' + error.message);
        else fetchPayments();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Payments</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Payment
                </button>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Number</th>
                            <th className="px-6 py-4">Partner</th>
                            <th className="px-6 py-4">Journal</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {loading ? (
                            <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : payments.map(pay => (
                            <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-6 py-4 text-slate-500">{pay.date}</td>
                                <td className="px-6 py-4 font-medium">{pay.name || '-'}</td>
                                <td className="px-6 py-4">{pay.partner?.name}</td>
                                <td className="px-6 py-4 text-slate-500">{pay.journal?.code}</td>
                                <td className={`px-6 py-4 text-right font-bold ${pay.payment_type === 'inbound' ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'
                                    }`}>
                                    <div className="flex items-center justify-end gap-1">
                                        {pay.payment_type === 'inbound' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                        ${Number(pay.amount).toFixed(2)}
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
                                    {pay.state === 'draft' && (
                                        <button
                                            onClick={(e) => handlePost(pay.id, e)}
                                            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
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
                <Modal title="Register Payment" onClose={() => setIsModalOpen(false)}>
                    <form onSubmit={handleCreatePayment} className="space-y-6">
                        <div className="flex gap-4 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setPaymentType('inbound')}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${paymentType === 'inbound'
                                        ? 'bg-white dark:bg-zinc-700 text-emerald-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Money In (Customer)
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentType('outbound')}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${paymentType === 'outbound'
                                        ? 'bg-white dark:bg-zinc-700 text-rose-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Money Out (Vendor)
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Partner</label>
                                <select
                                    required
                                    value={selectedPartner}
                                    onChange={e => setSelectedPartner(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
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
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bank/Cash Journal</label>
                                <select
                                    required
                                    value={selectedJournal}
                                    onChange={e => setSelectedJournal(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                                >
                                    <option value="">Select Journal</option>
                                    {journals.map(j => <option key={j.id} value={j.id}>{j.name} ({j.type})</option>)}
                                </select>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Memo / Notes</label>
                                <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" placeholder="e.g. Invoice Ref..." />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                            <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors">
                                Confirm Payment
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
