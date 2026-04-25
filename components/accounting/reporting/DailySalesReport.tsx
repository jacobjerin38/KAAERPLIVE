import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { BarChart3, Calendar, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const DailySalesReport: React.FC = () => {
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchSales(); }, [startDate, endDate]);

    const fetchSales = async () => {
        setLoading(true);
        try {
            const { data: invoices, error } = await supabase
                .from('accounting_moves')
                .select('date, amount_total, partner:accounting_partners(name)')
                .eq('move_type', 'out_invoice').eq('state', 'Posted')
                .gte('date', startDate).lte('date', endDate)
                .order('date', { ascending: true });
            if (error) throw error;

            // Group by date
            const grouped: Record<string, { date: string; total: number; count: number; topCustomer: string; topAmount: number }> = {};
            (invoices || []).forEach((inv: any) => {
                if (!grouped[inv.date]) grouped[inv.date] = { date: inv.date, total: 0, count: 0, topCustomer: '', topAmount: 0 };
                const g = grouped[inv.date];
                const amt = Number(inv.amount_total);
                g.total += amt; g.count++;
                if (amt > g.topAmount) { g.topAmount = amt; g.topCustomer = inv.partner?.name || 'Unknown'; }
            });
            setData(Object.values(grouped));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const totalRevenue = data.reduce((s, d) => s + d.total, 0);
    const totalInvoices = data.reduce((s, d) => s + d.count, 0);
    const avgDaily = data.length > 0 ? totalRevenue / data.length : 0;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-emerald-600" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Daily Sales Report</h2>
            </div>

            <div className="flex items-end gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">From</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">To</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" /></div>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-400 uppercase">Total Revenue</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">QAR {totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-400 uppercase">Total Invoices</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{totalInvoices}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-400 uppercase">Avg Daily</p>
                    <p className="text-2xl font-bold text-violet-600 mt-1">QAR {avgDaily.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                </div>
            </div>

            {/* Chart */}
            {data.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200 dark:border-zinc-800">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Sales Trend</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                            <Tooltip formatter={(v: any) => [`QAR ${Number(v).toLocaleString()}`, 'Revenue']} />
                            <Bar dataKey="total" fill="#8b5cf6" radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Invoices</th><th className="px-5 py-3">Top Customer</th><th className="px-5 py-3 text-right">Total Revenue</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {loading ? <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr> :
                         data.length === 0 ? <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400 italic">No sales data in this period.</td></tr> :
                         data.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                                <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">{d.date}</td>
                                <td className="px-5 py-3"><span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded text-xs font-bold">{d.count}</span></td>
                                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{d.topCustomer}</td>
                                <td className="px-5 py-3 text-right font-bold text-emerald-600">QAR {d.total.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
