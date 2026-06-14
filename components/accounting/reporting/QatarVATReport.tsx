import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
    Calendar, 
    Download, 
    FileText, 
    TrendingUp, 
    TrendingDown, 
    AlertCircle, 
    Database, 
    CheckCircle2, 
    ArrowUpRight, 
    ArrowDownLeft, 
    RefreshCw, 
    ShieldCheck, 
    Printer 
} from 'lucide-react';

interface QatarVATReportProps {
    currentCompanyId: string | null;
    startDate: string;
    endDate: string;
    formatCurrency: (amount: number) => string;
}

export const QatarVATReport: React.FC<QatarVATReportProps> = ({
    currentCompanyId,
    startDate,
    endDate,
    formatCurrency
}) => {
    const [loading, setLoading] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [isLedgerEmpty, setIsLedgerEmpty] = useState(false);
    const [seedMessage, setSeedMessage] = useState<{ success: boolean; text: string } | null>(null);

    useEffect(() => {
        if (currentCompanyId) {
            checkLedgerStatus();
            fetchReport();
        }
    }, [currentCompanyId, startDate, endDate]);

    const checkLedgerStatus = async () => {
        if (!currentCompanyId) return;
        try {
            // Count total moves for the current company
            const { count, error } = await supabase
                .from('accounting_moves')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', currentCompanyId);
                
            if (error) throw error;
            setIsLedgerEmpty(count === 0);
        } catch (err) {
            console.error('Error checking ledger status:', err);
        }
    };

    const fetchReport = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            const { data, error } = await (supabase.rpc as any)('rpc_get_qatar_vat_report', {
                p_start_date: startDate,
                p_end_date: endDate
            });

            if (error) throw error;
            setReportData(data);
        } catch (err: any) {
            console.error('Error fetching Qatar VAT report:', err);
            setReportData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSeedDemoData = async () => {
        if (!currentCompanyId) return;
        setSeeding(true);
        setSeedMessage(null);
        try {
            const { data, error } = await (supabase.rpc as any)('rpc_seed_vat_demo_data', {
                p_target_company_id: currentCompanyId
            });

            if (error) throw error;

            const res = data as any;
            if (res?.success) {
                setSeedMessage({ success: true, text: res.message });
                setIsLedgerEmpty(false);
                fetchReport();
            } else {
                setSeedMessage({ success: false, text: res?.message || 'Failed to seed demo data.' });
            }
        } catch (err: any) {
            console.error('Error seeding demo data:', err);
            setSeedMessage({ success: false, text: err.message || 'An error occurred while seeding demo data.' });
        } finally {
            setSeeding(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center py-20 text-slate-400 animate-pulse">
                <RefreshCw className="w-12 h-12 mb-4 animate-spin text-indigo-500 opacity-80" />
                <p className="font-bold tracking-widest uppercase text-xs text-indigo-500/80">Compiling Qatar VAT Data...</p>
                <p className="text-[10px] text-slate-400 mt-1">Aggregating Sales & Purchases Tax Ledgers</p>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="flex flex-col justify-center items-center py-20 text-slate-400">
                <FileText className="w-16 h-16 mb-4 opacity-10" />
                <p className="font-medium">No tax data found or failed to compile report.</p>
            </div>
        );
    }

    const { output_tax, input_tax, net_tax_payable } = reportData;
    const isRefund = net_tax_payable < 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Seed Demo Data Alert Banner */}
            {isLedgerEmpty && (
                <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900/90 to-indigo-950/90 backdrop-blur-md rounded-3xl border border-indigo-700/30 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_20px_50px_rgba(99,102,241,0.15)]">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -z-10 transform translate-x-1/3 -translate-y-1/3"></div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest bg-indigo-900/60 px-2 py-0.5 rounded-full border border-indigo-500/20">Empty Ledger Detected</span>
                        </div>
                        <h4 className="text-lg font-bold text-white">Experience High-Fidelity Tax Filing in One Click</h4>
                        <p className="text-xs text-indigo-200 max-w-xl leading-relaxed">
                            Your transaction ledger is currently empty. Seed realistic standard-rated (5%), zero-rated (0%), and exempt sales & purchase entries safely. Perfect for immediate dashboard visual validation.
                        </p>
                    </div>
                    <button
                        onClick={handleSeedDemoData}
                        disabled={seeding}
                        className="self-start md:self-auto bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        {seeding ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Seeding Transactions...
                            </>
                        ) : (
                            <>
                                <Database className="w-4 h-4" />
                                Populate Qatar Demo Data
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Seed Message Feedback */}
            {seedMessage && (
                <div className={`p-4 rounded-2xl flex items-start gap-3 border ${
                    seedMessage.success 
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' 
                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-500/30 text-rose-800 dark:text-rose-300'
                }`}>
                    {seedMessage.success ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />}
                    <div className="text-xs">
                        <span className="font-bold">{seedMessage.success ? 'Success!' : 'Notice:'}</span> {seedMessage.text}
                    </div>
                </div>
            )}

            {/* Premium Interactive KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Output VAT Box */}
                <div className="relative overflow-hidden bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.015)] rounded-3xl p-6 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.03)] group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <ArrowUpRight className="w-24 h-24 text-indigo-500" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Output VAT (Sales)</p>
                    <p className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mt-2">{formatCurrency(output_tax.total_vat)}</p>
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] font-semibold text-slate-500">
                        <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md font-mono">{formatCurrency(output_tax.total_base)} Base</span>
                        <span>•</span>
                        <span className="text-emerald-500">Sales Tax collected</span>
                    </div>
                </div>

                {/* Input VAT Box */}
                <div className="relative overflow-hidden bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.015)] rounded-3xl p-6 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.03)] group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <ArrowDownLeft className="w-24 h-24 text-indigo-500" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Input VAT (Purchases)</p>
                    <p className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mt-2">{formatCurrency(input_tax.total_vat)}</p>
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] font-semibold text-slate-500">
                        <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md font-mono">{formatCurrency(input_tax.total_base)} Base</span>
                        <span>•</span>
                        <span className="text-blue-500">Recoverable Tax</span>
                    </div>
                </div>

                {/* Net VAT Position */}
                <div className={`relative overflow-hidden border shadow-[0_8px_35px_rgba(0,0,0,0.02)] rounded-3xl p-6 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)] bg-gradient-to-br ${
                    isRefund 
                        ? 'from-emerald-50/50 to-teal-50/20 dark:from-emerald-950/10 dark:to-teal-950/5 border-emerald-200 dark:border-emerald-900/30' 
                        : 'from-amber-50/50 to-orange-50/20 dark:from-amber-950/10 dark:to-orange-950/5 border-amber-200 dark:border-amber-900/30'
                }`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Net VAT Return Position</p>
                    <p className={`text-3xl font-black tracking-tight mt-2 ${isRefund ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {formatCurrency(Math.abs(net_tax_payable))}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isRefund 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}>
                            {isRefund ? 'Tax Refund' : 'Tax Payable'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">Net GTA balance</span>
                    </div>
                </div>
            </div>

            {/* The Qatar VAT Filing Return Sheet */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 dark:bg-zinc-800/40 p-5 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-indigo-500" />
                            Qatar General Authority of Tax (GTA) Form
                        </h3>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Standard format aligned with Dhareeba Tax Portal regulations</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-white hover:bg-slate-100 border border-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700 p-2 rounded-xl text-slate-500 dark:text-slate-400 transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print Return</span>
                        </button>
                    </div>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                    {/* Section 1: Output Tax (Sales & Supplies) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-zinc-800">
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wide">1. Tax on Supplies & Sales (Output Tax)</h4>
                            <span className="text-xs bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded">Sales</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-400 uppercase tracking-widest text-[9px] border-b border-slate-100 dark:border-zinc-800">
                                        <th className="py-3 px-2 font-bold min-w-[250px]">Filing Box / Category</th>
                                        <th className="py-3 px-2 text-right font-bold">Standard VAT Rate</th>
                                        <th className="py-3 px-2 text-right font-bold">Taxable Base Amount</th>
                                        <th className="py-3 px-2 text-right font-bold">Output VAT Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50 font-medium">
                                    <tr className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className="py-4 px-2">
                                            <p className="font-bold text-slate-700 dark:text-slate-200">Box 1: Standard Rated Supplies</p>
                                            <p className="text-[10px] text-slate-400">Domestic sales subject to standard 5% VAT rate</p>
                                        </td>
                                        <td className="py-4 px-2 text-right font-mono font-bold text-slate-400">5.0%</td>
                                        <td className="py-4 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{formatCurrency(output_tax.standard_rated_base)}</td>
                                        <td className="py-4 px-2 text-right font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(output_tax.standard_rated_vat)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className="py-4 px-2">
                                            <p className="font-bold text-slate-700 dark:text-slate-200">Box 2: Zero-Rated Supplies & Exports</p>
                                            <p className="text-[10px] text-slate-400">Qualifying international exports, medications, etc. (0%)</p>
                                        </td>
                                        <td className="py-4 px-2 text-right font-mono font-bold text-slate-400">0.0%</td>
                                        <td className="py-4 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{formatCurrency(output_tax.zero_rated_base)}</td>
                                        <td className="py-4 px-2 text-right font-mono text-slate-400">—</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className="py-4 px-2">
                                            <p className="font-bold text-slate-700 dark:text-slate-200">Box 3: Exempt Supplies</p>
                                            <p className="text-[10px] text-slate-400">Domestic transactions exempt from Qatar VAT (e.g. residential rentals)</p>
                                        </td>
                                        <td className="py-4 px-2 text-right font-mono font-bold text-slate-400">Exempt</td>
                                        <td className="py-4 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{formatCurrency(output_tax.exempt_base)}</td>
                                        <td className="py-4 px-2 text-right font-mono text-slate-400">—</td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50/50 dark:bg-zinc-800/10 font-bold border-t border-slate-200 dark:border-zinc-800">
                                        <td className="py-3 px-2 text-slate-800 dark:text-slate-200 uppercase tracking-wide">Total Sales & Outputs</td>
                                        <td className="py-3 px-2"></td>
                                        <td className="py-3 px-2 text-right font-mono text-slate-800 dark:text-slate-300">{formatCurrency(output_tax.total_base)}</td>
                                        <td className="py-3 px-2 text-right font-mono text-indigo-600 dark:text-indigo-400 text-sm font-black">{formatCurrency(output_tax.total_vat)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Section 2: Input Tax (Purchases & Expenses) */}
                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-zinc-800">
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wide">2. Tax on Expenses & Purchases (Input Tax)</h4>
                            <span className="text-xs bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded">Purchases</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-400 uppercase tracking-widest text-[9px] border-b border-slate-100 dark:border-zinc-800">
                                        <th className="py-3 px-2 font-bold min-w-[250px]">Filing Box / Category</th>
                                        <th className="py-3 px-2 text-right font-bold">Standard VAT Rate</th>
                                        <th className="py-3 px-2 text-right font-bold">Taxable Base Amount</th>
                                        <th className="py-3 px-2 text-right font-bold">Recoverable Input VAT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50 font-medium">
                                    <tr className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className="py-4 px-2">
                                            <p className="font-bold text-slate-700 dark:text-slate-200">Box 4: Standard Rated Purchases</p>
                                            <p className="text-[10px] text-slate-400">Domestic purchases subject to standard 5% VAT rate</p>
                                        </td>
                                        <td className="py-4 px-2 text-right font-mono font-bold text-slate-400">5.0%</td>
                                        <td className="py-4 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{formatCurrency(input_tax.standard_rated_base)}</td>
                                        <td className="py-4 px-2 text-right font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(input_tax.standard_rated_vat)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className="py-4 px-2">
                                            <p className="font-bold text-slate-700 dark:text-slate-200">Box 5: Zero-Rated Purchases & Imports</p>
                                            <p className="text-[10px] text-slate-400">Qualifying zero-rated imports and supplies (0%)</p>
                                        </td>
                                        <td className="py-4 px-2 text-right font-mono font-bold text-slate-400">0.0%</td>
                                        <td className="py-4 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{formatCurrency(input_tax.zero_rated_base)}</td>
                                        <td className="py-4 px-2 text-right font-mono text-slate-400">—</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className="py-4 px-2">
                                            <p className="font-bold text-slate-700 dark:text-slate-200">Box 6: Exempt Purchases</p>
                                            <p className="text-[10px] text-slate-400">Purchases exempt from VAT (e.g. government services, banking fees)</p>
                                        </td>
                                        <td className="py-4 px-2 text-right font-mono font-bold text-slate-400">Exempt</td>
                                        <td className="py-4 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{formatCurrency(input_tax.exempt_base)}</td>
                                        <td className="py-4 px-2 text-right font-mono text-slate-400">—</td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50/50 dark:bg-zinc-800/10 font-bold border-t border-slate-200 dark:border-zinc-800">
                                        <td className="py-3 px-2 text-slate-800 dark:text-slate-200 uppercase tracking-wide">Total Purchases & Inputs</td>
                                        <td className="py-3 px-2"></td>
                                        <td className="py-3 px-2 text-right font-mono text-slate-800 dark:text-slate-300">{formatCurrency(input_tax.total_base)}</td>
                                        <td className="py-3 px-2 text-right font-mono text-indigo-600 dark:text-indigo-400 text-sm font-black">{formatCurrency(input_tax.total_vat)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Box-wise Helper Guide for Dhareeba submission */}
            <div className="bg-slate-900 dark:bg-black rounded-3xl border border-slate-800 p-6 md:p-8 space-y-6 text-white shadow-xl shadow-slate-950/20">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Submission Assistant</p>
                    <h4 className="text-md font-extrabold text-white">Dhareeba Tax Portal copy-paste helper</h4>
                    <p className="text-xs text-slate-400">Match values below directly with equivalent fields on your digital tax portal form.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-850 dark:bg-zinc-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md uppercase tracking-wider">Box 1-A (Sales Base)</span>
                            <p className="text-xs font-bold text-white mt-1">Standard Taxable Revenue</p>
                        </div>
                        <span className="font-mono text-sm font-black text-indigo-400">{formatCurrency(output_tax.standard_rated_base)}</span>
                    </div>

                    <div className="bg-slate-850 dark:bg-zinc-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md uppercase tracking-wider">Box 1-B (Sales VAT)</span>
                            <p className="text-xs font-bold text-white mt-1">Standard Sales Output Tax</p>
                        </div>
                        <span className="font-mono text-sm font-black text-indigo-400">{formatCurrency(output_tax.standard_rated_vat)}</span>
                    </div>

                    <div className="bg-slate-850 dark:bg-zinc-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md uppercase tracking-wider">Box 4-A (Purchase Base)</span>
                            <p className="text-xs font-bold text-white mt-1">Standard Recoverable Purchases</p>
                        </div>
                        <span className="font-mono text-sm font-black text-indigo-400">{formatCurrency(input_tax.standard_rated_base)}</span>
                    </div>

                    <div className="bg-slate-850 dark:bg-zinc-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md uppercase tracking-wider">Box 4-B (Purchase VAT)</span>
                            <p className="text-xs font-bold text-white mt-1">Standard Recoverable Input Tax</p>
                        </div>
                        <span className="font-mono text-sm font-black text-indigo-400">{formatCurrency(input_tax.standard_rated_vat)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
