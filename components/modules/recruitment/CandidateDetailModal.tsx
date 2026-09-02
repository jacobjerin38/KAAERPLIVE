import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  X, 
  Mail, 
  Phone, 
  MapPin, 
  Linkedin, 
  Globe, 
  Briefcase, 
  GraduationCap, 
  FileText, 
  Clock, 
  Calendar, 
  Star, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Send, 
  Download, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Tag
} from 'lucide-react';

interface CandidateDetailModalProps {
  candidateId: string;
  companyId: string;
  userId?: string;
  onClose: () => void;
  onRefresh?: () => void;
  onScheduleInterview?: (applicationId: string) => void;
  onCreateOffer?: (applicationId: string, candidate: any) => void;
  onConvertToEmployee?: (candidate: any, application?: any) => void;
}

export const CandidateDetailModal: React.FC<CandidateDetailModalProps> = ({
  candidateId,
  companyId,
  userId,
  onClose,
  onRefresh,
  onScheduleInterview,
  onCreateOffer,
  onConvertToEmployee
}) => {
  const [candidate, setCandidate] = useState<any | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'resume' | 'applications' | 'notes'>('overview');
  const [savingNote, setSavingNote] = useState(false);

  const fetchCandidateData = async () => {
    setLoading(true);
    try {
      // 1. Candidate details
      const { data: cand, error: cErr } = await supabase
        .from('recruitment_candidates')
        .select('*')
        .eq('id', candidateId)
        .single();
      if (cErr) throw cErr;
      setCandidate(cand);

      // 2. Documents
      const { data: docs } = await supabase
        .from('recruitment_candidate_documents')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('version_number', { ascending: false });
      setDocuments(docs || []);

      // 3. Applications with Job titles
      const { data: apps } = await supabase
        .from('recruitment_applications')
        .select(`
          *,
          job:recruitment_jobs(id, title, location, employment_type)
        `)
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });
      setApplications(apps || []);

      // 4. Notes
      const { data: nts } = await supabase
        .from('recruitment_candidate_notes')
        .select(`
          *,
          author:profiles(id, full_name)
        `)
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });
      setNotes(nts || []);

    } catch (err: any) {
      console.error('Error fetching candidate:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (candidateId) fetchCandidateData();
  }, [candidateId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSavingNote(true);
    try {
      const { error } = await supabase
        .from('recruitment_candidate_notes')
        .insert({
          company_id: companyId,
          candidate_id: candidateId,
          content: newNote.trim(),
          author_id: userId || null,
          note_type: 'GENERAL'
        });

      if (error) throw error;
      setNewNote('');
      fetchCandidateData();
    } catch (err: any) {
      alert('Failed to add note: ' + err.message);
    } finally {
      setSavingNote(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    try {
      const { error } = await supabase
        .from('recruitment_candidates')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', candidateId);

      if (error) throw error;
      fetchCandidateData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert('Error updating candidate status: ' + err.message);
    }
  };

  if (loading || !candidate) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl text-center text-xs text-slate-400 font-bold">
          Loading candidate profile...
        </div>
      </div>
    );
  }

  const latestDoc = documents[0];
  const primaryApplication = applications[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-5xl w-full h-[90vh] shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        
        {/* Header Profile Summary */}
        <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white font-black text-xl flex items-center justify-center shadow-md">
              {candidate.first_name?.[0] || 'C'}{candidate.last_name?.[0] || ''}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {candidate.first_name} {candidate.last_name}
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300">
                  {candidate.candidate_code || 'CAN-001'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  candidate.status === 'HIRED' ? 'bg-emerald-100 text-emerald-800' :
                  candidate.status === 'TALENT_POOL' ? 'bg-purple-100 text-purple-800' :
                  candidate.status === 'DO_NOT_CONTACT' ? 'bg-rose-100 text-rose-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {candidate.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                {candidate.email && (
                  <span className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {candidate.email}
                  </span>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {candidate.phone}
                  </span>
                )}
                {candidate.current_location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {candidate.current_location}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {candidate.status !== 'HIRED' && (
              <button
                onClick={() => onConvertToEmployee && onConvertToEmployee(candidate, primaryApplication)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <UserCheck className="w-4 h-4" /> Convert to Employee
              </button>
            )}

            {primaryApplication && (
              <button
                onClick={() => onCreateOffer && onCreateOffer(primaryApplication.id, candidate)}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Briefcase className="w-4 h-4" /> Release Offer
              </button>
            )}

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'overview' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Overview & Profile
          </button>
          <button
            onClick={() => setActiveTab('resume')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'resume' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Resume Text ({documents.length})
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'applications' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" /> Applications ({applications.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'notes' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Recruiter Timeline ({notes.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Professional Headline */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800">
                  <div className="text-[11px] font-bold text-slate-400">Total Experience</div>
                  <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-1">
                    {candidate.total_experience_years || 0} Years
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{candidate.current_title || 'Professional'}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800">
                  <div className="text-[11px] font-bold text-slate-400">Highest Education</div>
                  <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-1">
                    {candidate.highest_education || 'Degree on File'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">{candidate.education_institution || '—'}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800">
                  <div className="text-[11px] font-bold text-slate-400">Notice Period</div>
                  <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-1">
                    {candidate.notice_period_days || 30} Days
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Availability</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800">
                  <div className="text-[11px] font-bold text-slate-400">Expected Salary</div>
                  <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-1">
                    {candidate.expected_salary ? `${candidate.expected_salary} ${candidate.currency || 'QAR'}` : 'Negotiable'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Current: {candidate.current_salary || 'Undisclosed'}
                  </div>
                </div>
              </div>

              {/* Skills Tag Cloud */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-500" /> Extracted & Verified Skills
                </h3>
                <div className="flex flex-wrap gap-1.5 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800">
                  {(candidate.tags || []).map((t: string, idx: number) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                      {t}
                    </span>
                  ))}
                  {(!candidate.tags || candidate.tags.length === 0) && (
                    <span className="text-xs text-slate-400 italic">No skills tagged.</span>
                  )}
                </div>
              </div>

              {/* Links & Socials */}
              <div className="flex flex-wrap gap-4 pt-2">
                {candidate.linkedin_url && (
                  <a
                    href={candidate.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs font-bold text-blue-600 flex items-center gap-1.5 hover:bg-slate-50"
                  >
                    <Linkedin className="w-3.5 h-3.5" /> LinkedIn Profile
                  </a>
                )}
                {candidate.portfolio_url && (
                  <a
                    href={candidate.portfolio_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-50"
                  >
                    <Globe className="w-3.5 h-3.5" /> Portfolio / Website
                  </a>
                )}
              </div>

              {/* Status Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Talent Pool Actions:</span>
                <button
                  onClick={() => handleUpdateStatus('ACTIVE')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Active Pipeline
                </button>
                <button
                  onClick={() => handleUpdateStatus('TALENT_POOL')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-purple-100 hover:bg-purple-200 text-purple-700"
                >
                  Save to Talent Pool
                </button>
                <button
                  onClick={() => handleUpdateStatus('DO_NOT_CONTACT')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-rose-100 hover:bg-rose-200 text-rose-700"
                >
                  Do Not Contact
                </button>
              </div>
            </div>
          )}

          {activeTab === 'resume' && (
            <div className="space-y-4">
              {latestDoc ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <FileText className="w-4 h-4 text-amber-500" />
                      <span>{latestDoc.file_name}</span>
                      <span className="text-slate-400 font-normal">({latestDoc.file_type} • Version {latestDoc.version_number})</span>
                    </div>

                    {latestDoc.file_path && !latestDoc.file_path.startsWith('local://') && (
                      <a
                        href={latestDoc.file_path}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Original
                      </a>
                    )}
                  </div>

                  <div className="p-5 bg-slate-900 text-slate-100 rounded-2xl font-mono text-xs max-h-[500px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {latestDoc.extracted_text || 'No text extracted for this document.'}
                  </div>
                </div>
              ) : (
                <div className="text-center p-12 text-xs text-slate-400">
                  No resume documents on file for this candidate.
                </div>
              )}
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="space-y-4">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {app.job?.title || 'Job Opening'}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        {app.stage}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                      <span>Applied: {new Date(app.applied_at || app.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Fit Score: <strong className="text-slate-800 dark:text-slate-200">{app.match_score}%</strong></span>
                    </div>

                    {app.match_details?.reasons && (
                      <div className="mt-2 space-y-1">
                        {app.match_details.reasons.map((r: any, idx: number) => (
                          <div key={idx} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <span className={r.status === 'success' ? 'text-emerald-500' : 'text-amber-500'}>●</span>
                            {r.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onScheduleInterview && onScheduleInterview(app.id)}
                      className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shadow-sm flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5" /> Schedule Round
                    </button>
                    <button
                      onClick={() => onCreateOffer && onCreateOffer(app.id, candidate)}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-lg transition"
                    >
                      Offer
                    </button>
                  </div>
                </div>
              ))}

              {applications.length === 0 && (
                <div className="text-center p-12 text-xs text-slate-400">
                  No active job applications. Candidate is in general talent pool.
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  rows={3}
                  placeholder="Log recruiter notes, phone screen impressions, or salary feedback..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full p-3 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl text-xs"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingNote || !newNote.trim()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> Add Note
                  </button>
                </div>
              </form>

              <div className="space-y-3 pt-3">
                {notes.map((n) => (
                  <div key={n.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{n.author?.full_name || 'Recruiter'}</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                      {n.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
