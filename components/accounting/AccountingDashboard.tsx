import React, { useState } from 'react';
import { JournalView } from './JournalView';
import { AccountingSettings } from './AccountingSettings';
import { InventoryReconciliation } from './InventoryReconciliation';
import { Calculator, LayoutDashboard, BookOpen, Settings as SettingsIcon, PieChart } from 'lucide-react';

import { JournalEntries } from './operations/JournalEntries';
import { Invoices } from './operations/Invoices';
import { Bills } from './operations/Bills';
import { Partners } from './masters/Partners';
import { Payments } from './operations/Payments';
import { BankStatements } from './operations/BankStatements';
import { FinancialReports } from './reporting/FinancialReports';
import { FinanceDashboard } from './FinanceDashboard';

export const AccountingDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'vendors' | 'payments' | 'journal' | 'banking' | 'reporting' | 'settings'>('overview');
    const [subTab, setSubTab] = useState('invoices'); // invoices, bills, partners

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
                    {['overview', 'customers', 'vendors', 'payments', 'journal', 'banking', 'reporting', 'settings'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab as any); setSubTab(tab === 'customers' ? 'invoices' : tab === 'vendors' ? 'bills' : ''); }}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold capitalize transition-all whitespace-nowrap ${activeTab === tab
                                ? 'bg-white dark:bg-zinc-700 text-violet-600 dark:text-violet-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {tab === 'overview' ? '📊 Overview' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sub-Header for Customers/Vendors */}
            {(activeTab === 'customers' || activeTab === 'vendors') && (
                <div className="px-6 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4">
                    {activeTab === 'customers' && (
                        <>
                            <button onClick={() => setSubTab('invoices')} className={`text-sm font-medium ${subTab === 'invoices' ? 'text-blue-600' : 'text-slate-500'}`}>Invoices</button>
                            <button onClick={() => setSubTab('partners')} className={`text-sm font-medium ${subTab === 'partners' ? 'text-blue-600' : 'text-slate-500'}`}>Customers</button>
                        </>
                    )}
                    {activeTab === 'vendors' && (
                        <>
                            <button onClick={() => setSubTab('bills')} className={`text-sm font-medium ${subTab === 'bills' ? 'text-blue-600' : 'text-slate-500'}`}>Bills</button>
                            <button onClick={() => setSubTab('partners')} className={`text-sm font-medium ${subTab === 'partners' ? 'text-blue-600' : 'text-slate-500'}`}>Vendors</button>
                        </>
                    )}
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'overview' && <FinanceDashboard />}

                {activeTab === 'customers' && subTab === 'invoices' && <Invoices />}
                {activeTab === 'customers' && subTab === 'partners' && <Partners type="Customer" />}

                {activeTab === 'vendors' && subTab === 'bills' && <Bills />}
                {activeTab === 'vendors' && subTab === 'partners' && <Partners type="Vendor" />}

                {activeTab === 'payments' && <Payments />}

                {activeTab === 'journal' && <JournalEntries />}
                {activeTab === 'banking' && <BankStatements />}
                {activeTab === 'reporting' && <FinancialReports />}
                {activeTab === 'settings' && <AccountingSettings />}
            </div>
        </div>
    );
};
