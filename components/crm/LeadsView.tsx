import React, { useState, useEffect } from 'react';
import { Plus, Mail, Phone, ChevronDown, Users, Loader2, ArrowRight, CheckCircle2, Lock, Shield } from 'lucide-react';
import { Lead, CRMViewMode } from './types';
import { getLeads, createLead, updateLead, convertLeadToOpportunity, getStages, checkIsAdmin, getSalesReps } from './services';
import { useAuth } from '../../contexts/AuthContext';

interface LeadsViewProps {
    companyId: string;
    onConvert?: (tab: CRMViewMode) => void;
}

export default function LeadsView({ companyId, onConvert }: LeadsViewProps) {
    const { user, userRole } = useAuth();
    const isAdmin = checkIsAdmin(userRole);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [salesReps, setSalesReps] = useState<{ id: string; name: string; profileId?: string }[]>([]);
    const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('ALL');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [converting, setConverting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeLead, setActiveLead] = useState<Partial<Lead>>({});

    useEffect(() => {
        if (isAdmin && companyId) {
            getSalesReps(companyId).then(setSalesReps);
        }
    }, [isAdmin, companyId]);

    useEffect(() => {
        loadLeads();
    }, [user?.id, userRole, selectedOwnerFilter, companyId]);

    const loadLeads = async (silent = false) => {
        if (!silent && leads.length === 0) setLoading(true);
        try {
            const data = await getLeads(user?.id, userRole, selectedOwnerFilter, companyId);
            setLeads(data);
        } catch (err) {
            console.error('Failed to load leads:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const firstName = (activeLead.first_name || '').trim();
        const lastName = (activeLead.last_name || '').trim();
        const orgName = (activeLead.organization_name || '').trim();

        if (!orgName) {
            alert("Organization Name is required.");
            return;
        }
        if (!firstName && !lastName) {
            alert("Contact Name (First Name or Last Name) is required.");
            return;
        }

        const effectiveFirstName = firstName || lastName || orgName;
        const effectiveLastName = lastName;
        const effectiveCompanyId = companyId || (user as any)?.company_id;

        setSaving(true);
        try {
            let result: Lead | null = null;
            if (activeLead.id) {
                result = await updateLead(activeLead.id, {
                    ...activeLead,
                    first_name: effectiveFirstName,
                    last_name: effectiveLastName,
                    organization_name: orgName,
                    lead_owner_id: activeLead.lead_owner_id || null
                });
            } else {
                result = await createLead({
                    ...activeLead,
                    first_name: effectiveFirstName,
                    last_name: effectiveLastName,
                    organization_name: orgName,
                    status: activeLead.status || 'New',
                    lead_owner_id: activeLead.lead_owner_id || user?.id,
                    created_by: user?.id,
                    company_id: effectiveCompanyId
                });
            }

            if (!result) {
                alert("Failed to save lead. Please check the details and try again.");
                setSaving(false);
                return;
            }

            setShowModal(false);
            await loadLeads(true);
        } catch (err: any) {
            console.error('Error saving lead:', err);
            alert("Error saving lead: " + (err?.message || "Please try again."));
        } finally {
            setSaving(false);
        }
    };

    const handleConvertToOpportunity = async () => {
        if (!activeLead.id) return;
        setConverting(true);
        try {
            const stages = await getStages();
            if (stages.length === 0) {
                alert("No pipeline stages configured. Please add stages in Organisation settings first.");
                setConverting(false);
                return;
            }
            const result = await convertLeadToOpportunity(
                activeLead as Lead,
                companyId,
                stages[0].id,
                user?.id
            );
            if (result) {
                setShowModal(false);
                await loadLeads(true);
                onConvert?.('OPPORTUNITIES');
            } else {
                alert("Conversion failed. Please try again.");
            }
        } catch (err) {
            console.error('Conversion error:', err);
            alert("An error occurred during conversion.");
        }
        setConverting(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'New': return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800';
            case 'Contacted': return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800';
            case 'Qualified': return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800';
            case 'Converted': return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800';
            case 'Disqualified': return 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-800';
            default: return 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-zinc-800 dark:border-zinc-700';
        }
    };

    return (
        <div className="h-full flex flex-col p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Leads</h2>
                        {!isAdmin && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full">
                                <Lock size={11} /> Private View
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {isAdmin ? 'Manage all corporate leads across sales representatives' : 'Manage your assigned and created prospective customers'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Admin Sales Rep Filter */}
                    {isAdmin && (
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700">
                            <Shield size={14} className="text-indigo-600 dark:text-indigo-400" />
                            <span className="text-xs font-bold text-slate-500">Rep:</span>
                            <select
                                value={selectedOwnerFilter}
                                onChange={(e) => setSelectedOwnerFilter(e.target.value)}
                                className="text-xs font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                            >
                                <option value="ALL">All Sales Reps</option>
                                <option value={user?.id}>My Leads Only</option>
                                {salesReps.map(rep => (
                                    <option key={rep.id} value={rep.profileId || rep.id}>{rep.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={() => { setActiveLead({}); setShowModal(true); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 text-sm font-medium"
                    >
                        <Plus size={18} />
                        <span>New Lead</span>
                    </button>
                </div>
            </div>

            {/* Pipeline Flow Indicator */}
            <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-900/10 dark:to-emerald-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg">Lead</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-400">Opportunity</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-400">Customer</span>
            </div>

            {/* List */}
            <div className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-auto shadow-sm">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    </div>
                ) : leads.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                        <Users className="w-12 h-12 mb-3 opacity-30" />
                        <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300">No leads yet</h3>
                        <p className="text-sm mt-1">Create your first lead to get started</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
                                <th className="px-6 py-3.5">Name</th>
                                <th className="px-6 py-3.5">Status</th>
                                <th className="px-6 py-3.5">Company</th>
                                <th className="px-6 py-3.5">Contact</th>
                                <th className="px-6 py-3.5">Owner</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {leads.map((lead) => (
                                <tr key={lead.id} className="group hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => { setActiveLead(lead); setShowModal(true); }}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                                                {(lead.first_name || '?')[0]}{(lead.last_name || '?')[0]}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900 dark:text-white text-sm">{lead.salutation} {lead.first_name} {lead.last_name}</div>
                                                <div className="text-xs text-slate-400">{lead.job_title}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(lead.status)}`}>
                                                {lead.status}
                                            </span>
                                            {lead.is_converted && (
                                                <CheckCircle2 size={14} className="text-emerald-500" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-slate-900 dark:text-white">{lead.organization_name}</div>
                                        <div className="text-xs text-slate-400">{lead.industry}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 text-sm text-slate-500">
                                            {lead.email && <div className="flex items-center gap-1.5"><Mail size={13} className="text-slate-400" /> {lead.email}</div>}
                                            {lead.mobile && <div className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {lead.mobile}</div>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-semibold text-xs">
                                                {(lead.lead_owner?.name || lead.creator?.name || 'U')[0].toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-slate-900 dark:text-white leading-tight">
                                                    {lead.lead_owner?.name || lead.creator?.name || 'Unassigned'}
                                                </span>
                                                {lead.creator?.name && lead.creator?.name !== lead.lead_owner?.name && (
                                                    <span className="text-[10px] text-slate-400">By: {lead.creator.name}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {activeLead.id ? 'Edit Lead' : 'New Lead'}
                            </h3>
                            <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
                        </div>

                        {/* Converted Banner */}
                        {activeLead.is_converted && (
                            <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/30 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-600" />
                                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                    This lead has been converted to an Opportunity
                                </span>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <Section title="Lead Information">
                                <div className="grid grid-cols-3 gap-5">
                                    <Input label="Job Title" value={activeLead.job_title} onChange={v => setActiveLead({ ...activeLead, job_title: v })} />
                                    <Input label="Salutation" value={activeLead.salutation} onChange={v => setActiveLead({ ...activeLead, salutation: v })} />
                                    <Input label="Details" disabled value="Series generated on save" />
                                    <Input label="First Name" required value={activeLead.first_name} onChange={v => setActiveLead({ ...activeLead, first_name: v })} />
                                    <Input label="Middle Name" value={activeLead.middle_name} onChange={v => setActiveLead({ ...activeLead, middle_name: v })} />
                                    <Input label="Last Name" required value={activeLead.last_name} onChange={v => setActiveLead({ ...activeLead, last_name: v })} />
                                    <Select label="Gender" options={['Male', 'Female', 'Other']} value={activeLead.gender} onChange={v => setActiveLead({ ...activeLead, gender: v })} />
                                    <Select label="Lead Type" options={['Hot', 'Warm', 'Cold']} value={activeLead.lead_type} onChange={v => setActiveLead({ ...activeLead, lead_type: v })} />
                                    <Select label="Request Type" options={['Product Info', 'Demo', 'Quote']} value={activeLead.request_type} onChange={v => setActiveLead({ ...activeLead, request_type: v })} />
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500">Lead Owner / Sales Rep</label>
                                        <div className="relative">
                                            <select
                                                value={activeLead.lead_owner_id || ''}
                                                onChange={e => setActiveLead({ ...activeLead, lead_owner_id: e.target.value || null as any })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
                                            >
                                                <option value="">Unassigned</option>
                                                {salesReps.map(rep => (
                                                    <option key={rep.id} value={rep.profileId || rep.id}>{rep.name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                        </div>
                                    </div>
                                    {activeLead.creator?.name && (
                                        <div className="col-span-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500">
                                            <span>Created by: <strong className="font-semibold text-slate-700 dark:text-slate-300">{activeLead.creator.name}</strong></span>
                                            {activeLead.created_at && (
                                                <span>{new Date(activeLead.created_at).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Section>
                            <Section title="Contact Info">
                                <div className="grid grid-cols-3 gap-5">
                                    <Input label="Email" type="email" value={activeLead.email} onChange={v => setActiveLead({ ...activeLead, email: v })} />
                                    <Input label="Mobile" value={activeLead.mobile} onChange={v => setActiveLead({ ...activeLead, mobile: v })} />
                                    <Input label="Phone" value={activeLead.phone} onChange={v => setActiveLead({ ...activeLead, phone: v })} />
                                    <Input label="Phone Ext" value={activeLead.phone_ext} onChange={v => setActiveLead({ ...activeLead, phone_ext: v })} />
                                    <Input label="Website" value={activeLead.website} onChange={v => setActiveLead({ ...activeLead, website: v })} />
                                    <Input label="WhatsApp" value={activeLead.whatsapp} onChange={v => setActiveLead({ ...activeLead, whatsapp: v })} />
                                </div>
                            </Section>
                            <Section title="Organization">
                                <div className="grid grid-cols-3 gap-5">
                                    <Input label="Organization Name" required value={activeLead.organization_name} onChange={v => setActiveLead({ ...activeLead, organization_name: v })} />
                                    <Select label="No. of Employees" options={['1-10', '11-50', '51-200', '201+']} value={activeLead.no_of_employees} onChange={v => setActiveLead({ ...activeLead, no_of_employees: v })} />
                                    <Input label="Annual Revenue" type="number" value={activeLead.annual_revenue?.toString()} onChange={v => setActiveLead({ ...activeLead, annual_revenue: parseFloat(v) })} />
                                    <Input label="Industry" value={activeLead.industry} onChange={v => setActiveLead({ ...activeLead, industry: v })} />
                                    <Input label="Market Segment" value={activeLead.market_segment} onChange={v => setActiveLead({ ...activeLead, market_segment: v })} />
                                    <Input label="Territory" value={activeLead.territory} onChange={v => setActiveLead({ ...activeLead, territory: v })} />
                                </div>
                            </Section>
                            <Section title="Address Details">
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-4">
                                        <Input label="Address Line 1" value={activeLead.address_line_1} onChange={v => setActiveLead({ ...activeLead, address_line_1: v })} />
                                        <Input label="Address Line 2" value={activeLead.address_line_2} onChange={v => setActiveLead({ ...activeLead, address_line_2: v })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="City" value={activeLead.city} onChange={v => setActiveLead({ ...activeLead, city: v })} />
                                        <Input label="State" value={activeLead.state} onChange={v => setActiveLead({ ...activeLead, state: v })} />
                                        <Input label="Country" value={activeLead.country} onChange={v => setActiveLead({ ...activeLead, country: v })} />
                                        <Input label="Zip Code" value={activeLead.zip_code} onChange={v => setActiveLead({ ...activeLead, zip_code: v })} />
                                    </div>
                                </div>
                            </Section>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            {/* Left: Convert Button */}
                            <div>
                                {activeLead.id && !activeLead.is_converted && (
                                    <button
                                        type="button"
                                        onClick={handleConvertToOpportunity}
                                        disabled={converting}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20 text-sm font-medium disabled:opacity-50"
                                    >
                                        {converting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                        Convert to Opportunity
                                    </button>
                                )}
                            </div>
                            {/* Right: Save/Cancel */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 font-medium text-sm disabled:opacity-50"
                                >
                                    {saving && <Loader2 size={16} className="animate-spin" />}
                                    <span>{saving ? 'Saving...' : 'Save Lead'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper Components
const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800 pb-2">{title}</h4>
        {children}
    </div>
);

const Input = ({ label, value, onChange, type = "text", required, disabled }: any) => (
    <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500 flex gap-1">
            {label}
            {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type}
            value={value || ''}
            onChange={e => onChange?.(e.target.value)}
            disabled={disabled}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:opacity-50"
        />
    </div>
);

const Select = ({ label, options, value, onChange }: any) => (
    <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">{label}</label>
        <div className="relative">
            <select
                value={value || ''}
                onChange={e => onChange?.(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"
            >
                <option value="">Select...</option>
                {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
    </div>
);
