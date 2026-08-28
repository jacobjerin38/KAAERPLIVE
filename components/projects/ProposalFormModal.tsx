import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Building2, User, Calendar, DollarSign } from 'lucide-react';
import { createProposal } from './projectService';
import { useAuth } from '../../contexts/AuthContext';

interface ProposalFormModalProps {
    proposalType: 'TECHNICAL' | 'COMMERCIAL';
    clients: any[];
    deals: any[];
    employees: any[];
    onClose: () => void;
    onSuccess: () => void;
}

export const ProposalFormModal: React.FC<ProposalFormModalProps> = ({
    proposalType,
    clients,
    deals,
    employees,
    onClose,
    onSuccess
}) => {
    const { currentCompanyId, user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form fields
    const [title, setTitle] = useState('');
    const [clientId, setClientId] = useState('');
    const [dealId, setDealId] = useState('');
    const [rfqReference, setRfqReference] = useState('');
    const [quotationReference, setQuotationReference] = useState('');
    const [submissionDeadline, setSubmissionDeadline] = useState('');
    const [currency, setCurrency] = useState('QAR');
    const [remarks, setRemarks] = useState('');
    const [firstReviewerId, setFirstReviewerId] = useState('');

    // File attachments
    const [technicalFile, setTechnicalFile] = useState<File | null>(null);
    const [quotationFile, setQuotationFile] = useState<File | null>(null);
    const [costingSheetFile, setCostingSheetFile] = useState<File | null>(null);

    const isTechnical = proposalType === 'TECHNICAL';

    const canSubmit = isTechnical
        ? !!title.trim() && !!firstReviewerId && !!technicalFile
        : !!title.trim() && !!firstReviewerId && (!!quotationFile || !!costingSheetFile);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId) return;

        if (!title.trim()) {
            setError('Please enter a proposal title.');
            return;
        }
        if (!firstReviewerId) {
            setError('Please select a First Reviewer.');
            return;
        }
        if (isTechnical && !technicalFile) {
            setError('Technical proposal document is mandatory.');
            return;
        }
        if (!isTechnical && !quotationFile && !costingSheetFile) {
            setError('Please attach at least one commercial document (Quotation or Costing Sheet).');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await createProposal({
                companyId: currentCompanyId,
                proposalType,
                title: title.trim(),
                clientId: clientId || null,
                dealId: dealId ? Number(dealId) : null,
                rfqReference: rfqReference.trim() || null,
                quotationReference: quotationReference.trim() || null,
                submissionDeadline: submissionDeadline || null,
                currency,
                remarks: remarks.trim() || null,
                firstReviewerId,
                technicalFile,
                quotationFile,
                costingSheetFile,
                createdBy: user?.id || '00000000-0000-0000-0000-000000000000'
            });

            onSuccess();
        } catch (err: any) {
            console.error('Error registering proposal:', err);
            setError(err.message || 'Failed to register proposal');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl relative animate-slide-up border border-slate-100 dark:border-zinc-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase ${
                                isTechnical 
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                                {isTechnical ? 'Technical' : 'Commercial'}
                            </span>
                            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                                Register {isTechnical ? 'Technical Proposal' : 'Commercial Proposal'}
                            </h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Register an external proposal for document locking and multi-stage workflow approval.
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
                    {/* Proposal Title */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Proposal Title <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Substation Protection Automation System Upgrade"
                            className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>

                    {/* Client & CRM Deal Link */}
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
                                <option value="">— Select Client (Optional) —</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Link to CRM Deal / Opportunity
                            </label>
                            <select
                                value={dealId}
                                onChange={e => setDealId(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            >
                                <option value="">— Select Deal (Optional) —</option>
                                {deals.map(d => (
                                    <option key={d.id} value={d.id}>{d.title} ({d.company || 'CRM'})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* References & Deadline */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                RFQ Reference #
                            </label>
                            <input
                                type="text"
                                value={rfqReference}
                                onChange={e => setRfqReference(e.target.value)}
                                placeholder="RFQ-2026-089"
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white font-mono focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Quotation Ref #
                            </label>
                            <input
                                type="text"
                                value={quotationReference}
                                onChange={e => setQuotationReference(e.target.value)}
                                placeholder="QT-2026-0412"
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white font-mono focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Submission Deadline
                            </label>
                            <input
                                type="date"
                                value={submissionDeadline}
                                onChange={e => setSubmissionDeadline(e.target.value)}
                                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Reviewer Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            First Reviewer <span className="text-rose-500">*</span>
                        </label>
                        <select
                            required
                            value={firstReviewerId}
                            onChange={e => setFirstReviewerId(e.target.value)}
                            className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none font-bold"
                        >
                            <option value="">— Select First Reviewer (Engineering / Project Lead) —</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name} — {emp.designation || 'Engineer'} ({emp.employee_code || emp.email || 'Staff'})
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">
                            The first reviewer will verify the technical and operational scope before advancing.
                        </p>
                    </div>

                    {/* Mandatory File Uploads */}
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200/80 dark:border-zinc-700 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                Mandatory Document Uploads
                            </h4>
                        </div>

                        {isTechnical ? (
                            /* Technical: 1 file */
                            <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-4 text-center hover:border-blue-500 transition-colors">
                                <input
                                    type="file"
                                    id="techFile"
                                    accept=".pdf,.doc,.docx,.zip,.xlsx,.xls"
                                    onChange={e => setTechnicalFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                                <label htmlFor="techFile" className="cursor-pointer block">
                                    <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {technicalFile ? technicalFile.name : 'Upload Technical Proposal Document (PDF/DOC/ZIP)'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Click to browse file</p>
                                </label>
                                {technicalFile && (
                                    <div className="mt-2 text-[11px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> File Selected: {(technicalFile.size / 1024).toFixed(0)} KB
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Commercial: 2 files */
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Quotation File */}
                                <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors">
                                    <input
                                        type="file"
                                        id="quoteFile"
                                        accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
                                        onChange={e => setQuotationFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                    />
                                    <label htmlFor="quoteFile" className="cursor-pointer block">
                                        <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {quotationFile ? quotationFile.name : '1. Quotation Document (PDF/DOC/Excel)'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Commercial quotation file</p>
                                    </label>
                                    {quotationFile && (
                                        <div className="mt-2 text-[11px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                                        </div>
                                    )}
                                </div>

                                {/* Costing Sheet File */}
                                <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors">
                                    <input
                                        type="file"
                                        id="costingFile"
                                        accept=".xlsx,.xls,.pdf,.csv,.doc,.docx"
                                        onChange={e => setCostingSheetFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                    />
                                    <label htmlFor="costingFile" className="cursor-pointer block">
                                        <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {costingSheetFile ? costingSheetFile.name : '2. Costing Sheet (Excel/PDF/CSV)'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Costing breakdown sheet</p>
                                    </label>
                                    {costingSheetFile && (
                                        <div className="mt-2 text-[11px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Remarks / Scope Summary */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Scope Notes / Remarks
                        </label>
                        <textarea
                            rows={3}
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                            placeholder="Briefly describe key scope deliverables, exclusions, or special assumptions..."
                            className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white focus:outline-none"
                        />
                    </div>

                    {/* Action Buttons */}
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
                                    : isTechnical
                                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                            }`}
                        >
                            {submitting ? 'Registering & Uploading...' : `Submit & Send to Reviewer`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
