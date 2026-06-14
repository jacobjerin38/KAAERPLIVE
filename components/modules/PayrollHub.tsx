import React, { useState, useEffect, useMemo } from 'react';
import {
    DollarSign, FileText, LayoutDashboard, Settings, Play, Lock,
    Plus, Trash2, ShieldCheck, Check, Calendar, AlertCircle
} from 'lucide-react';
import { PayrollDashboard } from './hrms/PayrollDashboard';
import { ReportsListView } from './reports/ReportsListView';
import { PayrollViewMode } from '../../types';
import { Modal } from '../ui/Modal';

import { KAA_LOGO_URL } from '../../constants';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SalaryComponentRow {
    id?: string | number;
    name: string;
    code: string;
    component_type: 'EARNING' | 'DEDUCTION';
    is_taxable: boolean;
}

export const PayrollHub: React.FC = () => {
    const [activeTab, setActiveTab] = useState<PayrollViewMode>('OVERVIEW');
    const [companyId, setCompanyId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [runs, setRuns] = useState<any[]>([]);
    const [components, setComponents] = useState<SalaryComponentRow[]>([]);
    const [showComponentModal, setShowComponentModal] = useState(false);
    const [newComponent, setNewComponent] = useState<SalaryComponentRow>({
        name: '',
        code: '',
        component_type: 'EARNING',
        is_taxable: false
    });
    
    const { user, hasPermission } = useAuth();

    useEffect(() => {
        const fetchCompanyId = async () => {
            if (!user) return;
            const { data } = await supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle();
            if (data) {
                setCompanyId(data.company_id);
            }
        };
        fetchCompanyId();
    }, [user]);

    const refreshData = async () => {
        if (!companyId) return;
        setLoading(true);

        // Fetch payroll runs
        const { data: runsData } = await supabase.from('payroll_runs')
            .select('*')
            .eq('company_id', companyId)
            .order('month_year', { ascending: false });
        if (runsData) setRuns(runsData);

        // Fetch salary components
        const { data: compData } = await supabase.from('org_salary_components')
            .select('*')
            .eq('company_id', companyId);
        if (compData) setComponents(compData as any);

        setLoading(false);
    };

    useEffect(() => {
        if (companyId) {
            refreshData();
        }
    }, [companyId]);

    const handleAddComponent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComponent.name || !newComponent.code) return alert('Name and Code are required');
        
        const { error } = await supabase.from('org_salary_components').insert([{
            company_id: companyId,
            name: newComponent.name,
            code: newComponent.code.toUpperCase(),
            component_type: newComponent.component_type,
            is_taxable: newComponent.is_taxable
        }]);

        if (error) {
            alert('Error adding component: ' + error.message);
        } else {
            setShowComponentModal(false);
            setNewComponent({ name: '', code: '', component_type: 'EARNING', is_taxable: false });
            refreshData();
        }
    };

    const handleDeleteComponent = async (id: any) => {
        if (!confirm('Remove this salary component?')) return;
        const { error } = await supabase.from('org_salary_components').delete().eq('id', id);
        if (error) {
            alert('Error deleting component: ' + error.message);
        } else {
            refreshData();
        }
    };

    const navItems = useMemo(() => [
        { id: 'OVERVIEW', icon: LayoutDashboard, label: 'Overview', permission: 'finance.payroll.view' },
        { id: 'PROCESSING', icon: DollarSign, label: 'Processing', permission: 'finance.payroll.process' },
        { id: 'STRUCTURES', icon: Settings, label: 'Components', permission: 'finance.payroll.process' },
        { id: 'REPORTS', icon: FileText, label: 'Reports', permission: 'hrms.reports.view' },
    ].filter(item => hasPermission(item.permission) || hasPermission('*')), [hasPermission]);

    useEffect(() => {
        if (navItems.length > 0 && !navItems.find(i => i.id === activeTab)) {
            setActiveTab(navItems[0].id as PayrollViewMode);
        }
    }, [navItems, activeTab]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
            </div>
        );
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const renderOverview = () => {
        const lastRun = runs[0];
        const draftRuns = runs.filter(r => r.status === 'DRAFT');
        const paidRuns = runs.filter(r => r.status === 'PAID' || r.status === 'COMPLETED');

        return (
            <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
                <header className="flex justify-between items-center mb-8 shrink-0">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Payroll Suite</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Manage and track company payouts, revisions, and components.</p>
                    </div>
                    <button onClick={() => setActiveTab('PROCESSING')} className="px-5 py-2.5 bg-violet-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-violet-500/30 hover:bg-violet-700 transition-all active:scale-95 flex items-center gap-2">
                        <Play className="w-4 h-4 fill-current" /> Process Payroll
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Last Payout</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                                {lastRun ? formatCurrency(lastRun.total_net_pay || 0) : '$0.00'}
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">{lastRun ? `Month: ${lastRun.month_year}` : 'No runs processed yet'}</p>
                        </div>
                    </div>
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Draft Batches</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{draftRuns.length}</h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">Awaiting final approval</p>
                        </div>
                    </div>
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                            <Check className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Salary Components</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{components.length}</h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">Active structure components</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 flex-1">
                    {/* Historic Runs */}
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Historic Payroll Runs</h3>
                        <div className="space-y-4 overflow-y-auto pr-2 max-h-[400px]">
                            {runs.slice(0, 5).map(run => (
                                <div key={run.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-850 rounded-2xl border border-slate-100 dark:border-zinc-850 shadow-sm">
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{run.month_year}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Payout: {formatCurrency(run.total_net_pay || 0)}</p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                        run.status === 'PAID' || run.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 border-emerald-100' :
                                        'bg-amber-50 text-amber-600 dark:bg-amber-950/20 border-amber-100'
                                    }`}>
                                        {run.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Settings & Components Preview */}
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Active Salary Elements</h3>
                        <div className="space-y-4 overflow-y-auto pr-2 max-h-[400px]">
                            {components.slice(0, 5).map(comp => (
                                <div key={comp.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-850 rounded-2xl border border-slate-100 dark:border-zinc-850 shadow-sm">
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{comp.name}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Code: {comp.code} • {comp.is_taxable ? 'Taxable' : 'Non-taxable'}</p>
                                    </div>
                                    <span className={`px-2 py-1.5 rounded-xl text-xs font-bold ${
                                        comp.component_type === 'EARNING' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' :
                                        'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                                    }`}>
                                        {comp.component_type}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-full relative z-10 overflow-hidden bg-slate-50 dark:bg-black/20">
            {/* Sidebar */}
            <div className="w-20 md:w-64 flex-shrink-0 bg-white/40 dark:bg-zinc-900/40 border-r border-slate-200/50 dark:border-zinc-800 flex flex-col justify-between pt-8 pb-4 px-4 backdrop-blur-xl">
                <div className="flex flex-col gap-3">
                    <div className="mb-8 px-2 hidden md:block">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-6 h-6 text-violet-600" />
                            <span className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">Payroll</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">Finance & Payslips</span>
                    </div>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as PayrollViewMode)}
                            className={`flex items-center justify-between p-3.5 rounded-2xl transition-all active:scale-95 duration-200 ${activeTab === item.id
                                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
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
                {activeTab === 'OVERVIEW' && renderOverview()}
                {activeTab === 'PROCESSING' && <PayrollDashboard />}
                {activeTab === 'STRUCTURES' && (
                    <div className="p-8 h-full flex flex-col overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Salary Components</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Configure earnings, deductions, and tax statuses</p>
                            </div>
                            <button onClick={() => setShowComponentModal(true)} className="px-5 py-2.5 bg-violet-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-violet-500/30 hover:bg-violet-700 transition-all active:scale-95 flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Add Component
                            </button>
                        </div>

                        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/80 dark:bg-zinc-800/80 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Component Name</th>
                                        <th className="px-6 py-4">Code</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Taxable Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50">
                                    {components.map(comp => (
                                        <tr key={comp.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{comp.name}</td>
                                            <td className="px-6 py-4 font-mono text-sm text-slate-600 dark:text-slate-400">{comp.code}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                    comp.component_type === 'EARNING' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                                                }`}>
                                                    {comp.component_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    comp.is_taxable ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20' : 'bg-slate-50 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                                                }`}>
                                                    {comp.is_taxable ? 'Taxable' : 'Exempt'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleDeleteComponent(comp.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                                                    <Trash2 className="w-4 h-4 text-rose-500" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {components.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-10 text-slate-400 italic">No components configured.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {activeTab === 'REPORTS' && <ReportsListView moduleFilter="PAYROLL" />}
            </div>

            {showComponentModal && (
                <Modal title="Add Salary Component" onClose={() => setShowComponentModal(false)}>
                    <form onSubmit={handleAddComponent} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Component Name</label>
                            <input
                                type="text"
                                required
                                value={newComponent.name}
                                onChange={e => setNewComponent(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g. Basic Salary"
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Code</label>
                            <input
                                type="text"
                                required
                                value={newComponent.code}
                                onChange={e => setNewComponent(prev => ({ ...prev, code: e.target.value }))}
                                placeholder="e.g. BASIC"
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                            <select
                                value={newComponent.component_type}
                                onChange={e => setNewComponent(prev => ({ ...prev, component_type: e.target.value as any }))}
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                            >
                                <option value="EARNING">Earning</option>
                                <option value="DEDUCTION">Deduction</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_taxable"
                                checked={newComponent.is_taxable}
                                onChange={e => setNewComponent(prev => ({ ...prev, is_taxable: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                            />
                            <label htmlFor="is_taxable" className="text-sm font-medium text-slate-700 dark:text-slate-300">Is this component taxable?</label>
                        </div>
                        <button className="w-full py-4 bg-violet-600 text-white rounded-2xl font-bold hover:shadow-lg shadow-violet-500/30 transition-all active:scale-95">Add Component</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
