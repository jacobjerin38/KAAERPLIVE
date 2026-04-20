import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, X, ArrowRight, User, Building, FileText, Settings, LogOut, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../contexts/UIContext';
import { supabase } from '../lib/supabase';

// Types for search results
type ResultType = 'NAVIGATION' | 'PEOPLE' | 'DATA' | 'ACTION';

interface SearchResult {
    id: string;
    type: ResultType;
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    action: () => void;
}

export const GlobalSearchModal: React.FC = () => {
    const { isSearchOpen, toggleSearch, toggleNotifications } = useUI(); // Added toggleNotifications
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    // Focus input when opened
    useEffect(() => {
        if (isSearchOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setQuery('');
            setResults([]);
        }
    }, [isSearchOpen]);

    // Static Navigation Items
    const staticItems: SearchResult[] = [
        { id: 'nav-home', type: 'NAVIGATION', title: 'Dashboard', subtitle: 'Go to Home', icon: <LayoutGrid className="w-4 h-4" />, action: () => navigate('/') },
        { id: 'nav-hrms', type: 'NAVIGATION', title: 'HRMS', subtitle: 'Human Resources Module', icon: <User className="w-4 h-4" />, action: () => navigate('/hrms') },
        { id: 'nav-crm', type: 'NAVIGATION', title: 'CRM', subtitle: 'Customer Relationship Module', icon: <User className="w-4 h-4" />, action: () => navigate('/crm') },
        { id: 'nav-org', type: 'NAVIGATION', title: 'Organisation', subtitle: 'Company Settings & Structure', icon: <Building className="w-4 h-4" />, action: () => navigate('/organisation') },
        { id: 'nav-essp', type: 'NAVIGATION', title: 'ESSP', subtitle: 'Employee Self Service', icon: <User className="w-4 h-4" />, action: () => navigate('/essp') },
        { id: 'nav-accounting', type: 'NAVIGATION', title: 'Accounting', subtitle: 'Financials, Banking & Audit', icon: <FileText className="w-4 h-4" />, action: () => navigate('/accounting') },
        { id: 'nav-inventory', type: 'NAVIGATION', title: 'Inventory', subtitle: 'Stock, Logistics & Warehouse', icon: <FileText className="w-4 h-4" />, action: () => navigate('/inventory') },
        { id: 'nav-manufacturing', type: 'NAVIGATION', title: 'Manufacturing', subtitle: 'Work Orders, BOM & PLM', icon: <FileText className="w-4 h-4" />, action: () => navigate('/manufacturing') },
        { id: 'nav-procurement', type: 'NAVIGATION', title: 'Procurement', subtitle: 'Purchase Orders & Vendors', icon: <FileText className="w-4 h-4" />, action: () => navigate('/procurement') },
        { id: 'nav-settings', type: 'NAVIGATION', title: 'Settings', subtitle: 'App Preferences', icon: <Settings className="w-4 h-4" />, action: () => navigate('/settings') },
        { id: 'act-notifs', type: 'ACTION', title: 'Notifications', subtitle: 'View latest alerts', icon: <Settings className="w-4 h-4" />, action: () => { toggleSearch(false); toggleNotifications(true); } },
    ];

    // Search Logic
    useEffect(() => {
        const performSearch = async () => {
            if (!query.trim()) {
                setResults([]);
                return;
            }

            setLoading(true);
            const searchCanvas: SearchResult[] = [];
            const q = query.toLowerCase();

            // 1. Filter Static Navigation
            const matchedStatic = staticItems.filter(item =>
                item.title.toLowerCase().includes(q) ||
                item.subtitle?.toLowerCase().includes(q)
            );
            searchCanvas.push(...matchedStatic);

            // 2. Fetch from Supabase
            try {
                // Search Employees
                if (q.length > 1) {
                    const { data: employees } = await supabase
                        .from('employees')
                        .select('id, first_name, last_name, email, designation, department')
                        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,designation.ilike.%${query}%`)
                        .limit(5);

                    if (employees) {
                        employees.forEach((emp: any) => {
                            const name = [emp.first_name, emp.last_name].filter(Boolean).join(' ') || 'Unnamed';
                            searchCanvas.push({
                                id: `emp-${emp.id}`,
                                type: 'PEOPLE',
                                title: name,
                                subtitle: `${emp.designation || 'Employee'} • ${emp.department || ''}`.trim(),
                                icon: <User className="w-4 h-4" />,
                                action: () => { navigate('/hrms'); }
                            });
                        });
                    }
                }

                // Search CRM Leads
                if (q.length > 1) {
                    const { data: leads } = await (supabase as any)
                        .from('crm_leads')
                        .select('id, first_name, last_name, email, company, source')
                        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
                        .limit(4);

                    if (leads) {
                        leads.forEach((lead: any) => {
                            const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unnamed Lead';
                            searchCanvas.push({
                                id: `lead-${lead.id}`,
                                type: 'DATA',
                                title: name,
                                subtitle: `Lead • ${lead.company || lead.source || ''}`.trim(),
                                icon: <User className="w-4 h-4" />,
                                action: () => { navigate('/crm'); }
                            });
                        });
                    }
                }

                // Search CRM Customers
                if (q.length > 1) {
                    const { data: customers } = await (supabase as any)
                        .from('crm_customers')
                        .select('id, name, email, company, industry')
                        .or(`name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
                        .limit(4);

                    if (customers) {
                        customers.forEach((cust: any) => {
                            searchCanvas.push({
                                id: `cust-${cust.id}`,
                                type: 'DATA',
                                title: cust.name || cust.company || 'Unknown',
                                subtitle: `Customer • ${cust.industry || cust.email || ''}`.trim(),
                                icon: <Building className="w-4 h-4" />,
                                action: () => { navigate('/crm'); }
                            });
                        });
                    }
                }

                // Search CRM Opportunities
                if (q.length > 1) {
                    const { data: opps } = await (supabase as any)
                        .from('crm_opportunities')
                        .select('id, title, stage, value')
                        .ilike('title', `%${query}%`)
                        .limit(4);

                    if (opps) {
                        opps.forEach((opp: any) => {
                            searchCanvas.push({
                                id: `opp-${opp.id}`,
                                type: 'DATA',
                                title: opp.title || 'Untitled Opportunity',
                                subtitle: `Opportunity • ${opp.stage || ''} • ${opp.value ? 'QAR ' + Number(opp.value).toLocaleString() : ''}`.trim(),
                                icon: <FileText className="w-4 h-4" />,
                                action: () => { navigate('/crm'); }
                            });
                        });
                    }
                }

                // Search Departments
                const { data: depts } = await supabase
                    .from('departments')
                    .select('id, name, type')
                    .ilike('name', `%${query}%`)
                    .limit(3);

                if (depts) {
                    depts.forEach((d: any) => {
                        searchCanvas.push({
                            id: `dept-${d.id}`,
                            type: 'DATA',
                            title: d.name,
                            subtitle: `Department • ${d.type}`,
                            icon: <Building className="w-4 h-4" />,
                            action: () => { navigate('/organisation'); }
                        });
                    });
                }

                // Search Profiles
                if (q.length > 1) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, email, role')
                        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
                        .limit(5);

                    if (profiles) {
                        profiles.forEach((p: any) => {
                            searchCanvas.push({
                                id: `user-${p.id}`,
                                type: 'PEOPLE',
                                title: p.full_name || 'Unknown User',
                                subtitle: `${p.email} • ${p.role || 'Employee'}`,
                                icon: <User className="w-4 h-4" />,
                                action: () => { navigate('/organisation'); }
                            });
                        });
                    }
                }

            } catch (error) {
                console.error("Search error", error);
            }

            // Deduplicate by id
            const seen = new Set<string>();
            const deduplicated = searchCanvas.filter(item => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });

            setResults(deduplicated);
            setLoading(false);
            setSelectedIndex(0);
        };

        const timer = setTimeout(performSearch, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Keyboard Navigation
    useEffect(() => {
        const handleNav = (e: KeyboardEvent) => {
            if (!isSearchOpen) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            }
            if (e.key === 'Enter' && results[selectedIndex]) {
                e.preventDefault();
                results[selectedIndex].action();
                toggleSearch(false);
            }
        };
        window.addEventListener('keydown', handleNav);
        return () => window.removeEventListener('keydown', handleNav);
    }, [isSearchOpen, results, selectedIndex]);

    if (!isSearchOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
                onClick={() => toggleSearch(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-black/50 border border-slate-200 dark:border-zinc-800 overflow-hidden animate-scale-in flex flex-col max-h-[60vh]">

                {/* Header / Input */}
                <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100 dark:border-zinc-800">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search for anything..."
                        className="flex-1 bg-transparent text-lg font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                    />
                    <button
                        onClick={() => toggleSearch(false)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-bold px-2 py-1"
                    >
                        ESC
                    </button>
                </div>

                {/* Results */}
                <div className="overflow-y-auto p-2 scroll-smooth">
                    {results.length === 0 && query && !loading && (
                        <div className="p-12 text-center text-slate-500">
                            <Command className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No results found for "{query}"</p>
                        </div>
                    )}

                    {results.length === 0 && !query && (
                        <div className="p-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-3">Recent / Suggested</p>
                            {staticItems.slice(0, 4).map((item, idx) => (
                                <div
                                    key={item.id}
                                    onClick={() => { item.action(); toggleSearch(false); }}
                                    className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                                >
                                    <div className={`p-2 rounded-lg ${idx === selectedIndex ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
                                        {item.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className={`text-sm font-semibold ${idx === selectedIndex ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-900 dark:text-white'}`}>{item.title}</h4>
                                        <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="space-y-1">
                            {results.map((item, idx) => (
                                <div
                                    key={item.id}
                                    onClick={() => { item.action(); toggleSearch(false); }}
                                    className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors group ${idx === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-500/10 shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                                >
                                    <div className={`p-2 rounded-lg transition-colors ${idx === selectedIndex ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 group-hover:bg-white dark:group-hover:bg-zinc-700'}`}>
                                        {item.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className={`text-sm font-semibold ${idx === selectedIndex ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-900 dark:text-white'}`}>{item.title}</h4>
                                        <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                                    </div>
                                    {idx === selectedIndex && <ArrowRight className="w-4 h-4 text-indigo-400 animate-pulse" />}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-zinc-950/50 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    <span>Global Command Center</span>
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><kbd className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1 min-w-[1.2em] text-center">⇅</kbd> Navigate</span>
                        <span className="flex items-center gap-1"><kbd className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1 min-w-[1.2em] text-center">↵</kbd> Select</span>
                    </div>
                </div>

            </div>
        </div>
    );
};
