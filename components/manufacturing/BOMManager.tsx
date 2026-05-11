
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Box, Plus, X, ChevronDown, ChevronUp, Trash2, Save, Loader, Search, CheckCircle, AlertTriangle } from 'lucide-react';

interface BOMLine { id?: string; item_id: string; quantity: number; uom: string; item_name?: string; }
interface BOM { id: string; name: string; product_id: string; quantity: number; is_active: boolean; is_default: boolean; product_name?: string; lines?: BOMLine[]; }
interface Item { id: string; name: string; sku?: string; }

const EMPTY_FORM = { name: '', product_id: '', quantity: 1, is_active: true, is_default: false };

export const BOMManager: React.FC = () => {
  const [boms, setBoms] = useState<BOM[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBOM, setEditingBOM] = useState<BOM | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [lines, setLines] = useState<BOMLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  const fetchItems = useCallback(async () => {
    const { data } = await (supabase as any).from('item_master').select('id, name, sku').order('name');
    setItems(data || []);
  }, []);

  const fetchBOMs = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('mrp_bom')
      .select('*, item_master!product_id(name)')
      .order('created_at', { ascending: false });
    setBoms((data || []).map((d: any) => ({ ...d, product_name: d.item_master?.name })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchBOMs(); fetchItems(); }, [fetchBOMs, fetchItems]);

  const loadLines = async (bomId: string) => {
    const { data } = await (supabase as any)
      .from('mrp_bom_lines')
      .select('*, item_master!item_id(name)')
      .eq('bom_id', bomId)
      .order('created_at');
    return (data || []).map((d: any) => ({ ...d, item_name: d.item_master?.name }));
  };

  const toggleExpand = async (bomId: string) => {
    if (expanded === bomId) { setExpanded(null); return; }
    setExpanded(bomId);
    const loadedLines = await loadLines(bomId);
    setBoms(prev => prev.map(b => b.id === bomId ? { ...b, lines: loadedLines } : b));
  };

  const openNew = () => {
    setEditingBOM(null);
    setForm(EMPTY_FORM);
    setLines([{ item_id: '', quantity: 1, uom: 'Pcs' }]);
    setErr('');
    setShowModal(true);
  };

  const openEdit = async (bom: BOM) => {
    setEditingBOM(bom);
    setForm({ name: bom.name, product_id: bom.product_id, quantity: bom.quantity, is_active: bom.is_active, is_default: bom.is_default });
    const loaded = await loadLines(bom.id);
    setLines(loaded.length > 0 ? loaded : [{ item_id: '', quantity: 1, uom: 'Pcs' }]);
    setErr('');
    setShowModal(true);
  };

  const addLine = () => setLines(l => [...l, { item_id: '', quantity: 1, uom: 'Pcs' }]);
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof BOMLine, value: any) =>
    setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line));

  const handleSave = async () => {
    if (!form.name.trim() || !form.product_id) { setErr('Name and product are required.'); return; }
    const validLines = lines.filter(l => l.item_id);
    if (validLines.length === 0) { setErr('Add at least one component line.'); return; }
    setSaving(true); setErr('');

    try {
      let bomId = editingBOM?.id;
      if (editingBOM) {
        const { error } = await (supabase as any).from('mrp_bom').update({ name: form.name, product_id: form.product_id, quantity: form.quantity, is_active: form.is_active, is_default: form.is_default }).eq('id', bomId);
        if (error) throw error;
        await (supabase as any).from('mrp_bom_lines').delete().eq('bom_id', bomId);
      } else {
        const { data, error } = await (supabase as any).from('mrp_bom').insert({ name: form.name, product_id: form.product_id, quantity: form.quantity, is_active: form.is_active, is_default: form.is_default }).select().single();
        if (error) throw error;
        bomId = data.id;
      }
      const lineInserts = validLines.map(l => ({ bom_id: bomId, item_id: l.item_id, quantity: l.quantity, uom: l.uom || 'Pcs' }));
      const { error: lineErr } = await (supabase as any).from('mrp_bom_lines').insert(lineInserts);
      if (lineErr) throw lineErr;
      setShowModal(false);
      fetchBOMs();
    } catch (e: any) {
      setErr(e.message);
    }
    setSaving(false);
  };

  const deleteBOM = async (id: string) => {
    if (!confirm('Delete this BOM and all its lines?')) return;
    await (supabase as any).from('mrp_bom_lines').delete().eq('bom_id', id);
    await (supabase as any).from('mrp_bom').delete().eq('id', id);
    fetchBOMs();
  };

  const filtered = boms.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || (b.product_name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <h2 className="text-lg font-bold text-slate-700 dark:text-white">Bill of Materials</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search BOMs..." className="pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48" />
          </div>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap">
            <Plus className="w-4 h-4" /> New BOM
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <Box className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No Bills of Materials found</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">Create BOM</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(bom => (
            <div key={bom.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => toggleExpand(bom.id)}>
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                  <Box className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 dark:text-white text-sm">{bom.name}</span>
                    {bom.is_default && <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">Default</span>}
                    {bom.is_active
                      ? <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" />Active</span>
                      : <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Inactive</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">Product: {bom.product_name || '—'} · Qty: {bom.quantity}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); openEdit(bom); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors text-xs">Edit</button>
                  <button onClick={e => { e.stopPropagation(); deleteBOM(bom.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {expanded === bom.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>
              {expanded === bom.id && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-4 pb-4 pt-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Components</p>
                  {(!bom.lines || bom.lines.length === 0) ? (
                    <p className="text-sm text-slate-400 italic">No component lines.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead><tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700"><th className="pb-1 text-left font-semibold">Component</th><th className="pb-1 text-right font-semibold">Qty</th><th className="pb-1 text-right font-semibold">UOM</th></tr></thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {bom.lines!.map((line, i) => (
                          <tr key={i} className="text-slate-600 dark:text-slate-300">
                            <td className="py-1">{line.item_name || line.item_id}</td>
                            <td className="py-1 text-right font-medium">{line.quantity}</td>
                            <td className="py-1 text-right text-slate-400">{line.uom || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-white">{editingBOM ? 'Edit BOM' : 'New Bill of Materials'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {err && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{err}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">BOM Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Finished Product BOM v1" className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Finished Product *</label>
                  <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select product...</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}{i.sku ? ` (${i.sku})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Output Qty</label>
                  <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex items-end gap-4 pb-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-indigo-600" /> Active
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="w-4 h-4 accent-amber-500" /> Default
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Component Lines</p>
                  <button onClick={addLine} className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold">
                    <Plus className="w-3 h-3" /> Add Line
                  </button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={line.item_id} onChange={e => updateLine(i, 'item_id', e.target.value)} className="flex-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select component...</option>
                        {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                      </select>
                      <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => updateLine(i, 'quantity', Number(e.target.value))} placeholder="Qty" className="w-20 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center" />
                      <input value={line.uom} onChange={e => updateLine(i, 'uom', e.target.value)} placeholder="UOM" className="w-16 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <button onClick={() => removeLine(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save BOM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
