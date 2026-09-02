import React, { useState, useMemo } from 'react';
import { 
    FileText, Plus, Search, Filter, Lock, Unlock, Eye, CheckCircle2, 
    AlertCircle, RotateCcw, Building2, Calendar, User, Clock, ArrowRight,
    UserCheck, ShieldCheck 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ProposalsListProps {
    proposals: any[];
    loading: boolean;
    currentEmployee?: any;
    isAdmin?: boolean;
    onSelectProposal: (proposal: any) => void;
    onNewProposal?: (type: 'TECHNICAL' | 'COMMERCIAL') => void;
    onNewTechnicalProposal?: () => void;
    onNewCommercialProposal?: () => void;
    onRefresh: () => void;
}

export const ProposalsList: React.FC<ProposalsListProps> = ({
    proposals,
    loading,
    currentEmployee,
    isAdmin = false,
    onSelectProposal,
    onNewProposal,
    onNewTechnicalProposal,
    onNewCommercialProposal,
    onRefresh
}) => {
    const { user } = useAuth();
    const [activeTypeTab, setActiveTypeTab] = useState<'ALL' | 'ASSIGNED_TO_ME' | 'TECHNICAL' | 'COMMERCIAL'>('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Dynamic proposal assignment helper
    const isProposalAssignedToUser = (p: any) => {
        if (!p) return false;
        return Boolean(
            (currentEmployee && p.first_reviewer_id && (
                currentEmployee.id === p.first_reviewer_id ||
                (p.first_reviewer?.id && currentEmployee.id === p.first_reviewer.id) ||
                (p.first_reviewer?.email && currentEmployee.email && p.first_reviewer.email.toLowerCase() === currentEmployee.email.toLowerCase())
            )) ||
            (user?.id && (p.first_reviewer_id === user.id || p.first_reviewer?.profile_id === user.id)) ||
            (user?.email && p.first_reviewer?.email && p.first_reviewer.email.toLowerCase() === user.email.toLowerCase())
        );
    };

    const myAssignedCount = useMemo(() => {
        return proposals.filter(p => isProposalAssignedToUser(p) && p.status?.startsWith('PENDING')).length;
    }, [proposals, currentEmployee, user]);

    const filteredProposals = useMemo(() => {
        return proposals.filter(p => {
            // Type tab
            if (activeTypeTab === 'ASSIGNED_TO_ME') {
                if (!isProposalAssignedToUser(p)) return false;
            } else if (activeTypeTab !== 'ALL' && p.proposal_type !== activeTypeTab) {
                return false;
            }

            // Status filter
            if (statusFilter === 'PENDING' && !p.status.startsWith('PENDING')) return false;
            if (statusFilter === 'APPROVED' && p.status !== 'APPROVED') return false;
            if (statusFilter === 'RETURNED' && p.status !== 'RETURNED') return false;
            if (statusFilter === 'REJECTED' && p.status !== 'REJECTED') return false;

            // Search filter
            if (searchTerm.trim()) {
                const s = searchTerm.toLowerCase();
                const matchTitle = p.title?.toLowerCase().includes(s);
                const matchClient = p.client?.name?.toLowerCase().includes(s);
                const matchRfq = p.rfq_reference?.toLowerCase().includes(s);
                const matchQuote = p.quotation_reference?.toLowerCase().includes(s);
                if (!matchTitle && !matchClient && !matchRfq && !matchQuote) return false;
            }

            return true;
        });
    }, [proposals, activeTypeTab, statusFilter, searchTerm, currentEmployee, user]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <Lock className="w-3 h-3" /> Approved & Locked
                    </span>
                );
            case 'RETURNED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <RotateCcw className="w-3 h-3" /> Returned for Correction
                    </span>
                );
            case 'REJECTED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <AlertCircle className="w-3 h-3" /> Rejected
                    </span>
                );
            case 'PENDING_FIRST_REVIEW':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        <Clock className="w-3 h-3" /> Under 1st Review
                    </span>
                );
            case 'PENDING_FINANCE_APPROVAL':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <Clock className="w-3 h-3" /> Under Finance Review
                    </span>
                );
            case 'PENDING_FINAL_APPROVAL':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        <Clock className="w-3 h-3" /> Pending Final Approval
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300">
                        {status}
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header & New Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Proposal Control & Registrations</h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Register external proposals, assign reviewers, manage revisions, and lock approved documents.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <button
                        onClick={() => {
                            if (onNewProposal) onNewProposal('TECHNICAL');
                            else if (onNewTechnicalProposal) onNewTechnicalProposal();
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Technical Proposal</span>
                    </button>
                    <button
                        onClick={() => {
                            if (onNewProposal) onNewProposal('COMMERCIAL');
                            else if (onNewCommercialProposal) onNewCommercialProposal();
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Commercial Proposal</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                {/* Type Tab Selector */}
                <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl w-full md:w-auto">
                    {[
                        { id: 'ALL', label: 'All Proposals' },
                        { id: 'ASSIGNED_TO_ME', label: `Assigned to Me (${myAssignedCount})` },
                        { id: 'TECHNICAL', label: 'Technical' },
                        { id: 'COMMERCIAL', label: 'Commercial' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTypeTab(tab.id as any)}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                activeTypeTab === tab.id
                                    ? 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Search and Status Dropdown */}
                <div className="flex flex-1 w-full md:w-auto gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search by proposal title, client, RFQ reference..."
                            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-white"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 focus:outline-none"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="PENDING">Pending Review</option>
                        <option value="APPROVED">Approved & Locked</option>
                        <option value="RETURNED">Returned for Correction</option>
                        <option value="REJECTED">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Proposals Table */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/80 dark:bg-zinc-800/40 text-slate-400 font-bold text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Type & Title</th>
                                <th className="px-6 py-4">Client / Opportunity</th>
                                <th className="px-6 py-4">RFQ / Quotation Ref</th>
                                <th className="px-6 py-4">Reviewer</th>
                                <th className="px-6 py-4">Revision</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {filteredProposals.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                                        <FileText className="w-12 h-12 mx-auto opacity-30 mb-2" />
                                        <p className="font-bold text-base text-slate-700 dark:text-slate-300">No Proposals Found</p>
                                        <p className="text-xs mt-1">Register a technical or commercial proposal to begin the review lifecycle.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProposals.map((prop) => (
                                    <tr
                                        key={prop.id}
                                        onClick={() => onSelectProposal(prop)}
                                        className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                                    prop.proposal_type === 'TECHNICAL'
                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                }`}>
                                                    {prop.proposal_type === 'TECHNICAL' ? 'Tech' : 'Comm'}
                                                </span>
                                                <span className="font-bold text-slate-800 dark:text-white">{prop.title}</span>
                                            </div>
                                            {prop.submission_deadline && (
                                                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    Deadline: {prop.submission_deadline}
                                                </p>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            <p className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                                <Building2 className="w-3 h-3 text-slate-400" />
                                                {prop.client?.name || 'No Client Linked'}
                                            </p>
                                            {prop.currency && (
                                                <span className="text-[10px] text-slate-400 font-mono">Currency: {prop.currency}</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                                            {prop.rfq_reference && <div>RFQ: {prop.rfq_reference}</div>}
                                            {prop.quotation_reference && <div>Quote: {prop.quotation_reference}</div>}
                                            {!prop.rfq_reference && !prop.quotation_reference && <span className="text-slate-300">—</span>}
                                        </td>

                                        <td className="px-6 py-4 text-xs">
                                            {isProposalAssignedToUser(prop) ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-sm">
                                                    <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                                    <span>Assigned to You</span>
                                                </span>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
                                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>{prop.first_reviewer?.name || 'Unassigned'}</span>
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded font-mono font-bold text-xs">
                                                Rev {prop.current_revision || 1}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4">
                                            {getStatusBadge(prop.status)}
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            {isProposalAssignedToUser(prop) && prop.status?.startsWith('PENDING') ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectProposal(prop);
                                                    }}
                                                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
                                                >
                                                    <ShieldCheck className="w-3.5 h-3.5" />
                                                    <span>Review & Approve</span>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectProposal(prop);
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1"
                                                >
                                                    <span>View / History</span>
                                                    <ArrowRight className="w-3 h-3" />
                                                </button>
                                            )}
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
