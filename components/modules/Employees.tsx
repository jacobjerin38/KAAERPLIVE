import React, { useState, useEffect, useMemo } from 'react';
import {
    Users, Briefcase, Calendar, ChevronRight, Search, Plus, Bell,
    Settings, LogOut, FileText, Check, AlertCircle, ChevronLeft,
    MoreVertical, Edit3, MoreHorizontal, Headphones, ShieldCheck,
    Building2, Monitor, LayoutDashboard
} from 'lucide-react';
import {
    Department, Location, Role, Designation, Grade,
    EmploymentType, PayGroup, Faith, MaritalStatus, BloodGroup,
    Nationality, LeaveType, SalaryComponent, ShiftTiming,
    AttendanceStatusMaster, WeekoffRule, Employee,
    VisaType, EmployeeStatusMaster, LeavePlan, Asset
} from '../hrms/types';
import { EmployeesViewMode } from '../../types';
import { EmployeeFormModal } from './hrms/EmployeeFormModal';
import { EmployeeDetailModal } from './hrms/EmployeeDetailModal';
import { EmployeeDirectory } from './hrms/EmployeeDirectory';
import { ApprovalsModule } from './hrms/ApprovalsModule';
import { AssetModule } from './hrms/AssetModule';
import { HelpDeskModule } from './hrms/HelpDeskModule';
import { ExitModule } from './hrms/ExitModule';
import { SettingsModule } from './hrms/SettingsModule';
import { ReportsListView } from './reports/ReportsListView';

import { KAA_LOGO_URL } from '../../constants';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useDelayLoading } from '../../contexts/GlobalLoadingContext';
import { TableSkeleton, DashboardSkeleton } from '../ui/LoadingSkeletons';

export const Employees: React.FC = () => {
    const [activeTab, setActiveTab] = useState<EmployeesViewMode>('OVERVIEW');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);

    // User Context
    const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

    // Selection State
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    // Admin Stats State
    const [stats, setStats] = useState({
        employees: 0,
        departments: 0,
        pendingApprovals: 0,
        pendingExits: 0
    });

    // Modal State
    const [showEmployeeForm, setShowEmployeeForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

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

    const [loading, setLoading] = useState(true);
    const delayedLoading = useDelayLoading(loading, 300);
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

        // Stats Data
        const { count: empCount } = await supabase.from('employees')
            .select('id', { count: 'exact' })
            .eq('company_id', profile.company_id);
        
        const { count: deptCount } = await supabase.from('departments')
            .select('id', { count: 'exact' })
            .eq('company_id', profile.company_id);

        const { count: pendingAppr } = await supabase.from('employee_job_transitions')
            .select('id', { count: 'exact' })
            .eq('status', 'Pending');

        const { count: pendingExts } = await supabase.from('resignations')
            .select('id', { count: 'exact' })
            .eq('company_id', profile.company_id)
            .eq('status', 'Pending');

        setStats({
            employees: empCount || 0,
            departments: deptCount || 0,
            pendingApprovals: pendingAppr || 0,
            pendingExits: pendingExts || 0
        });

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

    useEffect(() => {
        if (activeTab === 'ASSETS') {
            supabase.from('assets').select('*').order('created_at', { ascending: false }).then(({ data }) => {
                if (data) setAssets(data.map((a: any) => ({ ...a, assignedTo: a.assigned_to, purchaseDate: a.purchase_date })));
            });
        }
    }, [activeTab]);

    const navItems = useMemo(() => [
        { id: 'OVERVIEW', icon: LayoutDashboard, label: 'Dashboard', permission: 'hrms.employees.view' },
        { id: 'PEOPLE', icon: Users, label: 'People', permission: 'hrms.employees.view' },
        { id: 'APPROVALS', icon: ShieldCheck, label: 'Approvals', permission: 'hrms.approvals.manage' },
        { id: 'ASSETS', icon: Monitor, label: 'Assets', permission: 'hrms.assets.view' },
        { id: 'HELPDESK', icon: Headphones, label: 'Help Desk', permission: 'hrms.helpdesk.view' },
        { id: 'REPORTS', icon: FileText, label: 'Reports', permission: 'hrms.reports.view' },
        { id: 'EXIT', icon: LogOut, label: 'Exit Mgmt', permission: 'hrms.exit.view' },
        { id: 'SETTINGS', icon: Settings, label: 'Settings', permission: 'hrms.settings.manage' },
    ].filter(item => hasPermission(item.permission) || hasPermission('*')), [hasPermission]);

    useEffect(() => {
        if (navItems.length > 0 && !navItems.find(i => i.id === activeTab)) {
            setActiveTab(navItems[0].id as EmployeesViewMode);
        }
    }, [navItems, activeTab]);

    const renderDashboard = () => {
        const recentEmployees = [...employees]
            .sort((a, b) => new Date(b.join_date || '').getTime() - new Date(a.join_date || '').getTime())
            .slice(0, 5);

        return (
            <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
                <header className="flex justify-between items-center mb-10 shrink-0">
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Employees Dashboard</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg font-medium">Overview of your employee base and directories.</p>
                    </div>
                </header>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Employees</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stats.employees}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Departments</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stats.departments}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Building2 className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Pending Approvals</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stats.pendingApprovals}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Pending Exits</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stats.pendingExits}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <LogOut className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                    {/* Recent Hires */}
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Recent Hires</h3>
                        {recentEmployees.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-slate-400 italic">No employees found.</div>
                        ) : (
                            <div className="space-y-4">
                                {recentEmployees.map(emp => (
                                    <div key={emp.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-850 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <img 
                                                src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random`} 
                                                alt={emp.name} 
                                                className="w-10 h-10 rounded-full border border-slate-200 dark:border-zinc-700 object-cover" 
                                            />
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{emp.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{emp.designation || 'Staff'} • {emp.department || 'General'}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-400 font-bold font-mono">
                                            {emp.joinDate ? `${String(new Date(emp.joinDate).getDate()).padStart(2, '0')}/${String(new Date(emp.joinDate).getMonth() + 1).padStart(2, '0')}/${new Date(emp.joinDate).getFullYear()}` : '—'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Access Actions */}
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-4 flex-1">
                            <button 
                                onClick={() => { setActiveTab('PEOPLE'); setShowEmployeeForm(true); setEditingEmployee(null); }}
                                className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-700 hover:border-rose-500 dark:hover:border-rose-500 hover:bg-rose-50/20 dark:hover:bg-rose-950/20 transition-all text-left flex flex-col justify-between group active:scale-95"
                            >
                                <Users className="w-8 h-8 text-rose-500 mb-4" />
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-rose-600 transition-colors">Onboard Employee</h4>
                                    <p className="text-xs text-slate-400 mt-1">Add a new record to directory</p>
                                </div>
                            </button>
                            <button 
                                onClick={() => setActiveTab('APPROVALS')}
                                className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-700 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50/20 dark:hover:bg-amber-950/20 transition-all text-left flex flex-col justify-between group active:scale-95"
                            >
                                <ShieldCheck className="w-8 h-8 text-amber-500 mb-4" />
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-amber-600 transition-colors">Pending Approvals</h4>
                                    <p className="text-xs text-slate-400 mt-1">Approve job transitions</p>
                                </div>
                            </button>
                            <button 
                                onClick={() => setActiveTab('ASSETS')}
                                className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all text-left flex flex-col justify-between group active:scale-95"
                            >
                                <Monitor className="w-8 h-8 text-blue-500 mb-4" />
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">Manage Assets</h4>
                                    <p className="text-xs text-slate-400 mt-1">Assign hardware to staff</p>
                                </div>
                            </button>
                            <button 
                                onClick={() => setActiveTab('REPORTS')}
                                className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all text-left flex flex-col justify-between group active:scale-95"
                            >
                                <FileText className="w-8 h-8 text-emerald-500 mb-4" />
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-emerald-600 transition-colors">Directory Reports</h4>
                                    <p className="text-xs text-slate-400 mt-1">Export employee data and summaries</p>
                                </div>
                            </button>
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
                            <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-1.5 flex items-center justify-center h-10 w-10 shrink-0">
                                <img src={KAA_LOGO_URL} alt="Employees Logo" className="h-full w-full object-contain" />
                            </div>
                            <span className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">Employees</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">Directory & Assets</span>
                    </div>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as EmployeesViewMode)}
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
                {delayedLoading ? (
                    activeTab === 'OVERVIEW' ? <DashboardSkeleton /> : <TableSkeleton />
                ) : (
                    <>
                        {activeTab === 'OVERVIEW' && renderDashboard()}
                        {activeTab === 'PEOPLE' && <EmployeeDirectory
                            employees={employees}
                            roles={roles}
                            departments={departments}
                            designations={designations}
                            onSelectEmployee={setSelectedEmployee}
                            onAddEmployee={hasPermission('hrms.employees.manage') ? () => { setShowEmployeeForm(true); setEditingEmployee(null); } : undefined}
                        />}
                        {activeTab === 'APPROVALS' && <ApprovalsModule currentEmployee={currentEmployee} />}
                        {activeTab === 'ASSETS' && <AssetModule assets={assets} employees={employees} refreshData={refreshData} />}
                        {activeTab === 'HELPDESK' && <HelpDeskModule employees={employees} currentEmployee={currentEmployee} />}
                        {activeTab === 'REPORTS' && <ReportsListView moduleFilter="EMPLOYEES" />}
                        {activeTab === 'EXIT' && <ExitModule employees={employees} currentEmployee={currentEmployee} />}
                        {activeTab === 'SETTINGS' && <SettingsModule />}
                    </>
                )}
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
        </div>
    );
};
