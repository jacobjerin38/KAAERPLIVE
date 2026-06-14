import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Percent, Plus, X, Save, Loader, Edit2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface Account { id: string; name: string; code: string; }
interface Tax {
  id: string; name: string; type: string; scope: string;
  amount: number; is_active: boolean;
  account_id?: string; refund_account_id?: string;
  account_name?: string; refund_account_name?: string;
}

const TAX_TYPES  = ['percentage','fixed'] as const;
const TAX_SCOPES = ['sale','purchase','both'] as const;
const EMPTY = { name:'', type:'percentage', scope:'both', amount:0, account_id:'', refund_account_id:'', is_active:true };

export const Taxes: React.FC = () => {
  const [taxes, setTaxes]       = useState<Tax[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState<Tax | null>(null);
  const [form, setForm]         = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: a }] = await Promise.all([
      (supabase as any).from('taxes')
        .select('*, chart_of_accounts!account_id(name,code), chart_of_accounts!refund_account_id(name,code)')
        .order('name'),
      (supabase as any).from('chart_of_accounts').select('id,name,code').order('code'),
    ]);
    setTaxes((t || []).map((x: any) => ({
      ...x,
      account_name: x.chart_of_accounts?.name,
      refund_account_name: x['chart_of_accounts1']?.name ?? x.chart_of_accounts?.name,
    })));
    setAccounts(a || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew  = () => { setEditing(null); setForm(EMPTY); setErr(''); setShowModal(true); };
  const openEdit = (t: Tax) => {
    setEditing(t);
    setForm({ name: t.name, type: t.type, scope: t.scope, amount: t.amount, account_id: t.account_id || '', refund_account_id: t.refund_account_id || '', is_active: t.is_active });
    setErr(''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    setSaving(true); setErr('');
    const payload = { name: form.name, type: form.type, scope: form.scope, amount: form.amount, account_id: form.account_id || null, refund_account_id: form.refund_account_id || null, is_active: form.is_active };
    const { error } = editing
      ? await (supabase as any).from('taxes').update(payload).eq('id', editing.id)
      : await (supabase as any).from('taxes').insert(payload);
    if (error) { setErr(error.message); setSaving(false); return; }
    setSaving(false); setShowModal(false); fetchAll();
  };

  const toggleActive = async (tax: Tax) => {
    await (supabase as any).from('taxes').update({ is_active: !tax.is_active }).eq('id', tax.id);
    fetchAll();
  };

  const scopeColor: Record<string, string> = {
    sale:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    purchase: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    both:     'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-700 dark:text-white">Taxes</h2>
          <p className="text-xs text-slate-400">Configure VAT, WHT and other tax rates</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors">
          <Plus className="w-4 h-4" /> New Tax
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : taxes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <Percent className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No taxes configured</p>
          <p className="text-xs text-slate-400 mt-1">Add VAT (5%), withholding tax, or custom rates</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700">Add Tax</button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Scope</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3">Tax Account</th>
                <th className="p-3 text-center">Active</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {taxes.map(tax => (
                <tr key={tax.id} className="text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="p-3 font-semibold">{tax.name}</td>
                  <td className="p-3 capitalize">{tax.type}</td>
                  <td className="p-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${scopeColor[tax.scope]}`}>{tax.scope}</span></td>
                  <td className="p-3 text-right font-bold">{tax.type === 'percentage' ? `${tax.amount}%` : `QAR ${Number(tax.amount).toFixed(2)}`}</td>
                  <td className="p-3 text-xs text-slate-400">{tax.account_name || '—'}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => toggleActive(tax)}>
                      {tax.is_active
                        ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => openEdit(tax)} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Percent className="w-5 h-5 text-violet-500" />{editing ? 'Edit Tax' : 'New Tax'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {err && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{err}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tax Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. VAT 5%" className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {TAX_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Scope</label>
                  <select value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {TAX_SCOPES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{form.type === 'percentage' ? 'Rate (%)' : 'Fixed Amount (QAR)'}</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-violet-600" /> Active
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tax Account (Payable/Receivable)</label>
                <select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">None</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Refund Account</label>
                <select value={form.refund_account_id} onChange={e => setForm(f => ({ ...f, refund_account_id: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">Same as Tax Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Tax
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
