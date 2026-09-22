import React, { useState, useEffect } from 'react';
import { 
    Plus, Mail, Phone, Building, ChevronDown, Loader2, Users, User, ArrowRight, Link2, 
    Lock, Shield, Search, X, FileText, Printer, Download, Calendar, DollarSign, 
    Edit, Trash2, Paperclip, Briefcase, CheckCircle2, Clock, AlertCircle, ExternalLink, FileCheck
} from 'lucide-react';
import { Customer, CRMCustomer, CRMCustomerWorkOrder } from './types';
import { 
    getCustomers, createCustomer, updateCustomer, checkIsAdmin, getSalesReps,
    getCustomerWorkOrders, getAllWorkOrders, createCustomerWorkOrder, updateCustomerWorkOrder, deleteCustomerWorkOrder
} from './services';
import { useAuth } from '../../contexts/AuthContext';
import { AttachmentPanel } from './AttachmentPanel';

export default function CustomersView({ companyId }: { companyId: string }) {
    const { user, userRole } = useAuth();
    const isAdmin = checkIsAdmin(userRole);

    // View Switching: 'CUSTOMERS' or 'WORK_ORDERS_REPORT'
    const [activeViewTab, setActiveViewTab] = useState<'CUSTOMERS' | 'WORK_ORDERS_REPORT'>('CUSTOMERS');

    // Customers State
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [salesReps, setSalesReps] = useState<{ id: string; name: string; profileId?: string }[]>([]);
    const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Customer Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalTab, setModalTab] = useState<'DETAILS' | 'CONTRACT' | 'WORK_ORDERS' | 'DOCUMENTS'>('DETAILS');
    const [activeCustomer, setActiveCustomer] = useState<Partial<Customer>>({});

    // Work Orders State
    const [workOrders, setWorkOrders] = useState<CRMCustomerWorkOrder[]>([]);
    const [customerModalWOs, setCustomerModalWOs] = useState<CRMCustomerWorkOrder[]>([]);
    const [woLoading, setWoLoading] = useState(false);
    const [savingWO, setSavingWO] = useState(false);

    // Work Order Modal State
    const [showWOModal, setShowWOModal] = useState(false);
    const [activeWO, setActiveWO] = useState<Partial<CRMCustomerWorkOrder>>({
        currency: 'QAR',
        status: 'In Progress'
    });

    // Work Orders Filter State
    const [woSearchQuery, setWoSearchQuery] = useState('');
    const [selectedClientFilter, setSelectedClientFilter] = useState<string>('ALL');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

    // Print Report Modal
    const [showPrintModal, setShowPrintModal] = useState(false);

    useEffect(() => {
        if (isAdmin && companyId) {
            getSalesReps(companyId).then(setSalesReps);
        }
    }, [isAdmin, companyId]);

    useEffect(() => {
        loadCustomers();
        loadAllWOs();
    }, [user?.id, userRole, selectedOwnerFilter, companyId]);

    const loadCustomers = async (silent = false) => {
        if (!silent && customers.length === 0) setLoading(true);
        const data = await getCustomers(user?.id, userRole, selectedOwnerFilter, companyId);
        setCustomers(data);
        setLoading(false);
    };

    const loadAllWOs = async (silent = false) => {
        if (!companyId) return;
        if (!silent && workOrders.length === 0) setWoLoading(true);
        const data = await getAllWorkOrders(companyId);
        setWorkOrders(data);
        setWoLoading(false);
    };

    const loadCustomerWOs = async (customerId: string) => {
        const data = await getCustomerWorkOrders(customerId);
        setCustomerModalWOs(data);
    };

    const handleOpenCustomer = (customer: Customer) => {
        setActiveCustomer(customer);
        setModalTab('DETAILS');
        setShowModal(true);
        if (customer.id) {
            loadCustomerWOs(customer.id);
        }
    };

    const handleSaveCustomer = async () => {
        if (!activeCustomer.name?.trim()) {
            alert("Customer Name is required.");
            return;
        }

        setSaving(true);
        try {
            if (activeCustomer.id) {
                await updateCustomer(activeCustomer.id, {
                    ...activeCustomer,
                    name: activeCustomer.name.trim(),
                    owner_id: activeCustomer.owner_id || null
                });
            } else {
                await createCustomer({
                    ...activeCustomer,
                    name: activeCustomer.name.trim(),
                    status: activeCustomer.status || 'Active',
                    owner_id: activeCustomer.owner_id || user?.id,
                    created_by: user?.id,
                    company_id: companyId,
                    contract_type: activeCustomer.contract_type || 'Call-Off / Work Order Basis'
                });
            }
            setShowModal(false);
            await loadCustomers(true);
            await loadAllWOs(true);
        } catch (err: any) {
            console.error('Error saving customer:', err);
            alert("Failed to save customer: " + (err.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    // Work Order Handlers
    const handleOpenAddWO = (preselectedCustomerId?: string) => {
        const customer = preselectedCustomerId ? customers.find(c => c.id === preselectedCustomerId) : undefined;
        setActiveWO({
            company_id: companyId,
            customer_id: preselectedCustomerId || (customers[0]?.id || ''),
            contract_ref: customer?.contract_number || 'QCTCM2922',
            currency: 'QAR',
            status: 'In Progress',
            issue_date: new Date().toISOString().split('T')[0],
            start_date: new Date().toISOString().split('T')[0]
        });
        setShowWOModal(true);
    };

    const handleEditWO = (wo: CRMCustomerWorkOrder) => {
        setActiveWO({ ...wo });
        setShowWOModal(true);
    };

    const handleSaveWO = async () => {
        if (!activeWO.customer_id) {
            alert("Please select a Customer / Client.");
            return;
        }
        if (!activeWO.wo_number?.trim()) {
            alert("PO / WO Number is required (e.g. WO #5000031062 or 443368).");
            return;
        }
        if (!activeWO.description?.trim()) {
            alert("Description / Scope of Work is required.");
            return;
        }

        setSavingWO(true);
        try {
            if (activeWO.id) {
                await updateCustomerWorkOrder(activeWO.id, {
                    customer_id: activeWO.customer_id,
                    wo_number: activeWO.wo_number.trim(),
                    contract_ref: activeWO.contract_ref?.trim() || null as any,
                    description: activeWO.description.trim(),
                    amount: activeWO.amount ? Number(activeWO.amount) : undefined,
                    currency: activeWO.currency || 'QAR',
                    issue_date: activeWO.issue_date || null as any,
                    start_date: activeWO.start_date || null as any,
                    completion_date: activeWO.completion_date || null as any,
                    status: activeWO.status || 'In Progress',
                    remarks: activeWO.remarks || null as any,
                    document_url: activeWO.document_url || null as any
                });
            } else {
                await createCustomerWorkOrder({
                    company_id: companyId,
                    customer_id: activeWO.customer_id,
                    wo_number: activeWO.wo_number.trim(),
                    contract_ref: activeWO.contract_ref?.trim() || null as any,
                    description: activeWO.description.trim(),
                    amount: activeWO.amount ? Number(activeWO.amount) : undefined,
                    currency: activeWO.currency || 'QAR',
                    issue_date: activeWO.issue_date || null as any,
                    start_date: activeWO.start_date || null as any,
                    completion_date: activeWO.completion_date || null as any,
                    status: activeWO.status || 'In Progress',
                    remarks: activeWO.remarks || null as any,
                    document_url: activeWO.document_url || null as any,
                    created_by: user?.id
                });
            }

            setShowWOModal(false);
            await loadAllWOs(true);
            if (activeCustomer.id) {
                await loadCustomerWOs(activeCustomer.id);
            }
        } catch (err: any) {
            console.error('Error saving Work Order:', err);
            alert("Failed to save Work Order: " + (err.message || 'Unknown error'));
        } finally {
            setSavingWO(false);
        }
    };

    const handleDeleteWO = async (id: string) => {
        if (!confirm("Are you sure you want to delete this Work Order / PO?")) return;
        try {
            await deleteCustomerWorkOrder(id);
            await loadAllWOs(true);
            if (activeCustomer.id) {
                await loadCustomerWOs(activeCustomer.id);
            }
        } catch (err: any) {
            console.error("Error deleting Work Order:", err);
            alert("Failed to delete Work Order: " + (err.message || 'Unknown error'));
        }
    };

    // Filtered Customers
    const filteredCustomers = customers.filter(customer => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            (customer.name || '').toLowerCase().includes(q) ||
            (customer.contract_number || '').toLowerCase().includes(q) ||
            (customer.contract_title || '').toLowerCase().includes(q) ||
            (customer.primary_email || '').toLowerCase().includes(q) ||
            (customer.primary_phone || '').toLowerCase().includes(q) ||
            (customer.industry || '').toLowerCase().includes(q) ||
            (customer.customer_type || '').toLowerCase().includes(q) ||
            (customer.billing_city || '').toLowerCase().includes(q)
        );
    });

    // Filtered Work Orders (matching the exact report format)
    const filteredWorkOrders = workOrders.filter(wo => {
        if (selectedClientFilter !== 'ALL' && wo.customer_id !== selectedClientFilter) {
            return false;
        }
        if (selectedStatusFilter !== 'ALL' && wo.status !== selectedStatusFilter) {
            return false;
        }
        if (woSearchQuery.trim()) {
            const q = woSearchQuery.toLowerCase().trim();
            const clientName = (wo.customer?.name || '').toLowerCase();
            const woNum = (wo.wo_number || '').toLowerCase();
            const desc = (wo.description || '').toLowerCase();
            const contract = (wo.contract_ref || '').toLowerCase();
            const remarks = (wo.remarks || '').toLowerCase();
            return clientName.includes(q) || woNum.includes(q) || desc.includes(q) || contract.includes(q) || remarks.includes(q);
        }
        return true;
    });

    // Counts & Stats
    const totalWOs = workOrders.length;
    const inProgressWOs = workOrders.filter(w => w.status === 'In Progress').length;
    const completedWOs = workOrders.filter(w => w.status === 'Completed').length;
    const totalValueUSD = workOrders.reduce((sum, w) => sum + (w.currency === 'USD' ? (Number(w.amount) || 0) : 0), 0);
    const totalValueQAR = workOrders.reduce((sum, w) => sum + (w.currency === 'QAR' || !w.currency ? (Number(w.amount) || 0) : 0), 0);

    // CSV Export
    const handleExportCSV = () => {
        if (filteredWorkOrders.length === 0) {
            alert("No work orders to export.");
            return;
        }
        const headers = ["SL.NO", "Client", "Description", "PO / WO Number", "Contract Ref", "Amount", "Currency", "Status", "Issue Date", "Remarks"];
        const rows = filteredWorkOrders.map((wo, idx) => [
            idx + 1,
            `"${(wo.customer?.name || '').replace(/"/g, '""')}"`,
            `"${(wo.description || '').replace(/"/g, '""')}"`,
            `"${(wo.wo_number || '').replace(/"/g, '""')}"`,
            `"${(wo.contract_ref || '').replace(/"/g, '""')}"`,
            wo.amount || 0,
            wo.currency || 'QAR',
            wo.status || '',
            wo.issue_date || '',
            `"${(wo.remarks || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Call_Off_Work_Orders_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
            {/* Header & View Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">CRM Customers & Call-Off Contracts</h2>
                        {!isAdmin && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full">
                                <Lock size={11} /> Private View
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 text-xs md:text-sm mt-0.5">
                        Manage corporate client contracts (e.g. QCTCM2922 Q-CHEM / RLOC) and call-off work orders / purchase orders
                    </p>
                </div>

                {/* Sub-Tab Navigation Bar */}
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700">
                    <button
                        onClick={() => setActiveViewTab('CUSTOMERS')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                            activeViewTab === 'CUSTOMERS'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title="View list of clients and corporate customers"
                    >
                        <Users size={15} />
                        <span>Clients & Customers</span>
                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[11px] rounded-full font-bold">
                            {customers.length} Clients
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveViewTab('WORK_ORDERS_REPORT')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                            activeViewTab === 'WORK_ORDERS_REPORT'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title="View all Call-Off Work Orders and Purchase Orders across contracts"
                    >
                        <FileText size={15} />
                        <span>Call-Off Work Orders & POs</span>
                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[11px] rounded-full font-bold">
                            {workOrders.length} Orders
                        </span>
                    </button>
                </div>
            </div>

            {/* TAB 1: CUSTOMER DIRECTORY VIEW */}
            {activeViewTab === 'CUSTOMERS' && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Customer Controls Toolbar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 flex-1 max-w-xl">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search by client name, contract #, email, phone, city..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-7 py-2 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Admin Sales Rep Filter */}
                            {isAdmin && (
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700">
                                    <Shield size={14} className="text-indigo-600 dark:text-indigo-400" />
                                    <span className="text-xs font-bold text-slate-500">Rep:</span>
                                    <select
                                        value={selectedOwnerFilter}
                                        onChange={(e) => setSelectedOwnerFilter(e.target.value)}
                                        className="text-xs font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                                    >
                                        <option value="ALL">All Sales Reps</option>
                                        <option value={user?.id}>My Customers Only</option>
                                        {salesReps.map(rep => (
                                            <option key={rep.id} value={rep.profileId || rep.id}>{rep.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleOpenAddWO()}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm text-xs font-semibold"
                            >
                                <Plus size={15} />
                                <span>Add Work Order / PO</span>
                            </button>

                            <button
                                onClick={() => {
                                    setActiveCustomer({
                                        customer_type: 'Company',
                                        status: 'Active',
                                        start_date: new Date().toISOString().split('T')[0],
                                        contract_type: 'Call-Off / Work Order Basis'
                                    });
                                    setModalTab('DETAILS');
                                    setShowModal(true);
                                }}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-xs font-semibold"
                            >
                                <Plus size={15} />
                                <span>New Customer</span>
                            </button>
                        </div>
                    </div>

                    {/* Customer Cards Grid */}
                    <div className="flex-1 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-2xl border border-slate-100 dark:border-zinc-800 p-4 overflow-y-auto shadow-sm">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                            </div>
                        ) : customers.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                                <Users className="w-12 h-12 mb-3 opacity-30" />
                                <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300">No CRM customers yet</h3>
                                <p className="text-sm mt-1 mb-4">Create your first client account to start managing Call-Off contracts and Work Orders</p>
                                <button
                                    onClick={() => {
                                        setActiveCustomer({ customer_type: 'Company', status: 'Active', start_date: new Date().toISOString().split('T')[0] });
                                        setShowModal(true);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
                                >
                                    <Plus size={16} />
                                    <span>Add First Customer</span>
                                </button>
                            </div>
                        ) : filteredCustomers.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                                <Search className="w-10 h-10 mb-2 opacity-30" />
                                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">No matching customers</h3>
                                <p className="text-xs text-slate-400 mt-1">No clients match "{searchQuery}"</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredCustomers.map(customer => {
                                    const clientWOs = workOrders.filter(w => w.customer_id === customer.id);
                                    return (
                                        <div
                                            key={customer.id}
                                            onClick={() => handleOpenCustomer(customer)}
                                            className="group bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer flex flex-col justify-between"
                                        >
                                            <div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-base">
                                                            {(customer.name || '?')[0]}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                                {customer.name}
                                                            </h3>
                                                            <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                                                <Building size={11} /> {customer.industry || 'General Industry'} • {customer.customer_type}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                        customer.status === 'Active' 
                                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                                                            : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400'
                                                    }`}>
                                                        {customer.status}
                                                    </span>
                                                </div>

                                                {/* Master Contract Badge / Call-Off Status */}
                                                {customer.contract_number ? (
                                                    <div className="mt-2.5 p-2 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-100 dark:border-blue-900/40">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                                                                Contract: {customer.contract_number}
                                                            </span>
                                                            <span className="text-[10px] font-medium text-slate-500 bg-white/80 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                                                Call-Off Basis
                                                            </span>
                                                        </div>
                                                        {customer.contract_title && (
                                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium line-clamp-1 mt-1">
                                                                {customer.contract_title}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : null}

                                                {/* Start Date & Work Orders Badge */}
                                                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                                                    <div className="flex items-center gap-1 text-slate-500">
                                                        <Calendar size={12} className="text-slate-400" />
                                                        <span>
                                                            {customer.start_date ? `Client Since: ${customer.start_date}` : 'Start date not set'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                                                        <FileText size={11} />
                                                        <span>{clientWOs.length} {clientWOs.length === 1 ? 'Work Order' : 'Work Orders'}</span>
                                                    </div>
                                                </div>

                                                {/* Owner & Creator Details */}
                                                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 dark:border-zinc-800/80 pt-2">
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <div className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[9px] font-bold">
                                                            {(customer.owner?.name || customer.creator?.name || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <span className="truncate">
                                                            Owner: <strong className="font-semibold text-slate-700 dark:text-slate-300">{customer.owner?.name || customer.creator?.name || 'Unassigned'}</strong>
                                                        </span>
                                                    </div>
                                                    {customer.creator?.name && customer.creator?.name !== customer.owner?.name && (
                                                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={`Created by ${customer.creator.name}`}>
                                                            By: {customer.creator.name}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Remarks Preview */}
                                                {customer.remarks && (
                                                    <div className="mt-2 p-1.5 bg-slate-50 dark:bg-zinc-800/60 rounded text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-2 border-l-2 border-indigo-400">
                                                        "{customer.remarks}"
                                                    </div>
                                                )}
                                            </div>

                                            {/* Contact & Actions Footer */}
                                            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500">
                                                <div className="truncate pr-2">
                                                    {customer.primary_email || customer.primary_phone || customer.billing_city || 'No direct contact'}
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenAddWO(customer.id);
                                                    }}
                                                    className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                                                >
                                                    <Plus size={11} /> +WO
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: CALL-OFF WORK ORDERS & POs REPORT VIEW (Matches client screenshot media_1789817708760.jpg) */}
            {activeViewTab === 'WORK_ORDERS_REPORT' && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Contract Banner & Report Subtitle */}
                    <div className="mb-3 px-4 py-3 bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                                <FileCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm md:text-base font-bold text-white tracking-wide">
                                        Call-Off Contracts Work Order & PO Register
                                    </h3>
                                    <span className="text-[10px] uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                                        Contract QCTCM2922 & Call-On Orders
                                    </span>
                                </div>
                                <p className="text-[11px] text-blue-200 mt-0.5 line-clamp-1">
                                    GRP FRP AND PROCESS PIPING repair services at Q-CHEM, Q-CHEM II AND RLOC ON — Call-On Basis by Work Order
                                </p>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowPrintModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all border border-white/20"
                            >
                                <Printer size={14} />
                                <span>Print Report</span>
                            </button>
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all border border-white/20"
                            >
                                <Download size={14} />
                                <span>Export CSV</span>
                            </button>
                            <button
                                onClick={() => handleOpenAddWO()}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/30"
                            >
                                <Plus size={15} />
                                <span>+ Add Work Order / PO</span>
                            </button>
                        </div>
                    </div>

                    {/* KPI Quick Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-medium text-slate-500">Total Work Orders</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{totalWOs}</p>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                                <FileText size={16} />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-medium text-slate-500">In Progress</p>
                                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{inProgressWOs}</p>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                                <Clock size={16} />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-medium text-slate-500">Completed</p>
                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{completedWOs}</p>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 size={16} />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-medium text-slate-500">Logged Value (USD / QAR)</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                    {totalValueUSD > 0 ? `$${totalValueUSD.toLocaleString()} USD` : ''} 
                                    {totalValueUSD > 0 && totalValueQAR > 0 ? ' + ' : ''}
                                    {totalValueQAR > 0 ? `${totalValueQAR.toLocaleString()} QAR` : (totalValueUSD === 0 ? '0' : '')}
                                </p>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                                <DollarSign size={16} />
                            </div>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                        <div className="flex flex-wrap items-center gap-3 flex-1">
                            {/* Search */}
                            <div className="relative min-w-[220px] flex-1 max-w-md">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search WO#, Description, Client, Contract..."
                                    value={woSearchQuery}
                                    onChange={e => setWoSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                                />
                                {woSearchQuery && (
                                    <button onClick={() => setWoSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Client Filter */}
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-slate-400 font-medium">Client:</span>
                                <select
                                    value={selectedClientFilter}
                                    onChange={e => setSelectedClientFilter(e.target.value)}
                                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200"
                                >
                                    <option value="ALL">All Clients ({customers.length})</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Filter */}
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-slate-400 font-medium">Status:</span>
                                <select
                                    value={selectedStatusFilter}
                                    onChange={e => setSelectedStatusFilter(e.target.value)}
                                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200"
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Billed">Billed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        <span className="text-xs text-slate-500 font-medium">
                            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredWorkOrders.length}</strong> records
                        </span>
                    </div>

                    {/* Table (EXACT MATCH to Client's Attached Screenshot) */}
                    <div className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-auto shadow-sm">
                        {woLoading ? (
                            <div className="h-full flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                            </div>
                        ) : filteredWorkOrders.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                                <FileText className="w-12 h-12 mb-3 opacity-30" />
                                <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300">No Work Orders Found</h3>
                                <p className="text-xs text-slate-400 mt-1 mb-4">Add your first Call-Off Work Order or PO to populate this report</p>
                                <button
                                    onClick={() => handleOpenAddWO()}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
                                >
                                    <Plus size={14} /> Add Work Order / PO
                                </button>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-zinc-700 sticky top-0 z-10">
                                        <th className="py-3 px-3 w-14 text-center">SL.NO</th>
                                        <th className="py-3 px-4 min-w-[180px]">Client</th>
                                        <th className="py-3 px-4 min-w-[280px]">Description</th>
                                        <th className="py-3 px-4 min-w-[150px]">PO/ WO</th>
                                        <th className="py-3 px-3 min-w-[120px]">Contract Ref</th>
                                        <th className="py-3 px-3 min-w-[100px]">Amount</th>
                                        <th className="py-3 px-3 min-w-[100px]">Status</th>
                                        <th className="py-3 px-4 min-w-[140px]">Remarks</th>
                                        <th className="py-3 px-3 w-20 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {filteredWorkOrders.map((wo, idx) => (
                                        <tr 
                                            key={wo.id}
                                            className="hover:bg-indigo-50/40 dark:hover:bg-zinc-800/50 transition-colors group"
                                        >
                                            <td className="py-3 px-3 text-center font-semibold text-slate-500">
                                                {idx + 1}
                                            </td>
                                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{wo.customer?.name || 'Unknown Client'}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                                                {wo.description}
                                            </td>
                                            <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                {wo.wo_number}
                                            </td>
                                            <td className="py-3 px-3 text-slate-500 font-medium">
                                                {wo.contract_ref || '—'}
                                            </td>
                                            <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                {wo.amount ? `${wo.amount.toLocaleString()} ${wo.currency || 'QAR'}` : '—'}
                                            </td>
                                            <td className="py-3 px-3">
                                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    wo.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                                    wo.status === 'In Progress' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                                                    wo.status === 'Billed' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' :
                                                    'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300'
                                                }`}>
                                                    {wo.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400 italic text-[11px]">
                                                {wo.remarks || '—'}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleEditWO(wo)}
                                                        title="Edit Work Order"
                                                        className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-500 hover:text-indigo-600"
                                                    >
                                                        <Edit size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteWO(wo.id)}
                                                        title="Delete Work Order"
                                                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded text-slate-400 hover:text-red-600"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL 1: CUSTOMER DETAILS / CONTRACT / DOCUMENTS MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>{activeCustomer.id ? activeCustomer.name : 'New CRM Customer'}</span>
                                    {activeCustomer.id && activeCustomer.contract_number && (
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                            {activeCustomer.contract_number}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    CRM Client Master & Call-Off Contract Setup (Doc upload, remarks, start date, and work order provisions)
                                </p>
                            </div>
                            <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
                        </div>

                        {/* Modal Tabs Header */}
                        <div className="flex border-b border-slate-100 dark:border-zinc-800 px-6 bg-slate-50/30 dark:bg-zinc-800/30 gap-6">
                            <button
                                onClick={() => setModalTab('DETAILS')}
                                className={`py-3 text-xs font-bold border-b-2 transition-all ${
                                    modalTab === 'DETAILS'
                                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                1. General Info & Remarks
                            </button>
                            <button
                                onClick={() => setModalTab('CONTRACT')}
                                className={`py-3 text-xs font-bold border-b-2 transition-all ${
                                    modalTab === 'CONTRACT'
                                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                2. Call-Off Contract & Scope
                            </button>
                            {activeCustomer.id && (
                                <>
                                    <button
                                        onClick={() => setModalTab('WORK_ORDERS')}
                                        className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                                            modalTab === 'WORK_ORDERS'
                                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <span>3. Work Orders & POs</span>
                                        <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-zinc-700 text-[10px]">
                                            {customerModalWOs.length}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setModalTab('DOCUMENTS')}
                                        className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                                            modalTab === 'DOCUMENTS'
                                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <Paperclip size={13} />
                                        <span>4. Doc Upload Provision</span>
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* TAB 1: General Details */}
                            {modalTab === 'DETAILS' && (
                                <div className="space-y-6">
                                    <Section title="Client Profile & Start Date">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="sm:col-span-2">
                                                <Input
                                                    label="Customer / Client Name"
                                                    required
                                                    value={activeCustomer.name}
                                                    onChange={(v: string) => setActiveCustomer({ ...activeCustomer, name: v })}
                                                    placeholder="e.g. QCHEM (Qatar Chemical Company Ltd)"
                                                />
                                            </div>
                                            <Select
                                                label="Customer Type"
                                                options={['Company', 'Individual']}
                                                value={activeCustomer.customer_type || 'Company'}
                                                onChange={(v: string) => setActiveCustomer({ ...activeCustomer, customer_type: v })}
                                            />
                                            <Input
                                                label="Customer Start Date"
                                                type="date"
                                                value={activeCustomer.start_date}
                                                onChange={(v: string) => setActiveCustomer({ ...activeCustomer, start_date: v })}
                                            />
                                            <Select
                                                label="Account Status"
                                                options={['Active', 'Inactive']}
                                                value={activeCustomer.status || 'Active'}
                                                onChange={(v: string) => setActiveCustomer({ ...activeCustomer, status: v })}
                                            />
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-500">Account Owner / Sales Rep</label>
                                                <div className="relative">
                                                    <select
                                                        value={activeCustomer.owner_id || ''}
                                                        onChange={e => setActiveCustomer({ ...activeCustomer, owner_id: e.target.value || null as any })}
                                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs appearance-none text-slate-800 dark:text-slate-200 cursor-pointer"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {salesReps.map(rep => (
                                                            <option key={rep.id} value={rep.profileId || rep.id}>{rep.name}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                                </div>
                                            </div>
                                            <Input
                                                label="Industry / Sector"
                                                value={activeCustomer.industry}
                                                onChange={(v: string) => setActiveCustomer({ ...activeCustomer, industry: v })}
                                                placeholder="e.g. Petrochemical / Oil & Gas"
                                            />
                                            <Input
                                                label="Tax ID / Commercial Reg (CR)"
                                                value={activeCustomer.tax_id}
                                                onChange={(v: string) => setActiveCustomer({ ...activeCustomer, tax_id: v })}
                                                placeholder="e.g. CR-987654"
                                            />
                                            <div className="sm:col-span-2">
                                                <Input
                                                    label="Website"
                                                    value={activeCustomer.website}
                                                    onChange={(v: string) => setActiveCustomer({ ...activeCustomer, website: v })}
                                                    placeholder="https://..."
                                                />
                                            </div>
                                            {activeCustomer.creator?.name && (
                                                <div className="sm:col-span-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500">
                                                    <span>Created by: <strong className="font-semibold text-slate-700 dark:text-slate-300">{activeCustomer.creator.name}</strong></span>
                                                    {activeCustomer.created_at && (
                                                        <span>{new Date(activeCustomer.created_at).toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </Section>

                                    <Section title="Primary Contact & Address">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input
                                                label="Primary Email"
                                                type="email"
                                                value={activeCustomer.primary_email}
                                                onChange={(v: string) => setActiveCustomer({ ...activeCustomer, primary_email: v })}
                                                placeholder="contact@company.com"
                                            />
                                            <Input
                                                label="Primary Phone / Mobile"
                                                value={activeCustomer.primary_phone}
                                                onChange={(v: string) => setActiveCustomer({ ...activeCustomer, primary_phone: v })}
                                                placeholder="+974 ..."
                                            />
                                            <Input
                                                label="Billing Address Line 1"
                                                value={activeCustomer.billing_address_line_1}
                                                onChange={(v: string) => setActiveCustomer({ ...activeCustomer, billing_address_line_1: v })}
                                                placeholder="Building, Street"
                                            />
                                            <Input
                                                label="City / Industrial Area"
                                                value={activeCustomer.billing_city}
                                                onChange={(v: string) => setActiveCustomer({ ...activeCustomer, billing_city: v })}
                                                placeholder="e.g. Mesaieed / Ras Laffan"
                                            />
                                            <Input
                                                label="State / Province"
                                                value={activeCustomer.billing_state}
                                                onChange={(v: string) => setActiveCustomer({ ...activeCustomer, billing_state: v })}
                                            />
                                            <Input
                                                label="Country"
                                                value={activeCustomer.billing_country || 'Qatar'}
                                                onChange={(v: string) => setActiveCustomer({ ...activeCustomer, billing_country: v })}
                                            />
                                        </div>
                                    </Section>

                                    {/* Remarks Provision */}
                                    <Section title="Customer Remarks Provision">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-500">Remarks & Special Instructions</label>
                                            <textarea
                                                rows={3}
                                                value={activeCustomer.remarks || ''}
                                                onChange={e => setActiveCustomer({ ...activeCustomer, remarks: e.target.value })}
                                                placeholder="Add general remarks, special instructions, access gate pass requirements, invoicing protocols, etc."
                                                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            />
                                        </div>
                                    </Section>
                                </div>
                            )}

                            {/* TAB 2: Contract Details */}
                            {modalTab === 'CONTRACT' && (
                                <div className="space-y-5">
                                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-900 dark:text-blue-200">
                                        <h4 className="font-bold mb-1 flex items-center gap-1.5">
                                            <Briefcase size={14} /> Master Call-Off Contract Configuration
                                        </h4>
                                        <p>
                                            For long-term framework agreements (such as Q-CHEM & RLOC Master Agreement), enter the contract number and scope here.
                                            Individual Work Orders and Purchase Orders will be executed under this contract reference.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input
                                            label="Contract Number / Reference"
                                            value={activeCustomer.contract_number}
                                            onChange={(v: string) => setActiveCustomer({ ...activeCustomer, contract_number: v })}
                                            placeholder="e.g. QCTCM2922"
                                        />
                                        <Input
                                            label="Contract Type"
                                            value={activeCustomer.contract_type || 'Call-Off / Work Order Basis'}
                                            onChange={(v: string) => setActiveCustomer({ ...activeCustomer, contract_type: v })}
                                            placeholder="Call-Off / Work Order Basis"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500">Contract Scope & Title</label>
                                        <textarea
                                            rows={3}
                                            value={activeCustomer.contract_title || ''}
                                            onChange={e => setActiveCustomer({ ...activeCustomer, contract_title: e.target.value })}
                                            placeholder="e.g. GRP FRP AND PROCESS PIPING repair services at Q-CHEM, Q-CHEM II AND RLOC ON"
                                            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: Work Orders Provision */}
                            {modalTab === 'WORK_ORDERS' && activeCustomer.id && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                                                Call-Off Work Orders for {activeCustomer.name}
                                            </h4>
                                            <p className="text-xs text-slate-500">
                                                Track each PO or Work Order executed under Contract {activeCustomer.contract_number || 'Call-Off'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleOpenAddWO(activeCustomer.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
                                        >
                                            <Plus size={14} /> Add Work Order / PO
                                        </button>
                                    </div>

                                    {customerModalWOs.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                                            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                            <p className="text-xs">No work orders logged for this client yet.</p>
                                        </div>
                                    ) : (
                                        <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 dark:bg-zinc-800 font-semibold text-slate-600 dark:text-slate-300">
                                                    <tr>
                                                        <th className="py-2.5 px-3">PO / WO Number</th>
                                                        <th className="py-2.5 px-3">Description</th>
                                                        <th className="py-2.5 px-3">Amount</th>
                                                        <th className="py-2.5 px-3">Status</th>
                                                        <th className="py-2.5 px-3 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                    {customerModalWOs.map(wo => (
                                                        <tr key={wo.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                {wo.wo_number}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                                                {wo.description}
                                                            </td>
                                                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                                                {wo.amount ? `${wo.amount.toLocaleString()} ${wo.currency || 'QAR'}` : '—'}
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                                                                    {wo.status}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <button
                                                                        onClick={() => handleEditWO(wo)}
                                                                        className="p-1 text-slate-500 hover:text-indigo-600"
                                                                    >
                                                                        <Edit size={13} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteWO(wo.id)}
                                                                        className="p-1 text-slate-400 hover:text-red-600"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 4: Doc Upload Provision */}
                            {modalTab === 'DOCUMENTS' && activeCustomer.id && (
                                <div className="space-y-4">
                                    <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs text-slate-600 dark:text-slate-300">
                                        <p className="font-semibold text-slate-800 dark:text-white mb-0.5">
                                            Customer Document & Contract Repository
                                        </p>
                                        <p>
                                            Upload signed master contracts, rate cards, work order scans, insurance certificates, and agreements.
                                        </p>
                                    </div>
                                    <AttachmentPanel
                                        companyId={companyId}
                                        module="customer"
                                        recordId={activeCustomer.id}
                                        userId={user?.id}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors font-semibold text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveCustomer}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 font-bold text-xs disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                                <span>Save Customer Account</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: WORK ORDER / PO MODAL (ADD / EDIT) */}
            {showWOModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <FileText size={16} className="text-indigo-600" />
                                    <span>{activeWO.id ? 'Edit Call-Off Work Order / PO' : 'New Call-Off Work Order / PO'}</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Execute work order under client's call-off contract (e.g. QCTCM2922)
                                </p>
                            </div>
                            <button type="button" onClick={() => setShowWOModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* Client Selector */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                    Client / Customer <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={activeWO.customer_id || ''}
                                    onChange={e => {
                                        const custId = e.target.value;
                                        const cust = customers.find(c => c.id === custId);
                                        setActiveWO({
                                            ...activeWO,
                                            customer_id: custId,
                                            contract_ref: cust?.contract_number || activeWO.contract_ref || 'QCTCM2922'
                                        });
                                    }}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">Select Client...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} {c.contract_number ? `(${c.contract_number})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    label="PO / Work Order Number"
                                    required
                                    value={activeWO.wo_number}
                                    onChange={(v: string) => setActiveWO({ ...activeWO, wo_number: v })}
                                    placeholder="e.g. WO #5000031062 or 443368"
                                />
                                <Input
                                    label="Master Contract Reference"
                                    value={activeWO.contract_ref}
                                    onChange={(v: string) => setActiveWO({ ...activeWO, contract_ref: v })}
                                    placeholder="e.g. QCTCM2922"
                                />
                            </div>

                            {/* Description / Scope */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                    Description / Scope of Work <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    value={activeWO.description || ''}
                                    onChange={e => setActiveWO({ ...activeWO, description: e.target.value })}
                                    placeholder="e.g. Repair LGMECH- Underground Fire Water Line Leaking or GRP Piping Top Resin Coat Rectification"
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2">
                                    <Input
                                        label="Amount (Value)"
                                        type="number"
                                        value={activeWO.amount}
                                        onChange={(v: string) => setActiveWO({ ...activeWO, amount: Number(v) })}
                                        placeholder="e.g. 14116.49"
                                    />
                                </div>
                                <Select
                                    label="Currency"
                                    options={['QAR', 'USD', 'EUR', 'SAR']}
                                    value={activeWO.currency || 'QAR'}
                                    onChange={(v: string) => setActiveWO({ ...activeWO, currency: v })}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Input
                                    label="Issue / PO Date"
                                    type="date"
                                    value={activeWO.issue_date}
                                    onChange={(v: string) => setActiveWO({ ...activeWO, issue_date: v })}
                                />
                                <Input
                                    label="Start Date"
                                    type="date"
                                    value={activeWO.start_date}
                                    onChange={(v: string) => setActiveWO({ ...activeWO, start_date: v })}
                                />
                                <Select
                                    label="Status"
                                    options={['In Progress', 'Pending', 'Completed', 'Billed', 'Cancelled']}
                                    value={activeWO.status || 'In Progress'}
                                    onChange={(v: string) => setActiveWO({ ...activeWO, status: v })}
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    Work Order Remarks
                                </label>
                                <textarea
                                    rows={2}
                                    value={activeWO.remarks || ''}
                                    onChange={e => setActiveWO({ ...activeWO, remarks: e.target.value })}
                                    placeholder="e.g. Awaiting spare flange gasket; inspection scheduled with Q-CHEM supervisor"
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            {/* Document upload for this specific work order if editing */}
                            {activeWO.id && (
                                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-2">
                                        Attached PO / WO Documents
                                    </label>
                                    <AttachmentPanel
                                        companyId={companyId}
                                        module="customer_work_order"
                                        recordId={activeWO.id}
                                        userId={user?.id}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            <button
                                type="button"
                                onClick={() => setShowWOModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors font-semibold text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveWO}
                                disabled={savingWO}
                                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20 font-bold text-xs disabled:opacity-50"
                            >
                                {savingWO ? <Loader2 size={15} className="animate-spin" /> : null}
                                <span>Save Work Order / PO</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: PRINTABLE REPORT MODAL (Matching media_1789817708760.jpg) */}
            {showPrintModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white text-slate-900 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Non-printed action toolbar */}
                        <div className="p-4 bg-slate-100 border-b border-slate-200 flex justify-between items-center print:hidden">
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Print Preview — Call-Off Work Orders & PO Report</h4>
                                <p className="text-xs text-slate-500">Form: QCTCM2922 & Call-On Contract Operations</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition-all"
                                >
                                    <Printer size={15} /> Print Now
                                </button>
                                <button
                                    onClick={() => setShowPrintModal(false)}
                                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        {/* Printable Area */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            {/* Report Header */}
                            <div className="border-b-2 border-slate-800 pb-4 flex justify-between items-start">
                                <div>
                                    <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                                        KAA ENTERPRISE ERP — CALL-OFF CONTRACT REGISTER
                                    </h1>
                                    <p className="text-xs text-slate-600 mt-1 font-semibold">
                                        MASTER CONTRACT: QCTCM2922 - GRP FRP AND PROCESS PIPING REPAIR SERVICES AT Q-CHEM, Q-CHEM II AND RLOC ON
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Execution Basis: Call-On Basis (Per Work Order / Purchase Order)
                                    </p>
                                </div>
                                <div className="text-right text-xs">
                                    <p className="font-bold text-slate-800">Date: {new Date().toLocaleDateString('en-GB')}</p>
                                    <p className="text-slate-500 mt-0.5">Total Records: {filteredWorkOrders.length}</p>
                                </div>
                            </div>

                            {/* Exact Table Layout from Screenshot */}
                            <table className="w-full border-collapse text-xs border border-slate-300">
                                <thead>
                                    <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-300">
                                        <th className="py-2.5 px-3 border border-slate-300 text-center w-14">SL.NO</th>
                                        <th className="py-2.5 px-3 border border-slate-300 min-w-[180px]">Client</th>
                                        <th className="py-2.5 px-3 border border-slate-300 min-w-[260px]">Description</th>
                                        <th className="py-2.5 px-3 border border-slate-300 min-w-[160px]">PO/ WO</th>
                                        <th className="py-2.5 px-3 border border-slate-300 min-w-[90px] text-center">Status</th>
                                        <th className="py-2.5 px-3 border border-slate-300 min-w-[100px] text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredWorkOrders.map((wo, idx) => (
                                        <tr key={wo.id} className="border-b border-slate-200">
                                            <td className="py-2.5 px-3 border border-slate-300 text-center font-bold text-slate-700">
                                                {idx + 1}
                                            </td>
                                            <td className="py-2.5 px-3 border border-slate-300 font-bold text-slate-900">
                                                {wo.customer?.name || '—'}
                                            </td>
                                            <td className="py-2.5 px-3 border border-slate-300 text-slate-800 font-medium">
                                                {wo.description}
                                            </td>
                                            <td className="py-2.5 px-3 border border-slate-300 font-mono font-bold text-slate-900">
                                                {wo.wo_number}
                                            </td>
                                            <td className="py-2.5 px-3 border border-slate-300 text-center font-semibold text-slate-700">
                                                {wo.status}
                                            </td>
                                            <td className="py-2.5 px-3 border border-slate-300 text-right font-semibold text-slate-900">
                                                {wo.amount ? `${wo.amount.toLocaleString()} ${wo.currency || 'QAR'}` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="pt-8 flex justify-between text-xs text-slate-500 border-t border-slate-200">
                                <div>
                                    <p className="font-semibold text-slate-700">Prepared By: Operations & Contracts Team</p>
                                    <p>KAA Enterprise Resource Planning System</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-slate-700">Approved By: Project Director</p>
                                    <p>Sign & Stamp: ___________________</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Reusable Sub-Components
const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800 pb-2">
            {title}
        </h4>
        {children}
    </div>
);

const Input = ({ label, value, onChange, type = "text", required, disabled, placeholder }: any) => (
    <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500 flex gap-1">
            {label}
            {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type}
            value={value || ''}
            placeholder={placeholder}
            onChange={e => onChange?.(e.target.value)}
            disabled={disabled}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs disabled:opacity-50 text-slate-800 dark:text-slate-200"
        />
    </div>
);

const Select = ({ label, options, value, onChange }: any) => (
    <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">{label}</label>
        <div className="relative">
            <select
                value={value || ''}
                onChange={e => onChange?.(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs appearance-none text-slate-800 dark:text-slate-200 cursor-pointer"
            >
                <option value="">Select...</option>
                {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
    </div>
);
