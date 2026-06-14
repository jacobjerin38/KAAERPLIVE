import React, { useState } from 'react';
import { 
  Megaphone, Users, DollarSign, Target, Plus, Search, 
  ChevronRight, Calendar, TrendingUp, CheckCircle, Clock, X 
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: 'Active' | 'Completed' | 'Planned';
  budget: number;
  leads: number;
  clicks: number;
  startDate: string;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  source: string;
  date: string;
}

const INITIAL_CAMPAIGNS: Campaign[] = [
  { id: '1', name: 'Summer Sales Newsletter 2026', status: 'Active', budget: 5000, leads: 320, clicks: 1200, startDate: '2026-06-01' },
  { id: '2', name: 'Google Search Ads - ERP Solutions', status: 'Active', budget: 15000, leads: 680, clicks: 3400, startDate: '2026-05-15' },
  { id: '3', name: 'LinkedIn Professional Outreach', status: 'Planned', budget: 8000, leads: 0, clicks: 0, startDate: '2026-07-01' },
  { id: '4', name: 'Q1 Review Retargeting Campaign', status: 'Completed', budget: 3000, leads: 240, clicks: 980, startDate: '2026-03-01' },
];

const INITIAL_LEADS: Lead[] = [
  { id: '1', name: 'John Doe', email: 'john.doe@enterprise.qa', source: 'Google Ads', date: '2026-06-12' },
  { id: '2', name: 'Sarah Smith', email: 'sarah.s@techcorp.qa', source: 'LinkedIn', date: '2026-06-11' },
  { id: '3', name: 'Ahmad Al-Thani', email: 'ahmad@althanigroup.com', source: 'Newsletter', date: '2026-06-10' },
  { id: '4', name: 'Michael Chang', email: 'm.chang@asiapacific.qa', source: 'Google Ads', date: '2026-06-09' },
  { id: '5', name: 'Fatima Al-Jaber', email: 'fatima@jaberholdings.com', source: 'Organic Search', date: '2026-06-08' },
];

export const MarketingHub: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'leads'>('campaigns');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignBudget, setNewCampaignBudget] = useState('');
  const [newCampaignStatus, setNewCampaignStatus] = useState<'Active' | 'Completed' | 'Planned'>('Planned');
  const [newCampaignStart, setNewCampaignStart] = useState('');

  const handleAddCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName || !newCampaignBudget) return;

    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: newCampaignName,
      status: newCampaignStatus,
      budget: parseFloat(newCampaignBudget) || 0,
      leads: 0,
      clicks: 0,
      startDate: newCampaignStart || new Date().toISOString().split('T')[0]
    };

    setCampaigns([newCampaign, ...campaigns]);
    setShowAddModal(false);
    
    // Reset Form
    setNewCampaignName('');
    setNewCampaignBudget('');
    setNewCampaignStatus('Planned');
    setNewCampaignStart('');
  };

  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + c.leads, 0) + leads.length;
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const avgConversion = totalClicks > 0 ? ((totalLeads / totalClicks) * 100).toFixed(1) : '0.0';

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 h-full flex flex-col animate-page-enter bg-slate-50 dark:bg-zinc-950 overflow-y-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl shadow-lg shadow-orange-500/20 text-white">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Marketing Portal</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                Design campaigns, manage budgets, and trace generated sales leads
              </p>
            </div>
          </div>
        </div>

        {activeTab === 'campaigns' && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 bg-orange-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-orange-500/30 hover:bg-orange-700 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4 text-white" /> Create Campaign
          </button>
        )}
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 shrink-0">
        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-lg shadow-slate-200/50 dark:shadow-black/20 flex items-center justify-between">
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Campaigns</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{campaigns.length}</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> +1 planned next month
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400">
            <Megaphone className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-lg shadow-slate-200/50 dark:shadow-black/20 flex items-center justify-between">
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Budget</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">QAR {totalBudget.toLocaleString()}</h3>
            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1">
              Across all platforms
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-lg shadow-slate-200/50 dark:shadow-black/20 flex items-center justify-between">
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Leads Acquired</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{totalLeads.toLocaleString()}</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> +18% growth this week
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-lg shadow-slate-200/50 dark:shadow-black/20 flex items-center justify-between">
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Conversion Rate</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{avgConversion}%</h3>
            <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 mt-1">
              Avg. from campaign clicks
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
            <Target className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-slate-100 dark:border-zinc-850 shrink-0">
        <button 
          onClick={() => { setActiveTab('campaigns'); setSearchQuery(''); }}
          className={`pb-4 text-sm font-bold tracking-tight transition-all relative ${activeTab === 'campaigns' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Marketing Campaigns
          {activeTab === 'campaigns' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-full" />}
        </button>
        <button 
          onClick={() => { setActiveTab('leads'); setSearchQuery(''); }}
          className={`pb-4 text-sm font-bold tracking-tight transition-all relative ${activeTab === 'leads' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Leads Generated ({leads.length})
          {activeTab === 'leads' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-full" />}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="relative mb-6 shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={activeTab === 'campaigns' ? "Search campaigns by name or status..." : "Search leads by name, email, or source..."}
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-orange-500/20 transition-all shadow-sm"
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'campaigns' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
            {filteredCampaigns.map(c => (
              <div 
                key={c.id}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 hover:shadow-xl hover:shadow-orange-500/5 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      c.status === 'Active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                      c.status === 'Completed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                      'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    }`}>
                      {c.status}
                    </span>
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {c.startDate}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 group-hover:text-orange-600 transition-colors text-lg">
                    {c.name}
                  </h3>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Budget</span>
                    <span className="text-slate-800 dark:text-slate-200">QAR {c.budget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Clicks / Leads</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {c.clicks.toLocaleString()} / <span className="text-emerald-600">{c.leads.toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {filteredCampaigns.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <p className="text-slate-400">No campaigns found matching your query.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm mb-10">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-850/50">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Acquisition Source</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Acquired</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(l => (
                    <tr key={l.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/50 dark:hover:bg-zinc-850/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200">{l.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{l.email}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                          {l.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">{l.date}</td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No leads found matching query.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Campaign Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Create New Campaign</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCampaign} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Campaign Name</label>
                <input 
                  type="text" 
                  required
                  value={newCampaignName}
                  onChange={e => setNewCampaignName(e.target.value)}
                  placeholder="e.g. Back to School Discounts"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium text-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Budget (QAR)</label>
                  <input 
                    type="number" 
                    required
                    value={newCampaignBudget}
                    onChange={e => setNewCampaignBudget(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Start Date</label>
                  <input 
                    type="date" 
                    value={newCampaignStart}
                    onChange={e => setNewCampaignStart(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Initial Status</label>
                <select 
                  value={newCampaignStatus}
                  onChange={e => setNewCampaignStatus(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium text-slate-800 dark:text-white"
                >
                  <option value="Planned">Planned</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-100 hover:text-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition-all shadow-lg shadow-orange-500/20"
                >
                  Add Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
