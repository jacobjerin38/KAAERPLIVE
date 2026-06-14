
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ListChecks, Plus, X, Save, Loader, Search, Filter,
  Play, CheckCircle2, StopCircle, Package, Clock, Cog,
  ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';

interface ProductionOrder {
  id: string;
  name: string;
  product_id: string;
  bom_id?: string;
  quantity_to_produce: number;
  quantity_produced: number;
  state: 'draft' | 'confirmed' | 'in_progress' | 'done' | 'cancelled';
  date_planned: string;
  date_start?: string;
  date_finished?: string;
  work_center_id?: string;
  notes?: string;
  product_name?: string;
  bom_name?: string;
  work_center_name?: string;
}

interface BOM { id: string; name: string; product_id: string; }
interface Item { id: string; name: string; sku?: string; }
interface WorkCenter { id: string; name: string; }
interface Move { id: string; item_id: string; move_type: string; quantity_demand: number; quantity_done: number; item_name?: string; }

const STATE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:       { label: 'Draft',       color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: Clock },
  confirmed:   { label: 'Confirmed',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',   icon: CheckCircle2 },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: Play },
  done:        { label: 'Done',        color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',       icon: StopCircle },
};

const FILTERS = ['all', 'draft', 'confirmed', 'in_progress', 'done', 'cancelled'] as const;

const EMPTY_FORM = { product_id: '', bom_id: '', quantity_to_produce: 1, date_planned: new Date().toISOString().slice(0, 10), work_center_id: '', notes: '' };

export const ProductionOrders: React.FC = () => {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [boms, setBoms] = useState<BOM[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [workcenters, setWorkcenters] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [movesCache, setMovesCache] = useState<Record<string, Move[]>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('mrp_production_orders')
      .select('*, item_master!product_id(name), mrp_bom!bom_id(name), mrp_work_centers!work_center_id(name)')
      .order('created_at', { ascending: false });
    setOrders((data || []).map((d: any) => ({
      ...d,
      product_name: d.item_master?.name,
      bom_name: d.mrp_bom?.name,
      work_center_name: d.mrp_work_centers?.name,
    })));
    setLoading(false);
  }, []);

  const fetchMasters = useCallback(async () => {
    const [{ data: b }, { data: i }, { data: w }] = await Promise.all([
      (supabase as any).from('mrp_bom').select('id, name, product_id').eq('is_active', true).order('name'),
      (supabase as any).from('item_master').select('id, name, sku').order('name'),
      (supabase as any).from('mrp_work_centers').select('id, name').eq('is_active', true).order('name'),
    ]);
    setBoms(b || []); setItems(i || []); setWorkcenters(w || []);
  }, []);

  useEffect(() => { fetchOrders(); fetchMasters(); }, [fetchOrders, fetchMasters]);

  const loadMoves = async (orderId: string) => {
    if (movesCache[orderId]) return;
    const { data } = await (supabase as any)
      .from('mrp_production_moves')
      .select('*, item_master!item_id(name)')
      .eq('production_order_id', orderId);
    setMovesCache(prev => ({ ...prev, [orderId]: (data || []).map((d: any) => ({ ...d, item_name: d.item_master?.name })) }));
  };

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    await loadMoves(id);
  };

  const handleCreate = async () => {
    if (!form.product_id || !form.bom_id || !form.quantity_to_produce) { setErr('Product, BOM and quantity are required.'); return; }
    setSaving(true); setErr('');
    const { data, error } = await (supabase as any).rpc('rpc_create_production_order', {
      p_product_id: form.product_id,
      p_bom_id: form.bom_id,
      p_quantity: form.quantity_to_produce,
      p_date_planned: form.date_planned,
      p_work_center_id: form.work_center_id || null,
      p_notes: form.notes || null,
    });
    if (error || !data?.success) { setErr(error?.message || data?.message || 'Failed to create order.'); setSaving(false); return; }
    setSaving(false); setShowModal(false); fetchOrders();
  };

  const doAction = async (orderId: string, rpc: string) => {
    setActionLoading(orderId + rpc);
    const { data, error } = await (supabase as any).rpc(rpc, { p_order_id: orderId });
    if (error || !data?.success) alert(error?.message || data?.message || 'Action failed.');
    setActionLoading(null);
    setMovesCache(prev => { const n = { ...prev }; delete n[orderId]; return n; });
    fetchOrders();
  };

  // Auto-fill BOM when product selected
  const onProductChange = (productId: string) => {
    setForm(f => ({ ...f, product_id: productId, bom_id: '' }));
  };

  const availableBoms = boms.filter(b => !form.product_id || b.product_id === form.product_id);

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.state !== filter) return false;
    if (search && !o.name.toLowerCase().includes(search.toLowerCase()) && !(o.product_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = FILTERS.reduce((acc, f) => ({ ...acc, [f]: f === 'all' ? orders.length : orders.filter(o => o.state === f).length }), {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <h2 className="text-lg font-bold text-slate-700 dark:text-white">Production Orders</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..." className="pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48" />
          </div>
          <button onClick={() => { setForm(EMPTY_FORM); setErr(''); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap">
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
            {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            <span className="ml-1.5 opacity-70">({counts[f]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <ListChecks className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No production orders found</p>
          <button onClick={() => { setForm(EMPTY_FORM); setErr(''); setShowModal(true); }} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">Create Order</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => {
            const SC = STATE_CONFIG[order.state];
            const Icon = SC.icon;
            const progress = order.quantity_to_produce > 0 ? (order.quantity_produced / order.quantity_to_produce) * 100 : 0;
            const isExpanded = expanded === order.id;
            const moves = movesCache[order.id] || [];
            const consuming = moves.filter(m => m.move_type === 'consume');
            const producing = moves.filter(m => m.move_type === 'produce');

            return (
              <div key={order.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5 flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${SC.color}`}>
                        <Icon className="w-3 h-3" />{SC.label}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-white text-sm">{order.name}</span>
                        {order.work_center_name && (
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Cog className="w-3 h-3" />{order.work_center_name}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <Package className="w-3 h-3 flex-shrink-0" />{order.product_name || '—'}
                        {order.bom_name && <><span className="text-slate-300 dark:text-slate-600">·</span><span className="truncate">{order.bom_name}</span></>}
                      </p>
                      {/* Progress bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {order.quantity_produced}/{order.quantity_to_produce}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Planned: {order.date_planned}
                        {order.date_finished && <> · Finished: {new Date(order.date_finished).toLocaleDateString()}</>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        {order.state === 'draft' && (
                          <button onClick={() => doAction(order.id, 'rpc_confirm_production_order')} disabled={actionLoading === order.id + 'rpc_confirm_production_order'} className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">Confirm</button>
                        )}
                        {order.state === 'confirmed' && (
                          <button onClick={() => doAction(order.id, 'rpc_start_production_order')} disabled={!!actionLoading} className="px-2.5 py-1 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50">Start</button>
                        )}
                        {(order.state === 'confirmed' || order.state === 'in_progress') && (
                          <button onClick={() => doAction(order.id, 'rpc_complete_production')} disabled={!!actionLoading} className="px-2.5 py-1 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
                            {actionLoading === order.id + 'rpc_complete_production' ? <Loader className="w-3 h-3 animate-spin" /> : 'Complete'}
                          </button>
                        )}
                        {['draft', 'confirmed'].includes(order.state) && (
                          <button onClick={() => doAction(order.id, 'rpc_cancel_production_order')} disabled={!!actionLoading} className="px-2.5 py-1 text-xs font-semibold border border-red-300 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50">Cancel</button>
                        )}
                        <button onClick={() => toggleExpand(order.id)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded moves */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 px-4 pb-4 pt-3">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Materials to Consume</p>
                        {consuming.length === 0 ? <p className="text-xs text-slate-400 italic">No consumption moves.</p> : (
                          <table className="w-full text-xs">
                            <thead><tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700"><th className="pb-1 text-left">Component</th><th className="pb-1 text-right">Demand</th><th className="pb-1 text-right">Done</th></tr></thead>
                            <tbody>
                              {consuming.map(m => (
                                <tr key={m.id} className="text-slate-600 dark:text-slate-300 border-b border-slate-50 dark:border-slate-700/30">
                                  <td className="py-1">{m.item_name || m.item_id}</td>
                                  <td className="py-1 text-right">{m.quantity_demand}</td>
                                  <td className={`py-1 text-right font-semibold ${m.quantity_done >= m.quantity_demand ? 'text-green-500' : 'text-amber-500'}`}>{m.quantity_done}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1"><Package className="w-3 h-3" /> Finished Goods Output</p>
                        {producing.length === 0 ? <p className="text-xs text-slate-400 italic">No output moves.</p> : (
                          <table className="w-full text-xs">
                            <thead><tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700"><th className="pb-1 text-left">Product</th><th className="pb-1 text-right">Demand</th><th className="pb-1 text-right">Done</th></tr></thead>
                            <tbody>
                              {producing.map(m => (
                                <tr key={m.id} className="text-slate-600 dark:text-slate-300">
                                  <td className="py-1">{m.item_name || m.item_id}</td>
                                  <td className="py-1 text-right">{m.quantity_demand}</td>
                                  <td className={`py-1 text-right font-semibold ${m.quantity_done >= m.quantity_demand ? 'text-green-500' : 'text-slate-400'}`}>{m.quantity_done}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {order.notes && <p className="text-xs text-slate-400 mt-2 italic">Notes: {order.notes}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-white">New Production Order</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {err && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{err}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Finished Product *</label>
                <select value={form.product_id} onChange={e => onProductChange(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select product to manufacture...</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}{i.sku ? ` (${i.sku})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Bill of Materials *</label>
                <select value={form.bom_id} onChange={e => setForm(f => ({ ...f, bom_id: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" disabled={!form.product_id}>
                  <option value="">{form.product_id ? 'Select BOM...' : 'Select product first'}</option>
                  {availableBoms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Quantity to Produce *</label>
                  <input type="number" min="0.01" step="0.01" value={form.quantity_to_produce} onChange={e => setForm(f => ({ ...f, quantity_to_produce: Number(e.target.value) }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Planned Date</label>
                  <input type="date" value={form.date_planned} onChange={e => setForm(f => ({ ...f, date_planned: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Work Center</label>
                <select value={form.work_center_id} onChange={e => setForm(f => ({ ...f, work_center_id: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">None</option>
                  {workcenters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional production notes..." className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Create Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
