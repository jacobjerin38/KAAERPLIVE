import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useDelayLoading } from '../../contexts/GlobalLoadingContext';
import { TableSkeleton, DashboardSkeleton } from '../ui/LoadingSkeletons';
import {
    LayoutDashboard, Users, FileText, CheckSquare, Calendar, Folder, Briefcase, Plus, Search,
    X, ChevronRight, ChevronDown, Sparkles, Workflow, Mic, Play, KanbanSquare, Bell, Loader2, BarChart3,
    Package, Menu, UploadCloud, Trash2, ExternalLink, Paperclip, CheckCircle2, Download, Copy, Eye, Lock
} from 'lucide-react';
import { ReportsListView } from './reports/ReportsListView';
import { LiveView } from '../crm/LiveView';
import { WebsiteFinderView } from '../crm/WebsiteFinder';
import LeadsView from '../crm/LeadsView';
import OpportunitiesView from '../crm/OpportunitiesView';
import CustomersView from '../crm/CustomersView';
import SummaryView from '../crm/SummaryView';
import ItemsView from '../crm/ItemsView';
import { ProposalWorkflow } from '../crm/ProposalWorkflow';
import {
    Deal, Contact, Task, CRMActivity, CRMViewMode, CRMStats,
    CRMDeal, CRMContact, CRMTask, CRMDocument
} from '../crm/types';
import { checkIsAdmin, getLeads, getPersonResolver, getLinkedEmployeeId } from '../crm/services';
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
    const { user, userRole, signOut, hasPermission, currentCompanyId } = useAuth();
    const [activeTab, setActiveTab] = useState<CRMViewMode>('DASHBOARD');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [stats, setStats] = useState<CRMStats | null>(null);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [activities, setActivities] = useState<CRMActivity[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const delayedLoading = useDelayLoading(loading, 300);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showDealModal, setShowDealModal] = useState(false);
    const [showDocModal, setShowDocModal] = useState(false);

    // New Creation States
    const [newContact, setNewContact] = useState<Partial<Contact>>({});
    const [newDeal, setNewDeal] = useState<Partial<Deal>>({});
    const [newDoc, setNewDoc] = useState<Partial<any>>({});

    // Document Specific States
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
    const [docUploadMode, setDocUploadMode] = useState<'file' | 'link'>('file');
    const [leadsList, setLeadsList] = useState<{ id: string; name: string; company?: string }[]>([]);
    const [docSearchQuery, setDocSearchQuery] = useState('');
    const [docCategoryFilter, setDocCategoryFilter] = useState<'ALL' | 'GENERAL' | 'LEAD' | 'DEAL' | 'CUSTOMER'>('ALL');
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
            let empRecord: any = null;
            const { data: emp } = await supabase
                .from('employees')
                .select('*')
                .eq('profile_id', user.id)
                .eq('company_id', currentCompanyId)
                .maybeSingle();

            if (emp) {
                setCurrentEmployee(emp);
                empRecord = emp;
            }

            fetchCRMData(currentCompanyId, empRecord?.id);
        };
        init();
    }, [user?.id, userRole, currentCompanyId]);

    // Refresh dashboard whenever switching to DASHBOARD tab
    useEffect(() => {
        if (activeTab === 'DASHBOARD' && companyId) {
            fetchCRMData(companyId, undefined, true);
        }
    }, [activeTab, companyId]);

    const fetchCRMData = async (companyId: string, employeeIdOverride?: string, silent = false) => {
        if (!silent && deals.length === 0) setLoading(true);
        try {
            const isAdmin = checkIsAdmin(userRole);
            const empId = employeeIdOverride || currentEmployee?.id;
            
            // 1. Opportunities Query (with customer and stage)
            let oppsQuery = (supabase as any)
                .from('crm_opportunities')
                .select(`
                    *,
                    customer:crm_customers(*),
                    stage:org_crm_stages(*)
                `)
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });

            // 2. Customers Query
            let customersQuery = (supabase as any)
                .from('crm_customers')
                .select('*')
                .eq('company_id', companyId)
                .order('name', { ascending: true });

            // 3. Leads Query
            let leadsQuery = (supabase as any)
                .from('crm_leads')
                .select('id, first_name, last_name, organization_name, status, created_at')
                .eq('company_id', companyId);

            // 4. Tasks Query
            let tasksQuery = (supabase as any)
                .from('crm_tasks')
                .select('*')
                .eq('company_id', companyId)
                .order('due_date', { ascending: true });

            // 5. Documents Query
            let docsQuery = (supabase as any)
                .from('crm_documents')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });

            // 6. Activity Log Query
            let activityQuery = (supabase as any)
                .from('crm_activity_log')
                .select('*, performer:employees(*)')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (!isAdmin && user?.id) {
                let effectiveEmpId = empId;
                if (!effectiveEmpId) {
                    effectiveEmpId = await getLinkedEmployeeId(user.id);
                }

                // 1. Opportunities / Deals
                const oppConditions = [
                    `created_by.eq.${user.id}`,
                    `owner_id.eq.${user.id}`
                ];
                if (effectiveEmpId) {
                    oppConditions.push(`owner_id.eq.${effectiveEmpId}`);
                    oppConditions.push(`created_by.eq.${effectiveEmpId}`);
                }
                oppsQuery = oppsQuery.or(oppConditions.join(','));

                // 2. Customers
                const custConditions = [
                    `created_by.eq.${user.id}`,
                    `owner_id.eq.${user.id}`
                ];
                if (effectiveEmpId) {
                    custConditions.push(`owner_id.eq.${effectiveEmpId}`);
                    custConditions.push(`created_by.eq.${effectiveEmpId}`);
                }
                customersQuery = customersQuery.or(custConditions.join(','));

                // 3. Leads
                const leadConditions = [
                    `created_by.eq.${user.id}`,
                    `lead_owner_id.eq.${user.id}`
                ];
                if (effectiveEmpId) {
                    leadConditions.push(`lead_owner_id.eq.${effectiveEmpId}`);
                    leadConditions.push(`created_by.eq.${effectiveEmpId}`);
                }
                leadsQuery = leadsQuery.or(leadConditions.join(','));

                // 4. Tasks
                const taskConditions = [
                    `created_by.eq.${user.id}`,
                    `owner_id.eq.${user.id}`
                ];
                if (effectiveEmpId) {
                    taskConditions.push(`owner_id.eq.${effectiveEmpId}`);
                    taskConditions.push(`created_by.eq.${effectiveEmpId}`);
                }
                tasksQuery = tasksQuery.or(taskConditions.join(','));

                // 5. Documents
                const docConditions = [
                    `created_by.eq.${user.id}`
                ];
                if (effectiveEmpId) {
                    docConditions.push(`created_by.eq.${effectiveEmpId}`);
                }
                docsQuery = docsQuery.or(docConditions.join(','));

                // 6. Recent Activity Log Updates
                const actConditions = [
                    `performed_by.eq.${user.id}`
                ];
                if (effectiveEmpId) {
                    actConditions.push(`performed_by.eq.${effectiveEmpId}`);
                }
                activityQuery = activityQuery.or(actConditions.join(','));
            }

            // Parallel Fetch
            const [
                { data: oppsData },
                { data: customersData },
                { data: leadsData },
                { data: tasksData },
                { data: documentsData },
                { data: activityData }
            ] = await Promise.all([
                oppsQuery,
                customersQuery,
                leadsQuery,
                tasksQuery,
                docsQuery,
                activityQuery
            ]);

            const resolver = await getPersonResolver(companyId);

            const mappedDeals: Deal[] = (oppsData || []).map((opp: any) => ({
                id: opp.id,
                company_id: opp.company_id,
                title: opp.title,
                company: opp.customer?.name || 'Unknown Client',
                value: Number(opp.amount || 0),
                currency: opp.currency || 'QAR',
                stage_id: opp.stage_id,
                stage: opp.stage,
                status: opp.status === 'Won' || opp.stage?.name === 'Won' ? 'WON' : opp.status === 'Lost' || opp.stage?.name === 'Lost' ? 'LOST' : 'OPEN',
                expected_close_date: opp.expected_closing_date,
                created_at: opp.created_at,
                created_by: opp.created_by,
                owner_id: opp.owner_id
            } as any));

            const mappedContacts: Contact[] = (customersData || []).map((c: any) => ({
                id: c.id,
                company_id: c.company_id,
                name: c.name,
                company: c.name,
                email: c.primary_email || '',
                phone: c.primary_phone || '',
                role: c.customer_type || 'Customer',
                status: c.status || 'Active',
                created_at: c.created_at
            } as any));

            const mappedTasks: Task[] = (tasksData || []).map((t: any) => ({
                id: t.id,
                company_id: t.company_id,
                title: t.title,
                description: t.description,
                due_date: t.due_date,
                status: t.status,
                priority_details: { name: t.priority || 'Medium' },
                created_at: t.created_at
            } as any));

            setDeals(mappedDeals);
            setContacts(mappedContacts);
            setTasks(mappedTasks);
            setDocuments(documentsData || []);

            // Calculate Stats accurately from real opportunities & customers
            const totalPipeline = mappedDeals.reduce((acc: number, d: any) => acc + (d.value || 0), 0);
            const wonDeals = mappedDeals.filter((d: any) => d.status === 'WON' || d.stage?.name === 'Won');
            const activeDeals = mappedDeals.filter((d: any) => d.status === 'OPEN');
            const totalContacts = (customersData || []).length + (leadsData || []).length;
            const conversionRate = mappedDeals.length ? (wonDeals.length / mappedDeals.length) * 100 : 0;

            setStats({
                totalRevenue: totalPipeline,
                activeDeals: activeDeals.length,
                totalContacts: totalContacts,
                conversionRate: conversionRate
            });

            // Process Activities
            if (activityData && activityData.length > 0) {
                setActivities(activityData.map((act: any) => {
                    let perfName = act.performer?.name;
                    if (!perfName) {
                        const resolved = resolver(act.performed_by);
                        perfName = resolved?.name || 'Team Member';
                    }
                    return {
                        id: act.id,
                        description: act.description,
                        created_at: act.created_at,
                        performer: { name: perfName }
                    } as any;
                }));
            } else {
                const syntheticActivities: CRMActivity[] = [];
                (oppsData || []).slice(0, 6).forEach((opp: any) => {
                    const resolvedPerson = resolver(opp.owner_id || opp.created_by);
                    syntheticActivities.push({
                        id: `act-opp-${opp.id}`,
                        description: `${opp.status === 'Won' || opp.stage?.name === 'Won' ? 'Closed won' : 'Created'} opportunity "${opp.title}" for ${opp.customer?.name || 'client'} (${opp.currency || 'QAR'} ${Number(opp.amount || 0).toLocaleString()})`,
                        created_at: opp.created_at,
                        performer: { name: resolvedPerson?.name || 'Sales Team' }
                    } as any);
                });
                (customersData || []).slice(0, 3).forEach((cust: any) => {
                    const resolvedPerson = resolver(cust.owner_id || cust.created_by);
                    syntheticActivities.push({
                        id: `act-cust-${cust.id}`,
                        description: `Registered client account "${cust.name}"`,
                        created_at: cust.created_at,
                        performer: { name: resolvedPerson?.name || 'Sales Team' }
                    } as any);
                });
                syntheticActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setActivities(syntheticActivities);
            }

        } catch (error) {
            console.error('Error fetching CRM data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateContact = async () => {
        if (!companyId) return alert('No company context available.');
        if (!newContact.name?.trim()) return alert('Contact name is required.');
        try {
            const { error } = await (supabase as any).from('crm_contacts').insert([{
                ...newContact,
                name: newContact.name.trim(),
                email: newContact.email?.trim() || null,
                phone: newContact.phone?.trim() || null,
                company_id: companyId,
                status: 'Active',
                owner_id: currentEmployee?.id || user?.id || null,
                created_by: user?.id || null
            }]);
            if (error) throw error;
            setShowContactModal(false);
            setNewContact({});
            fetchCRMData(companyId, currentEmployee?.id);
        } catch (err: any) {
            console.error('Error creating contact:', err);
            alert('Failed to save contact: ' + (err.message || 'Unknown error'));
        }
    };

    const openUploadModal = async () => {
        setNewDoc({
            name: '',
            related_type: 'GENERAL',
            related_id: '',
            file_url: ''
        });
        setSelectedDocFile(null);
        setDocUploadMode('file');
        setShowDocModal(true);

        if (companyId) {
            try {
                const leads = await getLeads(user?.id, userRole, undefined, companyId);
                setLeadsList((leads || []).map(l => ({ id: l.id, name: l.name, company: l.company })));
            } catch (err) {
                console.error('Failed to load leads for doc modal:', err);
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedDocFile(file);
        if (!newDoc.name || newDoc.name.trim() === '') {
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            setNewDoc(prev => ({ ...prev, name: baseName }));
        }
    };

    const handleUploadDocument = async () => {
        if (!companyId) return alert('No company context available.');
        if (!newDoc.name?.trim()) return alert('Please enter a Document Name.');

        setUploadingDoc(true);
        try {
            let finalUrl = newDoc.file_url?.trim() || '';

            if (docUploadMode === 'file') {
                if (!selectedDocFile) {
                    alert('Please select a file to upload from your computer or phone.');
                    setUploadingDoc(false);
                    return;
                }

                // Upload to Supabase storage 'documents' bucket
                const fileExt = selectedDocFile.name.split('.').pop() || 'bin';
                const cleanName = selectedDocFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const filePath = `crm/${companyId}/${Date.now()}_${cleanName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(filePath, selectedDocFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    throw new Error(`File upload failed: ${uploadError.message}`);
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('documents')
                    .getPublicUrl(filePath);

                finalUrl = publicUrl;
            } else {
                if (!finalUrl) {
                    alert('Please enter a valid URL (e.g. https://...).');
                    setUploadingDoc(false);
                    return;
                }
            }

            const uploaderEmployeeId = currentEmployee?.id || null;

            const docPayload = {
                company_id: companyId,
                name: newDoc.name.trim(),
                file_url: finalUrl,
                related_type: newDoc.related_type || 'GENERAL',
                related_id: (newDoc.related_type === 'GENERAL' || !newDoc.related_id) ? null : String(newDoc.related_id),
                uploaded_by: uploaderEmployeeId,
                file_size: selectedDocFile ? selectedDocFile.size : null,
                file_type: selectedDocFile ? selectedDocFile.type : null,
                status: 'Active'
            };

            const { error: insertError } = await (supabase as any)
                .from('crm_documents')
                .insert([docPayload]);

            if (insertError) throw insertError;

            setShowDocModal(false);
            setNewDoc({});
            setSelectedDocFile(null);
            fetchCRMData(companyId, currentEmployee?.id);
        } catch (err: any) {
            console.error('Error uploading document:', err);
            alert('Failed to upload document: ' + (err.message || 'Unknown error'));
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleDeleteDocument = async (docId: string, docName: string) => {
        if (!window.confirm(`Are you sure you want to delete "${docName}"?`)) return;
        try {
            const { error } = await (supabase as any)
                .from('crm_documents')
                .delete()
                .eq('id', docId);
            if (error) throw error;
            if (companyId) fetchCRMData(companyId, currentEmployee?.id);
        } catch (err: any) {
            alert('Failed to delete document: ' + (err.message || 'Unknown error'));
        }
    };

    const formatFileSize = (bytes?: number | null) => {
        if (!bytes || bytes === 0) return null;
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getRelatedEntityLabel = (doc: any) => {
        if (!doc.related_type || doc.related_type === 'GENERAL' || !doc.related_id) {
            return {
                type: 'General',
                name: 'General Document',
                badgeClass: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300'
            };
        }
        if (doc.related_type === 'LEAD') {
            const lead = leadsList.find(l => String(l.id) === String(doc.related_id));
            return {
                type: 'Lead',
                name: lead ? `${lead.name}` : `Lead #${String(doc.related_id).substring(0, 8)}`,
                badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            };
        }
        if (doc.related_type === 'DEAL') {
            const deal = deals.find(d => String(d.id) === String(doc.related_id));
            return {
                type: 'Deal',
                name: deal ? `${deal.title || (deal as any).name}` : `Deal #${doc.related_id}`,
                badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            };
        }
        if (doc.related_type === 'CUSTOMER' || doc.related_type === 'CONTACT') {
            const contact = contacts.find(c => String(c.id) === String(doc.related_id));
            return {
                type: 'Customer',
                name: contact ? `${contact.name}` : `Customer #${doc.related_id}`,
                badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800'
            };
        }
        return {
            type: doc.related_type,
            name: `${doc.related_type} #${doc.related_id}`,
            badgeClass: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300'
        };
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
            { id: 'TASKS', icon: CheckSquare, label: 'Tasks', permission: 'crm.tasks.view' },
            { id: 'DOCUMENTS', icon: Folder, label: 'Documents', permission: 'crm.deals.view' },
            { id: 'WORKFLOWS', icon: Workflow, label: 'Workflows', permission: 'crm.leads.view' },
            { id: 'ASSISTANT', icon: Sparkles, label: 'Assistant', permission: 'crm.ai.view' },
            { id: 'UPDATES', icon: Bell, label: 'Updates', permission: 'crm.dashboard.view' },
            { id: 'REPORTS', icon: BarChart3, label: 'Reports', permission: 'crm.dashboard.view' },
            { id: 'LIVE', icon: Mic, label: 'Live Mode', permission: 'crm.deals.view' },
            { id: 'WEBSITE_FINDER', icon: Search, label: 'Site Finder', permission: 'crm.leads.manage' }
        ].filter(item => hasPermission(item.permission) || hasPermission('*')), [hasPermission]);

        const handleTabClick = (id: string) => {
            setActiveTab(id as CRMViewMode);
            setMobileSidebarOpen(false);
        };

        return (
            <>
                {/* Mobile overlay backdrop */}
                {mobileSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/30 z-30 md:hidden"
                        onClick={() => setMobileSidebarOpen(false)}
                    />
                )}
                <div className={`
                    w-[220px] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-r border-slate-100 dark:border-zinc-800 flex flex-col py-6 z-40 shadow-sm flex-shrink-0
                    fixed inset-y-0 left-0 transition-transform duration-200 ease-in-out
                    md:relative md:translate-x-0
                    ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}>
                    <div className="px-5 mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                <Briefcase className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-bold text-sm text-slate-800 dark:text-white tracking-wide">CRM</span>
                        </div>
                        <button
                            className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400"
                            onClick={() => setMobileSidebarOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 w-full px-3 space-y-1 overflow-y-auto">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleTabClick(item.id)}
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
            </>
        );
    };



    const DocumentsView = () => {
        const filteredDocuments = useMemo(() => {
            return documents.filter(doc => {
                const matchesCategory = docCategoryFilter === 'ALL' ||
                    (docCategoryFilter === 'GENERAL' && (!doc.related_type || doc.related_type === 'GENERAL')) ||
                    (doc.related_type === docCategoryFilter) ||
                    (docCategoryFilter === 'CUSTOMER' && doc.related_type === 'CONTACT');

                const matchesSearch = !docSearchQuery ||
                    doc.name?.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
                    doc.related_type?.toLowerCase().includes(docSearchQuery.toLowerCase());

                return matchesCategory && matchesSearch;
            });
        }, [documents, docCategoryFilter, docSearchQuery]);

        const canManageDocs = hasPermission('crm.deals.manage') || hasPermission('crm.leads.manage') || hasPermission('crm.contacts.manage') || hasPermission('documents.view') || hasPermission('*') || checkIsAdmin(userRole);

        return (
            <div className="p-6 lg:p-8 h-full flex flex-col animate-page-enter">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Documents Vault</h1>
                        <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Securely manage, upload, and organize CRM proposals, contracts, and files.
                        </p>
                    </div>
                    {canManageDocs && (
                        <button
                            onClick={openUploadModal}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all self-start sm:self-auto"
                        >
                            <UploadCloud className="w-4 h-4" /> Upload Document
                        </button>
                    )}
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                        {[
                            { id: 'ALL', label: 'All Documents', count: documents.length },
                            { id: 'GENERAL', label: 'General', count: documents.filter(d => !d.related_type || d.related_type === 'GENERAL').length },
                            { id: 'LEAD', label: 'Leads', count: documents.filter(d => d.related_type === 'LEAD').length },
                            { id: 'DEAL', label: 'Deals', count: documents.filter(d => d.related_type === 'DEAL').length },
                            { id: 'CUSTOMER', label: 'Customers', count: documents.filter(d => d.related_type === 'CUSTOMER' || d.related_type === 'CONTACT').length },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setDocCategoryFilter(tab.id as any)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    docCategoryFilter === tab.id
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                                    docCategoryFilter === tab.id
                                        ? 'bg-indigo-700 text-white'
                                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search Input */}
                    <div className="relative min-w-[240px]">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search documents..."
                            value={docSearchQuery}
                            onChange={e => setDocSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-xs font-medium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                        {docSearchQuery && (
                            <button
                                onClick={() => setDocSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                                &times;
                            </button>
                        )}
                    </div>
                </div>

                {/* Documents Grid / Container */}
                <div className="flex-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl p-6 lg:p-8 overflow-y-auto">
                    {filteredDocuments.length === 0 ? (
                        <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400">
                            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-zinc-800/80 flex items-center justify-center mb-4 text-indigo-500">
                                <FileText className="w-8 h-8 opacity-60" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                {docSearchQuery || docCategoryFilter !== 'ALL' ? 'No matching documents' : 'No documents yet'}
                            </h3>
                            <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm text-center">
                                {docSearchQuery || docCategoryFilter !== 'ALL'
                                    ? 'Try changing your search keywords or filter category.'
                                    : 'Upload contracts, proposals, or invoices to securely store them.'}
                            </p>
                            {canManageDocs && (
                                <button
                                    onClick={openUploadModal}
                                    className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Upload Document
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredDocuments.map(doc => {
                                const rel = getRelatedEntityLabel(doc);
                                const isPdf = doc.file_url?.toLowerCase().endsWith('.pdf') || doc.name?.toLowerCase().endsWith('.pdf');
                                const isSheet = doc.file_url?.match(/\.(xlsx?|csv)$/i) || doc.name?.match(/\.(xlsx?|csv)$/i);
                                const isImage = doc.file_url?.match(/\.(jpe?g|png|webp|gif)$/i) || doc.name?.match(/\.(jpe?g|png|webp|gif)$/i);

                                return (
                                    <div
                                        key={doc.id}
                                        className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                    isPdf
                                                        ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'
                                                        : isSheet
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                                                        : isImage
                                                        ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600'
                                                        : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                                                }`}>
                                                    {isSheet ? (
                                                        <FileSpreadsheet className="w-5 h-5" />
                                                    ) : (
                                                        <FileText className="w-5 h-5" />
                                                    )}
                                                </div>
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 max-w-[170px] truncate ${rel.badgeClass}`}>
                                                    <span className="truncate">{rel.type}: {rel.name}</span>
                                                </span>
                                            </div>

                                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1 break-words line-clamp-2" title={doc.name}>
                                                {doc.name}
                                            </h4>

                                            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                                                <span>{new Date(doc.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                {doc.file_size && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{formatFileSize(doc.file_size)}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-zinc-800/80">
                                            <a
                                                href={doc.file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                                            >
                                                <Eye className="w-3.5 h-3.5" /> View / Download
                                            </a>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(doc.file_url);
                                                        alert('Document link copied to clipboard!');
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                                    title="Copy link"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                                {canManageDocs && (
                                                    <button
                                                        onClick={() => handleDeleteDocument(doc.id, doc.name)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Delete document"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Document Modal */}
                {showDocModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => !uploadingDoc && setShowDocModal(false)}>
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[92vh] animate-slide-up" onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                        <UploadCloud className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upload Document</h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Attach contracts, proposals, or CRM files</p>
                                    </div>
                                </div>
                                <button
                                    disabled={uploadingDoc}
                                    onClick={() => setShowDocModal(false)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-left">
                                {/* Upload Mode Selector: File vs URL */}
                                <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setDocUploadMode('file')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                            docUploadMode === 'file'
                                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        <UploadCloud className="w-3.5 h-3.5" /> Select File from Device
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDocUploadMode('link')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                            docUploadMode === 'link'
                                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" /> External Link
                                    </button>
                                </div>

                                {/* File Drop Area (File mode) */}
                                {docUploadMode === 'file' ? (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                                            Select Document *
                                        </label>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            className="hidden"
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp"
                                        />
                                        {!selectedDocFile ? (
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-indigo-200 dark:border-zinc-700 rounded-2xl p-6 text-center hover:bg-indigo-50/40 dark:hover:bg-zinc-800/50 cursor-pointer transition-all group"
                                            >
                                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-zinc-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-3 group-hover:scale-110 transition-transform">
                                                    <UploadCloud className="w-6 h-6" />
                                                </div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white">Click to select document</p>
                                                <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, PowerPoint, Images (Max 25MB)</p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between p-4 bg-indigo-50/50 dark:bg-zinc-800/80 rounded-2xl border border-indigo-100 dark:border-zinc-700">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate" title={selectedDocFile.name}>
                                                            {selectedDocFile.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            {(selectedDocFile.size / 1024 / 1024).toFixed(2)} MB • Ready to upload
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedDocFile(null)}
                                                    className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg text-slate-400 hover:text-red-500 transition-colors ml-2"
                                                    title="Remove file"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                                            File URL *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="https://drive.google.com/..."
                                            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                                            value={newDoc.file_url || ''}
                                            onChange={e => setNewDoc({ ...newDoc, file_url: e.target.value })}
                                        />
                                    </div>
                                )}

                                {/* Document Title / Name */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                                        Document Name *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Service Proposal v2, Q4 Contract"
                                        className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                                        value={newDoc.name || ''}
                                        onChange={e => setNewDoc({ ...newDoc, name: e.target.value })}
                                    />
                                </div>

                                {/* Document Select Option (Related Entity Selection) */}
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                                            Link Document To
                                        </label>
                                        <select
                                            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                                            value={newDoc.related_type || 'GENERAL'}
                                            onChange={e => {
                                                const newType = e.target.value;
                                                setNewDoc({ ...newDoc, related_type: newType, related_id: '' });
                                            }}
                                        >
                                            <option value="GENERAL">General Document (Company-wide)</option>
                                            <option value="LEAD">Lead</option>
                                            <option value="DEAL">Opportunity / Deal</option>
                                            <option value="CUSTOMER">Customer / Contact</option>
                                        </select>
                                    </div>

                                    {/* Specific Entity Picker based on related_type */}
                                    {newDoc.related_type === 'LEAD' && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                                                Select Lead *
                                            </label>
                                            <select
                                                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                                                value={newDoc.related_id || ''}
                                                onChange={e => setNewDoc({ ...newDoc, related_id: e.target.value })}
                                            >
                                                <option value="">-- Choose a Lead --</option>
                                                {leadsList.map(l => (
                                                    <option key={l.id} value={l.id}>
                                                        {l.name} {l.company ? `(${l.company})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            {leadsList.length === 0 && (
                                                <p className="text-[11px] text-amber-500 mt-1">No leads found.</p>
                                            )}
                                        </div>
                                    )}

                                    {newDoc.related_type === 'DEAL' && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                                                Select Opportunity / Deal *
                                            </label>
                                            <select
                                                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                                                value={newDoc.related_id || ''}
                                                onChange={e => setNewDoc({ ...newDoc, related_id: e.target.value })}
                                            >
                                                <option value="">-- Choose a Deal / Opportunity --</option>
                                                {deals.map(d => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.title || (d as any).name || `Deal #${d.id}`} {d.value ? `(QAR ${d.value.toLocaleString()})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            {deals.length === 0 && (
                                                <p className="text-[11px] text-amber-500 mt-1">No active deals found.</p>
                                            )}
                                        </div>
                                    )}

                                    {newDoc.related_type === 'CUSTOMER' && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                                                Select Customer / Contact *
                                            </label>
                                            <select
                                                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                                                value={newDoc.related_id || ''}
                                                onChange={e => setNewDoc({ ...newDoc, related_id: e.target.value })}
                                            >
                                                <option value="">-- Choose a Customer --</option>
                                                {contacts.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name} {c.company ? `(${c.company})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            {contacts.length === 0 && (
                                                <p className="text-[11px] text-amber-500 mt-1">No customers found.</p>
                                            )}
                                        </div>
                                    )}

                                    {(!newDoc.related_type || newDoc.related_type === 'GENERAL') && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                                            💡 This document will be saved as a general CRM document and available in your company's CRM documents vault.
                                        </p>
                                    )}
                                </div>

                                {/* Upload Button */}
                                <button
                                    type="button"
                                    disabled={uploadingDoc}
                                    onClick={handleUploadDocument}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 mt-4"
                                >
                                    {uploadingDoc ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Uploading document to vault...</span>
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud className="w-5 h-5" />
                                            <span>Save & Upload Document</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

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
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up border border-white/60 dark:border-zinc-800 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-8 pb-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Contact</h2>
                            <button onClick={() => setShowContactModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-8 pt-4 space-y-4 overflow-y-auto flex-1">
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
            const { data } = await (supabase as any).from('crm_automations').select('*').eq('company_id', companyId);
            if (data) setAutomations(data);
        };

        const handleSaveAutomation = async () => {
            if (!newAuto.name) return;
            if (!companyId) return; // Guard

            await (supabase as any).from('crm_automations').insert([{
                name: newAuto.name,
                trigger_event: newAuto.trigger,
                action_type: newAuto.action,
                company_id: companyId,
                created_by: currentEmployee?.id // or null if fallback
            }]);
            setShowAutoModal(false);
            fetchAutomations();
        };

        return (
            <div className="p-4 md:p-6 lg:p-8 h-full flex flex-col animate-page-enter">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Workflows & Automations</h1>
                    <button onClick={() => setShowAutoModal(true)} className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 shadow-lg">
                        <Plus className="w-4 h-4" /> Create Automation
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
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
                </div>

                {showAutoModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md" onClick={() => setShowAutoModal(false)}>
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-8 pb-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                                <h2 className="text-xl font-bold mb-0">New Automation</h2>
                                <button onClick={() => setShowAutoModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
                            </div>
                            <div className="p-8 pt-4 space-y-4 overflow-y-auto flex-1">
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

    const UpdatesView = () => {
        const isAdmin = checkIsAdmin(userRole);
        return (
            <div className="p-8 h-full flex flex-col animate-page-enter">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Recent Updates</h1>
                            {!isAdmin && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full">
                                    <Lock size={11} /> Private View
                                </span>
                            )}
                        </div>
                        <p className="text-slate-500 text-sm mt-1">
                            {isAdmin ? 'Real-time activity feed across all sales representatives' : 'Your personal activity log and recent CRM updates'}
                        </p>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl flex flex-col gap-6">
                        {activities.map((act) => (
                            <div key={act.id} className="flex gap-4 group">
                                <div className="flex flex-col items-center">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800 border-2 border-white dark:border-zinc-700 flex items-center justify-center font-bold text-slate-500 text-xs">
                                        {(act.performer?.name || user?.user_metadata?.full_name || 'Me').substring(0, 2).toUpperCase()}
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
                            <div className="p-8 text-center text-slate-400">
                                <p className="font-medium">No recent updates found for your account.</p>
                                <p className="text-xs text-slate-400 mt-1">Activities will appear here as you create or update your leads, opportunities, and customers.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-full relative z-10 overflow-hidden">
            <SidebarNav />
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-slate-50/50 dark:bg-zinc-950">
                {/* Mobile menu toggle */}
                <button
                    className="md:hidden fixed bottom-6 left-4 z-50 p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/30 active:scale-95 transition-transform"
                    onClick={() => setMobileSidebarOpen(true)}
                >
                    <Menu className="w-5 h-5" />
                </button>
                {delayedLoading ? (
                    activeTab === 'DASHBOARD' ? <DashboardSkeleton /> : <TableSkeleton />
                ) : !companyId ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                            <Briefcase className="w-10 h-10 opacity-50" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">No Company Assigned</h2>
                        <p className="max-w-md text-center mt-2">You are not currently linked to any company. Please contact your administrator to be assigned to an organization.</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'DASHBOARD' && (
                            <SummaryView 
                                stats={stats} 
                                activities={activities} 
                                deals={deals} 
                                tasks={tasks} 
                                companyId={companyId || undefined}
                                onRefresh={() => companyId && fetchCRMData(companyId)}
                            />
                        )}
                        {activeTab === 'LEADS' && <LeadsView companyId={companyId} onConvert={(tab) => setActiveTab(tab)} />}
                        {activeTab === 'OPPORTUNITIES' && <OpportunitiesView companyId={companyId} onConvert={(tab) => setActiveTab(tab)} />}
                        {activeTab === 'CUSTOMERS' && <CustomersView companyId={companyId} />}

                        {activeTab === 'ITEMS' && <ItemsView companyId={companyId} />}

                        {activeTab === 'WEBSITE_FINDER' && <WebsiteFinderView companyId={companyId} />}
                        {activeTab === 'TASKS' && <TasksView />}
                        {activeTab === 'SCHEDULE' && <ScheduleView />}
                        {activeTab === 'DOCUMENTS' && <DocumentsView />}
                        {activeTab === 'WORKFLOWS' && <ProposalWorkflow companyId={companyId || ''} />}
                        {activeTab === 'ASSISTANT' && <AssistantView />}
                        {activeTab === 'UPDATES' && <UpdatesView />}
                        {activeTab === 'REPORTS' && <ReportsListView moduleFilter="CRM" companyId={companyId} />}
                        {activeTab === 'LIVE' && <LiveView />}
                    </>
                )}
            </div>
        </div>
    );
};