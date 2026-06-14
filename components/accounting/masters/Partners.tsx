import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Edit3, Trash2, Phone, Mail, MapPin, FileText } from 'lucide-react';
import { Modal } from '../../ui/Modal';

interface Partner {
    id: string;
    name: string;
    email: string;
    phone: string;
    tax_id: string;
    partner_type: 'Customer' | 'Vendor' | 'Both';
    property_account_receivable_id: string;
    property_account_payable_id: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
    credit_limit: number;
}

interface Account {
    id: string;
    name: string;
    code: string;
    type: string;
}

export const Partners: React.FC<{ type?: 'Customer' | 'Vendor' }> = ({ type }) => {
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

    // Masters
    const [receivableAccounts, setReceivableAccounts] = useState<Account[]>([]);
    const [payableAccounts, setPayableAccounts] = useState<Account[]>([]);

    useEffect(() => {
        fetchPartners();
        fetchAccounts();
    }, [type]);

    const fetchPartners = async () => {
        setLoading(true);
        let query = supabase.from('accounting_partners').select('*').order('name');

        if (type) {
            // If type is specified, filter. Note: 'Both' should show up in both.
            // Logic: if requesting Customer, show Customer OR Both.
            query = query.or(`partner_type.eq.${type},partner_type.eq.Both`);
        }

        const { data, error } = await query;
        if (error) console.error('Error fetching partners:', error);
        else setPartners((data || []) as Partner[]);
        setLoading(false);
    };

    const fetchAccounts = async () => {
        // Fetch Receivable (Asset) and Payable (Liability) accounts
        const { data, error } = await supabase
            .from('chart_of_accounts')
            .select('id, name, code, type')
            .in('type', ['Asset', 'Liability']); // Broad filter, refine in UI if needed

        if (data) {
            setReceivableAccounts(data.filter(a => a.type === 'Asset')); // Ideally filter by subtype 'Receivable' if exists
            setPayableAccounts(data.filter(a => a.type === 'Liability')); // Ideally filter by subtype 'Payable' if exists
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const data = Object.fromEntries(formData.entries());

        // Basic validation
        if (!data.name) return alert('Name is required');

        try {
            if (editingPartner) {
                const { error } = await supabase
                    .from('accounting_partners')
                    .update(data as any)
                    .eq('id', editingPartner.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('accounting_partners')
                    .insert([data as any]);
                if (error) throw error;
            }
            setIsModalOpen(false);
            setEditingPartner(null);
            fetchPartners();
        } catch (error: any) {
            alert('Error saving partner: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? This cannot be undone.')) return;
        const { error } = await supabase.from('accounting_partners').delete().eq('id', id);
        if (error) alert('Error deleting: ' + error.message);
        else fetchPartners();
    };

    const filteredPartners = partners.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search partners..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <button
                    onClick={() => { setEditingPartner(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add {type || 'Partner'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full text-center py-12 text-slate-500">Loading...</div>
                ) : filteredPartners.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-slate-500 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700">
                        No partners found. Create one to get started.
                    </div>
                ) : (
                    filteredPartners.map(partner => (
                        <div key={partner.id} className="group relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 hover:shadow-md transition-all">
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingPartner(partner); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(partner.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                    {partner.name.charAt(0)}
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${partner.partner_type === 'Customer' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        partner.partner_type === 'Vendor' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                    {partner.partner_type}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{partner.name}</h3>
                            {partner.tax_id && (
                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded w-fit">
                                    <FileText className="w-3 h-3" />
                                    <span>{partner.tax_id}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-2 text-xs text-rose-500 font-bold mb-4 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded w-fit">
                                <span className="uppercase tracking-widest text-[10px]">Credit Limit:</span>
                                <span>${Number(partner.credit_limit || 0).toLocaleString()}</span>
                            </div>

                            <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                {partner.email && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <span className="truncate">{partner.email}</span>
                                    </div>
                                )}
                                {partner.phone && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                        <Phone className="w-4 h-4 text-slate-400" />
                                        <span>{partner.phone}</span>
                                    </div>
                                )}
                                {partner.city && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                        <MapPin className="w-4 h-4 text-slate-400" />
                                        <span>{partner.city}, {partner.country}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isModalOpen && (
                <Modal title={editingPartner ? 'Edit Partner' : 'New Partner'} onClose={() => setIsModalOpen(false)}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name *</label>
                                <input name="name" defaultValue={editingPartner?.name} required className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                                <select name="partner_type" defaultValue={editingPartner?.partner_type || type || 'Customer'} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm">
                                    <option value="Customer">Customer</option>
                                    <option value="Vendor">Vendor</option>
                                    <option value="Both">Both</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                                <input name="email" type="email" defaultValue={editingPartner?.email} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                                <input name="phone" defaultValue={editingPartner?.phone} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tax ID / VAT</label>
                            <input name="tax_id" defaultValue={editingPartner?.tax_id} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" placeholder="e.g. GSTIN, VAT Number" />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Credit Limit ($)</label>
                            <input name="credit_limit" type="number" step="0.01" defaultValue={editingPartner?.credit_limit || 0} className="w-full p-2.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/50 rounded-lg text-sm font-bold text-rose-600" placeholder="0.00" />
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Address</h4>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input name="street" defaultValue={editingPartner?.street} placeholder="Street" className="col-span-2 w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                                <input name="city" defaultValue={editingPartner?.city} placeholder="City" className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                                <input name="state" defaultValue={editingPartner?.state} placeholder="State" className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                                <input name="postal_code" defaultValue={editingPartner?.postal_code} placeholder="Postal Code" className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                                <input name="country" defaultValue={editingPartner?.country} placeholder="Country" className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Accounting</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Receivable Account</label>
                                    <select name="property_account_receivable_id" defaultValue={editingPartner?.property_account_receivable_id} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm">
                                        <option value="">Select Account</option>
                                        {receivableAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payable Account</label>
                                    <select name="property_account_payable_id" defaultValue={editingPartner?.property_account_payable_id} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm">
                                        <option value="">Select Account</option>
                                        {payableAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors">
                            Save Partner
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
