import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Calendar, Plus, Lock, Unlock, ChevronDown, ChevronRight } from 'lucide-react';
import { Modal } from '../../../ui/Modal';

export const FiscalYears: React.FC = () => {
    const [years, setYears] = useState<any[]>([]);
    const [isYearModalOpen, setIsYearModalOpen] = useState(false);
    const [expandedYear, setExpandedYear] = useState<string | null>(null);
    
    // New Year Form
    const [newYear, setNewYear] = useState({
        name: '',
        start_date: '',
        end_date: ''
    });

    useEffect(() => {
        fetchYears();
    }, []);

    const fetchYears = async () => {
        const { data, error } = await supabase
            .from('fiscal_years')
            .select(`
                *,
                periods:accounting_periods(*)
            `)
            .order('start_date', { ascending: false });
        
        if (error) console.error(error);
        else setYears(data || []);
    };

    const handleCreateYear = async () => {
        const { data: yearData, error } = await supabase
            .from('fiscal_years')
            .insert([newYear])
            .select()
            .single();

        if (error) {
            alert('Error: ' + error.message);
            return;
        }

        // Auto-generate periods?
        // For simplicity, let's just create the year first. 
        // A real ERP would ask "Generate Monthly Periods?"
        
        // Let's simple gen standard 12 months
        // Logic omitted for brevity, user can add manually or we add a "Generate Periods" button later.
        
        setIsYearModalOpen(false);
        fetchYears();
    };

    const togglePeriodStatus = async (periodId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Open' ? 'Closed' : 'Open';
        const { error } = await supabase
            .from('accounting_periods')
            .update({ status: newStatus })
            .eq('id', periodId);
            
        if (!error) fetchYears();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Fiscal Years & Periods</h3>
                    <p className="text-sm text-slate-500">Manage financial reporting years and lock periods.</p>
                </div>
                <button 
                    onClick={() => setIsYearModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    <Plus className="w-4 h-4" /> New Fiscal Year
                </button>
            </div>

            <div className="space-y-4">
                {years.map(year => (
                    <div key={year.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        <div 
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                            onClick={() => setExpandedYear(expandedYear === year.id ? null : year.id)}
                        >
                            <div className="flex items-center gap-4">
                                {expandedYear === year.id ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                                <div>
                                    <div className="font-semibold text-slate-800 dark:text-white">{year.name}</div>
                                    <div className="text-xs text-slate-500">{year.start_date} to {year.end_date}</div>
                                </div>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-bold ${year.is_closed ? 'bg-slate-100 text-slate-600 ms-3' : 'bg-green-100 text-green-700'}`}>
                                {year.is_closed ? 'CLOSED' : 'OPEN'}
                            </div>
                        </div>

                        {expandedYear === year.id && (
                            <div className="border-t border-slate-100 dark:border-zinc-800 p-4 bg-slate-50 dark:bg-zinc-900/50">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Accounting Periods</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {(year.periods || []).sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()).map((period: any) => (
                                        <div key={period.id} className="bg-white dark:bg-zinc-800 p-3 rounded border border-slate-200 dark:border-zinc-700 flex justify-between items-center">
                                            <div>
                                                <div className="font-medium text-slate-800 dark:text-white">{period.name}</div>
                                                <div className="text-xs text-slate-500">{period.code}</div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); togglePeriodStatus(period.id, period.status); }}
                                                className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 ${period.status === 'Open' ? 'text-green-600' : 'text-slate-400'}`}
                                                title={period.status === 'Open' ? 'Lock Period' : 'Unlock Period'}
                                            >
                                                {period.status === 'Open' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    ))}
                                    {(!year.periods || year.periods.length === 0) && (
                                        <div className="col-span-full text-center py-6 text-slate-400 italic">
                                            No periods found. <button className="text-indigo-600 hover:underline">Generate Periods</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {isYearModalOpen && (
                <Modal title="Create Fiscal Year" onClose={() => setIsYearModalOpen(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Fiscal Year Name</label>
                            <input 
                                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                placeholder="e.g. FY 2026-2027"
                                value={newYear.name}
                                onChange={e => setNewYear({...newYear, name: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Start Date</label>
                                <input 
                                    type="date"
                                    className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                    value={newYear.start_date}
                                    onChange={e => setNewYear({...newYear, start_date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">End Date</label>
                                <input 
                                    type="date"
                                    className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
                                    value={newYear.end_date}
                                    onChange={e => setNewYear({...newYear, end_date: e.target.value})}
                                />
                            </div>
                        </div>
                        <button onClick={handleCreateYear} className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Create Fiscal Year</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};
