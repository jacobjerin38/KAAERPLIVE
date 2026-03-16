import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowDownLeft, Search, Save, Package, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Item {
    id: string;
    code: string;
    name: string;
    uom: string;
}

interface WarehouseBin {
    id: string;
    name: string;
    zone?: { name: string; warehouse?: { name: string }[] } | { name: string; warehouse?: { name: string }[] }[];
}

export const GoodsReceipt: React.FC = () => {
    const { user, currentCompanyId } = useAuth();
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [items, setItems] = useState<Item[]>([]);
    const [bins, setBins] = useState<WarehouseBin[]>([]);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form State
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [quantity, setQuantity] = useState<string>('');
    const [unitCost, setUnitCost] = useState<string>('');
    const [selectedBinId, setSelectedBinId] = useState<string>('');
    const [reference, setReference] = useState('');
    const [refType, setRefType] = useState('PO');

    // Load initial data
    useEffect(() => {
        if (currentCompanyId) fetchBins();
    }, [currentCompanyId]);

    // Search items
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm && currentCompanyId) fetchItems(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, currentCompanyId]);

    const fetchItems = async (query: string) => {
        const { data } = await supabase
            .from('item_master')
            .select('id, code, name, uom')
            .eq('company_id', currentCompanyId)
            .ilike('name', `%${query}%`)
            .limit(10);
        setItems(data || []);
    };

    const fetchBins = async () => {
        const { data } = await supabase
            .from('warehouse_bins')
            .select('id, name, zone:warehouse_zones(name, warehouse:warehouses(name))')
            .eq('company_id', currentCompanyId)
            .limit(100);
        setBins(data || []);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMessage(null);

        const qty = parseFloat(quantity);
        const cost = parseFloat(unitCost);

        if (!selectedItem) {
            setStatusMessage({ type: 'error', text: 'Please select an item.' });
            return;
        }
        if (!selectedBinId) {
            setStatusMessage({ type: 'error', text: 'Please select a destination bin.' });
            return;
        }
        if (isNaN(qty) || qty <= 0) {
            setStatusMessage({ type: 'error', text: 'Quantity must be greater than 0.' });
            return;
        }
        if (isNaN(cost) || cost < 0) {
            setStatusMessage({ type: 'error', text: 'Unit cost must be a valid number.' });
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('rpc_process_stock_movement', {
                p_company_id: currentCompanyId,
                p_item_id: selectedItem.id,
                p_movement_type: 'IN',
                p_from_bin_id: null,
                p_to_bin_id: selectedBinId,
                p_qty: qty,
                p_ref_type: refType,
                p_ref_id: null,
                p_unit_cost: cost
            });

            if (error) throw error;

            setStatusMessage({ type: 'success', text: 'Goods Receipt processed successfully!' });
            // Reset form
            setSelectedItem(null);
            setQuantity('');
            setUnitCost('');
            setSelectedBinId('');
            setReference('');
            setSearchTerm('');
        } catch (error: any) {
            console.error('Error processing GRN:', error);
            setStatusMessage({ type: 'error', text: 'Failed to process GRN: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <ArrowDownLeft className="w-6 h-6 text-green-600" />
                    Goods Receipt (GRN)
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Receive stock into the warehouse from suppliers or production.</p>
            </div>

            {/* Status Message */}
            {statusMessage && (
                <div className={`p-4 rounded-xl text-sm font-medium ${statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'}`}>
                    {statusMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Form */}
                <div className="md:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Reference Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reference Type</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    value={refType}
                                    onChange={e => setRefType(e.target.value)}
                                >
                                    <option value="PO">Purchase Order</option>
                                    <option value="RETURN">Sales Return</option>
                                    <option value="ADJUSTMENT">Stock Adjustment (In)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reference #</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    placeholder="e.g. PO-2024-001"
                                    value={reference}
                                    onChange={e => setReference(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Item Selection */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Item *</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    placeholder="Search item name..."
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); setSelectedItem(null); }}
                                />
                            </div>
                            {/* Dropdown results */}
                            {searchTerm && !selectedItem && items.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {items.map(item => (
                                        <div
                                            key={item.id}
                                            className="p-3 hover:bg-slate-50 dark:hover:bg-zinc-700 cursor-pointer border-b border-slate-100 dark:border-zinc-700 last:border-0"
                                            onClick={() => { setSelectedItem(item); setSearchTerm(item.name); }}
                                        >
                                            <div className="font-medium text-slate-800 dark:text-white">{item.name}</div>
                                            <div className="text-xs text-slate-500 font-mono">{item.code} • {item.uom}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedItem && (
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                                <span className="font-medium text-indigo-700 dark:text-indigo-300">{selectedItem.name} ({selectedItem.uom})</span>
                                <span className="text-xs bg-white dark:bg-zinc-800 px-2 py-1 rounded text-slate-500 font-mono">{selectedItem.code}</span>
                            </div>
                        )}

                        {/* Qty & Cost */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity *</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    value={quantity}
                                    onChange={e => setQuantity(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unit Cost ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    value={unitCost}
                                    onChange={e => setUnitCost(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Destination Bin */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Receive Into Bin *</label>
                            <select
                                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                value={selectedBinId}
                                onChange={e => setSelectedBinId(e.target.value)}
                            >
                                <option value="">Select Bin...</option>
                                {bins.map(bin => {
                                    const z = Array.isArray(bin.zone) ? bin.zone[0] : bin.zone;
                                    const w = z?.warehouse ? (Array.isArray(z.warehouse) ? z.warehouse[0] : z.warehouse) : null;
                                    return (
                                        <option key={bin.id} value={bin.id}>
                                            {w?.name} &gt; {z?.name} &gt; {bin.name}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading || !selectedItem || !selectedBinId || !quantity}
                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? 'Processing...' : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Process Goods Receipt
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Instructions / Summary */}
                <div className="md:col-span-1 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-xl p-4">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Instructions</h4>
                        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-2 list-disc pl-4">
                            <li>Select items from the Master list. If an item is missing, create it in Item Master first.</li>
                            <li>Ensure Unit Cost is accurate for Weighted Average Valuation.</li>
                            <li>Select the target bin physically where the goods are being placed.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
