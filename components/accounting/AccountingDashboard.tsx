import React, { useState } from 'react';
import { JournalView } from './JournalView';
import { AccountingSettings } from './AccountingSettings';
import { InventoryReconciliation } from './InventoryReconciliation';
import { Calculator, LayoutDashboard, BookOpen, Settings as SettingsIcon, PieChart } from 'lucide-react';

import { JournalEntries } from './operations/JournalEntries';
import { Invoices } from './operations/Invoices';
import { Bills } from './operations/Bills';
import { Partners } from './masters/Partners';
import { ChartOfAccounts } from './masters/ChartOfAccounts';
import { Taxes } from './masters/Taxes';
import { Journals } from './masters/Journals';
import { FiscalYears } from './masters/FiscalYears';
import { Payments } from './operations/Payments';
import { PaymentReminders } from './operations/PaymentReminders';
import { BankStatements } from './operations/BankStatements';
import { CashBook } from './operations/CashBook';
import { FinancialReports } from './reporting/FinancialReports';
import { GeneralLedger } from './reporting/GeneralLedger';
import { DailySalesReport } from './reporting/DailySalesReport';
import { ExpenseReport } from './reporting/ExpenseReport';
import { BudgetAnalysis } from './reporting/BudgetAnalysis';
import { FinanceDashboard } from './FinanceDashboard';
import { FixedAssets } from './operations/FixedAssets';
import { AccountingMasters } from '../modules/organisation/AccountingMasters';

export const AccountingDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'vendors' | 'payments' | 'journal' | 'banking' | 'assets' | 'reporting' | 'masters' | 'settings'>('overview');
    const [subTab, setSubTab] = useState('invoices');

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 no-print">
                <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Calculator className="w-5 h-5 md:w-6 h-6 text-violet-600" />
                    Accounting
                </h1>

                {/* Tabs */}
                <div className="flex flex-wrap gap-0.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg overflow-x-auto max-w-full">
                    {['overview', 'customers', 'vendors', 'payments', 'journal', 'banking', 'assets', 'reporting', 'masters', 'settings'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => { 
                                setActiveTab(tab as any); 
                                if (tab === 'customers') setSubTab('invoices');
                                else if (tab === 'vendors') setSubTab('bills');
                                else if (tab === 'banking') setSubTab('statements');
                                else if (tab === 'reporting') setSubTab('financial');
                                else if (tab === 'masters') setSubTab('all_masters');
                                else setSubTab('');
                            }}
                            className={`px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm font-bold capitalize transition-all whitespace-nowrap ${activeTab === tab
                                ? 'bg-white dark:bg-zinc-700 text-violet-600 dark:text-violet-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {tab === 'overview' ? '📊 Overview' : tab === 'assets' ? '🏢 Assets' : tab === 'masters' ? '📚 Masters' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sub-Header for Customers */}
            {activeTab === 'customers' && (
                <div className="px-6 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4 no-print">
                    <button onClick={() => setSubTab('invoices')} className={`text-sm font-medium ${subTab === 'invoices' ? 'text-blue-600' : 'text-slate-500'}`}>Invoices</button>
                    <button onClick={() => setSubTab('reminders')} className={`text-sm font-medium ${subTab === 'reminders' ? 'text-blue-600' : 'text-slate-500'}`}>Payment Reminders</button>
                    <button onClick={() => setSubTab('partners')} className={`text-sm font-medium ${subTab === 'partners' ? 'text-blue-600' : 'text-slate-500'}`}>Customers</button>
                </div>
            )}

            {/* Sub-Header for Vendors */}
            {activeTab === 'vendors' && (
                <div className="px-6 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4 no-print">
                    <button onClick={() => setSubTab('bills')} className={`text-sm font-medium ${subTab === 'bills' ? 'text-blue-600' : 'text-slate-500'}`}>Bills</button>
                    <button onClick={() => setSubTab('partners')} className={`text-sm font-medium ${subTab === 'partners' ? 'text-blue-600' : 'text-slate-500'}`}>Vendors</button>
                </div>
            )}

            {/* Sub-Header for Banking */}
            {activeTab === 'banking' && (
                <div className="px-6 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4 no-print">
                    <button onClick={() => setSubTab('statements')} className={`text-sm font-medium ${subTab === 'statements' ? 'text-blue-600' : 'text-slate-500'}`}>Bank Statements</button>
                    <button onClick={() => setSubTab('cashbook')} className={`text-sm font-medium ${subTab === 'cashbook' ? 'text-blue-600' : 'text-slate-500'}`}>Cash Book</button>
                </div>
            )}

            {/* Sub-Header for Reporting */}
            {activeTab === 'reporting' && (
                <div className="px-6 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4 overflow-x-auto no-print">
                    <button onClick={() => setSubTab('financial')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'financial' ? 'text-blue-600' : 'text-slate-500'}`}>Financial Reports</button>
                    <button onClick={() => setSubTab('ledger')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'ledger' ? 'text-blue-600' : 'text-slate-500'}`}>General Ledger</button>
                    <button onClick={() => setSubTab('daily_sales')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'daily_sales' ? 'text-blue-600' : 'text-slate-500'}`}>Daily Sales</button>
                    <button onClick={() => setSubTab('expenses')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'expenses' ? 'text-blue-600' : 'text-slate-500'}`}>Expense Report</button>
                    <button onClick={() => setSubTab('budget')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'budget' ? 'text-blue-600' : 'text-slate-500'}`}>Budget Analysis</button>
                </div>
            )}

            {/* Sub-Header for Masters */}
            {activeTab === 'masters' && (
                <div className="px-6 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4 overflow-x-auto no-print">
                    <button onClick={() => setSubTab('all_masters')} className={`text-sm font-bold whitespace-nowrap ${subTab === 'all_masters' ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 pb-0.5' : 'text-slate-500 hover:text-slate-700'}`}>📚 All Masters Hub (16 Masters)</button>
                    <button onClick={() => setSubTab('coa')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'coa' ? 'text-blue-600' : 'text-slate-500'}`}>Chart of Accounts</button>
                    <button onClick={() => setSubTab('all_partners')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'all_partners' ? 'text-blue-600' : 'text-slate-500'}`}>All Partners</button>
                    <button onClick={() => setSubTab('taxes')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'taxes' ? 'text-blue-600' : 'text-slate-500'}`}>Taxes</button>
                    <button onClick={() => setSubTab('journals')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'journals' ? 'text-blue-600' : 'text-slate-500'}`}>Journals</button>
                    <button onClick={() => setSubTab('fiscal')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'fiscal' ? 'text-blue-600' : 'text-slate-500'}`}>Fiscal Years</button>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {activeTab === 'overview' && <FinanceDashboard />}

                {activeTab === 'customers' && subTab === 'invoices' && <Invoices />}
                {activeTab === 'customers' && subTab === 'reminders' && <PaymentReminders />}
                {activeTab === 'customers' && subTab === 'partners' && <Partners type="Customer" />}

                {activeTab === 'vendors' && subTab === 'bills' && <Bills />}
                {activeTab === 'vendors' && subTab === 'partners' && <Partners type="Vendor" />}

                {activeTab === 'payments' && <Payments />}

                {activeTab === 'journal' && <JournalEntries />}
                
                {activeTab === 'banking' && subTab === 'statements' && <BankStatements />}
                {activeTab === 'banking' && subTab === 'cashbook' && <CashBook />}

                {activeTab === 'reporting' && subTab === 'financial' && <FinancialReports />}
                {activeTab === 'reporting' && subTab === 'ledger' && <GeneralLedger />}
                {activeTab === 'reporting' && subTab === 'daily_sales' && <DailySalesReport />}
                {activeTab === 'reporting' && subTab === 'expenses' && <ExpenseReport />}
                {activeTab === 'reporting' && subTab === 'budget' && <BudgetAnalysis />}

                {activeTab === 'masters' && subTab === 'all_masters' && <AccountingMasters />}
                {activeTab === 'masters' && subTab === 'coa' && <ChartOfAccounts />}
                {activeTab === 'masters' && subTab === 'all_partners' && <Partners />}
                {activeTab === 'masters' && subTab === 'taxes' && <Taxes />}
                {activeTab === 'masters' && subTab === 'journals' && <Journals />}
                {activeTab === 'masters' && subTab === 'fiscal' && <FiscalYears />}

                {activeTab === 'assets' && <FixedAssets />}

                {activeTab === 'settings' && <AccountingSettings />}
            </div>
        </div>
    );
};
