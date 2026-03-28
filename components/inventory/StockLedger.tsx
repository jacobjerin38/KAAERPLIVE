import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowDownLeft, ArrowUpRight, Repeat, FileText, Search, Layers, Box } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface StockTransaction {
    id: string;
    posting_date: string;
    transaction_type: 'GRN' | 'ISSUE' | 'TRANSFER' | 'ADJUSTMENT';
    quantity: number;
    unit_cost: number;
    total_value: number;
    reference_type: string;
    reference_id?: string;
    item: {
        id: string;
        name: string;
        code: string;
        uom: string;
    };
    warehouse?: {
        name: string;
    };
}

interface StockMovement {
    id: string;
    movement_type: string;
    quantity: number;
    from_bin_id?: string;
    to_bin_id?: string;
    item: {
        id: string;
        name: string;
        code: string;
        uom: string;
    };
}

interface Bin {
    id: string;
    name: string;
    code: string;
}

type TabType = 'ledger' | 'fifo' | 'bins';

export const StockLedger: React.FC = () => {
    const { user, currentCompanyId } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('ledger');
    const [transactions, setTransactions] = useState<StockTransaction[]>([]);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [bins, setBins] = useState<Bin[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (currentCompanyId) {
            fetchTransactions();
            fetchBinData();
        }
    }, [currentCompanyId]);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('inventory_transactions')
                .select(`
                    *,
                    item:item_master(id, name, code, uom),
                    warehouse:warehouses(name)
                `)
                .order('created_at', { ascending: false })
                .eq('company_id', currentCompanyId)
                .limit(200);

            if (error) throw error;
            setTransactions((data || []) as any);
        } catch (error) {
            console.error('Error fetching stock ledger:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBinData = async () => {
        try {
            const [movRes, binRes] = await Promise.all([
                supabase.from('stock_movements').select(`
                    *,
                    item:item_master(id, name, code, uom)
                `).eq('company_id', currentCompanyId).limit(500),
                supabase.from('warehouse_bins').select('id, name, code').eq('company_id', currentCompanyId)
            ]);

            if (movRes.data) setMovements(movRes.data);
            if (binRes.data) setBins(binRes.data);
        } catch (e) {
            console.error('Error fetching bins', e);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'GRN': return <ArrowDownLeft className="text-green-500" />;
            case 'ISSUE': return <ArrowUpRight className="text-orange-500" />;
            case 'TRANSFER': return <Repeat className="text-blue-500" />;
            default: return <FileText className="text-slate-400" />;
        }
    };

    const filteredTxns = transactions.filter(txn =>
        txn.item?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.item?.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.reference_type?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Derive FIFO Layers (GRNs with qty > 0)
    const fifoLayers = filteredTxns.filter(t => (t.transaction_type === 'GRN' || t.transaction_type === 'ADJUSTMENT') && t.quantity > 0);

    // Compute Bin-wise stock
    const binStock = React.useMemo(() => {
        const balances: Record<string, { bin: Bin, item: any, qty: number }> = {};

        movements.forEach(m => {
            // Subtractions
            if (m.from_bin_id && m.movement_type !== 'IN') {
                const key = `${m.from_bin_id}_${m.item?.id}`;
                if (!balances[key]) balances[key] = { bin: bins.find(b => b.id === m.from_bin_id)!, item: m.item, qty: 0 };
                balances[key].qty -= Number(m.quantity);
            }
            // Additions
            if (m.to_bin_id) {
                const key = `${m.to_bin_id}_${m.item?.id}`;
                if (!balances[key]) balances[key] = { bin: bins.find(b => b.id === m.to_bin_id)!, item: m.item, qty: 0 };
                balances[key].qty += Number(m.quantity);
            }
        });

        return Object.values(balances).filter(b => b.qty !== 0 && b.bin && b.item?.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [movements, bins, searchQuery]);

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Stock Ledger & Tracking</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">View inventory movements, FIFO value layers, and bin-wise physical stock.</p>
                </div>

                <div className="flex p-1 bg-slate-100 dark:bg-zinc-800/50 rounded-lg max-w-sm">
                    <button
                        onClick={() => setActiveTab('ledger')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'ledger' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700/50'}`}
                    >
                        <FileText className="w-4 h-4" /> LEDGER
                    </button>
                    <button
                        onClick={() => setActiveTab('fifo')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'fifo' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700/50'}`}
                    >
                        <Layers className="w-4 h-4" /> FIFO LAYERS
                    </button>
                    <button
                        onClick={() => setActiveTab('bins')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'bins' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700/50'}`}
                    >
                        <Box className="w-4 h-4" /> BINS
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search items, references..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    {activeTab === 'ledger' && (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-zinc-700">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Item Details</th>
                                    <th className="px-6 py-4">Warehouse</th>
                                    <th className="px-6 py-4 text-right">Qty</th>
                                    <th className="px-6 py-4 text-right">Cost</th>
                                    <th className="px-6 py-4 text-right">Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {loading ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Loading ledger...</td></tr>
                                ) : filteredTxns.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">No transactions found.</td></tr>
                                ) : (
                                    filteredTxns.map((txn) => (
                                        <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{txn.posting_date}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                                                    {getIcon(txn.transaction_type)}
                                                    {txn.transaction_type}
                                                    <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">{txn.reference_type}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900 dark:text-white">{txn.item?.name}</span>
                                                    <span className="text-xs text-slate-500 font-mono">{txn.item?.code}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{txn.warehouse?.name || '-'}</td>
                                            <td className={`px-6 py-4 text-right font-medium ${txn.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                                {txn.quantity > 0 ? '+' : ''}{txn.quantity} <span className="text-xs text-slate-400 font-normal">{txn.item?.uom}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400 font-mono">${txn.unit_cost?.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right font-medium text-slate-800 dark:text-white font-mono">${(txn.quantity * txn.unit_cost).toFixed(2)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'fifo' && (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-zinc-700">
                                <tr>
                                    <th className="px-6 py-4">Receipt Date</th>
                                    <th className="px-6 py-4">Item Details</th>
                                    <th className="px-6 py-4">Receipt Ref (Layer)</th>
                                    <th className="px-6 py-4 text-right">Qty Received</th>
                                    <th className="px-6 py-4 text-right">Unit Cost</th>
                                    <th className="px-6 py-4 text-right">Layer Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {loading ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading FIFO layers...</td></tr>
                                ) : fifoLayers.length === 0 ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No receipt layers found.</td></tr>
                                ) : (
                                    fifoLayers.map((layer) => (
                                        <tr key={layer.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors">
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{layer.posting_date}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900 dark:text-white">{layer.item?.name}</span>
                                                    <span className="text-xs text-slate-500 font-mono">{layer.item?.code}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-1 rounded-md">
                                                    {layer.reference_type} #{layer.reference_id?.split('-')[0].toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                                                {layer.quantity} <span className="text-xs text-slate-400 font-normal">{layer.item?.uom}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400 font-mono">${layer.unit_cost?.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right font-medium text-indigo-700 dark:text-indigo-400 font-mono">${layer.total_value?.toFixed(2)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'bins' && (
                        <div className="p-6">
                            {loading ? (
                                <p className="text-center text-slate-500 py-12">Loading bin stock balances...</p>
                            ) : binStock.length === 0 ? (
                                <p className="text-center text-slate-500 py-12">No items found in any bins matching criteria.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {binStock.map((bs, i) => (
                                        <div key={i} className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl p-5 hover:border-indigo-500/50 transition-colors">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Location</span>
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{bs.bin?.name}</span>
                                                    <span className="text-[10px] text-slate-500 font-mono">{bs.bin?.code}</span>
                                                </div>
                                                <Box className="w-5 h-5 text-slate-300 dark:text-zinc-600" />
                                            </div>
                                            <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-slate-100 dark:border-zinc-800">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm line-clamp-1">{bs.item?.name}</p>
                                                        <p className="text-xs text-slate-400 font-mono">{bs.item?.code}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-bold text-slate-800 dark:text-white">{bs.qty}</p>
                                                        <p className="text-[10px] text-slate-400 uppercase">{bs.item?.uom}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

