import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Search, Filter, FileText, CheckCircle, Clock, Package, Building2, Scale, TrendingUp, Copy, Trash2, Layers, AlertCircle, RotateCcw, Sparkles, X, Undo2 } from 'lucide-react';
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

    // Document Type: 'out_invoice' (Sales Invoice) vs 'out_refund' (Sales Return / Credit Note)
    const [moveType, setMoveType] = useState<'out_invoice' | 'out_refund'>('out_invoice');
    const [typeFilter, setTypeFilter] = useState<'all' | 'out_invoice' | 'out_refund'>('all');

    // Quick Add Item Modal (Tally Alt+C Inline Item Creation)
    const [isQuickItemModalOpen, setIsQuickItemModalOpen] = useState(false);
    const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
    const [quickItemSaving, setQuickItemSaving] = useState(false);
    const [quickItemForm, setQuickItemForm] = useState({
        name: '',
        code: '',
        uom: 'PCS',
        category: 'General',
        standard_cost: '',
        income_account_id: '',
        description: ''
    });

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
            .in('move_type', ['out_invoice', 'out_refund'])
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

    // Filter accounts by type for accounting invoice mode and ledger selections
    const wipAndAccruals = chartOfAccounts.filter(a => 
        ['1410', '1210'].includes(a.code) || 
        /work\s*in\s*process|wip|accrued\s*income|accrued\s*revenue|unbilled/i.test(a.name)
    );
    const assetAccounts = chartOfAccounts.filter(a => a.type === 'Asset' && !wipAndAccruals.some(w => w.id === a.id));
    const liabilityAccounts = chartOfAccounts.filter(a => a.type === 'Liability');
    const incomeAccounts = chartOfAccounts.filter(a => a.type === 'Income');
    const expenseAccounts = chartOfAccounts.filter(a => a.type === 'Expense');
    const otherAccounts = chartOfAccounts.filter(a => !['Asset', 'Liability', 'Income', 'Expense'].includes(a.type) && !wipAndAccruals.some(w => w.id === a.id));

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

    // Alt+C global shortcut to quickly create a stock item inline like Tally
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                e.stopPropagation();
                if (isModalOpen && !viewMode) {
                    handleOpenQuickItemModal(activeLineIdx ?? 0);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen, viewMode, activeLineIdx, lines]);

    const handleOpenQuickItemModal = (lineIdx?: number) => {
        if (lineIdx !== undefined) {
            setActiveLineIdx(lineIdx);
        } else {
            const emptyIdx = lines.findIndex(l => !l.item_id);
            setActiveLineIdx(emptyIdx >= 0 ? emptyIdx : lines.length - 1);
        }
        const defaultIncomeAcc = incomeAccounts.length > 0 ? incomeAccounts[0].id : '';
        setQuickItemForm({
            name: '',
            code: `ITM-${Date.now().toString().slice(-4)}`,
            uom: 'PCS',
            category: 'General',
            standard_cost: '',
            income_account_id: defaultIncomeAcc,
            description: ''
        });
        setIsQuickItemModalOpen(true);
    };

    const handleSaveQuickItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickItemForm.name.trim() || !quickItemForm.code.trim()) {
            alert('Please provide Item Name and Item Code');
            return;
        }
        setQuickItemSaving(true);
        try {
            const insertPayload = {
                company_id: currentCompanyId,
                name: quickItemForm.name.trim(),
                code: quickItemForm.code.trim().toUpperCase(),
                uom: quickItemForm.uom.trim().toUpperCase() || 'PCS',
                category: quickItemForm.category.trim() || null,
                description: quickItemForm.description.trim() || null,
                standard_cost: Number(quickItemForm.standard_cost) || 0,
                income_account_id: quickItemForm.income_account_id || null,
                is_stockable: true,
                valuation_method: 'FIFO',
                status: 'Active'
            };

            const { data: createdItem, error } = await supabase
                .from('item_master')
                .insert([insertPayload])
                .select('id, name, code, income_account_id, standard_cost')
                .single();

            if (error) throw error;

            // Update master items cache
            setItems(prev => [...prev, createdItem]);

            // Auto-assign into the line that triggered creation
            const targetIdx = activeLineIdx !== null && activeLineIdx < lines.length ? activeLineIdx : (lines.length - 1);
            if (targetIdx >= 0) {
                const newLines = [...lines];
                const line = { ...newLines[targetIdx] };
                line.item_id = createdItem.id;
                if (!line.description) line.description = createdItem.name;
                if (createdItem.standard_cost && Number(line.unit_price) === 0) {
                    line.unit_price = Number(createdItem.standard_cost);
                }
                if (createdItem.income_account_id && !line.account_id) {
                    line.account_id = createdItem.income_account_id;
                    const matchedSl = salesLedgers.find(sl => sl.account_id === createdItem.income_account_id);
                    if (matchedSl) line.sales_ledger_id = matchedSl.id;
                }
                newLines[targetIdx] = line;
                setLines(newLines);
            }

            setIsQuickItemModalOpen(false);
        } catch (err: any) {
            console.error('Error creating stock item:', err);
            alert('Failed to create stock item: ' + (err.message || 'Unknown error'));
        } finally {
            setQuickItemSaving(false);
        }
    };

    const handleCreateCreditNoteFromInvoice = async (inv: any) => {
        const today = new Date().toISOString().split('T')[0];
        setEditingInvoiceId(null);
        setEditMode(false);
        setViewMode(false);
        setMoveType('out_refund');
        setSelectedPartner(inv.partner_id || '');
        setSelectedJournal(inv.journal_id || (journals.length > 0 ? journals[0].id : ''));
        setInvoiceDate(today);
        setCreditPeriod('0');
        setDueDate(today);
        setInvoiceReference(`CRN-${inv.reference || inv.id.slice(0, 5).toUpperCase()}`);

        // Fetch lines for this invoice
        const { data, error } = await supabase
            .from('accounting_journal_lines')
            .select('*')
            .eq('entry_id', inv.id);

        if (error) {
            console.error(error);
            alert('Error fetching invoice lines: ' + error.message);
            return;
        }

        const isOriginalRefund = inv.move_type === 'out_refund';
        const itemLines = (data as any[] || []).filter(l => 
            isOriginalRefund ? Number(l.debit) > 0 : Number(l.credit) > 0
        );

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
                unit_price: Number(l.unit_price || (isOriginalRefund ? l.debit : l.credit) || 0),
                description: `Return: ${l.name || ''}`,
                account_category: category || 'all'
            };
        });

        setLines(mappedLines.length > 0 ? mappedLines : [{ item_id: '', account_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', sales_ledger_id: '', description: '', account_category: 'all' }]);
        setVoucherMode(mappedLines.some(l => !!l.item_id) ? 'item' : 'accounting');
        setIsModalOpen(true);
    };

    const handleOpenModal = async (inv?: any, readonly = false, defaultMoveType: 'out_invoice' | 'out_refund' = 'out_invoice') => {
        if (inv) {
            const invDate = inv.date || new Date().toISOString().split('T')[0];
            const invDueDate = inv.due_date || invDate;

            setEditingInvoiceId(inv.id);
            setMoveType(inv.move_type || 'out_invoice');
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
            const isRefund = inv.move_type === 'out_refund';
            const itemLines = (data as any[] || []).filter(l => 
                isRefund ? Number(l.debit) > 0 : Number(l.credit) > 0
            );

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
                    unit_price: Number(l.unit_price || (isRefund ? l.debit : l.credit) || 0),
                    description: l.name || '',
                    account_category: category || 'all'
                };
            });

            setLines(mappedLines.length > 0 ? mappedLines : [{ item_id: '', account_id: '', quantity: 1, unit_price: 0, cost_center_id: '', project_cost_center_id: '', contract_cost_center_id: '', sales_ledger_id: '', description: '', account_category: 'all' }]);
            setIsModalOpen(true);
        } else {
            const today = new Date().toISOString().split('T')[0];
            setEditingInvoiceId(null);
            setMoveType(defaultMoveType);
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
                    if (!l.item_id && !l.sales_ledger_id && !l.account_id) {
                        alert(`Line #${i + 1}: Please select a Ledger Account (Sales, WIP, Accrued Income, etc.) or Item.`);
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

            const payloadLines = lines.map(l => {
                let accId = l.account_id ? String(l.account_id).trim() : null;
                let slId = l.sales_ledger_id ? String(l.sales_ledger_id).trim() : null;

                if (slId && !accId) {
                    const matched = salesLedgers.find(sl => sl.id === slId);
                    if (matched?.account_id) accId = matched.account_id;
                }
                if (accId && !slId) {
                    const matched = salesLedgers.find(sl => sl.account_id === accId);
                    if (matched) slId = matched.id;
                }

                return {
                    item_id: voucherMode === 'item' && l.item_id ? String(l.item_id).trim() : null,
                    account_id: accId,
                    sales_ledger_id: slId,
                    quantity: Number(l.quantity) || 1,
                    unit_price: Number(l.unit_price) || 0,
                    cost_center_id: l.cost_center_id ? String(l.cost_center_id).trim() : null,
                    project_cost_center_id: l.project_cost_center_id ? String(l.project_cost_center_id).trim() : null,
                    contract_cost_center_id: l.contract_cost_center_id ? String(l.contract_cost_center_id).trim() : null,
                    description: l.description ? String(l.description).trim() : null
                };
            });

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
                    p_reference: trimmedRef,
                    p_invoice_date: invoiceDate,
                    p_supplier_invoice_number: null
                };
                const { error } = await (supabase.rpc as any)('rpc_update_accounting_invoice', updatePayload);
                if (error) throw error;
                await supabase.from('accounting_journal_entries').update({ reference: trimmedRef }).eq('id', editingInvoiceId);
                alert(moveType === 'out_refund' ? 'Sales Return (Credit Note) updated successfully!' : 'Invoice updated successfully!');
            } else {
                const payload = {
                    p_partner_id: selectedPartner,
                    p_journal_id: selectedJournal,
                    p_date: invoiceDate,
                    p_due_date: dueDate,
                    p_move_type: moveType,
                    p_lines: payloadLines,
                    p_company_id: currentCompanyId,
                    p_reference: trimmedRef,
                    p_invoice_date: invoiceDate,
                    p_supplier_invoice_number: null
                };

                const { data: newId, error } = await (supabase.rpc as any)('rpc_create_accounting_invoice', payload);
                if (error) throw error;
                if (newId) {
                    await supabase.from('accounting_journal_entries').update({ reference: trimmedRef }).eq('id', newId);
                }
                alert(moveType === 'out_refund' ? 'Sales Return (Credit Note) created successfully!' : 'Invoice created successfully!');
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
        if (typeFilter !== 'all' && inv.move_type !== typeFilter) return false;
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Customer Invoices & Sales Returns</h2>
                    <p className="text-xs text-slate-500">Manage billing, receivable vouchers, and sales returns (credit notes).</p>
                </div>
                <div className="flex items-center gap-2.5 no-print">
                    <PrintButton />
                    <button
                        onClick={() => handleOpenModal(undefined, false, 'out_refund')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
                        title="Create a Sales Return / Customer Credit Note"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Sales Return (Credit Note)
                    </button>
                    <button
                        onClick={() => handleOpenModal(undefined, false, 'out_invoice')}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
                    >
                        <Plus className="w-4 h-4" />
                        New Invoice
                    </button>
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                    <button
                        onClick={() => setTypeFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            typeFilter === 'all'
                                ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        All Transactions ({invoices.length})
                    </button>
                    <button
                        onClick={() => setTypeFilter('out_invoice')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            typeFilter === 'out_invoice'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-blue-700 dark:text-blue-400 hover:text-blue-900'
                        }`}
                    >
                        Invoices ({invoices.filter(i => i.move_type === 'out_invoice').length})
                    </button>
                    <button
                        onClick={() => setTypeFilter('out_refund')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            typeFilter === 'out_refund'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-purple-700 dark:text-purple-400 hover:text-purple-900'
                        }`}
                    >
                        <RotateCcw className="w-3 h-3" />
                        Credit Notes ({invoices.filter(i => i.move_type === 'out_refund').length})
                    </button>
                </div>

                <div className="flex-1 max-w-md relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search by customer, reference #, or voucher ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">Number / Type</th>
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
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No records found.</td></tr>
                        ) : filteredInvoices.map(inv => (
                            <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-bold text-slate-700 dark:text-slate-300 font-mono text-xs">
                                            {inv.reference || `${inv.move_type === 'out_refund' ? 'CRN' : 'INV'}-${inv.id.slice(0, 5).toUpperCase()}`}
                                        </span>
                                        {inv.move_type === 'out_refund' ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 px-1.5 py-0.5 rounded w-fit">
                                                <RotateCcw className="w-2.5 h-2.5" /> Credit Note (Return)
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 px-1.5 py-0.5 rounded w-fit">
                                                Invoice
                                            </span>
                                        )}
                                    </div>
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
                                <td className="px-6 py-4 text-right font-bold font-mono">
                                    {inv.move_type === 'out_refund' ? (
                                        <span className="text-purple-600 dark:text-purple-400">
                                            - QAR {Number(inv.amount_total).toFixed(2)}
                                        </span>
                                    ) : (
                                        <span className="text-slate-800 dark:text-white">
                                            QAR {Number(inv.amount_total).toFixed(2)}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex gap-2 justify-center items-center">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(inv, true); }}
                                            className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded transition-colors"
                                        >
                                            View
                                        </button>
                                        {inv.move_type === 'out_invoice' && inv.state === 'Posted' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleCreateCreditNoteFromInvoice(inv); }}
                                                className="px-2 py-1 text-xs font-semibold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20 rounded transition-colors flex items-center gap-1"
                                                title="Create a Sales Return / Credit Note against this invoice"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                Return
                                            </button>
                                        )}
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
                <Modal 
                    title={
                        moveType === 'out_refund'
                            ? (viewMode ? "View Sales Return (Credit Note)" : (editMode ? "Edit Sales Return (Credit Note)" : "Create Sales Return (Credit Note)"))
                            : (viewMode ? "View Customer Invoice" : (editMode ? "Edit Customer Invoice" : "Create Customer Invoice"))
                    } 
                    onClose={() => setIsModalOpen(false)} 
                    maxWidth="6xl"
                >
                    <form onSubmit={handleCreateInvoice} className="space-y-6">
                        {/* Document Type Selector (Sales Invoice vs Sales Return / Credit Note) */}
                        <div className="bg-slate-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-slate-200 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Document Type:</span>
                                <div className="inline-flex rounded-lg p-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-xs">
                                    <button
                                        type="button"
                                        disabled={viewMode || editMode}
                                        onClick={() => setMoveType('out_invoice')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            moveType === 'out_invoice'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                                        }`}
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        Sales Invoice
                                    </button>
                                    <button
                                        type="button"
                                        disabled={viewMode || editMode}
                                        onClick={() => setMoveType('out_refund')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            moveType === 'out_refund'
                                                ? 'bg-purple-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                                        }`}
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Sales Return (Credit Note)
                                    </button>
                                </div>
                            </div>
                            {moveType === 'out_refund' ? (
                                <div className="text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Credit Note / Sales Return: Debits Sales/Return account & Credits Customer Receivable.</span>
                                </div>
                            ) : (
                                <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Standard Sales Invoice: Debits Customer Receivable & Credits Sales/Revenue.</span>
                                </div>
                            )}
                        </div>

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
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Item (Optional)</label>
                                                    {!viewMode && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenQuickItemModal(idx)}
                                                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 transition-colors"
                                                            title="Create new stock item without leaving this invoice (Shortcut: Alt+C)"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            <span>New Item</span>
                                                            <kbd className="text-[9px] px-1 py-0.2 bg-white dark:bg-zinc-800 border border-blue-300 dark:border-blue-700 rounded font-mono font-semibold">Alt+C</kbd>
                                                        </button>
                                                    )}
                                                </div>
                                                <select
                                                    value={line.item_id}
                                                    onChange={e => {
                                                        const itemId = e.target.value;
                                                        if (itemId === '__NEW_ITEM__') {
                                                            handleOpenQuickItemModal(idx);
                                                            return;
                                                        }
                                                        handleLineChange(idx, 'item_id', itemId);
                                                        if (itemId) {
                                                            const it = items.find(i => i.id === itemId);
                                                            if (it?.income_account_id && !line.account_id) {
                                                                handleLineChange(idx, 'account_id', it.income_account_id);
                                                                const matchedSl = salesLedgers.find(sl => sl.account_id === it.income_account_id);
                                                                if (matchedSl) handleLineChange(idx, 'sales_ledger_id', matchedSl.id);
                                                            }
                                                            if (it?.name && (!line.description || items.some(other => other.name === line.description))) {
                                                                handleLineChange(idx, 'description', it.name);
                                                            }
                                                            if (it?.standard_cost && Number(line.unit_price) === 0) {
                                                                handleLineChange(idx, 'unit_price', Number(it.standard_cost));
                                                            }
                                                        }
                                                    }}
                                                    disabled={viewMode}
                                                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm"
                                                >
                                                    <option value="">-- No Item / WIP / Progress / Service --</option>
                                                    {!viewMode && (
                                                        <option value="__NEW_ITEM__" className="font-bold text-blue-600 bg-blue-50 dark:bg-zinc-800">
                                                            ✨ + Create New Stock Item (Alt+C)...
                                                        </option>
                                                    )}
                                                    {items.map(i => <option key={i.id} value={i.id}>{i.name} {i.code ? `(${i.code})` : ''}</option>)}
                                                </select>
                                            </div>
                                            <div className="w-full md:w-64">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Sales / WIP / Accrual Ledger *</label>
                                                <select
                                                    required={!line.item_id}
                                                    value={line.account_id || (salesLedgers.find(sl => sl.id === line.sales_ledger_id)?.account_id) || ''}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        const matchedSl = salesLedgers.find(sl => sl.account_id === val);
                                                        handleLineChange(idx, 'account_id', val);
                                                        handleLineChange(idx, 'sales_ledger_id', matchedSl ? matchedSl.id : '');
                                                    }}
                                                    disabled={viewMode}
                                                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm font-medium"
                                                >
                                                    <option value="">Select Ledger / Account *</option>

                                                    {/* Work In Process & Accruals */}
                                                    {wipAndAccruals.length > 0 && (
                                                        <optgroup label="🏗️ Work In Process & Accruals (Contracting / Milestones)">
                                                            {wipAndAccruals.map(a => (
                                                                <option key={a.id} value={a.id}>
                                                                    [{a.code}] {a.name}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}

                                                    {/* Sales & Revenue Ledgers */}
                                                    <optgroup label="📈 Sales & Revenue Accounts">
                                                        {incomeAccounts.map(a => (
                                                            <option key={a.id} value={a.id}>
                                                                [{a.code}] {a.name}
                                                            </option>
                                                        ))}
                                                    </optgroup>

                                                    {/* Customer Advances & Liabilities */}
                                                    {liabilityAccounts.length > 0 && (
                                                        <optgroup label="⚖️ Customer Advances & Liabilities">
                                                            {liabilityAccounts.map(a => (
                                                                <option key={a.id} value={a.id}>
                                                                    [{a.code}] {a.name} {a.subtype ? `(${a.subtype})` : ''}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}

                                                    {/* Asset Accounts */}
                                                    {assetAccounts.length > 0 && (
                                                        <optgroup label="💼 Asset Accounts (Equipment, Scrap, Disposal)">
                                                            {assetAccounts.map(a => (
                                                                <option key={a.id} value={a.id}>
                                                                    [{a.code}] {a.name} {a.subtype ? `(${a.subtype})` : ''}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}

                                                    {/* Other Accounts */}
                                                    {otherAccounts.length > 0 && (
                                                        <optgroup label="📋 Other General Ledgers">
                                                            {otherAccounts.map(a => (
                                                                <option key={a.id} value={a.id}>
                                                                    [{a.code}] {a.name}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                </select>
                                            </div>
                                            <div className="w-full md:flex-1 min-w-[150px]">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Narration</label>
                                                <input
                                                    type="text"
                                                    value={line.description || ''}
                                                    onChange={e => handleLineChange(idx, 'description', e.target.value)}
                                                    disabled={viewMode}
                                                    placeholder="e.g. Milestone 1 / WIP Progress / Service note"
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
                                                            {(!line.account_category || line.account_category === 'all' || line.account_category === 'asset') && wipAndAccruals.length > 0 && (
                                                                <optgroup label="🏗️ Work In Process & Accruals (WIP 1410, Accrued Income 1210)">
                                                                    {wipAndAccruals.map(a => (
                                                                        <option key={a.id} value={a.id}>
                                                                            [{a.code}] {a.name} {a.subtype ? `(${a.subtype})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
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
                            <button className={`w-full py-3 ${moveType === 'out_refund' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'} text-white rounded-xl font-bold shadow-lg transition-all`}>
                                {viewMode ? "Close" : (editMode ? "Save Changes" : (moveType === 'out_refund' ? "Create Sales Return / Credit Note" : "Create Invoice"))}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Quick Add Stock Item Modal (Tally-style Alt+C inline creation) */}
            {isQuickItemModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-r from-blue-50 to-indigo-50/30 dark:from-zinc-800/80 dark:to-zinc-800/40">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        Quick Add Stock Item
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded font-semibold">
                                            Alt+C
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500">Define a new stock product & immediately select it in this invoice line.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsQuickItemModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveQuickItem} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                        Item Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        placeholder="e.g. Galvanized Pipe 2 inch, Hydraulic Valve 50mm"
                                        value={quickItemForm.name}
                                        onChange={e => setQuickItemForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                        Item Code / SKU *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. ITM-0091"
                                        value={quickItemForm.code}
                                        onChange={e => setQuickItemForm(prev => ({ ...prev, code: e.target.value }))}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                        Unit of Measure (UOM) *
                                    </label>
                                    <select
                                        value={quickItemForm.uom}
                                        onChange={e => setQuickItemForm(prev => ({ ...prev, uom: e.target.value }))}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="PCS">PCS (Pieces)</option>
                                        <option value="UNIT">UNIT (Units)</option>
                                        <option value="MTR">MTR (Meters)</option>
                                        <option value="KG">KG (Kilograms)</option>
                                        <option value="BOX">BOX (Boxes)</option>
                                        <option value="SET">SET (Sets)</option>
                                        <option value="LOT">LOT (Lots)</option>
                                        <option value="SQM">SQM (Square Meters)</option>
                                        <option value="LTR">LTR (Liters)</option>
                                        <option value="HRS">HRS (Hours)</option>
                                        <option value="PKT">PKT (Packets)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                        Category
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Finished Goods, Spare Parts, Consumables"
                                        value={quickItemForm.category}
                                        onChange={e => setQuickItemForm(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                        Selling / Standard Rate (QAR)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">QAR</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={quickItemForm.standard_cost}
                                            onChange={e => setQuickItemForm(prev => ({ ...prev, standard_cost: e.target.value }))}
                                            className="w-full pl-11 p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                        Default Sales / Income Account
                                    </label>
                                    <select
                                        value={quickItemForm.income_account_id}
                                        onChange={e => setQuickItemForm(prev => ({ ...prev, income_account_id: e.target.value }))}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">-- Use Default Sales Account --</option>
                                        {incomeAccounts.map(a => (
                                            <option key={a.id} value={a.id}>
                                                [{a.code}] {a.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                        Description / Specification (Optional)
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="Item description, grade, technical specifications..."
                                        value={quickItemForm.description}
                                        onChange={e => setQuickItemForm(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    Saved item will be auto-selected in invoice line
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsQuickItemModalOpen(false)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={quickItemSaving}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                    >
                                        {quickItemSaving ? 'Saving...' : 'Save & Select in Invoice'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
