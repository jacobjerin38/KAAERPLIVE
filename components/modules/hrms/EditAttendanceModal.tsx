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
    const [isMonthLocked, setIsMonthLocked] = useState(false);
    const [recordMeta, setRecordMeta] = useState<any>(null);
    const [formData, setFormData] = useState({
        checkIn: '',
        checkOut: '',
        status: '',
        reason: '',
        isLate: false,
        lateMinutes: 0,
        isEarlyLeaving: false,
        earlyMinutes: 0,
        otHours: 0
    });

    useEffect(() => {
        fetchRecord();
    }, [recordId]);

    const fetchRecord = async () => {
        const { data, error } = await (supabase as any).from('attendance').select('*').eq('id', recordId).single();
        if (data) {
            const d = data as any;
            setRecordMeta(d);
            setFormData({
                checkIn: d.check_in ? new Date(d.check_in).toTimeString().slice(0, 5) : '',
                checkOut: d.check_out ? new Date(d.check_out).toTimeString().slice(0, 5) : '',
                status: d.status || 'Present',
                reason: '',
                isLate: d.is_late || false,
                lateMinutes: d.late_minutes || 0,
                isEarlyLeaving: d.is_early_leaving || false,
                earlyMinutes: d.early_minutes || 0,
                otHours: d.ot_hours || 0
            });
            setIsProcessed(d.is_processed === true);

            // Check if month is locked in attendance_periods
            if (d.company_id && d.date) {
                const { data: periodData } = await supabase.from('attendance_periods')
                    .select('status')
                    .eq('company_id', d.company_id)
                    .lte('start_date', d.date)
                    .gte('end_date', d.date)
                    .maybeSingle();

                if (periodData?.status === 'LOCKED') {
                    setIsMonthLocked(true);
                }
            }
        }
        setFetching(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isMonthLocked) {
            alert("Attendance for this month is locked and cannot be modified.");
            return;
        }
        if (!formData.reason.trim()) {
            alert("An edit reason is required for audit purposes.");
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const dateStr = recordMeta?.date;
            let checkInTs = formData.checkIn ? new Date(`${dateStr}T${formData.checkIn}:00`).toISOString() : null;
            let checkOutTs = formData.checkOut ? new Date(`${dateStr}T${formData.checkOut}:00`).toISOString() : null;

            // Overnight shift check
            let duration = 0;
            if (checkInTs && checkOutTs) {
                let diffMs = new Date(checkOutTs).getTime() - new Date(checkInTs).getTime();
                if (diffMs < 0) {
                    diffMs += 24 * 60 * 60 * 1000;
                    checkOutTs = new Date(new Date(checkOutTs).getTime() + 24 * 60 * 60 * 1000).toISOString();
                }
                duration = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
            }

            const updates = {
                check_in: checkInTs,
                check_out: checkOutTs,
                status: formData.status,
                total_hours: duration,
                duration: duration,
                edited_by: user?.id,
                edited_at: new Date().toISOString(),
                edit_reason: formData.reason
            };

            const { error } = await supabase.from('attendance').update(updates).eq('id', recordId);
            if (error) throw error;

            // Audit Log in attendance_corrections_log
            if (recordMeta) {
                const logsToInsert: any[] = [];
                if (recordMeta.check_in !== checkInTs) {
                    logsToInsert.push({
                        company_id: recordMeta.company_id,
                        attendance_id: recordId,
                        attendance_period_id: recordMeta.attendance_period_id,
                        employee_id: recordMeta.employee_id,
                        date: recordMeta.date,
                        field_name: 'check_in',
                        old_value: recordMeta.check_in,
                        new_value: checkInTs,
                        correction_reason: formData.reason,
                        changed_by: user?.id
                    });
                }
                if (recordMeta.check_out !== checkOutTs) {
                    logsToInsert.push({
                        company_id: recordMeta.company_id,
                        attendance_id: recordId,
                        attendance_period_id: recordMeta.attendance_period_id,
                        employee_id: recordMeta.employee_id,
                        date: recordMeta.date,
                        field_name: 'check_out',
                        old_value: recordMeta.check_out,
                        new_value: checkOutTs,
                        correction_reason: formData.reason,
                        changed_by: user?.id
                    });
                }
                if (recordMeta.status !== formData.status) {
                    logsToInsert.push({
                        company_id: recordMeta.company_id,
                        attendance_id: recordId,
                        attendance_period_id: recordMeta.attendance_period_id,
                        employee_id: recordMeta.employee_id,
                        date: recordMeta.date,
                        field_name: 'status',
                        old_value: recordMeta.status,
                        new_value: formData.status,
                        correction_reason: formData.reason,
                        changed_by: user?.id
                    });
                }

                if (logsToInsert.length > 0) {
                    await supabase.from('attendance_corrections_log').insert(logsToInsert);
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            alert(err.message || "Failed to update attendance.");
        } finally {
            setLoading(false);
        }
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
                    {isMonthLocked ? (
                        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-start gap-3">
                            <Lock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-rose-700 dark:text-rose-400">Attendance Month is Locked</p>
                                <p className="text-xs text-rose-600 dark:text-rose-500 mt-1">Attendance for this month is locked and cannot be modified without an authorized admin reopen.</p>
                            </div>
                        </div>
                    ) : isProcessed ? (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
                            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">This record is processed & locked</p>
                                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">To edit, unprocess the day first from the Daily Attendance tab.</p>
                            </div>
                        </div>
                    ) : null}
                    {(formData.isLate || formData.isEarlyLeaving || formData.otHours > 0) && (
                        <div className="flex flex-wrap gap-2">
                            {formData.isLate && (
                                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg text-xs font-bold flex items-center gap-1">
                                    Late ({formData.lateMinutes} min)
                                </span>
                            )}
                            {formData.isEarlyLeaving && (
                                <span className="px-2.5 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg text-xs font-bold flex items-center gap-1">
                                    Early Leaving ({formData.earlyMinutes} min)
                                </span>
                            )}
                            {formData.otHours > 0 && (
                                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-xs font-bold flex items-center gap-1">
                                    OT: {formData.otHours}h
                                </span>
                            )}
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
                            disabled={loading || isProcessed || isMonthLocked}
                            type="submit"
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : isMonthLocked ? <><Lock className="w-5 h-5" /> Month Locked (Read Only)</> : <><Save className="w-5 h-5" /> Update Record</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
