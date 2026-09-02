import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Tag, Plus, Trash2, Edit2, Check, X, Layers } from 'lucide-react';

interface SkillsMasterSettingsProps {
  companyId: string;
}

export const SkillsMasterSettings: React.FC<SkillsMasterSettingsProps> = ({ companyId }) => {
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: '', category: 'Engineering', aliases: '' });

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recruitment_skills_master')
        .select('*')
        .eq('company_id', companyId)
        .order('category', { ascending: true });

      if (error) throw error;
      setSkills(data || []);
    } catch (err: any) {
      console.error('Error fetching skills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchSkills();
  }, [companyId]);

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkill.name.trim()) return;

    try {
      const aliasArray = newSkill.aliases
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from('recruitment_skills_master')
        .insert({
          company_id: companyId,
          name: newSkill.name.trim(),
          category: newSkill.category,
          aliases: aliasArray,
          is_active: true
        });

      if (error) throw error;
      setNewSkill({ name: '', category: 'Engineering', aliases: '' });
      setIsAdding(false);
      fetchSkills();
    } catch (err: any) {
      alert('Error adding skill: ' + err.message);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!confirm('Are you sure you want to remove this skill from the dictionary?')) return;
    try {
      const { error } = await supabase
        .from('recruitment_skills_master')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchSkills();
    } catch (err: any) {
      alert('Error deleting skill: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-500" />
            Skills Taxonomy & Keyword Matching Dictionary
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Defines canonical skills and synonyms used by the non-AI resume extractor and matching engine.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add New Skill
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddSkill} className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Skill Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Revit"
                value={newSkill.name}
                onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Category</label>
              <select
                value={newSkill.category}
                onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              >
                <option value="Engineering">Engineering</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Finance & Accounting">Finance & Accounting</option>
                <option value="Operations & Site">Operations & Site</option>
                <option value="Health & Safety">Health & Safety</option>
                <option value="Management">Management</option>
                <option value="General">General</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Aliases (Comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Autodesk Revit, BIM Revit"
                value={newSkill.aliases}
                onChange={(e) => setNewSkill({ ...newSkill, aliases: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-xs"
              />
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
              Save Skill
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/70 dark:bg-zinc-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-800">
              <th className="p-3">Skill Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Matching Aliases & Synonyms</th>
              <th className="p-3 text-center">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {skills.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition">
                <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                  {s.name}
                </td>
                <td className="p-3 text-slate-500 font-medium">
                  {s.category}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {(s.aliases || []).map((a: string, idx: number) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] text-slate-600 dark:text-slate-300 font-mono">
                        {a}
                      </span>
                    ))}
                    {(!s.aliases || s.aliases.length === 0) && (
                      <span className="text-[10px] text-slate-400 italic">None</span>
                    )}
                  </div>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleDeleteSkill(s.id)}
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
