import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Filter, FileText, CheckCircle, Clock, ShoppingCart, Zap, Building2, Trash2, Scale, Copy, PlusCircle } from 'lucide-react';
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

export interface BillLine {
    line_type: 'item' | 'expense' | 'asset' | 'liability';
    item_id?: string;
    account_id?: string;
    purchase_ledger_id?: string;
    description: string;
    cost_center_id?: string;
    project_cost_center_id?: string;
    contract_cost_center_id?: string;
    quantity: number;
    unit_price: number;
}

export const Bills: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Masters for Create Modal
    const [partners, setPartners] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]); // To select Purchase Journal
    const [costCenters, setCostCenters] = useState<any[]>([]);
    const [purchaseLedgers, setPurchaseLedgers] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Form State
    const [selectedPartner, setSelectedPartner] = useState('');
    const [selectedJournal, setSelectedJournal] = useState('');
    const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
    const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
    const [creditPeriod, setCreditPeriod] = useState<string>('30');
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
    const [billReference, setBillReference] = useState('');
    const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');

    // Edit/View State
    const [editMode, setEditMode] = useState(false);
    const [viewMode, setViewMode] = useState(false);
    const [editingBillId, setEditingBillId] = useState<string | null>(null);

    // Line Items
    const [lines, setLines] = useState<BillLine[]>([
        { line_type: 'expense', item_id: '', account_id: '', purchase_ledger_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', description: '' }
    ]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchBills();
            fetchMasters();
        }
    }, [currentCompanyId]);

    const fetchBills = async () => {
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
            .eq('move_type', 'in_invoice')
            .order('date', { ascending: false });

        if (error) console.error(error);
        else setBills(data || []);
        setLoading(false);
    };

    const fetchMasters = async () => {
        if (!currentCompanyId) return;
        
        // 1. Vendors
        const { data: pData } = await supabase
            .from('accounting_partners')
            .select('id, name, reference_code, code, payment_term_days')
            .eq('company_id', currentCompanyId)
            .or('partner_type.eq.Vendor,partner_type.eq.Both')
            .order('name', { ascending: true });
        setPartners(pData || []);

        // 2. Inventory Items
        const { data: iData } = await supabase
            .from('item_master')
            .select('id, name, code, expense_account_id, standard_cost')
            .eq('company_id', currentCompanyId)
            .order('name', { ascending: true });
        setItems(iData || []);

        // 3. Purchase Journals
        const { data: jData } = await supabase
            .from('accounting_journals')
            .select('id, name, code')
            .eq('company_id', currentCompanyId)
            .eq('type', 'Purchase');
        setJournals(jData || []);
        if (jData && jData.length > 0 && !selectedJournal) setSelectedJournal(jData[0].id);

        // 4. Cost Centers
        const { data: ccData } = await supabase
            .from('accounting_cost_centers')
            .select('id, name, code, type')
            .eq('company_id', currentCompanyId)
            .eq('is_active', true)
            .order('code', { ascending: true });
        setCostCenters(ccData || []);

        // 5. Purchase Ledgers
        const { data: plData } = await supabase
            .from('accounting_purchase_ledgers')
            .select('id, name, account_id')
            .eq('company_id', currentCompanyId)
            .eq('is_active', true)
            .order('name', { ascending: true });
        setPurchaseLedgers(plData || []);

        // 6. Chart of Accounts (All active posting accounts)
        const { data: coaData } = await (supabase.from('accounting_chart_of_accounts') as any)
            .select('id, name, code, type, subtype')
            .eq('company_id', currentCompanyId)
            .eq('is_group', false)
            .order('code', { ascending: true });
        setAccounts((coaData as any[]) || []);
    };

    // Filter accounts by type
    const expenseAccounts = accounts.filter(a => a.type === 'Expense');
    const assetAccounts = accounts.filter(a => a.type === 'Asset');
    const liabilityAccounts = accounts.filter(a => a.type === 'Liability');

    const handlePartnerChange = (partnerId: string) => {
        setSelectedPartner(partnerId);
        const p = partners.find(item => item.id === partnerId);
        if (p && p.payment_term_days !== undefined && p.payment_term_days !== null && p.payment_term_days !== '') {
            const days = String(p.payment_term_days);
            setCreditPeriod(days);
            if (billDate) {
                setDueDate(addDaysToDate(billDate, Number(days) || 0));
            }
        }
    };

    const handleCreditPeriodChange = (newPeriod: string) => {
        setCreditPeriod(newPeriod);
        if (newPeriod !== 'custom' && billDate) {
            setDueDate(addDaysToDate(billDate, Number(newPeriod) || 0));
        }
    };

    const handleBillDateChange = (newDate: string) => {
        setBillDate(newDate);
        if (creditPeriod !== 'custom' && newDate) {
            setDueDate(addDaysToDate(newDate, Number(creditPeriod) || 0));
        }
    };

    const handleOpenModal = async (bill?: any, readonly = false) => {
        if (bill) {
            const bBillDate = bill.invoice_date || bill.date || new Date().toISOString().split('T')[0];
            const bVoucherDate = bill.date || new Date().toISOString().split('T')[0];
            const bDueDate = bill.due_date || bBillDate;

            setEditingBillId(bill.id);
            setSelectedPartner(bill.partner_id || '');
            setSelectedJournal(bill.journal_id || '');
            setBillDate(bBillDate);
            setVoucherDate(bVoucherDate);
            setDueDate(bDueDate);
            setBillReference(bill.reference || '');
            setSupplierInvoiceNo(bill.supplier_invoice_number || '');
            setEditMode(!readonly);
            setViewMode(readonly);

            const diff = getDaysBetweenDates(bBillDate, bDueDate);
            if (diff !== null && ['0', '15', '30', '45', '60', '90', '120'].includes(String(diff))) {
                setCreditPeriod(String(diff));
            } else if (bDueDate && bDueDate !== bBillDate) {
                setCreditPeriod('custom');
            } else {
                setCreditPeriod('30');
            }

            // Fetch lines for this bill
            const { data, error } = await supabase
                .from('accounting_journal_lines')
                .select('*')
                .eq('entry_id', bill.id);

            if (error) {
                console.error(error);
                alert('Error fetching lines: ' + error.message);
                return;
            }

            // Filter out the balancing payable line (debit > 0)
            const itemLines = (data as any[] || []).filter(l => Number(l.debit) > 0);

            const mappedLines: BillLine[] = itemLines.map((l: any) => {
                const isItem = !!l.item_id;
                const account = accounts.find(a => a.id === l.account_id);
                let line_type: 'item' | 'expense' | 'asset' | 'liability' = 'expense';
                if (isItem) {
                    line_type = 'item';
                } else if (account) {
                    if (account.type === 'Asset' || account.subtype === 'Fixed Assets') {
                        line_type = 'asset';
                    } else if (account.type === 'Liability') {
                        line_type = 'liability';
                    } else {
                        line_type = 'expense';
                    }
                }
                const matchedLedger = purchaseLedgers.find(pl => pl.account_id === l.account_id);

                return {
                    line_type,
                    item_id: l.item_id || '',
                    account_id: l.account_id || '',
                    purchase_ledger_id: matchedLedger ? matchedLedger.id : '',
                    cost_center_id: l.cost_center_id || '',
                    project_cost_center_id: l.project_cost_center_id || '',
                    contract_cost_center_id: l.contract_cost_center_id || '',
                    quantity: Number(l.quantity || 1),
                    unit_price: Number(l.unit_price || (l.quantity ? Number(l.debit) / Number(l.quantity) : Number(l.debit)) || 0),
                    description: l.name || ''
                };
            });

            setLines(mappedLines.length > 0 ? mappedLines : [
                { line_type: 'expense', item_id: '', account_id: '', purchase_ledger_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', description: '' }
            ]);
            setIsModalOpen(true);
        } else {
            const today = new Date().toISOString().split('T')[0];
            setEditingBillId(null);
            setSelectedPartner('');
            setBillReference('');
            setSupplierInvoiceNo('');
            if (journals.length > 0) setSelectedJournal(journals[0].id);
            setBillDate(today);
            setVoucherDate(today);
            setCreditPeriod('30');
            setDueDate(addDaysToDate(today, 30));
            setLines([
                { line_type: 'expense', item_id: '', account_id: '', purchase_ledger_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', description: '' }
            ]);
            setEditMode(false);
            setViewMode(false);
            setIsModalOpen(true);
        }
    };

    const handleAddLine = (type: 'item' | 'expense' | 'asset' | 'liability' = 'expense') => {
        setLines([...lines, { 
            line_type: type, 
            item_id: '', 
            account_id: '', 
            purchase_ledger_id: '', 
            quantity: 1, 
            unit_price: 0, 
            cost_center_id: '', 
            project_cost_center_id: '', 
            contract_cost_center_id: '', 
            description: '' 
        }]);
    };

    const handleDuplicateLine = (index: number) => {
        const lineToCopy = lines[index];
        const newLines = [...lines];
        newLines.splice(index + 1, 0, { ...lineToCopy });
        setLines(newLines);
    };

    const handleLineChange = (index: number, field: keyof BillLine, value: any) => {
        const newLines = [...lines];
        const currentLine = { ...newLines[index], [field]: value };

        // Auto-fill logic when selecting an inventory item
        if (field === 'item_id' && value) {
            const selectedItem = items.find(i => i.id === value);
            if (selectedItem) {
                if (!currentLine.description) currentLine.description = selectedItem.name;
                if (selectedItem.standard_cost && Number(currentLine.unit_price) === 0) {
                    currentLine.unit_price = Number(selectedItem.standard_cost);
                }
                if (selectedItem.expense_account_id && !currentLine.account_id) {
                    currentLine.account_id = selectedItem.expense_account_id;
                }
            }
        }

        // When switching line type, reset dependent fields
        if (field === 'line_type') {
            currentLine.item_id = '';
            currentLine.purchase_ledger_id = '';
            currentLine.account_id = '';
        }

        newLines[index] = currentLine;
        setLines(newLines);
    };

    const handleCreateBill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (viewMode) {
            setIsModalOpen(false);
            return;
        }
        try {
            if (!selectedPartner) {
                alert('Please select a vendor.');
                return;
            }
            if (!selectedJournal) {
                alert('Please select a purchase journal.');
                return;
            }

            // Validate that each line has required fields
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.line_type === 'expense' && !line.account_id) {
                    alert(`Line #${i + 1}: Please select an Expense Account.`);
                    return;
                }
                if (line.line_type === 'asset' && !line.account_id) {
                    alert(`Line #${i + 1}: Please select an Asset Account (e.g. Employee Advance, Prepayment, Fixed Asset, Deposit).`);
                    return;
                }
                if (line.line_type === 'liability' && !line.account_id) {
                    alert(`Line #${i + 1}: Please select a Liability Account (e.g. Due to Related Parties, Accruals, Loans).`);
                    return;
                }
                if (line.line_type === 'item' && !line.item_id && !line.purchase_ledger_id && !line.account_id) {
                    alert(`Line #${i + 1}: Please select an Item or Purchase Ledger.`);
                    return;
                }
            }

            const payloadLines = lines.map(l => ({
                item_id: l.line_type === 'item' && l.item_id ? String(l.item_id).trim() : null,
                purchase_ledger_id: l.line_type === 'item' && l.purchase_ledger_id ? String(l.purchase_ledger_id).trim() : null,
                account_id: l.account_id ? String(l.account_id).trim() : null,
                description: l.description ? String(l.description).trim() : null,
                quantity: Number(l.quantity) || 1,
                unit_price: Number(l.unit_price) || 0,
                cost_center_id: l.cost_center_id ? String(l.cost_center_id).trim() : null,
                project_cost_center_id: l.project_cost_center_id ? String(l.project_cost_center_id).trim() : null,
                contract_cost_center_id: l.contract_cost_center_id ? String(l.contract_cost_center_id).trim() : null
            }));

            const trimmedRef = billReference.trim() || null;
            const trimmedSupplierInvNo = supplierInvoiceNo.trim() || null;

            if (editMode && editingBillId) {
                const updatePayload = {
                    p_entry_id: editingBillId,
                    p_partner_id: selectedPartner,
                    p_journal_id: selectedJournal,
                    p_date: voucherDate,
                    p_invoice_date: billDate,
                    p_due_date: dueDate,
                    p_lines: payloadLines,
                    p_company_id: currentCompanyId,
                    p_reference: trimmedRef,
                    p_supplier_invoice_number: trimmedSupplierInvNo
                };
                const { error } = await (supabase.rpc as any)('rpc_update_accounting_invoice', updatePayload);
                if (error) throw error;
                await supabase.from('accounting_journal_entries').update({ 
                    date: voucherDate,
                    invoice_date: billDate,
                    due_date: dueDate,
                    reference: trimmedRef,
                    supplier_invoice_number: trimmedSupplierInvNo
                }).eq('id', editingBillId);
                alert('Vendor Bill updated successfully!');
            } else {
                const payload = {
                    p_partner_id: selectedPartner,
                    p_journal_id: selectedJournal,
                    p_date: voucherDate,
                    p_invoice_date: billDate,
                    p_due_date: dueDate,
                    p_move_type: 'in_invoice',
                    p_lines: payloadLines,
                    p_company_id: currentCompanyId,
                    p_reference: trimmedRef,
                    p_supplier_invoice_number: trimmedSupplierInvNo
                };

                const { data: newId, error } = await (supabase.rpc as any)('rpc_create_accounting_invoice', payload);
                if (error) throw error;
                if (newId) {
                    await supabase.from('accounting_journal_entries').update({ 
                        date: voucherDate,
                        invoice_date: billDate,
                        due_date: dueDate,
                        reference: trimmedRef,
                        supplier_invoice_number: trimmedSupplierInvNo
                    }).eq('id', newId);
                }
                alert('Vendor Bill created successfully!');
            }

            setIsModalOpen(false);
            setLines([
                { line_type: 'expense', item_id: '', account_id: '', purchase_ledger_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', description: '' }
            ]);
            fetchBills();

        } catch (err: any) {
            console.error(err);
            alert('Error saving bill: ' + (err.message || 'Failed to save bill'));
        }
    };

    const handlePost = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Confirm Post? This will lock the bill and update general ledger.')) return;

        const { data, error } = await supabase.rpc('rpc_post_accounting_entry', { 
            p_entry_id: id
        });
        if (error) alert('Error posting: ' + error.message);
        else {
            const res = data as any;
            if (res?.success) alert('Posted Successfully');
            else alert('Post Failed: ' + (res?.message || 'Unknown error'));
            fetchBills();
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this draft bill? This action cannot be undone.')) return;

        const { error } = await supabase
            .from('accounting_journal_entries')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(error);
            alert('Error deleting bill: ' + error.message);
        } else {
            alert('Bill deleted successfully');
            fetchBills();
        }
    };

    const handleApprove = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const { error } = await supabase
            .from('accounting_journal_entries')
            .update({ approval_status: 'approved' })
            .eq('id', id);
        
        if (error) alert('Error approving: ' + error.message);
        else fetchBills();
    };

    const genericCC = costCenters.filter(cc => cc.type === 'GENERIC');
    const projectCC = costCenters.filter(cc => cc.type === 'PROJECT');
    const contractCC = costCenters.filter(cc => cc.type === 'CONTRACT');

    const filteredBills = bills.filter(b => {
        const matchesSearch = 
            (b.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.supplier_invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.partner?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.partner?.reference_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.partner?.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || b.state === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span>Vendor Bills</span>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400">
                            {bills.length}
                        </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Record vendor invoices for operational expenses, fixed assets, and item purchases.
                    </p>
                </div>
                <div className="flex items-center gap-3 no-print">
                    <PrintButton />
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md shadow-indigo-500/20 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Create Bill
                    </button>
                </div>
            </div>

            {/* Filters and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by vendor, reference #, or ledger code..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-transparent text-sm border-none focus:outline-none placeholder:text-slate-400"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="text-xs font-medium bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2 text-slate-700 dark:text-slate-300"
                    >
                        <option value="all">All Statuses</option>
                        <option value="Draft">Draft</option>
                        <option value="Posted">Posted</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-medium border-b border-slate-100 dark:border-zinc-800">
                        <tr>
                            <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">PEC Purchase #</th>
                            <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Supplier Inv #</th>
                            <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Vendor</th>
                            <th className="px-4 py-4 font-bold text-xs uppercase tracking-wider">Supplier Inv Date</th>
                            <th className="px-4 py-4 font-bold text-xs uppercase tracking-wider">Voucher Date</th>
                            <th className="px-4 py-4 font-bold text-xs uppercase tracking-wider">Due Date</th>
                            <th className="px-4 py-4 font-bold text-xs uppercase tracking-wider">Status</th>
                            <th className="px-4 py-4 font-bold text-xs uppercase tracking-wider">Approval</th>
                            <th className="px-5 py-4 text-right font-bold text-xs uppercase tracking-wider">Total</th>
                            <th className="px-5 py-4 text-center font-bold text-xs uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {loading ? (
                            <tr><td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-medium">Loading bills...</td></tr>
                        ) : filteredBills.length === 0 ? (
                            <tr><td colSpan={10} className="px-6 py-12 text-center text-slate-400">No vendor bills found.</td></tr>
                        ) : filteredBills.map(bill => (
                            <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-5 py-4 font-bold text-indigo-700 dark:text-indigo-400 font-mono text-xs">
                                    {bill.reference || `BILL-${bill.id.slice(0, 5).toUpperCase()}`}
                                </td>
                                <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200 font-mono text-xs">
                                    {bill.supplier_invoice_number ? (
                                        <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                            {bill.supplier_invoice_number}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">—</span>
                                    )}
                                </td>
                                <td className="px-5 py-4 font-medium text-slate-800 dark:text-white">
                                    <div className="flex items-center gap-1.5">
                                        <span>{bill.partner?.name || '—'}</span>
                                        {(bill.partner?.reference_code || bill.partner?.code) && (
                                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                                [{bill.partner?.reference_code || bill.partner?.code}]
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-slate-700 dark:text-slate-200 text-xs font-mono font-medium">
                                    {bill.invoice_date || bill.date || '—'}
                                </td>
                                <td className="px-4 py-4 text-slate-500 text-xs font-mono">
                                    {bill.date || '—'}
                                </td>
                                <td className="px-4 py-4 text-slate-600 dark:text-slate-300 text-xs font-mono font-semibold">
                                    {bill.due_date || '—'}
                                </td>
                                <td className="px-4 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${bill.state === 'Posted'
                                             ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                             : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                        {bill.state === 'Posted' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                        {bill.state}
                                    </span>
                                </td>
                                <td className="px-4 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${bill.approval_status === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                        {bill.approval_status || 'pending'}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-right font-bold text-slate-800 dark:text-white font-mono">
                                    QAR {Number(bill.amount_total).toFixed(2)}
                                </td>
                                <td className="px-5 py-4 text-center">
                                    <div className="flex gap-2 justify-center items-center">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(bill, true); }}
                                            className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg transition-colors"
                                        >
                                            View
                                        </button>
                                        {bill.state === 'Draft' && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(bill, false); }}
                                                    className="px-2.5 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-lg transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(bill.id, e)}
                                                    className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
                                                >
                                                    Delete
                                                </button>
                                                {bill.approval_status !== 'approved' && (
                                                    <button
                                                        onClick={(e) => handleApprove(bill.id, e)}
                                                        className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                                                    >
                                                        Approve
                                                    </button>
                                                )}
                                                {bill.approval_status === 'approved' && (
                                                    <button
                                                        onClick={(e) => handlePost(bill.id, e)}
                                                        className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                                                    >
                                                        Post
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create / Edit / View Modal */}
            {isModalOpen && (
                <Modal 
                    title={viewMode ? "View Vendor Bill" : (editMode ? "Edit Vendor Bill" : "Create Vendor Bill")} 
                    onClose={() => setIsModalOpen(false)} 
                    maxWidth="5xl"
                >
                    <form onSubmit={handleCreateBill} className="space-y-6">
                        {/* Header Details with PEC Internal & Supplier Reference sections */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                            {/* Section 1: PEC Internal Voucher Details */}
                            <div className="lg:col-span-12 pb-1 border-b border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5" />
                                    1. PEC Internal Purchase Voucher
                                </span>
                                <span className="text-[11px] text-slate-400 font-medium">Internal accounting record & entry period</span>
                            </div>

                            <div className="lg:col-span-4">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                                    PEC Purchase Invoice / Voucher # *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. PINV-001, 2"
                                    value={billReference}
                                    onChange={e => setBillReference(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                                />
                            </div>

                            <div className="lg:col-span-4">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                                    Voucher Date * <span className="text-[10px] font-normal text-slate-400 normal-case">(Posting / Keying Date)</span>
                                </label>
                                <input 
                                    type="date" 
                                    required 
                                    value={voucherDate} 
                                    onChange={e => setVoucherDate(e.target.value)} 
                                    disabled={viewMode} 
                                    className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-medium" 
                                />
                            </div>

                            <div className="lg:col-span-4">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Journal *</label>
                                <select
                                    required
                                    value={selectedJournal}
                                    onChange={e => setSelectedJournal(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                                >
                                    <option value="">Select Journal</option>
                                    {journals.map(j => <option key={j.id} value={j.id}>{j.name} ({j.code})</option>)}
                                </select>
                            </div>

                            {/* Section 2: Vendor / Supplier Invoice Details */}
                            <div className="lg:col-span-12 pt-2 pb-1 border-b border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5" />
                                    2. Vendor Supplier Invoice & Credit Terms
                                </span>
                                <span className="text-[11px] text-slate-400 font-medium">Aging & due date calculate from Supplier Invoice Date</span>
                            </div>

                            <div className="lg:col-span-4">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Vendor *</label>
                                <select
                                    required
                                    value={selectedPartner}
                                    onChange={e => handlePartnerChange(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-medium"
                                >
                                    <option value="">Select Vendor</option>
                                    {partners.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} {(p.reference_code || p.code) ? `[${p.reference_code || p.code}]` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="lg:col-span-3">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                                    Supplier Invoice No. *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. INV-9823, BILL-882"
                                    value={supplierInvoiceNo}
                                    onChange={e => setSupplierInvoiceNo(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                                />
                            </div>

                            <div className="lg:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                                    Supplier Inv Date *
                                </label>
                                <input 
                                    type="date" 
                                    required 
                                    value={billDate} 
                                    onChange={e => handleBillDateChange(e.target.value)} 
                                    disabled={viewMode} 
                                    className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-medium" 
                                />
                            </div>

                            <div className="lg:col-span-3">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Credit Period *</label>
                                <select
                                    required
                                    value={creditPeriod}
                                    onChange={e => handleCreditPeriodChange(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-white focus:outline-none"
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
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                            {dueDate || '—'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Late / Prior-Period Invoice Helper Banner */}
                            {billDate && voucherDate && billDate.slice(0, 7) !== voucherDate.slice(0, 7) && (
                                <div className="lg:col-span-12 flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-lg text-xs text-blue-800 dark:text-blue-300">
                                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    <span>
                                        <strong>Late / Prior Period Supplier Invoice:</strong> Supplier bill dated <strong>{billDate}</strong> (aging and payment due date count from this date) will be recognized in the general ledger under the active period of Voucher Date (<strong>{voucherDate}</strong>).
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Bill Lines Section */}
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                <div>
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                                        <span>Bill Lines & Split Entries</span>
                                        <span className="text-xs font-normal text-slate-500">
                                            (Expenses, Assets / Advances, Liabilities / Related Parties, Items)
                                        </span>
                                    </h4>
                                </div>
                                {!viewMode && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleAddLine('expense')}
                                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                                        >
                                            <Zap className="w-3.5 h-3.5" />
                                            + Add Expense
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddLine('asset')}
                                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                                        >
                                            <Building2 className="w-3.5 h-3.5" />
                                            + Add Asset / Advance
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddLine('liability')}
                                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors flex items-center gap-1.5"
                                        >
                                            <Scale className="w-3.5 h-3.5" />
                                            + Add Liability / Related Party
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddLine('item')}
                                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                                        >
                                            <ShoppingCart className="w-3.5 h-3.5" />
                                            + Add Item
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Lines List */}
                            <div className="space-y-3">
                                {lines.map((line, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`rounded-xl p-4 border transition-all ${
                                            line.line_type === 'expense' 
                                                ? 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/30' 
                                                : line.line_type === 'asset'
                                                ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900/30'
                                                : line.line_type === 'liability'
                                                ? 'bg-purple-50/40 dark:bg-purple-950/10 border-purple-200 dark:border-purple-900/30'
                                                : 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30'
                                        }`}
                                    >
                                        {/* Line Category Selector Pill & Line Actions */}
                                        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold text-slate-400 font-mono">#{idx + 1}</span>
                                                <div className="inline-flex rounded-lg p-0.5 bg-slate-200/70 dark:bg-zinc-800 text-xs font-medium">
                                                    <button
                                                        type="button"
                                                        disabled={viewMode}
                                                        onClick={() => handleLineChange(idx, 'line_type', 'expense')}
                                                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                                                            line.line_type === 'expense'
                                                                ? 'bg-amber-500 text-white shadow-sm'
                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                                                        }`}
                                                    >
                                                        <Zap className="w-3 h-3" />
                                                        Expense
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={viewMode}
                                                        onClick={() => handleLineChange(idx, 'line_type', 'asset')}
                                                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                                                            line.line_type === 'asset'
                                                                ? 'bg-blue-600 text-white shadow-sm'
                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                                                        }`}
                                                    >
                                                        <Building2 className="w-3 h-3" />
                                                        Asset / Advance
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={viewMode}
                                                        onClick={() => handleLineChange(idx, 'line_type', 'liability')}
                                                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                                                            line.line_type === 'liability'
                                                                ? 'bg-purple-600 text-white shadow-sm'
                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                                                        }`}
                                                    >
                                                        <Scale className="w-3 h-3" />
                                                        Liability / Related Party
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={viewMode}
                                                        onClick={() => handleLineChange(idx, 'line_type', 'item')}
                                                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                                                            line.line_type === 'item'
                                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                                                        }`}
                                                    >
                                                        <ShoppingCart className="w-3 h-3" />
                                                        Item Purchase
                                                    </button>
                                                </div>
                                            </div>

                                            {!viewMode && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDuplicateLine(idx)}
                                                        className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60 rounded-lg transition-colors flex items-center gap-1"
                                                        title="Duplicate line entry"
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
                                                            className="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                                            title="Remove line"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Dynamic Fields Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                            {/* EXPENSE MODE */}
                                            {line.line_type === 'expense' && (
                                                <>
                                                    <div className="md:col-span-4">
                                                        <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-1">
                                                            Expense Account *
                                                        </label>
                                                        <select
                                                            required
                                                            value={line.account_id || ''}
                                                            onChange={e => handleLineChange(idx, 'account_id', e.target.value)}
                                                            disabled={viewMode}
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
                                                        >
                                                            <option value="">Select Expense Account</option>
                                                            {expenseAccounts.map(acc => (
                                                                <option key={acc.id} value={acc.id}>
                                                                    [{acc.code}] {acc.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="md:col-span-4">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                                            Narration / Expense Note
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={line.description || ''}
                                                            onChange={e => handleLineChange(idx, 'description', e.target.value)}
                                                            disabled={viewMode}
                                                            placeholder="e.g. Travel, Air tickets, Office Rent, Utilities..."
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {/* ASSET / ADVANCE / PREPAYMENT / FIXED ASSET MODE */}
                                            {line.line_type === 'asset' && (
                                                <>
                                                    <div className="md:col-span-4">
                                                        <label className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block mb-1">
                                                            Asset Account * <span className="text-[9px] font-normal text-slate-400 lowercase">(advance, fixed asset, prepayment, deposit)</span>
                                                        </label>
                                                        <select
                                                            required
                                                            value={line.account_id || ''}
                                                            onChange={e => handleLineChange(idx, 'account_id', e.target.value)}
                                                            disabled={viewMode}
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:outline-none font-medium"
                                                        >
                                                            <option value="">Select Asset Account</option>
                                                            {assetAccounts.map(acc => (
                                                                <option key={acc.id} value={acc.id}>
                                                                    [{acc.code}] {acc.name} {acc.subtype ? `(${acc.subtype})` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="md:col-span-4">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                                            Narration / Asset / Advance Note
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={line.description || ''}
                                                            onChange={e => handleLineChange(idx, 'description', e.target.value)}
                                                            disabled={viewMode}
                                                            placeholder="e.g. Employee Advance for John, Laptop Purchase, Office Deposit..."
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {/* LIABILITY / RELATED PARTY / ACCRUAL MODE */}
                                            {line.line_type === 'liability' && (
                                                <>
                                                    <div className="md:col-span-4">
                                                        <label className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block mb-1">
                                                            Liability Account * <span className="text-[9px] font-normal text-slate-400 lowercase">(due to related parties, accruals, loans)</span>
                                                        </label>
                                                        <select
                                                            required
                                                            value={line.account_id || ''}
                                                            onChange={e => handleLineChange(idx, 'account_id', e.target.value)}
                                                            disabled={viewMode}
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:outline-none font-medium"
                                                        >
                                                            <option value="">Select Liability Account</option>
                                                            {liabilityAccounts.map(acc => (
                                                                <option key={acc.id} value={acc.id}>
                                                                    [{acc.code}] {acc.name} {acc.subtype ? `(${acc.subtype})` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="md:col-span-4">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                                            Narration / Related Party Note
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={line.description || ''}
                                                            onChange={e => handleLineChange(idx, 'description', e.target.value)}
                                                            disabled={viewMode}
                                                            placeholder="e.g. Due to Sister Co, Reimbursable, Accrued expense..."
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {/* ITEM PURCHASE MODE */}
                                            {line.line_type === 'item' && (
                                                <>
                                                    <div className="md:col-span-3">
                                                        <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                                                            Item
                                                        </label>
                                                        <select
                                                            value={line.item_id || ''}
                                                            onChange={e => handleLineChange(idx, 'item_id', e.target.value)}
                                                            disabled={viewMode}
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                                                        >
                                                            <option value="">Select Catalog Item</option>
                                                            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="md:col-span-3">
                                                        <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                                                            Purchase / COGS Ledger
                                                        </label>
                                                        <select
                                                            value={line.purchase_ledger_id || ''}
                                                            onChange={e => handleLineChange(idx, 'purchase_ledger_id', e.target.value)}
                                                            disabled={viewMode}
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                                                        >
                                                            <option value="">Select Ledger / COGS</option>
                                                            <optgroup label="Purchase Ledgers">
                                                                {purchaseLedgers.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                                                            </optgroup>
                                                            <optgroup label="Expense / COGS Accounts">
                                                                {expenseAccounts.map(acc => (
                                                                  <option key={`coa-${acc.id}`} value={`coa:${acc.id}`}>
                                                                        [{acc.code}] {acc.name}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        </select>
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                                            Narration
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={line.description || ''}
                                                            onChange={e => handleLineChange(idx, 'description', e.target.value)}
                                                            disabled={viewMode}
                                                            placeholder="Line note"
                                                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {/* Quantity */}
                                            <div className="md:col-span-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Qty</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={line.quantity}
                                                    onChange={e => handleLineChange(idx, 'quantity', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-center font-semibold focus:outline-none"
                                                />
                                            </div>

                                            {/* Unit Price */}
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Price (QAR)</label>
                                                <div className="relative">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">QAR</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={line.unit_price}
                                                        onChange={e => handleLineChange(idx, 'unit_price', e.target.value)}
                                                        disabled={viewMode}
                                                        className="w-full pl-11 p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-semibold focus:outline-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* Line Total */}
                                            <div className="md:col-span-1 text-right pb-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Line Total</span>
                                                <span className="text-xs font-bold text-slate-800 dark:text-white font-mono">
                                                    {(Number(line.quantity || 1) * Number(line.unit_price || 0)).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Cost Centers Row */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-200/50 dark:border-zinc-800">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Project CC</label>
                                                <select
                                                    value={line.project_cost_center_id || ''}
                                                    onChange={e => handleLineChange(idx, 'project_cost_center_id', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-xs"
                                                >
                                                    <option value="">None</option>
                                                    {projectCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Contract CC</label>
                                                <select
                                                    value={line.contract_cost_center_id || ''}
                                                    onChange={e => handleLineChange(idx, 'contract_cost_center_id', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-xs"
                                                >
                                                    <option value="">None</option>
                                                    {contractCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cost Center</label>
                                                <select
                                                    value={line.cost_center_id || ''}
                                                    onChange={e => handleLineChange(idx, 'cost_center_id', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-xs"
                                                >
                                                    <option value="">None</option>
                                                    {genericCC.map(cc => <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Multi-Line Quick Adder Bar */}
                            {!viewMode && (
                                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-slate-200 dark:border-zinc-700">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                        <PlusCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                        + Add Another Split / Line Entry:
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleAddLine('expense')}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all flex items-center gap-1 shadow-sm"
                                        >
                                            <Zap className="w-3 h-3" /> + Expense Line
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddLine('asset')}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all flex items-center gap-1 shadow-sm"
                                        >
                                            <Building2 className="w-3 h-3" /> + Asset / Advance Line
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddLine('liability')}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all flex items-center gap-1 shadow-sm"
                                        >
                                            <Scale className="w-3 h-3" /> + Liability / Related Party Line
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddLine('item')}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all flex items-center gap-1 shadow-sm"
                                        >
                                            <ShoppingCart className="w-3 h-3" /> + Item Purchase Line
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Total Bar */}
                            <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                                <div className="text-xs text-slate-500">
                                    Total {lines.length} {lines.length === 1 ? 'line item' : 'line items'}
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mr-4">Total Amount</span>
                                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                        QAR {lines.reduce((acc, l) => acc + (Number(l.quantity || 1) * Number(l.unit_price || 0)), 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                            <button 
                                type="submit"
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.99] flex items-center justify-center gap-2 text-base"
                            >
                                {viewMode ? "Close" : (editMode ? "Save Changes" : "Create Bill")}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
export default Bills;
