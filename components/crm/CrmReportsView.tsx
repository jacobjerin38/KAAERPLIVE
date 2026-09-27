import React, { useState } from 'react';
import { Users, FileCheck, BarChart3, Shield, Lock } from 'lucide-react';
import { EmployeeWiseCrmReport } from './reports/EmployeeWiseCrmReport';
import CustomersView from './CustomersView';
import { ReportsListView } from '../modules/reports/ReportsListView';
import { useAuth } from '../../contexts/AuthContext';
import { checkIsAdmin } from './services';

interface CrmReportsViewProps {
    companyId: string;
}

export const CrmReportsView: React.FC<CrmReportsViewProps> = ({ companyId }) => {
    const { userRole, hasPermission } = useAuth();
    const isAdmin = checkIsAdmin(userRole) || hasPermission('*') || hasPermission('crm.admin') || hasPermission('crm.manage_all');
    const [subTab, setSubTab] = useState<'EMPLOYEE_PERFORMANCE' | 'WORK_ORDERS' | 'CUSTOM_BUILDER'>('EMPLOYEE_PERFORMANCE');

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Top Navigation Bar */}
            <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-6 pt-4 pb-0 shrink-0 shadow-sm no-print">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                    CRM Reports & Analytics
                                </h1>
                                {isAdmin ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full">
                                        <Shield size={11} /> Manager / Admin Access
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full">
                                        <Lock size={11} /> Private Sales View
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {isAdmin 
                                    ? 'Enterprise performance matrix, call-off contracts, and business development intelligence'
                                    : 'Your personal sales performance, call-off work orders, and deals pipeline'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sub Tabs */}
                <div className="flex items-center gap-2 -mb-px overflow-x-auto">
                    <button
                        onClick={() => setSubTab('EMPLOYEE_PERFORMANCE')}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                            subTab === 'EMPLOYEE_PERFORMANCE'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Users size={15} />
                        <span>{isAdmin ? 'Employee Performance Matrix' : 'My Performance Matrix'}</span>
                    </button>

                    <button
                        onClick={() => setSubTab('WORK_ORDERS')}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                            subTab === 'WORK_ORDERS'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <FileCheck size={15} />
                        <span>Call-Off Work Orders & PO Register</span>
                    </button>

                    <button
                        onClick={() => setSubTab('CUSTOM_BUILDER')}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                            subTab === 'CUSTOM_BUILDER'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <BarChart3 size={15} />
                        <span>Custom Reports Builder</span>
                    </button>
                </div>
            </div>

            {/* Sub Tab View Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50 dark:bg-zinc-950">
                {subTab === 'EMPLOYEE_PERFORMANCE' && (
                    <EmployeeWiseCrmReport companyId={companyId} />
                )}

                {subTab === 'WORK_ORDERS' && (
                    <div className="h-full bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm overflow-hidden flex flex-col">
                        <CustomersView companyId={companyId} initialTab="WORK_ORDERS_REPORT" />
                    </div>
                )}

                {subTab === 'CUSTOM_BUILDER' && (
                    <div className="h-full bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
                        <ReportsListView moduleFilter="CRM" companyId={companyId} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CrmReportsView;
