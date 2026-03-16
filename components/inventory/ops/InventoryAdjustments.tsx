import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { ClipboardList, Plus, Check, X, Search, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { Modal } from '../../ui/Modal';

interface Adjustment {
    id: string;
    reference_number: string;
    adjustment_date: string;
    status: string;
    warehouse: { name: string };
    reason: { name: string };
    notes: string;
}

interface AdjustmentLine {
    id: string;
    item: { name: string; code: string; uom: string };
    bin: { name: string };
    system_qty: number;
    counted_qty: number;
    difference_qty: number;
    justification: string;
}

export const InventoryAdjustments: React.FC = () => {
    const { user, currentCompanyId } = useAuth();
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [selectedAdj, setSelectedAdj] = useState<Adjustment | null>(null);
    const [lines, setLines] = useState<AdjustmentLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isLineModalOpen, setIsLineModalOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Filter/Search
    const [filterStatus, setFilterStatus] = useState('ALL');

    // New Adjustment Form
    const [newAdj, setNewAdj] = useState({
        warehouse_id: '',
        reason_id: '',
        notes: ''
    });

    // New Line Form
    const [newLine, setNewLine] = useState({
        item_id: '',
        bin_id: '',
        counted_qty: '',
        justification: ''
    });

    // Masters
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [reasons, setReasons] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [bins, setBins] = useState<any[]>([]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchAdjustments();
            fetchMasters();
        }
    }, [currentCompanyId]);

    useEffect(() => {
        if (selectedAdj) fetchLines(selectedAdj.id);
    }, [selectedAdj]);

    // When filter changes, re-fetch
    useEffect(() => {
        if (currentCompanyId) fetchAdjustments();
    }, [filterStatus]);

    const fetchAdjustments = async () => {
        setLoading(true);
        let query = supabase
            .from('inventory_adjustments')
            .select(`
                id, reference_number, adjustment_date, status, notes,
                warehouse:warehouses(name),
                reason:inventory_reasons(name)
            `)
            .eq('company_id', currentCompanyId)
            .order('created_at', { ascending: false });

        if (filterStatus !== 'ALL') query = query.eq('status', filterStatus);

        const { data, error } = await query;
        if (error) console.error(error);
        else {
            const formatted = (data || []).map((adj: any) => ({
                ...adj,
                warehouse: Array.isArray(adj.warehouse) ? adj.warehouse[0] : adj.warehouse,
                reason: Array.isArray(adj.reason) ? adj.reason[0] : adj.reason
            }));
            setAdjustments(formatted);
        }
        setLoading(false);
    };

    const fetchLines = async (adjId: string) => {
        const { data, error } = await supabase
            .from('inventory_adjustment_lines')
            .select(`
                id, system_qty, counted_qty, difference_qty, justification,
                item:item_master(name, code, uom),
                bin:warehouse_bins(name)
            `)
            .eq('adjustment_id', adjId);

        if (error) console.error(error);
        else {
            const formattedLines = (data || []).map((line: any) => ({
                ...line,
                item: Array.isArray(line.item) ? line.item[0] : line.item,
                bin: Array.isArray(line.bin) ? line.bin[0] : line.bin
            }));
            setLines(formattedLines);
        }
    };

    const fetchMasters = async () => {
        const { data: wh } = await supabase.from('warehouses').select('id, name').eq('company_id', currentCompanyId);
        const { data: rs } = await supabase.from('inventory_reasons').select('id, name').eq('company_id', currentCompanyId);
        const { data: it } = await supabase.from('item_master').select('id, name, code').eq('company_id', currentCompanyId);
        const { data: bn } = await supabase.from('warehouse_bins').select('id, name').eq('company_id', currentCompanyId);

        setWarehouses(wh || []);
        setReasons(rs || []);
        setItems(it || []);
        setBins(bn || []);
    };

    const handleCreateAdjustment = async () => {
        setStatusMessage(null);

        if (!newAdj.warehouse_id) {
            setStatusMessage({ type: 'error', text: 'Please select a warehouse.' });
            return;
        }
        if (!newAdj.reason_id) {
            setStatusMessage({ type: 'error', text: 'Please select a reason.' });
            return;
        }
        if (!currentCompanyId) return;

        const { data, error } = await supabase
            .from('inventory_adjustments')
            .insert([{
                ...newAdj,
                reference_number: `ADJ-${Date.now().toString().slice(-6)}`,
                status: 'DRAFT',
                company_id: currentCompanyId
            }])
            .select()
            .single();

        if (error) {
            setStatusMessage({ type: 'error', text: 'Error: ' + error.message });
        } else {
            setIsCreateModalOpen(false);
            setNewAdj({ warehouse_id: '', reason_id: '', notes: '' });
            setStatusMessage({ type: 'success', text: 'Adjustment created successfully!' });
            fetchAdjustments();
            setSelectedAdj(data);
        }
    };

    const handleAddLine = async () => {
        if (!selectedAdj) return;
        setStatusMessage(null);

        if (!newLine.item_id) {
            setStatusMessage({ type: 'error', text: 'Please select an item.' });
            return;
        }

        const countedQty = parseFloat(newLine.counted_qty);
        if (isNaN(countedQty)) {
            setStatusMessage({ type: 'error', text: 'Please enter a valid counted quantity.' });
            return;
        }

        // System qty defaults to 0 for now — can be enhanced with RPC
        let systemQty = 0;

        const { error } = await supabase
            .from('inventory_adjustment_lines')
            .insert([{
                adjustment_id: selectedAdj.id,
                item_id: newLine.item_id,
                bin_id: newLine.bin_id || null,
                counted_qty: countedQty,
                system_qty: systemQty,
                justification: newLine.justification,
                company_id: currentCompanyId
            }]);

        if (error) {
            setStatusMessage({ type: 'error', text: 'Error: ' + error.message });
        } else {
            setIsLineModalOpen(false);
            setNewLine({ item_id: '', bin_id: '', counted_qty: '', justification: '' });
            setStatusMessage({ type: 'success', text: 'Line added successfully!' });
            fetchLines(selectedAdj.id);
        }
    };

    const handleApprove = async () => {
        if (!selectedAdj || !user) return;
        if (!confirm('Are you sure? This will update stock and post accounting entries.')) return;

        const { data, error } = await supabase
            .rpc('rpc_apply_adjustment', {
                p_adjustment_id: selectedAdj.id,
                p_user_id: user.id
            });

        if (error) {
            setStatusMessage({ type: 'error', text: 'Error applying adjustment: ' + error.message });
        } else {
            setStatusMessage({ type: 'success', text: 'Adjustment Approved Successfully!' });
            fetchAdjustments();
            setSelectedAdj(null);
        }
    };


    return (
        <div className="flex h-[calc(100vh-100px)] gap-6">
            {/* Status Message */}
            {statusMessage && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl text-sm font-medium shadow-lg ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}
                    onClick={() => setStatusMessage(null)}
                >
                    {statusMessage.text}
                </div>
            )}

            {/* List View */}
            <div className={`w-1/3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex flex-col ${selectedAdj ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-bold text-slate-800 dark:text-white">Adjustments</h2>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Filters */}
                    <div className="flex gap-2 text-xs">
                        {['ALL', 'DRAFT', 'APPROVED'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-3 py-1 rounded-full border ${filterStatus === status ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600'}`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400">Loading...</div>
                    ) : adjustments.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 italic">No adjustments found.</div>
                    ) : (
                        adjustments.map(adj => (
                            <div
                                key={adj.id}
                                onClick={() => setSelectedAdj(adj)}
                                className={`p-4 border-b border-slate-100 dark:border-zinc-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 ${selectedAdj?.id === adj.id ? 'bg-indigo-50 dark:bg-indigo-900/10 border-l-4 border-l-indigo-500' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-slate-800 dark:text-white">{adj.reference_number}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${adj.status === 'DRAFT' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {adj.status}
                                    </span>
                                </div>
                                <div className="text-sm text-slate-500 mb-1">{adj.warehouse?.name} • {adj.reason?.name}</div>
                                <div className="text-xs text-slate-400">{adj.adjustment_date}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Detail View */}
            <div className={`flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex flex-col ${selectedAdj ? 'flex' : 'hidden md:flex'}`}>
                {!selectedAdj ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <ClipboardList className="w-16 h-16 mb-4 opacity-20" />
                        <p>Select an adjustment to view details</p>
                    </div>
                ) : (
                    <>
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{selectedAdj.reference_number}</h2>
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${selectedAdj.status === 'DRAFT' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {selectedAdj.status}
                                    </span>
                                </div>
                                <div className="flex gap-6 text-sm text-slate-500">
                                    <span>Warehouse: <strong className="text-slate-700 dark:text-slate-300">{selectedAdj.warehouse?.name}</strong></span>
                                    <span>Reason: <strong className="text-slate-700 dark:text-slate-300">{selectedAdj.reason?.name}</strong></span>
                                    <span>Date: {selectedAdj.adjustment_date}</span>
                                </div>
                                {selectedAdj.notes && <p className="mt-2 text-sm text-slate-500 italic">"{selectedAdj.notes}"</p>}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedAdj(null)}
                                    className="md:hidden px-3 py-2 text-slate-500 border rounded"
                                >
                                    Close
                                </button>
                                {selectedAdj.status === 'DRAFT' && (
                                    <>
                                        <button
                                            onClick={() => setIsLineModalOpen(true)}
                                            className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 flex items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" /> Add Line
                                        </button>
                                        <button
                                            onClick={handleApprove}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm shadow-indigo-200"
                                        >
                                            <Check className="w-4 h-4" /> Approve Adjustment
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-semibold uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">Item</th>
                                        <th className="px-4 py-3">Bin</th>
                                        <th className="px-4 py-3 text-right">System Qty</th>
                                        <th className="px-4 py-3 text-right">Counted Qty</th>
                                        <th className="px-4 py-3 text-right">Difference</th>
                                        <th className="px-4 py-3 rounded-r-lg">Justification</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {lines.length === 0 ? (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No lines added yet.</td></tr>
                                    ) : (
                                        lines.map(line => (
                                            <tr key={line.id}>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-700 dark:text-slate-300">{line.item?.name || '—'}</div>
                                                    <div className="text-xs text-slate-500">{line.item?.code || '—'} • {line.item?.uom || ''}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">{line.bin?.name || '-'}</td>
                                                <td className="px-4 py-3 text-right text-slate-500">{line.system_qty}</td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-white bg-slate-50 dark:bg-zinc-800/50 rounded">{line.counted_qty}</td>
                                                <td className={`px-4 py-3 text-right font-bold ${line.difference_qty < 0 ? 'text-rose-500' : line.difference_qty > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                    {line.difference_qty > 0 ? '+' : ''}{line.difference_qty}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 italic max-w-[200px] truncate">{line.justification}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <Modal title="Start Inventory Adjustment" onClose={() => setIsCreateModalOpen(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Warehouse *</label>
                            <select
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={newAdj.warehouse_id}
                                onChange={e => setNewAdj({ ...newAdj, warehouse_id: e.target.value })}
                            >
                                <option value="">Select Warehouse</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Reason *</label>
                            <select
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={newAdj.reason_id}
                                onChange={e => setNewAdj({ ...newAdj, reason_id: e.target.value })}
                            >
                                <option value="">Select Reason</option>
                                {reasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Notes</label>
                            <textarea
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                rows={2}
                                value={newAdj.notes}
                                onChange={e => setNewAdj({ ...newAdj, notes: e.target.value })}
                            />
                        </div>
                        <button
                            onClick={handleCreateAdjustment}
                            disabled={!newAdj.warehouse_id || !newAdj.reason_id}
                            className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Start Count
                        </button>
                    </div>
                </Modal>
            )}

            {/* Line Modal */}
            {isLineModalOpen && (
                <Modal title="Record Count" onClose={() => setIsLineModalOpen(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Item *</label>
                            <select
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={newLine.item_id}
                                onChange={e => setNewLine({ ...newLine, item_id: e.target.value })}
                            >
                                <option value="">Select Item</option>
                                {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Bin Location</label>
                            <select
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={newLine.bin_id}
                                onChange={e => setNewLine({ ...newLine, bin_id: e.target.value })}
                            >
                                <option value="">Select Bin</option>
                                {bins.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">Leave blank if found outside a bin (system will assign).</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Counted Qty *</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700 font-bold"
                                    value={newLine.counted_qty}
                                    onChange={e => setNewLine({ ...newLine, counted_qty: e.target.value })}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-400">System Qty</label>
                                <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded text-slate-500 italic">Auto-calculated</div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Justification</label>
                            <input
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                placeholder="Why the discrepancy?"
                                value={newLine.justification}
                                onChange={e => setNewLine({ ...newLine, justification: e.target.value })}
                            />
                        </div>
                        <button
                            onClick={handleAddLine}
                            disabled={!newLine.item_id || !newLine.counted_qty}
                            className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Line
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};
