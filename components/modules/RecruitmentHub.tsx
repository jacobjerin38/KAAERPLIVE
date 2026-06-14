import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Loader2, 
  Briefcase, 
  Plus, 
  User, 
  FileText, 
  Star, 
  Calendar, 
  MapPin, 
  Users, 
  Clock, 
  ChevronRight,
  TrendingUp,
  UserCheck
} from 'lucide-react';

export const RecruitmentHub: React.FC = () => {
  const { user, currentCompanyId } = useAuth();
  const [activeTab, setActiveTab] = useState<'jobs' | 'ats'>('jobs');
  
  // Data State
  const [jobs, setJobs] = useState<any[]>([]);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Action State
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [showAddJob, setShowAddJob] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New Job Form
  const [jobForm, setJobForm] = useState({
    title: '',
    department_id: '',
    location: '',
    employment_type: 'Full-time',
    description: '',
    requirements: '',
    salary_range_min: '',
    salary_range_max: '',
    status: 'DRAFT'
  });

  // Applicant Progression State
  const [updatingApplicantId, setUpdatingApplicantId] = useState<string | null>(null);

  useEffect(() => {
    if (user && currentCompanyId) {
      loadData();
    }
  }, [user, currentCompanyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Departments
      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name')
        .eq('company_id', currentCompanyId)
        .order('name');
      if (deptData) setDepartments(deptData);

      // 2. Fetch Jobs
      const { data: jobData } = await supabase
        .from('recruitment_jobs' as any)
        .select('*, departments(name)')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false });
      
      const jobsArray = jobData as any[] | null;
      if (jobsArray) {
        setJobs(jobsArray);
        if (jobsArray.length > 0 && !selectedJobId) {
          setSelectedJobId(jobsArray[0].id);
        }
      }

      // 3. Fetch Applicants
      const { data: appData } = await supabase
        .from('recruitment_applicants' as any)
        .select('*, recruitment_jobs(title)')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false });
      if (appData) setApplicants(appData);

    } catch (err) {
      console.error('Error loading recruitment data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobForm.title || !jobForm.location || !jobForm.description) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('recruitment_jobs' as any)
        .insert({
          company_id: currentCompanyId,
          title: jobForm.title,
          department_id: jobForm.department_id ? parseInt(jobForm.department_id) : null,
          location: jobForm.location,
          employment_type: jobForm.employment_type,
          description: jobForm.description,
          requirements: jobForm.requirements || null,
          salary_range_min: jobForm.salary_range_min ? parseFloat(jobForm.salary_range_min) : null,
          salary_range_max: jobForm.salary_range_max ? parseFloat(jobForm.salary_range_max) : null,
          status: jobForm.status
        });

      if (error) throw error;
      
      setShowAddJob(false);
      loadData();
    } catch (err) {
      console.error('Error creating job posting:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStage = async (applicantId: string, newStage: string) => {
    setUpdatingApplicantId(applicantId);
    try {
      const { error } = await supabase
        .from('recruitment_applicants' as any)
        .update({ stage: newStage })
        .eq('id', applicantId);

      if (error) throw error;
      
      // Auto-hire: If applicant is moved to 'HIRED', create employee entry
      if (newStage === 'HIRED') {
        const applicantObj = applicants.find(a => a.id === applicantId);
        if (applicantObj) {
          const jobObj = jobs.find(j => j.id === applicantObj.job_id);
          
          await supabase.from('employees').insert({
            company_id: currentCompanyId,
            name: applicantObj.name,
            personal_email: applicantObj.email,
            personal_mobile: applicantObj.phone,
            department_id: jobObj?.department_id || null,
            status: 'Active',
            join_date: new Date().toISOString().split('T')[0]
          });
        }
      }

      loadData();
    } catch (err) {
      console.error('Error updating applicant stage:', err);
    } finally {
      setUpdatingApplicantId(null);
    }
  };

  const handleUpdateReview = async (applicantId: string, rating: number, notes: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('recruitment_applicants' as any)
        .update({ rating, interviewer_notes: notes })
        .eq('id', applicantId);

      if (error) throw error;
      
      setSelectedApplicant(null);
      loadData();
    } catch (err) {
      console.error('Error saving interviewer notes:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const stages = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER_MADE', 'HIRED', 'REJECTED'];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-amber-500" />
            Recruitment & Applicant Tracking (ATS)
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 text-sm">
            Publish job openings, manage candidates across the pipeline, and evaluate talent.
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'jobs' && (
            <button
              onClick={() => setShowAddJob(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Post New Job
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'jobs'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700'
          }`}
        >
          <Briefcase className="w-4 h-4" /> Job Postings
        </button>
        <button
          onClick={() => setActiveTab('ats')}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'ats'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" /> ATS Candidate Pipeline
        </button>
      </div>

      {/* Jobs List */}
      {activeTab === 'jobs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-10 text-center text-slate-400">
              No job postings created. Click "Post New Job" to begin hiring!
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-slate-850 dark:text-zinc-150 text-base line-clamp-1">{job.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      job.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' :
                      job.status === 'CLOSED' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400' :
                      'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {job.employment_type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-450 line-clamp-3">{job.description}</p>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 pt-3 border-t border-slate-100 dark:border-zinc-850">
                  <span className="font-medium text-slate-500 dark:text-zinc-300">{job.departments?.name || 'General'}</span>
                  <span>{job.views} Views</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ATS Candidate Pipeline */}
      {activeTab === 'ats' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
            <label className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Filter by Opening:</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
            >
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
              {jobs.length === 0 && <option value="">No openings configured</option>}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const stageApplicants = applicants.filter(
                (app) => app.job_id === selectedJobId && app.stage === stage
              );

              return (
                <div key={stage} className="bg-slate-100/60 dark:bg-zinc-900/60 border border-slate-200/50 dark:border-zinc-850 p-3 rounded-xl space-y-3 min-w-[200px] flex flex-col h-[500px]">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-zinc-800">
                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">{stage.replace('_', ' ')}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-xs font-bold">
                      {stageApplicants.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {stageApplicants.map((app) => (
                      <div
                        key={app.id}
                        onClick={() => setSelectedApplicant(app)}
                        className="bg-white dark:bg-zinc-850 p-3 rounded-lg border border-slate-100 dark:border-zinc-800 shadow-sm cursor-pointer hover:shadow hover:border-amber-400/50 transition space-y-2"
                      >
                        <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-xs">{app.name}</h4>
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>Rate: {app.rating ? `${app.rating} ★` : 'None'}</span>
                          <span className="text-slate-400 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(app.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Move Actions */}
                        <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                          <select
                            onClick={(e) => e.stopPropagation()}
                            value={app.stage}
                            onChange={(e) => handleUpdateStage(app.id, e.target.value)}
                            disabled={updatingApplicantId === app.id}
                            className="w-full text-[10px] bg-slate-50 dark:bg-zinc-900 border-none py-0.5 px-1 rounded font-semibold text-slate-650"
                          >
                            {stages.map(st => (
                              <option key={st} value={st}>{st.replace('_', ' ')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Job Modal */}
      {showAddJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-zinc-200">Post New Job Opening</h3>
              <button onClick={() => setShowAddJob(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Job Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Senior Frontend Engineer"
                  value={jobForm.title}
                  onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Department</label>
                  <select
                    value={jobForm.department_id}
                    onChange={(e) => setJobForm({ ...jobForm, department_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  >
                    <option value="">Choose department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Work Location</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Doha, Qatar"
                    value={jobForm.location}
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Employment Type</label>
                  <select
                    value={jobForm.employment_type}
                    onChange={(e) => setJobForm({ ...jobForm, employment_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract / Freelance</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Status</label>
                  <select
                    value={jobForm.status}
                    onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  >
                    <option value="DRAFT">Draft (Internal)</option>
                    <option value="PUBLISHED">Published (Public)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Salary Range Min</label>
                  <input
                    type="number"
                    placeholder="e.g. 10000"
                    value={jobForm.salary_range_min}
                    onChange={(e) => setJobForm({ ...jobForm, salary_range_min: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Salary Range Max</label>
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    value={jobForm.salary_range_max}
                    onChange={(e) => setJobForm({ ...jobForm, salary_range_max: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Job Description</label>
                <textarea
                  required
                  placeholder="Responsibilities, scope, and team details..."
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm h-16"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Requirements</label>
                <textarea
                  placeholder="Key skills, certifications, and minimum experience required..."
                  value={jobForm.requirements}
                  onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm h-16"
                />
              </div>

              <button
                disabled={submitting}
                type="submit"
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition text-sm font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Posting'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Review Candidate Modal */}
      {selectedApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-zinc-200">Review Candidate Details</h3>
              <button onClick={() => setSelectedApplicant(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="space-y-2">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Applicant Name</span>
                <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">{selectedApplicant.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Email Address</span>
                  <span className="text-xs">{selectedApplicant.email}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Mobile Phone</span>
                  <span className="text-xs">{selectedApplicant.phone || '-'}</span>
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Uploaded Resume</span>
                <a href={selectedApplicant.resume_url} target="_blank" rel="noreferrer" className="text-xs text-amber-500 font-bold hover:underline flex items-center gap-1 mt-0.5">
                  <FileText className="w-3.5 h-3.5" /> View Resume Attachment
                </a>
              </div>
              {selectedApplicant.cover_letter && (
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Cover Letter Notes</span>
                  <p className="text-xs text-slate-500 bg-slate-50 dark:bg-zinc-950 p-2 rounded border border-slate-100 dark:border-zinc-800 h-20 overflow-y-auto">
                    {selectedApplicant.cover_letter}
                  </p>
                </div>
              )}
            </div>

            {/* Assessment Input Form */}
            <div className="border-t border-slate-150 dark:border-zinc-800 pt-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300">Interviewer Assessment</h4>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Interviewer Rating (1-5 Stars)</label>
                <select
                  value={selectedApplicant.rating || '3'}
                  onChange={(e) => setSelectedApplicant({ ...selectedApplicant, rating: parseInt(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-slate-200 dark:border-zinc-850 dark:bg-zinc-950 rounded text-xs"
                >
                  <option value="1">1 Star (Poor)</option>
                  <option value="2">2 Stars (Fair)</option>
                  <option value="3">3 Stars (Average)</option>
                  <option value="4">4 Stars (Good)</option>
                  <option value="5">5 Stars (Excellent)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Interview Remarks / Feedback Notes</label>
                <textarea
                  value={selectedApplicant.interviewer_notes || ''}
                  onChange={(e) => setSelectedApplicant({ ...selectedApplicant, interviewer_notes: e.target.value })}
                  placeholder="Notes on communication skills, technical fit..."
                  className="w-full px-2 py-1.5 border border-slate-200 dark:border-zinc-850 dark:bg-zinc-950 rounded text-xs h-16"
                />
              </div>

              <button
                onClick={() => handleUpdateReview(selectedApplicant.id, selectedApplicant.rating || 3, selectedApplicant.interviewer_notes || '')}
                disabled={submitting}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold"
              >
                {submitting ? 'Saving...' : 'Submit Evaluation Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
