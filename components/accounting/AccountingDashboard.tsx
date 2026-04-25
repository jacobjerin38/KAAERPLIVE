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

export const AccountingDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'vendors' | 'payments' | 'journal' | 'banking' | 'reporting' | 'masters' | 'settings'>('overview');
    const [subTab, setSubTab] = useState('invoices');

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-center">
                <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Calculator className="w-6 h-6 text-violet-600" />
                    Accounting
                </h1>

                {/* Tabs */}
                <div className="flex flex-wrap gap-0.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg overflow-x-auto">
                    {['overview', 'customers', 'vendors', 'payments', 'journal', 'banking', 'reporting', 'masters', 'settings'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => { 
                                setActiveTab(tab as any); 
                                if (tab === 'customers') setSubTab('invoices');
                                else if (tab === 'vendors') setSubTab('bills');
                                else if (tab === 'banking') setSubTab('statements');
                                else if (tab === 'reporting') setSubTab('financial');
                                else if (tab === 'masters') setSubTab('coa');
                                else setSubTab('');
                            }}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold capitalize transition-all whitespace-nowrap ${activeTab === tab
                                ? 'bg-white dark:bg-zinc-700 text-violet-600 dark:text-violet-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {tab === 'overview' ? '📊 Overview' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sub-Header for Customers */}
            {activeTab === 'customers' && (
                <div className="px-6 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4">
                    <button onClick={() => setSubTab('invoices')} className={`text-sm font-medium ${subTab === 'invoices' ? 'text-blue-600' : 'text-slate-500'}`}>Invoices</button>
                    <button onClick={() => setSubTab('reminders')} className={`text-sm font-medium ${subTab === 'reminders' ? 'text-blue-600' : 'text-slate-500'}`}>Payment Reminders</button>
                    <button onClick={() => setSubTab('partners')} className={`text-sm font-medium ${subTab === 'partners' ? 'text-blue-600' : 'text-slate-500'}`}>Customers</button>
                </div>
            )}

            {/* Sub-Header for Vendors */}
            {activeTab === 'vendors' && (
                <div className="px-6 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4">
                    <button onClick={() => setSubTab('bills')} className={`text-sm font-medium ${subTab === 'bills' ? 'text-blue-600' : 'text-slate-500'}`}>Bills</button>
                    <button onClick={() => setSubTab('partners')} className={`text-sm font-medium ${subTab === 'partners' ? 'text-blue-600' : 'text-slate-500'}`}>Vendors</button>
                </div>
            )}

            {/* Sub-Header for Banking */}
            {activeTab === 'banking' && (
                <div className="px-6 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4">
                    <button onClick={() => setSubTab('statements')} className={`text-sm font-medium ${subTab === 'statements' ? 'text-blue-600' : 'text-slate-500'}`}>Bank Statements</button>
                    <button onClick={() => setSubTab('cashbook')} className={`text-sm font-medium ${subTab === 'cashbook' ? 'text-blue-600' : 'text-slate-500'}`}>Cash Book</button>
                </div>
            )}

            {/* Sub-Header for Reporting */}
            {activeTab === 'reporting' && (
                <div className="px-6 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4 overflow-x-auto">
                    <button onClick={() => setSubTab('financial')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'financial' ? 'text-blue-600' : 'text-slate-500'}`}>Financial Reports</button>
                    <button onClick={() => setSubTab('ledger')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'ledger' ? 'text-blue-600' : 'text-slate-500'}`}>General Ledger</button>
                    <button onClick={() => setSubTab('daily_sales')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'daily_sales' ? 'text-blue-600' : 'text-slate-500'}`}>Daily Sales</button>
                    <button onClick={() => setSubTab('expenses')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'expenses' ? 'text-blue-600' : 'text-slate-500'}`}>Expense Report</button>
                    <button onClick={() => setSubTab('budget')} className={`text-sm font-medium whitespace-nowrap ${subTab === 'budget' ? 'text-blue-600' : 'text-slate-500'}`}>Budget Analysis</button>
                </div>
            )}

            {/* Sub-Header for Masters */}
            {activeTab === 'masters' && (
                <div className="px-6 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4">
                    <button onClick={() => setSubTab('coa')} className={`text-sm font-medium ${subTab === 'coa' ? 'text-blue-600' : 'text-slate-500'}`}>Chart of Accounts</button>
                    <button onClick={() => setSubTab('all_partners')} className={`text-sm font-medium ${subTab === 'all_partners' ? 'text-blue-600' : 'text-slate-500'}`}>All Partners</button>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
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

                {activeTab === 'masters' && subTab === 'coa' && <ChartOfAccounts />}
                {activeTab === 'masters' && subTab === 'all_partners' && <Partners />}

                {activeTab === 'settings' && <AccountingSettings />}
            </div>
        </div>
    );
};
