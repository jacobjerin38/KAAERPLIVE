import React, { useState, useMemo } from 'react';
import { 
    Printer, Download, FileText, BarChart3, Building2, Calendar, 
    CheckCircle2, Clock, AlertTriangle, ShieldCheck, Filter, Search, 
    Briefcase, DollarSign, Layers, ArrowUpRight, Lock, Eye
} from 'lucide-react';
import { ProjectReportModal } from './ProjectReportModal';

interface ProjectReportsViewProps {
    projects: any[];
    proposals: any[];
    activities: any[];
    issues: any[];
    risks: any[];
    employees: any[];
    clients: any[];
}

type ReportType = 'PORTFOLIO_SUMMARY' | 'PROJECT_DOSSIER' | 'PROPOSALS_REPORT' | 'SITE_ACTIVITIES' | 'HSE_SAFETY';

export const ProjectReportsView: React.FC<ProjectReportsViewProps> = ({
    projects,
    proposals,
    activities,
    issues,
    risks,
    employees,
    clients
}) => {
    const [selectedReport, setSelectedReport] = useState<ReportType>('PORTFOLIO_SUMMARY');
    const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
    const [selectedProjectForModal, setSelectedProjectForModal] = useState<any | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState<string>('');

    const handlePrint = () => {
        window.print();
    };

    // Calculate Portfolio Summary Metrics
    const metrics = useMemo(() => {
        const totalProjects = projects.length;
        const totalContractValue = projects.reduce((acc, p) => acc + (Number(p.lpo_cost || p.budget) || 0), 0);
        const avgProgress = totalProjects > 0
            ? Math.round(projects.reduce((acc, p) => acc + (Number(p.completion_pct) || 0), 0) / totalProjects)
            : 0;
        const activeProjects = projects.filter(p => p.status !== 'COMPLETED' && p.status !== 'REJECTED').length;
        const completedProjects = projects.filter(p => p.status === 'COMPLETED').length;
        const totalProposals = proposals.length;
        const approvedProposals = proposals.filter(p => p.status === 'APPROVED').length;
        const totalActivities = activities.length;
        const openIssues = issues.filter(i => i.status !== 'CLOSED' && i.status !== 'RESOLVED').length;
        const openRisks = risks.filter(r => r.status !== 'CLOSED' && r.status !== 'MITIGATED').length;

        return {
            totalProjects,
            totalContractValue,
            avgProgress,
            activeProjects,
            completedProjects,
            totalProposals,
            approvedProposals,
            totalActivities,
            openIssues,
            openRisks
        };
    }, [projects, proposals, activities, issues, risks]);

    // Active project for individual dossier
    const activeProject = useMemo(() => {
        return projects.find(p => p.id === selectedProjectId) || projects[0];
    }, [projects, selectedProjectId]);

    // Filtered Projects for Portfolio Report
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
            if (searchTerm.trim()) {
                const s = searchTerm.toLowerCase();
                const matchName = p.name?.toLowerCase().includes(s);
                const matchClient = p.client?.name?.toLowerCase().includes(s);
                const matchLpo = p.lpo_number?.toLowerCase().includes(s);
                if (!matchName && !matchClient && !matchLpo) return false;
            }
            return true;
        });
    }, [projects, statusFilter, searchTerm]);

    // Filtered Proposals
    const filteredProposals = useMemo(() => {
        return proposals.filter(p => {
            if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
            if (searchTerm.trim()) {
                const s = searchTerm.toLowerCase();
                const matchTitle = p.title?.toLowerCase().includes(s);
                const matchClient = p.client?.name?.toLowerCase().includes(s);
                const matchRfq = p.rfq_reference?.toLowerCase().includes(s);
                if (!matchTitle && !matchClient && !matchRfq) return false;
            }
            return true;
        });
    }, [proposals, statusFilter, searchTerm]);

    return (
        <div className="space-y-6 animate-fade-in pb-16">
            {/* Header & Controls (Hidden when printing) */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-6 print:hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                Reporting Suite
                            </span>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">
                                Project Analytics & Governance Reports
                            </h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Generate executive dossiers, portfolio summaries, proposal conversion metrics, and site compliance logs for audit and management review.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Print / Export PDF</span>
                    </button>
                </div>

                {/* Report Type Tabs */}
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                    {[
                        { id: 'PORTFOLIO_SUMMARY', label: '1. Portfolio Master Status', icon: Briefcase },
                        { id: 'PROJECT_DOSSIER', label: '2. Project Executive Dossier', icon: FileText },
                        { id: 'PROPOSALS_REPORT', label: '3. Proposals & Bids Log', icon: Layers },
                        { id: 'SITE_ACTIVITIES', label: '4. Site Activity & Execution Feed', icon: ShieldCheck },
                        { id: 'HSE_SAFETY', label: '5. Issues, Risks & HSE Log', icon: AlertTriangle },
                    ].map(r => (
                        <button
                            key={r.id}
                            onClick={() => setSelectedReport(r.id as any)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
                                selectedReport === r.id
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            <r.icon className="w-4 h-4" />
                            <span>{r.label}</span>
                        </button>
                    ))}
                </div>

                {/* Report Specific Filters */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    {selectedReport === 'PROJECT_DOSSIER' ? (
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1">Select Project for Dossier</label>
                            <select
                                value={selectedProjectId}
                                onChange={e => setSelectedProjectId(e.target.value)}
                                className="w-full sm:w-80 px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white font-bold focus:outline-none"
                            >
                                {projects.length === 0 ? (
                                    <option value="">No projects found</option>
                                ) : (
                                    projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.lpo_number || 'No LPO'})</option>
                                    ))
                                )}
                            </select>
                        </div>
                    ) : (
                        <>
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search by name, client, reference..."
                                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>
                            <div className="sm:w-48">
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white font-bold focus:outline-none"
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="DRAFT">Draft</option>
                                    <option value="PENDING_PROJECT_HEAD_APPROVAL">Pending Approval</option>
                                    <option value="APPROVED">Approved / Site Active</option>
                                    <option value="SUPERVISOR_ASSIGNED">Supervisor Assigned</option>
                                    <option value="COMPLETION_REQUESTED">Completion Requested</option>
                                    <option value="COMPLETED">Completed & Handed Over</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* EXECUTIVE METRICS BANNER */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:grid-cols-4">
                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Active Portfolio</span>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1">
                        {metrics.totalProjects} Projects
                    </h3>
                    <p className="text-xs text-emerald-600 font-bold mt-0.5">{metrics.completedProjects} Completed</p>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Total Contract Value</span>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1 font-mono">
                        QAR {metrics.totalContractValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </h3>
                    <p className="text-xs text-blue-600 font-bold mt-0.5">Budgeted Execution</p>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Average Completion</span>
                    <h3 className="text-xl font-black text-blue-600 mt-1 font-mono">
                        {metrics.avgProgress}%
                    </h3>
                    <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${metrics.avgProgress}%` }} />
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Governance & Risks</span>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1">
                        {metrics.openIssues} Issues / {metrics.openRisks} Risks
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{metrics.totalActivities} Site Activities Recorded</p>
                </div>
            </div>

            {/* PRINTABLE REPORT DOCUMENT CONTAINER */}
            <div className="bg-white dark:bg-zinc-900 p-8 sm:p-10 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm print:p-0 print:border-none print:shadow-none print:bg-white text-slate-800 dark:text-slate-200">
                
                {/* Formal Corporate Letterhead */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 dark:border-white pb-6 mb-8">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-600 text-white font-mono font-bold text-[10px] rounded">
                                KAA ERP ENTERPRISE
                            </span>
                            <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">Governance & Audit Report</span>
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white mt-1.5">
                            {selectedReport === 'PORTFOLIO_SUMMARY' && 'Project Portfolio Master Status Report'}
                            {selectedReport === 'PROJECT_DOSSIER' && `Project Comprehensive Dossier: ${activeProject?.name || 'Project'}`}
                            {selectedReport === 'PROPOSALS_REPORT' && 'Commercial & Technical Proposals Audit Log'}
                            {selectedReport === 'SITE_ACTIVITIES' && 'Site Execution & Daily Activity Log Report'}
                            {selectedReport === 'HSE_SAFETY' && 'Project Issues, Risks & HSE Safety Summary'}
                        </h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                            Power Engineering & Contracting Co. • Official Project Management Record
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-slate-400">Date: {new Date().toLocaleDateString('en-GB')}</p>
                        <p className="text-xs font-bold text-slate-400">Time: {new Date().toLocaleTimeString()}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            CONFIDENTIAL
                        </span>
                    </div>
                </div>

                {/* 1. REPORT: PORTFOLIO MASTER STATUS */}
                {selectedReport === 'PORTFOLIO_SUMMARY' && (
                    <div className="space-y-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-700">
                                        <th className="p-3">#</th>
                                        <th className="p-3">Project Name & Reference</th>
                                        <th className="p-3">Client / Customer</th>
                                        <th className="p-3">LPO Number</th>
                                        <th className="p-3 text-right">Contract Value (QAR)</th>
                                        <th className="p-3 text-center">Schedule</th>
                                        <th className="p-3 text-center">Progress %</th>
                                        <th className="p-3 text-center">Governance Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {filteredProjects.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-slate-400">
                                                No projects registered in the portfolio.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProjects.map((p, idx) => (
                                            <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                                                <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{p.cost_center?.name || 'Main Cost Center'}</div>
                                                </td>
                                                <td className="p-3 font-medium">{p.client?.name || '—'}</td>
                                                <td className="p-3 font-mono font-bold">{p.lpo_number || '—'}</td>
                                                <td className="p-3 text-right font-mono font-bold">
                                                    {Number(p.lpo_cost || p.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-3 text-center text-[11px] font-mono">
                                                    {p.start_date || '—'} to {p.end_date || '—'}
                                                </td>
                                                <td className="p-3 text-center font-mono font-bold text-blue-600">
                                                    {p.completion_pct || 0}%
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300">
                                                        {p.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 dark:bg-zinc-800 font-bold border-t-2 border-slate-300 dark:border-zinc-700">
                                        <td colSpan={4} className="p-3 text-right uppercase">Portfolio Total:</td>
                                        <td className="p-3 text-right font-mono text-sm text-slate-900 dark:text-white">
                                            QAR {metrics.totalContractValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td colSpan={3} className="p-3 text-center">Avg: {metrics.avgProgress}% Complete</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* 2. REPORT: PROJECT EXECUTIVE DOSSIER */}
                {selectedReport === 'PROJECT_DOSSIER' && (
                    activeProject ? (
                        <div className="space-y-6">
                            {/* Project Header Summary */}
                            <div className="p-5 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200/80 dark:border-zinc-700 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                <div>
                                    <span className="text-slate-400 block font-bold">Project Name:</span>
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">{activeProject.name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block font-bold">Client / Customer:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{activeProject.client?.name || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block font-bold">Client LPO #:</span>
                                    <span className="font-mono font-bold">{activeProject.lpo_number || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block font-bold">Contract Value:</span>
                                    <span className="font-mono font-black text-slate-900 dark:text-white">
                                        QAR {Number(activeProject.lpo_cost || activeProject.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Mandatory Hold Points (6/6) */}
                            <div className="space-y-2">
                                <h3 className="text-xs font-black uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 p-2 rounded">
                                    3. Mandatory Document Compliance Gateway (6 Hold-Points)
                                </h3>
                                <table className="w-full text-left text-xs border border-slate-200 dark:border-zinc-800">
                                    <thead className="bg-slate-50 dark:bg-zinc-800/60 font-bold">
                                        <tr>
                                            <th className="p-2.5">Document Gateway</th>
                                            <th className="p-2.5">Status</th>
                                            <th className="p-2.5">Version</th>
                                            <th className="p-2.5">Verification Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {[
                                            { type: 'METHOD_STATEMENT', label: 'Method Statement (MS)' },
                                            { type: 'ITP', label: 'Inspection & Test Plan (ITP)' },
                                            { type: 'EXECUTION_PLAN', label: 'Project Execution Plan (PEP)' },
                                            { type: 'JHA', label: 'Job Hazard Analysis (JHA)' },
                                            { type: 'TECHNICAL_DATA_SHEET', label: 'Technical Data Sheets (TDS)' },
                                            { type: 'SDS', label: 'Safety Data Sheets (SDS / MSDS)' },
                                        ].map(m => {
                                            const doc = (activeProject.documents || []).find((d: any) => d.document_type === m.type);
                                            return (
                                                <tr key={m.type}>
                                                    <td className="p-2.5 font-bold">{m.label}</td>
                                                    <td className="p-2.5">
                                                        {doc?.confirmed ? (
                                                            <span className="text-emerald-600 font-bold">✓ Confirmed</span>
                                                        ) : (
                                                            <span className="text-amber-600 font-bold">⚠ Pending</span>
                                                        )}
                                                    </td>
                                                    <td className="p-2.5 font-mono">{doc ? `v${doc.version || 1}` : '—'}</td>
                                                    <td className="p-2.5 text-slate-500 italic">{doc?.remarks || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end print:hidden">
                                <button
                                    type="button"
                                    onClick={() => setSelectedProjectForModal(activeProject)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View Full Interactive Dossier</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-400">No project selected</div>
                    )
                )}

                {/* 3. REPORT: PROPOSALS AUDIT LOG */}
                {selectedReport === 'PROPOSALS_REPORT' && (
                    <div className="space-y-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-700">
                                        <th className="p-3">#</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Proposal Title & RFQ</th>
                                        <th className="p-3">Client / Partner</th>
                                        <th className="p-3">Reviewer</th>
                                        <th className="p-3 text-center">Revision</th>
                                        <th className="p-3 text-center">Lifecycle Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {filteredProposals.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-400">
                                                No proposals found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProposals.map((prop, idx) => (
                                            <tr key={prop.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                                                <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                                        prop.proposal_type === 'TECHNICAL'
                                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                    }`}>
                                                        {prop.proposal_type === 'TECHNICAL' ? 'Technical' : 'Commercial'}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-900 dark:text-white">{prop.title}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                        RFQ: {prop.rfq_reference || '—'} | Quote: {prop.quotation_reference || '—'}
                                                    </div>
                                                </td>
                                                <td className="p-3 font-medium">{prop.client?.name || '—'}</td>
                                                <td className="p-3">{prop.first_reviewer?.name || 'Unassigned'}</td>
                                                <td className="p-3 text-center font-mono font-bold">Rev {prop.current_revision || 1}</td>
                                                <td className="p-3 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300">
                                                        {prop.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. REPORT: SITE ACTIVITIES */}
                {selectedReport === 'SITE_ACTIVITIES' && (
                    <div className="space-y-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-700">
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Project</th>
                                        <th className="p-3">Supervisor</th>
                                        <th className="p-3">Execution Description</th>
                                        <th className="p-3 text-center">Manpower</th>
                                        <th className="p-3 text-center">Weather</th>
                                        <th className="p-3 text-center">Delays</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {activities.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-400">
                                                No daily site activities logged yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        activities.map((act) => (
                                            <tr key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                                                <td className="p-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">{act.activity_date}</td>
                                                <td className="p-3 font-bold">{act.project?.name || '—'}</td>
                                                <td className="p-3">{act.supervisor?.name || 'Site Lead'}</td>
                                                <td className="p-3 text-slate-700 dark:text-slate-300">{act.description}</td>
                                                <td className="p-3 text-center font-mono font-bold">{act.manpower_count || 0}</td>
                                                <td className="p-3 text-center">{act.weather_conditions || 'Normal'}</td>
                                                <td className="p-3 text-center">
                                                    {act.delay_encountered ? (
                                                        <span className="text-rose-600 font-bold">⚠ {act.delay_hours || 0}h delay</span>
                                                    ) : (
                                                        <span className="text-emerald-600 font-bold">✓ No Delay</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 5. REPORT: HSE & RISKS */}
                {selectedReport === 'HSE_SAFETY' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 p-2.5 rounded-xl mb-3">
                                Active Project Issues & Mitigations ({issues.length} Logged)
                            </h3>
                            <table className="w-full text-left text-xs border border-slate-200 dark:border-zinc-800">
                                <thead className="bg-slate-50 dark:bg-zinc-800 font-bold">
                                    <tr>
                                        <th className="p-2.5">Title & Description</th>
                                        <th className="p-2.5">Severity</th>
                                        <th className="p-2.5">Impact</th>
                                        <th className="p-2.5">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {issues.length === 0 ? (
                                        <tr><td colSpan={4} className="p-4 text-center text-slate-400">No active issues recorded</td></tr>
                                    ) : (
                                        issues.map((iss: any) => (
                                            <tr key={iss.id}>
                                                <td className="p-2.5">
                                                    <span className="font-bold block">{iss.title}</span>
                                                    <span className="text-slate-500">{iss.description}</span>
                                                </td>
                                                <td className="p-2.5 font-bold font-mono">{iss.severity || 'MEDIUM'}</td>
                                                <td className="p-2.5">{iss.impact || '—'}</td>
                                                <td className="p-2.5 font-bold">{iss.status || 'OPEN'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Formal Signoff Footer for Printed Reports */}
                <div className="hidden print:grid grid-cols-3 gap-8 pt-16 border-t border-slate-200 mt-12 text-xs">
                    <div>
                        <p className="font-bold">Prepared By:</p>
                        <div className="h-12 border-b border-slate-300 mt-2" />
                        <p className="text-[10px] text-slate-400 mt-1">Project Engineer / Lead</p>
                    </div>
                    <div>
                        <p className="font-bold">Verified By:</p>
                        <div className="h-12 border-b border-slate-300 mt-2" />
                        <p className="text-[10px] text-slate-400 mt-1">QA/QC & HSE Manager</p>
                    </div>
                    <div>
                        <p className="font-bold">Approved By:</p>
                        <div className="h-12 border-b border-slate-300 mt-2" />
                        <p className="text-[10px] text-slate-400 mt-1">Project Head / Managing Director</p>
                    </div>
                </div>
            </div>

            {/* Individual Project Dossier Modal */}
            {selectedProjectForModal && (
                <ProjectReportModal
                    project={selectedProjectForModal}
                    onClose={() => setSelectedProjectForModal(null)}
                />
            )}
        </div>
    );
};
