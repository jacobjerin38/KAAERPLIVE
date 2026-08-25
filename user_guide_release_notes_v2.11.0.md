# 📘 KAA ERP — New Features User Guide & Release Overview
**Version 2.11.0 | User Manual & Business Guide**

Welcome to the updated **KAA ERP Hub**. This guide explains all the new features and improvements introduced in this release, written specifically for business users, estimators, project managers, site supervisors, and company management.

---

## 🌟 Table of Contents
1. [Proposals & Estimation Control](#1-proposals--estimation-control)
2. [Registering a New Project with Client LPO](#2-registering-a-new-project-with-client-lpo)
3. [The 6 Mandatory Pre-Execution Documents Gate](#3-the-6-mandatory-pre-execution-documents-gate)
4. [Assigning Site Supervisors & Logging Daily Site Work](#4-assigning-site-supervisors--logging-daily-site-work)
5. [Tracking Issues, Site Risks & Safety Observations](#5-tracking-issues-site-risks--safety-observations)
6. [Formal Project Completion & Signoff](#6-formal-project-completion--signoff)
7. [1-Click Executive Print & PDF Reports](#7-1-click-executive-print--pdf-reports)
8. [Other Module Improvements & Bug Fixes](#8-other-module-improvements--bug-fixes)

---

## 1. Proposals & Estimation Control

> **Note on Proposal Preparation:**  
> Detailed engineering drawings, calculations, and proposal authoring continue to take place in your standard external engineering tools. KAA ERP manages the **registration, multi-level review, revision history, and document locking**.

### How to Register a New Proposal
1. Open the **Projects** module from the left navigation bar and click the **Proposals** tab.
2. Click **+ New Technical Proposal** or **+ New Commercial Proposal**:
   * **For Technical Proposals:** Enter the Proposal Title, select the Client, enter the RFQ reference, select your **First Reviewer**, and upload the Technical Proposal PDF.
   * **For Commercial Proposals:** Enter the title, select the Client, enter the Quotation Reference, select your **First Reviewer**, and upload **both** the Quotation document and the Internal Costing Sheet.
3. Click **Submit Proposal**.

### Proposal Review & Revision Workflow
* **Multi-Stage Approval:** The proposal moves sequentially through:
  1. `First Review` (Engineering / Technical Lead)
  2. `Finance Review` (Commercial Verification)
  3. `Final Approval` (Executive Signoff)
* **Returns & Rejections:** If a proposal needs changes, the reviewer selects **Return for Correction** or **Reject** and must enter written feedback explaining what to adjust.
* **Uploading Revisions:** The estimator uploads an updated file under the proposal's **Revision History** tab. The system automatically labels it (e.g., `Rev 1`, `Rev 2`) and re-notifies the reviewer.
* **Document Locking:** Once fully approved, the proposal is **locked** with a green badge to ensure no unapproved changes occur.

---

## 2. Registering a New Project with Client LPO

When a client awards a job, register the project to begin tracking compliance and site execution.

### How to Create a Project:
1. Under the **Projects** module, go to the **Projects Registry** tab and click **Create New Project**.
2. Fill in the project details:
   * **Project Name & Client:** Select from your registered company clients.
   * **Client LPO / Work Order Number:** Enter the official purchase order number.
   * **Contract Value (QAR):** Enter the agreed project budget or LPO total.
   * **Execution Schedule:** Choose the planned Start Date and End Date.
   * **Project Manager:** Assign the lead engineer/manager responsible for execution.
   * **Link Proposals:** Connect approved Technical and Commercial proposals.
   * **LPO Document:** Upload a copy of the signed Client LPO / Work Order.
3. Click **Create Project**. The project is created in **Draft / Setup** status.

---

## 3. The 6 Mandatory Pre-Execution Documents Gate

To ensure strict engineering quality, safety compliance, and client approval before mobilizing teams to the site, KAA ERP enforces a **6-Document Compliance Gate**.

### The 6 Mandatory Documents:
1. 📄 **Method Statement (MS):** Step-by-step site execution methodology and sequence.
2. 📋 **Inspection & Test Plan (ITP):** Quality control inspection points and acceptance criteria.
3. 📅 **Project Execution Plan (PEP):** Schedule, milestones, and site resource plan.
4. ⚠️ **Job Hazard Analysis (JHA):** Hazard identification and safety risk mitigations.
5. 📊 **Technical Data Sheets (TDS):** Material specifications and catalog cuts.
6. 🧪 **Safety Data Sheets (SDS / MSDS):** Chemical and hazardous material handling guidelines.

### How to Upload and Approve Mandatory Documents:
1. Open the project and navigate to the **Mandatory Documents** tab.
2. For each document type, click **Upload Document**, attach the file, and provide revision notes.
3. Once all 6 documents are uploaded and confirmed, the **Submit for Project Head Approval** button unlocks.
4. The Project Head reviews the compliance checklist and clicks **Approve for Site Execution**.

---

## 4. Assigning Site Supervisors & Logging Daily Site Work

### Assigning Site Supervisors:
1. In the project workspace, go to the **Supervisors** tab.
2. Click **+ Assign Supervisor**, select the engineer/supervisor from your staff list, set their role (e.g., *Lead Electrical Supervisor*), and set their deployment dates.

### Logging Daily Site Activities (Field Entry):
Site supervisors can log daily progress directly from their mobile devices or laptops:
1. Open the project and click **+ Log Daily Activity** (or click the **Site Activity Feed** tab on the main dashboard).
2. Enter:
   * **Activity Date & Work Area** (e.g., *Switchgear Room 2 / Feeder 4*).
   * **Workers on Site (Headcount)** (e.g., *8 Technicians, 2 Helpers*).
   * **Work Description** (Planned tasks vs. what was completed today).
   * **Completion Progress (%)**.
   * **Site Photos & Inspection Slips** (Take or attach on-site photos).
   * **Site Delays / Roadblocks** (if any).
   * **Safety Observations**.
3. Click **Submit Log**.
4. The Project Manager can review, comment, and stamp the log as **Reviewed & Approved**.

---

## 5. Tracking Issues, Site Risks & Safety Observations

Maintain visibility over field obstacles before they cause delays or cost overruns:

* **Site Issues Tab:** Log issues (e.g., *Client material delay*, *Access permit pending*), assign a team member, set severity (*Critical*, *High*, *Medium*), and track target closure dates.
* **Risk Register Tab:** Track risks with a **5x5 Probability vs. Impact matrix**, assign risk owners, and document preventative mitigation plans.
* **Safety (HSE) Observations Tab:** Record unsafe acts or safety hazards, specify required corrective actions, and track closure sign-offs.

---

## 6. Formal Project Completion & Signoff

When all site work is finished, the project goes through a formal closeout process to ensure all paperwork, testing records, and payments are settled.

### Step-by-Step Closeout Process:
1. Open the project and navigate to the **Completion & Closeout** tab.
2. Click **Submit Project Completion**:
   * Set the **Actual Completion Date**.
   * Enter the **Final Completion Percentage** (100%).
   * Upload the **Completion / Testing & Commissioning Report**.
   * Upload the **Client Taking-Over Certificate (TOC) / Handover Signoff**.
3. Click **Submit for Management Signoff**.
4. The Project Head reviews all deliverables, financial summaries, and attachments, then clicks **Approve & Close Project**.
5. **Project Locking:** The project is marked **Completed & Locked**. All records become read-only to preserve an immutable audit archive.

---

## 7. 1-Click Executive Print & PDF Reports

Need to share a project dossier with management, auditors, or the client?

1. Open any project workspace.
2. Click the **Print Executive Dossier** button in the top right corner.
3. A formatted **9-Section Executive Report** opens automatically, featuring:
   * Company header and project commercial figures (QAR).
   * Milestone dates and execution schedule.
   * Compliance checklist for all 6 mandatory documents.
   * Supervisor rosters and manpower allocations.
   * Recent site activity logs and progress percentages.
   * Open issues, risks, and HSE observations.
   * Official handover signoff blocks.
4. Click **Print / Save as PDF** to generate an official branded PDF.

---

## 8. Other Module Improvements & Bug Fixes

In addition to the new Project Hub, the following system-wide improvements have been completed:

* **Unified Client & Partner Directory:** Projects and Proposals are now seamlessly connected with your active company partner directory (`accounting_partners`), ensuring accurate client names, phone numbers, and emails across all forms.
* **Fast Cloud File Storage:** A dedicated high-speed document storage bucket is active for proposal attachments, client LPOs, site photos, and completion certificates.
* **Smoother Button Actions:** Resolved button click issues on the dashboard and proposal tables for a fast, responsive user interface.
* **HRMS & Leave Travel Tracking:** (From previous update) Added airfare ticket uploads, route tracking, and accurate employee leave balance synchronizations.

---

### Need Assistance?
If you have any questions or require user training on the new Project Governance features, please contact your KAA ERP administrator.
