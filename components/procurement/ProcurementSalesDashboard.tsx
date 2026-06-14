import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ShoppingCart, FileText, TrendingUp, TrendingDown,
  CheckCircle2, Package, Receipt, Loader
} from 'lucide-react';
import { PurchaseOrders } from './PurchaseOrders';
import { SalesOrders } from './SalesOrders';

type TabId = 'purchase' | 'sales';

interface Summary {
  po_total: number; po_draft: number; po_confirmed: number; po_received: number;
  so_total: number; so_draft: number; so_confirmed: number; so_shipped: number; so_invoiced: number;
  po_value: number; so_value: number;
}

const TABS: {id:TabId; label:string; icon:React.ElementType; color:string}[] = [
  {id:'purchase', label:'Purchase Orders', icon:ShoppingCart, color:'indigo'},
  {id:'sales',    label:'Sales Orders',    icon:FileText,     color:'emerald'},
];

interface ProcurementSalesDashboardProps {
  defaultTab?: TabId;
}

export const ProcurementSalesDashboard: React.FC<ProcurementSalesDashboardProps> = ({ defaultTab }) => {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab || 'purchase');

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);
  const [summary, setSummary]     = useState<Summary|null>(null);
  const [sumLoading, setSumLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    setSumLoading(true);
    const { data } = await (supabase as any).rpc('rpc_procurement_summary');
    if (data) setSummary(data);
    setSumLoading(false);
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const s = summary ?? { po_total:0, po_draft:0, po_confirmed:0, po_received:0, so_total:0, so_draft:0, so_confirmed:0, so_shipped:0, so_invoiced:0, po_value:0, so_value:0 };

  const KPI_ROWS = [
    {
      section: 'Purchasing',
      color: 'indigo',
      cards: [
        { label:'Total POs',     value: s.po_total,     icon: ShoppingCart, sub: `${s.po_draft} draft` },
        { label:'Pending',       value: s.po_confirmed,  icon: CheckCircle2, sub: 'awaiting receipt' },
        { label:'Received',      value: s.po_received,   icon: Package,      sub: 'fully received' },
        { label:'PO Value (QAR)',value: `QAR ${Number(s.po_value).toLocaleString('en',{maximumFractionDigits:0})}`, icon: TrendingDown, sub: 'excl. cancelled', isText: true },
      ]
    },
    {
      section: 'Sales',
      color: 'emerald',
      cards: [
        { label:'Total SOs',     value: s.so_total,     icon: FileText,     sub: `${s.so_draft} draft` },
        { label:'Confirmed',     value: s.so_confirmed,  icon: CheckCircle2, sub: 'ready to ship' },
        { label:'Shipped',       value: s.so_shipped,    icon: Package,      sub: 'awaiting invoice' },
        { label:'Invoiced',      value: s.so_invoiced,   icon: Receipt,      sub: 'completed' },
        { label:'SO Value (QAR)',value: `QAR ${Number(s.so_value).toLocaleString('en',{maximumFractionDigits:0})}`, icon: TrendingUp, sub: 'excl. cancelled', isText: true },
      ]
    }
  ];

  const colorMap: Record<string,{bg:string,text:string,ring:string}> = {
    indigo:  {bg:'bg-indigo-50 dark:bg-indigo-900/20',  text:'text-indigo-600 dark:text-indigo-400',  ring:'ring-indigo-500'},
    emerald: {bg:'bg-emerald-50 dark:bg-emerald-900/20', text:'text-emerald-600 dark:text-emerald-400', ring:'ring-emerald-500'},
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 shadow-lg shadow-indigo-500/20">
            <ShoppingCart className="w-6 h-6 text-white"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Procurement &amp; Sales</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Purchase Orders · Sales Orders · Vendor &amp; Customer Management</p>
          </div>
        </div>

        {/* KPI sections */}
        {sumLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-9 gap-3">
            {Array.from({length:9}).map((_,i)=>(
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
                <div className="h-7 w-7 bg-slate-200 dark:bg-slate-700 rounded-lg mb-3"/>
                <div className="h-6 w-10 bg-slate-200 dark:bg-slate-700 rounded mb-1"/>
                <div className="h-3 w-16 bg-slate-100 dark:bg-slate-700 rounded"/>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {KPI_ROWS.map(row => {
              const C = colorMap[row.color];
              return (
                <div key={row.section}>
                  <p className={`text-xs font-bold uppercase mb-2 ${C.text}`}>{row.section}</p>
                  <div className={`grid gap-3 grid-cols-2 sm:grid-cols-${row.cards.length} xl:grid-cols-${row.cards.length}`}>
                    {row.cards.map(card => {
                      const Icon = card.icon;
                      return (
                        <div key={card.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className={`inline-flex p-2 rounded-xl mb-3 ${C.bg}`}>
                            <Icon className={`w-4 h-4 ${C.text}`}/>
                          </div>
                          <p className={`${(card as any).isText ? 'text-base' : 'text-2xl'} font-bold ${C.text}`}>{card.value}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{card.label}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{card.sub}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 dark:border-slate-700 px-4">
            <nav className="flex gap-0 -mb-px">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                const aC = tab.id==='purchase' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-emerald-500 text-emerald-600 dark:text-emerald-400';
                return (
                  <button key={tab.id} onClick={()=>{setActiveTab(tab.id);fetchSummary();}}
                    className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
                      ${active ? aC : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                    <Icon className="w-4 h-4"/>{tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="p-5">
            {activeTab==='purchase' && <PurchaseOrders/>}
            {activeTab==='sales'    && <SalesOrders/>}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProcurementSalesDashboard;
