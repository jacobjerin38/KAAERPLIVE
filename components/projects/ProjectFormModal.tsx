import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Building2, User, Calendar, DollarSign, Tag, Layers } from 'lucide-react';
import { createProjectRecord } from './projectService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ProjectFormModalProps {
    clients: any[];
    deals: any[];
    employees: any[];
    proposals: any[];
    onClose: () => void;
    onSuccess: (newProj: any) => void;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
    clients,
    deals,
    employees,
    proposals,
    onClose,
    onSuccess
}) => {
    const { currentCompanyId, user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form fields
    const [name, setName] = useState('');
    const [clientId, setClientId] = useState('');
    const [dealId, setDealId] = useState('');
    const [lpoNumber, setLpoNumber] = useState('');
    const [lpoCost, setLpoCost] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [projectManagerId, setProjectManagerId] = useState('');
    const [projectCategoryId, setProjectCategoryId] = useState('');
    const [projectTypeId, setProjectTypeId] = useState('');
    const [costCenterId, setCostCenterId] = useState('');
    const [technicalProposalId, setTechnicalProposalId] = useState('');
    const [commercialProposalId, setCommercialProposalId] = useState('');
    const [remarks, setRemarks] = useState('');
    const [lpoFile, setLpoFile] = useState<File | null>(null);

    // Master options
    const [categories, setCategories] = useState<any[]>([]);
    const [types, setTypes] = useState<any[]>([]);
    const [costCenters, setCostCenters] = useState<any[]>([]);

    useEffect(() => {
        if (currentCompanyId) {
            fetchMasters();
        }
    }, [currentCompanyId]);

    const fetchMasters = async () => {
        try {
            const { data: catData } = await supabase.from('org_project_categories').select('*').eq('company_id', currentCompanyId);
            if (catData) setCategories(catData);

            const { data: typeData } = await supabase.from('org_project_types').select('*').eq('company_id', currentCompanyId);
            if (typeData) setTypes(typeData);

            const { data: ccData } = await supabase.from('accounting_cost_centers').select('*').eq('company_id', currentCompanyId);
            if (ccData) setCostCenters(ccData);
        } catch (err) {
            console.error('Error fetching project masters:', err);
        }
    };

    // Filter proposals
    const techProposals = proposals.filter(p => p.proposal_type === 'TECHNICAL');
    const commProposals = proposals.filter(p => p.proposal_type === 'COMMERCIAL');

    const canSubmit = !!name.trim() && !!lpoNumber.trim() && !!projectManagerId && !!startDate && !!endDate && !!lpoFile;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId) return;

        if (!canSubmit) {
            setError('Please fill in all mandatory fields and attach the LPO document.');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            setError('Start Date cannot be later than End Date.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const proj = await createProjectRecord({
                companyId: currentCompanyId,
                name: name.trim(),
                clientId: clientId || null,
                dealId: dealId ? Number(dealId) : null,
                lpoNumber: lpoNumber.trim(),
                lpoFile,
                lpoCost: Number(lpoCost) || 0,
                startDate,
                endDate,
                projectManagerId,
                projectCategoryId: projectCategoryId || null,
                projectTypeId: projectTypeId || null,
                costCenterId: costCenterId || null,
                technicalProposalId: technicalProposalId || null,
                commercialProposalId: commercialProposalId || null,
                remarks: remarks.trim() || null,
                createdBy: user?.id || '00000000-0000-0000-0000-000000000000'
            });

            onSuccess(proj);
        } catch (err: any) {
            console.error('Error creating project:', err);
            setError(err.message || 'Failed to create project');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-3xl p-6 sm:p-8 shadow-2xl relative animate-slide-up border border-slate-100 dark:border-zinc-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                Project Setup
                            </span>
                            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                                Create New Project
                            </h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Register a new project with client LPO, assign the Project Manager, and initialize mandatory document compliance.
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Project Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Project Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. EPC Turnkey Transmission Substation Protection Overhaul"
                            className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                        />
                    </div>

                    {/* Client & CRM Deal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Client / Customer
                            </label>
                            <select
                                value={clientId}
                                onChange={e => setClientId(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            >
                                <option value="">— Select Client —</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Linked CRM Deal / Opportunity
                            </label>
                            <select
                                value={dealId}
                                onChange={e => setDealId(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            >
                                <option value="">— Select CRM Deal (Optional) —</option>
                                {deals.map(d => (
                                    <option key={d.id} value={d.id}>{d.title} ({d.company || 'CRM'})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* LPO Number & LPO Cost */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Client LPO Number <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={lpoNumber}
                                onChange={e => setLpoNumber(e.target.value)}
                                placeholder="PO-2026-88910"
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white font-mono focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                LPO Total Value (QAR) <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={lpoCost}
                                onChange={e => setLpoCost(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white font-mono focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Mandatory LPO Document File Upload */}
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200/80 dark:border-zinc-700">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Attach Client LPO Document (PDF) <span className="text-rose-500">*</span>
                        </label>
                        <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-4 text-center hover:border-blue-500 transition-colors">
                            <input
                                type="file"
                                id="lpoFileInput"
                                accept=".pdf,.doc,.docx,.jpg,.png"
                                onChange={e => setLpoFile(e.target.files?.[0] || null)}
                                className="hidden"
                            />
                            <label htmlFor="lpoFileInput" className="cursor-pointer block">
                                <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {lpoFile ? lpoFile.name : 'Upload Official LPO / Award Letter'}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Mandatory before project can be created</p>
                            </label>
                            {lpoFile && (
                                <div className="mt-2 text-[11px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> LPO Attached: {(lpoFile.size / 1024).toFixed(0)} KB
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timeline & Project Manager */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Planned Start Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Planned End Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Project Manager <span className="text-rose-500">*</span>
                            </label>
                            <select
                                required
                                value={projectManagerId}
                                onChange={e => setProjectManagerId(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none font-bold"
                            >
                                <option value="">— Select Manager —</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name} ({emp.designation || 'Manager'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Category, Type & Cost Center */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Project Category
                            </label>
                            <select
                                value={projectCategoryId}
                                onChange={e => setProjectCategoryId(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            >
                                <option value="">— Select Category —</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Project Type
                            </label>
                            <select
                                value={projectTypeId}
                                onChange={e => setProjectTypeId(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            >
                                <option value="">— Select Type —</option>
                                {types.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Accounting Cost Center
                            </label>
                            <select
                                value={costCenterId}
                                onChange={e => setCostCenterId(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            >
                                <option value="">— Select Cost Center —</option>
                                {costCenters.map(cc => (
                                    <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Linked Approved Proposals */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Link Approved Technical Proposal
                            </label>
                            <select
                                value={technicalProposalId}
                                onChange={e => setTechnicalProposalId(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            >
                                <option value="">— Select Technical Proposal (Optional) —</option>
                                {techProposals.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.title} (Rev {p.current_revision}) [{p.status}]
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Link Approved Commercial Proposal
                            </label>
                            <select
                                value={commercialProposalId}
                                onChange={e => setCommercialProposalId(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            >
                                <option value="">— Select Commercial Proposal (Optional) —</option>
                                {commProposals.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.title} (Rev {p.current_revision}) [{p.status}]
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Project Remarks / Execution Notes
                        </label>
                        <textarea
                            rows={2}
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                            placeholder="Add any specific client conditions, site constraints, or execution notes..."
                            className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit || submitting}
                            className={`px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-lg transition-all ${
                                !canSubmit || submitting
                                    ? 'bg-slate-300 dark:bg-zinc-700 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                            }`}
                        >
                            {submitting ? 'Creating Project & LPO...' : 'Create Project Draft'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
