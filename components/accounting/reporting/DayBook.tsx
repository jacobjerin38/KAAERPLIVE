import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
    BookOpen,
    Calendar,
    Filter,
    Search,
    Download,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    ArrowUpDown,
    CheckCircle2,
    Clock,
    XCircle,
    Layers,
    ListFilter,
    ArrowDownRight,
    ArrowUpRight,
    Eye,
    Maximize2,
    Minimize2,
    Printer,
    ExternalLink,
    Edit
} from 'lucide-react';
import { PrintButton } from '../../ui/PrintButton';
import { formatLocalDate } from '../../../lib/dateFormat';

export interface DayBookLine {
    id: string;
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType?: string;
    name?: string;
    debit: number;
    credit: number;
    partnerName?: string;
    costCenterName?: string;
}

export interface DayBookVoucher {
    id: string;
    date: string;
    formattedDate: string;
    reference: string;
    voucherType: 'Payment' | 'Receipt' | 'Sales' | 'Purchase' | 'Journal' | 'Contra';
    particulars: string;
    debitAmount: number;
    creditAmount: number;
    notes: string;
    state: 'Draft' | 'Posted' | 'Cancelled';
    partnerName?: string;
    journalName?: string;
    clientPoNumber?: string;
    clientPoDate?: string;
    lines: DayBookLine[];
}

type PeriodPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'august_2026' | 'all' | 'custom';
type VoucherTypeFilter = 'ALL' | 'Payment' | 'Receipt' | 'Sales' | 'Purchase' | 'Journal' | 'Contra';
type StatusFilter = 'ALL' | 'Posted' | 'Draft' | 'Cancelled';
type SortField = 'date' | 'reference' | 'amount' | 'particulars';
type SortOrder = 'asc' | 'desc';

export interface DayBookProps {
    onNavigateToEntry?: (voucher: DayBookVoucher) => void;
}

export const getVoucherDestination = (voucher: DayBookVoucher) => {
    const ref = voucher.reference || '';
    const upperRef = ref.toUpperCase();
    const type = voucher.voucherType;

    if (type === 'Purchase' || upperRef.startsWith('PI.') || upperRef.startsWith('BILL')) {
        return { label: 'Bills', fullLabel: 'Vendor Bills', tab: 'vendors', subTab: 'bills' };
    }
    if (type === 'Sales' || upperRef.startsWith('SI.') || upperRef.startsWith('INV')) {
        return { label: 'Invoices', fullLabel: 'Customer Invoices', tab: 'customers', subTab: 'invoices' };
    }
    if (type === 'Payment' || type === 'Receipt' || type === 'Contra' || upperRef.startsWith('PBV') || upperRef.startsWith('PCV') || upperRef.startsWith('PRV') || upperRef.startsWith('BRV') || upperRef.startsWith('CRV')) {
        return { label: 'Payments', fullLabel: 'Payments & Receipts', tab: 'payments', subTab: '' };
    }
    return { label: 'Journal', fullLabel: 'Journal Entries', tab: 'journal', subTab: '' };
};

export const DayBook: React.FC<DayBookProps> = ({ onNavigateToEntry }) => {
    const { currentCompanyId } = useAuth();

    // Company profile
    const [companyInfo, setCompanyInfo] = useState<{ name: string; currency: string }>({
        name: 'KAA ERP',
        currency: 'QAR'
    });

    // Date range & preset - default to This Month so live transactions are immediately visible
    const [preset, setPreset] = useState<PeriodPreset>('this_month');
    const [startDate, setStartDate] = useState<string>(() => {
        const today = new Date();
        return formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1));
    });
    const [endDate, setEndDate] = useState<string>(() => {
        const today = new Date();
        return formatLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    });

    // Filters & Sorting
    const [voucherTypeFilter, setVoucherTypeFilter] = useState<VoucherTypeFilter>('ALL');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    // View mode: row expansion set
    const [expandedVoucherIds, setExpandedVoucherIds] = useState<Set<string>>(new Set());

    // Data & Loading
    const [vouchers, setVouchers] = useState<DayBookVoucher[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch company info
    useEffect(() => {
        if (!currentCompanyId) return;
        const fetchCompany = async () => {
            try {
                const { data } = await supabase
                    .from('companies')
                    .select('name, currency')
                    .eq('id', currentCompanyId)
                    .maybeSingle();
                if (data) {
                    setCompanyInfo({
                        name: data.name || 'KAA ERP',
                        currency: data.currency || 'QAR'
                    });
                }
            } catch (err) {
                console.error('Error fetching company info:', err);
            }
        };
        fetchCompany();
    }, [currentCompanyId]);

    // Handle Preset Selection
    const handlePresetChange = (newPreset: PeriodPreset) => {
        setPreset(newPreset);
        const today = new Date();

        switch (newPreset) {
            case 'today': {
                const todayStr = formatLocalDate(today);
                setStartDate(todayStr);
                setEndDate(todayStr);
                break;
            }
            case 'yesterday': {
                const y = new Date(today);
                y.setDate(y.getDate() - 1);
                const yStr = formatLocalDate(y);
                setStartDate(yStr);
                setEndDate(yStr);
                break;
            }
            case 'this_week': {
                const d = new Date(today);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                const firstDay = new Date(d.setDate(diff));
                const lastDay = new Date(firstDay);
                lastDay.setDate(firstDay.getDate() + 6);
                setStartDate(formatLocalDate(firstDay));
                setEndDate(formatLocalDate(lastDay));
                break;
            }
            case 'this_month': {
                const start = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1));
                const end = formatLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
                setStartDate(start);
                setEndDate(end);
                break;
            }
            case 'last_month': {
                const start = formatLocalDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
                const end = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 0));
                setStartDate(start);
                setEndDate(end);
                break;
            }
            case 'august_2026': {
                setStartDate('2026-08-01');
                setEndDate('2026-08-31');
                break;
            }
            case 'all': {
                setStartDate('2020-01-01');
                setEndDate('2030-12-31');
                break;
            }
            case 'custom':
            default:
                break;
        }
    };

    // Keyboard shortcut listener (Tally Alt+F1 for Detailed View)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && (e.key === 'F1' || e.code === 'F1')) {
                e.preventDefault();
                setIsDetailedView(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Format date in Tally style: e.g. 1-Aug-2026
    const formatTallyDate = (dateStr: string): string => {
        if (!dateStr) return '';
        try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const year = parts[0];
                const monthIndex = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${day}-${monthNames[monthIndex] || parts[1]}-${year}`;
            }
            const d = new Date(dateStr);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
        } catch {
            return dateStr;
        }
    };

    // Format currency
    const formatNumber = (num: number): string => {
        if (num === 0 || isNaN(num)) return '—';
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Fetch Day Book Vouchers
    const fetchDayBook = useCallback(async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        setError(null);

        try {
            // 1. Query journal entries joined with journal, partner, and lines
            let jEntryQuery = supabase
                .from('accounting_journal_entries')
                .select(`
                    id,
                    date,
                    reference,
                    notes,
                    state,
                    move_type,
                    amount_total,
                    created_at,
                    client_po_number,
                    client_po_date,
                    journal:accounting_journals(id, name, code, type),
                    partner:accounting_partners(id, name),
                    lines:accounting_journal_lines(
                        id,
                        account_id,
                        name,
                        debit,
                        credit,
                        cost_center_id,
                        account:accounting_chart_of_accounts(id, code, name, type),
                        partner:accounting_partners(id, name)
                    )
                `)
                .eq('company_id', currentCompanyId);

            if (startDate) {
                jEntryQuery = jEntryQuery.gte('date', startDate);
            }
            if (endDate) {
                jEntryQuery = jEntryQuery.lte('date', endDate);
            }
            jEntryQuery = jEntryQuery.order('date', { ascending: true });

            // 2. Query payment & receipt vouchers directly from accounting_payments
            // This ensures all draft, pending, and unposted vouchers appear immediately in Day Book
            let paymentQuery = supabase
                .from('accounting_payments')
                .select(`
                    id,
                    name,
                    date,
                    notes,
                    state,
                    payment_type,
                    payment_category,
                    amount,
                    accounting_entry_id,
                    partner_id,
                    account_id,
                    created_at,
                    partner:accounting_partners(id, name),
                    account:accounting_chart_of_accounts!account_id(id, code, name, type),
                    journal:accounting_journals!accounting_journal_id(id, code, name, type),
                    expense_lines,
                    bank_lines
                `)
                .eq('company_id', currentCompanyId);

            if (startDate) {
                paymentQuery = paymentQuery.gte('date', startDate);
            }
            if (endDate) {
                paymentQuery = paymentQuery.lte('date', endDate);
            }
            paymentQuery = paymentQuery.order('date', { ascending: true });

            // Fetch masters for resolving ledger accounts, partner names, and cost centers inside vouchers
            const [jRes, pRes, coaRes, partRes, ccRes] = await Promise.all([
                jEntryQuery,
                paymentQuery,
                supabase.from('accounting_chart_of_accounts').select('id, code, name, type').eq('company_id', currentCompanyId),
                supabase.from('accounting_partners').select('id, name').eq('company_id', currentCompanyId),
                supabase.from('accounting_cost_centers').select('id, code, name').eq('company_id', currentCompanyId)
            ]);

            if (jRes.error) throw jRes.error;
            if (pRes.error) throw pRes.error;

            const coaMap = new Map((coaRes.data || []).map((a: any) => [a.id, a]));
            const partMap = new Map((partRes.data || []).map((p: any) => [p.id, p.name]));
            const ccMap = new Map((ccRes.data || []).map((c: any) => [c.id, c.name]));

            const postedEntryIds = new Set<string>();
            const existingReferences = new Set<string>();

            // Transform raw journal entries to DayBookVoucher items
            const parsedJournalVouchers: DayBookVoucher[] = (jRes.data || []).map((entry: any) => {
                postedEntryIds.add(entry.id);
                const ref = (entry.reference || '').trim();
                const upperRef = ref.toUpperCase();
                if (upperRef) {
                    existingReferences.add(upperRef);
                }
                const jType = (entry.journal?.type || '').toLowerCase();
                const moveType = entry.move_type || 'entry';
                const notes = entry.notes || '';
                const entryPartner = entry.partner?.name || '';

                const rawLines = entry.lines || [];
                const formattedLines: DayBookLine[] = rawLines.map((l: any) => ({
                    id: l.id,
                    accountId: l.account_id,
                    accountCode: l.account?.code || '',
                    accountName: l.account?.name || 'General Account',
                    accountType: l.account?.type || '',
                    name: l.name || '',
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0,
                    partnerName: l.partner?.name || entryPartner || '',
                    costCenterName: l.cost_center_id ? (ccMap.get(l.cost_center_id) || undefined) : undefined
                }));

                const debitLines = formattedLines.filter(l => l.debit > 0);
                const creditLines = formattedLines.filter(l => l.credit > 0);
                const totalDebit = debitLines.reduce((sum, l) => sum + l.debit, 0);
                const totalCredit = creditLines.reduce((sum, l) => sum + l.credit, 0);

                // Determine Voucher Type
                let voucherType: DayBookVoucher['voucherType'] = 'Journal';

                const hasBankOrCashDebit = debitLines.some(l => {
                    const t = (l.accountType || '').toLowerCase();
                    const n = (l.accountName || '').toLowerCase();
                    return t.includes('bank') || t.includes('cash') || t.includes('liquidity') || n.includes('bank') || n.includes('cash');
                });
                const hasBankOrCashCredit = creditLines.some(l => {
                    const t = (l.accountType || '').toLowerCase();
                    const n = (l.accountName || '').toLowerCase();
                    return t.includes('bank') || t.includes('cash') || t.includes('liquidity') || n.includes('bank') || n.includes('cash');
                });

                if (moveType === 'out_invoice' || jType === 'sale' || upperRef.startsWith('SI.') || upperRef.startsWith('INV')) {
                    voucherType = 'Sales';
                } else if (moveType === 'in_invoice' || jType === 'purchase' || upperRef.startsWith('PI.') || upperRef.startsWith('BILL')) {
                    voucherType = 'Purchase';
                } else if (hasBankOrCashDebit && hasBankOrCashCredit) {
                    voucherType = 'Contra';
                } else if (upperRef.startsWith('PBV') || upperRef.startsWith('PCV') || hasBankOrCashCredit || jType === 'cash' || jType === 'bank') {
                    if (upperRef.startsWith('BRV') || upperRef.startsWith('CRV')) {
                        voucherType = 'Receipt';
                    } else {
                        voucherType = 'Payment';
                    }
                } else if (upperRef.startsWith('BRV') || upperRef.startsWith('CRV') || hasBankOrCashDebit) {
                    voucherType = 'Receipt';
                } else if (upperRef.startsWith('JV') || jType === 'general') {
                    voucherType = 'Journal';
                }

                // Determine Particulars (Tally Standard)
                let particulars = '';
                if (voucherType === 'Payment') {
                    // For payment, particulars shows the expense/ledger debited
                    if (debitLines.length === 1) {
                        particulars = debitLines[0].accountName || debitLines[0].name || entryPartner || 'Payment';
                    } else if (debitLines.length > 1) {
                        particulars = debitLines.map(l => l.accountName).filter(Boolean).slice(0, 2).join(', ') + (debitLines.length > 2 ? '...' : '');
                    } else {
                        particulars = entryPartner || notes || 'Payment';
                    }
                } else if (voucherType === 'Receipt') {
                    // For receipt, particulars shows customer/income credited
                    if (creditLines.length === 1) {
                        particulars = creditLines[0].accountName || creditLines[0].name || entryPartner || 'Receipt';
                    } else if (creditLines.length > 1) {
                        particulars = creditLines.map(l => l.accountName).filter(Boolean).slice(0, 2).join(', ') + (creditLines.length > 2 ? '...' : '');
                    } else {
                        particulars = entryPartner || notes || 'Receipt';
                    }
                } else if (voucherType === 'Sales') {
                    particulars = entryPartner || (debitLines[0]?.accountName) || 'Customer Account';
                } else if (voucherType === 'Purchase') {
                    particulars = entryPartner || (creditLines[0]?.accountName) || 'Vendor Account';
                } else if (voucherType === 'Contra') {
                    const drAcc = debitLines[0]?.accountName || 'Bank/Cash';
                    const crAcc = creditLines[0]?.accountName || 'Bank/Cash';
                    particulars = `${drAcc} / ${crAcc}`;
                } else {
                    // Journal
                    if (entryPartner) {
                        particulars = entryPartner;
                    } else if (debitLines.length === 1 && creditLines.length === 1) {
                        particulars = `${debitLines[0].accountName} / ${creditLines[0].accountName}`;
                    } else if (notes) {
                        particulars = notes;
                    } else {
                        particulars = debitLines[0]?.accountName || '(As per details)';
                    }
                }

                // Determine Tally Column Amounts
                let debitAmount = 0;
                let creditAmount = 0;

                if (voucherType === 'Payment') {
                    debitAmount = totalDebit > 0 ? totalDebit : Number(entry.amount_total) || 0;
                } else if (voucherType === 'Purchase') {
                    creditAmount = totalCredit > 0 ? totalCredit : Number(entry.amount_total) || 0;
                } else if (voucherType === 'Sales') {
                    debitAmount = totalDebit > 0 ? totalDebit : Number(entry.amount_total) || 0;
                } else if (voucherType === 'Receipt') {
                    creditAmount = totalCredit > 0 ? totalCredit : Number(entry.amount_total) || 0;
                } else if (voucherType === 'Contra') {
                    debitAmount = totalDebit;
                    creditAmount = totalCredit;
                } else {
                    // Journal
                    debitAmount = totalDebit;
                    creditAmount = totalCredit;
                }

                return {
                    id: entry.id,
                    date: entry.date,
                    formattedDate: formatTallyDate(entry.date),
                    reference: ref || 'UNNUMBERED',
                    voucherType,
                    particulars,
                    debitAmount,
                    creditAmount,
                    notes,
                    state: entry.state || 'Draft',
                    partnerName: entryPartner,
                    journalName: entry.journal?.name,
                    clientPoNumber: entry.client_po_number || undefined,
                    clientPoDate: entry.client_po_date || undefined,
                    lines: formattedLines
                };
            });

            // 3. Transform unposted or draft payment & receipt vouchers
            const parsedPaymentVouchers: DayBookVoucher[] = [];

            for (const pay of (pRes.data || [])) {
                // If payment has already been posted to accounting_journal_entries, skip to prevent duplicates
                if (pay.accounting_entry_id && postedEntryIds.has(pay.accounting_entry_id)) {
                    continue;
                }
                const payRef = (pay.name || '').trim();
                if (payRef && existingReferences.has(payRef.toUpperCase())) {
                    continue;
                }

                const isReceipt = pay.payment_type === 'inbound';
                const voucherType: DayBookVoucher['voucherType'] = isReceipt ? 'Receipt' : 'Payment';
                const entryPartner = pay.partner?.name || (pay.partner_id ? partMap.get(pay.partner_id) : '') || '';
                const payState = (pay.state || 'draft').toLowerCase();
                const displayState: 'Draft' | 'Posted' | 'Cancelled' =
                    payState === 'posted' ? 'Posted' :
                    payState === 'cancelled' ? 'Cancelled' : 'Draft';

                // Build detailed lines
                // 3A. Bank Lines
                const bankLines: DayBookLine[] = (pay.bank_lines || []).map((b: any, bIdx: number) => {
                    const bAmt = Number(b.amount) || 0;
                    const bName = b.bank_name || b.bank_account || pay.journal?.name || (isReceipt ? 'Bank / Cash Receipt' : 'Bank / Cash Payment');
                    return {
                        id: b.id || `bnk-${pay.id}-${bIdx}`,
                        accountCode: '',
                        accountName: bName,
                        accountType: 'Bank',
                        name: b.reference ? `${bName} (${b.reference})` : bName,
                        debit: isReceipt ? bAmt : 0,
                        credit: isReceipt ? 0 : bAmt,
                        partnerName: entryPartner
                    };
                });

                // 3B. Counterpart / Expense Lines
                let counterpartLines: DayBookLine[] = [];
                if (pay.expense_lines && Array.isArray(pay.expense_lines) && pay.expense_lines.length > 0) {
                    counterpartLines = pay.expense_lines.map((e: any, eIdx: number) => {
                        const rawAmt = Number(e.amount) || 0;
                        const linePartner = e.partner_id ? (partMap.get(e.partner_id) || entryPartner) : entryPartner;
                        const lineAcc = e.account_id ? coaMap.get(e.account_id) : null;
                        const accName = lineAcc?.name || (linePartner ? `${linePartner}` : (isReceipt ? 'Customer / Income' : 'Expense / Vendor'));
                        const accCode = lineAcc?.code || '';
                        const accType = lineAcc?.type || '';

                        let debit = 0;
                        let credit = 0;

                        if (isReceipt) {
                            if (e.entry_type === 'debit' || rawAmt < 0) {
                                debit = Math.abs(rawAmt);
                            } else {
                                credit = Math.abs(rawAmt);
                            }
                        } else {
                            const isCr = e.entry_type === 'credit' || rawAmt < 0;
                            if (isCr) {
                                credit = Math.abs(rawAmt);
                            } else {
                                debit = Math.abs(rawAmt);
                            }
                        }

                        const lineCcId = e.cost_center_id || pay.cost_center_id;
                        const lineCcName = lineCcId ? ccMap.get(lineCcId) : undefined;

                        return {
                            id: e.id || `exp-${pay.id}-${eIdx}`,
                            accountId: e.account_id || undefined,
                            accountCode: accCode,
                            accountName: accName,
                            accountType: accType,
                            name: e.notes || accName,
                            debit,
                            credit,
                            partnerName: linePartner,
                            costCenterName: lineCcName
                        };
                    });
                } else {
                    const accName = pay.account?.name || entryPartner || (isReceipt ? 'Customer / Income' : 'Expense Account');
                    const amt = Number(pay.amount) || 0;
                    const singleCcName = pay.cost_center_id ? ccMap.get(pay.cost_center_id) : undefined;
                    counterpartLines = [{
                        id: `cp-${pay.id}`,
                        accountId: pay.account_id || undefined,
                        accountCode: pay.account?.code || '',
                        accountName: accName,
                        accountType: pay.account?.type || '',
                        name: pay.notes || accName,
                        debit: isReceipt ? 0 : amt,
                        credit: isReceipt ? amt : 0,
                        partnerName: entryPartner,
                        costCenterName: singleCcName
                    }];
                }

                // Determine Particulars (Tally Standard)
                let particulars = '';
                if (isReceipt) {
                    if (entryPartner) {
                        particulars = entryPartner;
                    } else if (counterpartLines.length > 0) {
                        particulars = counterpartLines.map(l => l.accountName).filter(Boolean).slice(0, 2).join(', ');
                        if (counterpartLines.length > 2) particulars += '...';
                    } else {
                        particulars = pay.notes || 'Receipt';
                    }
                } else {
                    if (entryPartner) {
                        particulars = entryPartner;
                    } else if (counterpartLines.length > 0) {
                        particulars = counterpartLines.map(l => l.accountName).filter(Boolean).slice(0, 2).join(', ');
                        if (counterpartLines.length > 2) particulars += '...';
                    } else {
                        particulars = pay.notes || 'Payment';
                    }
                }

                const payTotal = Number(pay.amount) || 0;
                const debitAmount = isReceipt ? 0 : payTotal;
                const creditAmount = isReceipt ? payTotal : 0;

                const formattedLines = isReceipt 
                    ? [...bankLines, ...counterpartLines]
                    : [...counterpartLines, ...bankLines];

                parsedPaymentVouchers.push({
                    id: pay.id,
                    date: pay.date,
                    formattedDate: formatTallyDate(pay.date),
                    reference: payRef || 'UNNUMBERED',
                    voucherType,
                    particulars,
                    debitAmount,
                    creditAmount,
                    notes: pay.notes || '',
                    state: displayState,
                    partnerName: entryPartner,
                    journalName: pay.journal?.name || (isReceipt ? 'Receipt' : 'Payment'),
                    lines: formattedLines
                });
            }

            // Combine all vouchers and sort by date ascending, then reference
            const allVouchers = [...parsedJournalVouchers, ...parsedPaymentVouchers];
            allVouchers.sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return a.reference.localeCompare(b.reference, undefined, { numeric: true });
            });

            setVouchers(allVouchers);
        } catch (err: any) {
            console.error('Error fetching day book:', err);
            setError(err.message || 'Failed to load Day Book vouchers');
        } finally {
            setLoading(false);
        }
    }, [currentCompanyId, startDate, endDate]);

    useEffect(() => {
        fetchDayBook();
    }, [fetchDayBook]);

    // Filter & Sort Logic
    const filteredAndSortedVouchers = useMemo(() => {
        let result = [...vouchers];

        // Voucher Type Filter
        if (voucherTypeFilter !== 'ALL') {
            result = result.filter(v => v.voucherType === voucherTypeFilter);
        }

        // Status Filter
        if (statusFilter !== 'ALL') {
            result = result.filter(v => v.state === statusFilter);
        }

        // Search Term Filter
        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase().trim();
            result = result.filter(v => {
                const matchRef = v.reference.toLowerCase().includes(query);
                const matchParticulars = v.particulars.toLowerCase().includes(query);
                const matchType = v.voucherType.toLowerCase().includes(query);
                const matchNotes = v.notes.toLowerCase().includes(query);
                const matchPartner = (v.partnerName || '').toLowerCase().includes(query);
                const matchPo = (v.clientPoNumber || '').toLowerCase().includes(query) || (v.clientPoDate || '').toLowerCase().includes(query);
                const matchAmount =
                    v.debitAmount.toString().includes(query) ||
                    v.creditAmount.toString().includes(query);
                const matchLines = v.lines.some(l =>
                    l.accountName.toLowerCase().includes(query) ||
                    l.accountCode.toLowerCase().includes(query) ||
                    (l.name || '').toLowerCase().includes(query)
                );
                return matchRef || matchParticulars || matchType || matchNotes || matchPartner || matchPo || matchAmount || matchLines;
            });
        }

        // Sorting
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'date':
                    comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
                    break;
                case 'reference':
                    comparison = a.reference.localeCompare(b.reference, undefined, { numeric: true });
                    break;
                case 'particulars':
                    comparison = a.particulars.localeCompare(b.particulars);
                    break;
                case 'amount': {
                    const amtA = Math.max(a.debitAmount, a.creditAmount);
                    const amtB = Math.max(b.debitAmount, b.creditAmount);
                    comparison = amtA - amtB;
                    break;
                }
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [vouchers, voucherTypeFilter, statusFilter, searchTerm, sortField, sortOrder]);

    // Totals Calculation
    const totals = useMemo(() => {
        let totalDebit = 0;
        let totalCredit = 0;
        filteredAndSortedVouchers.forEach(v => {
            totalDebit += v.debitAmount;
            totalCredit += v.creditAmount;
        });
        const difference = totalDebit - totalCredit;
        return {
            count: filteredAndSortedVouchers.length,
            totalDebit,
            totalCredit,
            difference
        };
    }, [filteredAndSortedVouchers]);

    // Toggle individual row expansion
    const toggleVoucherExpansion = (id: string) => {
        setExpandedVoucherIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Toggle all expanded
    const toggleAllDetailed = () => {
        if (expandedVoucherIds.size === filteredAndSortedVouchers.length && filteredAndSortedVouchers.length > 0) {
            setExpandedVoucherIds(new Set());
        } else {
            setExpandedVoucherIds(new Set(filteredAndSortedVouchers.map(v => v.id)));
        }
    };

    const isDetailedView = filteredAndSortedVouchers.length > 0 && expandedVoucherIds.size === filteredAndSortedVouchers.length;

    // CSV Export
    const handleExportCSV = () => {
        if (filteredAndSortedVouchers.length === 0) return;

        const headers = ['Date', 'Particulars', 'Voucher Type', 'Voucher No', 'Debit Amount', 'Credit Amount', 'Status', 'Narration'];
        const rows = filteredAndSortedVouchers.map(v => [
            `"${v.formattedDate}"`,
            `"${v.particulars.replace(/"/g, '""')}"`,
            `"${v.voucherType}"`,
            `"${v.reference}"`,
            v.debitAmount > 0 ? v.debitAmount.toFixed(2) : '',
            v.creditAmount > 0 ? v.creditAmount.toFixed(2) : '',
            `"${v.state}"`,
            `"${(v.notes || '').replace(/"/g, '""')}"`
        ]);

        const totalsRow = [
            '"TOTAL"',
            '""',
            '""',
            `"${totals.count} Vouchers"`,
            totals.totalDebit.toFixed(2),
            totals.totalCredit.toFixed(2),
            '""',
            '""'
        ];

        const csvContent = [
            `"${companyInfo.name} - DAY BOOK"`,
            `"Period: ${startDate} to ${endDate}"`,
            `"Generated: ${new Date().toLocaleString()}"`,
            '',
            headers.join(','),
            ...rows.map(r => r.join(',')),
            totalsRow.join(',')
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `DayBook_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Voucher badge color helper
    const getVoucherBadgeStyle = (type: DayBookVoucher['voucherType']) => {
        switch (type) {
            case 'Payment':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
            case 'Receipt':
                return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
            case 'Sales':
                return 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800';
            case 'Purchase':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
            case 'Journal':
                return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
            case 'Contra':
                return 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 border-slate-300 dark:border-zinc-700';
        }
    };

    return (
        <div className="space-y-4 max-w-[1400px] mx-auto pb-12 print:p-0 print:m-0 print:max-w-full print:h-auto print:overflow-visible print:space-y-0">
            {/* Printable Report Header (Hidden in UI, visible on Print) */}
            <div className="hidden print:block mb-6 border-b-2 border-slate-800 pb-4 text-center print:break-inside-avoid">
                <h1 className="text-2xl font-black tracking-wider uppercase text-slate-900">{companyInfo.name}</h1>
                <h2 className="text-lg font-bold text-slate-700 uppercase tracking-wide mt-1">DAY BOOK (Transaction Register)</h2>
                <p className="text-xs text-slate-500 mt-1">
                    Period: <span className="font-semibold text-slate-800">{formatTallyDate(startDate)} to {formatTallyDate(endDate)}</span> | Currency: <span className="font-semibold text-slate-800">{companyInfo.currency}</span>
                </p>
            </div>

            {/* Top Toolbar: Title, View Switcher & Action Buttons */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm no-print">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded-xl">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Day Book</h2>
                            <span className="px-2 py-0.5 text-[11px] font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-full border border-violet-200 dark:border-violet-800">
                                TallyPrime Format
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Chronological register of all financial vouchers (Payments, Receipts, Sales, Purchases, Journals)
                        </p>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Condensed / Detailed Toggle */}
                    <button
                        onClick={toggleAllDetailed}
                        title="Toggle Detailed view showing all ledger lines and narration (Shortcut: Alt + F1)"
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border transition-all shadow-sm ${
                            isDetailedView
                                ? 'bg-violet-600 text-white border-violet-600'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700'
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{isDetailedView ? 'Detailed Mode (Alt+F1)' : 'Condensed Mode'}</span>
                    </button>

                    {/* CSV Export */}
                    <button
                        onClick={handleExportCSV}
                        disabled={filteredAndSortedVouchers.length === 0}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 rounded-lg transition-all shadow-sm disabled:opacity-50"
                        title="Export current vouchers to CSV spreadsheet"
                    >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span>Export CSV</span>
                    </button>

                    {/* Print Button */}
                    <PrintButton label="Print Day Book" />

                    {/* Refresh */}
                    <button
                        onClick={() => fetchDayBook()}
                        disabled={loading}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 transition-all shadow-sm"
                        title="Reload Day Book"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3 no-print">
                {/* Date Presets */}
                <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Period:
                    </span>
                    {(
                        [
                            { id: 'today', label: 'Today' },
                            { id: 'yesterday', label: 'Yesterday' },
                            { id: 'this_week', label: 'This Week' },
                            { id: 'this_month', label: 'This Month' },
                            { id: 'last_month', label: 'Last Month' },
                            { id: 'august_2026', label: 'August 2026' },
                            { id: 'all', label: 'All Dates' }
                        ] as const
                    ).map(p => (
                        <button
                            key={p.id}
                            onClick={() => handlePresetChange(p.id)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                                preset === p.id
                                    ? 'bg-violet-600 text-white shadow-sm'
                                    : 'bg-slate-50 dark:bg-zinc-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Date inputs, Voucher Type Filter, Status, Search & Sort */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                    {/* Date Pickers */}
                    <div className="lg:col-span-3 flex items-center gap-2">
                        <div className="flex-1">
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">From Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => {
                                    setStartDate(e.target.value);
                                    setPreset('custom');
                                }}
                                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">To Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => {
                                    setEndDate(e.target.value);
                                    setPreset('custom');
                                }}
                                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                        </div>
                    </div>

                    {/* Voucher Type Dropdown */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Vch Type</label>
                        <select
                            value={voucherTypeFilter}
                            onChange={e => setVoucherTypeFilter(e.target.value as VoucherTypeFilter)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
                        >
                            <option value="ALL">All Voucher Types</option>
                            <option value="Payment">Payment (PBV/PCV)</option>
                            <option value="Receipt">Receipt (BRV/CRV)</option>
                            <option value="Sales">Sales (SI/Invoices)</option>
                            <option value="Purchase">Purchase (PI/Bills)</option>
                            <option value="Journal">Journal (JV)</option>
                            <option value="Contra">Contra (Fund Transfer)</option>
                        </select>
                    </div>

                    {/* Status Dropdown */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Status</label>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="Posted">Posted Only</option>
                            <option value="Draft">Draft Only</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>

                    {/* Live Search */}
                    <div className="lg:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Search Day Book</label>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Voucher no, ledger, amount, narration..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                        </div>
                    </div>

                    {/* Sort Selector */}
                    <div className="lg:col-span-2 flex items-center gap-1">
                        <div className="flex-1">
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Sort By</label>
                            <select
                                value={sortField}
                                onChange={e => setSortField(e.target.value as SortField)}
                                className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
                            >
                                <option value="date">Date</option>
                                <option value="reference">Vch No.</option>
                                <option value="particulars">Particulars</option>
                                <option value="amount">Amount</option>
                            </select>
                        </div>
                        <button
                            onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                            className="p-1.5 mt-5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-zinc-700 transition-all"
                            title={`Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
                        >
                            <ArrowUpDown className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Summary Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 no-print">
                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Vouchers</p>
                    <p className="text-xl font-extrabold text-slate-800 dark:text-white mt-0.5">{totals.count}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Filtered in period</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Debit</p>
                    <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                        {companyInfo.currency} {formatNumber(totals.totalDebit)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Payments & Outflows</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Credit</p>
                    <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                        {companyInfo.currency} {formatNumber(totals.totalCredit)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Purchases & Payables</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Movement</p>
                    <p className={`text-xl font-extrabold mt-0.5 ${totals.difference >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {companyInfo.currency} {formatNumber(Math.abs(totals.difference))}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{totals.difference >= 0 ? 'Debit Surplus' : 'Credit Surplus'}</p>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
                    ⚠️ {error}
                </div>
            )}

            {/* Main Day Book Table (Tally Replica) */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden print:border print:border-slate-800 print:shadow-none print:rounded-none print:overflow-visible print:h-auto print:m-0">
                <div className="overflow-x-auto print:overflow-visible print:h-auto">
                    <table className="w-full text-left text-xs border-collapse print:text-[11px] print:w-full">
                        {/* Table Header: Exactly matching Tally Day Book */}
                        <thead className="print:table-header-group">
                            <tr className="bg-slate-100 dark:bg-zinc-800/90 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-zinc-700 text-[11px] font-bold uppercase tracking-wider print:bg-slate-200 print:text-black">
                                <th className="py-2.5 px-3 w-10 text-center no-print">#</th>
                                <th className="py-2.5 px-3 w-28 whitespace-nowrap">Date</th>
                                <th className="py-2.5 px-3 min-w-[240px]">Particulars</th>
                                <th className="py-2.5 px-3 w-28 whitespace-nowrap">Vch Type</th>
                                <th className="py-2.5 px-3 w-36 whitespace-nowrap">Vch No.</th>
                                <th className="py-2.5 px-3 w-36 text-right whitespace-nowrap">Debit Amount</th>
                                <th className="py-2.5 px-3 w-36 text-right whitespace-nowrap">Credit Amount</th>
                                <th className="py-2.5 px-3 w-20 text-center no-print">Status</th>
                                <th className="py-2.5 px-3 w-24 text-center no-print whitespace-nowrap">Action</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 print:divide-slate-300">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-violet-600" />
                                            <span className="font-medium">Loading Day Book transactions...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredAndSortedVouchers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400">
                                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-zinc-700" />
                                        <p className="font-semibold text-slate-600 dark:text-slate-400">No vouchers found in this period</p>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            Try switching the period preset to <span className="font-bold text-violet-600 cursor-pointer" onClick={() => handlePresetChange('this_month')}>This Month</span> or <span className="font-bold text-violet-600 cursor-pointer" onClick={() => handlePresetChange('all')}>All Dates</span>.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAndSortedVouchers.map((v, index) => {
                                    const isExpanded = expandedVoucherIds.has(v.id);
                                    const dest = getVoucherDestination(v);

                                    return (
                                        <React.Fragment key={v.id}>
                                            {/* Primary Condensed Row */}
                                            <tr
                                                onClick={() => toggleVoucherExpansion(v.id)}
                                                onDoubleClick={() => onNavigateToEntry?.(v)}
                                                title={`Click to expand breakdown | Double-click to open in ${dest.fullLabel}`}
                                                className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60 print:break-inside-avoid print:text-black ${
                                                    index % 2 === 1 ? 'bg-slate-50/40 dark:bg-zinc-900/40 print:bg-slate-50/50' : 'print:bg-white'
                                                } ${isExpanded ? 'bg-violet-50/40 dark:bg-violet-950/20' : ''}`}
                                            >
                                                {/* Expand Arrow / Index */}
                                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] no-print">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-3.5 h-3.5 text-violet-600" />
                                                        ) : (
                                                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                                        )}
                                                        <span>{index + 1}</span>
                                                    </div>
                                                </td>

                                                {/* Date */}
                                                <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                                    {v.formattedDate}
                                                </td>

                                                {/* Particulars (Ledger / Party) */}
                                                <td className="py-2.5 px-3 text-slate-900 dark:text-white font-semibold">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span>{v.particulars}</span>
                                                        {v.clientPoNumber && (
                                                            <span className="text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-1.5 py-0.5 rounded" title={`Client PO Date: ${v.clientPoDate || 'N/A'}`}>
                                                                PO: {v.clientPoNumber}
                                                            </span>
                                                        )}
                                                        {v.notes && !isExpanded && (
                                                            <span className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]" title={v.notes}>
                                                                — {v.notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Voucher Type */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getVoucherBadgeStyle(v.voucherType)}`}>
                                                        {v.voucherType}
                                                    </span>
                                                </td>

                                                {/* Voucher No. (Ref) - Clickable Link on Screen, Plain Text on Print */}
                                                <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                                                    <span className="hidden print:inline text-black">{v.reference}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onNavigateToEntry?.(v);
                                                        }}
                                                        className="no-print inline-flex items-center gap-1 text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-white hover:underline group cursor-pointer"
                                                        title={`Click to open ${v.reference} in ${dest.fullLabel}`}
                                                    >
                                                        <span>{v.reference}</span>
                                                        <ExternalLink className="w-3 h-3 text-violet-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                                                    </button>
                                                </td>

                                                {/* Debit Amount */}
                                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                    {v.debitAmount > 0 ? formatNumber(v.debitAmount) : '—'}
                                                </td>

                                                {/* Credit Amount */}
                                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                    {v.creditAmount > 0 ? formatNumber(v.creditAmount) : '—'}
                                                </td>

                                                {/* Status Badge */}
                                                <td className="py-2.5 px-3 text-center no-print whitespace-nowrap">
                                                    {v.state === 'Posted' ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                                                            <CheckCircle2 className="w-2.5 h-2.5" />
                                                            Posted
                                                        </span>
                                                    ) : v.state === 'Draft' ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                                                            <Clock className="w-2.5 h-2.5" />
                                                            Draft
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
                                                            <XCircle className="w-2.5 h-2.5" />
                                                            Cancelled
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Action Button */}
                                                <td className="py-2.5 px-3 text-center no-print whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onNavigateToEntry?.(v);
                                                        }}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-violet-100 hover:bg-violet-200 dark:bg-violet-950/50 dark:hover:bg-violet-900/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 transition shadow-2xs cursor-pointer"
                                                        title={`Open voucher in ${dest.fullLabel} to view or edit`}
                                                    >
                                                        <span>{dest.label}</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Detailed Breakdown Row (Tally Alt+F1 expansion) */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/80 dark:bg-zinc-950/50 border-y border-dashed border-slate-200 dark:border-zinc-800 print:break-inside-avoid print:bg-slate-50/50 print:text-black">
                                                    <td colSpan={9} className="py-3 px-6">
                                                        <div className="pl-6 border-l-2 border-violet-400 dark:border-violet-600 space-y-3 py-1">
                                                            {/* Breakdown Header with Quick Action */}
                                                            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-200/80 dark:border-zinc-800">
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                    Accounting Entries (Double Entry Breakdown):
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onNavigateToEntry?.(v)}
                                                                    className="no-print inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition shadow-xs cursor-pointer"
                                                                >
                                                                    <Edit className="w-3 h-3" />
                                                                    <span>Open in {dest.fullLabel} to Modify</span>
                                                                    <ExternalLink className="w-3 h-3 ml-0.5" />
                                                                </button>
                                                            </div>

                                                            {/* All Journal Legs */}
                                                            <div className="space-y-1">
                                                                <table className="w-full text-xs font-mono">
                                                                    <tbody>
                                                                        {v.lines.map((line, lIdx) => (
                                                                            <tr key={line.id || lIdx} className="text-[11px] hover:bg-slate-100/50 dark:hover:bg-zinc-800/40">
                                                                                <td className="w-10 text-slate-400 font-bold">
                                                                                    {line.debit > 0 ? 'Dr.' : '    Cr.'}
                                                                                </td>
                                                                                <td className="py-0.5 font-sans font-medium text-slate-800 dark:text-slate-200">
                                                                                    <span className="font-mono text-slate-500 mr-2">{line.accountCode}</span>
                                                                                    <span>{line.accountName}</span>
                                                                                    {line.partnerName && (
                                                                                        <span className="ml-2 text-[10px] text-slate-400 font-normal">
                                                                                            (Party: {line.partnerName})
                                                                                        </span>
                                                                                    )}
                                                                                    {line.costCenterName && (
                                                                                        <span className="ml-2 text-[10px] text-purple-700 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 rounded px-1.5 py-0.5 font-mono">
                                                                                            🎯 {line.costCenterName}
                                                                                        </span>
                                                                                    )}
                                                                                    {line.name && line.name !== line.accountName && (
                                                                                        <span className="ml-2 text-[10px] text-slate-400 italic">
                                                                                            [{line.name}]
                                                                                        </span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="w-32 text-right pr-6 font-semibold text-slate-700 dark:text-slate-300">
                                                                                    {line.debit > 0 ? formatNumber(line.debit) : ''}
                                                                                </td>
                                                                                <td className="w-32 text-right pr-3 font-semibold text-slate-700 dark:text-slate-300">
                                                                                    {line.credit > 0 ? formatNumber(line.credit) : ''}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>

                                                            {/* Narration */}
                                                            {v.notes && (
                                                                <div className="pt-1 border-t border-slate-200 dark:border-zinc-800 text-[11px]">
                                                                    <span className="font-bold text-slate-500 dark:text-slate-400 mr-1">Narration:</span>
                                                                    <span className="text-slate-700 dark:text-slate-300 italic">{v.notes}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>

                        {/* Sticky Totals Footer (Exact Tally Format) */}
                        {filteredAndSortedVouchers.length > 0 && (
                            <tfoot className="print:table-footer-group">
                                <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white font-extrabold border-t-2 border-slate-300 dark:border-zinc-700 text-xs print:bg-slate-200 print:text-black print:break-inside-avoid">
                                    <td className="py-3 px-3 text-center no-print"></td>
                                    <td className="py-3 px-3 uppercase tracking-wider">Total</td>
                                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-medium">
                                        {totals.count} Vouchers Listed
                                    </td>
                                    <td className="py-3 px-3"></td>
                                    <td className="py-3 px-3"></td>
                                    <td className="py-3 px-3 text-right font-mono text-sm text-blue-600 dark:text-blue-400">
                                        {formatNumber(totals.totalDebit)}
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono text-sm text-amber-600 dark:text-amber-400">
                                        {formatNumber(totals.totalCredit)}
                                    </td>
                                    <td className="py-3 px-3 no-print"></td>
                                    <td className="py-3 px-3 no-print"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Printable Sign-off Block */}
            <div className="hidden print:grid grid-cols-3 gap-8 mt-12 pt-8 border-t border-slate-300 text-center text-xs text-slate-600 print:break-inside-avoid">
                <div>
                    <div className="border-b border-slate-400 pb-12 mb-2"></div>
                    <p className="font-bold">Prepared By</p>
                    <p className="text-[10px] text-slate-400">Accountant / Data Entry</p>
                </div>
                <div>
                    <div className="border-b border-slate-400 pb-12 mb-2"></div>
                    <p className="font-bold">Verified By</p>
                    <p className="text-[10px] text-slate-400">Internal Auditor / Finance Officer</p>
                </div>
                <div>
                    <div className="border-b border-slate-400 pb-12 mb-2"></div>
                    <p className="font-bold">Approved By</p>
                    <p className="text-[10px] text-slate-400">Chief Financial Officer / Managing Director</p>
                </div>
            </div>
        </div>
    );
};
