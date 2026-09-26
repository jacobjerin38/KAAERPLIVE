import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
    Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, CheckCircle, Clock,
    BookOpen, Users, Trash2, Split, Building2, CreditCard, AlertCircle,
    CheckCircle2, ChevronDown, ChevronRight, Layers, FileSpreadsheet, ArrowRight, Tag
} from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { PrintButton } from '../../ui/PrintButton';
import { SearchableSelect, SearchableOption } from '../../ui/SearchableSelect';
import { PeriodFilter, PeriodPreset, getDatesForPreset } from '../common/PeriodFilter';

interface ExpenseLine {
    id: string;
    account_id: string;
    cost_center_id?: string;
    partner_id?: string;
    notes?: string;
    entry_type?: 'debit' | 'credit';
    amount: string | number;
}

interface BankLine {
    id: string;
    journal_id: string;
    bank_name?: string;
    bank_account?: string;
    reference?: string;
    instrument_date?: string;
    amount: string | number;
}

export interface PaymentsProps {
    initialSearch?: string;
    initialId?: string;
    onClearInitial?: () => void;
}

export const Payments: React.FC<PaymentsProps> = ({ initialSearch, initialId, onClearInitial }) => {
    const { currentCompanyId } = useAuth();
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [preset, setPreset] = useState<PeriodPreset>(() => (initialSearch || initialId ? 'all' : 'this_month'));
    const [startDate, setStartDate] = useState<string>(() => {
        if (initialSearch || initialId) return getDatesForPreset('all').startDate;
        return getDatesForPreset('this_month').startDate;
    });
    const [endDate, setEndDate] = useState<string>(() => {
        if (initialSearch || initialId) return getDatesForPreset('all').endDate;
        return getDatesForPreset('this_month').endDate;
    });

    // Masters
    const [partners, setPartners] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]); // Bank/Cash Journals
    const [accounts, setAccounts] = useState<any[]>([]); // Chart of accounts ledgers
    const [bankConfigs, setBankConfigs] = useState<any[]>([]); // Org Bank Configurations
    const [costCenters, setCostCenters] = useState<any[]>([]); // Cost Centers (Projects, Drivers, Staff, etc.)

    // Form Header State
    const [paymentNumber, setPaymentNumber] = useState(''); // Custom voucher / reference number
    const [paymentCategory, setPaymentCategory] = useState<'partner' | 'direct_account'>('direct_account');
    const [paymentType, setPaymentType] = useState('outbound'); // inbound (Money In), outbound (Money Out)
    const [selectedPartner, setSelectedPartner] = useState('');
    const [headerCostCenterId, setHeaderCostCenterId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    // Quick Add Cost Center State
    const [isCostCenterModalOpen, setIsCostCenterModalOpen] = useState(false);
    const [newCostCenterName, setNewCostCenterName] = useState('');
    const [newCostCenterCode, setNewCostCenterCode] = useState('');
    const [newCostCenterType, setNewCostCenterType] = useState<'PROJECT' | 'CONTRACT' | 'GENERIC'>('GENERIC');
    const [newCostCenterTargetIndex, setNewCostCenterTargetIndex] = useState<number | null>(null);
    const [creatingCostCenter, setCreatingCostCenter] = useState(false);

    // Multi-line Dynamic Form States
    const [expenseLines, setExpenseLines] = useState<ExpenseLine[]>([
        { id: 'exp-1', account_id: '', cost_center_id: '', partner_id: '', notes: '', entry_type: 'debit', amount: '' }
    ]);
    const [bankLines, setBankLines] = useState<BankLine[]>([
        { id: 'bnk-1', journal_id: '', bank_name: '', bank_account: '', reference: '', instrument_date: '', amount: '' }
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
                journal:accounting_journals!accounting_journal_id(code, name, type),
                cost_center:accounting_cost_centers!cost_center_id(code, name, type)
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
            const [pRes, jRes, aRes, bRes, ccRes] = await Promise.all([
                supabase.from('accounting_partners').select('id, name, partner_type, property_account_receivable_id, property_account_payable_id').eq('company_id', currentCompanyId).order('name'),
                supabase.from('accounting_journals').select('id, name, type, code').eq('company_id', currentCompanyId).in('type', ['Bank', 'Cash']).order('name'),
                supabase.from('accounting_chart_of_accounts').select('id, code, name, type, subtype, is_group, is_active').eq('company_id', currentCompanyId).eq('is_active', true).eq('is_group', false).order('code'),
                supabase.from('org_bank_configs').select('id, name, bank_name, code').eq('company_id', currentCompanyId).order('name'),
                supabase.from('accounting_cost_centers').select('id, code, name, type, is_active').eq('company_id', currentCompanyId).eq('is_active', true).order('name')
            ]);

            setPartners(pRes.data || []);
            const fetchedJournals = jRes.data || [];
            setJournals(fetchedJournals);
            setAccounts((aRes.data || []).filter((a: any) => !a.is_group && a.is_active !== false));
            setBankConfigs(bRes.data || []);
            setCostCenters(ccRes.data || []);
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

    const accountOptions = useMemo<SearchableOption[]>(() => {
        return accounts.map(acc => ({
            value: acc.id,
            code: acc.code,
            label: acc.name,
            type: acc.type
        }));
    }, [accounts]);

    const partnerOptions = useMemo<SearchableOption[]>(() => {
        return partners.map(p => ({
            value: p.id,
            label: p.name,
            type: p.partner_type
        }));
    }, [partners]);

    const costCenterOptions = useMemo<SearchableOption[]>(() => {
        return costCenters.map(cc => {
            let category = 'General';
            if (cc.type === 'PROJECT') category = 'Project';
            else if (cc.type === 'CONTRACT') category = 'Contract';
            else if (cc.code?.toUpperCase().includes('DRIVER') || cc.name?.toLowerCase().includes('driver')) category = 'Driver';
            else if (cc.code?.toUpperCase().includes('VEHICLE') || cc.name?.toLowerCase().includes('corolla') || cc.name?.toLowerCase().includes('toyota') || cc.name?.toLowerCase().includes('vehicle')) category = 'Vehicle';
            else if (cc.code?.toUpperCase().includes('SALES') || cc.name?.toLowerCase().includes('sales') || cc.name?.toLowerCase().includes('developer')) category = 'Sales / Staff';

            return {
                value: cc.id,
                code: cc.code,
                label: cc.name,
                type: category,
                sublabel: cc.code ? `[${category}] ${cc.code}` : `[${category}]`
            };
        });
    }, [costCenters]);

    const bankAccountOptions = useMemo<SearchableOption[]>(() => {
        const list: SearchableOption[] = [];
        bankAccountsFromCOA.forEach(acc => {
            list.push({
                value: `${acc.code} - ${acc.name}`,
                code: acc.code,
                label: acc.name,
                type: 'COA'
            });
        });
        bankConfigs.forEach(b => {
            const val = `${b.name} (${b.code})`;
            if (!list.some(item => item.value === val)) {
                list.push({
                    value: val,
                    code: b.code,
                    label: b.name,
                    type: 'Org Bank'
                });
            }
        });
        return list;
    }, [bankAccountsFromCOA, bankConfigs]);

    // Calculate dynamic totals (handling Debits and Credit Deductions)
    const totalExpenseDebits = useMemo(() => {
        return expenseLines.reduce((sum, l) => {
            const raw = Number(l.amount) || 0;
            const isCredit = l.entry_type === 'credit' || raw < 0;
            return isCredit ? sum : sum + Math.abs(raw);
        }, 0);
    }, [expenseLines]);

    const totalExpenseCredits = useMemo(() => {
        return expenseLines.reduce((sum, l) => {
            const raw = Number(l.amount) || 0;
            const isCredit = l.entry_type === 'credit' || raw < 0;
            return isCredit ? sum + Math.abs(raw) : sum;
        }, 0);
    }, [expenseLines]);

    const totalExpenseAmount = useMemo(() => {
        if (paymentType === 'inbound') {
            // Inbound Receipt: Credit lines are revenue/receipts; Debit lines are deductions/charges
            return Math.round((totalExpenseCredits - totalExpenseDebits) * 100) / 100;
        }
        // Outbound Payment: Debit lines are expenses; Credit lines are deductions
        return Math.round((totalExpenseDebits - totalExpenseCredits) * 100) / 100;
    }, [paymentType, totalExpenseDebits, totalExpenseCredits]);

    const totalBankAmount = useMemo(() => {
        return bankLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    }, [bankLines]);

    const balanceDifference = useMemo(() => {
        return Math.round((totalExpenseAmount - totalBankAmount) * 100) / 100;
    }, [totalExpenseAmount, totalBankAmount]);

    const isBalanced = useMemo(() => {
        if (paymentCategory === 'partner') {
            return !!selectedPartner && totalBankAmount > 0;
        }
        return totalExpenseAmount > 0 && Math.abs(balanceDifference) < 0.001;
    }, [paymentCategory, selectedPartner, totalExpenseAmount, totalBankAmount, balanceDifference]);

    // Multi-Line Handlers: Expense Lines
    const handleAddExpenseLine = () => {
        const remaining = totalBankAmount > totalExpenseAmount ? (totalBankAmount - totalExpenseAmount).toFixed(2) : '';
        setExpenseLines(prev => [
            ...prev,
            {
                id: `exp-${Date.now()}-${Math.random()}`,
                account_id: '',
                cost_center_id: headerCostCenterId || '',
                partner_id: selectedPartner || '',
                notes: '',
                entry_type: paymentType === 'inbound' ? 'credit' : 'debit',
                amount: remaining
            }
        ]);
    };

    const handleUpdateExpenseLine = (index: number, field: keyof ExpenseLine, value: any) => {
        setExpenseLines(prev => {
            const copy = [...prev];
            const updated = { ...copy[index], [field]: value };

            if (field === 'entry_type') {
                const curAmt = Number(updated.amount);
                if (!isNaN(curAmt) && curAmt !== 0) {
                    if (paymentType === 'inbound') {
                        // For inbound receipt: credit is normal (+), debit is deduction (-)
                        updated.amount = value === 'debit' ? -Math.abs(curAmt) : Math.abs(curAmt);
                    } else {
                        // For outbound payment: debit is normal (+), credit is deduction (-)
                        updated.amount = value === 'credit' ? -Math.abs(curAmt) : Math.abs(curAmt);
                    }
                }
            } else if (field === 'amount') {
                const curAmt = Number(value);
                if (!isNaN(curAmt) && curAmt < 0) {
                    updated.entry_type = paymentType === 'inbound' ? 'debit' : 'credit';
                }
            }

            copy[index] = updated;
            
            // If there's only 1 expense line and 1 bank line, sync amounts automatically for convenience
            if (field === 'amount' && copy.length === 1 && bankLines.length === 1) {
                setBankLines(bPrev => {
                    const bCopy = [...bPrev];
                    bCopy[0] = { ...bCopy[0], amount: Math.abs(Number(value) || 0) };
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
                instrument_date: date || new Date().toISOString().split('T')[0],
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
            // Net Allocation > Bank: add difference to the last bank line
            setBankLines(prev => {
                const copy = [...prev];
                const lastIdx = copy.length - 1;
                const cur = Number(copy[lastIdx].amount) || 0;
                copy[lastIdx] = { ...copy[lastIdx], amount: (cur + balanceDifference).toFixed(2) };
                return copy;
            });
        } else if (balanceDifference < 0) {
            // Bank > Net Allocation: add difference to the last allocation line
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
            setHeaderCostCenterId(pay.cost_center_id || '');
            setDate(pay.date || new Date().toISOString().split('T')[0]);
            setNotes(pay.notes || '');

            const isPayInbound = (pay.payment_type || 'outbound') === 'inbound';

            // Load multi-expense lines or fallback to single legacy record
            if (pay.expense_lines && Array.isArray(pay.expense_lines) && pay.expense_lines.length > 0) {
                setExpenseLines(pay.expense_lines.map((l: any, idx: number) => {
                    const rawAmt = l.amount !== undefined ? l.amount : '';
                    const isCredit = isPayInbound
                        ? (l.entry_type === 'debit' || Number(rawAmt) < 0 ? false : true)
                        : (l.entry_type === 'credit' || (Number(rawAmt) < 0));
                    return {
                        id: l.id || `exp-${idx}`,
                        account_id: l.account_id || '',
                        cost_center_id: l.cost_center_id || pay.cost_center_id || '',
                        partner_id: l.partner_id || '',
                        notes: l.notes || '',
                        entry_type: isCredit ? 'credit' : 'debit',
                        amount: Math.abs(Number(rawAmt)) || rawAmt
                    };
                }));
            } else {
                setExpenseLines([{
                    id: 'exp-1',
                    account_id: pay.account_id || '',
                    cost_center_id: pay.cost_center_id || '',
                    partner_id: pay.partner_id || '',
                    notes: '',
                    entry_type: isPayInbound ? 'credit' : 'debit',
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
                    instrument_date: l.instrument_date || pay.instrument_date || '',
                    amount: l.amount || ''
                })));
            } else {
                setBankLines([{
                    id: 'bnk-1',
                    journal_id: pay.accounting_journal_id || pay.journal_id || defaultJournalId,
                    bank_name: pay.bank_name || '',
                    bank_account: pay.bank_account || '',
                    reference: pay.notes?.startsWith('CHQ') || pay.notes?.startsWith('TT') ? pay.notes : '',
                    instrument_date: pay.instrument_date || pay.date || '',
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
            setHeaderCostCenterId('');
            setDate(new Date().toISOString().split('T')[0]);
            setNotes('');

            setExpenseLines([{
                id: `exp-${Date.now()}`,
                account_id: '',
                cost_center_id: '',
                partner_id: '',
                notes: '',
                entry_type: 'debit',
                amount: ''
            }]);

            setBankLines([{
                id: `bnk-${Date.now()}`,
                journal_id: defaultJournalId,
                bank_name: '',
                bank_account: '',
                reference: '',
                instrument_date: new Date().toISOString().split('T')[0],
                amount: ''
            }]);

            setEditMode(false);
            setViewMode(false);
            setIsModalOpen(true);
        }
    };

    const autoOpenedRef = useRef<string | null>(null);

    // Auto-open requested payment from Day Book or external navigation
    useEffect(() => {
        const targetKey = initialId || initialSearch;
        if (!targetKey || loading || payments.length === 0) return;
        if (autoOpenedRef.current === targetKey) return;

        const cleanSearch = (initialSearch || '').trim().toLowerCase();

        // 1. Search in loaded payments list
        const found = payments.find(p =>
            (initialId && (p.id === initialId || p.accounting_entry_id === initialId)) ||
            (cleanSearch && p.name && p.name.trim().toLowerCase() === cleanSearch)
        );

        if (found) {
            autoOpenedRef.current = targetKey;
            setSearchQuery(found.name || initialSearch || '');
            handleOpenModal(found, false);
        } else {
            // 2. Fallback: fetch single record from database
            const fetchTarget = async () => {
                try {
                    let q = supabase
                        .from('accounting_payments')
                        .select(`
                            *,
                            partner:accounting_partners(name),
                            account:accounting_chart_of_accounts!account_id(code, name, type),
                            journal:accounting_journals!accounting_journal_id(code, name, type),
                            cost_center:accounting_cost_centers!cost_center_id(code, name, type)
                        `);
                    if (initialId) {
                        q = q.or(`id.eq.${initialId},accounting_entry_id.eq.${initialId}`);
                    } else if (cleanSearch) {
                        q = q.ilike('name', initialSearch!.trim());
                    }
                    const { data } = await q.maybeSingle();
                    if (data) {
                        autoOpenedRef.current = targetKey;
                        setSearchQuery(data.name || initialSearch || '');
                        handleOpenModal(data, false);
                    }
                } catch (e) {
                    console.error('Error auto-opening payment:', e);
                }
            };
            fetchTarget();
        }
    }, [payments, loading, initialSearch, initialId]);

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
                    const val = Number(el.amount);
                    if (!el.amount || isNaN(val) || val === 0) {
                        throw new Error(`Expense Line #${i + 1}: Amount cannot be zero.`);
                    }
                }
                if (totalExpenseAmount <= 0) {
                    throw new Error(`Net voucher allocation must be greater than zero. Current net: QAR ${totalExpenseAmount.toFixed(2)}`);
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
                throw new Error(`Voucher is unbalanced. Net Allocation (QAR ${totalExpenseAmount.toFixed(2)}) must equal Total Bank/Payment (QAR ${totalBankAmount.toFixed(2)}). Difference: QAR ${balanceDifference.toFixed(2)}`);
            }
            if (paymentCategory === 'partner' && totalBankAmount <= 0) {
                throw new Error('Please enter the received/disbursed amount in Section 2 (Bank & Cash Payment Sources).');
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

            const partnerObj = partners.find((p: any) => p.id === selectedPartner);
            const defaultReceivable = accounts.find(a => a.code === '1110' || a.subtype === 'Receivable')?.id;
            const defaultPayable = accounts.find(a => ['2110', '2010'].includes(a.code) || a.subtype === 'Payable')?.id;
            const partnerDefaultAccId = paymentType === 'inbound'
                ? (partnerObj?.property_account_receivable_id || defaultReceivable)
                : (partnerObj?.property_account_payable_id || defaultPayable);

            const formattedExpenseLines = paymentCategory === 'partner'
                ? []
                : expenseLines.map(el => {
                    const rawAmt = Math.abs(Number(el.amount) || 0);
                    const isCredit = paymentType === 'inbound'
                        ? el.entry_type !== 'debit'
                        : (el.entry_type === 'credit' || Number(el.amount) < 0);
                    // Inbound: credit revenue is positive, debit deduction is negative
                    // Outbound: debit expense is positive, credit deduction is negative
                    const signedAmt = paymentType === 'inbound'
                        ? (isCredit ? rawAmt : -rawAmt)
                        : (isCredit ? -rawAmt : rawAmt);
                    const resolvedAccId = el.account_id || null;
                    return {
                        id: el.id,
                        account_id: resolvedAccId,
                        cost_center_id: el.cost_center_id ? String(el.cost_center_id).trim() : null,
                        partner_id: el.partner_id || selectedPartner || null,
                        notes: el.notes || null,
                        entry_type: isCredit ? 'credit' : 'debit',
                        amount: signedAmt
                    };
                });

            const formattedBankLines = bankLines.map(bl => ({
                id: bl.id,
                journal_id: bl.journal_id,
                bank_name: bl.bank_name || null,
                bank_account: bl.bank_account || null,
                reference: bl.reference || null,
                instrument_date: bl.instrument_date || null,
                amount: Number(bl.amount)
            }));

            const resolvedPrimaryAccId = paymentCategory === 'partner'
                ? (partnerDefaultAccId ? String(partnerDefaultAccId).trim() : null)
                : (primaryExpense?.account_id ? String(primaryExpense.account_id).trim() : null);

            const primaryCostCenterId = paymentCategory === 'partner'
                ? (headerCostCenterId ? String(headerCostCenterId).trim() : null)
                : (primaryExpense?.cost_center_id ? String(primaryExpense.cost_center_id).trim() : (headerCostCenterId ? String(headerCostCenterId).trim() : null));

            const payload: any = {
                company_id: currentCompanyId,
                name: trimmedVoucher || null,
                payment_category: paymentCategory,
                payment_type: paymentType,
                partner_type: paymentType === 'inbound' ? 'customer' : 'vendor',
                partner_id: selectedPartner ? String(selectedPartner).trim() : null,
                account_id: resolvedPrimaryAccId,
                cost_center_id: primaryCostCenterId,
                amount: totalVoucherAmount,
                date: date,
                accounting_journal_id: primaryBank?.journal_id ? String(primaryBank.journal_id).trim() : null,
                bank_name: primaryBank?.bank_name || null,
                bank_account: primaryBank?.bank_account || null,
                instrument_date: primaryBank?.instrument_date || null,
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

    const handleCreateQuickCostCenter = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId) return;
        const trimmedName = newCostCenterName.trim();
        if (!trimmedName) {
            alert('Please enter a cost center name.');
            return;
        }

        try {
            setCreatingCostCenter(true);
            let generatedCode = newCostCenterCode.trim().toUpperCase();
            if (!generatedCode) {
                const prefix = newCostCenterType === 'PROJECT' ? 'PRJ' : newCostCenterType === 'CONTRACT' ? 'CNT' : 'CC';
                generatedCode = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
            }

            const { data, error } = await supabase
                .from('accounting_cost_centers')
                .insert([{
                    company_id: currentCompanyId,
                    name: trimmedName,
                    code: generatedCode,
                    type: newCostCenterType,
                    is_active: true
                }])
                .select()
                .single();

            if (error) throw error;

            // Add to cost centers state
            setCostCenters(prev => [...prev, data]);

            // If target index was set, assign to that expense line
            if (newCostCenterTargetIndex !== null && newCostCenterTargetIndex >= 0 && newCostCenterTargetIndex < expenseLines.length) {
                handleUpdateExpenseLine(newCostCenterTargetIndex, 'cost_center_id', data.id);
            } else if (paymentCategory === 'partner') {
                setHeaderCostCenterId(data.id);
            }

            // Reset and close
            setNewCostCenterName('');
            setNewCostCenterCode('');
            setNewCostCenterType('GENERIC');
            setNewCostCenterTargetIndex(null);
            setIsCostCenterModalOpen(false);
            alert(`Cost Center "${trimmedName}" created and selected!`);
        } catch (err: any) {
            console.error('Error creating cost center:', err);
            if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
                alert(`A cost center with code "${newCostCenterCode.trim().toUpperCase()}" already exists. Please choose a unique code or leave blank to auto-generate.`);
            } else {
                alert('Failed to create cost center: ' + (err.message || 'Unknown error'));
            }
        } finally {
            setCreatingCostCenter(false);
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
            if (preset !== 'all') {
                const payDate = pay.date;
                if (startDate && payDate < startDate) return false;
                if (endDate && payDate > endDate) return false;
            }

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
    }, [payments, searchQuery, filterCategory, preset, startDate, endDate]);

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
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3 no-print">
                <PeriodFilter
                    preset={preset}
                    startDate={startDate}
                    endDate={endDate}
                    showDateInputs={true}
                    onPeriodChange={(newStart, newEnd, newPreset) => {
                        setStartDate(newStart);
                        setEndDate(newEnd);
                        setPreset(newPreset);
                    }}
                />

                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
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
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">No payment vouchers found</p>
                                        <p className="text-xs text-slate-400">
                                            No records match in the selected period ({startDate} to {endDate}). Try selecting{' '}
                                            <button type="button" onClick={() => { const { startDate: s, endDate: e } = getDatesForPreset('all'); setStartDate(s); setEndDate(e); setPreset('all'); }} className="text-violet-600 font-bold hover:underline cursor-pointer">All Dates</button> or{' '}
                                            <button type="button" onClick={() => { const { startDate: s, endDate: e } = getDatesForPreset('august_2026'); setStartDate(s); setEndDate(e); setPreset('august_2026'); }} className="text-violet-600 font-bold hover:underline cursor-pointer">August 2026</button>.
                                        </p>
                                    </td>
                                </tr>
                            ) : filteredPayments.map(pay => {
                                const isDirect = pay.payment_category === 'direct_account' || !!pay.account_id;
                                const multiExp = pay.expense_lines && Array.isArray(pay.expense_lines) && pay.expense_lines.length > 1;
                                const multiBnk = pay.bank_lines && Array.isArray(pay.bank_lines) && pay.bank_lines.length > 1;
                                const hasDeductions = pay.expense_lines && Array.isArray(pay.expense_lines) && pay.expense_lines.some((l: any) => {
                                    if (pay.payment_type === 'inbound') {
                                        return Number(l.amount) < 0 || l.entry_type === 'debit';
                                    }
                                    return Number(l.amount) < 0 || l.entry_type === 'credit';
                                });

                                const displayName = isDirect
                                    ? (multiExp 
                                        ? `Split Allocation (${pay.expense_lines.length} Ledgers)`
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
                                                {hasDeductions && <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded text-[10px] font-extrabold">DED</span>}
                                                <span>{displayName}</span>
                                            </div>
                                            {partnerSubtext && <div className="text-[11px] text-slate-400 font-normal">{partnerSubtext}</div>}
                                            {pay.cost_center?.name ? (
                                                <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5 flex items-center gap-1">
                                                    <span className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 rounded">
                                                        🎯 {pay.cost_center.name}
                                                    </span>
                                                </div>
                                            ) : (
                                                pay.expense_lines && Array.isArray(pay.expense_lines) && pay.expense_lines.some((l: any) => !!l.cost_center_id) ? (
                                                    <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5 flex items-center gap-1 flex-wrap">
                                                        {Array.from(new Set(pay.expense_lines.map((l: any) => l.cost_center_id).filter(Boolean))).map((ccId: any) => {
                                                            const ccObj = costCenters.find(c => c.id === ccId);
                                                            return ccObj ? (
                                                                <span key={ccId} className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 rounded">
                                                                    🎯 {ccObj.name}
                                                                </span>
                                                            ) : null;
                                                        })}
                                                    </div>
                                                ) : null
                                            )}
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
                    size="5xl"
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
                                        onClick={() => {
                                            setPaymentType('inbound');
                                            setExpenseLines(prev => prev.map(l => ({
                                                ...l,
                                                entry_type: l.entry_type === 'debit' && (!l.amount || Number(l.amount) >= 0) ? 'credit' : l.entry_type
                                            })));
                                        }}
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
                                        onClick={() => {
                                            setPaymentType('outbound');
                                            setExpenseLines(prev => prev.map(l => ({
                                                ...l,
                                                entry_type: l.entry_type === 'credit' && (!l.amount || Number(l.amount) >= 0) ? 'debit' : l.entry_type
                                            })));
                                        }}
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
                                                ? 'bg-purple-600 text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                        }`}
                                    >
                                        Direct Account / Split Ledgers
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
                        <div className={`grid grid-cols-1 ${paymentCategory === 'partner' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
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
                                <SearchableSelect
                                    options={partnerOptions}
                                    value={selectedPartner}
                                    onChange={setSelectedPartner}
                                    placeholder="Search Partner / Vendor / Customer..."
                                    disabled={viewMode}
                                    required={paymentCategory === 'partner'}
                                    buttonClassName="p-2.5 rounded-xl"
                                />
                            </div>

                            {paymentCategory === 'partner' && (
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                        Cost Center <span className="text-slate-400 font-normal">(Optional)</span>
                                    </label>
                                    <SearchableSelect
                                        options={costCenterOptions}
                                        value={headerCostCenterId}
                                        onChange={setHeaderCostCenterId}
                                        placeholder="Select Project or Dept..."
                                        disabled={viewMode}
                                        buttonClassName="p-2.5 rounded-xl"
                                    />
                                </div>
                            )}
                        </div>

                        {/* SECTION 1: EXPENSE / ACCOUNT LEDGERS (MULTI-LINE) */}
                        {paymentCategory === 'direct_account' && (
                            <div className="space-y-3 p-4 bg-purple-50/40 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/30 rounded-2xl">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-purple-600" />
                                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                            Expense & Account Allocation ({expenseLines.length} {expenseLines.length === 1 ? 'item' : 'items'})
                                        </h3>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <div className="text-xs font-semibold flex items-center gap-2">
                                            {paymentType === 'inbound' ? (
                                                totalExpenseDebits > 0 ? (
                                                    <>
                                                        <span className="text-emerald-700 dark:text-emerald-300">Gross CR: <strong>QAR {totalExpenseCredits.toFixed(2)}</strong></span>
                                                        <span className="text-rose-600 dark:text-rose-400">DR / Ded: <strong>-QAR {totalExpenseDebits.toFixed(2)}</strong></span>
                                                        <span className="text-slate-400">|</span>
                                                    </>
                                                ) : null
                                            ) : (
                                                totalExpenseCredits > 0 ? (
                                                    <>
                                                        <span className="text-slate-500">Gross DR: <strong className="text-purple-700 dark:text-purple-300">QAR {totalExpenseDebits.toFixed(2)}</strong></span>
                                                        <span className="text-rose-600 dark:text-rose-400">CR / Ded: <strong>-QAR {totalExpenseCredits.toFixed(2)}</strong></span>
                                                        <span className="text-slate-400">|</span>
                                                    </>
                                                ) : null
                                            )}
                                            <span className="text-purple-700 dark:text-purple-300 font-bold">
                                                Net Allocation: <strong>QAR {totalExpenseAmount.toFixed(2)}</strong>
                                            </span>
                                        </div>
                                        {!viewMode && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setNewCostCenterTargetIndex(expenseLines.length - 1);
                                                        setIsCostCenterModalOpen(true);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-zinc-700 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                                                    title="Create a new Cost Center for Project, Driver, Salesperson or Vehicle"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> New Cost Center
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleAddExpenseLine}
                                                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Add Ledger Line
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {expenseLines.map((line, idx) => {
                                        const rawAmt = Number(line.amount);
                                        const isDeduction = paymentType === 'inbound'
                                            ? (line.entry_type === 'debit' || (!isNaN(rawAmt) && rawAmt < 0))
                                            : (line.entry_type === 'credit' || (!isNaN(rawAmt) && rawAmt < 0));
                                        const isCredit = line.entry_type === 'credit' || (!isNaN(rawAmt) && rawAmt < 0);

                                        return (
                                            <div
                                                key={line.id}
                                                className={`grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 bg-white dark:bg-zinc-800/90 rounded-xl border items-center shadow-xs transition-colors ${
                                                    isDeduction 
                                                        ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10' 
                                                        : 'border-purple-100 dark:border-purple-900/20'
                                                }`}
                                            >
                                                {/* 1. Account Ledger (3 cols) */}
                                                <div className="sm:col-span-3">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                                        Account Ledger #{idx + 1} <span className="text-rose-500">*</span>
                                                    </label>
                                                    <SearchableSelect
                                                        options={accountOptions}
                                                        value={line.account_id}
                                                        onChange={val => handleUpdateExpenseLine(idx, 'account_id', val)}
                                                        placeholder="Search account (5510, Fuel...)..."
                                                        disabled={viewMode}
                                                        required
                                                    />
                                                </div>

                                                {/* 2. Cost Center (3 cols) */}
                                                <div className="sm:col-span-3">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">
                                                            Cost Center <span className="text-slate-400 font-normal">(Driver/Project)</span>
                                                        </label>
                                                    </div>
                                                    <SearchableSelect
                                                        options={costCenterOptions}
                                                        value={line.cost_center_id || ''}
                                                        onChange={val => handleUpdateExpenseLine(idx, 'cost_center_id', val)}
                                                        placeholder="Select Cost Center (Driver, Project...)"
                                                        disabled={viewMode}
                                                    />
                                                </div>

                                                {/* 3. DR / CR (1 col) */}
                                                <div className="sm:col-span-1">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                                        DR / CR <span className="text-rose-500">*</span>
                                                    </label>
                                                    <select
                                                        value={isCredit ? 'credit' : 'debit'}
                                                        onChange={e => handleUpdateExpenseLine(idx, 'entry_type', e.target.value)}
                                                        disabled={viewMode}
                                                        className={`w-full p-2 border rounded-lg text-xs font-black transition-colors ${
                                                            isCredit
                                                                ? paymentType === 'inbound'
                                                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                                                    : 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                                                                : 'bg-indigo-50 dark:bg-zinc-700/60 border-indigo-200 dark:border-zinc-600 text-indigo-700 dark:text-indigo-300'
                                                        }`}
                                                    >
                                                        {paymentType === 'inbound' ? (
                                                            <>
                                                                <option value="credit">CR</option>
                                                                <option value="debit">DR</option>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <option value="debit">DR</option>
                                                                <option value="credit">CR</option>
                                                            </>
                                                        )}
                                                    </select>
                                                </div>

                                                {/* 4. Notes / Memo (2 cols) */}
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Line Memo / Notes</label>
                                                    <input
                                                        type="text"
                                                        value={line.notes || ''}
                                                        onChange={e => handleUpdateExpenseLine(idx, 'notes', e.target.value)}
                                                        disabled={viewMode}
                                                        placeholder="e.g. Fuel, car 587593"
                                                        className="w-full p-2 bg-slate-50 dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-medium"
                                                    />
                                                </div>

                                                {/* 5. Amount (2 cols) */}
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 flex justify-between items-center">
                                                        <span>Amount (QAR) <span className="text-rose-500">*</span></span>
                                                        {paymentType === 'inbound' ? (
                                                            isCredit ? (
                                                                <span className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-1 py-0.2 rounded font-extrabold uppercase">CR</span>
                                                            ) : (
                                                                <span className="text-[9px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-1 py-0.2 rounded font-extrabold uppercase">DR</span>
                                                            )
                                                        ) : (
                                                            isCredit ? (
                                                                <span className="text-[9px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-1 py-0.2 rounded font-extrabold uppercase">CR (-ve)</span>
                                                            ) : (
                                                                <span className="text-[9px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-1 py-0.2 rounded font-extrabold uppercase">DR (+)</span>
                                                            )
                                                        )}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        required
                                                        value={line.amount}
                                                        onChange={e => handleUpdateExpenseLine(idx, 'amount', e.target.value)}
                                                        disabled={viewMode}
                                                        placeholder={isDeduction ? "-0.00" : "0.00"}
                                                        className={`w-full p-2 border rounded-lg text-xs font-bold text-right transition-colors ${
                                                            isDeduction
                                                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                                                                : 'bg-slate-50 dark:bg-zinc-700/60 border-slate-200 dark:border-zinc-600 text-purple-700 dark:text-purple-300'
                                                        }`}
                                                    />
                                                </div>

                                                {/* 6. Delete Line (1 col) */}
                                                <div className="sm:col-span-1 flex justify-center pt-3 sm:pt-0">
                                                    {!viewMode && expenseLines.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveExpenseLine(idx)}
                                                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                                            title="Delete Line"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
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
                                                    <SearchableSelect
                                                        options={bankAccountOptions}
                                                        value={bLine.bank_account || ''}
                                                        onChange={val => handleUpdateBankLine(bIdx, 'bank_account', val)}
                                                        placeholder="Select Bank Account..."
                                                        disabled={viewMode || !isBank}
                                                        required={isBank}
                                                    />
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

                                            {/* Cheque / Reference No. & Instrument Date */}
                                            {isBank && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-zinc-700/40">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">
                                                            Cheque / Transfer Reference No.
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={bLine.reference || ''}
                                                            onChange={e => handleUpdateBankLine(bIdx, 'reference', e.target.value)}
                                                            disabled={viewMode}
                                                            placeholder="Cheque / TT / Transfer Reference No. (e.g. QNB-00000289)"
                                                            className="w-full p-2 bg-slate-50 dark:bg-zinc-700/40 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">
                                                            Instrument Date / Cheque Date / Transfer Date
                                                        </label>
                                                        <input
                                                            type="date"
                                                            value={bLine.instrument_date || ''}
                                                            onChange={e => handleUpdateBankLine(bIdx, 'instrument_date', e.target.value)}
                                                            disabled={viewMode}
                                                            className="w-full p-2 bg-slate-50 dark:bg-zinc-700/40 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200"
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
                                            {paymentCategory === 'partner' ? (
                                                isBalanced
                                                    ? `Party Voucher Ready: QAR ${totalBankAmount.toFixed(2)}`
                                                    : 'Incomplete Party Voucher'
                                            ) : (
                                                isBalanced
                                                    ? `Voucher Balanced: Total QAR ${totalBankAmount.toFixed(2)}`
                                                    : `Unbalanced Voucher: Difference of QAR ${Math.abs(balanceDifference).toFixed(2)}`
                                            )}
                                        </h4>
                                        <p className="text-[11px] opacity-80">
                                            {paymentCategory === 'partner' ? (
                                                !selectedPartner ? (
                                                    <span className="text-amber-700 dark:text-amber-300 font-semibold">
                                                        ⚠️ Please select a {paymentType === 'inbound' ? 'Customer' : 'Vendor'} partner tag in the header.
                                                    </span>
                                                ) : totalBankAmount <= 0 ? (
                                                    <span className="text-amber-700 dark:text-amber-300 font-semibold">
                                                        ⚠️ Please enter the {paymentType === 'inbound' ? 'received' : 'disbursed'} amount in Section 2 (Bank & Cash Sources).
                                                    </span>
                                                ) : (
                                                    <>
                                                        {paymentType === 'inbound' ? 'Receipt from Customer' : 'Payment to Vendor'}: <strong>{partners.find(p => p.id === selectedPartner)?.name || 'Selected Partner'}</strong> | Total: <strong>QAR {totalBankAmount.toFixed(2)}</strong> (Settles to Accounts {paymentType === 'inbound' ? 'Receivable' : 'Payable'})
                                                    </>
                                                )
                                            ) : (
                                                paymentType === 'inbound' ? (
                                                    totalExpenseDebits > 0 ? (
                                                        <>
                                                            Gross Receipts (CR): <strong>QAR {totalExpenseCredits.toFixed(2)}</strong> | Deductions / Fees (DR): <strong>-QAR {totalExpenseDebits.toFixed(2)}</strong> | Net Received: <strong>QAR {totalExpenseAmount.toFixed(2)}</strong> | Bank Deposit: <strong>QAR {totalBankAmount.toFixed(2)}</strong>
                                                        </>
                                                    ) : (
                                                        <>
                                                            Receipts (CR): <strong>QAR {totalExpenseAmount.toFixed(2)}</strong> | Bank Deposit: <strong>QAR {totalBankAmount.toFixed(2)}</strong>
                                                        </>
                                                    )
                                                ) : (
                                                    totalExpenseCredits > 0 ? (
                                                        <>
                                                            Gross Expenses (DR): <strong>QAR {totalExpenseDebits.toFixed(2)}</strong> | Deductions / CR: <strong>-QAR {totalExpenseCredits.toFixed(2)}</strong> | Net Payout: <strong>QAR {totalExpenseAmount.toFixed(2)}</strong> | Bank Payment: <strong>QAR {totalBankAmount.toFixed(2)}</strong>
                                                        </>
                                                    ) : (
                                                        <>
                                                            Expenses: <strong>QAR {totalExpenseAmount.toFixed(2)}</strong> | Payment Sources: <strong>QAR {totalBankAmount.toFixed(2)}</strong>
                                                        </>
                                                    )
                                                )
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {!viewMode && paymentCategory === 'direct_account' && !isBalanced && Math.abs(balanceDifference) > 0.001 && (
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

            {/* Quick Add Cost Center Modal */}
            {isCostCenterModalOpen && (
                <Modal
                    title="Add New Cost Center / Project / Driver"
                    onClose={() => {
                        setIsCostCenterModalOpen(false);
                        setNewCostCenterTargetIndex(null);
                    }}
                    size="md"
                >
                    <form onSubmit={handleCreateQuickCostCenter} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Cost Center Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={newCostCenterName}
                                onChange={e => setNewCostCenterName(e.target.value)}
                                placeholder="e.g. Toyota Corolla 587593, Driver Hafeez, Project Dolphin"
                                className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                                Name of the project, vehicle, driver, department, or salesperson to allocate expenses against.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Allocation Type <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={newCostCenterType}
                                    onChange={e => setNewCostCenterType(e.target.value as any)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold"
                                >
                                    <option value="GENERIC">Driver / Vehicle / Sales / Staff</option>
                                    <option value="PROJECT">Project</option>
                                    <option value="CONTRACT">Contract / Manpower</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Code <span className="text-slate-400 font-normal">(Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={newCostCenterCode}
                                    onChange={e => setNewCostCenterCode(e.target.value)}
                                    placeholder="e.g. DRIVER-056 or PRJ-01"
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-700">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCostCenterModalOpen(false);
                                    setNewCostCenterTargetIndex(null);
                                }}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800 rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creatingCostCenter || !newCostCenterName.trim()}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 transition-all flex items-center gap-1.5"
                            >
                                {creatingCostCenter ? 'Creating...' : 'Create & Select Cost Center'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
