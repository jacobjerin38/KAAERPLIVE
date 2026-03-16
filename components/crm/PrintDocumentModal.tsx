import React, { useState, useEffect } from 'react';
import { Printer, X, Loader2, ChevronDown } from 'lucide-react';
import { CRMQuotation, CRMQuotationLine, CRMSalesInvoice, CRMSalesInvoiceLine, CRMDeliveryNote, CRMDeliveryNoteLine, CRMCustomer } from './types';
import {
    DocumentType,
    PrintTemplateConfig,
    CompanyProfile,
    fetchCompanyProfile,
    fetchCustomTemplates,
    getDefaultTemplate,
    generateDocumentHTML,
} from './printTemplates';

interface PrintDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentType: DocumentType;
    document: CRMQuotation | CRMSalesInvoice | CRMDeliveryNote;
    lines: CRMQuotationLine[] | CRMSalesInvoiceLine[] | CRMDeliveryNoteLine[];
    customer?: CRMCustomer;
    companyId: string;
}

const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
    isOpen,
    onClose,
    documentType,
    document: doc,
    lines,
    customer,
    companyId,
}) => {
    const [company, setCompany] = useState<CompanyProfile | null>(null);
    const [templates, setTemplates] = useState<PrintTemplateConfig[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplateConfig>(getDefaultTemplate());
    const [loading, setLoading] = useState(true);
    const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        loadData();
    }, [isOpen, companyId]);

    const loadData = async () => {
        setLoading(true);
        const [companyData, customTemplates] = await Promise.all([
            fetchCompanyProfile(companyId),
            fetchCustomTemplates(companyId),
        ]);
        setCompany(companyData);
        setTemplates(customTemplates);

        // If a custom template is marked as matching this doc type or 'all', use the first one
        const matching = customTemplates.find(
            (t) => t.id && ((t as any).document_type === documentType || (t as any).document_type === 'all')
        );
        if (matching) setSelectedTemplate(matching);
        else setSelectedTemplate(getDefaultTemplate());

        setLoading(false);
    };

    const handlePrint = () => {
        if (!company) return;

        const html = generateDocumentHTML({
            documentType,
            document: doc,
            lines,
            customer,
            company,
            template: selectedTemplate,
        });

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        }
    };

    if (!isOpen) return null;

    const docLabels: Record<DocumentType, string> = {
        quotation: 'Quotation',
        invoice: 'Sales Invoice',
        delivery_note: 'Delivery Note',
    };

    const allTemplates = [getDefaultTemplate(), ...templates];

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900/50 dark:to-blue-900/10 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Printer size={20} className="text-blue-500" /> Print {docLabels[documentType]}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-blue-500" size={28} />
                        </div>
                    ) : (
                        <>
                            {/* Template Selector */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Template
                                </label>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowTemplateDropdown((p) => !p)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-300 hover:border-blue-300 transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="w-3 h-3 rounded-full"
                                                style={{ background: selectedTemplate.accent_color }}
                                            />
                                            {selectedTemplate.name}
                                        </span>
                                        <ChevronDown size={16} className="text-slate-400" />
                                    </button>
                                    {showTemplateDropdown && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-lg z-10 overflow-hidden">
                                            {allTemplates.map((t, idx) => (
                                                <button
                                                    key={t.id || idx}
                                                    onClick={() => {
                                                        setSelectedTemplate(t);
                                                        setShowTemplateDropdown(false);
                                                    }}
                                                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors ${selectedTemplate.name === t.name ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-zinc-300'
                                                        }`}
                                                >
                                                    <span
                                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                                        style={{ background: t.accent_color }}
                                                    />
                                                    {t.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Preview Info */}
                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Document</span>
                                    <span className="text-slate-700 dark:text-zinc-300 font-medium">
                                        {docLabels[documentType]}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Customer</span>
                                    <span className="text-slate-700 dark:text-zinc-300 font-medium">
                                        {customer?.name || 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Items</span>
                                    <span className="text-slate-700 dark:text-zinc-300 font-medium">
                                        {lines.length} line item{lines.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                {(doc as any).grand_total !== undefined && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Total</span>
                                        <span className="text-slate-900 dark:text-white font-bold">
                                            ₹{((doc as any).grand_total || 0).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Company</span>
                                    <span className="text-slate-700 dark:text-zinc-300 font-medium">
                                        {company?.display_name || company?.name || '-'}
                                    </span>
                                </div>
                            </div>

                            {/* Options */}
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedTemplate.show_logo}
                                        onChange={(e) =>
                                            setSelectedTemplate((p) => ({ ...p, show_logo: e.target.checked }))
                                        }
                                        className="rounded border-slate-300"
                                    />
                                    Show Logo
                                </label>
                                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedTemplate.show_terms}
                                        onChange={(e) =>
                                            setSelectedTemplate((p) => ({ ...p, show_terms: e.target.checked }))
                                        }
                                        className="rounded border-slate-300"
                                    />
                                    Show Terms
                                </label>
                                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedTemplate.show_tax_breakdown}
                                        onChange={(e) =>
                                            setSelectedTemplate((p) => ({ ...p, show_tax_breakdown: e.target.checked }))
                                        }
                                        className="rounded border-slate-300"
                                    />
                                    Tax Breakdown
                                </label>
                                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedTemplate.show_amount_in_words}
                                        onChange={(e) =>
                                            setSelectedTemplate((p) => ({ ...p, show_amount_in_words: e.target.checked }))
                                        }
                                        className="rounded border-slate-300"
                                    />
                                    Amount in Words
                                </label>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={loading || !company}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all font-semibold text-sm disabled:opacity-50"
                    >
                        <Printer size={16} />
                        Print / Save PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrintDocumentModal;
