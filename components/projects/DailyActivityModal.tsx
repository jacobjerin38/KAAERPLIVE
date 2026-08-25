import React, { useState } from 'react';
import { 
    X, Upload, Image, FileText, CheckCircle2, AlertCircle, 
    Calendar, User, MapPin, Users, TrendingUp, AlertTriangle, ShieldCheck 
} from 'lucide-react';
import { createDailyActivity, reviewDailyActivity } from './projectService';
import { useAuth } from '../../contexts/AuthContext';

interface DailyActivityModalProps {
    project: any;
    activity?: any | null; // If provided, view/review mode
    onClose: () => void;
    onSuccess: () => void;
}

export const DailyActivityModal: React.FC<DailyActivityModalProps> = ({
    project,
    activity,
    onClose,
    onSuccess
}) => {
    const { currentCompanyId, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isViewMode = !!activity;

    // Supervisor Create State
    const [supervisorId, setSupervisorId] = useState(
        project.supervisors?.find((s: any) => s.is_active)?.employee?.id || ''
    );
    const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
    const [workArea, setWorkArea] = useState('');
    const [activityDescription, setActivityDescription] = useState('');
    const [plannedWork, setPlannedWork] = useState('');
    const [completedWork, setCompletedWork] = useState('');
    const [plannedQuantity, setPlannedQuantity] = useState('');
    const [completedQuantity, setCompletedQuantity] = useState('');
    const [workerCount, setWorkerCount] = useState('1');
    const [progressPct, setProgressPct] = useState(String(project.completion_pct || 0));
    const [issues, setIssues] = useState('');
    const [delayReason, setDelayReason] = useState('');
    const [risk, setRisk] = useState('');
    const [safetyObservation, setSafetyObservation] = useState('');
    const [remarks, setRemarks] = useState('');
    const [photos, setPhotos] = useState<File[]>([]);
    const [docs, setDocs] = useState<File[]>([]);

    // Review Mode State
    const [reviewRemarks, setReviewRemarks] = useState('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId || !user) return;

        if (!supervisorId || !activityDate || !workArea.trim() || !activityDescription.trim()) {
            setError('Please fill in all mandatory activity fields.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await createDailyActivity({
                companyId: currentCompanyId,
                projectId: project.id,
                supervisorId,
                activityDate,
                workArea: workArea.trim(),
                activityDescription: activityDescription.trim(),
                plannedWork: plannedWork.trim() || undefined,
                completedWork: completedWork.trim() || undefined,
                plannedQuantity: plannedQuantity ? Number(plannedQuantity) : undefined,
                completedQuantity: completedQuantity ? Number(completedQuantity) : undefined,
                workerCount: Number(workerCount) || 0,
                progressPct: Number(progressPct) || 0,
                issues: issues.trim() || undefined,
                delayReason: delayReason.trim() || undefined,
                risk: risk.trim() || undefined,
                safetyObservation: safetyObservation.trim() || undefined,
                remarks: remarks.trim() || undefined,
                photos,
                documents: docs,
                createdBy: user.id
            });

            onSuccess();
        } catch (err: any) {
            console.error('Error logging daily activity:', err);
            setError(err.message || 'Failed to log daily activity');
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (action: 'REVIEWED' | 'RETURNED' | 'APPROVED') => {
        if (!currentCompanyId || !user || !activity) return;

        setLoading(true);
        setError(null);

        try {
            await reviewDailyActivity({
                companyId: currentCompanyId,
                projectId: project.id,
                activityId: activity.id,
                action,
                remarks: reviewRemarks.trim() || undefined,
                actorId: user.id
            });

            onSuccess();
        } catch (err: any) {
            console.error('Error reviewing activity:', err);
            setError(err.message || 'Failed to review activity');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl relative animate-slide-up border border-slate-100 dark:border-zinc-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                Site Execution
                            </span>
                            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                                {isViewMode ? 'Daily Activity Record & Review' : 'Log Daily Site Activity'}
                            </h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            {project.name}
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {isViewMode ? (
                    /* VIEW / REVIEW MODE */
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-100 dark:border-zinc-800">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Date</span>
                                <p className="text-xs font-bold text-slate-800 dark:text-white mt-0.5">{activity.activity_date}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Supervisor</span>
                                <p className="text-xs font-bold text-slate-800 dark:text-white mt-0.5">{activity.supervisor?.name || '—'}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Work Area</span>
                                <p className="text-xs font-bold text-slate-800 dark:text-white mt-0.5">{activity.work_area}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Workers & Progress</span>
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
                                    {activity.worker_count} Staff | {activity.progress_pct}% Done
                                </p>
                            </div>
                        </div>

                        <div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Activity Description</span>
                            <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-100 dark:border-zinc-800 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                                {activity.activity_description}
                            </div>
                        </div>

                        {(activity.planned_work || activity.completed_work) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 dark:bg-zinc-800/30 rounded-xl border border-slate-100 dark:border-zinc-800">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Planned Work</span>
                                    <p className="text-xs text-slate-700 dark:text-slate-300">{activity.planned_work || '—'}</p>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-zinc-800/30 rounded-xl border border-slate-100 dark:border-zinc-800">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Completed Work</span>
                                    <p className="text-xs text-slate-700 dark:text-slate-300">{activity.completed_work || '—'}</p>
                                </div>
                            </div>
                        )}

                        {activity.issues && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl">
                                <span className="text-[10px] font-bold text-amber-600 uppercase block mb-1">Site Issues / Delays</span>
                                <p className="text-xs text-amber-800 dark:text-amber-300">{activity.issues}</p>
                            </div>
                        )}

                        {activity.safety_observation && (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl">
                                <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">Safety Observation</span>
                                <p className="text-xs text-emerald-800 dark:text-emerald-300">{activity.safety_observation}</p>
                            </div>
                        )}

                        {/* Attached Photos / Documents */}
                        {activity.docs && activity.docs.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">Site Photos & Documents</span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {activity.docs.map((doc: any) => (
                                        <a
                                            key={doc.id}
                                            href={doc.file_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 flex items-center gap-2 hover:border-blue-500 transition-colors"
                                        >
                                            {doc.file_type === 'PHOTO' ? <Image className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-emerald-500" />}
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{doc.file_name || 'View File'}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Review Action Panel for PM / Project Head */}
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900 space-y-3">
                            <span className="text-xs font-bold text-blue-800 dark:text-blue-300 block">Manager Activity Review</span>
                            <textarea
                                rows={2}
                                value={reviewRemarks}
                                onChange={e => setReviewRemarks(e.target.value)}
                                placeholder="Add review feedback or instructions to supervisor..."
                                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => handleReview('RETURNED')}
                                    className="px-3.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
                                >
                                    Return with Comments
                                </button>
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => handleReview('APPROVED')}
                                    className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
                                >
                                    Approve Activity
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* CREATE MODE */
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Supervisor <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    required
                                    value={supervisorId}
                                    onChange={e => setSupervisorId(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                >
                                    {(project.supervisors || []).map((s: any) => {
                                        const empId = s.employee?.id || s.employee_id;
                                        const empName = s.employee?.name || s.role || 'Supervisor';
                                        return (
                                            <option key={s.id || empId} value={empId}>
                                                {empName} ({s.responsibilities || 'Supervisor'})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Activity Date <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={activityDate}
                                    onChange={e => setActivityDate(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Work Area / Bay / Room <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={workArea}
                                    onChange={e => setWorkArea(e.target.value)}
                                    placeholder="e.g. Switchgear Room 2 / Feeder 4"
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Workers On Site (Headcount)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={workerCount}
                                    onChange={e => setWorkerCount(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Total Progress % (0 - 100)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={progressPct}
                                    onChange={e => setProgressPct(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Activity Description <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                rows={2}
                                required
                                value={activityDescription}
                                onChange={e => setActivityDescription(e.target.value)}
                                placeholder="Describe work executed on site today..."
                                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Site Issues / Delays / Roadblocks
                                </label>
                                <textarea
                                    rows={2}
                                    value={issues}
                                    onChange={e => setIssues(e.target.value)}
                                    placeholder="Any client delays, access restrictions, or missing parts..."
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Safety Observations / Toolbox Talk
                                </label>
                                <textarea
                                    rows={2}
                                    value={safetyObservation}
                                    onChange={e => setSafetyObservation(e.target.value)}
                                    placeholder="Toolbox talk conducted, PPE compliance, hazards mitigated..."
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* File Uploads */}
                        <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                Attach Site Photos & Inspection Records
                            </label>
                            <input
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx"
                                onChange={e => {
                                    const files = Array.from(e.target.files || []);
                                    setPhotos(files.filter(f => f.type.startsWith('image/')));
                                    setDocs(files.filter(f => !f.type.startsWith('image/')));
                                }}
                                className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-bold text-slate-500"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md"
                            >
                                {loading ? 'Submitting Activity...' : 'Submit Daily Activity Log'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
