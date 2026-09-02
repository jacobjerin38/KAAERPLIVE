import React, { useState } from 'react';
import { 
    X, Lock, Unlock, Download, Eye, FileText, CheckCircle2, RotateCcw, 
    AlertCircle, Clock, User, Calendar, Building2, Upload, History, UserCheck, Shield, ArrowLeft 
} from 'lucide-react';
import { processProposalReview, submitProposalRevision, reassignProposalReviewer } from './projectService';
import { useAuth } from '../../contexts/AuthContext';

interface ProposalDetailModalProps {
    proposal: any;
    employees: any[];
    currentEmployee?: any;
    isAdmin?: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const ProposalDetailModal: React.FC<ProposalDetailModalProps> = ({
    proposal,
    employees,
    currentEmployee,
    isAdmin = false,
    onClose,
    onSuccess
}) => {
    const { currentCompanyId, user, userRole, hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState<'DETAILS' | 'REVISIONS' | 'AUDIT'>('DETAILS');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dynamic Approver Verification
    const isAssignedApprover = Boolean(
        (currentEmployee && proposal.first_reviewer_id && (
            currentEmployee.id === proposal.first_reviewer_id ||
            (proposal.first_reviewer?.id && currentEmployee.id === proposal.first_reviewer.id) ||
            (proposal.first_reviewer?.email && currentEmployee.email && proposal.first_reviewer.email.toLowerCase() === currentEmployee.email.toLowerCase())
        )) ||
        (user?.id && (proposal.first_reviewer_id === user.id || proposal.first_reviewer?.profile_id === user.id)) ||
        (user?.email && proposal.first_reviewer?.email && proposal.first_reviewer.email.toLowerCase() === user.email.toLowerCase())
    );

    const isSuperAdmin = Boolean(
        isAdmin ||
        userRole?.toLowerCase() === 'admin' ||
        userRole?.toLowerCase() === 'super admin' ||
        hasPermission('*') ||
        hasPermission('projects.proposals.admin_approve')
    );

    const canApprove = isAssignedApprover || isSuperAdmin;

    // Review action state
    const [reviewAction, setReviewAction] = useState<'APPROVE' | 'RETURN' | 'REJECT' | null>(null);
    const [reviewRemarks, setReviewRemarks] = useState('');

    // Reassign state
    const [showReassign, setShowReassign] = useState(false);
    const [newReviewerId, setNewReviewerId] = useState('');
    const [reassignReason, setReassignReason] = useState('');

    // Revision upload state
    const [showUploadRevision, setShowUploadRevision] = useState(false);
    const [revTechFile, setRevTechFile] = useState<File | null>(null);
    const [revQuoteFile, setRevQuoteFile] = useState<File | null>(null);
    const [revCostingFile, setRevCostingFile] = useState<File | null>(null);
    const [revRemarks, setRevRemarks] = useState('');

    const isTechnical = proposal.proposal_type === 'TECHNICAL';
    const isLocked = proposal.is_locked || proposal.status === 'APPROVED';
    const isPendingReview = 
        proposal.status === 'PENDING_FIRST_REVIEW' || 
        proposal.status === 'PENDING_FINANCE_APPROVAL' || 
        proposal.status === 'PENDING_FINAL_APPROVAL';
    const isReturned = proposal.status === 'RETURNED';
    const isRejected = proposal.status === 'REJECTED';

    // Check what stage this proposal is at
    const currentStage: 'FIRST_REVIEW' | 'FINANCE_REVIEW' | 'FINAL_APPROVAL' = 
        proposal.status === 'PENDING_FIRST_REVIEW' ? 'FIRST_REVIEW' :
        proposal.status === 'PENDING_FINANCE_APPROVAL' ? 'FINANCE_REVIEW' : 'FINAL_APPROVAL';

    const stageTitle = 
        proposal.status === 'PENDING_FIRST_REVIEW' ? (isTechnical ? 'Stage 1: First Technical Review' : 'Stage 1: First Commercial Review') :
        proposal.status === 'PENDING_FINANCE_APPROVAL' ? 'Stage 2: Finance & Margin Review' :
        proposal.status === 'PENDING_FINAL_APPROVAL' ? 'Stage 3: Final Executive Approval' : 'Review';

    const handleExecuteReview = async (action: 'APPROVE' | 'RETURN' | 'REJECT') => {
        if (!currentCompanyId) return;
        if (!canApprove) {
            setError(`Unauthorized: Only ${proposal.first_reviewer?.name || 'the assigned reviewer'} can review or approve this proposal.`);
            return;
        }
        if ((action === 'RETURN' || action === 'REJECT') && !reviewRemarks.trim()) {
            setError(`Please provide mandatory remarks explaining why the proposal was ${action.toLowerCase()}ed.`);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const actorId = user?.id || proposal.created_by || '00000000-0000-0000-0000-000000000000';
            await processProposalReview({
                companyId: currentCompanyId,
                proposalId: proposal.id,
                action,
                remarks: reviewRemarks.trim(),
                actorId,
                currentStage
            });

            setReviewRemarks('');
            setReviewAction(null);
            onSuccess();
        } catch (err: any) {
            console.error('Error reviewing proposal:', err);
            setError(err.message || 'Failed to process review action');
        } finally {
            setLoading(false);
        }
    };

    const handleReassignReviewer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId) return;
        if (!newReviewerId) {
            setError('Please select a new reviewer.');
            return;
        }
        if (!reassignReason.trim()) {
            setError('Please provide a mandatory reason for reassignment.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const actorId = user?.id || proposal.created_by || '00000000-0000-0000-0000-000000000000';
            await reassignProposalReviewer({
                companyId: currentCompanyId,
                proposalId: proposal.id,
                newReviewerId,
                reason: reassignReason.trim(),
                actorId
            });

            setShowReassign(false);
            setReassignReason('');
            setNewReviewerId('');
            onSuccess();
        } catch (err: any) {
            console.error('Error reassigning reviewer:', err);
            setError(err.message || 'Failed to reassign reviewer');
        } finally {
            setLoading(false);
        }
    };

    const handleUploadRevision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId) return;

        if (isTechnical && !revTechFile) {
            setError('Technical proposal document is mandatory for revision.');
            return;
        }
        if (!isTechnical && !revQuoteFile && !revCostingFile) {
            setError('Please attach at least one updated document (Quotation or Costing Sheet) for revision.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const submittedBy = user?.id || proposal.created_by || '00000000-0000-0000-0000-000000000000';
            await submitProposalRevision({
                companyId: currentCompanyId,
                proposalId: proposal.id,
                reviewerId: proposal.first_reviewer_id,
                technicalFile: revTechFile,
                quotationFile: revQuoteFile,
                costingSheetFile: revCostingFile,
                remarks: revRemarks.trim() || 'Updated revision files',
                submittedBy
            });

            setShowUploadRevision(false);
            setRevTechFile(null);
            setRevQuoteFile(null);
            setRevCostingFile(null);
            setRevRemarks('');
            onSuccess();
        } catch (err: any) {
            console.error('Error uploading revision:', err);
            setError(err.message || 'Failed to upload revision');
        } finally {
            setLoading(false);
        }
    };

    // Latest revision files
    const latestRevision = (proposal.revisions || []).sort((a: any, b: any) => b.revision_number - a.revision_number)[0];

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-3xl p-6 sm:p-8 shadow-2xl relative animate-slide-up border border-slate-100 dark:border-zinc-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
                {/* Top Navigation & Close Bar */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-zinc-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors group shadow-sm"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                        <span>Back to Proposals</span>
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-zinc-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-600 dark:text-slate-400 transition-colors flex items-center gap-1 text-xs font-bold shadow-sm"
                        title="Close modal (Esc)"
                    >
                        <X className="w-4 h-4" />
                        <span>Close</span>
                    </button>
                </div>

                {/* Header Title Section */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase ${
                            isTechnical 
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                            {isTechnical ? 'Technical Proposal' : 'Commercial Proposal'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-xs">
                            Rev {proposal.current_revision || 1}
                        </span>
                        {isLocked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800">
                                <Lock className="w-3 h-3" /> Locked
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-2 break-all sm:break-words leading-tight">
                        {proposal.title}
                    </h2>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Sub-Tabs */}
                <div className="flex gap-2 border-b border-slate-100 dark:border-zinc-800 mb-6 pb-2">
                    {[
                        { id: 'DETAILS', label: 'Proposal & Files' },
                        { id: 'REVISIONS', label: `Revision History (${proposal.revisions?.length || 1})` },
                        { id: 'AUDIT', label: `Audit Log (${proposal.audit?.length || 0})` },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* TAB 1: DETAILS & DOCUMENTS */}
                {activeTab === 'DETAILS' && (
                    <div className="space-y-6">
                        {/* Meta Card */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-100 dark:border-zinc-800">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Client</span>
                                <p className="text-xs font-bold text-slate-800 dark:text-white mt-0.5">
                                    {proposal.client?.name || '—'}
                                </p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">RFQ Ref</span>
                                <p className="text-xs font-mono font-bold text-slate-800 dark:text-white mt-0.5">
                                    {proposal.rfq_reference || '—'}
                                </p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Quote Ref</span>
                                <p className="text-xs font-mono font-bold text-slate-800 dark:text-white mt-0.5">
                                    {proposal.quotation_reference || '—'}
                                </p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">First Reviewer</span>
                                <p className="text-xs font-bold text-slate-800 dark:text-white mt-0.5 flex items-center justify-between">
                                    <span>{proposal.first_reviewer?.name || '—'}</span>
                                    {!isLocked && (
                                        <button
                                            type="button"
                                            onClick={() => setShowReassign(true)}
                                            className="text-[10px] text-blue-600 hover:underline font-normal"
                                        >
                                            Reassign
                                        </button>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Proposal Files (Current Revision) */}
                        <div className="p-5 bg-white dark:bg-zinc-800/60 rounded-2xl border border-slate-200/80 dark:border-zinc-700 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                        Current Revision {proposal.current_revision || 1} Documents
                                    </h4>
                                </div>
                                {!isLocked && (
                                    <button
                                        type="button"
                                        onClick={() => setShowUploadRevision(true)}
                                        className="px-3 py-1 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>Upload New Revision</span>
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {isTechnical ? (
                                    /* Technical Document Link */
                                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700">
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-blue-500" />
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 dark:text-white">Technical Proposal Document</p>
                                                <p className="text-[10px] text-slate-400">PDF / Word file</p>
                                            </div>
                                        </div>
                                        {latestRevision?.technical_file_url ? (
                                            <a
                                                href={latestRevision.technical_file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-1.5 shadow-sm"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                <span>Download / View</span>
                                            </a>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">No file attached</span>
                                        )}
                                    </div>
                                ) : (
                                    /* Commercial: Quotation + Costing Sheet */
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700">
                                            <div className="flex items-center gap-2.5">
                                                <FileText className="w-4 h-4 text-emerald-500" />
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-white">1. Quotation</p>
                                                    <p className="text-[10px] text-slate-400">PDF document</p>
                                                </div>
                                            </div>
                                            {latestRevision?.quotation_file_url ? (
                                                <a
                                                    href={latestRevision.quotation_file_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg inline-flex items-center gap-1 shadow-sm"
                                                >
                                                    <Download className="w-3 h-3" />
                                                    <span>View</span>
                                                </a>
                                            ) : (
                                                <span className="text-[11px] text-rose-500">Missing</span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700">
                                            <div className="flex items-center gap-2.5">
                                                <FileText className="w-4 h-4 text-emerald-500" />
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-white">2. Costing Sheet</p>
                                                    <p className="text-[10px] text-slate-400">Excel / Breakdown</p>
                                                </div>
                                            </div>
                                            {latestRevision?.costing_sheet_file_url ? (
                                                <a
                                                    href={latestRevision.costing_sheet_file_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg inline-flex items-center gap-1 shadow-sm"
                                                >
                                                    <Download className="w-3 h-3" />
                                                    <span>View</span>
                                                </a>
                                            ) : (
                                                <span className="text-[11px] text-rose-500">Missing</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Remarks */}
                        {proposal.remarks && (
                            <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-100 dark:border-zinc-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Scope & Remarks</span>
                                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{proposal.remarks}</p>
                            </div>
                        )}

                        {/* Status Banners */}
                        {isLocked && (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
                                <Lock className="w-5 h-5 shrink-0 text-emerald-600" />
                                <div>
                                    <h4 className="text-xs font-extrabold uppercase tracking-wider">Approved & Locked</h4>
                                    <p className="text-xs mt-0.5">This proposal has received final executive approval and is locked for project execution.</p>
                                </div>
                            </div>
                        )}

                        {isReturned && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-2 text-amber-900 dark:text-amber-300">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <RotateCcw className="w-5 h-5 shrink-0 text-amber-600" />
                                        <h4 className="text-xs font-extrabold uppercase tracking-wider">Returned for Correction</h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowUploadRevision(true)}
                                        className="px-3 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>Upload Revision {(proposal.current_revision || 1) + 1}</span>
                                    </button>
                                </div>
                                {latestRevision?.return_reason && (
                                    <p className="text-xs bg-white/70 dark:bg-zinc-900/70 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/50 italic">
                                        "{latestRevision.return_reason}"
                                    </p>
                                )}
                            </div>
                        )}

                        {isRejected && (
                            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800 space-y-2 text-rose-900 dark:text-rose-300">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                                    <h4 className="text-xs font-extrabold uppercase tracking-wider">Proposal Rejected</h4>
                                </div>
                                {latestRevision?.rejection_reason && (
                                    <p className="text-xs bg-white/70 dark:bg-zinc-900/70 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/50 italic">
                                        "{latestRevision.rejection_reason}"
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Reviewer Action Bar (Active review stages) */}
                        {isPendingReview && !isLocked && (
                            canApprove ? (
                                <div className="p-5 bg-blue-50/60 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-4 animate-fade-in">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                            <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                {stageTitle}
                                            </h4>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                {isAssignedApprover ? 'Authorized Reviewer' : 'Admin Override'}
                                            </span>
                                            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                                                Action Required
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Review Remarks / Notes (Mandatory for Return or Rejection)
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={reviewRemarks}
                                            onChange={e => setReviewRemarks(e.target.value)}
                                            placeholder="Add approval remarks or explain reason for return/rejection..."
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-2.5 justify-end">
                                        <button
                                            type="button"
                                            disabled={loading}
                                            onClick={() => handleExecuteReview('RETURN')}
                                            className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm transition-all"
                                        >
                                            Return for Correction
                                        </button>
                                        <button
                                            type="button"
                                            disabled={loading}
                                            onClick={() => handleExecuteReview('REJECT')}
                                            className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-all"
                                        >
                                            Reject Proposal
                                        </button>
                                        <button
                                            type="button"
                                            disabled={loading}
                                            onClick={() => handleExecuteReview('APPROVE')}
                                            className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>
                                                {proposal.status === 'PENDING_FINAL_APPROVAL' 
                                                    ? 'Final Approve & Lock' 
                                                    : proposal.status === 'PENDING_FIRST_REVIEW'
                                                        ? (isTechnical ? 'Approve & Advance to Final Approval' : 'Approve & Advance to Finance Review')
                                                        : 'Approve & Advance to Final Approval'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Read-Only Gateway for Non-Assigned Users */
                                <div className="p-5 bg-slate-50 dark:bg-zinc-850 rounded-2xl border border-slate-200 dark:border-zinc-750 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 shadow-sm">
                                            <Lock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                                <span>Awaiting Review by {proposal.first_reviewer?.name || 'Assigned Reviewer'}</span>
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                Only the designated reviewer (<strong className="text-slate-700 dark:text-slate-200">{proposal.first_reviewer?.name || 'mentioned user'}</strong>) can approve, return, or reject this proposal.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold shrink-0 inline-flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" /> Read-Only View
                                    </span>
                                </div>
                            )
                        )}
                    </div>
                )}

                {/* TAB 2: REVISION HISTORY */}
                {activeTab === 'REVISIONS' && (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-400">
                            Complete historical record of all revisions submitted for this proposal. Historical files are never overwritten.
                        </p>

                        <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                            {(proposal.revisions || []).map((rev: any) => (
                                <div key={rev.id} className="p-4 bg-white dark:bg-zinc-900 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono font-bold text-xs rounded">
                                                Revision {rev.revision_number}
                                            </span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                Submitted {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : '—'}
                                            </span>
                                        </div>
                                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 font-bold">
                                            {rev.status}
                                        </span>
                                    </div>

                                    {rev.remarks && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                            "{rev.remarks}"
                                        </p>
                                    )}

                                    {rev.return_reason && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                                            Return Reason: {rev.return_reason}
                                        </p>
                                    )}

                                    {rev.rejection_reason && (
                                        <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                                            Rejection Reason: {rev.rejection_reason}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {rev.technical_file_url && (
                                            <a
                                                href={rev.technical_file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg hover:bg-blue-100 inline-flex items-center gap-1"
                                            >
                                                <Download className="w-3 h-3" /> Tech Doc (Rev {rev.revision_number})
                                            </a>
                                        )}
                                        {rev.quotation_file_url && (
                                            <a
                                                href={rev.quotation_file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 inline-flex items-center gap-1"
                                            >
                                                <Download className="w-3 h-3" /> Quotation (Rev {rev.revision_number})
                                            </a>
                                        )}
                                        {rev.costing_sheet_file_url && (
                                            <a
                                                href={rev.costing_sheet_file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 inline-flex items-center gap-1"
                                            >
                                                <Download className="w-3 h-3" /> Costing Sheet (Rev {rev.revision_number})
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB 3: AUDIT LOG */}
                {activeTab === 'AUDIT' && (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-400">
                            Immutable audit trail of all reviewer decisions, status transitions, and reassignments.
                        </p>

                        <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                            {(proposal.audit || []).map((a: any) => (
                                <div key={a.id} className="p-4 bg-white dark:bg-zinc-900 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-800 dark:text-white">{a.action}</span>
                                        <span className="text-[10px] text-slate-400">
                                            {a.created_at ? new Date(a.created_at).toLocaleString() : '—'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Status: <span className="font-mono text-[11px]">{a.previous_status || '—'}</span> → <span className="font-mono font-bold text-[11px] text-blue-600">{a.new_status}</span>
                                    </p>
                                    {a.remarks && (
                                        <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                                            "{a.remarks}"
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bottom Modal Action Bar */}
                <div className="mt-8 pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="text-xs text-slate-400">
                        Proposal ID: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{proposal.id.slice(0, 8)}</span>
                        {proposal.created_at && (
                            <span className="ml-2">| Registered {new Date(proposal.created_at).toLocaleDateString()}</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-sm"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Proposals</span>
                    </button>
                </div>

                {/* MODAL: UPLOAD NEW REVISION */}
                {showUploadRevision && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-zinc-800">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                    Upload Revision {(proposal.current_revision || 1) + 1}
                                </h3>
                                <button onClick={() => setShowUploadRevision(false)}>
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleUploadRevision} className="space-y-4">
                                {isTechnical ? (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            New Technical Document (PDF/DOC/ZIP) *
                                        </label>
                                        <input
                                            type="file"
                                            required
                                            accept=".pdf,.doc,.docx,.zip,.xlsx,.xls"
                                            onChange={e => setRevTechFile(e.target.files?.[0] || null)}
                                            className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                New Quotation File (PDF/DOC/Excel)
                                            </label>
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
                                                onChange={e => setRevQuoteFile(e.target.files?.[0] || null)}
                                                className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1">Leave empty to keep existing revision's quotation</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                New Costing Sheet File (Excel/PDF/CSV)
                                            </label>
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls,.pdf,.csv,.doc,.docx"
                                                onChange={e => setRevCostingFile(e.target.files?.[0] || null)}
                                                className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1">Leave empty to keep existing revision's costing sheet</p>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Revision Summary / Changes
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={revRemarks}
                                        onChange={e => setRevRemarks(e.target.value)}
                                        placeholder="Describe what changes were made in this revision..."
                                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowUploadRevision(false)}
                                        className="px-4 py-2 text-xs font-bold text-slate-500"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md"
                                    >
                                        {loading ? 'Uploading...' : 'Submit Revision'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL: REASSIGN REVIEWER */}
                {showReassign && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-zinc-800">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                    Reassign Proposal Reviewer
                                </h3>
                                <button onClick={() => setShowReassign(false)}>
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleReassignReviewer} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Select New Reviewer *
                                    </label>
                                    <select
                                        required
                                        value={newReviewerId}
                                        onChange={e => setNewReviewerId(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                    >
                                        <option value="">— Select New Reviewer —</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.designation || 'Staff'})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Mandatory Reason for Reassignment *
                                    </label>
                                    <textarea
                                        rows={2}
                                        required
                                        value={reassignReason}
                                        onChange={e => setReassignReason(e.target.value)}
                                        placeholder="e.g. Previous reviewer is on leave / domain specialization reassignment"
                                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowReassign(false)}
                                        className="px-4 py-2 text-xs font-bold text-slate-500"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md"
                                    >
                                        {loading ? 'Reassigning...' : 'Confirm Reassignment'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
