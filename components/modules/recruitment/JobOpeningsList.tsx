import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { JobOpeningModal } from './JobOpeningModal';
import { BulkResumeUploadModal } from './BulkResumeUploadModal';
import { 
  Briefcase, 
  Plus, 
  Search, 
  UploadCloud, 
  Users, 
  Eye, 
  Calendar, 
  Building2, 
  MapPin, 
  Share2, 
  Check, 
  MoreVertical, 
  Edit3, 
  Trash2,
  Filter,
  ArrowRight
} from 'lucide-react';

interface JobOpeningsListProps {
  companyId: string;
  userId?: string;
  departments: { id: number; name: string }[];
  employees: { id: string; name: string }[];
  prefillRequisition?: any;
  onSelectJobForPipeline?: (jobId: string) => void;
  onClearPrefillRequisition?: () => void;
}

export const JobOpeningsList: React.FC<JobOpeningsListProps> = ({
  companyId,
  userId,
  departments,
  employees,
  prefillRequisition,
  onSelectJobForPipeline,
  onClearPrefillRequisition
}) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<any | null>(null);
  const [bulkUploadJobId, setBulkUploadJobId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recruitment_jobs')
        .select(`
          *,
          departments(id, name),
          hiring_manager:employees!recruitment_jobs_hiring_manager_id_fkey(id, first_name, last_name),
          recruiter:employees!recruitment_jobs_recruiter_id_fkey(id, first_name, last_name),
          applications:recruitment_applications(count)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err: any) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchJobs();
  }, [companyId]);

  useEffect(() => {
    if (prefillRequisition) {
      setJobToEdit(null);
      setIsModalOpen(true);
    }
  }, [prefillRequisition]);

  const handleCopyLink = (jobId: string) => {
    const url = `${window.location.origin}/careers?company_id=${companyId}&job_id=${jobId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(jobId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleStatus = async (jobId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED';
    try {
      const { error } = await supabase
        .from('recruitment_jobs')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', jobId);
      if (error) throw error;
      fetchJobs();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const filteredJobs = jobs.filter(j => {
    const matchesSearch = 
      j.title?.toLowerCase().includes(search.toLowerCase()) ||
      j.location?.toLowerCase().includes(search.toLowerCase()) ||
      j.departments?.name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = selectedStatus === 'ALL' || j.status === selectedStatus;
    const matchesDept = selectedDept === 'ALL' || String(j.department_id) === selectedDept;

    return matchesSearch && matchesStatus && matchesDept;
  });

  const totalPublished = jobs.filter(j => j.status === 'PUBLISHED').length;
  const totalVacancies = jobs.reduce((acc, curr) => acc + (curr.vacancies || 1), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-500" />
            Job Openings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage active vacancies, public careers postings, and candidate pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkUploadJobId('')}
            className="px-3.5 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-bold transition flex items-center gap-1.5 hover:bg-amber-100"
          >
            <UploadCloud className="w-4 h-4" /> Bulk Import Resumes
          </button>
          <button
            onClick={() => { setJobToEdit(null); setIsModalOpen(true); }}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Post Job Opening
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by job title, location, or department..."
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
            <option value="ALL">All Statuses ({jobs.length})</option>
            <option value="PUBLISHED">Published ({totalPublished})</option>
            <option value="DRAFT">Draft</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Job Openings Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-medium">
          Loading job openings...
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Briefcase className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">No Job Openings</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create an opening or convert an approved manpower requisition into a live job opening.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredJobs.map((job) => {
            const applicantCount = job.applications?.[0]?.count || 0;

            return (
              <div
                key={job.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        {job.employment_type || 'Full-time'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {job.title}
                      </h3>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      job.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                      job.status === 'CLOSED' ? 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-400' :
                      'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}>
                      {job.status === 'PUBLISHED' ? '● Published' : job.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{job.departments?.name || 'General Department'}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{job.location}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {applicantCount} Applicant{applicantCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-slate-400">• {job.vacancies || 1} vacancy</span>
                    </div>

                    {job.salary_range_min && (
                      <div className="text-[11px] text-slate-500 pt-1 font-mono">
                        Salary: {job.salary_range_min} - {job.salary_range_max} {job.currency || 'QAR'}
                      </div>
                    )}
                  </div>

                  {job.required_skills && job.required_skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {job.required_skills.slice(0, 3).map((sk: string, idx: number) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] text-slate-600 dark:text-slate-300 font-medium">
                          {sk}
                        </span>
                      ))}
                      {job.required_skills.length > 3 && (
                        <span className="text-[10px] text-slate-400 font-bold">+{job.required_skills.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectJobForPipeline && onSelectJobForPipeline(job.id)}
                      className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Users className="w-3.5 h-3.5" /> Pipeline
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => setBulkUploadJobId(job.id)}
                      title="Upload Resumes directly to this Job"
                      className="p-1.5 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition"
                    >
                      <UploadCloud className="w-4 h-4 text-amber-600" />
                    </button>

                    <button
                      onClick={() => handleCopyLink(job.id)}
                      title="Copy Public Careers Portal Link"
                      className="p-1.5 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition"
                    >
                      {copiedId === job.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(job.id, job.status)}
                      className={`text-[11px] font-bold underline ${
                        job.status === 'PUBLISHED' ? 'text-slate-400 hover:text-slate-600' : 'text-emerald-600 hover:text-emerald-700'
                      }`}
                    >
                      {job.status === 'PUBLISHED' ? 'Close' : 'Publish'}
                    </button>

                    <button
                      onClick={() => { setJobToEdit(job); setIsModalOpen(true); }}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <JobOpeningModal
          companyId={companyId}
          userId={userId}
          departments={departments}
          employees={employees}
          jobToEdit={jobToEdit}
          prefillFromRequisition={prefillRequisition}
          onClose={() => {
            setIsModalOpen(false);
            if (onClearPrefillRequisition) onClearPrefillRequisition();
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            if (onClearPrefillRequisition) onClearPrefillRequisition();
            fetchJobs();
          }}
        />
      )}

      {/* Bulk Upload Modal */}
      {bulkUploadJobId !== null && (
        <BulkResumeUploadModal
          companyId={companyId}
          userId={userId}
          jobs={jobs.map(j => ({
            id: j.id,
            title: j.title,
            required_skills: j.required_skills,
            min_experience_years: j.min_experience_years,
            education_level: j.education_level,
            location: j.location
          }))}
          initialJobId={bulkUploadJobId || undefined}
          onClose={() => setBulkUploadJobId(null)}
          onSuccess={() => {
            setBulkUploadJobId(null);
            fetchJobs();
          }}
        />
      )}
    </div>
  );
};
