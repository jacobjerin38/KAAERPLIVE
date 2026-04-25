import React, { useState, useEffect, useCallback } from 'react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    TrendingUp, TrendingDown, DollarSign, CreditCard,
    Landmark, AlertCircle, RefreshCw, ArrowUpRight, Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinanceSummary {
    receivables: number;
    payables: number;
    bank_balance: number;
    revenue: number;
    expenses: number;
    net_profit: number;
}

interface AgingData {
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_over_90: number;
    total: number;
}

interface TrendPoint {
    month: string;
    revenue: number;
    expenses: number;
}

interface OverdueInvoice {
    id: string;
    name: string;
    invoice_date_due: string;
    amount_residual: number;
    partner_name?: string;
}

interface UpcomingBill {
    id: string;
    reference: string;
    invoice_date_due: string;
    amount_residual: number;
    partner_name?: string;
    days_until: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    'QAR ' + new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0, notation: 'compact'
    }).format(n);

const fmtFull = (n: number) =>
    'QAR ' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

const daysDiff = (dateStr: string) => {
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const KpiCard: React.FC<{
    label: string;
    value: string;
    icon: React.ElementType;
    color: string;
    trend?: 'up' | 'down' | 'neutral';
    sub?: string;
}> = ({ label, value, icon: Icon, color, trend, sub }) => (
    <div className={`relative overflow-hidden rounded-2xl p-5 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-sm group hover:shadow-md transition-all`}>
        <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 ${color}`} />
        <div className="flex items-start justify-between mb-3">
            <div className={`p-2 rounded-xl ${color} bg-opacity-10`}>
                <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
            </div>
            {trend && (
                trend === 'up'
                    ? <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    : trend === 'down'
                        ? <TrendingDown className="w-4 h-4 text-rose-500" />
                        : null
            )}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
    </div>
);

const SkeletonCard: React.FC = () => (
    <div className="rounded-2xl p-5 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 animate-pulse">
        <div className="w-8 h-8 bg-slate-200 dark:bg-zinc-800 rounded-xl mb-4" />
        <div className="h-3 w-20 bg-slate-200 dark:bg-zinc-800 rounded mb-2" />
        <div className="h-7 w-28 bg-slate-200 dark:bg-zinc-800 rounded" />
    </div>
);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 shadow-xl text-xs">
            <p className="font-bold text-slate-700 dark:text-slate-200 mb-2">{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
                    <span className="capitalize">{p.name}</span>
                    <span className="font-semibold">{fmtFull(p.value)}</span>
                </p>
            ))}
        </div>
    );
};

// ─── AR Aging Bar ─────────────────────────────────────────────────────────────

const AgingBar: React.FC<{ label: string; value: number; total: number; color: string }> = ({ label, value, total, color }) => {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">{label}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(value)}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-1.5">
                <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const FinanceDashboard: React.FC = () => {
    const { currentCompanyId } = useAuth();

    const [summary, setSummary] = useState<FinanceSummary | null>(null);
    const [aging, setAging] = useState<AgingData | null>(null);
    const [trend, setTrend] = useState<TrendPoint[]>([]);
    const [overdue, setOverdue] = useState<OverdueInvoice[]>([]);
    const [apDue, setApDue] = useState<UpcomingBill[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const fetchAll = useCallback(async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const in30 = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
            const [summaryRes, agingRes, trendRes, overdueRes, apDueRes] = await Promise.allSettled([
                supabase.rpc('rpc_finance_dashboard_summary', { p_company_id: currentCompanyId }),
                supabase.rpc('rpc_ar_aging', { p_company_id: currentCompanyId }),
                supabase.rpc('rpc_revenue_expense_trend', { p_company_id: currentCompanyId }),
                supabase
                    .from('accounting_moves')
                    .select('id, reference, invoice_date_due, amount_residual, partner:accounting_partners(name)')
                    .eq('company_id', currentCompanyId)
                    .eq('move_type', 'out_invoice')
                    .eq('state', 'Posted')
                    .gt('amount_residual', 0)
                    .lt('invoice_date_due', today)
                    .order('invoice_date_due', { ascending: true })
                    .limit(5),
                supabase
                    .from('accounting_moves')
                    .select('id, reference, invoice_date_due, amount_residual, partner:accounting_partners(name)')
                    .eq('company_id', currentCompanyId)
                    .eq('move_type', 'in_invoice')
                    .eq('state', 'Posted')
                    .gt('amount_residual', 0)
                    .lte('invoice_date_due', in30)
                    .order('invoice_date_due', { ascending: true })
                    .limit(8)
            ]);

            if (summaryRes.status === 'fulfilled' && summaryRes.value.data) {
                setSummary(summaryRes.value.data as any as FinanceSummary);
            }
            if (agingRes.status === 'fulfilled' && agingRes.value.data) {
                setAging(agingRes.value.data as any as AgingData);
            }
            if (trendRes.status === 'fulfilled' && trendRes.value.data) {
                setTrend((trendRes.value.data as any) || []);
            }
            if (overdueRes.status === 'fulfilled' && overdueRes.value.data) {
                setOverdue((overdueRes.value.data as any[]).map((d: any) => ({
                    ...d,
                    name: d.reference || d.name,
                    partner_name: d.partner?.name
                })));
            }
            if (apDueRes.status === 'fulfilled' && apDueRes.value.data) {
                setApDue((apDueRes.value.data as any[]).map((d: any) => {
                    const dueDate = new Date(d.invoice_date_due);
                    const daysUntil = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000*60*60*24));
                    return {
                        id: d.id, reference: d.reference || 'BILL',
                        invoice_date_due: d.invoice_date_due,
                        amount_residual: Number(d.amount_residual),
                        partner_name: d.partner?.name, days_until: daysUntil
                    };
                }));
            }
        } catch (e) {
            console.error('[FinanceDashboard] fetch error:', e);
        } finally {
            setLoading(false);
            setLastRefresh(new Date());
        }
    }, [currentCompanyId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Finance Overview</h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Current Financial Year · Updated {lastRefresh.toLocaleTimeString()}
                    </p>
                </div>
                <button
                    onClick={fetchAll}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                ) : (
                    <>
                        <KpiCard label="Receivables" value={fmt(summary?.receivables ?? 0)} icon={TrendingUp} color="bg-emerald-500" trend="up" sub="Outstanding AR" />
                        <KpiCard label="Payables" value={fmt(summary?.payables ?? 0)} icon={TrendingDown} color="bg-rose-500" trend="down" sub="Outstanding AP" />
                        <KpiCard label="Bank Balance" value={fmt(summary?.bank_balance ?? 0)} icon={Landmark} color="bg-blue-500" trend="neutral" sub="All bank accounts" />
                        <KpiCard label="Revenue" value={fmt(summary?.revenue ?? 0)} icon={DollarSign} color="bg-violet-500" trend="up" sub="Current FY" />
                        <KpiCard label="Expenses" value={fmt(summary?.expenses ?? 0)} icon={CreditCard} color="bg-amber-500" trend="down" sub="Current FY" />
                        <KpiCard
                            label="Net Profit"
                            value={fmt(summary?.net_profit ?? 0)}
                            icon={TrendingUp}
                            color={(summary?.net_profit ?? 0) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}
                            trend={(summary?.net_profit ?? 0) >= 0 ? 'up' : 'down'}
                            sub="Revenue − Expenses"
                        />
                    </>
                )}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Revenue vs Expense Trend */}
                <div className="xl:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-100 dark:border-zinc-800 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Revenue vs Expenses — Last 6 Months</h3>
                    {loading ? (
                        <div className="h-48 animate-pulse bg-slate-100 dark:bg-zinc-800 rounded-xl" />
                    ) : trend.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
                            <p className="text-sm">No transaction data yet</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} width={70} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorRevenue)" name="Revenue" />
                                <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#colorExpenses)" name="Expenses" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* AR Aging */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-100 dark:border-zinc-800 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">AR Aging</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                        Total: <span className="font-semibold text-slate-600 dark:text-slate-300">{fmtFull(aging?.total ?? 0)}</span>
                    </p>
                    {loading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-5 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <AgingBar label="Current (not due)" value={aging?.current ?? 0} total={aging?.total ?? 1} color="bg-emerald-400" />
                            <AgingBar label="1 – 30 days" value={aging?.days_1_30 ?? 0} total={aging?.total ?? 1} color="bg-yellow-400" />
                            <AgingBar label="31 – 60 days" value={aging?.days_31_60 ?? 0} total={aging?.total ?? 1} color="bg-orange-400" />
                            <AgingBar label="61 – 90 days" value={aging?.days_61_90 ?? 0} total={aging?.total ?? 1} color="bg-red-400" />
                            <AgingBar label="Over 90 days" value={aging?.days_over_90 ?? 0} total={aging?.total ?? 1} color="bg-red-700" />
                        </div>
                    )}
                </div>
            </div>

            {/* Overdue Invoices */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Overdue Invoices</h3>
                    {overdue.length > 0 && (
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-bold">
                            {overdue.length} due
                        </span>
                    )}
                </div>

                {loading ? (
                    <div className="p-5 space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-10 bg-slate-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : overdue.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-2">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">No overdue invoices. Excellent!</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50/50 dark:bg-zinc-800/30">
                                <th className="px-5 py-3">Invoice</th>
                                <th className="px-5 py-3">Customer</th>
                                <th className="px-5 py-3">Due Date</th>
                                <th className="px-5 py-3">Days Overdue</th>
                                <th className="px-5 py-3 text-right">Amount Due</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {overdue.map((inv) => {
                                const days = daysDiff(inv.invoice_date_due);
                                const severity = days > 90 ? 'text-red-600 dark:text-red-400' : days > 30 ? 'text-orange-600 dark:text-orange-400' : 'text-yellow-600 dark:text-yellow-400';
                                return (
                                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{inv.name}</td>
                                        <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{inv.partner_name || '—'}</td>
                                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(inv.invoice_date_due).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' })}
                                        </td>
                                        <td className={`px-5 py-3 font-bold ${severity}`}>{days}d</td>
                                        <td className="px-5 py-3 text-right font-semibold text-slate-800 dark:text-white">{fmtFull(inv.amount_residual)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* AP Due Tracking */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Upcoming Payments Due (AP)</h3>
                    {apDue.length > 0 && (
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-xs font-bold">
                            {apDue.length} bills
                        </span>
                    )}
                </div>
                {loading ? (
                    <div className="p-5 space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="h-10 bg-slate-100 dark:bg-zinc-800 rounded-xl animate-pulse" />))}</div>
                ) : apDue.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">No upcoming vendor payments due.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50/50 dark:bg-zinc-800/30">
                            <th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Bill</th><th className="px-5 py-3">Due Date</th><th className="px-5 py-3">Urgency</th><th className="px-5 py-3 text-right">Amount</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {apDue.map(bill => {
                                const urgency = bill.days_until <= 0 ? { label: 'OVERDUE', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' } :
                                    bill.days_until <= 7 ? { label: `${bill.days_until}d`, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' } :
                                    { label: `${bill.days_until}d`, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
                                return (
                                    <tr key={bill.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{bill.partner_name || '—'}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{bill.reference}</td>
                                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{new Date(bill.invoice_date_due).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</td>
                                        <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${urgency.cls}`}>{urgency.label}</span></td>
                                        <td className="px-5 py-3 text-right font-semibold text-slate-800 dark:text-white">{fmtFull(bill.amount_residual)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
