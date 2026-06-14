import React, { useState, useEffect } from 'react';
import { Plus, Award, Trash2, CheckCircle, XCircle, Edit, Shield } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface KudosCategory {
    id: number;
    name: string;
    description: string;
    icon: string;
    points: number;
    status: string;
    created_at: string;
}

export const KudosCategoriesView: React.FC = () => {
    const [categories, setCategories] = useState<KudosCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<KudosCategory | null>(null);
    const { currentCompanyId } = useAuth();

    useEffect(() => {
        if (currentCompanyId) {
            fetchCategories();
        }
    }, [currentCompanyId]);

    const fetchCategories = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('master_kudos_categories')
            .select('*')
            .eq('company_id', currentCompanyId)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching kudos categories:', error);
        } else {
            setCategories(data || []);
        }
        setLoading(false);
    };

    const toggleStatus = async (cat: KudosCategory) => {
        const { error } = await supabase
            .from('master_kudos_categories')
            .update({ status: cat.status === 'Active' ? 'Inactive' : 'Active' })
            .eq('id', cat.id);

        if (!error) fetchCategories();
    };

    const deleteCategory = async (id: number) => {
        if (!confirm('Are you sure you want to delete this category? This cannot be undone.')) return;

        const { error } = await supabase
            .from('master_kudos_categories')
            .delete()
            .eq('id', id);

        if (!error) fetchCategories();
        else alert('Error deleting category. It might be in use.');
    };

    const handleEdit = (cat: KudosCategory) => {
        setEditingCategory(cat);
        setIsModalOpen(true);
    };

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Award className="w-8 h-8 text-amber-500" /> Kudos Categories
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Manage categories for employee recognition.</p>
                </div>
                <button
                    onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Add Category
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading categories...</div>
            ) : categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white/50 dark:bg-zinc-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
                    <Award className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No categories created yet</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categories.map(cat => (
                        <div key={cat.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow relative group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center text-xl">
                                        {cat.icon || '🏅'}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white leading-tight">{cat.name}</h3>
                                        <p className="text-xs font-bold text-amber-600">{cat.points} Points</p>
                                    </div>
                                </div>
                                <div className={`px-2 py-1 rounded-lg text-xs font-bold ${cat.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                    {cat.status === 'Active' ? 'Active' : 'Disabled'}
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 line-clamp-2 min-h-[40px]">
                                {cat.description}
                            </p>

                            <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(cat)}
                                        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors text-blue-500"
                                        title="Edit Category"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => toggleStatus(cat)}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                        title={cat.status === 'Active' ? "Disable Category" : "Enable Category"}
                                    >
                                        {cat.status === 'Active' ? <XCircle className="w-4 h-4 text-amber-500" /> : <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                    </button>
                                    <button
                                        onClick={() => deleteCategory(cat.id)}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-500"
                                        title="Delete Category"
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
                <AddCategoryModal
                    category={editingCategory}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => { setIsModalOpen(false); fetchCategories(); }}
                />
            )}
        </div>
    );
};

// Internal Modal Component
const AddCategoryModal = ({ category, onClose, onSuccess }: { category: KudosCategory | null, onClose: () => void, onSuccess: () => void }) => {
    const { currentCompanyId } = useAuth();
    const [formData, setFormData] = useState({
        name: category?.name || '',
        description: category?.description || '',
        icon: category?.icon || '🏅',
        points: category?.points || 10,
        status: category ? category.status : 'Active'
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const payload = {
            ...formData,
            company_id: currentCompanyId
        };

        if (category) {
            const { error } = await supabase.from('master_kudos_categories').update(payload).eq('id', category.id);
            if (!error) onSuccess();
            else alert("Error updating category: " + error.message);
        } else {
            const { error } = await supabase.from('master_kudos_categories').insert([payload]);
            if (!error) onSuccess();
            else alert("Error creating category: " + error.message);
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2rem] p-8 shadow-2xl animate-scale-up relative">
                <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full transition-colors">
                    <XCircle className="w-4 h-4 text-slate-400" />
                </button>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                    {category ? 'Edit Category' : 'New Kudos Category'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category Name</label>
                        <input required className="w-full p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white" placeholder="e.g. Team Player" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                        <textarea required className="w-full p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white resize-none h-24" placeholder="For outstanding teamwork..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Icon (Emoji)</label>
                            <input required className="w-full p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white text-center text-xl" value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Points Awarded</label>
                            <input type="number" min="0" required className="w-full p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white" value={formData.points} onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <div className="pt-4">
                        <button disabled={saving} type="submit" className="w-full py-4 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors">
                            {saving ? 'Saving...' : (category ? 'Update Category' : 'Create Category')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
