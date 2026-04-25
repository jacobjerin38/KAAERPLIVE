import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Clock, Save, Loader2, AlertCircle, CheckCircle, Settings } from 'lucide-react';

interface AttendanceConfig {
    grace_minutes_late: number;
    grace_minutes_early: number;
    standard_hours: number;
    ot_threshold_hours: number;
    ot_multiplier: number;
    half_day_hours: number;
    auto_absent_if_no_punch: boolean;
}

export const AttendanceSettings: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [config, setConfig] = useState<AttendanceConfig>({
        grace_minutes_late: 15,
        grace_minutes_early: 15,
        standard_hours: 8,
        ot_threshold_hours: 8,
        ot_multiplier: 1.5,
        half_day_hours: 4,
        auto_absent_if_no_punch: true
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (currentCompanyId) fetchSettings();
    }, [currentCompanyId]);

    const fetchSettings = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('attendance_settings')
            .select('*')
            .eq('company_id', currentCompanyId)
            .maybeSingle();
        if (data) {
            setConfig({
                grace_minutes_late: data.grace_minutes_late || 15,
                grace_minutes_early: data.grace_minutes_early || 15,
                standard_hours: data.standard_hours || 8,
                ot_threshold_hours: data.ot_threshold_hours || 8,
                ot_multiplier: data.ot_multiplier || 1.5,
                half_day_hours: data.half_day_hours || 4,
                auto_absent_if_no_punch: data.auto_absent_if_no_punch ?? true
            });
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>
    );
};
