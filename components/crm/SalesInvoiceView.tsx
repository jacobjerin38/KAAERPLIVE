import React, { useState, useEffect } from 'react';
import { Plus, Search, Receipt, Loader2, Trash2, ArrowRight, Truck, CheckCircle, Printer } from 'lucide-react';
import { CRMSalesInvoice, CRMSalesInvoiceLine, CRMItem, CRMCustomer } from './types';
import { getSalesInvoices, createSalesInvoice, updateSalesInvoice, getSalesInvoiceLines, saveSalesInvoiceLines, getItems, getCustomers, convertInvoiceToDeliveryNote } from './services';
import { AttachmentPanel } from './AttachmentPanel';
import { useAuth } from '../../contexts/AuthContext';
import PrintDocumentModal from './PrintDocumentModal';

interface Props {
    companyId: string;
    onConvert?: (tab: string) => void;
}

const statusColors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-600',
    Unpaid: 'bg-amber-100 text-amber-700',
    Paid: 'bg-emerald-100 text-emerald-700',
    'Partially Paid': 'bg-blue-100 text-blue-700',
    Overdue: 'bg-red-100 text-red-700',
    Cancelled: 'bg-zinc-100 text-zinc-500',
};

const SalesInvoiceView: React.FC<Props> = ({ companyId, onConvert }) => {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<CRMSalesInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [activeInv, setActiveInv] = useState<Partial<CRMSalesInvoice>>({});
    const [lines, setLines] = useState<CRMSalesInvoiceLine[]>([]);
    const [items, setItems] = useState<CRMItem[]>([]);
    const [customers, setCustomers] = useState<CRMCustomer[]>([]);
    const [saving, setSaving] = useState(false);
    const [converting, setConverting] = useState(false);
    const [search, setSearch] = useState('');
    const [showPrint, setShowPrint] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [inv, i, c] = await Promise.all([getSalesInvoices(), getItems(), getCustomers()]);
        setInvoices(inv);
        setItems(i.filter(it => it.company_id === companyId));
        setCustomers(c);
        setLoading(false);
    };

    const openNew = () => {
        setActiveInv({ currency: 'INR', status: 'Unpaid', invoice_date: new Date().toISOString().split('T')[0], amount_paid: 0 });
        setLines([]);
        setShowModal(true);
    };

    const openEdit = async (inv: CRMSalesInvoice) => {
        setActiveInv({ ...inv });
        const l = await getSalesInvoiceLines(inv.id);
        setLines(l);
        setShowModal(true);
    };

    const addLine = () => {
        setLines(prev => [...prev, { item_name: '', quantity: 1, rate: 0, discount_percent: 0, tax_percent: 0 }]);
    };

    const updateLine = (idx: number, field: string, value: any) => {
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
    };

    const removeLine = (idx: number) => { setLines(prev => prev.filter((_, i) => i !== idx)); };

    const selectItem = (idx: number, itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (item) setLines(prev => prev.map((l, i) => i === idx ? { ...l, item_id: item.id, item_name: item.name, rate: item.selling_price || 0 } : l));
    };

    const calcLineAmount = (l: CRMSalesInvoiceLine) => l.quantity * l.rate * (1 - (l.discount_percent || 0) / 100);
    const subtotal = lines.reduce((s, l) => s + calcLineAmount(l), 0);
    const taxAmount = lines.reduce((s, l) => s + calcLineAmount(l) * (l.tax_percent || 0) / 100, 0);
    const grandTotal = subtotal + taxAmount;

    const handleSave = async () => {
        if (!activeInv.customer_id) return alert('Please select a customer');
        setSaving(true);
        const payload = { ...activeInv, company_id: companyId, subtotal, tax_amount: taxAmount, grand_total: grandTotal, owner_id: user?.id };
        delete payload.customer; delete payload.lines;
        let result: CRMSalesInvoice | null;
        if (activeInv.id) {
            result = await updateSalesInvoice(activeInv.id, payload);
        } else {
            result = await createSalesInvoice(payload);
        }
        if (result && lines.length > 0) await saveSalesInvoiceLines(result.id, lines);
        setSaving(false);
        setShowModal(false);
        loadData();
    };

    const handleMarkPaid = async () => {
        if (!activeInv.id) return;
        await updateSalesInvoice(activeInv.id, { status: 'Paid', amount_paid: activeInv.grand_total || grandTotal } as any);
        setShowModal(false);
        loadData();
    };

    const handleCreateDN = async () => {
        if (!activeInv.id) return;
        setConverting(true);
        const dn = await convertInvoiceToDeliveryNote(activeInv as CRMSalesInvoice, companyId, user?.id);
        setConverting(false);
        if (dn) {
            alert('Delivery Note created!');
            setShowModal(false);
            loadData();
            onConvert?.('DELIVERY_NOTES');
        } else {
            alert('Failed to create delivery note');
        }
    };

    const filtered = invoices.filter(i =>
        (i.customer?.name || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt className="text-emerald-500" size={22} /> Sales Invoices
                </h2>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..."
                            className="pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    </div>
                    <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all text-sm font-semibold">
                        <Plus size={16} /> New Invoice
                    </button>
                </div>
            </div>

            {/* Sales Flow */}
            <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-900/10 dark:to-emerald-900/10 rounded-xl border border-emerald-100/50 dark:border-emerald-800/30">
                <span className="text-xs font-medium text-slate-400">Quotation</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg">Sales Invoice</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-400">Delivery Note</span>
            </div>

            <div className="flex-1 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-auto shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-emerald-500" size={28} /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-400"><Receipt size={40} className="mx-auto mb-3 opacity-30" /><p>No invoices yet</p></div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-zinc-800 text-left text-xs text-slate-500 uppercase tracking-wider">
                                <th className="px-5 py-3">Date</th>
                                <th className="px-5 py-3">Customer</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3 text-right">Grand Total</th>
                                <th className="px-5 py-3 text-right">Paid</th>
                                <th className="px-5 py-3">Due Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(inv => (
                                <tr key={inv.id} className="border-b border-slate-50 dark:border-zinc-800/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors" onClick={() => openEdit(inv)}>
                                    <td className="px-5 py-3 text-slate-500">{inv.invoice_date}</td>
                                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{inv.customer?.name || '-'}</td>
                                    <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[inv.status]}`}>{inv.status}</span></td>
                                    <td className="px-5 py-3 text-right font-semibold text-slate-900 dark:text-white">₹{(inv.grand_total || 0).toLocaleString()}</td>
                                    <td className="px-5 py-3 text-right text-emerald-600">₹{(inv.amount_paid || 0).toLocaleString()}</td>
                                    <td className="px-5 py-3 text-slate-500">{inv.due_date || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Receipt size={20} className="text-emerald-500" /> {activeInv.id ? 'Edit Invoice' : 'New Invoice'}
                                {activeInv.status && <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[activeInv.status] || ''}`}>{activeInv.status}</span>}
                            </h3>
                        </div>
                        <div className="p-6 space-y-5 max-h-[65vh] overflow-auto">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Customer *</label>
                                    <select value={activeInv.customer_id || ''} onChange={e => setActiveInv(p => ({ ...p, customer_id: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                        <option value="">Select Customer</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Invoice Date</label>
                                    <input type="date" value={activeInv.invoice_date || ''} onChange={e => setActiveInv(p => ({ ...p, invoice_date: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Due Date</label>
                                    <input type="date" value={activeInv.due_date || ''} onChange={e => setActiveInv(p => ({ ...p, due_date: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                </div>
                            </div>

                            {/* Line Items */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Line Items</h4>
                                    <button onClick={addLine} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors">
                                        <Plus size={12} /> Add Item
                                    </button>
                                </div>
                                <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-zinc-800 text-slate-500 text-left">
                                                <th className="px-3 py-2 w-[35%]">Item</th>
                                                <th className="px-3 py-2 w-[12%]">Qty</th>
                                                <th className="px-3 py-2 w-[15%]">Rate</th>
                                                <th className="px-3 py-2 w-[10%]">Disc%</th>
                                                <th className="px-3 py-2 w-[10%]">Tax%</th>
                                                <th className="px-3 py-2 w-[13%] text-right">Amount</th>
                                                <th className="px-3 py-2 w-[5%]"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lines.map((line, idx) => (
                                                <tr key={idx} className="border-t border-slate-100 dark:border-zinc-800">
                                                    <td className="px-2 py-1.5">
                                                        <select value={line.item_id || ''} onChange={e => selectItem(idx, e.target.value)}
                                                            className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30">
                                                            <option value="">Select item</option>
                                                            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 py-1.5"><input type="number" value={line.quantity} onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-center" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={line.rate} onChange={e => updateLine(idx, 'rate', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-right" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={line.discount_percent} onChange={e => updateLine(idx, 'discount_percent', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-center" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={line.tax_percent} onChange={e => updateLine(idx, 'tax_percent', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-center" /></td>
                                                    <td className="px-2 py-1.5 text-right font-medium">₹{calcLineAmount(line).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-2 py-1.5"><button onClick={() => removeLine(idx)} className="p-1 hover:bg-red-50 rounded"><Trash2 size={12} className="text-red-400" /></button></td>
                                                </tr>
                                            ))}
                                            {lines.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No items added</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-end mt-3">
                                    <div className="w-56 space-y-1 text-xs">
                                        <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                                        <div className="flex justify-between text-slate-500"><span>Tax</span><span>₹{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                                        <div className="flex justify-between font-bold text-slate-900 dark:text-white text-sm border-t border-slate-200 dark:border-zinc-700 pt-1"><span>Grand Total</span><span>₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                                        {activeInv.amount_paid !== undefined && activeInv.amount_paid > 0 && (
                                            <div className="flex justify-between text-emerald-600 font-medium"><span>Paid</span><span>₹{(activeInv.amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Notes</label>
                                <textarea value={activeInv.notes || ''} onChange={e => setActiveInv(p => ({ ...p, notes: e.target.value }))}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                            </div>

                            {activeInv.id && <AttachmentPanel companyId={companyId} module="invoice" recordId={activeInv.id} userId={user?.id} />}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                            {activeInv.id && (
                                <button onClick={() => setShowPrint(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-sm font-medium">
                                    <Printer size={16} /> Print
                                </button>
                            )}
                            {activeInv.id && activeInv.status !== 'Paid' && activeInv.status !== 'Cancelled' && (
                                <button onClick={handleMarkPaid} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors text-sm font-medium">
                                    <CheckCircle size={16} /> Mark Paid
                                </button>
                            )}
                            {activeInv.id && activeInv.status !== 'Cancelled' && (
                                <button onClick={handleCreateDN} disabled={converting} className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors shadow-md shadow-purple-600/20 text-sm font-medium disabled:opacity-50">
                                    {converting ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                                    Create Delivery Note
                                </button>
                            )}
                            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium text-sm">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm disabled:opacity-50">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : activeInv.id ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Modal */}
            {showPrint && activeInv.id && (
                <PrintDocumentModal
                    isOpen={showPrint}
                    onClose={() => setShowPrint(false)}
                    documentType="invoice"
                    document={activeInv as CRMSalesInvoice}
                    lines={lines}
                    customer={customers.find(c => c.id === activeInv.customer_id)}
                    companyId={companyId}
                />
            )}
        </div>
    );
};

export default SalesInvoiceView;
