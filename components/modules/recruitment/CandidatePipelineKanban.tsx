import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { CandidateDetailModal } from './CandidateDetailModal';
import { BulkResumeUploadModal } from './BulkResumeUploadModal';
import { 
  Users, 
  Search, 
  Briefcase, 
  Filter, 
  UploadCloud, 
  Plus, 
  ChevronRight, 
  Clock, 
  Star, 
  Phone, 
  Mail, 
  MapPin, 
  UserCheck, 
  CheckCircle2, 
  XCircle,
  MoreHorizontal,
  FileText,
  Calendar,
  Layers
} from 'lucide-react';

export const PIPELINE_STAGES = [
  { key: 'APPLIED', label: 'Applied', color: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300' },
  { key: 'RESUME_SCREENING', label: 'Screening', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  { key: 'SHORTLISTED', label: 'Shortlisted', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
  { key: 'PHONE_SCREEN', label: 'Phone Screen', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300' },
  { key: 'INTERVIEW', label: 'Interview', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  { key: 'TECHNICAL_INTERVIEW', label: 'Technical Round', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' },
  { key: 'MANAGER_INTERVIEW', label: 'Manager Round', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' },
  { key: 'HR_INTERVIEW', label: 'HR Round', color: 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300' },
  { key: 'OFFER', label: 'Offer Made', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  { key: 'OFFER_ACCEPTED', label: 'Offer Accepted', color: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300' },
  { key: 'HIRED', label: 'Hired', color: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300' },
  { key: 'REJECTED', label: 'Rejected', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  { key: 'ON_HOLD', label: 'On Hold', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300' },
  { key: 'WITHDRAWN', label: 'Withdrawn', color: 'bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-slate-400' }
];

interface CandidatePipelineKanbanProps {
  companyId: string;
  userId?: string;
  jobs: any[];
  selectedJobId?: string;
  onScheduleInterview?: (applicationId: string) => void;
  onCreateOffer?: (applicationId: string, candidate: any) => void;
  onConvertToEmployee?: (candidate: any, application?: any) => void;
}

export const CandidatePipelineKanban: React.FC<CandidatePipelineKanbanProps> = ({
  companyId,
  userId,
  jobs,
  selectedJobId: initialJobId,
  onScheduleInterview,
  onCreateOffer,
  onConvertToEmployee
}) => {
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId || 'ALL');
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  useEffect(() => {
    if (initialJobId) setSelectedJobId(initialJobId);
  }, [initialJobId]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('recruitment_applications')
        .select(`
          *,
          candidate:recruitment_candidates(*),
          job:recruitment_jobs(id, title, location, employment_type)
        `)
        .eq('company_id', companyId)
        .order('stage_entered_at', { ascending: false });

      if (selectedJobId && selectedJobId !== 'ALL') {
        query = query.eq('job_id', selectedJobId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setApplications(data || []);
    } catch (err: any) {
      console.error('Error fetching applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchApplications();
  }, [companyId, selectedJobId]);

  const handleMoveStage = async (appId: string, oldStage: string, newStage: string) => {
    let rejectionReason = null;
    if (newStage === 'REJECTED') {
      rejectionReason = prompt('Enter rejection reason (optional):');
    }

    try {
      const { error: appErr } = await supabase
        .from('recruitment_applications')
        .update({
          stage: newStage,
          stage_entered_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          status: newStage === 'HIRED' ? 'HIRED' : newStage === 'REJECTED' ? 'REJECTED' : 'ACTIVE'
        })
        .eq('id', appId);

      if (appErr) throw appErr;

      // Log stage audit
      await supabase.from('recruitment_stage_history').insert({
        company_id: companyId,
        application_id: appId,
        old_stage: oldStage,
        new_stage: newStage,
        changed_by: userId || null,
        reason_or_notes: rejectionReason || `Moved from ${oldStage} to ${newStage}`
      });

      fetchApplications();
    } catch (err: any) {
      alert('Error updating stage: ' + err.message);
    }
  };

  const filteredApps = applications.filter(app => {
    const c = app.candidate;
    if (!c) return false;
    const q = search.toLowerCase();
    return (
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.tags?.some((t: string) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
            <Briefcase className="w-4 h-4 text-amber-500" /> Opening:
          </span>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full max-w-sm px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Active Openings ({jobs.length})</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate, skill, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs w-64 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setIsBulkUploadOpen(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <UploadCloud className="w-3.5 h-3.5" /> Bulk Import
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Kanban Columns */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-[2400px]">
          {PIPELINE_STAGES.map((stage) => {
            const stageApps = filteredApps.filter(a => a.stage === stage.key);

            return (
              <div
                key={stage.key}
                className="w-72 flex-shrink-0 bg-slate-50/80 dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800 p-3 flex flex-col max-h-[75vh]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {stage.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${stage.color}`}>
                      {stageApps.length}
                    </span>
                  </div>
                </div>

                {/* Candidate Cards */}
                <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
                  {stageApps.map((app) => {
                    const c = app.candidate;
                    if (!c) return null;

                    const daysInStage = Math.max(
                      0,
                      Math.floor((Date.now() - new Date(app.stage_entered_at || app.created_at).getTime()) / (1000 * 60 * 60 * 24))
                    );

                    return (
                      <div
                        key={app.id}
                        className="bg-white dark:bg-zinc-850 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-3.5 shadow-xs hover:shadow-md transition-all space-y-2 cursor-pointer group"
                        onClick={() => setActiveCandidateId(c.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition">
                              {c.first_name} {c.last_name}
                            </h4>
                            <div className="text-[10px] text-slate-400 truncate max-w-[170px]">
                              {c.current_title || 'Candidate'}
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            app.match_score >= 80 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                            app.match_score >= 50 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                            'bg-slate-100 text-slate-600 dark:bg-zinc-800'
                          }`}>
                            {app.match_score}%
                          </span>
                        </div>

                        {selectedJobId === 'ALL' && app.job && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold truncate flex items-center gap-1">
                            <Briefcase className="w-2.5 h-2.5" /> {app.job.title}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                          <span>{c.total_experience_years || 0} yrs exp</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {daysInStage === 0 ? 'Today' : `${daysInStage}d`}
                          </span>
                        </div>

                        {c.tags && c.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {c.tags.slice(0, 2).map((t: string, idx: number) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[9px] text-slate-600 dark:text-slate-300 font-medium">
                                {t}
                              </span>
                            ))}
                            {c.tags.length > 2 && (
                              <span className="text-[9px] text-slate-400">+{c.tags.length - 2}</span>
                            )}
                          </div>
                        )}

                        {/* Stage Action Controls */}
                        <div 
                          className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={app.stage}
                            onChange={(e) => handleMoveStage(app.id, app.stage, e.target.value)}
                            className="text-[10px] font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-300"
                          >
                            {PIPELINE_STAGES.map(s => (
                              <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1">
                            {(app.stage === 'INTERVIEW' || app.stage === 'TECHNICAL_INTERVIEW' || app.stage === 'MANAGER_INTERVIEW') && (
                              <button
                                onClick={() => onScheduleInterview && onScheduleInterview(app.id)}
                                title="Schedule Interview Round"
                                className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {(app.stage === 'OFFER' || app.stage === 'OFFER_ACCEPTED') && (
                              <button
                                onClick={() => onCreateOffer && onCreateOffer(app.id, c)}
                                title="Offer Details"
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {(app.stage === 'HIRED' || app.stage === 'OFFER_ACCEPTED') && (
                              <button
                                onClick={() => onConvertToEmployee && onConvertToEmployee(c, app)}
                                title="Convert Candidate to HRMS Employee"
                                className="p-1 text-green-700 hover:bg-green-50 rounded font-bold"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {stageApps.length === 0 && (
                    <div className="p-4 text-center text-[11px] text-slate-400 italic">
                      No candidates in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Candidate Detail Modal */}
      {activeCandidateId && (
        <CandidateDetailModal
          candidateId={activeCandidateId}
          companyId={companyId}
          userId={userId}
          onClose={() => setActiveCandidateId(null)}
          onRefresh={fetchApplications}
          onScheduleInterview={onScheduleInterview}
          onCreateOffer={onCreateOffer}
          onConvertToEmployee={onConvertToEmployee}
        />
      )}

      {/* Bulk Upload Modal */}
      {isBulkUploadOpen && (
        <BulkResumeUploadModal
          companyId={companyId}
          userId={userId}
          jobs={jobs}
          initialJobId={selectedJobId !== 'ALL' ? selectedJobId : undefined}
          onClose={() => setIsBulkUploadOpen(false)}
          onSuccess={() => {
            setIsBulkUploadOpen(false);
            fetchApplications();
          }}
        />
      )}
    </div>
  );
};
