import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { X, UserCheck, ShieldAlert, CheckCircle2, Loader2, Building2, Calendar, DollarSign } from 'lucide-react';

interface EmployeeConversionModalProps {
  candidate: any;
  application?: any;
  companyId: string;
  userId?: string;
  departments: { id: number; name: string }[];
  designations: { id: number; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export const EmployeeConversionModal: React.FC<EmployeeConversionModalProps> = ({
  candidate,
  application,
  companyId,
  userId,
  departments,
  designations,
  onClose,
  onSuccess
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(true);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const [form, setForm] = useState({
    employee_code: `EMP-${Date.now().toString().slice(-5)}`,
    first_name: candidate?.first_name || '',
    last_name: candidate?.last_name || '',
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    department_id: departments[0]?.id ? String(departments[0].id) : '',
    designation_id: designations[0]?.id ? String(designations[0].id) : '',
    joining_date: new Date().toISOString().split('T')[0],
    employment_type: 'Full-time',
    status: 'Active',
    basic_salary: candidate?.expected_salary || 10000,
    housing_allowance: 3000,
    transport_allowance: 1500,
    other_allowances: 500
  });

  // Verify against existing employees table for duplicates
  useEffect(() => {
    const checkDuplicates = async () => {
      setCheckingDuplicates(true);
      try {
        if (!candidate?.email && !candidate?.phone) {
          setCheckingDuplicates(false);
          return;
        }

        let query = supabase
          .from('employees')
          .select('id, first_name, last_name, email, phone, employee_code')
          .eq('company_id', companyId);

        const { data: existingEmployees } = await query;

        const emailMatch = existingEmployees?.find(
          e => e.email && candidate.email && e.email.toLowerCase() === candidate.email.toLowerCase()
        );

        if (emailMatch) {
          setDuplicateWarning(
            `An employee with email "${candidate.email}" already exists: ${emailMatch.first_name} ${emailMatch.last_name} (${emailMatch.employee_code}).`
          );
        }
      } catch (err) {
        console.warn('Duplicate check warning:', err);
      } finally {
        setCheckingDuplicates(false);
      }
    };

    checkDuplicates();
  }, [candidate, companyId]);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.email || !form.employee_code) {
      alert('Please fill out all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Employee in HRMS employees table
      const employeePayload = {
        company_id: companyId,
        employee_code: form.employee_code,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || null,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        designation_id: form.designation_id ? parseInt(form.designation_id) : null,
        joining_date: form.joining_date,
        employment_type: form.employment_type,
        status: form.status,
        basic_salary: parseFloat(String(form.basic_salary)) || 0,
        housing_allowance: parseFloat(String(form.housing_allowance)) || 0,
        transport_allowance: parseFloat(String(form.transport_allowance)) || 0,
        other_allowances: parseFloat(String(form.other_allowances)) || 0
      };

      const { data: newEmployee, error: empErr } = await supabase
        .from('employees')
        .insert(employeePayload)
        .select('id')
        .single();

      if (empErr) throw empErr;

      // 2. Link created employee back to recruitment_candidates
      await supabase
        .from('recruitment_candidates')
        .update({
          employee_id: newEmployee.id,
          status: 'HIRED',
          updated_at: new Date().toISOString()
        })
        .eq('id', candidate.id);

      // 3. Mark Application as HIRED if present
      if (application?.id) {
        await supabase
          .from('recruitment_applications')
          .update({
            stage: 'HIRED',
            status: 'HIRED',
            stage_entered_at: new Date().toISOString()
          })
          .eq('id', application.id);

        // Audit stage history
        await supabase.from('recruitment_stage_history').insert({
          company_id: companyId,
          application_id: application.id,
          old_stage: application.stage || 'OFFER_ACCEPTED',
          new_stage: 'HIRED',
          changed_by: userId || null,
          reason_or_notes: `Candidate formally converted to HRMS Employee (${form.employee_code})`
        });
      }

      alert(`Success! ${form.first_name} ${form.last_name} is now created as Employee ${form.employee_code} in HRMS.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error converting candidate to employee:', err);
      alert('Failed to convert candidate: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Convert Candidate to HRMS Employee
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Maps accepted candidate profile into the permanent Employee Directory.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConvert} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Duplicate Warning */}
          {duplicateWarning && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs">
              <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Potential Duplicate Employee Alert</div>
                <div>{duplicateWarning}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Employee Code *</label>
              <input
                type="text"
                required
                value={form.employee_code}
                onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-mono font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">First Name *</label>
              <input
                type="text"
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Last Name</label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Corporate / Personal Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Mobile Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Designation</label>
              <select
                value={form.designation_id}
                onChange={(e) => setForm({ ...form, designation_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              >
                <option value="">Select Designation...</option>
                {designations.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Joining Date *</label>
              <input
                type="date"
                required
                value={form.joining_date}
                onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              />
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
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Initial Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
              >
                <option value="Active">Active</option>
                <option value="Probation">Probation</option>
              </select>
            </div>
          </div>

          {/* Salary Structure Initial Setup */}
          <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Initial Monthly Salary Setup (QAR)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Basic Salary</label>
                <input
                  type="number"
                  value={form.basic_salary}
                  onChange={(e) => setForm({ ...form, basic_salary: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Housing</label>
                <input
                  type="number"
                  value={form.housing_allowance}
                  onChange={(e) => setForm({ ...form, housing_allowance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Transport</label>
                <input
                  type="number"
                  value={form.transport_allowance}
                  onChange={(e) => setForm({ ...form, transport_allowance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Other</label>
                <input
                  type="number"
                  value={form.other_allowances}
                  onChange={(e) => setForm({ ...form, other_allowances: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirm & Create HRMS Employee
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
