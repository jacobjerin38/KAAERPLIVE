import React, { useState } from 'react';
import { X, Plus, Trash2, Save, Calendar } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface AddPollModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const AddPollModal: React.FC<AddPollModalProps> = ({ onClose, onSuccess }) => {
    const { user, currentCompanyId } = useAuth();
    const [question, setQuestion] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [saving, setSaving] = useState(false);

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const addOption = () => {
        setOptions([...options, '']);
    };

    const removeOption = (index: number) => {
        if (options.length <= 2) return;
        const newOptions = options.filter((_, i) => i !== index);
        setOptions(newOptions);
    };

    const handleSave = async () => {
        if (!question.trim()) {
            alert('Please enter a question');
            return;
        }
        if (options.some(opt => !opt.trim())) {
            alert('Please fill in all options');
            return;
        }

        setSaving(true);
        try {
            // 1. Create Poll
            const { data: pollData, error: pollError } = await supabase
                .from('polls')
                .insert({
                    company_id: currentCompanyId,
                    question,
                    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
                    is_active: true,
                    created_by: user?.id
                })
                .select()
                .single();

            if (pollError) throw pollError;

            // 2. Create Options
            const optionsData = options.map(opt => ({
                poll_id: pollData.id,
                option_text: opt
            }));

            const { error: optionsError } = await supabase
                .from('poll_options')
                .insert(optionsData);

            if (optionsError) throw optionsError;

            alert('Poll created successfully!');
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error('Error creating poll:', error);
            alert('Failed to create poll: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-t-2xl">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Create New Poll</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Question</label>
                        <input
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            placeholder="e.g., Where should we have the team lunch?"
                            className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 outline-none font-medium dark:text-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Expiry Date (Optional)
                        </label>
                        <input
                            type="datetime-local"
                            value={expiresAt}
                            onChange={e => setExpiresAt(e.target.value)}
                            className="w-full p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 outline-none font-medium dark:text-white"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Options</label>
                            <button
                                onClick={addOption}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <Plus className="w-3 h-3" /> Add Option
                            </button>
                        </div>
                        <div className="space-y-3">
                            {options.map((opt, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        value={opt}
                                        onChange={e => handleOptionChange(idx, e.target.value)}
                                        placeholder={`Option ${idx + 1}`}
                                        className="flex-1 p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm dark:text-white"
                                    />
                                    {options.length > 2 && (
                                        <button
                                            onClick={() => removeOption(idx)}
                                            className="p-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-xl transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
                        Create Poll
                    </button>
                </div>
            </div>
        </div>
    );
};
