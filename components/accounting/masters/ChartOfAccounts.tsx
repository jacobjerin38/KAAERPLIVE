import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Edit3, Trash2, ChevronRight, ChevronDown, Layers, ToggleLeft, ToggleRight, UploadCloud, Download, Loader2 } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { PrintButton } from '../../ui/PrintButton';
import { read, utils, write } from 'xlsx';

interface Account {
    id: string; code: string; name: string;
    type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
    subtype: string | null;
    parent_id: string | null; 
    is_group?: boolean;
    balance_type?: string;
    is_active: boolean;
    currency_id: string | null; description: string;
}

interface Currency {
    id: string; code: string; name: string;
}

const TC: Record<string, string> = {
    Asset: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Liability: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    Equity: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    Income: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    Expense: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};
const TI: Record<string, string> = { Asset:'🏦', Liability:'📋', Equity:'💎', Income:'📈', Expense:'📉' };

const getCategoryOptions = (type: string) => {
    switch(type) {
        case 'Asset': return ['Current Assets', 'Fixed Assets', 'Cash', 'Bank', 'Receivable', 'Other'];
        case 'Liability': return ['Current Liabilities', 'Long-term Liabilities', 'Payable', 'Other'];
        case 'Equity': return ['Owner\'s Equity', 'Retained Earnings', 'Equity', 'Other'];
        case 'Income': return ['Operating Revenue', 'Non-Operating Revenue', 'Revenue', 'Other'];
        case 'Expense': return ['Direct Expenses', 'Indirect Expenses', 'COGS', 'Other'];
        default: return ['Other'];
    }
};

const getBalanceType = (type: string) => {
    return ['Asset', 'Expense'].includes(type) ? 'Debit balance' : 'Credit balance';
};

export const ChartOfAccounts: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Account | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['Asset','Liability','Equity','Income','Expense']));
    const [form, setForm] = useState({ 
        code:'', name:'', type:'Asset', category:'Current Assets', parent_id:'', is_group: false, balance_type: 'Debit balance', is_active:true, currency_id:'', description:'' 
    });
    const [showImportModal, setShowImportModal] = useState(false);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        if (currentCompanyId) {
            fetch_();
            fetchCurrencies();
        }
    }, [currentCompanyId]);

    const fetchCurrencies = async () => {
        if (!currentCompanyId) return;
        const { data } = await (supabase as any).from('financial_masters_currencies').select('*').eq('company_id', currentCompanyId);
        setCurrencies(data || []);
    };

    const fetch_ = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        const { data } = await supabase.from('accounting_chart_of_accounts').select('*').eq('company_id', currentCompanyId).order('code');
        setAccounts((data || []) as unknown as Account[]);
        setLoading(false);
    };

    const openCreate = () => { 
        setEditing(null); 
        setForm({ code:'', name:'', type:'Asset', category: getCategoryOptions('Asset')[0], parent_id:'', is_group: false, balance_type: getBalanceType('Asset'), is_active:true, currency_id:'', description:'' }); 
        setIsModalOpen(true); 
    };
    const openEdit = (a: Account) => { 
        setEditing(a); 
        setForm({ 
            code:a.code, 
            name:a.name, 
            type:a.type, 
            category:a.subtype || getCategoryOptions(a.type)[0], 
            parent_id:a.parent_id||'', 
            is_group: !!a.is_group,
            balance_type: a.balance_type || getBalanceType(a.type),
            is_active:a.is_active!==false, 
            currency_id:a.currency_id||'', 
            description:a.description||'' 
        }); 
        setIsModalOpen(true); 
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId) return alert('No company context');
        if (!form.code || !form.name) return alert('Code and Name are required');
        
        const payload: any = { 
            code: form.code, 
            name: form.name, 
            type: form.type, 
            subtype: form.category, 
            parent_id: form.parent_id || null, 
            is_group: form.is_group,
            balance_type: form.balance_type || getBalanceType(form.type),
            is_active: form.is_active, 
            account_group_id: null, 
            description: form.description, 
            company_id: currentCompanyId 
        };

        try {
            let err: any = null;
            if (editing) { 
                const res = await supabase.from('accounting_chart_of_accounts').update(payload).eq('id', editing.id); 
                err = res.error;
            } else { 
                const res = await supabase.from('accounting_chart_of_accounts').insert([payload]); 
                err = res.error;
            }

            if (err && (err.message?.includes('description') || err.message?.includes('parent_id') || err.message?.includes('schema cache'))) {
                const safePayload = { ...payload };
                delete safePayload.description;
                delete safePayload.parent_id;
                
                if (editing) {
                    const res2 = await supabase.from('accounting_chart_of_accounts').update(safePayload).eq('id', editing.id);
                    err = res2.error;
                } else {
                    const res2 = await supabase.from('accounting_chart_of_accounts').insert([safePayload]);
                    err = res2.error;
                }
            }

            if (err) throw err;

            setIsModalOpen(false); 
            fetch_();
        } catch (err: any) { alert('Error: ' + err.message); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this account? Accounts with posted transactions cannot be deleted.')) return;
        const { error } = await supabase.from('accounting_chart_of_accounts').delete().eq('id', id);
        if (error) alert('Cannot delete: ' + error.message); else fetch_();
    };

    const downloadTemplate = () => {
        const template = [
            {
                'Account Code': '1010',
                'Type': 'Assets',
                'Category': 'Current Assets',
                'Account Name': 'Petty Cash',
                'Balance Type': 'Debit balance',
                'Parent Account': 'Cash on Hand'
            }
        ];

        const ws = utils.json_to_sheet(template);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Chart of Accounts');
        const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
        
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chart_of_accounts_template.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!currentCompanyId) return alert('No company context');
        setImporting(true);
        try {
            const dataBuffer = await file.arrayBuffer();
            const workbook = read(dataBuffer);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = utils.sheet_to_json(sheet) as any[];

            if (!jsonData || jsonData.length === 0) {
                alert('File is empty or invalid.');
                setImporting(false);
                return;
            }

            const accountsToInsert = jsonData.map(row => {
                const rawCode = row['Account Code'] || row['AccountCode'] || row['Code'] || row['code'] || '';
                const rawName = row['Account Name'] || row['AccountName'] || row['Name'] || row['name'] || '';
                let rawType = String(row['Type'] || row['type'] || row['Account Type'] || 'Asset').trim();
                
                if (rawType.toLowerCase().startsWith('asset')) rawType = 'Asset';
                else if (rawType.toLowerCase().startsWith('liabilit')) rawType = 'Liability';
                else if (rawType.toLowerCase().startsWith('equit')) rawType = 'Equity';
                else if (rawType.toLowerCase().startsWith('incom') || rawType.toLowerCase().startsWith('revenu')) rawType = 'Income';
                else if (rawType.toLowerCase().startsWith('expens') || rawType.toLowerCase().startsWith('cost')) rawType = 'Expense';

                const type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense' = 
                    ['Asset', 'Liability', 'Equity', 'Income', 'Expense'].includes(rawType)
                        ? (rawType as any)
                        : 'Asset';
                        
                const categoryVal = String(row['Category'] || row['category'] || row['Subtype'] || row['subtype'] || getCategoryOptions(type)[0]).trim();
                const balType = String(row['Balance Type'] || row['balance_type'] || getBalanceType(type)).trim();

                const isActive = row['Is Active'] !== undefined 
                    ? (String(row['Is Active']).toLowerCase() === 'true' || row['Is Active'] === 1 || row['Is Active'] === true)
                    : true;

                const parentIdentifier = String(row['Parent Account'] || row['ParentAccount'] || row['Parent Account Code'] || row['Parent'] || '').trim();

                return {
                    company_id: currentCompanyId,
                    code: String(rawCode).trim(),
                    name: String(rawName).trim(),
                    type: type,
                    subtype: categoryVal,
                    balance_type: balType,
                    description: String(row['Description'] || row['description'] || '').trim(),
                    is_active: isActive,
                    parent_identifier: parentIdentifier
                };
            }).filter(a => a.code && a.name);

            if (accountsToInsert.length === 0) {
                alert('No valid accounts found. Ensure the "Account Code" / "Code" and "Account Name" / "Name" columns are populated.');
                setImporting(false);
                return;
            }

            const existingAccounts = [...accounts];
            const finalPayloads = accountsToInsert.map(acc => {
                let parentId: string | null = null;
                if (acc.parent_identifier) {
                    const match = existingAccounts.find(e => 
                        e.code.toLowerCase() === acc.parent_identifier.toLowerCase() || 
                        e.name.toLowerCase() === acc.parent_identifier.toLowerCase()
                    );
                    if (match) parentId = match.id;
                }
                const { parent_identifier, ...cleanPayload } = acc;
                return { ...cleanPayload, parent_id: parentId };
            });

            let { error: insertError } = await supabase
                .from('accounting_chart_of_accounts')
                .insert(finalPayloads);

            if (insertError && (insertError.message?.includes('description') || insertError.message?.includes('parent_id') || insertError.message?.includes('schema cache'))) {
                const safePayloads = finalPayloads.map(p => {
                    const { description, parent_id, ...rest } = p as any;
                    return rest;
                });
                const res2 = await supabase.from('accounting_chart_of_accounts').insert(safePayloads);
                insertError = res2.error;
            }

            if (insertError) {
                throw insertError;
            }

            alert(`Successfully imported ${finalPayloads.length} accounts from Excel.`);
            setShowImportModal(false);
            fetch_();
        } catch (error: any) {
            console.error(error);
            alert('Error importing accounts: ' + error.message);
        } finally {
            setImporting(false);
            e.target.value = '';
        }
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
                    <p className="text-sm text-slate-500 mt-0.5">
                        {accounts.length} accounts ({accounts.filter(a => a.is_group).length} Groups, {accounts.filter(a => !a.is_group).length} Posting) · {accounts.filter(a => a.is_active!==false).length} active
                    </p>
                </div>
                <div className="flex items-center gap-3 no-print">
                    <PrintButton />
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                        <UploadCloud className="w-4 h-4 text-indigo-500" /> Import
                    </button>
                    <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"><Plus className="w-4 h-4" /> New Account</button>
                </div>
            </div>

            <div className="flex flex-wrap gap-3 no-print">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Search by code or name..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-medium">
                    <option value="">All Types</option>
                    {['Asset','Liability','Equity','Income','Expense'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            {loading ? <div className="text-center py-12 text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />Loading accounts...</div> : grouped.length === 0 ? (
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
                                <div className="border-t border-slate-100 dark:border-zinc-800 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50/80 dark:bg-zinc-800/30"><tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            <th className="px-5 py-2.5">Code</th>
                                            <th className="px-5 py-2.5">Account Name</th>
                                            <th className="px-5 py-2.5">Nature</th>
                                            <th className="px-5 py-2.5">Category</th>
                                            <th className="px-5 py-2.5">Balance Type</th>
                                            <th className="px-5 py-2.5">Parent Account</th>
                                            <th className="px-5 py-2.5">Status</th>
                                            <th className="px-5 py-2.5 text-right">Actions</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                                            {g.accounts.map(acc => {
                                                const parentAcc = accounts.find(a => a.id === acc.parent_id);
                                                
                                                return (
                                                <tr key={acc.id} className={`group hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors ${acc.is_group ? 'bg-slate-50/40 dark:bg-zinc-800/20 font-bold' : ''}`}>
                                                    <td className="px-5 py-3">
                                                        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${acc.is_group ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'}`}>
                                                            {acc.code}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <div className={`flex items-center gap-2 ${acc.parent_id ? 'pl-4 border-l-2 border-slate-200 dark:border-zinc-700' : ''}`}>
                                                            <span className="font-medium text-slate-700 dark:text-slate-200">{acc.name}</span>
                                                        </div>
                                                        {acc.description && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{acc.description}</p>}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        {acc.is_group ? (
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                                📁 Header / Group
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                                📄 Posting
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-xs text-slate-500">{acc.subtype || '-'}</td>
                                                    <td className="px-5 py-3">
                                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${acc.balance_type?.toLowerCase().includes('credit') ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                                                            {acc.balance_type || getBalanceType(acc.type)}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-xs font-medium text-slate-500">
                                                        {parentAcc ? `${parentAcc.code} - ${parentAcc.name}` : '—'}
                                                    </td>
                                                    <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${acc.is_active!==false ? 'text-emerald-600' : 'text-slate-400'}`}>{acc.is_active!==false ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}{acc.is_active!==false ? 'Active' : 'Inactive'}</span></td>
                                                    <td className="px-5 py-3 text-right"><div className="flex gap-1.5 justify-end">
                                                        <button onClick={() => openEdit(acc)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Edit Account"><Edit3 className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => handleDelete(acc.id)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Delete Account"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div></td>
                                                </tr>
                                            )})}
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
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code *</label>
                                <input required value={form.code} onChange={e => setForm({...form, code:e.target.value})} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-mono" placeholder="e.g. 1010" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type *</label>
                                <select 
                                    value={form.type} 
                                    onChange={e => setForm({
                                        ...form, 
                                        type:e.target.value, 
                                        category: getCategoryOptions(e.target.value)[0], 
                                        balance_type: getBalanceType(e.target.value),
                                        parent_id:''
                                    })} 
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                                >
                                    {['Asset','Liability','Equity','Income','Expense'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                                <select 
                                    value={form.category} 
                                    onChange={e => setForm({...form, category:e.target.value})} 
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                                >
                                    {getCategoryOptions(form.type).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Balance Type</label>
                                <select
                                    value={form.balance_type}
                                    onChange={e => setForm({...form, balance_type: e.target.value})}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium"
                                >
                                    <option value="Debit balance">Debit balance</option>
                                    <option value="Credit balance">Credit balance</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account Name *</label>
                            <input required value={form.name} onChange={e => setForm({...form, name:e.target.value})} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" placeholder="e.g. Cash in Bank - QIIB" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parent Account</label>
                                <select value={form.parent_id} onChange={e => setForm({...form, parent_id:e.target.value})} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm">
                                    <option value="">— None (Top Level) —</option>
                                    {parents.filter(a => a.id !== editing?.id).map(a => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name} {a.is_group ? '(Group)' : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col justify-end">
                                <label className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={form.is_group}
                                        onChange={e => setForm({...form, is_group: e.target.checked})}
                                        className="w-4 h-4 text-indigo-600 rounded"
                                    />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">
                                        📁 Header / Group Account
                                    </span>
                                </label>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                            <textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} rows={2} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm resize-none" />
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                            <button type="button" onClick={() => setForm({...form, is_active:!form.is_active})} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{form.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <button className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20">{editing ? 'Update Account' : 'Create Account'}</button>
                    </form>
                </Modal>
            )}

            {showImportModal && (
                <Modal title="Import Chart of Accounts from Excel" onClose={() => setShowImportModal(false)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Upload an Excel file (.xlsx or .xls) containing your Chart of Accounts structure.
                        </p>

                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-2">
                            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                                <Download className="w-4 h-4" /> Download Sample Template
                            </h4>
                            <p className="text-xs text-indigo-700 dark:text-indigo-400">
                                Download a pre-formatted Excel template matching the required columns.
                            </p>
                            <button
                                onClick={downloadTemplate}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm inline-flex items-center gap-1.5"
                            >
                                <Download className="w-3.5 h-3.5" /> Download Template (.xlsx)
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Select Excel File</label>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                                disabled={importing}
                                className="w-full p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                            />
                        </div>

                        {importing && (
                            <div className="flex items-center justify-center py-4 gap-2 text-indigo-600 font-medium text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" /> Importing accounts...
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};
