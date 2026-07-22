import React, { useState, useEffect, useMemo } from 'react';
import { Check, X, LogOut, UserX, AlertTriangle, Plus, Filter, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Employee, EmployeeSeparation } from '../../../types';
import { Modal } from '../../ui/Modal';

interface ExitModuleProps {
    employees: Employee[];
    currentEmployee: Employee | null;
}

export type SeparationTypeFilter = 'ALL' | 'RESIGNATION' | 'TERMINATION' | 'RETIREMENT' | 'ABSCONDING' | 'CONTRACT_COMPLETION' | 'DEATH' | 'OTHER';

export const ExitModule: React.FC<ExitModuleProps> = ({ employees, currentEmployee }) => {
    const [separations, setSeparations] = useState<EmployeeSeparation[]>([]);
    const [activeSubtab, setActiveSubtab] = useState<SeparationTypeFilter>('ALL');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [sepType, setSepType] = useState<string>('RESIGNATION');
    const [reasonCategory, setReasonCategory] = useState('');
    const [reasonText, setReasonText] = useState('');
    const [lastWorkingDay, setLastWorkingDay] = useState(new Date().toISOString().split('T')[0]);
    const [relievingDate, setRelievingDate] = useState('');
    const [noticePeriodDays, setNoticePeriodDays] = useState(30);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchSeparations();
    }, []);

    const fetchSeparations = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('resignations')
            .select(`
                *,
                employee:employees!employee_id(id, name, designation, department, email)
            `)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setSeparations(data as any);
        }
        setLoading(false);
    };

    const handleUpdateStatus = async (id: string, empId: string, status: 'Approved' | 'Rejected', separationType: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: approverEmp } = await supabase.from('employees').select('id').eq('profile_id', user?.id).maybeSingle();

            // 1. Update separation record
            const { error: sepError } = await supabase.from('resignations').update({
                status: status,
                exit_status: status,
                approved_by: approverEmp?.id || currentEmployee?.id || null,
                approved_at: new Date().toISOString(),
                manager_comment: `Processed as ${status} by HR/Admin`
            }).eq('id', id);

            if (sepError) throw sepError;

            // 2. If approved, automatically update employee status without deleting record
            if (status === 'Approved') {
                let empStatus = 'Resigned';
                if (separationType === 'TERMINATION') empStatus = 'Terminated';
                else if (separationType === 'RETIREMENT') empStatus = 'Retired';
                else if (separationType === 'ABSCONDING') empStatus = 'Absconded';
                else if (separationType === 'DEATH') empStatus = 'Deceased';
                else if (separationType === 'CONTRACT_COMPLETION') empStatus = 'Contract Completed';

                await supabase.from('employees').update({
                    status: empStatus
                }).eq('id', empId);
            }

            alert(`Separation request ${status.toLowerCase()} successfully.`);
            fetchSeparations();
        } catch (err: any) {
            alert("Error processing approval: " + err.message);
        }
    };

    const handleCreateSeparation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        const targetEmpId = selectedEmployeeId || currentEmployee?.id;
        if (!targetEmpId) {
            alert("Please select an employee.");
            return;
        }

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user?.id).maybeSingle();

            const { error } = await supabase.from('resignations').insert([{
                company_id: profile?.company_id || currentEmployee?.company_id,
                employee_id: targetEmpId,
                separation_type: sepType,
                reason_category: reasonCategory,
                reason_text: reasonText,
                proposed_last_working_date: lastWorkingDay,
                relieving_date: relievingDate || lastWorkingDay,
                notice_period_days: noticePeriodDays,
                status: 'Pending',
                exit_status: 'Pending'
            } as any]);

            if (error) throw error;

            alert("Employee separation record created successfully.");
            setShowModal(false);
            fetchSeparations();
        } catch (err: any) {
            alert("Error creating separation record: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const subtabItems = [
        { id: 'ALL', label: 'All Separations' },
        { id: 'RESIGNATION', label: 'Resignation' },
        { id: 'TERMINATION', label: 'Termination' },
        { id: 'RETIREMENT', label: 'Retirement' },
        { id: 'ABSCONDING', label: 'Absconding' },
        { id: 'CONTRACT_COMPLETION', label: 'Contract Completion' },
        { id: 'DEATH', label: 'Death' },
        { id: 'OTHER', label: 'Other Separation' },
    ];

    const filteredSeparations = useMemo(() => {
        if (activeSubtab === 'ALL') return separations;
        return separations.filter(s => (s.separation_type || 'RESIGNATION') === activeSubtab);
    }, [separations, activeSubtab]);

    const getEmployeeName = (empId: string, empObj?: Employee) => {
        if (empObj?.name) return empObj.name;
        const emp = employees.find(e => e.id === empId);
        return emp ? emp.name : 'Staff Member';
    };

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 shrink-0">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <UserX className="w-8 h-8 text-rose-600" />
                        Employee Separation Management
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                        Manage resignations, terminations, retirements, and offboarding workflows safely without deleting employee history.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setSelectedEmployeeId('');
                        setSepType('RESIGNATION');
                        setReasonCategory('');
                        setReasonText('');
                        setNoticePeriodDays(30);
                        setShowModal(true);
                    }}
                    className="bg-rose-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-rose-700 hover:shadow-lg shadow-rose-500/30 transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4" /> Initiate Separation
                </button>
            </div>

            {/* Submenu Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-6 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                {subtabItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveSubtab(item.id as SeparationTypeFilter)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                            activeSubtab === item.id
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                                : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-zinc-800'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="flex-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 dark:bg-zinc-800/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/60 dark:border-zinc-700">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Employee</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Separation Type</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reason & Notice</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Last Working Day</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50">
                                {filteredSeparations.length > 0 ? filteredSeparations.map((res) => (
                                    <tr key={res.id} className="hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 dark:text-white">
                                                {getEmployeeName(res.employee_id, res.employee)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300">
                                                {res.separation_type || 'RESIGNATION'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{res.reason_category || 'General'}</span>
                                            <span className="text-xs text-slate-400 block max-w-xs truncate">{res.reason_text || '—'}</span>
                                            <span className="text-[10px] text-indigo-500 font-mono">Notice: {res.notice_period_days || 0} days</span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-slate-300">
                                            {res.proposed_last_working_date || res.last_working_day || '—'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                res.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                                res.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {res.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {res.status === 'Pending' && (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleUpdateStatus(res.id, res.employee_id, 'Approved', res.separation_type || 'RESIGNATION')}
                                                        title="Approve Separation & Update Status"
                                                        className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-1 font-bold text-xs"
                                                    >
                                                        <Check className="w-4 h-4" /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateStatus(res.id, res.employee_id, 'Rejected', res.separation_type || 'RESIGNATION')}
                                                        title="Reject Request"
                                                        className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors flex items-center gap-1 font-bold text-xs"
                                                    >
                                                        <X className="w-4 h-4" /> Reject
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-400 italic">
                                            No separation records found for tab "{activeSubtab}".
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <Modal title="Initiate Employee Separation" onClose={() => setShowModal(false)}>
                    <form onSubmit={handleCreateSeparation} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Employee *</label>
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                required
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                            >
                                <option value="">Select Employee...</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.designation || 'Staff'} - {emp.department || 'General'})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Separation Type *</label>
                                <select
                                    value={sepType}
                                    onChange={(e) => setSepType(e.target.value)}
                                    required
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                >
                                    <option value="RESIGNATION">Resignation</option>
                                    <option value="TERMINATION">Termination</option>
                                    <option value="RETIREMENT">Retirement</option>
                                    <option value="ABSCONDING">Absconding</option>
                                    <option value="CONTRACT_COMPLETION">Contract Completion</option>
                                    <option value="DEATH">Death</option>
                                    <option value="OTHER">Other Separation</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Reason Category</label>
                                <input
                                    type="text"
                                    value={reasonCategory}
                                    onChange={(e) => setReasonCategory(e.target.value)}
                                    placeholder="e.g. Career Growth / Conduct / Mutual"
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Notice Period (Days)</label>
                                <input
                                    type="number"
                                    value={noticePeriodDays}
                                    onChange={(e) => setNoticePeriodDays(parseInt(e.target.value) || 0)}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Last Working Day *</label>
                                <input
                                    type="date"
                                    value={lastWorkingDay}
                                    onChange={(e) => setLastWorkingDay(e.target.value)}
                                    required
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Relieving Date</label>
                                <input
                                    type="date"
                                    value={relievingDate}
                                    onChange={(e) => setRelievingDate(e.target.value)}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Detailed Remarks / Reason</label>
                            <textarea
                                value={reasonText}
                                onChange={(e) => setReasonText(e.target.value)}
                                required
                                placeholder="State reason and details..."
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white min-h-[90px]"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold hover:shadow-lg shadow-rose-500/30 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {submitting ? 'Submitting...' : 'Submit Separation Record'}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
