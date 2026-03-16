import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    Factory, Plus, CheckCircle, Clock, Box, ListChecks, Settings2, ChevronRight,
    Play, Cog, Package, AlertTriangle
} from 'lucide-react';

// Types
interface ProductionOrder {
    id: string;
    name: string;
    product_id: string;
    quantity_to_produce: number;
    quantity_produced: number;
    state: 'draft' | 'confirmed' | 'in_progress' | 'done' | 'cancelled';
    date_planned: string;
    product_name?: string;
    bom_name?: string;
}

interface BOM {
    id: string;
    name: string;
    product_id: string;
    quantity: number;
    is_active: boolean;
    product_name?: string;
}

interface WorkCenter {
    id: string;
    name: string;
    code: string;
    capacity_per_day: number;
    cost_per_hour: number;
    is_active: boolean;
}

type TabId = 'orders' | 'bom' | 'workcenters';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'orders', label: 'Production Orders', icon: ListChecks },
    { id: 'bom', label: 'Bill of Materials', icon: Box },
    { id: 'workcenters', label: 'Work Centers', icon: Cog }
];

const STATE_COLORS: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    confirmed: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    done: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
};

export const ManufacturingDashboard: React.FC = () => {
    const { session } = useAuth();
    const [activeTab, setActiveTab] = useState<TabId>('orders');
    const [orders, setOrders] = useState<ProductionOrder[]>([]);
    const [boms, setBoms] = useState<BOM[]>([]);
    const [workcenters, setWorkcenters] = useState<WorkCenter[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        if (activeTab === 'orders') {
            const { data } = await supabase.from('mrp_production_orders').select('*, item_master!product_id(name), mrp_bom!bom_id(name)').order('created_at', { ascending: false });
            setOrders((data || []).map((d: any) => ({ ...d, product_name: d.item_master?.name, bom_name: d.mrp_bom?.name })));
        } else if (activeTab === 'bom') {
            const { data } = await supabase.from('mrp_bom').select('*, item_master!product_id(name)').order('created_at', { ascending: false });
            setBoms((data || []).map((d: any) => ({ ...d, product_name: d.item_master?.name })));
        } else if (activeTab === 'workcenters') {
            const { data } = await supabase.from('mrp_work_centers').select('*').order('name');
            setWorkcenters(data || []);
        }
        setLoading(false);
    };

    const handleProduce = async (orderId: string) => {
        if (!session?.user?.id) return;
        const { data, error } = await supabase.rpc('rpc_produce_items', {
            p_order_id: orderId,
            p_user_id: session.user.id
        });
        if (error) {
            alert(`Error: ${error.message}`);
        } else if (data && !data.success) {
            alert(`Failed: ${data.message}`);
        } else {
            fetchData();
        }
    };

    // ---- Render Orders ----
    const renderOrders = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-700 dark:text-white">Production Orders</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
                    <Plus className="w-4 h-4" /> New Order
                </button>
            </div>
            {loading ? <p>Loading...</p> : orders.length === 0 ? (
                <div className="text-center py-10 text-slate-400"><Factory className="w-12 h-12 mx-auto mb-2 opacity-50" />No production orders found.</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {orders.map(order => (
                        <div key={order.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-800 dark:text-white">{order.name}</h3>
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${STATE_COLORS[order.state]}`}>{order.state.replace('_', ' ')}</span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate"><Package className="w-3 h-3 inline mr-1" />{order.product_name || 'Unknown Product'}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400"><Clock className="w-3 h-3 inline mr-1" />Planned: {order.date_planned}</p>
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{order.quantity_produced} / {order.quantity_to_produce}</span>
                                {order.state !== 'done' && order.state !== 'cancelled' && (
                                    <button
                                        onClick={() => handleProduce(order.id)}
                                        className="flex items-center gap-1 text-xs font-bold text-green-600 hover:text-green-700"
                                    >
                                        <Play className="w-3 h-3" /> Produce
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // ---- Render BOMs ----
    const renderBoms = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-700 dark:text-white">Bill of Materials</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
                    <Plus className="w-4 h-4" /> New BOM
                </button>
            </div>
            {loading ? <p>Loading...</p> : boms.length === 0 ? (
                <div className="text-center py-10 text-slate-400"><Box className="w-12 h-12 mx-auto mb-2 opacity-50" />No BOMs found.</div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                            <tr><th className="p-3">Name</th><th className="p-3">Product</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-center">Active</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {boms.map(bom => (
                                <tr key={bom.id} className="text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="p-3 font-medium">{bom.name}</td>
                                    <td className="p-3">{bom.product_name}</td>
                                    <td className="p-3 text-right">{bom.quantity}</td>
                                    <td className="p-3 text-center">{bom.is_active ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <AlertTriangle className="w-4 h-4 text-red-500 mx-auto" />}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    // ---- Render Work Centers ----
    const renderWorkcenters = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-700 dark:text-white">Work Centers</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
                    <Plus className="w-4 h-4" /> New Work Center
                </button>
            </div>
            {loading ? <p>Loading...</p> : workcenters.length === 0 ? (
                <div className="text-center py-10 text-slate-400"><Settings2 className="w-12 h-12 mx-auto mb-2 opacity-50" />No work centers found.</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {workcenters.map(wc => (
                        <div key={wc.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400"><Cog className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">{wc.name}</h3>
                                    <p className="text-xs text-slate-400">{wc.code}</p>
                                </div>
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                                <p>Capacity: <span className="font-semibold text-slate-700 dark:text-slate-200">{wc.capacity_per_day} hrs/day</span></p>
                                <p>Cost/hr: <span className="font-semibold text-slate-700 dark:text-slate-200">${wc.cost_per_hour.toFixed(2)}</span></p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Factory className="w-7 h-7 text-indigo-500" /> Manufacturing</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage production orders, BOMs, and work centers.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex gap-6 -mb-px">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-3 px-1 flex items-center gap-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'bom' && renderBoms()}
            {activeTab === 'workcenters' && renderWorkcenters()}
        </div>
    );
};

export default ManufacturingDashboard;
