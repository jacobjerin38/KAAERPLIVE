import React, { useState, useEffect } from 'react';
import { Settings, Clock, Calendar, Fingerprint, Plus, SwitchCamera, Save, Trash2, Key, Wallet } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { HolidayCalendar } from './HolidayCalendar';
import { AttendanceSettings as AttendanceSettingsPanel } from './AttendanceSettings';
import { LeaveAccrualManager } from './LeaveAccrualManager';

export const SettingsModule: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'HOLIDAYS' | 'LEAVE_ACCRUAL' | 'BIOMETRIC'>('ATTENDANCE');
    
    // State logic for settings forms
    const [graceMinutes, setGraceMinutes] = useState(15);
    const [overtimeMin, setOvertimeMin] = useState(60);
    const [mobileCheckin, setMobileCheckin] = useState(true);
    
    // Biometric state
    const [biometricApiKey, setBiometricApiKey] = useState('');
    const [enableBiometric, setEnableBiometric] = useState(false);

    // Holidays state
    const [holidays, setHolidays] = useState<any[]>([]);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [newHoliday, setNewHoliday] = useState({ name: '', date: '', description: '' });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (currentCompanyId) {
            fetchSettings();
            fetchHolidays();
        }
    }, [currentCompanyId]);

    const fetchSettings = async () => {
        const { data, error } = await (supabase
            .from('org_attendance_settings')
            .select('*')
            .eq('company_id', currentCompanyId)
            .maybeSingle() as any);
            
        if (data) {
            setGraceMinutes(data.grace_timing_minutes ?? 15);
            setOvertimeMin(data.overtime_min_minutes ?? 60);
            setMobileCheckin(data.enable_mobile_attendance ?? true);
            setBiometricApiKey(data.biometric_api_key ?? '');
            setEnableBiometric(data.enable_biometric ?? false);
        }
    };

    const fetchHolidays = async () => {
        const { data } = await supabase
            .from('org_holidays')
            .select('*')
            .eq('company_id', currentCompanyId)
            .order('date', { ascending: true });
        if (data) setHolidays(data);
    };

    const handleSaveSettings = async () => {
        setLoading(true);
        const updates = {
            company_id: currentCompanyId,
            grace_timing_minutes: graceMinutes,
            overtime_min_minutes: overtimeMin,
            enable_mobile_attendance: mobileCheckin,
            enable_biometric: enableBiometric,
            biometric_api_key: biometricApiKey,
            updated_at: new Date().toISOString()
        };

        const { error } = await (supabase
            .from('org_attendance_settings')
            .upsert(updates, { onConflict: 'company_id' }) as any);

        if (error) {
            alert("Error saving settings: " + error.message);
        } else {
            alert("Settings saved successfully!");
        }
        setLoading(false);
    };

    const handleAddHoliday = async () => {
        if (!newHoliday.name || !newHoliday.date) return alert("Name and Date are required");
        setLoading(true);
        const { error } = await supabase.from('org_holidays').insert([{
            company_id: currentCompanyId,
            name: newHoliday.name,
            date: newHoliday.date,
            description: newHoliday.description
        }]);
        if (!error) {
            setShowHolidayModal(false);
            setNewHoliday({ name: '', date: '', description: '' });
            fetchHolidays();
        } else {
            alert("Error adding holiday: " + error.message);
        }
        setLoading(false);
    };

    const handleDeleteHoliday = async (id: number) => {
        if (!confirm("Remove this holiday?")) return;
        await supabase.from('org_holidays').delete().eq('id', id);
        fetchHolidays();
    };

    const generateNewApiKey = () => {
        const p1 = Math.random().toString(36).substring(2, 15);
        const p2 = Math.random().toString(36).substring(2, 15);
        const newKey = `KAA_${p1}${p2}`.toUpperCase();
        setBiometricApiKey(newKey);
    };
    return (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">Organization Settings</h2>
            
            <div className="flex bg-white/50 dark:bg-zinc-900/50 p-1.5 rounded-2xl w-fit mb-8 shadow-sm">
                {[
                    { id: 'ATTENDANCE', label: 'Attendance & Overtime', icon: Clock },
                    { id: 'HOLIDAYS', label: 'Holiday Calendar', icon: Calendar },
                    { id: 'LEAVE_ACCRUAL', label: 'Leave Accrual', icon: Wallet },
                    { id: 'BIOMETRIC', label: 'Biometric Devices', icon: Fingerprint },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                            activeTab === tab.id 
                            ? 'bg-rose-600 text-white shadow-md' 
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1">
                {activeTab === 'ATTENDANCE' && <AttendanceSettingsPanel />}
                {activeTab === 'HOLIDAYS' && <HolidayCalendar />}
                {activeTab === 'LEAVE_ACCRUAL' && <LeaveAccrualManager />}
                
                {activeTab === 'BIOMETRIC' && (
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-4xl shadow-sm space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Biometric & Attendance Device Integration</h3>
                            <p className="text-sm text-slate-500">Connect Hikvision iVMS-4200 (All Series) and ZKTeco BioTime (9.01+) directly to KAA ERP.</p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <SwitchCamera className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">Biometric Real-Time Sync</h4>
                                    <p className="text-xs text-slate-500">Enable automatic punch log ingestion from device software</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${enableBiometric ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-200 text-slate-500'}`}>
                                    {enableBiometric ? 'Active' : 'Disabled'}
                                </span>
                                <input 
                                    type="checkbox" 
                                    checked={enableBiometric}
                                    onChange={(e) => setEnableBiometric(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                />
                            </div>
                        </div>
                        
                        <div className={`p-6 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-start gap-4 transition-opacity ${!enableBiometric ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="w-full">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cloud Webhook Endpoint URL</label>
                                <div className="p-3 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold select-all break-all">
                                    https://euoaoyzpurbvcoxydunl.supabase.co/functions/v1/device-sync
                                </div>
                            </div>

                            <div className="w-full">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Device Secret API Key (`x-api-key` header)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={biometricApiKey || 'Not Generated'}
                                        readOnly
                                        className="w-full p-3.5 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 font-mono text-xs text-slate-700 dark:text-slate-300"
                                    />
                                    <button onClick={generateNewApiKey} className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5">
                                        <Key className="w-3.5 h-3.5" /> Regenerate Key
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1.5">Or use query string: <code className="text-indigo-500 font-mono">?api_key={biometricApiKey || 'YOUR_KEY'}</code></p>
                            </div>
                        </div>

                        {/* Integration Guides for Hikvision & BioTime */}
                        <div className="space-y-4 pt-2">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Device Integration Instructions</h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Hikvision iVMS-4200 Guide */}
                                <div className="p-5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-3">
                                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                                        <Shield className="w-4 h-4" /> Hikvision iVMS-4200 / HikCentral
                                    </div>
                                    <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside font-medium">
                                        <li>Open <b>iVMS-4200</b> &rarr; <b>Access Control</b> &rarr; <b>Event Management</b>.</li>
                                        <li>Go to <b>HTTP Listening / Event Push</b> settings.</li>
                                        <li>Set Destination URL: <br/><code className="text-[10px] bg-slate-200 dark:bg-zinc-900 px-1 py-0.5 rounded font-mono select-all">https://euoaoyzpurbvcoxydunl.supabase.co/functions/v1/device-sync</code></li>
                                        <li>Add Header: <code className="text-[10px] bg-slate-200 dark:bg-zinc-900 px-1 py-0.5 rounded font-mono">x-api-key: {biometricApiKey || 'YOUR_KEY'}</code></li>
                                        <li>Enable <b>Real-time Event Upload</b> (JSON format).</li>
                                    </ol>
                                </div>

                                {/* ZKTeco BioTime Guide */}
                                <div className="p-5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-3">
                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                                        <Fingerprint className="w-4 h-4" /> ZKTeco BioTime (9.01+ & 8.5)
                                    </div>
                                    <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside font-medium">
                                        <li>Log into <b>BioTime 9.0+</b> Admin Portal &rarr; <b>System</b>.</li>
                                        <li>Go to <b>API / Webhook Push Settings</b>.</li>
                                        <li>Enter Push Endpoint: <br/><code className="text-[10px] bg-slate-200 dark:bg-zinc-900 px-1 py-0.5 rounded font-mono select-all">https://euoaoyzpurbvcoxydunl.supabase.co/functions/v1/device-sync?api_key={biometricApiKey || 'YOUR_KEY'}</code></li>
                                        <li>Set Trigger: <b>On Punch Transaction Insert</b>.</li>
                                        <li>Save & click <b>Test Push Connection</b>.</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleSaveSettings}
                            disabled={loading}
                            className="mt-6 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center gap-2 active:scale-95 transition-all w-fit shadow-md shadow-indigo-600/20"
                        >
                            <Save className="w-5 h-5" />
                            {loading ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
