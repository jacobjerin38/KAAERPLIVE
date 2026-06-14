import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    AlertTriangle, Bell, Package, RefreshCw, CheckCircle2,
    XCircle, Clock, TrendingDown, Calendar, ShoppingCart,
    Filter, ChevronDown
} from 'lucide-react';

interface StockAlert {
    id: string;
    created_at: string;
    alert_type: string;
    severity: string;
    message: string;
    current_qty: number;
    reorder_level: number;
    is_resolved: boolean;
    metadata: any;
    item: {
        id: string;
        code: string;
        name: string;
        uom: string;
        reorder_qty: number;
    } | null;
    warehouse: {
        name: string;
    } | null;
}

type FilterType = 'ALL' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NON_MOVING' | 'NEAR_EXPIRY' | 'EXPIRED';

export const StockAlerts: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [alerts, setAlerts] = useState<StockAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [filter, setFilter] = useState<FilterType>('ALL');
    const [showResolved, setShowResolved] = useState(false);

    const fetchAlerts = useCallback(async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            let query = supabase
                .from('stock_alerts')
                .select(`
                    *,
                    item:item_master(id, code, name, uom, reorder_qty),
                    warehouse:warehouses(name)
                `)
                .eq('company_id', currentCompanyId)
                .order('created_at', { ascending: false });

            if (!showResolved) {
                query = query.eq('is_resolved', false);
            }

            const { data, error } = await query;
            if (error) throw error;
            setAlerts((data || []) as any);
        } catch (err) {
            console.error('Error fetching alerts:', err);
        } finally {
            setLoading(false);
        }
    }, [currentCompanyId, showResolved]);

    useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

    const generateAlerts = async () => {
        if (!currentCompanyId) return;
        setGenerating(true);
        try {
            const { data, error } = await supabase.rpc('rpc_generate_stock_alerts', {
                p_company_id: currentCompanyId
            });
            if (error) throw error;
            await fetchAlerts();
        } catch (err: any) {
            console.error('Error generating alerts:', err);
            alert('Failed to generate alerts: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    const resolveAlert = async (alertId: string) => {
        try {
            const { error } = await supabase
                .from('stock_alerts')
                .update({ is_resolved: true, resolved_at: new Date().toISOString() })
                .eq('id', alertId);
            if (error) throw error;
            fetchAlerts();
        } catch (err: any) {
            console.error('Error resolving alert:', err);
        }
    };

    const filteredAlerts = alerts.filter(a => filter === 'ALL' || a.alert_type === filter);

    const alertCounts = {
        OUT_OF_STOCK: alerts.filter(a => a.alert_type === 'OUT_OF_STOCK').length,
        LOW_STOCK: alerts.filter(a => a.alert_type === 'LOW_STOCK').length,
        NON_MOVING: alerts.filter(a => a.alert_type === 'NON_MOVING').length,
        NEAR_EXPIRY: alerts.filter(a => a.alert_type === 'NEAR_EXPIRY').length,
        EXPIRED: alerts.filter(a => a.alert_type === 'EXPIRED').length,
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'OUT_OF_STOCK': return <XCircle className="w-5 h-5" />;
            case 'LOW_STOCK': return <TrendingDown className="w-5 h-5" />;
            case 'NON_MOVING': return <Clock className="w-5 h-5" />;
            case 'NEAR_EXPIRY': return <Calendar className="w-5 h-5" />;
            case 'EXPIRED': return <AlertTriangle className="w-5 h-5" />;
            default: return <Bell className="w-5 h-5" />;
        }
    };

    const getAlertColor = (type: string, severity: string) => {
        if (severity === 'CRITICAL') return 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10';
        switch (type) {
            case 'OUT_OF_STOCK': return 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10';
            case 'LOW_STOCK': return 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10';
            case 'NON_MOVING': return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10';
            case 'NEAR_EXPIRY': return 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10';
            case 'EXPIRED': return 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10';
            default: return 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50';
        }
    };

    const getIconColor = (type: string) => {
        switch (type) {
            case 'OUT_OF_STOCK': return 'text-rose-600 dark:text-rose-400';
            case 'LOW_STOCK': return 'text-amber-600 dark:text-amber-400';
            case 'NON_MOVING': return 'text-blue-600 dark:text-blue-400';
            case 'NEAR_EXPIRY': return 'text-orange-600 dark:text-orange-400';
            case 'EXPIRED': return 'text-rose-600 dark:text-rose-400';
            default: return 'text-slate-500';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Stock Alerts & Notifications</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Monitor out-of-stock, low stock, non-moving, and expiry alerts.
                    </p>
                </div>
                <button
                    onClick={generateAlerts}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                    {generating ? 'Scanning...' : 'Refresh Alerts'}
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { type: 'OUT_OF_STOCK' as FilterType, label: 'Out of Stock', count: alertCounts.OUT_OF_STOCK, color: 'bg-rose-500', iconColor: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-900/20' },
                    { type: 'LOW_STOCK' as FilterType, label: 'Low Stock', count: alertCounts.LOW_STOCK, color: 'bg-amber-500', iconColor: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-900/20' },
                    { type: 'NON_MOVING' as FilterType, label: 'Non-Moving', count: alertCounts.NON_MOVING, color: 'bg-blue-500', iconColor: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
                    { type: 'NEAR_EXPIRY' as FilterType, label: 'Near Expiry', count: alertCounts.NEAR_EXPIRY, color: 'bg-orange-500', iconColor: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-900/20' },
                    { type: 'EXPIRED' as FilterType, label: 'Expired', count: alertCounts.EXPIRED, color: 'bg-rose-600', iconColor: 'text-rose-700', bgColor: 'bg-rose-100 dark:bg-rose-900/30' },
                ].map(card => (
                    <button
                        key={card.type}
                        onClick={() => setFilter(filter === card.type ? 'ALL' : card.type)}
                        className={`p-4 rounded-xl border transition-all ${
                            filter === card.type
                                ? 'border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-800'
                                : 'border-slate-200 dark:border-zinc-800'
                        } ${card.bgColor}`}
                    >
                        <div className="text-2xl font-bold text-slate-800 dark:text-white">{card.count}</div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{card.label}</div>
                    </button>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showResolved}
                        onChange={e => setShowResolved(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-600 dark:text-slate-400">Show resolved alerts</span>
                </label>
                {filter !== 'ALL' && (
                    <button
                        onClick={() => setFilter('ALL')}
                        className="text-xs text-indigo-600 hover:underline"
                    >
                        Clear filter
                    </button>
                )}
                <span className="ml-auto text-xs text-slate-400">
                    {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Alerts List */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-20 bg-slate-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : filteredAlerts.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">All Clear</h3>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        {filter !== 'ALL' ? 'No alerts of this type.' : 'No active stock alerts. Click "Refresh Alerts" to scan inventory.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredAlerts.map(alert => (
                        <div
                            key={alert.id}
                            className={`border rounded-xl p-4 transition-all ${getAlertColor(alert.alert_type, alert.severity)} ${
                                alert.is_resolved ? 'opacity-50' : ''
                            }`}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`p-2 rounded-lg ${getIconColor(alert.alert_type)}`}>
                                    {getAlertIcon(alert.alert_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                                            alert.severity === 'CRITICAL'
                                                ? 'bg-rose-200 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400'
                                                : 'bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'
                                        }`}>
                                            {alert.severity}
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">
                                            {alert.alert_type.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{alert.message}</p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                        {alert.item && (
                                            <span className="flex items-center gap-1">
                                                <Package className="w-3 h-3" />
                                                {alert.item.code}
                                            </span>
                                        )}
                                        {alert.current_qty !== null && (
                                            <span>Current Qty: <strong>{alert.current_qty}</strong></span>
                                        )}
                                        {alert.reorder_level > 0 && (
                                            <span>Reorder at: <strong>{alert.reorder_level}</strong></span>
                                        )}
                                        {alert.metadata?.suggested_reorder_qty && (
                                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                                                <ShoppingCart className="w-3 h-3" />
                                                Suggested Order: {alert.metadata.suggested_reorder_qty}
                                            </span>
                                        )}
                                        {alert.metadata?.days_until_expiry !== undefined && (
                                            <span className="font-medium text-orange-600 dark:text-orange-400">
                                                {alert.metadata.days_until_expiry} days until expiry
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {!alert.is_resolved && (
                                    <button
                                        onClick={() => resolveAlert(alert.id)}
                                        className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        Resolve
                                    </button>
                                )}
                                {alert.is_resolved && (
                                    <span className="text-xs text-emerald-500 font-medium">Resolved</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
