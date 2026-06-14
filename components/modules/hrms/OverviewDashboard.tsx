import React from 'react';
import {
    Users, Briefcase, Bell, Check, DollarSign
} from 'lucide-react';
import { Announcement } from '../../hrms/types';

interface OverviewDashboardProps {
    stats: {
        employees: number;
        present: number;
        liability: number;
        departments: number;
    };
    announcements: Announcement[];
    employees: any[]; // Or Employee[] if imported
}

import { Cake } from 'lucide-react';

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ stats, announcements, employees = [] }) => {
    // Upcoming Birthdays logic
    const upcomingBirthdays = React.useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        return employees
            .filter(emp => emp.date_of_birth)
            .map(emp => {
                const dob = new Date(emp.date_of_birth);
                const thisYearBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
                
                // If birthday has passed this year, look at next year
                if (thisYearBday < today) {
                    thisYearBday.setFullYear(today.getFullYear() + 1);
                }
                
                const daysUntil = Math.ceil((thisYearBday.getTime() - today.getTime()) / (1000 * 3600 * 24));
                const ageToTurn = thisYearBday.getFullYear() - dob.getFullYear();
                
                return {
                    ...emp,
                    daysUntil,
                    ageToTurn
                };
            })
            .sort((a, b) => a.daysUntil - b.daysUntil)
            .slice(0, 5); // Top 5 upcoming
    }, [employees]);

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            <header className="flex justify-between items-center mb-10 shrink-0">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Admin Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg font-medium">Overview of your organization's performance.</p>
                </div>
                <div className="flex gap-4">
                    <button className="p-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors relative active:scale-95">
                        <Bell className="w-6 h-6" />
                        <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white dark:border-zinc-800"></span>
                    </button>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Employees</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stats.employees}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Users className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Present Today</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stats.present}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Check className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Payroll Liability</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">${stats.liability.toLocaleString()}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <DollarSign className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Departments</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stats.departments}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Briefcase className="w-6 h-6" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                {/* Attendance Trends */}
                <div className="lg:col-span-2 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Attendance Trends</h3>
                    <div className="h-64 flex items-end justify-between gap-4 px-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50 p-6">
                        {/* Mock Chart Bars for now */}
                        {[65, 78, 45, 89, 92, 54, 85].map((h, i) => (
                            <div key={i} className="w-full bg-indigo-500 rounded-t-lg opacity-80 hover:opacity-100 transition-opacity" style={{ height: `${h}%` }}></div>
                        ))}
                    </div>
                    <p className="text-center text-xs text-slate-400 font-bold mt-4 uppercase tracking-widest">Last 7 Days</p>
                </div>

                {/* Announcements */}
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-rose-500" />
                        Announcements
                    </h3>

                    {announcements.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <p className="text-sm italic">No active announcements.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            {announcements.map(ann => (
                                <div key={ann.id} className="p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 shadow-sm">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">{ann.title}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{ann.content}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Upcoming Birthdays */}
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex flex-col xl:col-span-1 lg:col-span-3">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Cake className="w-5 h-5 text-fuchsia-500" />
                        Upcoming Birthdays
                    </h3>

                    {upcomingBirthdays.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <p className="text-sm italic">No upcoming birthdays.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                            {upcomingBirthdays.map((emp: any) => (
                                <div key={emp.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 shadow-sm">
                                    <img 
                                        src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random`} 
                                        alt={emp.name} 
                                        className="w-10 h-10 rounded-full border border-slate-200 dark:border-zinc-700 object-cover" 
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{emp.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate w-full flex items-center gap-1.5">
                                            <span>{new Date(emp.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-600"></span>
                                            <span>Turning <span className="font-bold text-fuchsia-600 dark:text-fuchsia-400">{emp.ageToTurn}</span></span>
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${emp.daysUntil === 0 ? 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30' : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-slate-300'}`}>
                                            {emp.daysUntil === 0 ? 'Today!' : `In ${emp.daysUntil}d`}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
