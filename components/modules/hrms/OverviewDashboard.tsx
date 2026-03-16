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
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ stats, announcements }) => {
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
            </div>
        </div>
    );
};
