import React, { useState, useEffect, useMemo } from 'react';
import {
    ShieldCheck, FileText, CheckSquare, Clock, AlertTriangle, Plus, Search,
    Building2, Bell, RefreshCw, BarChart3, Settings, Filter, Download, UserCheck, Calendar,
    User, ExternalLink, ArrowRight, CheckCircle, Upload, Landmark, MapPin, DollarSign,
    ChevronRight, MessageSquare, Paperclip, Send, Eye, Briefcase, Activity, FolderOpen,
    AlertCircle, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';

// ─── Constants ───
const REQUEST_TYPES = [
    { value: 'VISA_APPLICATION', label: 'Visa Application' },
    { value: 'VISA_RENEWAL', label: 'Visa Renewal' },
    { value: 'QID_RENEWAL', label: 'QID Renewal' },
    { value: 'PASSPORT_RENEWAL', label: 'Passport Renewal' },
    { value: 'MEDICAL_TEST', label: 'Medical Test' },
    { value: 'FINGERPRINT', label: 'Fingerprint' },
    { value: 'LABOUR_SERVICES', label: 'Labour Related Services' },
    { value: 'IMMIGRATION', label: 'Immigration Services' },
    { value: 'EXIT_PERMIT', label: 'Exit Permit' },
    { value: 'ENTRY_PERMIT', label: 'Entry Permit' },
    { value: 'DRIVING_LICENCE', label: 'Driving Licence' },
    { value: 'HEALTH_CARD', label: 'Health Card' },
    { value: 'CR_RENEWAL', label: 'Company CR Renewal' },
    { value: 'COMPUTER_CARD', label: 'Computer Card Renewal' },
    { value: 'TRADE_LICENCE', label: 'Trade Licence Renewal' },
    { value: 'MUNICIPALITY_LICENCE', label: 'Municipality Licence Renewal' },
    { value: 'OTHER', label: 'Other Government Applications' }
];

const STATUS_PIPELINE = [
    { value: 'NEW_REQUEST', label: 'New Request', color: 'bg-slate-100 text-slate-700' },
    { value: 'ASSIGNED', label: 'Assigned to PRO', color: 'bg-blue-100 text-blue-700' },
    { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-indigo-100 text-indigo-700' },
    { value: 'WAITING_DOCS', label: 'Waiting for Documents', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'SUBMITTED', label: 'Submitted to Govt', color: 'bg-purple-100 text-purple-700' },
    { value: 'UNDER_GOVT', label: 'Under Government Process', color: 'bg-cyan-100 text-cyan-700' },
    { value: 'COMPLETED', label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'REJECTED', label: 'Rejected', color: 'bg-rose-100 text-rose-700' },
    { value: 'CANCELLED', label: 'Cancelled', color: 'bg-zinc-100 text-zinc-600' }
];

const DOC_CATEGORIES = [
    'Passport Copy', 'QID Copy', 'Visa Document', 'Government Application',
    'Receipt', 'Approval Document', 'Renewed Document', 'Company Document', 'Other'
];

const getStatusStyle = (status: string) => {
    return STATUS_PIPELINE.find(s => s.value === status)?.color || 'bg-slate-100 text-slate-600';
};

const getStatusLabel = (status: string) => {
    return STATUS_PIPELINE.find(s => s.value === status)?.label || status;
};

const getTypeLabel = (type: string) => {
    return REQUEST_TYPES.find(t => t.value === type)?.label || type;
};

// ─── Component ───
export type PROViewMode = 'DASHBOARD' | 'REQUESTS' | 'PRO_TASKS' | 'RENEWALS' | 'REMINDERS' | 'DOCUMENTS' | 'REPORTS';

export const PROHub: React.FC = () => {
    const { user, currentCompanyId, hasPermission, userRole } = useAuth();
    const [activeTab, setActiveTab] = useState<PROViewMode>('DASHBOARD');
    const [loading, setLoading] = useState(true);

    // Data
    const [applications, setApplications] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [licenses, setLicenses] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);

    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedApp, setSelectedApp] = useState<any>(null);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showDocModal, setShowDocModal] = useState(false);
    const [showLicenseModal, setShowLicenseModal] = useState(false);

    // Role checks
    const isHR = userRole?.toLowerCase() === 'hr' || userRole?.toLowerCase() === 'hr manager';
    const isCEO = userRole?.toLowerCase() === 'ceo' || userRole?.toLowerCase() === 'managing director' || userRole?.toLowerCase() === 'md';
    const isAdmin = userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'super admin';
    const isPRO = userRole?.toLowerCase() === 'pro' || userRole?.toLowerCase() === 'mandoob' || userRole?.toLowerCase() === 'pro officer';
    const canCreateRequest = isHR || isCEO || isAdmin || hasPermission('pro.requests.create');
    const canViewAll = isHR || isCEO || isAdmin || hasPermission('pro.requests.view');

    // Forms
    const [requestForm, setRequestForm] = useState({
        title: '', application_type: 'VISA_APPLICATION', applicant_employee_id: '',
        assigned_pro_id: '', qid_number: '', passport_number: '',
        remarks: '', urgent_flag: false, government_fees: '0'
    });

    const [commentText, setCommentText] = useState('');
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [docForm, setDocForm] = useState({
        document_name: '', document_type: 'Passport Copy', document_number: '',
        entity_type: 'EMPLOYEE', entity_id: '', issue_date: '', expiry_date: ''
    });
    const [docFile, setDocFile] = useState<File | null>(null);

    const [licenseForm, setLicenseForm] = useState({
        license_name: '', license_number: '', issuing_authority: '',
        issue_date: '', expiry_date: '', fee_amount: '0'
    });

    // ─── Data Fetching ───
    useEffect(() => {
        if (currentCompanyId) fetchAll();
    }, [currentCompanyId, activeTab]);

    const fetchAll = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            const [appsR, tasksR, licsR, empsR, docsR] = await Promise.all([
                (supabase as any).from('pro_applications')
                    .select('*, applicant:employees!applicant_employee_id(id, name, designation, department, qid_number, passport_number), pro_agent:employees!assigned_pro_id(id, name)')
                    .eq('company_id', currentCompanyId)
                    .order('created_at', { ascending: false }),
                (supabase as any).from('pro_tasks')
                    .select('*, assignee:employees!assigned_to(name), application:pro_applications(id, title, application_type, applicant_employee_id)')
                    .eq('company_id', currentCompanyId)
                    .order('created_at', { ascending: false }),
                (supabase as any).from('pro_licenses')
                    .select('*').eq('company_id', currentCompanyId)
                    .order('expiry_date', { ascending: true }),
                (supabase as any).from('employees')
                    .select('id, name, designation, department, email, employee_code, qid_number, qid_expiry, passport_number, passport_expiry, visa_number, visa_expiry, labour_card_number, labour_card_expiry, health_card_number, health_card_expiry, driving_licence_number, driving_licence_expiry, hamad_card_expiry')
                    .eq('company_id', currentCompanyId),
                (supabase as any).from('pro_documents')
                    .select('*').eq('company_id', currentCompanyId)
                    .order('created_at', { ascending: false })
            ]);

            if (appsR.data) setApplications(appsR.data);
            if (tasksR.data) setTasks(tasksR.data);
            if (licsR.data) setLicenses(licsR.data);
            if (empsR.data) setEmployees(empsR.data);
            if (docsR.data) setDocuments(docsR.data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const fetchActivityLog = async (appId: string) => {
        const { data } = await (supabase as any).from('pro_activity_log')
            .select('*').eq('application_id', appId)
            .order('created_at', { ascending: true });
        if (data) setActivityLogs(data);
    };

    // ─── Computed Metrics ───
    const today = new Date();
    const getDaysRemaining = (d?: string) => {
        if (!d) return 999;
        return Math.ceil((new Date(d).getTime() - today.getTime()) / 86400000);
    };

    const stats = useMemo(() => {
        const total = applications.length;
        const pending = applications.filter(a => ['NEW_REQUEST', 'ASSIGNED', 'WAITING_DOCS'].includes(a.status)).length;
        const inProgress = applications.filter(a => ['IN_PROGRESS', 'SUBMITTED', 'UNDER_GOVT'].includes(a.status)).length;
        const completed = applications.filter(a => a.status === 'COMPLETED').length;
        const rejected = applications.filter(a => a.status === 'REJECTED').length;
        return { total, pending, inProgress, completed, rejected };
    }, [applications]);

    // Build expiry alerts from employees + licenses
    const expiryAlerts = useMemo(() => {
        const alerts: any[] = [];
        const fields = [
            { key: 'qid_expiry', label: 'QID / Civil ID', numKey: 'qid_number' },
            { key: 'passport_expiry', label: 'Passport', numKey: 'passport_number' },
            { key: 'visa_expiry', label: 'Visa', numKey: 'visa_number' },
            { key: 'labour_card_expiry', label: 'Labour Card', numKey: 'labour_card_number' },
            { key: 'health_card_expiry', label: 'Health Card', numKey: 'health_card_number' },
            { key: 'driving_licence_expiry', label: 'Driving Licence', numKey: 'driving_licence_number' },
            { key: 'hamad_card_expiry', label: 'Hamad Health Card', numKey: '' }
        ];
        employees.forEach(emp => {
            fields.forEach(f => {
                const days = getDaysRemaining(emp[f.key]);
                if (days <= 90) {
                    alerts.push({
                        id: `${emp.id}-${f.key}`,
                        employeeId: emp.id,
                        employeeName: emp.name,
                        designation: emp.designation,
                        documentType: f.label,
                        documentNumber: emp[f.numKey] || '',
                        expiryDate: emp[f.key],
                        daysRemaining: days,
                        tier: days <= 1 ? 'CRITICAL' : days <= 7 ? 'CRITICAL' : days <= 15 ? 'URGENT' : days <= 30 ? 'URGENT' : days <= 60 ? 'WARNING' : 'NOTICE'
                    });
                }
            });
        });
        licenses.forEach(lic => {
            const days = getDaysRemaining(lic.expiry_date);
            if (days <= 90) {
                alerts.push({
                    id: `lic-${lic.id}`,
                    employeeName: 'Company',
                    designation: 'Corporate',
                    documentType: lic.license_name,
                    documentNumber: lic.license_number,
                    expiryDate: lic.expiry_date,
                    daysRemaining: days,
                    tier: days <= 7 ? 'CRITICAL' : days <= 30 ? 'URGENT' : days <= 60 ? 'WARNING' : 'NOTICE'
                });
            }
        });
        return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [employees, licenses]);

    // ─── Handlers ───
    const handleCreateRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const emp = employees.find(m => m.id === requestForm.applicant_employee_id);
            const { data, error } = await (supabase as any).from('pro_applications').insert([{
                company_id: currentCompanyId,
                title: requestForm.title || `${getTypeLabel(requestForm.application_type)} - ${emp?.name || 'Company'}`,
                application_type: requestForm.application_type,
                service_category: requestForm.application_type,
                applicant_employee_id: requestForm.applicant_employee_id || null,
                assigned_pro_id: requestForm.assigned_pro_id || null,
                qid_number: requestForm.qid_number || emp?.qid_number || null,
                passport_number: requestForm.passport_number || emp?.passport_number || null,
                urgent_flag: requestForm.urgent_flag,
                government_fees: parseFloat(requestForm.government_fees || '0'),
                remarks: requestForm.remarks,
                submission_date: new Date().toISOString().split('T')[0],
                status: requestForm.assigned_pro_id ? 'ASSIGNED' : 'NEW_REQUEST',
                stage: 'SUBMITTED',
                requested_by_id: user?.id || null,
                requested_by_role: isHR ? 'HR' : isCEO ? 'CEO' : 'ADMIN',
                created_by: user?.id || null
            }]).select();

            if (error) throw error;

            // Log activity
            if (data?.[0]) {
                await (supabase as any).from('pro_activity_log').insert([{
                    company_id: currentCompanyId,
                    application_id: data[0].id,
                    action_type: 'STATUS_CHANGE',
                    new_status: requestForm.assigned_pro_id ? 'ASSIGNED' : 'NEW_REQUEST',
                    comment: `Request created by ${isHR ? 'HR' : isCEO ? 'CEO' : 'Admin'}. ${requestForm.assigned_pro_id ? 'Assigned to PRO agent.' : ''}`,
                    created_by: user?.id,
                    created_by_name: user?.email || 'System',
                    created_by_role: isHR ? 'HR' : isCEO ? 'CEO' : 'ADMIN'
                }]);
            }

            setShowRequestModal(false);
            setRequestForm({ title: '', application_type: 'VISA_APPLICATION', applicant_employee_id: '', assigned_pro_id: '', qid_number: '', passport_number: '', remarks: '', urgent_flag: false, government_fees: '0' });
            fetchAll();
        } catch (err: any) { alert('Error: ' + err.message); }
        setSubmitting(false);
    };

    const handleStatusUpdate = async (appId: string, newStatus: string, oldStatus: string) => {
        try {
            await (supabase as any).from('pro_applications').update({ status: newStatus, stage: newStatus }).eq('id', appId);
            await (supabase as any).from('pro_activity_log').insert([{
                company_id: currentCompanyId,
                application_id: appId,
                action_type: 'STATUS_CHANGE',
                old_status: oldStatus,
                new_status: newStatus,
                comment: `Status updated from "${getStatusLabel(oldStatus)}" to "${getStatusLabel(newStatus)}"`,
                created_by: user?.id,
                created_by_name: user?.email || 'Unknown',
                created_by_role: isPRO ? 'PRO' : isHR ? 'HR' : isCEO ? 'CEO' : 'ADMIN'
            }]);
            if (selectedApp) {
                setSelectedApp({ ...selectedApp, status: newStatus });
                fetchActivityLog(appId);
            }
            fetchAll();
        } catch (err: any) { alert('Error: ' + err.message); }
    };

    const handleAddComment = async (appId: string) => {
        if (!commentText.trim() && !commentFile) return;
        setSubmitting(true);
        try {
            let attachUrl = '';
            let attachName = '';
            if (commentFile) {
                const path = `${currentCompanyId}/pro/comments/${Date.now()}_${commentFile.name}`;
                const { error: upErr } = await supabase.storage.from('attachments').upload(path, commentFile);
                if (!upErr) {
                    const { data: urlD } = supabase.storage.from('attachments').getPublicUrl(path);
                    attachUrl = urlD.publicUrl;
                    attachName = commentFile.name;
                }
            }
            await (supabase as any).from('pro_activity_log').insert([{
                company_id: currentCompanyId,
                application_id: appId,
                action_type: attachUrl ? 'DOCUMENT_UPLOAD' : 'COMMENT',
                comment: commentText || (attachName ? `Uploaded: ${attachName}` : ''),
                attachment_url: attachUrl || null,
                attachment_name: attachName || null,
                created_by: user?.id,
                created_by_name: user?.email || 'Unknown',
                created_by_role: isPRO ? 'PRO' : isHR ? 'HR' : isCEO ? 'CEO' : 'ADMIN'
            }]);
            setCommentText('');
            setCommentFile(null);
            fetchActivityLog(appId);
        } catch (err: any) { alert('Error: ' + err.message); }
        setSubmitting(false);
    };

    const handleUploadDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docFile) { alert('Please select a file.'); return; }
        setSubmitting(true);
        try {
            const path = `${currentCompanyId}/pro/docs/${Date.now()}_${docFile.name}`;
            const { error: upErr } = await supabase.storage.from('attachments').upload(path, docFile);
            if (upErr) throw upErr;
            const { data: urlD } = supabase.storage.from('attachments').getPublicUrl(path);

            await (supabase as any).from('pro_documents').insert([{
                company_id: currentCompanyId,
                document_name: docForm.document_name,
                document_type: docForm.document_type,
                document_number: docForm.document_number || null,
                entity_type: docForm.entity_type,
                entity_id: docForm.entity_id || null,
                issue_date: docForm.issue_date || null,
                expiry_date: docForm.expiry_date || null,
                status: 'VALID',
                attachment_url: urlD.publicUrl
            }]);
            setShowDocModal(false);
            setDocFile(null);
            setDocForm({ document_name: '', document_type: 'Passport Copy', document_number: '', entity_type: 'EMPLOYEE', entity_id: '', issue_date: '', expiry_date: '' });
            fetchAll();
        } catch (err: any) { alert('Error: ' + err.message); }
        setSubmitting(false);
    };

    const handleCreateLicense = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await (supabase as any).from('pro_licenses').insert([{
                company_id: currentCompanyId,
                license_name: licenseForm.license_name,
                license_number: licenseForm.license_number,
                issuing_authority: licenseForm.issuing_authority,
                issue_date: licenseForm.issue_date || null,
                expiry_date: licenseForm.expiry_date || null,
                fee_amount: parseFloat(licenseForm.fee_amount || '0'),
                status: 'ACTIVE'
            }]);
            setShowLicenseModal(false);
            setLicenseForm({ license_name: '', license_number: '', issuing_authority: '', issue_date: '', expiry_date: '', fee_amount: '0' });
            fetchAll();
        } catch (err: any) { alert('Error: ' + err.message); }
        setSubmitting(false);
    };

    // PRO-only: filter to assigned apps
    const myApps = useMemo(() => {
        if (isPRO && !canViewAll) {
            return applications.filter(a => a.assigned_pro_id === user?.id || a.applicant?.id === user?.id);
        }
        return applications;
    }, [applications, isPRO, canViewAll, user]);

    const filteredApps = useMemo(() => {
        let list = activeTab === 'PRO_TASKS' && isPRO ? myApps : myApps;
        if (statusFilter !== 'ALL') list = list.filter(a => a.status === statusFilter);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(a =>
                a.title?.toLowerCase().includes(q) ||
                a.applicant?.name?.toLowerCase().includes(q) ||
                a.application_type?.toLowerCase().includes(q) ||
                a.qid_number?.includes(q) ||
                a.passport_number?.includes(q)
            );
        }
        return list;
    }, [myApps, statusFilter, searchQuery, activeTab, isPRO]);

    // Nav
    const navItems = [
        { id: 'DASHBOARD', icon: ShieldCheck, label: 'Dashboard' },
        { id: 'REQUESTS', icon: FileText, label: 'Request Management' },
        ...(isPRO ? [{ id: 'PRO_TASKS', icon: CheckSquare, label: 'My Assigned Tasks' }] : []),
        { id: 'RENEWALS', icon: RefreshCw, label: 'Renewal Tracker' },
        { id: 'REMINDERS', icon: Bell, label: 'Expiry Reminders' },
        { id: 'DOCUMENTS', icon: FolderOpen, label: 'Document Vault' },
        { id: 'REPORTS', icon: BarChart3, label: 'Reports' },
    ];

    // ─── Request Detail Panel ───
    const RequestDetail = ({ app, onClose }: { app: any; onClose: () => void }) => {
        useEffect(() => { fetchActivityLog(app.id); }, [app.id]);

        const validNextStatuses = (current: string) => {
            const transitions: Record<string, string[]> = {
                'NEW_REQUEST': ['ASSIGNED', 'CANCELLED'],
                'ASSIGNED': ['IN_PROGRESS', 'CANCELLED'],
                'IN_PROGRESS': ['WAITING_DOCS', 'SUBMITTED', 'CANCELLED'],
                'WAITING_DOCS': ['IN_PROGRESS', 'SUBMITTED', 'CANCELLED'],
                'SUBMITTED': ['UNDER_GOVT', 'REJECTED'],
                'UNDER_GOVT': ['COMPLETED', 'REJECTED'],
                'COMPLETED': [],
                'REJECTED': [],
                'CANCELLED': []
            };
            return transitions[current] || [];
        };

        return (
            <div className="fixed inset-0 z-50 flex bg-slate-900/30 backdrop-blur-md animate-fade-in">
                <div className="flex-1 bg-white dark:bg-zinc-900 m-4 rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-zinc-800">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-start shrink-0">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase ${getStatusStyle(app.status)}`}>
                                    {getStatusLabel(app.status)}
                                </span>
                                {app.urgent_flag && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 uppercase">Urgent</span>}
                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700">
                                    {getTypeLabel(app.application_type)}
                                </span>
                            </div>
                            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{app.title}</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Ref: {app.application_number || app.id?.slice(0, 8)} • Employee: {app.applicant?.name || 'Company Filing'} • PRO: {app.pro_agent?.name || 'Unassigned'}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* Left: Details + Status */}
                        <div className="w-80 border-r border-slate-200 dark:border-zinc-800 p-6 overflow-y-auto shrink-0 space-y-6">
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Request Details</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-slate-500">QID #</span><span className="font-mono font-bold text-slate-800 dark:text-white">{app.qid_number || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Passport #</span><span className="font-mono font-bold text-slate-800 dark:text-white">{app.passport_number || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Submitted</span><span className="font-bold text-slate-800 dark:text-white">{app.submission_date || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Govt Fees</span><span className="font-bold text-emerald-600">${app.government_fees || 0}</span></div>
                                </div>
                            </div>

                            {app.remarks && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Remarks</h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl italic">"{app.remarks}"</p>
                                </div>
                            )}

                            {/* Status Update (PRO / Admin only) */}
                            {(isPRO || isAdmin) && validNextStatuses(app.status).length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Update Status</h4>
                                    <div className="space-y-2">
                                        {validNextStatuses(app.status).map(ns => (
                                            <button key={ns} onClick={() => handleStatusUpdate(app.id, ns, app.status)}
                                                className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold text-left transition-all hover:scale-[1.02] ${getStatusStyle(ns)} border border-transparent hover:border-current`}>
                                                → {getStatusLabel(ns)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: Activity Log + Comments */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2"><Activity className="w-4 h-4" /> Activity Log & Comments</h3>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {activityLogs.length === 0 ? (
                                    <p className="text-center text-slate-400 py-8 italic text-sm">No activity recorded yet.</p>
                                ) : activityLogs.map(log => (
                                    <div key={log.id} className={`p-4 rounded-2xl border ${log.action_type === 'STATUS_CHANGE' ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' : 'bg-white dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-800'}`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                {log.action_type === 'STATUS_CHANGE' && <ArrowRight className="w-3.5 h-3.5 text-blue-500" />}
                                                {log.action_type === 'COMMENT' && <MessageSquare className="w-3.5 h-3.5 text-slate-400" />}
                                                {log.action_type === 'DOCUMENT_UPLOAD' && <Paperclip className="w-3.5 h-3.5 text-emerald-500" />}
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{log.created_by_name || 'System'}</span>
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500">{log.created_by_role}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                                        </div>
                                        {log.comment && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{log.comment}</p>}
                                        {log.old_status && log.new_status && (
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusStyle(log.old_status)}`}>{getStatusLabel(log.old_status)}</span>
                                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusStyle(log.new_status)}`}>{getStatusLabel(log.new_status)}</span>
                                            </div>
                                        )}
                                        {log.attachment_url && (
                                            <a href={log.attachment_url} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 mt-2 text-xs text-blue-600 font-bold hover:underline">
                                                <Paperclip className="w-3 h-3" /> {log.attachment_name || 'View Attachment'}
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Comment Input */}
                            <div className="p-4 border-t border-slate-200 dark:border-zinc-800 shrink-0">
                                <div className="flex gap-2">
                                    <input value={commentText} onChange={e => setCommentText(e.target.value)}
                                        placeholder="Add a comment or update..."
                                        className="flex-1 p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white"
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(app.id); } }} />
                                    <label className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors flex items-center">
                                        <Paperclip className="w-4 h-4 text-slate-500" />
                                        <input type="file" className="hidden" onChange={e => setCommentFile(e.target.files?.[0] || null)} />
                                    </label>
                                    <button onClick={() => handleAddComment(app.id)} disabled={submitting || (!commentText.trim() && !commentFile)}
                                        className="px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5">
                                        <Send className="w-4 h-4" /> Send
                                    </button>
                                </div>
                                {commentFile && <p className="text-xs text-slate-400 mt-1">📎 {commentFile.name}</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ─── Render ───
    return (
        <div className="flex h-full relative z-10 overflow-hidden bg-slate-50 dark:bg-black/20">
            {/* Sidebar */}
            <div className="w-20 md:w-64 flex-shrink-0 bg-white/40 dark:bg-zinc-900/40 border-r border-slate-200/50 dark:border-zinc-800 flex flex-col pt-8 pb-4 px-4 backdrop-blur-xl">
                <div className="flex flex-col gap-2">
                    <div className="mb-6 px-2 hidden md:block">
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className="w-6 h-6 text-blue-600" />
                            <span className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">PRO / Mandoob</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded-md">Govt Relations</span>
                    </div>
                    {navItems.map(item => (
                        <button key={item.id} onClick={() => { setActiveTab(item.id as PROViewMode); setSelectedApp(null); }}
                            className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all active:scale-95 ${activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-zinc-800/60'}`}>
                            <item.icon className="w-5 h-5" />
                            <span className="hidden md:inline font-bold text-sm">{item.label}</span>
                            {item.id === 'REMINDERS' && expiryAlerts.filter(a => a.tier === 'CRITICAL').length > 0 && (
                                <span className="hidden md:inline ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">{expiryAlerts.filter(a => a.tier === 'CRITICAL').length}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main */}
            <div className="flex-1 overflow-hidden relative">
                {/* ──── DASHBOARD ──── */}
                {activeTab === 'DASHBOARD' && (
                    <div className="p-8 h-full overflow-y-auto animate-page-enter">
                        <header className="flex justify-between items-center mb-8">
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">PRO & Government Services</h1>
                                <p className="text-slate-500 text-sm font-medium mt-1">Mandoob request management, renewal tracking, and government application processing.</p>
                            </div>
                            {canCreateRequest && (
                                <button onClick={() => setShowRequestModal(true)}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 flex items-center gap-2">
                                    <Plus className="w-4 h-4" /> New PRO Request
                                </button>
                            )}
                        </header>

                        {/* KPI Row */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                            {[
                                { label: 'Total Requests', value: stats.total, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                                { label: 'In Progress', value: stats.inProgress, icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Expiry Alerts', value: expiryAlerts.filter(a => a.tier === 'CRITICAL' || a.tier === 'URGENT').length, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' }
                            ].map(kpi => (
                                <div key={kpi.label} className="bg-white/70 dark:bg-zinc-900/70 p-5 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                                        <h3 className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</h3>
                                    </div>
                                    <div className={`w-10 h-10 rounded-2xl ${kpi.bg} ${kpi.color} flex items-center justify-center`}>
                                        <kpi.icon className="w-5 h-5" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Recent Requests */}
                            <div className="bg-white dark:bg-zinc-900/70 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" /> Recent Requests</h3>
                                    <button onClick={() => setActiveTab('REQUESTS')} className="text-xs font-bold text-blue-600 hover:underline">View All</button>
                                </div>
                                <div className="space-y-3 max-h-[320px] overflow-y-auto">
                                    {applications.slice(0, 5).map(app => (
                                        <div key={app.id} onClick={() => setSelectedApp(app)} className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors">
                                            <div>
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">{app.title}</p>
                                                <p className="text-xs text-slate-400">{app.applicant?.name || 'Company'} • {getTypeLabel(app.application_type)}</p>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusStyle(app.status)}`}>{getStatusLabel(app.status)}</span>
                                        </div>
                                    ))}
                                    {applications.length === 0 && <p className="text-slate-400 italic text-sm text-center py-6">No requests yet.</p>}
                                </div>
                            </div>

                            {/* Critical Expiry Alerts */}
                            <div className="bg-white dark:bg-zinc-900/70 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-rose-600" /> Critical Expiry Alerts</h3>
                                    <button onClick={() => setActiveTab('REMINDERS')} className="text-xs font-bold text-blue-600 hover:underline">View All ({expiryAlerts.length})</button>
                                </div>
                                <div className="space-y-3 max-h-[320px] overflow-y-auto">
                                    {expiryAlerts.filter(a => a.tier === 'CRITICAL' || a.tier === 'URGENT').slice(0, 5).map(alert => (
                                        <div key={alert.id} className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">{alert.employeeName}</p>
                                                <p className="text-xs text-slate-400">{alert.documentType} • {alert.documentNumber || 'N/A'}</p>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${alert.daysRemaining <= 0 ? 'bg-rose-100 text-rose-700' : alert.daysRemaining <= 7 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {alert.daysRemaining <= 0 ? 'EXPIRED' : `${alert.daysRemaining}d left`}
                                            </span>
                                        </div>
                                    ))}
                                    {expiryAlerts.filter(a => a.tier === 'CRITICAL' || a.tier === 'URGENT').length === 0 && (
                                        <p className="text-slate-400 italic text-sm text-center py-6">No critical alerts.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ──── REQUEST MANAGEMENT + PRO TASKS ──── */}
                {(activeTab === 'REQUESTS' || activeTab === 'PRO_TASKS') && !selectedApp && (
                    <div className="p-8 h-full flex flex-col overflow-hidden animate-page-enter">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {activeTab === 'PRO_TASKS' ? 'My Assigned Tasks' : 'Government Application Requests'}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {activeTab === 'PRO_TASKS' ? 'Requests assigned to you for processing.' : 'All PRO requests created by HR and CEO.'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {canCreateRequest && activeTab === 'REQUESTS' && (
                                    <button onClick={() => setShowRequestModal(true)}
                                        className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-md hover:bg-blue-700 flex items-center gap-2">
                                        <Plus className="w-4 h-4" /> New Request
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex gap-3 mb-4 shrink-0 flex-wrap">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search requests..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white" />
                            </div>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                                className="px-4 py-2.5 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-medium text-slate-700 dark:text-white">
                                <option value="ALL">All Statuses</option>
                                {STATUS_PIPELINE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>

                        {/* Request List */}
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {filteredApps.map(app => (
                                <div key={app.id} onClick={() => { setSelectedApp(app); fetchActivityLog(app.id); }}
                                    className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-all flex items-center justify-between group">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{app.title}</h3>
                                                {app.urgent_flag && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700">URGENT</span>}
                                            </div>
                                            <p className="text-xs text-slate-400">
                                                {app.applicant?.name || 'Company'} • {getTypeLabel(app.application_type)} • Ref: {app.application_number || app.id?.slice(0, 8)} • PRO: {app.pro_agent?.name || 'Unassigned'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase shrink-0 ${getStatusStyle(app.status)}`}>
                                            {getStatusLabel(app.status)}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                </div>
                            ))}
                            {filteredApps.length === 0 && <p className="text-center text-slate-400 italic py-12">No requests found.</p>}
                        </div>
                    </div>
                )}

                {/* ──── RENEWAL TRACKER ──── */}
                {activeTab === 'RENEWALS' && (
                    <div className="p-8 h-full flex flex-col overflow-hidden animate-page-enter">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Renewal Management</h2>
                                <p className="text-xs text-slate-500">Track employee and company document expiries.</p>
                            </div>
                            <button onClick={() => setShowLicenseModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-md hover:bg-indigo-700 flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Add Company License
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {/* Employee Renewals Table */}
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm mb-8">
                                <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800">
                                    <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><UserCheck className="w-4 h-4" /> Employee Document Renewals</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50/50 dark:bg-zinc-800/50">
                                            <tr>
                                                <th className="p-3 sticky left-0 bg-slate-50 dark:bg-zinc-800 z-10">Employee</th>
                                                <th className="p-3">QID Expiry</th>
                                                <th className="p-3">Passport Expiry</th>
                                                <th className="p-3">Visa Expiry</th>
                                                <th className="p-3">Labour Card</th>
                                                <th className="p-3">Health Card</th>
                                                <th className="p-3">Driving Lic.</th>
                                                {canCreateRequest && <th className="p-3 text-right">Action</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                                            {employees.map(emp => {
                                                const fields = [
                                                    { key: 'qid_expiry' }, { key: 'passport_expiry' }, { key: 'visa_expiry' },
                                                    { key: 'labour_card_expiry' }, { key: 'health_card_expiry' }, { key: 'driving_licence_expiry' }
                                                ];
                                                return (
                                                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                                        <td className="p-3 sticky left-0 bg-white dark:bg-zinc-900 z-10">
                                                            <p className="font-bold text-slate-900 dark:text-white">{emp.name}</p>
                                                            <p className="text-[10px] text-slate-400">{emp.designation || 'Staff'}</p>
                                                        </td>
                                                        {fields.map(f => {
                                                            const days = getDaysRemaining(emp[f.key]);
                                                            return (
                                                                <td key={f.key} className="p-3">
                                                                    {emp[f.key] ? (
                                                                        <span className={`px-2 py-1 rounded-lg font-bold ${
                                                                            days <= 0 ? 'bg-rose-100 text-rose-700' :
                                                                            days <= 30 ? 'bg-amber-100 text-amber-700' :
                                                                            days <= 90 ? 'bg-yellow-50 text-yellow-700' : 'text-slate-500'
                                                                        }`}>
                                                                            {emp[f.key]}
                                                                        </span>
                                                                    ) : <span className="text-slate-300">—</span>}
                                                                </td>
                                                            );
                                                        })}
                                                        {canCreateRequest && (
                                                            <td className="p-3 text-right">
                                                                <button onClick={() => {
                                                                    setRequestForm({ ...requestForm, title: `Document Renewal - ${emp.name}`, applicant_employee_id: emp.id, qid_number: emp.qid_number || '', passport_number: emp.passport_number || '' });
                                                                    setShowRequestModal(true);
                                                                }} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700">Renew</button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Company Licenses */}
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800">
                                    <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><Building2 className="w-4 h-4" /> Company Licenses & Registrations</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                    {licenses.map(lic => {
                                        const days = getDaysRemaining(lic.expiry_date);
                                        return (
                                            <div key={lic.id} className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{lic.license_name}</h4>
                                                        <p className="text-[10px] text-slate-400">Lic #: {lic.license_number} • {lic.issuing_authority || 'Govt'}</p>
                                                    </div>
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${days <= 0 ? 'bg-rose-100 text-rose-700' : days <= 60 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {days <= 0 ? 'Expired' : `${days}d`}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-100 dark:border-zinc-700">
                                                    <span>Issued: {lic.issue_date || 'N/A'}</span>
                                                    <span>Expiry: {lic.expiry_date || 'N/A'}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {licenses.length === 0 && <p className="col-span-2 text-center text-slate-400 italic py-6 text-sm">No company licenses tracked.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ──── EXPIRY REMINDERS ──── */}
                {activeTab === 'REMINDERS' && (
                    <div className="p-8 h-full flex flex-col overflow-hidden animate-page-enter">
                        <div className="mb-6 shrink-0">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Automatic Expiry Reminders</h2>
                            <p className="text-xs text-slate-500">Documents expiring within 90 days, grouped by urgency.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-6">
                            {(['CRITICAL', 'URGENT', 'WARNING', 'NOTICE'] as const).map(tier => {
                                const tierAlerts = expiryAlerts.filter(a => a.tier === tier);
                                if (tierAlerts.length === 0) return null;
                                const tierConfig = {
                                    CRITICAL: { label: 'Critical (≤7 days)', color: 'border-rose-300 bg-rose-50/50', badge: 'bg-rose-100 text-rose-700', icon: '🔴' },
                                    URGENT: { label: 'Urgent (≤30 days)', color: 'border-amber-300 bg-amber-50/50', badge: 'bg-amber-100 text-amber-700', icon: '🟠' },
                                    WARNING: { label: 'Warning (≤60 days)', color: 'border-yellow-300 bg-yellow-50/30', badge: 'bg-yellow-100 text-yellow-700', icon: '🟡' },
                                    NOTICE: { label: 'Notice (≤90 days)', color: 'border-blue-200 bg-blue-50/30', badge: 'bg-blue-100 text-blue-700', icon: '🔵' }
                                }[tier];

                                return (
                                    <div key={tier} className={`rounded-2xl border ${tierConfig.color} overflow-hidden`}>
                                        <div className="p-4 flex items-center justify-between">
                                            <h3 className="font-bold text-sm text-slate-800 dark:text-white">{tierConfig.icon} {tierConfig.label}</h3>
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${tierConfig.badge}`}>{tierAlerts.length} items</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                                            {tierAlerts.map(alert => (
                                                <div key={alert.id} className="p-4 flex items-center justify-between bg-white/60 dark:bg-zinc-900/60">
                                                    <div className="flex items-center gap-4">
                                                        <div>
                                                            <p className="font-bold text-sm text-slate-900 dark:text-white">{alert.employeeName}</p>
                                                            <p className="text-xs text-slate-400">{alert.designation} • {alert.documentType} • #{alert.documentNumber || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <p className="text-xs font-mono text-slate-500">Expires: {alert.expiryDate}</p>
                                                            <p className={`text-xs font-bold ${alert.daysRemaining <= 0 ? 'text-rose-600' : alert.daysRemaining <= 7 ? 'text-rose-600' : 'text-amber-600'}`}>
                                                                {alert.daysRemaining <= 0 ? 'EXPIRED' : `${alert.daysRemaining} days remaining`}
                                                            </p>
                                                        </div>
                                                        {canCreateRequest && (
                                                            <button onClick={() => {
                                                                setRequestForm({ ...requestForm, title: `${alert.documentType} Renewal - ${alert.employeeName}`, applicant_employee_id: alert.employeeId || '' });
                                                                setShowRequestModal(true);
                                                            }} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700">Renew</button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {expiryAlerts.length === 0 && <p className="text-center text-slate-400 italic py-12">All documents are up to date. No expiry alerts.</p>}
                        </div>
                    </div>
                )}

                {/* ──── DOCUMENT VAULT ──── */}
                {activeTab === 'DOCUMENTS' && (
                    <div className="p-8 h-full flex flex-col overflow-hidden animate-page-enter">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Document Vault</h2>
                                <p className="text-xs text-slate-500">Centralized storage for all PRO & government-related documents.</p>
                            </div>
                            <button onClick={() => setShowDocModal(true)} className="px-5 py-2.5 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-md hover:bg-emerald-700 flex items-center gap-2">
                                <Upload className="w-4 h-4" /> Upload Document
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {documents.map(doc => (
                                    <div key={doc.id} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                <FolderOpen className="w-5 h-5" />
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                                                doc.status === 'EXPIRED' ? 'bg-rose-100 text-rose-700' :
                                                doc.status === 'EXPIRING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                            }`}>{doc.status}</span>
                                        </div>
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">{doc.document_name}</h4>
                                        <p className="text-[10px] text-slate-400 mb-3">{doc.document_type} • #{doc.document_number || 'N/A'} • {doc.entity_type}</p>
                                        <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-3 border-t border-slate-100 dark:border-zinc-800">
                                            <span>Issued: {doc.issue_date || 'N/A'}</span>
                                            <span>Expiry: {doc.expiry_date || 'N/A'}</span>
                                        </div>
                                        {doc.attachment_url && (
                                            <a href={doc.attachment_url} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1 mt-3 text-xs text-blue-600 font-bold hover:underline">
                                                <ExternalLink className="w-3 h-3" /> View Document
                                            </a>
                                        )}
                                    </div>
                                ))}
                                {documents.length === 0 && <p className="col-span-3 text-center text-slate-400 italic py-12">No documents uploaded yet.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ──── REPORTS ──── */}
                {activeTab === 'REPORTS' && (
                    <div className="p-8 h-full overflow-y-auto animate-page-enter">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">PRO Reports & Analytics</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Govt Application Report */}
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800">
                                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-600" /> Applications by Type</h3>
                                <div className="space-y-2">
                                    {REQUEST_TYPES.map(rt => {
                                        const count = applications.filter(a => a.application_type === rt.value).length;
                                        if (count === 0) return null;
                                        return (
                                            <div key={rt.value} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{rt.label}</span>
                                                <span className="text-xs font-bold text-blue-600">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Status Summary */}
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800">
                                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-600" /> Applications by Status</h3>
                                <div className="space-y-2">
                                    {STATUS_PIPELINE.map(s => {
                                        const count = applications.filter(a => a.status === s.value).length;
                                        return (
                                            <div key={s.value} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.color}`}>{s.label}</span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Renewal Report */}
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800">
                                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><RefreshCw className="w-5 h-5 text-amber-600" /> Renewal Summary</h3>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Expired Documents', count: expiryAlerts.filter(a => a.daysRemaining <= 0).length, color: 'text-rose-600' },
                                        { label: 'Critical (≤7 days)', count: expiryAlerts.filter(a => a.daysRemaining > 0 && a.daysRemaining <= 7).length, color: 'text-rose-600' },
                                        { label: 'Urgent (≤30 days)', count: expiryAlerts.filter(a => a.daysRemaining > 7 && a.daysRemaining <= 30).length, color: 'text-amber-600' },
                                        { label: 'Warning (≤60 days)', count: expiryAlerts.filter(a => a.daysRemaining > 30 && a.daysRemaining <= 60).length, color: 'text-yellow-600' },
                                        { label: 'Notice (≤90 days)', count: expiryAlerts.filter(a => a.daysRemaining > 60 && a.daysRemaining <= 90).length, color: 'text-blue-600' }
                                    ].map(item => (
                                        <div key={item.label} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                                            <span className={`text-xs font-bold ${item.color}`}>{item.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* PRO Performance */}
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800">
                                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><UserCheck className="w-5 h-5 text-emerald-600" /> PRO Performance</h3>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Total Govt Fees Paid', value: `$${tasks.filter(t => t.status === 'COMPLETED').reduce((a, t) => a + (parseFloat(t.fee_paid) || 0), 0).toLocaleString()}` },
                                        { label: 'Total Documents Stored', value: documents.length },
                                        { label: 'Avg. Processing Time', value: 'N/A' },
                                        { label: 'Active Company Licenses', value: licenses.filter(l => getDaysRemaining(l.expiry_date) > 0).length }
                                    ].map(item => (
                                        <div key={item.label} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                                            <span className="text-xs font-bold text-emerald-600">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ──── Detail Panel ──── */}
            {selectedApp && <RequestDetail app={selectedApp} onClose={() => setSelectedApp(null)} />}

            {/* ──── MODALS ──── */}

            {/* New PRO Request */}
            {showRequestModal && (
                <Modal title="Create PRO Request" onClose={() => setShowRequestModal(false)} maxWidth="max-w-2xl">
                    <form onSubmit={handleCreateRequest} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Request Type *</label>
                                <select value={requestForm.application_type} onChange={e => setRequestForm({ ...requestForm, application_type: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium">
                                    {REQUEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Applicant Employee</label>
                                <select value={requestForm.applicant_employee_id} onChange={e => {
                                    const emp = employees.find(m => m.id === e.target.value);
                                    setRequestForm({ ...requestForm, applicant_employee_id: e.target.value, qid_number: emp?.qid_number || '', passport_number: emp?.passport_number || '' });
                                }} className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                                    <option value="">— Company / Corporate —</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code || emp.qid_number || 'Staff'})</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Request Title</label>
                            <input value={requestForm.title} onChange={e => setRequestForm({ ...requestForm, title: e.target.value })}
                                placeholder="Auto-generated if left blank"
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assign PRO (Mandoob)</label>
                                <select value={requestForm.assigned_pro_id} onChange={e => setRequestForm({ ...requestForm, assigned_pro_id: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                                    <option value="">— Select PRO Agent —</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Govt Fees (Est.)</label>
                                <input type="number" step="0.01" value={requestForm.government_fees} onChange={e => setRequestForm({ ...requestForm, government_fees: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">QID Number</label>
                                <input value={requestForm.qid_number} onChange={e => setRequestForm({ ...requestForm, qid_number: e.target.value })} placeholder="QID #"
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Passport Number</label>
                                <input value={requestForm.passport_number} onChange={e => setRequestForm({ ...requestForm, passport_number: e.target.value })} placeholder="Passport #"
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remarks / Instructions</label>
                            <textarea value={requestForm.remarks} onChange={e => setRequestForm({ ...requestForm, remarks: e.target.value })} rows={2} placeholder="Notes for the PRO agent..."
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Mark as Urgent</span>
                            <input type="checkbox" checked={requestForm.urgent_flag} onChange={e => setRequestForm({ ...requestForm, urgent_flag: e.target.checked })} className="w-5 h-5 accent-blue-600 rounded" />
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                            <strong>Note:</strong> Changing role updates the profile access level. After creating, edit the user to set specific module permissions.
                        </div>

                        <button type="submit" disabled={submitting}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50">
                            {submitting ? 'Creating Request...' : 'Create PRO Request'}
                        </button>
                    </form>
                </Modal>
            )}

            {/* Upload Document */}
            {showDocModal && (
                <Modal title="Upload Document to Vault" onClose={() => setShowDocModal(false)}>
                    <form onSubmit={handleUploadDocument} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Document Name *</label>
                            <input value={docForm.document_name} onChange={e => setDocForm({ ...docForm, document_name: e.target.value })} required placeholder="e.g. John Doe - Passport Copy"
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                                <select value={docForm.document_type} onChange={e => setDocForm({ ...docForm, document_type: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                                    {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Linked Employee</label>
                                <select value={docForm.entity_id} onChange={e => setDocForm({ ...docForm, entity_id: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                                    <option value="">— Company Document —</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Upload File *</label>
                            <input type="file" required onChange={e => setDocFile(e.target.files?.[0] || null)}
                                className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-emerald-50 file:text-emerald-700" />
                        </div>
                        <button type="submit" disabled={submitting}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                            {submitting ? 'Uploading...' : 'Upload Document'}
                        </button>
                    </form>
                </Modal>
            )}

            {/* Add Company License */}
            {showLicenseModal && (
                <Modal title="Add Company License / Registration" onClose={() => setShowLicenseModal(false)}>
                    <form onSubmit={handleCreateLicense} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">License Name *</label>
                            <input value={licenseForm.license_name} onChange={e => setLicenseForm({ ...licenseForm, license_name: e.target.value })} required placeholder="e.g. Commercial Trade License"
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">License Number *</label>
                                <input value={licenseForm.license_number} onChange={e => setLicenseForm({ ...licenseForm, license_number: e.target.value })} required placeholder="Lic #"
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Issuing Authority</label>
                                <input value={licenseForm.issuing_authority} onChange={e => setLicenseForm({ ...licenseForm, issuing_authority: e.target.value })} placeholder="e.g. MOCI"
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Issue Date</label>
                                <input type="date" value={licenseForm.issue_date} onChange={e => setLicenseForm({ ...licenseForm, issue_date: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Expiry Date</label>
                                <input type="date" value={licenseForm.expiry_date} onChange={e => setLicenseForm({ ...licenseForm, expiry_date: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                            </div>
                        </div>
                        <button type="submit" disabled={submitting}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50">
                            {submitting ? 'Saving...' : 'Save License'}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
