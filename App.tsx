import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { GlobalHeader } from './components/GlobalHeader';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { Employees } from './components/modules/Employees';
import { AttendanceHub } from './components/modules/AttendanceHub';
import { LeaveHub } from './components/modules/LeaveHub';
import { PayrollHub } from './components/modules/PayrollHub';
import { CRM } from './components/modules/CRM';
import { Organisation } from './components/modules/Organisation';
import { ESSP } from './components/modules/ESSP';
import { HelpDeskHub } from './components/modules/HelpDeskHub';
import { MarketingHub } from './components/modules/MarketingHub';
import { Settings } from './components/Settings';
import { AppView } from './types';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';
import { ESSPProvider } from './contexts/ESSPContext';
import { GlobalLoadingProvider, useGlobalLoading } from './contexts/GlobalLoadingContext';
import { FullScreenLoader } from './components/ui/FullScreenLoader';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { supabase } from './lib/supabase';
import { InventoryDashboard } from './components/inventory/InventoryDashboard';
import { AccountingDashboard } from './components/accounting/AccountingDashboard';
import { ManufacturingDashboard } from './components/manufacturing/ManufacturingDashboard';
import { ProcurementSalesDashboard } from './components/procurement/ProcurementSalesDashboard';
import { CompanySelector } from './components/auth/CompanySelector';
import { ProjectManagement } from './components/modules/ProjectManagement';
import { DocumentManagement } from './components/modules/DocumentManagement';
import { LoansBenefitsHub } from './components/modules/LoansBenefitsHub';
import { TravelExpensesHub } from './components/modules/TravelExpensesHub';
import { PerformanceHub } from './components/modules/PerformanceHub';
import { RecruitmentHub } from './components/modules/RecruitmentHub';
import { CareersPortal } from './components/modules/CareersPortal';
import { TeamChat } from './components/modules/TeamChat';
import { PROHub } from './components/modules/PROHub';
import { SalesHub } from './components/modules/SalesHub';

const AppContent: React.FC = () => {
  const { session, loading, currentCompanyId, selectCompany, userRole, hasPermission } = useAuth();
  const { initialDataLoaded } = useGlobalLoading();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const normalizedPath = (location.pathname === '/dashboard' || location.pathname === '') ? '/' : location.pathname;
  const [visitedPaths, setVisitedPaths] = useState<Set<string>>(() => new Set([normalizedPath]));

  useEffect(() => {
    if (normalizedPath) {
      setVisitedPaths(prev => {
        if (prev.has(normalizedPath)) return prev;
        const next = new Set(prev);
        next.add(normalizedPath);
        return next;
      });
    }
  }, [normalizedPath]);

  // Initial Theme Check
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  // Update Theme Class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-zinc-950 text-slate-400">Loading...</div>;
  }

  const isPublicRoute = location.pathname.startsWith('/careers');
  if (isPublicRoute) {
    return <CareersPortal />;
  }

  if (!session) {
    return <Login />;
  }

  // FORCE COMPANY SELECTION
  if (!currentCompanyId) {
    return <CompanySelector onSelect={selectCompany} />;
  }

  // Determine current view for header
  const getCurrentView = (): AppView => {
    const path = normalizedPath.substring(1).toLowerCase();
    if (path === '' || path === 'dashboard') return AppView.DASHBOARD;
    if (path === 'employees') return AppView.EMPLOYEES;
    if (path === 'attendance') return AppView.ATTENDANCE;
    if (path === 'leave') return AppView.LEAVE;
    if (path === 'payroll') return AppView.PAYROLL;
    if (path === 'organisation') return AppView.ORGANISATION;
    if (path === 'crm') return AppView.CRM;
    if (path === 'inventory') return AppView.INVENTORY;
    if (path === 'accounting') return AppView.ACCOUNTING;
    if (path === 'manufacturing') return AppView.MANUFACTURING;
    if (path === 'procurement') return AppView.PROCUREMENT;
    if (path === 'essp') return AppView.ESSP;
    if (path === 'projects') return AppView.PROJECTS;
    if (path === 'documents') return AppView.DOCUMENTS;
    if (path === 'help_desk') return AppView.HELP_DESK;
    if (path === 'marketing') return AppView.MARKETING;
    if (path === 'sales') return AppView.SALES;
    if (path === 'recruitment') return AppView.RECRUITMENT;
    if (path === 'performance') return AppView.PERFORMANCE;
    if (path === 'loans') return AppView.LOANS;
    if (path === 'travel') return AppView.TRAVEL;
    if (path === 'careers') return AppView.CAREERS;
    if (path === 'chat') return AppView.CHAT;
    if (path === 'pro') return AppView.PRO;
    return AppView.DASHBOARD;
  };

  const getModulePermission = (path: string): string | null => {
    switch (path) {
      case '/employees': return 'hrms.employees.view';
      case '/attendance': return 'hrms.attendance.view';
      case '/leave': return 'hrms.leave.view';
      case '/payroll': return 'finance.payroll.view';
      case '/crm': return 'crm.dashboard.view';
      case '/sales': return 'sales.view';
      case '/accounting': return 'finance.dashboard.view';
      case '/inventory': return 'inventory.view';
      case '/projects': return 'projects.view';
      case '/documents': return 'documents.view';
      case '/help_desk': return 'hrms.helpdesk.view';
      case '/manufacturing': return 'manufacturing.view';
      case '/procurement': return 'procurement.view';
      case '/marketing': return 'marketing.view';
      case '/recruitment': return 'recruitment.view';
      case '/loans': return 'loans.view';
      case '/performance': return 'performance.view';
      case '/travel': return 'travel.view';
      case '/pro': return 'pro.view';
      case '/organisation': return 'org.structure.view';
      case '/essp': return 'essp.view';
      default: return null;
    }
  };

  // Define modules for Keep-Alive
  const KEEPALIVE_MODULES = [
    { path: '/', element: <Dashboard />, id: 'dashboard' },
    { path: '/organisation', element: <Organisation />, id: 'organisation' },
    { path: '/employees', element: <Employees />, id: 'employees' },
    { path: '/attendance', element: <AttendanceHub />, id: 'attendance' },
    { path: '/leave', element: <LeaveHub />, id: 'leave' },
    { path: '/payroll', element: <PayrollHub />, id: 'payroll' },
    { path: '/crm', element: <CRM />, id: 'crm' },
    { path: '/inventory', element: <InventoryDashboard />, id: 'inventory' },
    { path: '/accounting', element: <AccountingDashboard />, id: 'accounting' },
    { path: '/manufacturing', element: <ManufacturingDashboard />, id: 'manufacturing' },
    { path: '/procurement', element: <ProcurementSalesDashboard />, id: 'procurement' },
    { path: '/essp', element: <ESSP />, id: 'essp' },
    { path: '/projects', element: <ProjectManagement />, id: 'projects' },
    { path: '/documents', element: <DocumentManagement />, id: 'documents' },
    { path: '/sales', element: <SalesHub />, id: 'sales' },
    { path: '/pro', element: <PROHub />, id: 'pro' },
    { path: '/help_desk', element: <HelpDeskHub />, id: 'help_desk' },
    { path: '/marketing', element: <MarketingHub />, id: 'marketing' },
    { path: '/recruitment', element: <RecruitmentHub />, id: 'recruitment' },
    { path: '/performance', element: <PerformanceHub />, id: 'performance' },
    { path: '/loans', element: <LoansBenefitsHub />, id: 'loans' },
    { path: '/travel', element: <TravelExpensesHub />, id: 'travel' },
    { path: '/careers', element: <CareersPortal />, id: 'careers' },
    { path: '/chat', element: <TeamChat />, id: 'chat' },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-zinc-950 transition-colors duration-300 overflow-hidden font-sans">
      {!initialDataLoaded && <FullScreenLoader />}
      <GlobalHeader currentView={getCurrentView()} />
      <main className="flex-1 overflow-hidden relative">
        {normalizedPath !== '/' && normalizedPath !== '/essp' && (
          <button
            onClick={() => navigate('/')}
            className="absolute top-4 left-4 z-40 p-2 bg-white/50 dark:bg-black/50 backdrop-blur-md rounded-full hover:bg-white dark:hover:bg-zinc-800 transition-all shadow-sm border border-white/20"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        )}

        {/* Keep-Alive Modules Container */}
        <div 
          className="w-full h-full relative"
          style={{ display: KEEPALIVE_MODULES.some(m => m.path === normalizedPath) ? 'block' : 'none' }}
        >
          {KEEPALIVE_MODULES.map((module) => {
            const isVisited = visitedPaths.has(module.path);
            if (!isVisited) return null;

            const requiredPerm = getModulePermission(module.path);
            const hasAccess = !requiredPerm || hasPermission(requiredPerm) || hasPermission('*');

            return (
              <div
                key={module.id}
                className="absolute inset-0 w-full h-full overflow-auto"
                style={{ 
                  display: normalizedPath === module.path ? 'block' : 'none',
                  visibility: normalizedPath === module.path ? 'visible' : 'hidden' 
                }}
              >
                {hasAccess ? (
                  module.element
                ) : (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                    <ShieldAlert className="w-16 h-16 text-rose-500 mb-4 opacity-80" />
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Access Restricted</h2>
                    <p className="text-sm max-w-md mb-6">You do not have permission to view the <span className="font-bold text-slate-900 dark:text-white uppercase">{module.id}</span> module. Please contact your system administrator to request access.</p>
                    <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-sm rounded-xl hover:shadow-lg transition-all">
                      Return to Dashboard
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Standard Routes (for non-persisted views like Settings and fallbacks) */}
        <Routes>
          <Route path="/hrms" element={<Navigate to="/employees" replace />} />
          <Route path="/settings" element={
            <Settings
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
              onLogout={async () => await supabase.auth.signOut()}
            />
          } />
          {/* Internal redirect logic if current path isn't in keep-alive or settings */}
          <Route path="*" element={
            !KEEPALIVE_MODULES.some(m => m.path === location.pathname) && location.pathname !== '/settings'
              ? <Navigate to={userRole === 'essp_user' ? "/essp" : "/"} replace />
              : null
          } />
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <GlobalLoadingProvider>
        <UIProvider>
          <ESSPProvider>
            <Router>
              <GlobalSearchModal />
              <AppContent />
              <Analytics />
            </Router>
          </ESSPProvider>
        </UIProvider>
      </GlobalLoadingProvider>
    </AuthProvider>
  );
};

export default App;