import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock, Calendar, Layers, ClipboardList, BarChart3, FileText, LayoutDashboard
} from 'lucide-react';
import { Employee } from '../hrms/types';
import { AttendanceViewMode } from '../../types';
import {
    OverviewTab, DailyTab, MonthlyTab, ShiftsTab, DutyRosterTab
} from './hrms/AttendanceModule';
import { ReportsListView } from './reports/ReportsListView';

import { KAA_LOGO_URL } from '../../constants';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export const AttendanceHub: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AttendanceViewMode>('OVERVIEW');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [companyId, setCompanyId] = useState<string>('');
    const [companyOffDays, setCompanyOffDays] = useState<number[]>([5, 6]);
    const [loading, setLoading] = useState(true);
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

    useEffect(() => {
        if (!companyId) return;

        const fetchData = async () => {
            setLoading(true);
            // Fetch Off Days
            const { data: offDaysData } = await supabase.from('org_attendance_settings')
                .select('default_weekly_off_days')
                .eq('company_id', companyId)
                .maybeSingle();
            if (offDaysData?.default_weekly_off_days) {
                setCompanyOffDays(offDaysData.default_weekly_off_days.split(',').map(Number).filter((n: number) => !isNaN(n)));
            }

            // Fetch Employees
            const { data: empData } = await supabase.from('employees')
                .select('*')
                .eq('company_id', companyId);
            if (empData) {
                setEmployees(empData.map((e: any) => ({
                    ...e,
                    joinDate: e.join_date,
                    salary: e.salary_amount,
                    avatar: e.profile_photo_url || `https://ui-avatars.com/api/?name=${e.name}&background=random`
                })));
            }
            setLoading(false);
        };

        fetchData();
    }, [companyId]);

    const activeEmployees = useMemo(() =>
        employees.filter(e => e.status === 'Active'), [employees]);

    const navItems = useMemo(() => [
        { id: 'OVERVIEW', icon: BarChart3, label: 'Overview', permission: 'hrms.attendance.view' },
        { id: 'LOGS', icon: Clock, label: 'Daily Logs', permission: 'hrms.attendance.view' },
        { id: 'CORRECTION', icon: Calendar, label: 'Correction', permission: 'hrms.attendance.view' },
        { id: 'MANUAL', icon: ClipboardList, label: 'Duty Roster', permission: 'hrms.attendance.view' },
        { id: 'SHIFTS', icon: Layers, label: 'Shifts', permission: 'hrms.attendance.view' },
        { id: 'REPORTS', icon: FileText, label: 'Reports', permission: 'hrms.reports.view' },
    ].filter(item => hasPermission(item.permission) || hasPermission('*')), [hasPermission]);

    useEffect(() => {
        if (navItems.length > 0 && !navItems.find(i => i.id === activeTab)) {
            setActiveTab(navItems[0].id as AttendanceViewMode);
        }
    }, [navItems, activeTab]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
            </div>
        );
    }

    return (
        <div className="flex h-full relative z-10 overflow-hidden bg-slate-50 dark:bg-black/20">
            {/* Sidebar */}
            <div className="w-20 md:w-64 flex-shrink-0 bg-white/40 dark:bg-zinc-900/40 border-r border-slate-200/50 dark:border-zinc-800 flex flex-col justify-between pt-8 pb-4 px-4 backdrop-blur-xl">
                <div className="flex flex-col gap-3">
                    <div className="mb-8 px-2 hidden md:block">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-6 h-6 text-cyan-600" />
                            <span className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">Attendance</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">Time & shifts</span>
                    </div>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as AttendanceViewMode)}
                            className={`flex items-center justify-between p-3.5 rounded-2xl transition-all active:scale-95 duration-200 ${activeTab === item.id
                                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
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
                {activeTab === 'OVERVIEW' && <OverviewTab employees={activeEmployees} companyId={companyId} />}
                {activeTab === 'LOGS' && <DailyTab employees={activeEmployees} companyId={companyId} />}
                {activeTab === 'CORRECTION' && <MonthlyTab employees={activeEmployees} companyId={companyId} companyOffDays={companyOffDays} />}
                {activeTab === 'MANUAL' && <DutyRosterTab employees={activeEmployees} companyId={companyId} companyOffDays={companyOffDays} />}
                {activeTab === 'SHIFTS' && <ShiftsTab companyId={companyId} />}
                {activeTab === 'REPORTS' && <ReportsListView moduleFilter="ATTENDANCE" />}
            </div>
        </div>
    );
};
