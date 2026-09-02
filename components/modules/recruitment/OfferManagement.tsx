import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { OfferModal } from './OfferModal';
import { EmployeeConversionModal } from './EmployeeConversionModal';
import { 
  DollarSign, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Send, 
  UserCheck, 
  FileText, 
  Calendar, 
  Building2, 
  ArrowRight,
  ChevronRight
} from 'lucide-react';

interface OfferManagementProps {
  companyId: string;
  userId?: string;
  departments: { id: number; name: string }[];
  designations: { id: number; name: string }[];
  prefilledApplicationId?: string;
  prefilledCandidate?: any;
  onClearPrefill?: () => void;
}

export const OfferManagement: React.FC<OfferManagementProps> = ({
  companyId,
  userId,
  departments,
  designations,
  prefilledApplicationId,
  prefilledCandidate,
  onClearPrefill
}) => {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [offerToEdit, setOfferToEdit] = useState<any | null>(null);
  const [conversionCandidate, setConversionCandidate] = useState<any | null>(null);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recruitment_offers')
        .select(`
          *,
          candidate:recruitment_candidates(*),
          job:recruitment_jobs(id, title),
          designation:org_designations(id, name),
          department:departments(id, name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (err: any) {
      console.error('Error fetching offers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchOffers();
  }, [companyId]);

  useEffect(() => {
    if (prefilledApplicationId && prefilledCandidate) {
      setOfferToEdit(null);
      setIsModalOpen(true);
    }
  }, [prefilledApplicationId, prefilledCandidate]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('recruitment_offers')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      fetchOffers();
    } catch (err: any) {
      alert('Error updating offer status: ' + err.message);
    }
  };

  const filteredOffers = offers.filter(off => {
    const c = off.candidate;
    const q = search.toLowerCase();
    const matchesSearch = 
      off.offer_number?.toLowerCase().includes(q) ||
      c?.first_name?.toLowerCase().includes(q) ||
      c?.last_name?.toLowerCase().includes(q) ||
      off.job?.title?.toLowerCase().includes(q);

    const matchesStatus = selectedStatus === 'ALL' || off.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const totalPending = offers.filter(o => o.status === 'PENDING_APPROVAL').length;
  const totalAccepted = offers.filter(o => o.status === 'ACCEPTED').length;
  const totalSent = offers.filter(o => o.status === 'SENT').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Offer Letters & Compensation Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generate formal employment offers, manage approval workflows, and convert accepted candidates to employees.
          </p>
        </div>

        <button
          onClick={() => { setOfferToEdit(null); setIsModalOpen(true); }}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Employment Offer
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400">Total Offers</div>
          <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{offers.length}</div>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400">Pending Approval</div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{totalPending}</div>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400">Sent to Candidates</div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{totalSent}</div>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400">Accepted by Candidates</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{totalAccepted}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search offer #, candidate, position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="DECLINED">Declined</option>
        </select>
      </div>

      {/* Offers Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-medium">
          Loading offers...
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">No Offers Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create an offer for shortlisted candidates to begin the compensation and hiring workflow.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-zinc-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-800">
                <th className="p-3.5">Offer #</th>
                <th className="p-3.5">Candidate</th>
                <th className="p-3.5">Designation & Dept</th>
                <th className="p-3.5">Monthly Total</th>
                <th className="p-3.5">Joining Date</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredOffers.map((off) => {
                const c = off.candidate;

                return (
                  <tr key={off.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition">
                    <td className="p-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {off.offer_number}
                    </td>

                    <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                      {c ? `${c.first_name} ${c.last_name}` : 'Candidate'}
                      <div className="text-[11px] text-slate-400 font-normal">{c?.email}</div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {off.designation?.name || off.job?.title || 'Position'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {off.department?.name || 'Department'}
                      </div>
                    </td>

                    <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {off.total_salary?.toLocaleString()} {off.currency || 'QAR'}
                      <div className="text-[10px] text-slate-400 font-normal">
                        Basic: {off.basic_salary?.toLocaleString()}
                      </div>
                    </td>

                    <td className="p-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {new Date(off.joining_date).toLocaleDateString()}
                    </td>

                    <td className="p-3.5 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        off.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                        off.status === 'APPROVED' ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300' :
                        off.status === 'SENT' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
                        off.status === 'DECLINED' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}>
                        {off.status}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {off.status === 'PENDING_APPROVAL' && (
                          <button
                            onClick={() => handleUpdateStatus(off.id, 'APPROVED')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition"
                          >
                            Approve
                          </button>
                        )}

                        {off.status === 'APPROVED' && (
                          <button
                            onClick={() => handleUpdateStatus(off.id, 'SENT')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> Mark Sent
                          </button>
                        )}

                        {off.status === 'SENT' && (
                          <button
                            onClick={() => handleUpdateStatus(off.id, 'ACCEPTED')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition"
                          >
                            Mark Accepted
                          </button>
                        )}

                        {off.status === 'ACCEPTED' && (
                          <button
                            onClick={() => setConversionCandidate({ candidate: off.candidate, offer: off })}
                            className="px-3 py-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1 shadow-sm"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Convert to Employee
                          </button>
                        )}

                        <button
                          onClick={() => { setOfferToEdit(off); setIsModalOpen(true); }}
                          className="text-xs text-slate-400 hover:text-slate-600 underline ml-1"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Offer Modal */}
      {isModalOpen && (
        <OfferModal
          companyId={companyId}
          userId={userId}
          departments={departments}
          designations={designations}
          applicationId={prefilledApplicationId}
          candidate={prefilledCandidate}
          offerToEdit={offerToEdit}
          onClose={() => {
            setIsModalOpen(false);
            if (onClearPrefill) onClearPrefill();
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            if (onClearPrefill) onClearPrefill();
            fetchOffers();
          }}
        />
      )}

      {/* Employee Conversion Modal */}
      {conversionCandidate && (
        <EmployeeConversionModal
          candidate={conversionCandidate.candidate}
          application={{ id: conversionCandidate.offer?.application_id }}
          companyId={companyId}
          userId={userId}
          departments={departments}
          designations={designations}
          onClose={() => setConversionCandidate(null)}
          onSuccess={() => {
            setConversionCandidate(null);
            fetchOffers();
          }}
        />
      )}
    </div>
  );
};
