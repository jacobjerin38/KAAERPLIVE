import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Book, Plus, Edit2 } from 'lucide-react';
import { Modal } from '../../../ui/Modal';

export const JournalMasters: React.FC = () => {
    const [journals, setJournals] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentJournal, setCurrentJournal] = useState<any>({});
    const [accounts, setAccounts] = useState<any[]>([]);

    useEffect(() => {
        fetchJournals();
        fetchAccounts();
    }, []);

    const fetchJournals = async () => {
        const { data, error } = await supabase.from('journals').select('*').order('code');
        if (error) console.error(error);
        else setJournals(data || []);
    };

    const fetchAccounts = async () => {
        const { data } = await supabase.from('chart_of_accounts').select('id, name, code');
        setAccounts(data || []);
    };

    const handleSave = async () => {
        if (!currentJournal.name || !currentJournal.code) return;

        const payload = { ...currentJournal };
        let error;

        if (currentJournal.id) {
            const { error: err } = await supabase.from('journals').update(payload).eq('id', currentJournal.id);
            error = err;
        } else {
            const { error: err } = await supabase.from('journals').insert([payload]);
            error = err;
        }

        if (error) alert('Error: ' + error.message);
        else {
            setIsModalOpen(false);
            setCurrentJournal({});
            fetchJournals();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Journals</h3>
                    <p className="text-sm text-slate-500">Define entry types (Sales, Purchase, Cash, etc.)</p>
                </div>
                <button
                    onClick={() => { setCurrentJournal({ type: 'General' }); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    <Plus className="w-4 h-4" /> New Journal
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {journals.map(j => (
                    <div key={j.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 relative group">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                    <Book className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 dark:text-white">{j.name}</h4>
                                    <div className="text-xs text-slate-500 font-mono">{j.code}</div>
                                </div>
                            </div>
                            <span className="px-2 py-1 text-xs bg-slate-100 dark:bg-zinc-800 rounded text-slate-600 uppercase font-bold">
                                {j.type}
                            </span>
                        </div>

                        <div className="mt-4 text-sm text-slate-500">
                            <div>Default Account: <span className="text-slate-800 dark:text-slate-300">{accounts.find(a => a.id === j.default_account_id)?.name || '-'}</span></div>
                        </div>

                        <button
                            onClick={() => { setCurrentJournal(j); setIsModalOpen(true); }}
                            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <Modal title={currentJournal.id ? "Edit Journal" : "New Journal"} onClose={() => setIsModalOpen(false)}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                    value={currentJournal.name || ''}
                                    onChange={e => setCurrentJournal({ ...currentJournal, name: e.target.value })}
                                    placeholder="e.g. Sales Journal"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Code</label>
                                <input
                                    className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                    value={currentJournal.code || ''}
                                    onChange={e => setCurrentJournal({ ...currentJournal, code: e.target.value })}
                                    placeholder="e.g. INV"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Type</label>
                            <select
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={currentJournal.type || 'General'}
                                onChange={e => setCurrentJournal({ ...currentJournal, type: e.target.value })}
                            >
                                <option value="Sale">Sale</option>
                                <option value="Purchase">Purchase</option>
                                <option value="Cash">Cash</option>
                                <option value="Bank">Bank</option>
                                <option value="General">General</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Default Account</label>
                            <select
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={currentJournal.default_account_id || ''}
                                onChange={e => setCurrentJournal({ ...currentJournal, default_account_id: e.target.value })}
                            >
                                <option value="">Select Account</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                        </div>
                        <button onClick={handleSave} className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save Journal</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};
