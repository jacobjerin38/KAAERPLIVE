import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Share2, Plus, Trash2 } from 'lucide-react';

interface CandidateSourcesSettingsProps {
  companyId: string;
}

export const CandidateSourcesSettings: React.FC<CandidateSourcesSettingsProps> = ({ companyId }) => {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', channel_type: 'JOB_BOARD' });

  const fetchSources = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recruitment_sources')
        .select('*')
        .eq('company_id', companyId)
        .order('name', { ascending: true });

      if (error) throw error;
      setSources(data || []);
    } catch (err: any) {
      console.error('Error fetching sources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchSources();
  }, [companyId]);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource.name.trim()) return;

    try {
      const { error } = await supabase
        .from('recruitment_sources')
        .insert({
          company_id: companyId,
          name: newSource.name.trim(),
          channel_type: newSource.channel_type,
          is_active: true
        });

      if (error) throw error;
      setNewSource({ name: '', channel_type: 'JOB_BOARD' });
      setIsAdding(false);
      fetchSources();
    } catch (err: any) {
      alert('Error adding source: ' + err.message);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Are you sure you want to remove this source?')) return;
    try {
      const { error } = await supabase
        .from('recruitment_sources')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchSources();
    } catch (err: any) {
      alert('Error deleting source: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-amber-500" />
            Candidate Acquisition Sources Master
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Channels used to source applicants (Portals, Job Boards, Employee Referrals, Agencies).
          </p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add Source
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddSource} className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Source Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Bayt.com"
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Channel Type</label>
              <select
                value={newSource.channel_type}
                onChange={(e) => setNewSource({ ...newSource, channel_type: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              >
                <option value="PORTAL">Internal Careers Portal</option>
                <option value="JOB_BOARD">Job Board (LinkedIn, Indeed, etc.)</option>
                <option value="REFERRAL">Employee Referral</option>
                <option value="AGENCY">Recruitment Agency</option>
                <option value="CAMPUS">Campus / University</option>
                <option value="DIRECT">Direct / Walk-in</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm"
            >
              Save Source
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/70 dark:bg-zinc-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-800">
              <th className="p-3">Source Name</th>
              <th className="p-3">Channel Type</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {sources.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition">
                <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                  {s.name}
                </td>
                <td className="p-3 text-slate-500 font-medium">
                  {s.channel_type}
                </td>
                <td className="p-3 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Active
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleDeleteSource(s.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition"
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
  );
};
