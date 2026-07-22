import React, { useState, useEffect, useMemo } from 'react';
import {
    ShieldCheck, FileText, CheckSquare, Clock, AlertTriangle, Plus, Search,
    Building2, Bell, RefreshCw, BarChart3, Settings, Filter, Download, UserCheck, Calendar
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PROApplication, PROLicense, PRODocument, PRORenewal, PROTask, Employee } from '../../types';
import { Modal } from '../ui/Modal';
import { ReportsListView } from './reports/ReportsListView';

export type PROViewMode = 'DASHBOARD' | 'APPLICATIONS' | 'GOVT_APPROVALS' | 'LICENSES' | 'DOCUMENTS' | 'RENEWALS' | 'TASKS' | 'REMINDERS' | 'REPORTS' | 'SETTINGS';

export const PROHub: React.FC = () => {
    const { user, currentCompanyId, hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState<PROViewMode>('DASHBOARD');

    const [applications, setApplications] = useState<PROApplication[]>([]);
    const [licenses, setLicenses] = useState<PROLicense[]>([]);
    const [documents, setDocuments] = useState<PRODocument[]>([]);
    const [renewals, setRenewals] = useState<PRORenewal[]>([]);
    const [tasks, setTasks] = useState<PROTask[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showAppModal, setShowAppModal] = useState(false);
    const [showLicenseModal, setShowLicenseModal] = useState(false);
    const [showDocModal, setShowDocModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);

    useEffect(() => {
        if (currentCompanyId) {
            fetchPROData();
        }
    }, [currentCompanyId, activeTab]);

    const fetchPROData = async () => {
        if (!currentCompanyId) return;
        setLoading(true);

        const [appsRes, licsRes, docsRes, renRes, tasksRes, empRes] = await Promise.all([
            supabase.from('pro_applications').select('*, applicant:employees!applicant_employee_id(name)').eq('company_id', currentCompanyId).order('created_at', { ascending: false }),
            supabase.from('pro_licenses').select('*').eq('company_id', currentCompanyId).order('created_at', { ascending: false }),
            supabase.from('pro_documents').select('*').eq('company_id', currentCompanyId).order('created_at', { ascending: false }),
            supabase.from('pro_renewals').select('*, assignee:employees!assigned_to(name)').eq('company_id', currentCompanyId).order('renewal_due_date', { ascending: true }),
            supabase.from('pro_tasks').select('*, assignee:employees!assigned_to(name)').eq('company_id', currentCompanyId).order('created_at', { ascending: false }),
            supabase.from('employees').select('*').eq('company_id', currentCompanyId)
        ]);

        if (appsRes.data) setApplications(appsRes.data as any);
        if (licsRes.data) setLicenses(licsRes.data as any);
        if (docsRes.data) setDocuments(docsRes.data as any);
        if (renRes.data) setRenewals(renRes.data as any);
        if (tasksRes.data) setTasks(tasksRes.data as any);
        if (empRes.data) setEmployees(empRes.data as any);

        setLoading(false);
    };

    const navItems = useMemo(() => [
        { id: 'DASHBOARD', icon: ShieldCheck, label: 'Dashboard' },
        { id: 'APPLICATIONS', icon: FileText, label: 'Applications' },
        { id: 'GOVT_APPROVALS', icon: Building2, label: 'Govt Approvals' },
        { id: 'LICENSES', icon: ShieldCheck, label: 'License Tracking' },
        { id: 'DOCUMENTS', icon: FileText, label: 'Doc Tracking' },
        { id: 'RENEWALS', icon: RefreshCw, label: 'Renewals' },
        { id: 'TASKS', icon: CheckSquare, label: 'Tasks' },
        { id: 'REMINDERS', icon: Bell, label: 'Reminders' },
        { id: 'REPORTS', icon: BarChart3, label: 'Reports' },
        { id: 'SETTINGS', icon: Settings, label: 'Settings' },
    ], []);

    const pendingApps = useMemo(() => applications.filter(a => a.status === 'PENDING' || a.status === 'IN_PROGRESS'), [applications]);
    const expiringLicenses = useMemo(() => licenses.filter(l => l.status === 'EXPIRING_SOON' || l.status === 'EXPIRED'), [licenses]);
    const upcomingRenewals = useMemo(() => renewals.filter(r => r.status !== 'RENEWED'), [renewals]);

    // Handle Create Application
    const handleCreateApplication = async (e: React.FormEvent) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        const payload = {
            company_id: currentCompanyId,
            title: fd.get('title') as string,
            application_number: fd.get('application_number') as string,
            application_type: fd.get('application_type') as string,
            sponsor_entity: fd.get('sponsor_entity') as string,
            applicant_employee_id: (fd.get('applicant_employee_id') as string) || null,
            submission_date: (fd.get('submission_date') as string) || new Date().toISOString().split('T')[0],
            expiry_date: (fd.get('expiry_date') as string) || null,
            cost: parseFloat((fd.get('cost') as string) || '0'),
            government_fees: parseFloat((fd.get('government_fees') as string) || '0'),
            status: 'PENDING',
            remarks: fd.get('remarks') as string
        };

        const { error } = await supabase.from('pro_applications').insert([payload]);
        if (error) alert("Error creating application: " + error.message);
        else {
            setShowAppModal(false);
            fetchPROData();
        }
    };

    // Handle Create License
    const handleCreateLicense = async (e: React.FormEvent) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        const payload = {
            company_id: currentCompanyId,
            license_name: fd.get('license_name') as string,
            license_number: fd.get('license_number') as string,
            issuing_authority: fd.get('issuing_authority') as string,
            issue_date: (fd.get('issue_date') as string) || null,
            expiry_date: (fd.get('expiry_date') as string) || null,
            fee_amount: parseFloat((fd.get('fee_amount') as string) || '0'),
            status: 'ACTIVE'
        };

        const { error } = await supabase.from('pro_licenses').insert([payload]);
        if (error) alert("Error creating license: " + error.message);
        else {
            setShowLicenseModal(false);
            fetchPROData();
        }
    };

    // Dashboard View Component
    const renderDashboard = () => (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            <header className="flex justify-between items-center mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Public Relations Office (PRO / Madoob)</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                        Manage corporate government relations, visa processing, trade licenses, and document renewals.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowAppModal(true)} className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> New Application
                    </button>
                    <button onClick={() => setShowLicenseModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add License
                    </button>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 shrink-0">
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Applications</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">{pendingApps.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Trade Licenses</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">{licenses.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Expiring / Overdue</p>
                        <h3 className="text-3xl font-black text-rose-600">{expiringLicenses.length + upcomingRenewals.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pending PRO Tasks</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">{tasks.filter(t => t.status !== 'COMPLETED').length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center">
                        <CheckSquare className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Grid Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Recent Government Applications */}
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Recent Applications</h3>
                    <div className="space-y-4 overflow-y-auto max-h-[350px]">
                        {applications.length > 0 ? applications.slice(0, 5).map(app => (
                            <div key={app.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                <div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{app.title}</p>
                                    <p className="text-xs text-slate-400">{app.application_type} • Ref: {app.application_number || 'N/A'}</p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                    app.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                    app.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {app.status}
                                </span>
                            </div>
                        )) : (
                            <p className="text-slate-400 italic text-sm py-8 text-center">No PRO applications logged yet.</p>
                        )}
                    </div>
                </div>

                {/* Company Licenses */}
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Commercial & Govt Licenses</h3>
                    <div className="space-y-4 overflow-y-auto max-h-[350px]">
                        {licenses.length > 0 ? licenses.slice(0, 5).map(lic => (
                            <div key={lic.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                <div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{lic.license_name}</p>
                                    <p className="text-xs text-slate-400">No: {lic.license_number} • Authority: {lic.issuing_authority || 'Govt'}</p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-xs font-mono text-slate-500">Exp: {lic.expiry_date || 'N/A'}</span>
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                        lic.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                        {lic.status}
                                    </span>
                                </div>
                            </div>
                        )) : (
                            <p className="text-slate-400 italic text-sm py-8 text-center">No trade licenses tracked yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-full relative z-10 overflow-hidden bg-slate-50 dark:bg-black/20">
            {/* PRO Sidebar */}
            <div className="w-20 md:w-64 flex-shrink-0 bg-white/40 dark:bg-zinc-900/40 border-r border-slate-200/50 dark:border-zinc-800 flex flex-col justify-between pt-8 pb-4 px-4 backdrop-blur-xl">
                <div className="flex flex-col gap-3">
                    <div className="mb-8 px-2 hidden md:block">
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className="w-6 h-6 text-blue-600" />
                            <span className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">PRO Office</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">Madoob Suite</span>
                    </div>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as PROViewMode)}
                            className={`flex items-center justify-between p-3.5 rounded-2xl transition-all active:scale-95 duration-200 ${activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
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

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'DASHBOARD' && renderDashboard()}
                {activeTab === 'APPLICATIONS' && (
                    <div className="p-8 h-full flex flex-col overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Government Applications</h2>
                            <button onClick={() => setShowAppModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm">New Application</button>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-400 uppercase">
                                    <tr>
                                        <th className="p-4">Title</th>
                                        <th className="p-4">Type</th>
                                        <th className="p-4">Ref Number</th>
                                        <th className="p-4">Submission Date</th>
                                        <th className="p-4">Govt Fees</th>
                                        <th className="p-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-sm">
                                    {applications.map((app) => (
                                        <tr key={app.id}>
                                            <td className="p-4 font-bold text-slate-800 dark:text-white">{app.title}</td>
                                            <td className="p-4 text-slate-600 dark:text-slate-300">{app.application_type}</td>
                                            <td className="p-4 font-mono text-slate-500">{app.application_number || '—'}</td>
                                            <td className="p-4 text-slate-500">{app.submission_date || '—'}</td>
                                            <td className="p-4 font-bold text-slate-700 dark:text-slate-200">${app.government_fees || 0}</td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">{app.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {applications.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No applications found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {activeTab === 'LICENSES' && (
                    <div className="p-8 h-full flex flex-col overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Commercial & Govt Licenses</h2>
                            <button onClick={() => setShowLicenseModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm">Add License</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {licenses.map(lic => (
                                <div key={lic.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800">
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{lic.license_name}</h3>
                                    <p className="text-xs text-slate-400 mb-4">No: {lic.license_number} • Authority: {lic.issuing_authority || 'N/A'}</p>
                                    <div className="flex justify-between text-xs text-slate-500 font-mono">
                                        <span>Issue: {lic.issue_date || '—'}</span>
                                        <span>Expiry: {lic.expiry_date || '—'}</span>
                                    </div>
                                </div>
                            ))}
                            {licenses.length === 0 && <p className="text-slate-400 italic py-8">No licenses tracked yet.</p>}
                        </div>
                    </div>
                )}
                {activeTab === 'REPORTS' && <ReportsListView moduleFilter="PRO" />}
                {activeTab !== 'DASHBOARD' && activeTab !== 'APPLICATIONS' && activeTab !== 'LICENSES' && activeTab !== 'REPORTS' && (
                    <div className="p-12 text-center text-slate-400">
                        <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-1">{activeTab.replace('_', ' ')}</h3>
                        <p className="text-sm">PRO submodule is ready for live records.</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showAppModal && (
                <Modal title="New Government Application" onClose={() => setShowAppModal(false)}>
                    <form onSubmit={handleCreateApplication} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Application Title *</label>
                            <input name="title" required placeholder="e.g. Employee Visa Renewal" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Application Type</label>
                                <select name="application_type" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                                    <option value="VISA">Employee Visa</option>
                                    <option value="TRADE_LICENSE">Trade License</option>
                                    <option value="LABOR_PERMIT">Labor Permit</option>
                                    <option value="CIVIL_ID">Civil ID / Emirates ID</option>
                                    <option value="COMMERCIAL">Commercial Approval</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reference Number</label>
                                <input name="application_number" placeholder="Ref/App #" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Govt Fees ($)</label>
                                <input name="government_fees" type="number" step="0.01" placeholder="0.00" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sponsor / Entity</label>
                                <input name="sponsor_entity" placeholder="Govt Ministry / Entity" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                            </div>
                        </div>
                        <textarea name="remarks" placeholder="Notes / Instructions..." className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white min-h-[80px]"></textarea>
                        <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:shadow-lg shadow-blue-500/30 transition-all">Submit Application</button>
                    </form>
                </Modal>
            )}

            {showLicenseModal && (
                <Modal title="Add Commercial / Govt License" onClose={() => setShowLicenseModal(false)}>
                    <form onSubmit={handleCreateLicense} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">License Name *</label>
                            <input name="license_name" required placeholder="e.g. Commercial Trade License" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">License Number *</label>
                                <input name="license_number" required placeholder="Lic #" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Issuing Authority</label>
                                <input name="issuing_authority" placeholder="e.g. Ministry of Commerce" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Issue Date</label>
                                <input name="issue_date" type="date" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expiry Date</label>
                                <input name="expiry_date" type="date" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                            </div>
                        </div>
                        <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:shadow-lg shadow-indigo-500/30 transition-all">Save License</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
