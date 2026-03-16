import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GlobalHeader } from './components/GlobalHeader';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { HRMS } from './components/modules/HRMS';
import { CRM } from './components/modules/CRM';
import { Organisation } from './components/modules/Organisation';
import { ESSP } from './components/modules/ESSP';
import { Settings } from './components/Settings';
import { AppView } from './types';
import { ArrowLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';
import { ESSPProvider } from './contexts/ESSPContext';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { supabase } from './lib/supabase';
import { InventoryDashboard } from './components/inventory/InventoryDashboard';
import { AccountingDashboard } from './components/accounting/AccountingDashboard';
import { ManufacturingDashboard } from './components/manufacturing/ManufacturingDashboard';
import { ProcurementSalesDashboard } from './components/procurement/ProcurementSalesDashboard';
import { CompanySelector } from './components/auth/CompanySelector';

const AppContent: React.FC = () => {
  const { session, loading, currentCompanyId, selectCompany, userRole } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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

  if (!session) {
    return <Login />;
  }

  // FORCE COMPANY SELECTION
  if (!currentCompanyId) {
    return <CompanySelector onSelect={selectCompany} />;
  }

  // Determine current view for header
  const getCurrentView = (): AppView => {
    const path = location.pathname.substring(1).toUpperCase();
    if (path === '' || path === 'DASHBOARD') return AppView.DASHBOARD;

    // Simple mapping for demonstration
    // In a real app, you might match specific routes to enum values
    return AppView.DASHBOARD;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-zinc-950 transition-colors duration-300 overflow-hidden font-sans">
      <GlobalHeader currentView={getCurrentView()} />
      <main className="flex-1 overflow-hidden relative">
        {location.pathname !== '/' && location.pathname !== '/essp' && (
          <button
            onClick={() => navigate('/')}
            className="absolute top-4 left-4 z-40 p-2 bg-white/50 dark:bg-black/50 backdrop-blur-md rounded-full hover:bg-white dark:hover:bg-zinc-800 transition-all shadow-sm border border-white/20"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        )}

        {/* Role-based routing: show all routes unless explicitly essp_user */}
        {userRole !== 'essp_user' ? (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/organisation" element={<Organisation />} />
            <Route path="/essp" element={<ESSP />} />
            <Route path="/hrms" element={<HRMS />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/inventory" element={<InventoryDashboard />} />
            <Route path="/accounting" element={<AccountingDashboard />} />
            <Route path="/manufacturing" element={<ManufacturingDashboard />} />
            <Route path="/procurement" element={<ProcurementSalesDashboard />} />
            <Route path="/settings" element={
              <Settings
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                onLogout={async () => await supabase.auth.signOut()}
              />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          /* ESSP User: only ESSP module */
          <Routes>
            <Route path="/essp" element={<ESSP />} />
            <Route path="*" element={<Navigate to="/essp" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <UIProvider>
        <ESSPProvider>
          <Router>
            <GlobalSearchModal />
            <AppContent />
          </Router>
        </ESSPProvider>
      </UIProvider>
    </AuthProvider>
  );
};

export default App;