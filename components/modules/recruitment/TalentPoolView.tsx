import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { CandidateDetailModal } from './CandidateDetailModal';
import { 
  Users, 
  Search, 
  Briefcase, 
  Tag, 
  ArrowRight, 
  Mail, 
  Phone, 
  Star, 
  Filter, 
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';

interface TalentPoolViewProps {
  companyId: string;
  userId?: string;
  jobs: any[];
}

export const TalentPoolView: React.FC<TalentPoolViewProps> = ({
  companyId,
  userId,
  jobs
}) => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [reengageTarget, setReengageTarget] = useState<{ candidateId: string; jobId: string } | null>(null);

  const fetchTalentPool = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recruitment_candidates')
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['TALENT_POOL', 'ACTIVE'])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setCandidates(data || []);
    } catch (err: any) {
      console.error('Error fetching talent pool:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchTalentPool();
  }, [companyId]);

  const handleReengage = async (candidateId: string, jobId: string) => {
    if (!jobId) return;
    try {
      // Create new application
      const { error } = await supabase
        .from('recruitment_applications')
        .insert({
          company_id: companyId,
          candidate_id: candidateId,
          job_id: jobId,
          stage: 'SHORTLISTED',
          match_score: 80,
          status: 'ACTIVE',
          source_name: 'Talent Pool Rediscovery'
        });

      if (error) throw error;

      alert('Candidate successfully re-engaged and added to Shortlisted stage of opening!');
      setReengageTarget(null);
    } catch (err: any) {
      alert('Error re-engaging candidate: ' + err.message);
    }
  };

  // Collect all unique skill tags
  const allTags = Array.from(
    new Set(candidates.flatMap(c => c.tags || []))
  ).filter(Boolean);

  const filtered = candidates.filter(c => {
    const q = search.toLowerCase();
    const matchesSearch = 
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.current_title?.toLowerCase().includes(q) ||
      c.tags?.some((t: string) => t.toLowerCase().includes(q));

    const matchesTag = selectedTag === 'ALL' || c.tags?.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Talent Pool & Passive Reserves
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rediscover qualified past applicants, silver-medalist candidates, and passive talent.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search talent pool by skill, name, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Skills ({allTags.length})</option>
            {allTags.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Talent Pool Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-medium">
          Loading talent pool...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">No Talent Pool Matches</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Candidates saved to the talent pool from screening or past job postings will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-400 font-black text-sm flex items-center justify-center">
                      {c.first_name?.[0]}{c.last_name?.[0] || ''}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {c.first_name} {c.last_name}
                      </h3>
                      <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                        {c.current_title || 'Candidate'}
                      </div>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                    Talent Pool
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <div>Experience: <strong className="text-slate-700 dark:text-slate-300">{c.total_experience_years || 0} yrs</strong></div>
                  <div>Education: <strong className="text-slate-700 dark:text-slate-300">{c.highest_education || 'Degree'}</strong></div>
                  <div>Location: <strong className="text-slate-700 dark:text-slate-300">{c.current_location || 'Doha, Qatar'}</strong></div>
                </div>

                {c.tags && c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {c.tags.slice(0, 4).map((t: string, idx: number) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] text-slate-600 dark:text-slate-300 font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Re-engage Action */}
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => setActiveCandidateId(c.id)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  View Profile
                </button>

                <div className="flex items-center gap-1.5">
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleReengage(c.id, e.target.value);
                    }}
                    defaultValue=""
                    className="text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg px-2 py-1"
                  >
                    <option value="" disabled>Re-engage into Job...</option>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile Modal */}
      {activeCandidateId && (
        <CandidateDetailModal
          candidateId={activeCandidateId}
          companyId={companyId}
          userId={userId}
          onClose={() => setActiveCandidateId(null)}
          onRefresh={fetchTalentPool}
        />
      )}
    </div>
  );
};
