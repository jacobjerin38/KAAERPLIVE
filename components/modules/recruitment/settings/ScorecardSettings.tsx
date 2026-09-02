import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Award, Plus, Trash2, Check } from 'lucide-react';

interface ScorecardSettingsProps {
  companyId: string;
}

export const ScorecardSettings: React.FC<ScorecardSettingsProps> = ({ companyId }) => {
  const [scorecards, setScorecards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newCard, setNewCard] = useState({
    name: '',
    criteria: [
      { category: 'Technical Competence', weight: 40, description: 'Core functional depth and problem solving' },
      { category: 'Communication', weight: 20, description: 'Articulacy and stakeholder presentation' },
      { category: 'Experience Fit', weight: 25, description: 'Relevant industry track record' },
      { category: 'Culture & Attitude', weight: 15, description: 'Team fit, dependability, and work ethic' }
    ]
  });

  const fetchScorecards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recruitment_scorecards')
        .select('*')
        .eq('company_id', companyId);

      if (error) throw error;
      setScorecards(data || []);
    } catch (err: any) {
      console.error('Error fetching scorecards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchScorecards();
  }, [companyId]);

  const handleSaveScorecard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.name.trim()) return;

    try {
      const { error } = await supabase
        .from('recruitment_scorecards')
        .insert({
          company_id: companyId,
          name: newCard.name.trim(),
          criteria: newCard.criteria,
          is_active: true
        });

      if (error) throw error;
      setNewCard({
        name: '',
        criteria: [
          { category: 'Technical Competence', weight: 40, description: 'Core functional depth and problem solving' },
          { category: 'Communication', weight: 20, description: 'Articulacy and stakeholder presentation' },
          { category: 'Experience Fit', weight: 25, description: 'Relevant industry track record' },
          { category: 'Culture & Attitude', weight: 15, description: 'Team fit, dependability, and work ethic' }
        ]
      });
      setIsAdding(false);
      fetchScorecards();
    } catch (err: any) {
      alert('Error saving scorecard: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Interview Evaluation Scorecard Templates
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define weighted evaluation criteria and structured scoring rubrics for interview panels.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> New Scorecard Template
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSaveScorecard} className="p-5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Template Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Senior Technical & Project Engineering"
              value={newCard.name}
              onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs font-bold"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Rubric Categories & Weights (Total must equal 100%)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {newCard.criteria.map((c, idx) => (
                <div key={idx} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs space-y-1">
                  <div className="font-bold flex justify-between">
                    <span>{c.category}</span>
                    <span className="text-amber-600 font-mono">{c.weight}%</span>
                  </div>
                  <div className="text-[10px] text-slate-400">{c.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm"
            >
              Create Scorecard
            </button>
          </div>
        </form>
      )}

      {/* Grid of Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scorecards.map((sc) => (
          <div key={sc.id} className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{sc.name}</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Active
              </span>
            </div>

            <div className="space-y-1.5">
              {(sc.criteria || []).map((crit: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{crit.category}</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{crit.weight}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
