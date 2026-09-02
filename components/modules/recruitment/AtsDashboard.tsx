import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Briefcase, 
  Users, 
  Calendar, 
  DollarSign, 
  UserCheck, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  CheckCircle2, 
  Layers,
  Award,
  ChevronRight
} from 'lucide-react';

interface AtsDashboardProps {
  companyId: string;
  onNavigateTab: (tab: string, filter?: any) => void;
}

export const AtsDashboard: React.FC<AtsDashboardProps> = ({ companyId, onNavigateTab }) => {
  const [stats, setStats] = useState({
    activeJobs: 0,
    totalCandidates: 0,
    activeApplications: 0,
    interviewsScheduled: 0,
    offersPending: 0,
    totalHired: 0
  });
  const [funnelData, setFunnelData] = useState<{ stage: string; count: number; pct: number }[]>([]);
  const [recentApplications, setRecentApplications] = useState<any[]>([]);
  const [urgentJobs, setUrgentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch active jobs
      const { data: jobs } = await supabase
        .from('recruitment_jobs')
        .select('id, title, status, priority, created_at, vacancies')
        .eq('company_id', companyId);

      const activeJobsList = jobs?.filter(j => j.status === 'PUBLISHED') || [];

      // 2. Fetch candidates count
      const { count: candCount } = await supabase
        .from('recruitment_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);

      // 3. Fetch applications
      const { data: apps } = await supabase
        .from('recruitment_applications')
        .select(`
          id,
          stage,
          match_score,
          created_at,
          candidate:recruitment_candidates(id, first_name, last_name, email),
          job:recruitment_jobs(id, title)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      const allApps = apps || [];

      // 4. Interviews scheduled
      const { count: interviewCount } = await supabase
        .from('recruitment_interviews')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'SCHEDULED');

      // 5. Offers pending
      const { count: offerCount } = await supabase
        .from('recruitment_offers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('status', ['PENDING_APPROVAL', 'SENT']);

      // 6. Hired
      const hiredCount = allApps.filter(a => a.stage === 'HIRED').length;

      setStats({
        activeJobs: activeJobsList.length,
        totalCandidates: candCount || 0,
        activeApplications: allApps.filter(a => !['HIRED', 'REJECTED', 'WITHDRAWN'].includes(a.stage)).length,
        interviewsScheduled: interviewCount || 0,
        offersPending: offerCount || 0,
        totalHired: hiredCount
      });

      // Compute Funnel
      const totalCount = allApps.length || 1;
      const appliedCount = allApps.length;
      const screenedCount = allApps.filter(a => a.stage !== 'APPLIED').length;
      const interviewCountAll = allApps.filter(a => ['INTERVIEW', 'TECHNICAL_INTERVIEW', 'MANAGER_INTERVIEW', 'HR_INTERVIEW', 'OFFER', 'OFFER_ACCEPTED', 'HIRED'].includes(a.stage)).length;
      const offerCountAll = allApps.filter(a => ['OFFER', 'OFFER_ACCEPTED', 'HIRED'].includes(a.stage)).length;

      setFunnelData([
        { stage: 'Applied', count: appliedCount, pct: 100 },
        { stage: 'Screened', count: screenedCount, pct: Math.round((screenedCount / totalCount) * 100) },
        { stage: 'Interviewed', count: interviewCountAll, pct: Math.round((interviewCountAll / totalCount) * 100) },
        { stage: 'Offered', count: offerCountAll, pct: Math.round((offerCountAll / totalCount) * 100) },
        { stage: 'Hired', count: hiredCount, pct: Math.round((hiredCount / totalCount) * 100) }
      ]);

      setRecentApplications(allApps.slice(0, 5));
      setUrgentJobs(activeJobsList.slice(0, 4));

    } catch (err: any) {
      console.error('Error fetching ATS dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchDashboardData();
  }, [companyId]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div 
          onClick={() => onNavigateTab('jobs')}
          className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-amber-500 cursor-pointer transition"
        >
          <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
            <span>Published Jobs</span>
            <Briefcase className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{stats.activeJobs}</div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1 flex items-center gap-1">
            View Openings <ChevronRight className="w-2.5 h-2.5" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('candidates')}
          className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-amber-500 cursor-pointer transition"
        >
          <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
            <span>Talent Base</span>
            <Users className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{stats.totalCandidates}</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-1 flex items-center gap-1">
            Profiles on file <ChevronRight className="w-2.5 h-2.5" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('pipeline')}
          className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-amber-500 cursor-pointer transition"
        >
          <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
            <span>Active Pipeline</span>
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">{stats.activeApplications}</div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 flex items-center gap-1">
            In Process <ChevronRight className="w-2.5 h-2.5" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('interviews')}
          className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-amber-500 cursor-pointer transition"
        >
          <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
            <span>Interviews</span>
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{stats.interviewsScheduled}</div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1 flex items-center gap-1">
            Scheduled rounds <ChevronRight className="w-2.5 h-2.5" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('offers')}
          className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-amber-500 cursor-pointer transition"
        >
          <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
            <span>Pending Offers</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{stats.offersPending}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            Offers awaiting <ChevronRight className="w-2.5 h-2.5" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('candidates')}
          className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-amber-500 cursor-pointer transition"
        >
          <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
            <span>Total Hires</span>
            <UserCheck className="w-3.5 h-3.5 text-green-600" />
          </div>
          <div className="text-2xl font-black text-green-600 dark:text-green-400 mt-2">{stats.totalHired}</div>
          <div className="text-[10px] text-green-600 dark:text-green-400 font-semibold mt-1 flex items-center gap-1">
            Onboarded <ChevronRight className="w-2.5 h-2.5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Hiring Funnel + Urgent Openings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recruitment Funnel */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" /> Hiring Conversion Funnel
            </h3>
            <span className="text-xs text-slate-400">Total Applicants: {stats.totalCandidates}</span>
          </div>

          <div className="space-y-3 pt-2">
            {funnelData.map((f) => (
              <div key={f.stage} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>{f.stage}</span>
                  <span className="font-mono text-slate-500">{f.count} ({f.pct}%)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(f.pct, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Job Openings */}
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-amber-500" /> Active Job Vacancies
            </h3>
            <button 
              onClick={() => onNavigateTab('jobs')}
              className="text-xs font-bold text-amber-600 hover:underline"
            >
              All Openings
            </button>
          </div>

          <div className="space-y-3">
            {urgentJobs.map((j) => (
              <div 
                key={j.id} 
                onClick={() => onNavigateTab('pipeline', j.id)}
                className="p-3 bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 rounded-xl border border-slate-200 dark:border-zinc-800 cursor-pointer transition space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                    {j.title}
                  </h4>
                  <span className="text-[10px] font-bold text-amber-600 font-mono">
                    {j.vacancies || 1} vacancy
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Priority: {j.priority || 'Medium'}</span>
                  <span>Opened: {new Date(j.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}

            {urgentJobs.length === 0 && (
              <div className="text-center p-6 text-xs text-slate-400">
                No active job vacancies published.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Applications Feed */}
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" /> Recent Candidate Intakes
          </h3>
          <button 
            onClick={() => onNavigateTab('pipeline')}
            className="text-xs font-bold text-amber-600 hover:underline"
          >
            Open Kanban Pipeline
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
          {recentApplications.map((app) => (
            <div key={app.id} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center">
                  {app.candidate?.first_name?.[0]}{app.candidate?.last_name?.[0] || ''}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {app.candidate?.first_name} {app.candidate?.last_name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {app.job?.title || 'Job Opening'} • Applied {new Date(app.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {app.stage}
                </span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  Fit: {app.match_score}%
                </span>
              </div>
            </div>
          ))}

          {recentApplications.length === 0 && (
            <div className="text-center p-8 text-xs text-slate-400">
              No recent applications. Bulk import resumes or publish a job opening to start.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
