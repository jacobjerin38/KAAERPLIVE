import React, { useState, useEffect } from 'react';
import {
    Users, Briefcase, Phone, DollarSign, FileText, Edit3,
    Plus, Trash2, X, TrendingUp, MoreVertical, ArrowRightLeft, Loader2,
    Calendar, CheckCircle, Clock, AlertCircle, ShieldCheck,
    Ticket, Plane, Upload, ExternalLink, Download, Paperclip, MessageSquare, Save
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Employee } from '../../hrms/types';
import { JobTransitionModal } from '../../hrms/transitions/JobTransitionModal';
import { CompensationChangeModal } from '../../hrms/transitions/CompensationChangeModal';
import { CareerTimeline } from '../../hrms/transitions/CareerTimeline';
import { EmployeeDocuments } from './EmployeeDocuments';

interface EmployeeDetailModalProps {
    emp: Employee;
    onClose: () => void;
    onEdit: (emp: Employee) => void;
    refreshData?: () => void;

    // Masters
    departments: any[];
    locations: any[];
    designations: any[];
    grades: any[];
    employmentTypes: any[];
    payGroups: any[];
    roles: any[];
    employees: Employee[]; // For manager lookup
    salaryComponents: any[]; // New prop for mapping
    maritalStatuses?: any[];
    nationalities?: any[];
    visaTypes?: any[];
    employeeStatuses?: any[];
    leavePlans?: any[];
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
    emp, onClose, onEdit, refreshData,
    departments, locations, designations, grades, employmentTypes, payGroups, roles, employees, salaryComponents, maritalStatuses, nationalities,
    visaTypes, employeeStatuses, leavePlans
}) => {
    const [tab, setTab] = useState<'PROFILE' | 'JOB' | 'CONTACT' | 'FINANCIAL' | 'LEAVES' | 'DOCUMENTS' | 'TIMELINE' | 'TARGETS'>('PROFILE');

    // Leaves State
    const [employeeLeaves, setEmployeeLeaves] = useState<any[]>([]);
    const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
    const [loadingLeaves, setLoadingLeaves] = useState(false);

    // Financial Mapping State
    const [empSalaryComponents, setEmpSalaryComponents] = useState<any[]>([]);
    const [loadingComponents, setLoadingComponents] = useState(false);
    const [showAddComponent, setShowAddComponent] = useState(false);

    // New Component Form
    const [newComponentId, setNewComponentId] = useState<string>('');
    const [newAmount, setNewAmount] = useState<string>('');
    const [newEffectiveDate, setNewEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Transition Modals State
    const [showTransitionModal, setShowTransitionModal] = useState(false);
    const [showCompensationModal, setShowCompensationModal] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);

    // Format helpers
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Fetch Salary Mapping
    const fetchSalaryMapping = async () => {
        setLoadingComponents(true);
        const { data } = await (supabase as any)
            .from('employee_salary_components')
            .select(`
                *,
                org_salary_components(name, component_type)
            `)
            .eq('employee_id', emp.id)
            .eq('is_active', true);

        if (data) setEmpSalaryComponents(data as any[]);
        setLoadingComponents(false);
    };

    // Ticket & Remarks Management State
    const [selectedLeaveForTicket, setSelectedLeaveForTicket] = useState<any | null>(null);
    const [ticketFile, setTicketFile] = useState<File | null>(null);
    const [ticketNumber, setTicketNumber] = useState('');
    const [airline, setAirline] = useState('');
    const [leaveRemarks, setLeaveRemarks] = useState('');
    const [savingTicket, setSavingTicket] = useState(false);

    const handleOpenTicketModal = (leave: any) => {
        setSelectedLeaveForTicket(leave);
        setTicketFile(null);
        setTicketNumber(leave.ticket_number || '');
        setAirline(leave.airline || '');
        setLeaveRemarks(leave.remarks || leave.manager_comment || '');
    };

    const handleViewTicketAttachment = async (url: string) => {
        if (!url) return;
        const path = url.split('/storage/v1/object/public/attachments/')[1];
        if (!path) return window.open(url, '_blank');
        try {
            const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 120);
            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (err: any) {
            window.open(url, '_blank');
        }
    };

    const handleSaveTicket = async () => {
        if (!selectedLeaveForTicket) return;
        setSavingTicket(true);
        try {
            let uploadedUrl = selectedLeaveForTicket.ticket_attachment_url || null;

            if (ticketFile) {
                const fileExt = ticketFile.name.split('.').pop();
                const fileName = `leave_tickets/${emp.company_id || 'general'}/${selectedLeaveForTicket.id}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('attachments')
                    .upload(fileName, ticketFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('attachments')
                    .getPublicUrl(fileName);
                uploadedUrl = publicUrl;
            }

            const { error: updateError } = await supabase
                .from('leaves')
                .update({
                    ticket_number: ticketNumber.trim() || null,
                    airline: airline.trim() || null,
                    ticket_attachment_url: uploadedUrl,
                    remarks: leaveRemarks.trim() || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedLeaveForTicket.id);

            if (updateError) throw updateError;

            // Update local leaves state
            setEmployeeLeaves(prev => prev.map(l => l.id === selectedLeaveForTicket.id ? {
                ...l,
                ticket_number: ticketNumber.trim() || null,
                airline: airline.trim() || null,
                ticket_attachment_url: uploadedUrl,
                remarks: leaveRemarks.trim() || null
            } : l));

            setSelectedLeaveForTicket(null);
        } catch (err: any) {
            alert('Failed to save ticket details: ' + (err.message || 'Unknown error'));
        } finally {
            setSavingTicket(false);
        }
    };

    // Fetch Leave Balances & History
    const fetchEmployeeLeaves = async () => {
        if (!emp?.id) return;
        setLoadingLeaves(true);
        try {
            // 1. Fetch leave types for the company
            const { data: typesData } = await supabase
                .from('org_leave_types')
                .select('*')
                .eq('company_id', emp.company_id || '')
                .order('name');

            // 2. Fetch specific employee balances
            const { data: customBalances } = await supabase
                .from('employee_leave_balances')
                .select('*')
                .eq('employee_id', emp.id);

            // 3. Fetch leave applications / history
            const { data: leavesData } = await supabase
                .from('leaves')
                .select('*')
                .eq('employee_id', emp.id)
                .order('start_date', { ascending: false });

            const leavesList = leavesData || [];
            setEmployeeLeaves(leavesList);

            const types = typesData || [];
            const calculatedBalances = types.map((lt: any) => {
                const custom = customBalances?.find((cb: any) => 
                    cb.leave_type_id?.toString() === String(lt.id) || 
                    cb.leave_type_id?.toString() === lt.code
                );
                const total = custom && custom.total_balance != null 
                    ? Number(custom.total_balance) 
                    : Number(lt.default_balance || 0);

                const takenFromHistory = leavesList
                    .filter((l: any) => {
                        const typeMatches = (l.leave_type_id != null && l.leave_type_id.toString() === lt.id.toString()) ||
                            (l.type && l.type.trim().toLowerCase() === lt.name.trim().toLowerCase()) ||
                            (l.type && l.type.trim().toLowerCase() === lt.code.trim().toLowerCase());
                        const statusMatches = l.status === 'Approved' || l.status === 'approved';
                        return typeMatches && statusMatches;
                    })
                    .reduce((sum: number, l: any) => {
                        const start = new Date(l.start_date);
                        const end = new Date(l.end_date);
                        const diffTime = Math.abs(end.getTime() - start.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        return sum + (diffDays || 1);
                    }, 0);

                const used = Math.max(Number(custom?.used || 0), takenFromHistory);
                const remaining = Math.max(0, total - used);

                return {
                    id: lt.id,
                    name: lt.name,
                    code: lt.code,
                    is_paid: lt.is_paid,
                    total,
                    used,
                    remaining
                };
            });

            setLeaveBalances(calculatedBalances);
        } catch (err) {
            console.error('Failed to fetch employee leaves:', err);
        } finally {
            setLoadingLeaves(false);
        }
    };

    useEffect(() => {
        if (tab === 'FINANCIAL') {
            fetchSalaryMapping();
        } else if (tab === 'LEAVES') {
            fetchEmployeeLeaves();
        }
    }, [tab, emp.id]);

    const handleAddComponent = async () => {
        if (!newComponentId) return;
        const parsedAmount = parseFloat(newAmount);
        const safeAmount = isNaN(parsedAmount) || parsedAmount < 0 ? 0 : parsedAmount;

        const { error } = await (supabase as any).from('employee_salary_components').insert([{
            company_id: (emp as any).company_id,
            employee_id: emp.id,
            salary_component_id: parseInt(newComponentId),
            amount: safeAmount,
            remarks: newRemarks?.trim() || null,
            effective_from: newEffectiveDate || new Date().toISOString().split('T')[0],
            is_active: true
        }]);

        if (error) {
            alert('Error adding component: ' + error.message);
        } else {
            setShowAddComponent(false);
            setNewComponentId('');
            setNewAmount('');
            setNewRemarks('');
            fetchSalaryMapping();
        }
    };

    const handleDeleteComponent = async (id: string) => {
        if (!confirm('Are you sure you want to remove this salary component?')) return;
        const { error } = await (supabase as any).from('employee_salary_components').update({ is_active: false }).eq('id', id);
        if (error) alert('Error deleting: ' + error.message);
        else fetchSalaryMapping();
    };

    const EmployeeTargets = () => {
        const [targets, setTargets] = useState<any[]>([]);
        const [loadingTargets, setLoadingTargets] = useState(true);
        const [showAddForm, setShowAddForm] = useState(false);

        // Add Target Form state
        const [form, setForm] = useState({
            target_period: 'Monthly',
            target_year: new Date().getFullYear(),
            target_period_val: new Date().getMonth() + 1,
            target_amount: '',
            achieved_amount: '',
            incentive_rate: '2.5'
        });

        useEffect(() => {
            fetchTargets();
        }, []);

        const fetchTargets = async () => {
            setLoadingTargets(true);
            const { data, error } = await (supabase as any)
                .from('employee_targets')
                .select('*')
                .eq('employee_id', emp.id)
                .order('target_year', { ascending: false })
                .order('target_period_val', { ascending: false });

            if (error) console.error('Error fetching targets:', error);
            else setTargets(data || []);
            setLoadingTargets(false);
        };

        const handleSave = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!emp.company_id) return;
            
            const payload = {
                company_id: emp.company_id,
                employee_id: emp.id,
                target_period: form.target_period as any,
                target_year: form.target_year,
                target_period_val: form.target_period_val,
                target_amount: parseFloat(form.target_amount) || 0,
                achieved_amount: parseFloat(form.achieved_amount) || 0,
                incentive_rate: parseFloat(form.incentive_rate) || 0
            };

            const { error } = await (supabase as any)
                .from('employee_targets')
                .upsert([payload], { onConflict: 'company_id, employee_id, target_period, target_year, target_period_val' });

            if (error) {
                alert('Error saving target: ' + error.message);
            } else {
                setShowAddForm(false);
                setForm({
                    target_period: 'Monthly',
                    target_year: new Date().getFullYear(),
                    target_period_val: new Date().getMonth() + 1,
                    target_amount: '',
                    achieved_amount: '',
                    incentive_rate: '2.5'
                });
                fetchTargets();
            }
        };

        const formatPeriod = (t: any) => {
            if (t.target_period === 'Monthly') {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${months[t.target_period_val - 1]} ${t.target_year}`;
            }
            if (t.target_period === 'Quarterly') {
                return `Q${t.target_period_val} ${t.target_year}`;
            }
            return `Year ${t.target_year}`;
        };

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Performance Targets</h3>
                    <button 
                        onClick={() => setShowAddForm(!showAddForm)} 
                        className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3.5 py-1.5 rounded-lg transition-colors border border-indigo-100 dark:border-indigo-900/10"
                    >
                        {showAddForm ? 'Cancel' : '+ Assign Target'}
                    </button>
                </div>

                {showAddForm && (
                    <form onSubmit={handleSave} className="p-5 bg-slate-50 dark:bg-zinc-800/40 rounded-3xl border border-slate-100 dark:border-zinc-800 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Target Period</label>
                            <select
                                value={form.target_period}
                                onChange={e => setForm({ ...form, target_period: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-sm"
                            >
                                <option value="Monthly">Monthly</option>
                                <option value="Quarterly">Quarterly</option>
                                <option value="Annual">Annual</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Target Year</label>
                            <input
                                type="number"
                                required
                                value={form.target_year}
                                onChange={e => setForm({ ...form, target_year: parseInt(e.target.value) || new Date().getFullYear() })}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-sm"
                            />
                        </div>
                        {form.target_period !== 'Annual' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">
                                    {form.target_period === 'Monthly' ? 'Month (1-12)' : 'Quarter (1-4)'}
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max={form.target_period === 'Monthly' ? 12 : 4}
                                    required
                                    value={form.target_period_val}
                                    onChange={e => setForm({ ...form, target_period_val: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-sm"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Target Amount (QAR)</label>
                            <input
                                type="number"
                                required
                                value={form.target_amount}
                                onChange={e => setForm({ ...form, target_amount: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-sm"
                                placeholder="e.g. 50000"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Achieved Amount (QAR)</label>
                            <input
                                type="number"
                                value={form.achieved_amount}
                                onChange={e => setForm({ ...form, achieved_amount: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-sm"
                                placeholder="e.g. 45000"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Incentive Rate (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.incentive_rate}
                                onChange={e => setForm({ ...form, incentive_rate: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-sm"
                            />
                        </div>
                        <div className="col-span-2 flex justify-end gap-2 mt-2">
                            <button 
                                type="submit" 
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
                            >
                                Save Target
                            </button>
                        </div>
                    </form>
                )}

                {loadingTargets ? (
                    <div className="flex items-center justify-center py-10 text-slate-400">
                        <Loader2 className="animate-spin text-indigo-500 mr-2" /> Loading targets...
                    </div>
                ) : targets.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border border-slate-200 dark:border-zinc-800 rounded-2xl">
                        No targets assigned to this employee.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {targets.map(t => {
                            const progress = Math.min(100, (t.achieved_amount / (t.target_amount || 1)) * 100);
                            return (
                                <div key={t.id} className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 rounded-2xl flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 dark:text-white">{formatPeriod(t)}</span>
                                            <span className="text-[10px] bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-bold uppercase">{t.target_period}</span>
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            Target: QAR {t.target_amount.toLocaleString()} | Achieved: QAR {t.achieved_amount.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-slate-800 dark:text-white">{progress.toFixed(1)}%</div>
                                            <div className="text-[10px] text-slate-400">Incentive: {t.incentive_rate}%</div>
                                        </div>
                                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-600" style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl w-full max-w-5xl h-[85vh] rounded-[3rem] shadow-2xl flex overflow-hidden animate-slide-up border border-white/50 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
                {/* Sidebar */}
                <div className="w-72 bg-slate-50/80 dark:bg-zinc-950/50 border-r border-slate-100 dark:border-zinc-800 p-8 flex flex-col items-center overflow-y-auto">
                    <div className="relative mb-6 shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full blur-lg opacity-40"></div>
                        <img src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random`} className="w-32 h-32 rounded-full border-[6px] border-white dark:border-zinc-800 shadow-xl relative z-10 object-cover" alt="" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white text-center tracking-tight mb-1">{emp.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-2 font-medium">
                        {roles.find(r => r.id === emp.role_id)?.name || emp.role || 'No Role'}
                    </p>
                    <div className="flex justify-center mb-6">
                        {(emp as any).ot_applicable !== false ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-wide">OT Applicable</span>
                        ) : (
                            <span className="px-2 py-1 bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-wide">No OT</span>
                        )}
                    </div>
                    <div className="w-full space-y-3">
                        {[
                            { id: 'PROFILE', label: 'Overview', icon: Users },
                            { id: 'JOB', label: 'Job Info', icon: Briefcase },
                            { id: 'CONTACT', label: 'Contact', icon: Phone },
                            { id: 'FINANCIAL', label: 'Financial', icon: DollarSign },
                            { id: 'LEAVES', label: 'Leaves', icon: Calendar },
                            { id: 'DOCUMENTS', label: 'Documents', icon: FileText },
                            { id: 'TIMELINE', label: 'Career Timeline', icon: ArrowRightLeft },
                            { id: 'TARGETS', label: 'Targets', icon: TrendingUp },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id as any)}
                                className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all active:scale-95 ${tab === t.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-md'
                                    }`}
                            >
                                <t.icon className="w-4 h-4" /> {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-10 overflow-y-auto bg-white/50 dark:bg-zinc-900/50 relative">
                    <div className="absolute top-8 right-8 z-10 flex gap-2">
                        {/* Actions Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowActionsMenu(!showActionsMenu)}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
                            >
                                Actions <MoreVertical className="w-4 h-4" />
                            </button>

                            {showActionsMenu && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-fade-in-up z-20">
                                    <button
                                        onClick={() => { setShowTransitionModal(true); setShowActionsMenu(false); }}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-medium text-slate-700"
                                    >
                                        <ArrowRightLeft className="w-4 h-4 text-blue-500" /> Job Transition
                                    </button>
                                    <button
                                        onClick={() => { setShowCompensationModal(true); setShowActionsMenu(false); }}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-medium text-slate-700"
                                    >
                                        <DollarSign className="w-4 h-4 text-emerald-500" /> Compensation Change
                                    </button>
                                    <hr className="my-1 border-slate-100" />
                                    <button
                                        onClick={() => {
                                            onEdit(emp);
                                            onClose();
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-medium text-slate-700"
                                    >
                                        <Edit3 className="w-4 h-4 text-indigo-500" /> Edit Profile
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* TABS */}
                    {tab === 'PROFILE' && (
                        <div className="space-y-8">
                            {/* Professional Details */}
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Professional Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <ViewField label="Staff No." value={emp.employee_code || '-'} />
                                    <ViewField label="Department" value={departments.find(d => String(d.id) === String(emp.department_id))?.name || emp.department || '-'} />
                                    <ViewField label="Designation / Position" value={designations.find(d => String(d.id) === String(emp.designation_id))?.name || emp.designation || '-'} />
                                    <ViewField label="Grade" value={grades.find(g => String(g.id) === String(emp.grade_id))?.name || '-'} />
                                    <ViewField label="Employment Type" value={employmentTypes.find(e => String(e.id) === String(emp.employment_type_id))?.name || '-'} />
                                    <ViewField label="Join Date" value={formatDate(emp.joinDate || emp.join_date)} />
                                    <ViewField label="Location" value={locations.find(l => String(l.id) === String(emp.location_id))?.name || emp.location || '-'} />
                                    <ViewField label="Reporting Manager" value={employees.find(e => String(e.id) === String((emp as any).manager_id) || String(e.id) === String(emp.reporting_manager_id))?.name || '-'} />
                                    <ViewField label="Client" value={emp.client_name || '-'} />
                                    <ViewField label="Status" value={employeeStatuses?.find(s => String(s.id) === String((emp as any).employee_status_id))?.name || emp.status || '-'} />
                                </div>
                            </div>

                            {/* Personal Details */}
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Personal Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <ViewField label="Date of Birth" value={formatDate(emp.date_of_birth)} />
                                    <ViewField label="Age" value={emp.age || (emp.date_of_birth ? Math.floor((Date.now() - new Date(emp.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '-')} />
                                    <ViewField label="Gender" value={emp.gender || '-'} />
                                    <ViewField label="Nationality" value={nationalities?.find(n => String(n.id) === String(emp.nationality_id))?.name || emp.nationality || '-'} />
                                    <ViewField label="Civil Status" value={maritalStatuses?.find(m => String(m.id) === String(emp.marital_status_id))?.name || '-'} />
                                </div>
                            </div>

                            {/* Immigration & Travel */}
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Immigration & Travel</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <ViewField label="Passport No." value={emp.passport_number || '-'} />
                                    <ViewField label="Passport Expiry" value={formatDate(emp.passport_expiry)} />
                                    <ViewField label="QID / Visa Number" value={emp.visa_number || '-'} />
                                    <ViewField label="Visa / QID Validity" value={formatDate(emp.visa_expiry)} />
                                    <ViewField label="Visa Sponsor" value={emp.visa_sponsor || '-'} />
                                    <ViewField label="Visa Type" value={visaTypes?.find(v => String(v.id) === String((emp as any).visa_type_id))?.name || emp.visa_type || '-'} />
                                </div>
                            </div>

                            {/* Contact */}
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Contact Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <ViewField label="Personal Mobile" value={emp.personal_mobile || emp.phone || '-'} />
                                    <ViewField label="Office Mobile" value={emp.office_mobile || '-'} />
                                    <ViewField label="Personal Email" value={emp.personal_email || '-'} />
                                    <ViewField label="Office Email" value={emp.office_email || emp.email || '-'} />
                                </div>
                            </div>

                            {/* Additional Info */}
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Additional Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <ViewField label="Annual Leave Duration Policy" value={leavePlans?.find(p => String(p.id) === String((emp as any).leave_plan_id))?.name || emp.annual_leave_duration_policy || '-'} />
                                    <ViewField label="Air Ticket" value={emp.air_ticket || '-'} />
                                    <ViewField label="Memo" value={emp.memo || '-'} />
                                    <ViewField label="Remarks" value={emp.remarks || '-'} />
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'JOB' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Job Information</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <ViewField label="Designation" value={designations.find(d => String(d.id) === String(emp.designation_id))?.name || '-'} />
                                <ViewField label="Grade" value={grades.find(g => String(g.id) === String(emp.grade_id))?.name || '-'} />
                                <ViewField label="Employment Type" value={employmentTypes.find(e => String(e.id) === String(emp.employment_type_id))?.name || '-'} />
                                <ViewField label="Reporting Manager" value={employees.find(e => String(e.id) === String(emp.reporting_manager_id))?.name || 'None'} />
                            </div>
                        </div>
                    )}

                    {tab === 'CONTACT' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Contact Details</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <ViewField label="Personal Mobile" value={emp.personal_mobile || '-'} />
                                <ViewField label="Office Mobile" value={emp.office_mobile || '-'} />
                                <ViewField label="Personal Email" value={emp.personal_email || '-'} />
                                <ViewField label="Office Email" value={emp.office_email || '-'} />
                            </div>
                            <ViewField label="Current Address" value={emp.current_address || '-'} FullWidth />
                            <ViewField label="Permanent Address" value={emp.permanent_address || '-'} FullWidth />
                        </div>
                    )}

                    {tab === 'FINANCIAL' && (
                        <div className="space-y-8">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Financial Information</h3>

                            {/* Base Info */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                                <ViewField label="Pay Group" value={payGroups.find(p => p.id === emp.pay_group_id)?.name || '-'} />
                                <ViewField label="Base Salary (CTC)" value={`QAR ${Number(emp.salary_amount || 0).toLocaleString()}`} />
                                <ViewField label="Bank Name" value={emp.bank_name || '-'} />
                                <ViewField label="Account Number" value={emp.account_number || '-'} />
                                <ViewField label="IFSC Code" value={emp.ifsc_code || '-'} />
                                <ViewField label="OT Applicable" value={(emp as any).ot_applicable !== false ? 'Yes' : 'No'} />
                                {(emp as any).ot_applicable !== false && (
                                    <>
                                        <ViewField 
                                            label="OT Calculation Formula" 
                                            value={(emp as any).ot_calculation_basis === 'BASIC_DA' ? 'Basic + DA' : (emp as any).ot_calculation_basis === 'GROSS' ? 'Gross CTC' : 'Basic Salary (Default)'} 
                                        />
                                        <ViewField 
                                            label="OT Multiplier" 
                                            value={`${(emp as any).ot_rate_multiplier || 1.25}x`} 
                                        />
                                    </>
                                )}
                            </div>

                            <hr className="border-slate-100 dark:border-zinc-800 my-6" />

                            {/* Salary Components */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-slate-700 dark:text-slate-200">Salary Component Mapping</h4>
                                    <button onClick={() => setShowAddComponent(true)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> Add Component
                                    </button>
                                </div>

                                {showAddComponent && (
                                    <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl mb-4 border border-slate-200 dark:border-zinc-700 animate-fade-in-down">
                                        <h5 className="text-xs font-bold uppercase text-slate-500 mb-3">New Allocation</h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                                            <select
                                                value={newComponentId}
                                                onChange={e => setNewComponentId(e.target.value)}
                                                className="p-2 rounded-lg text-sm border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                            >
                                                <option value="">Select Component</option>
                                                {salaryComponents.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name} ({c.component_type})</option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                placeholder="Amount (QAR)"
                                                value={newAmount}
                                                onChange={e => setNewAmount(e.target.value)}
                                                className="p-2 rounded-lg text-sm border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Comments / Notes"
                                                value={newRemarks}
                                                onChange={e => setNewRemarks(e.target.value)}
                                                className="p-2 rounded-lg text-sm border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                            />
                                            <input
                                                type="date"
                                                value={newEffectiveDate}
                                                onChange={e => setNewEffectiveDate(e.target.value)}
                                                className="p-2 rounded-lg text-sm border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                            />
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => { setShowAddComponent(false); setNewRemarks(''); }} className="px-3 py-1.5 text-slate-500 text-xs font-bold hover:bg-slate-200 rounded-lg">Cancel</button>
                                            <button onClick={handleAddComponent} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700">Save Allocation</button>
                                        </div>
                                    </div>
                                )}

                                <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-bold text-xs uppercase">
                                            <tr>
                                                <th className="px-4 py-3">Component</th>
                                                <th className="px-4 py-3">Type</th>
                                                <th className="px-4 py-3">Amount</th>
                                                <th className="px-4 py-3">Comments / Notes</th>
                                                <th className="px-4 py-3">Effective Since</th>
                                                <th className="px-4 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                            {empSalaryComponents.map(comp => (
                                                <tr key={comp.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                                        {comp.org_salary_components?.name}
                                                        <span className="block text-[10px] text-slate-400">{comp.org_salary_components?.code}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${comp.org_salary_components?.component_type === 'EARNING'
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-rose-100 text-rose-700'
                                                            }`}>
                                                            {comp.org_salary_components?.component_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                        QAR {Number(comp.amount || 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                                                        {comp.remarks || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">
                                                        {formatDate(comp.effective_from)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button onClick={() => handleDeleteComponent(comp.id)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {empSalaryComponents.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                                                        No salary components allocated yet.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Overall Salary / Compensation Remarks Card */}
                                {(emp as any).salary_remarks && (
                                    <div className="mt-4 p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-1">
                                        <h5 className="text-xs font-bold uppercase text-slate-400">Compensation Notes / Comments</h5>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium">{(emp as any).salary_remarks}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'LEAVES' && (
                        <div className="animate-fade-in-up space-y-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Leave Balances & History</h3>
                                    <p className="text-slate-400 text-xs mt-1">Accrued leave entitlements, used days, and applications record for {emp.name}.</p>
                                </div>
                                <button
                                    onClick={fetchEmployeeLeaves}
                                    className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                                >
                                    {loadingLeaves ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                                    Refresh Balances
                                </button>
                            </div>

                            {loadingLeaves ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-600" />
                                    <p className="text-xs font-bold">Loading leave balances...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Leave Balance Cards Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {leaveBalances.length > 0 ? (
                                            leaveBalances.map((b) => {
                                                const pct = b.total > 0 ? Math.min(100, Math.round((b.used / b.total) * 100)) : 0;
                                                return (
                                                    <div
                                                        key={b.id}
                                                        className="p-5 bg-white dark:bg-zinc-800/80 rounded-2xl border border-slate-100 dark:border-zinc-700/60 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden"
                                                    >
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">{b.name}</h4>
                                                                <span className="text-[10px] text-slate-400 font-mono">{b.code}</span>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                                                b.is_paid
                                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                                    : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-slate-300'
                                                            }`}>
                                                                {b.is_paid ? 'Paid' : 'Unpaid'}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-baseline gap-1.5 mb-3">
                                                            <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{b.remaining}</span>
                                                            <span className="text-xs text-slate-400 font-medium">days available</span>
                                                        </div>

                                                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-700/40">
                                                            <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                                <span>Used: <strong className="text-slate-700 dark:text-slate-200">{b.used}</strong> / Entitled: <strong className="text-slate-700 dark:text-slate-200">{b.total}</strong></span>
                                                                <span>{pct}%</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${
                                                                        pct >= 90 ? 'bg-rose-500' : pct >= 60 ? 'bg-amber-500' : 'bg-indigo-600'
                                                                    }`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="col-span-3 p-6 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-700 text-center text-slate-400 text-xs">
                                                No leave policies configured for this company.
                                            </div>
                                        )}
                                    </div>

                                    {/* Leave History / Applications */}
                                    <div className="bg-white dark:bg-zinc-800/80 rounded-2xl border border-slate-100 dark:border-zinc-700/60 overflow-hidden shadow-xs">
                                        <div className="p-4 border-b border-slate-100 dark:border-zinc-700 flex justify-between items-center">
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-indigo-500" />
                                                Leave Applications History ({employeeLeaves.length})
                                            </h4>
                                        </div>

                                        {employeeLeaves.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-50/70 dark:bg-zinc-700/30 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        <tr>
                                                            <th className="px-4 py-3">Leave Type</th>
                                                            <th className="px-4 py-3">Duration</th>
                                                            <th className="px-4 py-3 text-center">Days</th>
                                                            <th className="px-4 py-3">Reason / Memo</th>
                                                            <th className="px-4 py-3">Ticket / Attachment</th>
                                                            <th className="px-4 py-3">Remarks</th>
                                                            <th className="px-4 py-3 text-center">Status</th>
                                                            <th className="px-4 py-3 text-right">Applied Date</th>
                                                            <th className="px-4 py-3 text-center">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/40">
                                                        {employeeLeaves.map((l) => {
                                                            const isApproved = l.status === 'Approved' || l.status === 'approved';
                                                            const isPending = l.status === 'Pending' || l.status === 'pending';
                                                            const isRejected = l.status === 'Rejected' || l.status === 'rejected';

                                                            const start = new Date(l.start_date);
                                                            const end = new Date(l.end_date);
                                                            const diffTime = Math.abs(end.getTime() - start.getTime());
                                                            const days = l.days || Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 || 1;
                                                            const hasTicket = !!(l.ticket_url || l.attachment_url);

                                                            return (
                                                                <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-700/20">
                                                                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                                                                        {l.type || (leaveBalances.find(b => b.id === l.leave_type_id)?.name) || 'Leave'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                                                                        {formatDate(l.start_date)} <span className="text-slate-400">→</span> {formatDate(l.end_date)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-200">
                                                                        {days} {days === 1 ? 'day' : 'days'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                                                        {l.reason || l.manager_comment || '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        {hasTicket ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleViewTicketAttachment(l.ticket_url || l.attachment_url)}
                                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold transition-all shadow-xs"
                                                                                title={l.ticket_name || l.attachment_name || 'View Travel Ticket'}
                                                                            >
                                                                                <Ticket className="w-3.5 h-3.5" />
                                                                                <span className="max-w-[120px] truncate">
                                                                                    {l.ticket_name || l.attachment_name || (l.ticket_number ? `#${l.ticket_number}` : 'View Ticket')}
                                                                                </span>
                                                                                <ExternalLink className="w-3 h-3 opacity-60" />
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleOpenTicketModal(l)}
                                                                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-700 rounded transition-colors"
                                                                            >
                                                                                <Plus className="w-3 h-3" />
                                                                                Add Ticket
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[150px] truncate" title={l.remarks || l.manager_comment || ''}>
                                                                        {l.remarks ? (
                                                                            <span className="text-slate-700 dark:text-slate-300 font-medium">{l.remarks}</span>
                                                                        ) : (
                                                                            <span className="text-slate-300 dark:text-zinc-600">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                                            isApproved
                                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                                                : isPending
                                                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                                                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                                                        }`}>
                                                                            {isApproved && <CheckCircle className="w-3 h-3" />}
                                                                            {isPending && <Clock className="w-3 h-3" />}
                                                                            {isRejected && <AlertCircle className="w-3 h-3" />}
                                                                            {l.status || 'Pending'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right text-slate-400 font-mono">
                                                                        {formatDate(l.applied_on || l.created_at)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenTicketModal(l)}
                                                                            className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-1 mx-auto"
                                                                            title="Upload Ticket & Edit Remarks"
                                                                        >
                                                                            <Ticket className="w-3.5 h-3.5" />
                                                                            <span>Ticket & Remarks</span>
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center text-slate-400">
                                                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                <p className="text-xs font-medium">No leave applications recorded for this employee.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Ticket & Remarks Modal */}
                                    {selectedLeaveForTicket && (
                                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
                                            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-scale-up">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                                            <Ticket className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                                                                Leave Ticket & Remarks
                                                            </h3>
                                                            <p className="text-xs text-slate-500">
                                                                {emp.name} • {selectedLeaveForTicket.type || 'Leave'} ({formatDate(selectedLeaveForTicket.start_date)} → {formatDate(selectedLeaveForTicket.end_date)})
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedLeaveForTicket(null)}
                                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>

                                                <form onSubmit={handleSaveTicketDetails} className="space-y-4">
                                                    {/* Existing Attached Ticket */}
                                                    {(selectedLeaveForTicket.ticket_url || selectedLeaveForTicket.attachment_url) && (
                                                        <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl flex items-center justify-between">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                                                                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 truncate">
                                                                    {selectedLeaveForTicket.ticket_name || selectedLeaveForTicket.attachment_name || 'Current Ticket File'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleViewTicketAttachment(selectedLeaveForTicket.ticket_url || selectedLeaveForTicket.attachment_url)}
                                                                className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-zinc-800 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 shadow-xs shrink-0"
                                                            >
                                                                <ExternalLink className="w-3 h-3" /> View
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Upload Ticket File */}
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                                            {selectedLeaveForTicket.ticket_url ? 'Replace / Upload New Ticket' : 'Upload Ticket / Boarding Pass (PDF / Image)'}
                                                        </label>
                                                        <div className="relative border-2 border-dashed border-slate-200 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-2xl p-4 text-center transition-all bg-slate-50/50 dark:bg-zinc-800/40">
                                                            <input
                                                                type="file"
                                                                accept=".pdf,image/*,.doc,.docx"
                                                                onChange={e => {
                                                                    if (e.target.files && e.target.files[0]) {
                                                                        setTicketFile(e.target.files[0]);
                                                                    }
                                                                }}
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                            />
                                                            <Upload className="w-6 h-6 mx-auto mb-2 text-indigo-500" />
                                                            {ticketFile ? (
                                                                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                                    Selected: {ticketFile.name}
                                                                </p>
                                                            ) : (
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                    Click or drag & drop ticket file here
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Ticket # and Airline */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                                                Ticket / PNR Number
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={ticketNumber}
                                                                onChange={e => setTicketNumber(e.target.value)}
                                                                placeholder="e.g. 157-92019482"
                                                                className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                                                Airline / Route
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={airline}
                                                                onChange={e => setAirline(e.target.value)}
                                                                placeholder="e.g. Qatar Airways (DOH → COK)"
                                                                className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Remarks / Travel Notes */}
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                                            Remarks / Travel Notes
                                                        </label>
                                                        <textarea
                                                            rows={3}
                                                            value={leaveRemarks}
                                                            onChange={e => setLeaveRemarks(e.target.value)}
                                                            placeholder="Add any remarks, travel itinerary details, or HR notes..."
                                                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                                                        />
                                                    </div>

                                                    {/* Buttons */}
                                                    <div className="flex justify-end gap-3 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedLeaveForTicket(null)}
                                                            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            type="submit"
                                                            disabled={savingTicket}
                                                            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                                                        >
                                                            {savingTicket ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                            Save Ticket Details
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {tab === 'DOCUMENTS' && (
                        <div className="animate-fade-in-up">
                            {emp.id && emp.company_id ? (
                                <EmployeeDocuments
                                    employeeId={emp.id}
                                    companyId={emp.company_id}
                                    readOnly={false}
                                />
                            ) : (
                                <div className="p-10 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-[2rem] text-center text-slate-400 dark:text-slate-500">
                                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Employee profile not loaded.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'TIMELINE' && (
                        <div className="animate-fade-in-up">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Career Timeline</h3>
                                <button onClick={() => setShowTransitionModal(true)} className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                                    + Add Event
                                </button>
                            </div>
                            <CareerTimeline employeeId={emp.id} />
                        </div>
                    )}

                    {tab === 'TARGETS' && (
                        <div className="animate-fade-in-up">
                            <EmployeeTargets />
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <JobTransitionModal
                isOpen={showTransitionModal}
                onClose={() => setShowTransitionModal(false)}
                employee={emp as any}
                onSuccess={() => { refreshData && refreshData() }} // Note: need to pass refreshData logic down if needed
            />

            <CompensationChangeModal
                isOpen={showCompensationModal}
                onClose={() => setShowCompensationModal(false)}
                employee={emp as any}
                onSuccess={() => { refreshData && refreshData() }}
            />
        </div>
    );
}

const ViewField = ({ label, value, FullWidth = false }: { label: string, value: string | number, FullWidth?: boolean }) => (
    <div className={`p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700 ${FullWidth ? 'col-span-2' : ''}`}>
        <p className="text-xs text-slate-400 uppercase font-bold mb-1">{label}</p>
        <p className="font-bold text-slate-800 dark:text-slate-200">{value}</p>
    </div>
);
