import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

export const ScrapInventory: React.FC = () => {
    const { user, currentCompanyId } = useAuth();
    const [scraps, setScraps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form for Quick Scrap
    const [formData, setFormData] = useState({
        warehouse_id: '',
        item_id: '',
        bin_id: '',
        qty: '',
        reason_id: '',
        notes: ''
    });

    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [bins, setBins] = useState<any[]>([]);
    const [reasons, setReasons] = useState<any[]>([]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchHistory();
            fetchMasters();
        }
    }, [currentCompanyId]);

    // Fetch bins when warehouse changes
    useEffect(() => {
        if (formData.warehouse_id && currentCompanyId) {
            fetchBinsByWarehouse(formData.warehouse_id);
        } else {
            setBins([]);
            setFormData(prev => ({ ...prev, bin_id: '' }));
        }
    }, [formData.warehouse_id, currentCompanyId]);

    const fetchHistory = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('inventory_adjustments')
            .select(`
                id, reference_number, adjustment_date, status, notes,
                warehouse:warehouses(name),
                reason:inventory_reasons(name)
            `)
            .eq('company_id', currentCompanyId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) console.error(error);
        else {
            // Fix array returns for joins
            const formatted = (data || []).map((s: any) => ({
                ...s,
                warehouse: Array.isArray(s.warehouse) ? s.warehouse[0] : s.warehouse,
                reason: Array.isArray(s.reason) ? s.reason[0] : s.reason
            }));
            setScraps(formatted);
        }
        setLoading(false);
    };

    const fetchMasters = async () => {
        const { data: wh } = await supabase.from('warehouses').select('id, name').eq('company_id', currentCompanyId);
        const { data: it } = await supabase.from('item_master').select('id, name, code').eq('company_id', currentCompanyId);
        const { data: rs } = await supabase.from('inventory_reasons').select('id, name').eq('company_id', currentCompanyId);

        setWarehouses(wh || []);
        setItems(it || []);
        setReasons(rs || []);
    };

    const fetchBinsByWarehouse = async (warehouseId: string) => {
        const { data } = await supabase
            .from('warehouse_bins')
            .select('id, name, zone:warehouse_zones!inner(warehouse_id)')
            .eq('company_id', currentCompanyId);

        // Filter bins that belong to the selected warehouse
        const filtered = (data || []).filter((bin: any) => {
            const zone = Array.isArray(bin.zone) ? bin.zone[0] : bin.zone;
            return zone?.warehouse_id === warehouseId;
        });

        setBins(filtered);
    };

    const handleScrap = async () => {
        setStatusMessage(null);

        if (!formData.warehouse_id) {
            setStatusMessage({ type: 'error', text: 'Please select a warehouse.' });
            return;
        }
        if (!formData.item_id) {
            setStatusMessage({ type: 'error', text: 'Please select an item.' });
            return;
        }
        if (!formData.reason_id) {
            setStatusMessage({ type: 'error', text: 'Please select a reason.' });
            return;
        }

        const qty = parseFloat(formData.qty);
        if (isNaN(qty) || qty <= 0) {
            setStatusMessage({ type: 'error', text: 'Quantity must be greater than 0.' });
            return;
        }

        if (!confirm('This will immediately remove stock. Continue?')) return;

        if (!user || !currentCompanyId) return;

        setProcessing(true);
        try {
            // 1. Create Header
            const { data: header, error: hErr } = await supabase
                .from('inventory_adjustments')
                .insert([{
                    warehouse_id: formData.warehouse_id,
                    reason_id: formData.reason_id,
                    reference_number: `SCRAP-${Date.now().toString().slice(-6)}`,
                    status: 'DRAFT',
                    notes: formData.notes || 'Quick Scrap',
                    company_id: currentCompanyId
                }])
                .select()
                .single();

            if (hErr) throw hErr;

            // 2. Create Line (negative counted_qty to represent removal)
            const { error: lErr } = await supabase
                .from('inventory_adjustment_lines')
                .insert([{
                    adjustment_id: header.id,
                    item_id: formData.item_id,
                    bin_id: formData.bin_id || null,
                    system_qty: 0,
                    counted_qty: -Math.abs(qty),
                    justification: 'Quick Scrap',
                    company_id: currentCompanyId
                }]);

            if (lErr) throw lErr;

            // 3. Auto-Approve
            const { error: rpcErr } = await supabase
                .rpc('rpc_apply_adjustment', {
                    p_adjustment_id: header.id,
                    p_user_id: user.id
                });

            if (rpcErr) throw rpcErr;

            setStatusMessage({ type: 'success', text: 'Scrap processed successfully!' });
            setFormData({ warehouse_id: '', item_id: '', bin_id: '', qty: '', reason_id: '', notes: '' });
            fetchHistory();

        } catch (error: any) {
            setStatusMessage({ type: 'error', text: 'Error: ' + error.message });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Scrap Form */}
            <div className="md:col-span-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-rose-100 text-rose-600 rounded-lg">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Scrap Inventory</h2>
                        <p className="text-sm text-slate-500">Remove damaged or expired stock.</p>
                    </div>
                </div>

                {/* Status Message */}
                {statusMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                        {statusMessage.text}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Warehouse *</label>
                        <select
                            className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                            value={formData.warehouse_id}
                            onChange={e => setFormData({ ...formData, warehouse_id: e.target.value, bin_id: '' })}
                        >
                            <option value="">Select Warehouse</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Item *</label>
                        <select
                            className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                            value={formData.item_id}
                            onChange={e => setFormData({ ...formData, item_id: e.target.value })}
                        >
                            <option value="">Select Item</option>
                            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Bin Location</label>
                        <select
                            className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                            value={formData.bin_id}
                            onChange={e => setFormData({ ...formData, bin_id: e.target.value })}
                            disabled={!formData.warehouse_id}
                        >
                            <option value="">Select Bin (Optional)</option>
                            {bins.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        {!formData.warehouse_id && <p className="text-xs text-slate-400 mt-1">Select warehouse first</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Qty to Scrap *</label>
                            <input
                                type="number" min="0.01" step="0.01"
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700 font-bold text-rose-600"
                                value={formData.qty}
                                onChange={e => setFormData({ ...formData, qty: e.target.value })}
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Reason *</label>
                            <select
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={formData.reason_id}
                                onChange={e => setFormData({ ...formData, reason_id: e.target.value })}
                            >
                                <option value="">Reason</option>
                                {reasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <textarea
                            className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                            rows={3}
                            placeholder="Details about damage..."
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3 rounded-lg text-xs flex gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5" />
                        <p>This will permanently reduce stock count and post a loss entry to accounting.</p>
                    </div>

                    <button
                        onClick={handleScrap}
                        disabled={processing}
                        className="w-full py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-bold shadow-lg shadow-rose-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {processing ? 'Processing...' : 'Confirm Scrap'}
                    </button>
                </div>
            </div>

            {/* History */}
            <div className="md:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
                <h3 className="font-bold text-slate-800 dark:text-white mb-4">Recent Scrap History</h3>
                <div className="space-y-3">
                    {loading ? (
                        <p className="text-slate-400">Loading history...</p>
                    ) : scraps.length === 0 ? (
                        <p className="text-slate-400 italic py-4 text-center">No scrap history found.</p>
                    ) : (
                        scraps.map(s => (
                            <div key={s.id} className="flex justify-between items-center p-3 border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded">
                                <div>
                                    <div className="font-medium text-slate-800 dark:text-white">{s.reference_number}</div>
                                    <div className="text-xs text-slate-500">{s.warehouse?.name} • {s.reason?.name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">{s.adjustment_date}</div>
                                    <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {s.status}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
