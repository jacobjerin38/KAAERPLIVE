import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { BookOpen, Plus, X, Save, Loader, Edit2, CheckCircle, XCircle } from 'lucide-react';

interface Account { id: string; name: string; code: string; }
interface Journal {
  id: string; name: string; code: string; type: string;
  sequence_prefix?: string; default_account_id?: string;
  account_name?: string; account_code?: string;
}

const JOURNAL_TYPES = ['sale','purchase','cash','bank','general'] as const;
const TYPE_COLORS: Record<string, string> = {
  sale:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  purchase: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  cash:     'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  bank:     'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  general:  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};
const TYPE_ICONS: Record<string, string> = { sale:'🧾', purchase:'🛒', cash:'💵', bank:'🏦', general:'📔' };
const EMPTY = { name:'', code:'', type:'general', sequence_prefix:'', default_account_id:'' };

export const Journals: React.FC = () => {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState<Journal | null>(null);
  const [form, setForm]         = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: j }, { data: a }] = await Promise.all([
      (supabase as any).from('journals').select('*, chart_of_accounts!default_account_id(name,code)').order('type').order('name'),
      (supabase as any).from('chart_of_accounts').select('id,name,code').order('code'),
    ]);
    setJournals((j || []).map((x: any) => ({ ...x, account_name: x.chart_of_accounts?.name, account_code: x.chart_of_accounts?.code })));
    setAccounts(a || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setErr(''); setShowModal(true); };
  const openEdit = (j: Journal) => {
    setEditing(j);
    setForm({ name: j.name, code: j.code, type: j.type, sequence_prefix: j.sequence_prefix || '', default_account_id: j.default_account_id || '' });
    setErr(''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { setErr('Name and code are required.'); return; }
    setSaving(true); setErr('');
    const payload = { name: form.name, code: form.code.toUpperCase(), type: form.type, sequence_prefix: form.sequence_prefix || null, default_account_id: form.default_account_id || null };
    const { error } = editing
      ? await (supabase as any).from('journals').update(payload).eq('id', editing.id)
      : await (supabase as any).from('journals').insert(payload);
    if (error) { setErr(error.message); setSaving(false); return; }
    setSaving(false); setShowModal(false); fetchAll();
  };

  const deleteJournal = async (id: string) => {
    if (!confirm('Delete this journal? This cannot be undone.')) return;
    const { error } = await (supabase as any).from('journals').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    fetchAll();
  };

  // Group by type
  const grouped = JOURNAL_TYPES.reduce((acc, t) => {
    acc[t] = journals.filter(j => j.type === t);
    return acc;
  }, {} as Record<string, Journal[]>);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-700 dark:text-white">Journals</h2>
          <p className="text-xs text-slate-400">Configure accounting journals for each transaction type</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors">
          <Plus className="w-4 h-4" /> New Journal
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : journals.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No journals configured</p>
          <p className="text-xs text-slate-400 mt-1">Add Sale, Purchase, Cash, Bank, or General journals</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700">Add Journal</button>
        </div>
      ) : (
        <div className="space-y-4">
          {JOURNAL_TYPES.filter(t => grouped[t].length > 0).map(type => (
            <div key={type}>
              <p className="text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                <span>{TYPE_ICONS[type]}</span>{type} Journals
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {grouped[type].map(journal => (
                  <div key={journal.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-white text-sm">{journal.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{journal.code}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(journal)} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteJournal(journal.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-semibold capitalize ${TYPE_COLORS[journal.type]}`}>{journal.type}</span>
                      {journal.sequence_prefix && <span className="text-slate-400">Prefix: <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{journal.sequence_prefix}</span></span>}
                    </div>
                    {journal.account_name && (
                      <p className="text-xs text-slate-400 mt-2">Account: <span className="font-medium text-slate-600 dark:text-slate-300">{journal.account_code} — {journal.account_name}</span></p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-violet-500" />{editing ? 'Edit Journal' : 'New Journal'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {err && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{err}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Journal Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Customer Invoices" className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Short Code *</label>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="INV" maxLength={8} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {JOURNAL_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Sequence Prefix</label>
                  <input value={form.sequence_prefix} onChange={e => setForm(f => ({ ...f, sequence_prefix: e.target.value }))} placeholder="e.g. INV/" className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Default Account</label>
                  <select value={form.default_account_id} onChange={e => setForm(f => ({ ...f, default_account_id: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">None</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Journal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
