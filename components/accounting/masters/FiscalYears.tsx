import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Calendar, Plus, X, Save, Loader, Lock, Unlock, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

interface Period {
  id: string; name: string; code: string; start_date: string; end_date: string; status: string;
  fiscal_year_id: string;
}
interface FiscalYear {
  id: string; name: string; start_date: string; end_date: string; is_closed: boolean;
  periods?: Period[];
}

const PERIOD_STATUS_COLOR: Record<string, string> = {
  open:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  locked: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const EMPTY_FY  = { name:'', start_date:'', end_date:'' };
const EMPTY_PER = { name:'', code:'', start_date:'', end_date:'', status:'open', fiscal_year_id:'' };

export const FiscalYears: React.FC = () => {
  const [years, setYears]         = useState<FiscalYear[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string|null>(null);
  const [showFYModal, setShowFYModal]   = useState(false);
  const [showPerModal, setShowPerModal] = useState(false);
  const [editingFY, setEditingFY] = useState<FiscalYear|null>(null);
  const [fyForm, setFyForm]       = useState<typeof EMPTY_FY>(EMPTY_FY);
  const [perForm, setPerForm]     = useState<typeof EMPTY_PER>(EMPTY_PER);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: fy } = await (supabase as any).from('fiscal_years').select('*').order('start_date', { ascending: false });
    const { data: per } = await (supabase as any).from('accounting_periods').select('*').order('start_date');
    const perByFY: Record<string, Period[]> = {};
    (per || []).forEach((p: Period) => {
      if (!perByFY[p.fiscal_year_id]) perByFY[p.fiscal_year_id] = [];
      perByFY[p.fiscal_year_id].push(p);
    });
    setYears((fy || []).map((y: FiscalYear) => ({ ...y, periods: perByFY[y.id] || [] })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNewFY  = () => { setEditingFY(null); setFyForm(EMPTY_FY); setErr(''); setShowFYModal(true); };
  const openEditFY = (y: FiscalYear) => { setEditingFY(y); setFyForm({ name: y.name, start_date: y.start_date, end_date: y.end_date }); setErr(''); setShowFYModal(true); };
  const openNewPer = (fyId: string) => { setPerForm({ ...EMPTY_PER, fiscal_year_id: fyId }); setErr(''); setShowPerModal(true); };

  const saveFY = async () => {
    if (!fyForm.name || !fyForm.start_date || !fyForm.end_date) { setErr('All fields required.'); return; }
    setSaving(true); setErr('');
    const payload = { name: fyForm.name, start_date: fyForm.start_date, end_date: fyForm.end_date };
    const { error } = editingFY
      ? await (supabase as any).from('fiscal_years').update(payload).eq('id', editingFY.id)
      : await (supabase as any).from('fiscal_years').insert({ ...payload, is_closed: false });
    if (error) { setErr(error.message); setSaving(false); return; }
    setSaving(false); setShowFYModal(false); fetchAll();
  };

  const savePeriod = async () => {
    if (!perForm.name || !perForm.start_date || !perForm.end_date) { setErr('Name and dates required.'); return; }
    setSaving(true); setErr('');
    const { error } = await (supabase as any).from('accounting_periods').insert({
      name: perForm.name, code: perForm.code || perForm.name, start_date: perForm.start_date,
      end_date: perForm.end_date, status: perForm.status, fiscal_year_id: perForm.fiscal_year_id,
    });
    if (error) { setErr(error.message); setSaving(false); return; }
    setSaving(false); setShowPerModal(false); fetchAll();
  };

  const togglePeriodStatus = async (period: Period) => {
    const next = period.status === 'open' ? 'closed' : period.status === 'closed' ? 'locked' : 'open';
    await (supabase as any).from('accounting_periods').update({ status: next }).eq('id', period.id);
    fetchAll();
  };

  const closeFY = async (y: FiscalYear) => {
    if (!confirm(`Close fiscal year "${y.name}"? This will lock all its periods.`)) return;
    await (supabase as any).from('fiscal_years').update({ is_closed: true }).eq('id', y.id);
    await (supabase as any).from('accounting_periods').update({ status: 'locked' }).eq('fiscal_year_id', y.id);
    fetchAll();
  };

  // Auto-generate periods for a fiscal year (monthly)
  const autoGenPeriods = async (y: FiscalYear) => {
    if (!confirm(`Auto-generate monthly periods for "${y.name}"?`)) return;
    const start = new Date(y.start_date);
    const end   = new Date(y.end_date);
    const periods = [];
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const pEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const label = cur.toLocaleString('en', { month: 'short', year: 'numeric' });
      periods.push({
        fiscal_year_id: y.id, name: label,
        code: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`,
        start_date: cur.toISOString().slice(0, 10),
        end_date: (pEnd > end ? end : pEnd).toISOString().slice(0, 10),
        status: 'open',
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    await (supabase as any).from('accounting_periods').insert(periods);
    fetchAll();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-700 dark:text-white">Fiscal Years &amp; Periods</h2>
          <p className="text-xs text-slate-400">Manage accounting years and period locks</p>
        </div>
        <button onClick={openNewFY} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors">
          <Plus className="w-4 h-4" /> New Fiscal Year
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : years.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No fiscal years defined</p>
          <button onClick={openNewFY} className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700">Create Fiscal Year</button>
        </div>
      ) : (
        <div className="space-y-3">
          {years.map(y => (
            <div key={y.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              {/* Year header */}
              <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => setExpanded(expanded === y.id ? null : y.id)}>
                <div className={`p-2 rounded-xl ${y.is_closed ? 'bg-red-100 dark:bg-red-900/30 text-red-500' : 'bg-green-100 dark:bg-green-900/30 text-green-600'}`}>
                  {y.is_closed ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    {y.name}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${y.is_closed ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                      {y.is_closed ? 'Closed' : 'Active'}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">{y.start_date} → {y.end_date} · {(y.periods || []).length} periods</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {!y.is_closed && (
                    <>
                      <button onClick={() => autoGenPeriods(y)} title="Auto-generate monthly periods" className="px-2.5 py-1 text-xs font-semibold text-violet-600 border border-violet-300 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors">Auto Periods</button>
                      <button onClick={() => openNewPer(y.id)} className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">+ Period</button>
                      <button onClick={() => closeFY(y)} className="px-2.5 py-1 text-xs font-semibold border border-red-300 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1"><Lock className="w-3 h-3"/>Close Year</button>
                    </>
                  )}
                  <button onClick={() => openEditFY(y)} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors text-xs">Edit</button>
                  {expanded === y.id ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
                </div>
              </div>

              {/* Periods */}
              {expanded === y.id && (y.periods || []).length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-4 pb-4 pt-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Accounting Periods</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {(y.periods || []).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                        <div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-white">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.start_date} → {p.end_date}</p>
                        </div>
                        <button onClick={() => !y.is_closed && togglePeriodStatus(p)} disabled={y.is_closed}
                          className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${PERIOD_STATUS_COLOR[p.status]} ${!y.is_closed ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}>
                          {p.status}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {expanded === y.id && (y.periods || []).length === 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 text-xs text-slate-400 italic">
                  No periods yet. Click "Auto Periods" to generate monthly periods or "+ Period" to add manually.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fiscal Year Modal */}
      {showFYModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white">{editingFY ? 'Edit Fiscal Year' : 'New Fiscal Year'}</h3>
              <button onClick={() => setShowFYModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              {err && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{err}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Name *</label>
                <input value={fyForm.name} onChange={e => setFyForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. FY 2025-2026" className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Start Date *</label>
                  <input type="date" value={fyForm.start_date} onChange={e => setFyForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">End Date *</label>
                  <input type="date" value={fyForm.end_date} onChange={e => setFyForm(f => ({ ...f, end_date: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"/>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setShowFYModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveFY} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60">
                {saving ? <Loader className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Period Modal */}
      {showPerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white">Add Accounting Period</h3>
              <button onClick={() => setShowPerModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              {err && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{err}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Period Name *</label>
                  <input value={perForm.name} onChange={e => setPerForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jan 2026" className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Start Date *</label>
                  <input type="date" value={perForm.start_date} onChange={e => setPerForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">End Date *</label>
                  <input type="date" value={perForm.end_date} onChange={e => setPerForm(f => ({ ...f, end_date: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Status</label>
                  <select value={perForm.status} onChange={e => setPerForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="locked">Locked</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setShowPerModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={savePeriod} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60">
                {saving ? <Loader className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Add Period
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
