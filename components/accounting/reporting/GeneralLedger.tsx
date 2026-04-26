import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { BookOpen, Filter, Download } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

interface GLEntry {
    date: string; journal_name: string; reference: string;
    description: string; debit: number; credit: number;
    partner_name: string;
}

export const GeneralLedger: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [entries, setEntries] = useState<GLEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [companyCurrency, setCompanyCurrency] = useState('QAR');

    useEffect(() => { 
        if (currentCompanyId) {
            fetchAccounts(); 
            fetchCurrency(); 
        }
    }, [currentCompanyId]);

    useEffect(() => { 
        if (selectedAccount && currentCompanyId) fetchLedger(); 
    }, [selectedAccount, startDate, endDate, currentCompanyId]);

    const fetchAccounts = async () => {
        if (!currentCompanyId) return;
        const { data } = await supabase.from('chart_of_accounts')
            .select('id, code, name, type')
            .eq('company_id', currentCompanyId)
            .order('code');
        setAccounts(data || []);
    };

    const fetchCurrency = async () => {
        if (!currentCompanyId) return;
        try {
            const { data } = await supabase.from('companies').select('currency').eq('id', currentCompanyId).maybeSingle();
            if (data?.currency) setCompanyCurrency(data.currency);
        } catch (e) {
            console.error('Error fetching currency:', e);
        }
    };

    const fetchLedger = async () => {
        if (!selectedAccount || !currentCompanyId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('accounting_move_lines')
                .select(`
                    date, name, debit, credit,
                    move:accounting_moves(reference, notes),
                    journal:journals(name),
                    partner:accounting_partners(name)
                `)
                .eq('company_id', currentCompanyId)
                .eq('account_id', selectedAccount)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: true });

            if (error) throw error;
            setEntries((data || []).map((d: any) => ({
                date: d.date,
                journal_name: d.journal?.name || '',
                reference: d.move?.reference || '',
                description: d.name || d.move?.notes || '',
                debit: Number(d.debit) || 0,
                credit: Number(d.credit) || 0,
                partner_name: d.partner?.name || ''
            })));
        } catch (err: any) {
            console.error('GL fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (n: number) => {
        try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: companyCurrency }).format(n); }
        catch { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n); }
    };

    // Running balance
    let runningBalance = 0;
    const rows = entries.map(e => {
        runningBalance += e.debit - e.credit;
        return { ...e, balance: runningBalance };
    });

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    const selectedAcc = accounts.find(a => a.id === selectedAccount);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-violet-600" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">General Ledger</h2>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                <div className="flex-1 min-w-[250px]">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account</label>
                    <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm">
                        <option value="">— Select Account —</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.type})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">From</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">To</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                </div>
                <button onClick={fetchLedger} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                    <Filter className="w-4 h-4" /> Apply
                </button>
            </div>

            {/* Account Info */}
            {selectedAcc && (
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-violet-200 dark:border-violet-800/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">{selectedAcc.code} — {selectedAcc.name}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Type: {selectedAcc.type} · Period: {startDate} to {endDate}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase font-bold">Net Balance</p>
                            <p className={`text-xl font-bold ${runningBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(runningBalance)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Ledger Table */}
            {!selectedAccount ? (
                <div className="text-center py-16 text-slate-400 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Select an account to view its ledger</p>
                </div>
            ) : loading ? (
                <div className="text-center py-12 text-slate-500">Loading ledger entries...</div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Journal</th>
                                <th className="px-4 py-3">Reference</th>
                                <th className="px-4 py-3">Partner</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3 text-right">Debit</th>
                                <th className="px-4 py-3 text-right">Credit</th>
                                <th className="px-4 py-3 text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {rows.length === 0 ? (
                                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 italic">No transactions in this period.</td></tr>
                            ) : rows.map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{r.date}</td>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">{r.journal_name}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{r.reference || '—'}</td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.partner_name || '—'}</td>
                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{r.description || '—'}</td>
                                    <td className="px-4 py-3 text-right font-mono text-emerald-600">{r.debit > 0 ? fmt(r.debit) : '—'}</td>
                                    <td className="px-4 py-3 text-right font-mono text-rose-600">{r.credit > 0 ? fmt(r.credit) : '—'}</td>
                                    <td className={`px-4 py-3 text-right font-bold font-mono ${r.balance >= 0 ? 'text-slate-800 dark:text-white' : 'text-rose-600'}`}>{fmt(r.balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot className="bg-slate-100 dark:bg-zinc-800 font-bold border-t-2 border-slate-300 dark:border-zinc-600">
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-right uppercase text-xs tracking-wider text-slate-500">Totals</td>
                                    <td className="px-4 py-3 text-right font-mono text-emerald-700">{fmt(totalDebit)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-rose-700">{fmt(totalCredit)}</td>
                                    <td className={`px-4 py-3 text-right font-mono ${runningBalance >= 0 ? 'text-slate-800 dark:text-white' : 'text-rose-600'}`}>{fmt(runningBalance)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </div>
    );
};
