import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Employee } from '../types';
import { X, Save, DollarSign } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

interface CompensationChangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: Employee;
    onSuccess?: () => void;
}

export const CompensationChangeModal: React.FC<CompensationChangeModalProps> = ({ isOpen, onClose, employee, onSuccess }) => {
    const { currentCompanyId } = useAuth();
    const [loading, setLoading] = useState(false);
    const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
    const [newCtc, setNewCtc] = useState<string>(employee.salary_amount?.toString() || '');
    const [reason, setReason] = useState('INCREMENT');
    const [remarks, setRemarks] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Check if table exists, otherwise alert (since I might not have RPC or table support for this specifically verified)
            // But based on SQL, table `employee_compensation_versions` exists.

            const { error } = await supabase.from('employee_compensation_versions').insert([{
                company_id: currentCompanyId,
                employee_id: employee.id,
                effective_date: effectiveDate,
                ctc: parseFloat(newCtc),
                reason: reason,
                is_active: false, // Needs approval or activation logic, usually
                // component_breakdown: [] // Ideal to include this
            }]);

            if (error) throw error;

            alert('Compensation change recorded (Draft/Pending).');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving compensation:', error);
            alert('Failed to save: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                        Update Compensation
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Reason</label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 outline-none"
                        >
                            <option value="INCREMENT">Annual Increment</option>
                            <option value="CORRECTION">Correction</option>
                            <option value="PROMOTION">Promotion Adjustment</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Effective Date</label>
                        <input
                            type="date"
                            required
                            value={effectiveDate}
                            onChange={(e) => setEffectiveDate(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">New CTC (Annual)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                            <input
                                type="number"
                                required
                                value={newCtc}
                                onChange={(e) => setNewCtc(e.target.value)}
                                className="w-full pl-8 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 font-mono font-bold"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Remarks</label>
                        <textarea
                            rows={2}
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50"
                            placeholder="Optional notes..."
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
