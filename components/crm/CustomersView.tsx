import React, { useState, useEffect } from 'react';
import { Plus, Mail, Phone, Building, ChevronDown, Loader2, Users, ArrowRight, Link2, Lock, Shield, Search, X } from 'lucide-react';
import { Customer } from './types';
import { getCustomers, createCustomer, updateCustomer, checkIsAdmin, getSalesReps } from './services';
import { useAuth } from '../../contexts/AuthContext';
import { AttachmentPanel } from './AttachmentPanel';

export default function CustomersView({ companyId }: { companyId: string }) {
    const { user, userRole } = useAuth();
    const isAdmin = checkIsAdmin(userRole);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [salesReps, setSalesReps] = useState<{ id: string; name: string; profileId?: string }[]>([]);
    const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeCustomer, setActiveCustomer] = useState<Partial<Customer>>({});

    useEffect(() => {
        if (isAdmin && companyId) {
            getSalesReps(companyId).then(setSalesReps);
        }
    }, [isAdmin, companyId]);

    useEffect(() => {
        loadCustomers();
    }, [user, userRole, selectedOwnerFilter, companyId]);

    const loadCustomers = async () => {
        setLoading(true);
        const data = await getCustomers(user?.id, userRole, selectedOwnerFilter, companyId);
        setCustomers(data);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!activeCustomer.name?.trim()) {
            alert("Customer Name is required.");
            return;
        }

        setSaving(true);
        try {
            if (activeCustomer.id) {
                await updateCustomer(activeCustomer.id, {
                    ...activeCustomer,
                    name: activeCustomer.name.trim()
                });
            } else {
                await createCustomer({
                    ...activeCustomer,
                    name: activeCustomer.name.trim(),
                    status: activeCustomer.status || 'Active',
                    owner_id: user?.id,
                    created_by: user?.id,
                    company_id: companyId
                });
            }
            setShowModal(false);
            loadCustomers();
        } catch (err: any) {
            console.error('Error saving customer:', err);
            alert("Failed to save customer: " + (err.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const filteredCustomers = customers.filter(customer => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            (customer.name || '').toLowerCase().includes(q) ||
            (customer.primary_email || '').toLowerCase().includes(q) ||
            (customer.primary_phone || '').toLowerCase().includes(q) ||
            (customer.industry || '').toLowerCase().includes(q) ||
            (customer.customer_type || '').toLowerCase().includes(q) ||
            (customer.billing_city || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="h-full flex flex-col p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">CRM Customers</h2>
                        {!isAdmin && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full">
                                <Lock size={11} /> Private View
                            </span>
                        )}
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded-full">
                            {customers.length} total
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {isAdmin ? 'Manage corporate client database across all sales representatives' : 'Manage your client base and customer accounts (independent of accounting)'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Search Bar */}
                    <div className="relative min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search customers..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-7 py-2 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

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
                                <option value={user?.id}>My Customers Only</option>
                                {salesReps.map(rep => (
                                    <option key={rep.id} value={rep.profileId || rep.id}>{rep.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={() => { setActiveCustomer({ customer_type: 'Company', status: 'Active' }); setShowModal(true); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 text-sm font-medium"
                    >
                        <Plus size={18} />
                        <span>New Customer</span>
                    </button>
                </div>
            </div>

            {/* Pipeline Flow Indicator */}
            <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-900/10 dark:to-emerald-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
                <span className="text-xs font-medium text-slate-400">Lead</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-400">Opportunity</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg">Customer</span>
            </div>

            {/* List */}
            <div className="flex-1 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-2xl border border-slate-100 dark:border-zinc-800 p-5 overflow-auto shadow-sm">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    </div>
                ) : customers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                        <Users className="w-12 h-12 mb-3 opacity-30" />
                        <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300">No CRM customers yet</h3>
                        <p className="text-sm mt-1 mb-4">Create your first CRM customer to start logging opportunities and deals</p>
                        <button
                            onClick={() => { setActiveCustomer({ customer_type: 'Company', status: 'Active' }); setShowModal(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
                        >
                            <Plus size={16} />
                            <span>Add First Customer</span>
                        </button>
                    </div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                        <Search className="w-10 h-10 mb-2 opacity-30" />
                        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">No matching customers</h3>
                        <p className="text-xs text-slate-400 mt-1">No customers match "{searchQuery}"</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredCustomers.map(customer => (
                            <div key={customer.id} onClick={() => { setActiveCustomer(customer); setShowModal(true); }} className="group bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-base">
                                        {(customer.name || '?')[0]}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium ${customer.status === 'Active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400'}`}>
                                        {customer.status}
                                    </span>
                                </div>
                                <h3 className="font-semibold text-slate-900 dark:text-white text-base mb-1">{customer.name}</h3>
                                <p className="text-slate-500 text-xs mb-2 flex items-center gap-1.5">
                                    <Building size={12} /> {customer.industry || 'No Industry'} • {customer.customer_type}
                                </p>
                                {customer.lifecycle_stage === 'Converted from Opportunity' && (
                                    <div className="flex items-center gap-1 text-[10px] text-purple-500 mb-2">
                                        <Link2 size={10} />
                                        <span>Converted from Opportunity</span>
                                    </div>
                                )}

                                <div className="space-y-1.5 pt-3 border-t border-slate-50 dark:border-zinc-800">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Mail size={13} className="text-indigo-500" />
                                        {customer.primary_email || 'No Email'}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Phone size={13} className="text-indigo-500" />
                                        {customer.primary_phone || 'No Phone'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {activeCustomer.id ? 'Edit CRM Customer' : 'New CRM Customer'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Independent CRM Customer account (not linked to accounting chart of accounts or partner ledgers).
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <Section title="Customer Details">
                                <div className="grid grid-cols-2 gap-5">
                                    <Input label="Customer Name" required value={activeCustomer.name} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, name: v })} />
                                    <Select label="Customer Type" options={['Company', 'Individual']} value={activeCustomer.customer_type} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, customer_type: v })} />
                                    <Input label="Tax ID" value={activeCustomer.tax_id} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, tax_id: v })} />
                                    <Input label="Website" value={activeCustomer.website} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, website: v })} />
                                    <Input label="Industry" value={activeCustomer.industry} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, industry: v })} />
                                </div>
                            </Section>

                            <Section title="Primary Contact Details">
                                <div className="grid grid-cols-2 gap-5">
                                    <Input label="Email ID" type="email" value={activeCustomer.primary_email} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, primary_email: v })} />
                                    <Input label="Mobile Number" value={activeCustomer.primary_phone} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, primary_phone: v })} />
                                </div>
                            </Section>

                            <Section title="Primary Address Details">
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="col-span-2 space-y-4">
                                        <Input label="Address Line 1" value={activeCustomer.billing_address_line_1} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, billing_address_line_1: v })} />
                                        <Input label="Address Line 2" value={activeCustomer.billing_address_line_2} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, billing_address_line_2: v })} />
                                    </div>
                                    <Input label="City" value={activeCustomer.billing_city} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, billing_city: v })} />
                                    <Input label="State" value={activeCustomer.billing_state} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, billing_state: v })} />
                                    <Input label="Country" value={activeCustomer.billing_country} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, billing_country: v })} />
                                    <Input label="ZIP Code" value={activeCustomer.billing_zip_code} onChange={(v: string) => setActiveCustomer({ ...activeCustomer, billing_zip_code: v })} />
                                </div>
                            </Section>

                            {activeCustomer.id && (
                                <Section title="Customer Documents & Attachments">
                                    <AttachmentPanel
                                        companyId={companyId}
                                        module="customer"
                                        recordId={activeCustomer.id}
                                        userId={user?.id}
                                    />
                                </Section>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-zinc-800/50">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors font-medium text-sm">Cancel</button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 font-medium text-sm disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                                <span>Save Customer</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Reusable Components
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
