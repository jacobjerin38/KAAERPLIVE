import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  ChevronRight, 
  User, 
  Mail, 
  Phone, 
  FileText, 
  Send,
  Loader2,
  CheckCircle,
  Building
} from 'lucide-react';

export const CareersPortal: React.FC = () => {
  const [companyId, setCompanyId] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('KAA ERP Client');
  
  // Data State
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Application Form State
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    resume_url: '',
    cover_letter: ''
  });

  useEffect(() => {
    // Resolve Company first
    const resolveCompanyAndJobs = async () => {
      setLoading(true);
      try {
        // Parse company_id from query params if available
        const params = new URLSearchParams(window.location.search);
        let cid = params.get('company_id');

        if (!cid) {
          // Fallback: Fetch first company in DB
          const { data: companies } = await supabase.from('companies').select('id, name').limit(1);
          if (companies && companies.length > 0) {
            cid = companies[0].id;
            setCompanyName(companies[0].name);
          }
        } else {
          const { data: comp } = await supabase.from('companies').select('name').eq('id', cid).maybeSingle();
          if (comp) setCompanyName(comp.name);
        }

        if (cid) {
          setCompanyId(cid);
          // Fetch Published Jobs for this company
          const { data: jobData } = await supabase
            .from('recruitment_jobs' as any)
            .select('*, departments(name)')
            .eq('company_id', cid)
            .eq('status', 'PUBLISHED')
            .order('created_at', { ascending: false });

          if (jobData) setJobs(jobData);
        }
      } catch (err) {
        console.error('Error loading careers portal:', err);
      } finally {
        setLoading(false);
      }
    };

    resolveCompanyAndJobs();
  }, []);

  const handleJobSelect = async (job: any) => {
    setSelectedJob(job);
    setShowApplyForm(false);
    setSuccessMessage(false);
    
    // Proactively increment views
    try {
      await supabase
        .from('recruitment_jobs' as any)
        .update({ views: (job.views || 0) + 1 })
        .eq('id', job.id);
    } catch (e) {
      // Ignore views increment failure
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.resume_url) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('recruitment_applicants' as any)
        .insert({
          company_id: companyId,
          job_id: selectedJob.id,
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          resume_url: form.resume_url,
          cover_letter: form.cover_letter || null,
          stage: 'APPLIED'
        });

      if (error) throw error;
      
      setSuccessMessage(true);
      setForm({
        name: '',
        email: '',
        phone: '',
        resume_url: '',
        cover_letter: ''
      });
    } catch (err) {
      console.error('Error submitting application:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500 text-white rounded-lg shadow-sm">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-500 block leading-none">Careers at</span>
              <span className="text-base font-black text-slate-800 dark:text-zinc-100">{companyName}</span>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-650 rounded-full">
            {jobs.length} Open Positions
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
        {/* Jobs List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-200">Current Openings</h2>
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-xl text-center text-slate-400">
                No active openings at this time. Check back later!
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => handleJobSelect(job)}
                  className={`bg-white dark:bg-zinc-900 border p-4 rounded-xl shadow-sm cursor-pointer transition flex justify-between items-center ${
                    selectedJob?.id === job.id
                      ? 'border-amber-500 ring-2 ring-amber-400/20'
                      : 'border-slate-200 dark:border-zinc-800 hover:border-slate-350'
                  }`}
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200">{job.title}</h3>
                    <div className="flex gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {job.employment_type}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Job Detail & Apply Form */}
        <div className="lg:col-span-2">
          {selectedJob ? (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6">
              <div className="border-b border-slate-100 dark:border-zinc-800 pb-4 flex justify-between items-start">
                <div className="space-y-1">
                  <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">{selectedJob.title}</h1>
                  <p className="text-xs text-slate-400 font-semibold">{selectedJob.departments?.name || 'General'}</p>
                </div>
                {!showApplyForm && (
                  <button
                    onClick={() => setShowApplyForm(true)}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition"
                  >
                    Apply Now
                  </button>
                )}
              </div>

              {!showApplyForm ? (
                <div className="space-y-6 text-sm text-slate-650 dark:text-zinc-350">
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-850 dark:text-zinc-200">Role Description</h3>
                    <p className="whitespace-pre-wrap leading-relaxed">{selectedJob.description}</p>
                  </div>
                  {selectedJob.requirements && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-slate-850 dark:text-zinc-200">Requirements & Qualifications</h3>
                      <p className="whitespace-pre-wrap leading-relaxed">{selectedJob.requirements}</p>
                    </div>
                  )}
                  {selectedJob.salary_range_min && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-slate-850 dark:text-zinc-200">Compensation Package</h3>
                      <p className="text-slate-800 dark:text-zinc-350">
                        QAR {selectedJob.salary_range_min.toLocaleString()} to QAR {selectedJob.salary_range_max?.toLocaleString()} per month.
                      </p>
                    </div>
                  )}
                </div>
              ) : successMessage ? (
                <div className="p-8 text-center space-y-4">
                  <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
                  <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-200">Application Submitted!</h3>
                  <p className="text-sm text-slate-400">
                    Thank you for applying for the <strong>{selectedJob.title}</strong> role. Our recruitment team will review your application soon.
                  </p>
                  <button
                    onClick={() => setShowApplyForm(false)}
                    className="text-xs text-amber-500 font-bold hover:underline"
                  >
                    Back to Job Details
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApply} className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <h3 className="font-bold text-slate-800 dark:text-zinc-200">Submit Your Application</h3>
                    <button
                      type="button"
                      onClick={() => setShowApplyForm(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Full Name
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. John Doe"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> Email Address
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="e.g. john@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" /> Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +974 5555 1234"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> Resume Link (PDF/Doc)
                    </label>
                    <input
                      required
                      type="url"
                      placeholder="e.g. https://dropbox.com/my-resume.pdf"
                      value={form.resume_url}
                      onChange={(e) => setForm({ ...form, resume_url: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Cover Letter Notes</label>
                    <textarea
                      placeholder="Introduce yourself or highlight why you are a great fit..."
                      value={form.cover_letter}
                      onChange={(e) => setForm({ ...form, cover_letter: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm h-24"
                    />
                  </div>

                  <button
                    disabled={submitting}
                    type="submit"
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition text-sm font-semibold flex items-center justify-center gap-2 shadow-sm"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex items-center gap-1"><Send className="w-4 h-4" /> Send Application</span>}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-10 text-center text-slate-400 h-full flex flex-col justify-center items-center space-y-2 shadow-sm">
              <Building className="w-12 h-12 text-slate-300" />
              <h3 className="font-bold text-slate-600 dark:text-zinc-400">Select a Job Opening</h3>
              <p className="text-xs text-slate-400">Select a role from the left list to view detailed requirements and submit your application.</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-100 dark:bg-zinc-900/50 border-t border-slate-200/50 dark:border-zinc-850 py-4 text-center text-xs text-slate-400 mt-8">
        Powered by {companyName} Recruitment System
      </footer>
    </div>
  );
};
