# 🚀 KAA ERP Hub — Release Notes v2.11.0

**Release Date:** August 26, 2026  
**Target Environment:** Production Live (`kaaerp.com`)  
**Database:** Supabase PostgreSQL 17.6 (`euoaoyzpurbvcoxydunl`)  
**Git Commits:** `bcff1df` | `0c96ed1` | `ef10ba2`  
**Git Remotes:** `origin/main` & `backup/main`

---

## 📌 Executive Summary

Release **v2.11.0** introduces the **Enterprise Project Management & Governance Hub** — a comprehensive suite engineered for rigorous project control, technical/commercial proposal lifecycle management, mandatory quality & safety gateways, site execution tracking, and formal project closeout governance. 

This release also delivers critical cross-module enhancements, including unified **Customer & Vendor Master Data alignment** (`accounting_partners`), **Supabase Storage bucket provisioning & RLS policies**, and **PostgREST schema cache optimizations**.

---

## 🌟 Key Upgraded Features

### 1. 📑 External Proposal Lifecycle & Document Locking
* **Technical vs. Commercial Segregation:** Distinct workflows tailored for Technical Proposals (Technical Submittals) and Commercial Proposals (Quotation + Costing Sheet).
* **Multi-Stage Review Chain:** Built-in review routing through **First Reviewer**, **Finance Approval**, and **Final Approval** with mandatory remarks for any return or rejection.
* **Immutable Revision Numbering:** Revisions increment automatically (Rev 1, Rev 2, etc.) while preserving past files and remarks for full traceability.
* **Dynamic Reviewer Reassignment:** Reassign pending proposals with mandatory audit justification.
* **Automated Document Locking:** Approved proposals are automatically locked against further edits.

---

### 2. 🛡️ 6 Mandatory Execution Document Gateways
To eliminate compliance gaps before site mobilization, projects cannot be approved for site execution until all **6 mandatory document hold-points** are uploaded and confirmed:
1. **Method Statement (MS)** — Detailed step-by-step execution methodology & sequence.
2. **Inspection & Test Plan (ITP)** — Quality verification hold-points and acceptance criteria.
3. **Project Execution Plan (PEP)** — Site management, schedule milestones & resources.
4. **Job Hazard Analysis (JHA)** — Site hazard identification and risk control measures.
5. **Technical Data Sheets (TDS)** — Equipment specs, material approvals, and catalog cuts.
6. **Safety Data Sheets (SDS / MSDS)** — Chemical hazard handling and storage safety guidelines.

---

### 3. 👥 Site Supervisor Assignment & Daily Activity Logs
* **Team Deployment:** Assign multiple site supervisors with defined roles, responsibilities, and deployment dates.
* **Site Execution Feed:** Site supervisors log daily activities directly from the field, tracking:
  - Daily manpower headcount on site.
  - Work area / switchgear room / feeder locations.
  - Planned vs. completed work and quantities.
  - Delay reasons and site constraints.
  - Safety observations & on-site photos/attachments.
* **Review & Verification:** Project Managers and Heads review and approve daily logs with time-stamped verification.

---

### 4. ⚠️ Issues, HSE Observations & Risk Matrix Radar
* **Issue Tracking:** Severity tracking (Critical, High, Medium, Low) with target due dates, impact analysis, and resolution signoff.
* **Risk Register:** 5x5 Probability vs. Impact matrix scoring, mitigation planning, and owner assignment.
* **Safety & HSE Observations:** Site safety hazard logging with immediate corrective action tracking.

---

### 5. 🔒 Strict Project Closeout & Reopening Protocol
* **Formal Closeout Gateway:** Project completion requires uploaded **Completion Reports**, **Testing & Commissioning Records**, and client **Taking-Over Certificates (TOC)**.
* **Final Signoff & Record Locking:** Project Head approval locks the project record (`is_locked = true`), preventing retroactive tampering.
* **Controlled Reopening:** Formal reopening protocol with mandatory managerial justification and audit logging.

---

### 6. 🖨️ Executive Dossier & 9-Section Print/PDF Report Builder
* **One-Click Printable Report:** Built-in clean executive dossier formatted with print stylesheets (`@media print`).
* **Comprehensive Sections:**
  1. Header & Company Executive Branding
  2. Project Overview & Commercial Terms (QAR)
  3. Executive Milestones & Timeline Summary
  4. Mandatory Document Compliance Audit Checklist (6/6 Hold Points)
  5. Site Supervision & Manpower Allocation
  6. Recent Site Activity & Progress Verification
  7. Active Issues & HSE Observations
  8. Risk Assessment Matrix & Mitigations
  9. Formal Approval, Handover & Signoff Authorization Blocks

---

### 7. 🏢 Master Data & Permission Governance
* **Organisation Masters:** Added master categories for **Project Categories**, **Project Types**, **Issue Categories**, and **Risk Categories** with full CRUD control.
* **20 Granular Permissions:** Role-Based Access Control (RBAC) added covering proposals, execution documents, supervisor assignment, safety observation, and project closeout.

---

## 🛠️ Cross-Module Fixes & Database Optimizations

| Area | Component / Table | Description of Fix |
| :--- | :--- | :--- |
| **Master Data** | `accounting_partners` | Aligned Project and Proposal client foreign keys to `accounting_partners(id)` (37 active company clients & vendors). |
| **Cloud Storage** | `storage.buckets` & `storage.objects` | Initialized public `'documents'` storage bucket with permissive authenticated RLS policies (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) for all project & proposal files. |
| **API & Schema** | `projectService.ts` / PostgREST | Sanitized PostgREST query projections for `pm_projects` and `project_proposals` to resolve `PGRST200` relation cache warnings. |
| **UI Callbacks** | `ProposalsList.tsx` & `ProjectDashboard.tsx` | Aligned proposal creation modal callback signatures, resolving `TypeError: s is not a function`. |
| **Form Resilience**| `DailyActivityModal.tsx` | Added fallback resolution for supervisor options (`employee?.id || s.employee_id`). |

---

## 📦 Modified & Newly Added Components

```
components/
├── modules/
│   ├── Organisation.tsx                   (Added Project Masters & Permission Controls)
│   └── ProjectManagement.tsx              (Complete Project Hub with Dashboard & Feed)
├── projects/
│   ├── DailyActivityModal.tsx             (Site Execution & Photo Attachment Modal)
│   ├── ProjectDashboard.tsx               (Executive Metric Cards & Visual Pipeline)
│   ├── ProjectDetailView.tsx              (8-Tab Project Workspace & Document Gateways)
│   ├── ProjectFormModal.tsx               (Project Registration & LPO Upload Modal)
│   ├── ProjectReportModal.tsx             (9-Section Printable Executive Report)
│   ├── ProjectsList.tsx                   (Project Registry & Filter Table)
│   ├── ProposalDetailModal.tsx            (Proposal Review & Revision Modal)
│   ├── ProposalFormModal.tsx              (Technical & Commercial Registration Modal)
│   ├── ProposalsList.tsx                  (Proposal Register & Status Filter Table)
│   └── projectService.ts                  (Database Service Layer & Storage API)
lib/
└── WorkflowEngine.ts                      (Workflow Hooks for Project & Proposal Approvals)
supabase/migrations/
└── 20260825_enterprise_project_management.sql (16 Relational Tables & RLS Policies)
```

---

## ✅ Deployment & Verification Checklist

- [x] **Database Migrations:** All 16 PostgreSQL tables, foreign keys, and RLS policies verified active on Supabase (`euoaoyzpurbvcoxydunl`).
- [x] **Storage Infrastructure:** `'documents'` bucket verified with public read & authenticated write policies.
- [x] **Code Build:** Production build passed with **0 TypeScript and bundling errors** (`npm run build`).
- [x] **Git Synchronization:** All commits successfully pushed to `origin/main` ([GitHub](https://github.com/jacobjerin38/KAAERPLIVE.git)) and `backup/main`.
