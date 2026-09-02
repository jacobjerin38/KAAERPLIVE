import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { InterviewEvaluationModal } from './InterviewEvaluationModal';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Video, 
  MapPin, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Award, 
  UserCheck, 
  X, 
  Loader2,
  Briefcase
} from 'lucide-react';

interface InterviewManagementProps {
  companyId: string;
  userId?: string;
  employees: { id: string; name: string }[];
  preselectedApplicationId?: string;
  onClearPreselectedApplication?: () => void;
}

export const InterviewManagement: React.FC<InterviewManagementProps> = ({
  companyId,
  userId,
  employees,
  preselectedApplicationId,
  onClearPreselectedApplication
}) => {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [scorecards, setScorecards] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [evaluationInterview, setEvaluationInterview] = useState<any | null>(null);

  // Scheduling Form
  const [scheduleForm, setScheduleForm] = useState({
    application_id: preselectedApplicationId || '',
    round_number: 1,
    round_name: 'Technical Round 1',
    interview_type: 'TECHNICAL',
    scheduled_date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
    end_time: '11:00',
    meeting_link: '',
    location: 'Head Office, Doha',
    interviewer_ids: [] as string[],
    scorecard_id: '',
    notes: ''
  });

  const fetchInterviews = async () => {
    setLoading(true);
    try {
      // 1. Fetch Interviews
      const { data: ints, error: iErr } = await supabase
        .from('recruitment_interviews')
        .select(`
          *,
          application:recruitment_applications(
            id,
            stage,
            candidate:recruitment_candidates(id, first_name, last_name, email, phone),
            job:recruitment_jobs(id, title)
          ),
          scorecard:recruitment_scorecards(id, name, criteria),
          evaluations:recruitment_interview_evaluations(*)
        `)
        .eq('company_id', companyId)
        .order('scheduled_date', { ascending: false });

      if (iErr) throw iErr;
      setInterviews(ints || []);

      // 2. Fetch Scorecard templates
      const { data: scs } = await supabase
        .from('recruitment_scorecards')
        .select('*')
        .eq('company_id', companyId);
      setScorecards(scs || []);

      // 3. Fetch active applications for scheduling
      const { data: apps } = await supabase
        .from('recruitment_applications')
        .select(`
          id,
          candidate:recruitment_candidates(first_name, last_name),
          job:recruitment_jobs(title)
        `)
        .eq('company_id', companyId)
        .not('stage', 'in', '("HIRED","REJECTED")');
      setApplications(apps || []);

    } catch (err: any) {
      console.error('Error fetching interview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchInterviews();
  }, [companyId]);

  useEffect(() => {
    if (preselectedApplicationId) {
      setScheduleForm(prev => ({ ...prev, application_id: preselectedApplicationId }));
      setIsScheduleOpen(true);
    }
  }, [preselectedApplicationId]);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.application_id || !scheduleForm.scheduled_date) {
      alert('Please select candidate application and interview date.');
      return;
    }

    try {
      const { error } = await supabase
        .from('recruitment_interviews')
        .insert({
          company_id: companyId,
          application_id: scheduleForm.application_id,
          round_number: scheduleForm.round_number,
          round_name: scheduleForm.round_name,
          interview_type: scheduleForm.interview_type,
          scheduled_date: scheduleForm.scheduled_date,
          start_time: scheduleForm.start_time,
          end_time: scheduleForm.end_time,
          meeting_link: scheduleForm.meeting_link || null,
          location: scheduleForm.location || null,
          interviewer_ids: scheduleForm.interviewer_ids,
          scorecard_id: scheduleForm.scorecard_id || null,
          notes: scheduleForm.notes || null,
          status: 'SCHEDULED'
        });

      if (error) throw error;

      // Update application stage to INTERVIEW or TECHNICAL_INTERVIEW
      await supabase
        .from('recruitment_applications')
        .update({
          stage: scheduleForm.interview_type === 'TECHNICAL' ? 'TECHNICAL_INTERVIEW' : 'INTERVIEW',
          stage_entered_at: new Date().toISOString()
        })
        .eq('id', scheduleForm.application_id);

      setIsScheduleOpen(false);
      if (onClearPreselectedApplication) onClearPreselectedApplication();
      fetchInterviews();
    } catch (err: any) {
      alert('Failed to schedule interview: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            Interview Rounds & Panel Evaluations
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Schedule candidate rounds, assign interviewer panels, and submit weighted scorecards.
          </p>
        </div>

        <button
          onClick={() => {
            if (scorecards.length > 0 && !scheduleForm.scorecard_id) {
              setScheduleForm(prev => ({ ...prev, scorecard_id: scorecards[0].id }));
            }
            setIsScheduleOpen(true);
          }}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Schedule Interview Round
        </button>
      </div>

      {/* Interviews Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-medium">
          Loading interview schedules...
        </div>
      ) : interviews.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">No Interviews Scheduled</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Schedule a technical or HR interview round with candidate scorecards.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-zinc-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-800">
                <th className="p-3.5">Candidate & Opening</th>
                <th className="p-3.5">Round / Type</th>
                <th className="p-3.5">Schedule Time</th>
                <th className="p-3.5">Meeting / Venue</th>
                <th className="p-3.5">Scorecard Template</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {interviews.map((intItem) => {
                const cand = intItem.application?.candidate;
                const job = intItem.application?.job;
                const evaluation = intItem.evaluations?.[0];

                return (
                  <tr key={intItem.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {cand ? `${cand.first_name} ${cand.last_name}` : 'Candidate'}
                      </div>
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold truncate">
                        {job?.title || 'Job Opening'}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {intItem.round_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {intItem.interview_type}
                      </div>
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(intItem.scheduled_date).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {intItem.start_time} - {intItem.end_time}
                      </div>
                    </td>

                    <td className="p-3.5 max-w-[180px]">
                      {intItem.meeting_link ? (
                        <a
                          href={intItem.meeting_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 truncate"
                        >
                          <Video className="w-3.5 h-3.5 text-blue-500" /> Join Call
                        </a>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" /> {intItem.location || 'On-site'}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {intItem.scorecard?.name || 'Standard Technical'}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        intItem.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                        intItem.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}>
                        {intItem.status}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      {intItem.status !== 'COMPLETED' ? (
                        <button
                          onClick={() => setEvaluationInterview(intItem)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto shadow-sm"
                        >
                          <Award className="w-3.5 h-3.5" /> Evaluate
                        </button>
                      ) : (
                        <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          ✓ {evaluation?.recommendation || 'Evaluated'} ({evaluation?.overall_rating || 4}/5)
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule Interview Modal */}
      {isScheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-xl w-full max-h-[90vh] shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-800/40">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" /> Schedule Interview Round
              </h2>
              <button 
                onClick={() => {
                  setIsScheduleOpen(false);
                  if (onClearPreselectedApplication) onClearPreselectedApplication();
                }} 
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Candidate & Application *</label>
                <select
                  required
                  value={scheduleForm.application_id}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, application_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold"
                >
                  <option value="">Select Candidate Application...</option>
                  {applications.map(app => (
                    <option key={app.id} value={app.id}>
                      {app.candidate?.first_name} {app.candidate?.last_name} — {app.job?.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Round Name</label>
                  <input
                    type="text"
                    required
                    value={scheduleForm.round_name}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, round_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Interview Type</label>
                  <select
                    value={scheduleForm.interview_type}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, interview_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                  >
                    <option value="TECHNICAL">Technical Round</option>
                    <option value="PHONE">Phone Screen</option>
                    <option value="VIDEO">Video Interview</option>
                    <option value="MANAGER">Hiring Manager</option>
                    <option value="HR">HR Discussion</option>
                    <option value="FINAL">Final Executive Round</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Date *</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.scheduled_date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Start Time</label>
                  <input
                    type="time"
                    value={scheduleForm.start_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">End Time</label>
                  <input
                    type="time"
                    value={scheduleForm.end_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Meeting Link (Google Meet / Teams / Zoom)</label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={scheduleForm.meeting_link}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, meeting_link: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Scorecard Evaluation Rubric</label>
                <select
                  value={scheduleForm.scorecard_id}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scorecard_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                >
                  <option value="">Standard Technical Scorecard</option>
                  {scorecards.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evaluation Scorecard Modal */}
      {evaluationInterview && (
        <InterviewEvaluationModal
          interview={evaluationInterview}
          companyId={companyId}
          userId={userId}
          onClose={() => setEvaluationInterview(null)}
          onSuccess={() => {
            setEvaluationInterview(null);
            fetchInterviews();
          }}
        />
      )}
    </div>
  );
};
