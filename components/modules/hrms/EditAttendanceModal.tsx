import React, { useState, useEffect } from 'react';
import { X, Save, Clock, AlertCircle, Lock } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { AttendanceRecord, Employee } from '../../hrms/types';

interface EditAttendanceModalProps {
    recordId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const EditAttendanceModal: React.FC<EditAttendanceModalProps> = ({ recordId, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [isProcessed, setIsProcessed] = useState(false);
    const [formData, setFormData] = useState({
        checkIn: '',
        checkOut: '',
        status: '',
        reason: ''
    });

    useEffect(() => {
        fetchRecord();
    }, [recordId]);

    const fetchRecord = async () => {
        const { data, error } = await supabase.from('attendance').select('*').eq('id', recordId).single();
        if (data) {
            setFormData({
                checkIn: data.check_in || '',
                checkOut: data.check_out || '',
                status: data.status || 'Present',
                reason: ''
            });
            setIsProcessed(data.is_processed === true);
        }
        setFetching(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.reason.trim()) {
            alert("An edit reason is required for audit purposes.");
            return;
        }

        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        // Calculate duration if both check-in and check-out exist
        let duration = 0;
        if (formData.checkIn && formData.checkOut) {
            const inDate = new Date(`2000-01-01T${formData.checkIn}`);
            const outDate = new Date(`2000-01-01T${formData.checkOut}`);
            const diffMs = outDate.getTime() - inDate.getTime();
            duration = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
        }

        const updates = {
            check_in: formData.checkIn || null,
            check_out: formData.checkOut || null,
            status: formData.status,
            duration: duration,
            edited_by: user?.id,
            edited_at: new Date().toISOString(),
            edit_reason: formData.reason
        };

        const { error } = await supabase.from('attendance').update(updates).eq('id', recordId);

        if (error) {
            alert("Failed to update attendance: " + error.message);
        } else {
            onSuccess();
            onClose();
        }
        setLoading(false);
    };

    if (fetching) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-white/50 dark:border-zinc-800 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Edit Attendance</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-5">
                    {isProcessed && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
                            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">This record is processed & locked</p>
                                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">To edit, unprocess the day first from the Daily Attendance tab.</p>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Check In</label>
                            <input
                                type="time"
                                value={formData.checkIn}
                                onChange={e => setFormData({ ...formData, checkIn: e.target.value })}
                                className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Check Out</label>
                            <input
                                type="time"
                                value={formData.checkOut}
                                onChange={e => setFormData({ ...formData, checkOut: e.target.value })}
                                className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                        <select
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        >
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                            <option value="Half Day">Half Day</option>
                            <option value="On Leave">On Leave</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            Edit Reason <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            required
                            value={formData.reason}
                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            placeholder="Why are you changing this record?"
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none h-24 resize-none text-slate-900 dark:text-white"
                        />
                        <p className="text-[10px] text-slate-400 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 p-2 rounded-lg">
                            <AlertCircle className="w-3 h-3" /> This action will be logged in the audit trail.
                        </p>
                    </div>

                    <div className="pt-2">
                        <button
                            disabled={loading || isProcessed}
                            type="submit"
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : <><Save className="w-5 h-5" /> Update Record</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
