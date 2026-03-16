import React, { useState } from 'react';
import {
    Plus, Monitor, Edit3, Trash2, UserPlus, CheckCircle, XCircle, RefreshCw, Smartphone, Box
} from 'lucide-react';
import { Asset, Employee } from '../../hrms/types';
import { supabase } from '../../../lib/supabase';
import { Modal } from '../../ui/Modal';
import { useAuth } from '../../../contexts/AuthContext';

interface AssetModuleProps {
    assets: Asset[];
    employees: Employee[];
    refreshData: () => void;
}

export const AssetModule: React.FC<AssetModuleProps> = ({
    assets, employees, refreshData
}) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // --- Actions ---

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this asset?')) return;
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (error) alert('Error deleting: ' + error.message);
        else refreshData();
    };

    const handleReturn = async (asset: Asset) => {
        if (!confirm(`Confirm return of ${asset.name}?`)) return;
        const { error } = await supabase.from('assets').update({
            assigned_to: null,
            status: 'Available'
        }).eq('id', asset.id);

        if (error) alert('Error returning asset: ' + error.message);
        else refreshData();
    };

    const handleAddAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const formData = new FormData(e.target as HTMLFormElement);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
            const { error } = await supabase.from('assets').insert([{
                company_id: profile?.company_id,
                name: formData.get('name'),
                serial_number: formData.get('serial_number'),
                type: formData.get('type'),
                status: 'Available', // Default
                created_at: new Date().toISOString()
            }]);

            if (error) alert('Error: ' + error.message);
            else {
                setShowAddModal(false);
                refreshData();
            }
        }
        setSubmitting(false);
    };

    const handleAssignAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAsset) return;
        setSubmitting(true);
        const formData = new FormData(e.target as HTMLFormElement);
        const employeeId = formData.get('employee_id');

        const { error } = await supabase.from('assets').update({
            assigned_to: employeeId,
            status: 'In Use'
        }).eq('id', selectedAsset.id);

        if (error) alert('Error assigning asset: ' + error.message);
        else {
            setShowAssignModal(false);
            setSelectedAsset(null);
            refreshData();
        }
        setSubmitting(false);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'Hardware': return <Monitor className="w-4 h-4" />;
            case 'Mobile': return <Smartphone className="w-4 h-4" />;
            case 'Software': return <Box className="w-4 h-4" />;
            default: return <Monitor className="w-4 h-4" />;
        }
    };

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Assets</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Manage hardware, software, and allocation.</p>
                </div>
                <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 hover:shadow-lg shadow-indigo-500/30 transition-all active:scale-95">
                    <Plus className="w-4 h-4" /> Add Asset
                </button>
            </div>

            <div className="flex-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden">
                <div className="overflow-y-auto h-full">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 dark:bg-zinc-800/80 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200/60 dark:border-zinc-700">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Asset Details</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Assigned To</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50">
                            {assets.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center p-8 text-slate-500">No assets found. Add one to get started.</td>
                                </tr>
                            ) : assets.map(asset => {
                                const user = employees.find(e => e.id === asset.assignedTo);
                                return (
                                    <tr key={asset.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors group">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-xl text-slate-500 dark:text-slate-400 shadow-sm">
                                                    {getIcon(asset.type)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-white">{asset.name}</p>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{asset.serial || asset.serial_number || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">{asset.type}</td>
                                        <td className="px-8 py-4">
                                            {user ? (
                                                <div className="flex items-center gap-2">
                                                    <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`} className="w-6 h-6 rounded-full border border-white dark:border-zinc-800 shadow-sm" alt="" />
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{user.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border shadow-sm ${asset.status === 'In Use' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800' :
                                                asset.status === 'Available' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' :
                                                    'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800'
                                                }`}>{asset.status}</span>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {asset.status === 'Available' && (
                                                    <button onClick={() => { setSelectedAsset(asset); setShowAssignModal(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg tooltip" title="Assign">
                                                        <UserPlus className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {asset.status === 'In Use' && (
                                                    <button onClick={() => handleReturn(asset)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg tooltip" title="Return">
                                                        <RefreshCw className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(asset.id)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Asset Modal */}
            {showAddModal && (
                <Modal title="Add New Asset" onClose={() => setShowAddModal(false)}>
                    <form onSubmit={handleAddAsset} className="space-y-4">
                        <input name="name" required placeholder="Asset Name" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        <input name="serial_number" required placeholder="Serial Number" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        <select name="type" required className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                            <option value="Hardware">Hardware</option>
                            <option value="Software">Software</option>
                            <option value="Mobile">Mobile</option>
                            <option value="Accessory">Accessory</option>
                        </select>
                        <button disabled={submitting} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
                            {submitting ? 'Adding...' : 'Add Asset'}
                        </button>
                    </form>
                </Modal>
            )}

            {/* Assign Asset Modal */}
            {showAssignModal && selectedAsset && (
                <Modal title={`Assign ${selectedAsset.name}`} onClose={() => { setShowAssignModal(false); setSelectedAsset(null); }}>
                    <form onSubmit={handleAssignAsset} className="space-y-4">
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl mb-4">
                            <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Asset: {selectedAsset.name}</p>
                            <p className="text-xs text-indigo-700 dark:text-indigo-300">Serial: {selectedAsset.serial || selectedAsset.serial_number}</p>
                        </div>

                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Select Employee</label>
                        <select name="employee_id" required className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                            <option value="">Choose...</option>
                            {employees.filter(e => e.status === 'Active').map(e => (
                                <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                            ))}
                        </select>
                        <button disabled={submitting} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
                            {submitting ? 'Assigning...' : 'Confirm Assignment'}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
