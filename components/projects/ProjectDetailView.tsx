import React, { useState } from 'react';
import { 
    ArrowLeft, Lock, Unlock, Download, Upload, CheckCircle2, AlertCircle, 
    Clock, Shield, User, Users, Calendar, Building2, FileText, AlertTriangle, 
    Plus, Check, Eye, Trash2, Printer, RefreshCw, X, ShieldAlert, CheckSquare, Layers
} from 'lucide-react';
import { 
    uploadRequiredDoc, submitProjectForHeadApproval, reviewProjectHeadApproval, 
    assignSupervisor, removeSupervisor, submitProjectCompletion, 
    reviewProjectCompletion, reopenProject, createProjectIssue, 
    createProjectRisk, createSafetyObservation, updateProjectIssue
} from './projectService';
import { DailyActivityModal } from './DailyActivityModal';
import { ProjectReportModal } from './ProjectReportModal';
import { useAuth } from '../../contexts/AuthContext';

interface ProjectDetailViewProps {
    project: any;
    employees: any[];
    onBack: () => void;
    onRefresh: () => void;
}

const MANDATORY_DOC_TYPES = [
    { type: 'METHOD_STATEMENT', label: 'Method Statement (MS)', desc: 'Detailed step-by-step execution methodology & sequence' },
    { type: 'ITP', label: 'Inspection & Test Plan (ITP)', desc: 'Quality verification hold-points and acceptance criteria' },
    { type: 'EXECUTION_PLAN', label: 'Project Execution Plan (PEP)', desc: 'Site management, schedule milestones & resources' },
    { type: 'JHA', label: 'Job Hazard Analysis (JHA)', desc: 'Site hazard identification and risk control measures' },
    { type: 'TECHNICAL_DATA_SHEET', label: 'Technical Data Sheets (TDS)', desc: 'Equipment specs, materials, and catalog cuts' },
    { type: 'SDS', label: 'Safety Data Sheets (SDS / MSDS)', desc: 'Chemical hazard, handling & storage safety guidelines' }
];

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
    project,
    employees,
    onBack,
    onRefresh
}) => {
    const { currentCompanyId, user } = useAuth();
    const [activeTab, setActiveTab] = useState<
        'OVERVIEW' | 'DOCUMENTS' | 'SUPERVISORS' | 'ACTIVITIES' | 'ISSUES' | 'SAFETY' | 'COMPLETION' | 'AUDIT'
    >('OVERVIEW');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modals
    const [showReportModal, setShowReportModal] = useState(false);
    const [showDailyActivityModal, setShowDailyActivityModal] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<any | null>(null);

    // Assign Supervisor Modal
    const [showAssignSupervisor, setShowAssignSupervisor] = useState(false);
    const [supEmployeeId, setSupEmployeeId] = useState('');
    const [supRole, setSupRole] = useState('Site Supervisor');
    const [supResponsibilities, setSupResponsibilities] = useState('');

    // Upload Doc Modal
    const [uploadDocType, setUploadDocType] = useState<string | null>(null);
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docConfirmed, setDocConfirmed] = useState(false);
    const [docRemarks, setDocRemarks] = useState('');

    // Project Head Review
    const [headReviewRemarks, setHeadReviewRemarks] = useState('');

    // Issue / Risk / Safety Modals
    const [showNewIssue, setShowNewIssue] = useState(false);
    const [issueTitle, setIssueTitle] = useState('');
    const [issueSeverity, setIssueSeverity] = useState('MEDIUM');
    const [issueDesc, setIssueDesc] = useState('');
    const [issueAssignedTo, setIssueAssignedTo] = useState('');

    const [showNewRisk, setShowNewRisk] = useState(false);
    const [riskTitle, setRiskTitle] = useState('');
    const [riskSeverity, setRiskSeverity] = useState('MEDIUM');
    const [riskProbability, setRiskProbability] = useState('MEDIUM');
    const [riskMitigation, setRiskMitigation] = useState('');

    const [showNewSafety, setShowNewSafety] = useState(false);
    const [safetyObs, setSafetyObs] = useState('');
    const [safetyLocation, setSafetyLocation] = useState('');
    const [safetyHazardType, setSafetyHazardType] = useState('PPE');
    const [safetyAction, setSafetyAction] = useState('');

    // Completion Request Form
    const [compReportFile, setCompReportFile] = useState<File | null>(null);
    const [clientSignoff, setClientSignoff] = useState(false);
    const [handoverComplete, setHandoverComplete] = useState(false);
    const [compRemarks, setCompRemarks] = useState('');

    // Reopen Project
    const [showReopenModal, setShowReopenModal] = useState(false);
    const [reopenReason, setReopenReason] = useState('');

    const isLocked = project.is_locked;

    // Document Helpers
    const projectDocs = project.documents || [];
    const getDocForType = (type: string) => projectDocs.find((d: any) => d.document_type === type);
    const allMandatoryConfirmed = MANDATORY_DOC_TYPES.every(m => {
        const d = getDocForType(m.type);
        return d && d.confirmed;
    });

    // 1. Submit Required Document
    const handleUploadDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId || !user || !uploadDocType || !docFile) return;

        setLoading(true);
        setError(null);

        try {
            await uploadRequiredDoc({
                companyId: currentCompanyId,
                projectId: project.id,
                documentType: uploadDocType,
                file: docFile,
                confirmed: docConfirmed,
                remarks: docRemarks.trim() || undefined,
                uploadedBy: user.id
            });

            setUploadDocType(null);
            setDocFile(null);
            setDocConfirmed(false);
            setDocRemarks('');
            onRefresh();
        } catch (err: any) {
            console.error('Error uploading document:', err);
            setError(err.message || 'Failed to upload document');
        } finally {
            setLoading(false);
        }
    };

    // 2. Submit Project to Head
    const handleSubmitToHead = async () => {
        if (!currentCompanyId || !user) return;
        setLoading(true);
        setError(null);

        try {
            await submitProjectForHeadApproval(currentCompanyId, project.id, user.id);
            onRefresh();
        } catch (err: any) {
            console.error('Error submitting project to head:', err);
            setError(err.message || 'Failed to submit to Project Head');
        } finally {
            setLoading(false);
        }
    };

    // 3. Head Review Action
    const handleHeadReview = async (action: 'APPROVE' | 'RETURN' | 'REJECT') => {
        if (!currentCompanyId || !user) return;
        if ((action === 'RETURN' || action === 'REJECT') && !headReviewRemarks.trim()) {
            setError(`Please provide mandatory remarks explaining why the project was ${action.toLowerCase()}ed.`);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await reviewProjectHeadApproval({
                companyId: currentCompanyId,
                projectId: project.id,
                action,
                remarks: headReviewRemarks.trim(),
                actorId: user.id
            });

            onRefresh();
        } catch (err: any) {
            console.error('Error in project head review:', err);
            setError(err.message || 'Failed to process Project Head review');
        } finally {
            setLoading(false);
        }
    };

    // 4. Assign Supervisor
    const handleAssignSupervisor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId || !user || !supEmployeeId) return;

        setLoading(true);
        setError(null);

        try {
            await assignSupervisor({
                companyId: currentCompanyId,
                projectId: project.id,
                employeeId: supEmployeeId,
                role: supRole,
                responsibilities: supResponsibilities.trim() || undefined,
                assignedBy: user.id
            });

            setShowAssignSupervisor(false);
            setSupEmployeeId('');
            setSupResponsibilities('');
            onRefresh();
        } catch (err: any) {
            console.error('Error assigning supervisor:', err);
            setError(err.message || 'Failed to assign supervisor');
        } finally {
            setLoading(false);
        }
    };

    // 5. Submit Completion Request
    const handleCompletionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId || !user || !compReportFile) {
            setError('Mandatory Project Completion Report document must be uploaded.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await submitProjectCompletion({
                companyId: currentCompanyId,
                projectId: project.id,
                actualCompletionDate: new Date().toISOString().split('T')[0],
                finalCompletionPct: 100,
                completionSummary: compRemarks.trim() || 'Project successfully executed and ready for handover.',
                completionReportFile: compReportFile,
                submittedBy: user.id
            });

            setCompReportFile(null);
            setCompRemarks('');
            onRefresh();
        } catch (err: any) {
            console.error('Error submitting completion request:', err);
            setError(err.message || 'Failed to submit completion request');
        } finally {
            setLoading(false);
        }
    };

    // 6. Review Completion Request
    const handleCompletionReview = async (action: 'APPROVE' | 'RETURN') => {
        if (!currentCompanyId || !user) return;

        const compReqId = Array.isArray(project.completion_request)
            ? project.completion_request[0]?.id
            : project.completion_request?.id;

        if (!compReqId && action === 'RETURN') {
            setError('No active completion request record found to review.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await reviewProjectCompletion({
                companyId: currentCompanyId,
                projectId: project.id,
                completionRequestId: compReqId || project.id,
                action: action === 'APPROVE' ? 'APPROVED' : 'RETURNED',
                remarks: compRemarks.trim() || undefined,
                actorId: user.id
            });

            onRefresh();
        } catch (err: any) {
            console.error('Error reviewing completion:', err);
            setError(err.message || 'Failed to review completion request');
        } finally {
            setLoading(false);
        }
    };

    // 7. Reopen Project
    const handleReopen = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId || !user || !reopenReason.trim()) {
            setError('Please provide a mandatory reason for reopening.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await reopenProject({
                companyId: currentCompanyId,
                projectId: project.id,
                reason: reopenReason.trim(),
                actorId: user.id
            });

            setShowReopenModal(false);
            setReopenReason('');
            onRefresh();
        } catch (err: any) {
            console.error('Error reopening project:', err);
            setError(err.message || 'Failed to reopen project');
        } finally {
            setLoading(false);
        }
    };

    // 8. Create Issue
    const handleCreateIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId || !user || !issueTitle.trim()) return;

        setLoading(true);
        setError(null);

        try {
            await createProjectIssue({
                companyId: currentCompanyId,
                projectId: project.id,
                title: issueTitle.trim(),
                description: issueDesc.trim() || undefined,
                severity: issueSeverity,
                assignedTo: issueAssignedTo || undefined,
                createdBy: user.id
            });

            setShowNewIssue(false);
            setIssueTitle('');
            setIssueDesc('');
            onRefresh();
        } catch (err: any) {
            console.error('Error logging issue:', err);
            setError(err.message || 'Failed to log issue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-16">
            {/* Top Workspace Header */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                                    {project.name}
                                </h1>
                                {isLocked && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                                        <Lock className="w-3 h-3" /> Locked
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                                <span>Client: <strong>{project.client?.name || 'No Client Linked'}</strong></span>
                                <span>•</span>
                                <span>LPO: <strong className="font-mono">{project.lpo_number || '—'}</strong></span>
                                <span>•</span>
                                <span>Status: <strong className="text-blue-600 dark:text-blue-400">{project.status}</strong></span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowReportModal(true)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Export Project Report</span>
                        </button>
                        {isLocked && (
                            <button
                                onClick={() => setShowReopenModal(true)}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                            >
                                <Unlock className="w-4 h-4" />
                                <span>Reopen Project</span>
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Sub-Navigation Tabs */}
                <div className="flex gap-1 border-t border-slate-100 dark:border-zinc-800 pt-3 overflow-x-auto">
                    {[
                        { id: 'OVERVIEW', label: 'Overview & LPO' },
                        { id: 'DOCUMENTS', label: `Mandatory Docs (${(project.documents || []).filter((d: any) => d.confirmed).length}/6)` },
                        { id: 'SUPERVISORS', label: `Supervisors (${(project.supervisors || []).filter((s: any) => s.is_active).length})` },
                        { id: 'ACTIVITIES', label: `Daily Activities (${project.activities?.length || 0})` },
                        { id: 'ISSUES', label: `Issues & Risks (${(project.issues?.length || 0) + (project.risks?.length || 0)})` },
                        { id: 'SAFETY', label: `Safety (${project.safety_observations?.length || 0})` },
                        { id: 'COMPLETION', label: 'Project Completion' },
                        { id: 'AUDIT', label: `Audit Log (${project.audit?.length || 0})` },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB 1: OVERVIEW & LPO */}
            {activeTab === 'OVERVIEW' && (
                <div className="space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">LPO Total Cost</span>
                            <p className="text-xl font-mono font-black text-slate-800 dark:text-white mt-1">
                                QAR {Number(project.lpo_cost || project.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Site Completion</span>
                            <div className="flex items-center gap-3 mt-1">
                                <div className="flex-1 bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-blue-600 h-full rounded-full" 
                                        style={{ width: `${Math.min(project.completion_pct || 0, 100)}%` }} 
                                    />
                                </div>
                                <span className="text-base font-mono font-bold text-blue-600 dark:text-blue-400">
                                    {project.completion_pct || 0}%
                                </span>
                            </div>
                        </div>
                        <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Project Manager</span>
                            <p className="text-sm font-bold text-slate-800 dark:text-white mt-1">
                                {project.manager?.name || 'Unassigned'}
                            </p>
                            <p className="text-[11px] text-slate-400">{project.manager?.designation || 'Engineering Lead'}</p>
                        </div>
                        <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Schedule</span>
                            <p className="text-xs font-bold text-slate-800 dark:text-white mt-1">
                                {project.start_date || '—'} <span className="text-slate-400 font-normal">to</span> {project.end_date || '—'}
                            </p>
                        </div>
                    </div>

                    {/* Official LPO Card */}
                    <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                    Official Client LPO & Documentation
                                </h3>
                            </div>
                            {project.lpo_document_url && (
                                <a
                                    href={project.lpo_document_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Download Official LPO</span>
                                </a>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-100 dark:border-zinc-800 text-xs">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">LPO Number</span>
                                <p className="font-mono font-bold text-slate-800 dark:text-white mt-0.5">{project.lpo_number || '—'}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Cost Center</span>
                                <p className="font-bold text-slate-800 dark:text-white mt-0.5">{project.cost_center?.name || 'Standard Ops'}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Category / Type</span>
                                <p className="font-bold text-slate-800 dark:text-white mt-0.5">
                                    {project.category?.name || 'EPC'} / {project.type?.name || 'Turnkey'}
                                </p>
                            </div>
                        </div>

                        {project.remarks && (
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Execution Notes</span>
                                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-zinc-800/30 p-3 rounded-xl">
                                    {project.remarks}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Project Head Approval Action Box */}
                    {project.status === 'PENDING_PROJECT_HEAD_APPROVAL' && (
                        <div className="p-6 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900 shadow-sm space-y-4">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                    Project Head Approval Action Required
                                </h3>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                All 6 mandatory execution documents have been confirmed. Review the project documents and approve to transition project into active site execution.
                            </p>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Review Remarks (Mandatory for Return or Rejection)
                                </label>
                                <textarea
                                    rows={2}
                                    value={headReviewRemarks}
                                    onChange={e => setHeadReviewRemarks(e.target.value)}
                                    placeholder="Add approval comments or return notes..."
                                    className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => handleHeadReview('RETURN')}
                                    className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm"
                                >
                                    Return for Correction
                                </button>
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => handleHeadReview('REJECT')}
                                    className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm"
                                >
                                    Reject Project
                                </button>
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => handleHeadReview('APPROVE')}
                                    className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md flex items-center gap-1.5"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Approve Project for Execution</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Submit for Approval Button (When in DRAFT or CORRECTION_REQUIRED and all 6 confirmed) */}
                    {(project.status === 'DRAFT' || project.status === 'CORRECTION_REQUIRED') && (
                        <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase">
                                    Project Submission Readiness
                                </h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {allMandatoryConfirmed 
                                        ? 'All 6 mandatory documents are uploaded and confirmed. Ready to submit to Project Head.'
                                        : 'Upload and confirm all 6 mandatory execution documents in the "Mandatory Docs" tab before submitting.'}
                                </p>
                            </div>
                            <button
                                disabled={!allMandatoryConfirmed || loading}
                                onClick={handleSubmitToHead}
                                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 ${
                                    allMandatoryConfirmed && !loading
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                <CheckSquare className="w-4 h-4" />
                                <span>Submit for Project Head Approval</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: MANDATORY DOCUMENTS */}
            {activeTab === 'DOCUMENTS' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-2">
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                            Mandatory Execution Documents (6 Required)
                        </h3>
                        <p className="text-xs text-slate-400">
                            Project execution requires 100% compliance. All 6 document types must be uploaded, version-tracked, and confirmed before site execution can commence.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {MANDATORY_DOC_TYPES.map((m) => {
                            const doc = getDocForType(m.type);
                            const isConfirmed = doc?.confirmed;

                            return (
                                <div 
                                    key={m.type}
                                    className={`p-5 rounded-2xl border transition-all ${
                                        isConfirmed
                                            ? 'bg-white dark:bg-zinc-900 border-emerald-200 dark:border-emerald-900/60 shadow-sm'
                                            : 'bg-white dark:bg-zinc-900 border-amber-200 dark:border-amber-900/60 shadow-sm'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300">
                                                {m.type}
                                            </span>
                                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white mt-1">
                                                {m.label}
                                            </h4>
                                        </div>
                                        {isConfirmed ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                <Clock className="w-3.5 h-3.5" /> Pending Upload
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-xs text-slate-400 mb-4">{m.desc}</p>

                                    {doc && (
                                        <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-xl mb-4 text-xs space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Version:</span>
                                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">v{doc.version || 1}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">File Name:</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{doc.file_name || 'Document'}</span>
                                            </div>
                                            {doc.remarks && (
                                                <p className="text-slate-500 italic mt-1">"{doc.remarks}"</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
                                        {doc?.file_url ? (
                                            <a
                                                href={doc.file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                                <Download className="w-3.5 h-3.5" /> Download v{doc.version || 1}
                                            </a>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">No file uploaded</span>
                                        )}

                                        {!isLocked && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setUploadDocType(m.type);
                                                    setDocConfirmed(true);
                                                }}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1"
                                            >
                                                <Upload className="w-3 h-3" />
                                                <span>{doc ? 'Upload New Version' : 'Upload & Confirm'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 3: SUPERVISORS */}
            {activeTab === 'SUPERVISORS' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                                Assigned Site Supervisors
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Site supervisors are authorized to log daily site activities, headcount, issues, and safety records.
                            </p>
                        </div>
                        {!isLocked && (
                            <button
                                onClick={() => setShowAssignSupervisor(true)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Assign Supervisor</span>
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {(project.supervisors || []).map((s: any) => (
                            <div 
                                key={s.id}
                                className={`p-5 bg-white dark:bg-zinc-900 rounded-2xl border shadow-sm space-y-3 ${
                                    s.is_active ? 'border-slate-200/80 dark:border-zinc-800' : 'border-slate-100 dark:border-zinc-800/40 opacity-60'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold text-sm">
                                            {s.employee?.name?.charAt(0) || 'S'}
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{s.employee?.name}</h4>
                                            <p className="text-[11px] text-slate-400">{s.role || 'Supervisor'}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        s.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {s.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                {s.responsibilities && (
                                    <p className="text-xs text-slate-500 bg-slate-50 dark:bg-zinc-800/40 p-2.5 rounded-xl">
                                        {s.responsibilities}
                                    </p>
                                )}

                                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-400">
                                    <span>Assigned: {s.assigned_at ? new Date(s.assigned_at).toLocaleDateString() : '—'}</span>
                                    {s.is_active && !isLocked && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (confirm(`Deactivate ${s.employee?.name}?`)) {
                                                    await removeSupervisor(s.id, project.id, currentCompanyId!, user!.id);
                                                    onRefresh();
                                                }
                                            }}
                                            className="text-rose-600 hover:underline font-bold"
                                        >
                                            Deactivate
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 4: DAILY ACTIVITIES */}
            {activeTab === 'ACTIVITIES' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                                Daily Site Execution Activities
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Logged by site supervisors with progress %, manpower count, and site photos.
                            </p>
                        </div>
                        {!isLocked && (
                            <button
                                onClick={() => {
                                    setSelectedActivity(null);
                                    setShowDailyActivityModal(true);
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Log Daily Activity</span>
                            </button>
                        )}
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                        {(project.activities || []).length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Calendar className="w-10 h-10 mx-auto opacity-30 mb-2" />
                                <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No Daily Activity Logs Yet</p>
                                <p className="text-xs mt-1">Supervisors can log daily progress, manpower count, and issues.</p>
                            </div>
                        ) : (
                            (project.activities || []).map((act: any) => (
                                <div
                                    key={act.id}
                                    onClick={() => {
                                        setSelectedActivity(act);
                                        setShowDailyActivityModal(true);
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
                                                    {act.work_area} — {act.supervisor?.name || 'Supervisor'}
                                                </h4>
                                                <p className="text-[11px] text-slate-400">
                                                    {act.worker_count} Workers • Progress: <strong className="text-blue-600">{act.progress_pct}%</strong>
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            act.review_status === 'APPROVED'
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                : act.review_status === 'RETURNED'
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                    : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400'
                                        }`}>
                                            {act.review_status || 'SUBMITTED'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{act.activity_description}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 5: ISSUES & RISKS */}
            {activeTab === 'ISSUES' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Project Issues */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Issues Log</h3>
                                {!isLocked && (
                                    <button
                                        onClick={() => setShowNewIssue(true)}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Log Issue</span>
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {(project.issues || []).map((iss: any) => (
                                    <div key={iss.id} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-2">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{iss.title}</h4>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                iss.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {iss.severity}
                                            </span>
                                        </div>
                                        {iss.description && <p className="text-xs text-slate-500">{iss.description}</p>}
                                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-zinc-800 text-[11px]">
                                            <span className="text-slate-400">Status: <strong>{iss.status}</strong></span>
                                            {iss.status !== 'RESOLVED' && !isLocked && (
                                                <button
                                                    onClick={async () => {
                                                        const res = prompt('Enter resolution notes:');
                                                        if (res) {
                                                            await updateProjectIssue({
                                                                issueId: iss.id,
                                                                status: 'RESOLVED',
                                                                resolution: res,
                                                                updatedBy: user!.id
                                                            });
                                                            onRefresh();
                                                        }
                                                    }}
                                                    className="text-emerald-600 font-bold hover:underline"
                                                >
                                                    Mark Resolved
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Project Risks */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Risk Matrix</h3>
                                {!isLocked && (
                                    <button
                                        onClick={() => setShowNewRisk(true)}
                                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Risk</span>
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {(project.risks || []).map((r: any) => (
                                    <div key={r.id} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-2">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{r.title}</h4>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                                Prob: {r.probability} / Sev: {r.severity}
                                            </span>
                                        </div>
                                        {r.mitigation_plan && (
                                            <p className="text-xs text-slate-500 bg-slate-50 dark:bg-zinc-800/40 p-2.5 rounded-xl">
                                                <strong>Mitigation:</strong> {r.mitigation_plan}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 6: SAFETY OBSERVATIONS */}
            {activeTab === 'SAFETY' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                                HSE & Safety Observations
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Site safety audits, unsafe act/condition reporting, and corrective action tracking.
                            </p>
                        </div>
                        {!isLocked && (
                            <button
                                onClick={() => setShowNewSafety(true)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Record Safety Observation</span>
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {(project.safety_observations || []).map((so: any) => (
                            <div key={so.id} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-2">
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                        {so.hazard_type || 'Safety'}
                                    </span>
                                    <span className="text-[11px] text-slate-400">{so.observation_date}</span>
                                </div>
                                <p className="text-xs font-bold text-slate-800 dark:text-white">{so.observation}</p>
                                {so.corrective_action && (
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-xl">
                                        <strong>Action:</strong> {so.corrective_action}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 7: PROJECT COMPLETION */}
            {activeTab === 'COMPLETION' && (
                <div className="space-y-6">
                    {/* Completion Status Card */}
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                                    Project Closeout & Completion Verification
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Finalizing a project requires a signed Completion Report, verified client handover, and Project Head signoff. Once completed, all project records are locked.
                                </p>
                            </div>
                            {project.status === 'COMPLETED' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    <CheckCircle2 className="w-4 h-4" /> Project Closed & Handed Over
                                </span>
                            ) : project.status === 'COMPLETION_REQUESTED' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                                    <Clock className="w-4 h-4" /> Pending Project Head Completion Review
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                    <Clock className="w-4 h-4" /> In Site Execution ({project.completion_pct || 0}%)
                                </span>
                            )}
                        </div>

                        {/* Completion Review Actions for Head */}
                        {project.status === 'COMPLETION_REQUESTED' && (
                            <div className="p-5 bg-purple-50 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/40 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-purple-600" />
                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                        Project Head Final Closeout Approval
                                    </h4>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                    Review the submitted Completion Report and client handover signoff. Approving will lock this project and mark it 100% completed.
                                </p>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Closeout Remarks
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={compRemarks}
                                        onChange={e => setCompRemarks(e.target.value)}
                                        placeholder="Add completion verification notes..."
                                        className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-2.5">
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleCompletionReview('RETURN')}
                                        className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
                                    >
                                        Return for Pending Punch Items
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleCompletionReview('APPROVE')}
                                        className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md flex items-center gap-1.5"
                                    >
                                        <Lock className="w-4 h-4" />
                                        <span>Final Approve & Lock Project</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Submit Closeout Request Form */}
                        {project.status !== 'COMPLETED' && project.status !== 'COMPLETION_REQUESTED' && (
                            <form onSubmit={handleCompletionSubmit} className="p-5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-4">
                                <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                    Submit Project Completion Request
                                </h4>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Upload Final Completion / Handover Report (PDF) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="file"
                                        required
                                        accept=".pdf,.doc,.docx"
                                        onChange={e => setCompReportFile(e.target.files?.[0] || null)}
                                        className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-2 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={clientSignoff}
                                            onChange={e => setClientSignoff(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Client Signoff / TOC Received</span>
                                    </label>

                                    <label className="flex items-center gap-2 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={handoverComplete}
                                            onChange={e => setHandoverComplete(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Site Handover & Demobilization Complete</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Closeout Summary / Deliverables List
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={compRemarks}
                                        onChange={e => setCompRemarks(e.target.value)}
                                        placeholder="Summarize project achievements, testing results, warranty period..."
                                        className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                    />
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading || !compReportFile}
                                        className="px-5 py-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5"
                                    >
                                        <CheckSquare className="w-4 h-4" />
                                        <span>Submit for Completion Signoff</span>
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 8: AUDIT LOG */}
            {activeTab === 'AUDIT' && (
                <div className="space-y-4">
                    <p className="text-xs text-slate-400">
                        Complete immutable record of all project creation events, mandatory document submissions, supervisor assignments, and approvals.
                    </p>

                    <div className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                        {(project.audit || []).map((a: any) => (
                            <div key={a.id} className="p-4 space-y-1">
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
                                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{a.remarks}"</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MODAL: UPLOAD REQUIRED DOCUMENT */}
            {uploadDocType && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                Upload {MANDATORY_DOC_TYPES.find(m => m.type === uploadDocType)?.label}
                            </h3>
                            <button onClick={() => setUploadDocType(null)}>
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleUploadDoc} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Select Document File (PDF/DOC) *
                                </label>
                                <input
                                    type="file"
                                    required
                                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                                    onChange={e => setDocFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700"
                                />
                            </div>

                            <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={docConfirmed}
                                    onChange={e => setDocConfirmed(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Confirm this document is verified & approved for site use *
                                </span>
                            </label>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Version Notes / Summary
                                </label>
                                <textarea
                                    rows={2}
                                    value={docRemarks}
                                    onChange={e => setDocRemarks(e.target.value)}
                                    placeholder="e.g. Approved Revision 1 with client consultant comments incorporated..."
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setUploadDocType(null)}
                                    className="px-4 py-2 text-xs font-bold text-slate-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !docFile}
                                    className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md"
                                >
                                    {loading ? 'Uploading...' : 'Save & Confirm Document'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ASSIGN SUPERVISOR */}
            {showAssignSupervisor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                Assign Site Supervisor
                            </h3>
                            <button onClick={() => setShowAssignSupervisor(false)}>
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleAssignSupervisor} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Select Employee *
                                </label>
                                <select
                                    required
                                    value={supEmployeeId}
                                    onChange={e => setSupEmployeeId(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                >
                                    <option value="">— Select Employee —</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.designation || 'Staff'})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Site Role
                                </label>
                                <input
                                    type="text"
                                    value={supRole}
                                    onChange={e => setSupRole(e.target.value)}
                                    placeholder="e.g. Lead Electrical Site Supervisor"
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Responsibilities / Scope
                                </label>
                                <textarea
                                    rows={2}
                                    value={supResponsibilities}
                                    onChange={e => setSupResponsibilities(e.target.value)}
                                    placeholder="e.g. Switchgear commissioning, testing coordination, and daily site logs..."
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignSupervisor(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !supEmployeeId}
                                    className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md"
                                >
                                    {loading ? 'Assigning...' : 'Assign to Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: LOG ISSUE */}
            {showNewIssue && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Log Site Issue</h3>
                            <button onClick={() => setShowNewIssue(false)}>
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateIssue} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Issue Title *</label>
                                <input
                                    type="text"
                                    required
                                    value={issueTitle}
                                    onChange={e => setIssueTitle(e.target.value)}
                                    placeholder="e.g. Missing calibration certificates from vendor"
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Severity</label>
                                    <select
                                        value={issueSeverity}
                                        onChange={e => setIssueSeverity(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assign To</label>
                                    <select
                                        value={issueAssignedTo}
                                        onChange={e => setIssueAssignedTo(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                    >
                                        <option value="">— Unassigned —</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description & Impact</label>
                                <textarea
                                    rows={2}
                                    value={issueDesc}
                                    onChange={e => setIssueDesc(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3">
                                <button type="button" onClick={() => setShowNewIssue(false)} className="px-4 py-2 text-xs font-bold text-slate-500">Cancel</button>
                                <button type="submit" disabled={loading} className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md">
                                    Log Issue
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: REOPEN PROJECT */}
            {showReopenModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                Reopen Completed Project
                            </h3>
                            <button onClick={() => setShowReopenModal(false)}>
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleReopen} className="space-y-4">
                            <p className="text-xs text-slate-500">
                                Reopening will unlock the project for further daily execution logs and document updates.
                            </p>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Mandatory Reason for Reopening *
                                </label>
                                <textarea
                                    rows={3}
                                    required
                                    value={reopenReason}
                                    onChange={e => setReopenReason(e.target.value)}
                                    placeholder="e.g. Additional punch list items requested by client / warranty rework required..."
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowReopenModal(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !reopenReason.trim()}
                                    className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md"
                                >
                                    {loading ? 'Reopening...' : 'Confirm Reopen'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DAILY ACTIVITY MODAL */}
            {showDailyActivityModal && (
                <DailyActivityModal
                    project={project}
                    activity={selectedActivity}
                    onClose={() => {
                        setShowDailyActivityModal(false);
                        setSelectedActivity(null);
                    }}
                    onSuccess={() => {
                        setShowDailyActivityModal(false);
                        setSelectedActivity(null);
                        onRefresh();
                    }}
                />
            )}

            {/* REPORT MODAL */}
            {showReportModal && (
                <ProjectReportModal
                    project={project}
                    onClose={() => setShowReportModal(false)}
                />
            )}
        </div>
    );
};
