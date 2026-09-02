import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { CandidateDetailModal } from './CandidateDetailModal';
import { BulkResumeUploadModal } from './BulkResumeUploadModal';
import { 
  Users, 
  Search, 
  Filter, 
  UploadCloud, 
  Plus, 
  Mail, 
  Phone, 
  Briefcase, 
  GraduationCap, 
  FileText, 
  UserCheck, 
  Tag, 
  Download,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

interface CandidateDatabaseProps {
  companyId: string;
  userId?: string;
  jobs: any[];
  onScheduleInterview?: (applicationId: string) => void;
  onCreateOffer?: (applicationId: string, candidate: any) => void;
  onConvertToEmployee?: (candidate: any, application?: any) => void;
}

export const CandidateDatabase: React.FC<CandidateDatabaseProps> = ({
  companyId,
  userId,
  jobs,
  onScheduleInterview,
  onCreateOffer,
  onConvertToEmployee
}) => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedExp, setSelectedExp] = useState<string>('ALL');
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recruitment_candidates')
        .select(`
          *,
          applications:recruitment_applications(
            id,
            job_id,
            stage,
            match_score,
            job:recruitment_jobs(id, title)
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCandidates(data || []);
    } catch (err: any) {
      console.error('Error fetching candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchCandidates();
  }, [companyId]);

  const filteredCandidates = candidates.filter(c => {
    const q = search.toLowerCase();
    const matchesSearch = 
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.current_title?.toLowerCase().includes(q) ||
      c.tags?.some((t: string) => t.toLowerCase().includes(q));

    const matchesStatus = selectedStatus === 'ALL' || c.status === selectedStatus;

    let matchesExp = true;
    const exp = c.total_experience_years || 0;
    if (selectedExp === 'ENTRY') matchesExp = exp <= 2;
    else if (selectedExp === 'MID') matchesExp = exp > 2 && exp <= 5;
    else if (selectedExp === 'SENIOR') matchesExp = exp > 5 && exp <= 10;
    else if (selectedExp === 'LEAD') matchesExp = exp > 10;

    return matchesSearch && matchesStatus && matchesExp;
  });

  const totalActive = candidates.filter(c => c.status === 'ACTIVE').length;
  const totalTalentPool = candidates.filter(c => c.status === 'TALENT_POOL').length;
  const totalHired = candidates.filter(c => c.status === 'HIRED').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Candidate Database & Talent Pool
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Searchable candidate profiles, parsed resumes, talent pool reserves, and career histories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkUploadOpen(true)}
            className="px-3.5 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-bold transition flex items-center gap-1.5 hover:bg-amber-100"
          >
            <UploadCloud className="w-4 h-4" /> Bulk Import Resumes
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400">Total Candidates</div>
          <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{candidates.length}</div>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400">In Active Pipeline</div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{totalActive}</div>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400">Talent Pool Reserves</div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{totalTalentPool}</div>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400">Successfully Hired</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{totalHired}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone, title, or skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TALENT_POOL">Talent Pool</option>
            <option value="HIRED">Hired</option>
            <option value="DO_NOT_CONTACT">Do Not Contact</option>
          </select>

          <select
            value={selectedExp}
            onChange={(e) => setSelectedExp(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Experience Levels</option>
            <option value="ENTRY">Entry (0 - 2 yrs)</option>
            <option value="MID">Mid (2 - 5 yrs)</option>
            <option value="SENIOR">Senior (5 - 10 yrs)</option>
            <option value="LEAD">Lead / Expert (10+ yrs)</option>
          </select>
        </div>
      </div>

      {/* Candidate Data Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-medium">
          Loading candidate database...
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">No Candidates Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Upload resumes or publish job openings to populate the candidate database.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-zinc-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-800">
                <th className="p-3.5">Candidate</th>
                <th className="p-3.5">Contact</th>
                <th className="p-3.5">Title & Experience</th>
                <th className="p-3.5">Education</th>
                <th className="p-3.5">Skills</th>
                <th className="p-3.5">Applications</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredCandidates.map((c) => (
                <tr 
                  key={c.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition cursor-pointer"
                  onClick={() => setActiveCandidateId(c.id)}
                >
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-black text-xs flex items-center justify-center">
                        {c.first_name?.[0]}{c.last_name?.[0] || ''}
                      </div>
                      <div>
                        <div>{c.first_name} {c.last_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{c.candidate_code}</div>
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5">
                    <div className="text-slate-600 dark:text-slate-300 space-y-0.5">
                      <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                        <Mail className="w-3 h-3 text-slate-400" /> {c.email}
                      </div>
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Phone className="w-3 h-3" /> {c.phone}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="p-3.5">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {c.current_title || 'Professional'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {c.total_experience_years || 0} years exp
                    </div>
                  </td>

                  <td className="p-3.5 max-w-[150px]">
                    <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {c.highest_education || '—'}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {c.education_institution || ''}
                    </div>
                  </td>

                  <td className="p-3.5 max-w-[180px]">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).slice(0, 2).map((t: string, idx: number) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] text-slate-600 dark:text-slate-300 font-medium">
                          {t}
                        </span>
                      ))}
                      {(c.tags || []).length > 2 && (
                        <span className="text-[10px] text-slate-400">+{c.tags.length - 2}</span>
                      )}
                    </div>
                  </td>

                  <td className="p-3.5">
                    <div className="space-y-1">
                      {(c.applications || []).map((app: any) => (
                        <span key={app.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-bold">
                          {app.job?.title || 'Job'}: {app.stage} ({app.match_score}%)
                        </span>
                      ))}
                      {(!c.applications || c.applications.length === 0) && (
                        <span className="text-[11px] text-slate-400 italic">Talent Pool (No App)</span>
                      )}
                    </div>
                  </td>

                  <td className="p-3.5 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      c.status === 'HIRED' ? 'bg-emerald-100 text-emerald-800' :
                      c.status === 'TALENT_POOL' ? 'bg-purple-100 text-purple-800' :
                      c.status === 'DO_NOT_CONTACT' ? 'bg-rose-100 text-rose-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {c.status}
                    </span>
                  </td>

                  <td className="p-3.5 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCandidateId(c.id);
                      }}
                      className="text-xs font-bold text-amber-600 hover:text-amber-700 hover:underline"
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Candidate Profile Modal */}
      {activeCandidateId && (
        <CandidateDetailModal
          candidateId={activeCandidateId}
          companyId={companyId}
          userId={userId}
          onClose={() => setActiveCandidateId(null)}
          onRefresh={fetchCandidates}
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
          onClose={() => setIsBulkUploadOpen(false)}
          onSuccess={() => {
            setIsBulkUploadOpen(false);
            fetchCandidates();
          }}
        />
      )}
    </div>
  );
};
