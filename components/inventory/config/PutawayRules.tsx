import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Map, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { useAuth } from '../../../contexts/AuthContext';

interface PutawayRule {
    id: string;
    warehouse: { name: string };
    storage_category: { name: string } | null;
    target_zone: { name: string };
    priority: number;
}

export const PutawayRules: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [rules, setRules] = useState<PutawayRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        warehouse_id: '',
        storage_category_id: '',
        target_zone_id: '',
        priority: 1
    });

    // Masters for Dropdowns
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [zones, setZones] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchRules();
            fetchMasters();
        }
    }, [currentCompanyId]);

    // Filter zones when warehouse changes
    useEffect(() => {
        if (formData.warehouse_id) {
            fetchZones(formData.warehouse_id);
        } else {
            setZones([]);
        }
    }, [formData.warehouse_id]);

    const fetchRules = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('putaway_rules')
            .select(`
                id, priority,
                warehouse:warehouses(name),
                storage_category:storage_categories(name),
                target_zone:warehouse_zones(name)
            `)
            .order('priority')
            .eq('company_id', currentCompanyId);

        if (error) console.error(error);
        else {
            // Fix: Handle cases where Supabase returns arrays for joined relations
            const formattedData = (data || []).map((item: any) => ({
                ...item,
                warehouse: Array.isArray(item.warehouse) ? item.warehouse[0] : item.warehouse,
                storage_category: Array.isArray(item.storage_category) ? item.storage_category[0] : item.storage_category,
                target_zone: Array.isArray(item.target_zone) ? item.target_zone[0] : item.target_zone
            }));
            setRules(formattedData);
        }

        setLoading(false);
    };

    const fetchMasters = async () => {
        const { data: wh } = await supabase.from('warehouses').select('id, name').eq('company_id', currentCompanyId);
        const { data: cat } = await supabase.from('storage_categories').select('id, name').eq('company_id', currentCompanyId);
        setWarehouses(wh || []);
        setCategories(cat || []);
    };

    const fetchZones = async (warehouseId: string) => {
        const { data } = await supabase.from('warehouse_zones')
            .select('id, name')
            .eq('warehouse_id', warehouseId);
        setZones(data || []);
    };

    const handleCreate = async () => {
        if (!formData.warehouse_id || !formData.target_zone_id) return;

        const payload = {
            warehouse_id: formData.warehouse_id,
            target_zone_id: formData.target_zone_id,
            storage_category_id: formData.storage_category_id || null, // Allow NULL for 'All Others'
            priority: formData.priority
        };

        const { error } = await supabase.from('putaway_rules').insert([{ ...payload, company_id: currentCompanyId }]);

        if (error) {
            alert('Error creating rule: ' + error.message);
        } else {
            setIsModalOpen(false);
            setFormData({ warehouse_id: '', storage_category_id: '', target_zone_id: '', priority: 1 });
            fetchRules();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this rule?')) return;
        const { error } = await supabase.from('putaway_rules').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else fetchRules();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Putaway Rules</h2>
                    <p className="text-sm text-slate-500">Automate where incoming items are stored based on their category.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Add Rule
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-semibold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Priority</th>
                            <th className="px-6 py-4">Context</th>
                            <th className="px-6 py-4">Action</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading rules...</td></tr>
                        ) : rules.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-500 italic">No putaway rules defined. Defaulting to any open bin.</td></tr>
                        ) : (
                            rules.map(rule => (
                                <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                    <td className="px-6 py-4">
                                        <span className="bg-slate-100 dark:bg-zinc-800 text-slate-600 px-2 py-1 rounded font-mono font-bold text-xs border border-slate-200 dark:border-zinc-700">
                                            #{rule.priority}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 dark:text-white">{rule.warehouse?.name}</span>
                                            <span className="text-xs text-slate-500">
                                                If Item is: <span className="font-bold text-indigo-600 dark:text-indigo-400">{rule.storage_category?.name || 'Any Category'}</span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                                            <ArrowRight className="w-4 h-4" />
                                            Target Zone: {rule.target_zone?.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(rule.id)}
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
                <Modal title="New Putaway Rule" onClose={() => setIsModalOpen(false)}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Warehouse</label>
                                <select
                                    className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                    value={formData.warehouse_id}
                                    onChange={e => setFormData({ ...formData, warehouse_id: e.target.value, target_zone_id: '' })}
                                >
                                    <option value="">Select Warehouse</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Priority</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                    value={formData.priority}
                                    onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                />
                                <p className="text-[10px] text-slate-500">Lower runs first.</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">If Item Category is...</label>
                            <select
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={formData.storage_category_id}
                                onChange={e => setFormData({ ...formData, storage_category_id: e.target.value })}
                            >
                                <option value="">Any Category (Catch-all)</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Put away in Zone...</label>
                            <select
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={formData.target_zone_id}
                                onChange={e => setFormData({ ...formData, target_zone_id: e.target.value })}
                                disabled={!formData.warehouse_id}
                            >
                                <option value="">Select Zone</option>
                                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                            </select>
                            {!formData.warehouse_id && <p className="text-xs text-rose-500">Select warehouse first</p>}
                        </div>

                        <button
                            onClick={handleCreate}
                            className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
                        >
                            Create Rule
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};
