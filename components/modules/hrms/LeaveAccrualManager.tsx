import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Wallet, Loader2, Play, CheckCircle, Settings, Plus, Edit3, Trash2, X, Save } from 'lucide-react';

interface AccrualRule {
    id: string;
    leave_type_id: number;
    accrual_frequency: string;
    accrual_amount: number;
    max_balance: number;
    carry_forward: boolean;
    carry_forward_max: number;
    is_active: boolean;
}

interface LeaveBalance {
    id: string;
    employee_id: string;
    leave_type_id: number;
    year: number;
    opening_balance: number;
    accrued: number;
    used: number;
    adjusted: number;
    closing_balance: number;
    employee?: { name: string; employee_code: string };
}

export const LeaveAccrualManager: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [activeTab, setActiveTab] = useState<'RULES' | 'BALANCES'>('RULES');
    const [loading, setLoading] = useState(true);
    const [rules, setRules] = useState<AccrualRule[]>([]);
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [editingRule, setEditingRule] = useState<AccrualRule | null>(null);
    const [ruleForm, setRuleForm] = useState({
        leave_type_id: 0, accrual_frequency: 'Monthly', accrual_amount: 1.5,
        max_balance: 30, carry_forward: false, carry_forward_max: 5, is_active: true
    });
    const [runningAccrual, setRunningAccrual] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (currentCompanyId) {
            fetchLeaveTypes();
            fetchRules();
        }
    }, [currentCompanyId]);

    useEffect(() => {
        if (currentCompanyId && activeTab === 'BALANCES') fetchBalances();
    }, [currentCompanyId, activeTab, selectedYear]);

    const fetchLeaveTypes = async () => {
        const { data } = await supabase.from('org_leave_types').select('id, name, code').eq('company_id', currentCompanyId);
        setLeaveTypes(data || []);
    };

    const fetchRules = async () => {
        setLoading(true);
        const { data } = await supabase.from('leave_accrual_rules').select('*').eq('company_id', currentCompanyId);
        setRules(data || []);
        setLoading(false);
    };

    const fetchBalances = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('leave_balances')
            .select('*, employee:employees(name, employee_code)')
            .eq('company_id', currentCompanyId)
            .eq('year', selectedYear)
            .order('employee_id');
        setBalances(data || []);
        setLoading(false);
    };

    const handleSaveRule = async () => {
        if (!ruleForm.leave_type_id) return alert('Select a leave type.');
        const payload = { ...ruleForm, company_id: currentCompanyId };
        if (editingRule) {
            const { error } = await supabase.from('leave_accrual_rules').update(payload).eq('id', editingRule.id);
            if (error) return alert(error.message);
        } else {
            const { error } = await supabase.from('leave_accrual_rules').insert([payload]);
            if (error) return alert(error.message);
        }
        setShowRuleForm(false);
        setEditingRule(null);
        fetchRules();
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm('Delete this accrual rule?')) return;
        await supabase.from('leave_accrual_rules').delete().eq('id', id);
        fetchRules();
    };

    const handleRunAccrual = async () => {
        if (!confirm(`Run monthly accrual for all active employees? This will add leave credits for ${selectedYear}.`)) return;
        setRunningAccrual(true);
        try {
            const { data, error } = await supabase.rpc('rpc_run_leave_accrual', {
                p_company_id: currentCompanyId,
                p_year: selectedYear
            });
            if (error) throw error;
            alert(`Accrual processed successfully! ${data} records updated.`);
            fetchBalances();
        } catch (err: any) {
            alert('Error running accrual: ' + err.message);
        } finally {
            setRunningAccrual(false);
        }
    };

    const getLeaveTypeName = (id: number) => leaveTypes.find(lt => lt.id === id)?.name || `Type #${id}`;

    return (
        <div className="space-y-6 animate-page-enter">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-emerald-500" /> Leave Accrual & Balances
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Configure auto-accrual rules and track employee leave balances</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-100 dark:border-zinc-800">
                <button onClick={() => setActiveTab('RULES')}
                    className={`pb-3 text-sm font-bold relative transition-all ${activeTab === 'RULES' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    Accrual Rules
                    {activeTab === 'RULES' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />}
                </button>
                <button onClick={() => setActiveTab('BALANCES')}
                    className={`pb-3 text-sm font-bold relative transition-all ${activeTab === 'BALANCES' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    Employee Balances
                    {activeTab === 'BALANCES' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />}
                </button>
            </div>

            {/* RULES Tab */}
            {activeTab === 'RULES' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => { setShowRuleForm(true); setEditingRule(null); setRuleForm({ leave_type_id: 0, accrual_frequency: 'Monthly', accrual_amount: 1.5, max_balance: 30, carry_forward: false, carry_forward_max: 5, is_active: true }); }}
                            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Add Rule
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                    ) : rules.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <Settings className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-bold">No accrual rules configured</p>
                            <p className="text-sm mt-1">Create rules to auto-credit leave days monthly or yearly.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {rules.map(rule => (
                                <div key={rule.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 group hover:shadow-lg transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-white">{getLeaveTypeName(rule.leave_type_id)}</h4>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {rule.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingRule(rule); setRuleForm(rule as any); setShowRuleForm(true); }} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit3 className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div className="bg-slate-50 dark:bg-zinc-800 rounded-lg p-2">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Frequency</p>
                                            <p className="text-sm font-black text-slate-800 dark:text-white">{rule.accrual_frequency}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-zinc-800 rounded-lg p-2">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Credit / Period</p>
                                            <p className="text-sm font-black text-emerald-600">{rule.accrual_amount} days</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-zinc-800 rounded-lg p-2">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Max Balance</p>
                                            <p className="text-sm font-black text-slate-800 dark:text-white">{rule.max_balance} days</p>
                                        </div>
                                    </div>
                                    {rule.carry_forward && (
                                        <p className="text-xs text-indigo-500 font-medium mt-2">↪ Carry forward up to {rule.carry_forward_max} days</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* BALANCES Tab */}
            {activeTab === 'BALANCES' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                            className="px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none">
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button onClick={handleRunAccrual} disabled={runningAccrual}
                            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-60">
                            {runningAccrual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            {runningAccrual ? 'Processing...' : 'Run Monthly Accrual'}
                        </button>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-zinc-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4">Leave Type</th>
                                    <th className="px-6 py-4 text-center">Opening</th>
                                    <th className="px-6 py-4 text-center text-emerald-600">Accrued</th>
                                    <th className="px-6 py-4 text-center text-rose-600">Used</th>
                                    <th className="px-6 py-4 text-center">Adjusted</th>
                                    <th className="px-6 py-4 text-center font-bold">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {loading ? (
                                    <tr><td colSpan={7} className="py-20 text-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" /></td></tr>
                                ) : balances.length === 0 ? (
                                    <tr><td colSpan={7} className="py-16 text-center text-slate-400">No leave balances found for {selectedYear}. Run accrual to initialize.</td></tr>
                                ) : balances.map(b => (
                                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-3">
                                            <p className="font-bold text-sm text-slate-700 dark:text-slate-200">{b.employee?.name}</p>
                                            <p className="text-[10px] text-slate-400">{b.employee?.employee_code}</p>
                                        </td>
                                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{getLeaveTypeName(b.leave_type_id)}</td>
                                        <td className="px-6 py-3 text-center font-mono text-sm">{b.opening_balance}</td>
                                        <td className="px-6 py-3 text-center font-mono text-sm text-emerald-600 font-bold">+{b.accrued}</td>
                                        <td className="px-6 py-3 text-center font-mono text-sm text-rose-500 font-bold">-{b.used}</td>
                                        <td className="px-6 py-3 text-center font-mono text-sm text-slate-500">{b.adjusted}</td>
                                        <td className="px-6 py-3 text-center">
                                            <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-black">
                                                {b.closing_balance}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Rule Form Modal */}
            {showRuleForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold">{editingRule ? 'Edit' : 'New'} Accrual Rule</h3>
                            <button onClick={() => setShowRuleForm(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Leave Type</label>
                                <select value={ruleForm.leave_type_id} onChange={e => setRuleForm({...ruleForm, leave_type_id: Number(e.target.value)})}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none">
                                    <option value={0}>Select Leave Type</option>
                                    {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Frequency</label>
                                    <select value={ruleForm.accrual_frequency} onChange={e => setRuleForm({...ruleForm, accrual_frequency: e.target.value})}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none">
                                        <option value="Monthly">Monthly</option>
                                        <option value="Yearly">Yearly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Days / Period</label>
                                    <input type="number" step="0.5" min="0.5" value={ruleForm.accrual_amount} onChange={e => setRuleForm({...ruleForm, accrual_amount: Number(e.target.value)})}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Max Balance (days)</label>
                                <input type="number" step="1" min="1" value={ruleForm.max_balance} onChange={e => setRuleForm({...ruleForm, max_balance: Number(e.target.value)})}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none" />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={ruleForm.carry_forward} onChange={e => setRuleForm({...ruleForm, carry_forward: e.target.checked})} className="w-4 h-4 rounded text-emerald-600" />
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Allow carry forward</span>
                            </label>
                            {ruleForm.carry_forward && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Max Carry Forward (days)</label>
                                    <input type="number" step="0.5" min="0" value={ruleForm.carry_forward_max} onChange={e => setRuleForm({...ruleForm, carry_forward_max: Number(e.target.value)})}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none" />
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                            <button onClick={() => setShowRuleForm(false)} className="px-5 py-2.5 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-xl font-bold text-sm">Cancel</button>
                            <button onClick={handleSaveRule} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 flex items-center gap-2">
                                <Save className="w-4 h-4" /> Save Rule
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
