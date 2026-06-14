import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Building2, Plus, X, Save, Loader, Edit2, Trash2,
  Search, ChevronDown, ChevronUp, TrendingDown,
  AlertTriangle, CheckCircle2, Archive, Play,
  Calendar, DollarSign, BarChart3, Tag
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface CoAAccount { id: string; name: string; code: string; }
interface DepLine    { id: string; period_date: string; amount: number; notes?: string; }
interface Asset {
  id: string; name: string; asset_code?: string; category: string;
  description?: string; purchase_date: string; purchase_value: number;
  salvage_value: number; useful_life_years: number; depreciation_method: string;
  accumulated_depreciation: number; net_book_value: number;
  status: string; disposal_date?: string; disposal_value?: number;
  location?: string; supplier?: string; warranty_expiry?: string;
  account_id?: string; depreciation_account_id?: string;
}
interface Summary {
  total_assets: number; total_cost: number;
  total_depreciation: number; total_nbv: number; disposed: number;
}

/* ─── Constants ─────────────────────────────────────────── */
const CATEGORIES   = ['equipment','vehicle','furniture','building','land','computer','machinery','other'];
const DEP_METHODS  = ['straight_line'];
const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active:   { label:'Active',   color:'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',   icon: CheckCircle2 },
  disposed: { label:'Disposed', color:'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',           icon: Archive },
  idle:     { label:'Idle',     color:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',   icon: AlertTriangle },
};
const EMPTY_FORM = {
  name:'', asset_code:'', category:'equipment', description:'',
  purchase_date:'', purchase_value:0, salvage_value:0,
  useful_life_years:5, depreciation_method:'straight_line',
  location:'', supplier:'', warranty_expiry:'',
  account_id:'', depreciation_account_id:'',
};
const fmtQAR = (n: number) => `QAR ${Number(n).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const pct    = (a: number, b: number) => b > 0 ? Math.min(100, (a/b)*100).toFixed(0) : '0';

/* ─── Component ─────────────────────────────────────────── */
export const FixedAssets: React.FC = () => {
  const [assets, setAssets]         = useState<Asset[]>([]);
  const [accounts, setAccounts]     = useState<CoAAccount[]>([]);
  const [summary, setSummary]       = useState<Summary|null>(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState<'all'|'active'|'disposed'>('active');
  const [filterCat, setFilterCat]   = useState('all');
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Asset|null>(null);
  const [form, setForm]             = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');
  const [expanded, setExpanded]     = useState<string|null>(null);
  const [depCache, setDepCache]     = useState<Record<string,DepLine[]>>({});
  // Depreciation run modal
  const [showDepModal, setShowDepModal]   = useState(false);
  const [depPeriod, setDepPeriod]         = useState('');
  const [depRunning, setDepRunning]       = useState(false);
  const [depResult, setDepResult]         = useState<string|null>(null);
  // Dispose modal
  const [showDisposeModal, setShowDisposeModal] = useState(false);
  const [disposeAsset, setDisposeAsset]   = useState<Asset|null>(null);
  const [disposeDate, setDisposeDate]     = useState('');
  const [disposeValue, setDisposeValue]   = useState(0);
  const [disposing, setDisposing]         = useState(false);

  /* ─── Fetch ──────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: a }, { data: acc }, { data: sum }] = await Promise.all([
      (supabase as any).from('fixed_assets').select('*').order('purchase_date', { ascending: false }),
      (supabase as any).from('chart_of_accounts').select('id,name,code').order('code'),
      (supabase as any).rpc('rpc_fixed_assets_summary'),
    ]);
    setAssets(a || []);
    setAccounts(acc || []);
    if (sum) setSummary(sum);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadDepHistory = async (assetId: string) => {
    if (depCache[assetId]) return;
    const { data } = await (supabase as any)
      .from('fixed_asset_depreciation')
      .select('*').eq('asset_id', assetId).order('period_date', { ascending: false });
    setDepCache(prev => ({ ...prev, [assetId]: data || [] }));
  };

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id); await loadDepHistory(id);
  };

  /* ─── CRUD ───────────────────────────────────────────── */
  const openNew = () => {
    setEditing(null); setForm({ ...EMPTY_FORM, purchase_date: new Date().toISOString().slice(0,10) });
    setErr(''); setShowModal(true);
  };
  const openEdit = (a: Asset) => {
    setEditing(a);
    setForm({
      name: a.name, asset_code: a.asset_code||'', category: a.category,
      description: a.description||'', purchase_date: a.purchase_date,
      purchase_value: a.purchase_value, salvage_value: a.salvage_value,
      useful_life_years: a.useful_life_years, depreciation_method: a.depreciation_method,
      location: a.location||'', supplier: a.supplier||'',
      warranty_expiry: a.warranty_expiry||'',
      account_id: a.account_id||'', depreciation_account_id: a.depreciation_account_id||'',
    });
    setErr(''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim())      { setErr('Asset name is required.'); return; }
    if (!form.purchase_date)    { setErr('Purchase date is required.'); return; }
    if (form.purchase_value<=0) { setErr('Purchase value must be > 0.'); return; }
    setSaving(true); setErr('');
    const payload = {
      name: form.name, asset_code: form.asset_code||null, category: form.category,
      description: form.description||null, purchase_date: form.purchase_date,
      purchase_value: form.purchase_value, salvage_value: form.salvage_value,
      useful_life_years: form.useful_life_years, depreciation_method: form.depreciation_method,
      location: form.location||null, supplier: form.supplier||null,
      warranty_expiry: form.warranty_expiry||null,
      account_id: form.account_id||null, depreciation_account_id: form.depreciation_account_id||null,
    };
    const { error } = editing
      ? await (supabase as any).from('fixed_assets').update(payload).eq('id', editing.id)
      : await (supabase as any).from('fixed_assets').insert(payload);
    if (error) { setErr(error.message); setSaving(false); return; }
    setSaving(false); setShowModal(false); fetchAll();
  };

  const deleteAsset = async (id: string) => {
    if (!confirm('Delete this asset? All depreciation records will be removed.')) return;
    await (supabase as any).from('fixed_assets').delete().eq('id', id);
    setDepCache(prev => { const n={...prev}; delete n[id]; return n; });
    fetchAll();
  };

  /* ─── Depreciation run ───────────────────────────────── */
  const runDepreciation = async () => {
    if (!depPeriod) return;
    setDepRunning(true); setDepResult(null);
    const { data } = await (supabase as any).rpc('rpc_run_depreciation', { p_period_date: depPeriod });
    setDepResult(data?.success
      ? `✅ Depreciation posted for ${data.assets_processed} asset(s) for period ${depPeriod}.`
      : `❌ ${data?.message || 'Failed.'}`);
    setDepRunning(false);
    setDepCache({});
    fetchAll();
  };

  /* ─── Dispose ────────────────────────────────────────── */
  const openDispose = (a: Asset) => {
    setDisposeAsset(a);
    setDisposeDate(new Date().toISOString().slice(0,10));
    setDisposeValue(0);
    setShowDisposeModal(true);
  };
  const handleDispose = async () => {
    if (!disposeAsset || !disposeDate) return;
    setDisposing(true);
    const { data } = await (supabase as any).rpc('rpc_dispose_asset', {
      p_asset_id: disposeAsset.id, p_disposal_date: disposeDate, p_disposal_value: disposeValue,
    });
    if (!data?.success) { alert(data?.message||'Failed.'); setDisposing(false); return; }
    setDisposing(false); setShowDisposeModal(false); fetchAll();
  };

  /* ─── Derived ────────────────────────────────────────── */
  const annualDep = (a: Asset) => {
    const depBase = a.purchase_value - a.salvage_value;
    return a.useful_life_years > 0 ? depBase / a.useful_life_years : 0;
  };
  const monthlyDep = (a: Asset) => annualDep(a) / 12;

  const categories = ['all', ...Array.from(new Set(assets.map(a => a.category)))];
  const filtered = assets.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterCat !== 'all' && a.category !== filterCat) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) &&
        !(a.asset_code||'').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const s = summary || { total_assets:0, total_cost:0, total_depreciation:0, total_nbv:0, disposed:0 };

  /* ─── KPI cards ──────────────────────────────────────── */
  const KPI = [
    { label:'Active Assets',   value: s.total_assets,       fmt: String,  color:'text-indigo-600 dark:text-indigo-400',  bg:'bg-indigo-50 dark:bg-indigo-900/20',  icon: Building2 },
    { label:'Total Cost',      value: s.total_cost,         fmt: fmtQAR,  color:'text-blue-600 dark:text-blue-400',      bg:'bg-blue-50 dark:bg-blue-900/20',      icon: DollarSign },
    { label:'Accum. Dep.',     value: s.total_depreciation, fmt: fmtQAR,  color:'text-amber-600 dark:text-amber-400',    bg:'bg-amber-50 dark:bg-amber-900/20',    icon: TrendingDown },
    { label:'Net Book Value',  value: s.total_nbv,          fmt: fmtQAR,  color:'text-emerald-600 dark:text-emerald-400',bg:'bg-emerald-50 dark:bg-emerald-900/20',icon: BarChart3 },
    { label:'Disposed',        value: s.disposed,           fmt: String,  color:'text-red-500 dark:text-red-400',        bg:'bg-red-50 dark:bg-red-900/20',        icon: Archive },
  ];

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-700 dark:text-white">Fixed Assets</h2>
          <p className="text-xs text-slate-400">Asset register, depreciation schedules &amp; disposal management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setDepPeriod(new Date().toISOString().slice(0,10)); setDepResult(null); setShowDepModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-amber-400 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors">
            <Play className="w-3.5 h-3.5"/>Run Depreciation
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4"/> New Asset
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {KPI.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <div className={`inline-flex p-2 rounded-xl mb-2 ${k.bg}`}><Icon className={`w-4 h-4 ${k.color}`}/></div>
              <p className={`text-sm font-bold ${k.color} truncate`}>{k.fmt(k.value as any)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assets..."
            className="pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"/>
        </div>
        {(['all','active','disposed'] as const).map(s => (
          <button key={s} onClick={()=>setFilterStatus(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${filterStatus===s?'bg-indigo-600 text-white':'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
            {s==='all'?'All Status':s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
          className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize">
          {categories.map(c=><option key={c} value={c}>{c==='all'?'All Categories':c}</option>)}
        </select>
      </div>

      {/* Asset list */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader className="w-6 h-6 animate-spin text-indigo-500"/></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600"/>
          <p className="text-slate-500 dark:text-slate-400 font-medium">No assets found</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Add Asset</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(asset => {
            const SC  = STATUS_CFG[asset.status] || STATUS_CFG.active;
            const SIcon = SC.icon;
            const dep   = depCache[asset.id] || [];
            const depPct = Number(pct(asset.accumulated_depreciation, asset.purchase_value - asset.salvage_value));
            const isExpanded = expanded === asset.id;
            return (
              <div key={asset.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="p-4 flex items-start gap-3">
                  {/* Status badge */}
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 mt-0.5 ${SC.color}`}>
                    <SIcon className="w-3 h-3"/>{SC.label}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-white text-sm">{asset.name}</span>
                      {asset.asset_code && <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{asset.asset_code}</span>}
                      <span className="text-xs capitalize text-slate-400 flex items-center gap-1"><Tag className="w-3 h-3"/>{asset.category}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                      <span><span className="text-slate-600 dark:text-slate-300 font-semibold">{fmtQAR(asset.purchase_value)}</span> cost</span>
                      <span><span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmtQAR(asset.net_book_value)}</span> NBV</span>
                      <span><span className="text-amber-500 font-semibold">{fmtQAR(monthlyDep(asset))}</span>/mo dep.</span>
                      {asset.location && <span>📍 {asset.location}</span>}
                    </div>
                    {/* Depreciation progress bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width:`${depPct}%` }}/>
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">{depPct}% dep.</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {asset.status === 'active' && (
                      <>
                        <button onClick={()=>openEdit(asset)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={()=>openDispose(asset)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Dispose"><Archive className="w-3.5 h-3.5"/></button>
                      </>
                    )}
                    <button onClick={()=>deleteAsset(asset.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>toggleExpand(asset.id)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                      {isExpanded?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
                    </button>
                  </div>
                </div>

                {/* Expanded: details + dep history */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 px-4 pb-4 pt-3 grid sm:grid-cols-2 gap-4">
                    {/* Details */}
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Asset Details</p>
                      <dl className="space-y-1 text-xs">
                        {[
                          ['Purchase Date',    asset.purchase_date],
                          ['Purchase Value',   fmtQAR(asset.purchase_value)],
                          ['Salvage Value',    fmtQAR(asset.salvage_value)],
                          ['Useful Life',      `${asset.useful_life_years} years`],
                          ['Dep. Method',      'Straight-Line'],
                          ['Annual Dep.',      fmtQAR(annualDep(asset))],
                          ['Accum. Dep.',      fmtQAR(asset.accumulated_depreciation)],
                          ['Net Book Value',   fmtQAR(asset.net_book_value)],
                          ['Supplier',         asset.supplier||'—'],
                          ['Warranty Expiry',  asset.warranty_expiry||'—'],
                          asset.disposal_date ? ['Disposal Date', asset.disposal_date] : null,
                          asset.disposal_value != null ? ['Disposal Value', fmtQAR(asset.disposal_value)] : null,
                        ].filter(Boolean).map(([k,v])=>(
                          <div key={k as string} className="flex justify-between gap-2">
                            <dt className="text-slate-400">{k}</dt>
                            <dd className="text-slate-700 dark:text-slate-200 font-medium text-right">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    {/* Depreciation history */}
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Depreciation History</p>
                      {dep.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No depreciation posted yet. Use "Run Depreciation" to post monthly entries.</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead><tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                              <th className="pb-1 text-left">Period</th>
                              <th className="pb-1 text-right">Amount</th>
                            </tr></thead>
                            <tbody>
                              {dep.map(d=>(
                                <tr key={d.id} className="border-b border-slate-50 dark:border-slate-700/30 text-slate-600 dark:text-slate-300">
                                  <td className="py-1">{d.period_date}</td>
                                  <td className="py-1 text-right font-semibold text-amber-600 dark:text-amber-400">{fmtQAR(d.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500"/>{editing?'Edit Asset':'New Fixed Asset'}
              </h3>
              <button onClick={()=>setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {err && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{err}</div>}

              {/* Section: Identity */}
              <p className="text-xs font-bold text-slate-400 uppercase">Asset Identity</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Asset Name *</label>
                  <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Company Vehicle - Toyota Hilux"
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Asset Code</label>
                  <input value={form.asset_code} onChange={e=>setForm(f=>({...f,asset_code:e.target.value.toUpperCase()}))} placeholder="FA-001"
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Category</label>
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize">
                    {CATEGORIES.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Location</label>
                  <input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Head Office"
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Supplier</label>
                  <input value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} placeholder="Vendor name"
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>

              {/* Section: Valuation */}
              <p className="text-xs font-bold text-slate-400 uppercase pt-1">Valuation &amp; Depreciation</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Purchase Date *</label>
                  <input type="date" value={form.purchase_date} onChange={e=>setForm(f=>({...f,purchase_date:e.target.value}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Warranty Expiry</label>
                  <input type="date" value={form.warranty_expiry} onChange={e=>setForm(f=>({...f,warranty_expiry:e.target.value}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Purchase Value (QAR) *</label>
                  <input type="number" min="0" step="0.01" value={form.purchase_value} onChange={e=>setForm(f=>({...f,purchase_value:Number(e.target.value)}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Salvage Value (QAR)</label>
                  <input type="number" min="0" step="0.01" value={form.salvage_value} onChange={e=>setForm(f=>({...f,salvage_value:Number(e.target.value)}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Useful Life (years)</label>
                  <input type="number" min="1" step="1" value={form.useful_life_years} onChange={e=>setForm(f=>({...f,useful_life_years:Number(e.target.value)}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Method</label>
                  <select value={form.depreciation_method} onChange={e=>setForm(f=>({...f,depreciation_method:e.target.value}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="straight_line">Straight-Line (SL)</option>
                  </select>
                </div>
              </div>

              {/* Live preview */}
              {form.purchase_value > 0 && form.useful_life_years > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 text-xs flex gap-4 flex-wrap">
                  <span className="text-slate-500 dark:text-slate-400">Depreciable: <span className="font-bold text-slate-700 dark:text-white">{fmtQAR(form.purchase_value - form.salvage_value)}</span></span>
                  <span className="text-slate-500 dark:text-slate-400">Annual: <span className="font-bold text-amber-600 dark:text-amber-400">{fmtQAR((form.purchase_value - form.salvage_value) / form.useful_life_years)}</span></span>
                  <span className="text-slate-500 dark:text-slate-400">Monthly: <span className="font-bold text-amber-600 dark:text-amber-400">{fmtQAR((form.purchase_value - form.salvage_value) / form.useful_life_years / 12)}</span></span>
                </div>
              )}

              {/* Accounts */}
              <p className="text-xs font-bold text-slate-400 uppercase pt-1">Accounting</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Asset Account</label>
                  <select value={form.account_id} onChange={e=>setForm(f=>({...f,account_id:e.target.value}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">None</option>
                    {accounts.map(a=><option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Accumulated Dep. Account</label>
                  <select value={form.depreciation_account_id} onChange={e=>setForm(f=>({...f,depreciation_account_id:e.target.value}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">None</option>
                    {accounts.map(a=><option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
              <button onClick={()=>setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
                {saving?<Loader className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}
                {editing?'Update Asset':'Create Asset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Run Depreciation Modal ──────────────────────────── */}
      {showDepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><TrendingDown className="w-5 h-5 text-amber-500"/>Run Monthly Depreciation</h3>
              <button onClick={()=>setShowDepModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">Posts straight-line depreciation for all active assets for the selected period. Already-posted periods are skipped automatically.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Depreciation Period</label>
                <input type="date" value={depPeriod} onChange={e=>setDepPeriod(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"/>
              </div>
              {depResult && (
                <div className={`p-3 rounded-lg text-sm ${depResult.startsWith('✅')?'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800':'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
                  {depResult}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
              <button onClick={()=>setShowDepModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Close</button>
              <button onClick={runDepreciation} disabled={depRunning||!depPeriod}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-60">
                {depRunning?<Loader className="w-4 h-4 animate-spin"/>:<Play className="w-4 h-4"/>} Post Depreciation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dispose Modal ───────────────────────────────────── */}
      {showDisposeModal && disposeAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Archive className="w-5 h-5 text-red-500"/>Dispose Asset</h3>
              <button onClick={()=>setShowDisposeModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                Disposing: <strong>{disposeAsset.name}</strong><br/>
                <span className="text-xs">NBV at disposal: {fmtQAR(disposeAsset.net_book_value)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Disposal Date</label>
                  <input type="date" value={disposeDate} onChange={e=>setDisposeDate(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Proceeds (QAR)</label>
                  <input type="number" min="0" step="0.01" value={disposeValue} onChange={e=>setDisposeValue(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                </div>
              </div>
              {disposeValue > 0 && (
                <p className={`text-xs font-semibold ${disposeValue >= disposeAsset.net_book_value?'text-green-600 dark:text-green-400':'text-red-500 dark:text-red-400'}`}>
                  {disposeValue >= disposeAsset.net_book_value ? '✅ Gain' : '⚠️ Loss'} on disposal: {fmtQAR(Math.abs(disposeValue - disposeAsset.net_book_value))}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
              <button onClick={()=>setShowDisposeModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleDispose} disabled={disposing||!disposeDate}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
                {disposing?<Loader className="w-4 h-4 animate-spin"/>:<Archive className="w-4 h-4"/>} Confirm Disposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
