import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
    Plus, FileText, Download, Trash2, Search, Play, Clock,
    BarChart3, Loader2, ChevronRight, Columns
} from 'lucide-react';
import { ReportBuilder } from './ReportBuilder';
import { LeaveAnalyticsReport } from '../hrms/reports/LeaveAnalyticsReport';
import { SalaryStatementReport } from '../hrms/reports/SalaryStatementReport';
import { BonusGratuityReport } from '../hrms/reports/BonusGratuityReport';

interface ReportsListViewProps {
    moduleFilter?: string;   // e.g. "CRM" — show only CRM modules
    companyId?: string;       // from parent module
}

export const ReportsListView: React.FC<ReportsListViewProps> = ({ moduleFilter, companyId: propCompanyId }) => {
    const { user, currentCompanyId } = useAuth();
    const companyId = propCompanyId || currentCompanyId;

    const [view, setView] = useState<'LIST' | 'BUILDER' | 'RUN' | 'STANDARD_RUN'>('LIST');
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editReport, setEditReport] = useState<any>(null);
    const [selectedStandardReport, setSelectedStandardReport] = useState<string | null>(null);
    const [reportCategory, setReportCategory] = useState<'CUSTOM' | 'STANDARD'>('CUSTOM');

    useEffect(() => {
        if (view === 'LIST') fetchReports();
    }, [view, companyId]);

    const fetchReports = async () => {
        if (!companyId) return;
        setLoading(true);
        let query = supabase
            .from('report_definitions')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        const { data } = await query;
        setReports(data || []);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this report definition?')) return;
        await supabase.from('report_definitions').delete().eq('id', id);
        fetchReports();
    };

    const handleRun = (report: any) => {
        setEditReport(report);
        setView('RUN');
    };

    const handleEdit = (report: any) => {
        setEditReport(report);
        setView('BUILDER');
    };

    const handleNew = () => {
        setEditReport(null);
        setView('BUILDER');
    };

    // Filter reports by search + module
    const filteredReports = reports.filter(r => {
        const matchesSearch = !searchQuery || r.name?.toLowerCase().includes(searchQuery.toLowerCase()) || r.module?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesModule = !moduleFilter || r.module?.startsWith(moduleFilter);
        return matchesSearch && matchesModule;
    });

    const moduleLabel = (m: string) => m?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || '';

    // ── Builder / Run view ──
    if (view === 'BUILDER' || view === 'RUN' || view === 'STANDARD_RUN') {
        if (view === 'STANDARD_RUN') {
            return (
                <div className="h-full flex flex-col p-8 overflow-y-auto">
                    <button onClick={() => { setView('LIST'); setSelectedStandardReport(null); }}
                        className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm transition-colors w-fit">
                        <Plus className="w-4 h-4 rotate-45" /> Back to Reports
                    </button>
                    {selectedStandardReport === 'LEAVE_ANALYTICS' && <LeaveAnalyticsReport />}
                    {selectedStandardReport === 'SALARY_STATEMENT' && <SalaryStatementReport />}
                    {selectedStandardReport === 'BONUS_GRATUITY' && <BonusGratuityReport />}
                </div>
            );
        }

        return (
            <ReportBuilder
                onBack={() => { setView('LIST'); setEditReport(null); }}
                companyId={companyId || undefined}
                initialModule={editReport?.module}
                editReport={view === 'RUN' || view === 'BUILDER' ? editReport : undefined}
            />
        );
    }

    const standardReports = [
        { id: 'LEAVE_ANALYTICS', name: 'Leave Analytics', desc: 'Visual trends and departmental distribution', icon: BarChart3, color: 'emerald' },
        { id: 'SALARY_STATEMENT', name: 'Monthly Salary Statement', desc: 'Detailed earnings and deductions breakdown', icon: DollarSign, color: 'indigo' },
        { id: 'BONUS_GRATUITY', name: 'Bonus & Gratuity Valuation', desc: 'Tenure-based liability and accruals', icon: FileText, color: 'amber' },
    ];

    // ── List view ──
    return (
        <div className="h-full flex flex-col p-8 animate-page-enter">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 shrink-0">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Reports & Analytics</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                        Build custom reports from any data source
                    </p>
                </div>
                <button onClick={handleNew}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
                    <Plus className="w-4 h-4 text-white" /> New Report
                </button>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-100 dark:border-zinc-800 shrink-0">
                <button 
                    onClick={() => setReportCategory('CUSTOM')}
                    className={`pb-4 text-sm font-bold tracking-tight transition-all relative ${reportCategory === 'CUSTOM' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Custom Reports
                    {reportCategory === 'CUSTOM' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
                </button>
                <button 
                    onClick={() => setReportCategory('STANDARD')}
                    className={`pb-4 text-sm font-bold tracking-tight transition-all relative ${reportCategory === 'STANDARD' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Standard HRMS Reports
                    {reportCategory === 'STANDARD' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
                </button>
            </div>

            {/* Search */}
            {reportCategory === 'CUSTOM' && (
                <div className="relative mb-6 shrink-0">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search reports by name or module…"
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {reportCategory === 'STANDARD' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {standardReports.map(report => (
                            <div key={report.id}
                                onClick={() => { setSelectedStandardReport(report.id); setView('STANDARD_RUN'); }}
                                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 hover:shadow-2xl hover:shadow-indigo-500/10 dark:hover:shadow-black/30 transition-all group flex flex-col cursor-pointer hover:-translate-y-1 active:scale-95">
                                <div className={`w-14 h-14 bg-${report.color}-50 dark:bg-${report.color}-900/20 rounded-2xl flex items-center justify-center text-${report.color}-600 dark:text-${report.color}-400 mb-6 group-hover:scale-110 transition-transform`}>
                                    <report.icon className="w-7 h-7" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 group-hover:text-indigo-600 transition-colors">
                                    {report.name}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6">{report.desc}</p>
                                <div className="mt-auto flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                                    View Report <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredReports.map(report => (
                            <div key={report.id}
                                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/30 transition-all group flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600 dark:text-indigo-400">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <button onClick={() => handleDelete(report.id)}
                                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 group-hover:text-indigo-600 transition-colors truncate">
                                    {report.name}
                                </h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{moduleLabel(report.module)}</p>

                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono mb-5">
                                    <span className="flex items-center gap-1"><Columns className="w-3 h-3" /> {report.config?.columns?.length || 0} cols</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(report.created_at).toLocaleDateString()}</span>
                                </div>

                                <div className="flex gap-2 mt-auto">
                                    <button onClick={() => handleRun(report)}
                                        className="flex-1 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all flex justify-center items-center gap-2">
                                        <Play className="w-4 h-4" /> Run
                                    </button>
                                    <button onClick={() => handleEdit(report)}
                                        className="py-2.5 px-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-zinc-700 transition-all">
                                        Edit
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Empty State */}
                        {filteredReports.length === 0 && !loading && (
                            <div className="col-span-full py-20 text-center">
                                <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <BarChart3 className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
                                    {searchQuery ? 'No matching reports' : 'No reports yet'}
                                </h3>
                                <p className="text-slate-400 text-sm mt-1">
                                    {searchQuery ? 'Try adjusting your search query.' : 'Create your first custom report to get started.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
