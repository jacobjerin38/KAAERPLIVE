import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    ShoppingCart, Plus, CheckCircle, Clock, Truck, FileText, Package,
    ChevronRight, Play, DollarSign, User
} from 'lucide-react';

// Types
interface PurchaseOrder {
    id: string;
    name: string;
    partner_id: string;
    order_date: string;
    expected_date: string;
    state: 'draft' | 'confirmed' | 'received' | 'cancelled';
    total_amount: number;
    partner_name?: string;
}

interface SalesOrder {
    id: string;
    name: string;
    partner_id: string;
    order_date: string;
    commitment_date: string;
    state: 'draft' | 'confirmed' | 'shipped' | 'invoiced' | 'cancelled';
    total_amount: number;
    partner_name?: string;
}

type TabId = 'purchase' | 'sales';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'purchase', label: 'Purchase Orders', icon: ShoppingCart },
    { id: 'sales', label: 'Sales Orders', icon: FileText }
];

const STATE_COLORS: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    confirmed: 'bg-blue-100 text-blue-700',
    received: 'bg-green-100 text-green-700',
    shipped: 'bg-teal-100 text-teal-700',
    invoiced: 'bg-purple-100 text-purple-700',
    cancelled: 'bg-red-100 text-red-700',
};

export const ProcurementSalesDashboard: React.FC = () => {
    const { session } = useAuth();
    const [activeTab, setActiveTab] = useState<TabId>('purchase');
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        if (activeTab === 'purchase') {
            const { data } = await supabase.from('purchase_orders').select('*, accounting_partners!partner_id(name)').order('created_at', { ascending: false });
            setPurchaseOrders((data || []).map((d: any) => ({ ...d, partner_name: d.accounting_partners?.name })));
        } else {
            const { data } = await supabase.from('sales_orders').select('*, accounting_partners!partner_id(name)').order('created_at', { ascending: false });
            setSalesOrders((data || []).map((d: any) => ({ ...d, partner_name: d.accounting_partners?.name })));
        }
        setLoading(false);
    };

    const handleConfirmPO = async (orderId: string) => {
        const { data, error } = await supabase.rpc('rpc_confirm_purchase_order', { p_order_id: orderId });
        if (error || (data && !data.success)) alert((error?.message) || data?.message);
        else fetchData();
    };

    const handleReceivePO = async (orderId: string) => {
        if (!session?.user?.id) return;
        const { data, error } = await supabase.rpc('rpc_receive_purchase_order', { p_order_id: orderId, p_user_id: session.user.id });
        if (error || (data && !data.success)) alert((error?.message) || data?.message);
        else fetchData();
    };

    const handleConfirmSO = async (orderId: string) => {
        const { data, error } = await supabase.rpc('rpc_confirm_sales_order', { p_order_id: orderId });
        if (error || (data && !data.success)) alert((error?.message) || data?.message);
        else fetchData();
    };

    const handleShipSO = async (orderId: string) => {
        if (!session?.user?.id) return;
        const { data, error } = await supabase.rpc('rpc_ship_sales_order', { p_order_id: orderId, p_user_id: session.user.id });
        if (error || (data && !data.success)) alert((error?.message) || data?.message);
        else fetchData();
    };

    // ---- Render POs ----
    const renderPurchaseOrders = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-700 dark:text-white">Purchase Orders</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
                    <Plus className="w-4 h-4" /> New PO
                </button>
            </div>
            {loading ? <p>Loading...</p> : purchaseOrders.length === 0 ? (
                <div className="text-center py-10 text-slate-400"><ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />No purchase orders found.</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {purchaseOrders.map(po => (
                        <div key={po.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-800 dark:text-white">{po.name}</h3>
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${STATE_COLORS[po.state]}`}>{po.state}</span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1"><User className="w-3 h-3" />{po.partner_name || 'Unknown Vendor'}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400"><Clock className="w-3 h-3 inline mr-1" />Expected: {po.expected_date}</p>
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                <span className="text-sm font-bold text-green-600 dark:text-green-400 flex items-center gap-1"><DollarSign className="w-3 h-3" />{po.total_amount.toFixed(2)}</span>
                                <div className="flex gap-2">
                                    {po.state === 'draft' && <button onClick={() => handleConfirmPO(po.id)} className="text-xs font-bold text-blue-600 hover:text-blue-700">Confirm</button>}
                                    {po.state === 'confirmed' && <button onClick={() => handleReceivePO(po.id)} className="text-xs font-bold text-green-600 hover:text-green-700 flex items-center gap-1"><Package className="w-3 h-3" />Receive</button>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // ---- Render SOs ----
    const renderSalesOrders = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-700 dark:text-white">Sales Orders</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
                    <Plus className="w-4 h-4" /> New SO
                </button>
            </div>
            {loading ? <p>Loading...</p> : salesOrders.length === 0 ? (
                <div className="text-center py-10 text-slate-400"><FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />No sales orders found.</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {salesOrders.map(so => (
                        <div key={so.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-800 dark:text-white">{so.name}</h3>
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${STATE_COLORS[so.state]}`}>{so.state}</span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1"><User className="w-3 h-3" />{so.partner_name || 'Unknown Customer'}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400"><Clock className="w-3 h-3 inline mr-1" />Commitment: {so.commitment_date || 'N/A'}</p>
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                <span className="text-sm font-bold text-green-600 dark:text-green-400 flex items-center gap-1"><DollarSign className="w-3 h-3" />{so.total_amount.toFixed(2)}</span>
                                <div className="flex gap-2">
                                    {so.state === 'draft' && <button onClick={() => handleConfirmSO(so.id)} className="text-xs font-bold text-blue-600 hover:text-blue-700">Confirm</button>}
                                    {so.state === 'confirmed' && <button onClick={() => handleShipSO(so.id)} className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"><Truck className="w-3 h-3" />Ship</button>}
                                </div>
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
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><ShoppingCart className="w-7 h-7 text-indigo-500" /> Procurement & Sales</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Manage purchase and sales orders.</p>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex gap-6 -mb-px">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-3 px-1 flex items-center gap-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                            <tab.icon className="w-4 h-4" />{tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            {activeTab === 'purchase' && renderPurchaseOrders()}
            {activeTab === 'sales' && renderSalesOrders()}
        </div>
    );
};

export default ProcurementSalesDashboard;
