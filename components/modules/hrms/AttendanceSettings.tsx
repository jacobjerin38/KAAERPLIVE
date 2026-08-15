import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Clock, Save, Loader2, AlertCircle, CheckCircle, Settings, Trash2, Edit3, ShieldCheck } from 'lucide-react';

interface AttendanceConfig {
    grace_minutes_late: number;
    grace_minutes_early: number;
    standard_hours: number;
    break_minutes: number;
    ot_threshold_hours: number;
    ot_multiplier: number;
    weekend_ot_multiplier?: number;
    holiday_ot_multiplier?: number;
    max_ot_hours_per_day?: number;
    ot_approval_required?: boolean;
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
        weekend_ot_multiplier: 2.0,
        holiday_ot_multiplier: 2.0,
        max_ot_hours_per_day: 4.0,
        ot_approval_required: true,
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

    // OT Authority Mapping State
    const [employees, setEmployees] = useState<any[]>([]);
    const [otAuthorities, setOtAuthorities] = useState<any[]>([]);
    const [editingOtAuthId, setEditingOtAuthId] = useState<string | null>(null);
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [level1, setLevel1] = useState('');
    const [level2, setLevel2] = useState('');
    const [level3, setLevel3] = useState('');
    const [savingOtAuth, setSavingOtAuth] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (currentCompanyId) {
            fetchSettings();
            fetchOtAuthorities();
            fetchEmployees();
        }
    }, [currentCompanyId]);

    const fetchEmployees = async () => {
        const { data } = await supabase
            .from('employees')
            .select('id, name, employee_code, designation')
            .eq('company_id', currentCompanyId)
            .eq('status', 'Active')
            .order('name');
        setEmployees(data || []);
    };

    const fetchOtAuthorities = async () => {
        const { data } = await (supabase as any)
            .from('employee_ot_authority')
            .select(`
                *,
                employee:employees!employee_id(name, employee_code),
                l1:employees!approver_level_1(name),
                l2:employees!approver_level_2(name),
                l3:employees!approver_level_3(name)
            `)
            .eq('company_id', currentCompanyId)
            .eq('is_active', true);
        setOtAuthorities(data || []);
    };

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
                weekend_ot_multiplier: d.weekend_ot_multiplier || 2.0,
                holiday_ot_multiplier: d.holiday_ot_multiplier || 2.0,
                max_ot_hours_per_day: d.max_ot_hours_per_day || 4.0,
                ot_approval_required: d.ot_approval_required ?? true,
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

    const handleEditOtAuthority = (auth: any) => {
        setEditingOtAuthId(auth.id);
        setSelectedEmpId(auth.employee_id);
        setLevel1(auth.approver_level_1 || '');
        setLevel2(auth.approver_level_2 || '');
        setLevel3(auth.approver_level_3 || '');
    };

    const handleCancelEditOtAuth = () => {
        setEditingOtAuthId(null);
        setSelectedEmpId('');
        setLevel1('');
        setLevel2('');
        setLevel3('');
    };

    const handleSaveOtAuthority = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmpId || !level1) {
            alert('Please select Employee and Level 1 Approver.');
            return;
        }
        setSavingOtAuth(true);

        const payload = {
            company_id: currentCompanyId,
            employee_id: selectedEmpId,
            approver_level_1: level1 || null,
            approver_level_2: level2 || null,
            approver_level_3: level3 || null,
            is_active: true
        };

        const { error } = await (supabase as any)
            .from('employee_ot_authority')
            .upsert(payload, { onConflict: 'company_id,employee_id' });

        if (error) {
            alert('Failed to save Overtime Authority Mapping: ' + error.message);
        } else {
            alert(editingOtAuthId ? 'Overtime Authority Mapping Updated!' : 'Overtime Authority Mapping Saved!');
            handleCancelEditOtAuth();
            fetchOtAuthorities();
        }
        setSavingOtAuth(false);
    };

    const handleDeleteOtAuthority = async (id: string) => {
        if (!confirm('Remove this OT approval authority mapping?')) return;
        const { error } = await (supabase as any)
            .from('employee_ot_authority')
            .delete()
            .eq('id', id);
        if (error) alert('Failed to delete mapping: ' + error.message);
        else {
            if (editingOtAuthId === id) handleCancelEditOtAuth();
            fetchOtAuthorities();
        }
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 animate-page-enter">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Clock className="w-6 h-6 text-indigo-500" /> Attendance & Overtime Configuration
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Configure grace timing, overtime thresholds, multipliers, and OT approval authorities</p>
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
                    <Clock className="w-4 h-4 text-slate-400" /> Working Hours Calculation
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

            {/* Overtime Settings */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" /> Overtime Settings & Policy Controls
                    </h4>
                    <label className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.ot_approval_required ?? true}
                            onChange={e => setConfig({...config, ot_approval_required: e.target.checked})}
                            className="w-5 h-5 text-indigo-600 rounded"
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Enforce Mandatory Manager Approval for OT Pay
                        </span>
                    </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">OT Starts After (hours)</label>
                        <input
                            type="number" step="0.5" min="1" max="24"
                            value={config.ot_threshold_hours}
                            onChange={e => setConfig({...config, ot_threshold_hours: Number(e.target.value)})}
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <p className="text-xs text-slate-400 mt-1">Hours beyond standard day</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Standard Day Multiplier</label>
                        <input
                            type="number" step="0.25" min="1" max="4"
                            value={config.ot_multiplier}
                            onChange={e => setConfig({...config, ot_multiplier: Number(e.target.value)})}
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <p className="text-xs text-slate-400 mt-1">Default 1.5x</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Weekend Multiplier</label>
                        <input
                            type="number" step="0.25" min="1" max="4"
                            value={config.weekend_ot_multiplier || 2.0}
                            onChange={e => setConfig({...config, weekend_ot_multiplier: Number(e.target.value)})}
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <p className="text-xs text-slate-400 mt-1">Off-day multiplier (e.g. 2.0x)</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Public Holiday Multiplier</label>
                        <input
                            type="number" step="0.25" min="1" max="4"
                            value={config.holiday_ot_multiplier || 2.0}
                            onChange={e => setConfig({...config, holiday_ot_multiplier: Number(e.target.value)})}
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <p className="text-xs text-slate-400 mt-1">Holiday multiplier (e.g. 2.0x)</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Max OT / Day (hours)</label>
                        <input
                            type="number" step="0.5" min="1" max="16"
                            value={config.max_ot_hours_per_day || 4.0}
                            onChange={e => setConfig({...config, max_ot_hours_per_day: Number(e.target.value)})}
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <p className="text-xs text-slate-400 mt-1">Daily cap (e.g. max 4.0 hrs)</p>
                    </div>
                </div>
            </div>

            {/* Overtime Approval Authority Mapping */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-orange-500" /> 3-Level Overtime Approval Authority Mapping
                    </h4>
                    {editingOtAuthId && (
                        <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold flex items-center gap-1">
                            <Edit3 className="w-3.5 h-3.5" /> Editing Mapping
                        </span>
                    )}
                </div>
                <p className="text-sm text-slate-500 mb-6">Configure 3-tier approval hierarchy per employee for Overtime Requests and Timesheets.</p>

                <form onSubmit={handleSaveOtAuthority} className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employee *</label>
                            <select
                                required
                                value={selectedEmpId}
                                onChange={e => setSelectedEmpId(e.target.value)}
                                className="w-full p-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium"
                            >
                                <option value="">Select Employee</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Level 1 Approver *</label>
                            <select
                                required
                                value={level1}
                                onChange={e => setLevel1(e.target.value)}
                                className="w-full p-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium"
                            >
                                <option value="">Select Level 1 Approver</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Level 2 Approver (Optional)</label>
                            <select
                                value={level2}
                                onChange={e => setLevel2(e.target.value)}
                                className="w-full p-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium"
                            >
                                <option value="">Select Level 2 Approver</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Level 3 Approver (Optional)</label>
                            <select
                                value={level3}
                                onChange={e => setLevel3(e.target.value)}
                                className="w-full p-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium"
                            >
                                <option value="">Select Level 3 Approver</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        {editingOtAuthId && (
                            <button
                                type="button"
                                onClick={handleCancelEditOtAuth}
                                className="px-4 py-2 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={savingOtAuth}
                            className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
                        >
                            {savingOtAuth ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {editingOtAuthId ? 'Update OT Authority' : 'Save OT Authority Mapping'}
                        </button>
                    </div>
                </form>

                {/* OT Authority List Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 uppercase font-bold">
                            <tr>
                                <th className="p-3">Employee</th>
                                <th className="p-3">Level 1 Approver</th>
                                <th className="p-3">Level 2 Approver</th>
                                <th className="p-3">Level 3 Approver</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {otAuthorities.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-4 text-center text-slate-400">No custom OT approval authorities mapped yet. (Defaulting to manager hierarchy)</td>
                                </tr>
                            ) : otAuthorities.map(auth => (
                                <tr key={auth.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{auth.employee?.name} ({auth.employee?.employee_code})</td>
                                    <td className="p-3 font-semibold text-emerald-600">{auth.l1?.name || '—'}</td>
                                    <td className="p-3 font-semibold text-indigo-600">{auth.l2?.name || '—'}</td>
                                    <td className="p-3 font-semibold text-purple-600">{auth.l3?.name || '—'}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => handleEditOtAuthority(auth)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                                title="Edit mapping"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteOtAuthority(auth.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                                                title="Delete mapping"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
