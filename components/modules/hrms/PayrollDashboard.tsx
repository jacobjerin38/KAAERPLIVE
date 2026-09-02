import React, { useState, useEffect } from 'react';
import {
    DollarSign, Play, Calendar, FileText, ChevronRight, Eye, CheckCircle, Lock,
    AlertCircle, Edit3, X, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight,
    RefreshCcw, Download, Filter, Sparkles, Plus, Loader2, Layers, Unlock
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';

import { PayrollRun, PayrollRecord } from '../../hrms/types';
import { KAA_LOGO_URL } from '../../../constants';
import { PayrollVariableInputsModal } from './PayrollVariableInputsModal';

export const PayrollDashboard: React.FC = () => {
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedRun, setSelectedRun] = useState<any | null>(null);
    const [runDetails, setRunDetails] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Company & Attendance Lock Status
    const [companyId, setCompanyId] = useState<string>('');
    const [attendancePeriod, setAttendancePeriod] = useState<any | null>(null);
    const [checkingAttendance, setCheckingAttendance] = useState(false);

    // Variable Inputs Modal
    const [showVariablesModal, setShowVariablesModal] = useState(false);

    // Filters
    const [showExceptionsOnly, setShowExceptionsOnly] = useState(false);

    // Payslip Modal State
    const [showPayslip, setShowPayslip] = useState(false);
    const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);
    const [companyLogo, setCompanyLogo] = useState(KAA_LOGO_URL);
    const [companyCurrency, setCompanyCurrency] = useState('QAR');

    // Edit Pay Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null);
    const [editForm, setEditForm] = useState({ gross_earning: 0, total_deduction: 0 });

    // Final Settlement Modal
    const [showSettlementModal, setShowSettlementModal] = useState(false);
    const [settlementForm, setSettlementForm] = useState({ employee_id: '', notice_pay: 0, leave_encashment: 0, gratuity: 0, loan_deduction: 0 });
    const [activeEmployees, setActiveEmployees] = useState<any[]>([]);

    useEffect(() => {
        initContext();
    }, []);

    const initContext = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle();
                if (profile?.company_id) {
                    setCompanyId(profile.company_id);
                    fetchCompanyLogo(profile.company_id);
                    fetchActiveEmployees(profile.company_id);
                    fetchRuns(profile.company_id);
                    fetchAttendancePeriod(profile.company_id, selectedMonth);
                }
            }
        } catch (e) {
            console.error('Error initializing payroll context:', e);
        }
    };

    useEffect(() => {
        if (companyId) {
            fetchAttendancePeriod(companyId, selectedMonth);
        }
    }, [selectedMonth, companyId]);

    const fetchActiveEmployees = async (comp_id: string) => {
        const { data } = await supabase.from('employees').select('id, name, employee_code').eq('company_id', comp_id).eq('status', 'Active');
        if (data) setActiveEmployees(data);
    };

    const fetchCompanyLogo = async (comp_id: string) => {
        try {
            const { data } = await supabase.from('companies').select('logo_url, currency').eq('id', comp_id).maybeSingle();
            if (data?.logo_url) setCompanyLogo(data.logo_url);
            if (data?.currency) setCompanyCurrency(data.currency);
        } catch (e) {
            console.error('Error fetching company details:', e);
        }
    };

    const fetchRuns = async (comp_id: string = companyId) => {
        if (!comp_id) return;
        const { data } = await (supabase as any).from('payroll_runs')
            .select('*')
            .eq('company_id', comp_id)
            .order('period_start', { ascending: false });
        if (data) setRuns(data);
    };

    const fetchAttendancePeriod = async (comp_id: string, m: string) => {
        if (!comp_id) return;
        setCheckingAttendance(true);
        const [y, mon] = m.split('-').map(Number);
        const lastDay = new Date(y, mon, 0).getDate();
        const startDate = `${m}-01`;
        const endDate = `${m}-${String(lastDay).padStart(2, '0')}`;

        const { data } = await supabase.from('attendance_periods')
            .select('*')
            .eq('company_id', comp_id)
            .lte('start_date', endDate)
            .gte('end_date', startDate)
            .maybeSingle();

        setAttendancePeriod(data || null);
        setCheckingAttendance(false);
    };

    // Stage 1: Import Locked Attendance Snapshot
    const handleImportAttendance = async () => {
        if (!attendancePeriod) {
            alert(`No attendance period found for ${selectedMonth}. Please process and lock attendance first.`);
            return;
        }

        if (attendancePeriod.status !== 'LOCKED' && attendancePeriod.status !== 'FINALIZED') {
            alert(`Cannot import attendance:\n\nThe attendance period for ${selectedMonth} must be FINALIZED or LOCKED by HR first.\nCurrent Status: ${attendancePeriod.status}`);
            return;
        }

        if (!confirm(`Import locked attendance snapshot for ${selectedMonth}? This creates an immutable snapshot of working days, LOP, and overtime.`)) return;

        setActionLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await (supabase.rpc as any)('rpc_transfer_attendance_to_payroll', {
                p_company_id: companyId,
                p_attendance_period_id: attendancePeriod.id,
                p_user_id: user?.id
            });

            if (error) throw error;

            alert(`Attendance Snapshot Imported successfully! (${data?.employees_snapshotted || 0} employees snapshotted)`);
            await fetchRuns(companyId);

            if (data?.payroll_run_id) {
                const { data: newRun } = await (supabase as any).from('payroll_runs').select('*').eq('id', data.payroll_run_id).single();
                if (newRun) handleViewDetails(newRun);
            }
        } catch (err: any) {
            alert('Error importing attendance: ' + (err.message || err));
        } finally {
            setActionLoading(false);
        }
    };

    // Stage 2: Pre-Process Salary (Preview & Exceptions)
    const handleRunPreProcessing = async () => {
        if (!selectedRun) return alert('Select or import a payroll run first.');

        setActionLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await (supabase.rpc as any)('rpc_preprocess_salary', {
                p_company_id: companyId,
                p_payroll_run_id: selectedRun.id,
                p_user_id: user?.id
            });

            if (error) throw error;

            alert(`Pre-processing complete!\n- Employees Evaluated: ${data?.employees_processed || 0}\n- Exceptions Flagged: ${data?.exceptions_count || 0}`);
            await fetchRuns(companyId);
            await handleViewDetails({ ...selectedRun, status: 'PREPROCESSING' });
        } catch (err: any) {
            alert('Pre-processing failed: ' + (err.message || err));
        } finally {
            setActionLoading(false);
        }
    };

    // Stage 3: Process Final Salary
    const handleProcessFinalSalary = async () => {
        if (!selectedRun) return alert('Select a payroll run first.');
        if (!confirm('Calculate and process final salary records for this batch?')) return;

        setActionLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await (supabase.rpc as any)('rpc_process_payroll_final', {
                p_company_id: companyId,
                p_payroll_run_id: selectedRun.id,
                p_user_id: user?.id
            });

            if (error) throw error;

            alert('Final salary processed successfully! Batch is ready for executive review and locking.');
            await fetchRuns(companyId);
            await handleViewDetails({ ...selectedRun, status: 'SALARY_PROCESSED' });
        } catch (err: any) {
            alert('Error processing salary: ' + (err.message || err));
        } finally {
            setActionLoading(false);
        }
    };

    // Stage 4: Finalize & Lock Batch
    const handleFinalizeBatch = async () => {
        if (!selectedRun) return;
        if (!confirm('Are you sure you want to FINALIZE & LOCK this payroll batch?\n\nOnce locked, all calculations and variable inputs are frozen for audit. Payout slips and WPS export will be generated.')) return;

        setActionLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await (supabase.rpc as any)('rpc_finalize_payroll_run', {
                p_company_id: companyId,
                p_payroll_run_id: selectedRun.id,
                p_lock_reason: 'Executive final approval and payout lock',
                p_user_id: user?.id
            });

            if (error) throw error;

            alert('Payroll batch FINALIZED & LOCKED successfully!');
            await fetchRuns(companyId);
            setSelectedRun({ ...selectedRun, status: 'FINALIZED' });
            await handleViewDetails({ ...selectedRun, status: 'FINALIZED' });
        } catch (err: any) {
            alert('Error finalizing batch: ' + (err.message || err));
        } finally {
            setActionLoading(false);
        }
    };

    const handleViewDetails = async (run: any) => {
        setSelectedRun(run);
        setLoadingDetails(true);
        const { data, error } = await (supabase as any)
            .from('payroll_records')
            .select(`
                *,
                employee:employees(name, department_id, employee_code, passport_number, visa_number, account_number, bank_name)
            `)
            .eq('payroll_run_id', run.id);

        if (data) {
            setRunDetails(data as any);
        }
        setLoadingDetails(false);
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

    const handleProcessSettlement = async () => {
        if (!settlementForm.employee_id) return alert("Select an employee");
        if (!selectedRun) return alert("Please select or generate a Draft Payroll Run for the current month first.");
        
        const totEarn = Number(settlementForm.notice_pay) + Number(settlementForm.leave_encashment) + Number(settlementForm.gratuity);
        const totDed = Number(settlementForm.loan_deduction);
        const netPay = totEarn - totDed;

        // Upsert settlement into the active payroll batch
        const insertData = {
            run_id: selectedRun.id,
            employee_id: settlementForm.employee_id,
            base_salary: 0, // already separated from standard
            payable_days: 0,
            gross_earning: totEarn,
            total_deduction: totDed,
            net_pay: netPay
        };

        const { error } = await (supabase.from('payroll_records') as any).insert([insertData]);
        if (error) {
            alert('Error creating settlement: ' + error.message);
        } else {
            alert('Full & Final Settlement added to current ' + (selectedRun.name || selectedRun.month_year || selectedRun.period_start) + ' batch.');
            setShowSettlementModal(false);
            handleViewDetails(selectedRun);
        }
    };

    const formatCurrency = (amount: number) => {
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: companyCurrency || 'QAR' }).format(amount);
        } catch {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR' }).format(amount);
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
        link.setAttribute("download", `WPS_Qatar_${(selectedRun.name || selectedRun.period_start || '').replace(/[^a-zA-Z0-9]/g, '')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportBankStatement = () => {
        if (!selectedRun || !runDetails || runDetails.length === 0) return;
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Employee Name,Employee Code,Bank Name,Account Number,Net Salary,Month\r\n";
        runDetails.forEach(rec => {
            const emp = rec.employee || {};
            csvContent += `${emp.name || 'Unknown'},${(emp as any).employee_code || ''},${(emp as any).bank_name || ''},${(emp as any).account_number || ''},${rec.net_pay || 0},${selectedRun.name || selectedRun.period_start}\r\n`;
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `Bank_Statement_${(selectedRun.name || selectedRun.period_start || '').replace(/[^a-zA-Z0-9]/g, '')}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleExportCashStatement = () => {
        if (!selectedRun || !runDetails || runDetails.length === 0) return;
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Employee Name,Basic Salary,Gross Earning,OT Amount,Deductions,Loan Recovery,Net Pay,Payment Mode\r\n";
        runDetails.forEach(rec => {
            const emp = rec.employee || {};
            const mode = (emp as any).account_number ? 'Bank Transfer' : 'Cash';
            csvContent += `${emp.name || 'Unknown'},${rec.base_salary || 0},${rec.gross_earning || 0},${rec.ot_amount || 0},${rec.total_deduction || 0},${rec.loan_deduction || 0},${rec.net_pay || 0},${mode}\r\n`;
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `Cash_Statement_${(selectedRun.name || selectedRun.period_start || '').replace(/[^a-zA-Z0-9]/g, '')}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleExportMonthlySalary = () => {
        if (!selectedRun || !runDetails || runDetails.length === 0) return;
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Employee Name,Employee Code,Department,Payable Days,LOP Days,Basic Salary,Overtime,Gross Earning,Deductions,Loan Recovery,Net Pay\r\n";
        runDetails.forEach(rec => {
            const emp = rec.employee || {};
            csvContent += `${emp.name || 'Unknown'},${(emp as any).employee_code || ''},${(emp as any).department || ''},${rec.payable_days || 0},${rec.lop_days || 0},${rec.base_salary || 0},${rec.ot_amount || 0},${rec.gross_earning || 0},${rec.total_deduction || 0},${rec.loan_deduction || 0},${rec.net_pay || 0}\r\n`;
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `Monthly_Salary_Report_${(selectedRun.name || selectedRun.period_start || '').replace(/[^a-zA-Z0-9]/g, '')}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleExportGratuity = () => {
        if (!selectedRun || !runDetails || runDetails.length === 0) return;
        alert('Gratuity & Bonus report is available in HRMS > Reports > Standard Reports > Bonus & Gratuity Valuation.');
    };

    const handleExportReport = (type: string) => {
        if (type === 'WPS') handleExportWPS();
        else if (type === 'Bank Statement') handleExportBankStatement();
        else if (type === 'Cash Statement') handleExportCashStatement();
        else if (type === 'Salary Slip') handleExportMonthlySalary();
        else if (type === 'Gratuity') handleExportGratuity();
    };

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            {/* Header */}
            <header className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Payroll Processing</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">End-to-end attendance snapshotting, variable inputs, and payout locking</p>
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
                        onClick={() => setShowVariablesModal(true)}
                        className="px-5 py-2.5 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300 border border-violet-200 dark:border-violet-800 rounded-2xl text-sm font-bold hover:bg-violet-100 transition-all shadow-sm flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Variable Inputs
                    </button>

                    <button
                        onClick={() => setShowSettlementModal(true)}
                        className="px-5 py-2.5 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-sm font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all shadow-sm"
                    >
                        Settlements
                    </button>
                </div>
            </header>

            {/* Attendance Month-Lock Status Banner */}
            <div className={`mb-6 p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 transition-all shrink-0 ${
                attendancePeriod?.status === 'LOCKED'
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                    : attendancePeriod?.status === 'FINALIZED'
                        ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                        : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
            }`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-sm ${
                        attendancePeriod?.status === 'LOCKED' ? 'bg-emerald-600 text-white' :
                        attendancePeriod?.status === 'FINALIZED' ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
                    }`}>
                        {attendancePeriod?.status === 'LOCKED' ? <Lock className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Attendance Status ({selectedMonth}):
                            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                                attendancePeriod?.status === 'LOCKED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                                attendancePeriod?.status === 'FINALIZED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                            }`}>
                                {attendancePeriod?.status || 'NOT PROCESSED / OPEN'}
                            </span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {attendancePeriod?.status === 'LOCKED'
                                ? 'Attendance is verified & locked. Payroll receives this frozen snapshot for working days, LOP, and overtime.'
                                : attendancePeriod?.status === 'FINALIZED'
                                    ? 'Attendance is finalized by HR but not locked. Lock the attendance period in HRMS before payroll import.'
                                    : 'Attendance has not been finalized/locked by HR. Payroll import requires a finalized or locked attendance period.'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleImportAttendance}
                        disabled={actionLoading || (!attendancePeriod || (attendancePeriod.status !== 'LOCKED' && attendancePeriod.status !== 'FINALIZED'))}
                        className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Import Attendance Snapshot
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
                {/* Runs List */}
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Batch History</h3>
                        <span className="text-xs font-bold text-slate-400">{runs.length} Batches</span>
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
                                    <h4 className="font-bold text-slate-700 dark:text-slate-200">{run.name || run.month_year || run.period_start}</h4>
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                        run.status === 'FINALIZED' || run.status === 'LOCKED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                                        run.status === 'SALARY_PROCESSED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                        run.status === 'PREPROCESSING' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' :
                                        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                    }`}>{run.status}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Total Payout</p>
                                        <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(run.total_net_pay || run.total_amount || 0)}</p>
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
                            {/* Run Header */}
                            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50 dark:bg-zinc-800/50">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        {selectedRun.name || selectedRun.month_year || selectedRun.period_start}
                                        <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold uppercase tracking-wider ${
                                            selectedRun.status === 'FINALIZED' || selectedRun.status === 'LOCKED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                                            selectedRun.status === 'SALARY_PROCESSED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                            'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                        }`}>
                                            {selectedRun.status}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Period: {selectedRun.period_start} to {selectedRun.period_end}</p>
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
                                </div>
                            </div>

                            {/* Processing Stepper Actions */}
                            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    {runDetails.some(r => r.has_exception) && (
                                        <button
                                            onClick={() => setShowExceptionsOnly(!showExceptionsOnly)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                                showExceptionsOnly 
                                                    ? 'bg-rose-600 text-white' 
                                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                            }`}
                                        >
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {showExceptionsOnly ? 'Show All Employees' : `Filter Exceptions (${runDetails.filter(r => r.has_exception).length})`}
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {selectedRun.status !== 'FINALIZED' && selectedRun.status !== 'LOCKED' && (
                                        <>
                                            <button
                                                onClick={handleRunPreProcessing}
                                                disabled={actionLoading}
                                                className="px-3.5 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                                                Pre-Process Salary
                                            </button>

                                            <button
                                                onClick={handleProcessFinalSalary}
                                                disabled={actionLoading}
                                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                                Process Final Salary
                                            </button>

                                            <button
                                                onClick={handleFinalizeBatch}
                                                disabled={actionLoading}
                                                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 hover:bg-rose-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                                                Finalize & Lock Batch
                                            </button>
                                        </>
                                    )}

                                    {(selectedRun.status === 'FINALIZED' || selectedRun.status === 'LOCKED') && (
                                        <span className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                            <Lock className="w-3.5 h-3.5 text-rose-600" /> Batch Finalized & Locked
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-zinc-800 sticky top-0 z-10 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Employee</th>
                                            <th className="px-6 py-4 text-center">Paid / LOP</th>
                                            <th className="px-6 py-4 text-right">Gross</th>
                                            <th className="px-6 py-4 text-right">Deductions</th>
                                            <th className="px-6 py-4 text-right">Net Pay</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {loadingDetails ? (
                                            <tr><td colSpan={6} className="text-center py-10">Loading records...</td></tr>
                                        ) : (showExceptionsOnly ? runDetails.filter(r => r.has_exception) : runDetails).map(rec => (
                                            <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div>
                                                            <p className="font-bold text-slate-700 dark:text-slate-200">{rec.employee?.name || 'Unknown'}</p>
                                                            <p className="text-xs text-slate-400">{rec.employee?.employee_code ? `(${rec.employee?.employee_code}) ` : ''}{rec.employee?.department || '-'}</p>
                                                        </div>
                                                        {rec.has_exception && (
                                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 rounded-md text-[10px] font-bold flex items-center gap-1">
                                                                <AlertCircle className="w-3 h-3" /> Exception
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-1 rounded-lg text-xs font-bold">{rec.payable_days}</span>
                                                    {Number(rec.lop_days) > 0 && (
                                                        <span className="text-[10px] text-rose-500 font-bold ml-1">({rec.lop_days} LOP)</span>
                                                    )}
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
                                                    {selectedRun.status !== 'FINALIZED' && selectedRun.status !== 'LOCKED' && (
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
                            <p className="max-w-xs mx-auto text-sm">Select a payroll batch or import locked attendance to start processing.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Variable Inputs Modal */}
            {showVariablesModal && (
                <PayrollVariableInputsModal
                    companyId={companyId}
                    monthYear={selectedMonth}
                    payrollRunId={selectedRun?.id}
                    isLocked={selectedRun?.status === 'FINALIZED' || selectedRun?.status === 'LOCKED'}
                    onClose={() => setShowVariablesModal(false)}
                    onSuccess={() => {
                        if (selectedRun) handleViewDetails(selectedRun);
                    }}
                />
            )}

            {/* Payslip Modal */}
            {showPayslip && selectedPayslip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowPayslip(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-start bg-slate-50/50 dark:bg-zinc-800/50 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <img src={companyLogo} alt="Logo" className="h-12 w-auto object-contain" />
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Payslip</h3>
                                    <p className="text-slate-500 text-sm font-medium">{selectedRun?.name || selectedRun?.month_year || selectedRun?.period_start}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPayslip(false)} className="p-2 bg-white dark:bg-zinc-800 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors">
                                <span className="sr-only">Close</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-8 space-y-8 flex-1 overflow-y-auto">
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
                                            <span className="font-mono font-bold">{formatCurrency(selectedPayslip.base_salary || (selectedPayslip as any).basic_salary || 0)}</span>
                                        </div>
                                        {((selectedPayslip as any).ot_amount > 0) && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600 dark:text-slate-300">Overtime ({(selectedPayslip as any).ot_hours || 0} hrs)</span>
                                                <span className="font-mono font-bold text-emerald-600">+{formatCurrency((selectedPayslip as any).ot_amount)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-between font-bold text-slate-800 dark:text-white">
                                        <span>Total Earnings</span>
                                        <span>{formatCurrency(selectedPayslip.gross_earning)}</span>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-rose-600 dark:text-rose-400 mb-4 text-sm uppercase tracking-wider">Deductions</h4>
                                    <div className="space-y-3">
                                        {((selectedPayslip as any).late_deduction > 0) && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600 dark:text-slate-300">Late Deductions ({(selectedPayslip as any).late_count || 0} lates)</span>
                                                <span className="font-mono font-bold text-rose-500">-{formatCurrency((selectedPayslip as any).late_deduction)}</span>
                                            </div>
                                        )}
                                        {((selectedPayslip as any).early_deduction > 0) && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600 dark:text-slate-300">Early Leaving ({(selectedPayslip as any).early_count || 0} times)</span>
                                                <span className="font-mono font-bold text-rose-500">-{formatCurrency((selectedPayslip as any).early_deduction)}</span>
                                            </div>
                                        )}
                                        {((selectedPayslip as any).loan_deduction > 0) && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600 dark:text-slate-300">Loan Repayment</span>
                                                <span className="font-mono font-bold text-rose-500">-{formatCurrency((selectedPayslip as any).loan_deduction)}</span>
                                            </div>
                                        )}
                                        {!((selectedPayslip as any).late_deduction > 0) && !((selectedPayslip as any).early_deduction > 0) && !((selectedPayslip as any).loan_deduction > 0) && (
                                            <p className="text-xs text-slate-400 italic">No deductions</p>
                                        )}
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
                        <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3 flex-shrink-0">
                            <button className="px-6 py-3 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-200 hover:border-indigo-400 transition-colors">Download PDF</button>
                            <button onClick={() => setShowPayslip(false)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Pay Modal */}
            {showEditModal && editRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowEditModal(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50 flex-shrink-0">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Adjust Payroll Record</h3>
                            <button onClick={() => setShowEditModal(false)} className="p-2 bg-white dark:bg-zinc-800 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors">
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
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
                        <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={handleSaveEdit} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 w-full text-center">Save Adjustments</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Final Settlement Modal */}
            {showSettlementModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowSettlementModal(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-rose-100 dark:border-rose-900/30 flex justify-between items-center bg-rose-50/50 dark:bg-rose-900/10 flex-shrink-0">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Full & Final Settlement</h3>
                            <button onClick={() => setShowSettlementModal(false)} className="p-2 bg-white dark:bg-zinc-800 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors">
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm font-medium rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <p>Ensure a Draft Payroll batch is selected or generated for the current month. The settlement will be attached to it.</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Select Employee</label>
                                <select 
                                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-900 dark:text-white"
                                    value={settlementForm.employee_id}
                                    onChange={e => setSettlementForm(prev => ({...prev, employee_id: e.target.value}))}
                                >
                                    <option value="">-- Choose Employee --</option>
                                    {activeEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code})</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Notice Period Pay</label>
                                    <input type="number" value={settlementForm.notice_pay} onChange={e => setSettlementForm(prev => ({...prev, notice_pay: Number(e.target.value)}))} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Leave Encashment</label>
                                    <input type="number" value={settlementForm.leave_encashment} onChange={e => setSettlementForm(prev => ({...prev, leave_encashment: Number(e.target.value)}))} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Gratuity Amount</label>
                                    <input type="number" value={settlementForm.gratuity} onChange={e => setSettlementForm(prev => ({...prev, gratuity: Number(e.target.value)}))} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Loan Recovery / Dues</label>
                                    <input type="number" value={settlementForm.loan_deduction} onChange={e => setSettlementForm(prev => ({...prev, loan_deduction: Number(e.target.value)}))} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-rose-200 dark:border-rose-900/50 outline-none text-rose-600" />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center text-lg">
                                <span className="font-bold text-slate-700 dark:text-slate-300">Final Net Payout</span>
                                <span className="font-black text-rose-600 dark:text-rose-400">
                                    {formatCurrency(Number(settlementForm.notice_pay) + Number(settlementForm.leave_encashment) + Number(settlementForm.gratuity) - Number(settlementForm.loan_deduction))}
                                </span>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={handleProcessSettlement} className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-colors shadow-lg shadow-rose-500/20 w-full">Finalize Offboarding Pay</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
