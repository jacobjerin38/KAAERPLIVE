import React, { useState } from 'react';
import {
    Calendar, Clock, AlertTriangle, FileSpreadsheet,
    FileText, SlidersHorizontal, BarChart3
} from 'lucide-react';
import { MonthlyAttendanceReport } from './MonthlyAttendanceReport';
import { OvertimeReport } from './OvertimeReport';
import { LateEarlyReport } from './LateEarlyReport';
import { ReportBuilder } from '../../reports/ReportBuilder';
import { useAuth } from '../../../../contexts/AuthContext';

export const AttendanceReportsSuite: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [activeReportTab, setActiveReportTab] = useState<'MONTHLY' | 'OVERTIME' | 'LATE_EARLY' | 'CUSTOM'>('MONTHLY');

    const reportTabs = [
        { id: 'MONTHLY', label: 'Monthly Attendance', desc: 'Working days, leaves, shifts & punch audit', icon: Calendar, color: 'cyan' },
        { id: 'OVERTIME', label: 'Overtime Statement', desc: 'Rules, multipliers, daily caps & approvals', icon: Clock, color: 'amber' },
        { id: 'LATE_EARLY', label: 'Late In / Early Out', desc: 'Punctuality analysis & grace comparisons', icon: AlertTriangle, color: 'rose' },
        { id: 'CUSTOM', label: 'Custom Builder', desc: 'Create custom filtered attendance exports', icon: SlidersHorizontal, color: 'indigo' },
    ];

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            {/* Top Navigation Tabs */}
            <div className="flex flex-wrap bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-200/60 dark:border-zinc-800 shadow-sm w-fit mb-6 gap-1 shrink-0">
                {reportTabs.map(tab => {
                    const isActive = activeReportTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveReportTab(tab.id as any)}
                            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                                isActive
                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Content View */}
            <div className="flex-1">
                {activeReportTab === 'MONTHLY' && <MonthlyAttendanceReport />}
                {activeReportTab === 'OVERTIME' && <OvertimeReport />}
                {activeReportTab === 'LATE_EARLY' && <LateEarlyReport />}
                {activeReportTab === 'CUSTOM' && (
                    <ReportBuilder
                        onBack={() => setActiveReportTab('MONTHLY')}
                        companyId={currentCompanyId || undefined}
                        initialModule="ATTENDANCE"
                        moduleFilter="ATTENDANCE"
                    />
                )}
            </div>
        </div>
    );
};
