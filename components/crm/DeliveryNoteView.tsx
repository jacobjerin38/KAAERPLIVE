import React, { useState, useEffect } from 'react';
import { Plus, Search, Truck, Loader2, ArrowRight, CheckCircle, Package, Printer } from 'lucide-react';
import { CRMDeliveryNote, CRMDeliveryNoteLine, CRMCustomer } from './types';
import { getDeliveryNotes, createDeliveryNote, updateDeliveryNote, getDeliveryNoteLines, saveDeliveryNoteLines, getCustomers } from './services';
import { AttachmentPanel } from './AttachmentPanel';
import { useAuth } from '../../contexts/AuthContext';
import PrintDocumentModal from './PrintDocumentModal';

interface Props { companyId: string; }

const statusColors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-600',
    Pending: 'bg-amber-100 text-amber-700',
    Delivered: 'bg-emerald-100 text-emerald-700',
    Returned: 'bg-red-100 text-red-700',
    Cancelled: 'bg-zinc-100 text-zinc-500',
};

const DeliveryNoteView: React.FC<Props> = ({ companyId }) => {
    const { user } = useAuth();
    const [notes, setNotes] = useState<CRMDeliveryNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [activeDN, setActiveDN] = useState<Partial<CRMDeliveryNote>>({});
    const [lines, setLines] = useState<CRMDeliveryNoteLine[]>([]);
    const [customers, setCustomers] = useState<CRMCustomer[]>([]);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [showPrint, setShowPrint] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [dns, c] = await Promise.all([getDeliveryNotes(), getCustomers()]);
        setNotes(dns);
        setCustomers(c);
        setLoading(false);
    };

    const openNew = () => {
        setActiveDN({ status: 'Pending', delivery_date: new Date().toISOString().split('T')[0] });
        setLines([]);
        setShowModal(true);
    };

    const openEdit = async (dn: CRMDeliveryNote) => {
        setActiveDN({ ...dn });
        const l = await getDeliveryNoteLines(dn.id);
        setLines(l);
        setShowModal(true);
    };

    const updateLine = (idx: number, field: string, value: any) => {
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
    };

    const handleSave = async () => {
        setSaving(true);
        const payload = { ...activeDN, company_id: companyId, owner_id: user?.id };
        delete payload.customer; delete payload.lines;
        let result: CRMDeliveryNote | null;
        if (activeDN.id) {
            result = await updateDeliveryNote(activeDN.id, payload);
        } else {
            result = await createDeliveryNote(payload);
        }
        if (result && lines.length > 0) await saveDeliveryNoteLines(result.id, lines);
        setSaving(false);
        setShowModal(false);
        loadData();
    };

    const handleMarkDelivered = async () => {
        if (!activeDN.id) return;
        // Mark all lines as fully delivered
        const updatedLines = lines.map(l => ({ ...l, quantity_delivered: l.quantity_ordered }));
        await saveDeliveryNoteLines(activeDN.id, updatedLines);
        await updateDeliveryNote(activeDN.id, { status: 'Delivered' } as any);
        setShowModal(false);
        loadData();
    };

    const filtered = notes.filter(n =>
        (n.customer?.name || '').toLowerCase().includes(search.toLowerCase()) || n.tracking_number?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Truck className="text-purple-500" size={22} /> Delivery Notes
                </h2>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search delivery notes..."
                            className="pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm w-56 focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                    </div>
                    <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all text-sm font-semibold">
                        <Plus size={16} /> New Delivery Note
                    </button>
                </div>
            </div>

            {/* Sales Flow */}
            <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-xl border border-purple-100/50 dark:border-purple-800/30">
                <span className="text-xs font-medium text-slate-400">Quotation</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-400">Sales Invoice</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2.5 py-1 rounded-lg">Delivery Note</span>
            </div>

            <div className="flex-1 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-auto shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-purple-500" size={28} /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-400"><Truck size={40} className="mx-auto mb-3 opacity-30" /><p>No delivery notes yet</p></div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-zinc-800 text-left text-xs text-slate-500 uppercase tracking-wider">
                                <th className="px-5 py-3">Date</th>
                                <th className="px-5 py-3">Customer</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3">Transporter</th>
                                <th className="px-5 py-3">Tracking #</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(dn => (
                                <tr key={dn.id} className="border-b border-slate-50 dark:border-zinc-800/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors" onClick={() => openEdit(dn)}>
                                    <td className="px-5 py-3 text-slate-500">{dn.delivery_date}</td>
                                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{dn.customer?.name || '-'}</td>
                                    <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[dn.status]}`}>{dn.status}</span></td>
                                    <td className="px-5 py-3 text-slate-500">{dn.transporter || '-'}</td>
                                    <td className="px-5 py-3 font-mono text-xs text-indigo-500">{dn.tracking_number || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Truck size={20} className="text-purple-500" /> {activeDN.id ? 'Edit Delivery Note' : 'New Delivery Note'}
                                {activeDN.status && <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[activeDN.status] || ''}`}>{activeDN.status}</span>}
                            </h3>
                        </div>
                        <div className="p-6 space-y-5 max-h-[65vh] overflow-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Customer</label>
                                    <select value={activeDN.customer_id || ''} onChange={e => setActiveDN(p => ({ ...p, customer_id: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20">
                                        <option value="">Select Customer</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Delivery Date</label>
                                    <input type="date" value={activeDN.delivery_date || ''} onChange={e => setActiveDN(p => ({ ...p, delivery_date: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Transporter</label>
                                    <input value={activeDN.transporter || ''} onChange={e => setActiveDN(p => ({ ...p, transporter: e.target.value }))} placeholder="Transport company"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Tracking Number</label>
                                    <input value={activeDN.tracking_number || ''} onChange={e => setActiveDN(p => ({ ...p, tracking_number: e.target.value }))} placeholder="Tracking #"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Shipping Address</label>
                                <textarea value={activeDN.shipping_address || ''} onChange={e => setActiveDN(p => ({ ...p, shipping_address: e.target.value }))} placeholder="Full shipping address"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                            </div>

                            {/* Line Items */}
                            {lines.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Package size={13} /> Items to Deliver</h4>
                                    <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-zinc-800 text-slate-500 text-left">
                                                    <th className="px-3 py-2">Item</th>
                                                    <th className="px-3 py-2 text-center">Ordered</th>
                                                    <th className="px-3 py-2 text-center">Delivered</th>
                                                    <th className="px-3 py-2 text-center">Remaining</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {lines.map((line, idx) => (
                                                    <tr key={idx} className="border-t border-slate-100 dark:border-zinc-800">
                                                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-zinc-300">{line.item_name}</td>
                                                        <td className="px-3 py-2 text-center text-slate-500">{line.quantity_ordered}</td>
                                                        <td className="px-2 py-1.5 text-center">
                                                            <input type="number" value={line.quantity_delivered} onChange={e => updateLine(idx, 'quantity_delivered', parseFloat(e.target.value) || 0)}
                                                                max={line.quantity_ordered}
                                                                className="w-16 px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-center focus:outline-none focus:ring-1 focus:ring-purple-500/30" />
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className={`font-medium ${line.quantity_ordered - line.quantity_delivered > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                                {line.quantity_ordered - line.quantity_delivered}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Notes</label>
                                <textarea value={activeDN.notes || ''} onChange={e => setActiveDN(p => ({ ...p, notes: e.target.value }))}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                            </div>

                            {activeDN.id && <AttachmentPanel companyId={companyId} module="delivery_note" recordId={activeDN.id} userId={user?.id} />}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                            {activeDN.id && (
                                <button onClick={() => setShowPrint(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-sm font-medium">
                                    <Printer size={16} /> Print
                                </button>
                            )}
                            {activeDN.id && activeDN.status !== 'Delivered' && activeDN.status !== 'Cancelled' && (
                                <button onClick={handleMarkDelivered} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20 text-sm font-medium">
                                    <CheckCircle size={16} /> Mark Delivered
                                </button>
                            )}
                            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium text-sm">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm disabled:opacity-50">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : activeDN.id ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Modal */}
            {showPrint && activeDN.id && (
                <PrintDocumentModal
                    isOpen={showPrint}
                    onClose={() => setShowPrint(false)}
                    documentType="delivery_note"
                    document={activeDN as CRMDeliveryNote}
                    lines={lines}
                    customer={customers.find(c => c.id === activeDN.customer_id)}
                    companyId={companyId}
                />
            )}
        </div>
    );
};

export default DeliveryNoteView;
