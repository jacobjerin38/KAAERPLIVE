import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    KanbanSquare,
    Users,
    MessageSquare,
    Mic,
    Search,
    Plus,
    MoreHorizontal,
    Filter,
    Send,
    Sparkles,
    Briefcase,
    Calendar,
    Mail,
    Phone,
    CheckSquare,
    Clock,
    FileText,
    Workflow,
    Bell,
    Folder,
    CheckCircle2,
    Circle,
    Play
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { LiveView } from '../crm/LiveView';
import {
    analyzeLead,
    draftEmail,
    generatePipelineInsight,
    getDeals,
    getTasks,
    getContacts,
    createDeal,
    createTask,
    getStages,
    getTaskStatuses,
    getTaskPriorities
} from '../crm/services';
import { CRMViewMode, Contact, Deal, LeadAnalysis, Message, Task, Stage } from '../crm/types';
import { CRMTaskStatus, CRMTaskPriority } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react'; // For loading state

export const CRM: React.FC = () => {
    const { currentCompanyId, user } = useAuth();
    const [activeTab, setActiveTab] = useState<CRMViewMode>('DASHBOARD');
    const [loading, setLoading] = useState(true);

    // Data State
    const [deals, setDeals] = useState<Deal[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [stages, setStages] = useState<Stage[]>([]);

    const [isDealModalOpen, setIsDealModalOpen] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

    // Task Meta State
    const [taskStatuses, setTaskStatuses] = useState<CRMTaskStatus[]>([]);
    const [taskPriorities, setTaskPriorities] = useState<CRMTaskPriority[]>([]);

    // Chat State
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMsg, setInputMsg] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Dashboard Insight State
    const [insight, setInsight] = useState<string>('');

    // Contact Detail Modal State
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [leadAnalysis, setLeadAnalysis] = useState<LeadAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [draftedEmail, setDraftedEmail] = useState('');

    // --- Effects ---
    useEffect(() => {
        fetchData();
    }, [currentCompanyId]);

    const fetchData = async () => {
        setLoading(true);
        const [fetchedDeals, fetchedContacts, fetchedTasks, fetchedStages, fetchedStatuses, fetchedPriorities] = await Promise.all([
            getDeals(),
            getContacts(),
            getTasks(),
            getStages(),
            getTaskStatuses(),
            getTaskPriorities()
        ]);
        setDeals(fetchedDeals);
        setContacts(fetchedContacts);
        setTasks(fetchedTasks);
        setStages(fetchedStages);
        setTaskStatuses(fetchedStatuses);
        setTaskPriorities(fetchedPriorities);
        setLoading(false);
    };
    useEffect(() => {
        if (activeTab === 'DASHBOARD' && !insight) {
            generatePipelineInsight(deals).then(setInsight);
        }
    }, [activeTab, deals, insight]);

    // --- Handlers ---

    const handleSendMessage = async () => {
        if (!inputMsg.trim()) return;

        const newMsg: Message = { id: Date.now().toString(), role: 'user', text: inputMsg, timestamp: new Date() };
        setMessages(prev => [...prev, newMsg]);
        setInputMsg('');
        setIsTyping(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const chat = ai.chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction: 'You are KAA CRM Assistant.' } });
            const result = await chat.sendMessageStream({ message: inputMsg });

            let fullResponse = "";
            const botMsgId = (Date.now() + 1).toString();

            setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '', timestamp: new Date() }]);

            for await (const chunk of result) {
                const text = chunk.text;
                if (text) {
                    fullResponse += text;
                    setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: fullResponse } : m));
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsTyping(false);
        }
    };

    const handleAnalyzeLead = async (contact: Contact) => {
        setIsAnalyzing(true);
        const result = await analyzeLead(contact);
        setLeadAnalysis(result);
        setIsAnalyzing(false);
    };

    const handleDraftEmail = async (contact: Contact) => {
        setDraftedEmail("Drafting...");
        const text = await draftEmail(contact);
        setDraftedEmail(text);
    };

    // --- Sub-Components ---

    const SidebarNav = () => (
        <div className="w-20 md:w-64 flex-shrink-0 bg-white/40 border-r border-slate-200/50 flex flex-col pt-8 gap-3 px-4 backdrop-blur-xl">
            <div className="mb-8 px-2 hidden md:block">
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">KAA CRM</h2>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">Enterprise</span>
            </div>
            {[
                { id: 'DASHBOARD', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'PIPELINE', icon: KanbanSquare, label: 'Pipeline' },
                { id: 'TASKS', icon: CheckSquare, label: 'Tasks' },
                { id: 'SCHEDULE', icon: Calendar, label: 'Schedule' },
                { id: 'DOCUMENTS', icon: Folder, label: 'Documents' },
                { id: 'CONTACTS', icon: Users, label: 'Contacts' },
                { id: 'WORKFLOWS', icon: Workflow, label: 'Workflows' },
                { id: 'ASSISTANT', icon: MessageSquare, label: 'Assistant' },
                { id: 'UPDATES', icon: Bell, label: 'Updates' },
                { id: 'LIVE', icon: Mic, label: 'Live Mode' },
            ].map((item) => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as CRMViewMode)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all active:scale-95 duration-200 ${activeTab === item.id
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                        : 'text-slate-500 hover:bg-white/60 hover:text-slate-800 hover:shadow-sm'
                        }`}
                >
                    <item.icon className="w-5 h-5" strokeWidth={activeTab === item.id ? 2.5 : 2} />
                    <span className="hidden md:inline font-bold text-sm tracking-tight">{item.label}</span>
                </button>
            ))}
        </div>
    );

    const DashboardView = () => (
        <div className="p-8 h-full overflow-y-auto animate-page-enter">
            <h1 className="text-3xl font-bold text-slate-900 mb-6 tracking-tight">Dashboard</h1>

            {/* Gemini Insight Card */}
            <div className="mb-8 relative overflow-hidden rounded-[2rem] p-8 bg-gradient-to-r from-indigo-600 to-indigo-900 text-white shadow-2xl shadow-indigo-500/30">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles className="w-48 h-48" /></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md border border-white/20">
                            <Sparkles className="w-4 h-4 text-indigo-100" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Gemini Insight</span>
                    </div>
                    <p className="text-2xl font-medium leading-relaxed opacity-95 max-w-2xl">
                        {insight || "Analyzing pipeline data..."}
                    </p>
                    <div className="mt-6 flex gap-3">
                        <button className="px-5 py-2.5 bg-white text-indigo-900 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors">View Report</button>
                        <button className="px-5 py-2.5 bg-indigo-800/50 text-white border border-indigo-400/30 rounded-xl font-bold text-sm hover:bg-indigo-800/70 transition-colors">Ask Assistant</button>
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {[
                    { label: 'Pipeline Value', value: deals.length > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(deals.reduce((sum, d) => sum + (d.value || 0), 0)) : '$0', color: 'text-slate-900', icon: Briefcase },
                    { label: 'Win Rate', value: deals.length > 0 ? `${Math.round((deals.filter(d => (d.stage as any)?.name === 'WON' || (d.stage as any) === 'WON').length / deals.length) * 100)}%` : '0%', color: 'text-emerald-600', icon: CheckCircle2 },
                    { label: 'Active Deals', value: `${deals.filter(d => d.status === 'OPEN').length}`, color: 'text-indigo-600', icon: KanbanSquare },
                    { label: 'Avg Cycle', value: deals.length > 0 ? (() => { const closed = deals.filter(d => d.expected_close_date && d.created_at); if (closed.length === 0) return 'N/A'; const avg = closed.reduce((s, d) => s + Math.max(1, Math.round((new Date(d.expected_close_date!).getTime() - new Date(d.created_at!).getTime()) / 86400000)), 0) / closed.length; return `${Math.round(avg)} Days`; })() : 'N/A', color: 'text-slate-900', icon: Clock }
                ].map((metric, i) => (
                    <div key={i} className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 shadow-lg shadow-slate-200/50 hover:-translate-y-1 transition-transform group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                                <metric.icon className="w-5 h-5 text-slate-500" />
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{metric.label}</p>
                        <h3 className={`text-3xl font-extrabold mt-1 tracking-tight ${metric.color}`}>{metric.value}</h3>
                    </div>
                ))}
            </div>

            {/* Funnel Chart (CSS) */}
            <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 shadow-lg shadow-slate-200/50">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-bold text-slate-800 tracking-tight">Pipeline Stages</h3>
                    <button className="text-indigo-600 text-sm font-bold hover:underline">View Full Pipeline</button>
                </div>
                <div className="space-y-6">
                    {stages.length > 0 ? stages.map((stage, i) => {
                        const stageDeals = deals.filter(d => (d.stage as any)?.name === stage.name || (d.stage as any) === stage.name);
                        const maxDeals = Math.max(...stages.map(s => deals.filter(d => (d.stage as any)?.name === s.name || (d.stage as any) === s.name).length), 1);
                        const widthPct = `${Math.max(10, (stageDeals.length / maxDeals) * 100)}%`;
                        return (
                            <div key={stage.id} className="group cursor-pointer">
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                                    <span>{stage.name}</span>
                                    <span>{stageDeals.length} Deals</span>
                                </div>
                                <div className="h-4 bg-slate-100/80 rounded-full overflow-hidden shadow-inner relative">
                                    <div className={`h-full ${i === stages.length - 1 ? 'bg-emerald-500' : 'bg-indigo-500'} rounded-full transition-all duration-1000 ease-out group-hover:brightness-110 shadow-sm`} style={{ width: widthPct }}></div>
                                </div>
                            </div>
                        );
                    }) : (
                        <p className="text-center text-slate-400 py-8">No pipeline stages configured.</p>
                    )}
                </div>
            </div>
        </div>
    );

    /* New Deal Handler */
    const handleCreateDeal = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newDeal: Partial<Deal> = {
            title: formData.get('title') as string,
            company: formData.get('company') as string,
            value: parseFloat(formData.get('value') as string),
            stage_id: stages.find(s => s.name === 'LEAD')?.id || stages[0]?.id, // Use ID
            company_id: currentCompanyId || undefined,
            status: 'OPEN',
            expected_close_date: formData.get('due_date') as string,
        };

        const created = await createDeal(newDeal);
        if (created) {
            setDeals(prev => [created, ...prev]);
            setIsDealModalOpen(false);
        } else {
            alert('Failed to create deal');
        }
    };

    const PipelineView = () => (
        <div className="flex-1 overflow-x-auto p-8 flex gap-8 h-full animate-page-enter">
            {stages.length > 0 ? stages.map((stage) => {
                const stageDeals = deals.filter(d => (d.stage as any)?.name === stage.name || (d.stage as any) === stage.name);
                return (
                    <div key={stage.id} className="min-w-[340px] flex flex-col h-full">
                        <div className="flex items-center justify-between mb-6 px-2">
                            <h3 className="font-bold text-slate-700 tracking-tight">{stage.name}</h3>
                            <span className="bg-white/60 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 shadow-sm">{stageDeals.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                            {stageDeals.map(deal => (
                                <div key={deal.id} className="bg-white/80 backdrop-blur-xl p-5 rounded-[1.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all cursor-grab active:cursor-grabbing group">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide border ${deal.tag_color || 'bg-slate-100 text-slate-500 border-slate-200'}`}>{deal.tag || 'DEAL'}</span>
                                        <button className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="w-4 h-4" /></button>
                                    </div>
                                    <h4 className="font-bold text-slate-800 mb-1 text-lg leading-tight">{deal.title}</h4>
                                    <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-5 font-medium"><Briefcase className="w-3.5 h-3.5" /> {deal.company}</p>
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                        <span className="text-base font-extrabold text-slate-700 tracking-tight">${deal.value?.toLocaleString() || 0}</span>
                                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{deal.expected_close_date || 'No Date'}</span>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => setIsDealModalOpen(true)}
                                className="w-full py-4 rounded-[1.5rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all">
                                + Add Deal
                            </button>
                        </div>
                    </div>
                );
            }) : (
                <div className="flex items-center justify-center w-full text-slate-400">Loading Pipeline Stages...</div>
            )}
        </div>
    );

    const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newTask: Partial<Task> = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            status_id: taskStatuses.find(s => s.name === 'To Do')?.id || taskStatuses[0]?.id,
            priority_id: taskPriorities.find(p => p.name === 'Medium')?.id || taskPriorities[0]?.id,
            due_date: formData.get('due_date') as string,
            company_id: currentCompanyId || undefined,
            assigned_to: undefined, // Requires employee lookup, leaving undefined for now or handling if ID passed
            // assignee: formData.get('assignee') as string, // Removing this as it expects Employee object, and DB expects assigned_to ID
        };

        const created = await createTask(newTask);
        if (created) {
            setTasks(prev => [...prev, created]);
            setIsTaskModalOpen(false);
        } else {
            alert('Failed to create task');
        }
    };

    const TasksView = () => (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tasks</h1>
                <button
                    onClick={() => setIsTaskModalOpen(true)}
                    className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                    <Plus className="w-4 h-4" /> New Task
                </button>
            </div>

            <div className="flex gap-8 overflow-x-auto pb-4">
                {(taskStatuses.length > 0 ? taskStatuses.map(s => s.name) : ['To Do', 'In Progress', 'Done']).map((status) => (
                    <div key={status} className="flex-1 min-w-[300px]">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">{status}</h3>
                        <div className="space-y-4">
                            {tasks.filter(t => (t.status_details?.name === status)).map((task) => (
                                <div key={task.id} className="bg-white/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 shadow-sm hover:shadow-md transition-all group cursor-pointer">
                                    <div className="flex items-start gap-3">
                                        <button className="mt-1 text-slate-300 hover:text-indigo-600 transition-colors">
                                            <Circle className="w-5 h-5" />
                                        </button>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-800 leading-tight mb-1">{task.title}</h4>
                                            {task.description && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{task.description}</p>}
                                            <p className="text-xs text-slate-500 mb-3">Due: {task.due_date}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-orange-200">{task.priority_details?.name || 'Normal'}</span>
                                                <div className="w-6 h-6 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[10px] font-bold text-slate-600 ml-auto">{task.assignee?.name?.charAt(0) || 'U'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const ScheduleView = () => (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Schedule</h1>
                <div className="flex gap-2 bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm">Day</button>
                    <button className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-xl text-sm font-bold">Week</button>
                    <button className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-xl text-sm font-bold">Month</button>
                </div>
            </div>

            <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-xl shadow-slate-200/50 p-8 overflow-y-auto">
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <Calendar className="w-8 h-8 opacity-30" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 mb-2">No Events Scheduled</h3>
                    <p className="max-w-xs mx-auto">Your calendar is empty. Add events to see them here.</p>
                    <button className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">+ Add Event</button>
                </div>
            </div>
        </div>
    );

    const DocumentsView = () => (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Documents</h1>
                <div className="flex gap-3">
                    <button className="bg-white text-slate-600 px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 border border-slate-200 hover:bg-slate-50 shadow-sm">
                        <Filter className="w-4 h-4" /> Filter
                    </button>
                    <button className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                        <Plus className="w-4 h-4" /> Upload
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <Folder className="w-8 h-8 opacity-30" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">No Documents Yet</h3>
                <p className="max-w-xs mx-auto text-center">Upload your first document to get started.</p>
                <button className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">+ Upload Document</button>
            </div>
        </div>
    );

    const ContactsView = () => (
        <div className="h-full flex flex-col p-8 animate-page-enter">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Contacts</h1>
                <div className="flex gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input type="text" placeholder="Search contacts..." className="pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/20 shadow-sm w-72 transition-all" />
                    </div>
                    <button className="bg-slate-900 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 hover:shadow-lg active:scale-95 transition-all">
                        <Plus className="w-4 h-4" /> Add New
                    </button>
                </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] flex-1 overflow-hidden shadow-xl shadow-slate-200/50 border border-white/60">
                <div className="overflow-y-auto h-full">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/60">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Contact</th>
                                <th className="px-8 py-5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                            {contacts.map((contact) => (
                                <tr key={contact.id} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="px-8 py-4">
                                        <div>
                                            <p className="font-bold text-slate-800">{contact.name}</p>
                                            <p className="text-xs text-slate-500 font-medium">{contact.email}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <div>
                                            <p className="font-medium text-slate-700">{contact.role}</p>
                                            <p className="text-xs text-slate-500">{contact.organization}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${contact.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                            contact.status === 'Lead' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                            }`}>{contact.status}</span>
                                    </td>
                                    <td className="px-8 py-4 text-sm text-slate-500 font-medium">{contact.last_contact}</td>
                                    <td className="px-8 py-4 text-right">
                                        <button
                                            onClick={() => { setSelectedContact(contact); setLeadAnalysis(null); setDraftedEmail(''); }}
                                            className="text-indigo-600 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Contact Detail Modal */}
            {selectedContact && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md animate-fade-in" onClick={() => setSelectedContact(null)}>
                    <div className="bg-white/95 backdrop-blur-xl w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up border border-white/60" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                            <div className="flex items-center gap-5">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-3xl font-bold text-indigo-600 border-4 border-white shadow-lg">
                                    {selectedContact.name.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedContact.name}</h2>
                                    <h3 className="text-sm font-bold text-slate-700">{selectedContact.role} at {selectedContact.organization}</h3>
                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <Mail className="w-4 h-4" /> {selectedContact.email}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <Phone className="w-4 h-4" /> {selectedContact.phone}
                                        </div>
                                    </div>
                                    {/* <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-8 mb-4">Notes</h3>
                                    <p className="text-sm text-slate-600 bg-yellow-50/50 p-5 rounded-[1.5rem] border border-yellow-100/50 leading-relaxed">
                                        {selectedContact.notes}
                                    </p> */}
                                </div>

                                <div className="space-y-6">
                                    {/* AI Actions */}
                                    <div className="bg-gradient-to-br from-indigo-50/80 to-white p-6 rounded-[2rem] border border-indigo-100 shadow-sm">
                                        <h3 className="text-xs font-bold text-indigo-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                                            <Sparkles className="w-4 h-4 text-indigo-500" /> Gemini Intelligence
                                        </h3>

                                        {!leadAnalysis ? (
                                            <button
                                                onClick={() => handleAnalyzeLead(selectedContact)}
                                                disabled={isAnalyzing}
                                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all disabled:opacity-50 active:scale-95"
                                            >
                                                {isAnalyzing ? "Analyzing..." : "Analyze Lead Score"}
                                            </button>
                                        ) : (
                                            <div className="space-y-4 animate-fade-in">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-bold text-slate-500">Score</span>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-32 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${leadAnalysis.score}%` }}></div>
                                                        </div>
                                                        <span className="font-bold text-indigo-700 text-lg">{leadAnalysis.score}</span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-slate-600 leading-relaxed font-medium"><span className="text-slate-900 font-bold">Insight:</span> {leadAnalysis.reasoning}</p>
                                                <div className="bg-white p-4 rounded-xl border border-indigo-100 text-xs text-indigo-700 font-bold shadow-sm flex gap-2">
                                                    <span>💡</span> {leadAnalysis.suggestedAction}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
                                        <h3 className="text-xs font-bold text-slate-700 mb-4 uppercase tracking-wide">Quick Actions</h3>
                                        <button
                                            onClick={() => handleDraftEmail(selectedContact)}
                                            className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all mb-3 shadow-sm active:scale-95"
                                        >
                                            Draft Follow-up Email
                                        </button>
                                        {draftedEmail && (
                                            <div className="mt-2 p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 italic leading-relaxed shadow-inner">
                                                "{draftedEmail}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const WorkflowsView = () => (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Workflows</h1>
                <button className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                    <Plus className="w-4 h-4" /> Create Workflow
                </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <Workflow className="w-8 h-8 opacity-30" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">No Workflows Configured</h3>
                <p className="max-w-xs mx-auto text-center">Create your first automation workflow to streamline your CRM processes.</p>
            </div>
        </div>
    );

    const AssistantView = () => (
        <div className="h-full flex flex-col max-w-4xl mx-auto p-4 md:p-8 animate-page-enter">
            <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-[3rem] shadow-xl shadow-slate-200/50 border border-white/60 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-white/40 backdrop-blur-md flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3 tracking-tight">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20"><Sparkles className="w-5 h-5" /></div>
                            KAA Assistant
                        </h2>
                    </div>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-indigo-100">Gemini 2.5 Flash</span>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                <MessageSquare className="w-8 h-8 opacity-30" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 mb-2">How can I help you?</h3>
                            <p className="max-w-xs mx-auto">Ask me to analyze your pipeline, draft emails, or summarize recent deals.</p>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-5 rounded-[1.5rem] text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-none shadow-indigo-500/20'
                                : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                                }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white px-5 py-4 rounded-[1.5rem] rounded-bl-none shadow-sm border border-slate-100 flex gap-1.5 items-center">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 bg-white/60 border-t border-slate-100/50 backdrop-blur-md">
                    <div className="flex items-center gap-3 bg-white p-2 rounded-[1.5rem] shadow-lg shadow-slate-200/50 border border-slate-200">
                        <input
                            type="text"
                            value={inputMsg}
                            onChange={(e) => setInputMsg(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Type your request..."
                            className="flex-1 bg-transparent px-5 py-2 text-sm focus:outline-none text-slate-700 placeholder-slate-400 font-medium"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!inputMsg.trim() || isTyping}
                            className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/30"
                        >
                            <Send className="w-5 h-5 ml-0.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const UpdatesView = () => (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <h1 className="text-3xl font-bold text-slate-900 mb-8 tracking-tight">Recent Updates</h1>

            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <Bell className="w-8 h-8 opacity-30" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">No Recent Updates</h3>
                <p className="max-w-xs mx-auto text-center">Activity updates from your team will appear here.</p>
            </div>
        </div>
    );

    // --- Main Render ---

    return (
        <div className="flex h-full relative z-10 overflow-hidden">
            <SidebarNav />
            <div className="flex-1 overflow-hidden relative">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                ) : (
                    <>
                        {activeTab === 'DASHBOARD' && <DashboardView />}
                        {activeTab === 'PIPELINE' && <PipelineView />}
                        {activeTab === 'TASKS' && <TasksView />}
                        {activeTab === 'SCHEDULE' && <ScheduleView />}
                        {activeTab === 'DOCUMENTS' && <DocumentsView />}
                        {activeTab === 'CONTACTS' && <ContactsView />}
                        {activeTab === 'WORKFLOWS' && <WorkflowsView />}
                        {activeTab === 'ASSISTANT' && <AssistantView />}
                        {activeTab === 'UPDATES' && <UpdatesView />}
                        {activeTab === 'LIVE' && <LiveView />}
                    </>
                )}

                {/* Add Deal Modal */}
                {isDealModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsDealModalOpen(false)}>
                        <div className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-lg border border-slate-100" onClick={e => e.stopPropagation()}>
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">Add New Deal</h2>
                            <form onSubmit={handleCreateDeal} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Deal Title</label>
                                    <input required name="title" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="e.g. Enterprise License Q3" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Company / Lead Name</label>
                                    <input required name="company" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="e.g. Acme Corp" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Value ($)</label>
                                        <input required type="number" name="value" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="0.00" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Due Date</label>
                                        <input type="date" name="due_date" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold mt-4 hover:bg-indigo-700 transition-all">Create Deal</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* New Task Modal */}
                {isTaskModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsTaskModalOpen(false)}>
                        <div className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-lg border border-slate-100" onClick={e => e.stopPropagation()}>
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">Create New Task</h2>
                            <form onSubmit={handleCreateTask} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Task Title</label>
                                    <input required name="title" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="e.g. Follow up with client" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Assignee</label>
                                    <input name="assignee" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Type employee name..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Due Date</label>
                                    <input type="date" name="due_date" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                                    <textarea name="description" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-24" placeholder="Task details..."></textarea>
                                </div>
                                <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold mt-4 hover:bg-indigo-700 transition-all">Create Task</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};