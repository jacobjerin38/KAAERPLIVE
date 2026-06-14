import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit2, Package, QrCode, Scale, Tag, Upload, Download, Calendar, BarChart3, AlertTriangle, X, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
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
    weight?: number;
    expiry_date?: string;
    barcode?: string;
    reorder_level?: number;
    reorder_qty?: number;
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
    // Excel Import
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importData, setImportData] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

            const saveData = { ...currentItem };
            // Clean empty strings for optional fields
            if (!saveData.storage_category_id) delete saveData.storage_category_id;
            if (!saveData.expiry_date) delete saveData.expiry_date;
            if (saveData.weight === undefined || saveData.weight === null) saveData.weight = 0;
            if (saveData.reorder_level === undefined || saveData.reorder_level === null) saveData.reorder_level = 0;
            if (saveData.reorder_qty === undefined || saveData.reorder_qty === null) saveData.reorder_qty = 0;

            if (saveData.id) {
                const { id, ...updateData } = saveData;
                const { error } = await supabase
                    .from('item_master')
                    .update({ ...updateData, company_id: currentCompanyId })
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { id, ...insertData } = saveData;
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

    // Auto-generate barcode (Code128-style numeric)
    const generateBarcode = () => {
        const prefix = 'KAA';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const barcode = `${prefix}${timestamp}${random}`;
        setCurrentItem({ ...currentItem, barcode });
    };

    // Excel Import handlers
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split('\n').filter(l => l.trim());
                if (lines.length < 2) {
                    alert('File must have at least a header row and one data row');
                    return;
                }

                // Parse CSV/TSV
                const delimiter = lines[0].includes('\t') ? '\t' : ',';
                const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));

                const rows = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
                    if (values.length < 2) continue;

                    const row: any = {};
                    headers.forEach((header, idx) => {
                        // Map common header names to our fields
                        const fieldMap: Record<string, string> = {
                            'lat_code': 'code', 'item_code': 'code', 'sku': 'code', 'code': 'code',
                            'item_name': 'name', 'name': 'name', 'product_name': 'name',
                            'description': 'description', 'desc': 'description',
                            'category': 'category', 'group': 'category',
                            'uom': 'uom', 'unit': 'uom', 'unit_of_measure': 'uom',
                            'weight': 'weight', 'wt': 'weight',
                            'expiry_date': 'expiry_date', 'expiry': 'expiry_date', 'exp_date': 'expiry_date',
                            'barcode': 'barcode',
                            'reorder_level': 'reorder_level', 'min_stock': 'reorder_level', 'min_qty': 'reorder_level',
                            'reorder_qty': 'reorder_qty', 'order_qty': 'reorder_qty',
                        };
                        const mappedField = fieldMap[header] || header;
                        if (values[idx]) row[mappedField] = values[idx];
                    });

                    if (row.code && row.name) {
                        rows.push(row);
                    }
                }

                setImportData(rows);
                setImportResult(null);
            } catch (err) {
                alert('Error parsing file. Please use CSV format.');
            }
        };
        reader.readAsText(file);
    };

    const executeImport = async () => {
        if (!currentCompanyId || importData.length === 0) return;
        setImporting(true);
        try {
            const { data, error } = await supabase.rpc('rpc_bulk_import_items', {
                p_company_id: currentCompanyId,
                p_items: importData
            });
            if (error) throw error;
            setImportResult(data);
            fetchItems();
        } catch (error: any) {
            alert('Import failed: ' + error.message);
        } finally {
            setImporting(false);
        }
    };

    const downloadTemplate = () => {
        const headers = 'LAT Code,Item Name,Description,Category,UOM,Weight,Expiry Date,Barcode,Reorder Level,Reorder Qty';
        const sample = 'LAT001,Sample Item,Description here,Raw Material,PCS,2.5,2027-12-31,,10,50';
        const csv = headers + '\n' + sample;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'item_master_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isExpiringSoon = (date?: string) => {
        if (!date) return false;
        return new Date(date).getTime() < Date.now() + 90 * 24 * 60 * 60 * 1000;
    };

    const isExpired = (date?: string) => {
        if (!date) return false;
        return new Date(date).getTime() < Date.now();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Item Master</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage product definitions, barcodes, and inventory settings.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setIsImportModalOpen(true); setImportData([]); setImportResult(null); }}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Excel Import
                    </button>
                    <button
                        onClick={() => { setCurrentItem({ is_stockable: true, valuation_method: 'FIFO', status: 'Active', uom: 'PCS', weight: 0, reorder_level: 0, reorder_qty: 0 }); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Item
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search by name, LAT code, category, or barcode..."
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
                                {(item.weight !== undefined && item.weight !== null && item.weight > 0) && (
                                    <div className="flex items-center gap-1.5" title="Weight">
                                        <Scale className="w-3.5 h-3.5 text-slate-400" />
                                        {item.weight} kg
                                    </div>
                                )}
                                {item.barcode && (
                                    <div className="flex items-center gap-1.5" title="Barcode">
                                        <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="font-mono text-xs truncate">{item.barcode}</span>
                                    </div>
                                )}
                            </div>

                            {/* Expiry Warning */}
                            {item.expiry_date && (
                                <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
                                    isExpired(item.expiry_date)
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : isExpiringSoon(item.expiry_date)
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-slate-400'
                                }`}>
                                    <Calendar className="w-3 h-3" />
                                    {isExpired(item.expiry_date) ? 'EXPIRED' : 'Expires'}: {new Date(item.expiry_date).toLocaleDateString()}
                                </div>
                            )}

                            {/* Reorder Level */}
                            {(item.reorder_level !== undefined && item.reorder_level > 0) && (
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                                    <AlertTriangle className="w-3 h-3" />
                                    Reorder at: {item.reorder_level} {item.uom}
                                </div>
                            )}

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
                    <form onSubmit={handleSave} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">LAT Code *</label>
                                <input
                                    required
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                                    value={currentItem.code || ''}
                                    onChange={e => setCurrentItem({ ...currentItem, code: e.target.value })}
                                    placeholder="e.g. LAT001"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Item Name *</label>
                                <input
                                    required
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                                    value={currentItem.name || ''}
                                    onChange={e => setCurrentItem({ ...currentItem, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                            <textarea
                                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                                rows={2}
                                value={currentItem.description || ''}
                                onChange={e => setCurrentItem({ ...currentItem, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                                <input
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                                    value={currentItem.category || ''}
                                    onChange={e => setCurrentItem({ ...currentItem, category: e.target.value })}
                                    placeholder="e.g. Raw Material"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unit of Measure (UOM) *</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                                    value={currentItem.uom || 'PCS'}
                                    onChange={e => setCurrentItem({ ...currentItem, uom: e.target.value })}
                                >
                                    <option value="PCS">PCS - Pieces</option>
                                    <option value="KG">KG - Kilograms</option>
                                    <option value="MTR">MTR - Meters</option>
                                    <option value="LTR">LTR - Liters</option>
                                    <option value="BOX">BOX - Box</option>
                                    <option value="SET">SET - Set</option>
                                    <option value="ROLL">ROLL - Roll</option>
                                    <option value="BAG">BAG - Bag</option>
                                </select>
                            </div>
                        </div>

                        {/* Weight & Expiry Date */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Weight (kg)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                                    value={currentItem.weight ?? 0}
                                    onChange={e => setCurrentItem({ ...currentItem, weight: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expiry Date</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                                    value={currentItem.expiry_date || ''}
                                    onChange={e => setCurrentItem({ ...currentItem, expiry_date: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Barcode */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Barcode</label>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 font-mono text-slate-900 dark:text-white"
                                    value={currentItem.barcode || ''}
                                    onChange={e => setCurrentItem({ ...currentItem, barcode: e.target.value })}
                                    placeholder="Enter or auto-generate"
                                />
                                <button
                                    type="button"
                                    onClick={generateBarcode}
                                    className="px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm whitespace-nowrap"
                                >
                                    Auto Generate
                                </button>
                            </div>
                        </div>

                        {/* Reorder Level & Qty */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reorder Level (Min Stock)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                                    value={currentItem.reorder_level ?? 0}
                                    onChange={e => setCurrentItem({ ...currentItem, reorder_level: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reorder Quantity</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                                    value={currentItem.reorder_qty ?? 0}
                                    onChange={e => setCurrentItem({ ...currentItem, reorder_qty: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valuation Method</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
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
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
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
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
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
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
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
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={currentItem.is_serial_tracked ?? false}
                                    onChange={e => setCurrentItem({ ...currentItem, is_serial_tracked: e.target.checked })}
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">Serial Tracked</span>
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

            {/* Excel Import Modal */}
            {isImportModalOpen && (
                <Modal title="Import Items from Excel / CSV" onClose={() => setIsImportModalOpen(false)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Upload a CSV file with item data. The first row should be headers. 
                            Supported columns: <span className="font-mono text-xs">LAT Code, Item Name, Description, Category, UOM, Weight, Expiry Date, Barcode, Reorder Level, Reorder Qty</span>
                        </p>

                        <div className="flex gap-2">
                            <button
                                onClick={downloadTemplate}
                                className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-slate-400 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Download Template
                            </button>
                            <label className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer">
                                <Upload className="w-4 h-4" />
                                Choose File
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.txt,.tsv"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        {/* Preview */}
                        {importData.length > 0 && !importResult && (
                            <div className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                                <div className="px-4 py-2 bg-slate-50 dark:bg-zinc-800 flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Preview: {importData.length} items found
                                    </span>
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-100 dark:bg-zinc-800 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left">LAT Code</th>
                                                <th className="px-3 py-2 text-left">Name</th>
                                                <th className="px-3 py-2 text-left">Category</th>
                                                <th className="px-3 py-2 text-left">UOM</th>
                                                <th className="px-3 py-2 text-right">Weight</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                            {importData.slice(0, 20).map((row, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-3 py-2 font-mono">{row.code}</td>
                                                    <td className="px-3 py-2">{row.name}</td>
                                                    <td className="px-3 py-2">{row.category || '-'}</td>
                                                    <td className="px-3 py-2">{row.uom || 'PCS'}</td>
                                                    <td className="px-3 py-2 text-right">{row.weight || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-4 py-3 bg-slate-50 dark:bg-zinc-800 flex justify-end">
                                    <button
                                        onClick={executeImport}
                                        disabled={importing}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                    >
                                        {importing ? 'Importing...' : `Import ${importData.length} Items`}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Result */}
                        {importResult && (
                            <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 bg-emerald-50 dark:bg-emerald-900/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    <span className="font-medium text-emerald-700 dark:text-emerald-400">Import Complete</span>
                                </div>
                                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                                    {importResult.inserted} items imported successfully
                                    {importResult.skipped > 0 && <>, {importResult.skipped} skipped (duplicates)</>}
                                </p>
                                {importResult.errors?.length > 0 && (
                                    <div className="mt-2 text-xs text-amber-600">
                                        {importResult.errors.map((err: any, i: number) => (
                                            <div key={i}>Code: {err.code} — {err.error}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};
