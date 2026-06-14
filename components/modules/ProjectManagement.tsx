import React, { useState, useEffect } from 'react';
import { Briefcase, CheckSquare, Clock, Plus, LayoutDashboard, Search, CheckCircle2, Circle, BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export const ProjectManagement: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PROJECTS' | 'TASKS' | 'TIMESHEETS' | 'ANALYTICS'>('OVERVIEW');
    
    const [projects, setProjects] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [timesheets, setTimesheets] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showTimesheetModal, setShowTimesheetModal] = useState(false);

    // Form States
    const [newProject, setNewProject] = useState({ name: '', description: '', status: 'Planning', budget: 0, start_date: '', end_date: '' });
    const [newTask, setNewTask] = useState({ project_id: '', name: '', description: '', assignee_id: '', status: 'To Do', due_date: '' });
    const [newTimesheet, setNewTimesheet] = useState({ task_id: '', hours: 0, date: new Date().toISOString().split('T')[0], description: '' });

    useEffect(() => {
        if (currentCompanyId) {
            fetchData();
            fetchEmployees();
        }
    }, [currentCompanyId]);

    const fetchData = async () => {
        setLoading(true);
        const [projRes, taskRes, timeRes] = await Promise.all([
            supabase.from('pm_projects').select('*').eq('company_id', currentCompanyId).order('created_at', { ascending: false }),
            supabase.from('pm_tasks').select('*, pm_projects(name), employees(first_name, last_name)').eq('company_id', currentCompanyId),
            supabase.from('pm_timesheets').select('*, pm_tasks(name, pm_projects(name)), employees(first_name, last_name)').eq('company_id', currentCompanyId).order('date', { ascending: false })
        ]);
        if (projRes.data) setProjects(projRes.data);
        if (taskRes.data) setTasks(taskRes.data);
        if (timeRes.data) setTimesheets(timeRes.data);
        setLoading(false);
    };

    const fetchEmployees = async () => {
        const { data } = await supabase.from('employees').select('id, first_name, last_name').eq('company_id', currentCompanyId).eq('status', 'Active');
        if (data) setEmployees(data);
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('pm_projects').insert([{ ...newProject, company_id: currentCompanyId }]);
        if (error) alert("Error creating project: " + error.message);
        else {
            setShowProjectModal(false);
            setNewProject({ name: '', description: '', status: 'Planning', budget: 0, start_date: '', end_date: '' });
            fetchData();
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('pm_tasks').insert([{ ...newTask, company_id: currentCompanyId, assignee_id: newTask.assignee_id || null }]);
        if (error) alert("Error creating task: " + error.message);
        else {
            setShowTaskModal(false);
            setNewTask({ project_id: '', name: '', description: '', assignee_id: '', status: 'To Do', due_date: '' });
            fetchData();
        }
    };

    const handleCreateTimesheet = async (e: React.FormEvent) => {
        e.preventDefault();
        const empId = (await supabase.auth.getUser()).data.user?.id; // Mock using current user profile ID or actual employee_id
        // We will just pick the first employee for the demo if empId doesn't map directly. 
        const actualEmpId = employees.length > 0 ? employees[0].id : null; 

        const { error } = await supabase.from('pm_timesheets').insert([{ 
            ...newTimesheet, 
            company_id: currentCompanyId, 
            employee_id: actualEmpId // Should be dynamically resolved via context
        }]);
        if (error) alert("Error saving timesheet: " + error.message);
        else {
            setShowTimesheetModal(false);
            setNewTimesheet({ task_id: '', hours: 0, date: new Date().toISOString().split('T')[0], description: '' });
            fetchData();
        }
    };

    const updateTaskStatus = async (taskId: string, currentStatus: string) => {
        const nextStatus = currentStatus === 'To Do' ? 'In Progress' : currentStatus === 'In Progress' ? 'Done' : 'To Do';
        await supabase.from('pm_tasks').update({ status: nextStatus, progress_pct: nextStatus === 'Done' ? 100 : nextStatus === 'In Progress' ? 50 : 0 }).eq('id', taskId);
        fetchData();
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950 animate-page-enter">
            {/* Header */}
            <div className="px-8 py-6 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                    <Briefcase className="w-7 h-7 text-indigo-600" />
                    Project Management
                </h1>
                <div className="flex gap-2">
                    {[
                        { id: 'OVERVIEW', label: 'Dashboard', icon: LayoutDashboard },
                        { id: 'PROJECTS', label: 'Projects', icon: Briefcase },
                        { id: 'TASKS', label: 'Tasks & Boards', icon: CheckSquare },
                        { id: 'TIMESHEETS', label: 'Timesheets', icon: Clock },
                        { id: 'ANALYTICS', label: 'Analytics', icon: BarChart3 },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm transition-all ${
                                activeTab === tab.id 
                                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-8 overflow-y-auto">
                {activeTab === 'OVERVIEW' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-300">Active Projects</h3>
                                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/20 rounded-full flex items-center justify-center">
                                    <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-black text-slate-800 dark:text-white">{projects.filter(p => p.status !== 'Completed').length}</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-300">Pending Tasks</h3>
                                <div className="w-10 h-10 bg-rose-50 dark:bg-rose-500/20 rounded-full flex items-center justify-center">
                                    <CheckSquare className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-black text-slate-800 dark:text-white">{tasks.filter(t => t.status !== 'Done').length}</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-300">Total Hours Logged</h3>
                                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-black text-slate-800 dark:text-white">{timesheets.reduce((s, t) => s + Number(t.hours), 0).toFixed(1)} hrs</p>
                        </div>
                    </div>
                )}

                {activeTab === 'PROJECTS' && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            <button onClick={() => setShowProjectModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-sm">
                                <Plus className="w-5 h-5" /> New Project
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projects.map(p => (
                                <div key={p.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">{p.name}</h3>
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${p.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : p.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {p.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2">{p.description}</p>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Budget: <strong className="text-slate-700 dark:text-slate-300">${Number(p.budget).toLocaleString()}</strong></span>
                                        <span className="text-slate-500">Due: <strong className="text-slate-700 dark:text-slate-300">{p.end_date ? new Date(p.end_date).toLocaleDateString() : 'N/A'}</strong></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'TASKS' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div className="relative w-72">
                                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input type="text" placeholder="Search tasks..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl" />
                            </div>
                            <button onClick={() => setShowTaskModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-sm">
                                <Plus className="w-5 h-5" /> New Task
                            </button>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                                    <tr>
                                        <th className="px-6 py-4">Task Name</th>
                                        <th className="px-6 py-4">Project</th>
                                        <th className="px-6 py-4">Assignee</th>
                                        <th className="px-6 py-4">Due Date</th>
                                        <th className="px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                    {tasks.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/20">
                                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{t.name}</td>
                                            <td className="px-6 py-4 text-slate-500">{t.pm_projects?.name}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {t.employees ? `${t.employees.first_name} ${t.employees.last_name}` : 'Unassigned'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{t.due_date ? new Date(t.due_date).toLocaleDateString() : '-'}</td>
                                            <td className="px-6 py-4 cursor-pointer" onClick={() => updateTaskStatus(t.id, t.status)}>
                                                <div className="flex items-center gap-2">
                                                    {t.status === 'Done' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-slate-300" />}
                                                    <span className={`font-bold ${t.status === 'Done' ? 'text-emerald-600' : t.status === 'In Progress' ? 'text-blue-600' : 'text-slate-500'}`}>{t.status}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'TIMESHEETS' && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            <button onClick={() => setShowTimesheetModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-sm">
                                <Plus className="w-5 h-5" /> Log Hours
                            </button>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                                    <tr>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Employee</th>
                                        <th className="px-6 py-4">Project - Task</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4 text-right">Hours</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                    {timesheets.map(ts => (
                                        <tr key={ts.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/20">
                                            <td className="px-6 py-4 text-slate-600 font-medium">{new Date(ts.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-slate-800 dark:text-slate-200 font-bold">{ts.employees ? `${ts.employees.first_name} ${ts.employees.last_name}` : '-'}</td>
                                            <td className="px-6 py-4 text-slate-500">{ts.pm_tasks?.pm_projects?.name} - {ts.pm_tasks?.name}</td>
                                            <td className="px-6 py-4 text-slate-500">{ts.description}</td>
                                            <td className="px-6 py-4 text-right font-black text-indigo-600 dark:text-indigo-400">{Number(ts.hours).toFixed(1)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'ANALYTICS' && (
                    <div className="space-y-8">
                        {/* Resource Utilization */}
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-500" /> Resource Utilization
                            </h3>
                            <div className="space-y-4">
                                {(() => {
                                    // Aggregate hours per employee across all projects
                                    const empHours: Record<string, { name: string; hours: number; taskCount: number }> = {};
                                    timesheets.forEach(ts => {
                                        const empName = ts.employees ? `${ts.employees.first_name} ${ts.employees.last_name}` : 'Unknown';
                                        const empId = ts.employee_id || 'unknown';
                                        if (!empHours[empId]) empHours[empId] = { name: empName, hours: 0, taskCount: 0 };
                                        empHours[empId].hours += Number(ts.hours);
                                        empHours[empId].taskCount += 1;
                                    });
                                    const maxHours = Math.max(...Object.values(empHours).map(e => e.hours), 1);
                                    return Object.entries(empHours).sort((a, b) => b[1].hours - a[1].hours).map(([id, emp]) => (
                                        <div key={id} className="flex items-center gap-4">
                                            <div className="w-40 text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{emp.name}</div>
                                            <div className="flex-1 bg-slate-100 dark:bg-zinc-800 rounded-full h-6 overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                                                    style={{ width: `${(emp.hours / maxHours) * 100}%`, minWidth: '40px' }}
                                                >
                                                    <span className="text-[10px] font-bold text-white">{emp.hours.toFixed(1)}h</span>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 w-20 text-right">{emp.taskCount} entries</span>
                                        </div>
                                    ));
                                })()}
                                {timesheets.length === 0 && (
                                    <p className="text-center text-slate-400 py-8">No timesheet data yet. Log hours to see utilization.</p>
                                )}
                            </div>
                        </div>

                        {/* Budget vs Actual */}
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-emerald-500" /> Budget vs Actual Cost
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3">Project</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3 text-right">Budget</th>
                                            <th className="px-6 py-3 text-right">Hours Logged</th>
                                            <th className="px-6 py-3 text-right">Est. Cost (@ $50/hr)</th>
                                            <th className="px-6 py-3 text-right">Variance</th>
                                            <th className="px-6 py-3">Utilization</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {projects.map(p => {
                                            const projectTasks = tasks.filter(t => t.project_id === p.id);
                                            const taskIds = projectTasks.map(t => t.id);
                                            const projectHours = timesheets.filter(ts => taskIds.includes(ts.task_id)).reduce((s, ts) => s + Number(ts.hours), 0);
                                            const estCost = projectHours * 50; // $50/hr rate placeholder
                                            const budget = Number(p.budget) || 0;
                                            const variance = budget - estCost;
                                            const utilPct = budget > 0 ? Math.min((estCost / budget) * 100, 100) : 0;
                                            return (
                                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/20">
                                                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{p.name}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 text-[10px] font-bold rounded ${p.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : p.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {p.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono">${budget.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-indigo-600">{projectHours.toFixed(1)}h</td>
                                                    <td className="px-6 py-4 text-right font-mono">${estCost.toLocaleString()}</td>
                                                    <td className={`px-6 py-4 text-right font-mono font-bold ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {variance >= 0 ? '+' : ''}{variance.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 bg-slate-100 dark:bg-zinc-800 rounded-full h-2 w-24">
                                                                <div className={`h-full rounded-full ${utilPct > 90 ? 'bg-rose-500' : utilPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${utilPct}%` }} />
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-500">{utilPct.toFixed(0)}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showProjectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <form onSubmit={handleCreateProject} className="bg-white dark:bg-zinc-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl space-y-4">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Create Project</h3>
                        <input type="text" placeholder="Project Name" required value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <textarea placeholder="Description" rows={3} value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <div className="grid grid-cols-2 gap-4">
                            <input type="number" placeholder="Budget ($)" value={newProject.budget} onChange={e => setNewProject({...newProject, budget: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                            <select value={newProject.status} onChange={e => setNewProject({...newProject, status: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                                <option value="Planning">Planning</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 ml-1">Start Date</label><input type="date" value={newProject.start_date} onChange={e => setNewProject({...newProject, start_date: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 mt-1" /></div>
                            <div><label className="text-xs font-bold text-slate-500 ml-1">End Date</label><input type="date" value={newProject.end_date} onChange={e => setNewProject({...newProject, end_date: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 mt-1" /></div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowProjectModal(false)} className="px-5 py-2 font-bold text-slate-500">Cancel</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Save</button></div>
                    </form>
                </div>
            )}

            {showTaskModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <form onSubmit={handleCreateTask} className="bg-white dark:bg-zinc-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl space-y-4">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Create Task</h3>
                        <select required value={newTask.project_id} onChange={e => setNewTask({...newTask, project_id: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                            <option value="">Select Project</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input type="text" placeholder="Task Name" required value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <select value={newTask.assignee_id} onChange={e => setNewTask({...newTask, assignee_id: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                            <option value="">Unassigned</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                        </select>
                        <input type="date" value={newTask.due_date} onChange={e => setNewTask({...newTask, due_date: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowTaskModal(false)} className="px-5 py-2 font-bold text-slate-500">Cancel</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Save</button></div>
                    </form>
                </div>
            )}

            {showTimesheetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <form onSubmit={handleCreateTimesheet} className="bg-white dark:bg-zinc-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl space-y-4">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Log Hours</h3>
                        <select required value={newTimesheet.task_id} onChange={e => setNewTimesheet({...newTimesheet, task_id: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                            <option value="">Select Task</option>
                            {tasks.map(t => <option key={t.id} value={t.id}>{t.pm_projects?.name} - {t.name}</option>)}
                        </select>
                        <input type="date" required value={newTimesheet.date} onChange={e => setNewTimesheet({...newTimesheet, date: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <input type="number" step="0.5" placeholder="Hours" required value={newTimesheet.hours || ''} onChange={e => setNewTimesheet({...newTimesheet, hours: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <textarea placeholder="Description" rows={2} value={newTimesheet.description} onChange={e => setNewTimesheet({...newTimesheet, description: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowTimesheetModal(false)} className="px-5 py-2 font-bold text-slate-500">Cancel</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Save</button></div>
                    </form>
                </div>
            )}
        </div>
    );
};
