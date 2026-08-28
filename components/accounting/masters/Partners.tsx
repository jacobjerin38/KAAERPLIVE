import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { read, utils, write } from 'xlsx';
import { Plus, Search, Edit3, Trash2, Phone, Mail, MapPin, FileText, UploadCloud, Download, Loader2 } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { PrintButton } from '../../ui/PrintButton';


interface Partner {
    id: string;
    name: string;
    reference_code?: string;
    code?: string;
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
    is_group?: boolean;
}

export const Partners: React.FC<{ type?: 'Customer' | 'Vendor' }> = ({ type }) => {
    const { currentCompanyId } = useAuth();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

    // Import state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importing, setImporting] = useState(false);

    // Masters
    const [receivableAccounts, setReceivableAccounts] = useState<Account[]>([]);
    const [payableAccounts, setPayableAccounts] = useState<Account[]>([]);

    useEffect(() => {
        fetchPartners();
        fetchAccounts();
    }, [type]);

    const fetchPartners = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        let query = supabase.from('accounting_partners').select('*').eq('company_id', currentCompanyId).order('name');

        if (type) {
            query = query.or(`partner_type.eq.${type},partner_type.eq.Both`);
        }

        const { data, error } = await query;
        if (error) console.error('Error fetching partners:', error);
        else setPartners((data || []) as Partner[]);
        setLoading(false);
    };

    const fetchAccounts = async () => {
        if (!currentCompanyId) return;
        const { data } = await (supabase as any)
            .from('accounting_chart_of_accounts')
            .select('id, name, code, type, is_group, is_active')
            .eq('company_id', currentCompanyId)
            .eq('is_active', true)
            .eq('is_group', false)
            .in('type', ['Asset', 'Liability'])
            .order('code');

        if (data) {
            const accList = data as Account[];
            setReceivableAccounts(accList.filter(a => a.type === 'Asset' && !a.is_group && (a as any).is_active !== false));
            setPayableAccounts(accList.filter(a => a.type === 'Liability' && !a.is_group && (a as any).is_active !== false));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId) return alert('No company context');
        const formData = new FormData(e.target as HTMLFormElement);
        const data = Object.fromEntries(formData.entries());

        if (!data.name) return alert('Name is required');

        const partnerType = String(data.partner_type || type || 'Customer');
        const defaultRec = receivableAccounts.find(a => a.code === '1110') || receivableAccounts[0];
        const defaultPay = payableAccounts.find(a => a.code === '2010') || payableAccounts[0];

        const recId = (data.property_account_receivable_id as string) || (partnerType === 'Customer' || partnerType === 'Both' ? defaultRec?.id : null) || null;
        const payId = (data.property_account_payable_id as string) || (partnerType === 'Vendor' || partnerType === 'Both' ? defaultPay?.id : null) || null;
        const refCode = data.reference_code ? String(data.reference_code).trim() : null;

        const payload = {
            name: String(data.name || '').trim(),
            reference_code: refCode,
            code: refCode,
            partner_type: partnerType,
            email: data.email ? String(data.email).trim() : null,
            phone: data.phone ? String(data.phone).trim() : null,
            tax_id: data.tax_id ? String(data.tax_id).trim() : null,
            street: data.street ? String(data.street).trim() : null,
            city: data.city ? String(data.city).trim() : null,
            state: data.state ? String(data.state).trim() : null,
            country: data.country ? String(data.country).trim() : null,
            postal_code: data.postal_code ? String(data.postal_code).trim() : null,
            company_id: currentCompanyId,
            credit_limit: parseFloat(data.credit_limit as string) || 0,
            property_account_receivable_id: recId,
            property_account_payable_id: payId,
            is_active: true,
        };

        try {
            if (editingPartner) {
                const { error } = await supabase
                    .from('accounting_partners')
                    .update(payload)
                    .eq('id', editingPartner.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('accounting_partners')
                    .insert([payload]);
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!currentCompanyId) return alert('No company context');
        setImporting(true);
        try {
            const dataBuffer = await file.arrayBuffer();
            const workbook = read(dataBuffer);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = utils.sheet_to_json(sheet) as any[];

            if (!jsonData || jsonData.length === 0) {
                alert('File is empty or invalid.');
                setImporting(false);
                return;
            }

            const partnersToInsert = jsonData.map(row => {
                const partnerType = row['Partner Type'] || row['Type'] || type || 'Customer';
                const refCode = String(row['Reference / Ledger Code'] || row['Reference Code'] || row['Code'] || row['Ref Code'] || '').trim() || null;
                
                const recCode = String(row['Receivable Account Code'] || row['Receivable Account'] || '').trim();
                const payCode = String(row['Payable Account Code'] || row['Payable Account'] || '').trim();
                
                const recAcc = recCode ? receivableAccounts.find(a => String(a.code) === recCode) : null;
                const payAcc = payCode ? payableAccounts.find(a => String(a.code) === payCode) : null;

                return {
                    company_id: currentCompanyId,
                    name: String(row['Name'] || '').trim(),
                    reference_code: refCode,
                    code: refCode,
                    email: String(row['Email'] || '').trim(),
                    phone: String(row['Phone'] || '').trim(),
                    tax_id: String(row['Tax ID'] || row['VAT'] || '').trim(),
                    partner_type: (partnerType === 'Customer' || partnerType === 'Vendor' || partnerType === 'Both') ? partnerType : 'Customer',
                    credit_limit: parseFloat(row['Credit Limit'] || row['Limit']) || 0,
                    street: String(row['Street'] || '').trim(),
                    city: String(row['City'] || '').trim(),
                    state: String(row['State'] || '').trim(),
                    country: String(row['Country'] || '').trim(),
                    postal_code: String(row['Postal Code'] || '').trim(),
                    property_account_receivable_id: recAcc ? recAcc.id : null,
                    property_account_payable_id: payAcc ? payAcc.id : null,
                };
            }).filter(p => p.name);

            if (partnersToInsert.length === 0) {
                alert('No valid partners found. Ensure the "Name" column is populated.');
                setImporting(false);
                return;
            }

            const { error } = await supabase.from('accounting_partners').insert(partnersToInsert);
            if (error) {
                alert('Error importing partners: ' + error.message);
            } else {
                alert(`Successfully imported ${partnersToInsert.length} partners.`);
                setShowImportModal(false);
                fetchPartners();
            }
        } catch (error: any) {
            console.error(error);
            alert('Error parsing file: ' + error.message);
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const downloadTemplate = () => {
        const template = [
            {
                'Name': 'John Doe Corp',
                'Reference / Ledger Code': 'VEND-001',
                'Email': 'john@example.com',
                'Phone': '+9741234567',
                'Tax ID': 'VAT123456',
                'Partner Type': type || 'Customer',
                'Credit Limit': 10000,
                'Street': '123 Al Sadd St',
                'City': 'Doha',
                'State': 'Doha',
                'Country': 'Qatar',
                'Postal Code': '00000',
                'Receivable Account Code': receivableAccounts[0]?.code || '1110',
                'Payable Account Code': payableAccounts[0]?.code || '2010'
            }
        ];
        const ws = utils.json_to_sheet(template);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Template');
        const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `partners_import_template.xlsx`;
        a.click();
    };

    const filteredPartners = partners.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase()) ||
        (p.reference_code && p.reference_code.toLowerCase().includes(search.toLowerCase())) ||
        (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="relative w-64 no-print">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search partners / ref code..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div className="flex gap-2">
                    <PrintButton />
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-lg text-sm font-medium transition-colors shadow-sm no-print"
                    >
                        <UploadCloud className="w-4 h-4 text-slate-500" />
                        Import
                    </button>
                    <button
                        onClick={() => { setEditingPartner(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow shadow-indigo-500/20 no-print"
                    >
                        <Plus className="w-4 h-4" />
                        Add Partner
                    </button>
                </div>
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
                                <div className="flex items-center gap-1.5">
                                    {(partner.reference_code || partner.code) && (
                                        <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40">
                                            {partner.reference_code || partner.code}
                                        </span>
                                    )}
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${partner.partner_type === 'Customer' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            partner.partner_type === 'Vendor' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        }`}>
                                        {partner.partner_type}
                                    </span>
                                </div>
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
                                <span>QAR {Number(partner.credit_limit || 0).toLocaleString()}</span>
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
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name *</label>
                                <input name="name" defaultValue={editingPartner?.name} required className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" placeholder="e.g. Al Rayyan Trading Co." />
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
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Reference / Ledger Code
                                </label>
                                <input 
                                    name="reference_code" 
                                    defaultValue={editingPartner?.reference_code || editingPartner?.code} 
                                    placeholder="e.g. VEND-001, CUST-PEC-042" 
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-mono font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tax ID / VAT</label>
                                <input name="tax_id" defaultValue={editingPartner?.tax_id} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" placeholder="e.g. GSTIN, VAT Number" />
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
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Credit Limit (QAR)</label>
                            <input name="credit_limit" type="number" step="0.01" defaultValue={editingPartner?.credit_limit || 0} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-slate-900 dark:text-white" placeholder="0.00" />
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
                                        <option value="">Select Account (Optional)</option>
                                        {receivableAccounts.map(acc => (
                                             <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payable Account</label>
                                    <select name="property_account_payable_id" defaultValue={editingPartner?.property_account_payable_id} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm">
                                        <option value="">Select Account (Optional)</option>
                                        {payableAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3 justify-end border-t border-slate-100 dark:border-zinc-800">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all">
                                {editingPartner ? 'Update Partner' : 'Save Partner'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowImportModal(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center flex-shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <UploadCloud size={20} className="text-indigo-500" /> Import Partners
                            </h3>
                            <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg hover:bg-indigo-100 transition-colors">
                                <Download size={14} /> Template
                            </button>
                        </div>
                        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                                <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-400 mb-2">Instructions</h4>
                                <p className="text-xs text-indigo-600/80 dark:text-indigo-300/80 mb-3">
                                    Upload an Excel/CSV file with a header row containing these column names:
                                </p>
                                <ul className="text-xs text-indigo-700 dark:text-indigo-300 list-disc list-inside space-y-1 font-medium">
                                    <li>Name (Required)</li>
                                    <li>Email</li>
                                    <li>Phone</li>
                                    <li>Tax ID</li>
                                    <li>Partner Type (Customer, Vendor, Both)</li>
                                    <li>Credit Limit</li>
                                    <li>Street, City, State, Country, Postal Code</li>
                                    <li>Receivable Account Code (e.g. {receivableAccounts[0]?.code || '101200'})</li>
                                    <li>Payable Account Code (e.g. {payableAccounts[0]?.code || '201100'})</li>
                                </ul>
                            </div>
                            
                            <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-8 text-center relative hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors bg-slate-50 dark:bg-zinc-800/30">
                                <input 
                                    type="file" 
                                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileUpload}
                                    disabled={importing}
                                />
                                {importing ? (
                                    <>
                                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" />
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Processing file...</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-full shadow flex items-center justify-center mx-auto mb-3 text-slate-500 dark:text-slate-400">
                                            <UploadCloud size={24} />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Click or drag file to upload</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Supports .xlsx, .xls, .csv</p>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end flex-shrink-0">
                            <button onClick={() => setShowImportModal(false)} disabled={importing} className="px-5 py-2 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium text-sm font-semibold">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
