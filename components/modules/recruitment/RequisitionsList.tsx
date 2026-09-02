import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { RequisitionModal } from './RequisitionModal';
import { 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Briefcase, 
  AlertCircle,
  MoreVertical,
  ChevronRight,
  UserCheck,
  Building2,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';

interface RequisitionsListProps {
  companyId: string;
  userId?: string;
  departments: { id: number; name: string }[];
  employees: { id: string; name: string }[];
  onOpenJobCreateWithRequisition?: (requisition: any) => void;
}

export const RequisitionsList: React.FC<RequisitionsListProps> = ({
  companyId,
  userId,
  departments,
  employees,
  onOpenJobCreateWithRequisition
}) => {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [requisitionToEdit, setRequisitionToEdit] = useState<any | null>(null);

  const fetchRequisitions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recruitment_requisitions')
        .select(`
          *,
          departments(id, name),
          hiring_manager:employees!recruitment_requisitions_hiring_manager_id_fkey(id, first_name, last_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequisitions(data || []);
    } catch (err: any) {
      console.error('Error fetching requisitions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchRequisitions();
  }, [companyId]);

  const handleUpdateStatus = async (id: string, newStatus: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('recruitment_requisitions')
        .update({
          status: newStatus,
          rejection_reason: reason || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      fetchRequisitions();
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const filteredRequisitions = requisitions.filter(req => {
    const matchesSearch = 
      req.position_title?.toLowerCase().includes(search.toLowerCase()) ||
      req.requisition_no?.toLowerCase().includes(search.toLowerCase()) ||
      req.location?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = selectedStatus === 'ALL' || req.status === selectedStatus;
    const matchesDept = selectedDept === 'ALL' || String(req.department_id) === selectedDept;

    return matchesSearch && matchesStatus && matchesDept;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">✓ Approved</span>;
      case 'PENDING_APPROVAL':
      case 'SUBMITTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">⏳ Pending Approval</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">✕ Rejected</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-slate-400">Closed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400">Draft</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">● Urgent</span>;
      case 'HIGH':
        return <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">● High</span>;
      case 'MEDIUM':
        return <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">● Medium</span>;
      default:
        return <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">● Low</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-500" />
            Manpower Requisitions
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Internal departmental hiring requests, approval routing, and vacancy authorizations.
          </p>
        </div>

        <button
          onClick={() => { setRequisitionToEdit(null); setIsCreateModalOpen(true); }}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Requisition
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, requisition #, or location..."
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
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted / In Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
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

      {/* Requisitions Grid / List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-medium">
          Loading manpower requisitions...
        </div>
      ) : filteredRequisitions.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">No Requisitions Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create a requisition to request manpower or vacancy approvals for your organization.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRequisitions.map((req) => (
            <div
              key={req.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                      {req.requisition_no}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {req.position_title}
                    </h3>
                  </div>
                  {getStatusBadge(req.status)}
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Building2 className="w-3.5 h-3.5" /> Department:
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {req.departments?.name || 'General'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <UserCheck className="w-3.5 h-3.5" /> Vacancies:
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {req.vacancies} position{req.vacancies > 1 ? 's' : ''} ({req.employment_type})
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5" /> Priority:
                    </span>
                    {getPriorityBadge(req.priority)}
                  </div>

                  {req.salary_min && (
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-400">Budget:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {req.salary_min} - {req.salary_max} {req.currency}
                      </span>
                    </div>
                  )}
                </div>

                {req.business_justification && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-3 p-2 bg-slate-50 dark:bg-zinc-800/50 rounded-lg italic">
                    "{req.business_justification}"
                  </p>
                )}
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {req.status === 'DRAFT' && (
                    <button
                      onClick={() => handleUpdateStatus(req.id, 'SUBMITTED')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 rounded-md transition"
                    >
                      Submit
                    </button>
                  )}

                  {(req.status === 'SUBMITTED' || req.status === 'PENDING_APPROVAL') && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(req.id, 'APPROVED')}
                        className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-md transition flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </button>
                      <button
                        onClick={() => {
                          const r = prompt('Reason for rejection:');
                          if (r) handleUpdateStatus(req.id, 'REJECTED', r);
                        }}
                        className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-md transition"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {req.status === 'APPROVED' && (
                    <button
                      onClick={() => onOpenJobCreateWithRequisition && onOpenJobCreateWithRequisition(req)}
                      className="px-3 py-1.5 text-xs font-black bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Briefcase className="w-3.5 h-3.5" /> Post Job Opening
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => { setRequisitionToEdit(req); setIsCreateModalOpen(true); }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold underline"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Requisition Create/Edit Modal */}
      {isCreateModalOpen && (
        <RequisitionModal
          companyId={companyId}
          userId={userId}
          departments={departments}
          employees={employees}
          requisitionToEdit={requisitionToEdit}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchRequisitions();
          }}
        />
      )}
    </div>
  );
};
