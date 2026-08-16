import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
    Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, CheckCircle, Clock,
    BookOpen, Users, Trash2, Split, Building2, CreditCard, AlertCircle,
    CheckCircle2, ChevronDown, ChevronRight, Layers, FileSpreadsheet, ArrowRight
} from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { PrintButton } from '../../ui/PrintButton';

interface ExpenseLine {
    id: string;
    account_id: string;
    partner_id?: string;
    notes?: string;
    amount: string | number;
}

interface BankLine {
    id: string;
    journal_id: string;
    bank_name?: string;
    bank_account?: string;
    reference?: string;
    amount: string | number;
}

export const Payments: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('ALL');

    // Masters
    const [partners, setPartners] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]); // Bank/Cash Journals
    const [accounts, setAccounts] = useState<any[]>([]); // Chart of accounts ledgers
    const [bankConfigs, setBankConfigs] = useState<any[]>([]); // Org Bank Configurations

    // Form Header State
    const [paymentNumber, setPaymentNumber] = useState(''); // Custom voucher / reference number
    const [paymentCategory, setPaymentCategory] = useState<'partner' | 'direct_account'>('direct_account');
    const [paymentType, setPaymentType] = useState('outbound'); // inbound (Money In), outbound (Money Out)
    const [selectedPartner, setSelectedPartner] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    // Multi-line Dynamic Form States
    const [expenseLines, setExpenseLines] = useState<ExpenseLine[]>([
        { id: 'exp-1', account_id: '', partner_id: '', notes: '', amount: '' }
    ]);
    const [bankLines, setBankLines] = useState<BankLine[]>([
        { id: 'bnk-1', journal_id: '', bank_name: '', bank_account: '', reference: '', amount: '' }
    ]);

    // Edit/View State
    const [editMode, setEditMode] = useState(false);
    const [viewMode, setViewMode] = useState(false);
    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
    const [viewingPayment, setViewingPayment] = useState<any>(null);

    useEffect(() => {
        if (currentCompanyId) {
            fetchPayments();
            fetchMasters();
        }
    }, [currentCompanyId]);

    const fetchPayments = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('accounting_payments')
            .select(`
                *,
                partner:accounting_partners(name),
                account:accounting_chart_of_accounts!account_id(code, name, type),
                journal:accounting_journals!accounting_journal_id(code, name, type)
            `)
            .eq('company_id', currentCompanyId)
            .order('date', { ascending: false });

        if (error) console.error('Error fetching payments:', error);
        else setPayments(data || []);
        setLoading(false);
    };

    const fetchMasters = async () => {
        if (!currentCompanyId) return;
        try {
            const [pRes, jRes, aRes, bRes] = await Promise.all([
                supabase.from('accounting_partners').select('id, name, partner_type').eq('company_id', currentCompanyId).order('name'),
                supabase.from('accounting_journals').select('id, name, type, code').eq('company_id', currentCompanyId).in('type', ['Bank', 'Cash']).order('name'),
                supabase.from('accounting_chart_of_accounts').select('id, code, name, type, subtype').eq('company_id', currentCompanyId).eq('is_active', true).order('code'),
                supabase.from('org_bank_configs').select('id, name, bank_name, code').eq('company_id', currentCompanyId).order('name')
            ]);

            setPartners(pRes.data || []);
            const fetchedJournals = jRes.data || [];
            setJournals(fetchedJournals);
            setAccounts((aRes.data || []).filter((a: any) => !a.is_group));
            setBankConfigs(bRes.data || []);
        } catch (e) {
            console.error('Error fetching masters:', e);
        }
    };

    const presetBanks = [
        'QNB (Qatar National Bank)',
        'CBQ (Commercial Bank of Qatar)',
        'QIB (Qatar Islamic Bank)',
        'Doha Bank',
        'Masraf Al Rayan',
        'Dukhan Bank',
        'Ahlibank',
        'HSBC Bank Qatar',
        'International Bank of Qatar (IBQ)',
        'Qatar International Islamic Bank (QIIB)'
    ];

    const availableBankNames = useMemo(() => {
        return Array.from(
            new Set([
                ...bankConfigs.map(b => b.bank_name || b.name).filter(Boolean),
                ...presetBanks
            ])
        );
    }, [bankConfigs]);

    const bankAccountsFromCOA = useMemo(() => {
        return accounts.filter(a => a.subtype === 'Bank' || (a.name || '').toLowerCase().includes('bank'));
    }, [accounts]);

    // Calculate dynamic totals
    const totalExpenseAmount = useMemo(() => {
        return expenseLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    }, [expenseLines]);

    const totalBankAmount = useMemo(() => {
        return bankLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    }, [bankLines]);

    const balanceDifference = useMemo(() => {
        return Math.round((totalExpenseAmount - totalBankAmount) * 100) / 100;
    }, [totalExpenseAmount, totalBankAmount]);

    const isBalanced = useMemo(() => {
        if (paymentCategory === 'partner' && expenseLines.length === 0) {
            return totalBankAmount > 0;
        }
        return totalExpenseAmount > 0 && Math.abs(balanceDifference) < 0.001;
    }, [paymentCategory, expenseLines, totalExpenseAmount, totalBankAmount, balanceDifference]);

    // Multi-Line Handlers: Expense Lines
    const handleAddExpenseLine = () => {
        const remaining = totalBankAmount > totalExpenseAmount ? (totalBankAmount - totalExpenseAmount).toFixed(2) : '';
        setExpenseLines(prev => [
            ...prev,
            { id: `exp-${Date.now()}-${Math.random()}`, account_id: '', partner_id: selectedPartner || '', notes: '', amount: remaining }
        ]);
    };

    const handleUpdateExpenseLine = (index: number, field: keyof ExpenseLine, value: any) => {
        setExpenseLines(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            
            // If there's only 1 expense line and 1 bank line, sync amounts automatically for convenience
            if (field === 'amount' && copy.length === 1 && bankLines.length === 1) {
                setBankLines(bPrev => {
                    const bCopy = [...bPrev];
                    bCopy[0] = { ...bCopy[0], amount: value };
                    return bCopy;
                });
            }
            return copy;
        });
    };

    const handleRemoveExpenseLine = (index: number) => {
        if (expenseLines.length <= 1) return;
        setExpenseLines(prev => prev.filter((_, i) => i !== index));
    };

    // Multi-Line Handlers: Bank Lines
    const handleAddBankLine = () => {
        const defaultJournalId = journals.length > 0 ? journals[0].id : '';
        const remaining = totalExpenseAmount > totalBankAmount ? (totalExpenseAmount - totalBankAmount).toFixed(2) : '';
        setBankLines(prev => [
            ...prev,
            {
                id: `bnk-${Date.now()}-${Math.random()}`,
                journal_id: defaultJournalId,
                bank_name: '',
                bank_account: '',
                reference: '',
                amount: remaining
            }
        ]);
    };

    const handleUpdateBankLine = (index: number, field: keyof BankLine, value: any) => {
        setBankLines(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };

            // If only 1 bank line and 1 expense line, sync amounts
            if (field === 'amount' && copy.length === 1 && expenseLines.length === 1) {
                setExpenseLines(ePrev => {
                    const eCopy = [...ePrev];
                    eCopy[0] = { ...eCopy[0], amount: value };
                    return eCopy;
                });
            }
            return copy;
        });
    };

    const handleRemoveBankLine = (index: number) => {
        if (bankLines.length <= 1) return;
        setBankLines(prev => prev.filter((_, i) => i !== index));
    };

    // Auto-balance helper
    const handleAutoBalance = () => {
        if (balanceDifference > 0) {
            // Expenses > Bank: add difference to the last bank line
            setBankLines(prev => {
                const copy = [...prev];
                const lastIdx = copy.length - 1;
                const cur = Number(copy[lastIdx].amount) || 0;
                copy[lastIdx] = { ...copy[lastIdx], amount: (cur + balanceDifference).toFixed(2) };
                return copy;
            });
        } else if (balanceDifference < 0) {
            // Bank > Expenses: add difference to the last expense line
            setExpenseLines(prev => {
                const copy = [...prev];
                const lastIdx = copy.length - 1;
                const cur = Number(copy[lastIdx].amount) || 0;
                copy[lastIdx] = { ...copy[lastIdx], amount: (cur + Math.abs(balanceDifference)).toFixed(2) };
                return copy;
            });
        }
    };

    const handleOpenModal = (pay?: any, readonly = false) => {
        const defaultJournalId = journals.length > 0 ? journals[0].id : '';

        if (pay) {
            setEditingPaymentId(pay.id);
            setViewingPayment(pay);
            setPaymentNumber(pay.name || '');
            setPaymentCategory(pay.payment_category === 'direct_account' || pay.account_id ? 'direct_account' : 'partner');
            setPaymentType(pay.payment_type || 'outbound');
            setSelectedPartner(pay.partner_id || '');
            setDate(pay.date || new Date().toISOString().split('T')[0]);
            setNotes(pay.notes || '');

            // Load multi-expense lines or fallback to single legacy record
            if (pay.expense_lines && Array.isArray(pay.expense_lines) && pay.expense_lines.length > 0) {
                setExpenseLines(pay.expense_lines.map((l: any, idx: number) => ({
                    id: l.id || `exp-${idx}`,
                    account_id: l.account_id || '',
                    partner_id: l.partner_id || '',
                    notes: l.notes || '',
                    amount: l.amount || ''
                })));
            } else {
                setExpenseLines([{
                    id: 'exp-1',
                    account_id: pay.account_id || '',
                    partner_id: pay.partner_id || '',
                    notes: '',
                    amount: pay.amount || ''
                }]);
            }

            // Load multi-bank lines or fallback to single legacy record
            if (pay.bank_lines && Array.isArray(pay.bank_lines) && pay.bank_lines.length > 0) {
                setBankLines(pay.bank_lines.map((l: any, idx: number) => ({
                    id: l.id || `bnk-${idx}`,
                    journal_id: l.journal_id || defaultJournalId,
                    bank_name: l.bank_name || '',
                    bank_account: l.bank_account || '',
                    reference: l.reference || '',
                    amount: l.amount || ''
                })));
            } else {
                setBankLines([{
                    id: 'bnk-1',
                    journal_id: pay.accounting_journal_id || pay.journal_id || defaultJournalId,
                    bank_name: pay.bank_name || '',
                    bank_account: pay.bank_account || '',
                    reference: '',
                    amount: pay.amount || ''
                }]);
            }

            setEditMode(!readonly);
            setViewMode(readonly);
            setIsModalOpen(true);
        } else {
            setEditingPaymentId(null);
            setViewingPayment(null);
            setPaymentNumber('');
            setPaymentCategory('direct_account');
            setPaymentType('outbound');
            setSelectedPartner('');
            setDate(new Date().toISOString().split('T')[0]);
            setNotes('');

            setExpenseLines([{
                id: `exp-${Date.now()}`,
                account_id: '',
                partner_id: '',
                notes: '',
                amount: ''
            }]);

            setBankLines([{
                id: `bnk-${Date.now()}`,
                journal_id: defaultJournalId,
                bank_name: '',
                bank_account: '',
                reference: '',
                amount: ''
            }]);

            setEditMode(false);
            setViewMode(false);
            setIsModalOpen(true);
        }
    };

    const handleSavePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (viewMode) {
            setIsModalOpen(false);
            return;
        }
        if (!currentCompanyId) return alert('No company context');

        try {
            // Validation
            if (paymentCategory === 'direct_account') {
                if (expenseLines.length === 0) throw new Error('Please add at least one Expense/Account Ledger line.');
                for (let i = 0; i < expenseLines.length; i++) {
                    const el = expenseLines[i];
                    if (!el.account_id) throw new Error(`Expense Line #${i + 1}: Please select an Account Ledger.`);
                    if (!el.amount || Number(el.amount) <= 0) throw new Error(`Expense Line #${i + 1}: Amount must be greater than 0.`);
                }
            } else {
                if (!selectedPartner) throw new Error('Please select a Partner for Party Payment.');
            }

            if (bankLines.length === 0) throw new Error('Please add at least one Bank/Cash payment source.');
            for (let i = 0; i < bankLines.length; i++) {
                const bl = bankLines[i];
                if (!bl.journal_id) throw new Error(`Bank Line #${i + 1}: Please select a Bank/Cash Journal.`);
                if (!bl.amount || Number(bl.amount) <= 0) throw new Error(`Bank Line #${i + 1}: Amount must be greater than 0.`);

                const journalObj = journals.find(j => j.id === bl.journal_id);
                const isBank = journalObj ? (journalObj.type === 'Bank' || (journalObj.name || '').toLowerCase().includes('bank')) : false;
                if (isBank && !bl.bank_name) {
                    throw new Error(`Bank Line #${i + 1}: Please select a Bank for Bank Journal.`);
                }
            }

            // Verify Balance
            if (paymentCategory === 'direct_account' && Math.abs(balanceDifference) > 0.001) {
                throw new Error(`Voucher is unbalanced. Total Expenses (QAR ${totalExpenseAmount.toFixed(2)}) must equal Total Bank/Payment (QAR ${totalBankAmount.toFixed(2)}). Difference: QAR ${balanceDifference.toFixed(2)}`);
            }

            const totalVoucherAmount = paymentCategory === 'direct_account' ? totalExpenseAmount : totalBankAmount;
            const primaryExpense = expenseLines[0];
            const primaryBank = bankLines[0];

            const trimmedVoucher = paymentNumber.trim();
            if (trimmedVoucher) {
                const { data: existingPay } = await supabase
                    .from('accounting_payments')
                    .select('id')
                    .eq('company_id', currentCompanyId)
                    .eq('name', trimmedVoucher)
                    .neq('id', editingPaymentId || '00000000-0000-0000-0000-000000000000')
                    .maybeSingle();

                if (existingPay) {
                    alert(`Voucher / Reference number "${trimmedVoucher}" already exists in your company. Please choose a unique reference.`);
                    return;
                }
            }

            const formattedExpenseLines = expenseLines.map(el => ({
                id: el.id,
                account_id: el.account_id,
                partner_id: el.partner_id || selectedPartner || null,
                notes: el.notes || null,
                amount: Number(el.amount)
            }));

            const formattedBankLines = bankLines.map(bl => ({
                id: bl.id,
                journal_id: bl.journal_id,
                bank_name: bl.bank_name || null,
                bank_account: bl.bank_account || null,
                reference: bl.reference || null,
                amount: Number(bl.amount)
            }));

            const payload: any = {
                company_id: currentCompanyId,
                name: trimmedVoucher || null,
                payment_category: paymentCategory,
                payment_type: paymentType,
                partner_type: paymentType === 'inbound' ? 'customer' : 'vendor',
                partner_id: selectedPartner ? String(selectedPartner).trim() : null,
                account_id: primaryExpense?.account_id ? String(primaryExpense.account_id).trim() : null,
                amount: totalVoucherAmount,
                date: date,
                accounting_journal_id: primaryBank?.journal_id ? String(primaryBank.journal_id).trim() : null,
                bank_name: primaryBank?.bank_name || null,
                bank_account: primaryBank?.bank_account || null,
                expense_lines: formattedExpenseLines,
                bank_lines: formattedBankLines,
                notes: notes ? notes.trim() : null,
                state: 'draft'
            };

            if (editMode && editingPaymentId) {
                const { error } = await supabase
                    .from('accounting_payments')
                    .update(payload)
                    .eq('id', editingPaymentId);

                if (error) throw error;
                alert('Payment Voucher Updated successfully!');
            } else {
                const { error } = await supabase.from('accounting_payments').insert([payload]);
                if (error) throw error;
                alert('Payment Voucher Created successfully!');
            }

            setIsModalOpen(false);
            fetchPayments();

        } catch (err: any) {
            console.error('Save error:', err);
            if (err.code === '23505' || err.message?.includes('duplicate key')) {
                alert('A payment with this reference number already exists in your company.');
            } else {
                alert('Error saving payment: ' + (err.message || 'Failed to save payment'));
            }
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this draft payment? This action cannot be undone.')) return;

        const { error } = await supabase
            .from('accounting_payments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(error);
            alert('Error deleting payment: ' + error.message);
        } else {
            alert('Payment deleted successfully');
            fetchPayments();
        }
    };

    const handlePost = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Confirm Post? This will generate balanced double-entry Journal Entries in the General Ledger.')) return;

        const { error } = await supabase.rpc('rpc_post_accounting_payment', { p_payment_id: id });
        if (error) {
            console.error('Post error:', error);
            alert('Error posting payment: ' + error.message);
        } else {
            alert('Payment successfully posted to the General Ledger!');
            fetchPayments();
        }
    };

    // Filtered Payments List
    const filteredPayments = useMemo(() => {
        return payments.filter(pay => {
            const matchesSearch = !searchQuery ||
                (pay.name && pay.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (pay.partner?.name && pay.partner.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (pay.account?.name && pay.account.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (pay.notes && pay.notes.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;
            if (filterCategory === 'DIRECT') return pay.payment_category === 'direct_account' || pay.account_id;
            if (filterCategory === 'PARTY') return pay.payment_category === 'partner' && !pay.account_id;
            if (filterCategory === 'POSTED') return pay.state === 'posted';
            if (filterCategory === 'DRAFT') return pay.state === 'draft';
            return true;
        });
    }, [payments, searchQuery, filterCategory]);

    return (
        <div className="space-y-6">
            {/* Top Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Payments & Vouchers</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Register multi-expense payment vouchers, multi-bank split disbursements, party payments, and receipts.
                    </p>
                </div>
                <div className="flex items-center gap-3 no-print w-full sm:w-auto">
                    <PrintButton />
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        New Payment Voucher
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search voucher #, partner, ledger..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
                    {[
                        { id: 'ALL', label: 'All Payments' },
                        { id: 'DIRECT', label: 'Expense / Ledgers' },
                        { id: 'PARTY', label: 'Party Payments' },
                        { id: 'DRAFT', label: 'Draft' },
                        { id: 'POSTED', label: 'Posted' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterCategory(tab.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                filterCategory === tab.id
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-5 py-3.5">Date</th>
                                <th className="px-5 py-3.5">Voucher / Ref #</th>
                                <th className="px-5 py-3.5">Type & Mode</th>
                                <th className="px-5 py-3.5">Expense / Account Allocation</th>
                                <th className="px-5 py-3.5">Bank / Payment Source</th>
                                <th className="px-5 py-3.5 text-right font-black">Amount</th>
                                <th className="px-5 py-3.5 text-center">Status</th>
                                <th className="px-5 py-3.5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-semibold">Loading payment vouchers...</td></tr>
                            ) : filteredPayments.length === 0 ? (
                                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-semibold">No payment vouchers found.</td></tr>
                            ) : filteredPayments.map(pay => {
                                const isDirect = pay.payment_category === 'direct_account' || !!pay.account_id;
                                const multiExp = pay.expense_lines && Array.isArray(pay.expense_lines) && pay.expense_lines.length > 1;
                                const multiBnk = pay.bank_lines && Array.isArray(pay.bank_lines) && pay.bank_lines.length > 1;

                                const displayName = isDirect
                                    ? (multiExp 
                                        ? `Split Expense (${pay.expense_lines.length} Ledgers)`
                                        : (pay.account ? `${pay.account.code} - ${pay.account.name}` : 'Expense Ledger'))
                                    : (pay.partner?.name || 'Party Payment');

                                const partnerSubtext = isDirect && pay.partner?.name ? ` (Partner: ${pay.partner.name})` : '';

                                return (
                                    <tr key={pay.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400 font-semibold whitespace-nowrap">{pay.date}</td>
                                        <td className="px-5 py-4 font-mono font-bold text-slate-900 dark:text-white">
                                            {pay.name || `PAY-${pay.id.slice(0, 5).toUpperCase()}`}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    pay.payment_type === 'inbound'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                                }`}>
                                                    {pay.payment_type === 'inbound' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                                    {pay.payment_type === 'inbound' ? 'Money In (Receipt)' : 'Money Out (Payment)'}
                                                </span>
                                                <span className="text-[11px] text-slate-500 font-medium">
                                                    {isDirect ? 'Direct Ledger' : 'Party'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                {multiExp && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 rounded text-[10px] font-extrabold">MULTI</span>}
                                                <span>{displayName}</span>
                                            </div>
                                            {partnerSubtext && <div className="text-[11px] text-slate-400 font-normal">{partnerSubtext}</div>}
                                            {pay.notes && <div className="text-[10px] text-slate-400 italic truncate max-w-xs">{pay.notes}</div>}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                {multiBnk && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded text-[10px] font-extrabold">MULTI</span>}
                                                <span>{multiBnk ? `Split Payment (${pay.bank_lines.length} Accounts)` : (pay.journal?.code || 'Bank/Cash')}</span>
                                            </div>
                                            {!multiBnk && pay.bank_name && (
                                                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5 flex items-center gap-1">
                                                    <span>🏦 {pay.bank_name}{pay.bank_account ? ` (${pay.bank_account})` : ''}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className={`px-5 py-4 text-right font-black text-sm ${pay.payment_type === 'inbound' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                                            QAR {Number(pay.amount).toFixed(2)}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                pay.state === 'posted'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                            }`}>
                                                {pay.state === 'posted' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                {pay.state === 'posted' ? 'Posted' : 'Draft'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="flex gap-1.5 justify-center items-center">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(pay, true); }}
                                                    className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors"
                                                >
                                                    View
                                                </button>
                                                {pay.state === 'draft' && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(pay, false); }}
                                                            className="px-2.5 py-1 text-xs font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDelete(pay.id, e)}
                                                            className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                                            title="Delete Draft"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handlePost(pay.id, e)}
                                                            className="px-3 py-1 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
                                                        >
                                                            POST
                                                        </button>
                                                    </>
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

            {/* Create / Edit / View Modal */}
            {isModalOpen && (
                <Modal
                    title={viewMode ? "Payment Voucher Summary" : (editMode ? "Edit Payment Voucher" : "Register Payment Voucher")}
                    onClose={() => setIsModalOpen(false)}
                >
                    <form onSubmit={handleSavePayment} className="space-y-6">
                        
                        {/* Header Mode Controls */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700">
                            {/* Inbound vs Outbound */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Payment Flow</label>
                                <div className="flex gap-2 p-1 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentType('inbound')}
                                        disabled={viewMode}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                            paymentType === 'inbound'
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                        }`}
                                    >
                                        Money In (Receipt)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentType('outbound')}
                                        disabled={viewMode}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                            paymentType === 'outbound'
                                                ? 'bg-rose-600 text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                        }`}
                                    >
                                        Money Out (Vendor/Expense)
                                    </button>
                                </div>
                            </div>

                            {/* Party vs Direct Account */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Counterpart Category</label>
                                <div className="flex gap-2 p-1 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentCategory('direct_account')}
                                        disabled={viewMode}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                            paymentCategory === 'direct_account'
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                        }`}
                                    >
                                        Expense / Account Ledgers
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentCategory('partner')}
                                        disabled={viewMode}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                            paymentCategory === 'partner'
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                        }`}
                                    >
                                        Party Payment (Vendor/Customer)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Voucher Metadata Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                    Voucher / Ref No. <span className="text-slate-400 font-normal">(e.g. PBV.3937.7)</span>
                                </label>
                                <input
                                    type="text"
                                    value={paymentNumber}
                                    onChange={e => setPaymentNumber(e.target.value)}
                                    disabled={viewMode}
                                    placeholder="Auto-generated if empty"
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                    Payment Date <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                    Partner Tag {paymentCategory === 'partner' ? <span className="text-rose-500">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
                                </label>
                                <select
                                    required={paymentCategory === 'partner'}
                                    value={selectedPartner}
                                    onChange={e => setSelectedPartner(e.target.value)}
                                    disabled={viewMode}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold"
                                >
                                    <option value="">Select Partner / Vendor / Customer</option>
                                    {partners.map(p => <option key={p.id} value={p.id}>{p.name} ({p.partner_type})</option>)}
                                </select>
                            </div>
                        </div>

                        {/* SECTION 1: EXPENSE / ACCOUNT LEDGERS (MULTI-LINE) */}
                        {paymentCategory === 'direct_account' && (
                            <div className="space-y-3 p-4 bg-purple-50/40 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/30 rounded-2xl">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-purple-600" />
                                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                            Expense & Account Allocation ({expenseLines.length} {expenseLines.length === 1 ? 'item' : 'items'})
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                                            Total Expenses: <strong>QAR {totalExpenseAmount.toFixed(2)}</strong>
                                        </span>
                                        {!viewMode && (
                                            <button
                                                type="button"
                                                onClick={handleAddExpenseLine}
                                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Add Expense Ledger
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {expenseLines.map((line, idx) => (
                                        <div
                                            key={line.id}
                                            className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 bg-white dark:bg-zinc-800/90 rounded-xl border border-purple-100 dark:border-purple-900/20 items-center shadow-xs"
                                        >
                                            <div className="sm:col-span-6">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                                                    Expense / Ledger Account #{idx + 1} <span className="text-rose-500">*</span>
                                                </label>
                                                <select
                                                    required
                                                    value={line.account_id}
                                                    onChange={e => handleUpdateExpenseLine(idx, 'account_id', e.target.value)}
                                                    disabled={viewMode}
                                                    className="w-full p-2 bg-slate-50 dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-bold"
                                                >
                                                    <option value="">Select Account Ledger (Rent, Laundry, Salary, Fuel...)</option>
                                                    {accounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.code} - {acc.name} ({acc.type})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="sm:col-span-3">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Line Memo / Notes</label>
                                                <input
                                                    type="text"
                                                    value={line.notes || ''}
                                                    onChange={e => handleUpdateExpenseLine(idx, 'notes', e.target.value)}
                                                    disabled={viewMode}
                                                    placeholder="e.g. Laundry Project A"
                                                    className="w-full p-2 bg-slate-50 dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-medium"
                                                />
                                            </div>

                                            <div className="sm:col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                                                    Amount (QAR) <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    required
                                                    value={line.amount}
                                                    onChange={e => handleUpdateExpenseLine(idx, 'amount', e.target.value)}
                                                    disabled={viewMode}
                                                    placeholder="0.00"
                                                    className="w-full p-2 bg-slate-50 dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-bold text-right text-purple-700 dark:text-purple-300"
                                                />
                                            </div>

                                            <div className="sm:col-span-1 flex justify-center pt-3 sm:pt-0">
                                                {!viewMode && expenseLines.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveExpenseLine(idx)}
                                                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                                        title="Delete Expense Line"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* SECTION 2: BANK / PAYMENT SOURCES (MULTI-LINE) */}
                        <div className="space-y-3 p-4 bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                        Bank & Cash Payment Sources ({bankLines.length} {bankLines.length === 1 ? 'account' : 'accounts'})
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                                        Total Bank/Payment: <strong>QAR {totalBankAmount.toFixed(2)}</strong>
                                    </span>
                                    {!viewMode && (
                                        <button
                                            type="button"
                                            onClick={handleAddBankLine}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Bank / Cash Account
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {bankLines.map((bLine, bIdx) => {
                                    const jObj = journals.find(j => j.id === bLine.journal_id);
                                    const isBank = jObj ? (jObj.type === 'Bank' || (jObj.name || '').toLowerCase().includes('bank')) : false;

                                    return (
                                        <div
                                            key={bLine.id}
                                            className="p-3 bg-white dark:bg-zinc-800/90 rounded-xl border border-blue-100 dark:border-blue-900/20 space-y-2.5 shadow-xs"
                                        >
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                                                {/* Journal */}
                                                <div className="sm:col-span-3">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                                                        Journal #{bIdx + 1} <span className="text-rose-500">*</span>
                                                    </label>
                                                    <select
                                                        required
                                                        value={bLine.journal_id}
                                                        onChange={e => handleUpdateBankLine(bIdx, 'journal_id', e.target.value)}
                                                        disabled={viewMode}
                                                        className="w-full p-2 bg-slate-50 dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-bold"
                                                    >
                                                        <option value="">Select Journal</option>
                                                        {journals.map(j => (
                                                            <option key={j.id} value={j.id}>
                                                                {j.name} ({j.type})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Bank Name (if Bank journal) */}
                                                <div className={isBank ? "sm:col-span-3" : "sm:col-span-3 opacity-40 pointer-events-none"}>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                                                        Bank Name {isBank && <span className="text-rose-500">*</span>}
                                                    </label>
                                                    <select
                                                        required={isBank}
                                                        value={bLine.bank_name || ''}
                                                        onChange={e => handleUpdateBankLine(bIdx, 'bank_name', e.target.value)}
                                                        disabled={viewMode || !isBank}
                                                        className="w-full p-2 bg-slate-50 dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-medium"
                                                    >
                                                        <option value="">Select Bank (QNB, CBQ...)</option>
                                                        {availableBankNames.map(b => (
                                                            <option key={b} value={b}>{b}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Bank Account */}
                                                <div className={isBank ? "sm:col-span-3" : "sm:col-span-3 opacity-40 pointer-events-none"}>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                                                        Bank Account {isBank && <span className="text-rose-500">*</span>}
                                                    </label>
                                                    <select
                                                        required={isBank}
                                                        value={bLine.bank_account || ''}
                                                        onChange={e => handleUpdateBankLine(bIdx, 'bank_account', e.target.value)}
                                                        disabled={viewMode || !isBank}
                                                        className="w-full p-2 bg-slate-50 dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-medium"
                                                    >
                                                        <option value="">Select Bank Account</option>
                                                        {bankAccountsFromCOA.map(acc => (
                                                            <option key={acc.id} value={`${acc.code} - ${acc.name}`}>
                                                                {acc.code} - {acc.name}
                                                            </option>
                                                        ))}
                                                        {bankConfigs.map(b => (
                                                            <option key={`cfg-${b.id}`} value={`${b.name} (${b.code})`}>
                                                                {b.name} ({b.code})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Amount */}
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                                                        Amount (QAR) <span className="text-rose-500">*</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        required
                                                        value={bLine.amount}
                                                        onChange={e => handleUpdateBankLine(bIdx, 'amount', e.target.value)}
                                                        disabled={viewMode}
                                                        placeholder="0.00"
                                                        className="w-full p-2 bg-slate-50 dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-bold text-right text-blue-700 dark:text-blue-300"
                                                    />
                                                </div>

                                                {/* Delete Button */}
                                                <div className="sm:col-span-1 flex justify-center pt-3 sm:pt-0">
                                                    {!viewMode && bankLines.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveBankLine(bIdx)}
                                                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                                            title="Delete Bank Line"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Cheque / Reference No. */}
                                            {isBank && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-zinc-700/40">
                                                    <div>
                                                        <input
                                                            type="text"
                                                            value={bLine.reference || ''}
                                                            onChange={e => handleUpdateBankLine(bIdx, 'reference', e.target.value)}
                                                            disabled={viewMode}
                                                            placeholder="Cheque / TT / Transfer Reference No. (e.g. CHQ-10492)"
                                                            className="w-full p-1.5 bg-slate-50 dark:bg-zinc-700/40 border border-slate-200 dark:border-zinc-600 rounded-lg text-[11px]"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* SECTION 3: BALANCE & VALIDATION SUMMARY */}
                        <div className={`p-4 rounded-2xl border transition-all ${
                            isBalanced
                                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                                : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200'
                        }`}>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="flex items-center gap-2.5">
                                    {isBalanced ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-amber-600 animate-pulse" />
                                    )}
                                    <div>
                                        <h4 className="text-xs font-bold">
                                            {isBalanced
                                                ? `Voucher Balanced: Total QAR ${totalBankAmount.toFixed(2)}`
                                                : `Unbalanced Voucher: Difference of QAR ${Math.abs(balanceDifference).toFixed(2)}`}
                                        </h4>
                                        <p className="text-[11px] opacity-80">
                                            Expenses: <strong>QAR {totalExpenseAmount.toFixed(2)}</strong> | Payment Sources: <strong>QAR {totalBankAmount.toFixed(2)}</strong>
                                        </p>
                                    </div>
                                </div>

                                {!viewMode && !isBalanced && Math.abs(balanceDifference) > 0.001 && (
                                    <button
                                        type="button"
                                        onClick={handleAutoBalance}
                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                                    >
                                        Auto-Balance Difference
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Overall Memo */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Overall Voucher Memo / Notes</label>
                            <input
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                disabled={viewMode}
                                className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium"
                                placeholder="e.g. Operational expenses reimbursement for Project A, Office utilities & supplies..."
                            />
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2 border-t border-slate-200 dark:border-zinc-700">
                            <button
                                type="submit"
                                disabled={!viewMode && !isBalanced}
                                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                                    viewMode
                                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-zinc-700 dark:text-white'
                                        : isBalanced
                                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
                                            : 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600'
                                }`}
                            >
                                {viewMode ? "Close" : (editMode ? "Save Voucher Changes" : "Confirm & Save Payment Voucher")}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
