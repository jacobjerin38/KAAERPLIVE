import React, { useState, useEffect, useMemo } from 'react';
import {
    ShieldCheck, FileText, CheckSquare, Clock, AlertTriangle, Plus, Search,
    Building2, Bell, RefreshCw, BarChart3, Settings, Filter, Download, UserCheck, Calendar,
    User, ExternalLink, ArrowRight, CheckCircle, Upload, Landmark, MapPin, DollarSign, ChevronRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { ReportsListView } from './reports/ReportsListView';

export type PROViewMode = 'DASHBOARD' | 'APPLICATIONS' | 'TASKS' | 'LICENSES' | 'EMPLOYEE_DOCS' | 'REPORTS';

export const PROHub: React.FC = () => {
    const { currentCompanyId, hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState<PROViewMode>('DASHBOARD');

    const [applications, setApplications] = useState<any[]>([]);
    const [licenses, setLicenses] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Modals
    const [showAppModal, setShowAppModal] = useState(false);
    const [showLicenseModal, setShowLicenseModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showCompleteTaskModal, setShowCompleteTaskModal] = useState<any>(null);
    const [selectedAppForTask, setSelectedAppForTask] = useState<any>(null);
    const [selectedEmpForRenewal, setSelectedEmpForRenewal] = useState<any>(null);

    // Form states
    const [appForm, setAppForm] = useState({
        title: '',
        application_type: 'QID_RENEWAL',
        applicant_employee_id: '',
        qid_number: '',
        passport_number: '',
        sponsor_entity: '',
        government_fees: '0',
        urgent_flag: false,
        remarks: ''
    });

    const [taskForm, setTaskForm] = useState({
        task_name: '',
        description: '',
        assigned_to: '',
        govt_office: 'Ministry of Interior (MOI)',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'MEDIUM',
        location_address: '',
        related_application_id: ''
    });

    const [licenseForm, setLicenseForm] = useState({
        license_name: '',
        license_number: '',
        issuing_authority: '',
        issue_date: '',
        expiry_date: '',
        fee_amount: '0',
        alert_days: '30'
    });

    const [completeTaskForm, setCompleteTaskForm] = useState({
        result_notes: '',
        fee_paid: '0',
        new_expiry_date: ''
    });
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [documentFile, setDocumentFile] = useState<File | null>(null);

    useEffect(() => {
        if (currentCompanyId) {
            fetchPROData();
        }
    }, [currentCompanyId, activeTab]);

    const fetchPROData = async () => {
        if (!currentCompanyId) return;
        setLoading(true);

        try {
            const [appsRes, licsRes, tasksRes, empRes] = await Promise.all([
                (supabase as any).from('pro_applications')
                    .select('*, applicant:employees!applicant_employee_id(id, name, designation, department, q_id, passport_no)')
                    .eq('company_id', currentCompanyId)
                    .order('created_at', { ascending: false }),
                (supabase as any).from('pro_licenses')
                    .select('*')
                    .eq('company_id', currentCompanyId)
                    .order('expiry_date', { ascending: true }),
                (supabase as any).from('pro_tasks')
                    .select('*, assignee:employees!assigned_to(name), application:pro_applications(title, application_type, applicant_employee_id)')
                    .eq('company_id', currentCompanyId)
                    .order('created_at', { ascending: false }),
                (supabase as any).from('employees')
                    .select('id, name, designation, department, email, q_id, q_id_expiry, passport_no, passport_expiry, visa_no, visa_expiry, join_date')
                    .eq('company_id', currentCompanyId)
            ]);

            if (appsRes.data) setApplications(appsRes.data);
            if (licsRes.data) setLicenses(licsRes.data);
            if (tasksRes.data) setTasks(tasksRes.data);
            if (empRes.data) setEmployees(empRes.data);
        } catch (err) {
            console.error('Error fetching PRO data:', err);
        }

        setLoading(false);
    };

    // Calculate Expiry Radar Metrics
    const today = new Date();
    const getDaysRemaining = (dateStr?: string) => {
        if (!dateStr) return 999;
        const target = new Date(dateStr);
        const diff = target.getTime() - today.getTime();
        return Math.ceil(diff / (1000 * 3600 * 24));
    };

    const expiringEmployees = useMemo(() => {
        return employees.filter(emp => {
            const qidDays = getDaysRemaining(emp.q_id_expiry);
            const passDays = getDaysRemaining(emp.passport_expiry);
            const visaDays = getDaysRemaining(emp.visa_expiry);
            return (qidDays <= 90 || passDays <= 90 || visaDays <= 90);
        });
    }, [employees]);

    const expiringLicenses = useMemo(() => {
        return licenses.filter(lic => getDaysRemaining(lic.expiry_date) <= 60);
    }, [licenses]);

    const totalGovtFeesPaid = useMemo(() => {
        return tasks.filter(t => t.status === 'COMPLETED').reduce((acc, t) => acc + (parseFloat(t.fee_paid) || 0), 0);
    }, [tasks]);

    // Handle Stage Update
    const handleUpdateStage = async (appId: string, newStage: string, newStatus?: string) => {
        try {
            const updatePayload: any = { stage: newStage };
            if (newStatus) updatePayload.status = newStatus;

            const { error } = await (supabase as any).from('pro_applications').update(updatePayload).eq('id', appId);
            if (error) throw error;

            fetchPROData();
        } catch (err: any) {
            alert('Failed to update stage: ' + err.message);
        }
    };

    // Handle Create Application
    const handleCreateApplication = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const selectedEmp = employees.find(emp => emp.id === appForm.applicant_employee_id);

            const { error } = await (supabase as any).from('pro_applications').insert([{
                company_id: currentCompanyId,
                title: appForm.title,
                application_type: appForm.application_type,
                service_category: appForm.application_type,
                applicant_employee_id: appForm.applicant_employee_id || null,
                qid_number: appForm.qid_number || selectedEmp?.q_id || null,
                passport_number: appForm.passport_number || selectedEmp?.passport_no || null,
                sponsor_entity: appForm.sponsor_entity || 'Company',
                government_fees: parseFloat(appForm.government_fees || '0'),
                urgent_flag: appForm.urgent_flag,
                remarks: appForm.remarks,
                submission_date: new Date().toISOString().split('T')[0],
                status: 'IN_PROGRESS',
                stage: 'SUBMITTED'
            }]);

            if (error) throw error;

            setShowAppModal(false);
            setAppForm({ title: '', application_type: 'QID_RENEWAL', applicant_employee_id: '', qid_number: '', passport_number: '', sponsor_entity: '', government_fees: '0', urgent_flag: false, remarks: '' });
            fetchPROData();
        } catch (err: any) {
            alert('Error creating application: ' + err.message);
        }
    };

    // Handle Create Field Task
    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await (supabase as any).from('pro_tasks').insert([{
                company_id: currentCompanyId,
                task_name: taskForm.task_name,
                description: taskForm.description,
                assigned_to: taskForm.assigned_to || null,
                govt_office: taskForm.govt_office,
                due_date: taskForm.due_date,
                priority: taskForm.priority,
                location_address: taskForm.location_address,
                related_application_id: taskForm.related_application_id || selectedAppForTask?.id || null,
                status: 'PENDING'
            }]);

            if (error) throw error;

            setShowTaskModal(false);
            setSelectedAppForTask(null);
            setTaskForm({ task_name: '', description: '', assigned_to: '', govt_office: 'Ministry of Interior (MOI)', due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], priority: 'MEDIUM', location_address: '', related_application_id: '' });
            fetchPROData();
        } catch (err: any) {
            alert('Error creating task: ' + err.message);
        }
    };

    // Handle Complete Task & Auto Sync to HRMS
    const handleCompleteTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showCompleteTaskModal) return;

        try {
            let receiptUrl = '';
            let docUrl = '';

            if (receiptFile) {
                const path = `${currentCompanyId}/pro/receipts/${Date.now()}_${receiptFile.name}`;
                const { error: uploadErr } = await supabase.storage.from('attachments').upload(path, receiptFile);
                if (!uploadErr) {
                    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
                    receiptUrl = data.publicUrl;
                }
            }

            if (documentFile) {
                const path = `${currentCompanyId}/pro/issued/${Date.now()}_${documentFile.name}`;
                const { error: uploadErr } = await supabase.storage.from('attachments').upload(path, documentFile);
                if (!uploadErr) {
                    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
                    docUrl = data.publicUrl;
                }
            }

            // 1. Update pro_tasks
            const { error: taskErr } = await (supabase as any).from('pro_tasks').update({
                status: 'COMPLETED',
                completed_at: new Date().toISOString(),
                result_notes: completeTaskForm.result_notes,
                fee_paid: parseFloat(completeTaskForm.fee_paid || '0'),
                receipt_url: receiptUrl || null
            }).eq('id', showCompleteTaskModal.id);

            if (taskErr) throw taskErr;

            // 2. If related to pro_applications, update app stage to COMPLETED
            const relApp = showCompleteTaskModal.application;
            const appId = showCompleteTaskModal.related_application_id;

            if (appId) {
                await (supabase as any).from('pro_applications').update({
                    status: 'COMPLETED',
                    stage: 'ISSUED'
                }).eq('id', appId);

                // 3. HRMS AUTO-SYNC: If application has applicant_employee_id and new_expiry_date, update employee HRMS record!
                if (relApp?.applicant_employee_id && completeTaskForm.new_expiry_date) {
                    const empId = relApp.applicant_employee_id;
                    const appType = relApp.application_type;

                    const empUpdate: any = {};
                    if (appType === 'QID_RENEWAL') empUpdate.q_id_expiry = completeTaskForm.new_expiry_date;
                    if (appType === 'VISA_RENEWAL') empUpdate.visa_expiry = completeTaskForm.new_expiry_date;
                    if (appType === 'PASSPORT_RELEASE') empUpdate.passport_expiry = completeTaskForm.new_expiry_date;

                    if (Object.keys(empUpdate).length > 0) {
                        await (supabase as any).from('employees').update(empUpdate).eq('id', empId);
                    }

                    // Also add document entry to employee_documents if file was uploaded
                    if (docUrl) {
                        await (supabase as any).from('employee_documents').insert([{
                            company_id: currentCompanyId,
                            employee_id: empId,
                            document_name: `${appType || 'Govt Document'} - Issued ${new Date().toLocaleDateString()}`,
                            document_type: appType,
                            file_url: docUrl,
                            expiry_date: completeTaskForm.new_expiry_date
                        }]);
                    }
                }
            }

            alert('Task completed successfully! HRMS employee records synchronized.');
            setShowCompleteTaskModal(null);
            setReceiptFile(null);
            setDocumentFile(null);
            setCompleteTaskForm({ result_notes: '', fee_paid: '0', new_expiry_date: '' });
            fetchPROData();
        } catch (err: any) {
            alert('Error completing task: ' + err.message);
        }
    };

    // Handle Create License
    const handleCreateLicense = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await (supabase as any).from('pro_licenses').insert([{
                company_id: currentCompanyId,
                license_name: licenseForm.license_name,
                license_number: licenseForm.license_number,
                issuing_authority: licenseForm.issuing_authority,
                issue_date: licenseForm.issue_date || null,
                expiry_date: licenseForm.expiry_date || null,
                fee_amount: parseFloat(licenseForm.fee_amount || '0'),
                alert_days: parseInt(licenseForm.alert_days || '30'),
                status: 'ACTIVE'
            }]);

            if (error) throw error;

            setShowLicenseModal(false);
            setLicenseForm({ license_name: '', license_number: '', issuing_authority: '', issue_date: '', expiry_date: '', fee_amount: '0', alert_days: '30' });
            fetchPROData();
        } catch (err: any) {
            alert('Error adding license: ' + err.message);
        }
    };

    // Nav items
    const navItems = [
        { id: 'DASHBOARD', icon: ShieldCheck, label: 'Dashboard & Radar' },
        { id: 'APPLICATIONS', icon: FileText, label: 'Govt Applications' },
        { id: 'TASKS', icon: CheckSquare, label: 'Madoob Field Tasks' },
        { id: 'LICENSES', icon: Building2, label: 'Commercial Licenses' },
        { id: 'EMPLOYEE_DOCS', icon: UserCheck, label: 'HRMS Doc Monitor' },
        { id: 'REPORTS', icon: BarChart3, label: 'Govt Fee Reports' },
    ];

    return (
        <div className="flex h-full relative z-10 overflow-hidden bg-slate-50 dark:bg-black/20">
            {/* Sidebar Navigation */}
            <div className="w-20 md:w-64 flex-shrink-0 bg-white/40 dark:bg-zinc-900/40 border-r border-slate-200/50 dark:border-zinc-800 flex flex-col justify-between pt-8 pb-4 px-4 backdrop-blur-xl">
                <div className="flex flex-col gap-3">
                    <div className="mb-6 px-2 hidden md:block">
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className="w-6 h-6 text-blue-600" />
                            <span className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">PRO & Madoob</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded-md">Govt Relations</span>
                    </div>

                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as PROViewMode)}
                            className={`flex items-center justify-between p-3.5 rounded-2xl transition-all active:scale-95 duration-200 ${activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-zinc-800/60 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className="w-5 h-5" />
                                <span className="hidden md:inline font-bold text-sm tracking-tight">{item.label}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {/* 1. DASHBOARD & RADAR */}
                {activeTab === 'DASHBOARD' && (
                    <div className="p-8 h-full flex flex-col overflow-y-auto animate-page-enter">
                        <header className="flex justify-between items-center mb-8 shrink-0">
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">PRO & Government Services Hub</h1>
                                <p className="text-slate-500 text-sm font-medium mt-1">Manage employee QID/Visa renewals, corporate trade licenses, and Madoob field task dispatches.</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowAppModal(true)} className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center gap-2">
                                    <Plus className="w-4 h-4" /> New Govt Application
                                </button>
                                <button onClick={() => setShowTaskModal(true)} className="px-5 py-2.5 bg-amber-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-amber-500/30 hover:bg-amber-700 transition-all flex items-center gap-2">
                                    <Plus className="w-4 h-4" /> Dispatch PRO Task
                                </button>
                            </div>
                        </header>

                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 shrink-0">
                            <div className="bg-white/70 dark:bg-zinc-900/70 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Applications</p>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">{applications.filter(a => a.status === 'IN_PROGRESS' || a.status === 'PENDING').length}</h3>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <FileText className="w-6 h-6" />
                                </div>
                            </div>

                            <div className="bg-white/70 dark:bg-zinc-900/70 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Doc Expiries (&lt;90 Days)</p>
                                    <h3 className="text-3xl font-black text-rose-600">{expiringEmployees.length}</h3>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                            </div>

                            <div className="bg-white/70 dark:bg-zinc-900/70 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending PRO Field Tasks</p>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">{tasks.filter(t => t.status === 'PENDING').length}</h3>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                    <CheckSquare className="w-6 h-6" />
                                </div>
                            </div>

                            <div className="bg-white/70 dark:bg-zinc-900/70 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Govt Fees Paid</p>
                                    <h3 className="text-3xl font-black text-emerald-600">${totalGovtFeesPaid.toLocaleString()}</h3>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <DollarSign className="w-6 h-6" />
                                </div>
                            </div>
                        </div>

                        {/* Recent Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            {/* Urgent Employee Expiry Radar */}
                            <div className="bg-white dark:bg-zinc-900/70 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-rose-600" /> HRMS Document Expiry Radar
                                    </h3>
                                    <button onClick={() => setActiveTab('EMPLOYEE_DOCS')} className="text-xs font-bold text-blue-600 hover:underline">View All ({employees.length})</button>
                                </div>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                    {expiringEmployees.length > 0 ? expiringEmployees.slice(0, 4).map(emp => (
                                        <div key={emp.id} className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">{emp.name}</p>
                                                <p className="text-xs text-slate-500">{emp.designation} • QID: {emp.q_id || 'N/A'}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right text-xs">
                                                    <p className="font-bold text-rose-600">QID Exp: {emp.q_id_expiry || 'N/A'}</p>
                                                    <p className="text-slate-400">Visa: {emp.visa_expiry || 'N/A'}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setSelectedEmpForRenewal(emp);
                                                        setAppForm({
                                                            ...appForm,
                                                            title: `QID & Visa Renewal - ${emp.name}`,
                                                            applicant_employee_id: emp.id,
                                                            qid_number: emp.q_id || '',
                                                            passport_number: emp.passport_no || ''
                                                        });
                                                        setShowAppModal(true);
                                                    }}
                                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
                                                >
                                                    Renew
                                                </button>
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-slate-400 italic py-6 text-center text-sm">All employee documents are up to date.</p>
                                    )}
                                </div>
                            </div>

                            {/* Pending PRO Field Tasks */}
                            <div className="bg-white dark:bg-zinc-900/70 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <CheckSquare className="w-5 h-5 text-amber-600" /> Dispatch Task Queue
                                    </h3>
                                    <button onClick={() => setActiveTab('TASKS')} className="text-xs font-bold text-blue-600 hover:underline">Manage Tasks</button>
                                </div>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                    {tasks.filter(t => t.status === 'PENDING').length > 0 ? tasks.filter(t => t.status === 'PENDING').slice(0, 4).map(t => (
                                        <div key={t.id} className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">{t.govt_office || 'MOI'}</span>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{t.task_name}</p>
                                                </div>
                                                <p className="text-xs text-slate-400">Assigned: {t.assignee?.name || 'Unassigned'} • Due: {t.due_date || 'N/A'}</p>
                                            </div>
                                            <button
                                                onClick={() => setShowCompleteTaskModal(t)}
                                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                                            >
                                                Complete Task
                                            </button>
                                        </div>
                                    )) : (
                                        <p className="text-slate-400 italic py-6 text-center text-sm">No pending field tasks.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. GOVT APPLICATIONS & ESSP REQUESTS */}
                {activeTab === 'APPLICATIONS' && (
                    <div className="p-8 h-full flex flex-col overflow-y-auto animate-page-enter">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Government Applications & Requests</h2>
                                <p className="text-xs text-slate-500">Corporate filings and employee self-service government requests.</p>
                            </div>
                            <button onClick={() => setShowAppModal(true)} className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-md hover:bg-blue-700">
                                + New Application
                            </button>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-400 uppercase">
                                    <tr>
                                        <th className="p-4">Application Title</th>
                                        <th className="p-4">Applicant Employee</th>
                                        <th className="p-4">Service Type</th>
                                        <th className="p-4">QID / Passport #</th>
                                        <th className="p-4">Submission Date</th>
                                        <th className="p-4">Current Stage</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-sm">
                                    {applications.map(app => (
                                        <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                            <td className="p-4">
                                                <p className="font-bold text-slate-900 dark:text-white">{app.title}</p>
                                                <p className="text-xs text-slate-400">Ref: {app.application_number || app.id.slice(0, 8)}</p>
                                            </td>
                                            <td className="p-4">
                                                <p className="font-bold text-slate-800 dark:text-slate-200">{app.applicant?.name || 'Company Filing'}</p>
                                                <p className="text-xs text-slate-400">{app.applicant?.designation || 'Corporate'}</p>
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                    {app.application_type}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono text-xs text-slate-500">
                                                QID: {app.qid_number || 'N/A'} <br /> Pass: {app.passport_number || 'N/A'}
                                            </td>
                                            <td className="p-4 text-slate-500">{app.submission_date || 'N/A'}</td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase ${
                                                    app.stage === 'ISSUED' || app.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                    app.stage === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {app.stage || app.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedAppForTask(app);
                                                        setTaskForm({
                                                            ...taskForm,
                                                            task_name: `Field Task: ${app.title}`,
                                                            description: `Process ${app.application_type} for ${app.applicant?.name || 'Company'}. QID: ${app.qid_number || 'N/A'}`,
                                                            related_application_id: app.id
                                                        });
                                                        setShowTaskModal(true);
                                                    }}
                                                    className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-100"
                                                >
                                                    Dispatch Task
                                                </button>
                                                {app.stage !== 'ISSUED' && (
                                                    <button
                                                        onClick={() => handleUpdateStage(app.id, 'ISSUED', 'COMPLETED')}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                                                    >
                                                        Mark Issued
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {applications.length === 0 && (
                                        <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No government applications found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 3. MADOOB FIELD TASKS */}
                {activeTab === 'TASKS' && (
                    <div className="p-8 h-full flex flex-col overflow-y-auto animate-page-enter">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Madoob Field Task Dispatcher</h2>
                                <p className="text-xs text-slate-500">Assign government office field visits to PRO agents and track completion.</p>
                            </div>
                            <button onClick={() => setShowTaskModal(true)} className="px-5 py-2.5 bg-amber-600 text-white rounded-2xl font-bold text-sm shadow-md hover:bg-amber-700">
                                + Dispatch New Task
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {tasks.map(t => (
                                <div key={t.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                                {t.govt_office || 'Govt Ministry'}
                                            </span>
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                                                t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {t.status}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">{t.task_name}</h3>
                                        <p className="text-xs text-slate-500 mb-4">{t.description}</p>
                                        <div className="text-xs space-y-1 text-slate-400 font-mono mb-4">
                                            <p>Assigned PRO: <span className="font-bold text-slate-700 dark:text-slate-200">{t.assignee?.name || 'Unassigned'}</span></p>
                                            <p>Target Due: {t.due_date || 'N/A'}</p>
                                            {t.fee_paid > 0 && <p className="text-emerald-600 font-bold">Fee Paid: ${t.fee_paid}</p>}
                                        </div>
                                    </div>
                                    {t.status !== 'COMPLETED' ? (
                                        <button
                                            onClick={() => setShowCompleteTaskModal(t)}
                                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all"
                                        >
                                            Mark Completed & Sync HRMS
                                        </button>
                                    ) : (
                                        <p className="text-xs text-emerald-600 font-bold text-center bg-emerald-50 p-2 rounded-xl">Completed & Sync'd</p>
                                    )}
                                </div>
                            ))}
                            {tasks.length === 0 && <p className="text-slate-400 italic py-8 col-span-3 text-center">No field tasks logged.</p>}
                        </div>
                    </div>
                )}

                {/* 4. COMMERCIAL LICENSES */}
                {activeTab === 'LICENSES' && (
                    <div className="p-8 h-full flex flex-col overflow-y-auto animate-page-enter">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Commercial & Trade Licenses</h2>
                                <p className="text-xs text-slate-500">Commercial Registrations (CR), Establishment Cards, Computer Cards, and Tax Licenses.</p>
                            </div>
                            <button onClick={() => setShowLicenseModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-md hover:bg-indigo-700">
                                + Add License
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {licenses.map(lic => {
                                const daysLeft = getDaysRemaining(lic.expiry_date);
                                return (
                                    <div key={lic.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{lic.license_name}</h3>
                                                <p className="text-xs text-slate-400">Lic #: {lic.license_number} • Authority: {lic.issuing_authority || 'Govt'}</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase ${
                                                daysLeft <= 0 ? 'bg-rose-100 text-rose-700' :
                                                daysLeft <= 60 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                                {daysLeft <= 0 ? 'Expired' : `${daysLeft} Days Left`}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500 font-mono mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                            <span>Issued: {lic.issue_date || 'N/A'}</span>
                                            <span>Expiry: {lic.expiry_date || 'N/A'}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {licenses.length === 0 && <p className="text-slate-400 italic py-8 col-span-2 text-center">No corporate trade licenses tracked yet.</p>}
                        </div>
                    </div>
                )}

                {/* 5. HRMS EMPLOYEE DOCUMENT MONITOR */}
                {activeTab === 'EMPLOYEE_DOCS' && (
                    <div className="p-8 h-full flex flex-col overflow-y-auto animate-page-enter">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">HRMS Employee Document Monitor</h2>
                                <p className="text-xs text-slate-500">Live grid of QID, Passport, and Residence Visa expiry dates across all employees.</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-400 uppercase">
                                    <tr>
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">QID / Civil ID #</th>
                                        <th className="p-4">QID Expiry</th>
                                        <th className="p-4">Passport #</th>
                                        <th className="p-4">Passport Expiry</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-sm">
                                    {employees.map(emp => {
                                        const qidDays = getDaysRemaining(emp.q_id_expiry);
                                        const passDays = getDaysRemaining(emp.passport_expiry);

                                        return (
                                            <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-900 dark:text-white">{emp.name}</p>
                                                    <p className="text-xs text-slate-400">{emp.designation || 'Staff'} • {emp.department || 'General'}</p>
                                                </td>
                                                <td className="p-4 font-mono text-slate-700 dark:text-slate-300">{emp.q_id || 'N/A'}</td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                        qidDays <= 30 ? 'bg-rose-100 text-rose-700' :
                                                        qidDays <= 90 ? 'bg-amber-100 text-amber-700' : 'text-slate-600'
                                                    }`}>
                                                        {emp.q_id_expiry || 'Not set'}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-mono text-slate-700 dark:text-slate-300">{emp.passport_no || 'N/A'}</td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                        passDays <= 30 ? 'bg-rose-100 text-rose-700' :
                                                        passDays <= 90 ? 'bg-amber-100 text-amber-700' : 'text-slate-600'
                                                    }`}>
                                                        {emp.passport_expiry || 'Not set'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedEmpForRenewal(emp);
                                                            setAppForm({
                                                                ...appForm,
                                                                title: `QID & Visa Renewal - ${emp.name}`,
                                                                applicant_employee_id: emp.id,
                                                                qid_number: emp.q_id || '',
                                                                passport_number: emp.passport_no || ''
                                                            });
                                                            setShowAppModal(true);
                                                        }}
                                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
                                                    >
                                                        Initiate PRO Renewal
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 6. REPORTS */}
                {activeTab === 'REPORTS' && <ReportsListView moduleFilter="PRO" />}
            </div>

            {/* MODALS */}
            {/* 1. New Govt Application Modal */}
            {showAppModal && (
                <Modal title="New Government Application" onClose={() => setShowAppModal(false)}>
                    <form onSubmit={handleCreateApplication} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Application Title *</label>
                            <input
                                value={appForm.title}
                                onChange={e => setAppForm({ ...appForm, title: e.target.value })}
                                required
                                placeholder="e.g. Employee Visa & QID Renewal"
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Applicant Employee</label>
                                <select
                                    value={appForm.applicant_employee_id}
                                    onChange={e => {
                                        const emp = employees.find(m => m.id === e.target.value);
                                        setAppForm({
                                            ...appForm,
                                            applicant_employee_id: e.target.value,
                                            qid_number: emp?.q_id || appForm.qid_number,
                                            passport_number: emp?.passport_no || appForm.passport_number
                                        });
                                    }}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                >
                                    <option value="">— Corporate / No Employee —</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.q_id || 'No QID'})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Service Category</label>
                                <select
                                    value={appForm.application_type}
                                    onChange={e => setAppForm({ ...appForm, application_type: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                >
                                    <option value="QID_RENEWAL">QID / Civil ID Renewal</option>
                                    <option value="VISA_RENEWAL">Residence / Work Visa Renewal</option>
                                    <option value="PASSPORT_RELEASE">Passport Release / Hold</option>
                                    <option value="NOC_REQUEST">No Objection Certificate (NOC)</option>
                                    <option value="EXIT_PERMIT">Travel Clearance / Exit Permit</option>
                                    <option value="TRADE_LICENSE">Trade License Renewal</option>
                                    <option value="COMMERCIAL">Commercial Registration (CR)</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">QID Number</label>
                                <input
                                    value={appForm.qid_number}
                                    onChange={e => setAppForm({ ...appForm, qid_number: e.target.value })}
                                    placeholder="QID #"
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Passport Number</label>
                                <input
                                    value={appForm.passport_number}
                                    onChange={e => setAppForm({ ...appForm, passport_number: e.target.value })}
                                    placeholder="Passport #"
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono"
                                />
                            </div>
                        </div>
                        <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20">
                            Create Application
                        </button>
                    </form>
                </Modal>
            )}

            {/* 2. Dispatch PRO Field Task Modal */}
            {showTaskModal && (
                <Modal title="Dispatch PRO Field Task" onClose={() => setShowTaskModal(false)}>
                    <form onSubmit={handleCreateTask} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Task Title *</label>
                            <input
                                value={taskForm.task_name}
                                onChange={e => setTaskForm({ ...taskForm, task_name: e.target.value })}
                                required
                                placeholder="e.g. MOI Fingerprinting & Medical Test Visit"
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assign PRO Agent</label>
                                <select
                                    value={taskForm.assigned_to}
                                    onChange={e => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                >
                                    <option value="">— Unassigned (Field Queue) —</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.designation || 'PRO'})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Govt Office</label>
                                <select
                                    value={taskForm.govt_office}
                                    onChange={e => setTaskForm({ ...taskForm, govt_office: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                >
                                    <option value="Ministry of Interior (MOI)">Ministry of Interior (MOI)</option>
                                    <option value="Ministry of Labor (MOL)">Ministry of Labor (MOL)</option>
                                    <option value="Ministry of Commerce (MOCI)">Ministry of Commerce (MOCI)</option>
                                    <option value="Traffic & Licensing Dept">Traffic & Licensing Dept</option>
                                    <option value="Chamber of Commerce">Chamber of Commerce</option>
                                </select>
                            </div>
                        </div>
                        <button className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-amber-500/20">
                            Dispatch Task
                        </button>
                    </form>
                </Modal>
            )}

            {/* 3. Complete Task Modal & HRMS Sync */}
            {showCompleteTaskModal && (
                <Modal title="Complete Field Task & Sync HRMS" onClose={() => setShowCompleteTaskModal(null)}>
                    <form onSubmit={handleCompleteTask} className="space-y-4">
                        <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{showCompleteTaskModal.task_name}</p>
                            <p className="text-xs text-slate-500 mb-4">{showCompleteTaskModal.description}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Actual Fee Paid ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={completeTaskForm.fee_paid}
                                onChange={e => setCompleteTaskForm({ ...completeTaskForm, fee_paid: e.target.value })}
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Document Expiry Date (Auto-syncs to HRMS)</label>
                            <input
                                type="date"
                                value={completeTaskForm.new_expiry_date}
                                onChange={e => setCompleteTaskForm({ ...completeTaskForm, new_expiry_date: e.target.value })}
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Result Notes / Remarks</label>
                            <textarea
                                value={completeTaskForm.result_notes}
                                onChange={e => setCompleteTaskForm({ ...completeTaskForm, result_notes: e.target.value })}
                                placeholder="Notes on completion..."
                                rows={2}
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                            ></textarea>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Upload Issued Document / Receipt</label>
                            <input
                                type="file"
                                onChange={e => setDocumentFile(e.target.files?.[0] || null)}
                                className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-emerald-50 file:text-emerald-700"
                            />
                        </div>
                        <button className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20">
                            Confirm Completion & Sync HRMS
                        </button>
                    </form>
                </Modal>
            )}

            {/* 4. Add License Modal */}
            {showLicenseModal && (
                <Modal title="Add Corporate Commercial License" onClose={() => setShowLicenseModal(false)}>
                    <form onSubmit={handleCreateLicense} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">License Name *</label>
                            <input
                                value={licenseForm.license_name}
                                onChange={e => setLicenseForm({ ...licenseForm, license_name: e.target.value })}
                                required
                                placeholder="e.g. Commercial Trade License"
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">License Number *</label>
                                <input
                                    value={licenseForm.license_number}
                                    onChange={e => setLicenseForm({ ...licenseForm, license_number: e.target.value })}
                                    required
                                    placeholder="Lic #"
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Issuing Authority</label>
                                <input
                                    value={licenseForm.issuing_authority}
                                    onChange={e => setLicenseForm({ ...licenseForm, issuing_authority: e.target.value })}
                                    placeholder="e.g. MOCI / Ministry of Commerce"
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Issue Date</label>
                                <input
                                    type="date"
                                    value={licenseForm.issue_date}
                                    onChange={e => setLicenseForm({ ...licenseForm, issue_date: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Expiry Date</label>
                                <input
                                    type="date"
                                    value={licenseForm.expiry_date}
                                    onChange={e => setLicenseForm({ ...licenseForm, expiry_date: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>
                        <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20">
                            Save License
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
