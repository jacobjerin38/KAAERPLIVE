import React, { useState, useRef } from 'react';
import {
    Users, Briefcase, Phone, DollarSign, FileText, Check, AlertTriangle, X, Loader,
    Camera, Upload, User, Save, ChevronRight, Hash, Mail, Calendar, Unlock, Leaf, Plus, Trash2
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { EmployeeDocuments } from './EmployeeDocuments';
import {
    Employee, Department, Location, Designation, Grade, EmploymentType,
    PayGroup, Faith, MaritalStatus, BloodGroup, Role, LeaveType,
    ShiftTiming, WeekoffRule, SalaryComponent
} from '../../hrms/types';
import { Modal } from '../../ui/Modal';

interface EmployeeFormModalProps {
    initialData?: Employee | null;
    onClose: () => void;
    refreshData: () => void;
    departments: Department[];
    locations: Location[];
    designations: Designation[];
    grades: Grade[];
    employmentTypes: EmploymentType[];
    payGroups: PayGroup[];
    faiths: Faith[];
    maritalStatuses: MaritalStatus[];
    bloodGroups: BloodGroup[];
    roles: Role[];
    leaveTypes: LeaveType[];
    shiftTimings: ShiftTiming[];
    weekoffRules: WeekoffRule[];
    salaryComponents: SalaryComponent[];
    employees: Employee[];
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
    initialData, onClose, refreshData,
    departments, locations, designations, grades, employmentTypes,
    payGroups, faiths, maritalStatuses, bloodGroups, roles,
    shiftTimings, weekoffRules, salaryComponents, employees
}) => {
    // Split name for UI if needed, but keeping single name field in DB for simplicity unless requested split
    const [formData, setFormData] = useState({
        first_name: initialData?.name?.split(' ')[0] || '',
        last_name: initialData?.name?.split(' ').slice(1).join(' ') || '',
        name: initialData?.name || '',
        employee_code: initialData?.employee_code || '',
        date_of_birth: initialData?.date_of_birth || '',
        gender: initialData?.gender || '',
        faith_id: initialData?.faith_id?.toString() || '',
        blood_group_id: initialData?.blood_group_id?.toString() || '',
        marital_status_id: initialData?.marital_status_id?.toString() || '',
        personal_mobile: initialData?.personal_mobile || '',
        office_mobile: initialData?.office_mobile || '',
        personal_email: initialData?.personal_email || '',
        office_email: initialData?.office_email || '',
        current_address: initialData?.current_address || '',
        permanent_address: initialData?.permanent_address || '',
        department_id: initialData?.department_id?.toString() || '',
        designation_id: initialData?.designation_id?.toString() || '',
        grade_id: initialData?.grade_id?.toString() || '',
        location_id: initialData?.location_id?.toString() || '',
        employment_type_id: initialData?.employment_type_id?.toString() || '',
        join_date: initialData?.join_date || initialData?.joinDate || '',
        reporting_manager_id: initialData?.reporting_manager_id?.toString() || '',
        shift_timing_id: initialData?.shift_timing_id?.toString() || '',
        weekoff_rule_id: initialData?.weekoff_rule_id?.toString() || '',
        pay_group_id: initialData?.pay_group_id?.toString() || '',
        salary_amount: initialData?.salary_amount?.toString() || '',
        bank_name: initialData?.bank_name || '',
        account_number: initialData?.account_number || '',
        ifsc_code: initialData?.ifsc_code || '',
        role_id: initialData?.role_id?.toString() || '',
        status: initialData?.status || 'Active',
        profile_photo_url: initialData?.profile_photo_url || ''
    });

    const [activeSection, setActiveSection] = useState<'OVERVIEW' | 'PROFESSIONAL' | 'CONTACT' | 'FINANCIAL' | 'DOCUMENTS' | 'LEAVE'>('OVERVIEW');
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(formData.profile_photo_url || null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Salary Components Logic
    const [empSalaryComponents, setEmpSalaryComponents] = useState<any[]>([]);

    // Leave Balances Logic
    const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
    const [companyLeaveTypes, setCompanyLeaveTypes] = useState<any[]>([]);
    const [leaveLoading, setLeaveLoading] = useState(false);
    const [leaveSaveMsg, setLeaveSaveMsg] = useState<string | null>(null);

    // Fetch existing mappings on mount
    React.useEffect(() => {
        if (initialData?.id) {
            fetchEmpSalaryComponents();
            fetchLeaveBalances();
        }
        fetchCompanyLeaveTypes();
    }, [initialData?.id]);

    const fetchEmpSalaryComponents = async () => {
        if (!initialData?.id) return;
        const { data } = await supabase
            .from('employee_salary_components')
            .select(`
                *,
                component:org_salary_components(name, component_type)
            `)
            .eq('employee_id', initialData.id)
            .eq('is_active', true);

        if (data) setEmpSalaryComponents(data);
    };

    const handleAddComponent = async (componentId: string) => {
        if (!initialData?.id) return;

        const payload = {
            company_id: initialData.company_id,
            employee_id: initialData.id,
            salary_component_id: componentId,
            amount: 0,
            effective_from: new Date().toISOString().split('T')[0],
            is_active: true
        };

        const { error } = await supabase.from('employee_salary_components').insert([payload]);
        if (error) alert(error.message);
        else fetchEmpSalaryComponents();
    };

    const handleRemoveComponent = async (id: string) => {
        const { error } = await supabase.from('employee_salary_components').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchEmpSalaryComponents();
    };

    const handleUpdateComponentAmount = async (id: string, amount: number) => {
        const { error } = await supabase.from('employee_salary_components').update({ amount }).eq('id', id);
        if (error) alert(error.message);
        else {
            // update local state optimistically or refetch
            setEmpSalaryComponents(prev => prev.map(p => p.id === id ? { ...p, amount } : p));
        }
    };

    // ===== Leave Balance Handlers =====
    const fetchCompanyLeaveTypes = async () => {
        const { data, error } = await supabase
            .from('org_leave_types')
            .select('*')
            .order('name');
        if (!error && data) setCompanyLeaveTypes(data);
    };

    const fetchLeaveBalances = async () => {
        if (!initialData?.id) return;
        setLeaveLoading(true);
        const { data, error } = await supabase
            .from('employee_leave_balances')
            .select('*')
            .eq('employee_id', initialData.id);
        if (!error && data) setLeaveBalances(data);
        setLeaveLoading(false);
    };

    const handleAddLeaveBalance = async (leaveTypeId: string) => {
        if (!initialData?.id || !initialData?.company_id) return;
        setLeaveSaveMsg(null);
        const { data, error } = await supabase
            .from('employee_leave_balances')
            .insert({
                company_id: initialData.company_id,
                employee_id: initialData.id,
                leave_type_id: leaveTypeId,
                total_balance: 0,
                used: 0
            })
            .select()
            .single();
        if (error) {
            setLeaveSaveMsg('Error: ' + error.message);
        } else {
            setLeaveBalances(prev => [...prev, data]);
            setLeaveSaveMsg('Leave type added');
            setTimeout(() => setLeaveSaveMsg(null), 2000);
        }
    };

    const handleUpdateLeaveBalance = async (bal: any, newBalance: number) => {
        setLeaveSaveMsg(null);
        const { error } = await supabase
            .from('employee_leave_balances')
            .update({ total_balance: newBalance })
            .eq('id', bal.id);
        if (error) {
            setLeaveSaveMsg('Error: ' + error.message);
        } else {
            setLeaveBalances(prev => prev.map(b => b.id === bal.id ? { ...b, total_balance: newBalance } : b));
            setLeaveSaveMsg('Balance updated');
            setTimeout(() => setLeaveSaveMsg(null), 2000);
        }
    };

    const handleRemoveLeaveBalance = async (bal: any) => {
        setLeaveSaveMsg(null);
        const { error } = await supabase
            .from('employee_leave_balances')
            .delete()
            .eq('id', bal.id);
        if (error) {
            setLeaveSaveMsg('Error: ' + error.message);
        } else {
            setLeaveBalances(prev => prev.filter(b => b.id !== bal.id));
            setLeaveSaveMsg('Leave type removed');
            setTimeout(() => setLeaveSaveMsg(null), 2000);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmitEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);

        // Basic Validation
        const fullName = `${formData.first_name} ${formData.last_name}`.trim();
        if (!fullName) { setSubmitError("Name is required"); return; }
        if (!formData.join_date) { setSubmitError("Join Date is required"); return; }
        if (!formData.employee_code) { setSubmitError("Employee Code is required"); return; }
        if (!formData.role_id) { setSubmitError("Role is required"); return; }

        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
            if (!profile) throw new Error("No company profile found");

            // 1. Prepare Data
            const employeeData = {
                company_id: profile.company_id,
                name: fullName,
                employee_code: formData.employee_code,
                // ... map all other fields - UUID fields use string directly ...
                date_of_birth: formData.date_of_birth || null,
                gender: formData.gender || null,
                faith_id: formData.faith_id || null,
                blood_group_id: formData.blood_group_id || null,
                marital_status_id: formData.marital_status_id || null,
                personal_mobile: formData.personal_mobile || null,
                office_mobile: formData.office_mobile || null,
                personal_email: formData.personal_email || null,
                office_email: formData.office_email || null,
                current_address: formData.current_address || null,
                permanent_address: formData.permanent_address || null,
                department_id: formData.department_id || null,
                designation_id: formData.designation_id || null,
                grade_id: formData.grade_id || null,
                location_id: formData.location_id || null,
                employment_type_id: formData.employment_type_id || null,
                join_date: formData.join_date || null,
                reporting_manager_id: formData.reporting_manager_id || null,
                shift_timing_id: formData.shift_timing_id || null,
                weekoff_rule_id: formData.weekoff_rule_id || null,
                pay_group_id: formData.pay_group_id || null,
                salary_amount: formData.salary_amount ? parseFloat(formData.salary_amount) : null,
                bank_name: formData.bank_name || null,
                account_number: formData.account_number || null,
                ifsc_code: formData.ifsc_code || null,
                role_id: formData.role_id || null,
                status: formData.status,
                // Legacy
                email: formData.office_email || formData.personal_email || null,
                phone: formData.office_mobile || formData.personal_mobile || null,
                role: roles.find(r => r.id === formData.role_id)?.name || null,
                department: departments.find(d => d.id === formData.department_id)?.name || null,
                location: locations.find(l => l.id === formData.location_id)?.name || null
            };

            let employeeId = initialData?.id;

            // 2. Insert or Update Employee Record
            if (employeeId) {
                const { error } = await supabase.from('employees').update(employeeData).eq('id', employeeId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('employees').insert([employeeData]).select().single();
                if (error) throw error;
                employeeId = data.id;
            }

            // 3. Upload Photo if selected
            if (photoFile && employeeId) {
                const fileExt = photoFile.name.split('.').pop();
                const fileName = `${profile.company_id}/employees/${employeeId}/avatar.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('company-assets')
                    .upload(fileName, photoFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('company-assets')
                    .getPublicUrl(fileName);

                // Update employee with photo URL
                await supabase.from('employees').update({ profile_photo_url: publicUrl }).eq('id', employeeId);
            }

            onClose();
            refreshData();

        } catch (err: any) {
            console.error(err);
            setSubmitError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const navItems = [
        { id: 'OVERVIEW', label: 'Overview', icon: User },
        { id: 'PROFESSIONAL', label: 'Professional', icon: Briefcase },
        { id: 'CONTACT', label: 'Personal & Contact', icon: Phone },
        { id: 'FINANCIAL', label: 'Financial & Statutory', icon: DollarSign },
        { id: 'DOCUMENTS', label: 'Documents', icon: FileText },
        { id: 'LEAVE', label: 'Leave', icon: Leaf }
    ];

    return (
        <Modal title={initialData ? 'Edit Employee' : 'New Employee'} onClose={onClose} maxWidth="max-w-6xl" noPadding hideHeader>
            <div className="flex h-[80vh] overflow-hidden bg-slate-50 dark:bg-[#0a0a0a]">
                {/* Left Sidebar */}
                <div className="w-64 bg-slate-900 text-slate-300 p-4 flex flex-col gap-2 shrink-0">
                    <div className="mb-6 px-2">
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Sections</div>
                    </div>
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id as any)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${activeSection === item.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                : 'hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#111] overflow-hidden">
                    {/* Header */}
                    <div className="h-16 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between px-8 bg-white dark:bg-[#111] shrink-0">
                        <h2 className="text-lg font-bold text-slate-700 dark:text-white flex items-center gap-2">
                            {initialData ? 'Edit' : 'Create'} Employee
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                            <span className="text-blue-500">{formData.first_name || 'New Profile'}</span>
                        </h2>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleSubmitEmployee} disabled={loading} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2">
                                {loading && <Loader className="w-4 h-4 animate-spin" />}
                                Save Profile
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Form Area */}
                    <div className="flex-1 overflow-y-auto p-8">
                        {submitError && (
                            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="font-bold text-sm">{submitError}</span>
                            </div>
                        )}

                        <div className="max-w-4xl mx-auto space-y-8">

                            {activeSection === 'OVERVIEW' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-2xl p-8">
                                        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-100 dark:border-zinc-800">
                                            <User className="w-5 h-5 text-blue-500" />
                                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Basic Identity</h3>
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-8">
                                            {/* Photo Upload */}
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-40 h-40 shrink-0 rounded-2xl border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group bg-slate-50 dark:bg-zinc-900"
                                            >
                                                {photoPreview ? (
                                                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-center p-4">
                                                        <div className="w-12 h-12 bg-slate-200 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                                                            <Camera className="w-6 h-6" />
                                                        </div>
                                                        <span className="text-xs font-bold text-blue-500">Upload Photo</span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Upload className="w-6 h-6 text-white" />
                                                </div>
                                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                                            </div>

                                            {/* Basic Fields */}
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">First Name <span className="text-rose-500">*</span></label>
                                                    <input
                                                        name="first_name"
                                                        value={formData.first_name}
                                                        onChange={handleChange}
                                                        className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-800 dark:text-white"
                                                        placeholder="John"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Last Name</label>
                                                    <input
                                                        name="last_name"
                                                        value={formData.last_name}
                                                        onChange={handleChange}
                                                        className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-800 dark:text-white"
                                                        placeholder="Doe"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Employee Code <span className="text-rose-500">*</span></label>
                                                    <input
                                                        name="employee_code"
                                                        value={formData.employee_code}
                                                        onChange={handleChange}
                                                        className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-800 dark:text-white"
                                                        placeholder="EMP-001"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Official Email</label>
                                                    <input
                                                        name="office_email"
                                                        value={formData.office_email}
                                                        onChange={handleChange}
                                                        className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-800 dark:text-white"
                                                        placeholder="john@kaa.com"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</label>
                                                    <select
                                                        name="status"
                                                        value={formData.status}
                                                        onChange={handleChange}
                                                        className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-800 dark:text-white"
                                                    >
                                                        <option>Active</option>
                                                        <option>Probation</option>
                                                        <option>Notice Period</option>
                                                        <option>Inactive</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date of Joining <span className="text-rose-500">*</span></label>
                                                    <input
                                                        type="date"
                                                        name="join_date"
                                                        value={formData.join_date}
                                                        onChange={handleChange}
                                                        className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-800 dark:text-white"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-2xl p-8">
                                        <div className="flex items-center gap-3 mb-6">
                                            <Unlock className="w-5 h-5 text-indigo-500" />
                                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">System Access</h3>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-zinc-800">
                                            <div className="w-5 h-5 rounded border border-slate-400 flex items-center justify-center">
                                                {/* Checkbox Placeholder logic would go here */}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Create user login for this employee?</p>
                                                <p className="text-xs text-slate-400">Allows them to log in to the employee portal.</p>
                                            </div>
                                            <select
                                                name="role_id"
                                                value={formData.role_id}
                                                onChange={handleChange}
                                                className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-700 rounded-lg text-xs p-2"
                                            >
                                                <option value="">Select Role</option>
                                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSection === 'PROFESSIONAL' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    {/* Department & Role */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Department</label>
                                        <select name="department_id" value={formData.department_id} onChange={handleChange} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none">
                                            <option value="">Select Department</option>
                                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Designation</label>
                                        <select name="designation_id" value={formData.designation_id} onChange={handleChange} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none">
                                            <option value="">Select Designation</option>
                                            {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Grade</label>
                                        <select name="grade_id" value={formData.grade_id} onChange={handleChange} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none">
                                            <option value="">Select Grade</option>
                                            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Employment Type</label>
                                        <select name="employment_type_id" value={formData.employment_type_id} onChange={handleChange} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none">
                                            <option value="">Select Type</option>
                                            {employmentTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Shift Timing</label>
                                        <select name="shift_timing_id" value={formData.shift_timing_id} onChange={handleChange} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none">
                                            <option value="">Select Shift</option>
                                            {shiftTimings.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time}-{s.end_time})</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reporting Manager</label>
                                        <select
                                            name="reporting_manager_id"
                                            value={formData.reporting_manager_id}
                                            onChange={handleChange}
                                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none"
                                        >
                                            <option value="">Select Manager</option>
                                            {employees.filter(e => e.id !== initialData?.id).map(e => ( // Filter out self
                                                <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {activeSection === 'CONTACT' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mobile</label>
                                            <input name="personal_mobile" value={formData.personal_mobile} onChange={handleChange} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Personal Email</label>
                                            <input name="personal_email" value={formData.personal_email} onChange={handleChange} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Current Address</label>
                                        <textarea name="current_address" value={formData.current_address} onChange={handleChange} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none min-h-[100px] text-slate-900 dark:text-white" />
                                    </div>
                                </div>
                            )}

                            {activeSection === 'FINANCIAL' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">CTC / Salary</label>
                                            <input name="salary_amount" type="number" value={formData.salary_amount} onChange={handleChange} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pay Group</label>
                                            <select name="pay_group_id" value={formData.pay_group_id} onChange={handleChange} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none">
                                                <option value="">Select Pay Group</option>
                                                {payGroups.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-slate-100 dark:bg-zinc-900 rounded-2xl space-y-4">
                                        <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Bank Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <input name="bank_name" value={formData.bank_name} onChange={handleChange} placeholder="Bank Name" className="bg-white dark:bg-zinc-900 border-none rounded-xl p-3 text-sm" />
                                            <input name="account_number" value={formData.account_number} onChange={handleChange} placeholder="Account No" className="bg-white dark:bg-zinc-900 border-none rounded-xl p-3 text-sm" />
                                            <input name="ifsc_code" value={formData.ifsc_code} onChange={handleChange} placeholder="IFSC / Swift" className="bg-white dark:bg-zinc-900 border-none rounded-xl p-3 text-sm" />
                                        </div>
                                    </div>

                                    {initialData?.id && (
                                        <div className="space-y-4 mt-8 pt-6 border-t border-slate-200 dark:border-zinc-800">
                                            <h4 className="font-bold text-slate-800 dark:text-white text-md">Salary Breakdown</h4>

                                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                                {salaryComponents.filter(sc => !empSalaryComponents.find(esc => esc.salary_component_id === sc.id)).map(sc => (
                                                    <button
                                                        key={sc.id}
                                                        type="button"
                                                        onClick={() => handleAddComponent(sc.id)}
                                                        className="px-3 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-500 whitespace-nowrap transition-colors"
                                                    >
                                                        + {sc.name}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-slate-50 dark:bg-zinc-800">
                                                        <tr>
                                                            <th className="p-3 font-bold text-slate-500">Component</th>
                                                            <th className="p-3 font-bold text-slate-500">Type</th>
                                                            <th className="p-3 font-bold text-slate-500">Amount</th>
                                                            <th className="p-3 text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                        {empSalaryComponents.map(comp => (
                                                            <tr key={comp.id}>
                                                                <td className="p-3 font-medium text-slate-700 dark:text-slate-200">{comp.component?.name}</td>
                                                                <td className="p-3 text-xs text-slate-500">
                                                                    <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${comp.component?.component_type === 'EARNING' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                                        {comp.component?.component_type}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-slate-400">$</span>
                                                                        <input
                                                                            type="number"
                                                                            defaultValue={comp.amount}
                                                                            onBlur={(e) => handleUpdateComponentAmount(comp.id, parseFloat(e.target.value))}
                                                                            className="w-24 bg-transparent font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:border-b-2 focus:border-blue-500"
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 text-right">
                                                                    <button type="button" onClick={() => handleRemoveComponent(comp.id)} className="text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {empSalaryComponents.length === 0 && (
                                                            <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">No salary components assigned. Add above.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeSection === 'DOCUMENTS' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    {initialData?.id && initialData?.company_id ? (
                                        <EmployeeDocuments
                                            employeeId={initialData.id}
                                            companyId={initialData.company_id}
                                            readOnly={false}
                                        />
                                    ) : (
                                        <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                                            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                            <h3 className="font-bold text-slate-600 dark:text-slate-400">Manage Documents</h3>
                                            <p className="text-sm text-slate-400 mt-2">Save the employee first to upload documents.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeSection === 'LEAVE' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    {initialData?.id ? (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Leave Applicability</h3>
                                                    <p className="text-sm text-slate-500 mt-1">Assign leave types and set balances for this employee</p>
                                                </div>
                                                {leaveSaveMsg && (
                                                    <div className={`text-sm font-bold px-3 py-1 rounded-lg ${leaveSaveMsg.startsWith('Error') ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                                                        }`}>{leaveSaveMsg}</div>
                                                )}
                                            </div>

                                            {/* Add leave type */}
                                            <div className="flex items-end gap-3">
                                                <div className="flex-1">
                                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Add Leave Type</label>
                                                    <select
                                                        id="add-leave-type-select"
                                                        className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm"
                                                        defaultValue=""
                                                    >
                                                        <option value="" disabled>Select a leave type...</option>
                                                        {companyLeaveTypes
                                                            .filter(lt => !leaveBalances.find(lb => lb.leave_type_id === lt.id))
                                                            .map(lt => (
                                                                <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
                                                            ))}
                                                    </select>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const sel = document.getElementById('add-leave-type-select') as HTMLSelectElement;
                                                        if (sel.value) handleAddLeaveBalance(sel.value);
                                                    }}
                                                    className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center gap-2"
                                                >
                                                    <Plus className="w-4 h-4" /> Add
                                                </button>
                                            </div>

                                            {/* Balances table */}
                                            <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-slate-50 dark:bg-zinc-800">
                                                        <tr>
                                                            <th className="p-3 font-bold text-slate-500">Leave Type</th>
                                                            <th className="p-3 font-bold text-slate-500">Total Balance</th>
                                                            <th className="p-3 font-bold text-slate-500">Used</th>
                                                            <th className="p-3 font-bold text-slate-500">Remaining</th>
                                                            <th className="p-3 text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                        {leaveBalances.map(bal => {
                                                            const lt = companyLeaveTypes.find(t => t.id === bal.leave_type_id);
                                                            return (
                                                                <tr key={bal.id || bal.leave_type_id}>
                                                                    <td className="p-3 font-medium text-slate-700 dark:text-slate-200">
                                                                        {lt?.name || 'Unknown'}
                                                                        <span className="ml-2 text-xs text-slate-400">{lt?.code}</span>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <input
                                                                            type="number"
                                                                            defaultValue={bal.total_balance}
                                                                            onBlur={(e) => handleUpdateLeaveBalance(bal, parseFloat(e.target.value) || 0)}
                                                                            className="w-20 bg-transparent font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:border-b-2 focus:border-blue-500"
                                                                        />
                                                                    </td>
                                                                    <td className="p-3 text-slate-500 font-mono">{bal.used || 0}</td>
                                                                    <td className="p-3 font-mono font-bold text-emerald-600">{(bal.total_balance || 0) - (bal.used || 0)}</td>
                                                                    <td className="p-3 text-right">
                                                                        <button type="button" onClick={() => handleRemoveLeaveBalance(bal)} className="text-rose-400 hover:text-rose-600">
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {leaveBalances.length === 0 && (
                                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">No leave types assigned. Use the dropdown above to add.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                                            <Leaf className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                            <h3 className="font-bold text-slate-600 dark:text-slate-400">Leave Applicability</h3>
                                            <p className="text-sm text-slate-400 mt-2">Save the employee first to assign leave balances.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
