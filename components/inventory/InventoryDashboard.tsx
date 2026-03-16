import React, { useState } from 'react';
import { ItemMaster } from './ItemMaster';
import { StockLedger } from './StockLedger';
import { StockMovements } from './StockMovements';
import { WarehouseLayout } from '../wms/WarehouseLayout';
import { GoodsReceipt } from '../wms/GoodsReceipt';
import { OutboundProcess } from '../wms/OutboundProcess';
import { StorageCategories } from './config/StorageCategories';
import { PutawayRules } from './config/PutawayRules';
import { InventoryAdjustments } from './ops/InventoryAdjustments';
import { ScrapInventory } from './ops/ScrapInventory';
import { InventoryOverview } from './InventoryOverview';
import { Package, Boxes, ClipboardList, Warehouse, ArrowDownLeft, ArrowUpRight, Settings, Trash2, RefreshCw, LayoutDashboard } from 'lucide-react';

export const InventoryDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'stock' | 'movements' | 'warehouse' | 'inbound' | 'outbound' | 'adjustments' | 'scrap' | 'config'>('overview');
    const [configSubTab, setConfigSubTab] = useState<'categories' | 'rules'>('categories');

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
                <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Package className="w-6 h-6 text-indigo-600" />
                    Inventory Management
                </h1>

                {/* Tabs */}
                <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'overview' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutDashboard className="w-3.5 h-3.5" /> Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('items')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'items' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Item Master
                    </button>
                    <button
                        onClick={() => setActiveTab('stock')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'stock' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Stock Ledger
                    </button>
                    <button
                        onClick={() => setActiveTab('movements')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'movements' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Movements
                    </button>
                    <button
                        onClick={() => setActiveTab('warehouse')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'warehouse' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Warehouse
                    </button>

                    <div className="w-px h-6 bg-slate-300 dark:bg-zinc-700 mx-1 self-center"></div>

                    <button
                        onClick={() => setActiveTab('inbound')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'inbound' ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ArrowDownLeft className="w-4 h-4" /> Inbound
                    </button>
                    <button
                        onClick={() => setActiveTab('outbound')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'outbound' ? 'bg-white dark:bg-zinc-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ArrowUpRight className="w-4 h-4" /> Outbound
                    </button>

                    <div className="w-px h-6 bg-slate-300 dark:bg-zinc-700 mx-1 self-center"></div>

                    <button
                        onClick={() => setActiveTab('adjustments')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'adjustments' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <RefreshCw className="w-4 h-4" /> Adjustments
                    </button>
                    <button
                        onClick={() => setActiveTab('scrap')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'scrap' ? 'bg-white dark:bg-zinc-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Trash2 className="w-4 h-4" /> Scrap
                    </button>

                    <div className="w-px h-6 bg-slate-300 dark:bg-zinc-700 mx-1 self-center"></div>

                    <button
                        onClick={() => setActiveTab('config')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'config' ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Settings className="w-4 h-4" /> Config
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'overview' && <InventoryOverview />}

                {activeTab === 'items' && <ItemMaster />}

                {activeTab === 'stock' && <StockLedger />}

                {activeTab === 'movements' && <StockMovements />}

                {activeTab === 'warehouse' && <WarehouseLayout />}

                {activeTab === 'inbound' && <GoodsReceipt />}

                {activeTab === 'outbound' && <OutboundProcess />}

                {activeTab === 'adjustments' && <InventoryAdjustments />}

                {activeTab === 'scrap' && <ScrapInventory />}

                {activeTab === 'config' && (
                    <div className="space-y-6">
                        <div className="flex gap-4 border-b border-slate-200 dark:border-zinc-800 pb-2">
                            <button
                                onClick={() => setConfigSubTab('categories')}
                                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${configSubTab === 'categories' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Storage Categories
                            </button>
                            <button
                                onClick={() => setConfigSubTab('rules')}
                                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${configSubTab === 'rules' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Putaway Rules
                            </button>
                        </div>

                        {configSubTab === 'categories' && <StorageCategories />}
                        {configSubTab === 'rules' && <PutawayRules />}
                    </div>
                )}
            </div>
        </div>
    );
};
