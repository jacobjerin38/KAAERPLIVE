import React, { useState, useEffect } from 'react';
import {
    Calendar, Check, X, Settings, Plus, Trash2, Loader2, Save, Paperclip,
    Ticket, ExternalLink, Upload, FileText
} from 'lucide-react';
import { LeaveRequest } from '../../hrms/types';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

const handleViewAttachment = async (url: string) => {
    const path = url.split('/storage/v1/object/public/attachments/')[1];
    if (!path) return window.open(url, '_blank');
    try {
        const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 60);
        if (error) throw error;
        window.open(data.signedUrl, '_blank');
    } catch (err: any) {
        console.error(err);
        alert('Could not view: ' + err.message);
    }
};

interface LeaveModuleProps {
    leaves: LeaveRequest[];
    leaveTypes: any[];
    employees?: any[];
    setShowLeaveModal: (show: boolean) => void;
    onUpdateStatus: (id: string, status: 'Approved' | 'Rejected', level?: 1 | 2) => void;
    formatDate: (date: string) => string;
}

// ─── Leave Policy Settings Panel ──────────────────────────────────────────────

interface LeaveTypeRow {
    id?: number;
    name: string;
    code: string;
    default_balance: number;
    is_paid: boolean;
    requires_approval: boolean;
    status: string;
    isNew?: boolean;
}

const LeavePolicySettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { currentCompanyId } = useAuth();
    const [types, setTypes] = useState<LeaveTypeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchTypes();
    }, []);

    const fetchTypes = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        const { data, error: err } = await supabase
            .from('org_leave_types')
            .select('*')
            .eq('company_id', currentCompanyId)
            .order('name');
        if (err) { setError(err.message); setLoading(false); return; }
        setTypes((data || []).map((d: any) => ({
            id: d.id,
            name: d.name || '',
            code: d.code || '',
            default_balance: d.default_balance || 0,
            is_paid: d.is_paid ?? true,
            requires_approval: d.requires_approval ?? true,
            status: d.status || 'Active',
        })));
        setLoading(false);
    };

    const addRow = () => {
        setTypes(prev => [...prev, {
            name: '', code: '', default_balance: 0,
            is_paid: true, requires_approval: true, status: 'Active', isNew: true
        }]);
    };

    const updateRow = (idx: number, field: string, value: any) => {
        setTypes(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    };

    const deleteRow = async (idx: number) => {
        const row = types[idx];
        if (row.id) {
            await supabase.from('org_leave_types').delete().eq('id', row.id);
        }
        setTypes(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        if (!currentCompanyId) return;
        setSaving(true);
        setError('');
        try {
            for (const row of types) {
                if (!row.name.trim()) continue;
                const payload = {
                    company_id: currentCompanyId,
                    name: row.name.trim(),
                    code: row.code.trim(),
                    default_balance: row.default_balance,
                    is_paid: row.is_paid,
                    requires_approval: row.requires_approval,
                    status: row.status,
                };
                if (row.id && !row.isNew) {
                    await supabase.from('org_leave_types').update(payload).eq('id', row.id);
                } else {
                    await supabase.from('org_leave_types').insert([payload]);
                }
            }
            await fetchTypes();
        } catch (e: any) {
            setError(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/10 dark:to-violet-900/10 flex-shrink-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-600" /> Leave Policy Settings
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                        <X className="w-4 h-4 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {error && (
                        <div className="mb-4 px-4 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-sm text-rose-600 dark:text-rose-400">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
                        </div>
                    ) : (
                        <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-x-auto">
                            <table className="w-full text-sm min-w-[600px]">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-zinc-800 text-left text-xs text-slate-500 uppercase tracking-wider">
                                        <th className="px-4 py-3">Leave Type</th>
                                        <th className="px-4 py-3 w-20">Code</th>
                                        <th className="px-4 py-3 w-24 text-center">Days/Year</th>
                                        <th className="px-4 py-3 w-16 text-center">Paid</th>
                                        <th className="px-4 py-3 w-20 text-center">Approval</th>
                                        <th className="px-4 py-3 w-24">Status</th>
                                        <th className="px-4 py-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {types.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                            <td className="px-4 py-2">
                                                <input value={row.name} onChange={e => updateRow(idx, 'name', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-transparent border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/30 text-slate-800 dark:text-white"
                                                    placeholder="e.g. Annual Leave" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input value={row.code} onChange={e => updateRow(idx, 'code', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-transparent border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/30 text-slate-800 dark:text-white"
                                                    placeholder="AL" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input type="number" min="0" value={row.default_balance} onChange={e => updateRow(idx, 'default_balance', parseInt(e.target.value) || 0)}
                                                    className="w-full px-2 py-1.5 bg-transparent border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500/30 text-slate-800 dark:text-white" />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <input type="checkbox" checked={row.is_paid} onChange={e => updateRow(idx, 'is_paid', e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <input type="checkbox" checked={row.requires_approval} onChange={e => updateRow(idx, 'requires_approval', e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <select value={row.status} onChange={e => updateRow(idx, 'status', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-transparent border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-bold focus:outline-none text-slate-700 dark:text-slate-300">
                                                    <option value="Active">Active</option>
                                                    <option value="Inactive">Inactive</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-2">
                                                <button onClick={() => deleteRow(idx)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {types.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-slate-400 italic">No leave types configured. Click "Add Type" to create one.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <button onClick={addRow} className="mt-4 flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                        <Plus className="w-4 h-4" /> Add Leave Type
                    </button>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3 flex-shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium text-sm font-semibold">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-50 font-semibold">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export const LeaveModule: React.FC<LeaveModuleProps> = ({
    leaves, leaveTypes, employees: initialEmployees, setShowLeaveModal, onUpdateStatus, formatDate
}) => {
    const { currentCompanyId } = useAuth();
    const [showPolicySettings, setShowPolicySettings] = useState(false);
    const [employeesList, setEmployeesList] = useState<any[]>(initialEmployees || []);

    // Ticket & Remarks Management State
    const [selectedLeaveForTicket, setSelectedLeaveForTicket] = useState<any | null>(null);
    const [ticketFile, setTicketFile] = useState<File | null>(null);
    const [ticketNumber, setTicketNumber] = useState('');
    const [airline, setAirline] = useState('');
    const [leaveRemarks, setLeaveRemarks] = useState('');
    const [savingTicket, setSavingTicket] = useState(false);

    // Fetch and sync employees
    const fetchEmployees = async () => {
        let query = supabase.from('employees').select('id, name, employee_code, profile_id, profile_photo_url, company_id');
        if (currentCompanyId) {
            query = query.eq('company_id', currentCompanyId);
        }
        const { data } = await query;
        if (data && data.length > 0) {
            setEmployeesList(prev => {
                const map = new Map();
                prev.forEach(e => map.set(e.id, e));
                data.forEach(e => map.set(e.id, e));
                return Array.from(map.values());
            });
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, [currentCompanyId]);

    useEffect(() => {
        if (initialEmployees && initialEmployees.length > 0) {
            setEmployeesList(prev => {
                const map = new Map();
                prev.forEach(e => map.set(e.id, e));
                initialEmployees.forEach((e: any) => map.set(e.id, e));
                return Array.from(map.values());
            });
        }
    }, [initialEmployees]);

    const handleOpenTicketModal = (leave: any) => {
        setSelectedLeaveForTicket(leave);
        setTicketFile(null);
        setTicketNumber((leave as any).ticket_number || '');
        setAirline((leave as any).airline || '');
        setLeaveRemarks((leave as any).remarks || (leave as any).manager_comment || '');
    };

    const handleSaveTicketDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLeaveForTicket) return;
        setSavingTicket(true);

        try {
            let ticketUrl = (selectedLeaveForTicket as any).ticket_url || selectedLeaveForTicket.attachment_url || null;
            let ticketName = (selectedLeaveForTicket as any).ticket_name || selectedLeaveForTicket.attachment_name || null;

            if (ticketFile) {
                const companyId = currentCompanyId || (selectedLeaveForTicket as any).company_id || 'general';
                const cleanFileName = ticketFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const path = `${companyId}/leaves/tickets/${Date.now()}_${cleanFileName}`;

                const { error: uploadErr } = await supabase.storage
                    .from('attachments')
                    .upload(path, ticketFile, { upsert: true });

                if (uploadErr) throw uploadErr;

                const { data: urlData } = supabase.storage
                    .from('attachments')
                    .getPublicUrl(path);

                ticketUrl = urlData.publicUrl;
                ticketName = ticketFile.name;
            }

            const { error: updateErr } = await (supabase.from('leaves') as any)
                .update({
                    ticket_url: ticketUrl,
                    ticket_name: ticketName,
                    ticket_number: ticketNumber || null,
                    airline: airline || null,
                    remarks: leaveRemarks || null
                })
                .eq('id', selectedLeaveForTicket.id);

            if (updateErr) throw updateErr;

            alert('Ticket details and remarks saved successfully!');
            setSelectedLeaveForTicket(null);
            setTicketFile(null);
            window.location.reload();
        } catch (err: any) {
            console.error('Error saving ticket details:', err);
            alert('Failed to save ticket details: ' + (err.message || 'Unknown error'));
        } finally {
            setSavingTicket(false);
        }
    };

    // Quick Stats Calculation
    const pendingCount = leaves.filter(l => l.status === 'Pending').length;
    const approvedCount = leaves.filter(l => l.status === 'Approved').length;
    const onLeaveCount = leaves.filter(l => l.status === 'Approved').length;

    const safeFormatDate = (dStr?: string | null) => {
        if (!dStr) return '—';
        try {
            const d = new Date(dStr);
            if (isNaN(d.getTime())) return dStr;
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return String(dStr);
        }
    };

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <header className="flex justify-between items-center mb-8 shrink-0">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Leave Administration</h2>
                <div className="flex gap-2">
                    <button onClick={() => setShowPolicySettings(true)} className="px-5 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-zinc-700 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Policy Settings
                    </button>
                    <button onClick={() => setShowLeaveModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all">Grant Leave</button>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 shrink-0">
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pending</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{pendingCount}</h3>
                    </div>
                </div>
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                        <Check className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Approved Total</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{approvedCount}</h3>
                    </div>
                </div>
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center">
                        <X className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">On Leave</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{onLeaveCount}</h3>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Leave Requests</h3>
                    <div className="flex gap-2 text-sm">
                        <button className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg font-bold text-slate-600 dark:text-slate-300">All</button>
                        <button className="px-3 py-1 bg-transparent rounded-lg font-medium text-slate-400 hover:text-indigo-500">Pending</button>
                        <button className="px-3 py-1 bg-transparent rounded-lg font-medium text-slate-400 hover:text-indigo-500">History</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 dark:bg-zinc-800/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/60 dark:border-zinc-700">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dates & Duration</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reason / Remarks</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Ticket / Attachment</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50">
                            {leaves.length > 0 ? leaves.map((req, i) => {
                                const rawEmp = (req as any).employees || (req as any).employee;
                                const joinedEmp = Array.isArray(rawEmp) ? rawEmp[0] : (rawEmp && typeof rawEmp === 'object' ? rawEmp : null);
                                const targetEmpId = (req as any).employee_id || (req as any).employeeId || (req as any).user_id || joinedEmp?.id;

                                const matchedEmp = employeesList.find(e => 
                                    (targetEmpId && String(e.id).toLowerCase() === String(targetEmpId).toLowerCase()) ||
                                    (targetEmpId && e.profile_id && String(e.profile_id).toLowerCase() === String(targetEmpId).toLowerCase()) ||
                                    ((req as any).employee_code && e.employee_code && String(e.employee_code).toLowerCase() === String((req as any).employee_code).toLowerCase())
                                ) || joinedEmp;

                                const empName = matchedEmp?.name || 
                                                joinedEmp?.name || 
                                                (req as any).employee_name || 
                                                (req as any).name || 
                                                (matchedEmp?.employee_code ? `Employee (${matchedEmp.employee_code})` : null) ||
                                                (targetEmpId ? `Employee #${String(targetEmpId).substring(0, 6)}` : `Leave #${(req.id || '').substring(0, 4)}`);

                                const empCode = matchedEmp?.employee_code || 
                                                joinedEmp?.employee_code || 
                                                (req as any).employee_code || 
                                                (req as any).emp_code || '';

                                const sDate = (req as any).start_date || (req as any).startDate || (req as any).from;
                                const eDate = (req as any).end_date || (req as any).endDate || (req as any).to;

                                let totalDays = (req as any).days;
                                if (!totalDays && sDate && eDate) {
                                    const start = new Date(sDate);
                                    const end = new Date(eDate);
                                    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                                        totalDays = Math.round(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                    }
                                }

                                const hasTicket = !!((req as any).ticket_url || req.attachment_url);

                                return (
                                    <tr key={req.id || i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 dark:text-slate-200">{empName}</div>
                                            {empCode && (
                                                <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded block w-fit mt-0.5">
                                                    {empCode}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                                            {leaveTypes.find(lt => String(lt.id) === String(req.leave_type_id))?.name || req.type || 'Leave'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {sDate ? (
                                                <div>
                                                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                        {safeFormatDate(sDate)} {eDate && eDate !== sDate ? `→ ${safeFormatDate(eDate)}` : ''}
                                                    </div>
                                                    {totalDays ? (
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 block">
                                                            {totalDays} {totalDays === 1 ? 'day' : 'days'}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : (req as any).appliedOn || (req as any).created_at ? (
                                                <span className="text-xs font-mono text-slate-400">
                                                    {safeFormatDate((req as any).appliedOn || (req as any).created_at)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-zinc-700">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                                            <p className="truncate font-medium">{req.reason || 'Leave'}</p>
                                            {(req as any).remarks && (
                                                <p className="text-xs text-slate-400 truncate mt-0.5">
                                                    Remark: {(req as any).remarks}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                            {hasTicket ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewAttachment(((req as any).ticket_url || req.attachment_url)!)}
                                                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50 hover:shadow-sm transition-all"
                                                    title={(req as any).ticket_name || req.attachment_name || 'View Travel Ticket'}
                                                >
                                                    <Ticket className="w-3.5 h-3.5" />
                                                    <span className="max-w-[120px] truncate">
                                                        {(req as any).ticket_name || req.attachment_name || ((req as any).ticket_number ? `#${(req as any).ticket_number}` : 'View Ticket')}
                                                    </span>
                                                    <ExternalLink className="w-3 h-3 opacity-60" />
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenTicketModal(req)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                                >
                                                    <Plus className="w-3 h-3" /> Add Ticket
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold w-fit ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                                                    req.status === 'Rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                                    }`}>Final: {req.status}</span>
                                                {req.status === 'Pending' && (
                                                    <div className="flex flex-col gap-0.5 mt-1">
                                                        <span className={`text-[10px] font-medium ${req.level1_status === 'Approved' ? 'text-emerald-500 font-bold' : req.level1_status === 'Rejected' ? 'text-rose-500 font-bold' : 'text-amber-500'}`}>L1 (Dept): {req.level1_status || 'Pending'}</span>
                                                        <span className={`text-[10px] font-medium ${req.level2_status === 'Approved' ? 'text-emerald-500 font-bold' : req.level2_status === 'Rejected' ? 'text-rose-500 font-bold' : 'text-amber-500'}`}>L2 (HR): {req.level2_status || 'Pending'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenTicketModal(req)}
                                                    className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1"
                                                    title="Upload Ticket & Edit Remarks"
                                                >
                                                    <Ticket className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Ticket & Remarks</span>
                                                </button>

                                                {req.status === 'Pending' && (
                                                    <div className="flex items-center gap-1 scale-90 origin-right">
                                                        {(!req.level1_status || req.level1_status === 'Pending') && (
                                                            <>
                                                                <button title="Approve L1" onClick={() => onUpdateStatus(req.id, 'Approved', 1)} className="p-1 px-2 border border-emerald-200 bg-emerald-50 text-emerald-600 rounded flex gap-1 items-center hover:bg-emerald-100 transition-colors text-xs font-bold"><Check className="w-3 h-3" /> Approve</button>
                                                                <button title="Reject L1" onClick={() => onUpdateStatus(req.id, 'Rejected', 1)} className="p-1 px-2 border border-rose-200 bg-rose-50 text-rose-600 rounded flex gap-1 items-center hover:bg-rose-100 transition-colors text-xs font-bold"><X className="w-3 h-3" /> Reject</button>
                                                            </>
                                                        )}
                                                        {req.level1_status === 'Approved' && (!req.level2_status || req.level2_status === 'Pending') && (
                                                            <>
                                                                <button title="Approve L2" onClick={() => onUpdateStatus(req.id, 'Approved', 2)} className="p-1 px-2 border border-emerald-200 bg-emerald-50 text-emerald-600 rounded flex gap-1 items-center hover:bg-emerald-100 transition-colors text-xs font-bold"><Check className="w-3 h-3" /> Approve</button>
                                                                <button title="Reject L2" onClick={() => onUpdateStatus(req.id, 'Rejected', 2)} className="p-1 px-2 border border-rose-200 bg-rose-50 text-rose-600 rounded flex gap-1 items-center hover:bg-rose-100 transition-colors text-xs font-bold"><X className="w-3 h-3" /> Reject</button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={7} className="text-center py-10 text-slate-400 italic">No leave requests found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
                                        {selectedLeaveForTicket.type || 'Leave'} ({safeFormatDate(selectedLeaveForTicket.start_date || selectedLeaveForTicket.startDate)} → {safeFormatDate(selectedLeaveForTicket.end_date || selectedLeaveForTicket.endDate)})
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
                            {((selectedLeaveForTicket as any).ticket_url || selectedLeaveForTicket.attachment_url) && (
                                <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                                        <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 truncate">
                                            {(selectedLeaveForTicket as any).ticket_name || selectedLeaveForTicket.attachment_name || 'Current Ticket Document'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleViewAttachment(((selectedLeaveForTicket as any).ticket_url || selectedLeaveForTicket.attachment_url)!)}
                                        className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-zinc-800 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 shadow-xs shrink-0"
                                    >
                                        <ExternalLink className="w-3 h-3" /> View
                                    </button>
                                </div>
                            )}

                            {/* Upload Ticket File */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    {(selectedLeaveForTicket as any).ticket_url ? 'Replace / Upload New Ticket' : 'Upload Ticket / Boarding Pass (PDF / Image)'}
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

            {/* Policy Settings Modal */}
            {showPolicySettings && <LeavePolicySettings onClose={() => setShowPolicySettings(false)} />}
        </div>
    );
};

