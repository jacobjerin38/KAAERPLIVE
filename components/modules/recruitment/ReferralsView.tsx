import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Users, 
  Plus, 
  Gift, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Briefcase, 
  UserCheck, 
  X,
  Loader2
} from 'lucide-react';

interface ReferralsViewProps {
  companyId: string;
  userId?: string;
  jobs: any[];
  employees: { id: string; name: string }[];
}

export const ReferralsView: React.FC<ReferralsViewProps> = ({
  companyId,
  userId,
  jobs,
  employees
}) => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_id: jobs[0]?.id || '',
    referrer_id: employees[0]?.id || '',
    bonus_amount: 2000,
    notes: ''
  });

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recruitment_referrals')
        .select(`
          *,
          candidate:recruitment_candidates(id, first_name, last_name, email, phone),
          job:recruitment_jobs(id, title),
          referrer:employees!recruitment_referrals_referrer_id_fkey(id, first_name, last_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReferrals(data || []);
    } catch (err: any) {
      console.error('Error fetching referrals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchReferrals();
  }, [companyId]);

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Create candidate record
      const { data: newCand, error: candErr } = await supabase
        .from('recruitment_candidates')
        .insert({
          company_id: companyId,
          candidate_code: `REF-${Date.now().toString().slice(-6)}`,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone || null,
          source_name: 'Employee Referral',
          status: 'ACTIVE'
        })
        .select('id')
        .single();

      if (candErr) throw candErr;

      // 2. Create application if job selected
      if (form.job_id) {
        await supabase
          .from('recruitment_applications')
          .insert({
            company_id: companyId,
            candidate_id: newCand.id,
            job_id: form.job_id,
            stage: 'SHORTLISTED',
            match_score: 85,
            status: 'ACTIVE',
            source_name: 'Employee Referral'
          });
      }

      // 3. Create referral record
      const { error: refErr } = await supabase
        .from('recruitment_referrals')
        .insert({
          company_id: companyId,
          candidate_id: newCand.id,
          referrer_id: form.referrer_id || null,
          job_id: form.job_id || null,
          bonus_amount: form.bonus_amount,
          notes: form.notes,
          status: 'SUBMITTED'
        });

      if (refErr) throw refErr;

      setIsModalOpen(false);
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        job_id: jobs[0]?.id || '',
        referrer_id: employees[0]?.id || '',
        bonus_amount: 2000,
        notes: ''
      });
      fetchReferrals();
    } catch (err: any) {
      alert('Error creating referral: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleBonus = async (id: string, currentPaid: boolean) => {
    try {
      const { error } = await supabase
        .from('recruitment_referrals')
        .update({ bonus_paid: !currentPaid })
        .eq('id', id);
      if (error) throw error;
      fetchReferrals();
    } catch (err: any) {
      alert('Error updating bonus: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-500" />
            Employee Referrals & Bonus Program
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track candidates referred by team members and automate referral bonus payouts.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Submit Employee Referral
        </button>
      </div>

      {/* Referrals Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-medium">
          Loading referrals...
        </div>
      ) : referrals.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Gift className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">No Referrals Registered</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Employee referrals yield higher quality hires and streamline onboarding.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-zinc-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-800">
                <th className="p-3.5">Referred Candidate</th>
                <th className="p-3.5">Referred For Job</th>
                <th className="p-3.5">Referred By Employee</th>
                <th className="p-3.5">Referral Date</th>
                <th className="p-3.5">Bonus Amount</th>
                <th className="p-3.5 text-center">Referral Status</th>
                <th className="p-3.5 text-center">Bonus Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {referrals.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition">
                  <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                    {r.candidate?.first_name} {r.candidate?.last_name}
                    <div className="text-[10px] text-slate-400 font-normal">{r.candidate?.email}</div>
                  </td>

                  <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">
                    {r.job?.title || 'General Position'}
                  </td>

                  <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">
                    {r.referrer ? `${r.referrer.first_name} ${r.referrer.last_name}` : 'Staff Member'}
                  </td>

                  <td className="p-3.5 text-slate-500">
                    {new Date(r.referral_date || r.created_at).toLocaleDateString()}
                  </td>

                  <td className="p-3.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                    {r.bonus_amount ? `${r.bonus_amount} QAR` : '—'}
                  </td>

                  <td className="p-3.5 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      r.status === 'HIRED' ? 'bg-emerald-100 text-emerald-800' :
                      r.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {r.status}
                    </span>
                  </td>

                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => handleToggleBonus(r.id, r.bonus_paid)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${
                        r.bonus_paid ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {r.bonus_paid ? '✓ Paid' : 'Unpaid (Mark Paid)'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full max-h-[90vh] shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-800/40">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-500" /> New Employee Referral
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReferral} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Candidate First Name *</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Candidate Last Name</label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Candidate Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Referred For Job Opening</label>
                <select
                  value={form.job_id}
                  onChange={(e) => setForm({ ...form, job_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
                >
                  <option value="">General Talent Pool</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Referred By Employee</label>
                  <select
                    value={form.referrer_id}
                    onChange={(e) => setForm({ ...form, referrer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-semibold"
                  >
                    <option value="">Select Employee...</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Referral Bonus (QAR)</label>
                  <input
                    type="number"
                    value={form.bonus_amount}
                    onChange={(e) => setForm({ ...form, bonus_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Referrer Recommendation Notes</label>
                <textarea
                  rows={2}
                  placeholder="Relationship to candidate, prior work experience, strengths..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full p-3 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Referral'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
