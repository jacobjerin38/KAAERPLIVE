import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Filter, FileText, CheckCircle, Clock } from 'lucide-react';
import { Modal } from '../../ui/Modal';

export const Bills: React.FC = () => {
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Masters for Create Modal
    const [partners, setPartners] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]); // To select Purchase Journal

    // Form State
    const [selectedPartner, setSelectedPartner] = useState('');
    const [selectedJournal, setSelectedJournal] = useState('');
    const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);

    // Line Items
    const [lines, setLines] = useState<any[]>([{ item_id: '', quantity: 1, unit_price: 0 }]);

    useEffect(() => {
        fetchBills();
        fetchMasters();
    }, []);

    const fetchBills = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('accounting_moves')
            .select(`
                *,
                partner:accounting_partners(name),
                journal:journals(code)
            `)
            .eq('move_type', 'in_invoice')
            .order('date', { ascending: false });

        if (error) console.error(error);
        else setBills(data || []);
        setLoading(false);
    };

    const fetchMasters = async () => {
        const { data: pData } = await supabase.from('accounting_partners').select('id, name').or('partner_type.eq.Vendor,partner_type.eq.Both');
        setPartners(pData || []);

        const { data: iData } = await supabase.from('item_master').select('id, name, code, expense_account_id');
        setItems(iData || []);

        const { data: jData } = await supabase.from('journals').select('id, name').eq('type', 'Purchase');
        setJournals(jData || []);
        if (jData && jData.length > 0) setSelectedJournal(jData[0].id);
    };

    const handleAddLine = () => {
        setLines([...lines, { item_id: '', quantity: 1, unit_price: 0 }]);
    };

    const handleLineChange = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        newLines[index][field] = value;
        setLines(newLines);
    };

    const handleCreateBill = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!selectedPartner || !selectedJournal) throw new Error('Missing required fields');

            const payload = {
                p_partner_id: selectedPartner,
                p_journal_id: selectedJournal,
                p_date: billDate,
                p_due_date: dueDate,
                p_move_type: 'in_invoice',
                p_lines: lines.map(l => ({
                    item_id: l.item_id,
                    quantity: Number(l.quantity),
                    unit_price: Number(l.unit_price)
                }))
            };

            const { data, error } = await supabase.rpc('rpc_create_invoice', payload);

            if (error) throw error;

            alert('Bill Created! ID: ' + data);
            setIsModalOpen(false);
            setLines([{ item_id: '', quantity: 1, unit_price: 0 }]);
            fetchBills();

        } catch (err: any) {
            console.error(err);
            alert('Error creating bill: ' + err.message);
        }
    };

    const handlePost = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Confirm Post? This will lock the bill.')) return;

        const { data, error } = await supabase.rpc('rpc_post_move', { 
            p_move_id: id,
            p_user_id: (await supabase.auth.getUser()).data.user?.id 
        });
        if (error) alert('Error posting: ' + error.message);
        else {
            const res = data as any;
            if (res?.success) alert('Posted Successfully');
            else alert('Post Failed: ' + (res?.message || 'Unknown error'));
            fetchBills();
        }
    };

    const handleApprove = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const { error } = await supabase
            .from('accounting_moves')
            .update({ approval_status: 'approved' })
            .eq('id', id);
        
        if (error) alert('Error approving: ' + error.message);
        else fetchBills();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Vendor Bills</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Bill
                </button>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">Number</th>
                            <th className="px-6 py-4">Vendor</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Approval</th>
                            <th className="px-6 py-4 text-right">Total</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {loading ? (
                            <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : bills.map(bill => (
                            <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                                    {bill.reference || 'Draft'}
                                </td>
                                <td className="px-6 py-4">{bill.partner?.name}</td>
                                <td className="px-6 py-4 text-slate-500">{bill.date}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${bill.state === 'Posted'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                        {bill.state === 'Posted' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                        {bill.state}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${bill.approval_status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {bill.approval_status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-white">
                                    ${Number(bill.amount_total).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex gap-2 justify-center">
                                        {bill.state === 'Draft' && bill.approval_status !== 'approved' && (
                                            <button
                                                onClick={(e) => handleApprove(bill.id, e)}
                                                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                            >
                                                APPROVE
                                            </button>
                                        )}
                                        {bill.state === 'Draft' && bill.approval_status === 'approved' && (
                                            <button
                                                onClick={(e) => handlePost(bill.id, e)}
                                                className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                                            >
                                                POST
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
                <Modal title="create Vendor Bill" onClose={() => setIsModalOpen(false)}>
                    <form onSubmit={handleCreateBill} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vendor</label>
                                <select
                                    required
                                    value={selectedPartner}
                                    onChange={e => setSelectedPartner(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                                >
                                    <option value="">Select Vendor</option>
                                    {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Journal</label>
                                <select
                                    required
                                    value={selectedJournal}
                                    onChange={e => setSelectedJournal(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                                >
                                    <option value="">Select Journal</option>
                                    {journals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bill Date</label>
                                <input type="date" required value={billDate} onChange={e => setBillDate(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                                <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Bill Lines</h4>
                            </div>

                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 space-y-3">
                                {lines.map((line, idx) => (
                                    <div key={idx} className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Item</label>
                                            <select
                                                value={line.item_id}
                                                onChange={e => handleLineChange(idx, 'item_id', e.target.value)}
                                                className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                            >
                                                <option value="">Select Item</option>
                                                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Qty</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={line.quantity}
                                                onChange={e => handleLineChange(idx, 'quantity', e.target.value)}
                                                className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                            />
                                        </div>
                                        <div className="w-32">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Price</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={line.unit_price}
                                                    onChange={e => handleLineChange(idx, 'unit_price', e.target.value)}
                                                    className="w-full pl-5 p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newLines = lines.filter((_, i) => i !== idx);
                                                setLines(newLines);
                                            }}
                                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-md"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                                <button type="button" onClick={handleAddLine} className="text-xs font-bold text-blue-600 hover:underline">+ Add Line</button>
                            </div>

                            <div className="flex justify-end text-right">
                                <div>
                                    <span className="text-xs text-slate-500 font-bold uppercase mr-4">Total</span>
                                    <span className="text-xl font-bold text-slate-800 dark:text-white">
                                        ${lines.reduce((acc, l) => acc + (Number(l.quantity) * Number(l.unit_price)), 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                            <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all">
                                Create Bill
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
