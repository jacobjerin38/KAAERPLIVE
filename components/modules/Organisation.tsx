import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2, MapPin, LayoutGrid, Users, Settings, Plus, Check, Edit3, X, Shield, User, Database, GitMerge, PlayCircle, StopCircle, ArrowRight, Bell, Clock, Save, Search, Trash2, Sparkles, Radio, BarChart2, Loader2, KeyRound,
    Banknote, Package, Factory, ShoppingCart
}
    from 'lucide-react';
import { PollsView } from './organization/PollsView';
import { StructureView } from './organization/StructureView';
import { SurveysView } from './organization/SurveysView';
import { KudosCategoriesView } from './organization/KudosCategoriesView';
import { FiscalYears } from './organisation/accounting/FiscalYears';
import { TaxMasters } from './organisation/accounting/TaxMasters';
import { JournalMasters } from './organisation/accounting/JournalMasters';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Department, Location, Role, Employee as AppUser } from '../hrms/types';
import { OrgAISettings } from '../../types';
import { KAA_LOGO_URL } from '../../constants';

// Types for new features
interface ReminderConfig {
    id: string;
    name: string;
    type: string;
    target_filter: { department_ids?: string[], location_ids?: string[] };
    schedule_config: { remind_before_days: number[], frequency: string, remind_on_same_day: boolean };
    recipients_config: { notify_employee: boolean, notify_manager: boolean, notify_hod?: boolean, custom_emails?: string[] };
    is_active: boolean;
}

interface WorkflowLevel {
    id: string;
    workflow_id: string;
    level_order: number;
    level_name: string;
    approver_type: 'USER' | 'ROLE' | 'POSITION' | 'GROUP';
    approver_ids: string[];
    approver_logic: 'ANY' | 'ALL';
}

interface WorkflowConfig {
    id: string;
    name: string;
    description: string;
    module: string;
    trigger_type: string;
    is_active: boolean;
    level_order_type: 'SEQUENTIAL' | 'PARALLEL';
    criteria: any;
}

interface Company {
    id: string;
    code: string;
    display_name: string;
    legal_name: string;
    email: string;
    phone: string;
    address_line_1: string;
    city: string;
    state: string;
    country: string;
    zip_code: string;
    tax_id: string;
    currency: string;
    logo_url: string;
}

// --- Company Profile View ---
const CompanyProfileView = () => {
    const [company, setCompany] = useState<Partial<Company>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const { user, currentCompanyId } = useAuth();

    useEffect(() => {
        if (currentCompanyId) {
            fetchCompany();
        }
    }, [currentCompanyId]);

    const fetchCompany = async () => {
        setLoading(true);
        if (currentCompanyId) {
            const { data } = await supabase.from('companies').select('*').eq('id', currentCompanyId).maybeSingle();
            if (data) setCompany(data);
            else {
                // Initialize with empty defaults — user must configure company settings
                setCompany({ id: currentCompanyId, currency: '', country: '' });
            }
        }
        setLoading(false);
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCompany({ ...company, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        setSaving(true);
        if (company.id) {
            // Upsert based on ID
            const { error } = await (supabase as any).from('companies').upsert([company], { onConflict: 'id' });
            if (!error) {
                // Success notification could go here
            }
        }
        setSaving(false);
    };

    const [uploading, setUploading] = useState(false);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !company.id) return;
        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${company.id}/logo-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('company-assets')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('company-assets')
                .getPublicUrl(fileName);

            setCompany({ ...company, logo_url: publicUrl });

            // Auto-save the new logo URL to the database
            await supabase.from('companies').update({ logo_url: publicUrl }).eq('id', company.id);

        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Error uploading logo. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="p-8 text-slate-500">Loading company profile...</div>;

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Company Profile</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Manage company details and branding.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl">
                {/* Left Column: Form */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
                            <Building2 className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Company Details</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Code</label>
                                <input name="code" value={company.code || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="KAA01" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Display Name</label>
                                <input name="display_name" value={company.display_name || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="KAA HRMS Inc." />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Legal Name</label>
                                <input name="legal_name" value={company.legal_name || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="KAA HR Management Systems Ltd." />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Email</label>
                                <input name="email" value={company.email || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Phone</label>
                                <input name="phone" value={company.phone || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 space-y-6">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Address Line 1</label>
                                <input name="address_line_1" value={company.address_line_1 || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">City</label>
                                    <input name="city" value={company.city || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">State</label>
                                    <input name="state" value={company.state || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Country</label>
                                    <input name="country" value={company.country || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Zip/Postal</label>
                                    <input name="zip_code" value={company.zip_code || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tax ID / PAN</label>
                                <input name="tax_id" value={company.tax_id || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Currency</label>
                                <input name="currency" value={company.currency || ''} onChange={handleChange} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button onClick={handleSave} disabled={saving} className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center gap-2">
                                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Logo & Docs */}
                <div className="space-y-8">
                    {/* Logo Section */}
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 flex flex-col items-center justify-center text-center">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-6">Company Logo</h3>
                        <div className="w-32 h-32 rounded-full bg-slate-50 dark:bg-zinc-800 border-4 border-dashed border-slate-200 dark:border-zinc-700 flex items-center justify-center mb-6 overflow-hidden relative group">
                            {company.logo_url ? (
                                <img src={company.logo_url} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                            )}
                            <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit3 className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <button className="text-blue-600 font-bold text-sm hover:underline relative" disabled={uploading}>
                            {uploading ? 'Uploading...' : 'Change Logo'}
                            {!uploading && <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />}
                        </button>
                    </div>

                    {/* Branding / Documents (Placeholder) */}
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white">Documents</h3>
                            <button className="p-2 text-slate-400 hover:text-blue-600"><Plus className="w-4 h-4" /></button>
                        </div>
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/50">
                            <span className="text-sm">No documents uploaded</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Payroll Settings View ---
const PayrollSettingsView = () => {
    const [settings, setSettings] = useState<any>({
        calculation_basis: 'CALENDAR_DAYS',
        rounding_method: 'NEAREST_INTEGER',
        pf_employer_contribution: 12.00,
        esi_employer_contribution: 3.25,
        is_active: true
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const { currentCompanyId } = useAuth();

    useEffect(() => {
        if (currentCompanyId) {
            fetchSettings();
        }
    }, [currentCompanyId]);

    const fetchSettings = async () => {
        setLoading(true);
        if (currentCompanyId) {
            const { data } = await (supabase as any).from('org_payroll_settings').select('*').eq('company_id', currentCompanyId).maybeSingle();
            if (data) setSettings(data);
            else setSettings((prev: any) => ({ ...prev, company_id: currentCompanyId }));
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const payload = { ...settings, company_id: currentCompanyId };
        const { error } = await (supabase as any).from('org_payroll_settings').upsert([payload], { onConflict: 'company_id' });
        if (error) alert('Error saving settings: ' + error.message);
        else alert('Settings saved successfully!');
        setSaving(false);
    };

    if (loading) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Payroll Settings</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Configure global payroll rules.</p>
                </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 max-w-3xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Calculation Basis</label>
                        <select
                            value={settings.calculation_basis}
                            onChange={e => setSettings({ ...settings, calculation_basis: e.target.value })}
                            className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800"
                        >
                            <option value="CALENDAR_DAYS">Calendar Days (Actual days in month)</option>
                            <option value="FIXED_30_DAYS">Fixed 30 Days</option>
                        </select>
                        <p className="text-xs text-slate-500">Determines per-day salary calculation.</p>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Rounding Method</label>
                        <select
                            value={settings.rounding_method}
                            onChange={e => setSettings({ ...settings, rounding_method: e.target.value })}
                            className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800"
                        >
                            <option value="NEAREST_INTEGER">Nearest Integer</option>
                            <option value="ROUND_UP">Round Up</option>
                            <option value="ROUND_DOWN">Round Down</option>
                            <option value="NO_ROUNDING">No Rounding (Decimals)</option>
                        </select>
                        <p className="text-xs text-slate-500">Applied to Net Pay and component calculations.</p>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">PF Employer Contribution (%)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={settings.pf_employer_contribution}
                            onChange={e => setSettings({ ...settings, pf_employer_contribution: Number(e.target.value) })}
                            className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800"
                        />
                    </div>

                    <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">ESI Employer Contribution (%)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={settings.esi_employer_contribution}
                            onChange={e => setSettings({ ...settings, esi_employer_contribution: Number(e.target.value) })}
                            className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800"
                        />
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button onClick={handleSave} disabled={saving} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center gap-2">
                        <Save className="w-5 h-5" /> Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- AI Settings View ---
const AISettingsView = () => {
    const [settings, setSettings] = useState<Partial<OrgAISettings>>({
        provider: 'GEMINI',
        model: 'gemini-2.5-flash',
        status: 'ACTIVE'
    });
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const { currentCompanyId } = useAuth();

    useEffect(() => {
        if (currentCompanyId) {
            fetchSettings();
        }
    }, [currentCompanyId]);

    const fetchSettings = async () => {
        setLoading(true);
        if (currentCompanyId) {
            const { data } = await supabase.from('org_ai_settings').select('*').eq('company_id', currentCompanyId).maybeSingle();
            if (data) {
                setSettings(data as any);
                // Don't set API key input for security, just show placeholder if exists
            } else {
                setSettings(prev => ({ ...prev, company_id: currentCompanyId }));
            }
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const payload = { ...settings };
        if (apiKeyInput) {
            payload.api_key_encrypted = apiKeyInput; // In real production, encrypt this before sending or rely on secure backend connection
        }

        const { error } = await (supabase as any).from('org_ai_settings').upsert([payload], { onConflict: 'company_id,provider' });

        if (error) alert('Error saving AI settings: ' + error.message);
        else {
            alert('AI Settings saved successfully!');
            setApiKeyInput(''); // Clear sensitive input
            fetchSettings();
        }
        setSaving(false);
    };

    if (loading) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Sparkles className="w-8 h-8 text-indigo-500" /> AI Settings
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Configure Generative AI providers for KAA Modules.</p>
                </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 max-w-3xl">
                <div className="space-y-6">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 flex items-start gap-4">
                        <div className="p-2 bg-white dark:bg-indigo-800 rounded-lg shadow-sm">
                            <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-white">Gemini Integration Active</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">This provider powers the Website Finder, Lead Analysis, and other smart features.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Provider</label>
                            <input value="Google Gemini" disabled className="w-full p-4 bg-slate-100 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-500 font-bold" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Model Version</label>
                            <select
                                value={settings.model}
                                onChange={e => setSettings({ ...settings, model: e.target.value })}
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-bold text-slate-700 dark:text-white"
                            >
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                                <option value="gemini-pro">Gemini Pro</option>
                            </select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">API Key</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={apiKeyInput}
                                    placeholder={settings.api_key_encrypted ? "•••••••••••••••• (Key Set)" : "Enter Gemini API Key"}
                                    onChange={e => setApiKeyInput(e.target.value)}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-mono text-slate-700 dark:text-white"
                                />
                                {settings.api_key_encrypted && !apiKeyInput && (
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Configured</span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">Key is stored encrypted. Leave blank to keep existing key.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Status</label>
                            <select
                                value={settings.status}
                                onChange={e => setSettings({ ...settings, status: e.target.value as any })}
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 font-bold text-slate-700 dark:text-white"
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="DISABLED">Disabled</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                        <button onClick={handleSave} disabled={saving} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-500/20">
                            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
                            Save AI Configuration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Master Data Configuration ---


type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'boolean' | 'time' | 'date';

interface MasterField {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    options?: { label: string; value: string }[];
    placeholder?: string;
}

interface MasterTableConfig {
    tableName: string;
    displayName: string;
    description: string;
    fields: MasterField[];
    columns: { key: string; label: string }[];
}

export const MASTER_CONFIG: Record<string, MasterTableConfig> = {
    'DEPARTMENTS': {
        tableName: 'departments',
        displayName: 'Department',
        description: 'Manage organizational departments',
        fields: [
            { key: 'name', label: 'Department Name', type: 'text', required: true },
            { key: 'code', label: 'Department Code', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]
    },
    'LOCATIONS': {
        tableName: 'locations',
        displayName: 'Location',
        description: 'Manage office locations',
        fields: [
            { key: 'name', label: 'Location Name', type: 'text', required: true },
            { key: 'address', label: 'Address', type: 'textarea', required: true }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'address', label: 'Address' }]
    },
    'DESIGNATIONS': {
        tableName: 'org_designations',
        displayName: 'Designation',
        description: 'Employee job titles and positions',
        fields: [
            { key: 'name', label: 'Designation Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]
    },
    'GRADES': {
        tableName: 'org_grades',
        displayName: 'Grade',
        description: 'Employee grade levels and bands',
        fields: [
            { key: 'name', label: 'Grade Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]
    },
    'CRM_STAGES': {
        tableName: 'org_crm_stages',
        displayName: 'Pipeline Stage',
        description: 'Sales pipeline stages (e.g., Prospecting, Qualification, Proposal)',
        fields: [
            { key: 'name', label: 'Stage Name', type: 'text', required: true },
            { key: 'position', label: 'Position Order', type: 'number', required: true },
            { key: 'win_probability', label: 'Win Probability (%)', type: 'number', required: true },
            { key: 'status', label: 'Status', type: 'select', required: true, options: [{label: 'Active', value: 'Active'}, {label: 'Inactive', value: 'Inactive'}] }
        ],
        columns: [
            { key: 'position', label: 'Order' },
            { key: 'name', label: 'Stage Name' },
            { key: 'win_probability', label: 'Win %' },
            { key: 'status', label: 'Status' }
        ]
    },
    'EMPLOYMENT_TYPES': {
        tableName: 'org_employment_types',
        displayName: 'Employment Type',
        description: 'Full-time, Part-time, Contract, etc.',
        fields: [
            { key: 'name', label: 'Type Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]
    },
    'SALARY_COMPONENTS': {
        tableName: 'org_salary_components',
        displayName: 'Salary Component',
        description: 'Earnings and Deductions components',
        fields: [
            { key: 'name', label: 'Component Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true },
            {
                key: 'component_type', label: 'Type', type: 'select', required: true,
                options: [{ label: 'Earning', value: 'EARNING' }, { label: 'Deduction', value: 'DEDUCTION' }]
            },
            { key: 'is_taxable', label: 'Is Taxable?', type: 'boolean' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'component_type', label: 'Type' }]
    },
    'PAY_GROUPS': {
        tableName: 'org_pay_groups',
        displayName: 'Pay Group',
        description: 'Payroll grouping and frequency',
        fields: [
            { key: 'name', label: 'Group Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true },
            {
                key: 'pay_frequency', label: 'Frequency', type: 'select', required: true,
                options: [
                    { label: 'Monthly', value: 'MONTHLY' },
                    { label: 'Weekly', value: 'WEEKLY' },
                    { label: 'Bi-Weekly', value: 'BI_WEEKLY' }
                ]
            },
            { key: 'salary_day', label: 'Salary Day (1-31)', type: 'number' },
            { key: 'attendance_required', label: 'Attendance Required?', type: 'boolean' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'pay_frequency', label: 'Frequency' }]
    },
    'FINANCIAL_YEARS': {
        tableName: 'org_financial_years',
        displayName: 'Financial Year',
        description: 'Define accounting years (e.g., FY2025-26)',
        fields: [
            { key: 'code', label: 'Code (e.g., FY2025-26)', type: 'text', required: true },
            { key: 'start_date', label: 'Start Date', type: 'date', required: true },
            { key: 'end_date', label: 'End Date', type: 'date', required: true },
            { key: 'is_active', label: 'Active', type: 'boolean' }
        ],
        columns: [
            { key: 'code', label: 'Code' },
            { key: 'start_date', label: 'Start' },
            { key: 'end_date', label: 'End' },
            { key: 'is_active', label: 'Active' }
        ]
    },
    'PAYROLL_MONTHS': {
        tableName: 'org_payroll_months',
        displayName: 'Payroll Month',
        description: 'Manage payroll periods and status',
        fields: [
            { key: 'financial_year_id', label: 'Financial Year', type: 'select', required: true, options: [] }, // Options populated dynamically
            { key: 'month_year', label: 'Month (First Date)', type: 'date', required: true },
            { key: 'status', label: 'Status', type: 'select', required: true, options: [{ label: 'Open', value: 'OPEN' }, { label: 'Processed', value: 'PROCESSED' }, { label: 'Locked', value: 'LOCKED' }] }
        ],
        columns: [
            { key: 'month_year', label: 'Month' },
            { key: 'status', label: 'Status' },
            { key: 'financial_year_id', label: 'FY' }
        ]
    },
    'LEAVE_CALENDAR': {
        tableName: 'org_leave_calendar_years',
        displayName: 'Leave Calendar',
        description: 'Yearly leave cycles (e.g., 2026)',
        fields: [
            { key: 'year', label: 'Year (e.g., 2026)', type: 'number', required: true },
            { key: 'start_date', label: 'Start Date', type: 'date', required: true },
            { key: 'end_date', label: 'End Date', type: 'date', required: true },
            { key: 'is_active', label: 'Active', type: 'boolean' }
        ],
        columns: [
            { key: 'year', label: 'Year' },
            { key: 'start_date', label: 'Start' },
            { key: 'end_date', label: 'End' },
            { key: 'is_active', label: 'Active' }
        ]
    },
    'SHIFT_TIMINGS': {
        tableName: 'org_shift_timings',
        displayName: 'Shift Timing',
        description: 'Work shift schedules',
        fields: [
            { key: 'name', label: 'Shift Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true },
            { key: 'start_time', label: 'Start Time', type: 'time', required: true },
            { key: 'end_time', label: 'End Time', type: 'time', required: true },
            { key: 'grace_period_minutes', label: 'Grace Period (mins)', type: 'number' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'start_time', label: 'Start' }, { key: 'end_time', label: 'End' }]
    },
    'LEAVE_TYPES': {
        tableName: 'org_leave_types',
        displayName: 'Leave Type',
        description: 'Leave categories and rules',
        fields: [
            { key: 'name', label: 'Leave Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true },
            { key: 'default_balance', label: 'Default Balance', type: 'number', required: true },
            { key: 'is_paid', label: 'Is Paid Leave?', type: 'boolean' },
            { key: 'requires_approval', label: 'Requires Approval?', type: 'boolean' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'default_balance', label: 'Balance' }]
    },
    'BANK_CONFIGS': {
        tableName: 'org_bank_configs',
        displayName: 'Bank Configuration',
        description: 'Bank account configurations',
        fields: [
            { key: 'name', label: 'Config Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true },
            { key: 'bank_name', label: 'Bank Name', type: 'text', required: true }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'bank_name', label: 'Bank' }]
    },
    // Common Attributes
    'FAITHS': {
        tableName: 'org_faiths',
        displayName: 'Faith',
        description: 'Religious affiliations',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]
    },
    'MARITAL_STATUS': {
        tableName: 'org_marital_status',
        displayName: 'Marital Status',
        description: 'Civil status options',
        fields: [
            { key: 'name', label: 'Status Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]
    },
    'BLOOD_GROUPS': {
        tableName: 'org_blood_groups',
        displayName: 'Blood Group',
        description: 'Blood group types',
        fields: [
            { key: 'name', label: 'Group Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]
    },
    'NATIONALITIES': {
        tableName: 'org_nationalities',
        displayName: 'Nationality',
        description: 'Country of origin',
        fields: [
            { key: 'name', label: 'Nationality', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]
    },
    'KUDOS_CATEGORIES': {
        tableName: 'master_kudos_categories',
        displayName: 'Kudos Category',
        description: 'Manage types of recognition (e.g., Team Player, Star Performer)',
        fields: [
            { key: 'name', label: 'Category Name', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'icon', label: 'Icon (Emoji or Lucide Name)', type: 'text', placeholder: 'e.g. Star, Trophy, 🌟' },
            { key: 'points', label: 'Points Value', type: 'number' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'points', label: 'Points' }]
    },
    'ANNOUNCEMENTS': {
        tableName: 'announcements',
        displayName: 'Announcement',
        description: 'Company-wide news and updates',
        fields: [
            { key: 'title', label: 'Title', type: 'text', required: true },
            { key: 'content', label: 'Content', type: 'textarea', required: true },
            { key: 'type', label: 'Type', type: 'select', options: [{ label: 'News', value: 'News' }, { label: 'Event', value: 'Event' }, { label: 'Alert', value: 'Alert' }] },
            { key: 'is_pinned', label: 'Pin to Top?', type: 'boolean' },
            { key: 'is_active', label: 'Active?', type: 'boolean' }
        ],
        columns: [{ key: 'title', label: 'Title' }, { key: 'type', label: 'Type' }, { key: 'is_pinned', label: 'Pinned' }, { key: 'is_active', label: 'Active' }]
    },
    'POLLS': {
        tableName: 'polls', // Note: polls has 'question' not 'name'.
        displayName: 'Polls',
        description: 'Manage employee polls',
        fields: [
            { key: 'question', label: 'Question', type: 'text', required: true },
            { key: 'is_active', label: 'Active', type: 'boolean' }
        ],
        columns: [{ key: 'question', label: 'Question' }, { key: 'is_active', label: 'Active' }]
    },
    'SURVEYS': {
        tableName: 'surveys',
        displayName: 'Surveys',
        description: 'Manage employee surveys',
        fields: [
            { key: 'title', label: 'Title', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'expiration_date', label: 'Expires On', type: 'date' },
            { key: 'is_active', label: 'Active', type: 'boolean' }
        ],
        columns: [{ key: 'title', label: 'Title' }, { key: 'expiration_date', label: 'Expires' }, { key: 'is_active', label: 'Active' }]
    },
    // Inventory Masters
    'INVENTORY_REASONS': {
        tableName: 'inventory_reasons',
        displayName: 'Inventory Reason',
        description: 'Reasons for adjustments, scrap, write-offs',
        fields: [
            { key: 'name', label: 'Reason Name', type: 'text', required: true },
            {
                key: 'type', label: 'Type', type: 'select', required: true, options: [
                    { label: 'Adjustment', value: 'ADJUSTMENT' },
                    { label: 'Scrap', value: 'SCRAP' },
                    { label: 'Write-off', value: 'WRITE_OFF' },
                    { label: 'Damage', value: 'DAMAGE' },
                    { label: 'Expired', value: 'EXPIRED' },
                    { label: 'Other', value: 'OTHER' }
                ]
            },
            { key: 'description', label: 'Description', type: 'textarea' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }]
    },
    'WAREHOUSES': {
        tableName: 'warehouses',
        displayName: 'Warehouse',
        description: 'Storage locations and facilities',
        fields: [
            { key: 'name', label: 'Warehouse Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true },
            { key: 'address', label: 'Address', type: 'textarea' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }, { key: 'address', label: 'Address' }]
    },
    'ITEMS': {
        tableName: 'item_master',
        displayName: 'Item',
        description: 'Products and materials',
        fields: [
            { key: 'name', label: 'Item Name', type: 'text', required: true },
            { key: 'code', label: 'Code', type: 'text', required: true },
            { key: 'category', label: 'Category', type: 'text' },
            { key: 'uom', label: 'Unit of Measure', type: 'text', required: true, placeholder: 'e.g. PCS, KG, LTR' },
            {
                key: 'valuation_method', label: 'Valuation', type: 'select', options: [
                    { label: 'FIFO', value: 'FIFO' },
                    { label: 'Average', value: 'AVG' }
                ]
            },
            { key: 'is_stockable', label: 'Is Stockable?', type: 'boolean' }
        ],
        columns: [{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }, { key: 'uom', label: 'UOM' }, { key: 'category', label: 'Category' }]
    }
};

// --- Generic Components (Extracted to prevent re-render focus loss) ---

const SearchBar = ({ value, onChange, placeholder = "Search..." }: { value: string, onChange: (val: string) => void, placeholder?: string }) => (
    <div className="relative mb-6">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-12 pr-4 py-3 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-md rounded-2xl border border-white/60 dark:border-zinc-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
    </div>
);

const Modal = ({ title, onClose, children, maxWidth = "max-w-lg" }: { title: string, onClose: () => void, children: React.ReactNode, maxWidth?: string }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md animate-fade-in">
        <div className={`bg-white dark:bg-zinc-900 w-full ${maxWidth} rounded-3xl p-8 shadow-2xl relative animate-slide-up border border-slate-100 dark:border-zinc-800 max-h-[90vh] overflow-y-auto`}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
                <button onClick={onClose}><X className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
            </div>
            {children}
        </div>
    </div>
);

const GenericMasterModal = ({ config, item, onClose, onRefresh }: { config: MasterTableConfig, item: any, onClose: () => void, onRefresh: () => void }) => {
    const { currentCompanyId } = useAuth();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        const payload: any = {};
        config.fields.forEach(field => {
            const value = formData.get(field.key);
            if (field.type === 'boolean') {
                payload[field.key] = value === 'on';
            } else if (field.type === 'number') {
                payload[field.key] = value ? Number(value) : null;
            } else {
                payload[field.key] = value;
            }
        });



        if (currentCompanyId) {
            payload.company_id = currentCompanyId;
            setSaving(true);

            if (item) {
                const { error } = await (supabase as any).from(config.tableName).update(payload).eq('id', item.id);
                if (error) {
                    setError(error.message);
                    setSaving(false);
                    return;
                }
            } else {
                const { error } = await (supabase as any).from(config.tableName).insert([payload]);
                if (error) {
                    setError(error.message);
                    setSaving(false);
                    return;
                }
            }

            setSaving(false);
            onClose();
            onRefresh();
        }
    };

    return (
        <Modal title={`${item ? 'Edit' : 'Add'} ${config.displayName}`} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400 text-sm font-medium">
                        {error}
                    </div>
                )}
                {config.fields.map(field => (
                    <div key={field.key}>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {field.label} {field.required && <span className="text-rose-500">*</span>}
                        </label>

                        {field.type === 'textarea' ? (
                            <textarea
                                name={field.key}
                                defaultValue={item?.[field.key]}
                                required={field.required}
                                placeholder={field.placeholder}
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm resize-none h-24"
                            />
                        ) : field.type === 'select' ? (
                            <select
                                name={field.key}
                                defaultValue={item?.[field.key] || ''}
                                required={field.required}
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm"
                            >
                                <option value="">Select {field.label}</option>
                                {field.options?.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        ) : field.type === 'boolean' ? (
                            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700">
                                <input
                                    type="checkbox"
                                    name={field.key}
                                    defaultChecked={item?.[field.key] ?? false}
                                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="font-medium text-slate-700 dark:text-slate-300">Yes, enable this</span>
                            </div>
                        ) : (
                            <input
                                type={field.type}
                                name={field.key}
                                defaultValue={item?.[field.key]}
                                required={field.required}
                                placeholder={field.placeholder}
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm"
                            />
                        )}
                    </div>
                ))}
                <button disabled={saving} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Saving...' : `${item ? 'Update' : 'Create'} ${config.displayName}`}
                </button>
            </form>
        </Modal>
    );
};

const GenericMastersView = ({
    activeTab,
    setActiveTab,
    search,
    setSearch,
    config,
    data,
    onAdd,
    onEdit,
    onDelete
}: any) => {
    // Search Filter
    const filteredData = data.filter((item: any) => {
        const s = search.toLowerCase();
        return (
            (item.name && item.name.toLowerCase().includes(s)) ||
            (item.code && item.code.toLowerCase().includes(s)) ||
            (item.description && item.description.toLowerCase().includes(s)) ||
            (item.title && item.title.toLowerCase().includes(s)) ||
            (item.question && item.question.toLowerCase().includes(s))
        );
    });

    return (
        <div className="h-full flex flex-col p-8">
            {/* Category Tabs */}
            <div className="flex flex-col gap-4 mb-8">
                {/* Core & HRMS */}
                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-800/50 rounded-2xl w-fit overflow-x-auto max-w-full">
                    {[
                        { id: 'DEPARTMENTS', label: 'Departments' },
                        { id: 'LOCATIONS', label: 'Locations' },
                        { id: 'DESIGNATIONS', label: 'Designations' },
                        { id: 'GRADES', label: 'Grades' },
                        { id: 'EMPLOYMENT_TYPES', label: 'Employment Types' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Payroll & Attendance */}
                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-800/50 rounded-2xl w-fit overflow-x-auto max-w-full">
                    {[
                        { id: 'LEAVE_TYPES', label: 'Leave Types' },
                        { id: 'SALARY_COMPONENTS', label: 'Salary Components' },
                        { id: 'SHIFT_TIMINGS', label: 'Shift Timings' },
                        { id: 'PAY_GROUPS', label: 'Pay Groups' },
                        { id: 'FINANCIAL_YEARS', label: 'Financial Years' },
                        { id: 'PAYROLL_MONTHS', label: 'Payroll Months' },
                        { id: 'LEAVE_CALENDAR', label: 'Leave Calendar' },
                        { id: 'BANK_CONFIGS', label: 'Bank Configs' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Common & ESSP */}
                <div className="flex flex-wrap gap-4">
                    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-800/50 rounded-2xl w-fit overflow-x-auto">
                        {[
                            { id: 'FAITHS', label: 'Faiths' },
                            { id: 'MARITAL_STATUS', label: 'Marital Status' },
                            { id: 'BLOOD_GROUPS', label: 'Blood Groups' },
                            { id: 'NATIONALITIES', label: 'Nationalities' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-1 p-1 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl w-fit overflow-x-auto border border-indigo-100 dark:border-indigo-800/30">
                        <span className="px-3 py-2.5 text-xs font-extrabold text-indigo-400 uppercase tracking-widest self-center">ESSP Masters:</span>
                        {[
                            { id: 'ANNOUNCEMENTS', label: 'Buzz/Announcements' },
                            { id: 'POLLS', label: 'Polls' },
                            { id: 'SURVEYS', label: 'Surveys' },
                            { id: 'KUDOS_CATEGORIES', label: 'Kudos Categories' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-indigo-600/70 hover:text-indigo-800 dark:text-indigo-400/70'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-1 p-1 bg-blue-50 dark:bg-blue-900/10 rounded-2xl w-fit overflow-x-auto border border-blue-100 dark:border-blue-800/30">
                        <span className="px-3 py-2.5 text-xs font-extrabold text-blue-400 uppercase tracking-widest self-center">CRM Masters:</span>
                        {[
                            { id: 'CRM_STAGES', label: 'Pipeline Stages' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-blue-600/70 hover:text-blue-800 dark:text-blue-400/70'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {activeTab === 'SURVEYS' ? (
                <div className="-mx-8 -my-8" style={{ height: 'calc(100% + 4rem)' }}>
                    <SurveysView />
                </div>
            ) : activeTab === 'KUDOS_CATEGORIES' ? (
                <div className="-mx-8 -my-8" style={{ height: 'calc(100% + 4rem)' }}>
                    <KudosCategoriesView />
                </div>
            ) : (
                <>
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{config?.displayName}</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">{config?.description}</p>
                        </div>
                        <button
                            onClick={onAdd}
                            className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                        >
                            <Plus className="w-4 h-4" /> Add {config?.displayName}
                        </button>
                    </div>

                    <SearchBar value={search} onChange={setSearch} placeholder={`Search ${config?.displayName?.toLowerCase() || ''}...`} />

                    {/* Generic Table */}
                    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex-1">
                        <div className="overflow-y-auto h-full">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/80 dark:bg-zinc-800/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/60 dark:border-zinc-700">
                                    <tr>
                                        {config?.columns?.map((col: any) => (
                                            <th key={col.key} className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{col.label}</th>
                                        ))}
                                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Status</th>
                                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50">
                                    {filteredData.map((item: any, i: number) => (
                                        <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                            {config?.columns?.map((col: any) => (
                                                <td key={col.key} className="px-8 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                                                    {typeof item[col.key] === 'boolean'
                                                        ? (item[col.key] ? 'Yes' : 'No')
                                                        : item[col.key]}
                                                </td>
                                            ))}
                                            <td className="px-8 py-4 text-center">
                                                {item.status ? (
                                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${item.status === 'Active' || item.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        'bg-slate-50 text-slate-500 border-slate-200'
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                ) : item.is_active !== undefined ? (
                                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${item.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        'bg-slate-50 text-slate-500 border-slate-200'
                                                        }`}>
                                                        {item.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                ) : (
                                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800">
                                                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => onEdit(item)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => onDelete(item)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredData.length === 0 && (
                                        <tr><td colSpan={(config?.columns?.length || 0) + 2} className="text-center py-12 text-slate-400">No records found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const GenericRolesView = ({ filteredRoles, users, setShowAddRole, setEditingRole, onDeleteRole, localSearch, setLocalSearch }: any) => (
    <div className="p-8 h-full flex flex-col animate-page-enter">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Roles & Permissions</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Define access levels for users.</p>
            </div>
            <button onClick={() => { setEditingRole(null); setShowAddRole(true); }} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                <Plus className="w-4 h-4" /> Add Role
            </button>
        </div>
        <SearchBar value={localSearch} onChange={setLocalSearch} placeholder="Search roles..." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pb-4">
            {filteredRoles.map((role: any) => (
                <div key={role.id} className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-lg group relative">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                            onClick={() => { setEditingRole(role); setShowAddRole(true); }}
                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Edit Role"
                        >
                            <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onDeleteRole(role)}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete Role"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Shield className="w-5 h-5" /></div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">{role.name}</h3>
                                <p className="text-xs text-slate-500">{role.description}</p>
                            </div>
                        </div>
                        <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-bold">{users.filter((u: any) => u.roleId === role.id).length} Users</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(role.permissions || []).slice(0, 5).map((p: any) => (
                            <span key={p} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600">{p}</span>
                        ))}
                        {(role.permissions?.length || 0) > 5 && (
                            <span className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600">+{role.permissions.length - 5} more</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const GenericUsersView = ({ filteredUsers, roles, setShowAddUser, localSearch, setLocalSearch, onEditUser, onResetPassword, onDeleteUser }: any) => (
    <div className="p-8 h-full flex flex-col animate-page-enter">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">System Users</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Manage user accounts and role assignments.</p>
            </div>
            <button onClick={() => setShowAddUser(true)} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                <Plus className="w-4 h-4" /> Add User
            </button>
        </div>

        <SearchBar value={localSearch} onChange={setLocalSearch} placeholder="Search users by name or email..." />
        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex-1">
            <table className="w-full text-left">
                <thead className="bg-slate-50/80 dark:bg-zinc-800/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/60 dark:border-zinc-700">
                    <tr>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">User</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Role</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Linked Employee</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50 overflow-y-auto">
                    {filteredUsers.map((user: any) => {
                        const role = roles.find((r: any) => r.id === user.roleId);
                        return (
                            <tr key={user.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                <td className="px-8 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white text-sm">{user.name}</p>
                                            <p className="text-xs text-slate-500">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-4">
                                    <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-100">{role?.name || 'Unknown'}</span>
                                </td>
                                <td className="px-8 py-4">
                                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100">{user.status}</span>
                                </td>
                                <td className="px-8 py-4 text-right font-mono text-xs text-slate-400">
                                    {user.employeeId || '-'}
                                </td>
                                <td className="px-8 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => onResetPassword(user)}
                                            title="Reset password to 654321"
                                            className="p-2 text-slate-400 hover:text-amber-600 transition-colors"
                                        >
                                            <KeyRound className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => onEditUser(user)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        {onDeleteUser && (
                                            <button
                                                onClick={() => onDeleteUser(user)}
                                                title="Delete user"
                                                className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
);

const GenericWorkflowsView = ({
    showWorkflowList,
    setShowWorkflowList,
    editingWorkflow,
    setEditingWorkflow,
    workflowLevels,
    setWorkflowLevels,
    workflows,
    roles,
    users,
    handleSaveWorkflow,
    fetchWorkflowLevels,
    onDeleteWorkflow
}: any) => {
    if (!showWorkflowList && editingWorkflow) {
        return (
            <div className="p-8 h-full flex flex-col animate-page-enter">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Approval Workflow Configuration</h2>
                    <button onClick={() => { setShowWorkflowList(true); setEditingWorkflow(null); }} className="text-slate-500 hover:text-slate-700 font-bold text-sm">Cancel</button>
                </div>

                <div className="bg-white/70 dark:bg-zinc-900/70 p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl overflow-y-auto">
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Workflow Name *</label>
                            <input value={editingWorkflow.name} onChange={e => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Module</label>
                            <select value={editingWorkflow.module} onChange={e => setEditingWorkflow({ ...editingWorkflow, module: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white mb-6">
                                <option value="HRMS">HRMS</option>
                                <option value="CRM">CRM</option>
                                <option value="FINANCE">Finance</option>
                            </select>

                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Workflow Type</label>
                            <select value={editingWorkflow.trigger_type} onChange={e => setEditingWorkflow({ ...editingWorkflow, trigger_type: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                                <option value="LEAVE_REQUEST">Leave Request</option>
                                <option value="RESIGNATION">Resignation</option>
                                <option value="EXPENSE_CLAIM">Expense Claim</option>
                                <option value="DEAL_APPROVAL">Deal Approval</option>
                                <option value="DOCUMENT_APPROVAL">Document Approval</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Level Order Type</label>
                            <select value={editingWorkflow.level_order_type} onChange={e => setEditingWorkflow({ ...editingWorkflow, level_order_type: e.target.value as any })} className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                                <option value="SEQUENTIAL">Sequential</option>
                                <option value="PARALLEL">Parallel</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active</label>
                            <button onClick={() => setEditingWorkflow({ ...editingWorkflow, is_active: !editingWorkflow.is_active })} className={`px-4 py-2 rounded-xl font-bold transition-all ${editingWorkflow.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {editingWorkflow.is_active ? 'Yes, Active' : 'Inactive'}
                            </button>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                            <input value={editingWorkflow.description} onChange={e => setEditingWorkflow({ ...editingWorkflow, description: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-zinc-700 pt-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Approval Levels</h3>
                            <button onClick={() => {
                                setWorkflowLevels([...workflowLevels, {
                                    id: Math.random().toString(), // Temp ID
                                    workflow_id: editingWorkflow.id,
                                    level_order: workflowLevels.length + 1,
                                    level_name: `Level ${workflowLevels.length + 1}`,
                                    approver_type: 'ROLE',
                                    approver_ids: [],
                                    approver_logic: 'ANY'
                                }]);
                            }} className="text-blue-600 font-bold text-sm flex items-center gap-1 hover:underline">
                                <Plus className="w-4 h-4" /> Add Level
                            </button>
                        </div>

                        <div className="space-y-4">
                            {workflowLevels.map((level: any, idx: number) => (
                                <div key={idx} className="bg-slate-50 dark:bg-zinc-800/50 p-6 rounded-2xl border border-slate-200 dark:border-zinc-700 relative group">
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setWorkflowLevels(workflowLevels.filter((_: any, i: number) => i !== idx))} className="text-rose-500 hover:text-rose-700"><X className="w-5 h-5" /></button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Level Name</label>
                                            <input value={level.level_name} onChange={e => {
                                                const newLevels = [...workflowLevels];
                                                newLevels[idx].level_name = e.target.value;
                                                setWorkflowLevels(newLevels);
                                            }} className="w-full p-2 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-600 text-sm font-bold" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Approver Type</label>
                                            <select value={level.approver_type} onChange={e => {
                                                const newLevels = [...workflowLevels];
                                                newLevels[idx].approver_type = e.target.value as any;
                                                setWorkflowLevels(newLevels);
                                            }} className="w-full p-2 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-600 text-sm font-bold">
                                                <option value="ROLE">Role</option>
                                                <option value="USER">Specific User</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Approvers</label>
                                            <div className="flex flex-wrap gap-2">
                                                {level.approver_type === 'ROLE' ? roles.map((r: any) => (
                                                    <button key={r.id}
                                                        onClick={() => {
                                                            const current = level.approver_ids;
                                                            const newIds = current.includes(r.id) ? current.filter((id: any) => id !== r.id) : [...current, r.id];
                                                            const newLevels = [...workflowLevels];
                                                            newLevels[idx].approver_ids = newIds;
                                                            setWorkflowLevels(newLevels);
                                                        }}
                                                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${level.approver_ids.includes(r.id) ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                                                        {r.name}
                                                    </button>
                                                )) : users.map((u: any) => (
                                                    <button key={u.id}
                                                        onClick={() => {
                                                            const current = level.approver_ids;
                                                            const newIds = current.includes(u.id) ? current.filter((id: any) => id !== u.id) : [...current, u.id];
                                                            const newLevels = [...workflowLevels];
                                                            newLevels[idx].approver_ids = newIds;
                                                            setWorkflowLevels(newLevels);
                                                        }}
                                                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${level.approver_ids.includes(u.id) ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                                                        {u.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button onClick={() => handleSaveWorkflow(editingWorkflow)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
                            <Save className="w-5 h-5" /> Update Workflow
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Workflow Engine</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Design and manage approval processes.</p>
                </div>
                <button onClick={() => {
                    setEditingWorkflow({
                        id: '',
                        name: '',
                        description: '',
                        module: 'CRM',
                        trigger_type: 'DEAL_APPROVAL',
                        is_active: true,
                        level_order_type: 'SEQUENTIAL',
                        criteria: {}
                    });
                    setWorkflowLevels([]);
                    setShowWorkflowList(false);
                }} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                    <Plus className="w-4 h-4" /> Create Workflow
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {workflows.map((wf: any) => (
                    <div key={wf.id} className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-lg group hover:border-blue-300 transition-all cursor-pointer relative"
                        onClick={() => {
                            setEditingWorkflow(wf);
                            fetchWorkflowLevels(wf.id);
                            setShowWorkflowList(false);
                        }}>
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl">
                                    <GitMerge className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{wf.name}</h3>
                                    <div className="flex gap-2 text-xs font-bold mt-1">
                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded">{wf.module}</span>
                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded">{wf.trigger_type}</span>
                                    </div>
                                </div>
                            </div>
                            <div className={`p-2 rounded-xl transition-colors ${wf.is_active ? 'text-emerald-500 bg-emerald-50' : 'text-slate-300 bg-slate-50'}`}>
                                {wf.is_active ? <PlayCircle className="w-6 h-6" /> : <StopCircle className="w-6 h-6" />}
                            </div>
                        </div>

                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2">{wf.description}</p>

                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                                <Edit3 className="w-4 h-4" />
                            </button>
                            {onDeleteWorkflow && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteWorkflow(wf); }}
                                    className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                                    title="Delete workflow"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Visual Steps Preview (simplified) */}
                        <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl flex items-center gap-3 overflow-x-auto">
                            <div className="text-xs font-bold text-slate-400">Click to view/edit levels</div>
                        </div>
                    </div>
                ))}
            </div>
            {workflows.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <GitMerge className="w-16 h-16 opacity-20 mb-4" />
                    <p className="font-bold">No workflows defined yet.</p>
                    <p className="text-sm">Create your first approval process.</p>
                </div>
            )}
        </div>
    );
};

const GenericNotificationSettingsView = ({ notificationSettings, setEditingNotification, setSelectedNotificationRoles, setShowAddNotification }: any) => (
    <div className="p-8 h-full flex flex-col animate-page-enter">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Notification Engine</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Configure who gets notified for system events.</p>
            </div>
            <button onClick={() => { setEditingNotification(null); setSelectedNotificationRoles([]); setShowAddNotification(true); }} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                <Plus className="w-4 h-4" /> Add Rule
            </button>
        </div>

        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex-1">
            <table className="w-full text-left">
                <thead className="bg-slate-50/80 dark:bg-zinc-800/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/60 dark:border-zinc-700">
                    <tr>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Event Type</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Module</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Channels</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recipients</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50">
                    {notificationSettings.map((setting: any, i: number) => (
                        <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                            <td className="px-8 py-4">
                                <span className="font-bold text-slate-800 dark:text-white">{setting.event_type.replace(/_/g, ' ')}</span>
                            </td>
                            <td className="px-8 py-4">
                                <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded text-xs font-bold">{setting.module}</span>
                            </td>
                            <td className="px-8 py-4">
                                <div className="flex gap-2">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${setting.email_enabled ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-50'}`}>Email</span>
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${setting.in_app_enabled ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-50'}`}>In-App</span>
                                </div>
                            </td>
                            <td className="px-8 py-4">
                                <div className="flex flex-wrap gap-1">
                                    {setting.notify_roles?.map((role: string, idx: number) => (
                                        <span key={idx} className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded text-xs">{role}</span>
                                    ))}
                                </div>
                            </td>
                            <td className="px-8 py-4 text-right">
                                <button onClick={() => { setEditingNotification(setting); setSelectedNotificationRoles(setting.notify_roles || []); setShowAddNotification(true); }} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                                    <Edit3 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const GenericRemindersView = ({
    showReminderList,
    setShowReminderList,
    editingReminder,
    setEditingReminder,
    departments,
    reminders,
    handleSaveReminder
}: any) => {
    if (!showReminderList && editingReminder) {
        // Edit View (The complex form)
        return (
            <div className="p-8 h-full flex flex-col animate-page-enter">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reminder Configuration</h2>
                    <button onClick={() => { setShowReminderList(true); setEditingReminder(null); }} className="text-slate-500 hover:text-slate-700 font-bold text-sm">Cancel</button>
                </div>

                <div className="bg-white/70 dark:bg-zinc-900/70 p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reminder Type *</label>
                            <input value={editingReminder.name} onChange={e => setEditingReminder({ ...editingReminder, name: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" placeholder="e.g. Employee Document" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Department Head</label>
                            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 min-h-[3.5rem]">
                                {departments.map((d: any) => (
                                    <button key={d.id}
                                        onClick={() => {
                                            const current = editingReminder.target_filter?.department_ids || [];
                                            const create = current.includes(d.id.toString())
                                                ? current.filter((id: any) => id !== d.id.toString())
                                                : [...current, d.id.toString()];
                                            setEditingReminder({ ...editingReminder, target_filter: { ...editingReminder.target_filter, department_ids: create } });
                                        }}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${editingReminder.target_filter?.department_ids?.includes(d.id.toString()) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-zinc-700 text-slate-600'}`}>
                                        {d.name} {editingReminder.target_filter?.department_ids?.includes(d.id.toString()) && <X className="inline w-3 h-3 ml-1" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                        {/* Recipients Toggles */}
                        <div className="space-y-6">
                            <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl">
                                <span className="font-bold text-slate-700 dark:text-slate-300">Email To Employee</span>
                                <button
                                    onClick={() => setEditingReminder({ ...editingReminder, recipients_config: { ...editingReminder.recipients_config, notify_employee: !editingReminder.recipients_config.notify_employee } })}
                                    className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${editingReminder.recipients_config.notify_employee ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}>
                                    <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                                </button>
                            </label>
                            <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl">
                                <span className="font-bold text-slate-700 dark:text-slate-300">Email To Manager</span>
                                <button
                                    onClick={() => setEditingReminder({ ...editingReminder, recipients_config: { ...editingReminder.recipients_config, notify_manager: !editingReminder.recipients_config.notify_manager } })}
                                    className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${editingReminder.recipients_config.notify_manager ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}>
                                    <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                                </button>
                            </label>
                        </div>

                        {/* Schedule Config */}
                        <div className="col-span-2 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remind On Same Day</label>
                                    <button
                                        onClick={() => setEditingReminder({ ...editingReminder, schedule_config: { ...editingReminder.schedule_config, remind_on_same_day: !editingReminder.schedule_config.remind_on_same_day } })}
                                        className={`w-full p-4 rounded-2xl border font-bold text-left transition-all ${editingReminder.schedule_config.remind_on_same_day ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>
                                        {editingReminder.schedule_config.remind_on_same_day ? 'Yes, Remind me' : 'No'}
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remind Before (Days)</label>
                                    <input
                                        value={editingReminder.schedule_config.remind_before_days.join(', ')}
                                        onChange={e => {
                                            const days = e.target.value.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
                                            setEditingReminder({ ...editingReminder, schedule_config: { ...editingReminder.schedule_config, remind_before_days: days } });
                                        }}
                                        className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                        placeholder="e.g. 30, 45, 60"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1 pl-1">Comma separated</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Other Email Recipients</label>
                                <input
                                    value={editingReminder.recipients_config.custom_emails?.join(', ') || ''}
                                    onChange={e => {
                                        const emails = e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s);
                                        setEditingReminder({ ...editingReminder, recipients_config: { ...editingReminder.recipients_config, custom_emails: emails } });
                                    }}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                    placeholder="e.g. admin@company.com, hr@company.com"
                                />
                            </div>
                        </div>
                    </div>

                    <button onClick={() => handleSaveReminder(editingReminder)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
                        <Save className="w-5 h-5" /> Update Configuration
                    </button>
                </div>
            </div>
        );
    }

    // List View
    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Reminders</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Manage automated expiry and compliance alerts.</p>
                </div>
                <button onClick={() => {
                    setEditingReminder({
                        id: '',
                        name: '',
                        type: 'DOCUMENT',
                        target_filter: {},
                        schedule_config: { remind_before_days: [30], frequency: 'DAILY', remind_on_same_day: true },
                        recipients_config: { notify_employee: true, notify_manager: true },
                        is_active: true
                    } as any);
                    setShowReminderList(false);
                }} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                    <Plus className="w-4 h-4" /> Add Configuration
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {reminders.map((rem: any) => (
                    <div key={rem.id} className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-lg group hover:border-blue-300 transition-all cursor-pointer relative" onClick={() => { setEditingReminder(rem); setShowReminderList(false); }}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl">
                                <Clock className="w-6 h-6" />
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${rem.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {rem.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{rem.name}</h3>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {rem.schedule_config.remind_before_days.map((d: any) => (
                                <span key={d} className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded text-xs font-bold">{d} Days Before</span>
                            ))}
                        </div>
                        <div className="absolute top-8 right-8 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Edit3 className="w-5 h-5" />
                        </div>
                    </div>
                ))}
                {reminders.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                        <Clock className="w-16 h-16 opacity-20 mb-4" />
                        <p className="font-bold">No reminders configured.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Constants ---

const ALL_PERMISSIONS = {
    HRMS: [
        { id: 'hrms.employees.view', label: 'View Employees' },
        { id: 'hrms.employees.manage', label: 'Manage Employees' },
        { id: 'hrms.attendance.view', label: 'View Attendance' },
        { id: 'hrms.attendance.manage', label: 'Manage Attendance' },
        { id: 'hrms.leave.view', label: 'View Leaves' },
        { id: 'hrms.leave.manage', label: 'Manage Leaves' },
        { id: 'hrms.payroll.manage', label: 'Manage Payroll' },
        { id: 'hrms.assets.view', label: 'View Assets' },
        { id: 'hrms.assets.manage', label: 'Manage Assets' },
        { id: 'hrms.helpdesk.view', label: 'View Helpdesk' },
        { id: 'hrms.helpdesk.manage', label: 'Manage Helpdesk' },
        { id: 'hrms.reports.view', label: 'View Reports' },
    ],
    CRM: [
        { id: 'crm.dashboard.view', label: 'View Dashboard' },
        { id: 'crm.leads.view', label: 'View Leads' },
        { id: 'crm.leads.manage', label: 'Manage Leads' },
        { id: 'crm.deals.view', label: 'View Deals' },
        { id: 'crm.deals.manage', label: 'Manage Deals' },
        { id: 'crm.tasks.manage', label: 'Manage Tasks' },
        { id: 'crm.contacts.manage', label: 'Manage Contacts' },
        { id: 'crm.pipeline.manage', label: 'Manage Pipeline' },
        { id: 'crm.settings.manage', label: 'Manage Settings' },
    ],
    ORGANISATION: [
        { id: 'org.structure.view', label: 'View Structure' },
        { id: 'org.company.manage', label: 'Manage Company' },
        { id: 'org.masters.manage', label: 'Manage Masters' },
        { id: 'org.roles.manage', label: 'Manage Roles' },
        { id: 'org.users.manage', label: 'Manage Users' },
        { id: 'org.workflows.manage', label: 'Manage Workflows' },
        { id: 'org.settings.manage', label: 'Manage Settings' },
    ],
    FINANCE: [
        { id: 'finance.dashboard.view', label: 'View Finance Dashboard' },
        { id: 'finance.setup.manage', label: 'Manage Finance Setup' },
        { id: 'finance.payroll.manage', label: 'Manage Payroll Settings' },
        { id: 'finance.invoices.manage', label: 'Manage Invoices' },
        { id: 'finance.expenses.manage', label: 'Manage Expenses' },
    ],
    INVENTORY: [
        { id: 'inventory.view', label: 'View Inventory' },
        { id: 'inventory.manage', label: 'Manage Inventory' }
    ],
    MANUFACTURING: [
        { id: 'manufacturing.view', label: 'View Manufacturing' },
        { id: 'manufacturing.manage', label: 'Manage Manufacturing' }
    ],
    PROCUREMENT: [
        { id: 'procurement.view', label: 'View Procurement' },
        { id: 'procurement.manage', label: 'Manage Procurement' }
    ],
    ESSP: [
        { id: 'essp.view', label: 'Access ESSP' },
        { id: 'essp.profile.manage', label: 'Manage Own Profile' }
    ]
};

const RolePermissionEditor = ({ selectedPermissions, onChange }: { selectedPermissions: string[], onChange: (perms: string[]) => void }) => {
    const [activeModule, setActiveModule] = useState<string>(Object.keys(ALL_PERMISSIONS)[0]);

    const togglePermission = (id: string) => {
        if (selectedPermissions.includes(id)) {
            onChange(selectedPermissions.filter(p => p !== id));
        } else {
            onChange([...selectedPermissions, id]);
        }
    };

    const toggleModule = (module: string, permissions: { id: string }[]) => {
        const allModuleIds = permissions.map(p => p.id);
        const hasAll = allModuleIds.every(id => selectedPermissions.includes(id));

        if (hasAll) {
            onChange(selectedPermissions.filter(p => !allModuleIds.includes(p)));
        } else {
            const newPerms = [...new Set([...selectedPermissions, ...allModuleIds])];
            onChange(newPerms);
        }
    }

    const getModuleIcon = (module: string) => {
        switch (module) {
            case 'HRMS': return Users;
            case 'CRM': return BarChart2; // Or Briefcase
            case 'ORGANISATION': return Building2;
            case 'FINANCE': return Banknote; // Need to import Banknote or use DollarSign
            case 'INVENTORY': return Package; // Need import
            case 'MANUFACTURING': return Factory; // Need import
            case 'PROCUREMENT': return ShoppingCart; // Need import
            case 'ESSP': return User;
            default: return Shield;
        }
    };

    return (
        <div className="flex h-[500px] border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-slate-50 dark:bg-zinc-900">
            {/* Sidebar */}
            <div className="w-1/3 border-r border-slate-200 dark:border-zinc-700 overflow-y-auto bg-white dark:bg-zinc-900 p-2 space-y-1">
                {Object.entries(ALL_PERMISSIONS).map(([module, permissions]) => {
                    const count = permissions.filter(p => selectedPermissions.includes(p.id)).length;
                    const total = permissions.length;
                    const Icon = getModuleIcon(module);

                    return (
                        <button
                            key={module}
                            type="button"
                            onClick={() => setActiveModule(module)}
                            className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all ${activeModule === module
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                        >
                            <div className="flex items-center gap-3">
                                {/* <Icon className="w-4 h-4" /> */}
                                <span className="font-bold text-sm tracking-wide">{module}</span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${count > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                                {count}/{total}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-zinc-800/20">
                <div className="p-4 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center bg-white dark:bg-zinc-900/50">
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">{activeModule} Permissions</h4>
                        <p className="text-xs text-slate-500">Manage access levels for {activeModule} module.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => toggleModule(activeModule, (ALL_PERMISSIONS as any)[activeModule])}
                        className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold transition-colors"
                    >
                        Toggle All
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(ALL_PERMISSIONS as any)[activeModule].map((perm: any) => (
                            <label key={perm.id} className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-all ${selectedPermissions.includes(perm.id)
                                ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 shadow-sm'
                                : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}>
                                <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedPermissions.includes(perm.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                    {selectedPermissions.includes(perm.id) && <Check className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <input
                                    type="checkbox"
                                    checked={selectedPermissions.includes(perm.id)}
                                    onChange={() => togglePermission(perm.id)}
                                    className="sr-only"
                                />
                                <div>
                                    <p className={`text-sm font-bold ${selectedPermissions.includes(perm.id) ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>{perm.label}</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{perm.id}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Organisation: React.FC = () => {
    const [activeTab, setActiveTab] = useState('STRUCTURE');
    const [activeMasterTab, setActiveMasterTab] = useState('DEPARTMENTS');

    const { currentCompanyId, user, hasPermission } = useAuth();

    const navItems = useMemo(() => [
        { id: 'STRUCTURE', icon: LayoutGrid, label: 'Org Structure', permission: 'org.structure.view' },
        { id: 'PROFILE', icon: Building2, label: 'Company Profile', permission: 'org.company.manage' },
        { id: 'MASTERS', icon: Database, label: 'Masters', permission: 'org.masters.manage' },
        { id: 'ROLES', icon: Shield, label: 'Roles & Permissions', permission: 'org.roles.manage' },
        { id: 'USERS', icon: User, label: 'Users', permission: 'org.users.manage' },
        { id: 'WORKFLOWS', icon: GitMerge, label: 'Workflows', permission: 'org.workflows.manage' },
        { id: 'NOTIFICATIONS', icon: Bell, label: 'Notifications', permission: 'org.settings.manage' },
        { id: 'REMINDERS', icon: Clock, label: 'Reminders', permission: 'org.settings.manage' },
        { id: 'AI_SETTINGS', icon: Sparkles, label: 'AI Settings', permission: 'org.settings.manage' },
        { id: 'SETTINGS', icon: Settings, label: 'Payroll Settings', permission: 'finance.payroll.manage' },
        { id: 'ACCOUNTING', icon: BarChart2, label: 'Accounting Setup', permission: 'finance.setup.manage' },
        { id: 'ADD_COMPANY', icon: Plus, label: 'Add Company', permission: '*' }, // Restricted to Admin/Owner effectively via *
    ].filter(item => hasPermission(item.permission) || hasPermission('*')), [hasPermission]);

    useEffect(() => {
        if (navItems.length > 0 && !navItems.find(i => i.id === activeTab)) {
            setActiveTab(navItems[0].id);
        }
    }, [navItems, activeTab]);

    // State for data
    const [departments, setDepartments] = useState<Department[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [notificationSettings, setNotificationSettings] = useState<any[]>([]);
    const [reminders, setReminders] = useState<any[]>([]);

    // State for master data
    const [designations, setDesignations] = useState<any[]>([]);
    const [grades, setGrades] = useState<any[]>([]);
    const [employmentTypes, setEmploymentTypes] = useState<any[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
    const [financialYears, setFinancialYears] = useState<any[]>([]);
    const [payrollMonths, setPayrollMonths] = useState<any[]>([]);
    const [leaveCalendarYears, setLeaveCalendarYears] = useState<any[]>([]);
    const [salaryComponents, setSalaryComponents] = useState<any[]>([]);
    const [shiftTimings, setShiftTimings] = useState<any[]>([]);
    const [faiths, setFaiths] = useState<any[]>([]);
    const [maritalStatus, setMaritalStatus] = useState<any[]>([]);
    const [bloodGroups, setBloodGroups] = useState<any[]>([]);
    const [nationalities, setNationalities] = useState<any[]>([]);

    // Buzz Data
    const [polls, setPolls] = useState<any[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [surveys, setSurveys] = useState<any[]>([]);
    const [kudosCategories, setKudosCategories] = useState<any[]>([]);

    // CRM Data
    const [crmStages, setCrmStages] = useState<any[]>([]);

    // All Employees (for linking in User Modal)
    const [allEmployees, setAllEmployees] = useState<any[]>([]);

    // State for modals / editing
    const [showAddDepartment, setShowAddDepartment] = useState(false);
    const [showAddLocation, setShowAddLocation] = useState(false);
    const [showAddRole, setShowAddRole] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [showAddUser, setShowAddUser] = useState(false);
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);
    const [showAddWorkflow, setShowAddWorkflow] = useState(false);
    const [showAddNotification, setShowAddNotification] = useState(false);
    const [editingNotification, setEditingNotification] = useState<any>(null);
    const [editingReminder, setEditingReminder] = useState<ReminderConfig | null>(null);
    const [showReminderList, setShowReminderList] = useState(true); // Master-Detail toggle for Reminders

    // Buzz Modals
    const [showAddPoll, setShowAddPoll] = useState(false);

    // Add Company State
    const [newCompanyName, setNewCompanyName] = useState('');
    const [newCompanyCode, setNewCompanyCode] = useState('');
    const [addCompanyLoading, setAddCompanyLoading] = useState(false);
    const [addCompanyMsg, setAddCompanyMsg] = useState<string | null>(null);

    const [editingWorkflow, setEditingWorkflow] = useState<WorkflowConfig | null>(null);
    const [workflowLevels, setWorkflowLevels] = useState<any[]>([]);
    const [showWorkflowList, setShowWorkflowList] = useState(true);

    const [selectedNotificationRoles, setSelectedNotificationRoles] = useState<string[]>([]);

    // Generic Master Data Modal State
    const [showMasterModal, setShowMasterModal] = useState(false);
    const [editingMasterItem, setEditingMasterItem] = useState<any>(null);
    const [currentMasterConfig, setCurrentMasterConfig] = useState<MasterTableConfig | null>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        refreshData();
    }, [activeTab]);

    const refreshData = async () => {
        setLoading(true);
        if (activeTab === 'MASTERS') {
            // Core Organization Masters
            if (activeMasterTab === 'DEPARTMENTS') {
                const { data } = await supabase.from('departments').select('*');
                if (data) setDepartments(data as any[]);
            }
            if (activeMasterTab === 'LOCATIONS') {
                const { data } = await supabase.from('locations').select('*');
                if (data) setLocations(data as any[]);
            }
            if (activeMasterTab === 'DESIGNATIONS') {
                const { data } = await supabase.from('org_designations').select('*');
                if (data) setDesignations(data as any[]);
            }
            if (activeMasterTab === 'GRADES') {
                const { data } = await supabase.from('org_grades').select('*');
                if (data) setGrades(data as any[]);
            }
            if (activeMasterTab === 'EMPLOYMENT_TYPES') {
                const { data } = await supabase.from('org_employment_types').select('*');
                if (data) setEmploymentTypes(data as any[]);
            }
            // Leave Masters
            if (activeMasterTab === 'LEAVE_TYPES') {
                const { data } = await supabase.from('org_leave_types').select('*');
                if (data) setLeaveTypes(data);
            }
            // Payroll Masters
            if (activeMasterTab === 'SALARY_COMPONENTS') {
                const { data } = await supabase.from('org_salary_components').select('*');
                if (data) setSalaryComponents(data);
            }
            // Attendance Masters
            if (activeMasterTab === 'SHIFT_TIMINGS') {
                const { data } = await supabase.from('org_shift_timings').select('*');
                if (data) setShiftTimings(data);
            }
            // Common Attributes
            if (activeMasterTab === 'FAITHS') {
                const { data } = await supabase.from('org_faiths').select('*');
                if (data) setFaiths(data);
            }
            if (activeMasterTab === 'MARITAL_STATUS') {
                const { data } = await supabase.from('org_marital_status').select('*');
                if (data) setMaritalStatus(data);
            }
            if (activeMasterTab === 'BLOOD_GROUPS') {
                const { data } = await supabase.from('org_blood_groups').select('*');
                if (data) setBloodGroups(data);
            }
            if (activeMasterTab === 'NATIONALITIES') {
                const { data } = await supabase.from('org_nationalities').select('*');
                if (data) setNationalities(data);
            }
            if (activeMasterTab === 'FINANCIAL_YEARS') {
                const { data } = await supabase.from('org_financial_years').select('*').order('start_date', { ascending: false });
                if (data) setFinancialYears(data);
            }
            if (activeMasterTab === 'PAYROLL_MONTHS') {
                const { data, error } = await supabase.from('org_payroll_months').select('*').order('month_year', { ascending: false });
                console.log('Payroll Months fetch:', { data, error });
                if (error) {
                    console.error('Payroll months fetch error:', error);
                } else if (data) {
                    setPayrollMonths(data);
                }

                // Also fetch Financial Years for the dropdown
                const { data: fyData } = await supabase.from('org_financial_years').select('*').order('start_date', { ascending: false });
                if (fyData) setFinancialYears(fyData);
            }
            if (activeMasterTab === 'LEAVE_CALENDAR') {
                const { data } = await supabase.from('org_leave_calendar_years').select('*').order('year', { ascending: false });
                if (data) setLeaveCalendarYears(data);
            }
            // Bank Configs
            if (activeMasterTab === 'BANK_CONFIGS') {
                const { data } = await supabase.from('org_bank_configs').select('*');
                if (data) setDepartments(prev => []); // Note: Using correct state variable if needed, but assuming GenericMastersView uses `data` prop
                // Actually we need a state for bank configs, but looking at code above, I missed adding it to state or it was missed in original code.
                // Assuming it's fine to rely on refreshData fetch or add it.
                // However, GenericMastersView takes `data` prop.
                // Let's check `data` switch in render.
            }

            // ESSP Masters
            if (activeMasterTab === 'ANNOUNCEMENTS') {
                const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
                if (data) setAnnouncements(data);
            }
            if (activeMasterTab === 'POLLS') {
                const { data } = await supabase.from('polls').select('*').order('created_at', { ascending: false });
                if (data) setPolls(data as any[]);
            }
            if (activeMasterTab === 'SURVEYS') {
                const { data } = await supabase.from('surveys').select('*').order('created_at', { ascending: false });
                if (data) setSurveys(data);
            }
            if (activeMasterTab === 'KUDOS_CATEGORIES') {
                const { data } = await supabase.from('master_kudos_categories').select('*');
                if (data) setKudosCategories(data as any[]);
            }
            if (activeMasterTab === 'CRM_STAGES') {
                const { data } = await supabase.from('org_crm_stages').select('*').order('position', { ascending: true });
                if (data) setCrmStages(data as any[]);
            }
        }
        if (activeTab === 'ROLES') {
            if (currentCompanyId) {
                const { data } = await supabase.from('roles').select('*').eq('company_id', currentCompanyId);
                if (data) setRoles(data as any[]);

                // Also fetch users to show counts
                const { data: userData } = await supabase.from('profiles')
                    .select('*, employees:employee_id(id, name, employee_code, email)')
                    .eq('company_id', currentCompanyId);

                if (userData) {
                    const appUsers: AppUser[] = userData.map((p: any) => {
                        const roleName = p.role || 'Employee';
                        const roleId = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase())?.id || '';

                        return {
                            id: p.id,
                            name: p.full_name || 'Unknown',
                            email: p.email || '',
                            roleId: roleId,
                            role: roleName,
                            department: 'N/A',
                            phone: '',
                            joinDate: new Date().toISOString(),
                            status: 'Active',
                            employeeId: p.employees?.employee_code || p.employees?.id || '-',
                            salary: 0,
                            avatar: '',
                            location: 'Unknown',
                            company_id: p.company_id
                        };
                    });
                    setUsers(appUsers);
                }
            }
        }
        if (activeTab === 'USERS') {
            // Fetch all employees for the linking dropdown
            if (currentCompanyId) {
                const { data: empList } = await supabase.from('employees')
                    .select('id, name, employee_code, email')
                    .eq('company_id', currentCompanyId)
                    .eq('status', 'Active')
                    .order('name');
                if (empList) setAllEmployees(empList);
            }

            const { data } = await (supabase as any).from('profiles')
                .select('*, employees:employee_id(id, name, employee_code, email)')
                .eq('company_id', currentCompanyId);

            if (data) {
                const appUsers: AppUser[] = data.map((p: any) => {
                    const roleName = p.role || 'Employee';
                    const roleId = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase())?.id || '';

                    return {
                        id: p.id,
                        name: p.full_name || 'Unknown',
                        email: p.email || '',
                        roleId: roleId,
                        role: roleName,
                        department: 'N/A',
                        phone: '',
                        joinDate: new Date().toISOString(),
                        status: 'Active',
                        employeeId: p.employees?.employee_code || p.employees?.id || '-',
                        linkedEmployeeId: p.employee_id || '',
                        salary: 0,
                        avatar: '',
                        location: 'Unknown',
                        company_id: ''
                    };
                });
                setUsers(appUsers);
            }
        }
        if (activeTab === 'WORKFLOWS') {
            const { data } = await supabase.from('workflows').select('*').order('created_at', { ascending: false });
            if (data) setWorkflows(data);
        }
        if (activeTab === 'NOTIFICATIONS') {
            const { data } = await supabase.from('notification_settings').select('*');
            if (data) setNotificationSettings(data);
        }
        if (activeTab === 'REMINDERS') {
            const { data } = await supabase.from('reminders').select('*');
            if (data) setReminders(data as any[]);
        }
        if (activeTab === 'BUZZ') {
            const { data: ann } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
            if (ann) setAnnouncements(ann);

            const { data: pl } = await supabase.from('polls').select('*, poll_options(*)').order('created_at', { ascending: false });
            if (pl) setPolls(pl);
        }
        setLoading(false);
    };

    useEffect(() => {
        refreshData();
    }, [activeMasterTab]);

    // --- Handlers ---

    const handleAddRole = async (formData: FormData, permissions: string[]) => {
        if (!currentCompanyId) return;

        const payload = {
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            permissions: permissions,
            status: 'Active',
            company_id: currentCompanyId
        };

        if (editingRole) {
            const { error } = await supabase.from('roles').update(payload).eq('id', editingRole.id);
            if (error) alert("Error updating role: " + error.message);
        } else {
            const { error } = await supabase.from('roles').insert([payload]);
            if (error) alert("Error creating role: " + error.message);
        }

        setShowAddRole(false);
        setEditingRole(null);
        refreshData();
    };

    const handleDeleteRole = async (role: Role) => {
        const assignedUsers = users.filter((u: any) => u.roleId === role.id);
        if (assignedUsers.length > 0) {
            alert(`Cannot delete role "${role.name}" — it is currently assigned to ${assignedUsers.length} user(s). Please reassign them first.`);
            return;
        }
        if (!confirm(`Are you sure you want to delete the role "${role.name}"? This action cannot be undone.`)) return;
        const { error } = await supabase.from('roles').delete().eq('id', role.id);
        if (error) {
            alert('Error deleting role: ' + error.message);
        } else {
            refreshData();
        }
    };

    const handleDeleteWorkflow = async (wf: any) => {
        if (!confirm(`Delete workflow "${wf.name}"? This will also remove all associated approval levels.`)) return;
        // Delete levels first
        await supabase.from('workflow_levels').delete().eq('workflow_id', wf.id);
        // Delete workflow instances if any
        await supabase.from('workflow_instances').delete().eq('workflow_id', wf.id).then(() => { });
        const { error } = await supabase.from('workflows').delete().eq('id', wf.id);
        if (error) {
            alert('Error deleting workflow: ' + error.message);
        } else {
            refreshData();
        }
    };

    const handleDeleteUser = async (user: any) => {
        // Safety: prevent deleting own account
        const { data: { user: currentAuthUser } } = await supabase.auth.getUser();
        if (currentAuthUser && currentAuthUser.id === user.id) {
            alert('You cannot delete your own account.');
            return;
        }
        if (!confirm(`Delete user "${user.name}" (${user.email})? This will remove their profile record. The auth account will remain but will be unlinked.`)) return;
        const { error } = await supabase.from('profiles').delete().eq('id', user.id);
        if (error) {
            alert('Error deleting user: ' + error.message);
        } else {
            refreshData();
        }
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        if (!currentCompanyId) return;

        const roleId = formData.get('roleId') as string;
        const roleObj = roles.find(r => r.id === roleId);
        const roleName = roleObj ? roleObj.name : 'Employee';

        const selectedEmployeeId = formData.get('employeeId') as string;

        // Auto-link by email match if no employee selected
        let linkedEmployeeId = selectedEmployeeId || null;
        const email = formData.get('email') as string;
        if (!linkedEmployeeId && email) {
            const { data: emp } = await supabase.from('employees').select('id').eq('email', email).maybeSingle();
            if (emp) linkedEmployeeId = emp.id;
        }

        const name = formData.get('name') as string;

        if (editingUser) {
            // Update User via RPC to bypass RLS
            const { error } = await supabase.rpc('admin_update_user', {
                p_user_id: editingUser.id,
                p_full_name: name,
                p_role: roleName,
                p_employee_id: linkedEmployeeId
            });
            
            if (error) {
                alert("Error updating user: " + error.message);
            } else {
                // Ensure role is updated in user_company_access
                await supabase.from('user_company_access')
                    .update({ role_id: roleId })
                    .eq('user_id', editingUser.id)
                    .eq('company_id', currentCompanyId);

                alert("User updated successfully");
                setShowAddUser(false);
                setEditingUser(null);
                refreshData();
            }
        } else {
            // Create new user via RPC to avoid logging out current admin
            if (!email) { alert('Email is required'); return; }

            try {
                const { data: result, error } = await supabase.rpc('admin_create_user', {
                    p_email: email,
                    p_password: 'Password123!',
                    p_full_name: name,
                    p_role: roleName,
                    p_company_id: currentCompanyId,
                    p_role_id: roleId,
                    p_employee_id: linkedEmployeeId
                });

                if (error) {
                    alert('Error creating user: ' + error.message);
                    return;
                }

                alert(`User "${name}" created successfully with default password "Password123!".`);
                setShowAddUser(false);
                setEditingUser(null);
                refreshData();
            } catch (err: any) {
                alert('Error: ' + err.message);
            }
        }
    };

    const handleAddWorkflow = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        if (!currentCompanyId) return;

        const { data: wf, error } = await supabase.from('workflows').insert([{
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            module: formData.get('module') as string,
            trigger_type: formData.get('trigger_type') as string,
            is_active: true,
            company_id: currentCompanyId
        }]).select().single();

        if (wf) {
            await supabase.from('workflow_steps').insert([
                { workflow_id: wf.id, step_order: 1, name: 'Manager Approval', type: 'APPROVAL' },
                { workflow_id: wf.id, step_order: 2, name: 'HR Verification', type: 'APPROVAL' }
            ]);
            setShowAddWorkflow(false);
            refreshData();
        }
    };

    const handleAddNotificationRule = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        if (currentCompanyId) {
            const payload = {
                event_type: formData.get('event_type') as string,
                module: formData.get('module') as string,
                email_enabled: formData.get('email_enabled') === 'on',
                in_app_enabled: formData.get('in_app_enabled') === 'on',
                notify_roles: selectedNotificationRoles,
                company_id: currentCompanyId
            };

            if (editingNotification) {
                await supabase.from('notification_settings').update(payload).eq('id', editingNotification.id);
            } else {
                await supabase.from('notification_settings').insert([payload]);
            }
            setShowAddNotification(false);
            setEditingNotification(null);
            refreshData();
        }
    };

    const handleSaveReminder = async (reminder: Partial<ReminderConfig>) => {
        if (!currentCompanyId) return;

        const payload = { ...reminder, company_id: currentCompanyId };

        // For insert we need to make sure we don't send 'id' if it's new
        const { id, ...insertData } = payload as any;

        if (reminder.id) {
            await supabase.from('reminders').update(insertData).eq('id', reminder.id);
        } else {
            await supabase.from('reminders').insert([insertData]);
        }
        setEditingReminder(null);
        setShowReminderList(true);
        refreshData();
    };

    const handleSaveWorkflow = async (wf: Partial<WorkflowConfig>) => {
        if (!currentCompanyId) return;

        const payload = { ...wf, company_id: currentCompanyId };
        const { id, ...insertData } = payload as any;

        let workflowId = wf.id;

        if (wf.id) {
            await supabase.from('workflows').update(insertData).eq('id', wf.id);
        } else {
            const { data } = await supabase.from('workflows').insert([insertData]).select().single();
            if (data) workflowId = data.id;
        }

        // Save Levels if we have them in state (for new workflows we might need to handle this better, but for MVP we edit existing)
        if (workflowId && workflowLevels.length > 0) {
            // Simple sync: delete all and re-insert (easiest for prototype)
            await supabase.from('workflow_levels').delete().eq('workflow_id', workflowId);
            const levelsPayload = workflowLevels.map(l => ({
                workflow_id: workflowId,
                level_order: l.level_order,
                level_name: l.level_name,
                approver_type: l.approver_type,
                approver_ids: l.approver_ids,
                approver_logic: l.approver_logic
            }));
            await supabase.from('workflow_levels').insert(levelsPayload);
        }

        setEditingWorkflow(null);
        setShowWorkflowList(true);
        refreshData();
    };

    const fetchWorkflowLevels = async (workflowId: string) => {
        const { data } = await supabase.from('workflow_levels').select('*').eq('workflow_id', workflowId).order('level_order');
        if (data) setWorkflowLevels(data);
        else setWorkflowLevels([]);
    };

    // --- Add Company Handler ---
    const handleAddCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddCompanyLoading(true);
        setAddCompanyMsg(null);
        try {
            const code = newCompanyCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || newCompanyName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'COMP';

            // 1. Create Company
            const { data: companyData, error: companyError } = await supabase
                .from('companies')
                .insert([{ name: newCompanyName.trim(), code, status: 'active', subscription_status: 'active' }])
                .select()
                .single();
            if (companyError) throw companyError;

            // 2. Create User Company Access
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) throw new Error('Not authenticated');

            const { error: accessError } = await supabase
                .from('user_company_access')
                .insert([{
                    user_id: authUser.id,
                    company_id: companyData.id,
                    is_default: false,
                    status: 'active'
                }]);
            if (accessError) throw accessError;

            setAddCompanyMsg(`✅ Company "${newCompanyName.trim()}" created! Switch to it from the Company Selector on next login.`);
            setNewCompanyName('');
            setNewCompanyCode('');
        } catch (err: any) {
            console.error('Add Company Error:', err);
            setAddCompanyMsg(`❌ Error: ${err.message}`);
        } finally {
            setAddCompanyLoading(false);
        }
    };

    // Local Search State
    const [localSearch, setLocalSearch] = useState('');

    // Filtered Data based on local search
    const filteredRoles = roles.filter(r => r.name.toLowerCase().includes(localSearch.toLowerCase()));
    const filteredUsers = users.filter(u => u.name.toLowerCase().includes(localSearch.toLowerCase()) || u.email.toLowerCase().includes(localSearch.toLowerCase()));

    // --- Components ---






    const GenericAddRoleModal = ({ setShowAddRole, handleAddRole }: any) => {
        const [permissions, setPermissions] = useState<string[]>([]);

        useEffect(() => {
            if (editingRole && editingRole.permissions) {
                setPermissions(editingRole.permissions);
            } else {
                setPermissions([]);
            }
        }, [editingRole]); // Depend on editingRole

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const formData = new FormData(form);
            handleAddRole(formData, permissions);
        };

        return (
            <Modal title={editingRole ? "Edit Role & Permissions" : "Add New Role"} onClose={() => { setShowAddRole(false); setEditingRole(null); }} maxWidth="max-w-5xl">
                <form onSubmit={handleSubmit} className="flex flex-col h-[70vh]">
                    <div className="flex gap-6 mb-6">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Role Name</label>
                            <input
                                name="name"
                                defaultValue={editingRole?.name || ''}
                                required
                                placeholder="e.g. HR Manager"
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                            />
                        </div>
                        <div className="flex-[2]">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                            <input
                                name="description"
                                defaultValue={editingRole?.description || ''}
                                required
                                placeholder="Brief description of the role's responsibilities..."
                                className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-zinc-900/50 rounded-2xl border border-slate-200 dark:border-zinc-800 p-1">
                        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-slate-400" />
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Access Control</label>
                            </div>
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-800">{permissions.length} Permissions Selected</span>
                        </div>
                        <div className="flex-1 overflow-hidden p-1">
                            <RolePermissionEditor selectedPermissions={permissions} onChange={setPermissions} />
                        </div>
                    </div>

                    <div className="pt-6 mt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                        <button type="button" onClick={() => setShowAddRole(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all">Cancel</button>
                        <button className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold transition-all hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-500/20 flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            {editingRole ? 'Update Role Configuration' : 'Create Role'}
                        </button>
                    </div>
                </form>
            </Modal>
        );
    };

    const GenericUserModal = ({ setShowAddUser, handleSaveUser, roles, editingUser, allEmployees }: any) => {
        const MODULE_PERMISSIONS = [
            { label: 'HRMS', perms: ['hrms.employees.view', 'hrms.attendance.view', 'hrms.leave.view', 'hrms.payroll.view'] },
            { label: 'Self Service (ESSP)', perms: ['essp.view'] },
            { label: 'CRM', perms: ['crm.dashboard.view', 'crm.deals.view', 'crm.customers.view'] },
            { label: 'Organisation', perms: ['org.structure.view', 'org.company.manage', 'org.roles.manage', 'org.users.manage', 'org.masters.manage'] },
            { label: 'Inventory', perms: ['inventory.view'] },
            { label: 'Accounting / Finance', perms: ['finance.dashboard.view', 'finance.payroll.manage'] },
            { label: 'Manufacturing', perms: ['manufacturing.view'] },
            { label: 'Procurement', perms: ['procurement.view'] },
        ];
        const [grantedPerms, setGrantedPerms] = React.useState<string[]>([]);
        const [showPerms, setShowPerms] = React.useState(false);

        React.useEffect(() => {
            if (editingUser?.id) {
                supabase.from('user_permissions')
                    .select('permission')
                    .eq('user_id', editingUser.id)
                    .eq('granted', true)
                    .then(({ data }) => setGrantedPerms(data?.map((d: any) => d.permission) || []));
            }
        }, [editingUser?.id]);

        const togglePerm = (perm: string) =>
            setGrantedPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);

        const handleSubmit = async (e: React.FormEvent) => {
            await handleSaveUser(e);
            if (editingUser?.id && currentCompanyId) {
                const allPerms = MODULE_PERMISSIONS.flatMap(m => m.perms);
                const upsertPayload = allPerms.map(p => ({
                    user_id: editingUser.id, company_id: currentCompanyId,
                    permission: p, granted: grantedPerms.includes(p)
                }));
                await supabase.from('user_permissions').upsert(upsertPayload, { onConflict: 'user_id,company_id,permission' });
            }
        };

        return (
            <Modal title={editingUser ? "Edit User" : "Add New User"} onClose={() => { setShowAddUser(false); setEditingUser(null); }} maxWidth="max-w-xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input name="name" defaultValue={editingUser?.name || ''} required placeholder="Full Name"
                        className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm" />
                    <input name="email" defaultValue={editingUser?.email || ''} required type="email" placeholder="Email"
                        disabled={!!editingUser}
                        className={`w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm ${editingUser ? 'opacity-60 cursor-not-allowed' : ''}`} />
                    <select name="roleId" defaultValue={editingUser?.roleId || ''} required
                        className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm">
                        <option value="">Select Role...</option>
                        {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Link Employee Record</label>
                        <select name="employeeId" defaultValue={editingUser?.linkedEmployeeId || ''}
                            className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm">
                            <option value="">— No Employee Linked —</option>
                            {(allEmployees || []).map((emp: any) => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name} {emp.employee_code ? `(${emp.employee_code})` : ''} — {emp.email || 'No email'}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-400 mt-1">Linking enables the employee to see their profile data in ESSP.</p>
                    </div>

                    {/* Permission Matrix — only for existing users */}
                    {editingUser && (
                        <div className="border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
                            <button type="button" onClick={() => setShowPerms(v => !v)}
                                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors">
                                <span>🔐 Module Permissions (Per-User Override)</span>
                                <span className="text-xs text-slate-400">{showPerms ? '▲ Hide' : '▼ Expand'}</span>
                            </button>
                            {showPerms && (
                                <div className="p-4 space-y-4 bg-white dark:bg-zinc-900 max-h-64 overflow-y-auto">
                                    <p className="text-xs text-slate-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 p-2 rounded-lg">These override role-based permissions for this user only.</p>
                                    {MODULE_PERMISSIONS.map(module => (
                                        <div key={module.label}>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{module.label}</p>
                                            <div className="grid grid-cols-1 gap-1 pl-2">
                                                {module.perms.map(perm => (
                                                    <label key={perm} className="flex items-center gap-2 cursor-pointer group">
                                                        <input type="checkbox" checked={grantedPerms.includes(perm)}
                                                            onChange={() => togglePerm(perm)} className="w-4 h-4 rounded accent-blue-600" />
                                                        <span className="text-xs text-slate-600 dark:text-slate-300 group-hover:text-blue-500 transition-colors font-mono">{perm}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl text-xs">
                        Note: Changing role updates the profile access level.{!editingUser && ' After creating, edit the user to set specific module permissions.'}
                    </div>
                    <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-colors">
                        {editingUser ? 'Update User' : 'Send Invitation'}
                    </button>
                </form>
            </Modal>
        );
    };


    const GenericAddWorkflowModal = ({ setShowAddWorkflow, handleAddWorkflow }: any) => (
        <Modal title="Create New Workflow" onClose={() => setShowAddWorkflow(false)}>
            <form onSubmit={handleAddWorkflow} className="space-y-4">
                <input name="name" required placeholder="Workflow Name" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm" />
                <textarea name="description" placeholder="Description" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm h-24 resize-none" />
                <div className="grid grid-cols-2 gap-4">
                    <select name="module" required className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm">
                        <option value="HRMS">HRMS</option>
                        <option value="ESSP">ESSP</option>
                        <option value="CRM">CRM</option>
                        <option value="FINANCE">Finance</option>
                    </select>
                    <select name="trigger_type" required className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm">
                        <option value="LEAVE_REQUEST">Leave Request</option>
                        <option value="RESIGNATION">Resignation</option>
                        <option value="EXPENSE_CLAIM">Expense Claim</option>
                        <option value="DEAL_APPROVAL">New Deal Approval</option>
                    </select>
                </div>
                <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold">Create Workflow</button>
            </form>
        </Modal>
    );

    const GenericAddNotificationRuleModal = ({ editingNotification, setShowAddNotification, setEditingNotification, handleAddNotificationRule, roles, selectedNotificationRoles, setSelectedNotificationRoles }: any) => (
        <Modal title={editingNotification ? "Edit Notification Rule" : "Add Notification Rule"} onClose={() => { setShowAddNotification(false); setEditingNotification(null); }}>
            <form key={editingNotification?.id || 'new'} onSubmit={handleAddNotificationRule} className="space-y-4">
                <select name="event_type" defaultValue={editingNotification?.event_type} required className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm">
                    <option value="LEAVE_REQUEST">Leave Request</option>
                    <option value="NEW_USER">New User Joined</option>
                    <option value="WORKFLOW_APPROVAL">Workflow Approval Needed</option>
                    <option value="SYSTEM_ALERT">System Alert</option>
                </select>
                <select name="module" defaultValue={editingNotification?.module} required className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm">
                    <option value="HRMS">HRMS</option>
                    <option value="ORGANISATION">Organisation</option>
                    <option value="CRM">CRM</option>
                    <option value="All">All Modules</option>
                </select>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recipients (Roles)</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 min-h-[3.5rem]">
                        {roles.map((r: any) => (
                            <button key={r.id} type="button"
                                onClick={() => {
                                    const current = selectedNotificationRoles;
                                    const updated = current.includes(r.name)
                                        ? current.filter((n: string) => n !== r.name)
                                        : [...current, r.name];
                                    setSelectedNotificationRoles(updated);
                                }}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${selectedNotificationRoles.includes(r.name) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-zinc-700 text-slate-600'}`}>
                                {r.name} {selectedNotificationRoles.includes(r.name) && <X className="inline w-3 h-3 ml-1" />}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex gap-6">
                    <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                        <input type="checkbox" name="email_enabled" defaultChecked={editingNotification ? editingNotification.email_enabled : true} className="w-5 h-5 rounded text-blue-600" />
                        Email
                    </label>
                    <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                        <input type="checkbox" name="in_app_enabled" defaultChecked={editingNotification ? editingNotification.in_app_enabled : true} className="w-5 h-5 rounded text-blue-600" />
                        In-App
                    </label>
                </div>
                <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold">{editingNotification ? 'Update' : 'Save'}</button>
            </form>
        </Modal>
    );



    // --- BUZZ FEED COMPONENTS ---

    const GenericBuzzView = ({ announcements, setAnnouncements, polls, setPolls, onAddPoll }: any) => {
        const [subTab, setSubTab] = useState('ANNOUNCEMENTS');

        return (
            <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950">
                <header className="flex-shrink-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-8 py-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Buzz & Communications</h1>
                            <p className="text-slate-500 font-medium">Manage announcements and team polls</p>
                        </div>
                    </div>
                    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl w-fit">
                        {['ANNOUNCEMENTS', 'POLLS'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSubTab(tab)}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${subTab === tab
                                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {tab.charAt(0) + tab.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="flex-1 overflow-hidden p-8">
                    {subTab === 'ANNOUNCEMENTS' && (
                        <GenericMastersView
                            activeTab="ANNOUNCEMENTS"
                            setActiveTab={() => { }}
                            search=""
                            setSearch={() => { }}
                            config={MASTER_CONFIG['ANNOUNCEMENTS']}
                            data={announcements}
                            onAdd={() => {
                                setCurrentMasterConfig(MASTER_CONFIG['ANNOUNCEMENTS']);
                                setEditingMasterItem(null);
                                setShowMasterModal(true);
                            }}
                            onEdit={(item: any) => {
                                setCurrentMasterConfig(MASTER_CONFIG['ANNOUNCEMENTS']);
                                setEditingMasterItem(item);
                                setShowMasterModal(true);
                            }}
                            onDelete={(item: any) => handleDeleteMasterItem(MASTER_CONFIG['ANNOUNCEMENTS'], item)}
                        />
                    )}
                    {subTab === 'POLLS' && (
                        <InternalPollsView polls={polls} onAdd={() => setShowAddPoll(true)} onDelete={async (id: string) => {
                            if (confirm('Delete Poll?')) {
                                await supabase.from('polls').delete().eq('id', id);
                                refreshData();
                            }
                        }} />
                    )}
                </div>
            </div>
        );
    };

    const InternalPollsView = ({ polls, onAdd, onDelete }: any) => (
        <div className="h-full flex flex-col">
            <div className="flex justify-end mb-6">
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Create Poll
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pb-20">
                {polls.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-400 font-medium">To create a poll, click the button above.</div>
                )}
                {polls.map((poll: any) => (
                    <div key={poll.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-100 dark:border-zinc-800 shadow-sm relative group hover:shadow-md transition-all">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onDelete(poll.id)} className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-xl text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className={`px-3 py-1 text-xs font-bold rounded-lg uppercase ${poll.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {poll.is_active ? 'Active' : 'Closed'}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">{new Date(poll.created_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 pr-8">{poll.question}</h3>
                        <div className="space-y-3">
                            {poll.poll_options?.map((opt: any) => (
                                <div key={opt.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{opt.option_text}</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{opt.vote_count} votes</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const AddPollModal = ({ onClose }: any) => {
        const [question, setQuestion] = useState('');
        const [options, setOptions] = useState(['', '']);

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            const cleanOptions = options.filter(o => o.trim() !== '');
            if (cleanOptions.length < 2) return alert("Please provide at least 2 options.");

            if (!user || !currentCompanyId) return;

            // 1. Create Poll
            const { data: poll, error } = await supabase.from('polls').insert([{
                company_id: currentCompanyId,
                question,
                created_by: user.id
            }]).select().single();

            if (error) { alert("Error: " + error.message); return; }

            // 2. Create Options
            const optionInserts = cleanOptions.map(opt => ({
                poll_id: poll.id,
                option_text: opt
            }));

            await supabase.from('poll_options').insert(optionInserts);

            onClose();
            refreshData();
        };

        return (
            <Modal title="Create New Poll" onClose={onClose}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Question</label>
                        <input required value={question} onChange={e => setQuestion(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl outline-none" placeholder="e.g. Where should we go?" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Options</label>
                        <div className="space-y-2">
                            {options.map((opt, idx) => (
                                <input
                                    key={idx}
                                    value={opt}
                                    onChange={e => {
                                        const newOpts = [...options];
                                        newOpts[idx] = e.target.value;
                                        setOptions(newOpts);
                                    }}
                                    placeholder={`Option ${idx + 1}`}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl outline-none border border-slate-200 dark:border-zinc-700"
                                />
                            ))}
                        </div>
                        <button type="button" onClick={() => setOptions([...options, ''])} className="mt-2 text-sm font-bold text-blue-600">+ Add Option</button>
                    </div>
                    <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold">Launch Poll</button>
                </form>
            </Modal>
        );
    }

    // --- Handlers for Master Data Action ---
    const handleDelete = async (id: string | number) => {
        if (confirm('Are you sure you want to delete this item?')) {
            const { error } = await (supabase as any).from(currentMasterConfig!.tableName).delete().eq('id', id);
            if (error) alert(error.message);
            else refreshData();
        }
    };

    const handleDeleteMasterItem = async (config: MasterTableConfig, item: any) => {
        if (confirm('Delete this item?')) {
            const { error } = await (supabase as any).from(config.tableName).delete().eq('id', item.id);
            if (error) {
                alert('Error deleting: ' + error.message);
            } else {
                refreshData();
            }
        }
    };




    return (
        <div className="flex h-full relative z-10 overflow-hidden">
            {/* Organisation Sidebar */}
            <div className="w-20 md:w-64 flex-shrink-0 bg-white/40 dark:bg-zinc-900/40 border-r border-slate-200/50 dark:border-zinc-800 flex flex-col justify-between pt-8 pb-4 px-4 backdrop-blur-xl">
                <div className="flex flex-col gap-3">
                    <div className="mb-8 px-2 hidden md:block">
                        <div className="flex items-center gap-2 mb-1">
                            <img src={KAA_LOGO_URL} alt="Logo" className="h-8 w-auto object-contain brightness-100 dark:brightness-[1.15]" />
                            <span className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">ORG</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">Administration</span>
                    </div>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex items-center justify-between p-3.5 rounded-2xl transition-all active:scale-95 duration-200 ${activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-zinc-800/60 hover:text-slate-800 dark:hover:text-slate-200 hover:shadow-sm'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className="w-5 h-5" strokeWidth={activeTab === item.id ? 2.5 : 2} />
                                <span className="hidden md:inline font-bold text-sm tracking-tight">{item.label}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'STRUCTURE' && (
                    <StructureView />
                )}
                {activeTab === 'PROFILE' && (
                    <CompanyProfileView />
                )}
                {activeTab === 'MASTERS' && (
                    <GenericMastersView
                        activeTab={activeMasterTab}
                        setActiveTab={setActiveMasterTab}
                        search={localSearch}
                        setSearch={setLocalSearch}
                        config={MASTER_CONFIG[activeMasterTab]}
                        data={(() => {
                            switch (activeMasterTab) {
                                case 'DEPARTMENTS': return departments;
                                case 'LOCATIONS': return locations;
                                case 'DESIGNATIONS': return designations;
                                case 'GRADES': return grades;
                                case 'EMPLOYMENT_TYPES': return employmentTypes;
                                case 'LEAVE_TYPES': return leaveTypes;
                                case 'SALARY_COMPONENTS': return salaryComponents;
                                case 'SHIFT_TIMINGS': return shiftTimings;
                                case 'FAITHS': return faiths;
                                case 'MARITAL_STATUS': return maritalStatus;
                                case 'BLOOD_GROUPS': return bloodGroups;
                                case 'NATIONALITIES': return nationalities;
                                case 'FINANCIAL_YEARS': return financialYears;
                                case 'PAYROLL_MONTHS': return payrollMonths;
                                case 'LEAVE_CALENDAR': return leaveCalendarYears;
                                case 'ANNOUNCEMENTS': return announcements;
                                case 'POLLS': return polls;
                                case 'SURVEYS': return surveys;
                                case 'KUDOS_CATEGORIES': return kudosCategories;
                                case 'CRM_STAGES': return crmStages;
                                default: return [];
                            }
                        })()}
                        onAdd={() => {
                            let config = { ...MASTER_CONFIG[activeMasterTab] };
                            // Dynamically populate options for Payroll Months
                            if (activeMasterTab === 'PAYROLL_MONTHS') {
                                config = {
                                    ...config,
                                    fields: config.fields.map(f =>
                                        f.key === 'financial_year_id'
                                            ? { ...f, options: financialYears.map(fy => ({ label: fy.code, value: fy.id })) }
                                            : f
                                    )
                                };
                            }
                            setCurrentMasterConfig(config);
                            setEditingMasterItem(null);

                            // Special handling for Polls using dedicated modal (optional, but requested to order properly)
                            if (activeMasterTab === 'POLLS') {
                                setShowAddPoll(true);
                                return;
                            }

                            setShowMasterModal(true);
                        }}
                        onEdit={(item: any) => {
                            let config = { ...MASTER_CONFIG[activeMasterTab] };
                            // Dynamically populate options for Payroll Months
                            if (activeMasterTab === 'PAYROLL_MONTHS') {
                                config = {
                                    ...config,
                                    fields: config.fields.map(f =>
                                        f.key === 'financial_year_id'
                                            ? { ...f, options: financialYears.map(fy => ({ label: fy.code, value: fy.id })) }
                                            : f
                                    )
                                };
                            }
                            setCurrentMasterConfig(config);
                            setEditingMasterItem(item);
                            setShowMasterModal(true);
                        }}
                        onDelete={(item: any) => handleDeleteMasterItem(MASTER_CONFIG[activeMasterTab], item)}
                    />
                )}
                {activeTab === 'ROLES' && (
                    <GenericRolesView
                        filteredRoles={filteredRoles}
                        users={users}
                        setShowAddRole={setShowAddRole}
                        setEditingRole={setEditingRole}
                        onDeleteRole={handleDeleteRole}
                        localSearch={localSearch}
                        setLocalSearch={setLocalSearch}
                    />
                )}
                {activeTab === 'USERS' && (
                    <GenericUsersView
                        filteredUsers={filteredUsers}
                        roles={roles}
                        setShowAddUser={() => { setEditingUser(null); setShowAddUser(true); }}
                        localSearch={localSearch}
                        setLocalSearch={setLocalSearch}
                        onEditUser={(user: AppUser) => {
                            setEditingUser(user);
                            setShowAddUser(true);
                        }}
                        onResetPassword={async (user: AppUser) => {
                            if (!confirm(`Reset password for "${user.name}" (${user.email}) to default (654321)?`)) return;
                            try {
                                const { data: { session } } = await supabase.auth.getSession();
                                const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${session?.access_token}`,
                                    },
                                    body: JSON.stringify({ user_id: user.id }),
                                });
                                const result = await res.json();
                                if (res.ok) {
                                    alert(`Password for ${user.name} has been reset to 654321.`);
                                } else {
                                    alert(`Error: ${result.error || 'Failed to reset password'}`);
                                }
                            } catch (err: any) {
                                alert(`Error: ${err.message}`);
                            }
                        }}
                        onDeleteUser={handleDeleteUser}
                    />
                )}
                {activeTab === 'WORKFLOWS' && (
                    <GenericWorkflowsView
                        showWorkflowList={showWorkflowList}
                        setShowWorkflowList={setShowWorkflowList}
                        editingWorkflow={editingWorkflow}
                        setEditingWorkflow={setEditingWorkflow}
                        workflowLevels={workflowLevels}
                        setWorkflowLevels={setWorkflowLevels}
                        workflows={workflows}
                        roles={roles}
                        users={users}
                        handleSaveWorkflow={handleSaveWorkflow}
                        fetchWorkflowLevels={fetchWorkflowLevels}
                        onDeleteWorkflow={handleDeleteWorkflow}
                    />
                )}
                {activeTab === 'NOTIFICATIONS' && (
                    <GenericNotificationSettingsView
                        notificationSettings={notificationSettings}
                        setEditingNotification={setEditingNotification}
                        setSelectedNotificationRoles={setSelectedNotificationRoles}
                        setShowAddNotification={setShowAddNotification}
                    />
                )}

                {activeTab === 'REMINDERS' && (
                    <GenericRemindersView
                        showReminderList={showReminderList}
                        setShowReminderList={setShowReminderList}
                        editingReminder={editingReminder}
                        setEditingReminder={setEditingReminder}
                        departments={departments}
                        reminders={reminders}
                        handleSaveReminder={handleSaveReminder}
                    />
                )}
                {activeTab === 'SETTINGS' && (
                    <PayrollSettingsView />
                )}
                {activeTab === 'AI_SETTINGS' && (
                    <AISettingsView />
                )}
                {activeTab === 'ACCOUNTING' && (
                    <div className="p-8 h-full overflow-y-auto animate-page-enter">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Accounting Setup</h2>
                                <p className="text-slate-500 dark:text-slate-400 mt-2">Manage fiscal years, taxes, and journals.</p>
                            </div>
                        </div>

                        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-zinc-800 shadow-sm overflow-hidden">
                            <div className="border-b border-slate-200 dark:border-zinc-800">
                                <div className="flex overflow-x-auto">
                                    {['FISCAL', 'TAXES', 'JOURNALS'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveMasterTab(tab)}
                                            className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeMasterTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                        >
                                            {tab === 'FISCAL' ? 'Fiscal Years' : tab === 'TAXES' ? 'Taxes' : 'Journals'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="p-6">
                                {activeMasterTab === 'FISCAL' && <FiscalYears />}
                                {activeMasterTab === 'TAXES' && <TaxMasters />}
                                {activeMasterTab === 'JOURNALS' && <JournalMasters />}
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'ADD_COMPANY' && (
                    <div className="p-8 h-full overflow-y-auto animate-page-enter">
                        <div className="mb-8">
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Add New Company</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">Create a new company under your account. You can switch between companies from the Company Selector.</p>
                        </div>
                        <div className="max-w-lg">
                            <form onSubmit={handleAddCompany} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Company Name *</label>
                                    <input
                                        type="text" required
                                        value={newCompanyName}
                                        onChange={e => setNewCompanyName(e.target.value)}
                                        placeholder="e.g. Kaa Technologies"
                                        className="w-full p-4 bg-white/50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Company Code</label>
                                    <input
                                        type="text"
                                        value={newCompanyCode}
                                        onChange={e => setNewCompanyCode(e.target.value.toUpperCase())}
                                        placeholder="Auto-generated if blank (e.g. KAATECH)"
                                        maxLength={8}
                                        className="w-full p-4 bg-white/50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono uppercase"
                                    />
                                </div>
                                {addCompanyMsg && (
                                    <div className={`p-4 rounded-2xl text-sm font-semibold ${addCompanyMsg.startsWith('✅') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                                        {addCompanyMsg}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={addCompanyLoading || !newCompanyName.trim()}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {addCompanyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                    {addCompanyLoading ? 'Creating...' : 'Create Company'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showAddRole && <GenericAddRoleModal setShowAddRole={setShowAddRole} handleAddRole={handleAddRole} />}
            {showAddUser && <GenericUserModal
                setShowAddUser={setShowAddUser}
                handleSaveUser={handleSaveUser} roles={roles} editingUser={editingUser} allEmployees={allEmployees} />}
            {showAddWorkflow && <GenericAddWorkflowModal setShowAddWorkflow={setShowAddWorkflow} handleAddWorkflow={handleAddWorkflow} />}
            {showAddNotification && (
                <GenericAddNotificationRuleModal
                    editingNotification={editingNotification}
                    setShowAddNotification={setShowAddNotification}
                    setEditingNotification={setEditingNotification}
                    handleAddNotificationRule={handleAddNotificationRule}
                    roles={roles}
                    selectedNotificationRoles={selectedNotificationRoles}
                    setSelectedNotificationRoles={setSelectedNotificationRoles}
                />
            )}
            {showAddPoll && <AddPollModal onClose={() => setShowAddPoll(false)} />}
            {showMasterModal && currentMasterConfig && (
                <GenericMasterModal
                    config={currentMasterConfig}
                    item={editingMasterItem}
                    onClose={() => {
                        setShowMasterModal(false);
                        setEditingMasterItem(null);
                    }}
                    onRefresh={refreshData}
                />
            )}
        </div>
    );
};

// Helper for Actions
const MasterActions = ({ onDelete, onEdit }: { onDelete: () => void, onEdit?: () => void }) => (
    <div className="flex items-center justify-center gap-2">
        {onEdit && (
            <button onClick={onEdit} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                <Edit3 className="w-4 h-4" />
            </button>
        )}
        <button onClick={() => {
            if (confirm('Are you sure you want to delete this item? This cannot be undone.')) {
                onDelete();
            }
        }} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
            <Trash2 className="w-4 h-4" />
        </button>
    </div>
);
