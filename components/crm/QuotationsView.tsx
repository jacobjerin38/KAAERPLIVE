import React, { useState, useEffect } from 'react';
import { Plus, Search, FileText, Loader2, Trash2, ArrowRight, ChevronDown, Receipt, Printer, Building, Mail, Phone, X } from 'lucide-react';
import { CRMQuotation, CRMQuotationLine, CRMItem, CRMCustomer } from './types';
import { getQuotations, createQuotation, updateQuotation, getQuotationLines, saveQuotationLines, getItems, getCustomers, createCustomer, convertQuotationToInvoice } from './services';
import { AttachmentPanel } from './AttachmentPanel';
import { useAuth } from '../../contexts/AuthContext';
import PrintDocumentModal from './PrintDocumentModal';

interface Props {
    companyId: string;
    onConvert?: (tab: string) => void;
}

const statusColors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-600',
    Sent: 'bg-blue-100 text-blue-700',
    Accepted: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Cancelled: 'bg-zinc-100 text-zinc-500',
};

const QuotationsView: React.FC<Props> = ({ companyId, onConvert }) => {
    const { user, userRole } = useAuth();
    const [quotations, setQuotations] = useState<CRMQuotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [activeQuot, setActiveQuot] = useState<Partial<CRMQuotation>>({});
    const [lines, setLines] = useState<CRMQuotationLine[]>([]);
    const [items, setItems] = useState<CRMItem[]>([]);
    const [customers, setCustomers] = useState<CRMCustomer[]>([]);
    const [saving, setSaving] = useState(false);
    const [converting, setConverting] = useState(false);
    const [search, setSearch] = useState('');
    const [showPrint, setShowPrint] = useState(false);

    // Quick customer creation
    const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
    const [savingQuickCustomer, setSavingQuickCustomer] = useState(false);
    const [quickCustomer, setQuickCustomer] = useState<{
        name: string;
        customer_type: string;
        primary_email: string;
        primary_phone: string;
        industry: string;
    }>({
        name: '',
        customer_type: 'Company',
        primary_email: '',
        primary_phone: '',
        industry: ''
    });

    useEffect(() => { loadData(); }, [companyId]);

    const loadData = async () => {
        setLoading(true);
        const [q, i, c] = await Promise.all([
            getQuotations(),
            getItems(),
            getCustomers(user?.id, userRole, 'ALL', companyId)
        ]);
        setQuotations(q);
        setItems(i.filter(it => it.company_id === companyId));
        setCustomers(c);
        setLoading(false);
    };

    const handleSaveQuickCustomer = async () => {
        if (!quickCustomer.name?.trim()) {
            alert("Customer Name is required.");
            return;
        }
        setSavingQuickCustomer(true);
        try {
            const newCust = await createCustomer({
                name: quickCustomer.name.trim(),
                customer_type: quickCustomer.customer_type,
                primary_email: quickCustomer.primary_email?.trim() || undefined,
                primary_phone: quickCustomer.primary_phone?.trim() || undefined,
                industry: quickCustomer.industry?.trim() || undefined,
                company_id: companyId,
                owner_id: user?.id,
                created_by: user?.id,
                status: 'Active'
            });
            if (newCust) {
                setCustomers(prev => [newCust as any, ...prev]);
                setActiveQuot(prev => ({ ...prev, customer_id: newCust.id }));
                setQuickCustomer({ name: '', customer_type: 'Company', primary_email: '', primary_phone: '', industry: '' });
                setShowQuickCustomerModal(false);
            }
        } catch (err: any) {
            console.error('Error creating customer:', err);
            alert('Failed to create customer: ' + (err.message || 'Unknown error'));
        } finally {
            setSavingQuickCustomer(false);
        }
    };

    const openNew = () => {
        setActiveQuot({ currency: 'QAR', status: 'Draft', quotation_date: new Date().toISOString().split('T')[0] });
        setLines([]);
        setShowModal(true);
    };

    const openEdit = async (q: CRMQuotation) => {
        setActiveQuot({ ...q });
        const l = await getQuotationLines(q.id);
        setLines(l);
        setShowModal(true);
    };

    const addLine = () => {
        setLines(prev => [...prev, { item_name: '', quantity: 1, rate: 0, discount_percent: 0, tax_percent: 0 }]);
    };

    const updateLine = (idx: number, field: string, value: any) => {
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
    };

    const removeLine = (idx: number) => {
        setLines(prev => prev.filter((_, i) => i !== idx));
    };

    const selectItem = (idx: number, itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
            updateLine(idx, 'item_id', item.id);
            updateLine(idx, 'item_name', item.name);
            setLines(prev => prev.map((l, i) => i === idx ? { ...l, item_id: item.id, item_name: item.name, rate: item.selling_price || 0 } : l));
        }
    };

    const calcLineAmount = (l: CRMQuotationLine) => l.quantity * l.rate * (1 - (l.discount_percent || 0) / 100);
    const subtotal = lines.reduce((s, l) => s + calcLineAmount(l), 0);
    const taxAmount = lines.reduce((s, l) => s + calcLineAmount(l) * (l.tax_percent || 0) / 100, 0);
    const grandTotal = subtotal + taxAmount;

    const handleSave = async () => {
        if (!activeQuot.customer_id) return alert('Please select a customer');
        if (lines.length === 0) return alert('Add at least one line item');
        setSaving(true);
        const payload = { ...activeQuot, company_id: companyId, subtotal, tax_amount: taxAmount, grand_total: grandTotal, owner_id: user?.id };
        delete payload.customer; delete payload.lines;
        let result: CRMQuotation | null;
        if (activeQuot.id) {
            result = await updateQuotation(activeQuot.id, payload);
        } else {
            result = await createQuotation(payload);
        }
        if (result) await saveQuotationLines(result.id, lines);
        setSaving(false);
        setShowModal(false);
        loadData();
    };

    const handleConvertToInvoice = async () => {
        if (!activeQuot.id) return;
        setConverting(true);
        const inv = await convertQuotationToInvoice(activeQuot as CRMQuotation, companyId, user?.id);
        setConverting(false);
        if (inv) {
            alert('Invoice created successfully!');
            setShowModal(false);
            loadData();
            onConvert?.('SALES_INVOICES');
        } else {
            alert('Failed to create invoice');
        }
    };

    const filtered = quotations.filter(q =>
        (q.customer?.name || '').toLowerCase().includes(search.toLowerCase()) || q.series?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="text-blue-500" size={22} /> Quotations
                </h2>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotations..."
                            className="pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                    <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all text-sm font-semibold">
                        <Plus size={16} /> New Quotation
                    </button>
                </div>
            </div>

            {/* Sales Flow Indicator */}
            <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-900/10 dark:to-emerald-900/10 rounded-xl border border-blue-100/50 dark:border-blue-800/30">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg">Quotation</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-400">Sales Invoice</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-400">Delivery Note</span>
            </div>

            <div className="flex-1 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-auto shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-400"><FileText size={40} className="mx-auto mb-3 opacity-30" /><p>No quotations yet</p></div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-zinc-800 text-left text-xs text-slate-500 uppercase tracking-wider">
                                <th className="px-5 py-3">Date</th>
                                <th className="px-5 py-3">Customer</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3 text-right">Grand Total</th>
                                <th className="px-5 py-3">Valid Until</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(q => (
                                <tr key={q.id} className="border-b border-slate-50 dark:border-zinc-800/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer" onClick={() => openEdit(q)}>
                                    <td className="px-5 py-3 text-slate-500">{q.quotation_date}</td>
                                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{q.customer?.name || 'No Customer'}</td>
                                    <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[q.status] || ''}`}>{q.status}</span></td>
                                    <td className="px-5 py-3 text-right font-semibold text-slate-900 dark:text-white">QAR {(q.grand_total || 0).toLocaleString()}</td>
                                    <td className="px-5 py-3 text-slate-500">{q.valid_until || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 flex-shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileText size={20} className="text-blue-500" /> {activeQuot.id ? 'Edit Quotation' : 'New Quotation'}
                                {activeQuot.status && <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[activeQuot.status] || ''}`}>{activeQuot.status}</span>}
                            </h3>
                        </div>
                        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                            {/* Header Fields */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium text-slate-500">Customer *</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowQuickCustomerModal(true)}
                                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-0.5"
                                        >
                                            <Plus size={12} />
                                            <span>New</span>
                                        </button>
                                    </div>
                                    <select
                                        value={activeQuot.customer_id || ''}
                                        onChange={e => {
                                            if (e.target.value === '__NEW__') {
                                                setShowQuickCustomerModal(true);
                                            } else {
                                                setActiveQuot(p => ({ ...p, customer_id: e.target.value }));
                                            }
                                        }}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="">Select Customer</option>
                                        <option value="__NEW__" className="text-blue-600 font-semibold">+ Add New Customer...</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {customers.length === 0 && (
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                            No customers. Click <button type="button" onClick={() => setShowQuickCustomerModal(true)} className="underline font-semibold">New</button> to add.
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Date</label>
                                    <input type="date" value={activeQuot.quotation_date || ''} onChange={e => setActiveQuot(p => ({ ...p, quotation_date: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Valid Until</label>
                                    <input type="date" value={activeQuot.valid_until || ''} onChange={e => setActiveQuot(p => ({ ...p, valid_until: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                            </div>

                            {/* Line Items */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Line Items</h4>
                                    <button onClick={addLine} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
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
                                                            className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30">
                                                            <option value="">Select item</option>
                                                            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 py-1.5"><input type="number" value={line.quantity} onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500/30" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={line.rate} onChange={e => updateLine(idx, 'rate', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500/30" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={line.discount_percent} onChange={e => updateLine(idx, 'discount_percent', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500/30" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={line.tax_percent} onChange={e => updateLine(idx, 'tax_percent', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500/30" /></td>
                                                    <td className="px-2 py-1.5 text-right font-medium text-slate-700 dark:text-zinc-300">QAR {calcLineAmount(line).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-2 py-1.5"><button onClick={() => removeLine(idx)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={12} className="text-red-400" /></button></td>
                                                </tr>
                                            ))}
                                            {lines.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No items added</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Totals */}
                                <div className="flex justify-end mt-3">
                                    <div className="w-56 space-y-1 text-xs">
                                        <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>QAR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                                        <div className="flex justify-between text-slate-500"><span>Tax</span><span>QAR {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                                        <div className="flex justify-between font-bold text-slate-900 dark:text-white text-sm border-t border-slate-200 dark:border-zinc-700 pt-1"><span>Grand Total</span><span>QAR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Terms & Conditions</label>
                                <textarea value={activeQuot.terms_and_conditions || ''} onChange={e => setActiveQuot(p => ({ ...p, terms_and_conditions: e.target.value }))}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Payment terms, validity conditions..." />
                            </div>

                            {activeQuot.id && <AttachmentPanel companyId={companyId} module="quotation" recordId={activeQuot.id} userId={user?.id} />}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                            <div>
                                {activeQuot.id && activeQuot.status !== 'Cancelled' && (
                                    <div className="flex gap-2">
                                        {['Draft', 'Sent', 'Accepted', 'Rejected'].map(s => (
                                            <button key={s} onClick={() => setActiveQuot(p => ({ ...p, status: s as any }))}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${activeQuot.status === s ? statusColors[s] : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {activeQuot.id && (
                                    <button onClick={() => setShowPrint(true)}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-sm font-medium">
                                        <Printer size={16} /> Print
                                    </button>
                                )}
                                {activeQuot.id && (activeQuot.status === 'Accepted' || activeQuot.status === 'Sent') && (
                                    <button onClick={handleConvertToInvoice} disabled={converting}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20 text-sm font-medium disabled:opacity-50">
                                        {converting ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}
                                        Convert to Invoice
                                    </button>
                                )}
                                <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium text-sm">Cancel</button>
                                <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm disabled:opacity-50">
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : activeQuot.id ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Modal */}
            {showPrint && activeQuot.id && (
                <PrintDocumentModal
                    isOpen={showPrint}
                    onClose={() => setShowPrint(false)}
                    documentType="quotation"
                    document={activeQuot as CRMQuotation}
                    lines={lines}
                    customer={customers.find(c => c.id === activeQuot.customer_id)}
                    companyId={companyId}
                />
            )}

            {/* Quick Customer Modal */}
            {showQuickCustomerModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Building size={16} className="text-blue-600" /> Add New CRM Customer
                                </h3>
                                <p className="text-xs text-slate-500">Independent CRM Customer account</p>
                            </div>
                            <button onClick={() => setShowQuickCustomerModal(false)} className="p-1 rounded text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-3">
                            <div>
                                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Customer Name *</label>
                                <input
                                    type="text"
                                    placeholder="Customer / Company Name"
                                    value={quickCustomer.name}
                                    onChange={e => setQuickCustomer({ ...quickCustomer, name: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Type</label>
                                    <select
                                        value={quickCustomer.customer_type}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, customer_type: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm"
                                    >
                                        <option value="Company">Company</option>
                                        <option value="Individual">Individual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Industry</label>
                                    <input
                                        type="text"
                                        placeholder="Industry"
                                        value={quickCustomer.industry}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, industry: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Email</label>
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={quickCustomer.primary_email}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, primary_email: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Phone</label>
                                    <input
                                        type="tel"
                                        placeholder="Phone"
                                        value={quickCustomer.primary_phone}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, primary_phone: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-2 bg-slate-50/50 dark:bg-zinc-800/50">
                            <button
                                type="button"
                                onClick={() => setShowQuickCustomerModal(false)}
                                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveQuickCustomer}
                                disabled={savingQuickCustomer}
                                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                                {savingQuickCustomer ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                <span>Save & Select</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuotationsView;
