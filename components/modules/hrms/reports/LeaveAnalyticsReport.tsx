import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { Calendar, Users, Activity, Loader2, Download, Filter } from 'lucide-react';

export const LeaveAnalyticsReport: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [deptData, setDeptData] = useState<any[]>([]);

    useEffect(() => {
        if (currentCompanyId) fetchData();
    }, [currentCompanyId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Leaves with join to Leave Types and Employees
            const { data: leaves, error } = await supabase
                .from('leaves')
                .select(`
                    id, type, status, start_date, end_date,
                    employee:employees(name, department_id, department:departments(name))
                `)
                .eq('company_id', currentCompanyId);

            if (error) throw error;

            // 2. Process Stats
            const total = leaves.length;
            const approved = leaves.filter(l => l.status === 'Approved').length;
            const pending = leaves.filter(l => l.status === 'Pending').length;
            const rejected = leaves.filter(l => l.status === 'Rejected').length;

            setStats({ total, approved, pending, rejected });

            // 3. Process Type Chart Data
            const typeMap: any = {};
            leaves.forEach(l => {
                typeMap[l.type] = (typeMap[l.type] || 0) + 1;
            });
            setChartData(Object.keys(typeMap).map(name => ({ name, value: typeMap[name] })));

            // 4. Process Department Chart Data
            const deptMap: any = {};
            leaves.forEach(l => {
                const deptName = l.employee?.department?.name || 'Unassigned';
                deptMap[deptName] = (deptMap[deptName] || 0) + 1;
            });
            setDeptData(Object.keys(deptMap).map(name => ({ name, count: deptMap[name] })));

        } catch (err) {
            console.error('Error fetching leave analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Crunching leave data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-page-enter">
            {/* Header */}
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Leave Analytics</h2>
                    <p className="text-slate-500 text-sm">Visualize leave patterns and trends across your company</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchData} className="p-2.5 bg-slate-100 dark:bg-zinc-800 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all">
                        <Activity className="w-4 h-4" />
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all">
                        <Download className="w-4 h-4" /> Export Report
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Requests', value: stats?.total, color: 'indigo', icon: Calendar },
                    { label: 'Approved', value: stats?.approved, color: 'emerald', icon: Users },
                    { label: 'Pending Approval', value: stats?.pending, color: 'amber', icon: Activity },
                    { label: 'Rejected', value: stats?.rejected, color: 'rose', icon: Filter },
                ].map((s, idx) => (
                    <div key={idx} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                        <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-${s.color}-500/5 rounded-full group-hover:scale-110 transition-transform`} />
                        <div className="flex justify-between items-start mb-4 relative">
                            <div className={`p-3 bg-${s.color}-100 dark:bg-${s.color}-900/20 rounded-2xl text-${s.color}-600 dark:text-${s.color}-400`}>
                                <s.icon className="w-6 h-6" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{s.value || 0}</h3>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Leave Types */}
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col h-[400px]">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Leave Type Distribution</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Departmental Leave */}
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col h-[400px]">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Leave by Department</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={deptData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
