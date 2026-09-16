import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Filter, FileText, CheckCircle, Clock, Package, Building2, Scale, TrendingUp, Copy, Trash2, Layers, AlertCircle } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { PrintButton } from '../../ui/PrintButton';


// Helper to add days to ISO date string YYYY-MM-DD safely
const addDaysToDate = (dateStr: string, days: number): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return '';
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const getDaysBetweenDates = (startDateStr: string, endDateStr: string): number | null => {
    if (!startDateStr || !endDateStr) return null;
    const [sy, sm, sd] = startDateStr.split('-').map(Number);
    const [ey, em, ed] = endDateStr.split('-').map(Number);
    if (!sy || !sm || !sd || !ey || !em || !ed) return null;
    const s = new Date(sy, sm - 1, sd);
    const e = new Date(ey, em - 1, ed);
    const diffTime = e.getTime() - s.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

export interface InvoiceLineItem {
    item_id: string;
    account_id: string;
    sales_ledger_id: string;
    description: string;
    cost_center_id: string;
    project_cost_center_id: string;
    contract_cost_center_id: string;
    quantity: number;
    unit_price: number;
    account_category?: 'all' | 'asset' | 'liability' | 'income' | 'expense';
}

export const Invoices: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Masters for Create Modal
    const [partners, setPartners] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]); // To select Sales Journal
    const [costCenters, setCostCenters] = useState<any[]>([]);
    const [salesLedgers, setSalesLedgers] = useState<any[]>([]);
    const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
    const [arAccount, setArAccount] = useState<any>(null);

    // Voucher Mode: 'item' (Standard Goods / Catalog Invoice) vs 'accounting' (Direct Chart of Accounts / Services / Asset / Liability)
    const [voucherMode, setVoucherMode] = useState<'item' | 'accounting'>('item');

    // Form State
    const [selectedPartner, setSelectedPartner] = useState('');
    const [selectedJournal, setSelectedJournal] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [creditPeriod, setCreditPeriod] = useState<string>('30');
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
    const [invoiceReference, setInvoiceReference] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Edit/View State
    const [editMode, setEditMode] = useState(false);
    const [viewMode, setViewMode] = useState(false);
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

    // Line Items
    const [lines, setLines] = useState<InvoiceLineItem[]>([
        { item_id: '', account_id: '', sales_ledger_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', description: '', account_category: 'all' }
    ]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchInvoices();
            fetchMasters();
        }
    }, [currentCompanyId]);

    const fetchInvoices = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('accounting_journal_entries')
            .select(`
                *,
                partner:accounting_partners(name, reference_code, code),
                journal:accounting_journals(code)
            `)
            .eq('company_id', currentCompanyId)
            .eq('move_type', 'out_invoice')
            .order('date', { ascending: false });

        if (error) console.error(error);
        else setInvoices(data || []);
        setLoading(false);
    };

    const fetchMasters = async () => {
        if (!currentCompanyId) return;
        const { data: pData } = await supabase
            .from('accounting_partners')
            .select('id, name, reference_code, code, credit_limit, payment_term_days, property_account_receivable_id')
            .eq('company_id', currentCompanyId)
            .or('partner_type.eq.Customer,partner_type.eq.Both');
        setPartners(pData || []);

        const { data: iData } = await supabase.from('item_master').select('id, name, code, income_account_id').eq('company_id', currentCompanyId);
        setItems(iData || []);

        const { data: jData } = await supabase.from('accounting_journals').select('id, name').eq('company_id', currentCompanyId).eq('type', 'Sale');
        setJournals(jData || []);
        if (jData && jData.length > 0) setSelectedJournal(jData[0].id);

        const { data: ccData } = await supabase.from('accounting_cost_centers').select('id, name, code, type').eq('company_id', currentCompanyId).eq('is_active', true);
        setCostCenters(ccData || []);

        const { data: slData } = await supabase.from('accounting_sales_ledgers').select('id, name, account_id').eq('company_id', currentCompanyId).eq('is_active', true);
        setSalesLedgers(slData || []);

        // Chart of Accounts (All active posting accounts only - no groups, no inactives)
        const { data: coaData } = await (supabase.from('accounting_chart_of_accounts') as any)
            .select('id, name, code, type, subtype, is_group, is_active')
            .eq('company_id', currentCompanyId)
            .eq('is_group', false)
            .eq('is_active', true)
            .order('code', { ascending: true });
        setChartOfAccounts(((coaData as any[]) || []).filter((a: any) => !a.is_group && a.is_active !== false));

        // Load new Accounts Receivable account for credit limit check
        const { data: arData } = await supabase
            .from('accounting_chart_of_accounts')
            .select('id')
            .eq('company_id', currentCompanyId)
            .eq('subtype', 'Receivable')
            .limit(1)
            .maybeSingle();
        if (arData) setArAccount(arData);
    };

    // Filter accounts by type for accounting invoice mode
    const assetAccounts = chartOfAccounts.filter(a => a.type === 'Asset');
    const liabilityAccounts = chartOfAccounts.filter(a => a.type === 'Liability');
    const incomeAccounts = chartOfAccounts.filter(a => a.type === 'Income');
    const expenseAccounts = chartOfAccounts.filter(a => a.type === 'Expense');

    const handlePartnerChange = (partnerId: string) => {
        setSelectedPartner(partnerId);
        const p = partners.find(item => item.id === partnerId);
        if (p && p.payment_term_days !== undefined && p.payment_term_days !== null && p.payment_term_days !== '') {
            const days = String(p.payment_term_days);
            setCreditPeriod(days);
            if (invoiceDate) {
                setDueDate(addDaysToDate(invoiceDate, Number(days) || 0));
            }
        }
    };

    const handleCreditPeriodChange = (newPeriod: string) => {
        setCreditPeriod(newPeriod);
        if (newPeriod !== 'custom' && invoiceDate) {
            setDueDate(addDaysToDate(invoiceDate, Number(newPeriod) || 0));
        }
    };

    const handleInvoiceDateChange = (newDate: string) => {
        setInvoiceDate(newDate);
        if (creditPeriod !== 'custom' && newDate) {
            setDueDate(addDaysToDate(newDate, Number(creditPeriod) || 0));
        }
    };

    const handleOpenModal = async (inv?: any, readonly = false) => {
        if (inv) {
            const invDate = inv.date || new Date().toISOString().split('T')[0];
            const invDueDate = inv.due_date || invDate;

            setEditingInvoiceId(inv.id);
            setSelectedPartner(inv.partner_id || '');
            setSelectedJournal(inv.journal_id || '');
            setInvoiceDate(invDate);
            setDueDate(invDueDate);
            setInvoiceReference(inv.reference || '');
            setEditMode(!readonly);
            setViewMode(readonly);

            const diff = getDaysBetweenDates(invDate, invDueDate);
            if (diff !== null && ['0', '15', '30', '45', '60', '90', '120'].includes(String(diff))) {
                setCreditPeriod(String(diff));
            } else if (invDueDate && invDueDate !== invDate) {
                setCreditPeriod('custom');
            } else {
                setCreditPeriod('30');
            }

            // Fetch lines for this invoice
            const { data, error } = await supabase
                .from('accounting_journal_lines')
                .select('*')
                .eq('entry_id', inv.id);

            if (error) {
                console.error(error);
                alert('Error fetching lines: ' + error.message);
                return;
            }

            // Filter out the balancing line (receivable/payable)
            const itemLines = (data as any[] || []).filter(l => Number(l.credit) > 0);

            // Detect voucher mode: If any line has no item_id and has an account_id, or none have item_id
            const hasAnyItem = itemLines.some(l => !!l.item_id);
            const isAccounting = itemLines.length > 0 && !hasAnyItem;
            setVoucherMode(isAccounting ? 'accounting' : 'item');

            const mappedLines: InvoiceLineItem[] = itemLines.map((l: any) => {
                const matchedLedger = salesLedgers.find(sl => sl.account_id === l.account_id);
                const acc = chartOfAccounts.find(a => a.id === l.account_id);
                const category = acc ? (acc.type?.toLowerCase() as any) : 'all';
                return {
                    item_id: l.item_id || '',
                    account_id: l.account_id || '',
                    sales_ledger_id: matchedLedger ? matchedLedger.id : '',
                    cost_center_id: l.cost_center_id || '',
                    project_cost_center_id: l.project_cost_center_id || '',
                    contract_cost_center_id: l.contract_cost_center_id || '',
                    quantity: Number(l.quantity || 1),
                    unit_price: Number(l.unit_price || l.credit || 0),
                    description: l.name || '',
                    account_category: category || 'all'
                };
            });

            setLines(mappedLines.length > 0 ? mappedLines : [{ item_id: '', account_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', sales_ledger_id: '', description: '', account_category: 'all' }]);
            setIsModalOpen(true);
        } else {
            const today = new Date().toISOString().split('T')[0];
            setEditingInvoiceId(null);
            setSelectedPartner('');
            setInvoiceReference('');
            if (journals.length > 0) setSelectedJournal(journals[0].id);
            setInvoiceDate(today);
            setCreditPeriod('30');
            setDueDate(addDaysToDate(today, 30));
            setVoucherMode('item');
            setLines([{ item_id: '', account_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', sales_ledger_id: '', description: '', account_category: 'all' }]);
            setEditMode(false);
            setViewMode(false);
            setIsModalOpen(true);
        }
    };

    const handleAddLine = (cat: 'all' | 'asset' | 'liability' | 'income' | 'expense' = 'all') => {
        setLines([...lines, { 
            item_id: '', 
            account_id: '', 
            quantity: 1, 
            unit_price: 0, 
            cost_center_id: '', 
            project_cost_center_id: '', 
            contract_cost_center_id: '', 
            sales_ledger_id: '', 
            description: '',
            account_category: cat
        }]);
    };

    const handleDuplicateLine = (index: number) => {
        const lineToDup = lines[index];
        setLines([...lines, { ...lineToDup }]);
    };

    const handleLineChange = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        (newLines[index] as any)[field] = value;
        setLines(newLines);
    };

    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (viewMode) {
            setIsModalOpen(false);
            return;
        }
        try {
            if (!selectedPartner || !selectedJournal) throw new Error('Missing required fields');

            // Mode-specific line validation
            if (voucherMode === 'item') {
                for (let i = 0; i < lines.length; i++) {
                    const l = lines[i];
                    if (!l.item_id && !l.sales_ledger_id) {
                        alert(`Line #${i + 1}: Please select an Item or Sales Ledger.`);
                        return;
                    }
                }
            } else {
                for (let i = 0; i < lines.length; i++) {
                    const l = lines[i];
                    if (!l.account_id) {
                        alert(`Line #${i + 1}: Please select an Account (Asset, Liability, Income, or Expense).`);
                        return;
                    }
                }
            }

            // Credit Limit Check
            const partner = partners.find(p => p.id === selectedPartner);
            if (partner && partner.credit_limit > 0 && arAccount) {
                // Get current balance in new tables
                const { data: balanceData } = await supabase.rpc('rpc_get_accounting_account_balance', {
                    p_account_id: arAccount.id,
                    p_date: new Date().toISOString().split('T')[0],
                    p_partner_id: partner.id
                });
                
                const currentBalance = Number(balanceData || 0);
                const invoiceTotal = lines.reduce((acc, l) => acc + (Number(l.quantity) * Number(l.unit_price)), 0);
                
                if (currentBalance + invoiceTotal > partner.credit_limit) {
                    if (!confirm(`Warning: This invoice will put the customer over their credit limit of QAR ${partner.credit_limit}. Current Balance: QAR ${currentBalance}. Proceed?`)) {
                        return;
                    }
                }
            }

            if (!selectedPartner) {
                alert('Please select a customer.');
                return;
            }
            if (!selectedJournal) {
                alert('Please select a sales journal.');
                return;
            }

            const payloadLines = lines.map(l => ({
                item_id: voucherMode === 'item' && l.item_id ? String(l.item_id).trim() : null,
                account_id: voucherMode === 'accounting' && l.account_id ? String(l.account_id).trim() : (l.account_id ? String(l.account_id).trim() : null),
                sales_ledger_id: voucherMode === 'item' && l.sales_ledger_id ? String(l.sales_ledger_id).trim() : null,
                quantity: Number(l.quantity) || 1,
                unit_price: Number(l.unit_price) || 0,
                cost_center_id: l.cost_center_id ? String(l.cost_center_id).trim() : null,
                project_cost_center_id: l.project_cost_center_id ? String(l.project_cost_center_id).trim() : null,
                contract_cost_center_id: l.contract_cost_center_id ? String(l.contract_cost_center_id).trim() : null,
                description: l.description ? String(l.description).trim() : null
            }));

            const trimmedRef = invoiceReference.trim() || null;

            if (editMode && editingInvoiceId) {
                const updatePayload = {
                    p_entry_id: editingInvoiceId,
                    p_partner_id: selectedPartner,
                    p_journal_id: selectedJournal,
                    p_date: invoiceDate,
                    p_due_date: dueDate,
                    p_lines: payloadLines,
                    p_company_id: currentCompanyId,
                    p_reference: trimmedRef
                };
                const { error } = await (supabase.rpc as any)('rpc_update_accounting_invoice', updatePayload);
                if (error) throw error;
                await supabase.from('accounting_journal_entries').update({ reference: trimmedRef }).eq('id', editingInvoiceId);
                alert('Invoice Updated successfully!');
            } else {
                const payload = {
                    p_partner_id: selectedPartner,
                    p_journal_id: selectedJournal,
                    p_date: invoiceDate,
                    p_due_date: dueDate,
                    p_move_type: 'out_invoice',
                    p_lines: payloadLines,
                    p_company_id: currentCompanyId,
                    p_reference: trimmedRef
                };

                const { data: newId, error } = await (supabase.rpc as any)('rpc_create_accounting_invoice', payload);
                if (error) throw error;
                if (newId) {
                    await supabase.from('accounting_journal_entries').update({ reference: trimmedRef }).eq('id', newId);
                }
                alert('Invoice Created successfully!');
            }

            setIsModalOpen(false);
            setLines([{ item_id: '', account_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', sales_ledger_id: '', description: '', account_category: 'all' }]);
            fetchInvoices();

        } catch (err: any) {
            console.error(err);
            alert('Error saving invoice: ' + (err.message || 'Failed to save invoice'));
        }
    };

    const handlePost = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Confirm Post? This will lock the invoice.')) return;

        const { data, error } = await supabase.rpc('rpc_post_accounting_entry', { 
            p_entry_id: id
        });
        if (error) alert('Error posting: ' + error.message);
        else {
            const res = data as any;
            if (res?.success) alert('Posted Successfully');
            else alert('Post Failed: ' + (res?.message || 'Unknown error'));
            fetchInvoices();
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this draft invoice? This action cannot be undone.')) return;

        const { error } = await supabase
            .from('accounting_journal_entries')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(error);
            alert('Error deleting invoice: ' + error.message);
        } else {
            alert('Invoice deleted successfully');
            fetchInvoices();
        }
    };

    const projectCC = costCenters.filter(cc => (cc.type || '').toUpperCase() === 'PROJECT');
    const contractCC = costCenters.filter(cc => (cc.type || '').toUpperCase() === 'CONTRACT');
    const genericCC = costCenters.filter(cc => !cc.type || (cc.type || '').toUpperCase() === 'GENERIC' || ((cc.type || '').toUpperCase() !== 'PROJECT' && (cc.type || '').toUpperCase() !== 'CONTRACT'));

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = 
            (inv.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (inv.partner?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (inv.partner?.reference_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (inv.partner?.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (inv.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Customer Invoices</h2>
                <div className="flex items-center gap-3 no-print">
                    <PrintButton />
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Invoice
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search by customer, reference #, or ledger code..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-transparent text-sm border-none focus:outline-none placeholder:text-slate-400"
                />
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">Number</th>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Total</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : filteredInvoices.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No invoices found.</td></tr>
                        ) : filteredInvoices.map(inv => (
                            <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 font-mono text-xs">
                                    {inv.reference || `INV-${inv.id.slice(0, 5).toUpperCase()}`}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5">
                                        <span>{inv.partner?.name || '—'}</span>
                                        {(inv.partner?.reference_code || inv.partner?.code) && (
                                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                                [{inv.partner?.reference_code || inv.partner?.code}]
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{inv.date}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${inv.state === 'Posted'
                                             ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                             : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                        {inv.state === 'Posted' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                        {inv.state}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-white font-mono">
                                    QAR {Number(inv.amount_total).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex gap-2 justify-center items-center">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(inv, true); }}
                                            className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded transition-colors"
                                        >
                                            View
                                        </button>
                                        {inv.state === 'Draft' && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(inv, false); }}
                                                    className="px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(inv.id, e)}
                                                    className="px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition-colors"
                                                >
                                                    Delete
                                                </button>
                                                <button
                                                    onClick={(e) => handlePost(inv.id, e)}
                                                    className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                                                >
                                                    POST
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <Modal title={viewMode ? "View Customer Invoice" : (editMode ? "Edit Customer Invoice" : "Create Customer Invoice")} onClose={() => setIsModalOpen(false)} maxWidth="6xl">
                    <form onSubmit={handleCreateInvoice} className="space-y-6">
                        {/* Voucher Mode Switcher (Tally Prime Style: Item Invoice vs Accounting Invoice) */}
                        <div className="bg-slate-100/80 dark:bg-zinc-800/80 p-3 rounded-xl border border-slate-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Voucher Mode:</span>
                                <div className="inline-flex rounded-lg p-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-sm">
                                    <button
                                        type="button"
                                        disabled={viewMode}
                                        onClick={() => setVoucherMode('item')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            voucherMode === 'item'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <Package className="w-3.5 h-3.5" />
                                        Item Invoice
                                    </button>
                                    <button
                                        type="button"
                                        disabled={viewMode}
                                        onClick={() => setVoucherMode('accounting')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            voucherMode === 'accounting'
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        Accounting Invoice
                                    </button>
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                {voucherMode === 'item' ? (
                                    <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        <strong>Item Mode:</strong> For sales of physical inventory items & catalog goods.
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                        <strong>Accounting Mode:</strong> Direct ledger booking (Asset, Liability, Income, Expense) without items.
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="lg:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer *</label>
                                <select
                                    required
                                    value={selectedPartner}
                                    onChange={e => handlePartnerChange(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                                >
                                    <option value="">Select Customer</option>
                                    {partners.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} {(p.reference_code || p.code) ? `[${p.reference_code || p.code}]` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Invoice / Reference # *</label>
                                <input 
                                    type="text" 
                                    required 
                                    placeholder="e.g. INV-001, CUST-REF-99"
                                    value={invoiceReference} 
                                    onChange={e => setInvoiceReference(e.target.value)} 
                                    disabled={viewMode} 
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-mono font-bold" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Journal *</label>
                                <select
                                    required
                                    value={selectedJournal}
                                    onChange={e => setSelectedJournal(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                                >
                                    <option value="">Select Journal</option>
                                    {journals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Invoice Date *</label>
                                <input 
                                    type="date" 
                                    required 
                                    value={invoiceDate} 
                                    onChange={e => handleInvoiceDateChange(e.target.value)} 
                                    disabled={viewMode} 
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Credit Period *</label>
                                <select
                                    required
                                    value={creditPeriod}
                                    onChange={e => handleCreditPeriodChange(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-white focus:outline-none"
                                >
                                    <option value="30">30 Days</option>
                                    <option value="45">45 Days</option>
                                    <option value="60">60 Days</option>
                                    <option value="90">90 Days</option>
                                    <option value="15">15 Days</option>
                                    <option value="0">Immediate / Cash (0 Days)</option>
                                    <option value="120">120 Days</option>
                                    <option value="custom">Custom Due Date</option>
                                </select>
                                {creditPeriod === 'custom' ? (
                                    <input
                                        type="date"
                                        required
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        disabled={viewMode}
                                        className="w-full mt-1.5 p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono"
                                    />
                                ) : (
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
                                        <span>Due Date:</span>
                                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                            {dueDate || '—'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-wrap justify-between items-center gap-2">
                                <div>
                                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        {voucherMode === 'item' ? (
                                            <>
                                                <Package className="w-4 h-4 text-blue-600" />
                                                Item Lines (Inventory Sales)
                                            </>
                                        ) : (
                                            <>
                                                <FileText className="w-4 h-4 text-indigo-600" />
                                                Accounting Particulars (General Ledger Allocation)
                                            </>
                                        )}
                                    </h4>
                                    <p className="text-[11px] text-slate-500">
                                        {voucherMode === 'item' 
                                            ? 'Select items from catalog with quantities, unit rates, and sales ledgers.' 
                                            : 'Select Asset, Liability, Income, or Expense ledger accounts directly from Chart of Accounts.'}
                                    </p>
                                </div>
                                {!viewMode && voucherMode === 'accounting' && (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleAddLine('asset')}
                                            className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1"
                                            title="Add Asset Account Line (e.g. Sale of Old Generator, Fixed Asset Disposal)"
                                        >
                                            <Building2 className="w-3 h-3" />
                                            + Asset Line
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddLine('liability')}
                                            className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-bold hover:bg-purple-100 transition-colors flex items-center gap-1"
                                            title="Add Liability Account Line (e.g. Client Advance Recovery, Retainage)"
                                        >
                                            <Scale className="w-3 h-3" />
                                            + Liability Line
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddLine('income')}
                                            className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
                                            title="Add Income Line (e.g. Service Fees, Consulting, Maintenance)"
                                        >
                                            <TrendingUp className="w-3 h-3" />
                                            + Income Line
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* ITEM INVOICE MODE LINES */}
                            {voucherMode === 'item' ? (
                                <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 space-y-3">
                                    {lines.map((line, idx) => (
                                        <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 items-end border-b border-slate-100 dark:border-zinc-800 pb-3 md:pb-0 md:border-b-0">
                                            <div className="w-full md:flex-1 min-w-[150px]">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Item</label>
                                                <select
                                                    value={line.item_id}
                                                    onChange={e => handleLineChange(idx, 'item_id', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                                >
                                                    <option value="">Select Item</option>
                                                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="w-full md:w-48">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Sales Ledger</label>
                                                <select
                                                    required={!line.item_id}
                                                    value={line.sales_ledger_id}
                                                    onChange={e => handleLineChange(idx, 'sales_ledger_id', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                                >
                                                    <option value="">Select Sales Ledger</option>
                                                    {salesLedgers.map(sl => <option key={sl.id} value={sl.id}>{sl.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="w-full md:flex-1 min-w-[150px]">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Narration</label>
                                                <input
                                                    type="text"
                                                    value={line.description || ''}
                                                    onChange={e => handleLineChange(idx, 'description', e.target.value)}
                                                    disabled={viewMode}
                                                    placeholder="Comment / Line note"
                                                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                                />
                                            </div>
                                            <div className="w-full md:w-36">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Project CC</label>
                                                <select
                                                    value={line.project_cost_center_id}
                                                    onChange={e => handleLineChange(idx, 'project_cost_center_id', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                                >
                                                    <option value="">None</option>
                                                    {projectCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code}</option>)}
                                                </select>
                                            </div>
                                            <div className="w-full md:w-36">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Contract CC</label>
                                                <select
                                                    value={line.contract_cost_center_id}
                                                    onChange={e => handleLineChange(idx, 'contract_cost_center_id', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                                >
                                                    <option value="">None</option>
                                                    {contractCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code}</option>)}
                                                </select>
                                            </div>
                                            <div className="w-full md:w-36">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Cost Center</label>
                                                <select
                                                    value={line.cost_center_id}
                                                    onChange={e => handleLineChange(idx, 'cost_center_id', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                                >
                                                    <option value="">None</option>
                                                    {genericCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code}</option>)}
                                                </select>
                                            </div>
                                            <div className="w-20">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Qty</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={line.quantity}
                                                    onChange={e => handleLineChange(idx, 'quantity', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                                />
                                            </div>
                                            <div className="w-28">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Price</label>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">QAR</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={line.unit_price}
                                                        onChange={e => handleLineChange(idx, 'unit_price', e.target.value)}
                                                        disabled={viewMode}
                                                        className="w-full pl-10 p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm font-semibold"
                                                    />
                                                </div>
                                            </div>
                                            {!viewMode && (
                                                <div className="flex items-center gap-1 mb-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDuplicateLine(idx)}
                                                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60 rounded-md transition-colors"
                                                        title="Duplicate line"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                    {lines.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newLines = lines.filter((_, i) => i !== idx);
                                                                setLines(newLines);
                                                            }}
                                                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md"
                                                            title="Delete line"
                                                        >
                                                            &times;
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {!viewMode && (
                                        <button type="button" onClick={() => handleAddLine('all')} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                            <Plus className="w-3.5 h-3.5" />
                                            Add Item Line
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* ACCOUNTING INVOICE MODE LINES */
                                <div className="space-y-3">
                                    {lines.map((line, idx) => {
                                        const selectedAcc = chartOfAccounts.find(a => a.id === line.account_id);
                                        return (
                                            <div 
                                                key={idx} 
                                                className={`rounded-xl p-3.5 border transition-all ${
                                                    line.account_category === 'asset'
                                                        ? 'bg-blue-50/40 dark:bg-blue-950/15 border-blue-200 dark:border-blue-900/40'
                                                        : line.account_category === 'liability'
                                                        ? 'bg-purple-50/40 dark:bg-purple-950/15 border-purple-200 dark:border-purple-900/40'
                                                        : line.account_category === 'income'
                                                        ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/40'
                                                        : line.account_category === 'expense'
                                                        ? 'bg-amber-50/40 dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/40'
                                                        : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700'
                                                }`}
                                            >
                                                {/* Line Top Toolbar */}
                                                <div className="flex flex-wrap justify-between items-center gap-2 mb-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-bold text-slate-400 font-mono">#{idx + 1}</span>
                                                        <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 dark:bg-zinc-800 text-xs font-medium">
                                                            <button
                                                                type="button"
                                                                disabled={viewMode}
                                                                onClick={() => handleLineChange(idx, 'account_category', 'all')}
                                                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                                                                    !line.account_category || line.account_category === 'all'
                                                                        ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-white shadow-xs'
                                                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                                                                }`}
                                                            >
                                                                All
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={viewMode}
                                                                onClick={() => handleLineChange(idx, 'account_category', 'asset')}
                                                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                                                                    line.account_category === 'asset'
                                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                                        : 'text-blue-700 dark:text-blue-400 hover:text-blue-900'
                                                                }`}
                                                            >
                                                                <Building2 className="w-3 h-3" />
                                                                Asset
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={viewMode}
                                                                onClick={() => handleLineChange(idx, 'account_category', 'liability')}
                                                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                                                                    line.account_category === 'liability'
                                                                        ? 'bg-purple-600 text-white shadow-xs'
                                                                        : 'text-purple-700 dark:text-purple-400 hover:text-purple-900'
                                                                }`}
                                                            >
                                                                <Scale className="w-3 h-3" />
                                                                Liability
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={viewMode}
                                                                onClick={() => handleLineChange(idx, 'account_category', 'income')}
                                                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                                                                    line.account_category === 'income'
                                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                                        : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-900'
                                                                }`}
                                                            >
                                                                <TrendingUp className="w-3 h-3" />
                                                                Income
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={viewMode}
                                                                onClick={() => handleLineChange(idx, 'account_category', 'expense')}
                                                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                                                                    line.account_category === 'expense'
                                                                        ? 'bg-amber-600 text-white shadow-xs'
                                                                        : 'text-amber-700 dark:text-amber-400 hover:text-amber-900'
                                                                }`}
                                                            >
                                                                Expense
                                                            </button>
                                                        </div>
                                                        {selectedAcc && (
                                                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                                                                Type: {selectedAcc.type} {selectedAcc.subtype ? `(${selectedAcc.subtype})` : ''}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {!viewMode && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDuplicateLine(idx)}
                                                                className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60 rounded-lg transition-colors flex items-center gap-1"
                                                                title="Duplicate line"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" />
                                                                <span className="hidden sm:inline">Duplicate</span>
                                                            </button>
                                                            {lines.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newLines = lines.filter((_, i) => i !== idx);
                                                                        setLines(newLines);
                                                                    }}
                                                                    className="px-2 py-1 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg"
                                                                    title="Remove line"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Fields Grid */}
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                                                    {/* Account Selector */}
                                                    <div className="md:col-span-4">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                                            Ledger Account *
                                                        </label>
                                                        <select
                                                            required
                                                            value={line.account_id || ''}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                const acc = chartOfAccounts.find(a => a.id === val);
                                                                const newLines = [...lines];
                                                                newLines[idx].account_id = val;
                                                                if (acc && (!line.account_category || line.account_category === 'all')) {
                                                                    newLines[idx].account_category = (acc.type?.toLowerCase() as any) || 'all';
                                                                }
                                                                setLines(newLines);
                                                            }}
                                                            disabled={viewMode}
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                                                        >
                                                            <option value="">Select Ledger Account *</option>
                                                            {(!line.account_category || line.account_category === 'all' || line.account_category === 'asset') && assetAccounts.length > 0 && (
                                                                <optgroup label="💼 Asset Accounts (Fixed Assets, Advances, Equipment, Deposits)">
                                                                    {assetAccounts.map(a => (
                                                                        <option key={a.id} value={a.id}>
                                                                            [{a.code}] {a.name} {a.subtype ? `(${a.subtype})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                            {(!line.account_category || line.account_category === 'all' || line.account_category === 'liability') && liabilityAccounts.length > 0 && (
                                                                <optgroup label="⚖️ Liability Accounts (Customer Advances, Retainage, Deposits, Accruals)">
                                                                    {liabilityAccounts.map(a => (
                                                                        <option key={a.id} value={a.id}>
                                                                            [{a.code}] {a.name} {a.subtype ? `(${a.subtype})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                            {(!line.account_category || line.account_category === 'all' || line.account_category === 'income') && incomeAccounts.length > 0 && (
                                                                <optgroup label="📈 Income Accounts (Sales, Service Fees, Consultation, Revenue)">
                                                                    {incomeAccounts.map(a => (
                                                                        <option key={a.id} value={a.id}>
                                                                            [{a.code}] {a.name} {a.subtype ? `(${a.subtype})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                            {(!line.account_category || line.account_category === 'all' || line.account_category === 'expense') && expenseAccounts.length > 0 && (
                                                                <optgroup label="📉 Expense Accounts (Reimbursable Costs, Clearing)">
                                                                    {expenseAccounts.map(a => (
                                                                        <option key={a.id} value={a.id}>
                                                                            [{a.code}] {a.name} {a.subtype ? `(${a.subtype})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                        </select>
                                                    </div>

                                                    {/* Narration / Particulars */}
                                                    <div className="md:col-span-3">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                                            Particulars / Narration
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={line.description || ''}
                                                            onChange={e => handleLineChange(idx, 'description', e.target.value)}
                                                            disabled={viewMode}
                                                            placeholder="e.g. Sale of Old Equipment / Retainage / Consultation"
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                                                        />
                                                    </div>

                                                    {/* Cost Centers */}
                                                    <div className="md:col-span-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Project CC</label>
                                                        <select
                                                            value={line.project_cost_center_id}
                                                            onChange={e => handleLineChange(idx, 'project_cost_center_id', e.target.value)}
                                                            disabled={viewMode}
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs"
                                                        >
                                                            <option value="">None</option>
                                                            {projectCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="md:col-span-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Contract CC</label>
                                                        <select
                                                            value={line.contract_cost_center_id}
                                                            onChange={e => handleLineChange(idx, 'contract_cost_center_id', e.target.value)}
                                                            disabled={viewMode}
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs"
                                                        >
                                                            <option value="">None</option>
                                                            {contractCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code}</option>)}
                                                        </select>
                                                    </div>

                                                    {/* Quantity */}
                                                    <div className="md:col-span-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Qty</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={line.quantity}
                                                            onChange={e => handleLineChange(idx, 'quantity', e.target.value)}
                                                            disabled={viewMode}
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-center"
                                                        />
                                                    </div>

                                                    {/* Unit Price / Amount */}
                                                    <div className="md:col-span-2">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Rate / Amount</label>
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">QAR</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={line.unit_price}
                                                                onChange={e => handleLineChange(idx, 'unit_price', e.target.value)}
                                                                disabled={viewMode}
                                                                className="w-full pl-10 p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-semibold"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {!viewMode && (
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            <button 
                                                type="button" 
                                                onClick={() => handleAddLine('all')} 
                                                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                + Add Particulars Line
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end text-right">
                                <div>
                                    <span className="text-xs text-slate-500 font-bold uppercase mr-4">Total</span>
                                    <span className="text-xl font-bold text-slate-800 dark:text-white">
                                        QAR {lines.reduce((acc, l) => acc + (Number(l.quantity) * Number(l.unit_price)), 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                            <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all">
                                {viewMode ? "Close" : (editMode ? "Save Changes" : "Create Invoice")}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
