import React, { useState, useEffect } from 'react';
import { Plus, ClipboardList, Trash2, CheckCircle, XCircle, Edit, Calendar } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface Survey {
    id: string;
    title: string;
    description: string;
    expiration_date: string;
    is_active: boolean;
    created_at: string;
}

export const SurveysView: React.FC = () => {
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
    const { currentCompanyId } = useAuth();

    useEffect(() => {
        if (currentCompanyId) {
            fetchSurveys();
        }
    }, [currentCompanyId]);

    const fetchSurveys = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('surveys')
            .select('*')
            .eq('company_id', currentCompanyId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching surveys:', error);
        } else {
            setSurveys(data || []);
        }
        setLoading(false);
    };

    const toggleStatus = async (survey: Survey) => {
        const { error } = await supabase
            .from('surveys')
            .update({ is_active: !survey.is_active })
            .eq('id', survey.id);

        if (!error) fetchSurveys();
    };

    const deleteSurvey = async (id: string) => {
        if (!confirm('Are you sure you want to delete this survey? This cannot be undone.')) return;

        const { error } = await supabase
            .from('surveys')
            .delete()
            .eq('id', id);

        if (!error) fetchSurveys();
        else alert('Error deleting survey. It might have responses.');
    };

    const handleEdit = (survey: Survey) => {
        setEditingSurvey(survey);
        setIsModalOpen(true);
    };

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <ClipboardList className="w-8 h-8 text-indigo-500" /> Employee Surveys
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Create and manage organization-wide surveys.</p>
                </div>
                <button
                    onClick={() => { setEditingSurvey(null); setIsModalOpen(true); }}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Create Survey
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading surveys...</div>
            ) : surveys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white/50 dark:bg-zinc-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
                    <ClipboardList className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No surveys created yet</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {surveys.map(survey => (
                        <div key={survey.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow relative">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white">{survey.title}</h3>
                                <div className={`px-2 py-1 rounded-lg text-xs font-bold ${survey.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                    {survey.is_active ? 'Active' : 'Closed'}
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 line-clamp-2 min-h-[40px]">
                                {survey.description}
                            </p>

                            <div className="flex flex-wrap gap-2 text-xs text-slate-500 font-bold mb-4">
                                <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-md flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Expires: {new Date(survey.expiration_date).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800">
                                <div className="text-xs text-slate-400">
                                    Created: {new Date(survey.created_at).toLocaleDateString()}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(survey)}
                                        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors text-indigo-500"
                                        title="Edit Survey"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => toggleStatus(survey)}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                        title={survey.is_active ? "Close Survey" : "Re-open Survey"}
                                    >
                                        {survey.is_active ? <XCircle className="w-4 h-4 text-amber-500" /> : <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                    </button>
                                    <button
                                        onClick={() => deleteSurvey(survey.id)}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-500"
                                        title="Delete Survey"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <SurveyFormModal
                    existingSurvey={editingSurvey}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => { setIsModalOpen(false); fetchSurveys(); }}
                />
            )}
        </div>
    );
};

// Internal Modal Component for managing Survey + Questions
const SurveyFormModal = ({ existingSurvey, onClose, onSuccess }: { existingSurvey: Survey | null, onClose: () => void, onSuccess: () => void }) => {
    const { currentCompanyId, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [title, setTitle] = useState(existingSurvey?.title || '');
    const [description, setDescription] = useState(existingSurvey?.description || '');
    const [expirationDate, setExpirationDate] = useState(existingSurvey?.expiration_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [isActive, setIsActive] = useState(existingSurvey ? existingSurvey.is_active : true);

    // Questions State
    const [questions, setQuestions] = useState<any[]>([]);

    useEffect(() => {
        if (existingSurvey) {
            fetchQuestions();
        } else {
            // Default empty question
            setQuestions([{ id: 'temp_' + Date.now(), question_text: '', question_type: 'Text', options: [], order_num: 1 }]);
            setLoading(false);
        }
    }, [existingSurvey]);

    const fetchQuestions = async () => {
        const { data, error } = await supabase
            .from('survey_questions')
            .select('*')
            .eq('survey_id', existingSurvey!.id)
            .order('order_num', { ascending: true });

        if (!error && data) {
            setQuestions(data);
        }
        setLoading(false);
    };

    const handleAddQuestion = () => {
        const newOrder = questions.length + 1;
        setQuestions([...questions, { id: 'temp_' + Date.now(), question_text: '', question_type: 'Text', options: [], order_num: newOrder }]);
    };

    const handleQuestionChange = (id: string, field: string, value: any) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
    };

    const handleRemoveQuestion = (id: string) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (questions.length === 0) return alert("Please add at least one question.");
        if (questions.some(q => !q.question_text.trim())) return alert("All questions must have text.");

        setSaving(true);
        let surveyId = existingSurvey?.id;

        try {
            // 1. Save Survey Header
            const surveyPayload = {
                company_id: currentCompanyId,
                title,
                description,
                expiration_date: expirationDate,
                is_active: isActive,
                created_by: user?.id
            };

            if (existingSurvey) {
                const { error } = await supabase.from('surveys').update(surveyPayload).eq('id', existingSurvey.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('surveys').insert([surveyPayload]).select().single();
                if (error) throw error;
                surveyId = data.id;
            }

            // 2. Save Questions (for simplicity, delete all old questions and re-insert if editing)
            // Note: This drops responses associated with questions in a real prod env! 
            // Better approach for production: handle inserts, updates, deletes manually.
            if (existingSurvey) {
                await supabase.from('survey_questions').delete().eq('survey_id', surveyId);
            }

            const questionsPayload = questions.map((q, idx) => ({
                survey_id: surveyId,
                question_text: q.question_text,
                question_type: q.question_type,
                options: q.options,
                order_num: idx + 1
            }));

            const { error: qError } = await supabase.from('survey_questions').insert(questionsPayload);
            if (qError) throw qError;

            onSuccess();
        } catch (err: any) {
            alert('Error saving survey: ' + err.message);
        }
        setSaving(false);
    };

    if (loading) return null; // Or a spinner

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-[2rem] p-8 shadow-2xl animate-scale-up relative flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {existingSurvey ? 'Edit Survey' : 'New Survey'}
                    </h2>
                    <button onClick={onClose} className="p-2 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full transition-colors">
                        <XCircle className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-6">
                    {/* Survey Details Section */}
                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 space-y-4">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-2">1. Survey Details</h3>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Title</label>
                            <input required className="w-full p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white font-bold" placeholder="e.g. Q3 Employee Satisfaction" value={title} onChange={e => setTitle(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Expiration Date</label>
                                <input type="date" required className="w-full p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} />
                            </div>
                            <div className="flex flex-col justify-end">
                                <label className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 cursor-pointer">
                                    <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                                    <span className="font-bold text-slate-700 dark:text-slate-300">Set as Active</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                            <textarea required className="w-full p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white resize-none h-20" placeholder="Please fill this out honestly..." value={description} onChange={e => setDescription(e.target.value)} />
                        </div>
                    </div>

                    {/* Questions Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 dark:text-white">2. Questions</h3>
                            <button type="button" onClick={handleAddQuestion} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                                <Plus className="w-4 h-4" /> Add Question
                            </button>
                        </div>

                        {questions.map((q, index) => (
                            <div key={q.id} className="bg-white dark:bg-zinc-800/80 p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 relative group">
                                <button type="button" onClick={() => handleRemoveQuestion(q.id)} className="absolute top-4 right-4 text-red-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 pr-8">
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Question {index + 1}</label>
                                        <input required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white" value={q.question_text} onChange={e => handleQuestionChange(q.id, 'question_text', e.target.value)} placeholder={`e.g. How would you rate...`} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
                                        <select className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" value={q.question_type} onChange={e => handleQuestionChange(q.id, 'question_type', e.target.value)}>
                                            <option value="Text">Text</option>
                                            <option value="Multiple Choice">Multiple Choice</option>
                                        </select>
                                    </div>
                                </div>

                                {q.question_type === 'Multiple Choice' && (
                                    <div className="mt-4 p-4 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Options (comma separated)</label>
                                        <input
                                            required
                                            className="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white text-sm"
                                            value={(q.options || []).join(', ')}
                                            onChange={e => handleQuestionChange(q.id, 'options', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                                            placeholder="Option A, Option B, Option C"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-zinc-800 sticky bottom-0 bg-white dark:bg-zinc-900 py-4">
                        <button disabled={saving} type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30">
                            {saving ? 'Saving Survey...' : (existingSurvey ? 'Update Survey' : 'Publish Survey')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
