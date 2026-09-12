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
    Printer
} from 'lucide-react';
import { PrintButton } from '../../ui/PrintButton';

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
    lines: DayBookLine[];
}

type PeriodPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'august_2026' | 'all' | 'custom';
type VoucherTypeFilter = 'ALL' | 'Payment' | 'Receipt' | 'Sales' | 'Purchase' | 'Journal' | 'Contra';
type StatusFilter = 'ALL' | 'Posted' | 'Draft' | 'Cancelled';
type SortField = 'date' | 'reference' | 'amount' | 'particulars';
type SortOrder = 'asc' | 'desc';

export const DayBook: React.FC = () => {
    const { currentCompanyId } = useAuth();

    // Company profile
    const [companyInfo, setCompanyInfo] = useState<{ name: string; currency: string }>({
        name: 'KAA ERP',
        currency: 'QAR'
    });

    // Date range & preset - default to August 2026 so live data is immediately visible
    const [preset, setPreset] = useState<PeriodPreset>('august_2026');
    const [startDate, setStartDate] = useState<string>('2026-08-01');
    const [endDate, setEndDate] = useState<string>('2026-08-31');

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
                const todayStr = today.toISOString().split('T')[0];
                setStartDate(todayStr);
                setEndDate(todayStr);
                break;
            }
            case 'yesterday': {
                const y = new Date(today);
                y.setDate(y.getDate() - 1);
                const yStr = y.toISOString().split('T')[0];
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
                setStartDate(firstDay.toISOString().split('T')[0]);
                setEndDate(lastDay.toISOString().split('T')[0]);
                break;
            }
            case 'this_month': {
                const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
                setStartDate(start);
                setEndDate(end);
                break;
            }
            case 'last_month': {
                const start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
                const end = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
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
            // Query journal entries joined with journal, partner, and lines
            let query = supabase
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
                query = query.gte('date', startDate);
            }
            if (endDate) {
                query = query.lte('date', endDate);
            }

            // Order by date
            query = query.order('date', { ascending: true });

            const { data, error: fetchErr } = await query;
            if (fetchErr) throw fetchErr;

            // Transform raw entries to DayBookVoucher items
            const parsedVouchers: DayBookVoucher[] = (data || []).map((entry: any) => {
                const ref = (entry.reference || '').trim();
                const upperRef = ref.toUpperCase();
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
                    costCenterName: l.cost_center_id ? 'CC' : undefined
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
                    lines: formattedLines
                };
            });

            setVouchers(parsedVouchers);
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
                const matchAmount =
                    v.debitAmount.toString().includes(query) ||
                    v.creditAmount.toString().includes(query);
                const matchLines = v.lines.some(l =>
                    l.accountName.toLowerCase().includes(query) ||
                    l.accountCode.toLowerCase().includes(query) ||
                    (l.name || '').toLowerCase().includes(query)
                );
                return matchRef || matchParticulars || matchType || matchNotes || matchPartner || matchAmount || matchLines;
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
        <div className="space-y-4 max-w-[1400px] mx-auto pb-12 print:p-0 print:m-0 print:max-w-full">
            {/* Printable Report Header (Hidden in UI, visible on Print) */}
            <div className="hidden print:block mb-6 border-b-2 border-slate-800 pb-4 text-center">
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
                            { id: 'august_2026', label: 'August 2026 (Live Data)' },
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
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden print:border print:border-slate-800">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        {/* Table Header: Exactly matching Tally Day Book */}
                        <thead>
                            <tr className="bg-slate-100 dark:bg-zinc-800/90 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-zinc-700 text-[11px] font-bold uppercase tracking-wider">
                                <th className="py-2.5 px-3 w-10 text-center no-print">#</th>
                                <th className="py-2.5 px-3 w-28 whitespace-nowrap">Date</th>
                                <th className="py-2.5 px-3 min-w-[240px]">Particulars</th>
                                <th className="py-2.5 px-3 w-28 whitespace-nowrap">Vch Type</th>
                                <th className="py-2.5 px-3 w-36 whitespace-nowrap">Vch No.</th>
                                <th className="py-2.5 px-3 w-36 text-right whitespace-nowrap">Debit Amount</th>
                                <th className="py-2.5 px-3 w-36 text-right whitespace-nowrap">Credit Amount</th>
                                <th className="py-2.5 px-3 w-20 text-center no-print">Status</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-violet-600" />
                                            <span className="font-medium">Loading Day Book transactions...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredAndSortedVouchers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-zinc-700" />
                                        <p className="font-semibold text-slate-600 dark:text-slate-400">No vouchers found in this period</p>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            Try switching the period preset to <span className="font-bold text-violet-600 cursor-pointer" onClick={() => handlePresetChange('august_2026')}>August 2026</span> or <span className="font-bold text-violet-600 cursor-pointer" onClick={() => handlePresetChange('all')}>All Dates</span>.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAndSortedVouchers.map((v, index) => {
                                    const isExpanded = expandedVoucherIds.has(v.id);

                                    return (
                                        <React.Fragment key={v.id}>
                                            {/* Primary Condensed Row */}
                                            <tr
                                                onClick={() => toggleVoucherExpansion(v.id)}
                                                className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60 ${
                                                    index % 2 === 1 ? 'bg-slate-50/40 dark:bg-zinc-900/40' : ''
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
                                                    <div className="flex items-center gap-2">
                                                        <span>{v.particulars}</span>
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

                                                {/* Voucher No. (Ref) */}
                                                <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                    {v.reference}
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
                                            </tr>

                                            {/* Detailed Breakdown Row (Tally Alt+F1 expansion) */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/80 dark:bg-zinc-950/50 border-y border-dashed border-slate-200 dark:border-zinc-800">
                                                    <td colSpan={8} className="py-2 px-6">
                                                        <div className="pl-6 border-l-2 border-violet-400 dark:border-violet-600 space-y-2 py-1">
                                                            {/* All Journal Legs */}
                                                            <div className="space-y-1">
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accounting Entries (Double Entry Breakdown):</p>
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
                            <tfoot>
                                <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white font-extrabold border-t-2 border-slate-300 dark:border-zinc-700 text-xs">
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
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Printable Sign-off Block */}
            <div className="hidden print:grid grid-cols-3 gap-8 mt-12 pt-8 border-t border-slate-300 text-center text-xs text-slate-600">
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
