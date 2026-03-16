import React, { useMemo } from 'react';
import { BarChart, PieChart, TrendingUp, Users, Clock, AlertTriangle } from 'lucide-react';
import { AttendanceRecord, Employee } from '../../hrms/types';

interface AttendanceReportsProps {
    attendance: AttendanceRecord[];
    employees: Employee[];
    month: string; // YYYY-MM
}

export const AttendanceReports: React.FC<AttendanceReportsProps> = ({ attendance, employees, month }) => {

    const stats = useMemo(() => {
        const totalEmployees = employees.length;
        const present = attendance.filter(a => a.status === 'Present').length;
        const absent = attendance.filter(a => a.status === 'Absent').length;
        const late = attendance.filter(a => {
            if (!a.checkIn) return false;
            const hour = parseInt(a.checkIn.split(':')[0]);
            return hour >= 10; // Late after 10 AM (Mock rule)
        }).length;
        const onLeave = attendance.filter(a => a.status === 'On Leave').length;

        const avgDuration = attendance.reduce((acc, curr) => acc + (curr.duration || 0), 0) / (present || 1);

        return {
            totalEmployees,
            present,
            absent,
            late,
            onLeave,
            avgDuration: avgDuration.toFixed(1)
        };
    }, [attendance, employees]);

    const attendancePercentage = Math.round((stats.present / (stats.totalEmployees || 1)) * 100);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                    label="Attendance Rate"
                    value={`${attendancePercentage}%`}
                    subtext={`${stats.present} / ${stats.totalEmployees} Present`}
                    icon={TrendingUp}
                    color="indigo"
                />
                <StatCard
                    label="Absentees"
                    value={stats.absent}
                    subtext="Unaccounted Absence"
                    icon={AlertTriangle}
                    color="rose"
                />
                <StatCard
                    label="On Leave"
                    value={stats.onLeave}
                    subtext="Approved Leaves"
                    icon={Users}
                    color="blue"
                />
                <StatCard
                    label="Avg. Work Hrs"
                    value={stats.avgDuration}
                    subtext="Per Employee"
                    icon={Clock}
                    color="emerald"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Visual Representation (Mock implementation without charting lib) */}
                <div className="p-6 bg-white dark:bg-zinc-800 rounded-[2rem] border border-slate-100 dark:border-zinc-700 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Daily Status Breakdown</h3>
                    <div className="space-y-4">
                        <ProgressBar label="Present" value={stats.present} total={stats.totalEmployees} color="bg-emerald-500" />
                        <ProgressBar label="Absent" value={stats.absent} total={stats.totalEmployees} color="bg-rose-500" />
                        <ProgressBar label="On Leave" value={stats.onLeave} total={stats.totalEmployees} color="bg-blue-500" />
                        <ProgressBar label="Half Day / Late" value={stats.late} total={stats.totalEmployees} color="bg-amber-500" />
                    </div>
                </div>

                {/* Employee Performance List */}
                <div className="p-6 bg-white dark:bg-zinc-800 rounded-[2rem] border border-slate-100 dark:border-zinc-700 shadow-sm overflow-hidden flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Employee Performance (Today)</h3>
                    <div className="flex-1 overflow-y-auto pr-2">
                        {attendance.map(rec => {
                            const emp = employees.find(e => e.id === rec.employeeId);
                            return (
                                <div key={rec.id} className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-zinc-700/50 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                            {emp?.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{emp?.name}</p>
                                            <p className="text-xs text-slate-400">{rec.checkIn || '--:--'} - {rec.checkOut || '--:--'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-800 dark:text-white">{rec.duration}h</p>
                                        <span className={`text-[10px] font-bold ${rec.duration && rec.duration > 8 ? 'text-emerald-500' :
                                                rec.duration && rec.duration < 4 ? 'text-rose-500' : 'text-amber-500'
                                            }`}>{rec.status}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, subtext, icon: Icon, color }: any) => {
    const colorClasses: any = {
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    };

    return (
        <div className="p-6 bg-white dark:bg-zinc-800 rounded-[2rem] border border-slate-100 dark:border-zinc-700 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`p-4 rounded-2xl ${colorClasses[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-0.5">{value}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{subtext}</p>
            </div>
        </div>
    );
}

const ProgressBar = ({ label, value, total, color }: any) => {
    const minTotal = total || 1;
    const percentage = Math.round((value / minTotal) * 100);

    return (
        <div>
            <div className="flex justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
                <span className="text-xs font-bold text-slate-400">{value} / {total} ({percentage}%)</span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    )
}
