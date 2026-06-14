
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Cog, Plus, X, CheckCircle, XCircle, Edit2, Save, Loader } from 'lucide-react';

interface WorkCenter {
  id: string;
  name: string;
  code: string;
  capacity_per_day: number;
  cost_per_hour: number;
  is_active: boolean;
}

const EMPTY: Omit<WorkCenter, 'id'> = { name: '', code: '', capacity_per_day: 8, cost_per_hour: 0, is_active: true };

export const WorkCenters: React.FC = () => {
  const [items, setItems] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WorkCenter | null>(null);
  const [form, setForm] = useState<Omit<WorkCenter, 'id'>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const fetch = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('mrp_work_centers').select('*').order('name');
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setErr(''); setShowModal(true); };
  const openEdit = (wc: WorkCenter) => { setEditing(wc); setForm({ name: wc.name, code: wc.code, capacity_per_day: wc.capacity_per_day, cost_per_hour: wc.cost_per_hour, is_active: wc.is_active }); setErr(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    setSaving(true); setErr('');
    if (editing) {
      const { error } = await (supabase as any).from('mrp_work_centers').update(form).eq('id', editing.id);
      if (error) { setErr(error.message); setSaving(false); return; }
    } else {
      const { error } = await (supabase as any).from('mrp_work_centers').insert(form);
      if (error) { setErr(error.message); setSaving(false); return; }
    }
    setSaving(false); setShowModal(false); fetch();
  };

  const toggleActive = async (wc: WorkCenter) => {
    await (supabase as any).from('mrp_work_centers').update({ is_active: !wc.is_active }).eq('id', wc.id);
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-700 dark:text-white">Work Centers</h2>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> New Work Center
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <Cog className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No work centers yet</p>
          <p className="text-xs text-slate-400 mt-1">Add production stations, machines or assembly lines</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">Add Work Center</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map(wc => (
            <div key={wc.id} className={`relative p-5 bg-white dark:bg-slate-800 rounded-2xl border shadow-sm hover:shadow-md transition-all ${wc.is_active ? 'border-slate-200 dark:border-slate-700' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                    <Cog className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">{wc.name}</h3>
                    <p className="text-xs text-slate-400">{wc.code || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(wc)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggleActive(wc)} className={`p-1.5 rounded-lg transition-colors ${wc.is_active ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                    {wc.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
                  <p className="text-slate-400 mb-0.5">Capacity</p>
                  <p className="font-bold text-slate-700 dark:text-white">{wc.capacity_per_day} hrs/day</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
                  <p className="text-slate-400 mb-0.5">Cost/hr</p>
                  <p className="font-bold text-slate-700 dark:text-white">QAR {Number(wc.cost_per_hour).toFixed(2)}</p>
                </div>
              </div>
              {!wc.is_active && (
                <span className="absolute top-3 right-3 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">Inactive</span>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white">{editing ? 'Edit Work Center' : 'New Work Center'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {err && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{err}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Assembly Line A" className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Code</label>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="WC-001" className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Capacity (hrs/day)</label>
                  <input type="number" min="1" value={form.capacity_per_day} onChange={e => setForm(f => ({ ...f, capacity_per_day: Number(e.target.value) }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Cost / Hour (QAR)</label>
                  <input type="number" min="0" step="0.01" value={form.cost_per_hour} onChange={e => setForm(f => ({ ...f, cost_per_hour: Number(e.target.value) }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="wc_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                  <label htmlFor="wc_active" className="text-sm text-slate-600 dark:text-slate-300">Active</label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
