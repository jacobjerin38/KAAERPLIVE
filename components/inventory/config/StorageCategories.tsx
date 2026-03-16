import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Archive, Plus, Trash2, Save, X } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { useAuth } from '../../../contexts/AuthContext';

interface StorageCategory {
    id: string;
    name: string;
    description: string;
    is_active: boolean;
}

export const StorageCategories: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [categories, setCategories] = useState<StorageCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', description: '' });

    useEffect(() => {
        if (currentCompanyId) fetchCategories();
    }, [currentCompanyId]);

    const fetchCategories = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('storage_categories')
            .select('*')
            .eq('company_id', currentCompanyId)
            .order('name');

        if (error) console.error('Error fetching categories:', error);
        else setCategories(data || []);

        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newItem.name) return;

        const { error } = await supabase.from('storage_categories').insert([{ ...newItem, company_id: currentCompanyId }]);

        if (error) {
            alert('Error creating category: ' + error.message);
        } else {
            setIsModalOpen(false);
            setNewItem({ name: '', description: '' });
            fetchCategories();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? This might affect existing items/rules.')) return;

        const { error } = await supabase.from('storage_categories').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else fetchCategories();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Storage Categories</h2>
                    <p className="text-sm text-slate-500">Define environment requirements for items (e.g., Cold Chain, Hazardous).</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Add Category
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-semibold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {loading ? (
                            <tr><td colSpan={3} className="p-8 text-center text-slate-500">Loading...</td></tr>
                        ) : categories.length === 0 ? (
                            <tr><td colSpan={3} className="p-8 text-center text-slate-500 italic">No storage categories defined.</td></tr>
                        ) : (
                            categories.map(cat => (
                                <tr key={cat.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-white flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg">
                                            <Archive className="w-4 h-4" />
                                        </div>
                                        {cat.name}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{cat.description || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(cat.id)}
                                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <Modal title="New Storage Category" onClose={() => setIsModalOpen(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Name</label>
                            <input
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                placeholder="e.g., Cold Storage (-18C)"
                                value={newItem.name}
                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <textarea
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                rows={3}
                                placeholder="Optional details..."
                                value={newItem.description}
                                onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                            />
                        </div>
                        <button
                            onClick={handleCreate}
                            className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
                        >
                            Create Category
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};
