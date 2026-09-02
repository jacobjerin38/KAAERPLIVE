import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { extractDocumentText } from '../../lib/recruitment/documentExtractor';
import { parseResumeText } from '../../lib/recruitment/resumeParser';
import { computeJobMatchScore } from '../../lib/recruitment/matchingEngine';
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
  Building,
  UploadCloud,
  Check,
  ArrowLeft
} from 'lucide-react';

export const CareersPortal: React.FC = () => {
  const [companyId, setCompanyId] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('Power Engineering Corporation');
  
  // Data State
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Application Form State
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [parsingResume, setParsingResume] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    experienceYears: 0,
    education: '',
    linkedinUrl: '',
    coverLetter: ''
  });

  useEffect(() => {
    const resolveCompanyAndJobs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams(window.location.search);
        let cid = params.get('company_id');
        const initialJobId = params.get('job_id');

        if (!cid) {
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
          const { data: jobData } = await supabase
            .from('recruitment_jobs')
            .select('*, departments(name)')
            .eq('company_id', cid)
            .eq('status', 'PUBLISHED')
            .order('created_at', { ascending: false });

          if (jobData) {
            setJobs(jobData);
            if (initialJobId) {
              const matched = jobData.find(j => j.id === initialJobId);
              if (matched) setSelectedJob(matched);
            }
          }
        }
      } catch (err) {
        console.error('Error loading careers portal:', err);
      } finally {
        setLoading(false);
      }
    };

    resolveCompanyAndJobs();
  }, []);

  const handleResumeChange = async (file: File) => {
    setResumeFile(file);
    setParsingResume(true);
    try {
      // Deterministically extract text and pre-fill form fields
      const extracted = await extractDocumentText(file);
      const parsed = parseResumeText(extracted.text);

      setForm(prev => ({
        ...prev,
        firstName: prev.firstName || parsed.firstName || '',
        lastName: prev.lastName || parsed.lastName || '',
        email: prev.email || parsed.email || '',
        phone: prev.phone || parsed.phone || '',
        location: prev.location || parsed.location || '',
        experienceYears: prev.experienceYears || parsed.totalExperienceYears || 0,
        education: prev.education || parsed.highestEducation || '',
        linkedinUrl: prev.linkedinUrl || parsed.linkedinUrl || ''
      }));
    } catch (err) {
      console.warn('Resume autofill note:', err);
    } finally {
      setParsingResume(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.email) {
      alert('Please enter your full name and email address.');
      return;
    }

    setSubmitting(true);
    try {
      let fileUrl = '';
      let extractedText = '';
      let parsedData: any = {};

      if (resumeFile) {
        // 1. Text extraction & parsing
        const extracted = await extractDocumentText(resumeFile);
        extractedText = extracted.text;
        parsedData = parseResumeText(extractedText);

        // 2. Upload to storage
        const ext = resumeFile.name.split('.').pop() || 'pdf';
        const storagePath = `recruitment/${companyId}/public/${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
        
        try {
          const { error: upErr } = await supabase.storage
            .from('documents')
            .upload(storagePath, resumeFile, { upsert: true });

          if (!upErr) {
            const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
            fileUrl = publicUrlData?.publicUrl || storagePath;
          }
        } catch {
          fileUrl = `local://${storagePath}`;
        }
      }

      // 3. Check for existing candidate by email
      const { data: existingCand } = await supabase
        .from('recruitment_candidates')
        .select('id')
        .eq('company_id', companyId)
        .ilike('email', form.email.trim())
        .maybeSingle();

      let candidateId = existingCand?.id;

      if (!candidateId) {
        const candidateCode = `CAN-${Date.now().toString().slice(-6)}`;
        const { data: newCand, error: candErr } = await supabase
          .from('recruitment_candidates')
          .insert({
            company_id: companyId,
            candidate_code: candidateCode,
            first_name: form.firstName,
            last_name: form.lastName,
            email: form.email.toLowerCase().trim(),
            phone: form.phone || null,
            current_location: form.location || null,
            total_experience_years: form.experienceYears || 0,
            highest_education: form.education || null,
            linkedin_url: form.linkedinUrl || null,
            source_name: 'Careers Portal',
            status: 'ACTIVE',
            tags: parsedData.skills || []
          })
          .select('id')
          .single();

        if (candErr) throw candErr;
        candidateId = newCand.id;
      }

      // 4. Save resume document
      if (resumeFile && candidateId) {
        await supabase
          .from('recruitment_candidate_documents')
          .insert({
            company_id: companyId,
            candidate_id: candidateId,
            file_name: resumeFile.name,
            file_path: fileUrl,
            file_type: resumeFile.name.split('.').pop()?.toUpperCase() || 'FILE',
            file_size: resumeFile.size,
            extracted_text: extractedText,
            parser_data: parsedData,
            parser_status: extractedText.length > 20 ? 'PARSED' : 'PARTIAL',
            parser_confidence: parsedData.confidence || 'LOW'
          });
      }

      // 5. Compute match score for application
      let matchScore = 75;
      let matchDetails = {};
      if (selectedJob) {
        const matchRes = computeJobMatchScore({
          skills: parsedData.skills || [],
          totalExperienceYears: form.experienceYears || parsedData.totalExperienceYears || 0,
          highestEducation: form.education || parsedData.highestEducation,
          location: form.location
        }, {
          requiredSkills: selectedJob.required_skills || [],
          minExperienceYears: selectedJob.min_experience_years || 0,
          educationLevel: selectedJob.education_level,
          location: selectedJob.location
        });
        matchScore = matchRes.score;
        matchDetails = matchRes;
      }

      // 6. Create application in recruitment_applications
      const { data: newApp, error: appErr } = await supabase
        .from('recruitment_applications')
        .insert({
          company_id: companyId,
          candidate_id: candidateId,
          job_id: selectedJob.id,
          stage: 'APPLIED',
          match_score: matchScore,
          match_details: matchDetails,
          cover_letter: form.coverLetter || null,
          source_name: 'Careers Portal',
          status: 'ACTIVE'
        })
        .select('id')
        .single();

      if (appErr) throw appErr;

      // 7. Backward compatibility: also insert into legacy recruitment_applicants
      try {
        await supabase.from('recruitment_applicants' as any).insert({
          company_id: companyId,
          job_id: selectedJob.id,
          name: `${form.firstName} ${form.lastName}`.trim(),
          email: form.email,
          phone: form.phone || null,
          resume_url: fileUrl || 'Uploaded in Portal',
          cover_letter: form.coverLetter || null,
          stage: 'APPLIED'
        });
      } catch {
        // Non-fatal fallback
      }

      setSuccessMessage(true);
      setResumeFile(null);
    } catch (err: any) {
      console.error('Error submitting application:', err);
      alert('Failed to submit application: ' + (err.message || 'Please try again.'));
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
      {/* Top Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shadow-xs sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 dark:text-white leading-tight block">
                {companyName}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Careers & Opportunities</span>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800">
            {jobs.length} Open Position{jobs.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        {selectedJob ? (
          /* Job Details & Apply View */
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8 space-y-6">
            <button
              onClick={() => {
                setSelectedJob(null);
                setShowApplyForm(false);
                setSuccessMessage(false);
              }}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to all openings
            </button>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  {selectedJob.departments?.name || 'General Engineering'} • {selectedJob.employment_type || 'Full-time'}
                </span>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {selectedJob.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {selectedJob.location}</span>
                  {selectedJob.salary_range_min && (
                    <span>Salary: {selectedJob.salary_range_min} - {selectedJob.salary_range_max} {selectedJob.currency || 'QAR'}</span>
                  )}
                </div>
              </div>

              {!showApplyForm && !successMessage && (
                <button
                  onClick={() => setShowApplyForm(true)}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Apply for this Position
                </button>
              )}
            </div>

            {/* Application Success View */}
            {successMessage && (
              <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl space-y-3">
                <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl mx-auto flex items-center justify-center shadow-md">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Application Received!</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Thank you for applying for the {selectedJob.title} position at {companyName}. Our recruitment team will review your qualifications and contact you.
                </p>
                <button
                  onClick={() => { setSelectedJob(null); setSuccessMessage(false); }}
                  className="mt-4 px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-xl"
                >
                  Browse More Positions
                </button>
              </div>
            )}

            {/* Application Form */}
            {showApplyForm && !successMessage && (
              <form onSubmit={handleApply} className="space-y-5 pt-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-zinc-800">
                  Submit Your Application
                </h3>

                {/* Resume Upload Box */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Upload Resume (PDF, DOCX, TXT) *
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl p-6 text-center cursor-pointer hover:border-amber-500 transition-colors bg-slate-50/50 dark:bg-zinc-800/30"
                  >
                    {resumeFile ? (
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-600">
                        <Check className="w-4 h-4" /> {resumeFile.name} ({(resumeFile.size / 1024).toFixed(0)} KB)
                        {parsingResume && <span className="text-slate-400 font-normal">Autofilling form...</span>}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <UploadCloud className="w-8 h-8 text-amber-500 mx-auto" />
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Click to upload or drag resume file here
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Auto-extracts your profile information
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => e.target.files?.[0] && handleResumeChange(e.target.files[0])}
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">First Name *</label>
                    <input
                      required
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Last Name</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Address *</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mobile Phone</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Current City / Country</label>
                    <input
                      type="text"
                      placeholder="e.g. Doha, Qatar"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Total Experience (Years)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form.experienceYears}
                      onChange={(e) => setForm({ ...form, experienceYears: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">LinkedIn Profile</label>
                    <input
                      type="url"
                      placeholder="https://linkedin.com/in/..."
                      value={form.linkedinUrl}
                      onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cover Letter & Message</label>
                  <textarea
                    rows={3}
                    placeholder="Brief introduction or highlight of relevant projects..."
                    value={form.coverLetter}
                    onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
                    className="w-full p-3 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-xl text-xs"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowApplyForm(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit Application
                  </button>
                </div>
              </form>
            )}

            {/* Description & Requirements View */}
            {!showApplyForm && !successMessage && (
              <div className="space-y-6 pt-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {selectedJob.description && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Job Overview</h3>
                    <p className="whitespace-pre-line">{selectedJob.description}</p>
                  </div>
                )}

                {selectedJob.responsibilities && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Responsibilities</h3>
                    <p className="whitespace-pre-line">{selectedJob.responsibilities}</p>
                  </div>
                )}

                {selectedJob.requirements && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Requirements</h3>
                    <p className="whitespace-pre-line">{selectedJob.requirements}</p>
                  </div>
                )}

                {selectedJob.required_skills && selectedJob.required_skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Desired Skills</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.required_skills.map((sk: string, idx: number) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Job Openings Grid */
          <div className="space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">
                Current Job Openings
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Explore engineering, technical, and operational career paths at {companyName}.
              </p>
            </div>

            {jobs.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-2">
                <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Open Positions Currently</h3>
                <p className="text-xs text-slate-400">Check back soon for new openings.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 hover:border-amber-500 group"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        {job.departments?.name || 'General'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 group-hover:text-amber-600 transition">
                        {job.title}
                      </h3>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> {job.location}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {job.employment_type || 'Full-time'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                      <span>View Position</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {companyName}. Powered by KAA ERP Hub Recruitment ATS.
      </footer>
    </div>
  );
};
