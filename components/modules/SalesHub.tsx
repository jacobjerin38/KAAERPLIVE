import React, { useState, useEffect, useMemo } from 'react';
import {
    ShoppingCart, Users, Briefcase, FileText, CheckSquare, Settings,
    BarChart3, Plus, Search, DollarSign, Package, LayoutDashboard, Send
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import QuotationsView from '../crm/QuotationsView';
import { ProposalWorkflow } from '../crm/ProposalWorkflow';
import LeadsView from '../crm/LeadsView';
import CustomersView from '../crm/CustomersView';
import ItemsView from '../crm/ItemsView';
import { ReportsListView } from './reports/ReportsListView';

export type SalesViewMode = 'DASHBOARD' | 'LEADS' | 'CUSTOMERS' | 'QUOTATIONS' | 'PROPOSALS' | 'SALES_ORDERS' | 'CONTRACTS' | 'PRICE_LISTS' | 'REPORTS' | 'SETTINGS';

interface SalesHubProps {
    defaultTab?: string;
}

export const SalesHub: React.FC<SalesHubProps> = ({ defaultTab }) => {
    const { user, currentCompanyId, hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState<SalesViewMode>((defaultTab?.toUpperCase() as SalesViewMode) || 'DASHBOARD');
    const [companyId, setCompanyId] = useState<string>(currentCompanyId || '');

    useEffect(() => {
        if (currentCompanyId) {
            setCompanyId(currentCompanyId);
        } else if (user) {
            supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle().then(({ data }) => {
                if (data?.company_id) setCompanyId(data.company_id);
            });
        }
    }, [user, currentCompanyId]);

    const navItems = useMemo(() => [
        { id: 'DASHBOARD', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'LEADS', icon: Users, label: 'Leads' },
        { id: 'CUSTOMERS', icon: Briefcase, label: 'Customers' },
        { id: 'QUOTATIONS', icon: FileText, label: 'Quotations' },
        { id: 'PROPOSALS', icon: Send, label: 'Proposals' },
        { id: 'SALES_ORDERS', icon: ShoppingCart, label: 'Sales Orders' },
        { id: 'CONTRACTS', icon: FileText, label: 'Contracts' },
        { id: 'PRICE_LISTS', icon: Package, label: 'Price Lists' },
        { id: 'REPORTS', icon: BarChart3, label: 'Reports' },
        { id: 'SETTINGS', icon: Settings, label: 'Settings' },
    ], []);

    const renderDashboard = () => (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            <header className="flex justify-between items-center mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Sales Management Suite</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                        Quotations, Proposals, Sales Orders, Pricing & Commercial Contracts.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setActiveTab('QUOTATIONS')} className="px-5 py-2.5 bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Create Quotation
                    </button>
                    <button onClick={() => setActiveTab('PROPOSALS')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Create Proposal
                    </button>
                </div>
            </header>

            {/* Submodules Quick Access */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
                <div
                    onClick={() => setActiveTab('QUOTATIONS')}
                    className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
                >
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Quotations</h3>
                        <p className="text-xs text-slate-400">Generate & send commercial quotes</p>
                    </div>
                </div>

                <div
                    onClick={() => setActiveTab('PROPOSALS')}
                    className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
                >
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 flex items-center justify-center">
                        <Send className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Proposals</h3>
                        <p className="text-xs text-slate-400">Manage client proposals & RFP responses</p>
                    </div>
                </div>

                <div
                    onClick={() => setActiveTab('CUSTOMERS')}
                    className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
                >
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center">
                        <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Customers</h3>
                        <p className="text-xs text-slate-400">Active client directory & history</p>
                    </div>
                </div>
            </div>

            {/* Direct Embedded Quotations View */}
            <div className="flex-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl overflow-hidden p-6">
                <QuotationsView companyId={companyId} onConvert={(tab) => setActiveTab(tab as any)} />
            </div>
        </div>
    );

    return (
        <div className="flex h-full relative z-10 overflow-hidden bg-slate-50 dark:bg-black/20">
            {/* Sales Sidebar */}
            <div className="w-20 md:w-64 flex-shrink-0 bg-white/40 dark:bg-zinc-900/40 border-r border-slate-200/50 dark:border-zinc-800 flex flex-col justify-between pt-8 pb-4 px-4 backdrop-blur-xl">
                <div className="flex flex-col gap-3">
                    <div className="mb-8 px-2 hidden md:block">
                        <div className="flex items-center gap-2 mb-1">
                            <ShoppingCart className="w-6 h-6 text-emerald-600" />
                            <span className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">Sales Module</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">Commercial Suite</span>
                    </div>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as SalesViewMode)}
                            className={`flex items-center justify-between p-3.5 rounded-2xl transition-all active:scale-95 duration-200 ${activeTab === item.id
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-zinc-800/60 hover:text-slate-800 dark:hover:text-slate-200 hover:shadow-sm'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className="w-5 h-5" strokeWidth={activeTab === item.id ? 2.5 : 2} />
                                <span className="hidden md:inline font-bold text-sm tracking-tight">{item.label}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'DASHBOARD' && renderDashboard()}
                {activeTab === 'LEADS' && <LeadsView companyId={companyId} />}
                {activeTab === 'CUSTOMERS' && <CustomersView companyId={companyId} />}
                {activeTab === 'QUOTATIONS' && (
                    <div className="p-8 h-full overflow-y-auto">
                        <QuotationsView companyId={companyId} onConvert={(tab) => setActiveTab(tab as any)} />
                    </div>
                )}
                {activeTab === 'PROPOSALS' && (
                    <div className="p-8 h-full overflow-y-auto">
                        <ProposalWorkflow companyId={companyId} />
                    </div>
                )}
                {activeTab === 'PRICE_LISTS' && (
                    <div className="p-8 h-full overflow-y-auto">
                        <ItemsView companyId={companyId} />
                    </div>
                )}
                {activeTab === 'REPORTS' && <ReportsListView moduleFilter="SALES" />}
                {activeTab !== 'DASHBOARD' && activeTab !== 'LEADS' && activeTab !== 'CUSTOMERS' && activeTab !== 'QUOTATIONS' && activeTab !== 'PROPOSALS' && activeTab !== 'PRICE_LISTS' && activeTab !== 'REPORTS' && (
                    <div className="p-12 text-center text-slate-400">
                        <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-1">{activeTab.replace('_', ' ')}</h3>
                        <p className="text-sm">Submodule view ready for production transactions.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
