import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Check, X, Edit3, Trash2, Search, UserCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Employee, EmployeeLeaveAuthority } from '../../../types';
import { Modal } from '../../ui/Modal';

interface LeaveAuthorityMappingProps {
    companyId: string;
}

export const LeaveAuthorityMapping: React.FC<LeaveAuthorityMappingProps> = ({ companyId }) => {
    const [authorities, setAuthorities] = useState<EmployeeLeaveAuthority[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<EmployeeLeaveAuthority | null>(null);

    // Form state
    const [employeeId, setEmployeeId] = useState('');
    const [level1, setLevel1] = useState('');
    const [level2, setLevel2] = useState('');
    const [level3, setLevel3] = useState('');
    const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
    const [effectiveTo, setEffectiveTo] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (companyId) {
            fetchData();
        }
    }, [companyId]);

    const fetchData = async () => {
        setLoading(true);
        // Fetch active employees
        const { data: empData } = await supabase.from('employees')
            .select('*')
            .eq('company_id', companyId)
            .order('name');

        if (empData) setEmployees(empData as any);

        // Fetch authority mappings
        const { data: authData } = await supabase.from('employee_leave_authority')
            .select(`
                *,
                employee:employees!employee_id(id, name, designation, department, profile_photo_url),
                approver_level_1_emp:employees!approver_level_1(id, name, designation),
                approver_level_2_emp:employees!approver_level_2(id, name, designation),
                approver_level_3_emp:employees!approver_level_3(id, name, designation)
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (authData) setAuthorities(authData as any);
        setLoading(false);
    };

    const handleOpenModal = (item?: EmployeeLeaveAuthority) => {
        setFormError('');
        if (item) {
            setEditingItem(item);
            setEmployeeId(item.employee_id);
            setLevel1(item.approver_level_1 || '');
            setLevel2(item.approver_level_2 || '');
            setLevel3(item.approver_level_3 || '');
            setEffectiveFrom(item.effective_from || new Date().toISOString().split('T')[0]);
            setEffectiveTo(item.effective_to || '');
            setIsActive(item.is_active ?? true);
        } else {
            setEditingItem(null);
            setEmployeeId('');
            setLevel1('');
            setLevel2('');
            setLevel3('');
            setEffectiveFrom(new Date().toISOString().split('T')[0]);
            setEffectiveTo('');
            setIsActive(true);
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        // 1. Validation: Employee required
        if (!employeeId) {
            setFormError("Please select an employee.");
            return;
        }

        // 2. Validation: Employee cannot approve their own leave
        if (employeeId === level1 || employeeId === level2 || employeeId === level3) {
            setFormError("An employee cannot be designated as their own leave approver.");
            return;
        }

        // 3. Validation: Same approver cannot exist multiple times in hierarchy
        const selectedApprovers = [level1, level2, level3].filter(Boolean);
        const uniqueApprovers = new Set(selectedApprovers);
        if (selectedApprovers.length !== uniqueApprovers.size) {
            setFormError("The same approver cannot exist multiple times in the approval hierarchy.");
            return;
        }

        if (selectedApprovers.length === 0) {
            setFormError("Please select at least Level 1 approver.");
            return;
        }

        setSubmitting(true);
        try {
            const payload: any = {
                company_id: companyId,
                employee_id: employeeId,
                approver_level_1: level1 || null,
                approver_level_2: level2 || null,
                approver_level_3: level3 || null,
                effective_from: effectiveFrom,
                effective_to: effectiveTo || null,
                is_active: isActive
            };

            if (editingItem) {
                const { error } = await supabase.from('employee_leave_authority')
                    .update(payload)
                    .eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('employee_leave_authority')
                    .insert([payload]);
                if (error) throw error;
            }

            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.message || "Failed to save mapping.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this leave authority mapping?")) return;
        const { error } = await supabase.from('employee_leave_authority').delete().eq('id', id);
        if (error) alert("Error deleting: " + error.message);
        else fetchData();
    };

    const filteredAuthorities = authorities.filter(a => {
        const empName = a.employee?.name?.toLowerCase() || '';
        const dept = a.employee?.department?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        return empName.includes(query) || dept.includes(query);
    });

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 shrink-0">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-emerald-600" />
                        Leave Authority Mapping
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                        Define multi-level leave approval hierarchies per employee (Level 1, 2, and 3 Approvers).
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Add Mapping
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-6 shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by employee name or department..."
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
            </div>

            {/* Table */}
            <div className="flex-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 dark:bg-zinc-800/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/60 dark:border-zinc-700">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Employee</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Level 1 Approver</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Level 2 Approver</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Level 3 Approver</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Effective Dates</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50">
                                {filteredAuthorities.length > 0 ? (
                                    filteredAuthorities.map((auth) => (
                                        <tr key={auth.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm">
                                                        {auth.employee?.name?.charAt(0) || 'E'}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white">{auth.employee?.name || 'Unknown'}</p>
                                                        <p className="text-xs text-slate-400">{auth.employee?.designation || 'Staff'} • {auth.employee?.department || 'General'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {auth.approver_level_1_emp?.name ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg">
                                                        <UserCheck className="w-3.5 h-3.5" /> {auth.approver_level_1_emp.name}
                                                    </span>
                                                ) : <span className="text-slate-400 italic">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {auth.approver_level_2_emp?.name ? (
                                                    <span className="inline-flex items-center gap-1 text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-lg">
                                                        <UserCheck className="w-3.5 h-3.5" /> {auth.approver_level_2_emp.name}
                                                    </span>
                                                ) : <span className="text-slate-400 italic">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {auth.approver_level_3_emp?.name ? (
                                                    <span className="inline-flex items-center gap-1 text-purple-600 font-bold bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1 rounded-lg">
                                                        <UserCheck className="w-3.5 h-3.5" /> {auth.approver_level_3_emp.name}
                                                    </span>
                                                ) : <span className="text-slate-400 italic">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                                From: {auth.effective_from}
                                                {auth.effective_to ? ` To: ${auth.effective_to}` : ' (Indefinite)'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                    auth.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {auth.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(auth)}
                                                        className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-zinc-800 transition-colors"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(auth.id)}
                                                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-zinc-800 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-slate-400 italic">
                                            No leave authority mappings found. Click "Add Mapping" to create one.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Form Modal */}
            {showModal && (
                <Modal title={editingItem ? "Edit Leave Authority Mapping" : "New Leave Authority Mapping"} onClose={() => setShowModal(false)} maxWidth="max-w-xl">
                    <form onSubmit={handleSave} className="space-y-4">
                        {formError && (
                            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm font-medium">
                                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                                <span>{formError}</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Target Employee *</label>
                            <select
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                disabled={!!editingItem}
                                required
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                                <option value="">Select Employee...</option>
                                {employees.map((e) => (
                                    <option key={e.id} value={e.id}>{e.name} ({e.designation || 'Staff'})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-3 pt-2">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Approver Level 1 (Primary) *</label>
                                <select
                                    value={level1}
                                    onChange={(e) => setLevel1(e.target.value)}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                                >
                                    <option value="">Select Primary Approver...</option>
                                    {employees.filter(e => e.id !== employeeId).map((e) => (
                                        <option key={e.id} value={e.id}>{e.name} ({e.designation || 'Staff'})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Approver Level 2 (Secondary - Optional)</label>
                                <select
                                    value={level2}
                                    onChange={(e) => setLevel2(e.target.value)}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                                >
                                    <option value="">Select Secondary Approver...</option>
                                    {employees.filter(e => e.id !== employeeId && e.id !== level1).map((e) => (
                                        <option key={e.id} value={e.id}>{e.name} ({e.designation || 'Staff'})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Approver Level 3 (Final - Optional)</label>
                                <select
                                    value={level3}
                                    onChange={(e) => setLevel3(e.target.value)}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                                >
                                    <option value="">Select Final Approver...</option>
                                    {employees.filter(e => e.id !== employeeId && e.id !== level1 && e.id !== level2).map((e) => (
                                        <option key={e.id} value={e.id}>{e.name} ({e.designation || 'Staff'})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Effective From *</label>
                                <input
                                    type="date"
                                    value={effectiveFrom}
                                    onChange={(e) => setEffectiveFrom(e.target.value)}
                                    required
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Effective To (Optional)</label>
                                <input
                                    type="date"
                                    value={effectiveTo}
                                    onChange={(e) => setEffectiveTo(e.target.value)}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <input
                                type="checkbox"
                                id="active_status"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="w-5 h-5 accent-emerald-600 rounded"
                            />
                            <label htmlFor="active_status" className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                Active Status
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:shadow-lg shadow-emerald-500/30 transition-all active:scale-95 disabled:opacity-50 mt-4"
                        >
                            {submitting ? 'Saving...' : 'Save Leave Authority Mapping'}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
