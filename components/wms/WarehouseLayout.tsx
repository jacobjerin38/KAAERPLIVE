import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Warehouse, Map, Grid, Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface WarehouseBin {
    id: string;
    name: string;
    zone_id: string;
}

interface WarehouseZone {
    id: string;
    name: string;
    warehouse_id: string;
    bins: WarehouseBin[];
}

interface WarehouseData {
    id: string;
    name: string;
    address: string;
    zones: WarehouseZone[];
}

export const WarehouseLayout: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedWarehouse, setExpandedWarehouse] = useState<string | null>(null);
    const [expandedZone, setExpandedZone] = useState<string | null>(null);

    // Modal States
    const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
    const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
    const [isBinModalOpen, setIsBinModalOpen] = useState(false);

    const [newWarehouse, setNewWarehouse] = useState({ name: '', code: '', address: '' });
    const [newZone, setNewZone] = useState({ name: '', code: '', warehouse_id: '' });
    const [newBin, setNewBin] = useState({ name: '', code: '', zone_id: '' });

    useEffect(() => {
        if (currentCompanyId) fetchLayout();
    }, [currentCompanyId]);

    const fetchLayout = async () => {
        try {
            setLoading(true);
            // Fetch everything nested
            const { data: whData, error: whError } = await supabase
                .from('warehouses')
                .select(`
                    id, name, address,
                    zones:warehouse_zones(
                        id, name, warehouse_id,
                        bins:warehouse_bins(id, name, zone_id)
                    )
                `)
                .order('created_at');

            if (whError) throw whError;
            setWarehouses(whData || []);
        } catch (error) {
            console.error('Error fetching warehouse layout:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWarehouse = async () => {
        if (!newWarehouse.name || !newWarehouse.code || !currentCompanyId) return;
        try {
            const { error } = await supabase.from('warehouses').insert([{ ...newWarehouse, company_id: currentCompanyId }]);
            if (error) throw error;
            setIsWarehouseModalOpen(false);
            setNewWarehouse({ name: '', code: '', address: '' });
            fetchLayout();
        } catch (error) {
            console.error(error);
            alert('Failed to create warehouse');
        }
    };

    const handleCreateZone = async () => {
        if (!newZone.name || !newZone.code || !newZone.warehouse_id || !currentCompanyId) return;
        try {
            const { error } = await supabase.from('warehouse_zones').insert([{ ...newZone, company_id: currentCompanyId }]);
            if (error) throw error;
            setIsZoneModalOpen(false);
            setNewZone({ name: '', code: '', warehouse_id: '' });
            fetchLayout();
        } catch (error) {
            console.error(error);
            alert('Failed to create zone');
        }
    };

    const handleCreateBin = async () => {
        if (!newBin.name || !newBin.code || !newBin.zone_id || !currentCompanyId) return;
        try {
            const { error } = await supabase.from('warehouse_bins').insert([{ ...newBin, company_id: currentCompanyId }]);
            if (error) throw error;
            setIsBinModalOpen(false);
            setNewBin({ name: '', code: '', zone_id: '' });
            fetchLayout();
        } catch (error) {
            console.error(error);
            alert('Failed to create bin');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Warehouse Layout</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage warehouses, zones, and storage bins.</p>
                </div>
                <button
                    onClick={() => setIsWarehouseModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Warehouse
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Warehouse List */}
                <div className="lg:col-span-1 space-y-4">
                    {loading ? (
                        <div className="text-slate-500 text-center py-8">Loading layout...</div>
                    ) : (
                        warehouses.map(wh => (
                            <div
                                key={wh.id}
                                className={`bg-white dark:bg-zinc-900 border rounded-xl overflow-hidden transition-all ${expandedWarehouse === wh.id ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-md' : 'border-slate-200 dark:border-zinc-800 hover:border-indigo-300'}`}
                            >
                                <div
                                    className="p-4 cursor-pointer flex justify-between items-center"
                                    onClick={() => setExpandedWarehouse(expandedWarehouse === wh.id ? null : wh.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-slate-600 dark:text-slate-300">
                                            <Warehouse className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800 dark:text-white">{wh.name}</h3>
                                            <p className="text-xs text-slate-500">{wh.address || 'No location set'}</p>
                                        </div>
                                    </div>
                                    {expandedWarehouse === wh.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                </div>

                                {expandedWarehouse === wh.id && (
                                    <div className="border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 p-3 space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-xs font-semibold text-slate-500 uppercase">Zones</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setNewZone({ ...newZone, warehouse_id: wh.id }); setIsZoneModalOpen(true); }}
                                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        {wh.zones?.length === 0 ? (
                                            <div className="text-xs text-slate-400 text-center py-2 italic">No zones defined</div>
                                        ) : (
                                            wh.zones.map(zone => (
                                                <div
                                                    key={zone.id}
                                                    onClick={() => setExpandedZone(zone.id)}
                                                    className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ${expandedZone === zone.id ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-zinc-800'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Map className="w-3.5 h-3.5 opacity-70" />
                                                        {zone.name}
                                                    </div>
                                                    <ChevronRight className={`w-3 h-3 transition-transform ${expandedZone === zone.id ? 'rotate-90 text-indigo-500' : 'text-transparent group-hover:text-slate-300'}`} />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Zone & Bin Details */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 min-h-[400px]">
                    {!expandedZone ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Grid className="w-16 h-16 mb-4 opacity-20" />
                            <p>Select a Zone to view Bins</p>
                        </div>
                    ) : (
                        (() => {
                            // Find the selected zone
                            let activeZone: WarehouseZone | undefined;
                            warehouses.forEach(w => {
                                const z = w.zones.find(z => z.id === expandedZone);
                                if (z) activeZone = z;
                            });

                            if (!activeZone) return null;

                            return (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                <Map className="w-5 h-5 text-indigo-500" />
                                                {activeZone.name}
                                            </h3>
                                            <p className="text-sm text-slate-500">Managing bins in this zone</p>
                                        </div>
                                        <button
                                            onClick={() => { setNewBin({ ...newBin, zone_id: activeZone!.id }); setIsBinModalOpen(true); }}
                                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-sm font-medium rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                        >
                                            + Add Bin
                                        </button>
                                    </div>

                                    {activeZone.bins?.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 italic">No bins created in this zone yet.</div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {activeZone.bins.map(bin => (
                                                <div key={bin.id} className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800 flex flex-col items-center justify-center gap-2 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm transition-all cursor-default group">
                                                    <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-slate-400 border border-slate-100 dark:border-zinc-700">
                                                        <Grid className="w-5 h-5" />
                                                    </div>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{bin.name}</span>
                                                    {/* Placeholder for bin stats (e.g. usage) */}
                                                    <span className="text-xs text-slate-400">Empty</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()
                    )}
                </div>
            </div>

            {/* Modals */}
            {isWarehouseModalOpen && (
                <Modal title="New Warehouse" onClose={() => setIsWarehouseModalOpen(false)}>
                    <div className="space-y-4">
                        <input className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" placeholder="Warehouse Code (Unique)" value={newWarehouse.code} onChange={e => setNewWarehouse({ ...newWarehouse, code: e.target.value })} />
                        <input className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" placeholder="Warehouse Name" value={newWarehouse.name} onChange={e => setNewWarehouse({ ...newWarehouse, name: e.target.value })} />
                        <input className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" placeholder="Location / Address" value={newWarehouse.address} onChange={e => setNewWarehouse({ ...newWarehouse, address: e.target.value })} />
                        <button onClick={handleCreateWarehouse} className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Create Warehouse</button>
                    </div>
                </Modal>
            )}

            {isZoneModalOpen && (
                <Modal title="New Zone" onClose={() => setIsZoneModalOpen(false)}>
                    <div className="space-y-4">
                        <input className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" placeholder="Zone Code" value={newZone.code} onChange={e => setNewZone({ ...newZone, code: e.target.value })} />
                        <input className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" placeholder="Zone Name (e.g., Aisle 1, Cold Storage)" value={newZone.name} onChange={e => setNewZone({ ...newZone, name: e.target.value })} />
                        <button onClick={handleCreateZone} className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Create Zone</button>
                    </div>
                </Modal>
            )}

            {isBinModalOpen && (
                <Modal title="New Bin" onClose={() => setIsBinModalOpen(false)}>
                    <div className="space-y-4">
                        <input className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" placeholder="Bin Code (e.g., A1-01)" value={newBin.code} onChange={e => setNewBin({ ...newBin, code: e.target.value })} />
                        <input className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" placeholder="Bin Name" value={newBin.name} onChange={e => setNewBin({ ...newBin, name: e.target.value })} />
                        <button onClick={handleCreateBin} className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Create Bin</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};
