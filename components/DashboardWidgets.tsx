import React from 'react';
import {
    Users, Building2, TrendingUp, TrendingDown, Calendar, Briefcase,
    ChevronRight, PieChart, Activity, UserPlus, Package, Boxes,
    AlertTriangle, DollarSign, Landmark, Clock, Bell
} from 'lucide-react';

interface WidgetProps {
    onClick: () => void;
    className?: string;
}

// ─── Card Wrapper ─────────────────────────────────────────────────────────────

const WidgetCard: React.FC<{
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    gradient?: string;
}> = ({ children, onClick, className = '', gradient }) => {
    return (
        <div
            onClick={onClick}
            className={`relative group overflow-hidden rounded-[2.5rem] p-6 cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/20 active:scale-[0.98] border border-white/50 dark:border-white/10 ${className}`}
        >
            {/* Dynamic Background */}
            <div className={`absolute inset-0 opacity-[0.08] dark:opacity-[0.15] transition-opacity group-hover:opacity-20 ${gradient || 'bg-slate-200 dark:bg-zinc-800'}`} />
            <div className="absolute inset-0 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl" />

            {/* Content */}
            <div className="relative z-10 h-full flex flex-col">
                {children}
            </div>

            {/* Interactive Glow Effect */}
            <div className="absolute top-0 -left-[100%] block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-40 group-hover:animate-shine dark:opacity-10" />
        </div>
    );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR',
        maximumFractionDigits: 0, notation: 'compact'
    }).format(n);

// ─── HRMS Widget ──────────────────────────────────────────────────────────────

export const HRMSWidget: React.FC<WidgetProps & {
    count?: number;
    attendancePercentage?: number;
    openLeaves?: number;
}> = ({ onClick, className, count = 0, attendancePercentage = 0, openLeaves = 0 }) => (
    <WidgetCard onClick={onClick} className={className} gradient="bg-gradient-to-br from-pink-400 to-rose-600">
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400">
                <Users className="w-6 h-6" />
            </div>
            {openLeaves > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3" />{openLeaves} pending
                </span>
            )}
        </div>
        <div className="mt-auto">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">Human Resources</h3>
            <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-light text-slate-700 dark:text-slate-200">{count}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400 mb-1">Active Employees</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-zinc-700/50 rounded-full h-1.5 overflow-hidden">
                <div className="bg-pink-500 h-full transition-all duration-1000" style={{ width: `${attendancePercentage}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">{attendancePercentage}% Attendance today</p>
        </div>
    </WidgetCard>
);

// ─── CRM Widget ───────────────────────────────────────────────────────────────

export const CRMWidget: React.FC<WidgetProps & { pipelineValue?: string; dealCount?: number }> = ({ onClick, className, pipelineValue = '₹0', dealCount = 0 }) => (
    <WidgetCard onClick={onClick} className={className} gradient="bg-gradient-to-br from-orange-400 to-amber-600">
        <div className="flex justify-between items-start mb-auto">
            <div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                <PieChart className="w-6 h-6" />
            </div>
            <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-900 bg-slate-200 dark:bg-zinc-700" />
                ))}
            </div>
        </div>
        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-4">CRM</h3>
        <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Pipeline</p>
                <p className="text-xl font-semibold text-slate-700 dark:text-slate-200">{pipelineValue}</p>
            </div>
            <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Deals</p>
                <p className="text-xl font-semibold text-slate-700 dark:text-slate-200">{dealCount}</p>
            </div>
        </div>
    </WidgetCard>
);


// ─── Organisation Widget ──────────────────────────────────────────────────────

export const OrganisationWidget: React.FC<WidgetProps> = ({ onClick, className }) => (
    <WidgetCard onClick={onClick} className={className} gradient="bg-gradient-to-br from-blue-400 to-indigo-600">
        <div className="p-3 w-fit rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4">
            <Building2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Organisation</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">Structure, policies, and company-wide settings.</p>
        <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium group-hover:gap-2 transition-all">
            <span>Manage</span>
            <ChevronRight className="w-4 h-4 ml-1" />
        </div>
    </WidgetCard>
);

// ─── ESSP Widget ──────────────────────────────────────────────────────────────

export const ESSPWidget: React.FC<WidgetProps> = ({ onClick, className }) => (
    <WidgetCard onClick={onClick} className={className} gradient="bg-gradient-to-br from-violet-400 to-purple-600">
        <div className="p-3 w-fit rounded-2xl bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 mb-4">
            <Briefcase className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Self Service</h3>
        <ul className="mt-3 space-y-2">
            {['Leave Request', 'Payslips', 'Profile'].map((item, i) => (
                <li key={i} className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mr-2" />
                    {item}
                </li>
            ))}
        </ul>
    </WidgetCard>
);

// ─── Upcoming / Generic Widget ─────────────────────────────────────────────────

export const UpcomingWidget: React.FC<WidgetProps & {
    title: string;
    icon: React.ElementType;
    gradient: string;
    subtitle: string;
}> = ({ onClick, className, title, icon: Icon, gradient, subtitle }) => (
    <WidgetCard onClick={onClick} className={className} gradient={gradient}>
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-white/50 dark:bg-white/10 backdrop-blur-md">
                <Icon className="w-6 h-6 text-slate-700 dark:text-white" />
            </div>
            <span className="px-2 py-1 rounded-full border border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Installed
            </span>
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{subtitle}</p>

        <div className="mt-auto flex items-center gap-2 text-xs font-bold text-slate-400 group-hover:text-indigo-500 transition-colors uppercase tracking-widest">
            <span>Open App</span>
            <ChevronRight className="w-3 h-3" />
        </div>
    </WidgetCard>
);

// ─── Accounting Widget (Live Data) ────────────────────────────────────────────

export const AccountingWidget: React.FC<WidgetProps & {
    receivables?: number;
    payables?: number;
    overdueCount?: number;
}> = ({ onClick, className, receivables = 0, payables = 0, overdueCount = 0 }) => (
    <WidgetCard onClick={onClick} className={className} gradient="bg-gradient-to-br from-emerald-400 to-teal-600">
        <div className="flex justify-between items-start mb-3">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <Activity className="w-6 h-6" />
            </div>
            {overdueCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-full">
                    <AlertTriangle className="w-3 h-3" />{overdueCount} overdue
                </span>
            )}
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Accounting</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Financials, Banking &amp; Audit</p>

        <div className="grid grid-cols-2 gap-2 mt-auto">
            <div className="bg-white/40 dark:bg-black/20 rounded-xl p-2">
                <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Receivables</p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{fmt(receivables)}</p>
            </div>
            <div className="bg-white/40 dark:bg-black/20 rounded-xl p-2">
                <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Payables</p>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{fmt(payables)}</p>
            </div>
        </div>
    </WidgetCard>
);

// ─── Inventory Widget (Live Data) ─────────────────────────────────────────────

export const InventoryWidget: React.FC<WidgetProps & {
    stockValue?: number;
    lowStockCount?: number;
}> = ({ onClick, className, stockValue = 0, lowStockCount = 0 }) => (
    <WidgetCard onClick={onClick} className={className} gradient="bg-gradient-to-br from-cyan-400 to-blue-600">
        <div className="flex justify-between items-start mb-2">
            <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">
                <Boxes className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1">
                {lowStockCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                        <AlertTriangle className="w-3 h-3" />{lowStockCount} low
                    </span>
                )}
                <div className="flex items-center gap-1 bg-white/30 dark:bg-black/20 px-2 py-1 rounded-full ml-1">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Live</span>
                </div>
            </div>
        </div>

        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Inventory</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Stock, Logistics &amp; Warehouse</p>

        <div className="mt-auto bg-white/30 dark:bg-black/20 rounded-xl p-2.5">
            <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-0.5">Total Stock Value</p>
            <p className="text-lg font-bold text-slate-800 dark:text-white">{fmt(stockValue)}</p>
        </div>
    </WidgetCard>
);

// ─── Pending Approvals Widget ─────────────────────────────────────────────────

export const PendingApprovalsWidget: React.FC<WidgetProps & {
    pendingLeaves?: number;
    pendingTransitions?: number;
}> = ({ onClick, className, pendingLeaves = 0, pendingTransitions = 0 }) => {
    const total = pendingLeaves + pendingTransitions;
    return (
        <WidgetCard onClick={onClick} className={className} gradient="bg-gradient-to-br from-indigo-400 to-blue-600">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    <Clock className="w-6 h-6" />
                </div>
                {total > 0 && (
                    <span className="px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                        {total} pending
                    </span>
                )}
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Approvals</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-3">Pending actions across modules</p>
            <div className="space-y-2 mt-auto">
                <div className="flex justify-between items-center text-sm bg-white/30 dark:bg-black/20 rounded-xl px-3 py-2">
                    <span className="text-slate-600 dark:text-slate-300 text-xs">Leave Requests</span>
                    <span className={`font-bold text-sm ${pendingLeaves > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{pendingLeaves}</span>
                </div>
                <div className="flex justify-between items-center text-sm bg-white/30 dark:bg-black/20 rounded-xl px-3 py-2">
                    <span className="text-slate-600 dark:text-slate-300 text-xs">Job Changes</span>
                    <span className={`font-bold text-sm ${pendingTransitions > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{pendingTransitions}</span>
                </div>
            </div>
        </WidgetCard>
    );
};

// ─── Manufacturing Widget ─────────────────────────────────────────────────────

export const ManufacturingWidget: React.FC<WidgetProps> = ({ onClick, className }) => (
    <WidgetCard onClick={onClick} className={className} gradient="bg-gradient-to-br from-amber-400 to-orange-600">
        <div className="p-3 w-fit rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mb-3">
            <Briefcase className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Manufacturing</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Production &amp; BOMs</p>

        <div className="mt-auto pt-3 flex items-center gap-2 text-xs font-bold text-slate-500 group-hover:text-amber-700 transition-colors uppercase tracking-widest">
            <span>Manage Orders</span>
            <ChevronRight className="w-3 h-3" />
        </div>
    </WidgetCard>
);

// ─── Procurement Widget ───────────────────────────────────────────────────────

export const ProcurementWidget: React.FC<WidgetProps> = ({ onClick, className }) => (
    <WidgetCard onClick={onClick} className={className} gradient="bg-gradient-to-br from-rose-400 to-pink-600">
        <div className="p-3 w-fit rounded-2xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 mb-3">
            <Briefcase className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Procurement &amp; Sales</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">PO &amp; SO Management</p>

        <div className="mt-auto pt-3 flex items-center gap-2 text-xs font-bold text-slate-500 group-hover:text-rose-700 transition-colors uppercase tracking-widest">
            <span>Manage Orders</span>
            <ChevronRight className="w-3 h-3" />
        </div>
    </WidgetCard>
);

// ─── Alerts Widget ────────────────────────────────────────────────────────────

export interface Alert {
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    time: string;
}

export const AlertsWidget: React.FC<WidgetProps & { alerts: Alert[] }> = ({ onClick, className, alerts = [] }) => (
    <WidgetCard onClick={onClick} className={className} gradient="bg-gradient-to-br from-slate-700 to-slate-900">
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-white/10 text-white">
                <Bell className="w-6 h-6" />
            </div>
            {alerts.length > 0 && (
                <span className="px-2 py-1 rounded-full bg-white/10 text-white text-xs font-bold">
                    {alerts.length} New
                </span>
            )}
        </div>
        <h3 className="text-lg font-bold text-white mb-2">System Alerts & Rules</h3>
        <p className="text-xs text-slate-300 mb-3">Automated threshold triggers</p>
        <div className="space-y-2 mt-auto overflow-y-auto max-h-[140px] pr-2 custom-scrollbar">
            {alerts.length === 0 ? (
                <p className="text-sm text-slate-400">No active alerts.</p>
            ) : (
                alerts.map(a => (
                    <div key={a.id} className="flex items-start gap-2 bg-white/5 rounded-lg p-2 hover:bg-white/10 transition-colors">
                        {a.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" /> :
                            a.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /> :
                                <Bell className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />}
                        <div>
                            <p className="text-xs text-slate-200 line-clamp-2">{a.message}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{a.time}</p>
                        </div>
                    </div>
                ))
            )}
        </div>
    </WidgetCard>
);
