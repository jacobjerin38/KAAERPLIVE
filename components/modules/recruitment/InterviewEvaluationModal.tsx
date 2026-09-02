import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { X, Star, CheckCircle, Loader2, Award, FileText } from 'lucide-react';

interface InterviewEvaluationModalProps {
  interview: any;
  companyId: string;
  userId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const InterviewEvaluationModal: React.FC<InterviewEvaluationModalProps> = ({
  interview,
  companyId,
  userId,
  onClose,
  onSuccess
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [overallRating, setOverallRating] = useState<number>(4);
  const [recommendation, setRecommendation] = useState<string>('HIRE');
  const [comments, setComments] = useState('');

  // Default criteria or criteria from attached scorecard
  const criteriaList = interview.scorecard?.criteria || [
    { category: 'Technical Expertise', weight: 35, score: 4 },
    { category: 'Relevant Experience & Projects', weight: 25, score: 4 },
    { category: 'Communication & Professionalism', weight: 15, score: 4 },
    { category: 'Problem Solving & Analytical Thinking', weight: 15, score: 4 },
    { category: 'Culture & Team Fit', weight: 10, score: 4 }
  ];

  const [scores, setScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    criteriaList.forEach((c: any) => {
      initial[c.category] = c.score || 4;
    });
    return initial;
  });

  const handleScoreChange = (category: string, value: number) => {
    setScores(prev => ({ ...prev, [category]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const criteriaScores = criteriaList.map((c: any) => ({
        category: c.category,
        weight: c.weight,
        score: scores[c.category] || 3
      }));

      // 1. Insert evaluation
      const { error: evalErr } = await supabase
        .from('recruitment_interview_evaluations')
        .insert({
          company_id: companyId,
          interview_id: interview.id,
          interviewer_id: null,
          criteria_scores: criteriaScores,
          overall_rating: overallRating,
          recommendation,
          comments
        });
      if (evalErr) throw evalErr;

      // 2. Mark interview as COMPLETED
      const { error: intErr } = await supabase
        .from('recruitment_interviews')
        .update({ status: 'COMPLETED' })
        .eq('id', interview.id);
      if (intErr) throw intErr;

      // 3. If recommendation is HIRE, advance application stage to OFFER or next round
      if (recommendation === 'STRONG_HIRE' || recommendation === 'HIRE') {
        await supabase
          .from('recruitment_applications')
          .update({ stage: 'OFFER', stage_entered_at: new Date().toISOString() })
          .eq('id', interview.application_id);

        await supabase.from('recruitment_stage_history').insert({
          company_id: companyId,
          application_id: interview.application_id,
          old_stage: interview.application?.stage || 'INTERVIEW',
          new_stage: 'OFFER',
          changed_by: userId || null,
          reason_or_notes: `Interview evaluated: ${recommendation} (Rating: ${overallRating}/5)`
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting evaluation:', err);
      alert('Failed to submit evaluation: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const candidate = interview.application?.candidate;
  const job = interview.application?.job;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Interview Scorecard Evaluation
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {candidate ? `${candidate.first_name} ${candidate.last_name}` : 'Candidate'} • {job?.title || 'Position'} ({interview.round_name})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Criteria Evaluation */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Scoring Criteria Rubric (1 = Poor, 5 = Exceptional)
            </h3>

            {criteriaList.map((crit: any) => (
              <div 
                key={crit.category} 
                className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    {crit.category}
                    <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-normal">
                      ({crit.weight}% weight)
                    </span>
                  </div>
                  {crit.description && (
                    <div className="text-[11px] text-slate-400 mt-0.5">{crit.description}</div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => handleScoreChange(crit.category, star)}
                      className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center w-8 h-8 ${
                        (scores[crit.category] || 3) >= star
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-slate-400'
                      }`}
                    >
                      {star}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Overall Rating & Recommendation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Overall Impression Rating</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setOverallRating(r)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      overallRating === r ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5 fill-current" /> {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Final Hiring Recommendation *</label>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="STRONG_HIRE">🌟 Strong Hire (Fast-track Offer)</option>
                <option value="HIRE">✓ Hire (Meets Requirements)</option>
                <option value="HOLD">⏳ Hold (Backup Candidate)</option>
                <option value="NO_HIRE">✕ No Hire (Do Not Proceed)</option>
              </select>
            </div>
          </div>

          {/* Feedback Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Interviewer Observations & Detailed Feedback
            </label>
            <textarea
              required
              rows={3}
              placeholder="Detail key technical strengths, areas of concern, project depth, and salary expectations discussed..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full p-3 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl text-xs"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Submit Scorecard & Complete Round
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
