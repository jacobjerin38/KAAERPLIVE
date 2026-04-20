import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    FileText, Printer, Plus, Trash2, Download,
    Building, Calendar, Hash, DollarSign
} from 'lucide-react';

type DocType = 'QUOTATION' | 'LPO' | 'INVOICE' | 'DELIVERY_NOTE';

interface LineItem {
    id: string;
    description: string;
    qty: number;
    unit: string;
    unitPrice: number;
    total: number;
}

interface DocumentData {
    docType: DocType;
    docNumber: string;
    date: string;
    dueDate?: string;
    customerName: string;
    customerAddress: string;
    customerContact: string;
    reference: string;
    notes: string;
    lineItems: LineItem[];
    taxRate: number;
    currency: string;
}

const DOC_CONFIG: Record<DocType, { title: string; color: string; prefix: string }> = {
    QUOTATION: { title: 'Quotation', color: '#6366f1', prefix: 'QTN' },
    LPO: { title: 'Local Purchase Order', color: '#059669', prefix: 'LPO' },
    INVOICE: { title: 'Invoice', color: '#dc2626', prefix: 'INV' },
    DELIVERY_NOTE: { title: 'Delivery Note', color: '#d97706', prefix: 'DN' },
};

export const DocumentGenerator: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const printRef = useRef<HTMLDivElement>(null);
    const [docType, setDocType] = useState<DocType>('QUOTATION');
    const [showPreview, setShowPreview] = useState(false);

    const generateDocNumber = (type: DocType) => {
        const prefix = DOC_CONFIG[type].prefix;
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `${prefix}-${datePart}-${random}`;
    };

    const [docData, setDocData] = useState<DocumentData>({
        docType: 'QUOTATION',
        docNumber: generateDocNumber('QUOTATION'),
        date: new Date().toISOString().split('T')[0],
        customerName: '',
        customerAddress: '',
        customerContact: '',
        reference: '',
        notes: '',
        lineItems: [{ id: '1', description: '', qty: 1, unit: 'PCS', unitPrice: 0, total: 0 }],
        taxRate: 5,
        currency: 'QAR',
    });

    const updateDocType = (type: DocType) => {
        setDocType(type);
        setDocData(prev => ({
            ...prev,
            docType: type,
            docNumber: generateDocNumber(type),
        }));
    };

    const addLineItem = () => {
        const newId = (docData.lineItems.length + 1).toString();
        setDocData(prev => ({
            ...prev,
            lineItems: [...prev.lineItems, { id: newId, description: '', qty: 1, unit: 'PCS', unitPrice: 0, total: 0 }]
        }));
    };

    const removeLineItem = (id: string) => {
        if (docData.lineItems.length <= 1) return;
        setDocData(prev => ({
            ...prev,
            lineItems: prev.lineItems.filter(li => li.id !== id)
        }));
    };

    const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
        setDocData(prev => ({
            ...prev,
            lineItems: prev.lineItems.map(li => {
                if (li.id !== id) return li;
                const updated = { ...li, [field]: value };
                updated.total = updated.qty * updated.unitPrice;
                return updated;
            })
        }));
    };

    const subtotal = docData.lineItems.reduce((sum, li) => sum + (li.qty * li.unitPrice), 0);
    const taxAmount = subtotal * (docData.taxRate / 100);
    const grandTotal = subtotal + taxAmount;

    const printDocument = () => {
        setShowPreview(true);
        setTimeout(() => {
            const printWindow = window.open('', '_blank');
            if (!printWindow) return;
            const config = DOC_CONFIG[docData.docType];
            const customerLabel = docData.docType === 'LPO' ? 'Supplier' : 'Customer';

            printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${config.title} - ${docData.docNumber}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid ${config.color}; }
                    .company-name { font-size: 24px; font-weight: 700; color: ${config.color}; }
                    .company-tagline { font-size: 11px; color: #94a3b8; margin-top: 4px; }
                    .doc-title { font-size: 28px; font-weight: 700; color: ${config.color}; text-align: right; }
                    .doc-number { font-size: 13px; color: #64748b; text-align: right; margin-top: 4px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
                    .info-box { padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .info-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 600; margin-bottom: 8px; }
                    .info-value { font-size: 14px; color: #334155; line-height: 1.6; }
                    .info-value strong { color: #0f172a; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                    thead th { background: ${config.color}; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
                    thead th:last-child, thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
                    tbody td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
                    tbody td:last-child, tbody td:nth-child(3), tbody td:nth-child(4) { text-align: right; font-family: monospace; }
                    tbody tr:nth-child(even) { background: #f8fafc; }
                    .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
                    .totals-box { width: 280px; }
                    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #475569; }
                    .totals-row.grand { font-size: 16px; font-weight: 700; color: ${config.color}; border-top: 2px solid ${config.color}; padding-top: 12px; margin-top: 8px; }
                    .notes { padding: 16px; background: #fffbeb; border-radius: 8px; border: 1px solid #fef3c7; margin-bottom: 40px; }
                    .notes-label { font-size: 11px; font-weight: 600; color: #92400e; text-transform: uppercase; margin-bottom: 6px; }
                    .notes-text { font-size: 12px; color: #78716c; line-height: 1.5; }
                    .footer { text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
                    .signature-area { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; margin-bottom: 24px; }
                    .sig-line { border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 11px; color: #64748b; text-align: center; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="company-name">KAA ERP</div>
                        <div class="company-tagline">Enterprise Resource Planning System</div>
                    </div>
                    <div>
                        <div class="doc-title">${config.title}</div>
                        <div class="doc-number">${docData.docNumber}</div>
                    </div>
                </div>
                
                <div class="info-grid">
                    <div class="info-box">
                        <div class="info-label">${customerLabel} Details</div>
                        <div class="info-value">
                            <strong>${docData.customerName || '—'}</strong><br/>
                            ${docData.customerAddress || ''}<br/>
                            ${docData.customerContact || ''}
                        </div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Document Info</div>
                        <div class="info-value">
                            <strong>Date:</strong> ${docData.date}<br/>
                            ${docData.dueDate ? `<strong>Due:</strong> ${docData.dueDate}<br/>` : ''}
                            ${docData.reference ? `<strong>Ref:</strong> ${docData.reference}` : ''}
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width:40px">#</th>
                            <th>Description</th>
                            <th style="width:60px">Qty</th>
                            <th style="width:100px">Unit Price</th>
                            <th style="width:100px">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${docData.lineItems.map((li, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td>${li.description || '—'}</td>
                            <td style="text-align:right">${li.qty} ${li.unit}</td>
                            <td style="text-align:right">${docData.currency} ${li.unitPrice.toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                            <td style="text-align:right">${docData.currency} ${(li.qty * li.unitPrice).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="totals-box">
                        <div class="totals-row"><span>Subtotal</span><span>${docData.currency} ${subtotal.toLocaleString('en', { minimumFractionDigits: 2 })}</span></div>
                        <div class="totals-row"><span>Tax (${docData.taxRate}%)</span><span>${docData.currency} ${taxAmount.toLocaleString('en', { minimumFractionDigits: 2 })}</span></div>
                        <div class="totals-row grand"><span>Grand Total</span><span>${docData.currency} ${grandTotal.toLocaleString('en', { minimumFractionDigits: 2 })}</span></div>
                    </div>
                </div>

                ${docData.notes ? `
                <div class="notes">
                    <div class="notes-label">Notes / Terms</div>
                    <div class="notes-text">${docData.notes}</div>
                </div>
                ` : ''}

                <div class="signature-area">
                    <div class="sig-line">Authorized Signature</div>
                    <div class="sig-line">${customerLabel} Signature</div>
                </div>

                <div class="footer">
                    Generated by KAA ERP System • ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 300);
        }, 100);
    };

    const config = DOC_CONFIG[docType];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Document Generator</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Create Quotations, LPOs, Invoices, and Delivery Notes.
                    </p>
                </div>
            </div>

            {/* Document Type Selector */}
            <div className="flex gap-2 bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-lg max-w-xl">
                {(Object.entries(DOC_CONFIG) as [DocType, typeof DOC_CONFIG[DocType]][]).map(([type, cfg]) => (
                    <button
                        key={type}
                        onClick={() => updateDocType(type)}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                            docType === type
                                ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-800 dark:text-white'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                        style={docType === type ? { borderBottom: `2px solid ${cfg.color}` } : undefined}
                    >
                        {cfg.title}
                    </button>
                ))}
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
                {/* Header Fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Document #</label>
                        <input
                            className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-sm"
                            value={docData.docNumber}
                            onChange={e => setDocData(prev => ({ ...prev, docNumber: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white text-sm"
                            value={docData.date}
                            onChange={e => setDocData(prev => ({ ...prev, date: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Due Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white text-sm"
                            value={docData.dueDate || ''}
                            onChange={e => setDocData(prev => ({ ...prev, dueDate: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                        <input
                            className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white text-sm"
                            value={docData.reference}
                            onChange={e => setDocData(prev => ({ ...prev, reference: e.target.value }))}
                            placeholder="PO-00123"
                        />
                    </div>
                </div>

                {/* Customer/Supplier Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                            {docType === 'LPO' ? 'Supplier' : 'Customer'} Name
                        </label>
                        <input
                            className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                            value={docData.customerName}
                            onChange={e => setDocData(prev => ({ ...prev, customerName: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                        <input
                            className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                            value={docData.customerAddress}
                            onChange={e => setDocData(prev => ({ ...prev, customerAddress: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Contact</label>
                        <input
                            className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                            value={docData.customerContact}
                            onChange={e => setDocData(prev => ({ ...prev, customerContact: e.target.value }))}
                        />
                    </div>
                </div>

                {/* Line Items */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Line Items</label>
                        <button
                            onClick={addLineItem}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Item
                        </button>
                    </div>
                    <div className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-zinc-800">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs text-slate-500 font-medium w-8">#</th>
                                    <th className="px-3 py-2 text-left text-xs text-slate-500 font-medium">Description</th>
                                    <th className="px-3 py-2 text-right text-xs text-slate-500 font-medium w-20">Qty</th>
                                    <th className="px-3 py-2 text-left text-xs text-slate-500 font-medium w-20">Unit</th>
                                    <th className="px-3 py-2 text-right text-xs text-slate-500 font-medium w-28">Unit Price</th>
                                    <th className="px-3 py-2 text-right text-xs text-slate-500 font-medium w-28">Total</th>
                                    <th className="px-3 py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {docData.lineItems.map((li, idx) => (
                                    <tr key={li.id}>
                                        <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                                        <td className="px-3 py-2">
                                            <input
                                                className="w-full bg-transparent border-0 focus:outline-none text-slate-800 dark:text-white"
                                                value={li.description}
                                                onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                                                placeholder="Item description..."
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full bg-transparent border-0 focus:outline-none text-right text-slate-800 dark:text-white"
                                                value={li.qty}
                                                onChange={e => updateLineItem(li.id, 'qty', parseFloat(e.target.value) || 0)}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                className="w-full bg-transparent border-0 focus:outline-none text-slate-800 dark:text-white"
                                                value={li.unit}
                                                onChange={e => updateLineItem(li.id, 'unit', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="w-full bg-transparent border-0 focus:outline-none text-right text-slate-800 dark:text-white font-mono"
                                                value={li.unitPrice}
                                                onChange={e => updateLineItem(li.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                                            {docData.currency} {(li.qty * li.unitPrice).toLocaleString('en', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2">
                                            <button
                                                onClick={() => removeLineItem(li.id)}
                                                className="text-slate-300 hover:text-rose-500 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Totals & Tax */}
                <div className="flex justify-between items-start">
                    <div className="max-w-xs">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Notes / Terms</label>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white text-sm"
                            rows={3}
                            value={docData.notes}
                            onChange={e => setDocData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Payment terms, delivery conditions..."
                        />
                    </div>
                    <div className="w-72 space-y-2 text-sm">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>Subtotal</span>
                            <span className="font-mono">{docData.currency} {subtotal.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                            <span className="flex items-center gap-2">
                                Tax
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="w-14 px-2 py-1 text-center text-xs border border-slate-200 dark:border-zinc-700 rounded bg-slate-50 dark:bg-zinc-800"
                                    value={docData.taxRate}
                                    onChange={e => setDocData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                                />
                                %
                            </span>
                            <span className="font-mono">{docData.currency} {taxAmount.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-slate-200 dark:border-zinc-700 pt-2" style={{ color: config.color }}>
                            <span>Grand Total</span>
                            <span className="font-mono">{docData.currency} {grandTotal.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                    <button
                        onClick={printDocument}
                        className="flex items-center gap-2 px-6 py-2.5 text-white rounded-lg hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: config.color }}
                    >
                        <Printer className="w-4 h-4" />
                        Print / Download {config.title}
                    </button>
                </div>
            </div>
        </div>
    );
};
