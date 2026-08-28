import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Modal } from '../../ui/Modal';
import { 
    Plus, Search, Edit3, Trash2, Loader, ChevronRight, 
    BookOpen, Layers, FolderTree, Tag, ShoppingCart, 
    TrendingUp, TrendingDown, DollarSign, Briefcase, 
    FileText, Calendar, Clock, Sliders, ShieldCheck, 
    Coins, Percent, Eye
} from 'lucide-react';

interface FieldConfig {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'date';
    required?: boolean;
    optionsSource?: string; // e.g. 'groups', 'accounts', 'currencies', 'fiscal_years'
    options?: { label: string; value: any }[]; // static options
    fixedValue?: any;
}

interface ColumnConfig {
    key: string;
    label: string;
}

interface MasterConfig {
    id: string;
    tableName: string;
    displayName: string;
    description: string;
    icon: any;
    filterField?: string;
    filterValue?: string;
    fields: FieldConfig[];
    columns: ColumnConfig[];
}

export const AccountingMasters: React.FC = () => {
    const { currentCompanyId } = useAuth();
    
    // Tab State
    const [activeTab, setActiveTab] = useState<string>('COA');
    const [search, setSearch] = useState<string>('');
    
    // Data List States
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    
    // Modal & Edit States
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [formState, setFormState] = useState<Record<string, any>>({});
    const [actionLoading, setActionLoading] = useState<boolean>(false);

    // Dynamic Select Options States
    const [accountGroups, setAccountGroups] = useState<any[]>([]);
    const [coaAccounts, setCoaAccounts] = useState<any[]>([]);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [fiscalYears, setFiscalYears] = useState<any[]>([]);
    const [costCenters, setCostCenters] = useState<any[]>([]);

    // 16 Master Configurations Mapping
    const MASTER_CONFIGS: Record<string, MasterConfig> = useMemo(() => ({
        'COA': {
            id: 'COA',
            tableName: 'accounting_chart_of_accounts',
            displayName: 'Chart of Accounts',
            description: 'Define and manage your general ledger accounts.',
            icon: BookOpen,
            fields: [
                { key: 'code', label: 'Account Code *', type: 'text', required: true },
                { key: 'name', label: 'Account Name *', type: 'text', required: true },
                { 
                    key: 'type', label: 'Type *', type: 'select', required: true,
                    options: [
                        { label: 'Asset', value: 'Asset' },
                        { label: 'Liability', value: 'Liability' },
                        { label: 'Equity', value: 'Equity' },
                        { label: 'Income', value: 'Income' },
                        { label: 'Expense', value: 'Expense' }
                    ]
                },
                { 
                    key: 'subtype', label: 'Subtype', type: 'select',
                    options: [
                        { label: 'Receivable', value: 'Receivable' },
                        { label: 'Payable', value: 'Payable' },
                        { label: 'Bank', value: 'Bank' },
                        { label: 'Cash', value: 'Cash' },
                        { label: 'COGS', value: 'COGS' },
                        { label: 'Revenue', value: 'Revenue' },
                        { label: 'Other', value: 'Other' }
                    ]
                },
                { key: 'account_group_id', label: 'Account Group', type: 'select', optionsSource: 'groups' },
                { key: 'currency_id', label: 'Default Currency', type: 'select', optionsSource: 'currencies' },
                { key: 'is_reconcilable', label: 'Reconcilable (Allow Payments Match)', type: 'boolean' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Account Name' },
                { key: 'type', label: 'Type' },
                { key: 'subtype', label: 'Subtype' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'GROUPS': {
            id: 'GROUPS',
            tableName: 'accounting_account_groups',
            displayName: 'Account Groups',
            description: 'Group accounts into hierarchies for balance sheets and P&L structures.',
            icon: Layers,
            fields: [
                { key: 'name', label: 'Group Name *', type: 'text', required: true },
                { key: 'code_prefix_start', label: 'Code Prefix Start', type: 'text' },
                { key: 'code_prefix_end', label: 'Code Prefix End', type: 'text' },
                { 
                    key: 'type', label: 'Type *', type: 'select', required: true,
                    options: [
                        { label: 'Asset', value: 'Asset' },
                        { label: 'Liability', value: 'Liability' },
                        { label: 'Equity', value: 'Equity' },
                        { label: 'Income', value: 'Income' },
                        { label: 'Expense', value: 'Expense' }
                    ]
                },
                { key: 'parent_id', label: 'Parent Group', type: 'select', optionsSource: 'groups' }
            ],
            columns: [
                { key: 'name', label: 'Group Name' },
                { key: 'type', label: 'Type' },
                { key: 'code_prefix_start', label: 'Prefix Start' },
                { key: 'code_prefix_end', label: 'Prefix End' }
            ]
        },
        'STOCK_CATEGORIES': {
            id: 'STOCK_CATEGORIES',
            tableName: 'accounting_stock_categories',
            displayName: 'Stock Categories',
            description: 'Link inventory categories to asset, purchase, and adjustment accounts.',
            icon: Tag,
            fields: [
                { key: 'name', label: 'Stock Category Name *', type: 'text', required: true },
                { key: 'item_category', label: 'Inventory Item Category *', type: 'text', required: true },
                { key: 'asset_account_id', label: 'Asset Account *', type: 'select', required: true, optionsSource: 'accounts' },
                { key: 'cogs_account_id', label: 'COGS/Purchase Account *', type: 'select', required: true, optionsSource: 'accounts' },
                { key: 'adjustment_account_id', label: 'Stock Adjustment Account *', type: 'select', required: true, optionsSource: 'accounts' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'name', label: 'Category Name' },
                { key: 'item_category', label: 'Item Category' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'PURCHASE_LEDGERS': {
            id: 'PURCHASE_LEDGERS',
            tableName: 'accounting_purchase_ledgers',
            displayName: 'Purchase Ledgers',
            description: 'Link item purchases and vendor bills to designated purchase ledger accounts.',
            icon: ShoppingCart,
            fields: [
                { key: 'name', label: 'Purchase Ledger Name *', type: 'text', required: true },
                { key: 'account_id', label: 'Linked COA Account *', type: 'select', required: true, optionsSource: 'accounts' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'name', label: 'Purchase Ledger Name' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'SALES_LEDGERS': {
            id: 'SALES_LEDGERS',
            tableName: 'accounting_sales_ledgers',
            displayName: 'Sales Ledgers',
            description: 'Configure trading incomes, discounts, and manpower contract revenue ledgers.',
            icon: TrendingUp,
            fields: [
                { key: 'name', label: 'Sales Ledger Name *', type: 'text', required: true },
                { key: 'account_id', label: 'Linked COA Account *', type: 'select', required: true, optionsSource: 'accounts' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'name', label: 'Sales Ledger Name' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'DIRECT_EXPENSES': {
            id: 'DIRECT_EXPENSES',
            tableName: 'accounting_direct_expense_ledgers',
            displayName: 'Direct Expense Ledgers',
            description: 'Manage cost of sales (COS) packaging, logistics, and employee benefit expense mappings.',
            icon: TrendingDown,
            fields: [
                { key: 'name', label: 'Direct Expense Ledger Name *', type: 'text', required: true },
                { key: 'account_id', label: 'Linked COA Account *', type: 'select', required: true, optionsSource: 'accounts' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'name', label: 'Direct Expense Ledger Name' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'INDIRECT_INCOMES': {
            id: 'INDIRECT_INCOMES',
            tableName: 'accounting_indirect_income_ledgers',
            displayName: 'Indirect Income Ledgers',
            description: 'Seed exchange gains, interest, and rental indirect income ledger mappings.',
            icon: Coins,
            fields: [
                { key: 'name', label: 'Indirect Income Name *', type: 'text', required: true },
                { key: 'account_id', label: 'Linked COA Account *', type: 'select', required: true, optionsSource: 'accounts' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'name', label: 'Indirect Income Name' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'COST_CENTERS': {
            id: 'COST_CENTERS',
            tableName: 'accounting_cost_centers',
            displayName: 'Cost Centers (Generic)',
            description: 'Cost centers for tracking organizational expenses.',
            icon: FolderTree,
            filterField: 'type',
            filterValue: 'GENERIC',
            fields: [
                { key: 'code', label: 'Cost Center Code *', type: 'text', required: true },
                { key: 'name', label: 'Cost Center Name *', type: 'text', required: true },
                { key: 'type', label: 'Type', type: 'text', fixedValue: 'GENERIC' },
                { key: 'parent_id', label: 'Parent Cost Center', type: 'select', optionsSource: 'cost_centers' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Name' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'PROJECT_COST_CENTERS': {
            id: 'PROJECT_COST_CENTERS',
            tableName: 'accounting_cost_centers',
            displayName: 'Project Cost Centers',
            description: 'Project cost centers for allocating contract/QP project values.',
            icon: Briefcase,
            filterField: 'type',
            filterValue: 'PROJECT',
            fields: [
                { key: 'code', label: 'Project Code *', type: 'text', required: true },
                { key: 'name', label: 'Project Name *', type: 'text', required: true },
                { key: 'type', label: 'Type', type: 'text', fixedValue: 'PROJECT' },
                { key: 'parent_id', label: 'Parent Project Cost Center', type: 'select', optionsSource: 'cost_centers' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'code', label: 'Project Code' },
                { key: 'name', label: 'Project Name' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'CONTRACT_COST_CENTERS': {
            id: 'CONTRACT_COST_CENTERS',
            tableName: 'accounting_cost_centers',
            displayName: 'Contract Cost Centers',
            description: 'Manpower deputation contract cost centers.',
            icon: FileText,
            filterField: 'type',
            filterValue: 'CONTRACT',
            fields: [
                { key: 'code', label: 'Contract Code *', type: 'text', required: true },
                { key: 'name', label: 'Contract/Client Name *', type: 'text', required: true },
                { key: 'type', label: 'Type', type: 'text', fixedValue: 'CONTRACT' },
                { key: 'parent_id', label: 'Parent Contract Cost Center', type: 'select', optionsSource: 'cost_centers' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'code', label: 'Contract Code' },
                { key: 'name', label: 'Contract Name' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'FISCAL_YEARS': {
            id: 'FISCAL_YEARS',
            tableName: 'accounting_fiscal_years',
            displayName: 'Fiscal Years',
            description: 'Set up isolated accounting fiscal years.',
            icon: Calendar,
            fields: [
                { key: 'name', label: 'Fiscal Year Name *', type: 'text', required: true },
                { key: 'start_date', label: 'Start Date *', type: 'date', required: true },
                { key: 'end_date', label: 'End Date *', type: 'date', required: true },
                { key: 'is_closed', label: 'Closed', type: 'boolean' }
            ],
            columns: [
                { key: 'name', label: 'Fiscal Year' },
                { key: 'start_date', label: 'Start Date' },
                { key: 'end_date', label: 'End Date' },
                { key: 'is_closed', label: 'Status' }
            ]
        },
        'PERIODS': {
            id: 'PERIODS',
            tableName: 'accounting_periods',
            displayName: 'Accounting Periods',
            description: 'Define monthly lock and transaction periods for fiscal years.',
            icon: Clock,
            fields: [
                { key: 'name', label: 'Period Name *', type: 'text', required: true },
                { key: 'code', label: 'Period Code *', type: 'text', required: true },
                { key: 'start_date', label: 'Start Date *', type: 'date', required: true },
                { key: 'end_date', label: 'End Date *', type: 'date', required: true },
                { 
                    key: 'status', label: 'Status *', type: 'select', required: true,
                    options: [
                        { label: 'Open', value: 'Open' },
                        { label: 'Closed', value: 'Closed' },
                        { label: 'Locked', value: 'Locked' }
                    ]
                },
                { key: 'accounting_fiscal_year_id', label: 'Accounting Fiscal Year *', type: 'select', required: true, optionsSource: 'fiscal_years' }
            ],
            columns: [
                { key: 'name', label: 'Period' },
                { key: 'code', label: 'Code' },
                { key: 'start_date', label: 'Start Date' },
                { key: 'end_date', label: 'End Date' },
                { key: 'status', label: 'Status' }
            ]
        },
        'JOURNALS': {
            id: 'JOURNALS',
            tableName: 'accounting_journals',
            displayName: 'Journals',
            description: 'Sales, purchases, banking, and general entries journals.',
            icon: Sliders,
            fields: [
                { key: 'name', label: 'Journal Name *', type: 'text', required: true },
                { key: 'code', label: 'Journal Code *', type: 'text', required: true },
                { 
                    key: 'type', label: 'Journal Type *', type: 'select', required: true,
                    options: [
                        { label: 'Sale', value: 'Sale' },
                        { label: 'Purchase', value: 'Purchase' },
                        { label: 'Cash', value: 'Cash' },
                        { label: 'Bank', value: 'Bank' },
                        { label: 'General', value: 'General' }
                    ]
                },
                { key: 'default_account_id', label: 'Default account', type: 'select', optionsSource: 'accounts' },
                { key: 'sequence_prefix', label: 'Sequence Prefix', type: 'text' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'name', label: 'Journal Name' },
                { key: 'code', label: 'Code' },
                { key: 'type', label: 'Type' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'TAXES': {
            id: 'TAXES',
            tableName: 'accounting_taxes',
            displayName: 'Taxes',
            description: 'Set up percentage or fixed taxes.',
            icon: Percent,
            fields: [
                { key: 'name', label: 'Tax Name *', type: 'text', required: true },
                { 
                    key: 'type', label: 'Tax Computation *', type: 'select', required: true,
                    options: [
                        { label: 'Percent', value: 'Percent' },
                        { label: 'Fixed', value: 'Fixed' }
                    ]
                },
                { 
                    key: 'scope', label: 'Tax Scope *', type: 'select', required: true,
                    options: [
                        { label: 'Sales', value: 'Sales' },
                        { label: 'Purchase', value: 'Purchase' },
                        { label: 'None', value: 'None' }
                    ]
                },
                { key: 'amount', label: 'Tax Amount/Rate *', type: 'number', required: true },
                { key: 'account_id', label: 'Tax Account', type: 'select', optionsSource: 'accounts' },
                { key: 'refund_account_id', label: 'Refund Tax Account', type: 'select', optionsSource: 'accounts' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'name', label: 'Tax Name' },
                { key: 'type', label: 'Type' },
                { key: 'amount', label: 'Rate' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'PAYMENT_TERMS': {
            id: 'PAYMENT_TERMS',
            tableName: 'accounting_payment_terms',
            displayName: 'Payment Terms',
            description: 'Configure standard payment schedules (e.g. Net 30, Net 45).',
            icon: ShieldCheck,
            fields: [
                { key: 'name', label: 'Payment Term Title *', type: 'text', required: true },
                { key: 'days', label: 'Due Days *', type: 'number', required: true },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'name', label: 'Term Title' },
                { key: 'days', label: 'Days' },
                { key: 'is_active', label: 'Status' }
            ]
        },
        'CURRENCIES': {
            id: 'CURRENCIES',
            tableName: 'financial_masters_currencies',
            displayName: 'Currencies',
            description: 'Manage active system currencies and symbols.',
            icon: Coins,
            fields: [
                { key: 'code', label: 'Currency Code *', type: 'text', required: true },
                { key: 'name', label: 'Currency Name *', type: 'text', required: true },
                { key: 'symbol', label: 'Symbol', type: 'text' },
                { key: 'is_active', label: 'Active', type: 'boolean' }
            ],
            columns: [
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Name' },
                { key: 'symbol', label: 'Symbol' },
                { key: 'is_active', label: 'Status' }
            ]
        }
    }), [currentCompanyId]);

    const activeConfig = MASTER_CONFIGS[activeTab];

    // Load Data
    const fetchItems = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            let query = (supabase as any).from(activeConfig.tableName).select('*').eq('company_id', currentCompanyId);
            if (activeConfig.filterField && activeConfig.filterValue) {
                query = query.eq(activeConfig.filterField, activeConfig.filterValue);
            }
            
            // Sort COA by code, others by name or created_at
            if (activeConfig.id === 'COA') {
                query = query.order('code');
            } else if (activeConfig.id === 'FISCAL_YEARS') {
                query = query.order('start_date', { ascending: false });
            } else if (activeConfig.id === 'CURRENCIES') {
                query = query.order('code');
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query;
            if (error) throw error;
            setItems(data || []);
        } catch (err: any) {
            console.error('Error fetching masters:', err.message);
        } finally {
            setLoading(false);
        }
    };

    // Load Dynamic Dropdown Selections
    const loadDynamicOptions = async () => {
        if (!currentCompanyId) return;
        try {
            // Load Groups
            const { data: groups } = await supabase.from('accounting_account_groups').select('id, name').eq('company_id', currentCompanyId);
            setAccountGroups(groups || []);

            // Load Accounts (Active Posting accounts only)
            const { data: accounts } = await supabase.from('accounting_chart_of_accounts').select('id, name, code, is_group, is_active').eq('company_id', currentCompanyId).eq('is_active', true).eq('is_group', false).order('code');
            setCoaAccounts((accounts || []).filter((a: any) => !a.is_group && a.is_active !== false));

            // Load Currencies
            const { data: cur } = await supabase.from('financial_masters_currencies').select('id, name, code').eq('company_id', currentCompanyId);
            setCurrencies(cur || []);

            // Load Fiscal Years
            const { data: fy } = await supabase.from('accounting_fiscal_years').select('id, name').eq('company_id', currentCompanyId);
            setFiscalYears(fy || []);

            // Load Cost Centers
            const { data: cc } = await supabase.from('accounting_cost_centers').select('id, name, code').eq('company_id', currentCompanyId);
            setCostCenters(cc || []);
        } catch (e) {
            console.error('Failed to load selector options', e);
        }
    };

    useEffect(() => {
        fetchItems();
        loadDynamicOptions();
    }, [activeTab, currentCompanyId]);

    // Search Filter
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const s = search.toLowerCase();
            return (
                (item.name && item.name.toLowerCase().includes(s)) ||
                (item.code && item.code.toLowerCase().includes(s)) ||
                (item.item_category && item.item_category.toLowerCase().includes(s)) ||
                (item.code_prefix_start && item.code_prefix_start.toLowerCase().includes(s))
            );
        });
    }, [items, search]);

    // Form Handlers
    const openAdd = () => {
        setEditingItem(null);
        const initialForm: Record<string, any> = {};
        activeConfig.fields.forEach(f => {
            if (f.fixedValue !== undefined) {
                initialForm[f.key] = f.fixedValue;
            } else if (f.type === 'boolean') {
                initialForm[f.key] = true;
            } else {
                initialForm[f.key] = '';
            }
        });
        setFormState(initialForm);
        setIsModalOpen(true);
    };

    const openEdit = (item: any) => {
        setEditingItem(item);
        const editForm: Record<string, any> = {};
        activeConfig.fields.forEach(f => {
            editForm[f.key] = item[f.key] !== null && item[f.key] !== undefined ? item[f.key] : '';
        });
        setFormState(editForm);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const payload: Record<string, any> = { ...formState, company_id: currentCompanyId };
            
            // Clean up empty selects
            Object.keys(payload).forEach(k => {
                if (payload[k] === '') payload[k] = null;
            });

            if (editingItem) {
                const { error } = await (supabase as any)
                    .from(activeConfig.tableName)
                    .update(payload)
                    .eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any)
                    .from(activeConfig.tableName)
                    .insert([payload]);
                if (error) throw error;
            }
            setIsModalOpen(false);
            fetchItems();
            loadDynamicOptions(); // Refresh options
        } catch (err: any) {
            alert('Error saving record: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this master record?')) return;
        try {
            const { error } = await (supabase as any).from(activeConfig.tableName).delete().eq('id', id);
            if (error) throw error;
            fetchItems();
            loadDynamicOptions();
        } catch (err: any) {
            alert('Cannot delete: ' + err.message);
        }
    };

    // Helper: get options list for dynamic sources
    const getOptionsForSource = (source?: string) => {
        switch (source) {
            case 'groups':
                return accountGroups.map(g => ({ label: g.name, value: g.id }));
            case 'accounts':
                return coaAccounts.map(a => ({ label: `[${a.code}] ${a.name}`, value: a.id }));
            case 'currencies':
                return currencies.map(c => ({ label: `[${c.code}] ${c.name}`, value: c.id }));
            case 'fiscal_years':
                return fiscalYears.map(fy => ({ label: fy.name, value: fy.id }));
            case 'cost_centers':
                return costCenters.map(cc => ({ label: `[${cc.code}] ${cc.name}`, value: cc.id }));
            default:
                return [];
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50/50 dark:bg-zinc-950/20">
            {/* Header */}
            <div className="p-8 border-b border-slate-200/60 dark:border-zinc-800 flex justify-between items-center bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Sliders className="w-8 h-8 text-violet-600" /> Accounting Masters
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1.5">Manage the client profit &amp; loss ledgers, cost centers, and categories.</p>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar Menu */}
                <div className="w-80 border-r border-slate-200/60 dark:border-zinc-800 bg-white/30 dark:bg-zinc-900/30 overflow-y-auto p-4 space-y-1.5">
                    {Object.values(MASTER_CONFIGS).map(config => {
                        const Icon = config.icon;
                        const isActive = activeTab === config.id;
                        return (
                            <button
                                key={config.id}
                                onClick={() => { setActiveTab(config.id); setSearch(''); }}
                                className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-all font-bold text-sm text-left active:scale-[0.98] ${
                                    isActive 
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/10' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/40'
                                }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 dark:text-zinc-500'}`} />
                                <span className="flex-1 truncate">{config.displayName}</span>
                                <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'rotate-90 text-white' : 'text-slate-300 dark:text-zinc-600'}`} />
                            </button>
                        );
                    })}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white/20 dark:bg-zinc-900/10">
                    <div className="p-6 border-b border-slate-200/50 dark:border-zinc-800/60 flex items-center justify-between gap-4 flex-shrink-0">
                        {/* Search */}
                        <div className="relative max-w-md flex-1">
                            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder={`Search ${activeConfig.displayName}...`}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white/70 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700/80 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none transition-all font-semibold"
                            />
                        </div>

                        {/* Add Action */}
                        <button
                            onClick={openAdd}
                            className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-violet-500/20 active:scale-95 transition-all flex-shrink-0"
                        >
                            <Plus className="w-4 h-4" /> Add Record
                        </button>
                    </div>

                    {/* Data List */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader className="w-8 h-8 text-violet-600 animate-spin" />
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="text-center py-20 bg-white/50 dark:bg-zinc-900/40 rounded-3xl border border-dashed border-slate-300 dark:border-zinc-800">
                                <Search className="w-12 h-12 text-slate-300 dark:text-zinc-700 mx-auto mb-4" />
                                <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-lg">No Records Found</h3>
                                <p className="text-slate-400 dark:text-zinc-500 text-sm mt-1">Create a new record or modify your search term.</p>
                            </div>
                        ) : (
                            <div className="bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-zinc-800/50 shadow-sm overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-zinc-800/40 border-b border-slate-200/50 dark:border-zinc-800/60">
                                            {activeConfig.columns.map(col => (
                                                <th key={col.key} className="px-6 py-4.5 text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">{col.label}</th>
                                            ))}
                                            <th className="px-6 py-4.5 text-right text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                        {filteredItems.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                                {activeConfig.columns.map(col => {
                                                    let val = item[col.key];
                                                    
                                                    // Handle Status rendering
                                                    if (col.key === 'is_active' || col.key === 'is_closed') {
                                                        const isTrue = val === true;
                                                        const label = col.key === 'is_closed' 
                                                            ? (isTrue ? 'Closed' : 'Active') 
                                                            : (isTrue ? 'Active' : 'Inactive');
                                                        const color = isTrue 
                                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400';
                                                        return (
                                                            <td key={col.key} className="px-6 py-4 font-semibold text-sm">
                                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>
                                                                    {label}
                                                                </span>
                                                            </td>
                                                        );
                                                    }
                                                    
                                                    return (
                                                        <td key={col.key} className="px-6 py-4 font-medium text-slate-800 dark:text-zinc-200 text-sm truncate max-w-xs">
                                                            {val !== null && val !== undefined ? String(val) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => openEdit(item)}
                                                        className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-xl transition-all"
                                                    >
                                                        <Edit3 className="w-4.5 h-4.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                                                    >
                                                        <Trash2 className="w-4.5 h-4.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* CRUD Edit/Add Modal */}
            {isModalOpen && (
                <Modal
                    title={editingItem ? `Edit ${activeConfig.displayName}` : `Add New ${activeConfig.displayName}`}
                    onClose={() => setIsModalOpen(false)}
                    maxWidth="max-w-lg"
                >
                    <form onSubmit={handleSave} className="space-y-5">
                        {activeConfig.fields.map(f => {
                            if (f.fixedValue !== undefined) return null; // Skip fixed fields in UI

                            return (
                                <div key={f.key}>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                                        {f.label}
                                    </label>
                                    
                                    {f.type === 'select' ? (
                                        <select
                                            value={formState[f.key] || ''}
                                            required={f.required}
                                            onChange={e => setFormState(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            className="w-full p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700/80 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none transition-all font-semibold text-sm"
                                        >
                                            <option value="">Select Option</option>
                                            {f.optionsSource 
                                                ? getOptionsForSource(f.optionsSource).map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                  ))
                                                : f.options?.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                  ))
                                            }
                                        </select>
                                    ) : f.type === 'boolean' ? (
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!!formState[f.key]}
                                                onChange={e => setFormState(prev => ({ ...prev, [f.key]: e.target.checked }))}
                                                className="w-5 h-5 text-violet-600 bg-slate-50 border-slate-300 rounded focus:ring-violet-500"
                                            />
                                            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Yes, Enabled</span>
                                        </label>
                                    ) : f.type === 'textarea' ? (
                                        <textarea
                                            value={formState[f.key] || ''}
                                            required={f.required}
                                            onChange={e => setFormState(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            rows={3}
                                            className="w-full p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700/80 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none transition-all font-semibold text-sm"
                                        />
                                    ) : (
                                        <input
                                            type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                                            value={formState[f.key] || ''}
                                            required={f.required}
                                            onChange={e => setFormState(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            step={f.type === 'number' ? 'any' : undefined}
                                            className="w-full p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700/80 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none transition-all font-semibold text-sm"
                                        />
                                    )}
                                </div>
                            );
                        })}
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-3 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={actionLoading}
                                className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center gap-2"
                            >
                                {actionLoading && <Loader className="w-4 h-4 animate-spin" />}
                                Save Record
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
