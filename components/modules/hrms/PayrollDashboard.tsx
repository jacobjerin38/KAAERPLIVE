import React, { useState, useEffect } from 'react';
import { DollarSign, Play, Calendar, FileText, ChevronRight, Eye, CheckCircle, Lock, AlertCircle, Edit3, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

import { PayrollRun, PayrollRecord } from '../../hrms/types';

import { KAA_LOGO_URL } from '../../../constants';

export const PayrollDashboard: React.FC = () => {
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedRun, setSelectedRun] = useState<any | null>(null);
    const [runDetails, setRunDetails] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Payslip Modal State
    const [showPayslip, setShowPayslip] = useState(false);
    const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);
    const [companyLogo, setCompanyLogo] = useState(KAA_LOGO_URL);
    const [companyCurrency, setCompanyCurrency] = useState('USD');

    // Edit Pay Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null);
    const [editForm, setEditForm] = useState({ gross_earning: 0, total_deduction: 0 });

    useEffect(() => {
        fetchCompanyLogo();
    }, []);

    const fetchCompanyLogo = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle();
                if (profile?.company_id) {
                    const { data } = await supabase.from('companies').select('logo_url, currency').eq('id', profile.company_id).maybeSingle();
                    if (data?.logo_url) setCompanyLogo(data.logo_url);
                    if (data?.currency) setCompanyCurrency(data.currency);
                }
            }
        } catch (e) {
            console.error('Error fetching logo:', e);
        }
    };

    useEffect(() => {
        fetchRuns();
    }, []);

    const fetchRuns = async () => {
        const { data } = await (supabase as any).from('payroll_runs').select('*').order('month_year', { ascending: false });
        if (data) setRuns(data);
    };

    const handleGeneratePayroll = async () => {
        if (!confirm(`Generate payroll for ${selectedMonth}? Existing draft data will be overwritten.`)) return;

        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle();

            const { data, error } = await supabase.rpc('rpc_generate_payroll', {
                p_company_id: profile.company_id,
                p_month_year: selectedMonth
            });

            if (error) throw error;

            alert('Payroll generated successfully!');
            fetchRuns();

            // Auto-select the new run
            if (data) {
                const { data: newRun } = await (supabase as any).from('payroll_runs').select('*').eq('id', data).single();
                if (newRun) handleViewDetails(newRun);
            }

        } catch (error: any) {
            alert('Error generating payroll: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (run: any) => {
        setSelectedRun(run);
        setLoadingDetails(true);
        // @ts-ignore
        const { data, error } = await (supabase as any)
            .from('payroll_records')
            .select(`
                *,
                employee:employees(name, department_id, passport_number, visa_number, account_number, bank_name)
            `)
            .eq('payroll_run_id', run.id);

        if (data) {
            setRunDetails(data as any);
        }
        setLoadingDetails(false);
    };

    const handleFinalizeBatch = async () => {
        if (!selectedRun) return;
        if (!confirm('Are you sure you want to finalize this payroll batch? This action cannot be undone.')) return;

        const { error } = await supabase
            .from('payroll_runs')
            .update({ status: 'COMPLETED' })
            .eq('id', selectedRun.id);

        if (error) {
            alert('Error finalizing batch: ' + error.message);
        } else {
            alert('Batch finalized successfully!');
            fetchRuns();
            setSelectedRun({ ...selectedRun, status: 'COMPLETED' });
        }
    };

    const handleSaveEdit = async () => {
        if (!editRecord) return;
        const net_pay = Number(editForm.gross_earning) - Number(editForm.total_deduction);
        
        const { error } = await supabase
            .from('payroll_records')
            .update({
                gross_earning: Number(editForm.gross_earning),
                total_deduction: Number(editForm.total_deduction),
                net_pay: net_pay
            })
            .eq('id', editRecord.id);

        if (error) {
            alert('Error updating record: ' + error.message);
        } else {
            setShowEditModal(false);
            handleViewDetails(selectedRun);
        }
    };

    const formatCurrency = (amount: number) => {
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: companyCurrency }).format(amount);
        } catch {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
        }
    };

    const handleExportWPS = () => {
        if (!selectedRun || !runDetails || runDetails.length === 0) return;
        
        // Mock Qatar WPS CSV Format
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "EmployerEID,RecordType,EmployeeQID,VisaID,EmployeeName,BankName,BankAccount,SalaryFrequency,NoOfWorkingDays,NetSalary,BasicSalary,ExtraHours,ExtraIncome,Deductions,PaymentType,Comments\r\n";
        
        runDetails.forEach(rec => {
            const emp = rec.employee || {};
            const qid = (emp as any).passport_number || 'N/A';
            const visa = (emp as any).visa_number || 'N/A';
            const name = emp.name || 'Unknown';
            const bankName = (emp as any).bank_name || '';
            const account = (emp as any).account_number || '';
            
            const days = rec.payable_days || 30;
            const net = rec.net_pay || 0;
            const basic = rec.base_salary || 0;
            const extra = Math.max(0, rec.gross_earning - rec.base_salary);
            const ded = rec.total_deduction || 0;
            
            const row = `1234567890,SAL,${qid},${visa},${name},${bankName},${account},M,${days},${net},${basic},0,${extra},${ded},Transfer,Monthly Salary`;
            csvContent += row + "\r\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `WPS_Qatar_${selectedRun.month_year.replace('-', '')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportReport = (type: string) => {
        if (type === 'WPS') handleExportWPS();
        else alert(`Generating ${type} report... (Feature in development)`);
    };

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <header className="flex justify-between items-center mb-8 shrink-0">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Payroll Processing</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Manage monthly salary batches</p>
                </div>

                <div className="flex gap-3 items-center">
                    <div className="relative">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    </div>

                    <button
                        onClick={handleGeneratePayroll}
                        disabled={loading}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        {loading ? 'Processing...' : 'Run Payroll'}
                    </button>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
                {/* Runs List */}
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-zinc-800">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Batch History</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {runs.map(run => (
                            <div
                                key={run.id}
                                onClick={() => handleViewDetails(run)}
                                className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedRun?.id === run.id
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm ring-1 ring-indigo-500/20'
                                    : 'bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-slate-700 dark:text-slate-200">{run.month_year}</h4>
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${run.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                                        run.status === 'COMPLETED' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                                        }`}>{run.status}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Total Payout</p>
                                        <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(run.total_net_pay || 0)}</p>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform ${selectedRun?.id === run.id ? 'translate-x-1 text-indigo-500' : ''}`} />
                                </div>
                            </div>
                        ))}
                        {runs.length === 0 && (
                            <div className="text-center py-10 text-slate-400 text-sm">No payroll runs found.</div>
                        )}
                    </div>
                </div>

                {/* Run Details */}
                <div className="lg:col-span-2 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex flex-col">
                    {selectedRun ? (
                        <>
                            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        {selectedRun.month_year} <span className="text-slate-400 font-normal text-sm">Details</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Generated on {new Date(selectedRun.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="flex gap-2">
                                    <select 
                                        onChange={(e) => { if(e.target.value) handleExportReport(e.target.value); e.target.value='' }}
                                        className="px-4 py-2 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:border-indigo-300 transition-colors outline-none cursor-pointer"
                                    >
                                        <option value="">Export Report...</option>
                                        <option value="WPS">WPS Export (Qatar)</option>
                                        <option value="Bank Statement">Bank Statement</option>
                                        <option value="Cash Statement">Cash Statement</option>
                                        <option value="Salary Slip">Monthly Salary Report</option>
                                        <option value="Gratuity">Bonus & Gratuity Report</option>
                                    </select>
                                    {selectedRun.status === 'DRAFT' && (
                                        <button onClick={handleFinalizeBatch} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors flex items-center gap-2">
                                            <Lock className="w-3 h-3" /> Finalize Batch
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-zinc-800 sticky top-0 z-10 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Employee</th>
                                            <th className="px-6 py-4 text-center">Paid Days</th>
                                            <th className="px-6 py-4 text-right">Gross</th>
                                            <th className="px-6 py-4 text-right">Deductions</th>
                                            <th className="px-6 py-4 text-right">Net Pay</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {loadingDetails ? (
                                            <tr><td colSpan={6} className="text-center py-10">Loading records...</td></tr>
                                        ) : runDetails.map(rec => (
                                            <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-700 dark:text-slate-200">{rec.employee?.name || 'Unknown'}</p>
                                                    <p className="text-xs text-slate-400">{rec.employee?.department || '-'}</p>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-xs font-bold">{rec.payable_days}</span>
                                                    <span className="text-[10px] text-slate-400 ml-1">/ {rec.payable_days + (parseFloat(rec.lop_days as any) || 0)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-sm text-slate-600 dark:text-slate-400">
                                                    {formatCurrency(rec.gross_earning)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-sm text-rose-500">
                                                    -{formatCurrency(rec.total_deduction)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">
                                                    {formatCurrency(rec.net_pay)}
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    {selectedRun.status === 'DRAFT' && (
                                                        <button
                                                            title="Adjust Pay"
                                                            onClick={() => {
                                                                setEditRecord(rec);
                                                                setEditForm({ gross_earning: rec.gross_earning || 0, total_deduction: rec.total_deduction || 0 });
                                                                setShowEditModal(true);
                                                            }}
                                                            className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        title="View Payslip Breakdown"
                                                        onClick={() => {
                                                            setSelectedPayslip(rec);
                                                            setShowPayslip(true);
                                                        }}
                                                        className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10 text-center">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                                <DollarSign className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">No Batch Selected</h3>
                            <p className="max-w-xs mx-auto text-sm">Select a payroll run from the history or generate a new one to view details.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Payslip Modal */}
            {showPayslip && selectedPayslip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
                        <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-start bg-slate-50/50 dark:bg-zinc-800/50">
                            <div className="flex items-center gap-4">
                                <img src={companyLogo} alt="Logo" className="h-12 w-auto object-contain" />
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Payslip</h3>
                                    <p className="text-slate-500 text-sm font-medium">{selectedRun?.month_year}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPayslip(false)} className="p-2 bg-white dark:bg-zinc-800 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors">
                                <span className="sr-only">Close</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Employee Info */}
                            <div className="grid grid-cols-2 gap-8 pb-8 border-b border-slate-100 dark:border-zinc-800">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Employee Name</p>
                                    <p className="font-bold text-slate-800 dark:text-white text-lg">{selectedPayslip.employee?.name}</p>
                                    <p className="text-sm text-slate-500">ID: {selectedPayslip.id.slice(0, 8)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Payable Days</p>
                                    <p className="font-bold text-slate-800 dark:text-white text-lg">{selectedPayslip.payable_days}</p>
                                </div>
                            </div>

                            {/* Earnings & Deductions */}
                            <div className="grid grid-cols-2 gap-12">
                                <div>
                                    <h4 className="font-bold text-emerald-600 dark:text-emerald-400 mb-4 text-sm uppercase tracking-wider">Earnings</h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600 dark:text-slate-300">Basic Salary</span>
                                            <span className="font-mono font-bold">{formatCurrency(selectedPayslip.base_salary)}</span>
                                        </div>
                                        {/* Dynamic components if any in breakdown */}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-between font-bold text-slate-800 dark:text-white">
                                        <span>Total Earnings</span>
                                        <span>{formatCurrency(selectedPayslip.gross_earning)}</span>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-rose-600 dark:text-rose-400 mb-4 text-sm uppercase tracking-wider">Deductions</h4>
                                    <div className="space-y-3">
                                        {/* Dynamic deductions */}
                                        <p className="text-xs text-slate-400 italic">No deductions</p>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-between font-bold text-slate-800 dark:text-white">
                                        <span>Total Deductions</span>
                                        <span>{formatCurrency(selectedPayslip.total_deduction)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Net Pay */}
                            <div className="bg-slate-50 dark:bg-zinc-800 rounded-2xl p-6 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Salary</p>
                                    <p className="text-xs text-slate-500 mt-1">Paid via Bank Transfer</p>
                                </div>
                                <p className="text-3xl font-black text-slate-900 dark:text-white">{formatCurrency(selectedPayslip.net_pay)}</p>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                            <button className="px-6 py-3 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-200 hover:border-indigo-400 transition-colors">Download PDF</button>
                            <button onClick={() => setShowPayslip(false)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Pay Modal */}
            {showEditModal && editRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Adjust Payroll Record</h3>
                            <button onClick={() => setShowEditModal(false)} className="p-2 bg-white dark:bg-zinc-800 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors">
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Employee</p>
                                <p className="font-bold text-slate-800 dark:text-white">{editRecord.employee?.name}</p>
                            </div>
                            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-2">Total Earnings / Gross</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-slate-400 sm:text-sm">{companyCurrency}</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={editForm.gross_earning}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, gross_earning: Number(e.target.value) }))}
                                            className="pl-12 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-emerald-600 dark:text-emerald-400"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Includes variable allowances like overtime or bonus</p>
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-2">Total Deductions</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-slate-400 sm:text-sm">{companyCurrency}</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={editForm.total_deduction}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, total_deduction: Number(e.target.value) }))}
                                            className="pl-12 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-rose-500"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Includes loan recoveries and other variable deductions</p>
                                </div>
                            </div>
                            <div className="pt-4 flex justify-between items-center text-lg">
                                <span className="font-bold text-slate-700 dark:text-slate-300">Net Pay</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(editForm.gross_earning - editForm.total_deduction)}</span>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                            <button onClick={handleSaveEdit} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 w-full text-center">Save Adjustments</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
