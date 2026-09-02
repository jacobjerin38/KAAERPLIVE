import React, { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, Download, Save, Loader2, DollarSign } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface PayrollVariableInputsModalProps {
    companyId: string;
    monthYear: string;
    payrollRunId?: string;
    isLocked?: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface VariableItem {
    id?: string;
    employee_code: string;
    employee_name?: string;
    employee_id?: string;
    input_type: 'ALLOWANCE' | 'DEDUCTION';
    component_code: string;
    component_name: string;
    component_id?: number;
    amount: number;
    remarks: string;
    status: 'VALID' | 'INVALID' | 'WARNING';
    validation_notes?: string;
}

export const PayrollVariableInputsModal: React.FC<PayrollVariableInputsModalProps> = ({
    companyId,
    monthYear,
    payrollRunId,
    isLocked = false,
    onClose,
    onSuccess
}) => {
    const [activeTab, setActiveTab] = useState<'VIEW' | 'ADD_MANUAL' | 'BULK_UPLOAD'>('VIEW');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [existingInputs, setExistingInputs] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [components, setComponents] = useState<any[]>([]);

    // Manual Form State
    const [manualForm, setManualForm] = useState({
        employee_id: '',
        input_type: 'ALLOWANCE' as 'ALLOWANCE' | 'DEDUCTION',
        component_code: '',
        component_name: '',
        amount: '',
        remarks: ''
    });

    // Bulk Upload State
    const [bulkRows, setBulkRows] = useState<VariableItem[]>([]);
    const [csvText, setCsvText] = useState('');

    useEffect(() => {
        loadData();
    }, [companyId, monthYear]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load Employees
            const { data: emps } = await supabase.from('employees')
                .select('id, name, employee_code')
                .eq('company_id', companyId)
                .eq('status', 'Active');
            setEmployees(emps || []);

            // Load Salary Components
            const { data: comps } = await supabase.from('org_salary_components')
                .select('*')
                .eq('company_id', companyId);
            setComponents(comps || []);

            // Load Existing Variable Inputs for this month
            const { data: inputs } = await supabase.from('payroll_variable_inputs')
                .select('*')
                .eq('company_id', companyId)
                .eq('month_year', monthYear)
                .order('created_at', { ascending: false });
            setExistingInputs(inputs || []);
        } catch (err) {
            console.error('Error loading variable inputs data:', err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate Summaries
    const totalAllowances = existingInputs
        .filter(i => i.input_type === 'ALLOWANCE')
        .reduce((sum, i) => sum + Number(i.amount || 0), 0);

    const totalDeductions = existingInputs
        .filter(i => i.input_type === 'DEDUCTION')
        .reduce((sum, i) => sum + Number(i.amount || 0), 0);

    // Handle Manual Add
    const handleSaveManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLocked) return alert('Payroll variable inputs are locked for this month.');
        if (!manualForm.employee_id) return alert('Please select an employee.');
        const amt = parseFloat(manualForm.amount);
        if (isNaN(amt) || amt <= 0) return alert('Please enter a valid positive amount.');

        const emp = employees.find(e => e.id === manualForm.employee_id);
        const comp = components.find(c => c.code === manualForm.component_code);

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const insertPayload = {
                company_id: companyId,
                month_year: monthYear,
                payroll_run_id: payrollRunId || null,
                employee_id: manualForm.employee_id,
                employee_code: emp?.employee_code || null,
                employee_name: emp?.name || null,
                input_type: manualForm.input_type,
                component_id: comp?.id || null,
                component_code: manualForm.component_code || (manualForm.input_type === 'ALLOWANCE' ? 'VAR_ALLOW' : 'VAR_DEDUCT'),
                component_name: manualForm.component_name || (manualForm.input_type === 'ALLOWANCE' ? 'Variable Allowance' : 'Variable Deduction'),
                amount: amt,
                remarks: manualForm.remarks || null,
                status: 'VALID',
                created_by: user?.id
            };

            const { error } = await supabase.from('payroll_variable_inputs').insert([insertPayload]);
            if (error) throw error;

            setManualForm({
                employee_id: '',
                input_type: 'ALLOWANCE',
                component_code: '',
                component_name: '',
                amount: '',
                remarks: ''
            });

            await loadData();
            setActiveTab('VIEW');
            onSuccess();
        } catch (err: any) {
            alert('Error adding variable input: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Handle Delete
    const handleDeleteInput = async (id: string) => {
        if (isLocked) return alert('Payroll variable inputs are locked for this month.');
        if (!confirm('Are you sure you want to remove this entry?')) return;

        try {
            const { error } = await supabase.from('payroll_variable_inputs').delete().eq('id', id);
            if (error) throw error;
            await loadData();
            onSuccess();
        } catch (err: any) {
            alert('Error deleting: ' + err.message);
        }
    };

    // Parse and Validate CSV / Paste
    const handleParseBulkData = () => {
        if (!csvText.trim()) return alert('Paste CSV data first.');

        const lines = csvText.trim().split('\n');
        const parsed: VariableItem[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            // Skip header if present
            if (i === 0 && line.toLowerCase().includes('employee')) continue;

            const parts = line.split(',').map(s => s.trim());
            const empCode = parts[0] || '';
            const typeRaw = (parts[1] || 'ALLOWANCE').toUpperCase();
            const inputType: 'ALLOWANCE' | 'DEDUCTION' = typeRaw.includes('DEDUCT') ? 'DEDUCTION' : 'ALLOWANCE';
            const compCode = parts[2] || (inputType === 'ALLOWANCE' ? 'OTHER' : 'PENALTY');
            const compName = parts[3] || compCode;
            const amt = parseFloat(parts[4] || '0');
            const remarks = parts[5] || '';

            // Validate
            let status: 'VALID' | 'INVALID' | 'WARNING' = 'VALID';
            let notes = '';

            const matchedEmp = employees.find(e => 
                (e.employee_code && e.employee_code.toLowerCase() === empCode.toLowerCase()) ||
                (e.name && e.name.toLowerCase() === empCode.toLowerCase())
            );

            if (!matchedEmp) {
                status = 'INVALID';
                notes = `Employee '${empCode}' not found.`;
            } else if (isNaN(amt) || amt <= 0) {
                status = 'INVALID';
                notes = 'Amount must be greater than 0.';
            }

            parsed.push({
                employee_code: empCode,
                employee_name: matchedEmp?.name,
                employee_id: matchedEmp?.id,
                input_type: inputType,
                component_code: compCode,
                component_name: compName,
                amount: isNaN(amt) ? 0 : amt,
                remarks: remarks,
                status: status,
                validation_notes: notes
            });
        }

        setBulkRows(parsed);
    };

    // Save Bulk Rows
    const handleSaveBulk = async () => {
        if (isLocked) return alert('Payroll variable inputs are locked for this month.');
        const validRows = bulkRows.filter(r => r.status === 'VALID');
        if (validRows.length === 0) return alert('No valid rows found to import.');

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const payloads = validRows.map(r => ({
                company_id: companyId,
                month_year: monthYear,
                payroll_run_id: payrollRunId || null,
                employee_id: r.employee_id,
                employee_code: r.employee_code,
                employee_name: r.employee_name,
                input_type: r.input_type,
                component_code: r.component_code,
                component_name: r.component_name,
                amount: r.amount,
                remarks: r.remarks,
                status: 'VALID',
                created_by: user?.id
            }));

            const { error } = await supabase.from('payroll_variable_inputs').insert(payloads);
            if (error) throw error;

            alert(`Successfully imported ${validRows.length} variable inputs.`);
            setCsvText('');
            setBulkRows([]);
            await loadData();
            setActiveTab('VIEW');
            onSuccess();
        } catch (err: any) {
            alert('Error saving bulk inputs: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Download Sample CSV
    const handleDownloadTemplate = () => {
        const header = "EmployeeCode,InputType(ALLOWANCE/DEDUCTION),ComponentCode,ComponentName,Amount,Remarks\r\n";
        const sample1 = "EMP001,ALLOWANCE,BONUS,Project Performance Bonus,500.00,August Milestone\r\n";
        const sample2 = "EMP002,DEDUCTION,PHONE,Mobile Bill Excess,120.00,Official limit exceeded\r\n";
        const content = "data:text/csv;charset=utf-8," + header + sample1 + sample2;
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(content));
        link.setAttribute("download", `Variable_Inputs_Template_${monthYear}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-zinc-800 flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                Variable Allowances & Deductions
                                <span className="text-xs px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold">
                                    {monthYear}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Manage ad-hoc monthly additions, allowances, penalties and deductions</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Sub-Tabs */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('VIEW')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'VIEW' ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}
                        >
                            Existing Items ({existingInputs.length})
                        </button>
                        {!isLocked && (
                            <>
                                <button
                                    onClick={() => setActiveTab('ADD_MANUAL')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'ADD_MANUAL' ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Individual
                                </button>
                                <button
                                    onClick={() => setActiveTab('BULK_UPLOAD')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'BULK_UPLOAD' ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}
                                >
                                    <Upload className="w-3.5 h-3.5" /> Bulk Upload CSV
                                </button>
                            </>
                        )}
                    </div>

                    {/* Financial Totals */}
                    <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg">
                            +Allowances: QAR {totalAllowances.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-lg">
                            -Deductions: QAR {totalDeductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                        </div>
                    ) : activeTab === 'VIEW' ? (
                        existingInputs.length === 0 ? (
                            <div className="text-center py-16">
                                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">No Variable Inputs For {monthYear}</h4>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                    Upload project bonuses, food/transport allowances, expense reimbursements, or disciplinary deductions.
                                </p>
                                {!isLocked && (
                                    <div className="flex justify-center gap-3 mt-5">
                                        <button onClick={() => setActiveTab('ADD_MANUAL')} className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl">
                                            Add Entry
                                        </button>
                                        <button onClick={() => setActiveTab('BULK_UPLOAD')} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl">
                                            Bulk Import CSV
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-400 uppercase font-bold sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3">Employee</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Component</th>
                                        <th className="px-4 py-3 text-right">Amount (QAR)</th>
                                        <th className="px-4 py-3">Remarks</th>
                                        {!isLocked && <th className="px-4 py-3 text-right">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {existingInputs.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-slate-800 dark:text-slate-200">{item.employee_name || item.employee_code}</p>
                                                <p className="text-[10px] text-slate-400">{item.employee_code}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${item.input_type === 'ALLOWANCE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    {item.input_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                {item.component_name} ({item.component_code})
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                                                {item.remarks || '-'}
                                            </td>
                                            {!isLocked && (
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => handleDeleteInput(item.id)} className="p-1 text-slate-400 hover:text-rose-600 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : activeTab === 'ADD_MANUAL' ? (
                        <form onSubmit={handleSaveManual} className="max-w-xl mx-auto space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Employee *</label>
                                <select
                                    required
                                    value={manualForm.employee_id}
                                    onChange={e => setManualForm({ ...manualForm, employee_id: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none"
                                >
                                    <option value="">Select Employee...</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Input Type *</label>
                                    <select
                                        value={manualForm.input_type}
                                        onChange={e => setManualForm({ ...manualForm, input_type: e.target.value as any })}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none font-bold"
                                    >
                                        <option value="ALLOWANCE">ALLOWANCE (+ Earning)</option>
                                        <option value="DEDUCTION">DEDUCTION (- Deduction)</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Amount (QAR) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="0.00"
                                        value={manualForm.amount}
                                        onChange={e => setManualForm({ ...manualForm, amount: e.target.value })}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none font-mono font-bold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Component / Purpose</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Project Bonus, Food Allowance, Traffic Fine, Excess Phone"
                                    value={manualForm.component_name}
                                    onChange={e => setManualForm({ ...manualForm, component_name: e.target.value, component_code: e.target.value.replace(/\s+/g, '_').toUpperCase().slice(0, 15) })}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Remarks / Reference</label>
                                <textarea
                                    value={manualForm.remarks}
                                    onChange={e => setManualForm({ ...manualForm, remarks: e.target.value })}
                                    placeholder="Optional notes or voucher reference..."
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none h-20 resize-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-violet-700 transition-all flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Variable Item
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/20 p-4 rounded-2xl border border-violet-200 dark:border-violet-800">
                                <div>
                                    <h4 className="text-sm font-bold text-violet-900 dark:text-violet-300">Bulk CSV Upload</h4>
                                    <p className="text-xs text-violet-700 dark:text-violet-400">Format: EmployeeCode, InputType, ComponentCode, ComponentName, Amount, Remarks</p>
                                </div>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-violet-300 text-violet-700 dark:text-violet-300 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm hover:bg-violet-50"
                                >
                                    <Download className="w-3.5 h-3.5" /> Download Template
                                </button>
                            </div>

                            <div className="space-y-2">
                                <textarea
                                    value={csvText}
                                    onChange={e => setCsvText(e.target.value)}
                                    placeholder="Paste comma-separated rows or CSV text here...&#10;e.g.&#10;EMP001, ALLOWANCE, BONUS, Site Bonus, 500, Approved by PM&#10;EMP002, DEDUCTION, PENALTY, Safety Violation, 150, HSE Report #12"
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono outline-none h-32"
                                />
                                <button
                                    onClick={handleParseBulkData}
                                    className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-black transition-all"
                                >
                                    Parse & Validate Rows
                                </button>
                            </div>

                            {bulkRows.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">Validation Results ({bulkRows.length} Rows)</h5>
                                        <button
                                            onClick={handleSaveBulk}
                                            disabled={saving || bulkRows.filter(r => r.status === 'VALID').length === 0}
                                            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            Commit Valid Rows ({bulkRows.filter(r => r.status === 'VALID').length})
                                        </button>
                                    </div>

                                    <table className="w-full text-left text-xs border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                                        <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-500 uppercase font-bold">
                                            <tr>
                                                <th className="p-2.5">Status</th>
                                                <th className="p-2.5">Emp Code</th>
                                                <th className="p-2.5">Resolved Name</th>
                                                <th className="p-2.5">Type</th>
                                                <th className="p-2.5">Component</th>
                                                <th className="p-2.5 text-right">Amount</th>
                                                <th className="p-2.5">Notes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-mono">
                                            {bulkRows.map((row, idx) => (
                                                <tr key={idx} className={row.status === 'INVALID' ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''}>
                                                    <td className="p-2.5">
                                                        {row.status === 'VALID' ? (
                                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                                                                <CheckCircle2 className="w-3 h-3" /> VALID
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                                                                <XCircle className="w-3 h-3" /> INVALID
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-2.5 font-bold">{row.employee_code}</td>
                                                    <td className="p-2.5">{row.employee_name || '-'}</td>
                                                    <td className="p-2.5">{row.input_type}</td>
                                                    <td className="p-2.5">{row.component_name}</td>
                                                    <td className="p-2.5 text-right font-bold">{row.amount}</td>
                                                    <td className="p-2.5 text-rose-600 text-[11px]">{row.validation_notes || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
