import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { DollarSign, Calendar, Download, Search, Loader2, FileText, ChevronRight } from 'lucide-react';

export const SalaryStatementReport: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [statements, setStatements] = useState<any[]>([]);
    const [summary, setSummary] = useState({ totalGross: 0, totalDeduction: 0, totalNet: 0, employeeCount: 0 });

    useEffect(() => {
        if (currentCompanyId) fetchReportData();
    }, [currentCompanyId, selectedMonth]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            // 1. Fetch completed payroll runs for the selected month
            const { data: runs } = await supabase
                .from('payroll_runs')
                .select('id, period_start, status')
                .eq('company_id', currentCompanyId)
                .eq('period_start', `${selectedMonth}-01`);

            if (!runs || runs.length === 0) {
                setStatements([]);
                setSummary({ totalGross: 0, totalDeduction: 0, totalNet: 0, employeeCount: 0 });
                return;
            }

            const dateObj = new Date(`${selectedMonth}-01`);
            const monthStr = dateObj.toLocaleString('en-US', { month: 'short' });
            const yearStr = dateObj.getFullYear();
            const formattedMonthYear = `${monthStr} ${yearStr}`;

            // 2. Fetch records for these runs
            const { data: records, error } = await supabase
                .from('payroll_records')
                .select(`
                    id, gross_earning, total_deduction, net_pay, ot_amount, loan_deduction,
                    employee:employees(name, employee_code, department:departments(name), bank_name, account_number)
                `)
                .eq('month_year', formattedMonthYear)
                .eq('company_id', currentCompanyId);

            if (error) throw error;

            if (records) {
                setStatements(records);
                
                // Calculate Summary
                const totalGross = records.reduce((acc, curr) => acc + (curr.gross_earning || 0), 0);
                const totalDeduction = records.reduce((acc, curr) => acc + (curr.total_deduction || 0), 0);
                const totalNet = records.reduce((acc, curr) => acc + (curr.net_pay || 0), 0);
                
                setSummary({
                    totalGross,
                    totalDeduction,
                    totalNet,
                    employeeCount: records.length
                });
            }

        } catch (err) {
            console.error('Error fetching salary statement:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR' }).format(amount);
    };

    return (
        <div className="space-y-8 animate-page-enter">
            {/* Filter Header */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Monthly Salary Statement</h2>
                    <p className="text-slate-500 text-sm">Consolidated report of all earnings and deductions</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="month" 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none w-full"
                        />
                    </div>
                    <button className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2 px-6">
                        <Download className="w-4 h-4" />
                        <span className="text-sm font-bold">Export Excel</span>
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Gross Payout', value: summary.totalGross, color: 'indigo', icon: DollarSign },
                    { label: 'Total Deductions', value: summary.totalDeduction, color: 'rose', icon: FileText },
                    { label: 'Net Payable', value: summary.totalNet, color: 'emerald', icon: DollarSign },
                    { label: 'Employees Paid', value: summary.employeeCount, color: 'amber', icon: Search },
                ].map((s, idx) => (
                    <div key={idx} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 bg-${s.color}-100 dark:bg-${s.color}-900/20 rounded-lg text-${s.color}-600`}>
                                <s.icon className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                            {idx === 3 ? s.value : formatCurrency(s.value)}
                        </h3>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white">Detailed Breakdown</h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input placeholder="Search employee..." className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none w-64" />
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-zinc-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4">Department</th>
                                <th className="px-6 py-4 text-right">Gross Pay</th>
                                <th className="px-6 py-4 text-right">OT Pay</th>
                                <th className="px-6 py-4 text-right">Deductions</th>
                                <th className="px-6 py-4 text-right">Loans</th>
                                <th className="px-6 py-4 text-right">Net Salary</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center">
                                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
                                        <p className="text-slate-400 text-sm font-medium">Loading statement...</p>
                                    </td>
                                </tr>
                            ) : statements.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center text-slate-400">
                                        No finalized payroll found for this month.
                                    </td>
                                </tr>
                            ) : statements.map(rec => (
                                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-700 dark:text-slate-200">{rec.employee?.name}</p>
                                        <p className="text-xs text-slate-400">{rec.employee?.employee_code}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                        {rec.employee?.department?.name || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-sm text-slate-600 dark:text-slate-400">
                                        {formatCurrency(rec.gross_earning)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-sm text-indigo-500">
                                        +{formatCurrency(rec.ot_amount || 0)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-sm text-rose-500">
                                        -{formatCurrency(rec.total_deduction)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-sm text-rose-500">
                                        -{formatCurrency(rec.loan_deduction || 0)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">
                                        {formatCurrency(rec.net_pay)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
