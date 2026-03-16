import React, { useMemo } from 'react';
import {
    TrendingUp, Briefcase, Users, PieChart as PieChartIcon,
    CheckSquare, Plus, ArrowUpRight
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { CRMStats, CRMActivity, Deal, Task } from './types';
import { useAuth } from '../../contexts/AuthContext';

interface SummaryViewProps {
    stats: CRMStats | null;
    activities: CRMActivity[];
    deals: Deal[];
    tasks: Task[];
}

const StatCard = ({ title, value, icon: Icon, color }: any) => {
    const colors: any = {
        indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30',
        emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30',
        cyan: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30',
        amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30'
    };
    return (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all border border-slate-100 dark:border-zinc-800 group">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">{title}</p>
                    <h4 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{value}</h4>
                </div>
                <div className={`p-2.5 rounded-xl ${colors[color]} transition-transform group-hover:scale-110`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
        </div>
    );
};

export default function SummaryView({ stats, activities, deals, tasks }: SummaryViewProps) {
    const { user } = useAuth();

    // Compute monthly revenue from real deals data
    const revenueChartData = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyTotals = new Array(12).fill(0);

        (deals || []).forEach(deal => {
            if (deal.created_at) {
                const month = new Date(deal.created_at).getMonth();
                monthlyTotals[month] += deal.value || 0;
            }
        });

        return months.map((name, i) => ({ name, value: monthlyTotals[i] }));
    }, [deals]);

    const hasChartData = revenueChartData.some(d => d.value > 0);

    return (
        <div className="p-6 lg:p-8 h-full flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
                <p className="text-slate-500 text-sm mt-1">Welcome back, {user?.email?.split('@')[0]} 👋</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                    title="Total Pipeline"
                    value={`$${(stats?.totalRevenue || 0).toLocaleString()}`}
                    icon={TrendingUp}
                    color="indigo"
                />
                <StatCard
                    title="Active Deals"
                    value={stats?.activeDeals || 0}
                    icon={Briefcase}
                    color="emerald"
                />
                <StatCard
                    title="Total Contacts"
                    value={stats?.totalContacts || 0}
                    icon={Users}
                    color="cyan"
                />
                <StatCard
                    title="Conversion Rate"
                    value={`${stats?.conversionRate?.toFixed(1) || 0}%`}
                    icon={PieChartIcon}
                    color="amber"
                />
            </div>

            {/* Main Content Areas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Revenue Overview</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Monthly deal values</p>
                        </div>
                    </div>
                    <div className="h-[260px] w-full">
                        {hasChartData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueChartData}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px 12px' }}
                                        cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm font-medium">No revenue data yet</p>
                                <p className="text-xs mt-1">Deals will appear here as they are created</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-y-auto max-h-[400px]">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Recent Activity</h3>
                    {activities.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-slate-400">
                            <p className="text-sm">No activity yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activities.slice(0, 8).map((act) => (
                                <div key={act.id} className="flex gap-3 group">
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200 dark:border-zinc-700">
                                            {(act.performer?.name || 'Sys').substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="w-px flex-1 bg-slate-100 dark:bg-zinc-800 my-1 group-last:hidden"></div>
                                    </div>
                                    <div className="pb-1">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                            <span className="font-semibold text-slate-900 dark:text-white">{act.performer?.name || 'System'}</span>
                                            {' '}{act.description}
                                        </p>
                                        <span className="text-[11px] text-slate-400 mt-0.5 block">{new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Deals Box */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Top Deals</h3>
                    </div>
                    {(deals || []).length === 0 ? (
                        <div className="h-32 flex flex-col items-center justify-center text-slate-400">
                            <Briefcase className="w-8 h-8 mb-2 opacity-30" />
                            <p className="text-sm">No deals yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {(deals || []).slice(0, 4).map((deal) => (
                                <div key={deal.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-800/50 rounded-xl hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm transition-all border border-transparent hover:border-slate-100 dark:hover:border-zinc-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-lg flex items-center justify-center text-indigo-600 shadow-sm">
                                            <Briefcase className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800 dark:text-white text-sm">{deal.title}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5">{deal.stage?.name || 'Unknown Stage'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-900 dark:text-white text-sm">${deal.value.toLocaleString()}</p>
                                        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">{deal.stage?.win_probability || 0}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Upcoming Tasks */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                    <h3 className="text-lg font-bold mb-5 relative z-10 flex items-center gap-2"><CheckSquare className="w-5 h-5 opacity-80" /> Upcoming Tasks</h3>
                    {(tasks || []).length === 0 ? (
                        <div className="h-32 flex items-center justify-center text-white/60 relative z-10">
                            <p className="text-sm">No tasks scheduled</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5 relative z-10 max-h-[260px] overflow-y-auto">
                            {(tasks || []).slice(0, 5).map(task => {
                                const priorityColors: Record<string, string> = {
                                    'High': 'bg-rose-500',
                                    'Medium': 'bg-amber-500',
                                    'Low': 'bg-emerald-500'
                                };
                                return (
                                    <div key={task.id} className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 hover:bg-white/20 transition-all flex items-center gap-3 cursor-pointer">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{task.title}</p>
                                            <p className="text-[11px] opacity-70 mt-0.5">{new Date(task.due_date).toLocaleDateString()}</p>
                                        </div>
                                        <span className={`w-2 h-2 rounded-full ${priorityColors[task.priority_details?.name || ''] || 'bg-slate-400'}`}></span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <button className="mt-4 w-full py-2.5 bg-white/15 backdrop-blur-md rounded-xl font-medium text-sm hover:bg-white/25 transition-colors flex items-center justify-center gap-2 relative z-10">
                        <Plus className="w-4 h-4" /> Add Task
                    </button>
                </div>
            </div>
        </div>
    );
}
