import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Save, AlertCircle, FileText, CheckCircle2, UserCheck, ArrowDownRight, ArrowUpRight, DollarSign } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Employee } from '../../../types';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface FnFSettlementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    employees: Employee[];
    initialEmployeeId?: string;
}

export const FnFSettlementModal: React.FC<FnFSettlementModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    employees,
    initialEmployeeId = ''
}) => {
    const { currentCompanyId } = useAuth();

    // Form fields
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId);
    const [resignationDate, setResignationDate] = useState(new Date().toISOString().split('T')[0]);
    const [lastWorkingDay, setLastWorkingDay] = useState(new Date().toISOString().split('T')[0]);
    
    const [basicSalary, setBasicSalary] = useState<number>(0);
    const [grossSalary, setGrossSalary] = useState<number>(0);
    const [joinDate, setJoinDate] = useState<string>('');

    // Allowances
    const [hraAmount, setHraAmount] = useState<number>(0);
    const [transportAllowance, setTransportAllowance] = useState<number>(0);
    const [specialAllowance, setSpecialAllowance] = useState<number>(0);
    const [foodAllowance, setFoodAllowance] = useState<number>(0);
    const [otherAllowance, setOtherAllowance] = useState<number>(0);
    const [assignedAssetsCount, setAssignedAssetsCount] = useState<number>(0);

    // Notice Period
    const [noticePeriodDays, setNoticePeriodDays] = useState<number>(30);
    const [shortfallDays, setShortfallDays] = useState<number>(0);
    const [manualNoticeRecovery, setManualNoticeRecovery] = useState<number | null>(null);

    // Unpaid Salary
    const [unpaidSalaryDays, setUnpaidSalaryDays] = useState<number>(0);
    const [manualUnpaidSalary, setManualUnpaidSalary] = useState<number | null>(null);

    // Leave Encashment
    const [remainingLeaveDays, setRemainingLeaveDays] = useState<number>(0);
    const [manualLeaveEncashment, setManualLeaveEncashment] = useState<number | null>(null);

    // Gratuity
    const [manualGratuity, setManualGratuity] = useState<number | null>(null);
    const [otherEarnings, setOtherEarnings] = useState<number>(0);

    // Deductions
    const [assetDeduction, setAssetDeduction] = useState<number>(0);
    const [loanDeduction, setLoanDeduction] = useState<number>(0);
    const [otherDeduction, setOtherDeduction] = useState<number>(0);

    const [remarks, setRemarks] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    // Selected Employee Object
    const selectedEmployee = useMemo(() => {
        return employees.find(e => e.id === selectedEmployeeId) || null;
    }, [employees, selectedEmployeeId]);

    // Pre-fill values on employee select & auto-fetch allowances, leave, loans, assets
    useEffect(() => {
        if (!selectedEmployee) return;

        const gross = Number(selectedEmployee.salary || selectedEmployee.salary_amount || 0);
        const join = selectedEmployee.joinDate || selectedEmployee.join_date || '';

        setGrossSalary(gross);
        setJoinDate(join);

        // Clear manual overrides on employee switch
        setManualNoticeRecovery(null);
        setManualUnpaidSalary(null);
        setManualLeaveEncashment(null);
        setManualGratuity(null);

        const empId = selectedEmployee.id;

        // 1. Fetch Salary Components
        const fetchSalaryComponents = async () => {
            const { data: components } = await (supabase as any)
                .from('employee_salary_components')
                .select('*, component:org_salary_components(name, component_type)')
                .eq('employee_id', empId)
                .eq('is_active', true);

            if (components && components.length > 0) {
                let basic = 0;
                let hra = 0;
                let transport = 0;
                let special = 0;
                let food = 0;
                let other = 0;

                components.forEach((c: any) => {
                    const name = (c.component?.name || c.name || '').toLowerCase();
                    const amt = Number(c.amount || 0);
                    if (name.includes('basic')) basic += amt;
                    else if (name.includes('hra') || name.includes('housing')) hra += amt;
                    else if (name.includes('transport') || name.includes('travel')) transport += amt;
                    else if (name.includes('special')) special += amt;
                    else if (name.includes('food') || name.includes('meal')) food += amt;
                    else other += amt;
                });

                setBasicSalary(basic > 0 ? basic : Math.round(gross * 0.5));
                setHraAmount(hra || Math.round(gross * 0.25));
                setTransportAllowance(transport || Math.round(gross * 0.15));
                setSpecialAllowance(special || Math.round(gross * 0.10));
                setFoodAllowance(food || 0);
                setOtherAllowance(other || 0);
            } else {
                setBasicSalary(Math.round(gross * 0.5));
                setHraAmount(Math.round(gross * 0.25));
                setTransportAllowance(Math.round(gross * 0.15));
                setSpecialAllowance(Math.round(gross * 0.10));
                setFoodAllowance(0);
                setOtherAllowance(0);
            }
        };

        // 2. Fetch Remaining Leave Days
        const fetchLeaveBalance = async () => {
            const { data: balances } = await (supabase as any)
                .from('employee_leave_balances')
                .select('total_balance, used, remaining_days, balance_days')
                .eq('employee_id', empId);

            if (balances && balances.length > 0) {
                const totalRemaining = balances.reduce((sum: number, b: any) => {
                    const rem = b.remaining_days ?? b.balance_days ?? ((b.total_balance || 0) - (b.used || 0));
                    return sum + Math.max(0, Number(rem || 0));
                }, 0);
                setRemainingLeaveDays(totalRemaining);
            } else {
                setRemainingLeaveDays(0);
            }
        };

        // 3. Fetch Outstanding Loans
        const fetchLoans = async () => {
            const { data: loans } = await (supabase as any)
                .from('payroll_loans')
                .select('balance_amount, remaining_amount, loan_amount')
                .eq('employee_id', empId);

            if (loans && loans.length > 0) {
                const totalOutstanding = loans.reduce((sum: number, l: any) => {
                    const rem = l.balance_amount ?? l.remaining_amount ?? l.loan_amount ?? 0;
                    return sum + Number(rem || 0);
                }, 0);
                setLoanDeduction(totalOutstanding);
            } else {
                setLoanDeduction(0);
            }
        };

        // 4. Fetch Assigned Assets Count
        const fetchAssets = async () => {
            const { data: assets } = await (supabase as any)
                .from('assets')
                .select('id')
                .or(`assigned_to.eq.${empId},employee_id.eq.${empId}`);

            if (assets) {
                setAssignedAssetsCount(assets.length);
            } else {
                setAssignedAssetsCount(0);
            }
        };

        fetchSalaryComponents();
        fetchLeaveBalance();
        fetchLoans();
        fetchAssets();
    }, [selectedEmployee]);

    // Calculate Service Years for Gratuity
    const serviceYears = useMemo(() => {
        if (!joinDate || !lastWorkingDay) return 0;
        const start = new Date(joinDate);
        const end = new Date(lastWorkingDay);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
        const diffMs = Math.max(0, end.getTime() - start.getTime());
        const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
        return Number(years.toFixed(2));
    }, [joinDate, lastWorkingDay]);

    // Auto Calculations
    // Notice Pay Recovery: (Basic Salary / 30) * Shortfall Days
    const calculatedNoticeRecovery = useMemo(() => {
        if (shortfallDays <= 0 || basicSalary <= 0) return 0;
        return Math.round((basicSalary / 30) * shortfallDays);
    }, [basicSalary, shortfallDays]);

    const noticeRecoveryAmount = manualNoticeRecovery !== null ? manualNoticeRecovery : calculatedNoticeRecovery;

    // Unpaid Salary Amount: (Gross Salary / 30) * Unpaid Days
    const calculatedUnpaidSalary = useMemo(() => {
        if (unpaidSalaryDays <= 0 || grossSalary <= 0) return 0;
        return Math.round((grossSalary / 30) * unpaidSalaryDays);
    }, [grossSalary, unpaidSalaryDays]);

    const unpaidSalaryAmount = manualUnpaidSalary !== null ? manualUnpaidSalary : calculatedUnpaidSalary;

    // Leave Encashment: (Gross Salary / 30) * Leave Days
    const calculatedLeaveEncashment = useMemo(() => {
        if (remainingLeaveDays <= 0 || grossSalary <= 0) return 0;
        return Math.round((grossSalary / 30) * remainingLeaveDays);
    }, [grossSalary, remainingLeaveDays]);

    const leaveEncashmentAmount = manualLeaveEncashment !== null ? manualLeaveEncashment : calculatedLeaveEncashment;

    // Qatar / GCC Gratuity Calculation Rule:
    // < 1 yr: 0
    // 1 to 5 yrs: 21 days basic salary per year ((21 * basicSalary * serviceYears) / 30)
    // > 5 yrs: 21 days basic for first 5 yrs + 30 days basic for every yr thereafter ((21 * 5 + 30 * (serviceYears - 5)) * basicSalary / 30)
    // Capped at 2 years total basic salary (24 * basicSalary)
    const calculatedGratuity = useMemo(() => {
        if (isNaN(serviceYears) || serviceYears < 1 || isNaN(basicSalary) || basicSalary <= 0) return 0;
        let amount = 0;
        if (serviceYears <= 5) {
            amount = (21 * basicSalary * serviceYears) / 30;
        } else {
            amount = ((21 * 5 + 30 * (serviceYears - 5)) * basicSalary) / 30;
        }
        const maxCap = 24 * basicSalary;
        if (amount > maxCap) amount = maxCap;
        return isNaN(amount) ? 0 : Math.round(amount);
    }, [serviceYears, basicSalary]);

    const gratuityAmount = manualGratuity !== null ? manualGratuity : calculatedGratuity;

    // Totals & Net Calculation
    const totalEarnings = useMemo(() => {
        const sum = Number(unpaidSalaryAmount) + Number(leaveEncashmentAmount) + Number(gratuityAmount) + Number(otherEarnings);
        return isNaN(sum) ? 0 : sum;
    }, [unpaidSalaryAmount, leaveEncashmentAmount, gratuityAmount, otherEarnings]);

    const totalDeductions = useMemo(() => {
        const sum = Number(noticeRecoveryAmount) + Number(assetDeduction) + Number(loanDeduction) + Number(otherDeduction);
        return isNaN(sum) ? 0 : sum;
    }, [noticeRecoveryAmount, assetDeduction, loanDeduction, otherDeduction]);

    const netAmount = useMemo(() => {
        const net = totalEarnings - totalDeductions;
        return isNaN(net) ? 0 : net;
    }, [totalEarnings, totalDeductions]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeId) {
            alert('Please select an employee for Full & Final settlement.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                company_id: selectedEmployee?.company_id || currentCompanyId,
                employee_id: selectedEmployeeId,
                resignation_date: resignationDate,
                last_working_day: lastWorkingDay,
                notice_period_days: Number(noticePeriodDays) || 0,
                shortfall_days: Number(shortfallDays) || 0,
                notice_recovery_amount: Number(noticeRecoveryAmount) || 0,
                unpaid_salary_days: Number(unpaidSalaryDays) || 0,
                unpaid_salary_amount: Number(unpaidSalaryAmount) || 0,
                remaining_leave_days: Number(remainingLeaveDays) || 0,
                leave_encashment_amount: Number(leaveEncashmentAmount) || 0,
                service_years: Number(serviceYears) || 0,
                gratuity_amount: Number(gratuityAmount) || 0,
                asset_deduction: Number(assetDeduction) || 0,
                loan_deduction: Number(loanDeduction) || 0,
                other_deduction: Number(otherDeduction) || 0,
                hra_amount: Number(hraAmount) || 0,
                transport_allowance: Number(transportAllowance) || 0,
                special_allowance: Number(specialAllowance) || 0,
                food_allowance: Number(foodAllowance) || 0,
                other_allowance: Number(otherAllowance) || 0,
                basic_salary: Number(basicSalary) || 0,
                gross_salary: Number(grossSalary) || 0,
                total_earnings: Number(totalEarnings) || 0,
                total_deductions: Number(totalDeductions) || 0,
                net_amount: Number(netAmount) || 0,
                remarks: remarks,
                status: 'PROCESSED'
            };

            // 1. Insert into employee_fnf_settlements
            const { error: fnfError } = await (supabase as any).from('employee_fnf_settlements').insert([payload as any]);
            if (fnfError) {
                throw new Error('Failed to save settlement record: ' + fnfError.message);
            }

            // 2. Update employee status to Resigned
            const { error: empError } = await (supabase as any)
                .from('employees')
                .update({ status: 'Resigned' })
                .eq('id', selectedEmployeeId);

            if (empError) throw empError;

            // 3. Update resignation record status if exists
            await (supabase as any)
                .from('resignations')
                .update({ settlement_status: 'SETTLED', exit_status: 'Approved', status: 'Approved' })
                .eq('employee_id', selectedEmployeeId);

            alert(`F&F Settlement saved successfully for ${selectedEmployee?.name || 'Employee'}. Status updated to Resigned.`);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err: any) {
            alert('Error processing settlement: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal title="Full & Final (F&F) Settlement Form" onClose={onClose} maxWidth="max-w-4xl">
            <form onSubmit={handleSave} className="space-y-6">
                {/* Employee Info Header */}
                <div className="bg-indigo-50/70 dark:bg-indigo-950/30 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Select Employee *
                            </label>
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                required
                                className="w-full p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-slate-800 dark:text-slate-100"
                            >
                                <option value="">Select Staff Member...</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name} ({(emp as any).employee_code || emp.id.substring(0, 6)}) - {emp.department || 'General'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Resignation Date
                            </label>
                            <input
                                type="date"
                                value={resignationDate}
                                onChange={(e) => setResignationDate(e.target.value)}
                                required
                                className="w-full p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Last Working Day *
                            </label>
                            <input
                                type="date"
                                value={lastWorkingDay}
                                onChange={(e) => setLastWorkingDay(e.target.value)}
                                required
                                className="w-full p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-100"
                            />
                        </div>
                    </div>

                    {selectedEmployee && (
                        <div className="mt-4 pt-3 border-t border-indigo-100 dark:border-indigo-900/40 flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <div><span className="text-slate-400">Join Date:</span> {joinDate || 'N/A'}</div>
                            <div><span className="text-slate-400">Service Tenure:</span> {serviceYears} Years</div>
                            <div><span className="text-slate-400">Assigned Assets:</span> <span className="text-amber-600 font-bold">{assignedAssetsCount} Assets</span></div>
                            <div><span className="text-slate-400">Current Status:</span> <span className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedEmployee.status || 'Active'}</span></div>
                        </div>
                    )}
                </div>

                {/* Salary Base Parameters & Allowances */}
                <div className="space-y-3 bg-slate-50 dark:bg-zinc-800/50 p-5 rounded-2xl border border-slate-200/60 dark:border-zinc-700">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Salary & Allowance Mapping</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Basic Salary</label>
                            <input
                                type="number"
                                value={basicSalary}
                                onChange={(e) => setBasicSalary(Number(e.target.value))}
                                className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Gross Salary</label>
                            <input
                                type="number"
                                value={grossSalary}
                                onChange={(e) => setGrossSalary(Number(e.target.value))}
                                className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">HRA Allowance</label>
                            <input
                                type="number"
                                value={hraAmount}
                                onChange={(e) => setHraAmount(Number(e.target.value))}
                                className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Transport Allowance</label>
                            <input
                                type="number"
                                value={transportAllowance}
                                onChange={(e) => setTransportAllowance(Number(e.target.value))}
                                className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Special Allowance</label>
                            <input
                                type="number"
                                value={specialAllowance}
                                onChange={(e) => setSpecialAllowance(Number(e.target.value))}
                                className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Food / Other Allowance</label>
                            <input
                                type="number"
                                value={foodAllowance + otherAllowance}
                                onChange={(e) => setFoodAllowance(Number(e.target.value))}
                                className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Grid 2 Columns: Earnings (Left) & Deductions (Right) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* EARNINGS */}
                    <div className="space-y-4 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                        <h3 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-emerald-600" /> F&F Earnings & Additions
                        </h3>

                        {/* Unpaid Salary Days */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Unpaid Salary Days
                                </label>
                                <span className="text-xs text-emerald-600 font-bold font-mono">
                                    = {unpaidSalaryAmount.toLocaleString()}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="number"
                                    placeholder="Days"
                                    value={unpaidSalaryDays}
                                    onChange={(e) => {
                                        setUnpaidSalaryDays(Number(e.target.value));
                                        setManualUnpaidSalary(null);
                                    }}
                                    className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-semibold"
                                />
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={unpaidSalaryAmount}
                                    onChange={(e) => setManualUnpaidSalary(Number(e.target.value))}
                                    className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono text-emerald-700 dark:text-emerald-400 font-bold"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Formula: (Gross / 30) * Unpaid Days</p>
                        </div>

                        {/* Leave Encashment */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Remaining Leave Days
                                </label>
                                <span className="text-xs text-emerald-600 font-bold font-mono">
                                    = {leaveEncashmentAmount.toLocaleString()}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="number"
                                    placeholder="Leave Days"
                                    value={remainingLeaveDays}
                                    onChange={(e) => {
                                        setRemainingLeaveDays(Number(e.target.value));
                                        setManualLeaveEncashment(null);
                                    }}
                                    className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-semibold"
                                />
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={leaveEncashmentAmount}
                                    onChange={(e) => setManualLeaveEncashment(Number(e.target.value))}
                                    className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono text-emerald-700 dark:text-emerald-400 font-bold"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Formula: (Gross / 30) * Leave Days</p>
                        </div>

                        {/* Gratuity */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Gratuity Entitlement ({serviceYears} yrs)
                                </label>
                                <span className="text-xs text-emerald-600 font-bold font-mono">
                                    = {gratuityAmount.toLocaleString()}
                                </span>
                            </div>
                            <input
                                type="number"
                                placeholder="Gratuity Amount"
                                value={gratuityAmount}
                                onChange={(e) => setManualGratuity(Number(e.target.value))}
                                className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono text-emerald-700 dark:text-emerald-400 font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                {serviceYears >= 5 ? 'Entitled (≥5 Yrs Service)' : 'Calculated 0 (< 5 Yrs Service - Editable)'}
                            </p>
                        </div>

                        {/* Other Allowances / Bonus */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Other Allowances / Bonus
                            </label>
                            <input
                                type="number"
                                value={otherEarnings}
                                onChange={(e) => setOtherEarnings(Number(e.target.value))}
                                className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono"
                            />
                        </div>

                        <div className="pt-3 border-t border-emerald-200/60 dark:border-emerald-900/60 flex justify-between items-center font-extrabold text-sm text-emerald-900 dark:text-emerald-200">
                            <span>Total Gross Earnings:</span>
                            <span className="font-mono text-base">{totalEarnings.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* DEDUCTIONS */}
                    <div className="space-y-4 bg-rose-50/40 dark:bg-rose-950/20 p-5 rounded-2xl border border-rose-100 dark:border-rose-900/40">
                        <h3 className="font-bold text-rose-800 dark:text-rose-300 text-sm flex items-center gap-2">
                            <ArrowDownRight className="w-4 h-4 text-rose-600" /> F&F Deductions & Recoveries
                        </h3>

                        {/* Notice Shortfall & Notice Recovery */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Notice Shortfall Days
                                </label>
                                <span className="text-xs text-rose-600 font-bold font-mono">
                                    = {noticeRecoveryAmount.toLocaleString()}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="number"
                                    placeholder="Shortfall Days"
                                    value={shortfallDays}
                                    onChange={(e) => {
                                        setShortfallDays(Number(e.target.value));
                                        setManualNoticeRecovery(null);
                                    }}
                                    className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-semibold"
                                />
                                <input
                                    type="number"
                                    placeholder="Recovery Amount"
                                    value={noticeRecoveryAmount}
                                    onChange={(e) => setManualNoticeRecovery(Number(e.target.value))}
                                    className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono text-rose-700 dark:text-rose-400 font-bold"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Formula: (Basic / 30) * Shortfall Days</p>
                        </div>

                        {/* Asset Deductions */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Asset Deductions (Unreturned / Damaged)
                            </label>
                            <input
                                type="number"
                                value={assetDeduction}
                                onChange={(e) => setAssetDeduction(Number(e.target.value))}
                                className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono text-rose-700 dark:text-rose-400"
                            />
                        </div>

                        {/* Loan/Advance Balance */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Loan / Salary Advance Outstanding
                            </label>
                            <input
                                type="number"
                                value={loanDeduction}
                                onChange={(e) => setLoanDeduction(Number(e.target.value))}
                                className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono text-rose-700 dark:text-rose-400"
                            />
                        </div>

                        {/* Other Deductions */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Other Deductions
                            </label>
                            <input
                                type="number"
                                value={otherDeduction}
                                onChange={(e) => setOtherDeduction(Number(e.target.value))}
                                className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono"
                            />
                        </div>

                        <div className="pt-3 border-t border-rose-200/60 dark:border-rose-900/60 flex justify-between items-center font-extrabold text-sm text-rose-900 dark:text-rose-200">
                            <span>Total Deductions:</span>
                            <span className="font-mono text-base">{totalDeductions.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Net Payable / Receivable Card */}
                <div className={`p-6 rounded-2xl border-2 flex items-center justify-between shadow-lg transition-all ${
                    netAmount >= 0 
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/20' 
                        : 'bg-rose-600 border-rose-500 text-white shadow-rose-500/20'
                }`}>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider opacity-90">
                            {netAmount >= 0 ? 'Net Payable to Employee' : 'Net Receivable from Employee (Shortfall)'}
                        </p>
                        <h4 className="text-3xl font-black font-mono mt-1">
                            {Math.abs(netAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h4>
                        <p className="text-[11px] opacity-80 mt-1">
                            Earnings ({totalEarnings.toLocaleString()}) - Deductions ({totalDeductions.toLocaleString()})
                        </p>
                    </div>
                    <div className="text-right">
                        <span className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl font-bold text-xs uppercase tracking-wider">
                            {netAmount >= 0 ? 'Payable' : 'Receivable'}
                        </span>
                    </div>
                </div>

                {/* Remarks */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Settlement Remarks / Notes
                    </label>
                    <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Add HR settlement remarks..."
                        rows={2}
                        className="w-full p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm"
                    />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-sm transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                        {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="w-4 h-4" />}
                        Process & Mark Resigned
                    </button>
                </div>
            </form>
        </Modal>
    );
};
