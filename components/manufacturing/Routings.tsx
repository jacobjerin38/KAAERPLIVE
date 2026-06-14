import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  GitBranch, Plus, X, Save, Loader, Edit2, Trash2,
  Search, ChevronDown, ChevronUp, ArrowUpDown,
  CheckCircle, XCircle, Clock, Cog
} from 'lucide-react';

interface WorkCenter { id: string; name: string; code: string; cost_per_hour: number; }
interface Item        { id: string; name: string; sku?: string; }

interface RoutingLine {
  id?: string;
  sequence: number;
  operation_name: string;
  work_center_id: string;
  duration_hours: number;
  notes: string;
  work_center_name?: string;
}

interface Routing {
  id: string;
  name: string;
  code?: string;
  product_id?: string;
  notes?: string;
  is_active: boolean;
  product_name?: string;
  lines?: RoutingLine[];
}

const EMPTY_FORM = { name: '', code: '', product_id: '', notes: '', is_active: true };
const EMPTY_LINE = (): RoutingLine => ({ sequence: 10, operation_name: '', work_center_id: '', duration_hours: 1, notes: '' });

export const Routings: React.FC = () => {
  const [routings, setRoutings]       = useState<Routing[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [items, setItems]             = useState<Item[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<Routing | null>(null);
  const [form, setForm]               = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [lines, setLines]             = useState<RoutingLine[]>([EMPTY_LINE()]);
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState('');
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [linesCache, setLinesCache]   = useState<Record<string, RoutingLine[]>>({});

  // ── Fetch ────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: r }, { data: wc }, { data: it }] = await Promise.all([
      (supabase as any).from('mrp_routing').select('*, item_master!product_id(name,sku)').order('name'),
      (supabase as any).from('mrp_work_centers').select('id,name,code,cost_per_hour').eq('is_active', true).order('name'),
      (supabase as any).from('item_master').select('id,name,sku').order('name'),
    ]);
    setRoutings((r || []).map((x: any) => ({ ...x, product_name: x.item_master?.name })));
    setWorkCenters(wc || []);
    setItems(it || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Load lines lazily ────────────────────────────────────
  const loadLines = async (routingId: string) => {
    if (linesCache[routingId]) return;
    const { data } = await (supabase as any)
      .from('mrp_routing_lines')
      .select('*, mrp_work_centers!work_center_id(name)')
      .eq('routing_id', routingId)
      .order('sequence');
    const mapped = (data || []).map((d: any) => ({
      ...d, work_center_name: d.mrp_work_centers?.name
    }));
    setLinesCache(prev => ({ ...prev, [routingId]: mapped }));
  };

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    await loadLines(id);
  };

  // ── Line editing helpers ─────────────────────────────────
  const addLine    = () => {
    const maxSeq = lines.reduce((m, l) => Math.max(m, l.sequence), 0);
    setLines(l => [...l, { ...EMPTY_LINE(), sequence: maxSeq + 10 }]);
  };
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof RoutingLine, val: any) => {
    setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: val } : ln));
  };
  const moveUp   = (i: number) => { if (i === 0) return; setLines(l => { const a = [...l]; [a[i-1],a[i]] = [a[i],a[i-1]]; return a.map((x,idx)=>({...x,sequence:(idx+1)*10})); }); };
  const moveDown = (i: number) => { if (i === lines.length-1) return; setLines(l => { const a = [...l]; [a[i],a[i+1]] = [a[i+1],a[i]]; return a.map((x,idx)=>({...x,sequence:(idx+1)*10})); }); };

  // ── Modal open ───────────────────────────────────────────
  const openNew = () => {
    setEditing(null); setForm(EMPTY_FORM);
    setLines([EMPTY_LINE()]); setErr(''); setShowModal(true);
  };

  const openEdit = async (r: Routing) => {
    setEditing(r);
    setForm({ name: r.name, code: r.code || '', product_id: r.product_id || '', notes: r.notes || '', is_active: r.is_active });
    setErr('');
    // Load existing lines
    const { data } = await (supabase as any)
      .from('mrp_routing_lines')
      .select('*, mrp_work_centers!work_center_id(name)')
      .eq('routing_id', r.id)
      .order('sequence');
    setLines((data || []).map((d: any) => ({ ...d, work_center_name: d.mrp_work_centers?.name })));
    setShowModal(true);
  };

  // ── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Routing name is required.'); return; }
    const validLines = lines.filter(l => l.operation_name.trim());
    if (!validLines.length) { setErr('Add at least one operation step.'); return; }
    setSaving(true); setErr('');

    const payload = {
      name:       form.name,
      code:       form.code || null,
      product_id: form.product_id || null,
      notes:      form.notes || null,
      is_active:  form.is_active,
    };

    let routingId = editing?.id;
    if (editing) {
      await (supabase as any).from('mrp_routing').update(payload).eq('id', editing.id);
      // Delete old lines and re-insert
      await (supabase as any).from('mrp_routing_lines').delete().eq('routing_id', editing.id);
    } else {
      const { data, error } = await (supabase as any).from('mrp_routing').insert(payload).select('id').single();
      if (error) { setErr(error.message); setSaving(false); return; }
      routingId = data.id;
    }

    // Insert lines
    const linePayload = validLines.map((l, idx) => ({
      routing_id:     routingId,
      sequence:       (idx + 1) * 10,
      operation_name: l.operation_name,
      work_center_id: l.work_center_id || null,
      duration_hours: l.duration_hours,
      notes:          l.notes || null,
    }));
    const { error: lineErr } = await (supabase as any).from('mrp_routing_lines').insert(linePayload);
    if (lineErr) { setErr(lineErr.message); setSaving(false); return; }

    // Invalidate cache
    if (routingId) setLinesCache(prev => { const n = { ...prev }; delete n[routingId!]; return n; });
    setSaving(false); setShowModal(false); fetchAll();
  };

  const toggleActive = async (r: Routing) => {
    await (supabase as any).from('mrp_routing').update({ is_active: !r.is_active }).eq('id', r.id);
    fetchAll();
  };

  const deleteRouting = async (id: string) => {
    if (!confirm('Delete this routing? All operation steps will be removed.')) return;
    await (supabase as any).from('mrp_routing').delete().eq('id', id);
    setLinesCache(prev => { const n = { ...prev }; delete n[id]; return n; });
    fetchAll();
  };

  // ── Computed ─────────────────────────────────────────────
  const totalDuration = lines.reduce((s, l) => s + (Number(l.duration_hours) || 0), 0);
  const totalCost     = lines.reduce((s, l) => {
    const wc = workCenters.find(w => w.id === l.work_center_id);
    return s + (Number(l.duration_hours) || 0) * (wc?.cost_per_hour || 0);
  }, 0);

  const filtered = routings.filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.code || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.product_name || '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <h2 className="text-lg font-bold text-slate-700 dark:text-white">Routings</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)} placeholder="Search routings..."
              className="pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-52"
            />
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap">
            <Plus className="w-4 h-4" /> New Routing
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Routings', value: routings.length, color: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Active',         value: routings.filter(r => r.is_active).length, color: 'text-green-600 dark:text-green-400' },
          { label: 'With Product',   value: routings.filter(r => r.product_id).length, color: 'text-violet-600 dark:text-violet-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <GitBranch className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No routings found</p>
          <p className="text-xs text-slate-400 mt-1">Routings define the sequence of manufacturing operations</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Create Routing</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(routing => {
            const cached = linesCache[routing.id] || [];
            const totalHrs = cached.reduce((s, l) => s + Number(l.duration_hours), 0);
            return (
              <div key={routing.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                {/* Header row */}
                <div className="p-4 flex items-start gap-3">
                  <div className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${routing.is_active ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-white text-sm">{routing.name}</span>
                      {routing.code && <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{routing.code}</span>}
                      {!routing.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-700">Inactive</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {routing.product_name ? `📦 ${routing.product_name}` : 'No product linked'}
                      {expanded === routing.id && cached.length > 0 && (
                        <span className="ml-3 text-indigo-400"><Clock className="w-3 h-3 inline mr-0.5" />{totalHrs.toFixed(1)} hrs total</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(routing)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleActive(routing)} title={routing.is_active ? 'Deactivate' : 'Activate'}
                      className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors">
                      {routing.is_active ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => deleteRouting(routing.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleExpand(routing.id)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                      {expanded === routing.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Operations table */}
                {expanded === routing.id && (
                  <div className="border-t border-slate-100 dark:border-slate-700 px-4 pb-4 pt-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Operations</p>
                    {cached.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No operations defined. Click edit to add steps.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                              <th className="pb-1.5 text-left w-8">#</th>
                              <th className="pb-1.5 text-left">Operation</th>
                              <th className="pb-1.5 text-left">Work Center</th>
                              <th className="pb-1.5 text-right">Duration</th>
                              <th className="pb-1.5 text-right">Est. Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cached.map((op, i) => {
                              const wc = workCenters.find(w => w.id === op.work_center_id);
                              const cost = Number(op.duration_hours) * (wc?.cost_per_hour || 0);
                              return (
                                <tr key={i} className="border-b border-slate-50 dark:border-slate-700/30 text-slate-600 dark:text-slate-300">
                                  <td className="py-1.5 text-slate-400 font-mono">{op.sequence}</td>
                                  <td className="py-1.5 font-medium">{op.operation_name}</td>
                                  <td className="py-1.5">
                                    {op.work_center_name
                                      ? <span className="flex items-center gap-1"><Cog className="w-3 h-3 text-indigo-400" />{op.work_center_name}</span>
                                      : <span className="text-slate-400">—</span>}
                                  </td>
                                  <td className="py-1.5 text-right">{Number(op.duration_hours).toFixed(1)} hr</td>
                                  <td className="py-1.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                    {cost > 0 ? `QAR ${cost.toFixed(2)}` : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="text-slate-500 dark:text-slate-400 font-bold border-t border-slate-200 dark:border-slate-700">
                              <td colSpan={3} className="pt-2 text-right text-xs uppercase">Total</td>
                              <td className="pt-2 text-right">{totalHrs.toFixed(1)} hr</td>
                              <td className="pt-2 text-right text-emerald-600 dark:text-emerald-400">
                                QAR {cached.reduce((s, l) => { const wc = workCenters.find(w => w.id === l.work_center_id); return s + Number(l.duration_hours) * (wc?.cost_per_hour || 0); }, 0).toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                    {routing.notes && <p className="text-xs text-slate-400 mt-2 italic">Notes: {routing.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-indigo-500" />
                {editing ? 'Edit Routing' : 'New Routing'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {/* Modal body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {err && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{err}</div>}

              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Routing Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard Assembly"
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Code</label>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. RT-001"
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Linked Product</label>
                  <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">None</option>
                    {items.map(it => <option key={it.id} value={it.id}>{it.name}{it.sku ? ` (${it.sku})` : ''}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes..."
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer mt-1">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-indigo-600" /> Active
                  </label>
                </div>
              </div>

              {/* Operations */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Operations / Steps</p>
                  <button onClick={addLine} className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold">
                    <Plus className="w-3 h-3" /> Add Step
                  </button>
                </div>

                {lines.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-400 text-xs">
                    No operations yet. Click "Add Step".
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lines.map((line, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-mono text-slate-400 w-6">{(i+1)*10}</span>
                          <input
                            value={line.operation_name} onChange={e => updateLine(i, 'operation_name', e.target.value)}
                            placeholder="Operation name *"
                            className="flex-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                          />
                          {/* Move buttons */}
                          <button onClick={() => moveUp(i)} disabled={i===0} className="p-1 text-slate-400 hover:text-indigo-500 disabled:opacity-30 rounded transition-colors"><ChevronUp className="w-3.5 h-3.5"/></button>
                          <button onClick={() => moveDown(i)} disabled={i===lines.length-1} className="p-1 text-slate-400 hover:text-indigo-500 disabled:opacity-30 rounded transition-colors"><ChevronDown className="w-3.5 h-3.5"/></button>
                          <button onClick={() => removeLine(i)} className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>
                        <div className="flex gap-2 items-center pl-8">
                          <div className="flex-1">
                            <select value={line.work_center_id} onChange={e => updateLine(i, 'work_center_id', e.target.value)}
                              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                              <option value="">No work center</option>
                              {workCenters.map(wc => <option key={wc.id} value={wc.id}>{wc.name} (QAR {wc.cost_per_hour}/hr)</option>)}
                            </select>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400 flex-shrink-0"/>
                            <input type="number" min="0" step="0.5" value={line.duration_hours} onChange={e => updateLine(i, 'duration_hours', Number(e.target.value))}
                              className="w-20 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"/>
                            <span className="text-xs text-slate-400 flex-shrink-0">hrs</span>
                          </div>
                          {line.work_center_id && (
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 w-20 text-right flex-shrink-0">
                              QAR {(Number(line.duration_hours) * (workCenters.find(w => w.id === line.work_center_id)?.cost_per_hour || 0)).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals */}
                {lines.length > 0 && (
                  <div className="flex justify-end gap-6 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Total time: <span className="font-bold text-slate-700 dark:text-white">{totalDuration.toFixed(1)} hrs</span>
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Est. cost: <span className="font-bold text-emerald-600 dark:text-emerald-400">QAR {totalCost.toFixed(2)}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editing ? 'Update Routing' : 'Create Routing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
