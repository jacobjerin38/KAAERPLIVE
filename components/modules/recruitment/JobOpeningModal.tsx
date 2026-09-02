import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { X, Loader2, Briefcase, Globe, Save } from 'lucide-react';

interface JobOpeningModalProps {
  companyId: string;
  userId?: string;
  departments: { id: number; name: string }[];
  employees: { id: string; name: string }[];
  jobToEdit?: any;
  prefillFromRequisition?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const JobOpeningModal: React.FC<JobOpeningModalProps> = ({
  companyId,
  userId,
  departments,
  employees,
  jobToEdit,
  prefillFromRequisition,
  onClose,
  onSuccess
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: jobToEdit?.title || prefillFromRequisition?.position_title || '',
    department_id: jobToEdit?.department_id ? String(jobToEdit.department_id) : prefillFromRequisition?.department_id ? String(prefillFromRequisition.department_id) : '',
    location: jobToEdit?.location || prefillFromRequisition?.location || 'Doha, Qatar',
    employment_type: jobToEdit?.employment_type || prefillFromRequisition?.employment_type || 'Full-time',
    vacancies: jobToEdit?.vacancies || prefillFromRequisition?.vacancies || 1,
    priority: jobToEdit?.priority || prefillFromRequisition?.priority || 'MEDIUM',
    min_experience_years: jobToEdit?.min_experience_years || prefillFromRequisition?.min_experience || 0,
    max_experience_years: jobToEdit?.max_experience_years || prefillFromRequisition?.max_experience || 10,
    education_level: jobToEdit?.education_level || prefillFromRequisition?.education || 'Bachelor Degree',
    required_skills: (jobToEdit?.required_skills || prefillFromRequisition?.required_skills || []).join(', '),
    salary_range_min: jobToEdit?.salary_range_min || prefillFromRequisition?.salary_min || '',
    salary_range_max: jobToEdit?.salary_range_max || prefillFromRequisition?.salary_max || '',
    currency: jobToEdit?.currency || prefillFromRequisition?.currency || 'QAR',
    application_deadline: jobToEdit?.application_deadline || '',
    hiring_manager_id: jobToEdit?.hiring_manager_id || prefillFromRequisition?.hiring_manager_id || '',
    recruiter_id: jobToEdit?.recruiter_id || '',
    status: jobToEdit?.status || 'PUBLISHED',
    description: jobToEdit?.description || prefillFromRequisition?.job_description || '',
    responsibilities: jobToEdit?.responsibilities || '',
    requirements: jobToEdit?.requirements || '',
    requisition_id: jobToEdit?.requisition_id || prefillFromRequisition?.id || null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.location) {
      alert('Please fill out job title and location.');
      return;
    }

    setSubmitting(true);
    try {
      const skillsArray = form.required_skills
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);

      const payload = {
        company_id: companyId,
        title: form.title,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        location: form.location,
        employment_type: form.employment_type,
        vacancies: parseInt(String(form.vacancies)) || 1,
        priority: form.priority,
        min_experience_years: parseFloat(String(form.min_experience_years)) || 0,
        max_experience_years: parseFloat(String(form.max_experience_years)) || 10,
        education_level: form.education_level,
        required_skills: skillsArray,
        salary_range_min: form.salary_range_min ? parseFloat(String(form.salary_range_min)) : null,
        salary_range_max: form.salary_range_max ? parseFloat(String(form.salary_range_max)) : null,
        currency: form.currency,
        application_deadline: form.application_deadline || null,
        hiring_manager_id: form.hiring_manager_id || null,
        recruiter_id: form.recruiter_id || null,
        status: form.status,
        description: form.description || null,
        responsibilities: form.responsibilities || null,
        requirements: form.requirements || null,
        requisition_id: form.requisition_id || null,
        updated_at: new Date().toISOString()
      };

      if (jobToEdit) {
        const { error } = await supabase
          .from('recruitment_jobs')
          .update(payload)
          .eq('id', jobToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('recruitment_jobs')
          .insert(payload);
        if (error) throw error;

        // If created from requisition, mark requisition as CLOSED
        if (prefillFromRequisition?.id) {
          await supabase
            .from('recruitment_requisitions')
            .update({ status: 'CLOSED' })
            .eq('id', prefillFromRequisition.id);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving job opening:', err);
      alert('Failed to save job opening: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {jobToEdit ? 'Edit Job Opening' : 'Post New Job Opening'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Publish positions to the internal pipeline and external Careers Portal.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Job Title *</label>
              <input
                required
                type="text"
                placeholder="e.g. Senior Electrical Design Engineer"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Publishing Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold text-amber-600"
              >
                <option value="PUBLISHED">Published (Visible on Portal)</option>
                <option value="DRAFT">Draft (Internal Only)</option>
                <option value="CLOSED">Closed (Archived)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Department</label>
              <select
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              >
                <option value="">Select Department...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Employment Type</label>
              <select
                value={form.employment_type}
                onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract / Project</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Location *</label>
              <input
                required
                type="text"
                placeholder="e.g. Doha, Qatar"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Vacancies</label>
              <input
                type="number"
                min="1"
                value={form.vacancies}
                onChange={(e) => setForm({ ...form, vacancies: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Application Deadline</label>
              <input
                type="date"
                value={form.application_deadline}
                onChange={(e) => setForm({ ...form, application_deadline: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Hiring Team */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Hiring Manager</label>
              <select
                value={form.hiring_manager_id}
                onChange={(e) => setForm({ ...form, hiring_manager_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              >
                <option value="">Select Manager...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Assigned Recruiter</label>
              <select
                value={form.recruiter_id}
                onChange={(e) => setForm({ ...form, recruiter_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              >
                <option value="">Select Recruiter...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Experience, Education & Salary Range */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Min Exp (Yrs)</label>
              <input
                type="number"
                min="0"
                value={form.min_experience_years}
                onChange={(e) => setForm({ ...form, min_experience_years: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Max Exp (Yrs)</label>
              <input
                type="number"
                min="0"
                value={form.max_experience_years}
                onChange={(e) => setForm({ ...form, max_experience_years: parseFloat(e.target.value) || 10 })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Min Salary ({form.currency})</label>
              <input
                type="number"
                placeholder="e.g. 12000"
                value={form.salary_range_min}
                onChange={(e) => setForm({ ...form, salary_range_min: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Max Salary ({form.currency})</label>
              <input
                type="number"
                placeholder="e.g. 18000"
                value={form.salary_range_max}
                onChange={(e) => setForm({ ...form, salary_range_max: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Required Skills (Used for deterministic match scoring)
            </label>
            <input
              type="text"
              placeholder="e.g. AutoCAD, Revit, Electrical Design, Substation, HVAC"
              value={form.required_skills}
              onChange={(e) => setForm({ ...form, required_skills: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Job Description & Summary</label>
            <textarea
              rows={3}
              placeholder="Overview of the position, team, and objectives..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Responsibilities & Duties</label>
            <textarea
              rows={3}
              placeholder="Day-to-day duties, technical deliverables..."
              value={form.responsibilities}
              onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
            />
          </div>

          {/* Footer Actions */}
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
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {jobToEdit ? 'Update Job' : 'Publish Job Opening'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
