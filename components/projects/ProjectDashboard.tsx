import React, { useMemo } from 'react';
import { 
    Briefcase, CheckCircle2, Clock, AlertTriangle, TrendingUp, DollarSign, 
    FileText, ShieldAlert, CheckSquare, Users, Building2, Calendar, Award 
} from 'lucide-react';

interface ProjectDashboardProps {
    projects: any[];
    proposals: any[];
    activities?: any[];
    issues?: any[];
    risks?: any[];
    onSelectProject?: (proj: any) => void;
    onNewProject?: () => void;
    onNewProposal?: (type: 'TECHNICAL' | 'COMMERCIAL') => void;
    onNewTechnicalProposal?: () => void;
    onNewCommercialProposal?: () => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
    projects = [],
    proposals = [],
    onSelectProject,
    onNewProject,
    onNewProposal,
    onNewTechnicalProposal,
    onNewCommercialProposal
}) => {
    // Metrics Calculations
    const metrics = useMemo(() => {
        const total = projects.length;
        const draft = projects.filter(p => p.status === 'DRAFT').length;
        const pendingApproval = projects.filter(p => p.status === 'PENDING_PROJECT_HEAD_APPROVAL').length;
        const approved = projects.filter(p => p.status === 'APPROVED' || p.status === 'SUPERVISOR_ASSIGNED').length;
        const inProgress = projects.filter(p => p.status === 'IN_PROGRESS').length;
        const onHold = projects.filter(p => p.status === 'ON_HOLD').length;
        const completionRequested = projects.filter(p => p.status === 'COMPLETION_REQUESTED' || p.status === 'COMPLETION_REVIEW').length;
        const completed = projects.filter(p => p.status === 'COMPLETED' || p.status === 'CLOSED').length;

        const totalValue = projects.reduce((acc, p) => acc + (Number(p.lpo_cost || p.budget) || 0), 0);
        const activeValue = projects
            .filter(p => p.status === 'IN_PROGRESS' || p.status === 'APPROVED' || p.status === 'SUPERVISOR_ASSIGNED')
            .reduce((acc, p) => acc + (Number(p.lpo_cost || p.budget) || 0), 0);

        const avgProgress = total > 0 
            ? Math.round(projects.reduce((acc, p) => acc + (Number(p.completion_pct) || 0), 0) / total) 
            : 0;

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const dueThisMonth = projects.filter(p => {
            if (!p.end_date) return false;
            const d = new Date(p.end_date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear && p.status !== 'COMPLETED';
        }).length;

        const overdue = projects.filter(p => {
            if (!p.end_date || p.status === 'COMPLETED' || p.status === 'CLOSED') return false;
            return new Date(p.end_date) < today;
        }).length;

        // Proposals metrics
        const techProps = proposals.filter(p => p.proposal_type === 'TECHNICAL');
        const commProps = proposals.filter(p => p.proposal_type === 'COMMERCIAL');
        const pendingTech = techProps.filter(p => p.status.startsWith('PENDING')).length;
        const pendingComm = commProps.filter(p => p.status.startsWith('PENDING')).length;
        const approvedTech = techProps.filter(p => p.status === 'APPROVED').length;
        const approvedComm = commProps.filter(p => p.status === 'APPROVED').length;

        // Issues & Risks across projects
        let totalIssues = 0;
        let openIssues = 0;
        let totalRisks = 0;
        let openRisks = 0;

        projects.forEach(p => {
            if (p.issues) {
                totalIssues += p.issues.length;
                openIssues += p.issues.filter((i: any) => i.status === 'OPEN' || i.status === 'IN_PROGRESS').length;
            }
            if (p.risks) {
                totalRisks += p.risks.length;
                openRisks += p.risks.filter((r: any) => r.status === 'OPEN').length;
            }
        });

        return {
            total,
            draft,
            pendingApproval,
            approved,
            inProgress,
            onHold,
            completionRequested,
            completed,
            totalValue,
            activeValue,
            avgProgress,
            dueThisMonth,
            overdue,
            techPropsCount: techProps.length,
            commPropsCount: commProps.length,
            pendingTech,
            pendingComm,
            approvedTech,
            approvedComm,
            openIssues,
            openRisks
        };
    }, [projects, proposals]);

    // Status breakdown data for progress bars
    const statusCounts = [
        { label: 'In Progress', count: metrics.inProgress, color: 'bg-blue-600', text: 'text-blue-600 dark:text-blue-400' },
        { label: 'Pending Approval', count: metrics.pendingApproval, color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
        { label: 'Completed', count: metrics.completed, color: 'bg-emerald-600', text: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Completion Review', count: metrics.completionRequested, color: 'bg-purple-600', text: 'text-purple-600 dark:text-purple-400' },
        { label: 'Draft', count: metrics.draft, color: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Top Stat Banners */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Project Value</span>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1 font-mono">
                                QAR {metrics.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span>QAR {metrics.activeValue.toLocaleString('en-US', { minimumFractionDigits: 0 })} in active execution</span>
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Projects</span>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1 font-mono">
                                {metrics.inProgress} <span className="text-xs font-bold text-slate-400">/ {metrics.total} total</span>
                            </h3>
                            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                                <Briefcase className="w-3.5 h-3.5" />
                                <span>{metrics.approved} ready for supervisor</span>
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                            <Briefcase className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Progress</span>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1 font-mono">
                                {metrics.avgProgress}%
                            </h3>
                            <div className="w-36 bg-slate-100 dark:bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
                                <div 
                                    className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${Math.min(metrics.avgProgress, 100)}%` }} 
                                />
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Risks & Issues</span>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1 font-mono">
                                {metrics.openIssues} Issues <span className="text-sm font-normal text-slate-400">/ {metrics.openRisks} Risks</span>
                            </h3>
                            <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${metrics.overdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>{metrics.overdue} Overdue projects</span>
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Proposal Lifecycle & Project Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Proposal Overview */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-extrabold text-base text-slate-800 dark:text-white">Proposals Control</h3>
                            <p className="text-xs text-slate-400 mt-0.5">External registration & review workflow</p>
                        </div>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => {
                                    if (onNewProposal) onNewProposal('TECHNICAL');
                                    else if (onNewTechnicalProposal) onNewTechnicalProposal();
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg hover:bg-blue-100"
                            >
                                + Tech
                            </button>
                            <button
                                onClick={() => {
                                    if (onNewProposal) onNewProposal('COMMERCIAL');
                                    else if (onNewCommercialProposal) onNewCommercialProposal();
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-lg hover:bg-emerald-100"
                            >
                                + Comm
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Technical Proposals</span>
                                <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-md">
                                    {metrics.techPropsCount} Total
                                </span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>Pending: <strong className="text-amber-600">{metrics.pendingTech}</strong></span>
                                <span>Approved: <strong className="text-emerald-600">{metrics.approvedTech}</strong></span>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Commercial Proposals</span>
                                <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-md">
                                    {metrics.commPropsCount} Total
                                </span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>Pending: <strong className="text-amber-600">{metrics.pendingComm}</strong></span>
                                <span>Approved: <strong className="text-emerald-600">{metrics.approvedComm}</strong></span>
                            </div>
                        </div>

                        <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100/50 dark:border-blue-900/30 text-[11px] text-blue-700 dark:text-blue-300">
                            💡 Proposal preparation is external. KAA ERP manages document locking, multi-level review, and audit revisions.
                        </div>
                    </div>
                </div>

                {/* Project Lifecycle Status Breakdown */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-sm lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-extrabold text-base text-slate-800 dark:text-white">Project Pipeline Breakdown</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Live distribution by execution lifecycle phase</p>
                        </div>
                        {onNewProject && (
                            <button
                                onClick={onNewProject}
                                className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all"
                            >
                                + New Project
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                        {statusCounts.map((s, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-100 dark:border-zinc-800 text-center">
                                <span className="text-[11px] font-bold text-slate-400 block truncate">{s.label}</span>
                                <span className={`text-xl font-black ${s.text} font-mono mt-1 block`}>{s.count}</span>
                            </div>
                        ))}
                    </div>

                    {/* Progress distribution bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                            <span>Pipeline Capacity</span>
                            <span>{metrics.completed} Completed / {metrics.total} Projects</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                            {metrics.total > 0 && (
                                <>
                                    <div style={{ width: `${(metrics.inProgress / metrics.total) * 100}%` }} className="bg-blue-600 h-full" title="In Progress" />
                                    <div style={{ width: `${(metrics.pendingApproval / metrics.total) * 100}%` }} className="bg-amber-500 h-full" title="Pending Approval" />
                                    <div style={{ width: `${(metrics.completed / metrics.total) * 100}%` }} className="bg-emerald-600 h-full" title="Completed" />
                                    <div style={{ width: `${(metrics.completionRequested / metrics.total) * 100}%` }} className="bg-purple-600 h-full" title="Completion Review" />
                                    <div style={{ width: `${(metrics.draft / metrics.total) * 100}%` }} className="bg-slate-300 h-full" title="Draft" />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Active & Recent Projects Table Preview */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                    <div>
                        <h3 className="font-extrabold text-base text-slate-800 dark:text-white">Active Projects in Execution</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Projects currently underway with supervisors and daily tracking</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/80 dark:bg-zinc-800/40 text-slate-400 font-bold text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Project Name & Client</th>
                                <th className="px-6 py-4">Manager & Supervisors</th>
                                <th className="px-6 py-4">LPO Cost</th>
                                <th className="px-6 py-4">Timeline</th>
                                <th className="px-6 py-4">Progress</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {projects.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                        <Briefcase className="w-10 h-10 mx-auto opacity-30 mb-2" />
                                        <p className="font-bold text-sm">No projects registered yet.</p>
                                        <p className="text-xs mt-1">Create a new project after proposal approval.</p>
                                    </td>
                                </tr>
                            ) : (
                                projects.slice(0, 6).map((proj) => (
                                    <tr 
                                        key={proj.id} 
                                        onClick={() => onSelectProject && onSelectProject(proj)}
                                        className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-800 dark:text-white">{proj.name}</p>
                                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                <Building2 className="w-3 h-3" />
                                                {proj.client?.name || 'Client Not Specified'}
                                                {proj.lpo_number && <span className="font-mono ml-1">[{proj.lpo_number}]</span>}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {proj.manager?.name || 'Unassigned'}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {proj.supervisors?.filter((s: any) => s.is_active).length || 0} active supervisor(s)
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-bold text-xs text-slate-800 dark:text-white">
                                            QAR {Number(proj.lpo_cost || proj.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500">
                                            <div>{proj.start_date || '—'}</div>
                                            <div className="text-[11px] text-slate-400">to {proj.end_date || '—'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-20 bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                                    <div 
                                                        className="bg-blue-600 h-full rounded-full" 
                                                        style={{ width: `${Math.min(proj.completion_pct || 0, 100)}%` }} 
                                                    />
                                                </div>
                                                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                                    {proj.completion_pct || 0}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                proj.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                                proj.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                                                proj.status === 'PENDING_PROJECT_HEAD_APPROVAL' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                                proj.status === 'COMPLETION_REQUESTED' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                                                'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300'
                                            }`}>
                                                {proj.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button className="text-xs font-bold text-blue-600 hover:text-blue-800">
                                                View →
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
