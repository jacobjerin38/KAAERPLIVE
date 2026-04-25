import React, { useState, useEffect } from 'react';
import { Settings, Clock, Calendar, Fingerprint, Plus, SwitchCamera, Save, Trash2, Key } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

export const SettingsModule: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'HOLIDAYS' | 'BIOMETRIC'>('ATTENDANCE');
    
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
        const { data, error } = await supabase
            .from('org_attendance_settings')
            .select('*')
            .eq('company_id', currentCompanyId)
            .maybeSingle();
            
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

        const { error } = await supabase
            .from('org_attendance_settings')
            .upsert(updates, { onConflict: 'company_id' });

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
                {activeTab === 'ATTENDANCE' && (
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-3xl shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Attendance & Overtime Rules</h3>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Grace Timing (Minutes)</label>
                                <input 
                                    type="number" 
                                    value={graceMinutes}
                                    onChange={(e) => setGraceMinutes(parseInt(e.target.value))}
                                    className="w-full max-w-xs p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 font-medium"
                                />
                                <p className="text-xs text-slate-400 mt-2">Time allowed after start of shift before marking as late.</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Minimum Overtime Rules (Minutes)</label>
                                <input 
                                    type="number" 
                                    value={overtimeMin}
                                    onChange={(e) => setOvertimeMin(parseInt(e.target.value))}
                                    className="w-full max-w-xs p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 font-medium"
                                />
                                <p className="text-xs text-slate-400 mt-2">Minimum duration an employee must stay past shift end to trigger OT.</p>
                            </div>

                            <div className="flex items-center gap-4 py-4 border-t border-slate-100 dark:border-zinc-800 mt-4">
                                <input 
                                    type="checkbox" 
                                    checked={mobileCheckin}
                                    onChange={(e) => setMobileCheckin(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                />
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Enable Mobile Attendance</h4>
                                    <p className="text-xs text-slate-500">Allow employees to check in and out through the ESSP mobile-friendly portal with location tracking.</p>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleSaveSettings}
                                disabled={loading}
                                className="mt-4 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center gap-2 active:scale-95 transition-all w-fit shadow-md shadow-indigo-600/20"
                            >
                                <Save className="w-5 h-5" />
                                {loading ? 'Saving...' : 'Save Rule Settings'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'HOLIDAYS' && (
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-4xl shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Organization Holidays</h3>
                            <button onClick={() => setShowHolidayModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all">
                                <Plus className="w-4 h-4" />
                                Add Holiday
                            </button>
                        </div>
                        {holidays.length === 0 ? (
                            <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <h4 className="font-bold text-slate-600 dark:text-slate-400">No Holidays Configured</h4>
                                <p className="text-sm text-slate-400 mt-2">Add fixed and recurring holidays for automatic leave omission.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2">
                                {holidays.map(h => (
                                    <div key={h.id} className="p-5 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-zinc-800">
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200">{h.name}</h4>
                                            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{new Date(h.date).toDateString()}</p>
                                            {h.description && <p className="text-xs text-slate-500 mt-1">{h.description}</p>}
                                        </div>
                                        <button onClick={() => handleDeleteHoliday(h.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'BIOMETRIC' && (
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-4xl shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Device Integration Hub</h3>
                        <div className="flex items-center justify-between mb-8">
                            <p className="text-sm text-slate-500">Connect external biometric hardware (like ZKTeco) using Edge Function webhooks.</p>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Enable Sync</span>
                                <input 
                                    type="checkbox" 
                                    checked={enableBiometric}
                                    onChange={(e) => setEnableBiometric(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                />
                            </div>
                        </div>
                        
                        <div className={`p-6 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-start gap-4 transition-opacity ${!enableBiometric ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="flex items-center gap-3 w-full border-b border-slate-200 dark:border-zinc-700 pb-4">
                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center">
                                    <SwitchCamera className={`w-6 h-6 ${enableBiometric ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Device Webhook Endpoint (POST)</h4>
                                    <p className="text-xs text-slate-500 font-mono mt-1">https://euoaoyzpurbvcoxydunl.supabase.co/functions/v1/device-sync</p>
                                </div>
                                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${enableBiometric ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                    {enableBiometric ? 'Active' : 'Disabled'}
                                </span>
                            </div>
                            <div className="w-full">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">API Bearer Key for Device Request</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={biometricApiKey || 'Not Generated'}
                                        readOnly
                                        className="w-full p-4 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 font-mono text-sm text-slate-600 dark:text-slate-400"
                                    />
                                    <button onClick={generateNewApiKey} className="px-6 py-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all whitespace-nowrap flex items-center gap-2">
                                        <Key className="w-4 h-4" /> Regenerate
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400 mt-2">Use this key in the `x-api-key` header of your biometric device's HTTP requests.</p>
                            </div>
                        </div>

                        <button 
                            onClick={handleSaveSettings}
                            disabled={loading}
                            className="mt-8 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center gap-2 active:scale-95 transition-all w-fit shadow-md shadow-indigo-600/20"
                        >
                            <Save className="w-5 h-5" />
                            {loading ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                )}
            </div>

            {/* Holiday Modal */}
            {showHolidayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Add Holiday</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Holiday Name</label>
                                <input 
                                    type="text" 
                                    value={newHoliday.name}
                                    onChange={e => setNewHoliday({...newHoliday, name: e.target.value})}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700"
                                    placeholder="e.g., Christmas"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                                <input 
                                    type="date" 
                                    value={newHoliday.date}
                                    onChange={e => setNewHoliday({...newHoliday, date: e.target.value})}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Description (Optional)</label>
                                <input 
                                    type="text" 
                                    value={newHoliday.description}
                                    onChange={e => setNewHoliday({...newHoliday, description: e.target.value})}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                <button onClick={() => setShowHolidayModal(false)} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleAddHoliday} disabled={loading} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
                                    {loading ? 'Saving...' : 'Add Holiday'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
