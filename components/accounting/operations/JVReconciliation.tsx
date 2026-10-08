import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
    Scale, CheckCircle2, AlertCircle, RefreshCw, Search, ArrowRight, ExternalLink,
    ShieldCheck, FileText, Download, Check, X, Sparkles, Filter, Calendar,
    AlertTriangle, Layers, RotateCcw, Lock, ArrowUpRight, ArrowDownRight, Info
} from 'lucide-react';
import { PeriodFilter, PeriodPreset, getDatesForPreset } from '../common/PeriodFilter';
import { formatLocalDate } from '../../../lib/dateFormat';

const checkIsAdmin = (role: string | null | undefined): boolean =>
    ['admin', 'super admin', 'administrator'].includes(role?.toLowerCase() || '');

export interface JVReconciliationProps {
    onNavigateToEntry?: (voucher: any) => void;
}

interface ReconciliationLine {
    line_id: string;
    entry_id: string;
    date: string;
    voucher_ref: string;
    move_type: string;
    partner_id?: string;
    partner_name?: string;
    description: string;
    debit: number;
    credit: number;
    is_reconciled: boolean;
    reconciled_at?: string;
    reconciled_by?: string;
    reconciler_name?: string;
    reconciliation_ref?: string;
    reconciliation_notes?: string;
    journal_code?: string;
    journal_name?: string;
}

interface AccountItem {
    id: string;
    code: string;
    name: string;
    type: string;
    subtype?: string;
    is_reconcilable?: boolean;
}

export const JVReconciliation: React.FC<JVReconciliationProps> = ({ onNavigateToEntry }) => {
    const { currentCompanyId, userRole, hasPermission, profile, user } = useAuth();

    // Authority Check: Only financial controllers or admins can reconcile / unreconcile
    const canManageReconciliation = useMemo(() => {
        return (
            checkIsAdmin(userRole) ||
            hasPermission('*') ||
            hasPermission('finance.*') ||
            hasPermission('finance.reconciliation.manage')
        );
    }, [userRole, hasPermission]);

    // Accounts State
    const [accounts, setAccounts] = useState<AccountItem[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [filterOnlyReconcilable, setFilterOnlyReconcilable] = useState(false);
    const [accountSearch, setAccountSearch] = useState('');

    // Currency
    const [companyCurrency, setCompanyCurrency] = useState('QAR');

    // Lines & Data State
    const [lines, setLines] = useState<ReconciliationLine[]>([]);
    const [loadingLines, setLoadingLines] = useState(false);
    const [stats, setStats] = useState({
        unreconciled_debit: 0,
        unreconciled_credit: 0,
        unreconciled_balance: 0,
        reconciled_debit: 0,
        reconciled_credit: 0
    });

    // Filters
    const [statusFilter, setStatusFilter] = useState<'unreconciled' | 'reconciled' | 'all'>('unreconciled');
    const [preset, setPreset] = useState<PeriodPreset>('all');
    const [startDate, setStartDate] = useState<string>(() => getDatesForPreset('all').startDate);
    const [endDate, setEndDate] = useState<string>(() => getDatesForPreset('all').endDate);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
    const [batchSearch, setBatchSearch] = useState('');

    // Selection for Reconciliation
    const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());

    // Modal & Action State
    const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
    const [reconcileRef, setReconcileRef] = useState('');
    const [reconcileNotes, setReconcileNotes] = useState('');
    const [allowUnbalanced, setAllowUnbalanced] = useState(false);
    const [processingAction, setProcessingAction] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Unreconcile Confirmation State
    const [unreconcileTarget, setUnreconcileTarget] = useState<{ batchRef?: string; lineId?: string } | null>(null);

    // Load Company Currency
    useEffect(() => {
        if (!currentCompanyId) return;
        const fetchCompany = async () => {
            const { data } = await supabase.from('companies').select('currency').eq('id', currentCompanyId).maybeSingle();
            if (data?.currency) setCompanyCurrency(data.currency);
        };
        fetchCompany();
    }, [currentCompanyId]);

    // Load Accounts
    useEffect(() => {
        if (!currentCompanyId) return;
        const fetchAccounts = async () => {
            setLoadingAccounts(true);
            try {
                const { data, error } = await supabase
                    .from('accounting_chart_of_accounts')
                    .select('id, code, name, type, subtype, is_reconcilable')
                    .or(`company_id.eq.${currentCompanyId},company_id.is.null`)
                    .order('code', { ascending: true });

                if (error) throw error;
                const items: AccountItem[] = data || [];
                setAccounts(items);

                // Auto-select first account if not selected
                if (items.length > 0 && !selectedAccountId) {
                    const preferred = items.find(a => 
                        a.is_reconcilable || 
                        a.name.toLowerCase().includes('clearing') || 
                        a.name.toLowerCase().includes('suspense') ||
                        a.name.toLowerCase().includes('payable') ||
                        a.name.toLowerCase().includes('receivable')
                    ) || items[0];
                    setSelectedAccountId(preferred.id);
                }
            } catch (err) {
                console.error('Error fetching accounts for reconciliation:', err);
            } finally {
                setLoadingAccounts(false);
            }
        };
        fetchAccounts();
    }, [currentCompanyId]);

    // Fetch Lines for Selected Account
    const fetchLines = useCallback(async () => {
        if (!currentCompanyId || !selectedAccountId) return;
        setLoadingLines(true);
        setSelectedLineIds(new Set());
        setActionMessage(null);

        try {
            // 1. Try RPC first
            const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_get_reconciliation_lines', {
                p_company_id: currentCompanyId,
                p_account_id: selectedAccountId,
                p_status: statusFilter,
                p_start_date: preset === 'all' ? null : startDate,
                p_end_date: preset === 'all' ? null : endDate,
                p_partner_id: selectedPartnerId ? selectedPartnerId : null,
                p_reconciliation_ref: batchSearch.trim() ? batchSearch.trim() : null
            });

            if (!rpcError && rpcData && rpcData.success) {
                const formattedLines: ReconciliationLine[] = (rpcData.lines || []).map((l: any) => ({
                    line_id: l.line_id,
                    entry_id: l.entry_id,
                    date: l.date,
                    voucher_ref: l.voucher_ref || 'JV',
                    move_type: l.move_type,
                    partner_id: l.partner_id,
                    partner_name: l.partner_name,
                    description: l.description,
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0,
                    is_reconciled: !!l.is_reconciled,
                    reconciled_at: l.reconciled_at,
                    reconciled_by: l.reconciled_by,
                    reconciler_name: l.reconciler_name,
                    reconciliation_ref: l.reconciliation_ref,
                    reconciliation_notes: l.reconciliation_notes,
                    journal_code: l.journal_code,
                    journal_name: l.journal_name
                }));
                setLines(formattedLines);
                if (rpcData.stats) {
                    setStats({
                        unreconciled_debit: Number(rpcData.stats.unreconciled_debit) || 0,
                        unreconciled_credit: Number(rpcData.stats.unreconciled_credit) || 0,
                        unreconciled_balance: Number(rpcData.stats.unreconciled_balance) || 0,
                        reconciled_debit: Number(rpcData.stats.reconciled_debit) || 0,
                        reconciled_credit: Number(rpcData.stats.reconciled_credit) || 0
                    });
                }
                return;
            }

            // 2. Resilient Direct Fallback Query
            let query = supabase
                .from('accounting_journal_lines')
                .select(`
                    id, entry_id, name, debit, credit, is_reconciled, reconciled_at, reconciled_by, reconciliation_ref, reconciliation_notes,
                    entry:accounting_journal_entries!entry_id(
                        id, date, reference, notes, move_type, state,
                        journal:accounting_journals(name, code)
                    ),
                    partner:accounting_partners(id, name)
                `)
                .eq('company_id', currentCompanyId)
                .eq('account_id', selectedAccountId);

            if (statusFilter === 'unreconciled') {
                query = query.or('is_reconciled.is.null,is_reconciled.eq.false');
            } else if (statusFilter === 'reconciled') {
                query = query.eq('is_reconciled', true);
            }

            if (preset !== 'all') {
                query = query.filter('entry.date', 'gte', startDate).filter('entry.date', 'lte', endDate);
            }

            if (selectedPartnerId) {
                query = query.eq('partner_id', selectedPartnerId);
            }

            const { data, error } = await query;
            if (error) throw error;

            const mapped: ReconciliationLine[] = (data || [])
                .filter((d: any) => d.entry && d.entry.state === 'Posted')
                .map((d: any) => ({
                    line_id: d.id,
                    entry_id: d.entry?.id || d.entry_id,
                    date: d.entry?.date || '',
                    voucher_ref: d.entry?.reference || 'JV',
                    move_type: d.entry?.move_type || 'entry',
                    partner_id: d.partner?.id,
                    partner_name: d.partner?.name || '',
                    description: d.name || d.entry?.notes || d.entry?.reference || 'Journal Line',
                    debit: Number(d.debit) || 0,
                    credit: Number(d.credit) || 0,
                    is_reconciled: !!d.is_reconciled,
                    reconciled_at: d.reconciled_at,
                    reconciled_by: d.reconciled_by,
                    reconciliation_ref: d.reconciliation_ref,
                    reconciliation_notes: d.reconciliation_notes,
                    journal_code: d.entry?.journal?.code,
                    journal_name: d.entry?.journal?.name
                }));

            mapped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setLines(mapped);

            let unrecDr = 0, unrecCr = 0, recDr = 0, recCr = 0;
            mapped.forEach(l => {
                if (l.is_reconciled) {
                    recDr += l.debit;
                    recCr += l.credit;
                } else {
                    unrecDr += l.debit;
                    unrecCr += l.credit;
                }
            });
            setStats({
                unreconciled_debit: unrecDr,
                unreconciled_credit: unrecCr,
                unreconciled_balance: unrecDr - unrecCr,
                reconciled_debit: recDr,
                reconciled_credit: recCr
            });

        } catch (err: any) {
            console.error('Error fetching reconciliation lines:', err);
            setActionMessage({ type: 'error', text: err.message || 'Failed to load account ledger transactions.' });
        } finally {
            setLoadingLines(false);
        }
    }, [currentCompanyId, selectedAccountId, statusFilter, preset, startDate, endDate, selectedPartnerId, batchSearch]);

    useEffect(() => {
        fetchLines();
    }, [fetchLines]);

    // Filtered Lines based on Search
    const filteredLines = useMemo(() => {
        if (!searchTerm) return lines;
        const term = searchTerm.toLowerCase().trim();
        return lines.filter(l => 
            l.voucher_ref.toLowerCase().includes(term) ||
            (l.partner_name && l.partner_name.toLowerCase().includes(term)) ||
            (l.description && l.description.toLowerCase().includes(term)) ||
            (l.reconciliation_ref && l.reconciliation_ref.toLowerCase().includes(term)) ||
            l.debit.toString().includes(term) ||
            l.credit.toString().includes(term)
        );
    }, [lines, searchTerm]);

    // Distinct Partners for Filter Dropdown
    const availablePartners = useMemo(() => {
        const map = new Map<string, string>();
        lines.forEach(l => {
            if (l.partner_id && l.partner_name) {
                map.set(l.partner_id, l.partner_name);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [lines]);

    // Selected Lines Metrics
    const selectedMetrics = useMemo(() => {
        let totalDebit = 0;
        let totalCredit = 0;
        let debitCount = 0;
        let creditCount = 0;

        lines.forEach(l => {
            if (selectedLineIds.has(l.line_id)) {
                if (l.debit > 0) {
                    totalDebit += l.debit;
                    debitCount++;
                }
                if (l.credit > 0) {
                    totalCredit += l.credit;
                    creditCount++;
                }
            }
        });

        const difference = Math.abs(totalDebit - totalCredit);
        const isBalanced = selectedLineIds.size > 0 && difference < 0.005;

        return {
            totalDebit,
            totalCredit,
            debitCount,
            creditCount,
            count: selectedLineIds.size,
            difference,
            isBalanced
        };
    }, [lines, selectedLineIds]);

    const toggleLineSelection = (lineId: string) => {
        setSelectedLineIds(prev => {
            const next = new Set(prev);
            if (next.has(lineId)) {
                next.delete(lineId);
            } else {
                next.add(lineId);
            }
            return next;
        });
    };

    const handleSelectAllVisible = () => {
        if (selectedLineIds.size === filteredLines.length) {
            setSelectedLineIds(new Set());
        } else {
            const next = new Set<string>();
            filteredLines.forEach(l => {
                if (!l.is_reconciled) next.add(l.line_id);
            });
            setSelectedLineIds(next);
        }
    };

    const handleAutoMatch = () => {
        const unreconciled = lines.filter(l => !l.is_reconciled);
        const matchedIds = new Set<string>();

        const debits = unreconciled.filter(l => l.debit > 0);
        const credits = unreconciled.filter(l => l.credit > 0);
        const usedCredits = new Set<string>();

        // 1. Same partner & same amount
        debits.forEach(d => {
            if (matchedIds.has(d.line_id)) return;
            const match = credits.find(c => 
                !usedCredits.has(c.line_id) && 
                Math.abs(c.credit - d.debit) < 0.005 &&
                d.partner_id && c.partner_id && d.partner_id === c.partner_id
            );
            if (match) {
                matchedIds.add(d.line_id);
                matchedIds.add(match.line_id);
                usedCredits.add(match.line_id);
            }
        });

        // 2. Same amount anywhere
        debits.forEach(d => {
            if (matchedIds.has(d.line_id)) return;
            const match = credits.find(c => 
                !usedCredits.has(c.line_id) && 
                Math.abs(c.credit - d.debit) < 0.005
            );
            if (match) {
                matchedIds.add(d.line_id);
                matchedIds.add(match.line_id);
                usedCredits.add(match.line_id);
            }
        });

        if (matchedIds.size > 0) {
            setSelectedLineIds(matchedIds);
            setActionMessage({
                type: 'success',
                text: `⚡ Auto-matched ${matchedIds.size} lines (${matchedIds.size / 2} balanced pairs). Click "Reconcile Selected Entries" below to finalize.`
            });
        } else {
            setActionMessage({
                type: 'error',
                text: 'No 1-to-1 exact matching debit and credit amounts found. Please select lines manually.'
            });
        }
    };

    const handleOpenReconcileModal = () => {
        if (selectedLineIds.size === 0) return;
        const now = new Date();
        const autoRef = `REC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        setReconcileRef(autoRef);
        setReconcileNotes('');
        setAllowUnbalanced(false);
        setIsReconcileModalOpen(true);
    };

    const handleConfirmReconcile = async () => {
        if (!currentCompanyId || selectedLineIds.size === 0) return;
        setProcessingAction(true);
        setActionMessage(null);

        const idsArray = Array.from(selectedLineIds);
        const refToUse = reconcileRef.trim() || `REC-${Date.now()}`;

        try {
            // 1. Try RPC
            const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_reconcile_journal_lines', {
                p_company_id: currentCompanyId,
                p_line_ids: idsArray,
                p_reconciliation_ref: refToUse,
                p_notes: reconcileNotes.trim() || null,
                p_allow_unbalanced: allowUnbalanced
            });

            if (!rpcError && rpcData?.success) {
                setIsReconcileModalOpen(false);
                setSelectedLineIds(new Set());
                setActionMessage({
                    type: 'success',
                    text: `✅ Successfully reconciled ${rpcData.line_count} journal lines with batch ref ${rpcData.reconciliation_ref}.`
                });
                await fetchLines();
                return;
            }

            // 2. Direct Supabase update fallback
            const { error: updateError } = await supabase
                .from('accounting_journal_lines')
                .update({
                    is_reconciled: true,
                    reconciled_at: new Date().toISOString(),
                    reconciled_by: user?.id || null,
                    reconciliation_ref: refToUse,
                    reconciliation_notes: reconcileNotes.trim() || null
                })
                .in('id', idsArray)
                .eq('company_id', currentCompanyId);

            if (updateError) throw updateError;

            setIsReconcileModalOpen(false);
            setSelectedLineIds(new Set());
            setActionMessage({
                type: 'success',
                text: `✅ Successfully reconciled ${idsArray.length} journal lines with batch ref ${refToUse}.`
            });
            await fetchLines();

        } catch (err: any) {
            console.error('Error during reconciliation:', err);
            setActionMessage({ type: 'error', text: err.message || 'Failed to reconcile journal lines.' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleConfirmUnreconcile = async () => {
        if (!currentCompanyId || !unreconcileTarget) return;
        setProcessingAction(true);
        setActionMessage(null);

        try {
            if (unreconcileTarget.batchRef) {
                const { error: rpcError } = await supabase.rpc('rpc_unreconcile_journal_lines', {
                    p_company_id: currentCompanyId,
                    p_reconciliation_ref: unreconcileTarget.batchRef
                });

                if (rpcError) {
                    await supabase
                        .from('accounting_journal_lines')
                        .update({
                            is_reconciled: false,
                            reconciled_at: null,
                            reconciled_by: null,
                            reconciliation_ref: null,
                            reconciliation_notes: null
                        })
                        .eq('company_id', currentCompanyId)
                        .eq('reconciliation_ref', unreconcileTarget.batchRef);
                }
                setActionMessage({
                    type: 'success',
                    text: `Reopened batch ${unreconcileTarget.batchRef}. Lines are now available for reconciliation.`
                });
            } else if (unreconcileTarget.lineId) {
                const { error: rpcError } = await supabase.rpc('rpc_unreconcile_journal_lines', {
                    p_company_id: currentCompanyId,
                    p_line_ids: [unreconcileTarget.lineId]
                });

                if (rpcError) {
                    await supabase
                        .from('accounting_journal_lines')
                        .update({
                            is_reconciled: false,
                            reconciled_at: null,
                            reconciled_by: null,
                            reconciliation_ref: null,
                            reconciliation_notes: null
                        })
                        .eq('company_id', currentCompanyId)
                        .eq('id', unreconcileTarget.lineId);
                }
                setActionMessage({
                    type: 'success',
                    text: 'Reopened line. Status set back to unreconciled.'
                });
            }

            setUnreconcileTarget(null);
            await fetchLines();
        } catch (err: any) {
            console.error('Error unreconciling:', err);
            setActionMessage({ type: 'error', text: err.message || 'Failed to reopen journal line.' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleExportCSV = () => {
        if (lines.length === 0) return;
        const currentAccount = accounts.find(a => a.id === selectedAccountId);
        const headers = ['Date', 'Voucher Ref', 'Journal', 'Partner', 'Description', 'Debit', 'Credit', 'Status', 'Reconciliation Ref', 'Reconciled Date', 'Notes'];
        const rows = lines.map(l => [
            l.date,
            `"${(l.voucher_ref || '').replace(/"/g, '""')}"`,
            `"${(l.journal_name || l.journal_code || '').replace(/"/g, '""')}"`,
            `"${(l.partner_name || '').replace(/"/g, '""')}"`,
            `"${(l.description || '').replace(/"/g, '""')}"`,
            l.debit.toFixed(2),
            l.credit.toFixed(2),
            l.is_reconciled ? 'Reconciled' : 'Unreconciled',
            `"${(l.reconciliation_ref || '').replace(/"/g, '""')}"`,
            l.reconciled_at ? l.reconciled_at.slice(0, 10) : '',
            `"${(l.reconciliation_notes || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `JV_Reconciliation_${currentAccount?.code || 'Account'}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const fmt = (n: number) => {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: companyCurrency || 'QAR'
            }).format(n);
        } catch {
            return `${(companyCurrency || 'QAR')} ${n.toFixed(2)}`;
        }
    };

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);

    if (!canManageReconciliation) {
        return (
            <div className="p-8 max-w-3xl mx-auto my-12 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800/40 rounded-3xl p-8 shadow-xl text-center space-y-4">
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">JV &amp; Ledger Reconciliation Authority Restricted</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                    Access to the Journal Voucher &amp; General Ledger Reconciliation module is restricted to authorized financial controllers and managers. 
                    Your current role does not have the <span className="font-mono text-xs bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-bold text-amber-700 dark:text-amber-300">finance.reconciliation.manage</span> authority.
                </p>
                <div className="pt-2 text-xs text-slate-400">
                    To request access, please contact your System Administrator to enable this permission in Organization &gt; Roles &amp; Permissions.
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-5 animate-page-enter max-w-[1700px] mx-auto pb-32">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 flex items-center justify-center shadow-xs">
                        <Scale className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                JV &amp; Ledger Reconciliation
                            </h2>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                                Controller Authority
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Match and settle debit and credit entries for Clearing, Intercompany, Advance, Suspense, and General Ledger accounts.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        type="button"
                        onClick={handleAutoMatch}
                        disabled={statusFilter === 'reconciled' || loadingLines || lines.length === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                        title="Auto-detect and select identical debit/credit amount pairs"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Auto-Match Pairs</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleExportCSV}
                        disabled={lines.length === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                    </button>

                    <button
                        type="button"
                        onClick={fetchLines}
                        disabled={loadingLines}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 transition shadow-2xs cursor-pointer"
                        title="Refresh transactions"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingLines ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {actionMessage && (
                <div className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between shadow-xs ${
                    actionMessage.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                        <span>{actionMessage.text}</span>
                    </div>
                    <button type="button" onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Account Selector & Filters Bar */}
            <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Account Selector */}
                    <div className="md:col-span-5 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <span>Target Ledger Account:</span>
                                {selectedAccount?.is_reconcilable && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold">
                                        Reconcilable
                                    </span>
                                )}
                            </label>
                            <button
                                type="button"
                                onClick={() => setFilterOnlyReconcilable(v => !v)}
                                className={`text-[11px] font-medium transition-colors ${filterOnlyReconcilable ? 'text-violet-600 dark:text-violet-400 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {filterOnlyReconcilable ? '✓ Showing Reconcilable Accounts' : 'Show Only Reconcilable'}
                            </button>
                        </div>
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            disabled={loadingAccounts}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 transition shadow-2xs"
                        >
                            <option value="">— Select an Account to Reconcile —</option>
                            {accounts
                                .filter(a => !filterOnlyReconcilable || a.is_reconcilable)
                                .map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.code} — {a.name} ({a.type})
                                    </option>
                                ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="md:col-span-3 space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reconciliation Status:</label>
                        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('unreconciled')}
                                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    statusFilter === 'unreconciled'
                                        ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                Unreconciled
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('reconciled')}
                                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    statusFilter === 'reconciled'
                                        ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                Reconciled
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('all')}
                                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    statusFilter === 'all'
                                        ? 'bg-white dark:bg-zinc-700 text-violet-600 dark:text-violet-400 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                All Lines
                            </button>
                        </div>
                    </div>

                    {/* Partner Filter */}
                    <div className="md:col-span-4 space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Filter by Partner (Optional):</label>
                        <select
                            value={selectedPartnerId}
                            onChange={e => setSelectedPartnerId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 shadow-2xs"
                        >
                            <option value="">All Partners in Account</option>
                            {availablePartners.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Sub-row: Period Filter & Text Search */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                    <div className="flex-1 max-w-sm relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by voucher ref, partner, or memo..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 placeholder-slate-400"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                                ×
                            </button>
                        )}
                    </div>

                    <PeriodFilter
                        preset={preset}
                        startDate={startDate}
                        endDate={endDate}
                        onPresetChange={(p, s, e) => {
                            setPreset(p);
                            setStartDate(s);
                            setEndDate(e);
                        }}
                        onCustomDateChange={(s, e) => {
                            setStartDate(s);
                            setEndDate(e);
                        }}
                    />
                </div>
            </div>

            {/* Account KPI Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unreconciled Debits</p>
                        <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                            {fmt(stats.unreconciled_debit)}
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                        <ArrowUpRight className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unreconciled Credits</p>
                        <p className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                            {fmt(stats.unreconciled_credit)}
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                        <ArrowDownRight className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Open Variance</p>
                        <p className={`text-lg font-black font-mono mt-1 ${
                            Math.abs(stats.unreconciled_balance) < 0.005 ? 'text-slate-900 dark:text-white' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                            {fmt(stats.unreconciled_balance)}
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                        <Scale className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reconciled Historical</p>
                        <p className="text-lg font-black font-mono text-violet-600 dark:text-violet-400 mt-1">
                            {fmt(stats.reconciled_debit)}
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Transactions Grid */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
                <div className="p-3.5 px-5 bg-slate-50/70 dark:bg-zinc-800/40 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                            {selectedAccount ? `${selectedAccount.code} — ${selectedAccount.name}` : 'Transactions'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 font-bold">
                            {filteredLines.length} {filteredLines.length === 1 ? 'line' : 'lines'}
                        </span>
                    </div>

                    {statusFilter !== 'reconciled' && filteredLines.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAllVisible}
                                className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                            >
                                {selectedLineIds.size === filteredLines.filter(l => !l.is_reconciled).length && selectedLineIds.size > 0
                                    ? 'Deselect All'
                                    : 'Select All Unreconciled'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200 dark:border-zinc-800">
                            <tr>
                                {statusFilter !== 'reconciled' && (
                                    <th className="px-3.5 py-3 w-10 text-center">
                                        <span className="sr-only">Select</span>
                                    </th>
                                )}
                                <th className="px-3.5 py-3 whitespace-nowrap">Date</th>
                                <th className="px-3.5 py-3 whitespace-nowrap">Voucher Ref</th>
                                <th className="px-3.5 py-3 whitespace-nowrap">Journal</th>
                                <th className="px-3.5 py-3">Partner</th>
                                <th className="px-3.5 py-3">Description / Memo</th>
                                <th className="px-3.5 py-3 text-right">Debit</th>
                                <th className="px-3.5 py-3 text-right">Credit</th>
                                <th className="px-3.5 py-3 text-center">Status</th>
                                {statusFilter === 'reconciled' && (
                                    <>
                                        <th className="px-3.5 py-3">Reconciliation Ref</th>
                                        <th className="px-3.5 py-3 text-center">Action</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
                            {loadingLines ? (
                                <tr>
                                    <td colSpan={statusFilter === 'reconciled' ? 10 : 9} className="px-4 py-12 text-center text-slate-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <RefreshCw className="w-4 h-4 animate-spin text-violet-600" />
                                            <span>Loading account transactions...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLines.length === 0 ? (
                                <tr>
                                    <td colSpan={statusFilter === 'reconciled' ? 10 : 9} className="px-4 py-12 text-center text-slate-400">
                                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                            No {statusFilter === 'unreconciled' ? 'unreconciled' : statusFilter === 'reconciled' ? 'reconciled' : ''} entries found
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {statusFilter === 'unreconciled' 
                                                ? 'All journal lines for this account are fully balanced and reconciled! 🎉'
                                                : 'Try adjusting the date range or selecting another account.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLines.map((l) => {
                                    const isSelected = selectedLineIds.has(l.line_id);
                                    const isDebit = l.debit > 0;
                                    const isCredit = l.credit > 0;

                                    return (
                                        <tr
                                            key={l.line_id}
                                            onClick={() => {
                                                if (!l.is_reconciled) toggleLineSelection(l.line_id);
                                            }}
                                            className={`transition-colors cursor-pointer ${
                                                isSelected
                                                    ? 'bg-violet-50/80 dark:bg-violet-950/30'
                                                    : 'hover:bg-slate-50/60 dark:hover:bg-zinc-800/40'
                                            }`}
                                        >
                                            {statusFilter !== 'reconciled' && (
                                                <td className="px-3.5 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                                                    {!l.is_reconciled ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleLineSelection(l.line_id)}
                                                            className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                                                        />
                                                    ) : (
                                                        <Check className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                                                    )}
                                                </td>
                                            )}

                                            <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">
                                                {formatLocalDate(l.date)}
                                            </td>

                                            {/* Click to Navigate & Edit Voucher */}
                                            <td className="px-3.5 py-2.5 font-mono font-bold whitespace-nowrap">
                                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                    {onNavigateToEntry && l.voucher_ref ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const ref = (l.voucher_ref || '').trim();
                                                                const upperRef = ref.toUpperCase();
                                                                const vType = 
                                                                    l.move_type === 'in_invoice' ? 'Purchase' :
                                                                    l.move_type === 'out_invoice' ? 'Sales' :
                                                                    (upperRef.startsWith('PBV') || upperRef.startsWith('PCV') || upperRef.startsWith('PRV') || upperRef.startsWith('BRV') || upperRef.startsWith('CRV')) ? 'Payment' :
                                                                    'Journal';
                                                                onNavigateToEntry({
                                                                    id: l.entry_id,
                                                                    reference: ref,
                                                                    voucherType: vType,
                                                                    move_type: l.move_type
                                                                });
                                                            }}
                                                            className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200 hover:underline cursor-pointer group text-left transition-colors font-bold"
                                                            title={`Click to open ${l.voucher_ref} in edit view`}
                                                        >
                                                            <span>{l.voucher_ref}</span>
                                                            <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-700 dark:text-slate-300">{l.voucher_ref}</span>
                                                    )}
                                                    {l.move_type && (
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                            l.move_type === 'in_invoice' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' :
                                                            l.move_type === 'out_invoice' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' :
                                                            'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400'
                                                        }`}>
                                                            {l.move_type === 'in_invoice' ? 'Bill' : l.move_type === 'out_invoice' ? 'Invoice' : 'JV'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {l.journal_name || l.journal_code || '—'}
                                            </td>

                                            <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 max-w-[170px] truncate" title={l.partner_name}>
                                                {l.partner_name || '—'}
                                            </td>

                                            <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-300 max-w-[240px] truncate" title={l.description}>
                                                {l.description || '—'}
                                            </td>

                                            <td className={`px-3.5 py-2.5 text-right font-mono ${isDebit ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-zinc-600'}`}>
                                                {isDebit ? fmt(l.debit) : '—'}
                                            </td>

                                            <td className={`px-3.5 py-2.5 text-right font-mono ${isCredit ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-slate-300 dark:text-zinc-600'}`}>
                                                {isCredit ? fmt(l.credit) : '—'}
                                            </td>

                                            <td className="px-3.5 py-2.5 text-center">
                                                {l.is_reconciled ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        <span>Reconciled</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                                        <AlertCircle className="w-3 h-3" />
                                                        <span>Open</span>
                                                    </span>
                                                )}
                                            </td>

                                            {statusFilter === 'reconciled' && (
                                                <>
                                                    <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-300">
                                                        <div className="font-mono text-[11px] font-bold text-violet-700 dark:text-violet-300">
                                                            {l.reconciliation_ref || 'Manual'}
                                                        </div>
                                                        {l.reconciled_at && (
                                                            <div className="text-[10px] text-slate-400">
                                                                {formatLocalDate(l.reconciled_at)}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setUnreconcileTarget({ batchRef: l.reconciliation_ref, lineId: l.line_id })}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                                                            title="Reopen entry back to unreconciled status"
                                                        >
                                                            <RotateCcw className="w-3 h-3" />
                                                            <span>Reopen</span>
                                                        </button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sticky Floating Matching & Reconciliation Dock */}
            {selectedLineIds.size > 0 && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-4xl bg-slate-900/95 dark:bg-zinc-950/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 dark:border-zinc-700 flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up">
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse" />
                            <span className="font-bold text-slate-300">Selected Lines:</span>
                            <span className="font-black font-mono bg-slate-800 px-2 py-0.5 rounded text-white">
                                {selectedMetrics.count} ({selectedMetrics.debitCount} Dr / {selectedMetrics.creditCount} Cr)
                            </span>
                        </div>

                        <div className="h-4 w-px bg-slate-700 hidden sm:block" />

                        <div className="flex items-center gap-3 font-mono">
                            <div>
                                <span className="text-[10px] text-emerald-400 block font-bold">Total Debit</span>
                                <span className="font-black text-emerald-300">{fmt(selectedMetrics.totalDebit)}</span>
                            </div>
                            <span className="text-slate-500 font-bold">=</span>
                            <div>
                                <span className="text-[10px] text-rose-400 block font-bold">Total Credit</span>
                                <span className="font-black text-rose-300">{fmt(selectedMetrics.totalCredit)}</span>
                            </div>
                        </div>

                        <div className="h-4 w-px bg-slate-700 hidden sm:block" />

                        {/* Balance Status Pill */}
                        <div>
                            {selectedMetrics.isBalanced ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Exact Match (Balanced)</span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Diff: {fmt(selectedMetrics.difference)}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => setSelectedLineIds(new Set())}
                            className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenReconcileModal}
                            disabled={!selectedMetrics.isBalanced && !canManageReconciliation}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black rounded-xl transition shadow-lg cursor-pointer ${
                                selectedMetrics.isBalanced
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
                            }`}
                        >
                            <ShieldCheck className="w-4 h-4" />
                            <span>Reconcile Selected Entries</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Reconcile Confirmation Modal */}
            {isReconcileModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-scale-up">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white">Confirm Reconciliation</h3>
                                    <p className="text-xs text-slate-400">Lock and settle selected journal voucher lines</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsReconcileModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/60 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Selected Lines:</span>
                                <span className="font-bold text-slate-900 dark:text-white">{selectedMetrics.count} lines</span>
                            </div>
                            <div className="flex justify-between font-mono">
                                <span className="text-slate-500">Total Debit (Dr):</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(selectedMetrics.totalDebit)}</span>
                            </div>
                            <div className="flex justify-between font-mono">
                                <span className="text-slate-500">Total Credit (Cr):</span>
                                <span className="font-bold text-rose-600 dark:text-rose-400">{fmt(selectedMetrics.totalCredit)}</span>
                            </div>
                            <div className="flex justify-between font-mono pt-2 border-t border-slate-200 dark:border-zinc-700">
                                <span className="font-bold text-slate-700 dark:text-slate-300">Balance Difference:</span>
                                <span className={`font-black ${selectedMetrics.isBalanced ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {fmt(selectedMetrics.difference)}
                                </span>
                            </div>
                        </div>

                        {!selectedMetrics.isBalanced && (
                            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                                <div className="flex items-center gap-1.5 font-bold">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    <span>Entries are not perfectly balanced!</span>
                                </div>
                                <p className="text-[11px] leading-relaxed">
                                    A difference of {fmt(selectedMetrics.difference)} exists between selected debits and credits. Reconciling with an active variance requires explicit authorization.
                                </p>
                                <label className="flex items-center gap-2 cursor-pointer pt-1 font-bold">
                                    <input
                                        type="checkbox"
                                        checked={allowUnbalanced}
                                        onChange={e => setAllowUnbalanced(e.target.checked)}
                                        className="w-4 h-4 rounded text-amber-600"
                                    />
                                    <span>I authorize reconciling with variance (Note required below)</span>
                                </label>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Reconciliation Reference / Batch Code:
                                </label>
                                <input
                                    type="text"
                                    value={reconcileRef}
                                    onChange={e => setReconcileRef(e.target.value)}
                                    placeholder="e.g. REC-202609-0001"
                                    className="w-full px-3.5 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Audit Memo / Reconciliation Notes (Optional):
                                </label>
                                <textarea
                                    value={reconcileNotes}
                                    onChange={e => setReconcileNotes(e.target.value)}
                                    rows={2}
                                    placeholder="e.g. Settled opening balance adjustments against September vendor invoices."
                                    className="w-full px-3.5 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-white resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setIsReconcileModalOpen(false)}
                                disabled={processingAction}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmReconcile}
                                disabled={processingAction || (!selectedMetrics.isBalanced && !allowUnbalanced)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-md disabled:opacity-50 cursor-pointer"
                            >
                                {processingAction ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Reconciling...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Confirm &amp; Post Reconciliation</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unreconcile Confirmation Dialog */}
            {unreconcileTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                                <RotateCcw className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white">Reopen Reconciled Entry?</h3>
                                <p className="text-xs text-slate-400">Restore line to open unreconciled status</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {unreconcileTarget.batchRef ? (
                                <>
                                    Are you sure you want to unreconcile batch <strong className="font-mono text-violet-600">{unreconcileTarget.batchRef}</strong>? 
                                    All matched lines in this batch will be reopened for reconciliation.
                                </>
                            ) : (
                                <>Are you sure you want to reopen this entry? It will become open for future reconciliation matching.</>
                            )}
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setUnreconcileTarget(null)}
                                disabled={processingAction}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            >
                                Keep Reconciled
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmUnreconcile}
                                disabled={processingAction}
                                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md cursor-pointer"
                            >
                                {processingAction ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Reopening...</span>
                                    </>
                                ) : (
                                    <span>Yes, Reopen</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
