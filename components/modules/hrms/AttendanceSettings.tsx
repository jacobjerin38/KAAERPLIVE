import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Clock, Save, Loader2, AlertCircle, CheckCircle, Settings } from 'lucide-react';

interface AttendanceConfig {
    grace_minutes_late: number;
    grace_minutes_early: number;
    standard_hours: number;
    break_minutes: number;
    ot_threshold_hours: number;
    ot_multiplier: number;
    half_day_hours: number;
    auto_absent_if_no_punch: boolean;
    late_deduction_enabled?: boolean;
    late_deduction_type?: string;
    late_penalty_type?: string;
    late_deduction_amount?: number;
    half_day_threshold?: number;
    early_deduction_enabled?: boolean;
    early_deduction_type?: string;
    early_deduction_amount?: number;
}

export const AttendanceSettings: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [config, setConfig] = useState<AttendanceConfig>({
        grace_minutes_late: 15,
        grace_minutes_early: 15,
        standard_hours: 8,
        break_minutes: 60,
        ot_threshold_hours: 8,
        ot_multiplier: 1.5,
        half_day_hours: 4,
        auto_absent_if_no_punch: true,
        late_deduction_enabled: false,
        late_deduction_type: 'per_instance',
        late_penalty_type: 'half_day',
        late_deduction_amount: 0,
        half_day_threshold: 3,
        early_deduction_enabled: false,
        early_deduction_type: 'per_instance',
        early_deduction_amount: 0
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (currentCompanyId) fetchSettings();
    }, [currentCompanyId]);

    const fetchSettings = async () => {
        setLoading(true);
        const { data } = await (supabase as any)
            .from('attendance_settings')
            .select('*')
            .eq('company_id', currentCompanyId)
            .maybeSingle();
        if (data) {
            const d = data as any;
            setConfig({
                grace_minutes_late: d.grace_minutes_late || 15,
                grace_minutes_early: d.grace_minutes_early || 15,
                standard_hours: d.standard_hours || 8,
                break_minutes: d.break_minutes ?? 60,
                ot_threshold_hours: d.ot_threshold_hours || 8,
                ot_multiplier: d.ot_multiplier || 1.5,
                half_day_hours: d.half_day_hours || 4,
                auto_absent_if_no_punch: d.auto_absent_if_no_punch ?? true,
                late_deduction_enabled: d.late_deduction_enabled || false,
                late_deduction_type: d.late_deduction_type || 'per_instance',
                late_penalty_type: d.late_penalty_type || 'half_day',
                late_deduction_amount: d.late_deduction_amount || 0,
                half_day_threshold: d.half_day_threshold || 3,
                early_deduction_enabled: d.early_deduction_enabled || false,
                early_deduction_type: d.early_deduction_type || 'per_instance',
                early_deduction_amount: d.early_deduction_amount || 0
            });
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await (supabase as any)
            .from('attendance_settings')
            .upsert({
                company_id: currentCompanyId,
                ...config,
                updated_at: new Date().toISOString()
            }, { onConflict: 'company_id' });

        if (error) {
            alert('Error saving settings: ' + error.message);
        } else {
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        }
        setSaving(false);
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 animate-page-enter">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Clock className="w-6 h-6 text-indigo-500" /> Attendance Configuration
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Configure grace timing, overtime thresholds, and punch rules</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-60"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
                </button>
            </div>

            {/* Grace Timing */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-400" /> Grace Timing
                </h4>
                <p className="text-sm text-slate-500 mb-6">Employees arriving within the grace period will not be marked as late.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Late Arrival Grace (minutes)</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range" min="0" max="60" step="5"
                                value={config.grace_minutes_late}
                                onChange={e => setConfig({...config, grace_minutes_late: Number(e.target.value)})}
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <span className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg text-sm font-black min-w-[60px] text-center">
                                {config.grace_minutes_late} min
                            </span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Early Leave Grace (minutes)</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range" min="0" max="60" step="5"
                                value={config.grace_minutes_early}
                                onChange={e => setConfig({...config, grace_minutes_early: Number(e.target.value)})}
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <span className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg text-sm font-black min-w-[60px] text-center">
                                {config.grace_minutes_early} min
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Working Hours */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" /> Working Hours
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Standard Hours / Day</label>
                        <input
                            type="number" step="0.5" min="1" max="24"
                            value={config.standard_hours}
                            onChange={e => setConfig({...config, standard_hours: Number(e.target.value)})}
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Break Duration (minutes)</label>
                        <input
                            type="number" step="5" min="0" max="240"
                            value={config.break_minutes}
                            onChange={e => setConfig({...config, break_minutes: Number(e.target.value)})}
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <p className="text-xs text-slate-400 mt-1">Deducted from gross duration</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Half Day Threshold (hours)</label>
                        <input
                            type="number" step="0.5" min="1" max="12"
                            value={config.half_day_hours}
                            onChange={e => setConfig({...config, half_day_hours: Number(e.target.value)})}
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <p className="text-xs text-slate-400 mt-1">Less than this = Half Day</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Auto-Absent on No Punch</label>
                        <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.auto_absent_if_no_punch}
                                onChange={e => setConfig({...config, auto_absent_if_no_punch: e.target.checked})}
                                className="w-5 h-5 text-indigo-600 rounded"
                            />
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                {config.auto_absent_if_no_punch ? 'Enabled' : 'Disabled'}
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Overtime */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" /> Overtime Rules
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">OT Starts After (hours)</label>
                        <input
                            type="number" step="0.5" min="1" max="24"
                            value={config.ot_threshold_hours}
                            onChange={e => setConfig({...config, ot_threshold_hours: Number(e.target.value)})}
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <p className="text-xs text-slate-400 mt-1">Hours worked beyond this = Overtime</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">OT Multiplier</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range" min="1" max="3" step="0.25"
                                value={config.ot_multiplier}
                                onChange={e => setConfig({...config, ot_multiplier: Number(e.target.value)})}
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                            />
                            <span className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg text-sm font-black min-w-[60px] text-center">
                                {config.ot_multiplier}x
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Standard = 1.5x, Double = 2x</p>
                    </div>
                </div>
            </div>

            {/* Late & Early Deduction Policy */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-400" /> Late & Early Deduction Policy
                </h4>
                
                {/* Late Deduction */}
                <div className="mb-6 pb-6 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Late Deduction Enabled</label>
                        <label className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.late_deduction_enabled}
                                onChange={e => setConfig({...config, late_deduction_enabled: e.target.checked})}
                                className="w-5 h-5 text-indigo-600 rounded"
                            />
                        </label>
                    </div>

                    {config.late_deduction_enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Late Deduction Type</label>
                                <select
                                    value={config.late_deduction_type}
                                    onChange={e => setConfig({...config, late_deduction_type: e.target.value})}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="per_instance">Flat amount per late instance</option>
                                    <option value="per_minute">Amount per late minute</option>
                                    <option value="half_day_after_n">Convert to half-day after N lates</option>
                                </select>
                            </div>

                            {config.late_deduction_type === 'half_day_after_n' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Late Penalty Type</label>
                                        <select
                                            value={config.late_penalty_type}
                                            onChange={e => setConfig({...config, late_penalty_type: e.target.value})}
                                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            <option value="half_day">Reduce payable days by 0.5</option>
                                            <option value="flat_penalty">Apply flat monetary penalty</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Half Day Threshold (N)</label>
                                        <input
                                            type="number" min="1" step="1"
                                            value={config.half_day_threshold}
                                            onChange={e => setConfig({...config, half_day_threshold: Number(e.target.value)})}
                                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                </>
                            )}

                            {(config.late_deduction_type === 'per_instance' || config.late_deduction_type === 'per_minute' || (config.late_deduction_type === 'half_day_after_n' && config.late_penalty_type === 'flat_penalty')) && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Late Deduction Amount (QAR)</label>
                                    <input
                                        type="number" min="0" step="0.01"
                                        value={config.late_deduction_amount}
                                        onChange={e => setConfig({...config, late_deduction_amount: Number(e.target.value)})}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Early Deduction */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Early Deduction Enabled</label>
                        <label className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.early_deduction_enabled}
                                onChange={e => setConfig({...config, early_deduction_enabled: e.target.checked})}
                                className="w-5 h-5 text-indigo-600 rounded"
                            />
                        </label>
                    </div>

                    {config.early_deduction_enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Early Deduction Type</label>
                                <select
                                    value={config.early_deduction_type}
                                    onChange={e => setConfig({...config, early_deduction_type: e.target.value})}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="per_instance">Flat amount per instance</option>
                                    <option value="per_minute">Amount per minute</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Early Deduction Amount (QAR)</label>
                                <input
                                    type="number" min="0" step="0.01"
                                    value={config.early_deduction_amount}
                                    onChange={e => setConfig({...config, early_deduction_amount: Number(e.target.value)})}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
