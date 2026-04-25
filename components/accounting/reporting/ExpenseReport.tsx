import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Receipt, PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#8b5cf6','#f43f5e','#06b6d4','#f59e0b','#10b981','#6366f1','#ec4899','#14b8a6'];

export const ExpenseReport: React.FC = () => {
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchExpenses(); }, [startDate, endDate]);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            // Fetch posted expense move lines joined to expense-type accounts
            const { data: lines, error } = await supabase
                .from('accounting_move_lines')
                .select('debit, credit, account:chart_of_accounts(id, code, name, type)')
                .gte('date', startDate).lte('date', endDate);
            if (error) throw error;

            // Group by expense accounts only
            const grouped: Record<string, { name: string; code: string; amount: number }> = {};
            (lines || []).forEach((l: any) => {
                if (l.account?.type !== 'Expense') return;
                const key = l.account.id;
                if (!grouped[key]) grouped[key] = { name: l.account.name, code: l.account.code, amount: 0 };
                grouped[key].amount += Number(l.debit) - Number(l.credit);
            });

            const result = Object.values(grouped).filter(g => g.amount > 0).sort((a, b) => b.amount - a.amount);
            setData(result);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const totalExpenses = data.reduce((s, d) => s + d.amount, 0);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
                <Receipt className="w-6 h-6 text-rose-500" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Expense Report</h2>
            </div>

            <div className="flex items-end gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">From</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">To</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" /></div>
                <div className="bg-rose-50 dark:bg-rose-900/20 px-4 py-2.5 rounded-lg">
                    <p className="text-[10px] font-bold text-rose-400 uppercase">Total Expenses</p>
                    <p className="text-lg font-bold text-rose-600">QAR {totalExpenses.toLocaleString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Pie Chart */}
                {data.length > 0 && (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200 dark:border-zinc-800">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Expense Breakdown</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart><Pie data={data} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie><Tooltip formatter={(v: any) => [`QAR ${Number(v).toLocaleString()}`, 'Amount']} /><Legend /></PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <tr><th className="px-5 py-3">Account</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-right">% of Total</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {loading ? <tr><td colSpan={3} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr> :
                             data.length === 0 ? <tr><td colSpan={3} className="px-5 py-12 text-center text-slate-400 italic">No expense data.</td></tr> :
                             data.map((d, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                            <div><div className="font-medium text-slate-700 dark:text-slate-200">{d.name}</div><div className="text-[10px] text-slate-400">{d.code}</div></div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-white">QAR {d.amount.toLocaleString()}</td>
                                    <td className="px-5 py-3 text-right text-slate-500">{totalExpenses > 0 ? ((d.amount / totalExpenses) * 100).toFixed(1) : 0}%</td>
                                </tr>
                            ))}
                        </tbody>
                        {data.length > 0 && <tfoot className="bg-slate-100 dark:bg-zinc-800 font-bold border-t-2"><tr><td className="px-5 py-3">Total</td><td className="px-5 py-3 text-right text-rose-600">QAR {totalExpenses.toLocaleString()}</td><td className="px-5 py-3 text-right">100%</td></tr></tfoot>}
                    </table>
                </div>
            </div>
        </div>
    );
};
