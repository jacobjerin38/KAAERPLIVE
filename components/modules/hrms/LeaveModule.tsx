import React from 'react';
import {
    Calendar, Check, X
} from 'lucide-react';
import { LeaveRequest } from '../../hrms/types';

interface LeaveModuleProps {
    leaves: LeaveRequest[];
    leaveTypes: any[];
    setShowLeaveModal: (show: boolean) => void;
    onUpdateStatus: (id: string, status: 'Approved' | 'Rejected') => void;
    formatDate: (date: string) => string;
}

export const LeaveModule: React.FC<LeaveModuleProps> = ({
    leaves, leaveTypes, setShowLeaveModal, onUpdateStatus, formatDate
}) => {
    // Quick Stats Calculation
    const pendingCount = leaves.filter(l => l.status === 'Pending').length;

    // We can filter "Approved Today" if we assume appliedOn is relevant or start_date
    // For now we'll mock the 'Approved Today' if we don't have approval timestamp
    const approvedCount = leaves.filter(l => l.status === 'Approved').length;

    // "On Leave" could be calculated by checking if today is within start/end date
    const onLeaveCount = leaves.filter(l => l.status === 'Approved').length; // Placeholder logic as in original

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <header className="flex justify-between items-center mb-8 shrink-0">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Leave Administration</h2>
                <div className="flex gap-2">
                    <button onClick={() => alert("Policy Settings coming in Phase 6")} className="px-5 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-zinc-700">Policy Settings</button>
                    <button onClick={() => setShowLeaveModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all">Grant Leave</button>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 shrink-0">
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pending</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{pendingCount}</h3>
                    </div>
                </div>
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                        <Check className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Approved Total</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{approvedCount}</h3>
                    </div>
                </div>
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center">
                        <X className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">On Leave</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{onLeaveCount}</h3>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Leave Requests</h3>
                    <div className="flex gap-2 text-sm">
                        <button className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg font-bold text-slate-600 dark:text-slate-300">All</button>
                        <button className="px-3 py-1 bg-transparent rounded-lg font-medium text-slate-400 hover:text-indigo-500">Pending</button>
                        <button className="px-3 py-1 bg-transparent rounded-lg font-medium text-slate-400 hover:text-indigo-500">History</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 dark:bg-zinc-800/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/60 dark:border-zinc-700">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dates</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50">
                            {leaves.length > 0 ? leaves.map((req, i) => (
                                <tr key={i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700 dark:text-slate-200">Employee #{req.id ? req.id.substring(0, 4) : i + 1}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                                        {leaveTypes.find(lt => lt.id === req.leave_type_id)?.name || req.type}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">{formatDate(req.appliedOn)}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">{req.reason || 'Personal'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                            req.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                            }`}>{req.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        {req.status === 'Pending' && (
                                            <>
                                                <button title="Approve" onClick={() => onUpdateStatus(req.id, 'Approved')} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"><Check className="w-4 h-4" /></button>

                                                <button title="Reject" onClick={() => onUpdateStatus(req.id, 'Rejected')} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"><X className="w-4 h-4" /></button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-slate-400 italic">No leave requests found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
