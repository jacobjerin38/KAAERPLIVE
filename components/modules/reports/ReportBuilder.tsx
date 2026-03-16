import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import {
    Save, Play, Download, FileText, X, Plus, ArrowLeft,
    ChevronDown, ChevronUp, BarChart3, Table2, Printer,
    Loader2, GripVertical, Filter, Columns, SortAsc, SortDesc,
    TrendingUp, Hash, Calculator
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';

interface SchemaField {
    id: string;
    module: string;
    source_table: string;
    field_key: string;
    field_label: string;
    data_type: string;
    is_filterable: boolean;
    is_sortable: boolean;
}

interface SelectedColumn {
    field: SchemaField;
    aggregation: 'NONE' | 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX';
}

interface ReportFilter {
    field_key: string;
    operator: 'eq' | 'neq' | 'ilike' | 'gt' | 'lt' | 'gte' | 'lte';
    value: string;
}

interface SortConfig {
    field_key: string;
    direction: 'asc' | 'desc';
}

interface ReportBuilderProps {
    onBack: () => void;
    companyId?: string;
    initialModule?: string;
    editReport?: any;
}

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#ef4444'];

const OPERATOR_LABELS: Record<string, string> = {
    eq: 'Equals', neq: 'Not Equals', ilike: 'Contains',
    gt: '>', lt: '<', gte: '\u2265', lte: '\u2264'
};

const AGG_LABELS: Record<string, string> = {
    NONE: '\u2014', SUM: '\u03A3 Sum', COUNT: '# Count', AVG: 'x\u0304 Avg', MIN: '\u2193 Min', MAX: '\u2191 Max'
};

export const ReportBuilder: React.FC<ReportBuilderProps> = ({ onBack, companyId, initialModule, editReport }) => {
    const [modules, setModules] = useState<string[]>([]);
    const [selectedModule, setSelectedModule] = useState(initialModule || '');
    const [availableFields, setAvailableFields] = useState<SchemaField[]>([]);
    const [sourceTable, setSourceTable] = useState('');

    const [reportName, setReportName] = useState(editReport?.name || '');
    const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([]);
    const [filters, setFilters] = useState<ReportFilter[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [groupByField, setGroupByField] = useState('');

    const [previewData, setPreviewData] = useState<any[]>([]);
    const [totalRows, setTotalRows] = useState(0);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'TABLE' | 'BAR' | 'LINE' | 'PIE'>('TABLE');
    const [activePanel, setActivePanel] = useState<'COLUMNS' | 'FILTERS' | 'SORT'>('COLUMNS');

    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadModules = async () => {
            const { data } = await supabase.from('report_schema_registry').select('module').order('module');
            if (data) {
                const unique = [...new Set(data.map(d => d.module))];
                setModules(unique);
                if (!selectedModule && unique.length > 0) setSelectedModule(unique[0]);
            }
        };
        loadModules();
    }, []);

    useEffect(() => {
        if (!selectedModule) return;
        const loadFields = async () => {
            const { data } = await supabase.from('report_schema_registry').select('*').eq('module', selectedModule).order('field_label');
            if (data && data.length > 0) {
                setAvailableFields(data);
                setSourceTable(data[0].source_table);
                setSelectedColumns([]);
                setFilters([]);
                setSortConfig(null);
                setGroupByField('');
                setPreviewData([]);
            }
        };
        loadFields();
    }, [selectedModule]);

    useEffect(() => {
        if (editReport?.config && availableFields.length > 0) {
            const cfg = editReport.config;
            if (cfg.columns) {
                const cols: SelectedColumn[] = cfg.columns
                    .map((c: any) => {
                        const field = availableFields.find(f => f.field_key === (c.field_key || c));
                        return field ? { field, aggregation: c.aggregation || 'NONE' } : null;
                    })
                    .filter(Boolean);
                setSelectedColumns(cols);
            }
            if (cfg.filters) setFilters(cfg.filters);
            if (cfg.sort) setSortConfig(cfg.sort);
            if (cfg.groupBy) setGroupByField(cfg.groupBy);
        }
    }, [editReport, availableFields]);

    const addColumn = (field: SchemaField) => {
        if (selectedColumns.find(c => c.field.field_key === field.field_key)) return;
        setSelectedColumns(prev => [...prev, { field, aggregation: 'NONE' }]);
    };

    const removeColumn = (idx: number) => {
        setSelectedColumns(prev => prev.filter((_, i) => i !== idx));
    };

    const updateAggregation = (idx: number, agg: SelectedColumn['aggregation']) => {
        setSelectedColumns(prev => prev.map((c, i) => i === idx ? { ...c, aggregation: agg } : c));
    };

    const moveColumn = (from: number, to: number) => {
        if (to < 0 || to >= selectedColumns.length) return;
        const next = [...selectedColumns];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        setSelectedColumns(next);
    };

    const addFilter = () => {
        const filterable = availableFields.filter(f => f.is_filterable);
        if (filterable.length === 0) return;
        setFilters(prev => [...prev, { field_key: filterable[0].field_key, operator: 'eq', value: '' }]);
    };

    const updateFilter = (idx: number, key: string, val: string) => {
        setFilters(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f));
    };

    const removeFilter = (idx: number) => {
        setFilters(prev => prev.filter((_, i) => i !== idx));
    };

    const handlePreview = async () => {
        if (selectedColumns.length === 0) return;
        setLoading(true);
        try {
            const selectStr = selectedColumns.map(c => c.field.field_key).join(',');
            let query = supabase.from(sourceTable).select(selectStr, { count: 'exact' });
            if (companyId) query = query.eq('company_id', companyId);

            for (const f of filters) {
                if (!f.value) continue;
                switch (f.operator) {
                    case 'eq': query = query.eq(f.field_key, f.value); break;
                    case 'neq': query = query.neq(f.field_key, f.value); break;
                    case 'ilike': query = query.ilike(f.field_key, `%${f.value}%`); break;
                    case 'gt': query = query.gt(f.field_key, f.value); break;
                    case 'lt': query = query.lt(f.field_key, f.value); break;
                    case 'gte': query = query.gte(f.field_key, f.value); break;
                    case 'lte': query = query.lte(f.field_key, f.value); break;
                }
            }

            if (sortConfig) query = query.order(sortConfig.field_key, { ascending: sortConfig.direction === 'asc' });

            const { data, count, error } = await query.limit(200);
            if (error) throw error;

            let results = data || [];
            setTotalRows(count || results.length);

            const hasAgg = selectedColumns.some(c => c.aggregation !== 'NONE');
            if (hasAgg && groupByField) {
                results = aggregateData(results);
            } else if (hasAgg && !groupByField) {
                results = [computeSingleAggregate(results)];
            }

            setPreviewData(results);
        } catch (err: any) {
            console.error('Report preview error:', err);
        } finally {
            setLoading(false);
        }
    };

    const aggregateData = (rows: any[]): any[] => {
        const groups: Record<string, any[]> = {};
        for (const row of rows) {
            const key = String(row[groupByField] || 'N/A');
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        }
        return Object.entries(groups).map(([key, groupRows]) => {
            const result: any = { [groupByField]: key };
            for (const col of selectedColumns) {
                if (col.field.field_key === groupByField) continue;
                const vals = groupRows.map(r => parseFloat(r[col.field.field_key]) || 0);
                switch (col.aggregation) {
                    case 'SUM': result[col.field.field_key] = vals.reduce((a, b) => a + b, 0); break;
                    case 'COUNT': result[col.field.field_key] = groupRows.length; break;
                    case 'AVG': result[col.field.field_key] = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0; break;
                    case 'MIN': result[col.field.field_key] = Math.min(...vals); break;
                    case 'MAX': result[col.field.field_key] = Math.max(...vals); break;
                    default: result[col.field.field_key] = groupRows[0]?.[col.field.field_key] ?? '';
                }
            }
            return result;
        });
    };

    const computeSingleAggregate = (rows: any[]): any => {
        const result: any = {};
        for (const col of selectedColumns) {
            const vals = rows.map(r => parseFloat(r[col.field.field_key]) || 0);
            switch (col.aggregation) {
                case 'SUM': result[col.field.field_key] = vals.reduce((a, b) => a + b, 0); break;
                case 'COUNT': result[col.field.field_key] = rows.length; break;
                case 'AVG': result[col.field.field_key] = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0; break;
                case 'MIN': result[col.field.field_key] = Math.min(...vals); break;
                case 'MAX': result[col.field.field_key] = Math.max(...vals); break;
                default: result[col.field.field_key] = rows[0]?.[col.field.field_key] ?? '';
            }
        }
        return result;
    };

    const exportCSV = () => {
        if (previewData.length === 0) return;
        const headers = selectedColumns.map(c => c.field.field_label);
        const keys = selectedColumns.map(c => c.field.field_key);
        const csvRows = [headers.join(',')];
        for (const row of previewData) {
            csvRows.push(keys.map(k => '"' + String(row[k] ?? '').replace(/"/g, '""') + '"').join(','));
        }
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (reportName || 'report') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportPDF = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const headers = selectedColumns.map(c => c.field.field_label);
        const keys = selectedColumns.map(c => c.field.field_key);
        const thCells = headers.map(h => '<th>' + h + '</th>').join('');
        const bodyRows = previewData.map(row => '<tr>' + keys.map(k => '<td>' + (row[k] ?? '-') + '</td>').join('') + '</tr>').join('');
        printWindow.document.write(
            '<html><head><title>' + (reportName || 'Report') + '</title>' +
            '<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:40px;color:#1e293b}' +
            'h1{font-size:24px;margin-bottom:4px}.meta{color:#64748b;font-size:13px;margin-bottom:24px}' +
            'table{width:100%;border-collapse:collapse;font-size:13px}' +
            'th{background:#f1f5f9;padding:10px 12px;text-align:left;font-weight:700;border-bottom:2px solid #e2e8f0}' +
            'td{padding:8px 12px;border-bottom:1px solid #f1f5f9}' +
            'tr:nth-child(even){background:#fafbfc}@media print{body{padding:0}}</style></head><body>' +
            '<h1>' + (reportName || 'Report') + '</h1>' +
            '<div class="meta">' + selectedModule + ' \u00B7 ' + previewData.length + ' rows \u00B7 Generated ' + new Date().toLocaleString() + '</div>' +
            '<table><thead><tr>' + thCells + '</tr></thead><tbody>' + bodyRows + '</tbody></table>' +
            '</body></html>'
        );
        printWindow.document.close();
        printWindow.print();
    };

    const handleSave = async () => {
        if (!reportName || selectedColumns.length === 0) return;
        const config = {
            columns: selectedColumns.map(c => ({ field_key: c.field.field_key, aggregation: c.aggregation })),
            filters, sort: sortConfig, groupBy: groupByField, sourceTable,
        };
        if (editReport?.id) {
            await supabase.from('report_definitions').update({ name: reportName, module: selectedModule, config }).eq('id', editReport.id);
        } else {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from('report_definitions').insert([{
                company_id: companyId, name: reportName, module: selectedModule, config, created_by: user.id
            }]);
        }
        onBack();
    };

    const formatValue = (val: any, dataType: string) => {
        if (val === null || val === undefined) return '\u2014';
        if (dataType === 'currency') return '\u20B9' + Number(val).toLocaleString('en-IN');
        if (dataType === 'date' && val) return new Date(val).toLocaleDateString();
        if (dataType === 'number') return Number(val).toLocaleString();
        return String(val);
    };

    const chartData = previewData.slice(0, 20);
    const numericColumns = selectedColumns.filter(c => ['currency', 'number'].includes(c.field.data_type) || c.aggregation !== 'NONE');
    const labelColumn = selectedColumns.find(c => c.field.data_type === 'text') || selectedColumns[0];

    const moduleLabel = (m: string) => m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950">
            {/* Top Bar */}
            <div className="shrink-0 px-6 py-4 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </button>
                <div className="flex-1">
                    <input value={reportName} onChange={e => setReportName(e.target.value)} placeholder="Untitled Report\u2026"
                        className="text-xl font-bold bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-zinc-600 w-full" />
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{moduleLabel(selectedModule)} \u00B7 {selectedColumns.length} columns</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handlePreview} disabled={selectedColumns.length === 0 || loading}
                        className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center gap-2 disabled:opacity-40">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run
                    </button>
                    <button onClick={handleSave} disabled={!reportName || selectedColumns.length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-40">
                        <Save className="w-4 h-4" /> Save
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar */}
                <div className="w-[300px] shrink-0 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Data Source</label>
                        <select value={selectedModule} onChange={e => setSelectedModule(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20">
                            {modules.map(m => <option key={m} value={m}>{moduleLabel(m)}</option>)}
                        </select>
                    </div>

                    <div className="flex border-b border-slate-100 dark:border-zinc-800">
                        {(['COLUMNS', 'FILTERS', 'SORT'] as const).map(tab => (
                            <button key={tab} onClick={() => setActivePanel(tab)}
                                className={`flex-1 py-2.5 text-xs font-bold tracking-wide transition-colors ${activePanel === tab
                                    ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                                    : 'text-slate-400 hover:text-slate-600'}`}>
                                {tab === 'COLUMNS' && <Columns className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                                {tab === 'FILTERS' && <Filter className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                                {tab === 'SORT' && <SortAsc className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {activePanel === 'COLUMNS' && (
                            <div className="space-y-3">
                                {selectedColumns.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Selected ({selectedColumns.length})</p>
                                        <div className="space-y-1.5">
                                            {selectedColumns.map((col, idx) => (
                                                <div key={idx} className="group flex items-center gap-1.5 p-2 bg-indigo-50 dark:bg-indigo-900/15 border border-indigo-100 dark:border-indigo-800/30 rounded-lg">
                                                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => moveColumn(idx, idx - 1)} className="text-slate-400 hover:text-indigo-600"><ChevronUp className="w-3 h-3" /></button>
                                                        <button onClick={() => moveColumn(idx, idx + 1)} className="text-slate-400 hover:text-indigo-600"><ChevronDown className="w-3 h-3" /></button>
                                                    </div>
                                                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex-1 truncate">{col.field.field_label}</span>
                                                    {['currency', 'number'].includes(col.field.data_type) && (
                                                        <select value={col.aggregation} onChange={e => updateAggregation(idx, e.target.value as any)}
                                                            className="text-[10px] font-bold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1 py-0.5 text-slate-600 dark:text-slate-400 outline-none">
                                                            {Object.entries(AGG_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                                        </select>
                                                    )}
                                                    <button onClick={() => removeColumn(idx)} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedColumns.some(c => c.aggregation !== 'NONE') && (
                                    <div className="mb-4">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Group By</label>
                                        <select value={groupByField} onChange={e => setGroupByField(e.target.value)}
                                            className="w-full p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs font-bold outline-none">
                                            <option value="">No Grouping</option>
                                            {selectedColumns.filter(c => c.field.data_type === 'text').map(c => (
                                                <option key={c.field.field_key} value={c.field.field_key}>{c.field.field_label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Available Fields</p>
                                {availableFields.filter(f => !selectedColumns.find(c => c.field.field_key === f.field_key)).map(field => (
                                    <button key={field.id} onClick={() => addColumn(field)}
                                        className="w-full text-left p-2.5 flex items-center gap-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors group">
                                        <div className={'w-1.5 h-1.5 rounded-full ' + (field.data_type === 'currency' ? 'bg-emerald-400' : field.data_type === 'number' ? 'bg-amber-400' : field.data_type === 'date' ? 'bg-blue-400' : 'bg-slate-300')} />
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex-1">{field.field_label}</span>
                                        <Plus className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {activePanel === 'FILTERS' && (
                            <div className="space-y-3">
                                {filters.map((filter, idx) => (
                                    <div key={idx} className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-indigo-500 uppercase">Filter {idx + 1}</span>
                                            <button onClick={() => removeFilter(idx)}><X className="w-3 h-3 text-slate-400 hover:text-rose-500" /></button>
                                        </div>
                                        <select value={filter.field_key} onChange={e => updateFilter(idx, 'field_key', e.target.value)}
                                            className="w-full p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg text-xs font-bold border border-slate-200 dark:border-zinc-700 outline-none">
                                            {availableFields.filter(f => f.is_filterable).map(f => <option key={f.field_key} value={f.field_key}>{f.field_label}</option>)}
                                        </select>
                                        <div className="flex gap-2">
                                            <select value={filter.operator} onChange={e => updateFilter(idx, 'operator', e.target.value)}
                                                className="w-1/3 p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg text-xs font-bold border border-slate-200 dark:border-zinc-700 outline-none">
                                                {Object.entries(OPERATOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                            </select>
                                            <input value={filter.value} onChange={e => updateFilter(idx, 'value', e.target.value)}
                                                placeholder="Value" className="flex-1 p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg text-xs border border-slate-200 dark:border-zinc-700 outline-none" />
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addFilter} className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors flex items-center justify-center gap-1.5">
                                    <Plus className="w-3.5 h-3.5" /> Add Filter
                                </button>
                            </div>
                        )}

                        {activePanel === 'SORT' && (
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Sort By</label>
                                <select value={sortConfig?.field_key || ''} onChange={e => setSortConfig(e.target.value ? { field_key: e.target.value, direction: sortConfig?.direction || 'asc' } : null)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold outline-none">
                                    <option value="">No Sorting</option>
                                    {availableFields.filter(f => f.is_sortable).map(f => <option key={f.field_key} value={f.field_key}>{f.field_label}</option>)}
                                </select>
                                {sortConfig && (
                                    <div className="flex gap-2">
                                        <button onClick={() => setSortConfig({ ...sortConfig, direction: 'asc' })}
                                            className={'flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ' + (sortConfig.direction === 'asc' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400')}>
                                            <SortAsc className="w-3.5 h-3.5" /> Ascending
                                        </button>
                                        <button onClick={() => setSortConfig({ ...sortConfig, direction: 'desc' })}
                                            className={'flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ' + (sortConfig.direction === 'desc' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400')}>
                                            <SortDesc className="w-3.5 h-3.5" /> Descending
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="shrink-0 px-6 py-3 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 rounded-xl p-1">
                            {([
                                { key: 'TABLE' as const, icon: Table2, label: 'Table' },
                                { key: 'BAR' as const, icon: BarChart3, label: 'Bar' },
                                { key: 'LINE' as const, icon: TrendingUp, label: 'Line' },
                                { key: 'PIE' as const, icon: Hash, label: 'Pie' },
                            ]).map(({ key, icon: Icon, label }) => (
                                <button key={key} onClick={() => setViewMode(key)}
                                    className={'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ' + (viewMode === key ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                                    <Icon className="w-3.5 h-3.5" /> {label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            {previewData.length > 0 && <span className="text-xs font-bold text-slate-400">{previewData.length} of {totalRows} rows</span>}
                            <button onClick={exportCSV} disabled={previewData.length === 0}
                                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5 disabled:opacity-30">
                                <Download className="w-3.5 h-3.5" /> CSV
                            </button>
                            <button onClick={exportPDF} disabled={previewData.length === 0}
                                className="px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1.5 disabled:opacity-30">
                                <Printer className="w-3.5 h-3.5" /> PDF
                            </button>
                        </div>
                    </div>

                    <div ref={printRef} className="flex-1 overflow-auto p-6">
                        {selectedColumns.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                    <Columns className="w-8 h-8 opacity-40" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-1">Select Columns</h3>
                                <p className="text-sm">Choose fields from the left panel to build your report</p>
                            </div>
                        ) : previewData.length === 0 && !loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
                                    <Play className="w-8 h-8 text-indigo-400 opacity-60" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-1">Ready to Run</h3>
                                <p className="text-sm">Click <strong>Run</strong> to preview your report data</p>
                            </div>
                        ) : loading ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                            </div>
                        ) : viewMode === 'TABLE' ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 sticky top-0">
                                        <tr>
                                            <th className="p-3 w-12 text-slate-400 font-bold text-xs">#</th>
                                            {selectedColumns.map(c => (
                                                <th key={c.field.field_key} className="p-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider whitespace-nowrap">
                                                    {c.field.field_label}
                                                    {c.aggregation !== 'NONE' && <span className="ml-1 text-indigo-500">({c.aggregation})</span>}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.map((row, i) => (
                                            <tr key={i} className="border-b border-slate-50 dark:border-zinc-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                                <td className="p-3 text-xs text-slate-400 font-mono">{i + 1}</td>
                                                {selectedColumns.map(c => (
                                                    <td key={c.field.field_key} className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap text-sm">
                                                        {formatValue(row[c.field.field_key], c.field.data_type)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : viewMode === 'PIE' ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 h-[420px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData.map(row => ({
                                                name: String(row[labelColumn?.field.field_key || ''] || ''),
                                                value: numericColumns[0] ? Number(row[numericColumns[0].field.field_key] || 0) : 0
                                            }))}
                                            cx="50%" cy="50%" outerRadius={140} innerRadius={70}
                                            paddingAngle={2} dataKey="value" nameKey="name"
                                            label={({ name, percent }: any) => name + ' (' + (percent * 100).toFixed(0) + '%)'}
                                        >
                                            {chartData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 h-[420px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    {viewMode === 'BAR' ? (
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis dataKey={labelColumn?.field.field_key} tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <Tooltip />
                                            <Legend />
                                            {numericColumns.map((c, i) => (
                                                <Bar key={c.field.field_key} dataKey={c.field.field_key} name={c.field.field_label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[6, 6, 0, 0] as any} />
                                            ))}
                                        </BarChart>
                                    ) : (
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis dataKey={labelColumn?.field.field_key} tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <Tooltip />
                                            <Legend />
                                            {numericColumns.map((c, i) => (
                                                <Line key={c.field.field_key} type="monotone" dataKey={c.field.field_key} name={c.field.field_label} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
                                            ))}
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
