import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { CareerTimelineEvent } from './types';
import { Briefcase, Award, ArrowUpRight, MapPin, UserCheck, LogOut } from 'lucide-react';

interface CareerTimelineProps {
    employeeId: string;
}

export const CareerTimeline: React.FC<CareerTimelineProps> = ({ employeeId }) => {
    const [events, setEvents] = useState<CareerTimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTimeline();
    }, [employeeId]);

    const fetchTimeline = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('employee_career_timeline')
            .select('*')
            .eq('employee_id', employeeId)
            .order('event_date', { ascending: false });

        if (!error && data) {
            setEvents(data);
        }
        setLoading(false);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'JOINED': return <UserCheck className="w-5 h-5 text-emerald-600" />;
            case 'PROMOTION': return <Award className="w-5 h-5 text-indigo-600" />;
            case 'TRANSFER': return <MapPin className="w-5 h-5 text-orange-600" />;
            case 'EXIT': return <LogOut className="w-5 h-5 text-rose-600" />;
            default: return <Briefcase className="w-5 h-5 text-slate-600" />;
        }
    };

    if (loading) return <div className="p-4 text-center text-slate-400">Loading timeline...</div>;

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Briefcase className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">No timeline events recorded yet.</p>
            </div>
        );
    }

    return (
        <div className="relative border-l-2 border-slate-100 dark:border-zinc-800 ml-4 space-y-8 py-2">
            {events.map((event) => (
                <div key={event.id} className="relative pl-8">
                    {/* Dot Icon */}
                    <div className="absolute -left-[11px] top-1 w-6 h-6 rounded-full bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700 flex items-center justify-center">
                        {getIcon(event.event_type)}
                    </div>

                    <span className="text-xs font-bold text-slate-400 mb-1 block">
                        {new Date(event.event_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>

                    <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                        {event.title}
                    </h4>

                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl inline-block">
                        {event.description}
                    </p>

                    {/* Metadata Diff */}
                    {event.metadata && (event.metadata.from || event.metadata.to) && (
                        <div className="text-xs space-y-1 mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                            {Object.keys(event.metadata.to || {}).map(key => {
                                // Skip IDs for cleaner display if names are available or just show key
                                if (key.includes('_id')) return null;
                                return (
                                    <div key={key} className="flex items-center gap-2">
                                        <span className="font-medium text-slate-500 capitalize">{key.replace('_', ' ')}:</span>
                                        <span className="line-through text-slate-400">{event.metadata.from?.[key]}</span>
                                        <ArrowUpRight className="w-3 h-3 text-slate-400" />
                                        <span className="font-bold text-indigo-700 dark:text-indigo-400">{event.metadata.to?.[key]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
