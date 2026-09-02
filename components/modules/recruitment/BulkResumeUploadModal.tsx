import React, { useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { extractDocumentText } from '../../../lib/recruitment/documentExtractor';
import { parseResumeText, ParsedResume } from '../../../lib/recruitment/resumeParser';
import { computeJobMatchScore, MatchRequirement } from '../../../lib/recruitment/matchingEngine';
import { 
  X, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  Briefcase,
  Users,
  Check,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

interface JobOption {
  id: string;
  title: string;
  required_skills?: string[];
  min_experience_years?: number;
  education_level?: string;
  location?: string;
}

interface ParsedCandidateItem {
  id: string;
  file: File;
  fileName: string;
  fileType: string;
  fileSize: number;
  extractedText: string;
  parsed: ParsedResume;
  isDuplicate: boolean;
  duplicateCandidateId?: string;
  duplicateReason?: string;
  duplicateAction: 'skip' | 'link_application' | 'create_new';
  matchScore: number;
  matchDetails: any;
  status: 'PENDING' | 'PARSED' | 'PARTIAL' | 'FAILED';
  error?: string;
}

interface BulkResumeUploadModalProps {
  companyId: string;
  userId?: string;
  jobs: JobOption[];
  initialJobId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkResumeUploadModal: React.FC<BulkResumeUploadModalProps> = ({
  companyId,
  userId,
  jobs,
  initialJobId,
  onClose,
  onSuccess
}) => {
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId || '');
  const [items, setItems] = useState<ParsedCandidateItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number; stage: string }>({
    current: 0,
    total: 0,
    stage: ''
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected job for match calculations
  const selectedJob = jobs.find(j => j.id === selectedJobId);

  const handleFilesSelected = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => {
      const name = f.name.toLowerCase();
      return name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.txt') || name.endsWith('.rtf');
    });

    if (fileArray.length === 0) return;

    setIsProcessing(true);
    setStep('review');
    const parsedItems: ParsedCandidateItem[] = [];

    // Fetch existing candidates for duplicate checking (email and phone)
    const { data: existingCandidates } = await supabase
      .from('recruitment_candidates')
      .select('id, email, phone, first_name, last_name')
      .eq('company_id', companyId);

    const existingEmails = new Map<string, string>();
    const existingPhones = new Map<string, string>();
    (existingCandidates || []).forEach((c: any) => {
      if (c.email) existingEmails.set(c.email.toLowerCase().trim(), c.id);
      if (c.phone) {
        const digits = c.phone.replace(/\D/g, '');
        if (digits.length >= 7) existingPhones.set(digits.slice(-8), c.id);
      }
    });

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setCurrentProgress({
        current: i + 1,
        total: fileArray.length,
        stage: `Extracting & Parsing ${file.name}...`
      });

      try {
        // 1. Deterministic Text Extraction
        const extracted = await extractDocumentText(file);

        // 2. Deterministic Rule-Based Parsing
        const parsed = parseResumeText(extracted.text);

        // 3. Duplicate Detection
        let isDuplicate = false;
        let duplicateCandidateId: string | undefined;
        let duplicateReason: string | undefined;

        if (parsed.email && existingEmails.has(parsed.email.toLowerCase().trim())) {
          isDuplicate = true;
          duplicateCandidateId = existingEmails.get(parsed.email.toLowerCase().trim());
          duplicateReason = `Email matches existing candidate (${parsed.email})`;
        } else if (parsed.phone) {
          const phoneDigits = parsed.phone.replace(/\D/g, '');
          if (phoneDigits.length >= 7 && existingPhones.has(phoneDigits.slice(-8))) {
            isDuplicate = true;
            duplicateCandidateId = existingPhones.get(phoneDigits.slice(-8));
            duplicateReason = `Phone matches existing candidate (${parsed.phone})`;
          }
        }

        // Also check duplicates within this batch
        const batchDuplicate = parsedItems.find(it => 
          (it.parsed.email && parsed.email && it.parsed.email.toLowerCase() === parsed.email.toLowerCase())
        );
        if (batchDuplicate) {
          isDuplicate = true;
          duplicateReason = 'Duplicate file inside this batch';
        }

        // 4. Compute Match Score if Job is selected
        let matchScore = 75;
        let matchDetails: any = {};
        if (selectedJob) {
          const matchReq: MatchRequirement = {
            requiredSkills: selectedJob.required_skills || [],
            minExperienceYears: selectedJob.min_experience_years || 0,
            educationLevel: selectedJob.education_level || undefined,
            location: selectedJob.location || undefined
          };
          const matchRes = computeJobMatchScore({
            skills: parsed.skills,
            totalExperienceYears: parsed.totalExperienceYears,
            highestEducation: parsed.highestEducation,
            location: parsed.location
          }, matchReq);
          matchScore = matchRes.score;
          matchDetails = matchRes;
        }

        const itemStatus = extracted.isScannedOrEmpty ? 'FAILED' : parsed.confidence === 'HIGH' ? 'PARSED' : 'PARTIAL';

        parsedItems.push({
          id: `item_${i}_${Date.now()}`,
          file,
          fileName: file.name,
          fileType: extracted.fileType,
          fileSize: file.size,
          extractedText: extracted.text,
          parsed,
          isDuplicate,
          duplicateCandidateId,
          duplicateReason,
          duplicateAction: isDuplicate ? (duplicateCandidateId ? 'link_application' : 'skip') : 'create_new',
          matchScore,
          matchDetails,
          status: itemStatus,
          error: extracted.isScannedOrEmpty ? 'Scanned or unreadable document. Manual review required.' : undefined
        });

      } catch (err: any) {
        parsedItems.push({
          id: `item_${i}_${Date.now()}`,
          file,
          fileName: file.name,
          fileType: 'FILE',
          fileSize: file.size,
          extractedText: '',
          parsed: {
            firstName: file.name.replace(/\.[^/.]+$/, '').slice(0, 20),
            lastName: '',
            email: '',
            phone: '',
            location: '',
            linkedinUrl: '',
            portfolioUrl: '',
            currentTitle: '',
            currentCompany: '',
            totalExperienceYears: 0,
            highestEducation: '',
            educationDegree: '',
            educationInstitution: '',
            skills: [],
            workExperience: [],
            confidence: 'NOT_DETECTED',
            rawText: ''
          },
          isDuplicate: false,
          duplicateAction: 'create_new',
          matchScore: 50,
          matchDetails: {},
          status: 'FAILED',
          error: err?.message || 'Extraction failed'
        });
      }

      // Small async tick to keep browser responsive
      await new Promise(r => setTimeout(r, 20));
    }

    setItems(parsedItems);
    setIsProcessing(false);
  };

  const handleUpdateItemField = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        parsed: {
          ...item.parsed,
          [field]: value
        }
      };
    }));
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleSaveAndImport = async () => {
    const validItems = items.filter(i => i.duplicateAction !== 'skip');
    if (validItems.length === 0) {
      alert('No candidates to import.');
      return;
    }

    setIsSaving(true);
    let successCount = 0;

    try {
      for (let i = 0; i < validItems.length; i++) {
        const it = validItems[i];
        setCurrentProgress({
          current: i + 1,
          total: validItems.length,
          stage: `Saving ${it.parsed.firstName} ${it.parsed.lastName} (${i + 1}/${validItems.length})...`
        });

        let candidateId = it.duplicateCandidateId;

        // Step A: Upload Resume File to Supabase Storage
        const fileExt = it.fileName.split('.').pop() || 'pdf';
        const storagePath = `recruitment/${companyId}/resumes/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        
        let resumeUrl = '';
        try {
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(storagePath, it.file, { upsert: true });

          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
            resumeUrl = urlData?.publicUrl || storagePath;
          } else {
            resumeUrl = `local://${storagePath}`;
          }
        } catch {
          resumeUrl = `local://${storagePath}`;
        }

        // Step B: Create or Update Candidate
        if (!candidateId || it.duplicateAction === 'create_new') {
          const candidateCode = `CAN-${Date.now().toString().slice(-6)}`;
          const { data: newCand, error: candErr } = await supabase
            .from('recruitment_candidates')
            .insert({
              company_id: companyId,
              candidate_code: candidateCode,
              first_name: it.parsed.firstName || 'Candidate',
              last_name: it.parsed.lastName || '',
              email: it.parsed.email || `candidate_${Date.now()}_${i}@imported.local`,
              phone: it.parsed.phone || null,
              current_location: it.parsed.location || null,
              current_title: it.parsed.currentTitle || null,
              current_company: it.parsed.currentCompany || null,
              total_experience_years: it.parsed.totalExperienceYears || 0,
              highest_education: it.parsed.highestEducation || null,
              education_degree: it.parsed.educationDegree || null,
              education_institution: it.parsed.educationInstitution || null,
              linkedin_url: it.parsed.linkedinUrl || null,
              portfolio_url: it.parsed.portfolioUrl || null,
              status: 'ACTIVE',
              source_name: 'Bulk Resume Import',
              tags: it.parsed.skills.slice(0, 5)
            })
            .select('id')
            .single();

          if (candErr) {
            console.error('Error creating candidate:', candErr);
            continue;
          }
          candidateId = newCand.id;
        }

        // Step C: Save Document Version
        await supabase
          .from('recruitment_candidate_documents')
          .insert({
            company_id: companyId,
            candidate_id: candidateId,
            file_name: it.fileName,
            file_path: resumeUrl,
            file_type: it.fileType,
            file_size: it.fileSize,
            version_number: 1,
            is_current: true,
            document_category: 'RESUME',
            extracted_text: it.extractedText,
            parser_data: it.parsed,
            parser_status: it.status,
            parser_confidence: it.parsed.confidence
          });

        // Step D: Link Application if Job is selected
        if (selectedJobId && candidateId) {
          const { data: newApp, error: appErr } = await supabase
            .from('recruitment_applications')
            .insert({
              company_id: companyId,
              candidate_id: candidateId,
              job_id: selectedJobId,
              stage: 'RESUME_SCREENING',
              match_score: it.matchScore,
              match_details: it.matchDetails,
              status: 'ACTIVE',
              source_name: 'Bulk Resume Import'
            })
            .select('id')
            .single();

          if (!appErr && newApp) {
            // Log stage audit
            await supabase.from('recruitment_stage_history').insert({
              company_id: companyId,
              application_id: newApp.id,
              old_stage: 'APPLIED',
              new_stage: 'RESUME_SCREENING',
              reason_or_notes: 'Automated bulk parse intake'
            });
          }
        }

        successCount++;
      }

      alert(`Import complete! Successfully imported ${successCount} candidates.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Bulk import error:', err);
      alert('Error during bulk import: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const parsedCount = items.filter(i => i.status === 'PARSED').length;
  const partialCount = items.filter(i => i.status === 'PARTIAL').length;
  const failedCount = items.filter(i => i.status === 'FAILED').length;
  const duplicateCount = items.filter(i => i.isDuplicate).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-6xl w-full h-[90vh] shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Bulk Resume Import & Deterministic Parser
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload batches of resumes (PDF, DOCX, TXT) — parsed 100% locally without external AI APIs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Job Selection Bar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-amber-500" /> Target Job Opening:
            </span>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <option value="">Intake to General Talent Pool (No Job Link)</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>

          {step === 'review' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 font-bold">
                ✓ {parsedCount} Parsed
              </span>
              {partialCount > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 font-bold">
                  ⚠ {partialCount} Partial
                </span>
              )}
              {duplicateCount > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 font-bold">
                  👥 {duplicateCount} Duplicates
                </span>
              )}
              {failedCount > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 font-bold">
                  ✕ {failedCount} Review Needed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="h-full flex flex-col items-center justify-center">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-2xl border-2 border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/20 dark:bg-amber-950/10 rounded-3xl p-12 text-center cursor-pointer hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50/40 transition-all group space-y-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-zinc-200">
                    Drop resume files here, or <span className="text-amber-600 dark:text-amber-400 underline">browse</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports PDF, Word DOCX, and TXT files. Select up to 100 files simultaneously.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 font-mono pt-2">
                  <span>✓ PDF text stream parsing</span>
                  <span>✓ DOCX XML extraction</span>
                  <span>✓ Deterministic regex NER</span>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
                  multiple
                  accept=".pdf,.docx,.txt,.rtf"
                  className="hidden"
                />
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {/* Progress Indicator */}
              {isProcessing && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-amber-800 dark:text-amber-300">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                      {currentProgress.stage}
                    </span>
                    <span>{currentProgress.current} / {currentProgress.total}</span>
                  </div>
                  <div className="w-full bg-amber-200/50 dark:bg-amber-900/40 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full transition-all duration-300"
                      style={{ width: `${(currentProgress.current / (currentProgress.total || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Table of Parsed Candidates */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-zinc-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-800">
                      <th className="p-3">File / Candidate</th>
                      <th className="p-3">Contact Details</th>
                      <th className="p-3">Experience</th>
                      <th className="p-3">Education</th>
                      <th className="p-3">Detected Skills</th>
                      {selectedJobId && <th className="p-3 text-center">Match Fit</th>}
                      <th className="p-3 text-center">Status / Actions</th>
                      <th className="p-3 text-center">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {items.map((item) => (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 ${
                          item.isDuplicate ? 'bg-purple-50/20 dark:bg-purple-950/10' : ''
                        }`}
                      >
                        {/* File & Name */}
                        <td className="p-3 max-w-[180px]">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                            <input
                              type="text"
                              value={item.parsed.firstName}
                              onChange={(e) => handleUpdateItemField(item.id, 'firstName', e.target.value)}
                              placeholder="First"
                              className="w-16 px-1.5 py-1 border border-slate-200 dark:border-zinc-700 rounded text-xs dark:bg-zinc-850"
                            />
                            <input
                              type="text"
                              value={item.parsed.lastName}
                              onChange={(e) => handleUpdateItemField(item.id, 'lastName', e.target.value)}
                              placeholder="Last"
                              className="w-16 px-1.5 py-1 border border-slate-200 dark:border-zinc-700 rounded text-xs dark:bg-zinc-850"
                            />
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-1 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> {item.fileName} ({item.fileType})
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="p-3 max-w-[190px]">
                          <input
                            type="email"
                            value={item.parsed.email}
                            onChange={(e) => handleUpdateItemField(item.id, 'email', e.target.value)}
                            placeholder="Email address"
                            className="w-full px-1.5 py-0.5 border border-slate-200 dark:border-zinc-700 rounded text-[11px] mb-1 dark:bg-zinc-850"
                          />
                          <input
                            type="text"
                            value={item.parsed.phone}
                            onChange={(e) => handleUpdateItemField(item.id, 'phone', e.target.value)}
                            placeholder="Phone number"
                            className="w-full px-1.5 py-0.5 border border-slate-200 dark:border-zinc-700 rounded text-[11px] dark:bg-zinc-850"
                          />
                        </td>

                        {/* Experience */}
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              value={item.parsed.totalExperienceYears}
                              onChange={(e) => handleUpdateItemField(item.id, 'totalExperienceYears', parseFloat(e.target.value) || 0)}
                              className="w-12 px-1.5 py-0.5 border border-slate-200 dark:border-zinc-700 rounded text-xs text-center font-bold dark:bg-zinc-850"
                            />
                            <span className="text-xs text-slate-500 font-medium">years</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px] mt-1">
                            {item.parsed.currentTitle || 'General Profile'}
                          </div>
                        </td>

                        {/* Education */}
                        <td className="p-3 max-w-[140px]">
                          <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {item.parsed.highestEducation || 'Degree Pending'}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {item.parsed.educationInstitution || '—'}
                          </div>
                        </td>

                        {/* Skills */}
                        <td className="p-3 max-w-[200px]">
                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                            {item.parsed.skills.slice(0, 5).map((sk, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] text-slate-600 dark:text-slate-300 font-medium">
                                {sk}
                              </span>
                            ))}
                            {item.parsed.skills.length > 5 && (
                              <span className="text-[10px] text-slate-400 font-semibold">+{item.parsed.skills.length - 5} more</span>
                            )}
                            {item.parsed.skills.length === 0 && (
                              <span className="text-[10px] text-slate-400 italic">No skills tagged</span>
                            )}
                          </div>
                        </td>

                        {/* Match Fit Score */}
                        {selectedJobId && (
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                              item.matchScore >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30' :
                              item.matchScore >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30' :
                              'bg-slate-100 text-slate-600 dark:bg-zinc-800'
                            }`}>
                              {item.matchScore}%
                            </span>
                          </td>
                        )}

                        {/* Duplicate / Status */}
                        <td className="p-3 text-center">
                          {item.isDuplicate ? (
                            <div className="space-y-1">
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold block">
                                Duplicate
                              </span>
                              <select
                                value={item.duplicateAction}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  setItems(prev => prev.map(it => it.id === item.id ? { ...it, duplicateAction: val } : it));
                                }}
                                className="text-[10px] border border-purple-200 rounded px-1 py-0.5 bg-white dark:bg-zinc-800"
                              >
                                <option value="link_application">Link to Existing</option>
                                <option value="create_new">Create Distinct</option>
                                <option value="skip">Skip / Ignore</option>
                              </select>
                            </div>
                          ) : item.status === 'PARSED' ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold">
                              Parsed (High)
                            </span>
                          ) : item.status === 'PARTIAL' ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold">
                              Partial
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold">
                              Review Needed
                            </span>
                          )}
                        </td>

                        {/* Remove */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex items-center justify-between">
          <div>
            {step === 'review' && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing || isSaving}
                className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-lg transition flex items-center gap-1.5"
              >
                <UploadCloud className="w-4 h-4 text-amber-500" /> Add More Files
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
              multiple
              accept=".pdf,.docx,.txt,.rtf"
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition"
            >
              Cancel
            </button>

            {step === 'review' && (
              <button
                onClick={handleSaveAndImport}
                disabled={isProcessing || isSaving || items.length === 0}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Candidates...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Import {items.filter(i => i.duplicateAction !== 'skip').length} Valid Candidates
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
