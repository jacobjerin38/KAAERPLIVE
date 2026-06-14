import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ShoppingCart, Plus, X, Save, Loader, Search, Trash2,
  ChevronDown, ChevronUp, CheckCircle2, Clock, Package,
  Truck, XCircle, User, Calendar, FileText
} from 'lucide-react';

interface POLine { id?: string; item_id: string; quantity: number; unit_price: number; quantity_received?: number; subtotal?: number; item_name?: string; }
interface PO {
  id: string; name: string; partner_id: string; order_date: string;
  expected_date: string; state: string; total_amount: number; notes?: string;
  warehouse_id?: string; partner_name?: string; lines?: POLine[];
}
interface Partner { id: string; name: string; partner_type: string; }
interface Item { id: string; name: string; sku?: string; purchase_price?: number; }
interface Warehouse { id: string; name: string; }

const STATE_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: 'Draft',     color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',   icon: CheckCircle2 },
  received:  { label: 'Received',  color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: Package },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',       icon: XCircle },
};
const FILTERS = ['all','draft','confirmed','received','cancelled'] as const;
const EMPTY_FORM = { partner_id:'', expected_date:'', warehouse_id:'', notes:'' };

export const PurchaseOrders: React.FC = () => {
  const [orders, setOrders]       = useState<PO[]>([]);
  const [partners, setPartners]   = useState<Partner[]>([]);
  const [items, setItems]         = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<typeof FILTERS[number]>('all');
  const [search, setSearch]       = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [lines, setLines]         = useState<POLine[]>([{ item_id:'', quantity:1, unit_price:0 }]);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');
  const [expanded, setExpanded]   = useState<string|null>(null);
  const [linesCache, setLinesCache] = useState<Record<string,POLine[]>>({});
  const [actionLoading, setActionLoading] = useState<string|null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('purchase_orders')
      .select('*, accounting_partners!partner_id(name)')
      .order('created_at', { ascending: false });
    setOrders((data||[]).map((d:any)=>({...d, partner_name: d.accounting_partners?.name})));
    setLoading(false);
  }, []);

  const fetchMasters = useCallback(async () => {
    const [{data:p},{data:i},{data:w}] = await Promise.all([
      (supabase as any).from('accounting_partners').select('id,name,partner_type').order('name'),
      (supabase as any).from('item_master').select('id,name,sku,purchase_price').order('name'),
      (supabase as any).from('warehouses').select('id,name').order('name'),
    ]);
    setPartners((p||[]).filter((x:any)=>x.partner_type==='vendor'||x.partner_type==='both'));
    setItems(i||[]);
    setWarehouses(w||[]);
  }, []);

  useEffect(()=>{ fetchOrders(); fetchMasters(); },[fetchOrders,fetchMasters]);

  const loadLines = async (orderId:string) => {
    if (linesCache[orderId]) return;
    const { data } = await (supabase as any)
      .from('purchase_order_lines')
      .select('*, item_master!item_id(name)')
      .eq('order_id', orderId);
    setLinesCache(prev=>({...prev,[orderId]:(data||[]).map((d:any)=>({...d,item_name:d.item_master?.name}))}));
  };

  const toggleExpand = async (id:string) => {
    if (expanded===id){ setExpanded(null); return; }
    setExpanded(id); await loadLines(id);
  };

  const addLine    = () => setLines(l=>[...l,{item_id:'',quantity:1,unit_price:0}]);
  const removeLine = (i:number) => setLines(l=>l.filter((_,idx)=>idx!==i));
  const updateLine = (i:number, field:keyof POLine, val:any) => {
    setLines(l=>l.map((ln,idx)=>{
      if(idx!==i) return ln;
      const updated = {...ln,[field]:val};
      if(field==='item_id'){
        const item = items.find(it=>it.id===val);
        if(item?.purchase_price) updated.unit_price = item.purchase_price;
      }
      return updated;
    }));
  };

  const lineTotal = lines.reduce((s,l)=>s+(l.quantity||0)*(l.unit_price||0),0);

  const handleCreate = async () => {
    if (!form.partner_id){ setErr('Select a vendor.'); return; }
    if (!form.expected_date){ setErr('Expected date is required.'); return; }
    const valid = lines.filter(l=>l.item_id && l.quantity>0);
    if (!valid.length){ setErr('Add at least one line item.'); return; }
    setSaving(true); setErr('');
    const { data, error } = await (supabase as any).rpc('rpc_create_purchase_order',{
      p_partner_id: form.partner_id,
      p_expected_date: form.expected_date,
      p_warehouse_id: form.warehouse_id||null,
      p_notes: form.notes||null,
      p_lines: valid.map(l=>({item_id:l.item_id,quantity:l.quantity,unit_price:l.unit_price})),
    });
    if (error||!data?.success){ setErr(error?.message||data?.message||'Failed.'); setSaving(false); return; }
    setSaving(false); setShowModal(false); fetchOrders();
  };

  const doAction = async (id:string, rpc:string) => {
    setActionLoading(id+rpc);
    const { data, error } = await (supabase as any).rpc(rpc,{p_order_id:id});
    if (error||!data?.success) alert(error?.message||data?.message||'Action failed.');
    setActionLoading(null);
    setLinesCache(prev=>{const n={...prev};delete n[id];return n;});
    fetchOrders();
  };

  const vendors  = partners.filter(p=>p.partner_type==='vendor'||p.partner_type==='both');
  const filtered = orders.filter(o=>{
    if (filter!=='all'&&o.state!==filter) return false;
    if (search&&!o.name.toLowerCase().includes(search.toLowerCase())&&!(o.partner_name||'').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const counts = FILTERS.reduce((a,f)=>({...a,[f]:f==='all'?orders.length:orders.filter(o=>o.state===f).length}),{} as Record<string,number>);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <h2 className="text-lg font-bold text-slate-700 dark:text-white">Purchase Orders</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search POs..."
              className="pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"/>
          </div>
          <button onClick={()=>{setForm(EMPTY_FORM);setLines([{item_id:'',quantity:1,unit_price:0}]);setErr('');setShowModal(true);}}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap">
            <Plus className="w-4 h-4"/> New PO
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter===f?'bg-indigo-600 text-white':'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
            {f==='all'?'All':f.charAt(0).toUpperCase()+f.slice(1)} <span className="opacity-70">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader className="w-6 h-6 animate-spin text-indigo-500"/></div>
      ) : filtered.length===0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600"/>
          <p className="text-slate-500 dark:text-slate-400 font-medium">No purchase orders found</p>
          <button onClick={()=>{setForm(EMPTY_FORM);setLines([{item_id:'',quantity:1,unit_price:0}]);setErr('');setShowModal(true);}}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Create PO</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(po=>{
            const SC=STATE_CFG[po.state]||STATE_CFG.draft;
            const Icon=SC.icon;
            const cachedLines=linesCache[po.id]||[];
            return (
              <div key={po.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="p-4 flex items-start gap-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 mt-0.5 ${SC.color}`}>
                    <Icon className="w-3 h-3"/>{SC.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-white text-sm">{po.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                      <User className="w-3 h-3 flex-shrink-0"/>{po.partner_name||'—'}
                      <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>
                      <Calendar className="w-3 h-3 flex-shrink-0"/>Expected: {po.expected_date||'—'}
                    </p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      QAR {Number(po.total_amount).toLocaleString('en',{minimumFractionDigits:2})}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {po.state==='draft'&&(
                      <button onClick={()=>doAction(po.id,'rpc_confirm_purchase_order')} disabled={!!actionLoading}
                        className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">Confirm</button>
                    )}
                    {po.state==='confirmed'&&(
                      <button onClick={()=>doAction(po.id,'rpc_receive_purchase_order')} disabled={!!actionLoading}
                        className="px-2.5 py-1 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1">
                        <Package className="w-3 h-3"/>Receive
                      </button>
                    )}
                    {['draft','confirmed'].includes(po.state)&&(
                      <button onClick={()=>doAction(po.id,'rpc_cancel_purchase_order')} disabled={!!actionLoading}
                        className="px-2.5 py-1 text-xs font-semibold border border-red-300 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50">Cancel</button>
                    )}
                    <button onClick={()=>toggleExpand(po.id)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                      {expanded===po.id?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
                    </button>
                  </div>
                </div>
                {expanded===po.id&&(
                  <div className="border-t border-slate-100 dark:border-slate-700 px-4 pb-4 pt-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Line Items</p>
                    {cachedLines.length===0?<p className="text-xs text-slate-400 italic">No lines.</p>:(
                      <table className="w-full text-xs">
                        <thead><tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                          <th className="pb-1 text-left">Item</th><th className="pb-1 text-right">Qty</th>
                          <th className="pb-1 text-right">Unit Price</th><th className="pb-1 text-right">Subtotal</th>
                          <th className="pb-1 text-right">Received</th>
                        </tr></thead>
                        <tbody>{cachedLines.map((l,i)=>(
                          <tr key={i} className="text-slate-600 dark:text-slate-300 border-b border-slate-50 dark:border-slate-700/30">
                            <td className="py-1">{l.item_name||l.item_id}</td>
                            <td className="py-1 text-right">{l.quantity}</td>
                            <td className="py-1 text-right">QAR {Number(l.unit_price).toFixed(2)}</td>
                            <td className="py-1 text-right font-semibold">QAR {Number(l.subtotal).toFixed(2)}</td>
                            <td className={`py-1 text-right font-semibold ${Number(l.quantity_received)>=Number(l.quantity)?'text-green-500':'text-amber-500'}`}>
                              {l.quantity_received||0}/{l.quantity}
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                    {po.notes&&<p className="text-xs text-slate-400 mt-2 italic">Notes: {po.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-indigo-500"/>New Purchase Order</h3>
              <button onClick={()=>setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {err&&<div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{err}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Vendor *</label>
                  <select value={form.partner_id} onChange={e=>setForm(f=>({...f,partner_id:e.target.value}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select vendor...</option>
                    {vendors.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Expected Date *</label>
                  <input type="date" value={form.expected_date} onChange={e=>setForm(f=>({...f,expected_date:e.target.value}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Warehouse</label>
                  <select value={form.warehouse_id} onChange={e=>setForm(f=>({...f,warehouse_id:e.target.value}))}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">None</option>
                    {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Optional notes..."
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"/>
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Order Lines</p>
                  <button onClick={addLine} className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold">
                    <Plus className="w-3 h-3"/>Add Line
                  </button>
                </div>
                <div className="space-y-2">
                  {lines.map((line,i)=>(
                    <div key={i} className="flex gap-2 items-center">
                      <select value={line.item_id} onChange={e=>updateLine(i,'item_id',e.target.value)}
                        className="flex-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select item...</option>
                        {items.map(it=><option key={it.id} value={it.id}>{it.name}{it.sku?` (${it.sku})`:''}</option>)}
                      </select>
                      <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={e=>updateLine(i,'quantity',Number(e.target.value))}
                        placeholder="Qty" className="w-20 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"/>
                      <input type="number" min="0" step="0.01" value={line.unit_price} onChange={e=>updateLine(i,'unit_price',Number(e.target.value))}
                        placeholder="Price" className="w-24 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"/>
                      <span className="w-24 text-xs text-right text-slate-500 dark:text-slate-400 font-semibold">
                        QAR {((line.quantity||0)*(line.unit_price||0)).toFixed(2)}
                      </span>
                      <button onClick={()=>removeLine(i)} className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors flex-shrink-0"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">Total: QAR {lineTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
              <button onClick={()=>setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
                {saving?<Loader className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>} Create PO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
