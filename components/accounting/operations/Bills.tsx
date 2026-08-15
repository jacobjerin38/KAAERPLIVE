import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Filter, FileText, CheckCircle, Clock } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { PrintButton } from '../../ui/PrintButton';


export const Bills: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Masters for Create Modal
    const [partners, setPartners] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]); // To select Purchase Journal
    const [costCenters, setCostCenters] = useState<any[]>([]);
    const [purchaseLedgers, setPurchaseLedgers] = useState<any[]>([]);

    // Form State
    const [selectedPartner, setSelectedPartner] = useState('');
    const [selectedJournal, setSelectedJournal] = useState('');
    const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);

    // Edit/View State
    const [editMode, setEditMode] = useState(false);
    const [viewMode, setViewMode] = useState(false);
    const [editingBillId, setEditingBillId] = useState<string | null>(null);

    // Line Items
    const [lines, setLines] = useState<any[]>([{ item_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', purchase_ledger_id: '', description: '' }]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchBills();
            fetchMasters();
        }
    }, [currentCompanyId]);

    const fetchBills = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('accounting_journal_entries')
            .select(`
                *,
                partner:accounting_partners(name),
                journal:accounting_journals(code)
            `)
            .eq('company_id', currentCompanyId)
            .eq('move_type', 'in_invoice')
            .order('date', { ascending: false });

        if (error) console.error(error);
        else setBills(data || []);
        setLoading(false);
    };

    const fetchMasters = async () => {
        if (!currentCompanyId) return;
        const { data: pData } = await supabase.from('accounting_partners').select('id, name').eq('company_id', currentCompanyId).or('partner_type.eq.Vendor,partner_type.eq.Both');
        setPartners(pData || []);

        const { data: iData } = await supabase.from('item_master').select('id, name, code, expense_account_id').eq('company_id', currentCompanyId);
        setItems(iData || []);

        const { data: jData } = await supabase.from('accounting_journals').select('id, name').eq('company_id', currentCompanyId).eq('type', 'Purchase');
        setJournals(jData || []);
        if (jData && jData.length > 0) setSelectedJournal(jData[0].id);

        const { data: ccData } = await supabase.from('accounting_cost_centers').select('id, name, code, type').eq('company_id', currentCompanyId).eq('is_active', true);
        setCostCenters(ccData || []);

        const { data: plData } = await supabase.from('accounting_purchase_ledgers').select('id, name, account_id').eq('company_id', currentCompanyId).eq('is_active', true);
        setPurchaseLedgers(plData || []);
    };

    const handleOpenModal = async (bill?: any, readonly = false) => {
        if (bill) {
            setEditingBillId(bill.id);
            setSelectedPartner(bill.partner_id || '');
            setSelectedJournal(bill.journal_id || '');
            setBillDate(bill.date || '');
            setDueDate(bill.due_date || '');
            setEditMode(!readonly);
            setViewMode(readonly);

            // Fetch lines for this bill
            const { data, error } = await supabase
                .from('accounting_journal_lines')
                .select('*')
                .eq('entry_id', bill.id);

            if (error) {
                console.error(error);
                alert('Error fetching lines: ' + error.message);
                return;
            }

            // Filter out the balancing line (receivable/payable)
            const itemLines = (data as any[] || []).filter(l => Number(l.debit) > 0);

            const mappedLines = itemLines.map((l: any) => {
                const matchedLedger = purchaseLedgers.find(pl => pl.account_id === l.account_id);
                return {
                    item_id: l.item_id || '',
                    purchase_ledger_id: matchedLedger ? matchedLedger.id : '',
                    cost_center_id: l.cost_center_id || '',
                    project_cost_center_id: l.project_cost_center_id || '',
                    contract_cost_center_id: l.contract_cost_center_id || '',
                    quantity: Number(l.quantity || 1),
                    unit_price: Number(l.unit_price || l.debit || 0),
                    description: l.name || ''
                };
            });

            setLines(mappedLines.length > 0 ? mappedLines : [{ item_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', purchase_ledger_id: '', description: '' }]);
            setIsModalOpen(true);
        } else {
            setEditingBillId(null);
            setSelectedPartner('');
            if (journals.length > 0) setSelectedJournal(journals[0].id);
            setBillDate(new Date().toISOString().split('T')[0]);
            setDueDate(new Date().toISOString().split('T')[0]);
            setLines([{ item_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', purchase_ledger_id: '', description: '' }]);
            setEditMode(false);
            setViewMode(false);
            setIsModalOpen(true);
        }
    };

    const handleAddLine = () => {
        setLines([...lines, { item_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', purchase_ledger_id: '', description: '' }]);
    };

    const handleLineChange = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        newLines[index][field] = value;
        setLines(newLines);
    };

    const handleCreateBill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (viewMode) {
            setIsModalOpen(false);
            return;
        }
        try {
            if (!selectedPartner) {
                alert('Please select a vendor.');
                return;
            }
            if (!selectedJournal) {
                alert('Please select a purchase journal.');
                return;
            }

            const payloadLines = lines.map(l => ({
                item_id: l.item_id ? String(l.item_id).trim() : null,
                quantity: Number(l.quantity) || 1,
                unit_price: Number(l.unit_price) || 0,
                cost_center_id: l.cost_center_id ? String(l.cost_center_id).trim() : null,
                project_cost_center_id: l.project_cost_center_id ? String(l.project_cost_center_id).trim() : null,
                contract_cost_center_id: l.contract_cost_center_id ? String(l.contract_cost_center_id).trim() : null,
                purchase_ledger_id: l.purchase_ledger_id ? String(l.purchase_ledger_id).trim() : null,
                description: l.description ? String(l.description).trim() : null
            }));

            if (editMode && editingBillId) {
                const updatePayload = {
                    p_entry_id: editingBillId,
                    p_partner_id: selectedPartner,
                    p_journal_id: selectedJournal,
                    p_date: billDate,
                    p_due_date: dueDate,
                    p_lines: payloadLines,
                    p_company_id: currentCompanyId
                };
                const { error } = await (supabase.rpc as any)('rpc_update_accounting_invoice', updatePayload);
                if (error) throw error;
                alert('Bill Updated successfully!');
            } else {
                const payload = {
                    p_partner_id: selectedPartner,
                    p_journal_id: selectedJournal,
                    p_date: billDate,
                    p_due_date: dueDate,
                    p_move_type: 'in_invoice',
                    p_lines: payloadLines,
                    p_company_id: currentCompanyId
                };

                const { data, error } = await (supabase.rpc as any)('rpc_create_accounting_invoice', payload);
                if (error) throw error;
                alert('Bill Created successfully!');
            }

            setIsModalOpen(false);
            setLines([{ item_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', purchase_ledger_id: '', description: '' }]);
            fetchBills();

        } catch (err: any) {
            console.error(err);
            alert('Error saving bill: ' + (err.message || 'Failed to save bill'));
        }
    };

    const handlePost = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Confirm Post? This will lock the bill.')) return;

        const { data, error } = await supabase.rpc('rpc_post_accounting_entry', { 
            p_entry_id: id
        });
        if (error) alert('Error posting: ' + error.message);
        else {
            const res = data as any;
            if (res?.success) alert('Posted Successfully');
            else alert('Post Failed: ' + (res?.message || 'Unknown error'));
            fetchBills();
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this draft bill? This action cannot be undone.')) return;

        const { error } = await supabase
            .from('accounting_journal_entries')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(error);
            alert('Error deleting bill: ' + error.message);
        } else {
            alert('Bill deleted successfully');
            fetchBills();
        }
    };

    const handleApprove = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const { error } = await supabase
            .from('accounting_journal_entries')
            .update({ approval_status: 'approved' })
            .eq('id', id);
        
        if (error) alert('Error approving: ' + error.message);
        else fetchBills();
    };

    const genericCC = costCenters.filter(cc => cc.type === 'GENERIC');
    const projectCC = costCenters.filter(cc => cc.type === 'PROJECT');
    const contractCC = costCenters.filter(cc => cc.type === 'CONTRACT');

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Vendor Bills</h2>
                <div className="flex items-center gap-3 no-print">
                    <PrintButton />
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Bill
                    </button>
                </div>
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
                                    {bill.reference || `BILL-${bill.id.slice(0, 5).toUpperCase()}`}
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
                                    QAR {Number(bill.amount_total).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex gap-2 justify-center items-center">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(bill, true); }}
                                            className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded transition-colors"
                                        >
                                            View
                                        </button>
                                        {bill.state === 'Draft' && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(bill, false); }}
                                                    className="px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(bill.id, e)}
                                                    className="px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition-colors"
                                                >
                                                    Delete
                                                </button>
                                                {bill.approval_status !== 'approved' && (
                                                    <button
                                                        onClick={(e) => handleApprove(bill.id, e)}
                                                        className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                                    >
                                                        APPROVE
                                                    </button>
                                                )}
                                                {bill.approval_status === 'approved' && (
                                                    <button
                                                        onClick={(e) => handlePost(bill.id, e)}
                                                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                                                    >
                                                        POST
                                                    </button>
                                                )}
                                            </>
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
                <Modal title={viewMode ? "View Vendor Bill" : (editMode ? "Edit Vendor Bill" : "Create Vendor Bill")} onClose={() => setIsModalOpen(false)} maxWidth="5xl">
                    <form onSubmit={handleCreateBill} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vendor</label>
                                <select
                                    required
                                    value={selectedPartner}
                                    onChange={e => setSelectedPartner(e.target.value)}
                                    disabled={viewMode}
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
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                                >
                                    <option value="">Select Journal</option>
                                    {journals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bill Date</label>
                                <input type="date" required value={billDate} onChange={e => setBillDate(e.target.value)} disabled={viewMode} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                                <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={viewMode} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Bill Lines</h4>
                            </div>

                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 space-y-3">
                                {lines.map((line, idx) => (
                                    <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 items-end border-b border-slate-100 dark:border-zinc-800 pb-3 md:pb-0 md:border-b-0">
                                        <div className="flex-1 min-w-[150px]">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Item</label>
                                            <select
                                                value={line.item_id}
                                                onChange={e => handleLineChange(idx, 'item_id', e.target.value)}
                                                disabled={viewMode}
                                                className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                            >
                                                <option value="">Select Item</option>
                                                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-full md:w-48">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Purchase Ledger</label>
                                            <select
                                                required={!line.item_id}
                                                value={line.purchase_ledger_id}
                                                onChange={e => handleLineChange(idx, 'purchase_ledger_id', e.target.value)}
                                                disabled={viewMode}
                                                className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                            >
                                                <option value="">Select Purchase Ledger</option>
                                                {purchaseLedgers.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-full md:flex-1 min-w-[150px]">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Narration</label>
                                            <input
                                                type="text"
                                                value={line.description || ''}
                                                onChange={e => handleLineChange(idx, 'description', e.target.value)}
                                                disabled={viewMode}
                                                placeholder="Comment / Line note"
                                                className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                            />
                                        </div>
                                        <div className="w-full md:w-36">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Project CC</label>
                                            <select
                                                value={line.project_cost_center_id}
                                                onChange={e => handleLineChange(idx, 'project_cost_center_id', e.target.value)}
                                                disabled={viewMode}
                                                className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                            >
                                                <option value="">None</option>
                                                {projectCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-full md:w-36">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Contract CC</label>
                                            <select
                                                value={line.contract_cost_center_id}
                                                onChange={e => handleLineChange(idx, 'contract_cost_center_id', e.target.value)}
                                                disabled={viewMode}
                                                className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                            >
                                                <option value="">None</option>
                                                {contractCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-full md:w-36">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Cost Center</label>
                                            <select
                                                value={line.cost_center_id}
                                                onChange={e => handleLineChange(idx, 'cost_center_id', e.target.value)}
                                                disabled={viewMode}
                                                className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                            >
                                                <option value="">None</option>
                                                {genericCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-20">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Qty</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={line.quantity}
                                                onChange={e => handleLineChange(idx, 'quantity', e.target.value)}
                                                disabled={viewMode}
                                                className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                            />
                                        </div>
                                        <div className="w-28">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Price</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">QAR</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={line.unit_price}
                                                    onChange={e => handleLineChange(idx, 'unit_price', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full pl-10 p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                                />
                                            </div>
                                        </div>
                                        {!viewMode && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newLines = lines.filter((_, i) => i !== idx);
                                                    setLines(newLines);
                                                }}
                                                className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md mb-0.5"
                                            >
                                                &times;
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {!viewMode && (
                                    <button type="button" onClick={handleAddLine} className="text-xs font-bold text-blue-600 hover:underline">+ Add Line</button>
                                )}
                            </div>

                            <div className="flex justify-end text-right">
                                <div>
                                    <span className="text-xs text-slate-500 font-bold uppercase mr-4">Total</span>
                                    <span className="text-xl font-bold text-slate-800 dark:text-white">
                                        QAR {lines.reduce((acc, l) => acc + (Number(l.quantity) * Number(l.unit_price)), 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                            <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all">
                                {viewMode ? "Close" : (editMode ? "Save Changes" : "Create Bill")}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
