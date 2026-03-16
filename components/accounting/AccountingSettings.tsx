import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AccountConfig {
    id?: string;
    inventory_asset_account: string;
    cogs_account: string;
    grni_account: string;
    sales_revenue_account: string;
}

export const AccountingSettings: React.FC = () => {
    const { user } = useAuth();
    const [config, setConfig] = useState<AccountConfig>({
        inventory_asset_account: '',
        cogs_account: '',
        grni_account: '',
        sales_revenue_account: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('inventory_account_config')
                .select('*')
                .maybeSingle();

            if (data) {
                setConfig(data);
            }
        } catch (error) {
            console.error('Error fetching account config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const userProfile = await supabase.from('profiles').select('company_id').eq('id', user?.id).single();
            const company_id = userProfile.data?.company_id;

            if (!company_id) throw new Error('Company ID not found');

            const payload = { ...config, company_id };

            // Check if exists to determine insert/update logic (or use upset if unique constraint exists on company_id)
            // Assuming unique constraint on company_id from schema
            const { error } = await supabase
                .from('inventory_account_config')
                .upsert(payload, { onConflict: 'company_id' });

            if (error) throw error;
            alert('Accounting configuration saved successfully!');
        } catch (error: any) {
            console.error('Error saving config:', error);
            alert('Failed to save config: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading settings...</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">General Ledger Mapping</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Map inventory actions to specific GL accounts.</p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800/50 p-4 rounded-xl flex gap-3 text-sm text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>Ensure these account codes/names match exactly with your Chart of Accounts. Incorrect mapping will result in wrong financial reports.</p>
            </div>

            <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Inventory Asset Account</label>
                    <input
                        required
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                        placeholder="e.g. 1001-INVENTORY"
                        value={config.inventory_asset_account}
                        onChange={e => setConfig({ ...config, inventory_asset_account: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-1">Debited on GRN, Credited on Issue.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cost of Goods Sold (COGS)</label>
                    <input
                        required
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                        placeholder="e.g. 5001-COGS"
                        value={config.cogs_account}
                        onChange={e => setConfig({ ...config, cogs_account: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-1">Debited on Issue (Sale/Usage).</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">GRNI (Goods Received Not Invoiced)</label>
                    <input
                        required
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                        placeholder="e.g. 2005-GRNI-ACCRUAL"
                        value={config.grni_account}
                        onChange={e => setConfig({ ...config, grni_account: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-1">Credited on GRN. Liability account.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sales Revenue Account</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800"
                        placeholder="e.g. 4001-SALES"
                        value={config.sales_revenue_account || ''}
                        onChange={e => setConfig({ ...config, sales_revenue_account: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-1">Credited on Invoice (Optional for Inventory module).</p>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Configuration
                    </button>
                </div>
            </form>
        </div>
    );
};
