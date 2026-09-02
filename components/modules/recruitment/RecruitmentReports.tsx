import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  BarChart3, 
  Download, 
  Clock, 
  Share2, 
  AlertTriangle, 
  Calendar, 
  TrendingUp, 
  Filter,
  CheckCircle2
} from 'lucide-react';

interface RecruitmentReportsProps {
  companyId: string;
}

export const RecruitmentReports: React.FC<RecruitmentReportsProps> = ({ companyId }) => {
  const [activeReport, setActiveReport] = useState<'source' | 'velocity' | 'aging'>('source');
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const { data: apps } = await supabase
          .from('recruitment_applications')
          .select(`
            *,
            job:recruitment_jobs(id, title, department_id, departments(name)),
            candidate:recruitment_candidates(id, first_name, last_name, source_name)
          `)
          .eq('company_id', companyId);

        const { data: jobList } = await supabase
          .from('recruitment_jobs')
          .select('id, title, created_at, status, vacancies, departments(name)')
          .eq('company_id', companyId);

        setApplications(apps || []);
        setJobs(jobList || []);
      } catch (err) {
        console.error('Error fetching report data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (companyId) fetchReportData();
  }, [companyId]);

  // Aggregate by Source
  const sourceStats = React.useMemo(() => {
    const map: Record<string, { source: string; applications: number; interviewed: number; offers: number; hired: number }> = {};
    applications.forEach((a) => {
      const src = a.source_name || a.candidate?.source_name || 'Direct / Unknown';
      if (!map[src]) {
        map[src] = { source: src, applications: 0, interviewed: 0, offers: 0, hired: 0 };
      }
      map[src].applications++;
      if (['INTERVIEW', 'TECHNICAL_INTERVIEW', 'MANAGER_INTERVIEW', 'HR_INTERVIEW', 'OFFER', 'OFFER_ACCEPTED', 'HIRED'].includes(a.stage)) {
        map[src].interviewed++;
      }
      if (['OFFER', 'OFFER_ACCEPTED', 'HIRED'].includes(a.stage)) {
        map[src].offers++;
      }
      if (a.stage === 'HIRED') {
        map[src].hired++;
      }
    });
    return Object.values(map);
  }, [applications]);

  // Aggregate Aging
  const agingList = React.useMemo(() => {
    const now = Date.now();
    return applications
      .filter(a => !['HIRED', 'REJECTED', 'WITHDRAWN'].includes(a.stage))
      .map(a => {
        const days = Math.floor((now - new Date(a.stage_entered_at || a.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: a.id,
          candidateName: `${a.candidate?.first_name || ''} ${a.candidate?.last_name || ''}`,
          jobTitle: a.job?.title || 'General Position',
          department: a.job?.departments?.name || 'General',
          stage: a.stage,
          daysInStage: days
        };
      })
      .sort((a, b) => b.daysInStage - a.daysInStage);
  }, [applications]);

  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeReport === 'source') {
      csvContent += 'Source,Total Applications,Interviewed,Offers,Hires,Conversion Rate\n';
      sourceStats.forEach(s => {
        const conv = s.applications > 0 ? ((s.hired / s.applications) * 100).toFixed(1) : '0';
        csvContent += `"${s.source}",${s.applications},${s.interviewed},${s.offers},${s.hired},${conv}%\n`;
      });
    } else if (activeReport === 'aging') {
      csvContent += 'Candidate,Job Title,Department,Current Stage,Days in Stage\n';
      agingList.forEach(a => {
        csvContent += `"${a.candidateName}","${a.jobTitle}","${a.department}","${a.stage}",${a.daysInStage}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `recruitment_report_${activeReport}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            Recruitment Analytics & Compliance Reports
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Source attribution ROI, pipeline aging bottlenecks, and hiring velocity analytics.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Export Report (CSV)
        </button>
      </div>

      {/* Report Sub-Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-zinc-800 rounded-xl w-fit text-xs font-bold">
        <button
          onClick={() => setActiveReport('source')}
          className={`px-4 py-1.5 rounded-lg transition ${
            activeReport === 'source' ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-xs' : 'text-slate-500'
          }`}
        >
          Source Channel Performance
        </button>
        <button
          onClick={() => setActiveReport('aging')}
          className={`px-4 py-1.5 rounded-lg transition ${
            activeReport === 'aging' ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-xs' : 'text-slate-500'
          }`}
        >
          Pipeline Stage Aging Bottlenecks
        </button>
      </div>

      {/* Report Tables */}
      {activeReport === 'source' && (
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-zinc-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-800">
                <th className="p-3.5">Candidate Source Channel</th>
                <th className="p-3.5 text-center">Applications</th>
                <th className="p-3.5 text-center">Interviewed</th>
                <th className="p-3.5 text-center">Offers Released</th>
                <th className="p-3.5 text-center">Hired</th>
                <th className="p-3.5 text-right">Hire Conversion %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {sourceStats.map((s, idx) => {
                const conv = s.applications > 0 ? ((s.hired / s.applications) * 100).toFixed(1) : '0';
                return (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                      {s.source}
                    </td>
                    <td className="p-3.5 text-center font-mono">{s.applications}</td>
                    <td className="p-3.5 text-center font-mono">{s.interviewed}</td>
                    <td className="p-3.5 text-center font-mono">{s.offers}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-emerald-600">{s.hired}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      {conv}%
                    </td>
                  </tr>
                );
              })}
              {sourceStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No source data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeReport === 'aging' && (
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-zinc-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-800">
                <th className="p-3.5">Candidate</th>
                <th className="p-3.5">Job Opening</th>
                <th className="p-3.5">Current Stage</th>
                <th className="p-3.5 text-center">Days in Stage</th>
                <th className="p-3.5 text-center">Aging Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {agingList.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition">
                  <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                    {a.candidateName}
                  </td>
                  <td className="p-3.5 text-slate-600 dark:text-slate-300">
                    {a.jobTitle}
                  </td>
                  <td className="p-3.5 font-semibold text-amber-600">
                    {a.stage}
                  </td>
                  <td className="p-3.5 text-center font-mono font-bold">
                    {a.daysInStage} days
                  </td>
                  <td className="p-3.5 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      a.daysInStage > 14 ? 'bg-rose-100 text-rose-800' :
                      a.daysInStage > 7 ? 'bg-amber-100 text-amber-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {a.daysInStage > 14 ? '⚠️ Critical Bottleneck' : a.daysInStage > 7 ? 'Delayed' : 'Normal'}
                    </span>
                  </td>
                </tr>
              ))}
              {agingList.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No active applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
