import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowRight, Truck, User, Calendar, MapPin, Package } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface StockMovement {
    id: string;
    created_at: string;
    movement_type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
    quantity: number;
    reference_type: string;
    reference_id: string;
    item: {
        name: string;
        code: string;
        uom: string;
    };
    from_bin?: {
        name: string;
        zone?: { name: string; warehouse?: { name: string } };
    };
    to_bin?: {
        name: string;
        zone?: { name: string; warehouse?: { name: string } };
    };
}

export const StockMovements: React.FC = () => {
    const { user, currentCompanyId } = useAuth();
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentCompanyId) fetchMovements();
    }, [currentCompanyId]);

    const fetchMovements = async () => {
        try {
            setLoading(true);
            // We need to join nested relations. 
            // Note: Supabase nested joins can be tricky. 
            // We'll simplify for now and refine if needed.
            const { data, error } = await supabase
                .from('stock_movements')
                .select(`
                    *,
                    item:item_master(name, code, uom),
                    from_bin:warehouse_bins!from_bin_id(name, zone:warehouse_zones(name, warehouse:warehouses(name))),
                    to_bin:warehouse_bins!to_bin_id(name, zone:warehouse_zones(name, warehouse:warehouses(name)))
                `)
                .eq('company_id', currentCompanyId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setMovements((data || []) as any);
        } catch (error) {
            console.error('Error fetching stock movements:', error);
        } finally {
            setLoading(false);
        }
    };

    const getMovementColor = (type: string) => {
        switch (type) {
            case 'IN': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'OUT': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            case 'TRANSFER': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const formatLocation = (bin: any) => {
        if (!bin) return 'External';
        const whName = bin.zone?.warehouse?.name || '?';
        const zoneName = bin.zone?.name || '?';
        return `${whName} > ${zoneName} > ${bin.name}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Physical Movements</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Track real-time stock movement across warehouses and bins.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-slate-500">Loading movements...</div>
                ) : movements.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center text-slate-500">
                        <Truck className="w-12 h-12 mb-4 opacity-20" />
                        <p>No stock movements recorded yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {movements.map((move) => (
                            <div key={move.id} className="p-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-start justify-between">
                                    {/* Left: Item & Type */}
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2 rounded-lg ${getMovementColor(move.movement_type)}`}>
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-slate-800 dark:text-white">{move.item?.name}</h4>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getMovementColor(move.movement_type)}`}>
                                                    {move.movement_type}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-500 mt-1 flex items-center gap-4">
                                                <span className="font-mono bg-slate-100 dark:bg-zinc-800 px-1.5 rounded text-xs">{move.item?.code}</span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(move.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Center: Route (From -> To) */}
                                    <div className="flex-1 px-8 flex items-center justify-center gap-4 text-sm">
                                        <div className={`flex items-center gap-1.5 ${!move.from_bin ? 'text-slate-400 italic' : 'text-slate-700 dark:text-slate-300'}`}>
                                            <MapPin className="w-3.5 h-3.5" />
                                            {formatLocation(move.from_bin)}
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-300" />
                                        <div className={`flex items-center gap-1.5 ${!move.to_bin ? 'text-slate-400 italic' : 'text-slate-700 dark:text-slate-300'}`}>
                                            <MapPin className="w-3.5 h-3.5" />
                                            {formatLocation(move.to_bin)}
                                        </div>
                                    </div>

                                    {/* Right: Qty & User */}
                                    <div className="text-right">
                                        <div className="font-bold text-lg text-slate-800 dark:text-white">
                                            {move.quantity} <span className="text-sm font-normal text-slate-500">{move.item?.uom}</span>
                                        </div>
                                        <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500 mt-1">
                                            <User className="w-3 h-3" />
                                            System
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
