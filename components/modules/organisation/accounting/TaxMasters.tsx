import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Plus, Percent, Edit2 } from 'lucide-react';
import { Modal } from '../../../ui/Modal';

export const TaxMasters: React.FC = () => {
    const [taxes, setTaxes] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTax, setCurrentTax] = useState<any>({});

    // For account mapping, we need CoA. Assuming simple list for now.
    const [accounts, setAccounts] = useState<any[]>([]);

    useEffect(() => {
        fetchTaxes();
        fetchAccounts();
    }, []);

    const fetchTaxes = async () => {
        const { data, error } = await supabase.from('taxes').select('*').order('name');
        if (error) console.error(error);
        else setTaxes(data || []);
    };

    const fetchAccounts = async () => {
        // Fetch Liability/Expense accounts usually
        const { data } = await supabase.from('chart_of_accounts').select('id, name, code');
        setAccounts(data || []);
    };

    const handleSave = async () => {
        if (!currentTax.name || !currentTax.amount) return;

        const payload = {
            ...currentTax,
            params: undefined // cleanup unique id if needed
        };

        let error;
        if (currentTax.id) {
            const { error: err } = await supabase.from('taxes').update(payload).eq('id', currentTax.id);
            error = err;
        } else {
            const { error: err } = await supabase.from('taxes').insert([payload]);
            error = err;
        }

        if (error) alert('Error: ' + error.message);
        else {
            setIsModalOpen(false);
            setCurrentTax({});
            fetchTaxes();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Tax Master</h3>
                    <p className="text-sm text-slate-500">Configure tax rates (GST, VAT) and account mappings.</p>
                </div>
                <button
                    onClick={() => { setCurrentTax({ type: 'Percent', scope: 'Sales', is_active: true }); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    <Plus className="w-4 h-4" /> New Tax
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {taxes.map(tax => (
                    <div key={tax.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 relative group">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <Percent className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 dark:text-white">{tax.name}</h4>
                                    <div className="text-xs text-slate-500">{tax.scope} Tax</div>
                                </div>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded font-bold ${tax.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {tax.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>

                        <div className="mt-4">
                            <div className="text-2xl font-bold text-slate-800 dark:text-white">{tax.amount}%</div>
                            <div className="text-xs text-slate-400 mt-1">
                                Linked Account: {accounts.find(a => a.id === tax.account_id)?.name || 'Not Linked'}
                            </div>
                        </div>

                        <button
                            onClick={() => { setCurrentTax(tax); setIsModalOpen(true); }}
                            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <Modal title={currentTax.id ? "Edit Tax" : "New Tax"} onClose={() => setIsModalOpen(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Tax Name</label>
                            <input
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={currentTax.name || ''}
                                onChange={e => setCurrentTax({ ...currentTax, name: e.target.value })}
                                placeholder="e.g. GST 18%"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Type</label>
                                <select
                                    className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                    value={currentTax.type || 'Percent'}
                                    onChange={e => setCurrentTax({ ...currentTax, type: e.target.value })}
                                >
                                    <option value="Percent">Percentage</option>
                                    <option value="Fixed">Fixed Amount</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Scope</label>
                                <select
                                    className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                    value={currentTax.scope || 'Sales'}
                                    onChange={e => setCurrentTax({ ...currentTax, scope: e.target.value })}
                                >
                                    <option value="Sales">Sales (Output Tax)</option>
                                    <option value="Purchase">Purchase (Input Tax)</option>
                                    <option value="None">None</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Amount / Rate</label>
                            <input
                                type="number" step="0.01"
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={currentTax.amount || 0}
                                onChange={e => setCurrentTax({ ...currentTax, amount: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">GL Account</label>
                            <select
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                value={currentTax.account_id || ''}
                                onChange={e => setCurrentTax({ ...currentTax, account_id: e.target.value })}
                            >
                                <option value="">Select Account</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                checked={currentTax.is_active ?? true}
                                onChange={e => setCurrentTax({ ...currentTax, is_active: e.target.checked })}
                            />
                            <label className="text-sm">Is Active</label>
                        </div>
                        <button onClick={handleSave} className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save Tax</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};
