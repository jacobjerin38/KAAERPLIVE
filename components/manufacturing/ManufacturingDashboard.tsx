
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Factory, ListChecks, Box, Cog,
  TrendingUp, ClipboardList, CheckCircle2, Play,
  AlertCircle, Loader
} from 'lucide-react';
import { ProductionOrders } from './ProductionOrders';
import { BOMManager } from './BOMManager';
import { WorkCenters } from './WorkCenters';

type TabId = 'orders' | 'bom' | 'workcenters';

interface Summary {
  total_orders: number;
  draft: number;
  confirmed: number;
  in_progress: number;
  done: number;
  cancelled: number;
  total_boms: number;
  total_workcenters: number;
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'orders',      label: 'Production Orders', icon: ListChecks },
  { id: 'bom',         label: 'Bill of Materials',  icon: Box },
  { id: 'workcenters', label: 'Work Centers',        icon: Cog },
];

const KPI_CARDS = (s: Summary) => [
  {
    label: 'Total Orders',
    value: s.total_orders,
    icon: ClipboardList,
    color: 'from-indigo-500 to-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    label: 'In Progress',
    value: s.in_progress,
    icon: Play,
    color: 'from-amber-500 to-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Completed',
    value: s.done,
    icon: CheckCircle2,
    color: 'from-green-500 to-green-600',
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-600 dark:text-green-400',
  },
  {
    label: 'Pending Confirm',
    value: s.draft + s.confirmed,
    icon: AlertCircle,
    color: 'from-slate-400 to-slate-500',
    bg: 'bg-slate-100 dark:bg-slate-700/40',
    text: 'text-slate-600 dark:text-slate-300',
  },
  {
    label: 'Active BOMs',
    value: s.total_boms,
    icon: Box,
    color: 'from-violet-500 to-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    text: 'text-violet-600 dark:text-violet-400',
  },
  {
    label: 'Work Centers',
    value: s.total_workcenters,
    icon: Cog,
    color: 'from-teal-500 to-teal-600',
    bg: 'bg-teal-50 dark:bg-teal-900/20',
    text: 'text-teal-600 dark:text-teal-400',
  },
];

export const ManufacturingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('orders');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    const { data, error } = await (supabase as any).rpc('rpc_manufacturing_summary');
    if (!error && data) setSummary(data);
    setSummaryLoading(false);
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Refresh summary when tab changes (orders/bom/wc may have been edited)
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    fetchSummary();
  };

  const EMPTY_SUMMARY: Summary = {
    total_orders: 0, draft: 0, confirmed: 0, in_progress: 0,
    done: 0, cancelled: 0, total_boms: 0, total_workcenters: 0,
  };

  const s = summary ?? EMPTY_SUMMARY;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">

        {/* ─── Page Header ─── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Manufacturing</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                MRP · Production Orders · BOM · Work Centers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <TrendingUp className="w-4 h-4" />
            <span>Phase 3 Active</span>
          </div>
        </div>

        {/* ─── KPI Cards ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {summaryLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
                <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-xl mb-3" />
                <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded mb-1" />
                <div className="h-3 w-20 bg-slate-100 dark:bg-slate-700 rounded" />
              </div>
            ))
          ) : (
            KPI_CARDS(s).map(card => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={`inline-flex p-2 rounded-xl mb-3 ${card.bg}`}>
                    <Icon className={`w-4 h-4 ${card.text}`} />
                  </div>
                  <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{card.label}</p>
                </div>
              );
            })
          )}
        </div>

        {/* ─── Tabs ─── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Tab nav */}
          <div className="border-b border-slate-200 dark:border-slate-700 px-4">
            <nav className="flex gap-0 -mb-px overflow-x-auto">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
                      ${isActive
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === 'orders'      && <ProductionOrders />}
            {activeTab === 'bom'         && <BOMManager />}
            {activeTab === 'workcenters' && <WorkCenters />}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ManufacturingDashboard;
