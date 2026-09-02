import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Briefcase, 
  Layers, 
  Users, 
  Calendar, 
  DollarSign, 
  Sparkles, 
  Gift, 
  BarChart3, 
  Settings, 
  LayoutDashboard,
  Loader2,
  UploadCloud,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

// Subcomponents
import { AtsDashboard } from './recruitment/AtsDashboard';
import { RequisitionsList } from './recruitment/RequisitionsList';
import { JobOpeningsList } from './recruitment/JobOpeningsList';
import { CandidatePipelineKanban } from './recruitment/CandidatePipelineKanban';
import { CandidateDatabase } from './recruitment/CandidateDatabase';
import { InterviewManagement } from './recruitment/InterviewManagement';
import { OfferManagement } from './recruitment/OfferManagement';
import { TalentPoolView } from './recruitment/TalentPoolView';
import { ReferralsView } from './recruitment/ReferralsView';
import { RecruitmentReports } from './recruitment/RecruitmentReports';
import { SkillsMasterSettings } from './recruitment/settings/SkillsMasterSettings';
import { CandidateSourcesSettings } from './recruitment/settings/CandidateSourcesSettings';
import { ScorecardSettings } from './recruitment/settings/ScorecardSettings';
import { BulkResumeUploadModal } from './recruitment/BulkResumeUploadModal';

export type AtsTab = 
  | 'dashboard'
  | 'requisitions'
  | 'jobs'
  | 'pipeline'
  | 'candidates'
  | 'interviews'
  | 'offers'
  | 'talent_pool'
  | 'referrals'
  | 'reports'
  | 'settings';

export const RecruitmentHub: React.FC = () => {
  const { user, currentCompanyId } = useAuth();
  const [activeTab, setActiveTab] = useState<AtsTab>('dashboard');
  const [loading, setLoading] = useState(true);

  // Common Master Data
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: number; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  // Inter-tab Hand-off State
  const [prefillRequisitionForJob, setPrefillRequisitionForJob] = useState<any | null>(null);
  const [selectedJobIdForPipeline, setSelectedJobIdForPipeline] = useState<string>('ALL');
  const [prefilledAppForInterview, setPrefilledAppForInterview] = useState<string | undefined>(undefined);
  const [prefilledOfferData, setPrefilledOfferData] = useState<{ appId: string; candidate: any } | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [settingsSubTab, setSettingsSubTab] = useState<'skills' | 'sources' | 'scorecards'>('skills');

  const loadMasterData = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    try {
      // 1. Departments
      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name')
        .eq('company_id', currentCompanyId)
        .order('name');
      setDepartments(deptData || []);

      // 2. Designations
      const { data: desigData } = await supabase
        .from('org_designations')
        .select('id, name')
        .eq('company_id', currentCompanyId)
        .order('name');
      setDesignations(desigData || []);

      // 3. Employees
      const { data: empData } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('company_id', currentCompanyId)
        .order('first_name');

      if (empData) {
        setEmployees(empData.map(e => ({
          id: e.id,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Employee'
        })));
      }

      // 4. Published Jobs
      const { data: jobData } = await supabase
        .from('recruitment_jobs')
        .select('id, title, required_skills, min_experience_years, education_level, location')
        .eq('company_id', currentCompanyId);
      setJobs(jobData || []);

    } catch (err) {
      console.error('Error loading ATS master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && currentCompanyId) {
      loadMasterData();
    }
  }, [user, currentCompanyId]);

  const handleNavigateTab = (tab: string, filter?: any) => {
    setActiveTab(tab as AtsTab);
    if (tab === 'pipeline' && filter) {
      setSelectedJobIdForPipeline(filter);
    }
  };

  if (!currentCompanyId) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Please select a company to access the Recruitment & ATS Hub.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Module Title & Top Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-sm">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Recruitment & ATS Enterprise Hub
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                End-to-End Talent Acquisition: Requisitions, Deterministic Resume Parsing, Pipeline, Scorecards & HRMS Conversion
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkUploadOpen(true)}
            className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-bold transition flex items-center gap-1.5 hover:bg-amber-100 shadow-xs"
          >
            <UploadCloud className="w-4 h-4 text-amber-500" /> Bulk Import Resumes
          </button>

          <a
            href={`/careers?company_id=${currentCompanyId}`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Public Careers Portal
          </a>
        </div>
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-zinc-800 text-xs font-bold scrollbar-none">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
        </button>

        <button
          onClick={() => setActiveTab('requisitions')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'requisitions'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Requisitions
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'jobs'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" /> Job Openings
        </button>

        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'pipeline'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Kanban Pipeline
        </button>

        <button
          onClick={() => setActiveTab('candidates')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'candidates'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Candidates
        </button>

        <button
          onClick={() => setActiveTab('interviews')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'interviews'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Interviews
        </button>

        <button
          onClick={() => setActiveTab('offers')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'offers'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" /> Offers
        </button>

        <button
          onClick={() => setActiveTab('talent_pool')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'talent_pool'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Talent Pool
        </button>

        <button
          onClick={() => setActiveTab('referrals')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'referrals'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Gift className="w-3.5 h-3.5" /> Referrals
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'reports'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Reports
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> ATS Settings
        </button>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
          Loading ATS Hub data...
        </div>
      ) : (
        <div>
          {activeTab === 'dashboard' && (
            <AtsDashboard
              companyId={currentCompanyId}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'requisitions' && (
            <RequisitionsList
              companyId={currentCompanyId}
              userId={user?.id}
              departments={departments}
              employees={employees}
              onOpenJobCreateWithRequisition={(req) => {
                setPrefillRequisitionForJob(req);
                setActiveTab('jobs');
              }}
            />
          )}

          {activeTab === 'jobs' && (
            <JobOpeningsList
              companyId={currentCompanyId}
              userId={user?.id}
              departments={departments}
              employees={employees}
              prefillRequisition={prefillRequisitionForJob}
              onSelectJobForPipeline={(jobId) => {
                setSelectedJobIdForPipeline(jobId);
                setActiveTab('pipeline');
              }}
              onClearPrefillRequisition={() => setPrefillRequisitionForJob(null)}
            />
          )}

          {activeTab === 'pipeline' && (
            <CandidatePipelineKanban
              companyId={currentCompanyId}
              userId={user?.id}
              jobs={jobs}
              selectedJobId={selectedJobIdForPipeline}
              onScheduleInterview={(appId) => {
                setPrefilledAppForInterview(appId);
                setActiveTab('interviews');
              }}
              onCreateOffer={(appId, candidate) => {
                setPrefilledOfferData({ appId, candidate });
                setActiveTab('offers');
              }}
              onConvertToEmployee={(candidate, app) => {
                setActiveTab('offers');
              }}
            />
          )}

          {activeTab === 'candidates' && (
            <CandidateDatabase
              companyId={currentCompanyId}
              userId={user?.id}
              jobs={jobs}
              onScheduleInterview={(appId) => {
                setPrefilledAppForInterview(appId);
                setActiveTab('interviews');
              }}
              onCreateOffer={(appId, candidate) => {
                setPrefilledOfferData({ appId, candidate });
                setActiveTab('offers');
              }}
            />
          )}

          {activeTab === 'interviews' && (
            <InterviewManagement
              companyId={currentCompanyId}
              userId={user?.id}
              employees={employees}
              preselectedApplicationId={prefilledAppForInterview}
              onClearPreselectedApplication={() => setPrefilledAppForInterview(undefined)}
            />
          )}

          {activeTab === 'offers' && (
            <OfferManagement
              companyId={currentCompanyId}
              userId={user?.id}
              departments={departments}
              designations={designations}
              prefilledApplicationId={prefilledOfferData?.appId}
              prefilledCandidate={prefilledOfferData?.candidate}
              onClearPrefill={() => setPrefilledOfferData(null)}
            />
          )}

          {activeTab === 'talent_pool' && (
            <TalentPoolView
              companyId={currentCompanyId}
              userId={user?.id}
              jobs={jobs}
            />
          )}

          {activeTab === 'referrals' && (
            <ReferralsView
              companyId={currentCompanyId}
              userId={user?.id}
              jobs={jobs}
              employees={employees}
            />
          )}

          {activeTab === 'reports' && (
            <RecruitmentReports
              companyId={currentCompanyId}
            />
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Settings Sub-Tabs */}
              <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-zinc-800 rounded-xl w-fit text-xs font-bold">
                <button
                  onClick={() => setSettingsSubTab('skills')}
                  className={`px-4 py-1.5 rounded-lg transition ${
                    settingsSubTab === 'skills' ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Skills Taxonomy & Aliases
                </button>
                <button
                  onClick={() => setSettingsSubTab('sources')}
                  className={`px-4 py-1.5 rounded-lg transition ${
                    settingsSubTab === 'sources' ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Candidate Sources
                </button>
                <button
                  onClick={() => setSettingsSubTab('scorecards')}
                  className={`px-4 py-1.5 rounded-lg transition ${
                    settingsSubTab === 'scorecards' ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Scorecard Templates
                </button>
              </div>

              {settingsSubTab === 'skills' && <SkillsMasterSettings companyId={currentCompanyId} />}
              {settingsSubTab === 'sources' && <CandidateSourcesSettings companyId={currentCompanyId} />}
              {settingsSubTab === 'scorecards' && <ScorecardSettings companyId={currentCompanyId} />}
            </div>
          )}
        </div>
      )}

      {/* Global Bulk Resume Upload Wizard Modal */}
      {isBulkUploadOpen && (
        <BulkResumeUploadModal
          companyId={currentCompanyId}
          userId={user?.id}
          jobs={jobs}
          onClose={() => setIsBulkUploadOpen(false)}
          onSuccess={() => {
            setIsBulkUploadOpen(false);
            loadMasterData();
          }}
        />
      )}
    </div>
  );
};
