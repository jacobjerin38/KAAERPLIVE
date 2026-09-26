import React from 'react';
import { Calendar } from 'lucide-react';
import { formatLocalDate } from '../../../lib/dateFormat';

export type PeriodPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'august_2026' | 'all' | 'custom';

export interface PeriodPresetOption {
    id: PeriodPreset;
    label: string;
}

export const PERIOD_PRESETS: PeriodPresetOption[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'august_2026', label: 'August 2026' },
    { id: 'all', label: 'All Dates' }
];

export const getDatesForPreset = (preset: PeriodPreset): { startDate: string; endDate: string } => {
    const today = new Date();

    switch (preset) {
        case 'today': {
            const todayStr = formatLocalDate(today);
            return { startDate: todayStr, endDate: todayStr };
        }
        case 'yesterday': {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            const yStr = formatLocalDate(y);
            return { startDate: yStr, endDate: yStr };
        }
        case 'this_week': {
            const d = new Date(today);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const firstDay = new Date(d.setDate(diff));
            const lastDay = new Date(firstDay);
            lastDay.setDate(firstDay.getDate() + 6);
            return { startDate: formatLocalDate(firstDay), endDate: formatLocalDate(lastDay) };
        }
        case 'this_month': {
            const start = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1));
            const end = formatLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
            return { startDate: start, endDate: end };
        }
        case 'last_month': {
            const start = formatLocalDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
            const end = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 0));
            return { startDate: start, endDate: end };
        }
        case 'august_2026': {
            return { startDate: '2026-08-01', endDate: '2026-08-31' };
        }
        case 'all': {
            return { startDate: '2020-01-01', endDate: '2030-12-31' };
        }
        case 'custom':
        default: {
            const start = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1));
            const end = formatLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
            return { startDate: start, endDate: end };
        }
    }
};

export interface PeriodFilterProps {
    preset: PeriodPreset;
    startDate: string;
    endDate: string;
    onPeriodChange: (startDate: string, endDate: string, preset: PeriodPreset) => void;
    showDateInputs?: boolean;
    className?: string;
    compact?: boolean;
}

export const PeriodFilter: React.FC<PeriodFilterProps> = ({
    preset,
    startDate,
    endDate,
    onPeriodChange,
    showDateInputs = false,
    className = '',
    compact = false
}) => {
    const handlePresetClick = (newPreset: PeriodPreset) => {
        const { startDate: newStart, endDate: newEnd } = getDatesForPreset(newPreset);
        onPeriodChange(newStart, newEnd, newPreset);
    };

    const handleStartDateChange = (val: string) => {
        onPeriodChange(val, endDate, 'custom');
    };

    const handleEndDateChange = (val: string) => {
        onPeriodChange(startDate, val, 'custom');
    };

    return (
        <div className={`space-y-2.5 ${className}`}>
            {/* Presets Row */}
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Period:
                </span>
                {PERIOD_PRESETS.map(p => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePresetClick(p.id)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                            preset === p.id
                                ? 'bg-violet-600 text-white shadow-sm'
                                : 'bg-slate-50 dark:bg-zinc-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Optional Date Inputs */}
            {showDateInputs && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium uppercase text-[10px]">From:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => handleStartDateChange(e.target.value)}
                            className="px-2 py-1 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                    </div>
                    <span className="text-slate-400 text-xs">→</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium uppercase text-[10px]">To:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => handleEndDateChange(e.target.value)}
                            className="px-2 py-1 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
