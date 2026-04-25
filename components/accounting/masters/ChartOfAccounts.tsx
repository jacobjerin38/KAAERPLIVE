import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Edit3, Trash2, ChevronRight, ChevronDown, Layers, ToggleLeft, ToggleRight } from 'lucide-react';
import { Modal } from '../../ui/Modal';

interface Account {
    id: string; code: string; name: string;
    type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
    parent_id: string | null; is_active: boolean;
    currency: string; description: string;
}

const TC: Record<string, string> = {
    Asset: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Liability: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    Equity: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    Income: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    Expense: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};
const TI: Record<string, string> = { Asset:'🏦', Liability:'📋', Equity:'💎', Income:'📈', Expense:'📉' };

export const ChartOfAccounts: React.FC = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Account | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['Asset','Liability','Equity','Income','Expense']));
    const [form, setForm] = useState({ code:'', name:'', type:'Asset', parent_id:'', is_active:true, currency:'QAR', description:'' });

    useEffect(() => { fetch_(); }, []);

    const fetch_ = async () => {
        setLoading(true);
        const { data } = await supabase.from('chart_of_accounts').select('*').order('code');
        setAccounts((data || []) as Account[]);
        setLoading(false);
    };

    const openCreate = () => { setEditing(null); setForm({ code:'', name:'', type:'Asset', parent_id:'', is_active:true, currency:'QAR', description:'' }); setIsModalOpen(true); };
    const openEdit = (a: Account) => { setEditing(a); setForm({ code:a.code, name:a.name, type:a.type, parent_id:a.parent_id||'', is_active:a.is_active!==false, currency:a.currency||'QAR', description:a.description||'' }); setIsModalOpen(true); };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.code || !form.name) return alert('Code and Name are required');
        const payload: any = { code:form.code, name:form.name, type:form.type, parent_id:form.parent_id||null, is_active:form.is_active, currency:form.currency, description:form.description };
        try {
            if (editing) { const { error } = await supabase.from('chart_of_accounts').update(payload).eq('id', editing.id); if (error) throw error; }
            else { const { error } = await supabase.from('chart_of_accounts').insert([payload]); if (error) throw error; }
            setIsModalOpen(false); fetch_();
        } catch (err: any) { alert('Error: ' + err.message); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this account? Accounts with posted transactions cannot be deleted.')) return;
        const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id);
        if (error) alert('Cannot delete: ' + error.message); else fetch_();
    };

    const toggle = (t: string) => { const n = new Set(expanded); if (n.has(t)) n.delete(t); else n.add(t); setExpanded(n); };

    const filtered = accounts.filter(a => {
        const ms = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase());
        const mt = !filterType || a.type === filterType;
        return ms && mt;
    });
    const grouped = ['Asset','Liability','Equity','Income','Expense'].map(t => ({ type:t, accounts:filtered.filter(a => a.type === t) })).filter(g => g.accounts.length > 0);
    const parents = accounts.filter(a => a.type === form.type);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Layers className="w-6 h-6 text-violet-600" />Chart of Accounts</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{accounts.length} accounts · {accounts.filter(a => a.is_active!==false).length} active</p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"><Plus className="w-4 h-4" /> New Account</button>
            </div>

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Search by code or name..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-medium">
                    <option value="">All Types</option>
                    {['Asset','Liability','Equity','Income','Expense'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            {loading ? <div className="text-center py-12 text-slate-500">Loading...</div> : grouped.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700">No accounts found.</div>
            ) : (
                <div className="space-y-4">
                    {grouped.map(g => (
                        <div key={g.type} className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                            <button onClick={() => toggle(g.type)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    {expanded.has(g.type) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                    <span className="text-lg">{TI[g.type]}</span>
                                    <h3 className="font-bold text-slate-800 dark:text-white">{g.type}</h3>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TC[g.type]}`}>{g.accounts.length}</span>
                                </div>
                            </button>
                            {expanded.has(g.type) && (
                                <div className="border-t border-slate-100 dark:border-zinc-800">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50/80 dark:bg-zinc-800/30"><tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            <th className="px-5 py-2.5">Code</th><th className="px-5 py-2.5">Account Name</th><th className="px-5 py-2.5">Currency</th><th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5 text-right">Actions</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                                            {g.accounts.map(acc => (
                                                <tr key={acc.id} className="group hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                    <td className="px-5 py-3"><span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded">{acc.code}</span></td>
                                                    <td className="px-5 py-3"><span className="font-medium text-slate-700 dark:text-slate-200">{acc.name}</span>{acc.description && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{acc.description}</p>}</td>
                                                    <td className="px-5 py-3 text-xs text-slate-500">{acc.currency || 'QAR'}</td>
                                                    <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${acc.is_active!==false ? 'text-emerald-600' : 'text-slate-400'}`}>{acc.is_active!==false ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}{acc.is_active!==false ? 'Active' : 'Inactive'}</span></td>
                                                    <td className="px-5 py-3 text-right"><div className="flex gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openEdit(acc)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"><Edit3 className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => handleDelete(acc.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <Modal title={editing ? 'Edit Account' : 'New Account'} onClose={() => setIsModalOpen(false)}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code *</label><input required value={form.code} onChange={e => setForm({...form, code:e.target.value})} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-mono" placeholder="e.g. 1001" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type *</label><select value={form.type} onChange={e => setForm({...form, type:e.target.value, parent_id:''})} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm">{['Asset','Liability','Equity','Income','Expense'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        </div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name *</label><input required value={form.name} onChange={e => setForm({...form, name:e.target.value})} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" placeholder="e.g. Cash in Hand" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parent Account</label><select value={form.parent_id} onChange={e => setForm({...form, parent_id:e.target.value})} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"><option value="">— None —</option>{parents.filter(a => a.id !== editing?.id).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Currency</label><input value={form.currency} onChange={e => setForm({...form, currency:e.target.value})} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" /></div>
                        </div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label><textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} rows={2} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm resize-none" /></div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                            <button type="button" onClick={() => setForm({...form, is_active:!form.is_active})} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{form.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <button className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20">{editing ? 'Update Account' : 'Create Account'}</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
