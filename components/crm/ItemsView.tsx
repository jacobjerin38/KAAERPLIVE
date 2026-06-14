import React, { useState, useEffect } from 'react';
import { Plus, Search, Package, Edit3, Loader2, IndianRupee, Tag, Box, UploadCloud, Download } from 'lucide-react';
import { CRMItem } from './types';
import { getItems, createItem, updateItem, importItems } from './services';
import { read, utils } from 'xlsx';
import { AttachmentPanel } from './AttachmentPanel';
import { useAuth } from '../../contexts/AuthContext';

interface Props { companyId: string; }

const ItemsView: React.FC<Props> = ({ companyId }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<CRMItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [activeItem, setActiveItem] = useState<Partial<CRMItem>>({});
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [importing, setImporting] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = read(data);
            const sheetNames = workbook.SheetNames;
            const sheet = workbook.Sheets[sheetNames[0]];
            const jsonData = utils.sheet_to_json(sheet) as any[];

            if (!jsonData || jsonData.length === 0) {
                alert('File is empty or invalid.');
                setImporting(false);
                return;
            }

            const itemsToInsert = jsonData.map(row => ({
                company_id: companyId,
                code: row['LAT Code'] || row['Item Code'] || row['Code'] || '',
                name: row['Name'] || row['Item Name'] || '',
                uom: row['UOM'] || row['Base Unit'] || 'Nos',
                category: row['Category'] || null,
                weight: parseFloat(row['Weight']) || undefined,
                expiry_date: row['Expiry Date'] ? new Date(row['Expiry Date']).toISOString().split('T')[0] : undefined,
                selling_price: parseFloat(row['Selling Price']) || 0,
                buying_price: parseFloat(row['Buying Price']) || 0,
                description: row['Description'] || '',
                status: 'Active',
                is_stockable: true
            })).filter(item => item.code && item.name);

            if (itemsToInsert.length === 0) {
                alert('No valid items found. Ensure column names map correctly (e.g. LAT Code, Name).');
                setImporting(false);
                return;
            }

            const success = await importItems(itemsToInsert);
            if (success) {
                alert(`Successfully imported ${itemsToInsert.length} items.`);
                setShowImportModal(false);
                loadData();
            } else {
                alert('Failed to import items. Check console for details.');
            }
        } catch (error) {
            console.error(error);
            alert('Error parsing Excel file.');
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };


    useEffect(() => { loadData(); }, []);
    const loadData = async () => {
        setLoading(true);
        const data = await getItems();
        setItems(data.filter(i => i.company_id === companyId));
        setLoading(false);
    };

    const handleSave = async () => {
        if (!activeItem.name || !activeItem.code) return alert('Item Name and Code are required');
        setSaving(true);
        if (activeItem.id) {
            await updateItem(activeItem.id, activeItem);
        } else {
            await createItem({ ...activeItem, company_id: companyId, uom: activeItem.uom || 'Nos', status: 'Active' });
        }
        setSaving(false);
        setShowModal(false);
        setActiveItem({});
        loadData();
    };

    const openNew = () => { setActiveItem({}); setShowModal(true); };
    const openEdit = (item: CRMItem) => { setActiveItem({ ...item }); setShowModal(true); };

    const filtered = items.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Package className="text-orange-500" size={22} /> Items Master
                </h2>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
                            className="pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm w-56 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                    </div>
                    <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-sm font-semibold shadow-sm">
                        <UploadCloud size={16} /> Import Excel
                    </button>
                    <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all text-sm font-semibold">
                        <Plus size={16} /> Add Item
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-auto shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-orange-500" size={28} /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-400"><Package size={40} className="mx-auto mb-3 opacity-30" /><p>No items found</p></div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-zinc-800 text-left text-xs text-slate-500 uppercase tracking-wider">
                                <th className="px-5 py-3">LAT Code</th>
                                <th className="px-5 py-3">Name</th>
                                <th className="px-5 py-3">Category</th>
                                <th className="px-5 py-3">UOM</th>
                                <th className="px-5 py-3">Weight (Kg)</th>
                                <th className="px-5 py-3 text-right">Selling Price</th>
                                <th className="px-5 py-3 text-right">Buying Price</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => (
                                <tr key={item.id} className="border-b border-slate-50 dark:border-zinc-800/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer" onClick={() => openEdit(item)}>
                                    <td className="px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">{item.code}</td>
                                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{item.name}</td>
                                    <td className="px-5 py-3 text-slate-500">{item.category || '-'}</td>
                                    <td className="px-5 py-3 text-slate-500">{item.uom}</td>
                                    <td className="px-5 py-3 text-slate-500">{item.weight ? `${item.weight} Kg` : '-'}</td>
                                    <td className="px-5 py-3 text-right font-medium text-emerald-600">QAR {(item.selling_price || 0).toLocaleString()}</td>
                                    <td className="px-5 py-3 text-right text-slate-500">QAR {(item.buying_price || 0).toLocaleString()}</td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {item.status || 'Active'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3"><Edit3 size={14} className="text-slate-400" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Package size={20} className="text-orange-500" /> {activeItem.id ? 'Edit Item' : 'New Item'}
                            </h3>
                        </div>
                        <div className="p-6 space-y-4 max-h-[60vh] overflow-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">LAT Code *</label>
                                    <div className="relative">
                                        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input value={activeItem.code || ''} onChange={e => setActiveItem(p => ({ ...p, code: e.target.value }))} placeholder="ITEM-001"
                                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">UOM</label>
                                    <select value={activeItem.uom || 'Nos'} onChange={e => setActiveItem(p => ({ ...p, uom: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                                        {['Nos', 'Kg', 'Litre', 'Meter', 'Box', 'Pack', 'Set', 'Pair', 'Hour', 'Day'].map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Item Name *</label>
                                <input value={activeItem.name || ''} onChange={e => setActiveItem(p => ({ ...p, name: e.target.value }))} placeholder="Product Name"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Description</label>
                                <textarea value={activeItem.description || ''} onChange={e => setActiveItem(p => ({ ...p, description: e.target.value }))} placeholder="Item description..."
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Category</label>
                                    <input value={activeItem.category || ''} onChange={e => setActiveItem(p => ({ ...p, category: e.target.value }))} placeholder="e.g., Electronics, Services"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Weight (Kg)</label>
                                    <input type="number" step="0.01" value={activeItem.weight || ''} onChange={e => setActiveItem(p => ({ ...p, weight: parseFloat(e.target.value) || undefined }))} placeholder="0.00"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1"><IndianRupee size={11} /> Selling Price</label>
                                    <input type="number" value={activeItem.selling_price || ''} onChange={e => setActiveItem(p => ({ ...p, selling_price: parseFloat(e.target.value) || 0 }))} placeholder="0.00"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1"><IndianRupee size={11} /> Buying Price</label>
                                    <input type="number" value={activeItem.buying_price || ''} onChange={e => setActiveItem(p => ({ ...p, buying_price: parseFloat(e.target.value) || 0 }))} placeholder="0.00"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Expiry Date</label>
                                <input type="date" value={activeItem.expiry_date || ''} onChange={e => setActiveItem(p => ({ ...p, expiry_date: e.target.value }))}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-700 dark:text-slate-200" />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={activeItem.is_stockable ?? true} onChange={e => setActiveItem(p => ({ ...p, is_stockable: e.target.checked }))}
                                        className="rounded border-slate-300" />
                                    <Box size={14} className="text-slate-400" /> Stockable
                                </label>
                            </div>

                            {activeItem.id && <AttachmentPanel companyId={companyId} module="item" recordId={activeItem.id} userId={user?.id} />}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium text-sm">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm disabled:opacity-50">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : activeItem.id ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowImportModal(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <UploadCloud size={20} className="text-indigo-500" /> Import Items
                            </h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                                <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-400 mb-2">Instructions</h4>
                                <p className="text-xs text-indigo-600/80 dark:text-indigo-300/80 mb-3">
                                    Please ensure your Excel or CSV file contains a header row with the following column names:
                                </p>
                                <ul className="text-xs text-indigo-700 dark:text-indigo-300 list-disc list-inside space-y-1 font-medium">
                                    <li>LAT Code (Required)</li>
                                    <li>Name (Required)</li>
                                    <li>UOM (Nos, Kg, etc.)</li>
                                    <li>Category</li>
                                    <li>Selling Price</li>
                                    <li>Buying Price</li>
                                </ul>
                            </div>
                            
                            <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-8 text-center relative hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors bg-slate-50 dark:bg-zinc-800/30">
                                <input 
                                    type="file" 
                                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileUpload}
                                    disabled={importing}
                                />
                                {importing ? (
                                    <>
                                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" />
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Processing file...</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-full shadow flex items-center justify-center mx-auto mb-3 text-slate-500 dark:text-slate-400">
                                            <UploadCloud size={24} />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Click or drag file to upload</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Supports .xlsx, .xls, .csv</p>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <button onClick={() => setShowImportModal(false)} disabled={importing} className="px-5 py-2 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium text-sm">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ItemsView;
