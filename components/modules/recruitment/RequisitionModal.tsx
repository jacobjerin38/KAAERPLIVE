import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { X, Loader2, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface RequisitionModalProps {
  companyId: string;
  userId?: string;
  departments: { id: number; name: string }[];
  employees: { id: string; name: string }[];
  requisitionToEdit?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const RequisitionModal: React.FC<RequisitionModalProps> = ({
  companyId,
  userId,
  departments,
  employees,
  requisitionToEdit,
  onClose,
  onSuccess
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    requisition_no: requisitionToEdit?.requisition_no || `REQ-${Date.now().toString().slice(-6)}`,
    position_title: requisitionToEdit?.position_title || '',
    department_id: requisitionToEdit?.department_id ? String(requisitionToEdit.department_id) : '',
    vacancies: requisitionToEdit?.vacancies || 1,
    employment_type: requisitionToEdit?.employment_type || 'Full-time',
    location: requisitionToEdit?.location || 'Doha, Qatar',
    hiring_manager_id: requisitionToEdit?.hiring_manager_id || '',
    reporting_manager_id: requisitionToEdit?.reporting_manager_id || '',
    required_date: requisitionToEdit?.required_date || '',
    priority: requisitionToEdit?.priority || 'MEDIUM',
    min_experience: requisitionToEdit?.min_experience || 0,
    max_experience: requisitionToEdit?.max_experience || 10,
    salary_min: requisitionToEdit?.salary_min || '',
    salary_max: requisitionToEdit?.salary_max || '',
    currency: requisitionToEdit?.currency || 'QAR',
    education: requisitionToEdit?.education || 'Bachelor Degree',
    required_skills: (requisitionToEdit?.required_skills || []).join(', '),
    job_description: requisitionToEdit?.job_description || '',
    business_justification: requisitionToEdit?.business_justification || '',
    is_replacement: requisitionToEdit?.is_replacement || false,
    replacement_employee_id: requisitionToEdit?.replacement_employee_id || ''
  });

  const handleSubmit = async (e: React.FormEvent, submitStatus: 'DRAFT' | 'SUBMITTED') => {
    e.preventDefault();
    if (!form.position_title || !form.location) {
      alert('Please fill out position title and location.');
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
        requisition_no: form.requisition_no,
        position_title: form.position_title,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        vacancies: parseInt(String(form.vacancies)) || 1,
        employment_type: form.employment_type,
        location: form.location,
        hiring_manager_id: form.hiring_manager_id || null,
        reporting_manager_id: form.reporting_manager_id || null,
        required_date: form.required_date || null,
        priority: form.priority,
        min_experience: parseFloat(String(form.min_experience)) || 0,
        max_experience: parseFloat(String(form.max_experience)) || 10,
        salary_min: form.salary_min ? parseFloat(String(form.salary_min)) : null,
        salary_max: form.salary_max ? parseFloat(String(form.salary_max)) : null,
        currency: form.currency,
        education: form.education || null,
        required_skills: skillsArray,
        job_description: form.job_description || null,
        business_justification: form.business_justification || null,
        is_replacement: form.is_replacement,
        replacement_employee_id: form.is_replacement ? form.replacement_employee_id || null : null,
        status: submitStatus,
        created_by: userId || null
      };

      if (requisitionToEdit) {
        const { error } = await supabase
          .from('recruitment_requisitions')
          .update(payload)
          .eq('id', requisitionToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('recruitment_requisitions')
          .insert(payload);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving requisition:', err);
      alert('Failed to save requisition: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {requisitionToEdit ? 'Edit Manpower Requisition' : 'New Manpower Requisition'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Request a new vacancy or replacement with approval workflow.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={(e) => handleSubmit(e, 'SUBMITTED')} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Requisition No</label>
              <input
                type="text"
                readOnly
                value={form.requisition_no}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-mono font-bold text-slate-600"
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Position / Job Title *</label>
              <input
                required
                type="text"
                placeholder="e.g. Senior Electrical Engineer"
                value={form.position_title}
                onChange={(e) => setForm({ ...form, position_title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100"
              />
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
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Vacancies Count *</label>
              <input
                type="number"
                min="1"
                required
                value={form.vacancies}
                onChange={(e) => setForm({ ...form, vacancies: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Location</label>
              <input
                required
                type="text"
                placeholder="e.g. Doha, Qatar"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Target Joining Date</label>
              <input
                type="date"
                value={form.required_date}
                onChange={(e) => setForm({ ...form, required_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              />
            </div>
          </div>

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
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Reporting Manager</label>
              <select
                value={form.reporting_manager_id}
                onChange={(e) => setForm({ ...form, reporting_manager_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              >
                <option value="">Select Reporting Manager...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Experience & Salary Range */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Min Experience (Yrs)</label>
              <input
                type="number"
                min="0"
                value={form.min_experience}
                onChange={(e) => setForm({ ...form, min_experience: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Max Experience (Yrs)</label>
              <input
                type="number"
                min="0"
                value={form.max_experience}
                onChange={(e) => setForm({ ...form, max_experience: parseFloat(e.target.value) || 10 })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Salary Min ({form.currency})</label>
              <input
                type="number"
                placeholder="e.g. 10000"
                value={form.salary_min}
                onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Salary Max ({form.currency})</label>
              <input
                type="number"
                placeholder="e.g. 15000"
                value={form.salary_max}
                onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Required Skills (Comma-separated)</label>
            <input
              type="text"
              placeholder="e.g. AutoCAD, Revit, Electrical Design, Substation, Project Management"
              value={form.required_skills}
              onChange={(e) => setForm({ ...form, required_skills: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
            />
          </div>

          {/* Replacement Toggle */}
          <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_replacement}
                onChange={(e) => setForm({ ...form, is_replacement: e.target.checked })}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                This is a replacement position (replacing an existing or departed employee)
              </span>
            </label>
            {form.is_replacement && (
              <select
                value={form.replacement_employee_id}
                onChange={(e) => setForm({ ...form, replacement_employee_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold mt-2"
              >
                <option value="">Select Employee Being Replaced...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Business Justification *</label>
            <textarea
              required
              rows={2}
              placeholder="Explain project requirements, workload increase, or replacement rationale..."
              value={form.business_justification}
              onChange={(e) => setForm({ ...form, business_justification: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Job Description & Responsibilities</label>
            <textarea
              rows={3}
              placeholder="Core duties, deliverables, and performance expectations..."
              value={form.job_description}
              onChange={(e) => setForm({ ...form, job_description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={(e) => handleSubmit(e, 'DRAFT')}
              className="px-4 py-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
