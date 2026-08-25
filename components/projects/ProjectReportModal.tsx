import React from 'react';
import { X, Printer, Download, CheckCircle2, AlertCircle, Building2, Calendar, FileText, Lock, Shield } from 'lucide-react';

interface ProjectReportModalProps {
    project: any;
    onClose: () => void;
}

export const ProjectReportModal: React.FC<ProjectReportModalProps> = ({
    project,
    onClose
}) => {
    const handlePrint = () => {
        window.print();
    };

    const docs = project.documents || [];
    const confirmedDocs = docs.filter((d: any) => d.confirmed).length;
    const supervisors = (project.supervisors || []).filter((s: any) => s.is_active);
    const activities = project.activities || [];
    const issues = project.issues || [];
    const risks = project.risks || [];
    const safetyObs = project.safety_observations || [];
    const auditLogs = project.audit || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-3xl p-6 sm:p-10 shadow-2xl relative animate-slide-up border border-slate-100 dark:border-zinc-800 max-h-[90vh] overflow-y-auto custom-scrollbar print:max-h-none print:shadow-none print:border-none print:p-0 print:w-full print:rounded-none">
                
                {/* Modal Controls (Hidden in Print) */}
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100 dark:border-zinc-800 print:hidden">
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            Executive Report
                        </span>
                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                            Project Comprehensive Status Report
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print / Save as PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* PRINTABLE DOCUMENT BODY */}
                <div className="space-y-8 print:space-y-6 text-slate-800 dark:text-slate-200">
                    {/* Report Header */}
                    <div className="flex justify-between items-start border-b-2 border-slate-900 dark:border-white pb-6">
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                KAA ERP Project Dossier
                            </h1>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
                                Enterprise Execution & Governance Audit
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400">Generated: {new Date().toLocaleString()}</p>
                            <p className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                                STATUS: {project.status}
                            </p>
                        </div>
                    </div>

                    {/* Section 1: Executive Overview */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                            1. Project Executive Summary
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                                <span className="text-slate-400 block font-bold">Project Name:</span>
                                <span className="font-bold text-slate-900 dark:text-white">{project.name}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-bold">Client / Customer:</span>
                                <span className="font-bold">{project.client?.name || '—'}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-bold">Project Manager:</span>
                                <span className="font-bold">{project.manager?.name || 'Unassigned'}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-bold">Schedule:</span>
                                <span className="font-bold">{project.start_date || '—'} to {project.end_date || '—'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Contractual & Commercial Data */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                            2. Contractual & Financial Milestones
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                                <span className="text-slate-400 block font-bold">Client LPO #:</span>
                                <span className="font-mono font-bold">{project.lpo_number || '—'}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-bold">Contract Value:</span>
                                <span className="font-mono font-black text-slate-900 dark:text-white">
                                    QAR {Number(project.lpo_cost || project.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-bold">Cost Center:</span>
                                <span className="font-bold">{project.cost_center?.name || 'Standard'}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-bold">Execution Progress:</span>
                                <span className="font-mono font-bold text-blue-600">{project.completion_pct || 0}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Mandatory Document Compliance */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md flex justify-between items-center">
                            <span>3. Mandatory Document Governance ({confirmedDocs}/6 Confirmed)</span>
                        </h3>
                        <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden text-xs">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-400 font-bold">
                                    <tr>
                                        <th className="px-4 py-2">Document Type</th>
                                        <th className="px-4 py-2">Version</th>
                                        <th className="px-4 py-2">Compliance Status</th>
                                        <th className="px-4 py-2">Verification Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {[
                                        { type: 'METHOD_STATEMENT', label: 'Method Statement (MS)' },
                                        { type: 'ITP', label: 'Inspection & Test Plan (ITP)' },
                                        { type: 'EXECUTION_PLAN', label: 'Project Execution Plan (PEP)' },
                                        { type: 'JHA', label: 'Job Hazard Analysis (JHA)' },
                                        { type: 'TECHNICAL_DATA_SHEET', label: 'Technical Data Sheets (TDS)' },
                                        { type: 'SDS', label: 'Safety Data Sheets (SDS / MSDS)' },
                                    ].map(m => {
                                        const doc = docs.find((d: any) => d.document_type === m.type);
                                        return (
                                            <tr key={m.type}>
                                                <td className="px-4 py-2 font-bold">{m.label}</td>
                                                <td className="px-4 py-2 font-mono">{doc ? `v${doc.version || 1}` : '—'}</td>
                                                <td className="px-4 py-2">
                                                    {doc?.confirmed ? (
                                                        <span className="text-emerald-600 font-bold">✓ Confirmed</span>
                                                    ) : (
                                                        <span className="text-amber-600 font-bold">⚠ Pending</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-slate-500 italic">{doc?.remarks || '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 4: Supervisory Personnel */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                            4. Site Supervisory Personnel ({supervisors.length} Active)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {supervisors.map((s: any) => (
                                <div key={s.id} className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                                    <p className="font-bold text-slate-900 dark:text-white">{s.employee?.name}</p>
                                    <p className="text-slate-500">{s.role || 'Supervisor'} • {s.responsibilities || 'Site Supervision'}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section 5: Daily Execution Logs Summary */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                            5. Site Activities Summary ({activities.length} Logs Recorded)
                        </h3>
                        <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden text-xs">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-400 font-bold">
                                    <tr>
                                        <th className="px-4 py-2">Date</th>
                                        <th className="px-4 py-2">Work Area</th>
                                        <th className="px-4 py-2">Supervisor</th>
                                        <th className="px-4 py-2">Staff</th>
                                        <th className="px-4 py-2">Progress %</th>
                                        <th className="px-4 py-2">Review</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {activities.slice(0, 10).map((a: any) => (
                                        <tr key={a.id}>
                                            <td className="px-4 py-2 font-mono font-bold">{a.activity_date}</td>
                                            <td className="px-4 py-2 font-bold">{a.work_area}</td>
                                            <td className="px-4 py-2">{a.supervisor?.name || '—'}</td>
                                            <td className="px-4 py-2 font-mono">{a.worker_count}</td>
                                            <td className="px-4 py-2 font-mono font-bold text-blue-600">{a.progress_pct}%</td>
                                            <td className="px-4 py-2 font-bold text-slate-600">{a.review_status || 'SUBMITTED'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 6: Issues & Risks */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                            6. Active Issues & Risk Log ({issues.length} Issues, {risks.length} Risks)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div>
                                <h4 className="font-bold text-rose-600 mb-1">Issues Log</h4>
                                <ul className="space-y-1.5 list-disc list-inside text-slate-600 dark:text-slate-400">
                                    {issues.map((iss: any) => (
                                        <li key={iss.id}>
                                            <strong className="text-slate-800 dark:text-white">{iss.title}</strong> [{iss.severity}] — {iss.status}
                                        </li>
                                    ))}
                                    {issues.length === 0 && <li className="italic text-slate-400">No issues recorded.</li>}
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-amber-600 mb-1">Risk Register</h4>
                                <ul className="space-y-1.5 list-disc list-inside text-slate-600 dark:text-slate-400">
                                    {risks.map((r: any) => (
                                        <li key={r.id}>
                                            <strong className="text-slate-800 dark:text-white">{r.title}</strong> [Sev: {r.severity} / Prob: {r.probability}]
                                        </li>
                                    ))}
                                    {risks.length === 0 && <li className="italic text-slate-400">No risks registered.</li>}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Section 7: HSE & Safety Observations */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                            7. Health, Safety & Environment (HSE) Observations ({safetyObs.length} Records)
                        </h3>
                        <div className="space-y-2 text-xs">
                            {safetyObs.map((so: any) => (
                                <div key={so.id} className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                                    <span className="font-bold text-blue-600">[{so.hazard_type}]</span> {so.observation}
                                    {so.corrective_action && <p className="text-emerald-600 mt-0.5"><strong>Action:</strong> {so.corrective_action}</p>}
                                </div>
                            ))}
                            {safetyObs.length === 0 && <p className="text-slate-400 italic">No HSE incidents recorded.</p>}
                        </div>
                    </div>

                    {/* Section 8: Closeout & Signoff */}
                    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                            8. Governance Verification & Authority Signatures
                        </h3>
                        <div className="grid grid-cols-3 gap-6 pt-6 text-center text-xs">
                            <div className="border-t border-slate-400 pt-2">
                                <p className="font-bold text-slate-900 dark:text-white">{project.manager?.name || 'Project Manager'}</p>
                                <p className="text-[10px] text-slate-400">Project Manager</p>
                            </div>
                            <div className="border-t border-slate-400 pt-2">
                                <p className="font-bold text-slate-900 dark:text-white">Engineering Lead</p>
                                <p className="text-[10px] text-slate-400">Technical Head</p>
                            </div>
                            <div className="border-t border-slate-400 pt-2">
                                <p className="font-bold text-slate-900 dark:text-white">Managing Director / Project Head</p>
                                <p className="text-[10px] text-slate-400">Executive Approval</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
