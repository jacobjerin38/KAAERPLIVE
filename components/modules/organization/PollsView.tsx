import React, { useState, useEffect } from 'react';
import { Plus, BarChart2, Calendar, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { AddPollModal } from './AddPollModal';

interface Poll {
    id: string;
    question: string;
    is_active: boolean;
    expires_at: string | null;
    created_at: string;
    poll_options: {
        id: string;
        option_text: string;
        vote_count: number;
    }[];
}

export const PollsView: React.FC = () => {
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    useEffect(() => {
        fetchPolls();
    }, []);

    const fetchPolls = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('polls')
            .select(`
                *,
                poll_options (
                    id,
                    option_text,
                    vote_count
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching polls:', error);
        } else {
            setPolls(data || []);
        }
        setLoading(false);
    };

    const toggleStatus = async (poll: Poll) => {
        const { error } = await supabase
            .from('polls')
            .update({ is_active: !poll.is_active })
            .eq('id', poll.id);

        if (!error) fetchPolls();
    };

    const deletePoll = async (id: string) => {
        if (!confirm('Are you sure you want to delete this poll? This cannot be undone.')) return;

        const { error } = await supabase
            .from('polls')
            .delete()
            .eq('id', id);

        if (!error) fetchPolls();
    };

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <BarChart2 className="w-8 h-8 text-blue-500" /> Polls
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Manage polls and view results.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Create Poll
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading polls...</div>
            ) : polls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white/50 dark:bg-zinc-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
                    <BarChart2 className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No polls created yet</p>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="mt-4 text-blue-600 hover:underline font-bold"
                    >
                        Create your first poll
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {polls.map(poll => {
                        const totalVotes = poll.poll_options.reduce((acc, curr) => acc + curr.vote_count, 0);
                        return (
                            <div key={poll.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-white line-clamp-2">{poll.question}</h3>
                                    <div className={`px-2 py-1 rounded-lg text-xs font-bold ${poll.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                        {poll.is_active ? 'Active' : 'Closed'}
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    {poll.poll_options.map(opt => {
                                        const percentage = totalVotes > 0 ? Math.round((opt.vote_count / totalVotes) * 100) : 0;
                                        return (
                                            <div key={opt.id} className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-700 dark:text-slate-300">{opt.option_text}</span>
                                                    <span className="font-bold text-slate-900 dark:text-white">{percentage}% ({opt.vote_count})</span>
                                                </div>
                                                <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percentage}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(poll.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => toggleStatus(poll)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                            title={poll.is_active ? "Close Poll" : "Re-open Poll"}
                                        >
                                            {poll.is_active ? <XCircle className="w-4 h-4 text-amber-500" /> : <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                        </button>
                                        <button
                                            onClick={() => deletePoll(poll.id)}
                                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-500"
                                            title="Delete Poll"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isAddModalOpen && (
                <AddPollModal
                    onClose={() => setIsAddModalOpen(false)}
                    onSuccess={fetchPolls}
                />
            )}
        </div>
    );
};
