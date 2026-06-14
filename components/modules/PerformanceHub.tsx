import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Loader2, 
  Award, 
  Plus, 
  Target, 
  TrendingUp, 
  Calendar, 
  Star, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  FileText
} from 'lucide-react';

export const PerformanceHub: React.FC = () => {
  const { user, currentCompanyId } = useAuth();
  const [activeTab, setActiveTab] = useState<'goals' | 'reviews'>('goals');
  
  // Data State
  const [goals, setGoals] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Action State
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddReview, setShowAddReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Goal Form
  const [goalForm, setGoalForm] = useState({
    employee_id: '',
    title: '',
    description: '',
    target_value: '',
    unit: '%',
    due_date: '',
    weightage: '1.00'
  });

  // New Review Form
  const [reviewForm, setReviewForm] = useState({
    cycle_id: '',
    employee_id: '',
    self_rating: '',
    self_comments: '',
    manager_rating: '',
    manager_comments: '',
    final_rating: '',
    status: 'PENDING_SELF'
  });

  useEffect(() => {
    if (user && currentCompanyId) {
      loadData();
    }
  }, [user, currentCompanyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Employees
      const { data: empData } = await supabase
        .from('employees')
        .select('id, name')
        .eq('company_id', currentCompanyId)
        .order('name');
      if (empData) setEmployees(empData);

      // 2. Fetch Goals
      const { data: goalData } = await supabase
        .from('hrms_perf_goals' as any)
        .select('*, employees(name)')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false });
      if (goalData) setGoals(goalData);

      // 3. Fetch Cycles
      const { data: cycleData } = await supabase
        .from('hrms_perf_cycles' as any)
        .select('*')
        .eq('company_id', currentCompanyId)
        .order('start_date', { ascending: false });
      if (cycleData) setCycles(cycleData);

      // 4. Fetch Reviews
      const { data: reviewData } = await supabase
        .from('hrms_perf_reviews' as any)
        .select('*, employees(name), hrms_perf_cycles(name)')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false });
      if (reviewData) setReviews(reviewData);

    } catch (err) {
      console.error('Error loading performance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.employee_id || !goalForm.title || !goalForm.target_value || !goalForm.due_date) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('hrms_perf_goals' as any)
        .insert({
          company_id: currentCompanyId,
          employee_id: goalForm.employee_id,
          title: goalForm.title,
          description: goalForm.description,
          target_value: parseFloat(goalForm.target_value),
          current_value: 0.00,
          unit: goalForm.unit,
          due_date: goalForm.due_date,
          weightage: parseFloat(goalForm.weightage) || 1.00,
          status: 'NOT_STARTED'
        });

      if (error) throw error;
      
      setShowAddGoal(false);
      loadData();
    } catch (err) {
      console.error('Error creating performance goal:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm.cycle_id || !reviewForm.employee_id) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('hrms_perf_reviews' as any)
        .insert({
          company_id: currentCompanyId,
          cycle_id: reviewForm.cycle_id,
          employee_id: reviewForm.employee_id,
          self_rating: reviewForm.self_rating ? parseFloat(reviewForm.self_rating) : null,
          self_comments: reviewForm.self_comments || null,
          manager_rating: reviewForm.manager_rating ? parseFloat(reviewForm.manager_rating) : null,
          manager_comments: reviewForm.manager_comments || null,
          final_rating: reviewForm.final_rating ? parseFloat(reviewForm.final_rating) : null,
          status: reviewForm.status
        });

      if (error) throw error;
      
      setShowAddReview(false);
      loadData();
    } catch (err) {
      console.error('Error creating appraisal review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <Award className="w-6 h-6 text-violet-600" />
            Performance & Goals Hub
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 text-sm">
            Align organizational strategy, track key results/KPIs, and evaluate employee appraisal cycles.
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'goals' && (
            <button
              onClick={() => setShowAddGoal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Create Goal/KPI
            </button>
          )}
          {activeTab === 'reviews' && (
            <button
              onClick={() => setShowAddReview(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Appraisal Review
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'goals'
              ? 'border-violet-500 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700'
          }`}
        >
          <Target className="w-4 h-4" /> KPI / OKR Goals
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'reviews'
              ? 'border-violet-500 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700'
          }`}
        >
          <Star className="w-4 h-4" /> Performance Reviews
        </button>
      </div>

      {/* Goals / KPIs List */}
      {activeTab === 'goals' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-10 text-center text-slate-400">
              No performance goals found. Let's create one to get started!
            </div>
          ) : (
            goals.map((goal) => {
              const progress = goal.target_value > 0 ? (goal.current_value / goal.target_value) * 100 : 0;
              return (
                <div key={goal.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-base line-clamp-1">{goal.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                        goal.status === 'ACHIEVED' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' :
                        goal.status === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400' :
                        'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {goal.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{goal.description || 'No description provided.'}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-400">Target Weight: {goal.weightage}</span>
                      <span className="text-slate-900 dark:text-zinc-200 font-bold">
                        {goal.current_value} / {goal.target_value} {goal.unit}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2">
                      <div 
                        className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-400 pt-3 border-t border-slate-100 dark:border-zinc-850">
                    <span className="font-medium text-slate-500 dark:text-zinc-300">{goal.employees?.name}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Due {goal.due_date}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Performance Appraisals List */}
      {activeTab === 'reviews' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-400">
            <thead className="bg-slate-50 dark:bg-zinc-850 text-slate-500 uppercase text-xs">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Review Cycle</th>
                <th className="p-4">Self Rating</th>
                <th className="p-4">Manager Rating</th>
                <th className="p-4">Final Rating</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">No performance appraisals logged.</td>
                </tr>
              ) : (
                reviews.map((rev) => (
                  <tr key={rev.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="p-4 font-semibold text-slate-900 dark:text-zinc-200">{rev.employees?.name}</td>
                    <td className="p-4 text-xs font-semibold text-slate-500">{rev.hrms_perf_cycles?.name}</td>
                    <td className="p-4 font-medium">{rev.self_rating ? `${rev.self_rating} / 5` : '-'}</td>
                    <td className="p-4 font-medium">{rev.manager_rating ? `${rev.manager_rating} / 5` : '-'}</td>
                    <td className="p-4 font-bold text-violet-600 dark:text-violet-400">{rev.final_rating ? `${rev.final_rating} / 5` : '-'}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${
                        rev.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        rev.status === 'PENDING_MANAGER' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {rev.status === 'COMPLETED' && <CheckCircle className="w-3.5 h-3.5" />}
                        {rev.status === 'PENDING_MANAGER' && <Clock className="w-3.5 h-3.5" />}
                        {rev.status === 'PENDING_SELF' && <AlertCircle className="w-3.5 h-3.5" />}
                        {rev.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-zinc-200">Set Performance Goal (KPI/OKR)</h3>
              <button onClick={() => setShowAddGoal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Employee Owner</label>
                <select
                  required
                  value={goalForm.employee_id}
                  onChange={(e) => setGoalForm({ ...goalForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                >
                  <option value="">Choose employee...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Goal Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Increase monthly QAR sales target"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Target Value</label>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 100"
                    value={goalForm.target_value}
                    onChange={(e) => setGoalForm({ ...goalForm, target_value: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Unit</label>
                  <input
                    type="text"
                    placeholder="e.g. % or QAR"
                    value={goalForm.unit}
                    onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Target Weight</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 1.0"
                    value={goalForm.weightage}
                    onChange={(e) => setGoalForm({ ...goalForm, weightage: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Due Date</label>
                  <input
                    required
                    type="date"
                    value={goalForm.due_date}
                    onChange={(e) => setGoalForm({ ...goalForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Description</label>
                <textarea
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  placeholder="Key metrics to measure success..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm h-16"
                />
              </div>

              <button
                disabled={submitting}
                type="submit"
                className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition text-sm font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Goal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Review Modal */}
      {showAddReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-zinc-200">Start Appraisal Review</h3>
              <button onClick={() => setShowAddReview(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateReview} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Review Cycle</label>
                <select
                  required
                  value={reviewForm.cycle_id}
                  onChange={(e) => setReviewForm({ ...reviewForm, cycle_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                >
                  <option value="">Choose cycle...</option>
                  {cycles.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  {cycles.length === 0 && (
                    <option disabled>No cycles defined. Please seed review cycles first.</option>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Select Employee</label>
                <select
                  required
                  value={reviewForm.employee_id}
                  onChange={(e) => setReviewForm({ ...reviewForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                >
                  <option value="">Choose employee...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Self Rating (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    placeholder="e.g. 4.2"
                    value={reviewForm.self_rating}
                    onChange={(e) => setReviewForm({ ...reviewForm, self_rating: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Manager Rating (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    placeholder="e.g. 4.5"
                    value={reviewForm.manager_rating}
                    onChange={(e) => setReviewForm({ ...reviewForm, manager_rating: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Manager Comments</label>
                <textarea
                  value={reviewForm.manager_comments}
                  onChange={(e) => setReviewForm({ ...reviewForm, manager_comments: e.target.value })}
                  placeholder="Key summary of accomplishments, training requirements, or feedback..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm h-16"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Final Score (Appraisal rating)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  placeholder="e.g. 4.5"
                  value={reviewForm.final_rating}
                  onChange={(e) => setReviewForm({ ...reviewForm, final_rating: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Appraisal Stage</label>
                <select
                  value={reviewForm.status}
                  onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                >
                  <option value="PENDING_SELF">Pending Self Review</option>
                  <option value="PENDING_MANAGER">Pending Manager Review</option>
                  <option value="COMPLETED">Appraisal Completed</option>
                </select>
              </div>

              <button
                disabled={submitting}
                type="submit"
                className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition text-sm font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Appraisal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
