import React, { useState, useEffect } from 'react';
import { Settings, Clock, Calendar, Fingerprint, Plus, SwitchCamera, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

export const SettingsModule: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'HOLIDAYS' | 'BIOMETRIC'>('ATTENDANCE');
    
    // State logic for settings forms
    const [graceMinutes, setGraceMinutes] = useState(15);
    const [overtimeMin, setOvertimeMin] = useState(60);
    const [mobileCheckin, setMobileCheckin] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch org settings if any (we can use an RPC or direct API later)
    }, [currentCompanyId]);

    const handleSaveAttendance = async () => {
        setLoading(true);
        // Call to supabase to save org_attendance_settings
        alert("Attendance Settings saved successfully! (Phase 1 Stub)");
        setLoading(false);
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
                                onClick={handleSaveAttendance}
                                disabled={loading}
                                className="mt-4 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center gap-2 active:scale-95 transition-all w-fit"
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
                            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all">
                                <Plus className="w-4 h-4" />
                                Add Holiday
                            </button>
                        </div>
                        <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h4 className="font-bold text-slate-600 dark:text-slate-400">No Holidays Configured</h4>
                            <p className="text-sm text-slate-400 mt-2">Add fixed and recurring holidays for automatic leave omission.</p>
                        </div>
                    </div>
                )}
                
                {activeTab === 'BIOMETRIC' && (
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-4xl shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Device Integration Hub</h3>
                        <p className="text-sm text-slate-500 mb-8">Connect external biometric hardware (like ZKTeco) using Edge Function webhooks.</p>
                        
                        <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-start gap-4">
                            <div className="flex items-center gap-3 w-full border-b border-slate-200 dark:border-zinc-700 pb-4">
                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center">
                                    <SwitchCamera className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Device Webhook Endpoint (POST)</h4>
                                    <p className="text-xs text-slate-500 font-mono mt-1">https://hcpywrxdabaqyyijoxtf.supabase.co/functions/v1/device-sync</p>
                                </div>
                                <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-xs font-bold uppercase">Not Connected</span>
                            </div>
                            <div className="w-full">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">API Bearer Key for Device Request</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="password" 
                                        defaultValue="XXXXXXXXXXXXXXXXXXXXXXXXX"
                                        readOnly
                                        className="w-full p-4 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 font-mono text-sm text-slate-500"
                                    />
                                    <button className="px-6 py-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all">Generate New</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
