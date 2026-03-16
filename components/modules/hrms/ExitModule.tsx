import React, { useState, useEffect } from 'react';
import { Check, X, LogOut } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Employee } from '../../hrms/types';
import { Modal } from '../../ui/Modal';

interface ExitModuleProps {
    employees: Employee[];
    currentEmployee: Employee | null;
}

export const ExitModule: React.FC<ExitModuleProps> = ({ employees, currentEmployee }) => {
    const [resignations, setResignations] = useState<any[]>([]);
    const [showResignModal, setShowResignModal] = useState(false);

    useEffect(() => {
        fetchResignations();
    }, []);

    const fetchResignations = async () => {
        const { data } = await supabase
            .from('resignations')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setResignations(data);
    };

    const handleUpdateResignation = async (id: string, status: string, comment: string) => {
        const { error } = await supabase.from('resignations').update({ status, manager_comment: comment }).eq('id', id);
        if (error) alert("Failed to update resignation");
        else fetchResignations();
    };

    const handleSubmitResignation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentEmployee) return;

        const formData = new FormData(e.target as HTMLFormElement);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();

        const { error } = await supabase.from('resignations').insert([{
            company_id: profile?.company_id,
            employee_id: currentEmployee.id,
            reason_category: formData.get('category'),
            reason_text: formData.get('reason'),
            proposed_last_working_date: formData.get('lastWorkingDate'),
            status: 'Pending'
        }]);

        if (error) alert("Error submitting resignation: " + error.message);
        else {
            alert("Resignation submitted successfully");
            setShowResignModal(false);
            fetchResignations();
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getEmployeeName = (id: string) => {
        const emp = employees.find(e => e.id === id);
        return emp ? emp.name : 'Unknown';
    };

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Exit Management</h2>
                <button onClick={() => setShowResignModal(true)} className="bg-rose-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-rose-700 hover:shadow-lg shadow-rose-500/30 transition-all active:scale-95">
                    <LogOut className="w-4 h-4" /> Submit Resignation
                </button>
            </div>

            <div className="flex-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 dark:bg-zinc-800/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/60 dark:border-zinc-700">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Last Working Date</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50">
                            {resignations.length > 0 ? resignations.map((res, i) => (
                                <tr key={i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700 dark:text-slate-200">
                                            {/* Use employee_id to find name in local list */}
                                            {getEmployeeName(res.employee_id)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="block text-sm font-medium text-slate-600 dark:text-slate-300">{res.reason_category}</span>
                                        <span className="text-xs text-slate-400 max-w-xs truncate block">{res.reason_text}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">{formatDate(res.proposed_last_working_date)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${res.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                            res.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                            }`}>{res.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        {res.status === 'Pending' && (
                                            <>
                                                <button onClick={() => handleUpdateResignation(res.id, 'Approved', 'Approved by Admin')} title="Approve" className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => handleUpdateResignation(res.id, 'Rejected', 'Rejected by Admin')} title="Reject" className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"><X className="w-4 h-4" /></button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-slate-400 italic">No resignation requests found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showResignModal && (
                <Modal title="Submit Resignation" onClose={() => setShowResignModal(false)}>
                    <form onSubmit={handleSubmitResignation} className="space-y-4">
                        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-100 dark:border-rose-900/50">
                            <h4 className="font-bold text-rose-800 dark:text-rose-200 mb-1">Important Notice</h4>
                            <p className="text-xs text-rose-600 dark:text-rose-300">
                                Submitting a resignation request will initiate the exit process. This action will notify HR and your reporting manager.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason Category</label>
                            <select name="category" required className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                                <option value="">Select Reason...</option>
                                <option value="Constructive Resignation">Better Opportunity</option>
                                <option value="Personal Reasons">Personal Reasons</option>
                                <option value="Relocation">Relocation</option>
                                <option value="Higher Education">Higher Education</option>
                                <option value="Health">Health Issues</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Detailed Reason</label>
                            <textarea name="reason" required placeholder="Checking out..." className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white min-h-[100px]"></textarea>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Proposed Last Working Day</label>
                            <input type="date" name="lastWorkingDate" required className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        </div>

                        <button className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold hover:shadow-lg shadow-rose-500/30 active:scale-95 transition-all">Submit Request</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
