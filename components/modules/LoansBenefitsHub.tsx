import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Loader2, 
  DollarSign, 
  Plus, 
  Calculator, 
  Calendar, 
  FileText, 
  Heart, 
  CheckCircle, 
  XCircle, 
  Clock,
  ArrowRight,
  TrendingUp,
  Percent
} from 'lucide-react';

export const LoansBenefitsHub: React.FC = () => {
  const { user, currentCompanyId } = useAuth();
  const [activeTab, setActiveTab] = useState<'loans' | 'calculator' | 'benefits'>('loans');
  
  // Data State
  const [loans, setLoans] = useState<any[]>([]);
  const [benefits, setBenefits] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Action State
  const [showApplyLoan, setShowApplyLoan] = useState(false);
  const [showClaimBenefit, setShowClaimBenefit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Loan Form
  const [loanForm, setLoanForm] = useState({
    employee_id: '',
    loan_type: 'Personal',
    amount: '',
    repayment_months: '12',
    purpose: '',
    start_date: new Date().toISOString().split('T')[0]
  });

  // Amortization Calculator State
  const [calcInputs, setCalcInputs] = useState({
    amount: 10000,
    interest: 0,
    months: 12
  });

  // New Benefit Claim Form
  const [claimForm, setClaimForm] = useState({
    employee_id: '',
    benefit_id: '',
    claim_amount: '',
    description: '',
    receipt_url: ''
  });

  useEffect(() => {
    if (user && currentCompanyId) {
      loadData();
    }
  }, [user, currentCompanyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Employees for dropdowns
      const { data: empData } = await supabase
        .from('employees')
        .select('id, name')
        .eq('company_id', currentCompanyId)
        .order('name');
      if (empData) setEmployees(empData);

      // 2. Fetch Loans
      const { data: loanData } = await supabase
        .from('payroll_loans')
        .select('*, employees(name)')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false });
      if (loanData) setLoans(loanData);

      // 3. Fetch Benefits
      const { data: benefitData } = await supabase
        .from('hrms_benefits' as any)
        .select('*, employees(name)')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false });
      if (benefitData) setBenefits(benefitData);

      // 4. Fetch Benefit Claims
      const { data: claimData } = await supabase
        .from('hrms_benefit_claims' as any)
        .select('*, employees(name), hrms_benefits(benefit_type)')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false });
      if (claimData) setClaims(claimData);

    } catch (err) {
      console.error('Error loading loans/benefits data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.employee_id || !loanForm.amount || !loanForm.repayment_months) return;

    setSubmitting(true);
    try {
      const amt = parseFloat(loanForm.amount);
      const months = parseInt(loanForm.repayment_months);
      const emi = amt / months;

      const { error } = await supabase
        .from('payroll_loans')
        .insert({
          company_id: currentCompanyId,
          employee_id: loanForm.employee_id,
          loan_type: loanForm.loan_type,
          amount: amt,
          emi_amount: emi,
          balance: amt,
          status: 'Active',
          start_date: loanForm.start_date
        });

      if (error) throw error;
      
      setShowApplyLoan(false);
      loadData();
    } catch (err) {
      console.error('Error applying for loan:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimBenefit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimForm.employee_id || !claimForm.benefit_id || !claimForm.claim_amount) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('hrms_benefit_claims' as any)
        .insert({
          company_id: currentCompanyId,
          employee_id: claimForm.employee_id,
          benefit_id: claimForm.benefit_id,
          claim_amount: parseFloat(claimForm.claim_amount),
          description: claimForm.description,
          receipt_url: claimForm.receipt_url || null,
          status: 'PENDING'
        });

      if (error) throw error;

      setShowClaimBenefit(false);
      loadData();
    } catch (err) {
      console.error('Error claiming benefit:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate Amortization
  const emiCalculator = () => {
    const P = calcInputs.amount;
    const r = (calcInputs.interest / 100) / 12;
    const n = calcInputs.months;
    
    if (r === 0) {
      return {
        emi: P / n,
        totalPayable: P,
        totalInterest: 0
      };
    }
    
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPayable = emi * n;
    return {
      emi: emi,
      totalPayable: totalPayable,
      totalInterest: totalPayable - P
    };
  };

  const calcResults = emiCalculator();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-500" />
            Loans & Benefits Management
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 text-sm">
            Manage employee advances, loans, amortization schedules, and benefit claims.
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'loans' && (
            <button
              onClick={() => setShowApplyLoan(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Apply Advance/Loan
            </button>
          )}
          {activeTab === 'benefits' && (
            <button
              onClick={() => setShowClaimBenefit(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Claim Benefit
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('loans')}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'loans'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700'
          }`}
        >
          <DollarSign className="w-4 h-4" /> Active Loans
        </button>
        <button
          onClick={() => setActiveTab('calculator')}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'calculator'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700'
          }`}
        >
          <Calculator className="w-4 h-4" /> Amortization Calculator
        </button>
        <button
          onClick={() => setActiveTab('benefits')}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'benefits'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700'
          }`}
        >
          <Heart className="w-4 h-4" /> Benefits & Claims
        </button>
      </div>

      {/* Active Loans Tab */}
      {activeTab === 'loans' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
              <h3 className="font-semibold text-slate-700 dark:text-zinc-300 text-sm">Disbursed Loans & Advances</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-400">
                <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 uppercase text-xs">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Loan Type</th>
                    <th className="p-4">Amount (QAR)</th>
                    <th className="p-4">EMI (QAR)</th>
                    <th className="p-4">Balance Remaining</th>
                    <th className="p-4">Start Date</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                  {loans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">No active loans or advances found.</td>
                    </tr>
                  ) : (
                    loans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                        <td className="p-4 font-medium text-slate-900 dark:text-zinc-200">{loan.employees?.name}</td>
                        <td className="p-4">{loan.loan_type}</td>
                        <td className="p-4">{parseFloat(loan.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-4">{parseFloat(loan.emi_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-4 font-semibold text-emerald-600 dark:text-emerald-400">
                          {parseFloat(loan.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">{loan.start_date}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            loan.status === 'Active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {loan.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Amortization Calculator Tab */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-500" />
              Calculator Inputs
            </h3>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400 dark:text-zinc-500">Loan Amount (QAR)</label>
              <input
                type="number"
                value={calcInputs.amount}
                onChange={(e) => setCalcInputs({ ...calcInputs, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400 dark:text-zinc-500 flex justify-between">
                <span>Interest Rate (%)</span>
                <span className="font-semibold text-emerald-500">{calcInputs.interest}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={calcInputs.interest}
                onChange={(e) => setCalcInputs({ ...calcInputs, interest: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400 dark:text-zinc-500">Duration (Months)</label>
              <select
                value={calcInputs.months}
                onChange={(e) => setCalcInputs({ ...calcInputs, months: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
              >
                <option value="3">3 Months</option>
                <option value="6">6 Months</option>
                <option value="12">12 Months (1 Year)</option>
                <option value="24">24 Months (2 Years)</option>
                <option value="36">36 Months (3 Years)</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-2 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-xl p-6 flex flex-col justify-between shadow-md relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12">
              <Calculator className="w-72 h-72" />
            </div>

            <div className="space-y-2">
              <span className="text-emerald-100 uppercase tracking-widest text-xs font-bold">Estimated Monthly EMI</span>
              <div className="text-4xl md:text-5xl font-black">
                QAR {calcResults.emi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8 border-t border-white/20 pt-6">
              <div>
                <span className="text-emerald-100 text-xs block">Principal Amount</span>
                <span className="text-lg font-bold">QAR {calcInputs.amount.toLocaleString('en-US')}</span>
              </div>
              <div>
                <span className="text-emerald-100 text-xs block">Total Interest (Flat)</span>
                <span className="text-lg font-bold">QAR {calcResults.totalInterest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="col-span-2">
                <span className="text-emerald-100 text-xs block">Total Repayment Amount</span>
                <span className="text-2xl font-black text-emerald-200">
                  QAR {calcResults.totalPayable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Benefits & Claims Tab */}
      {activeTab === 'benefits' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Benefits Enrolled */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              Benefit Profiles
            </h3>
            {benefits.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 text-center text-slate-400 text-sm">
                No active benefit profiles enrolled.
              </div>
            ) : (
              benefits.map((benefit) => (
                <div key={benefit.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
                      {benefit.benefit_type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400">{benefit.tier_name}</span>
                  </div>
                  <h4 className="font-bold text-slate-850 dark:text-zinc-200 text-sm">{benefit.employees?.name}</h4>
                  <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-zinc-800">
                    <span>Contribution</span>
                    <span className="font-semibold text-slate-850 dark:text-zinc-300">QAR {benefit.company_contribution}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Claims List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-500" />
              Claims Ledger
            </h3>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-400">
                <thead className="bg-slate-50 dark:bg-zinc-850 text-slate-500 uppercase text-xs">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Benefit</th>
                    <th className="p-4">Claim Date</th>
                    <th className="p-4">Amount (QAR)</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                  {claims.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">No benefit claims logged.</td>
                    </tr>
                  ) : (
                    claims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                        <td className="p-4 font-semibold text-slate-850 dark:text-zinc-250">{claim.employees?.name}</td>
                        <td className="p-4">{claim.hrms_benefits?.benefit_type || 'General'}</td>
                        <td className="p-4">{claim.claim_date}</td>
                        <td className="p-4 font-bold">QAR {claim.claim_amount}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit ${
                            claim.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            claim.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' :
                            'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {claim.status === 'APPROVED' && <CheckCircle className="w-3.5 h-3.5" />}
                            {claim.status === 'REJECTED' && <XCircle className="w-3.5 h-3.5" />}
                            {claim.status === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                            {claim.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Apply Loan Modal */}
      {showApplyLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-zinc-200">New Loan / Advance Request</h3>
              <button onClick={() => setShowApplyLoan(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleApplyLoan} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Select Employee</label>
                <select
                  required
                  value={loanForm.employee_id}
                  onChange={(e) => setLoanForm({ ...loanForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                >
                  <option value="">Choose employee...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Loan Type</label>
                <select
                  value={loanForm.loan_type}
                  onChange={(e) => setLoanForm({ ...loanForm, loan_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                >
                  <option value="Personal">Personal Loan</option>
                  <option value="Salary Advance">Salary Advance</option>
                  <option value="Housing loan">Housing Loan</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Amount (QAR)</label>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 5000"
                    value={loanForm.amount}
                    onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Tenure (Months)</label>
                  <select
                    value={loanForm.repayment_months}
                    onChange={(e) => setLoanForm({ ...loanForm, repayment_months: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  >
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                    <option value="24">24 Months</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Purpose</label>
                <textarea
                  value={loanForm.purpose}
                  onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
                  placeholder="Reason for advance..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm h-20"
                />
              </div>

              <button
                disabled={submitting}
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-sm font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disburse Advance'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Claim Benefit Modal */}
      {showClaimBenefit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-zinc-200">Submit Benefit Claim</h3>
              <button onClick={() => setShowClaimBenefit(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleClaimBenefit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Select Employee</label>
                <select
                  required
                  value={claimForm.employee_id}
                  onChange={(e) => setClaimForm({ ...claimForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                >
                  <option value="">Choose employee...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Select Benefit Profile</label>
                <select
                  required
                  value={claimForm.benefit_id}
                  onChange={(e) => setClaimForm({ ...claimForm, benefit_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                >
                  <option value="">Choose benefit...</option>
                  {benefits
                    .filter(b => b.employee_id === claimForm.employee_id)
                    .map(b => (
                      <option key={b.id} value={b.id}>{b.benefit_type} ({b.tier_name})</option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Claim Amount (QAR)</label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 250"
                  value={claimForm.claim_amount}
                  onChange={(e) => setClaimForm({ ...claimForm, claim_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Receipt Attachment URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://supabase.storage/receipt.jpg"
                  value={claimForm.receipt_url}
                  onChange={(e) => setClaimForm({ ...claimForm, receipt_url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Description</label>
                <textarea
                  value={claimForm.description}
                  onChange={(e) => setClaimForm({ ...claimForm, description: e.target.value })}
                  placeholder="Details of medical consultation/expense..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm h-20"
                />
              </div>

              <button
                disabled={submitting}
                type="submit"
                className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition text-sm font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Claim'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
