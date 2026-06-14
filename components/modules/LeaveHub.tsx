import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar, Check, X, Settings, Plus, Loader2, FileText, LayoutDashboard, ShieldCheck
} from 'lucide-react';
import { LeaveRequest, Employee } from '../hrms/types';
import { LeaveViewMode } from '../../types';
import { LeaveModule } from './hrms/LeaveModule';
import { HolidayCalendar } from './hrms/HolidayCalendar';
import { LeaveAccrualManager } from './hrms/LeaveAccrualManager';
import { ReportsListView } from './reports/ReportsListView';
import { Modal } from '../ui/Modal';

import { KAA_LOGO_URL } from '../../constants';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export const LeaveHub: React.FC = () => {
    const [activeTab, setActiveTab] = useState<LeaveViewMode>('OVERVIEW');
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [companyId, setCompanyId] = useState<string>('');
    const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    
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

        const { data: emp } = await supabase.from('employees').select('*').eq('profile_id', user?.id).maybeSingle();
        if (emp) {
            setCurrentEmployee({ ...emp, id: emp.id, joinDate: emp.join_date, company_id: emp.company_id } as any);
        }

        const { data: leaveData } = await supabase.from('leaves')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });
        if (leaveData) setLeaves(leaveData as any);

        const { data: typesData } = await supabase.from('org_leave_types')
            .select('*')
            .eq('company_id', companyId);
        if (typesData) setLeaveTypes(typesData);

        const { data: empData } = await supabase.from('employees')
            .select('*')
            .eq('company_id', companyId);
        if (empData) setEmployees(empData as any);

        setLoading(false);
    };

    useEffect(() => {
        if (companyId) {
            refreshData();
        }
    }, [companyId]);

    const handleUpdateLeaveStatus = async (id: string, status: 'Approved' | 'Rejected', level?: 1 | 2) => {
        let updateData: any = {};
        if (level === 1) {
            updateData.level1_status = status;
            if (status === 'Rejected') updateData.status = 'Rejected';
        } else if (level === 2) {
            updateData.level2_status = status;
            if (status === 'Approved') updateData.status = 'Approved';
            else updateData.status = 'Rejected';
        } else {
            updateData.status = status;
            updateData.level1_status = status;
            updateData.level2_status = status;
        }
        const { error } = await supabase.from('leaves').update(updateData).eq('id', id);
        if (error) alert(error.message);
        else refreshData();
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const navItems = useMemo(() => [
        { id: 'OVERVIEW', icon: LayoutDashboard, label: 'Overview', permission: 'hrms.leave.view' },
        { id: 'APPLICATIONS', icon: Calendar, label: 'Applications', permission: 'hrms.leave.view' },
        { id: 'APPROVALS', icon: ShieldCheck, label: 'Approvals', permission: 'hrms.leave.approve' },
        { id: 'CALENDAR', icon: Calendar, label: 'Holidays', permission: 'hrms.leave.view' },
        { id: 'BALANCES', icon: Settings, label: 'Accruals', permission: 'hrms.leave.view' },
        { id: 'REPORTS', icon: FileText, label: 'Reports', permission: 'hrms.reports.view' },
    ].filter(item => hasPermission(item.permission) || hasPermission('*')), [hasPermission]);

    useEffect(() => {
        if (navItems.length > 0 && !navItems.find(i => i.id === activeTab)) {
            setActiveTab(navItems[0].id as LeaveViewMode);
        }
    }, [navItems, activeTab]);

    const pendingLeaves = useMemo(() => leaves.filter(l => l.status === 'Pending'), [leaves]);
    const approvedLeaves = useMemo(() => leaves.filter(l => l.status === 'Approved'), [leaves]);

    const AddLeaveModal = () => (
        <Modal title="Grant Leave / Request Leave" onClose={() => setShowLeaveModal(false)}>
            <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const leaveTypeId = formData.get('leave_type_id') as string;
                const typeName = leaveTypes.find(lt => lt.id.toString() === leaveTypeId.toString())?.code || 'OTHER';
                const employeeId = formData.get('employee_id') as string || currentEmployee?.id;
                
                const { error } = await supabase.from('leaves').insert([{
                    employee_id: employeeId,
                    company_id: companyId,
                    leave_type_id: leaveTypeId ? parseInt(leaveTypeId) : null,
                    type: typeName,
                    start_date: formData.get('startDate'),
                    end_date: formData.get('endDate'),
                    reason: formData.get('reason'),
                    status: 'Pending',
                    applied_on: new Date().toISOString()
                } as any]);
                if (error) alert('Error: ' + error.message);
                else {
                    alert('Leave request submitted successfully!');
                    setShowLeaveModal(false);
                    refreshData();
                }
            }} className="space-y-4">
                {hasPermission('hrms.leave.approve') || hasPermission('*') ? (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">For Employee</label>
                        <select name="employee_id" required defaultValue={currentEmployee?.id || ''} className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                            <option value="">Select Employee...</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                    </div>
                ) : null}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Leave Type</label>
                    <select name="leave_type_id" required className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                        <option value="">Select Leave Type</option>
                        {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                        <input name="startDate" type="date" required className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                        <input name="endDate" type="date" required className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                    </div>
                </div>
                <textarea name="reason" required placeholder="Reason for leave..." className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white min-h-[100px]"></textarea>
                <button className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:shadow-lg shadow-emerald-500/30 transition-all active:scale-95">Submit Request</button>
            </form>
        </Modal>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    const getEmployeeName = (id: string) => {
        const emp = employees.find(e => e.id === id);
        return emp ? emp.name : 'Staff Member';
    };

    const renderOverview = () => {
        return (
            <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
                <header className="flex justify-between items-center mb-8 shrink-0">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Leave Administration</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Manage and track company leave requests and balances.</p>
                    </div>
                    <button onClick={() => setShowLeaveModal(true)} className="px-5 py-2.5 bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 transition-all active:scale-95">Grant / Request Leave</button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pending Requests</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{pendingLeaves.length}</h3>
                        </div>
                    </div>
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                            <Check className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Approved Requests</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{approvedLeaves.length}</h3>
                        </div>
                    </div>
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Leave Types</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{leaveTypes.length}</h3>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 flex-1">
                    {/* Recent Requests */}
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Recent Applications</h3>
                        <div className="space-y-4 overflow-y-auto pr-2 max-h-[400px]">
                            {leaves.slice(0, 5).map(req => (
                                <div key={req.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-850 rounded-2xl border border-slate-100 dark:border-zinc-850 shadow-sm">
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{getEmployeeName((req as any).employee_id)}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {leaveTypes.find(lt => lt.id === req.leave_type_id)?.name || req.type} • {formatDate(req.start_date)} to {formatDate(req.end_date)}
                                        </p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                        req.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' :
                                        req.status === 'Rejected' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20' :
                                        'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                                    }`}>
                                        {req.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Leave Policy Summary */}
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Active Leave Policies</h3>
                        <div className="space-y-4 overflow-y-auto pr-2 max-h-[400px]">
                            {leaveTypes.map(lt => (
                                <div key={lt.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-850 rounded-2xl border border-slate-100 dark:border-zinc-850 shadow-sm">
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{lt.name}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Code: {lt.code} • {lt.is_paid ? 'Paid' : 'Unpaid'}</p>
                                    </div>
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl">
                                        {lt.default_balance} days/yr
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
                            <Calendar className="w-6 h-6 text-emerald-600" />
                            <span className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">Leave Suite</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">Time Off Mgmt</span>
                    </div>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as LeaveViewMode)}
                            className={`flex items-center justify-between p-3.5 rounded-2xl transition-all active:scale-95 duration-200 ${activeTab === item.id
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
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
                {activeTab === 'APPLICATIONS' && (
                    <LeaveModule 
                        leaves={leaves} 
                        leaveTypes={leaveTypes} 
                        setShowLeaveModal={setShowLeaveModal} 
                        onUpdateStatus={handleUpdateLeaveStatus} 
                        formatDate={formatDate} 
                    />
                )}
                {activeTab === 'APPROVALS' && (
                    <div className="p-8 h-full flex flex-col overflow-y-auto">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Pending Leave Approvals</h2>
                        <LeaveModule 
                            leaves={pendingLeaves} 
                            leaveTypes={leaveTypes} 
                            setShowLeaveModal={setShowLeaveModal} 
                            onUpdateStatus={handleUpdateLeaveStatus} 
                            formatDate={formatDate} 
                        />
                    </div>
                )}
                {activeTab === 'CALENDAR' && (
                    <div className="p-8 h-full flex flex-col overflow-y-auto">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Holiday Calendar</h2>
                        <HolidayCalendar />
                    </div>
                )}
                {activeTab === 'BALANCES' && (
                    <div className="p-8 h-full flex flex-col overflow-y-auto">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Leave Accruals & Policy</h2>
                        <LeaveAccrualManager />
                    </div>
                )}
                {activeTab === 'REPORTS' && <ReportsListView moduleFilter="LEAVE" />}
            </div>

            {showLeaveModal && <AddLeaveModal />}
        </div>
    );
};
