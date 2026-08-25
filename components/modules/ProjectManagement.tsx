import React, { useState, useEffect, useCallback } from 'react';
import { 
    Briefcase, LayoutDashboard, FileText, CheckSquare, Clock, AlertTriangle, 
    ShieldCheck, Plus, RefreshCw, BarChart3, Users, DollarSign, ArrowRight, 
    Search, CheckCircle2, Circle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { fetchProjectHubData } from '../projects/projectService';
import { ProjectDashboard } from '../projects/ProjectDashboard';
import { ProposalsList } from '../projects/ProposalsList';
import { ProposalFormModal } from '../projects/ProposalFormModal';
import { ProposalDetailModal } from '../projects/ProposalDetailModal';
import { ProjectsList } from '../projects/ProjectsList';
import { ProjectFormModal } from '../projects/ProjectFormModal';
import { ProjectDetailView } from '../projects/ProjectDetailView';
import { DailyActivityModal } from '../projects/DailyActivityModal';

export const ProjectManagement: React.FC = () => {
    const { currentCompanyId, user } = useAuth();
    
    // Top-Level Hub Tabs
    const [activeTab, setActiveTab] = useState<
        'DASHBOARD' | 'PROPOSALS' | 'PROJECTS' | 'DAILY_ACTIVITIES' | 'ISSUES_RISKS' | 'TASKS_TIMESHEETS'
    >('DASHBOARD');

    // Hub State
    const [loading, setLoading] = useState(true);
    const [hubData, setHubData] = useState<{
        proposals: any[];
        projects: any[];
        activities: any[];
        issues: any[];
        risks: any[];
        clients: any[];
        deals: any[];
        employees: any[];
    }>({
        proposals: [],
        projects: [],
        activities: [],
        issues: [],
        risks: [],
        clients: [],
        deals: [],
        employees: []
    });

    // Selected items
    const [selectedProposal, setSelectedProposal] = useState<any | null>(null);
    const [selectedProject, setSelectedProject] = useState<any | null>(null);

    // Modals
    const [showProposalModal, setShowProposalModal] = useState<boolean>(false);
    const [proposalModalType, setProposalModalType] = useState<'TECHNICAL' | 'COMMERCIAL'>('TECHNICAL');
    const [showProjectModal, setShowProjectModal] = useState<boolean>(false);

    // Global Daily Activity Modal
    const [showDailyActivityModal, setShowDailyActivityModal] = useState<boolean>(false);
    const [activityModalProject, setActivityModalProject] = useState<any | null>(null);
    const [selectedActivity, setSelectedActivity] = useState<any | null>(null);

    // Legacy Tasks & Timesheets State
    const [legacyTasks, setLegacyTasks] = useState<any[]>([]);
    const [legacyTimesheets, setLegacyTimesheets] = useState<any[]>([]);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showTimesheetModal, setShowTimesheetModal] = useState(false);
    const [newTask, setNewTask] = useState({ project_id: '', name: '', description: '', assignee_id: '', status: 'To Do', due_date: '' });
    const [newTimesheet, setNewTimesheet] = useState({ task_id: '', hours: 0, date: new Date().toISOString().split('T')[0], description: '' });

    const loadAllData = useCallback(async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            const data = await fetchProjectHubData(currentCompanyId);
            setHubData(data);

            // Fetch legacy tasks & timesheets in parallel
            const [taskRes, timeRes] = await Promise.all([
                supabase.from('pm_tasks').select('*, pm_projects(name), employees(name)').eq('company_id', currentCompanyId),
                supabase.from('pm_timesheets').select('*, pm_tasks(name, pm_projects(name)), employees(name)').eq('company_id', currentCompanyId).order('date', { ascending: false })
            ]);
            if (taskRes.data) setLegacyTasks(taskRes.data);
            if (timeRes.data) setLegacyTimesheets(timeRes.data);

            // If a project is currently open in detail view, refresh its reference
            if (selectedProject) {
                const refreshedProj = data.projects.find(p => p.id === selectedProject.id);
                if (refreshedProj) setSelectedProject(refreshedProj);
            }

            // If a proposal is currently open, refresh its reference
            if (selectedProposal) {
                const refreshedProp = data.proposals.find(p => p.id === selectedProposal.id);
                if (refreshedProp) setSelectedProposal(refreshedProp);
            }
        } catch (err) {
            console.error('Error loading project hub data:', err);
        } finally {
            setLoading(false);
        }
    }, [currentCompanyId, selectedProject?.id, selectedProposal?.id]);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    // Legacy Task Handlers
    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('pm_tasks').insert([{ ...newTask, company_id: currentCompanyId, assignee_id: newTask.assignee_id || null }]);
        if (error) alert("Error creating task: " + error.message);
        else {
            setShowTaskModal(false);
            setNewTask({ project_id: '', name: '', description: '', assignee_id: '', status: 'To Do', due_date: '' });
            loadAllData();
        }
    };

    const handleCreateTimesheet = async (e: React.FormEvent) => {
        e.preventDefault();
        const actualEmpId = hubData.employees.length > 0 ? hubData.employees[0].id : null; 
        const { error } = await supabase.from('pm_timesheets').insert([{ 
            ...newTimesheet, 
            company_id: currentCompanyId, 
            employee_id: actualEmpId 
        }]);
        if (error) alert("Error saving timesheet: " + error.message);
        else {
            setShowTimesheetModal(false);
            setNewTimesheet({ task_id: '', hours: 0, date: new Date().toISOString().split('T')[0], description: '' });
            loadAllData();
        }
    };

    const updateTaskStatus = async (taskId: string, currentStatus: string) => {
        const nextStatus = currentStatus === 'To Do' ? 'In Progress' : currentStatus === 'In Progress' ? 'Done' : 'To Do';
        await supabase.from('pm_tasks').update({ status: nextStatus, progress_pct: nextStatus === 'Done' ? 100 : nextStatus === 'In Progress' ? 50 : 0 }).eq('id', taskId);
        loadAllData();
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950 animate-page-enter">
            {/* Header / Global Navigation */}
            <div className="px-8 py-6 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center font-bold">
                            <Briefcase className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                                Project Management & Governance Hub
                            </h1>
                            <p className="text-xs text-slate-400 font-bold">
                                Enterprise Proposal Controls • Document Gateways • Site Execution & Verification
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadAllData}
                            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Primary Hub Navigation Tabs */}
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pt-2">
                    {[
                        { id: 'DASHBOARD', label: 'Executive Dashboard', icon: LayoutDashboard },
                        { id: 'PROPOSALS', label: `Proposals (${hubData.proposals.length})`, icon: FileText },
                        { id: 'PROJECTS', label: `Projects Registry (${hubData.projects.length})`, icon: Briefcase },
                        { id: 'DAILY_ACTIVITIES', label: `Site Activity Feed (${hubData.activities.length})`, icon: ShieldCheck },
                        { id: 'ISSUES_RISKS', label: `Issues & Risks (${hubData.issues.length + hubData.risks.length})`, icon: AlertTriangle },
                        { id: 'TASKS_TIMESHEETS', label: 'Tasks & Timesheets', icon: CheckSquare },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setSelectedProject(null);
                                setActiveTab(tab.id as any);
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
                                activeTab === tab.id && !selectedProject
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Workspace */}
            <div className="flex-1 p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                {/* 1. Project Detail View (Master-Detail Drilldown) */}
                {selectedProject ? (
                    <ProjectDetailView
                        project={selectedProject}
                        employees={hubData.employees}
                        onBack={() => setSelectedProject(null)}
                        onRefresh={loadAllData}
                    />
                ) : (
                    <>
                        {/* 2. TAB: DASHBOARD */}
                        {activeTab === 'DASHBOARD' && (
                            <ProjectDashboard
                                projects={hubData.projects}
                                proposals={hubData.proposals}
                                activities={hubData.activities}
                                issues={hubData.issues}
                                risks={hubData.risks}
                                onSelectProject={(p) => setSelectedProject(p)}
                                onNewProject={() => setShowProjectModal(true)}
                                onNewTechnicalProposal={() => {
                                    setProposalModalType('TECHNICAL');
                                    setShowProposalModal(true);
                                }}
                                onNewCommercialProposal={() => {
                                    setProposalModalType('COMMERCIAL');
                                    setShowProposalModal(true);
                                }}
                            />
                        )}

                        {/* 3. TAB: PROPOSALS */}
                        {activeTab === 'PROPOSALS' && (
                            <ProposalsList
                                proposals={hubData.proposals}
                                loading={loading}
                                onSelectProposal={(p) => setSelectedProposal(p)}
                                onNewTechnicalProposal={() => {
                                    setProposalModalType('TECHNICAL');
                                    setShowProposalModal(true);
                                }}
                                onNewCommercialProposal={() => {
                                    setProposalModalType('COMMERCIAL');
                                    setShowProposalModal(true);
                                }}
                                onRefresh={loadAllData}
                            />
                        )}

                        {/* 4. TAB: PROJECTS REGISTRY */}
                        {activeTab === 'PROJECTS' && (
                            <ProjectsList
                                projects={hubData.projects}
                                loading={loading}
                                onSelectProject={(p) => setSelectedProject(p)}
                                onNewProject={() => setShowProjectModal(true)}
                                onRefresh={loadAllData}
                            />
                        )}

                        {/* 5. TAB: DAILY ACTIVITIES FEED */}
                        {activeTab === 'DAILY_ACTIVITIES' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">
                                            Site Execution & Daily Activity Logs
                                        </h2>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Global site activity records across all active projects, manpower counts, and verification statuses.
                                        </p>
                                    </div>
                                </div>

                                <div className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                                    {hubData.activities.length === 0 ? (
                                        <div className="p-16 text-center text-slate-400">
                                            <ShieldCheck className="w-12 h-12 mx-auto opacity-30 mb-2" />
                                            <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No Site Activities Logged</p>
                                            <p className="text-xs mt-1">Open a project workspace to assign supervisors and log daily activities.</p>
                                        </div>
                                    ) : (
                                        hubData.activities.map((act) => {
                                            const proj = hubData.projects.find(p => p.id === act.project_id);
                                            return (
                                                <div
                                                    key={act.id}
                                                    onClick={() => {
                                                        if (proj) {
                                                            setSelectedProject(proj);
                                                        }
                                                    }}
                                                    className="p-5 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors space-y-2"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            <div className="px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg font-mono font-bold text-xs">
                                                                {act.activity_date}
                                                            </div>
                                                            <div>
                                                                <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                                                                    {proj?.name || 'Project'} • {act.work_area}
                                                                </h4>
                                                                <p className="text-[11px] text-slate-400">
                                                                    Supervisor: <strong>{act.supervisor?.name || 'Assigned Staff'}</strong> • Headcount: <strong>{act.worker_count}</strong> • Progress: <strong className="text-blue-600">{act.progress_pct}%</strong>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                                            act.review_status === 'APPROVED'
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400'
                                                        }`}>
                                                            {act.review_status || 'SUBMITTED'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{act.activity_description}</p>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 6. TAB: ISSUES & RISKS CONSOLIDATED */}
                        {activeTab === 'ISSUES_RISKS' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">
                                        Consolidated Issues & Risk Radar
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Live overview of open operational issues, delays, roadblocks, and risk mitigation strategies across all ongoing projects.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Issues */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                            Open Issues Log ({hubData.issues.filter(i => i.status !== 'RESOLVED').length} Active)
                                        </h3>
                                        <div className="space-y-3">
                                            {hubData.issues.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800">
                                                    No issues logged across projects.
                                                </p>
                                            ) : (
                                                hubData.issues.map(iss => {
                                                    const proj = hubData.projects.find(p => p.id === iss.project_id);
                                                    return (
                                                        <div 
                                                            key={iss.id} 
                                                            onClick={() => proj && setSelectedProject(proj)}
                                                            className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-2 cursor-pointer hover:border-blue-500 transition-colors"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-blue-600 uppercase">{proj?.name || 'Project'}</p>
                                                                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">{iss.title}</h4>
                                                                </div>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                    iss.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                                                }`}>
                                                                    {iss.severity}
                                                                </span>
                                                            </div>
                                                            {iss.description && <p className="text-xs text-slate-500 line-clamp-2">{iss.description}</p>}
                                                            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-400">
                                                                <span>Status: <strong>{iss.status}</strong></span>
                                                                <span className="text-blue-600 font-bold">Open Project →</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Risks */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                            Risk Register ({hubData.risks.length} Registered)
                                        </h3>
                                        <div className="space-y-3">
                                            {hubData.risks.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800">
                                                    No risks registered across projects.
                                                </p>
                                            ) : (
                                                hubData.risks.map(r => {
                                                    const proj = hubData.projects.find(p => p.id === r.project_id);
                                                    return (
                                                        <div 
                                                            key={r.id}
                                                            onClick={() => proj && setSelectedProject(proj)}
                                                            className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-2 cursor-pointer hover:border-amber-500 transition-colors"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-blue-600 uppercase">{proj?.name || 'Project'}</p>
                                                                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">{r.title}</h4>
                                                                </div>
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300">
                                                                    Prob: {r.probability} / Sev: {r.severity}
                                                                </span>
                                                            </div>
                                                            {r.mitigation_plan && (
                                                                <p className="text-xs text-slate-500 bg-slate-50 dark:bg-zinc-800/40 p-2.5 rounded-xl">
                                                                    <strong>Mitigation:</strong> {r.mitigation_plan}
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 7. TAB: TASKS & TIMESHEETS (Backward-Compatible) */}
                        {activeTab === 'TASKS_TIMESHEETS' && (
                            <div className="space-y-8 animate-fade-in">
                                {/* Tasks Section */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Execution Tasks & Milestones</h3>
                                        <button
                                            onClick={() => setShowTaskModal(true)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>New Task</span>
                                        </button>
                                    </div>

                                    <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50/80 dark:bg-zinc-800/40 text-slate-400 font-bold uppercase">
                                                <tr>
                                                    <th className="px-6 py-3">Task Name</th>
                                                    <th className="px-6 py-3">Project</th>
                                                    <th className="px-6 py-3">Assignee</th>
                                                    <th className="px-6 py-3">Due Date</th>
                                                    <th className="px-6 py-3">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                {legacyTasks.map(t => (
                                                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{t.name}</td>
                                                        <td className="px-6 py-4 text-slate-500">{t.pm_projects?.name}</td>
                                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{t.employees ? t.employees.name : 'Unassigned'}</td>
                                                        <td className="px-6 py-4 text-slate-500 font-mono">{t.due_date ? new Date(t.due_date).toLocaleDateString() : '-'}</td>
                                                        <td className="px-6 py-4 cursor-pointer" onClick={() => updateTaskStatus(t.id, t.status)}>
                                                            <div className="flex items-center gap-1.5">
                                                                {t.status === 'Done' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
                                                                <span className={`font-bold ${t.status === 'Done' ? 'text-emerald-600' : t.status === 'In Progress' ? 'text-blue-600' : 'text-slate-500'}`}>{t.status}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Timesheets Section */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Logged Timesheets</h3>
                                        <button
                                            onClick={() => setShowTimesheetModal(true)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Log Hours</span>
                                        </button>
                                    </div>

                                    <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50/80 dark:bg-zinc-800/40 text-slate-400 font-bold uppercase">
                                                <tr>
                                                    <th className="px-6 py-3">Date</th>
                                                    <th className="px-6 py-3">Employee</th>
                                                    <th className="px-6 py-3">Project - Task</th>
                                                    <th className="px-6 py-3">Description</th>
                                                    <th className="px-6 py-3 text-right">Hours</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                {legacyTimesheets.map(ts => (
                                                    <tr key={ts.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                                        <td className="px-6 py-4 font-mono text-slate-600">{new Date(ts.date).toLocaleDateString()}</td>
                                                        <td className="px-6 py-4 text-slate-800 dark:text-slate-200 font-bold">{ts.employees ? ts.employees.name : '-'}</td>
                                                        <td className="px-6 py-4 text-slate-500">{ts.pm_tasks?.pm_projects?.name} - {ts.pm_tasks?.name}</td>
                                                        <td className="px-6 py-4 text-slate-500">{ts.description}</td>
                                                        <td className="px-6 py-4 text-right font-black text-blue-600 font-mono">{Number(ts.hours).toFixed(1)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* MODALS */}
            {/* 1. Register Proposal Modal */}
            {showProposalModal && (
                <ProposalFormModal
                    proposalType={proposalModalType}
                    clients={hubData.clients}
                    deals={hubData.deals}
                    employees={hubData.employees}
                    onClose={() => setShowProposalModal(false)}
                    onSuccess={() => {
                        setShowProposalModal(false);
                        loadAllData();
                    }}
                />
            )}

            {/* 2. Proposal Detail Modal */}
            {selectedProposal && (
                <ProposalDetailModal
                    proposal={selectedProposal}
                    employees={hubData.employees}
                    onClose={() => setSelectedProposal(null)}
                    onSuccess={() => {
                        loadAllData();
                    }}
                />
            )}

            {/* 3. Create Project Modal */}
            {showProjectModal && (
                <ProjectFormModal
                    clients={hubData.clients}
                    deals={hubData.deals}
                    employees={hubData.employees}
                    proposals={hubData.proposals}
                    onClose={() => setShowProjectModal(false)}
                    onSuccess={(newProj) => {
                        setShowProjectModal(false);
                        loadAllData();
                        if (newProj) setSelectedProject(newProj);
                    }}
                />
            )}

            {/* 4. Legacy Task Modal */}
            {showTaskModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form onSubmit={handleCreateTask} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 border border-slate-100 dark:border-zinc-800">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create Execution Task</h3>
                        <select required value={newTask.project_id} onChange={e => setNewTask({...newTask, project_id: e.target.value})} className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                            <option value="">— Select Project —</option>
                            {hubData.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input type="text" placeholder="Task Name" required value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <select value={newTask.assignee_id} onChange={e => setNewTask({...newTask, assignee_id: e.target.value})} className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                            <option value="">— Unassigned —</option>
                            {hubData.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <input type="date" value={newTask.due_date} onChange={e => setNewTask({...newTask, due_date: e.target.value})} className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <div className="flex justify-end gap-2 pt-3">
                            <button type="button" onClick={() => setShowTaskModal(false)} className="px-4 py-2 text-xs font-bold text-slate-500">Cancel</button>
                            <button type="submit" className="px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700">Save Task</button>
                        </div>
                    </form>
                </div>
            )}

            {/* 5. Legacy Timesheet Modal */}
            {showTimesheetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form onSubmit={handleCreateTimesheet} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 border border-slate-100 dark:border-zinc-800">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Log Work Hours</h3>
                        <select required value={newTimesheet.task_id} onChange={e => setNewTimesheet({...newTimesheet, task_id: e.target.value})} className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                            <option value="">— Select Task —</option>
                            {legacyTasks.map(t => <option key={t.id} value={t.id}>{t.pm_projects?.name} - {t.name}</option>)}
                        </select>
                        <input type="date" required value={newTimesheet.date} onChange={e => setNewTimesheet({...newTimesheet, date: e.target.value})} className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <input type="number" step="0.5" placeholder="Hours" required value={newTimesheet.hours || ''} onChange={e => setNewTimesheet({...newTimesheet, hours: Number(e.target.value)})} className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <textarea placeholder="Description" rows={2} value={newTimesheet.description} onChange={e => setNewTimesheet({...newTimesheet, description: e.target.value})} className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700" />
                        <div className="flex justify-end gap-2 pt-3">
                            <button type="button" onClick={() => setShowTimesheetModal(false)} className="px-4 py-2 text-xs font-bold text-slate-500">Cancel</button>
                            <button type="submit" className="px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700">Save Hours</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

