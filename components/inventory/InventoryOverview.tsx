import React, { useState, useEffect, useCallback } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import {
    Package, TrendingDown, AlertTriangle, Boxes,
    RefreshCw, Search, ArrowDownLeft, ArrowUpRight,
    Layers, CheckCircle2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvSummary {
    total_stock_value: number;
    low_stock_count: number;
    reserved_qty: number;
    scrap_value: number;
}

interface MovementPoint {
    date: string;
    inbound: number;
    outbound: number;
    net: number;
}

interface LowStockItem {
    id: string;
    item_code: string;
    name: string;
    uom: string;
    net_qty: number;
    reorder_level?: number;
    warehouse?: string;
}

interface BinStockRow {
    warehouse_name: string;
    item_name: string;
    item_code: string;
    net_qty: number;
    uom: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR',
        maximumFractionDigits: 0, notation: 'compact'
    }).format(n);

const fmtQty = (n: number, uom = '') =>
    `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}${uom ? ' ' + uom : ''}`;

// ─── Sub-components ───────────────────────────────────────────────────────────

const KpiCard: React.FC<{
    label: string;
    value: string;
    icon: React.ElementType;
    accent: string;
    badge?: string;
    badgeColor?: string;
}> = ({ label, value, icon: Icon, accent, badge, badgeColor }) => (
    <div className="relative overflow-hidden rounded-2xl p-5 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all">
        <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 ${accent}`} />
        <div className="flex items-start justify-between mb-3">
            <div className={`p-2 rounded-xl ${accent} bg-opacity-10`}>
                <Icon className={`w-5 h-5 ${accent.replace('bg-', 'text-')}`} />
            </div>
            {badge && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor || 'bg-slate-100 text-slate-500'}`}>
                    {badge}
                </span>
            )}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
    </div>
);

const SkeletonCard: React.FC = () => (
    <div className="rounded-2xl p-5 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 animate-pulse">
        <div className="w-8 h-8 bg-slate-200 dark:bg-zinc-800 rounded-xl mb-4" />
        <div className="h-3 w-20 bg-slate-200 dark:bg-zinc-800 rounded mb-2" />
        <div className="h-7 w-28 bg-slate-200 dark:bg-zinc-800 rounded" />
    </div>
);

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 shadow-xl text-xs">
            <p className="font-bold text-slate-700 dark:text-slate-200 mb-2">{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
                    <span className="capitalize">{p.name}</span>
                    <span className="font-semibold">{fmtQty(p.value)}</span>
                </p>
            ))}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const InventoryOverview: React.FC = () => {
    const { currentCompanyId } = useAuth();

    const [summary, setSummary] = useState<InvSummary | null>(null);
    const [movement, setMovement] = useState<MovementPoint[]>([]);
    const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
    const [binStock, setBinStock] = useState<BinStockRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [binSearch, setBinSearch] = useState('');
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const fetchAll = useCallback(async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            const [summaryRes, movementRes, lowStockRes, binRes] = await Promise.allSettled([
                supabase.rpc('rpc_inventory_dashboard_summary', { p_company_id: currentCompanyId }),
                supabase.rpc('rpc_stock_movement_trend', { p_company_id: currentCompanyId }),
                // Low stock: items with net_qty <= reorder_level or very low
                supabase
                    .from('inventory_transactions')
                    .select('item_id, item_master!inner(id, item_code, name, uom, reorder_level)')
                    .eq('company_id', currentCompanyId),
                // Bin-wise: aggregate by warehouse + item
                supabase
                    .from('inventory_transactions')
                    .select(`
                        item_id,
                        warehouse_id,
                        quantity,
                        item_master!inner(id, item_code, name, uom),
                        warehouses!inner(id, name)
                    `)
                    .eq('company_id', currentCompanyId)
            ]);

            if (summaryRes.status === 'fulfilled' && summaryRes.value.data) {
                setSummary(summaryRes.value.data as any);
            }
            if (movementRes.status === 'fulfilled' && movementRes.value.data) {
                setMovement(movementRes.value.data as any);
            }

            // Process low stock
            if (lowStockRes.status === 'fulfilled' && lowStockRes.value.data) {
                const raw = lowStockRes.value.data as any[];
                // Aggregate net qty per item
                const aggregated: Record<string, { item: any; qty: number }> = {};
                for (const row of raw) {
                    const id = row.item_id;
                    if (!aggregated[id]) {
                        aggregated[id] = { item: row.item_master, qty: 0 };
                    }
                    aggregated[id].qty += row.quantity ?? 0;
                }
                const lowItems = Object.values(aggregated)
                    .filter(({ item, qty }) => {
                        const reorder = item?.reorder_level ?? 10;
                        return qty <= reorder && qty > 0;
                    })
                    .sort((a, b) => a.qty - b.qty)
                    .slice(0, 10)
                    .map(({ item, qty }) => ({
                        id: item.id,
                        item_code: item.item_code,
                        name: item.name,
                        uom: item.uom,
                        net_qty: qty,
                        reorder_level: item.reorder_level ?? 10,
                    }));
                setLowStock(lowItems);
            }

            // Process bin-wise stock
            if (binRes.status === 'fulfilled' && binRes.value.data) {
                const raw = binRes.value.data as any[];
                const binMap: Record<string, BinStockRow & { _qty: number }> = {};
                for (const row of raw) {
                    const key = `${row.warehouse_id}_${row.item_id}`;
                    if (!binMap[key]) {
                        binMap[key] = {
                            warehouse_name: row.warehouses?.name ?? '—',
                            item_name: row.item_master?.name ?? '—',
                            item_code: row.item_master?.item_code ?? '—',
                            uom: row.item_master?.uom ?? '',
                            net_qty: 0,
                            _qty: 0,
                        };
                    }
                    binMap[key]._qty += row.quantity ?? 0;
                    binMap[key].net_qty = binMap[key]._qty;
                }
                const bins = Object.values(binMap)
                    .filter(b => b.net_qty > 0)
                    .sort((a, b) => b.net_qty - a.net_qty);
                setBinStock(bins);
            }
        } catch (e) {
            console.error('[InventoryOverview] fetch error:', e);
        } finally {
            setLoading(false);
            setLastRefresh(new Date());
        }
    }, [currentCompanyId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const filteredBin = binStock.filter(b =>
        binSearch === '' ||
        b.item_name.toLowerCase().includes(binSearch.toLowerCase()) ||
        b.item_code.toLowerCase().includes(binSearch.toLowerCase()) ||
        b.warehouse_name.toLowerCase().includes(binSearch.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Inventory Overview</h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Live stock position · Updated {lastRefresh.toLocaleTimeString()}
                    </p>
                </div>
                <button
                    onClick={fetchAll}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                ) : (
                    <>
                        <KpiCard label="Total Stock Value" value={fmt(summary?.total_stock_value ?? 0)} icon={Boxes} accent="bg-indigo-500" />
                        <KpiCard
                            label="Low Stock Items"
                            value={String(summary?.low_stock_count ?? 0)}
                            icon={AlertTriangle}
                            accent="bg-amber-500"
                            badge={summary?.low_stock_count ? `${summary.low_stock_count} alerts` : 'OK'}
                            badgeColor={summary?.low_stock_count ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'}
                        />
                        <KpiCard label="Reserved Qty" value={fmtQty(summary?.reserved_qty ?? 0)} icon={Layers} accent="bg-violet-500" />
                        <KpiCard label="Scrap Value" value={fmt(summary?.scrap_value ?? 0)} icon={TrendingDown} accent="bg-rose-500" />
                    </>
                )}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Stock Movement Trend */}
                <div className="xl:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-100 dark:border-zinc-800 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">
                        Stock Movement — Last 30 Days
                    </h3>
                    {loading ? (
                        <div className="h-48 animate-pulse bg-slate-100 dark:bg-zinc-800 rounded-xl" />
                    ) : movement.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <Package className="w-10 h-10 mb-2 opacity-30" />
                            <p className="text-sm">No movement data in last 30 days</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={movement} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={45} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="inbound" name="Inbound" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={16} />
                                <Bar dataKey="outbound" name="Outbound" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Low Stock Alerts */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-100 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Low Stock Alerts</h3>
                        {lowStock.length > 0 && (
                            <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                                {lowStock.length}
                            </span>
                        )}
                    </div>
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-8 bg-slate-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : lowStock.length === 0 ? (
                        <div className="py-8 text-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                            <p className="text-sm text-slate-400 dark:text-slate-500">All items above reorder level</p>
                        </div>
                    ) : (
                        <div className="space-y-2 overflow-y-auto max-h-52">
                            {lowStock.map((item) => {
                                const pct = item.reorder_level ? Math.min((item.net_qty / item.reorder_level) * 100, 100) : 0;
                                const critical = pct < 30;
                                return (
                                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${critical ? 'bg-rose-500' : 'bg-amber-400'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <div className="flex-1 bg-slate-200 dark:bg-zinc-700 rounded-full h-1">
                                                    <div className={`h-full rounded-full ${critical ? 'bg-rose-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                                    {fmtQty(item.net_qty, item.uom)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Bin-wise Stock View */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Bin-wise Stock Position</h3>
                    </div>
                    <div className="ml-auto relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Filter items…"
                            value={binSearch}
                            onChange={e => setBinSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-44"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-5 space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-10 bg-slate-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : filteredBin.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{binSearch ? 'No matching items' : 'No stock data available'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0">
                                <tr className="text-left text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50">
                                    <th className="px-5 py-3">Warehouse</th>
                                    <th className="px-5 py-3">Item Code</th>
                                    <th className="px-5 py-3">Item Name</th>
                                    <th className="px-5 py-3 text-right">Net Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {filteredBin.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-5 py-3">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                                <Boxes className="w-3.5 h-3.5" />
                                                {row.warehouse_name}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{row.item_code}</td>
                                        <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{row.item_name}</td>
                                        <td className="px-5 py-3 text-right font-semibold text-slate-800 dark:text-white">
                                            {fmtQty(row.net_qty, row.uom)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
