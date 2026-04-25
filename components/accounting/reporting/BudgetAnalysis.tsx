import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Target, Plus, Save, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Modal } from '../../ui/Modal';
import { useAuth } from '../../../contexts/AuthContext';

interface BudgetLine {
    account_id: string; account_code: string; account_name: string;
    budget_amount: number; actual_amount: number;
    variance: number; variance_pct: number;
}

export const BudgetAnalysis: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [budgetEntries, setBudgetEntries] = useState<{account_id:string; amount:number}[]>([]);
    const [year, setYear] = useState(new Date().getFullYear());
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchAccounts(); }, []);
    useEffect(() => { if (accounts.length > 0) fetchBudgetAnalysis(); }, [accounts, year]);

    const fetchAccounts = async () => {
        const { data } = await supabase.from('chart_of_accounts').select('id, code, name, type').in('type', ['Income', 'Expense']).order('code');
        setAccounts(data || []);
    };

    const fetchBudgetAnalysis = async () => {
        setLoading(true);
        try {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            // Fetch actuals from move lines
            const { data: actuals } = await supabase
                .from('accounting_move_lines')
                .select('account_id, debit, credit')
                .gte('date', startDate).lte('date', endDate);

            // Fetch budgets (from localStorage for now — DB table can be added later)
            const stored = localStorage.getItem(`budgets_${currentCompanyId}_${year}`);
            const budgets: Record<string, number> = stored ? JSON.parse(stored) : {};

            // Aggregate actuals by account
            const actualMap: Record<string, number> = {};
            (actuals || []).forEach((l: any) => {
                if (!actualMap[l.account_id]) actualMap[l.account_id] = 0;
                actualMap[l.account_id] += Number(l.debit) - Number(l.credit);
            });

            // Build lines for income/expense accounts
            const lines: BudgetLine[] = accounts.map(acc => {
                const budget = budgets[acc.id] || 0;
                const actual = Math.abs(actualMap[acc.id] || 0);
                const variance = budget - actual;
                const variance_pct = budget > 0 ? ((variance / budget) * 100) : 0;
                return { account_id: acc.id, account_code: acc.code, account_name: acc.name, budget_amount: budget, actual_amount: actual, variance, variance_pct };
            }).filter(l => l.budget_amount > 0 || l.actual_amount > 0);

            setBudgetLines(lines);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const openBudgetEntry = () => {
        const stored = localStorage.getItem(`budgets_${currentCompanyId}_${year}`);
        const budgets: Record<string, number> = stored ? JSON.parse(stored) : {};
        setBudgetEntries(accounts.map(a => ({ account_id: a.id, amount: budgets[a.id] || 0 })));
        setIsModalOpen(true);
    };

    const handleSaveBudgets = () => {
        setSaving(true);
        const budgets: Record<string, number> = {};
        budgetEntries.forEach(e => { if (e.amount > 0) budgets[e.account_id] = e.amount; });
        localStorage.setItem(`budgets_${currentCompanyId}_${year}`, JSON.stringify(budgets));
        setIsModalOpen(false);
        setSaving(false);
        fetchBudgetAnalysis();
    };

    const totalBudget = budgetLines.reduce((s, l) => s + l.budget_amount, 0);
    const totalActual = budgetLines.reduce((s, l) => s + l.actual_amount, 0);
    const totalVariance = totalBudget - totalActual;

    // Chart data (top 8)
    const chartData = budgetLines.slice(0, 8).map(l => ({ name: l.account_code, Budget: l.budget_amount, Actual: l.actual_amount }));

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Target className="w-6 h-6 text-indigo-600" />
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Budget Analysis</h2>
                </div>
                <div className="flex items-center gap-3">
                    <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-bold">
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>FY {y}</option>)}
                    </select>
                    <button onClick={openBudgetEntry} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors">
                        <Plus className="w-4 h-4" /> Set Budgets
                    </button>
                </div>
            </div>

            {/* KPI */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-400 uppercase">Total Budget</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">QAR {totalBudget.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-400 uppercase">Total Actual</p>
                    <p className="text-2xl font-bold text-violet-600 mt-1">QAR {totalActual.toLocaleString()}</p>
                </div>
                <div className={`rounded-xl p-5 border ${totalVariance >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800'}`}>
                    <p className="text-xs font-bold text-slate-400 uppercase">Variance</p>
                    <p className={`text-2xl font-bold mt-1 flex items-center gap-2 ${totalVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {totalVariance >= 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                        QAR {Math.abs(totalVariance).toLocaleString()}
                        <span className="text-sm font-medium">{totalVariance >= 0 ? 'Under' : 'Over'}</span>
                    </p>
                </div>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200 dark:border-zinc-800">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Budget vs Actual</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                            <Tooltip formatter={(v: any) => `QAR ${Number(v).toLocaleString()}`} />
                            <Legend /><Bar dataKey="Budget" fill="#6366f1" radius={[4,4,0,0]} /><Bar dataKey="Actual" fill="#f43f5e" radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr><th className="px-5 py-3">Account</th><th className="px-5 py-3 text-right">Budget</th><th className="px-5 py-3 text-right">Actual</th><th className="px-5 py-3 text-right">Variance</th><th className="px-5 py-3 text-right">%</th><th className="px-5 py-3 text-center">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr> :
                         budgetLines.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 italic">No budget data. Click "Set Budgets" to begin.</td></tr> :
                         budgetLines.map((l, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                                <td className="px-5 py-3"><div className="font-medium text-slate-700 dark:text-slate-200">{l.account_name}</div><div className="text-[10px] text-slate-400">{l.account_code}</div></td>
                                <td className="px-5 py-3 text-right font-mono">{l.budget_amount > 0 ? `QAR ${l.budget_amount.toLocaleString()}` : '—'}</td>
                                <td className="px-5 py-3 text-right font-mono font-bold">{l.actual_amount > 0 ? `QAR ${l.actual_amount.toLocaleString()}` : '—'}</td>
                                <td className={`px-5 py-3 text-right font-mono font-bold ${l.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{l.budget_amount > 0 ? `QAR ${Math.abs(l.variance).toLocaleString()}` : '—'}</td>
                                <td className={`px-5 py-3 text-right font-bold ${l.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{l.budget_amount > 0 ? `${l.variance_pct.toFixed(1)}%` : '—'}</td>
                                <td className="px-5 py-3 text-center">{l.budget_amount > 0 ? (l.variance >= 0 ? <span className="text-emerald-600 text-xs font-bold">✓ Under</span> : <span className="text-rose-600 text-xs font-bold">⚠ Over</span>) : <Minus className="w-4 h-4 text-slate-300 mx-auto" />}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Budget Entry Modal */}
            {isModalOpen && (
                <Modal title={`Set Budgets — FY ${year}`} onClose={() => setIsModalOpen(false)} maxWidth="max-w-2xl">
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        <p className="text-xs text-slate-500">Enter annual budget amounts for each account.</p>
                        {budgetEntries.map((entry, i) => {
                            const acc = accounts.find(a => a.id === entry.account_id);
                            if (!acc) return null;
                            return (
                                <div key={entry.account_id} className="flex items-center gap-3">
                                    <div className="flex-1"><span className="text-xs font-mono text-slate-400">{acc.code}</span> <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{acc.name}</span><span className="ml-2 text-[10px] text-slate-400 uppercase">({acc.type})</span></div>
                                    <input type="number" step="1" min="0" value={entry.amount || ''} onChange={e => { const n = [...budgetEntries]; n[i].amount = Number(e.target.value) || 0; setBudgetEntries(n); }}
                                        className="w-32 p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-right font-mono" placeholder="0" />
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={handleSaveBudgets} disabled={saving} className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                        <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Budgets'}
                    </button>
                </Modal>
            )}
        </div>
    );
};
