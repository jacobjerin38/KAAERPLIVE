import React, { useState, useMemo } from 'react';
import { 
    Briefcase, Plus, Search, Building2, Calendar, User, ArrowRight, 
    Lock, CheckCircle2, Clock, AlertTriangle, ShieldAlert, FileText, Layers 
} from 'lucide-react';

interface ProjectsListProps {
    projects: any[];
    loading: boolean;
    onSelectProject: (proj: any) => void;
    onNewProject: () => void;
    onRefresh: () => void;
}

export const ProjectsList: React.FC<ProjectsListProps> = ({
    projects,
    loading,
    onSelectProject,
    onNewProject,
    onRefresh
}) => {
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            // Status filter
            if (statusFilter !== 'ALL') {
                if (statusFilter === 'IN_PROGRESS' && p.status !== 'IN_PROGRESS' && p.status !== 'APPROVED' && p.status !== 'SUPERVISOR_ASSIGNED') return false;
                if (statusFilter === 'PENDING_APPROVAL' && p.status !== 'PENDING_PROJECT_HEAD_APPROVAL') return false;
                if (statusFilter === 'COMPLETED' && p.status !== 'COMPLETED' && p.status !== 'CLOSED') return false;
                if (statusFilter === 'COMPLETION_REQUESTED' && p.status !== 'COMPLETION_REQUESTED' && p.status !== 'COMPLETION_REVIEW') return false;
                if (statusFilter === 'DRAFT' && p.status !== 'DRAFT') return false;
            }

            // Search filter
            if (searchTerm.trim()) {
                const s = searchTerm.toLowerCase();
                const matchName = p.name?.toLowerCase().includes(s);
                const matchClient = p.client?.name?.toLowerCase().includes(s);
                const matchLpo = p.lpo_number?.toLowerCase().includes(s);
                const matchManager = p.manager?.name?.toLowerCase().includes(s);
                if (!matchName && !matchClient && !matchLpo && !matchManager) return false;
            }

            return true;
        });
    }, [projects, statusFilter, searchTerm]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <Lock className="w-3 h-3" /> Completed & Locked
                    </span>
                );
            case 'IN_PROGRESS':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        <Clock className="w-3 h-3" /> In Progress
                    </span>
                );
            case 'PENDING_PROJECT_HEAD_APPROVAL':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <Clock className="w-3 h-3" /> Pending Head Approval
                    </span>
                );
            case 'APPROVED':
            case 'SUPERVISOR_ASSIGNED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <CheckCircle2 className="w-3 h-3" /> Ready for Execution
                    </span>
                );
            case 'COMPLETION_REQUESTED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        <Clock className="w-3 h-3" /> Completion Review
                    </span>
                );
            case 'CORRECTION_REQUIRED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                        <AlertTriangle className="w-3 h-3" /> Correction Required
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300">
                        {status.replace(/_/g, ' ')}
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Project Registry & Execution</h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Track mandatory document compliance, supervisor assignments, daily execution logs, and project completion.
                    </p>
                </div>
                <button
                    onClick={onNewProject}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                    <Plus className="w-4 h-4" />
                    <span>Create New Project</span>
                </button>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                {/* Search */}
                <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search by project name, client, LPO number, manager..."
                        className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-white"
                    />
                </div>

                {/* Status Tabs */}
                <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl w-full md:w-auto overflow-x-auto">
                    {[
                        { id: 'ALL', label: 'All' },
                        { id: 'IN_PROGRESS', label: 'In Progress' },
                        { id: 'PENDING_APPROVAL', label: 'Pending Approval' },
                        { id: 'COMPLETION_REQUESTED', label: 'Completion Review' },
                        { id: 'COMPLETED', label: 'Completed' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setStatusFilter(tab.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                statusFilter === tab.id
                                    ? 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/80 dark:bg-zinc-800/40 text-slate-400 font-bold text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Project Name & Client</th>
                                <th className="px-6 py-4">LPO # & Value</th>
                                <th className="px-6 py-4">Manager & Team</th>
                                <th className="px-6 py-4">Schedule</th>
                                <th className="px-6 py-4">Mandatory Docs</th>
                                <th className="px-6 py-4">Progress</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {filteredProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                                        <Briefcase className="w-12 h-12 mx-auto opacity-30 mb-2" />
                                        <p className="font-bold text-base text-slate-700 dark:text-slate-300">No Projects Found</p>
                                        <p className="text-xs mt-1">Create a new project with LPO and mandatory execution documents.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProjects.map((proj) => {
                                    const docsConfirmed = (proj.documents || []).filter((d: any) => d.confirmed).length;
                                    const activeSupervisors = (proj.supervisors || []).filter((s: any) => s.is_active).length;

                                    return (
                                        <tr
                                            key={proj.id}
                                            onClick={() => onSelectProject(proj)}
                                            className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-800 dark:text-white">{proj.name}</p>
                                                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                    <Building2 className="w-3 h-3" />
                                                    {proj.client?.name || 'No Client Linked'}
                                                </p>
                                            </td>

                                            <td className="px-6 py-4">
                                                <p className="font-mono font-bold text-xs text-slate-800 dark:text-white">
                                                    QAR {Number(proj.lpo_cost || proj.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </p>
                                                <p className="text-[11px] font-mono text-slate-400">
                                                    LPO: {proj.lpo_number || '—'}
                                                </p>
                                            </td>

                                            <td className="px-6 py-4 text-xs">
                                                <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                                    {proj.manager?.name || 'Unassigned'}
                                                </p>
                                                <p className="text-[11px] text-slate-400">
                                                    {activeSupervisors} supervisor(s)
                                                </p>
                                            </td>

                                            <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                                                <div>{proj.start_date || '—'}</div>
                                                <div className="text-[11px] text-slate-400">to {proj.end_date || '—'}</div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                                    docsConfirmed >= 6
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                }`}>
                                                    <FileText className="w-3 h-3" />
                                                    {docsConfirmed}/6 Confirmed
                                                </span>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
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
                                                {getStatusBadge(proj.status)}
                                            </td>

                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectProject(proj);
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1"
                                                >
                                                    <span>Open Workspace</span>
                                                    <ArrowRight className="w-3 h-3" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
