import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    LayoutDashboard, Users, FileText, CheckSquare, Calendar, Folder, Briefcase, Plus, Search,
    X, ChevronRight, ChevronDown, Sparkles, Workflow, Mic, Play, KanbanSquare, Bell, Loader2, BarChart3,
    Package, Receipt, Truck
} from 'lucide-react';
import { ReportsListView } from './reports/ReportsListView';
import { LiveView } from '../crm/LiveView';
import { WebsiteFinderView } from '../crm/WebsiteFinder';
import LeadsView from '../crm/LeadsView';
import OpportunitiesView from '../crm/OpportunitiesView';
import CustomersView from '../crm/CustomersView';
import SummaryView from '../crm/SummaryView';
import ItemsView from '../crm/ItemsView';
import QuotationsView from '../crm/QuotationsView';
import SalesInvoiceView from '../crm/SalesInvoiceView';
import DeliveryNoteView from '../crm/DeliveryNoteView';
import {
    Deal, Contact, Task, CRMActivity, CRMViewMode, CRMStats,
    CRMDeal, CRMContact, CRMTask, CRMDocument
} from '../crm/types';
import { MASTER_CONFIG } from './Organisation';

// --- Placeholder Components for Missing Views ---
// These will be replaced by full implementations later.

const TasksView = () => (
    <div className="flex h-full items-center justify-center text-slate-400">
        <div className="text-center">
            <CheckSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-bold">Tasks</h2>
            <p>Task management coming soon.</p>
        </div>
    </div>
);

const ScheduleView = () => (
    <div className="flex h-full items-center justify-center text-slate-400">
        <div className="text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-bold">Schedule</h2>
            <p>Calendar integration coming soon.</p>
        </div>
    </div>
);

export const CRM: React.FC = () => {
    const { user, signOut, hasPermission, currentCompanyId } = useAuth();
    const [activeTab, setActiveTab] = useState<CRMViewMode>('DASHBOARD');
    const [stats, setStats] = useState<CRMStats | null>(null);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [activities, setActivities] = useState<CRMActivity[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showDealModal, setShowDealModal] = useState(false);
    const [showDocModal, setShowDocModal] = useState(false);

    // New Creation States
    const [newContact, setNewContact] = useState<Partial<Contact>>({});
    const [newDeal, setNewDeal] = useState<Partial<Deal>>({});
    const [newDoc, setNewDoc] = useState<Partial<any>>({});

    const [currentEmployee, setCurrentEmployee] = useState<any>(null);

    // Initial Load — use currentCompanyId from AuthContext (consistent with all other modules)
    useEffect(() => {
        const init = async () => {
            if (!user || !currentCompanyId) {
                setLoading(false);
                return;
            }
            setCompanyId(currentCompanyId);

            // Optionally try to get employee record for owner assignment
            const { data: emp } = await supabase
                .from('employees')
                .select('*')
                .eq('profile_id', user.id)
                .eq('company_id', currentCompanyId)
                .maybeSingle();

            if (emp) {
                setCurrentEmployee(emp);
            }

            fetchCRMData(currentCompanyId);
        };
        init();
    }, [user, currentCompanyId]);

    const fetchCRMData = async (companyId: string) => {
        setLoading(true);
        try {
            // Parallel Fetch
            const [
                { data: dealsData },
                { data: contactsData },
                { data: tasksData },
                { data: documentsData }
            ] = await Promise.all([
                supabase.from('crm_deals').select('*').eq('company_id', companyId),
                supabase.from('crm_contacts').select('*').eq('company_id', companyId),
                supabase.from('crm_tasks').select('*').eq('company_id', companyId),
                supabase.from('crm_documents').select('*').eq('company_id', companyId)
            ]);

            setDeals((dealsData as any) || []);
            setContacts((contactsData as any) || []);
            setTasks((tasksData as any) || []);
            setDocuments(documentsData || []);

            // Calculate Stats
            const totalPipeline = (dealsData || []).reduce((acc, d) => acc + (d.amount || 0), 0);
            const wonDeals = (dealsData || []).filter(d => d.stage_id === 4); // Assuming 4 is won
            const conversionRate = dealsData?.length ? (wonDeals.length / dealsData.length) * 100 : 0;

            setStats({
                totalRevenue: totalPipeline,
                activeDeals: (dealsData || []).filter(d => d.status === 'Open').length,
                totalContacts: (contactsData || []).length,
                conversionRate: conversionRate
            });

        } catch (error) {
            console.error('Error fetching CRM data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateContact = async () => {
        if (!companyId || !newContact.name) return;
        const { error } = await supabase.from('crm_contacts').insert([{
            ...newContact,
            company_id: companyId,
            status: 'Active',
            owner_id: currentEmployee?.id // Correct owner assignment?
        }]);
        if (!error) {
            setShowContactModal(false);
            setNewContact({});
            fetchCRMData(companyId);
        }
    };

    const handleUploadDocument = async () => {
        if (!companyId || !newDoc.name) return;
        const { error } = await supabase.from('crm_documents').insert([{
            ...newDoc,
            company_id: companyId,
            uploaded_by: currentEmployee?.id
        }]);
        if (!error) {
            setShowDocModal(false);
            setNewDoc({});
            fetchCRMData(companyId);
        }
    };

    // --- Sub-Components (Internal for now, to move to separate files later) ---

    // Navigation Sidebar
    const SidebarNav = () => {
        const navItems = useMemo(() => [
            { id: 'DASHBOARD', icon: LayoutDashboard, label: 'Summary', permission: 'crm.dashboard.view' },
            { id: 'LEADS', icon: Users, label: 'Leads', permission: 'crm.leads.view' },
            { id: 'OPPORTUNITIES', icon: KanbanSquare, label: 'Opportunities', permission: 'crm.deals.view' },
            { id: 'CUSTOMERS', icon: Briefcase, label: 'Customers', permission: 'crm.contacts.view' },
            { id: 'ITEMS', icon: Package, label: 'Items', permission: 'crm.deals.view' },
            { id: 'QUOTATIONS', icon: FileText, label: 'Quotations', permission: 'crm.deals.view' },
            { id: 'SALES_INVOICES', icon: Receipt, label: 'Sales Invoices', permission: 'crm.deals.view' },
            { id: 'DELIVERY_NOTES', icon: Truck, label: 'Delivery Notes', permission: 'crm.deals.view' },
            { id: 'TASKS', icon: CheckSquare, label: 'Tasks', permission: 'crm.tasks.view' },
            { id: 'DOCUMENTS', icon: Folder, label: 'Documents', permission: 'crm.deals.view' },
            { id: 'WORKFLOWS', icon: Workflow, label: 'Workflows', permission: 'crm.settings.manage' },
            { id: 'ASSISTANT', icon: Sparkles, label: 'Assistant', permission: 'crm.ai.view' },
            { id: 'UPDATES', icon: Bell, label: 'Updates', permission: 'crm.dashboard.view' },
            { id: 'REPORTS', icon: BarChart3, label: 'Reports', permission: 'crm.dashboard.view' },
            { id: 'LIVE', icon: Mic, label: 'Live Mode', permission: 'crm.deals.view' },
            { id: 'WEBSITE_FINDER', icon: Search, label: 'Site Finder', permission: 'crm.leads.manage' }
        ].filter(item => hasPermission(item.permission) || hasPermission('*')), [hasPermission]);

        return (
            <div className="w-[220px] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-r border-slate-100 dark:border-zinc-800 flex flex-col py-6 z-20 shadow-sm">
                <div className="px-5 mb-8 flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Briefcase className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-sm text-slate-800 dark:text-white tracking-wide">CRM</span>
                </div>

                <div className="flex-1 w-full px-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as CRMViewMode)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${isActive
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:text-slate-400'
                                    }`}
                            >
                                <Icon className="w-[18px] h-[18px] min-w-[18px]" />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };



    const DocumentsView = () => (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Documents</h1>
                {hasPermission('crm.deals.manage') && (
                    <button onClick={() => setShowDocModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg hover:shadow-indigo-500/20 transition-all">
                        <Plus className="w-4 h-4" /> Upload Document
                    </button>
                )}
            </div>

            <div className="flex-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl p-8 overflow-y-auto">
                {documents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <FileText className="w-16 h-16 mb-4 opacity-30" />
                        <h3 className="text-lg font-bold">No documents yet</h3>
                        <p className="text-sm">Upload contracts, proposals, or invoices.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {documents.map(doc => (
                            <div key={doc.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[1.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600"><FileText className="w-5 h-5" /></div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-500 px-2 py-1 rounded-lg">{doc.related_type} #{doc.related_id}</span>
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1 truncate" title={doc.name}>{doc.name}</h4>
                                <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-auto pt-4 flex items-center gap-1">
                                    View File <Play className="w-3 h-3 rotate-90" />
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Document Modal */}
            {showDocModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md animate-fade-in" onClick={() => setShowDocModal(false)}>
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up border border-white/60 dark:border-zinc-800 p-8" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Upload Document</h2>
                        <div className="space-y-4">
                            <input type="text" placeholder="Document Name" className="w-full p-3 rounded-xl border bg-slate-50" value={newDoc.name || ''} onChange={e => setNewDoc({ ...newDoc, name: e.target.value })} />
                            <input type="text" placeholder="File URL (e.g. https://...)" className="w-full p-3 rounded-xl border bg-slate-50" value={newDoc.file_url || ''} onChange={e => setNewDoc({ ...newDoc, file_url: e.target.value })} />
                            <div className="flex gap-4">
                                <select className="flex-1 p-3 rounded-xl border bg-slate-50" value={newDoc.related_type || 'DEAL'} onChange={e => setNewDoc({ ...newDoc, related_type: e.target.value as any })}>
                                    <option value="DEAL">Deal</option>
                                    <option value="CONTACT">Contact</option>
                                </select>
                                <input type="number" placeholder="Related ID" className="flex-1 p-3 rounded-xl border bg-slate-50" value={newDoc.related_id || ''} onChange={e => setNewDoc({ ...newDoc, related_id: Number(e.target.value) })} />
                            </div>
                            <button onClick={handleUploadDocument} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors">Upload</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const ContactsView = () => (
        <div className="h-full flex flex-col p-8 animate-page-enter">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Contacts</h1>
                {hasPermission('crm.contacts.manage') && (
                    <button
                        onClick={() => setShowContactModal(true)}
                        className="bg-slate-900 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add New
                    </button>
                )}
            </div>
            <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] flex-1 overflow-hidden shadow-xl border border-white/60">
                <div className="overflow-y-auto h-full">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/60">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Deals</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                            {contacts.map((contact) => {
                                // Link Deals to Contacts (assuming simple name match or id match if exists)
                                // Standard CRM logic usually links via ID. Assuming 'contact_id' on deal, or we filter loosely for now.
                                // For V1.2 demo, we'll try to find deals where company name matches or owner.
                                // Let's assume contacts have IDs and deals might have a 'contact_id' property we added in types, 
                                // OR we just list deals that look relevant. 
                                // Actually, `deals` array has `contact_id`? Let's check type. 
                                // The Service `getDeals` returns generic `Deal`.
                                // Let's filter by ID if possible, else mock it visually if schema isn't ready.
                                // Schema alignment (Phase 2): We should rely on foreign keys.
                                // Ideally `deals` has `contact_id`.

                                const activeDeals = deals.filter(d => Boolean(d.id)); // Placeholder filter
                                // Real filter: const activeDeals = deals.filter(d => d.contact_id === contact.id); 

                                return (
                                    <tr key={contact.id} className="hover:bg-indigo-50/30 transition-colors">
                                        <td className="px-8 py-4">
                                            <p className="font-bold text-slate-800 dark:text-white">{contact.name}</p>
                                            <p className="text-xs text-slate-500">{contact.email}</p>
                                        </td>
                                        <td className="px-8 py-4">
                                            <p className="font-medium text-slate-700 dark:text-slate-300">{contact.role}</p>
                                        </td>
                                        <td className="px-8 py-4">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                                                <Briefcase className="w-3 h-3" /> {deals.filter(d => (d as any).contact_id === contact.id).length} Deals
                                            </span>
                                        </td>
                                        <td className="px-8 py-4">
                                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400">{contact.status}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Contact Modal */}
            {showContactModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md animate-fade-in" onClick={() => setShowContactModal(false)}>
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up border border-white/60 dark:border-zinc-800 p-8" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add Contact</h2>
                            <button onClick={() => setShowContactModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <input type="text" placeholder="Name" className="w-full p-3 rounded-xl border bg-slate-50" value={newContact.name || ''} onChange={e => setNewContact({ ...newContact, name: e.target.value })} />
                            <input type="email" placeholder="Email" className="w-full p-3 rounded-xl border bg-slate-50" value={newContact.email || ''} onChange={e => setNewContact({ ...newContact, email: e.target.value })} />
                            <input type="text" placeholder="Role/Job Title" className="w-full p-3 rounded-xl border bg-slate-50" value={newContact.role || ''} onChange={e => setNewContact({ ...newContact, role: e.target.value })} />
                            <input type="text" placeholder="Company" className="w-full p-3 rounded-xl border bg-slate-50" value={newContact.company || ''} onChange={e => setNewContact({ ...newContact, company: e.target.value })} />
                            <input type="text" placeholder="Phone" className="w-full p-3 rounded-xl border bg-slate-50" value={newContact.phone || ''} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} />
                            <button onClick={handleCreateContact} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 shadow-lg">Create Contact</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const WorkflowsView = () => {
        const [automations, setAutomations] = useState<any[]>([]);
        const [showAutoModal, setShowAutoModal] = useState(false);
        const [newAuto, setNewAuto] = useState({ name: '', trigger: 'DEAL_STAGE_CHANGED', action: 'CREATE_TASK' });

        useEffect(() => {
            fetchAutomations();
        }, []);

        const fetchAutomations = async () => {
            if (!companyId) return; // Use robust ID
            const { data } = await supabase.from('crm_automations').select('*').eq('company_id', companyId);
            if (data) setAutomations(data);
        };

        const handleSaveAutomation = async () => {
            if (!newAuto.name) return;
            if (!companyId) return; // Guard

            await supabase.from('crm_automations').insert([{
                ...newAuto,
                company_id: companyId,
                created_by: currentEmployee?.id // or null if fallback
            }]);
            setShowAutoModal(false);
            fetchAutomations();
        };

        return (
            <div className="p-8 h-full flex flex-col animate-page-enter">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Workflows & Automations</h1>
                    <button onClick={() => setShowAutoModal(true)} className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 shadow-lg">
                        <Plus className="w-4 h-4" /> Create Automation
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {automations.map(auto => (
                        <div key={auto.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-slate-200 dark:border-zinc-800 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Workflow className="w-24 h-24 rotate-12" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{auto.name}</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center"><Sparkles className="w-4 h-4" /></span>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trigger</span>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{auto.trigger_event.replace(/_/g, ' ')}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-center"><ChevronDown className="w-4 h-4 text-slate-300" /></div>
                                    <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckSquare className="w-4 h-4" /></span>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Action</span>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{auto.action_type.replace(/_/g, ' ')}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Active</span>
                                    <button className="text-slate-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {showAutoModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md" onClick={() => setShowAutoModal(false)}>
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
                            <h2 className="text-xl font-bold mb-6">New Automation</h2>
                            <div className="space-y-4">
                                <input className="w-full p-3 bg-slate-50 rounded-xl border" placeholder="Name (e.g. Auto-Task)" value={newAuto.name} onChange={e => setNewAuto({ ...newAuto, name: e.target.value })} />
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">When...</label>
                                    <select className="w-full p-3 bg-slate-50 rounded-xl border mt-1" value={newAuto.trigger} onChange={e => setNewAuto({ ...newAuto, trigger: e.target.value })}>
                                        <option value="DEAL_STAGE_CHANGED">Deal Stage Changes</option>
                                        <option value="TASK_COMPLETED">Task is Completed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Then...</label>
                                    <select className="w-full p-3 bg-slate-50 rounded-xl border mt-1" value={newAuto.action} onChange={e => setNewAuto({ ...newAuto, action: e.target.value })}>
                                        <option value="CREATE_TASK">Create a Task</option>
                                        <option value="SEND_EMAIL">Send Email</option>
                                    </select>
                                </div>
                                <button onClick={handleSaveAutomation} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold mt-4">Save Automation</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const AssistantView = () => (
        <div className="h-full flex flex-col max-w-4xl mx-auto p-8 animate-page-enter">
            <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-[3rem] shadow-xl border border-white/60 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-white/40 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white"><Sparkles className="w-5 h-5" /></div>
                        CRM Assistant
                    </h2>
                    <span className="text-xs font-bold text-slate-400">V1.3 Preview</span>
                </div>
                <div className="flex-1 p-8 flex items-center justify-center text-slate-400">
                    Assistant capabilities are currently disabled for stability.
                </div>
            </div>
        </div>
    );

    const UpdatesView = () => (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Recent Updates</h1>
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl flex flex-col gap-6">
                    {activities.map((act) => (
                        <div key={act.id} className="flex gap-4 group">
                            <div className="flex flex-col items-center">
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800 border-2 border-white dark:border-zinc-700 flex items-center justify-center font-bold text-slate-500 text-xs">
                                    {(act.performer?.name || 'Sys').substring(0, 2).toUpperCase()}
                                </div>
                                <div className="w-0.5 flex-1 bg-slate-100 dark:bg-zinc-800 my-2 group-last:hidden"></div>
                            </div>
                            <div className="flex-1 pb-8">
                                <div className="bg-white dark:bg-zinc-900 p-5 rounded-[1.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
                                    <p className="font-bold text-slate-800 dark:text-white text-sm mb-1">
                                        {act.description}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-slate-400 font-bold">
                                        <span className="uppercase tracking-wider">{act.action}</span>
                                        <span>•</span>
                                        <span>{new Date(act.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {activities.length === 0 && (
                        <div className="p-8 text-center text-slate-400">No recent activities found.</div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-full relative z-10 overflow-hidden">
            <SidebarNav />
            <div className="flex-1 overflow-hidden relative bg-slate-50/50 dark:bg-zinc-950">
                {loading && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                )}
                {!companyId && !loading ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                            <Briefcase className="w-10 h-10 opacity-50" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">No Company Assigned</h2>
                        <p className="max-w-md text-center mt-2">You are not currently linked to any company. Please contact your administrator to be assigned to an organization.</p>
                    </div>
                ) : companyId ? (
                    <>
                        {activeTab === 'DASHBOARD' && <SummaryView stats={stats} activities={activities} deals={deals} tasks={tasks} />}
                        {activeTab === 'LEADS' && <LeadsView companyId={companyId} onConvert={(tab) => setActiveTab(tab)} />}
                        {activeTab === 'OPPORTUNITIES' && <OpportunitiesView companyId={companyId} onConvert={(tab) => setActiveTab(tab)} />}
                        {activeTab === 'CUSTOMERS' && <CustomersView companyId={companyId} />}

                        {activeTab === 'ITEMS' && <ItemsView companyId={companyId} />}
                        {activeTab === 'QUOTATIONS' && <QuotationsView companyId={companyId} onConvert={(tab) => setActiveTab(tab as any)} />}
                        {activeTab === 'SALES_INVOICES' && <SalesInvoiceView companyId={companyId} onConvert={(tab) => setActiveTab(tab as any)} />}
                        {activeTab === 'DELIVERY_NOTES' && <DeliveryNoteView companyId={companyId} />}

                        {activeTab === 'WEBSITE_FINDER' && <WebsiteFinderView companyId={companyId} />}
                        {activeTab === 'TASKS' && <TasksView />}
                        {activeTab === 'SCHEDULE' && <ScheduleView />}
                        {activeTab === 'DOCUMENTS' && <DocumentsView />}
                        {activeTab === 'WORKFLOWS' && <WorkflowsView />}
                        {activeTab === 'ASSISTANT' && <AssistantView />}
                        {activeTab === 'UPDATES' && <UpdatesView />}
                        {activeTab === 'REPORTS' && <ReportsListView moduleFilter="CRM" companyId={companyId} />}
                        {activeTab === 'LIVE' && <LiveView />}
                    </>
                ) : null}
            </div>
        </div>
    );
};