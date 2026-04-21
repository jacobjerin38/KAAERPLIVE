import React, { useState, useEffect, useMemo } from 'react';
import {
    Users, Briefcase, Calendar, ChevronRight, Search, Plus, Bell,
    Settings, LogOut, LayoutGrid, FileText, DollarSign, Clock,
    Menu, X, Check, Filter, Download, Trash2, Mail, Phone,
    MapPin, Building, CreditCard, UserPlus, FolderOpen,
    AlertCircle, Activity, ChevronLeft, MoreVertical, Edit3,
    MoreHorizontal, Fingerprint, Coffee, Headphones, CheckSquare,
    LayoutDashboard, ArrowLeftRight, ShieldCheck, Building2, Monitor
} from 'lucide-react';
import {
    Employee, Department, Location, Role, Designation, Grade,
    EmploymentType, PayGroup, Faith, MaritalStatus, BloodGroup,
    Nationality, LeaveType, SalaryComponent, ShiftTiming,
    AttendanceStatusMaster, WeekoffRule, AttendanceRecord,
    LeaveRequest, Asset, Announcement, HRMSViewMode
} from '../hrms/types';
import { EmployeeFormModal } from './hrms/EmployeeFormModal';
import { EmployeeDetailModal } from './hrms/EmployeeDetailModal';
import { EditAttendanceModal } from './hrms/EditAttendanceModal';
import { AttendanceReports } from './hrms/AttendanceReports';
import { PayrollDashboard } from './hrms/PayrollDashboard';
import { OverviewDashboard } from './hrms/OverviewDashboard';
import { EmployeeDirectory } from './hrms/EmployeeDirectory';
import { AttendanceModule } from './hrms/AttendanceModule';
import { LeaveModule } from './hrms/LeaveModule';
import { AssetModule } from './hrms/AssetModule';
import { HelpDeskModule } from './hrms/HelpDeskModule';
import { ExitModule } from './hrms/ExitModule';
import { SettingsModule } from './hrms/SettingsModule';
import { ReportsListView } from './reports/ReportsListView';
import { ApprovalsModule } from './hrms/ApprovalsModule';
import { Modal } from '../ui/Modal';

import { KAA_LOGO_URL } from '../../constants';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export const HRMS: React.FC = () => {
    const [activeTab, setActiveTab] = useState<HRMSViewMode>('OVERVIEW');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);

    // User Context
    const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

    // Selection State
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    // Admin Stats State
    const [stats, setStats] = useState({
        employees: 0,
        present: 0,
        liability: 0,
        departments: 0
    });

    // Modal State
    const [showEmployeeForm, setShowEmployeeForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showAttendanceEditModal, setShowAttendanceEditModal] = useState(false);
    const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
    const [attendanceViewMode, setAttendanceViewMode] = useState<'LIST' | 'REPORTS'>('LIST');
    const [showAttendanceStatusModal, setShowAttendanceStatusModal] = useState(false);
    const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null);
    // const [employeeFormSection, setEmployeeFormSection] = useState<'BASIC' | 'CONTACT' | 'JOB' | 'PAYROLL' | 'DOCUMENTS' | 'SYSTEM'>('BASIC');

    // Master Data for Dropdowns
    const [departments, setDepartments] = useState<Department[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [designations, setDesignations] = useState<Designation[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
    const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
    const [faiths, setFaiths] = useState<Faith[]>([]);
    const [maritalStatuses, setMaritalStatuses] = useState<MaritalStatus[]>([]);
    const [bloodGroups, setBloodGroups] = useState<BloodGroup[]>([]);
    const [nationalities, setNationalities] = useState<Nationality[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [salaryComponents, setSalaryComponents] = useState<SalaryComponent[]>([]);
    const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
    const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatusMaster[]>([]);
    const [leavePlans, setLeavePlans] = useState<LeavePlan[]>([]);
    const [shiftTimings, setShiftTimings] = useState<ShiftTiming[]>([]);
    const [attendanceStatuses, setAttendanceStatuses] = useState<AttendanceStatusMaster[]>([]);
    const [weekoffRules, setWeekoffRules] = useState<WeekoffRule[]>([]);

    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

    const [loading, setLoading] = useState(true);
    const { user, hasPermission } = useAuth();

    useEffect(() => {
        const initUser = async () => {
            if (user) {
                const { data: emp } = await supabase.from('employees').select('*').eq('profile_id', user.id).maybeSingle();
                if (emp) {
                    const mappedEmp = { ...emp, id: emp.id, joinDate: emp.join_date, company_id: emp.company_id } as any;
                    setCurrentEmployee(mappedEmp);
                }
            }
            refreshData();
        };
        initUser();
    }, [user]);

    const refreshData = async () => {
        setLoading(true);
        if (!user) return;

        // Fetch Employees
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle();
        if (!profile) return;

        const { data: empData } = await supabase.from('employees')
            .select('*')
            .eq('company_id', profile.company_id);
        if (empData) setEmployees(empData.map((e: any) => ({
            ...e,
            joinDate: e.join_date,
            salary: e.salary_amount,
            avatar: e.profile_photo_url || `https://ui-avatars.com/api/?name=${e.name}&background=random`
        })));

        // Admin Dashboard Data
        const { count: empCount } = await supabase.from('employees')
            .select('id', { count: 'exact' })
            .eq('company_id', profile.company_id);
        const today = new Date().toISOString().split('T')[0];
        const { count: presentCount } = await supabase.from('attendance')
            .select('id', { count: 'exact' })
            .like('status', 'Present')
            .gte('date', today)
            .lte('date', today)
            .eq('company_id', profile.company_id);
        const { count: deptCount } = await supabase.from('departments')
            .select('id', { count: 'exact' })
            .eq('company_id', profile.company_id);
        const { data: salaryData } = await supabase.from('employees')
            .select('salary_amount')
            .eq('company_id', profile.company_id);
        const totalLiability = salaryData?.reduce((acc, curr) => acc + (curr.salary_amount || 0), 0) || 0;

        setStats({
            employees: empCount || 0,
            present: presentCount || 0,
            departments: deptCount || 0,
            liability: totalLiability
        });

        // Fetch Attendance
        if (activeTab === 'ATTENDANCE') {
            let query = supabase.from('attendance').select(`*, attendance_status:org_attendance_status(name, code)`);
            if (attendanceViewMode === 'REPORTS') {
                const dateObj = new Date(attendanceDate);
                const year = dateObj.getFullYear();
                const month = dateObj.getMonth();
                const start = new Date(year, month, 1).toISOString().split('T')[0];
                const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
                query = query.gte('date', start).lte('date', end);
            } else {
                query = query.eq('date', attendanceDate);
            }
            const { data: attData } = await query;
            if (attData) {
                const mappedAtt = attData.map((a: any) => ({
                    id: a.id,
                    employeeId: a.employee_id,
                    date: a.date,
                    checkIn: a.check_in,
                    checkOut: a.check_out,
                    status: a.attendance_status?.name || a.status || 'Unknown',
                    attendanceStatusId: a.attendance_status_id,
                    duration: a.duration || a.total_hours || 0
                }));
                setAttendance(mappedAtt);
            } else {
                setAttendance([]);
            }
        }
        // Fetch Leaves
        const { data: leaveData } = await supabase.from('leaves')
            .select('*')
            .eq('company_id', profile.company_id)
            .order('created_at', { ascending: false });
        if (leaveData) setLeaves(leaveData as any);

        setLoading(false);
    };

    const fetchMasterData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle();
        if (!profile) return;

        // Batch 1: Core Org Data
        const [dept, loc, desig, grade, empType, payGrp] = await Promise.all([
            supabase.from('departments').select('*').eq('company_id', profile.company_id),
            supabase.from('locations').select('*').eq('company_id', profile.company_id),
            supabase.from('org_designations').select('*').eq('company_id', profile.company_id),
            supabase.from('org_grades').select('*').eq('company_id', profile.company_id),
            supabase.from('org_employment_types').select('*').eq('company_id', profile.company_id),
            supabase.from('org_pay_groups').select('*').eq('company_id', profile.company_id)
        ]);

        if (dept.data) setDepartments(dept.data as any);
        if (loc.data) setLocations(loc.data as any);
        if (desig.data) setDesignations(desig.data as any);
        if (grade.data) setGrades(grade.data as any);
        if (empType.data) setEmploymentTypes(empType.data as any);
        if (payGrp.data) setPayGroups(payGrp.data as any);

        // Batch 2: Demographics & Roles
        const [faith, marital, blood, nation, role] = await Promise.all([
            supabase.from('org_faiths').select('*').eq('company_id', profile.company_id),
            supabase.from('org_marital_status').select('*').eq('company_id', profile.company_id),
            supabase.from('org_blood_groups').select('*').eq('company_id', profile.company_id),
            supabase.from('org_nationalities').select('*').eq('company_id', profile.company_id),
            supabase.from('roles').select('*').eq('company_id', profile.company_id)
        ]);

        if (faith.data) setFaiths(faith.data as any);
        if (marital.data) setMaritalStatuses(marital.data as any);
        if (blood.data) setBloodGroups(blood.data as any);
        if (nation.data) setNationalities(nation.data as any);
        if (role.data) setRoles(role.data as any);

        // Batch 3: HRMS Specific
        const [visa, status, plan] = await Promise.all([
            supabase.from('org_visa_types').select('*').eq('company_id', profile.company_id),
            supabase.from('org_employee_statuses').select('*').eq('company_id', profile.company_id),
            supabase.from('org_leave_plans').select('*').eq('company_id', profile.company_id)
        ]);

        if (visa.data) setVisaTypes(visa.data as any);
        if (status.data) setEmployeeStatuses(status.data as any);
        if (plan.data) setLeavePlans(plan.data as any);

        // Batch 4: HRMS Specifics
        const [lvType, salComp, shifts, attStatus, weekoff] = await Promise.all([
            supabase.from('org_leave_types').select('*').eq('company_id', profile.company_id),
            supabase.from('org_salary_components').select('*').eq('company_id', profile.company_id),
            supabase.from('org_shift_timings').select('*').eq('company_id', profile.company_id),
            supabase.from('org_attendance_status').select('*').eq('company_id', profile.company_id),
            supabase.from('org_weekoff_rules').select('*').eq('company_id', profile.company_id)
        ]);

        if (lvType.data) setLeaveTypes(lvType.data as any);
        if (salComp.data) setSalaryComponents(salComp.data as any);
        if (shifts.data) setShiftTimings(shifts.data as any);
        if (attStatus.data) setAttendanceStatuses(attStatus.data as any);
        if (weekoff.data) setWeekoffRules(weekoff.data as any);
    };

    useEffect(() => {
        fetchMasterData();
    }, []);

    const handleUpdateAttendanceStatus = async (statusObj: any) => {
        if (!editingAttendanceId) return;
        const { error } = await supabase.from('attendance').update({ attendance_status_id: statusObj.id, status: statusObj.name }).eq('id', editingAttendanceId);
        if (error) console.error(error);
        else {
            refreshData();
            setShowAttendanceStatusModal(false);
            setEditingAttendanceId(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (isoStr: string | null) => {
        if (!isoStr) return '--:--';
        return new Date(isoStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

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

    useEffect(() => {
        if (activeTab === 'ASSETS') {
            supabase.from('assets').select('*').order('created_at', { ascending: false }).then(({ data }) => {
                if (data) setAssets(data.map((a: any) => ({ ...a, assignedTo: a.assigned_to, purchaseDate: a.purchase_date })));
            });
        }
    }, [activeTab]);

    const AddLeaveModal = () => (
        <Modal title="Grant Leave / Request Leave" onClose={() => setShowLeaveModal(false)}>
            <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const leaveTypeId = formData.get('leave_type_id') as string;
                const typeName = leaveTypes.find(lt => lt.id.toString() === leaveTypeId.toString())?.code || 'OTHER';
                const { error } = await supabase.from('leaves').insert([{
                    employee_id: currentEmployee?.id,
                    company_id: currentEmployee?.company_id,
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
                <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all active:scale-95">Submit Request</button>
            </form>
        </Modal>
    );

    const navItems = useMemo(() => [
        { id: 'OVERVIEW', icon: LayoutDashboard, label: 'Dashboard', permission: 'hrms.employees.view' },
        { id: 'PEOPLE', icon: Users, label: 'People', permission: 'hrms.employees.view' },
        { id: 'APPROVALS', icon: ShieldCheck, label: 'Approvals', permission: 'hrms.approvals.manage' },
        { id: 'ATTENDANCE', icon: Clock, label: 'Attendance', permission: 'hrms.attendance.view' },
        { id: 'LEAVES', icon: Briefcase, label: 'Leave', permission: 'hrms.leave.view' },
        { id: 'PAYROLL', icon: DollarSign, label: 'Payroll', permission: 'finance.payroll.view' },
        { id: 'ASSETS', icon: Monitor, label: 'Assets', permission: 'hrms.assets.view' },
        { id: 'HELPDESK', icon: Headphones, label: 'Help Desk', permission: 'hrms.helpdesk.view' },
        { id: 'REPORTS', icon: FileText, label: 'Reports', permission: 'hrms.reports.view' },
        { id: 'EXIT', icon: LogOut, label: 'Exit Mgmt', permission: 'hrms.exit.view' },
        { id: 'SETTINGS', icon: Settings, label: 'Settings', permission: 'hrms.settings.manage' },
    ].filter(item => hasPermission(item.permission) || hasPermission('*')), [hasPermission]);

    useEffect(() => {
        if (navItems.length > 0 && !navItems.find(i => i.id === activeTab)) {
            setActiveTab(navItems[0].id as HRMSViewMode);
        }
    }, [navItems, activeTab]);

    return (
        <div className="flex h-full relative z-10 overflow-hidden bg-slate-50 dark:bg-black/20">
            {/* Sidebar */}
            <div className="w-20 md:w-64 flex-shrink-0 bg-white/40 dark:bg-zinc-900/40 border-r border-slate-200/50 dark:border-zinc-800 flex flex-col justify-between pt-8 pb-4 px-4 backdrop-blur-xl">
                <div className="flex flex-col gap-3">
                    <div className="mb-8 px-2 hidden md:block">
                        <div className="flex items-center gap-2 mb-1">
                            <img src={KAA_LOGO_URL} alt="HRMS Logo" className="h-8 w-auto object-contain brightness-100 dark:brightness-[1.15]" />
                            <span className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">HRMS</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">Core Suite</span>
                    </div>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as HRMSViewMode)}
                            className={`flex items-center justify-between p-3.5 rounded-2xl transition-all active:scale-95 duration-200 ${activeTab === item.id
                                ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30'
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
                {activeTab === 'OVERVIEW' && <OverviewDashboard stats={stats} announcements={announcements} employees={employees} />}
                {activeTab === 'PEOPLE' && <EmployeeDirectory
                    employees={employees}
                    roles={roles}
                    departments={departments}
                    designations={designations}
                    onSelectEmployee={setSelectedEmployee}
                    onAddEmployee={hasPermission('hrms.employees.manage') ? () => { setShowEmployeeForm(true); setEditingEmployee(null); } : undefined}
                />}
                {activeTab === 'APPROVALS' && <ApprovalsModule currentEmployee={currentEmployee} />}
                {activeTab === 'ATTENDANCE' && <AttendanceModule employees={employees} />}
                {activeTab === 'LEAVES' && <LeaveModule leaves={leaves} leaveTypes={leaveTypes} setShowLeaveModal={setShowLeaveModal} onUpdateStatus={handleUpdateLeaveStatus} formatDate={formatDate} />}
                {activeTab === 'ASSETS' && <AssetModule assets={assets} employees={employees} refreshData={refreshData} />}
                {activeTab === 'HELPDESK' && <HelpDeskModule employees={employees} currentEmployee={currentEmployee} />}
                {activeTab === 'PAYROLL' && <PayrollDashboard />}
                {activeTab === 'REPORTS' && <ReportsListView />}
                {activeTab === 'EXIT' && <ExitModule employees={employees} currentEmployee={currentEmployee} />}
                {activeTab === 'SETTINGS' && <SettingsModule />}
            </div>

            {/* Modals */}
            {selectedEmployee && (
                <EmployeeDetailModal
                    emp={selectedEmployee}
                    onClose={() => setSelectedEmployee(null)}
                    onEdit={(e) => { setEditingEmployee(e); setShowEmployeeForm(true); }}
                    refreshData={refreshData}
                    departments={departments}
                    locations={locations}
                    designations={designations}
                    grades={grades}
                    employmentTypes={employmentTypes}
                    payGroups={payGroups}
                    roles={roles}
                    employees={employees}
                    salaryComponents={salaryComponents}
                    maritalStatuses={maritalStatuses}
                    nationalities={nationalities}
                    visaTypes={visaTypes}
                    employeeStatuses={employeeStatuses}
                    leavePlans={leavePlans}
                />
            )}
            {showAttendanceEditModal && selectedAttendanceId && (
                <EditAttendanceModal
                    recordId={selectedAttendanceId}
                    onClose={() => setShowAttendanceEditModal(false)}
                    onSuccess={() => refreshData()}
                />
            )}
            {showEmployeeForm && (
                <EmployeeFormModal
                    initialData={editingEmployee}
                    onClose={() => { setShowEmployeeForm(false); setEditingEmployee(null); }}
                    refreshData={refreshData}
                    departments={departments}
                    locations={locations}
                    designations={designations}
                    grades={grades}
                    employmentTypes={employmentTypes}
                    payGroups={payGroups}
                    faiths={faiths}
                    maritalStatuses={maritalStatuses}
                    bloodGroups={bloodGroups}
                    nationalities={nationalities}
                    visaTypes={visaTypes}
                    employeeStatuses={employeeStatuses}
                    leavePlans={leavePlans}
                    roles={roles}
                    leaveTypes={leaveTypes}
                    shiftTimings={shiftTimings}
                    weekoffRules={weekoffRules}
                    salaryComponents={salaryComponents}
                    employees={employees}
                />
            )}
            {showLeaveModal && <AddLeaveModal />}
            {showAttendanceStatusModal && (
                <Modal title="Update Attendance Status" onClose={() => setShowAttendanceStatusModal(false)} maxWidth="max-w-md">
                    <div className="space-y-3">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Select new status for this record:</p>
                        {attendanceStatuses.map(status => (
                            <button
                                key={status.id}
                                onClick={() => handleUpdateAttendanceStatus(status)}
                                className="w-full p-4 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 transition-all text-left flex items-center justify-between group"
                            >
                                <div>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 block">{status.name}</span>
                                    <span className="text-xs text-slate-400 group-hover:text-indigo-400/70">{status.code}</span>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${status.name === 'Present' ? 'bg-emerald-500' :
                                    status.name === 'Absent' ? 'bg-rose-500' : 'bg-amber-500'
                                    }`}></div>
                            </button>
                        ))}
                    </div>
                </Modal>
            )}
        </div>
    );
};