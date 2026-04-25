import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { CalendarDays, Plus, Trash2, Edit3, X, Check, Star, Loader2, RotateCcw } from 'lucide-react';

interface Holiday {
    id: string;
    name: string;
    date: string;
    type: string;
    applicable_to: string;
    is_recurring: boolean;
}

export const HolidayCalendar: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', date: '', type: 'Public', applicable_to: 'All', is_recurring: false });
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (currentCompanyId) fetchHolidays();
    }, [currentCompanyId, selectedYear]);

    const fetchHolidays = async () => {
        setLoading(true);
        const startDate = `${selectedYear}-01-01`;
        const endDate = `${selectedYear}-12-31`;
        const { data } = await supabase
            .from('holidays')
            .select('*')
            .eq('company_id', currentCompanyId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date');
        setHolidays(data || []);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!form.name || !form.date) return alert('Name and Date are required.');
        const payload = { ...form, company_id: currentCompanyId };

        if (editingId) {
            const { error } = await supabase.from('holidays').update(payload).eq('id', editingId);
            if (error) return alert(error.message);
        } else {
            const { error } = await supabase.from('holidays').insert([payload]);
            if (error) return alert(error.message);
        }
        setShowForm(false);
        setEditingId(null);
        setForm({ name: '', date: '', type: 'Public', applicable_to: 'All', is_recurring: false });
        fetchHolidays();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this holiday?')) return;
        await supabase.from('holidays').delete().eq('id', id);
        fetchHolidays();
    };

    const handleEdit = (h: Holiday) => {
        setForm({ name: h.name, date: h.date, type: h.type, applicable_to: h.applicable_to, is_recurring: h.is_recurring });
        setEditingId(h.id);
        setShowForm(true);
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Public': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'Optional': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Restricted': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Group holidays by month
    const groupedByMonth: { [key: number]: Holiday[] } = {};
    holidays.forEach(h => {
        const month = new Date(h.date).getMonth();
        if (!groupedByMonth[month]) groupedByMonth[month] = [];
        groupedByMonth[month].push(h);
    });

    return (
        <div className="space-y-6 animate-page-enter">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <CalendarDays className="w-6 h-6 text-rose-500" /> Holiday Calendar
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Manage company holidays and observances</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-4 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none"
                    >
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button
                        onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', date: '', type: 'Public', applicable_to: 'All', is_recurring: false }); }}
                        className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Add Holiday
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Holidays</p>
                    <h4 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{holidays.length}</h4>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Public</p>
                    <h4 className="text-3xl font-black text-emerald-600 mt-1">{holidays.filter(h => h.type === 'Public').length}</h4>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Optional</p>
                    <h4 className="text-3xl font-black text-amber-600 mt-1">{holidays.filter(h => h.type === 'Optional').length}</h4>
                </div>
            </div>

            {/* Month-wise Layout */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-rose-500 animate-spin" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {monthNames.map((monthName, idx) => (
                        <div key={idx} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800">
                                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">{monthName}</h4>
                            </div>
                            <div className="p-4 space-y-2 min-h-[80px]">
                                {(groupedByMonth[idx] || []).length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-4 text-center">No holidays</p>
                                ) : (
                                    (groupedByMonth[idx] || []).map(h => (
                                        <div key={h.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl group hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-lg flex flex-col items-center justify-center border border-slate-200 dark:border-zinc-700 shadow-sm">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">
                                                        {new Date(h.date).toLocaleDateString('en', { month: 'short' })}
                                                    </span>
                                                    <span className="text-sm font-black text-slate-800 dark:text-white leading-none">
                                                        {new Date(h.date).getDate()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                                        {h.name}
                                                        {h.is_recurring && <RotateCcw className="w-3 h-3 text-slate-400" />}
                                                    </p>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getTypeColor(h.type)}`}>{h.type}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(h)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit3 className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDelete(h.id)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingId ? 'Edit' : 'Add'} Holiday</h3>
                            <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Holiday Name</label>
                                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                                    placeholder="e.g., National Day" className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500/20" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500/20" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Type</label>
                                    <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none">
                                        <option value="Public">Public</option>
                                        <option value="Optional">Optional</option>
                                        <option value="Restricted">Restricted</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Applicable To</label>
                                    <select value={form.applicable_to} onChange={e => setForm({...form, applicable_to: e.target.value})}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none">
                                        <option value="All">All Employees</option>
                                        <option value="Management">Management</option>
                                        <option value="Operations">Operations</option>
                                    </select>
                                </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.is_recurring} onChange={e => setForm({...form, is_recurring: e.target.checked})}
                                    className="w-4 h-4 text-rose-600 rounded" />
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Recurring every year</span>
                            </label>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-xl font-bold text-sm">Cancel</button>
                            <button onClick={handleSave} className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all flex items-center gap-2">
                                <Check className="w-4 h-4" /> Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
