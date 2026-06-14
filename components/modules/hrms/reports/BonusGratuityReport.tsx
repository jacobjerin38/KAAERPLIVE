import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { Award, TrendingUp, Download, Loader2, User, Clock, Shield } from 'lucide-react';

export const BonusGratuityReport: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<any[]>([]);
    const [totals, setTotals] = useState({ totalLiability: 0, totalEmployees: 0 });

    useEffect(() => {
        if (currentCompanyId) fetchReportData();
    }, [currentCompanyId]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Employees with joining dates and salary
            const { data: employees, error } = await supabase
                .from('employees')
                .select('id, name, employee_code, join_date, salary_amount, department:departments(name)')
                .eq('company_id', currentCompanyId)
                .eq('status', 'Active');

            if (error) throw error;

            if (employees) {
                const processed = employees.map(emp => {
                    const joinDate = new Date(emp.join_date);
                    const today = new Date();
                    const diffTime = Math.abs(today.getTime() - joinDate.getTime());
                    const tenureYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
                    const tenureMonths = (tenureYears * 12).toFixed(1);
                    
                    // Gratuity logic (Standard: 21 days per year for <5 years, 30 days for >5 years)
                    // For simplified MVP report: (Salary / 30) * 21 * tenureYears
                    const dailyRate = (emp.salary_amount || 0) / 30;
                    const daysPerYear = tenureYears >= 5 ? 30 : 21;
                    const gratuityLiability = tenureYears >= 1 ? (dailyRate * daysPerYear * tenureYears) : 0;

                    return {
                        ...emp,
                        tenureYears: tenureYears.toFixed(2),
                        tenureMonths,
                        gratuityLiability: Math.round(gratuityLiability),
                        bonusLiability: Math.round((emp.salary_amount || 0) * 0.0833) // Standard 1 month bonus accrual (8.33%)
                    };
                });

                setReportData(processed);
                
                const totalLiab = processed.reduce((acc, curr) => acc + curr.gratuityLiability, 0);
                setTotals({
                    totalLiability: totalLiab,
                    totalEmployees: processed.length
                });
            }

        } catch (err) {
            console.error('Error fetching gratuity report:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR' }).format(amount);
    };

    return (
        <div className="space-y-8 animate-page-enter">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Award className="w-8 h-8 text-amber-500" />
                        Bonus & Gratuity Valuation
                    </h2>
                    <p className="text-slate-500 text-sm">Long-term liability projections and accruals tracking</p>
                </div>
                
                <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all">
                    <Download className="w-4 h-4" /> Export Valuation
                </button>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 rounded-[2rem] text-white shadow-xl shadow-amber-500/20 relative overflow-hidden">
                    <TrendingUp className="absolute top-4 right-4 w-12 h-12 text-white/20" />
                    <p className="text-sm font-bold uppercase tracking-wider opacity-80 mb-2">Total Accrued Gratuity</p>
                    <h3 className="text-4xl font-black">{formatCurrency(totals.totalLiability)}</h3>
                    <p className="text-xs mt-4 font-medium opacity-90 italic">* Estimated liability for {totals.totalEmployees} employees</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4 text-indigo-600">
                        <Clock className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Average Tenure</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">
                        {(reportData.reduce((acc, curr) => acc + parseFloat(curr.tenureYears), 0) / (totals.totalEmployees || 1)).toFixed(1)} Years
                    </h3>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4 text-emerald-600">
                        <Shield className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Compliance Ratio</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">100%</h3>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800">
                    <h3 className="font-bold text-slate-800 dark:text-white">Employee Valuation Table</h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-zinc-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4">Joining Date</th>
                                <th className="px-6 py-4">Tenure (Yrs)</th>
                                <th className="px-6 py-4 text-right">Basic Salary</th>
                                <th className="px-6 py-4 text-right text-indigo-600">Monthly Accrual</th>
                                <th className="px-6 py-4 text-right text-amber-600 font-bold">Gratuity Payable</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : reportData.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-slate-500">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700 dark:text-slate-200">{emp.name}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold">{emp.department?.name || 'Unassigned'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {new Date(emp.join_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
                                            {emp.tenureYears} Yrs
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-sm">
                                        {formatCurrency(emp.salary_amount || 0)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-sm text-indigo-500">
                                        {formatCurrency(emp.bonusLiability)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-amber-600 text-base">
                                        {formatCurrency(emp.gratuityLiability)}
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
