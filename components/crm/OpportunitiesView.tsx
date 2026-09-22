import React, { useState, useEffect } from 'react';
import { Plus, LayoutGrid, List as ListIcon, Calendar, ChevronDown, MoreHorizontal, KanbanSquare, Loader2, ArrowRight, Trophy, XCircle, Link2, Lock, Shield, Building, Mail, Phone, Globe, MapPin, X } from 'lucide-react';
import { Opportunity, Customer, Stage, CRMViewMode } from './types';
import { getOpportunities, createOpportunity, updateOpportunity, getStages, getCustomers, createCustomer, convertOpportunityToCustomer, checkIsAdmin, getSalesReps } from './services';
import { useAuth } from '../../contexts/AuthContext';

interface OpportunitiesViewProps {
    companyId: string;
    onConvert?: (tab: CRMViewMode) => void;
}

export default function OpportunitiesView({ companyId, onConvert }: OpportunitiesViewProps) {
    const { user, userRole } = useAuth();
    const isAdmin = checkIsAdmin(userRole);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [salesReps, setSalesReps] = useState<{ id: string; name: string; profileId?: string }[]>([]);
    const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('ALL');
    const [stages, setStages] = useState<Stage[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [activeOpp, setActiveOpp] = useState<Partial<Opportunity>>({ currency: 'QAR' });
    const [viewMode, setViewMode] = useState<'KANBAN' | 'LIST'>('KANBAN');
    const [draggedOppId, setDraggedOppId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [converting, setConverting] = useState(false);
    const [showLossModal, setShowLossModal] = useState(false);
    const [lossReason, setLossReason] = useState('');

    // Quick Add CRM Customer states
    const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
    const [savingQuickCustomer, setSavingQuickCustomer] = useState(false);
    const [quickCustomer, setQuickCustomer] = useState<{
        name: string;
        customer_type: string;
        primary_email: string;
        primary_phone: string;
        industry: string;
        website: string;
        billing_city: string;
        billing_country: string;
    }>({
        name: '',
        customer_type: 'Company',
        primary_email: '',
        primary_phone: '',
        industry: '',
        website: '',
        billing_city: '',
        billing_country: ''
    });

    useEffect(() => {
        if (isAdmin && companyId) {
            getSalesReps(companyId).then(setSalesReps);
        }
    }, [isAdmin, companyId]);

    useEffect(() => {
        loadData();
    }, [user?.id, userRole, selectedOwnerFilter, companyId]);

    const loadData = async (silent = false) => {
        if (!silent && opportunities.length === 0) setLoading(true);
        const [oppsData, stagesData, custData] = await Promise.all([
            getOpportunities(user?.id, userRole, selectedOwnerFilter),
            getStages(),
            getCustomers(user?.id, userRole, selectedOwnerFilter, companyId)
        ]);
        setOpportunities(oppsData);
        setStages(stagesData);
        setCustomers(custData);
        setLoading(false);
    };

    const handleSaveQuickCustomer = async () => {
        if (!quickCustomer.name?.trim()) {
            alert("Customer Name is required.");
            return;
        }

        setSavingQuickCustomer(true);
        try {
            const newCust = await createCustomer({
                name: quickCustomer.name.trim(),
                customer_type: quickCustomer.customer_type,
                primary_email: quickCustomer.primary_email?.trim() || undefined,
                primary_phone: quickCustomer.primary_phone?.trim() || undefined,
                industry: quickCustomer.industry?.trim() || undefined,
                website: quickCustomer.website?.trim() || undefined,
                billing_city: quickCustomer.billing_city?.trim() || undefined,
                billing_country: quickCustomer.billing_country?.trim() || undefined,
                company_id: companyId,
                owner_id: user?.id,
                created_by: user?.id,
                status: 'Active'
            });

            if (newCust) {
                setCustomers(prev => [newCust, ...prev]);
                setActiveOpp(prev => ({ ...prev, customer_id: newCust.id }));
                setQuickCustomer({
                    name: '',
                    customer_type: 'Company',
                    primary_email: '',
                    primary_phone: '',
                    industry: '',
                    website: '',
                    billing_city: '',
                    billing_country: ''
                });
                setShowQuickCustomerModal(false);
            }
        } catch (err: any) {
            console.error("Error creating quick customer:", err);
            alert("Failed to create customer: " + (err.message || 'Unknown error'));
        } finally {
            setSavingQuickCustomer(false);
        }
    };

    const handleSave = async () => {
        if (!activeOpp.title?.trim()) {
            alert("Opportunity Title is required.");
            return;
        }
        if (!activeOpp.customer_id) {
            alert("Please select a customer or click '+ New Customer' to add one.");
            return;
        }

        const payload = {
            ...activeOpp,
            currency: activeOpp.currency || 'QAR',
            title: activeOpp.title.trim(),
            stage_id: activeOpp.stage_id || stages[0]?.id,
            owner_id: activeOpp.owner_id || null
        };

        if (activeOpp.id) {
            await updateOpportunity(activeOpp.id, payload);
        } else {
            await createOpportunity({
                ...payload,
                status: 'Open',
                owner_id: activeOpp.owner_id || user?.id,
                created_by: user?.id,
                company_id: companyId
            });
        }
        setShowModal(false);
        await loadData(true);
    };

    const handleMarkAsWon = async () => {
        if (!activeOpp.id) return;
        setConverting(true);
        try {
            const result = await convertOpportunityToCustomer(
                activeOpp as Opportunity,
                companyId,
                user?.id
            );
            if (result) {
                setShowModal(false);
                await loadData(true);
                onConvert?.('CUSTOMERS');
            } else {
                alert("Conversion failed. Please try again.");
            }
        } catch (err) {
            console.error('Won conversion error:', err);
            alert("An error occurred.");
        }
        setConverting(false);
    };

    const handleMarkAsLost = async () => {
        if (!activeOpp.id) return;
        await updateOpportunity(activeOpp.id, {
            status: 'Lost',
            loss_reason: lossReason,
        } as any);
        setShowLossModal(false);
        setShowModal(false);
        setLossReason('');
        await loadData(true);
    };

    const onDragStart = (e: React.DragEvent, oppId: string) => {
        setDraggedOppId(oppId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const onDrop = async (e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        if (!draggedOppId) return;

        const updatedOpps = opportunities.map(o =>
            o.id === draggedOppId ? { ...o, stage_id: stageId } : o
        );
        setOpportunities(updatedOpps);
        setDraggedOppId(null);

        await updateOpportunity(draggedOppId, { stage_id: stageId });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Won': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800';
            case 'Lost': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800';
            default: return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Opportunities</h2>
                        {!isAdmin && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full">
                                <Lock size={11} /> Private View
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {isAdmin ? 'Track enterprise sales pipelines across all representatives' : 'Track your deals and pipeline progression'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
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
                                <option value={user?.id}>My Deals Only</option>
                                {salesReps.map(rep => (
                                    <option key={rep.id} value={rep.profileId || rep.id}>{rep.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
                        <button onClick={() => setViewMode('KANBAN')} className={`p-2 rounded-md transition-all ${viewMode === 'KANBAN' ? 'bg-white dark:bg-zinc-700 shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={18} /></button>
                        <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-zinc-700 shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><ListIcon size={18} /></button>
                    </div>

                    <button
                        onClick={() => { setActiveOpp({ currency: 'QAR' }); setShowModal(true); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 text-sm font-medium"
                    >
                        <Plus size={18} />
                        <span>New Opportunity</span>
                    </button>
                </div>
            </div>

            {/* Pipeline Flow Indicator */}
            <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-900/10 dark:to-emerald-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
                <span className="text-xs font-medium text-slate-400">Lead</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2.5 py-1 rounded-lg">Opportunity</span>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-400">Customer</span>
            </div>

            {/* Kanban View */}
            {viewMode === 'KANBAN' && (
                <div className="flex-1 overflow-x-auto pb-4">
                    {stages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                            <KanbanSquare className="w-12 h-12 mb-3 opacity-30" />
                            <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300">No pipeline stages</h3>
                            <p className="text-sm mt-1">Configure stages in Organisation settings</p>
                        </div>
                    ) : (
                        <div className="flex gap-4 h-full min-w-full pr-4">
                            {stages.map(stage => (
                                <div
                                    key={stage.id}
                                    className="w-72 flex flex-col"
                                    onDragOver={onDragOver}
                                    onDrop={(e) => onDrop(e, stage.id)}
                                >
                                    <div className="mb-3 flex justify-between items-center px-1">
                                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{stage.name}</span>
                                        <span className="bg-slate-100 dark:bg-zinc-800 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium">
                                            {opportunities.filter(o => o.stage_id === stage.id).length}
                                        </span>
                                    </div>

                                    <div className="flex-1 bg-slate-50/80 dark:bg-zinc-800/30 rounded-xl p-2.5 space-y-2.5 border border-slate-100/50 dark:border-zinc-800">
                                        {opportunities
                                            .filter(o => o.stage_id === stage.id)
                                            .map((opp) => (
                                                <div
                                                    key={opp.id}
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, opp.id)}
                                                    onClick={() => { setActiveOpp(opp); setShowModal(true); }}
                                                    className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow group cursor-pointer active:cursor-grabbing"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">{opp.series || 'OPP'}</span>
                                                            {opp.status !== 'Open' && (
                                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${getStatusBadge(opp.status)}`}>{opp.status}</span>
                                                            )}
                                                        </div>
                                                        <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600"><MoreHorizontal size={14} /></button>
                                                    </div>
                                                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">{opp.title}</h4>
                                                    <p className="text-xs text-slate-500 mb-2">{opp.customer?.name || 'No client'}</p>

                                                    {/* Source Lead Link */}
                                                    {opp.lead_id && (
                                                        <div className="flex items-center gap-1 text-[10px] text-purple-500 mb-2">
                                                            <Link2 size={10} />
                                                            <span>From Lead</span>
                                                        </div>
                                                    )}

                                                    <div className="flex justify-between items-center text-xs text-slate-500 pt-2.5 border-t border-slate-50 dark:border-zinc-800">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-semibold text-slate-900 dark:text-white">{opp.currency || 'QAR'} {Number(opp.amount || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Calendar size={12} />
                                                            <span>{opp.expected_closing_date ? new Date(opp.expected_closing_date).toLocaleDateString() : '-'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Owner & Creator Details */}
                                                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-50 dark:border-zinc-800/60 mt-1.5">
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <div className="w-3.5 h-3.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[8px] font-bold">
                                                                {(opp.owner?.name || opp.creator?.name || 'U')[0].toUpperCase()}
                                                            </div>
                                                            <span className="truncate">
                                                                {opp.owner?.name || opp.creator?.name || 'Unassigned'}
                                                            </span>
                                                        </div>
                                                        {opp.creator?.name && opp.creator?.name !== opp.owner?.name && (
                                                            <span className="text-[9px] text-slate-400 truncate max-w-[80px]" title={`Created by ${opp.creator.name}`}>
                                                                By: {opp.creator.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        {opportunities.filter(o => o.stage_id === stage.id).length === 0 && (
                                            <div className="py-8 text-center text-xs text-slate-400">Drop here</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* List View */}
            {viewMode === 'LIST' && (
                <div className="flex-1 bg-white dark:bg-zinc-900 ring-1 ring-slate-100 dark:ring-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    {opportunities.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                            <KanbanSquare className="w-12 h-12 mb-3 opacity-30" />
                            <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300">No opportunities yet</h3>
                            <p className="text-sm mt-1">Create your first opportunity to get started</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800">
                                <tr>
                                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase">Series</th>
                                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase">Title</th>
                                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase">Customer</th>
                                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase">Stage</th>
                                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase">Status</th>
                                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase">Owner / Rep</th>
                                    <th className="text-right py-3 px-5 text-xs font-semibold text-slate-400 uppercase">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {opportunities.map(opp => (
                                    <tr key={opp.id} onClick={() => { setActiveOpp(opp); setShowModal(true); }} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                                        <td className="py-3 px-5 text-sm text-slate-500">{opp.series}</td>
                                        <td className="py-3 px-5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-slate-900 dark:text-white">{opp.title}</span>
                                                {opp.lead_id && <Link2 size={12} className="text-purple-500" />}
                                            </div>
                                        </td>
                                        <td className="py-3 px-5 text-sm text-slate-500">{opp.customer?.name}</td>
                                        <td className="py-3 px-5 text-sm"><span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-medium">{opp.stage?.name}</span></td>
                                        <td className="py-3 px-5"><span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusBadge(opp.status)}`}>{opp.status}</span></td>
                                        <td className="py-3 px-5 text-sm text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-semibold text-xs">
                                                    {(opp.owner?.name || opp.creator?.name || 'U')[0].toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-slate-900 dark:text-white leading-tight">
                                                        {opp.owner?.name || opp.creator?.name || 'Unassigned'}
                                                    </span>
                                                    {opp.creator?.name && opp.creator?.name !== opp.owner?.name && (
                                                        <span className="text-[10px] text-slate-400">By: {opp.creator.name}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-5 text-sm text-slate-900 dark:text-white text-right font-medium">{opp.currency || 'QAR'} {Number(opp.amount || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Edit/Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {activeOpp.id ? 'Edit Opportunity' : 'New Opportunity'}
                            </h3>
                            <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
                        </div>

                        {/* Status Banners */}
                        {activeOpp.status === 'Won' && (
                            <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/30 flex items-center gap-2">
                                <Trophy size={16} className="text-emerald-600" />
                                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">This opportunity was won and converted to a Customer</span>
                            </div>
                        )}
                        {activeOpp.status === 'Lost' && (
                            <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800/30 flex items-center gap-2">
                                <XCircle size={16} className="text-red-600" />
                                <span className="text-sm font-medium text-red-700 dark:text-red-400">This opportunity was marked as Lost</span>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <Section title="Details">
                                <div className="grid grid-cols-3 gap-5">
                                    <Input label="Series" disabled value={activeOpp.series || "Generated on Save"} />
                                    <Input label="Opportunity Type" value={activeOpp.type || 'Sales'} onChange={(v: string) => setActiveOpp({ ...activeOpp, type: v })} />

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500">Sales Stage</label>
                                        <div className="relative">
                                            <select
                                                value={activeOpp.stage_id || ''}
                                                onChange={e => setActiveOpp({ ...activeOpp, stage_id: e.target.value })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"
                                            >
                                                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                        </div>
                                    </div>

                                    <Input label="Title" required value={activeOpp.title} onChange={(v: string) => setActiveOpp({ ...activeOpp, title: v })} />

                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                                Customer <span className="text-red-500">*</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setShowQuickCustomerModal(true)}
                                                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                                            >
                                                <Plus size={13} />
                                                <span>New Customer</span>
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <select
                                                value={activeOpp.customer_id || ''}
                                                onChange={e => {
                                                    if (e.target.value === '__NEW__') {
                                                        setShowQuickCustomerModal(true);
                                                    } else {
                                                        setActiveOpp({ ...activeOpp, customer_id: e.target.value });
                                                    }
                                                }}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"
                                            >
                                                <option value="">Select Customer...</option>
                                                <option value="__NEW__" className="text-indigo-600 dark:text-indigo-400 font-semibold">+ Add New Customer...</option>
                                                {customers.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name} {c.customer_type ? `(${c.customer_type})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                        </div>
                                        {customers.length === 0 && (
                                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                                                No customers listed yet. Click{' '}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowQuickCustomerModal(true)}
                                                    className="underline font-semibold hover:text-amber-700 dark:hover:text-amber-300"
                                                >
                                                    + New Customer
                                                </button>{' '}
                                                to add one.
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500">Opportunity Owner / Sales Rep</label>
                                        <div className="relative">
                                            <select
                                                value={activeOpp.owner_id || ''}
                                                onChange={e => setActiveOpp({ ...activeOpp, owner_id: e.target.value || null as any })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
                                            >
                                                <option value="">Unassigned</option>
                                                {salesReps.map(rep => (
                                                    <option key={rep.id} value={rep.profileId || rep.id}>{rep.name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                        </div>
                                    </div>

                                    <Input label="Expected Closing Date" type="date" value={activeOpp.expected_closing_date} onChange={(v: string) => setActiveOpp({ ...activeOpp, expected_closing_date: v })} />
                                    <Input label="Probability (%)" type="number" value={activeOpp.probability} onChange={(v: string) => setActiveOpp({ ...activeOpp, probability: parseFloat(v) })} />
                                    <Input label="Status" value={activeOpp.status} disabled />

                                    {activeOpp.creator?.name && (
                                        <div className="col-span-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500">
                                            <span>Created by: <strong className="font-semibold text-slate-700 dark:text-slate-300">{activeOpp.creator.name}</strong></span>
                                            {activeOpp.created_at && (
                                                <span>{new Date(activeOpp.created_at).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Section>

                            {/* Source Lead Info */}
                            {activeOpp.lead_id && (
                                <Section title="Source">
                                    <div className="p-3.5 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800/30 text-sm flex items-center gap-2">
                                        <Link2 size={14} className="text-purple-600" />
                                        <span className="font-medium text-purple-700 dark:text-purple-400">Converted from Lead</span>
                                    </div>
                                </Section>
                            )}

                            <Section title="Organization Details">
                                <div className="p-3.5 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700 text-sm text-slate-500 flex items-center gap-2">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Linked Customer:</span>
                                    {customers.find(c => c.id === activeOpp.customer_id)?.name || 'None Selected'}
                                </div>
                            </Section>

                            <Section title="Opportunity Value">
                                <div className="grid grid-cols-2 gap-5">
                                    <Input label="Currency" value={activeOpp.currency || 'QAR'} onChange={(v: string) => setActiveOpp({ ...activeOpp, currency: v })} />
                                    <Input label="Opportunity Amount" type="number" value={activeOpp.amount} onChange={(v: string) => setActiveOpp({ ...activeOpp, amount: parseFloat(v) })} />
                                </div>
                            </Section>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            {/* Left: Conversion Buttons */}
                            <div className="flex gap-2">
                                {activeOpp.id && activeOpp.status === 'Open' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleMarkAsWon}
                                            disabled={converting}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20 text-sm font-medium disabled:opacity-50"
                                        >
                                            {converting ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                                            Won {'\u2192'} Customer
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowLossModal(true)}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-md shadow-red-600/20 text-sm font-medium"
                                        >
                                            <XCircle size={16} />
                                            Lost
                                        </button>
                                    </>
                                )}
                            </div>
                            {/* Right: Save/Cancel */}
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors font-medium text-sm">Cancel</button>
                                <button type="button" onClick={handleSave} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 font-medium text-sm">Save Opportunity</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Loss Reason Modal */}
            {showLossModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-red-50 dark:bg-red-900/20">
                            <h3 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                                <XCircle size={20} />
                                Mark as Lost
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Loss Reason</label>
                                <textarea
                                    value={lossReason}
                                    onChange={e => setLossReason(e.target.value)}
                                    placeholder="Why was this opportunity lost?"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm h-24 resize-none"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                            <button type="button" onClick={() => { setShowLossModal(false); setLossReason(''); }} className="px-5 py-2.5 text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors font-medium text-sm">Cancel</button>
                            <button type="button" onClick={handleMarkAsLost} className="px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-md shadow-red-600/20 font-medium text-sm">Confirm Lost</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Add CRM Customer Modal */}
            {showQuickCustomerModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Building size={18} className="text-indigo-600 dark:text-indigo-400" />
                                    Add New CRM Customer
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Creates an independent CRM Customer record (not linked to accounting accounts).
                                </p>
                            </div>
                            <button
                                onClick={() => setShowQuickCustomerModal(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    Customer Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Acme Corporation or John Smith"
                                    value={quickCustomer.name}
                                    onChange={e => setQuickCustomer({ ...quickCustomer, name: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Customer Type</label>
                                    <select
                                        value={quickCustomer.customer_type}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, customer_type: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    >
                                        <option value="Company">Company</option>
                                        <option value="Individual">Individual</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Industry / Sector</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Oil & Gas, IT, Retail"
                                        value={quickCustomer.industry}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, industry: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                        <Mail size={12} className="text-slate-400" />
                                        Primary Email
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="contact@company.qa"
                                        value={quickCustomer.primary_email}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, primary_email: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                        <Phone size={12} className="text-slate-400" />
                                        Primary Phone
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="+974 ..."
                                        value={quickCustomer.primary_phone}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, primary_phone: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Globe size={12} className="text-slate-400" />
                                    Website
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://..."
                                    value={quickCustomer.website}
                                    onChange={e => setQuickCustomer({ ...quickCustomer, website: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                        <MapPin size={12} className="text-slate-400" />
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Doha"
                                        value={quickCustomer.billing_city}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, billing_city: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Country</label>
                                    <input
                                        type="text"
                                        placeholder="Qatar"
                                        value={quickCustomer.billing_country}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, billing_country: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-zinc-800/50">
                            <button
                                type="button"
                                onClick={() => setShowQuickCustomerModal(false)}
                                disabled={savingQuickCustomer}
                                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveQuickCustomer}
                                disabled={savingQuickCustomer}
                                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 font-medium text-sm disabled:opacity-50"
                            >
                                {savingQuickCustomer ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                <span>Save & Select Customer</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Reusable Components
const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800 pb-2">{title}</h4>
        {children}
    </div>
);

const Input = ({ label, value, onChange, type = "text", required, disabled }: any) => (
    <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500 flex gap-1">
            {label}
            {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type}
            value={value || ''}
            onChange={e => onChange?.(e.target.value)}
            disabled={disabled}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:opacity-50"
        />
    </div>
);
