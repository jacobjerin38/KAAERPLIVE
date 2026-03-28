import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit2, Archive, Package, QrCode, Scale, Tag } from 'lucide-react';
import { Modal } from '../ui/Modal'; // Adjust path if needed
import { useAuth } from '../../contexts/AuthContext';

interface Item {
    id: string;
    code: string;
    name: string;
    description?: string;
    category?: string;
    uom: string;
    valuation_method: 'FIFO' | 'AVG';
    is_stockable: boolean;
    is_batch_tracked: boolean;
    is_serial_tracked: boolean;
    status: 'Active' | 'Inactive';
    storage_category_id?: string;
    putaway_strategy?: 'FIFO' | 'LIFO' | 'FEFO';
    picking_method?: 'FIFO' | 'FEFO';
}

export const ItemMaster: React.FC = () => {
    const { user, currentCompanyId } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<Item>>({});
    const [saving, setSaving] = useState(false);
    const [storageCategories, setStorageCategories] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchItems();
            fetchStorageCategories();
        }
    }, [currentCompanyId]);

    const fetchStorageCategories = async () => {
        const { data } = await supabase.from('storage_categories').select('id, name').eq('company_id', currentCompanyId);
        setStorageCategories(data || []);
    };

    const fetchItems = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('item_master')
                .select('*')
                .eq('company_id', currentCompanyId)
                .order('name');

            if (error) throw error;
            setItems((data || []) as any);
        } catch (error) {
            console.error('Error fetching items:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (!currentCompanyId) return;

            if (currentItem.id) {
                // Update existing item
                const { id, ...updateData } = currentItem;
                const { error } = await supabase
                    .from('item_master')
                    .update({ ...updateData, company_id: currentCompanyId })
                    .eq('id', id);
                if (error) throw error;
            } else {
                // Create new item - exclude id field
                const { id, ...insertData } = currentItem;
                const { error } = await supabase
                    .from('item_master')
                    .insert([{ ...insertData, company_id: currentCompanyId } as any]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchItems();
        } catch (error: any) {
            console.error('Error saving item:', error);
            alert('Failed to save item: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Item Master</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage global product definitions and inventory settings.</p>
                </div>
                <button
                    onClick={() => { setCurrentItem({ is_stockable: true, valuation_method: 'FIFO', status: 'Active', uom: 'PCS' }); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Item
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search by name, SKU, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {/* Items List */}
            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading items...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map(item => (
                        <div key={item.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 hover:shadow-md transition-shadow group relative">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-white">{item.name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                                            <QrCode className="w-3 h-3" />
                                            {item.code}
                                        </div>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full ${item.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600'}`}>
                                    {item.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-600 dark:text-slate-400 mt-4">
                                <div className="flex items-center gap-1.5" title="Category">
                                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                                    {item.category || '-'}
                                </div>
                                <div className="flex items-center gap-1.5" title="Unit of Measure">
                                    <Scale className="w-3.5 h-3.5 text-slate-400" />
                                    {item.uom}
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2 text-xs text-slate-500">
                                {item.is_stockable && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded">Stockable</span>}
                                {item.is_batch_tracked && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 rounded">Batch</span>}
                                {item.is_serial_tracked && <span className="px-2 py-0.5 bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 rounded">Serial</span>}
                            </div>

                            <button
                                onClick={() => { setCurrentItem(item); setIsModalOpen(true); }}
                                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-400 italic">
                            No items found matching your search.
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <Modal title={currentItem.id ? 'Edit Item' : 'New Item'} onClose={() => setIsModalOpen(false)}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SKU / Code *</label>
                                <input
                                    required
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    value={currentItem.code || ''}
                                    onChange={e => setCurrentItem({ ...currentItem, code: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Item Name *</label>
                                <input
                                    required
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    value={currentItem.name || ''}
                                    onChange={e => setCurrentItem({ ...currentItem, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                            <textarea
                                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                rows={2}
                                value={currentItem.description || ''}
                                onChange={e => setCurrentItem({ ...currentItem, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                                <input
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    value={currentItem.category || ''}
                                    onChange={e => setCurrentItem({ ...currentItem, category: e.target.value })}
                                    placeholder="e.g. Raw Material"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unit of Measure (UOM) *</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    value={currentItem.uom || 'PCS'}
                                    onChange={e => setCurrentItem({ ...currentItem, uom: e.target.value })}
                                >
                                    <option value="PCS">PCS - Pieces</option>
                                    <option value="KG">KG - Kilograms</option>
                                    <option value="MTR">MTR - Meters</option>
                                    <option value="LTR">LTR - Liters</option>
                                    <option value="BOX">BOX - Box</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valuation Method</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    value={currentItem.valuation_method || 'FIFO'}
                                    onChange={e => setCurrentItem({ ...currentItem, valuation_method: e.target.value as any })}
                                >
                                    <option value="FIFO">FIFO (First In First Out)</option>
                                    <option value="AVG">Weighted Average</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    value={currentItem.status || 'Active'}
                                    onChange={e => setCurrentItem({ ...currentItem, status: e.target.value as any })}
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Storage Category</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    value={currentItem.storage_category_id || ''}
                                    onChange={e => setCurrentItem({ ...currentItem, storage_category_id: e.target.value })}
                                >
                                    <option value="">None (Standard)</option>
                                    {storageCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Putaway Strategy</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                                    value={currentItem.putaway_strategy || 'FIFO'}
                                    onChange={e => setCurrentItem({ ...currentItem, putaway_strategy: e.target.value as any })}
                                >
                                    <option value="FIFO">FIFO (First In First Out)</option>
                                    <option value="LIFO">LIFO (Last In First Out)</option>
                                    <option value="FEFO">FEFO (First Expired First Out)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-6 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={currentItem.is_stockable ?? true}
                                    onChange={e => setCurrentItem({ ...currentItem, is_stockable: e.target.checked })}
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">Stockable Item</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={currentItem.is_batch_tracked ?? false}
                                    onChange={e => setCurrentItem({ ...currentItem, is_batch_tracked: e.target.checked })}
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">Batch Tracked</span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 pt-6">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Item'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
