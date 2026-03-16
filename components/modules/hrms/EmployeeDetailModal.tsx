import React, { useState, useEffect } from 'react';
import {
    Users, Briefcase, Phone, DollarSign, FileText, Edit3,
    Plus, Trash2, X, TrendingUp, MoreVertical, ArrowRightLeft
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Employee } from '../../hrms/types';
import { JobTransitionModal } from '../../hrms/transitions/JobTransitionModal';
import { CompensationChangeModal } from '../../hrms/transitions/CompensationChangeModal';
import { CareerTimeline } from '../../hrms/transitions/CareerTimeline';

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
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
    emp, onClose, onEdit, refreshData,
    departments, locations, designations, grades, employmentTypes, payGroups, roles, employees, salaryComponents
}) => {
    const [tab, setTab] = useState<'PROFILE' | 'JOB' | 'CONTACT' | 'FINANCIAL' | 'DOCUMENTS' | 'TIMELINE'>('PROFILE');

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
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Fetch Salary Mapping
    const fetchSalaryMapping = async () => {
        setLoadingComponents(true);
        const { data, error } = await supabase
            .from('employee_salary_components')
            .select('*, org_salary_components(name, code, component_type)')
            .eq('employee_id', emp.id)
            .order('effective_from', { ascending: false });

        if (data) setEmpSalaryComponents(data);
        setLoadingComponents(false);
    };

    useEffect(() => {
        if (tab === 'FINANCIAL') {
            fetchSalaryMapping();
        }
    }, [tab, emp.id]);

    const handleAddComponent = async () => {
        if (!newComponentId || !newAmount) return;

        const { error } = await supabase.from('employee_salary_components').insert([{
            employee_id: emp.id,
            salary_component_id: parseInt(newComponentId),
            amount: parseFloat(newAmount),
            effective_from: newEffectiveDate,
            is_active: true
        }]);

        if (error) {
            alert('Error adding component: ' + error.message);
        } else {
            setShowAddComponent(false);
            setNewComponentId('');
            setNewAmount('');
            fetchSalaryMapping();
        }
    };

    const handleDeleteComponent = async (id: string) => {
        if (!confirm('Are you sure you want to remove this salary component?')) return;
        const { error } = await supabase.from('employee_salary_components').delete().eq('id', id);
        if (error) alert('Error deleting: ' + error.message);
        else fetchSalaryMapping();
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
                    <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-8 font-medium">
                        {roles.find(r => r.id === emp.role_id)?.name || emp.role || 'No Role'}
                    </p>
                    <div className="w-full space-y-3">
                        {[
                            { id: 'PROFILE', label: 'Overview', icon: Users },
                            { id: 'JOB', label: 'Job Info', icon: Briefcase },
                            { id: 'CONTACT', label: 'Contact', icon: Phone },
                            { id: 'FINANCIAL', label: 'Financial', icon: DollarSign },
                            { id: 'DOCUMENTS', label: 'Documents', icon: FileText },
                            { id: 'TIMELINE', label: 'Career Timeline', icon: TrendingUp },
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
                        <div className="space-y-10">
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Professional Details</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <ViewField label="Department" value={departments.find(d => d.id === emp.department_id)?.name || emp.department || '-'} />
                                    <ViewField label="Join Date" value={formatDate(emp.joinDate)} />
                                    <ViewField label="Email" value={emp.email} />
                                    <ViewField label="Location" value={locations.find(l => l.id === emp.location_id)?.name || emp.location || '-'} />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Skills</h3>
                                <div className="flex flex-wrap gap-2">
                                    {emp.skills?.map(skill => (
                                        <span key={skill} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl text-sm font-bold border border-indigo-100 dark:border-indigo-800">{skill}</span>
                                    ))}
                                    {(!emp.skills || emp.skills.length === 0) && <span className="text-slate-400 text-sm italic">No skills listed</span>}
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'JOB' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Job Information</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <ViewField label="Designation" value={designations.find(d => d.id === emp.designation_id)?.name || '-'} />
                                <ViewField label="Grade" value={grades.find(g => g.id === emp.grade_id)?.name || '-'} />
                                <ViewField label="Employment Type" value={employmentTypes.find(e => e.id === emp.employment_type_id)?.name || '-'} />
                                <ViewField label="Reporting Manager" value={employees.find(e => e.id === emp.reporting_manager_id)?.name || 'None'} />
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
                            <div className="grid grid-cols-2 gap-6">
                                <ViewField label="Pay Group" value={payGroups.find(p => p.id === emp.pay_group_id)?.name || '-'} />
                                <ViewField label="Base Salary (CTC)" value={`$${emp.salary_amount || '0'}`} />
                                <ViewField label="Bank Name" value={emp.bank_name || '-'} />
                                <ViewField label="Account Number" value={emp.account_number || '-'} />
                                <ViewField label="IFSC Code" value={emp.ifsc_code || '-'} />
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
                                        <div className="grid grid-cols-3 gap-3 mb-3">
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
                                                placeholder="Amount"
                                                value={newAmount}
                                                onChange={e => setNewAmount(e.target.value)}
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
                                            <button onClick={() => setShowAddComponent(false)} className="px-3 py-1.5 text-slate-500 text-xs font-bold hover:bg-slate-200 rounded-lg">Cancel</button>
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
                                                        ${comp.amount}
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
                                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                                        No salary components allocated yet.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'DOCUMENTS' && (
                        <div className="animate-fade-in-up">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 tracking-tight">Employee Documents</h3>
                            <div className="space-y-4">
                                {emp.documents?.map((doc, i) => (
                                    <div key={i} className="flex items-center justify-between p-5 bg-white dark:bg-zinc-800 rounded-[1.5rem] border border-slate-100 dark:border-zinc-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl"><FileText className="w-6 h-6" /></div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-slate-100">{doc.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Uploaded {doc.date}</p>
                                            </div>
                                        </div>
                                        <button className="text-indigo-600 dark:text-indigo-400 font-bold text-sm bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">Download</button>
                                    </div>
                                ))}
                                {(!emp.documents || emp.documents.length === 0) && (
                                    <div className="p-10 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-[2rem] text-center text-slate-400 dark:text-slate-500">
                                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No documents uploaded.</p>
                                    </div>
                                )}
                            </div>
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
