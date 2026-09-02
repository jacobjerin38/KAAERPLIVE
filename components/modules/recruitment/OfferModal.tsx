import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { X, Loader2, DollarSign, Calendar, FileText, CheckCircle2 } from 'lucide-react';

interface OfferModalProps {
  companyId: string;
  userId?: string;
  departments: { id: number; name: string }[];
  designations: { id: number; name: string }[];
  applicationId?: string;
  candidate?: any;
  jobId?: string;
  offerToEdit?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const OfferModal: React.FC<OfferModalProps> = ({
  companyId,
  userId,
  departments,
  designations,
  applicationId,
  candidate,
  jobId,
  offerToEdit,
  onClose,
  onSuccess
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    offer_number: offerToEdit?.offer_number || `OFF-${Date.now().toString().slice(-6)}`,
    designation_id: offerToEdit?.designation_id ? String(offerToEdit.designation_id) : '',
    department_id: offerToEdit?.department_id ? String(offerToEdit.department_id) : '',
    basic_salary: offerToEdit?.basic_salary || 10000,
    housing_allowance: offerToEdit?.allowances?.housing || 3000,
    transport_allowance: offerToEdit?.allowances?.transport || 1500,
    other_allowances: offerToEdit?.allowances?.other || 500,
    currency: offerToEdit?.currency || 'QAR',
    joining_date: offerToEdit?.joining_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    probation_months: offerToEdit?.probation_months || 6,
    notice_period_days: offerToEdit?.notice_period_days || 30,
    offer_expiry_date: offerToEdit?.offer_expiry_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    status: offerToEdit?.status || 'DRAFT',
    remarks: offerToEdit?.remarks || ''
  });

  const totalGross = 
    (parseFloat(String(form.basic_salary)) || 0) +
    (parseFloat(String(form.housing_allowance)) || 0) +
    (parseFloat(String(form.transport_allowance)) || 0) +
    (parseFloat(String(form.other_allowances)) || 0);

  const handleSubmit = async (e: React.FormEvent, targetStatus: string) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const allowancesPayload = {
        housing: parseFloat(String(form.housing_allowance)) || 0,
        transport: parseFloat(String(form.transport_allowance)) || 0,
        other: parseFloat(String(form.other_allowances)) || 0
      };

      const payload = {
        company_id: companyId,
        application_id: applicationId || offerToEdit?.application_id,
        candidate_id: candidate?.id || offerToEdit?.candidate_id,
        job_id: jobId || offerToEdit?.job_id,
        offer_number: form.offer_number,
        designation_id: form.designation_id ? parseInt(form.designation_id) : null,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        basic_salary: parseFloat(String(form.basic_salary)) || 0,
        allowances: allowancesPayload,
        total_salary: totalGross,
        currency: form.currency,
        joining_date: form.joining_date,
        probation_months: parseInt(String(form.probation_months)) || 6,
        notice_period_days: parseInt(String(form.notice_period_days)) || 30,
        offer_expiry_date: form.offer_expiry_date || null,
        status: targetStatus,
        remarks: form.remarks || null,
        updated_at: new Date().toISOString()
      };

      if (offerToEdit) {
        const { error } = await supabase
          .from('recruitment_offers')
          .update(payload)
          .eq('id', offerToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('recruitment_offers')
          .insert(payload);
        if (error) throw error;

        // Advance application stage to OFFER
        if (applicationId) {
          await supabase
            .from('recruitment_applications')
            .update({ stage: 'OFFER', stage_entered_at: new Date().toISOString() })
            .eq('id', applicationId);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving offer:', err);
      alert('Failed to save offer: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {offerToEdit ? 'Edit Formal Offer' : 'Generate Employment Offer'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Candidate: {candidate ? `${candidate.first_name} ${candidate.last_name}` : 'Selected Candidate'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => handleSubmit(e, 'PENDING_APPROVAL')} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Offer Letter No</label>
              <input
                type="text"
                readOnly
                value={form.offer_number}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-mono font-bold text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Offer Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold text-amber-600"
              >
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="SENT">Sent to Candidate</option>
                <option value="ACCEPTED">Accepted by Candidate</option>
                <option value="DECLINED">Declined</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          {/* Compensation Breakdown */}
          <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Monthly Compensation Breakdown ({form.currency})
              </h3>
              <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                Total: {totalGross.toLocaleString()} {form.currency} / mo
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Basic Salary *</label>
                <input
                  type="number"
                  required
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
                <label className="text-[11px] font-bold text-slate-500">Other Allowances</label>
                <input
                  type="number"
                  value={form.other_allowances}
                  onChange={(e) => setForm({ ...form, other_allowances: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Expected Joining Date *</label>
              <input
                type="date"
                required
                value={form.joining_date}
                onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Probation (Months)</label>
              <input
                type="number"
                min="0"
                value={form.probation_months}
                onChange={(e) => setForm({ ...form, probation_months: parseInt(e.target.value) || 6 })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Offer Expiry Date</label>
              <input
                type="date"
                value={form.offer_expiry_date}
                onChange={(e) => setForm({ ...form, offer_expiry_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Special Terms & Remarks</label>
            <textarea
              rows={2}
              placeholder="Air ticket eligibility, annual leave terms, performance bonus..."
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="w-full p-3 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
            />
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
              type="button"
              disabled={submitting}
              onClick={(e) => handleSubmit(e, 'DRAFT')}
              className="px-4 py-2 border border-slate-300 text-xs font-bold rounded-lg hover:bg-slate-50"
            >
              Save Draft
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
