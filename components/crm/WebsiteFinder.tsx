import React, { useState, useEffect } from 'react';
import { Sparkles, Globe, Play, Plus, Clock, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Download, Users, Building2, ExternalLink } from 'lucide-react';
import { WebsiteFinderJob, WebsiteFinderResult } from '../../types';
import { WebsiteFinderService } from './WebsiteFinderLogic';
import { supabase } from '../../lib/supabase';
import { createContact, createDeal } from './services';

const COUNTRIES = ['UAE', 'KSA', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'];

export const WebsiteFinderView: React.FC<{ companyId: string | null }> = ({ companyId }) => {
    const [view, setView] = useState<'LIST' | 'NEW' | 'DETAILS'>('LIST');
    const [jobs, setJobs] = useState<WebsiteFinderJob[]>([]);
    const [selectedJob, setSelectedJob] = useState<WebsiteFinderJob | null>(null);
    const [results, setResults] = useState<WebsiteFinderResult[]>([]);
    const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

    // New Job State
    const [inputList, setInputList] = useState('');
    const [selectedCountries, setSelectedCountries] = useState<string[]>(['UAE', 'KSA']);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchJobs();
        return () => {
            if (timer) clearInterval(timer);
        };
    }, []);

    // Poll for updates if viewing a running job
    useEffect(() => {
        if (selectedJob && selectedJob.status === 'RUNNING') {
            const interval = setInterval(refreshSelectedJob, 3000);
            return () => clearInterval(interval);
        }
    }, [selectedJob]);

    const fetchJobs = async () => {
        const { data } = await WebsiteFinderService.getJobs();
        if (data) setJobs(data as WebsiteFinderJob[]);
    };

    const refreshSelectedJob = async () => {
        if (!selectedJob) return;
        const { data: job } = await supabase.from('crm_website_finder_jobs').select('*').eq('id', selectedJob.id).single();
        if (job) {
            const { data: res } = await supabase.from('crm_website_finder_results').select('*').eq('job_id', job.id);
            setSelectedJob(job as WebsiteFinderJob);
            if (res) setResults(res as WebsiteFinderResult[]);
        }
    };

    // --- API Key Management ---
    const [showSettings, setShowSettings] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [savingKey, setSavingKey] = useState(false);

    const handleSaveKey = async () => {
        setSavingKey(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Simple Upsert logic
        if (!companyId) {
            alert("System Error: Missing Company ID");
            return;
        }

        const { error } = await supabase.from('org_ai_settings').upsert({
            company_id: companyId,
            provider: 'GEMINI',
            api_key_encrypted: apiKey, // In real app, encrypt this or use vault
            model: 'gemini-pro',
            status: 'ACTIVE',
            updated_at: new Date().toISOString()
        }, { onConflict: 'company_id' });

        if (error) {
            alert("Failed to save Key");
            console.error(error);
        } else {
            alert("API Key Saved!");
            setShowSettings(false);
        }
        setSavingKey(false);
    };

    const handleCreateJob = async () => {
        if (!inputList.trim()) return alert("Please enter at least one company name");
        setCreating(true);
        const companies = inputList.split('\n').filter(c => c.trim()).map(c => ({ name: c.trim() }));

        const { data: { user } } = await supabase.auth.getUser();
        if (user && companyId) {
            const job = await WebsiteFinderService.createJob(companyId, user.id, companies, selectedCountries);
            if (job) {
                await WebsiteFinderService.startJob(job.id);
                setJobs([job, ...jobs]);
                handleViewJob(job);
            } else {
                alert("Failed to create job");
            }
        }
        setCreating(false);
    };

    const handleViewJob = async (job: WebsiteFinderJob) => {
        setSelectedJob(job);
        const { data: res } = await supabase.from('crm_website_finder_results').select('*').eq('job_id', job.id);
        if (res) setResults(res as WebsiteFinderResult[]);
        setView('DETAILS');
    };

    const handleExport = () => {
        // Simple CSV export
        if (!results.length) return;
        const headers = ['Company', 'Website', 'Status', ...selectedCountries.map(c => `Branch in ${c}`)];
        const rows = results.map(r => [
            r.company_name,
            r.website_url || '',
            r.status,
            ...selectedCountries.map(c => r.branch_presence ? (r.branch_presence[c] ? 'Yes' : 'No') : '-')
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `finder_results_${selectedJob?.id}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    const handlePushToCRM = async (result: WebsiteFinderResult, type: 'LEAD' | 'CONTACT') => {
        if (!result.company_name) return;

        try {
            if (!companyId) return alert("Missing Company ID");

            // Basic push logic - calling existing services
            if (type === 'CONTACT') {
                await createContact({
                    company_id: companyId, // [NEW] Added
                    name: result.company_name + " (Lead)",
                    organization: result.company_name,
                    role: 'Unknown',
                    status: 'Lead',
                    // Add custom fields if services support it (website, etc)
                });
                alert("Contact created!");
            } else {
                // Push to Deal/Pipeline
                await createDeal({
                    company_id: companyId, // [NEW] Added
                    title: `${result.company_name} Opportunity`,
                    company: result.company_name,
                    value: 0,
                    stage_id: 1 // Default to first stage
                });
                alert("Deal created!");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to push to CRM");
        }
    };

    if (view === 'NEW') {
        return (
            <div className="p-8 h-full flex flex-col animate-page-enter">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => setView('LIST')} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight className="w-6 h-6 rotate-180" /></button>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">New Finder Job</h1>
                </div>

                <div className="max-w-4xl bg-white/70 backdrop-blur-xl p-8 rounded-[2rem] shadow-xl border border-white/60">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="font-bold text-slate-700 block mb-2">Company List (One per line)</label>
                            <textarea
                                className="w-full h-96 p-4 rounded-xl border border-slate-200 bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 ring-indigo-500/20 outline-none resize-none font-mono text-sm text-slate-900 dark:text-white"
                                placeholder="Acme Corp\nGlobex Inc\nSoylent Corp"
                                value={inputList}
                                onChange={e => setInputList(e.target.value)}
                            />
                        </div>
                        <div className="space-y-8">
                            <div>
                                <label className="font-bold text-slate-700 block mb-4">Check Branch Presence</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {COUNTRIES.map(c => (
                                        <label key={c} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedCountries.includes(c) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={selectedCountries.includes(c)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedCountries([...selectedCountries, c]);
                                                    else setSelectedCountries(selectedCountries.filter(x => x !== c));
                                                }}
                                            />
                                            <span className="font-bold text-sm">{c}</span>
                                            {selectedCountries.includes(c) && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-5 h-5 text-indigo-600" />
                                    <span className="font-bold text-indigo-900">AI Estimation</span>
                                </div>
                                <p className="text-sm text-indigo-800">
                                    You are about to process <strong>{inputList.split('\n').filter(x => x.trim()).length}</strong> companies.
                                    This will consume approximately <strong>{inputList.split('\n').filter(x => x.trim()).length * 0.05}</strong> credits.
                                </p>
                            </div>

                            <button
                                disabled={creating}
                                onClick={handleCreateJob}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                {creating ? 'Creating Job...' : <><Play className="w-5 h-5" /> Start Processing</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'DETAILS' && selectedJob) {
        return (
            <div className="p-8 h-full flex flex-col animate-page-enter">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('LIST')} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight className="w-6 h-6 rotate-180" /></button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                Job #{selectedJob.id.slice(0, 8)}
                                <span className={`text-xs px-2 py-1 rounded-lg uppercase ${selectedJob.status === 'RUNNING' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>{selectedJob.status}</span>
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">{new Date(selectedJob.created_at).toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleExport} className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-50">
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Progress */}
                <div className="mb-8 bg-white/50 p-6 rounded-[1.5rem] border border-slate-200">
                    <div className="flex justify-between text-sm font-bold text-slate-500 mb-2">
                        <span>Progress</span>
                        <span>{Math.round((selectedJob.processed_records / selectedJob.total_records) * 100)}% ({selectedJob.processed_records}/{selectedJob.total_records})</span>
                    </div>
                    <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${(selectedJob.processed_records / selectedJob.total_records) * 100}%` }}
                        ></div>
                    </div>
                </div>

                {/* Results Table */}
                <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/60 overflow-hidden flex flex-col">
                    <div className="overflow-y-auto flex-1 p-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Company</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Website</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {results.map(r => (
                                    <tr key={r.id} className="hover:bg-indigo-50/50 transition-colors">
                                        <td className="p-4 font-bold text-slate-700">{r.company_name}</td>
                                        <td className="p-4">
                                            {r.website_url ? (
                                                <a href={r.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline font-medium text-sm">
                                                    {r.website_url} <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ) : <span className="text-slate-400 text-sm">-</span>}
                                        </td>
                                        <td className="p-4">
                                            {r.status === 'SUCCESS' ? <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Found</span> :
                                                r.status === 'FAILED' ? <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded">Failed</span> :
                                                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">Pending</span>
                                            }
                                        </td>
                                        <td className="p-4 flex gap-2">
                                            <button onClick={() => handlePushToCRM(r, 'CONTACT')} title="Create Contact" className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-indigo-600"><Users className="w-4 h-4" /></button>
                                            <button onClick={() => handlePushToCRM(r, 'LEAD')} title="Create Deal" className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-indigo-600"><Building2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <Globe className="w-8 h-8 text-indigo-600" /> Website Finder
                        <span className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold tracking-wide">AI POWERED</span>
                    </h1>
                    <p className="text-slate-500 mt-2">Enrich your lead lists with website URLs and branch presence data.</p>
                </div>
                <button onClick={() => setView('NEW')} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all active:scale-95">
                    <Plus className="w-5 h-5" /> New Finder Job
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {jobs.map(job => (
                    <div key={job.id} onClick={() => handleViewJob(job)} className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-lg border border-white/60 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${job.status === 'RUNNING' ? 'bg-amber-100 text-amber-600' : job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                {job.status === 'RUNNING' ? <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" /> : <Globe className="w-6 h-6" />}
                            </div>
                            <span className="text-xs font-bold text-slate-400">{new Date(job.created_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-1">Job #{job.id.slice(0, 8)}</h3>
                        <p className="text-sm text-slate-500 font-medium mb-4">{job.total_records} Companies • {job.processed_records} Processed</p>

                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500" style={{ width: `${(job.processed_records / job.total_records) * 100}%` }}></div>
                        </div>
                    </div>
                ))}
                {jobs.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-400 bg-white/30 rounded-[3rem] border-2 border-dashed border-slate-200">
                        <Globe className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <h3 className="text-xl font-bold text-slate-600">No Jobs Found</h3>
                        <p>Create a new finder job to start enriching data.</p>
                    </div>
                )}
            </div>

            {/* API Settings Button (Floating or Header) */}
            <div className="fixed bottom-8 right-8">
                <button onClick={() => setShowSettings(true)} className="p-4 bg-white text-slate-600 rounded-full shadow-lg border border-slate-200 hover:text-indigo-600 transition-colors">
                    <Sparkles className="w-6 h-6" />
                </button>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md animate-fade-in" onClick={() => setShowSettings(false)}>
                    <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up border border-white/60 p-8" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">Configure AI</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gemini API Key</label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                    placeholder="AIza..."
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200"
                                />
                                <p className="text-xs text-slate-400 mt-2">Required for Website Finder functionality.</p>
                            </div>
                            <button
                                onClick={handleSaveKey}
                                disabled={savingKey}
                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all"
                            >
                                {savingKey ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
