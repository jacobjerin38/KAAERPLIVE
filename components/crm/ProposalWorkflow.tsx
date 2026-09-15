import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
    getProposalRequests, 
    createProposalRequest, 
    updateProposalRequest, 
    getProposals, 
    createProposal, 
    updateProposal, 
    ProposalRequest, 
    Proposal 
} from './enhancementServices';
import { getCustomers } from './services';
import { Customer } from './types';
import { 
    Workflow, 
    Plus, 
    FileText, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    ArrowRight, 
    Lock, 
    Unlock, 
    Trash2, 
    Eye, 
    User, 
    Calendar, 
    DollarSign,
    Loader2,
    Printer
} from 'lucide-react';
import { Modal } from '../ui/Modal';

export const ProposalWorkflow: React.FC<{ companyId: string }> = ({ companyId }) => {
    const { user, userRole } = useAuth();
    const [requests, setRequests] = useState<ProposalRequest[]>([]);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [subTab, setSubTab] = useState<'requests' | 'proposals'>('requests');

    // Modals
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

    // Selected items
    const [selectedRequest, setSelectedRequest] = useState<ProposalRequest | null>(null);
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [saving, setSaving] = useState(false);

    // Forms
    const [reqForm, setReqForm] = useState({
        customer_id: '',
        requirements: '',
        requested_delivery_date: ''
    });

    const [propForm, setPropForm] = useState({
        title: '',
        terms_and_conditions: '',
        lines: [{ item_name: '', quantity: 1, rate: 0 }]
    });

    useEffect(() => {
        if (companyId) {
            loadData();
        }
    }, [companyId]);

    const loadData = async () => {
        setLoading(true);
        const [reqs, props, custs] = await Promise.all([
            getProposalRequests(companyId),
            getProposals(companyId),
            getCustomers(user?.id, userRole, 'ALL', companyId)
        ]);
        setRequests(reqs);
        setProposals(props);
        setCustomers(custs);
        setLoading(false);
    };

    const handleCreateRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reqForm.customer_id || !reqForm.requirements) {
            alert('Please fill in customer and requirements');
            return;
        }

        setSaving(true);
        try {
            const customer = customers.find(c => c.id === reqForm.customer_id);
            const payload: Partial<ProposalRequest> = {
                company_id: companyId,
                customer_id: reqForm.customer_id,
                customer_details: customer ? { name: customer.name, email: customer.primary_email } : {},
                requirements: reqForm.requirements,
                requested_delivery_date: reqForm.requested_delivery_date || undefined,
                status: 'Pending Proposal Creation'
            };

            const result = await createProposalRequest(payload);
            if (result) {
                // SLA insertion for level 2: 48 hours to create proposal
                const now = new Date();
                const due = new Date(now.getTime() + 48 * 60 * 60 * 1000);
                await (supabase as any).from('sla_tracking').insert([{
                    company_id: companyId,
                    entity_type: 'PROPOSAL',
                    entity_id: result.id,
                    sla_hours: 48,
                    start_time: now.toISOString(),
                    due_time: due.toISOString(),
                    status: 'Pending'
                }]);

                setIsRequestModalOpen(false);
                setReqForm({ customer_id: '', requirements: '', requested_delivery_date: '' });
                loadData();
            } else {
                alert('Failed to submit proposal request');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCreateProposalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRequest) return;
        if (!propForm.title || propForm.lines.some(l => !l.item_name || l.rate <= 0)) {
            alert('Please enter a valid title and line items with rates > 0');
            return;
        }

        setSaving(true);
        try {
            const grandTotal = propForm.lines.reduce((sum, l) => sum + l.quantity * l.rate, 0);
            const payload: Partial<Proposal> = {
                company_id: companyId,
                request_id: selectedRequest.id,
                customer_id: selectedRequest.customer_id,
                title: propForm.title,
                pricing_details: { lines: propForm.lines },
                grand_total: grandTotal,
                terms_and_conditions: propForm.terms_and_conditions || undefined,
                status: 'Pending Approval',
                is_locked: false
            };

            const result = await createProposal(payload);
            if (result) {
                await updateProposalRequest(selectedRequest.id, 'Proposal Created');
                setIsProposalModalOpen(false);
                setSelectedRequest(null);
                setPropForm({ title: '', terms_and_conditions: '', lines: [{ item_name: '', quantity: 1, rate: 0 }] });
                loadData();
            } else {
                alert('Failed to save proposal');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePrintProposal = async (prop: Proposal) => {
        if (!companyId) return;

        // Fetch company logo and details
        const { data: comp } = await supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single();

        const companyLogo = comp?.logo_url || 'https://raw.githubusercontent.com/jacobjerin38/KAA-ERP-Live1/main/kaa_logo.png';
        const companyName = comp?.name || 'KAA ERP SYSTEM';
        const companyAddress = (comp as any)?.address || `${comp?.address_line_1 || ''} ${comp?.city || ''}`.trim();
        const companyPhone = comp?.phone || '';

        const receiptHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Proposal - ${prop.title}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        color: #333;
                        margin: 40px;
                        line-height: 1.5;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2px solid #333;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .company-logo {
                        max-height: 60px;
                        max-width: 150px;
                    }
                    .company-details {
                        text-align: right;
                    }
                    .company-name {
                        font-weight: bold;
                        font-size: 1.4rem;
                        margin-bottom: 5px;
                    }
                    .proposal-title {
                        text-align: center;
                        font-size: 1.6rem;
                        font-weight: bold;
                        margin: 30px 0;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .details-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 40px;
                    }
                    .section {
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        padding: 15px;
                        background: #fdfdfd;
                    }
                    .section-title {
                        font-weight: bold;
                        text-transform: uppercase;
                        font-size: 0.85rem;
                        color: #666;
                        margin-bottom: 10px;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 5px;
                    }
                    .row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 8px;
                        font-size: 0.9rem;
                    }
                    .label {
                        color: #666;
                    }
                    .value {
                        font-weight: bold;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                        margin-bottom: 30px;
                    }
                    th, td {
                        padding: 12px;
                        border-bottom: 1px solid #ddd;
                        text-align: left;
                        font-size: 0.9rem;
                    }
                    th {
                        background-color: #f8f9fa;
                        font-weight: bold;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .text-center {
                        text-align: center;
                    }
                    .total-row {
                        font-size: 1.1rem;
                        font-weight: bold;
                        background-color: #f8f9fa;
                    }
                    .terms-box {
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        padding: 15px;
                        background: #fdfdfd;
                        margin-top: 30px;
                        font-size: 0.85rem;
                    }
                    .terms-title {
                        font-weight: bold;
                        margin-bottom: 8px;
                        color: #555;
                    }
                    .footer-sig {
                        margin-top: 60px;
                        display: flex;
                        justify-content: space-between;
                    }
                    .sig-line {
                        width: 200px;
                        border-top: 1px solid #333;
                        text-align: center;
                        padding-top: 5px;
                        font-size: 0.85rem;
                    }
                    @media print {
                        .print-btn {
                            display: none !important;
                        }
                    }
                </style>
            </head>
            <body>
                <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;" class="print-btn">
                    <button onclick="window.print()" style="padding: 10px 20px; font-weight: bold; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Print / Save PDF
                    </button>
                </div>

                <div class="header">
                    <img class="company-logo" src="${companyLogo}" alt="Logo" />
                    <div class="company-details">
                        <div class="company-name">${companyName}</div>
                        <div>${companyAddress}</div>
                        <div>Phone: ${companyPhone}</div>
                    </div>
                </div>

                <div class="proposal-title">Commercial Proposal</div>

                <div class="details-grid">
                    <div class="section">
                        <div class="section-title">Client Details</div>
                        <div class="row">
                            <span class="label">Customer Name:</span>
                            <span class="value">${prop.customer?.name || 'N/A'}</span>
                        </div>
                        <div class="row">
                            <span class="label">Email:</span>
                            <span class="value">${prop.customer?.primary_email || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">Proposal Info</div>
                        <div class="row">
                            <span class="label">Proposal Title:</span>
                            <span class="value">${prop.title}</span>
                        </div>
                        <div class="row">
                            <span class="label">Status:</span>
                            <span class="value">${prop.status}</span>
                        </div>
                        <div class="row">
                            <span class="label">Date Created:</span>
                            <span class="value">${new Date(prop.created_at || '').toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Item Details / Services</th>
                            <th class="text-center">Quantity</th>
                            <th class="text-right">Rate</th>
                            <th class="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(prop.pricing_details?.lines || []).map((l: any) => `
                            <tr>
                                <td>${l.item_name}</td>
                                <td class="text-center">${l.quantity}</td>
                                <td class="text-right">${l.rate.toLocaleString()} QAR</td>
                                <td class="text-right">${(l.quantity * l.rate).toLocaleString()} QAR</td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td colspan="3">Grand Total</td>
                            <td class="text-right">${prop.grand_total.toLocaleString()} QAR</td>
                        </tr>
                    </tbody>
                </table>

                ${prop.terms_and_conditions ? `
                    <div class="terms-box">
                        <div class="terms-title">Terms & Conditions</div>
                        <div>${prop.terms_and_conditions}</div>
                    </div>
                ` : ''}

                <div class="footer-sig">
                    <div>
                        <div style="height: 50px;"></div>
                        <div class="sig-line">Prepared By</div>
                    </div>
                    <div>
                        <div style="height: 50px;"></div>
                        <div class="sig-line">Approved By (Client)</div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(receiptHTML);
            printWindow.document.close();
        }
    };

    const handleApproveProposal = async (prop: Proposal, approve: boolean) => {
        setSaving(true);
        try {
            const updates: Partial<Proposal> = approve 
                ? { status: 'Approved', is_locked: true }
                : { status: 'Revision Needed', is_locked: false };

            const updated = await updateProposal(prop.id, updates);
            if (updated) {
                // If approved, mark SLA completed
                if (approve) {
                    const now = new Date().toISOString();
                    await (supabase as any)
                        .from('sla_tracking')
                        .update({ status: 'Completed', completed_time: now })
                        .eq('entity_type', 'PROPOSAL')
                        .eq('entity_id', prop.request_id || prop.id)
                        .eq('status', 'Pending');
                } else {
                    // If revision needed, set request status back
                    if (prop.request_id) {
                        await updateProposalRequest(prop.request_id, 'Pending Proposal Creation');
                    }
                }

                setIsReviewModalOpen(false);
                setSelectedProposal(null);
                loadData();
            } else {
                alert('Failed to update proposal status');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const addLine = () => {
        setPropForm(prev => ({
            ...prev,
            lines: [...prev.lines, { item_name: '', quantity: 1, rate: 0 }]
        }));
    };

    const removeLine = (idx: number) => {
        setPropForm(prev => ({
            ...prev,
            lines: prev.lines.filter((_, i) => i !== idx)
        }));
    };

    const updateLine = (idx: number, field: string, val: any) => {
        setPropForm(prev => {
            const updated = [...prev.lines];
            updated[idx] = { ...updated[idx], [field]: val };
            return { ...prev, lines: updated };
        });
    };

    return (
        <div className="h-full flex flex-col p-6 overflow-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Proposal Workflow</h1>
                    <p className="text-slate-500 text-sm mt-0.5">3-Level quotation and proposal approval system</p>
                </div>
                <button
                    onClick={() => setIsRequestModalOpen(true)}
                    className="flex items-center gap-2 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md shadow-indigo-600/20 text-sm font-semibold"
                >
                    <Plus size={16} />
                    New Request
                </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-max mb-6">
                <button
                    onClick={() => setSubTab('requests')}
                    className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                        subTab === 'requests' 
                            ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Level 1 & 2: Requests ({requests.length})
                </button>
                <button
                    onClick={() => setSubTab('proposals')}
                    className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                        subTab === 'proposals' 
                            ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Level 3: Approvals ({proposals.length})
                </button>
            </div>

            {/* List Content */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin text-indigo-500 mr-2" /> Loading...
                </div>
            ) : subTab === 'requests' ? (
                /* Requests Tab */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition-shadow relative">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-base">{req.customer_details?.name || 'Customer'}</h3>
                                    <p className="text-slate-400 text-xs mt-0.5">{req.customer_details?.email || 'No email'}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    req.status === 'Pending Proposal Creation' 
                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' 
                                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                }`}>
                                    {req.status}
                                </span>
                            </div>

                            <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-xl text-xs text-slate-600 dark:text-slate-400 italic">
                                "{req.requirements}"
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-50 dark:border-zinc-800 pt-3">
                                <span className="flex items-center gap-1">
                                    <Calendar size={10} /> Due: {req.requested_delivery_date ? new Date(req.requested_delivery_date).toLocaleDateString() : 'N/A'}
                                </span>
                                {req.status === 'Pending Proposal Creation' && (
                                    <button
                                        onClick={() => {
                                            setSelectedRequest(req);
                                            setPropForm({
                                                title: `Proposal for ${req.customer_details?.name || 'Client'}`,
                                                terms_and_conditions: 'Payment: 100% on acceptance.',
                                                lines: [{ item_name: '', quantity: 1, rate: 0 }]
                                            });
                                            setIsProposalModalOpen(true);
                                        }}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1 transition-colors"
                                    >
                                        Create Proposal <ArrowRight size={10} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {requests.length === 0 && (
                        <div className="col-span-full text-center py-20 text-slate-400 italic">
                            No proposal requests found.
                        </div>
                    )}
                </div>
            ) : (
                /* Proposals Tab */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {proposals.map(prop => (
                        <div key={prop.id} className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition-shadow relative">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-base">{prop.title}</h3>
                                    <p className="text-slate-400 text-xs mt-0.5">{prop.customer?.name || 'Customer'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        prop.status === 'Approved' 
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                            : prop.status === 'Pending Approval'
                                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                                    }`}>
                                        {prop.status}
                                    </span>
                                    {prop.is_locked ? (
                                        <span className="flex items-center gap-0.5 text-[9px] text-red-500 font-semibold">
                                            <Lock size={8} /> Locked
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-0.5 text-[9px] text-slate-400 font-semibold">
                                            <Unlock size={8} /> Editable
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-sm font-extrabold text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800/40 p-3 rounded-xl">
                                <span>Grand Total:</span>
                                <span>QAR {prop.grand_total.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-zinc-800">
                                <button
                                    onClick={() => handlePrintProposal(prop)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Print Proposal"
                                >
                                    <Printer size={15} />
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedProposal(prop);
                                        setIsReviewModalOpen(true);
                                    }}
                                    className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300 font-semibold text-xs flex items-center gap-1 transition-all"
                                >
                                    <Eye size={12} /> {prop.is_locked ? 'View Proposal' : 'Review & Approve'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {proposals.length === 0 && (
                        <div className="col-span-full text-center py-20 text-slate-400 italic">
                            No proposals found.
                        </div>
                    )}
                </div>
            )}

            {/* Level 1: New Request Modal */}
            {isRequestModalOpen && (
                <Modal title="Create Proposal Request" onClose={() => setIsRequestModalOpen(false)}>
                    <form onSubmit={handleCreateRequest} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Select Customer *</label>
                            <select
                                required
                                value={reqForm.customer_id}
                                onChange={e => setReqForm({ ...reqForm, customer_id: e.target.value })}
                                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                            >
                                <option value="">Select a customer...</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Requirements / Details *</label>
                            <textarea
                                required
                                value={reqForm.requirements}
                                onChange={e => setReqForm({ ...reqForm, requirements: e.target.value })}
                                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                rows={4}
                                placeholder="Describe client requirements, quantities, items needed..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Requested Delivery Date</label>
                            <input
                                type="date"
                                value={reqForm.requested_delivery_date}
                                onChange={e => setReqForm({ ...reqForm, requested_delivery_date: e.target.value })}
                                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsRequestModalOpen(false)}
                                className="px-5 py-2.5 text-slate-700 hover:bg-slate-200/50 rounded-xl text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-1.5"
                            >
                                {saving && <Loader2 className="animate-spin w-4 h-4" />}
                                Submit Request
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Level 2: Create Proposal Modal */}
            {isProposalModalOpen && selectedRequest && (
                <Modal title="Create Pricing Proposal" onClose={() => { setIsProposalModalOpen(false); setSelectedRequest(null); }}>
                    <form onSubmit={handleCreateProposalSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Proposal Title *</label>
                            <input
                                required
                                value={propForm.title}
                                onChange={e => setPropForm({ ...propForm, title: e.target.value })}
                                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                placeholder="e.g. Acme Office Solution - Final Proposal"
                            />
                        </div>

                        {/* Line Items */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-700 dark:text-white">Pricing Line Items</span>
                                <button
                                    type="button"
                                    onClick={addLine}
                                    className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2.5 py-1 rounded"
                                >
                                    + Add Item
                                </button>
                            </div>

                            {propForm.lines.map((line, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <input
                                        required
                                        value={line.item_name}
                                        onChange={e => updateLine(idx, 'item_name', e.target.value)}
                                        className="flex-1 px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs"
                                        placeholder="Item description / service"
                                    />
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        value={line.quantity}
                                        onChange={e => updateLine(idx, 'quantity', parseInt(e.target.value) || 1)}
                                        className="w-16 px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-center"
                                        placeholder="Qty"
                                    />
                                    <input
                                        required
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={line.rate}
                                        onChange={e => updateLine(idx, 'rate', parseFloat(e.target.value) || 0)}
                                        className="w-24 px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-right"
                                        placeholder="Rate (QAR)"
                                    />
                                    {propForm.lines.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeLine(idx)}
                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Terms & Conditions</label>
                            <textarea
                                value={propForm.terms_and_conditions}
                                onChange={e => setPropForm({ ...propForm, terms_and_conditions: e.target.value })}
                                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                rows={3}
                            />
                        </div>

                        {/* Grand Total */}
                        <div className="flex justify-between items-center font-bold text-sm text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800/40 p-3 rounded-xl">
                            <span>Total (QAR):</span>
                            <span>{propForm.lines.reduce((sum, l) => sum + l.quantity * l.rate, 0).toLocaleString()} QAR</span>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => { setIsProposalModalOpen(false); setSelectedRequest(null); }}
                                className="px-5 py-2.5 text-slate-700 hover:bg-slate-200/50 rounded-xl text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-1.5"
                            >
                                {saving && <Loader2 className="animate-spin w-4 h-4" />}
                                Submit Proposal
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Level 3: Review & Approve Modal */}
            {isReviewModalOpen && selectedProposal && (
                <Modal title={`Review Proposal - ${selectedProposal.title}`} onClose={() => { setIsReviewModalOpen(false); setSelectedProposal(null); }}>
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-slate-400 block">Customer:</span>
                                <span className="font-bold text-slate-700 dark:text-zinc-300">{selectedProposal.customer?.name || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block">Terms:</span>
                                <span className="font-bold text-slate-700 dark:text-zinc-300">{selectedProposal.terms_and_conditions || 'None'}</span>
                            </div>
                        </div>

                        {/* Pricing details table */}
                        <div className="border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden text-xs">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold">
                                    <tr>
                                        <th className="p-3">Item details</th>
                                        <th className="p-3 text-center">Qty</th>
                                        <th className="p-3 text-right">Rate</th>
                                        <th className="p-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                                    {(selectedProposal.pricing_details?.lines || []).map((l: any, i: number) => (
                                        <tr key={i}>
                                            <td className="p-3 font-semibold text-slate-700 dark:text-zinc-300">{l.item_name}</td>
                                            <td className="p-3 text-center">{l.quantity}</td>
                                            <td className="p-3 text-right">{l.rate.toLocaleString()} QAR</td>
                                            <td className="p-3 text-right font-bold">{(l.quantity * l.rate).toLocaleString()} QAR</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center font-bold text-sm text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800/40 p-3 rounded-xl">
                            <span>Grand Total:</span>
                            <span>{selectedProposal.grand_total.toLocaleString()} QAR</span>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-zinc-800">
                            {selectedProposal.is_locked ? (
                                <div className="text-rose-500 font-semibold text-xs flex items-center gap-1">
                                    <Lock size={12} /> Document is locked on final approval. No edits allowed.
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleApproveProposal(selectedProposal, false)}
                                        className="px-4 py-2 border border-rose-200 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-50 transition-colors"
                                    >
                                        Send Back / Reject
                                    </button>
                                    <button
                                        onClick={() => handleApproveProposal(selectedProposal, true)}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                                    >
                                        Approve & Lock
                                    </button>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePrintProposal(selectedProposal)}
                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                    <Printer size={13} /> Print / Save PDF
                                </button>
                                <button
                                    onClick={() => { setIsReviewModalOpen(false); setSelectedProposal(null); }}
                                    className="px-4 py-2 text-slate-500 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
