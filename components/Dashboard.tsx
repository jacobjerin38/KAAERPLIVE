import React, { useState, useEffect } from 'react';
import { KAA_LOGO_URL, MODULES } from '../constants';
import { AppView } from '../types';
import { Search, Command, Bell, Settings, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  HRMSWidget, CRMWidget, OrganisationWidget, ESSPWidget, UpcomingWidget,
  AccountingWidget, InventoryWidget, ManufacturingWidget, ProcurementWidget
} from './DashboardWidgets';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getDeals } from './crm/services';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlobalStats {
  // HR
  activeEmployees: number;
  attendancePercentage: number;
  pendingLeaves: number;
  // Finance
  receivables: number;
  payables: number;
  overdueInvoices: number;
  // Inventory
  stockValue: number;
  lowStockItems: number;
  // Approvals
  pendingTransitions: number;
  // CRM
  pipelineValue: string;
  dealCount: number;
}

const INITIAL_STATS: GlobalStats = {
  activeEmployees: 0,
  attendancePercentage: 0,
  pendingLeaves: 0,
  receivables: 0,
  payables: 0,
  overdueInvoices: 0,
  stockValue: 0,
  lowStockItems: 0,
  pendingTransitions: 0,
  pipelineValue: 'QAR 0',
  dealCount: 0,
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toggleSearch, toggleNotifications } = useUI();
  const { user, hasPermission, currentCompanyId } = useAuth();
  const [greeting, setGreeting] = useState('');
  const [stats, setStats] = useState<GlobalStats>(INITIAL_STATS);

  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  // ── Greet ──
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  // ── Fetch all dashboard data ──
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Try the global RPC first (most efficient single round-trip)
        if (currentCompanyId) {
          const { data: globalData, error: rpcError } = await supabase
            .rpc('rpc_global_dashboard', { p_company_id: currentCompanyId });

          if (!rpcError && globalData) {
            const gd = globalData as any;
            setStats(prev => ({
              ...prev,
              activeEmployees: gd.hr?.active_employees ?? 0,
              attendancePercentage: gd.hr?.attendance_pct ?? 0,
              pendingLeaves: gd.hr?.pending_leaves ?? 0,
              receivables: gd.finance?.receivables ?? 0,
              overdueInvoices: gd.finance?.overdue_invoices ?? 0,
              stockValue: gd.inventory?.stock_value ?? 0,
              lowStockItems: gd.inventory?.low_stock_items ?? 0,
              pendingTransitions: gd.approvals?.pending_transitions ?? 0,
            }));

            // Fetch Company Logo
            const { data: comp } = await supabase.from('companies').select('logo_url').eq('id', currentCompanyId).maybeSingle();
            if (comp) setCompanyLogo(comp.logo_url);

          } else {
            // Fallback: fetch HR stats directly if RPC not yet deployed
            const today = new Date().toISOString().split('T')[0];
            const [empRes, attRes] = await Promise.allSettled([
              supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'Active').eq('company_id', currentCompanyId),
              supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'Present').eq('company_id', currentCompanyId),
            ]);
            const empCount = empRes.status === 'fulfilled' ? (empRes.value.count ?? 0) : 0;
            const attCount = attRes.status === 'fulfilled' ? (attRes.value.count ?? 0) : 0;
            const attPct = empCount > 0 ? Math.round((attCount / empCount) * 100) : 0;
            setStats(prev => ({ ...prev, activeEmployees: empCount, attendancePercentage: attPct }));
          }
        }

        // CRM deals (separate service, may fail gracefully)
        try {
          const allDeals = await getDeals();
          const dealCount = allDeals.length;
          const totalValue = allDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
          const pipelineValue = 'QAR ' + new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 0, notation: 'compact'
          }).format(totalValue);
          setStats(prev => ({ ...prev, pipelineValue, dealCount }));
        } catch (e) {
          console.warn('[Dashboard] CRM data unavailable:', e);
        }

      } catch (error) {
        console.error('[Dashboard] Error fetching stats:', error);
      }
    };

    const fetchCompanyLogo = async () => {
      if (!currentCompanyId) return;
      try {
        const { data } = await supabase
          .from('companies').select('logo_url').eq('id', currentCompanyId).maybeSingle();
        if (data?.logo_url) setCompanyLogo(data.logo_url);
        else setCompanyLogo(null);
      } catch (e) {
        console.error('[Dashboard] Error fetching logo:', e);
      }
    };

    fetchDashboardData();
    fetchCompanyLogo();
  }, [currentCompanyId]);

  // ── Navigation ──
  const handleNavigate = (view: AppView) => {
    if (view === AppView.DASHBOARD) navigate('/');
    else navigate(`/${view.toLowerCase()}`);
  };

  // ── Widget Renderer (permission-gated) ──
  const renderModuleWidget = (moduleId: AppView) => {
    switch (moduleId) {
      case AppView.HRMS:
        if (!hasPermission('hrms.employees.view') && !hasPermission('hrms.attendance.view') && !hasPermission('hrms.leave.view')) return null;
        return (
          <HRMSWidget
            onClick={() => handleNavigate(AppView.HRMS)}
            count={stats.activeEmployees}
            attendancePercentage={stats.attendancePercentage}
            openLeaves={stats.pendingLeaves}
            className="md:col-span-2 md:row-span-2 min-h-[320px]"
          />
        );

      case AppView.CRM:
        if (!hasPermission('crm.dashboard.view') && !hasPermission('crm.deals.view')) return null;
        return (
          <CRMWidget
            onClick={() => handleNavigate(AppView.CRM)}
            pipelineValue={stats.pipelineValue}
            dealCount={stats.dealCount}
            className="md:col-span-1 md:row-span-2 min-h-[320px]"
          />
        );

      case AppView.ORGANISATION:
        if (!hasPermission('org.company.manage') && !hasPermission('org.structure.view') && !hasPermission('org.settings.manage')) return null;
        return <OrganisationWidget onClick={() => handleNavigate(AppView.ORGANISATION)} className="md:col-span-1 min-h-[150px]" />;

      case AppView.ESSP:
        if (!hasPermission('essp.view')) return null;
        return <ESSPWidget onClick={() => handleNavigate(AppView.ESSP)} className="md:col-span-1 md:row-span-1 min-h-[180px]" />;

      case AppView.ACCOUNTING:
        if (!hasPermission('finance.dashboard.view') && !hasPermission('*')) return null;
        return (
          <AccountingWidget
            onClick={() => handleNavigate(AppView.ACCOUNTING)}
            receivables={stats.receivables}
            payables={stats.payables}
            overdueCount={stats.overdueInvoices}
            className="md:col-span-1 min-h-[200px]"
          />
        );

      case AppView.INVENTORY:
        if (!hasPermission('inventory.view') && !hasPermission('*')) return null;
        return (
          <InventoryWidget
            onClick={() => handleNavigate(AppView.INVENTORY)}
            stockValue={stats.stockValue}
            lowStockCount={stats.lowStockItems}
            className="md:col-span-1 min-h-[200px]"
          />
        );

      case AppView.MANUFACTURING:
        if (!hasPermission('manufacturing.view') && !hasPermission('*')) return null;
        return <ManufacturingWidget onClick={() => handleNavigate(AppView.MANUFACTURING)} className="md:col-span-1 min-h-[180px]" />;

      case AppView.PROCUREMENT:
        if (!hasPermission('procurement.view') && !hasPermission('*')) return null;
        return <ProcurementWidget onClick={() => handleNavigate(AppView.PROCUREMENT)} className="md:col-span-1 min-h-[180px]" />;

      default: {
        const config = MODULES.find(m => m.id === moduleId);
        if (!config) return null;
        return (
          <UpcomingWidget
            key={moduleId}
            onClick={() => handleNavigate(moduleId)}
            className="md:col-span-1 min-h-[150px]"
            title={config.name}
            subtitle={config.description}
            icon={config.icon}
            gradient={config.bgColor.replace('bg-', 'bg-gradient-to-br from-white to-').replace('100', '200')}
          />
        );
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto relative z-10 scroll-smooth bg-slate-50 dark:bg-zinc-950 selection:bg-indigo-500/30">

      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] animate-blob" />
        <div className="absolute top-[20%] left-[-10%] w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 p-6 md:p-12 max-w-[1600px] mx-auto">

        {/* Top Bar / Command Center */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 animate-slide-up">
          <div>
            <div className="flex items-center gap-4 mb-3">
              {companyLogo ? (
                <img src={companyLogo} alt="Company Logo" className="h-16 w-auto object-contain brightness-100 dark:brightness-[1.2] rounded-xl shadow-lg shadow-indigo-500/10" />
              ) : (
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-md border border-slate-100 dark:border-zinc-800">
                  <Building2 className="w-8 h-8 text-indigo-500" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[10px] font-black tracking-[0.3em] text-indigo-500/70 dark:text-indigo-400/60 uppercase">Workspace</span>
                <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase">Organization Portal</span>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
              {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">
                {user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'}
              </span>.
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Here's what's happening in your organization today.</p>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Command Bar */}
            <div className="relative group flex-1 md:w-[400px]">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                readOnly
                onClick={() => toggleSearch(true)}
                className="cursor-pointer block w-full pl-11 pr-12 py-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-slate-200/50 dark:border-white/10 rounded-2xl text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 shadow-lg shadow-slate-200/20 dark:shadow-black/20 transition-all hover:bg-white/70 dark:hover:bg-zinc-800/70"
                placeholder="Jump to..."
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center point-events-none">
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700">
                  <span className="text-[10px] font-bold text-slate-400">⌘K</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleNotifications()}
              className="p-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-slate-200/50 dark:border-white/10 rounded-2xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all relative"
            >
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 grid-rows-auto gap-6 pb-20 animate-slide-up" style={{ animationDelay: '0.1s' }}>

          {/* Priority Modules */}
          {renderModuleWidget(AppView.HRMS)}
          {renderModuleWidget(AppView.CRM)}

          {/* Secondary Modules */}
          {renderModuleWidget(AppView.ESSP)}



          {/* Render All Other Modules */}
          {MODULES
            .filter(m => ![AppView.HRMS, AppView.CRM, AppView.SALES, AppView.ESSP, AppView.ORGANISATION, AppView.DASHBOARD].includes(m.id))
            .map(m => renderModuleWidget(m.id))
          }

          {/* Organisation & Settings Section */}
          <div className="md:col-span-4 mt-8 pt-8 border-t border-slate-200/50 dark:border-white/5">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Operations &amp; System</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {renderModuleWidget(AppView.ORGANISATION)}

              <div onClick={() => navigate('/settings')} className="group relative border border-dashed border-slate-300 dark:border-zinc-700 rounded-[2rem] p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-all">
                <Settings className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 transition-colors mb-2" />
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Settings</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};