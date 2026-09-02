# KAA ERP — Release Notes v2.15.0

**Release Date:** September 3, 2026  
**Module Scope:** Recruitment & ATS Hub, Sourcing, Careers Portal, Interview Scorecards, Offer Management & HRMS Integration

---

## 🌟 Executive Summary

Release **v2.15.0** transforms the KAA ERP Recruitment module into a full-scale, enterprise-grade **Applicant Tracking System (ATS)**. 

The upgrade covers the complete hiring lifecycle from departmental vacancy requests to active employee onboarding:
**Manpower Requisition → Approval → Job Opening → Public Publishing → Resume Upload & Parsing → Candidate Profile → 14-Stage Kanban Pipeline → Panel Interviews & Weighted Scorecards → Formal Compensation Offers → HRMS Employee Creation**.

All parsing and matching algorithms are **100% deterministic and self-contained**, operating entirely without external AI API dependencies or recurring service costs.

---

## 🚀 Key Features & Capabilities Delivered

### 1. 🤖 Pure Non-AI Deterministic Resume Extraction & Parsing
- **Native Document Text Stream Extractor**:
  - Automatically decodes PDF streams, Word (.docx) XML documents, and text files directly in the browser using native web stream decompressors.
  - Zero files or confidential resume data are sent to third-party AI APIs.
  - Fault-tolerant fallback preserves scanned documents and tags them for recruiter manual review without dropping files.
- **Rule-Based Entity Parser**:
  - Extracts contact information, email addresses, and international/GCC phone numbers.
  - Classifies degree levels (Doctorate, Masters, Bachelors, Diplomas, Secondary) and educational institutions.
  - Calculates net working experience from chronological employment date spans.
  - Automatically tags detected skills by matching against the standardized organizational taxonomy.
  - Computes confidence ratings (**High**, **Medium**, **Low**) with instant editable previews.

---

### 2. ⚡ Bulk Resume Import Wizard
- **High-Volume Intake**:
  - Recruiters can drag-and-drop batches of up to 100 resumes simultaneously.
  - Asynchronous background batch processing keeps the user interface smooth and responsive with live progress bars.
- **Automated Duplicate Candidate Detection**:
  - Automatically flags candidates with matching email addresses or phone numbers.
  - Provides quick resolution options: link to an existing candidate, create a distinct profile, or skip.
- **Recruiter Review Grid**:
  - Review and adjust parsed names, emails, phone numbers, experience years, and skills before one-click batch import.

---

### 3. 🎯 Transparent Candidate-Job Matching Engine
- **Weighted Rule-Based Scoring Formula**:
  - **Skills Match (50%)**: Compares candidate capabilities against job opening requirements.
  - **Experience Fit (25%)**: Evaluates total verified work history against position seniority.
  - **Education Level (15%)**: Assesses degree alignment.
  - **Location Fit (5%)**: Recognizes local, regional GCC, or overseas residence.
  - **Notice Period (5%)**: Evaluates availability for joining.
- **Explainable Feedback Tags**:
  - Every application displays a 0–100% match score alongside clear justification badges (e.g., *"7/8 Required Skills Verified"*, *"Exceeds minimum experience requirement"*, *"Local candidate residing in Doha"*).

---

### 4. 📋 Manpower Requisitions & Approval Hierarchy
- **Departmental Vacancy Requests**:
  - Line managers can submit hiring requisitions detailing position titles, headcount vacancies, replacement rationale, target joining dates, and budget brackets.
- **Workflow Approval Routing**:
  - Track requests through formal statuses: **Draft**, **Submitted / In Review**, **Approved**, **Rejected**, and **Closed**.
- **1-Click Opening Generation**:
  - Approved requisitions automatically pre-fill new job openings, ensuring approved budgets and headcounts are strictly maintained.

---

### 5. 📊 14-Stage Visual Kanban Pipeline
- **Interactive Visual Workflow**:
  - Full candidate progression across 14 dedicated hiring stages:
    1. **Applied**
    2. **Resume Screening**
    3. **Shortlisted**
    4. **Phone Screen**
    5. **Interview**
    6. **Technical Round**
    7. **Manager Round**
    8. **HR Round**
    9. **Offer Made**
    10. **Offer Accepted**
    11. **Hired**
    12. **Rejected**
    13. **On Hold**
    14. **Withdrawn**
- **Comprehensive Stage Movement Audit**:
  - Every stage change automatically logs timestamps, acting users, and mandatory notes or rejection reasons.
- **Action Shortcuts**:
  - Contextual action buttons directly on cards to schedule rounds, issue offers, or initiate employee conversion.

---

### 6. 🏆 Interview Panel Management & Weighted Scorecards
- **Multi-Round Scheduling**:
  - Coordinate technical, managerial, and HR rounds with calendar dates, time slots, and virtual meeting links (Google Meet, Teams, Zoom).
- **Structured Scorecard Evaluation Rubrics**:
  - Interviewers grade candidates across weighted categories (Technical Competence, Relevant Experience, Communication, Problem Solving, Team Fit).
  - Calculates weighted average ratings and records hiring recommendations (**Strong Hire**, **Hire**, **Hold**, **No Hire**) with detailed interview observations.

---

### 7. 💼 Formal Offer Letters & Safe HRMS Employee Conversion
- **Compensation Breakdown**:
  - Structure complete monthly packages with Basic Salary, Housing Allowance, Transport Allowance, and Other Benefits in local currency.
  - Enforces approval reviews before offer release.
- **Guaranteed Safe Employee Conversion**:
  - Converts accepted candidates directly into the HRMS Employee Directory with zero manual re-entry.
  - **Conflict Prevention**: Pre-checks for duplicate email addresses or employee codes before saving.
  - Displays a complete mapping preview for HR confirmation before creating the official employee record.

---

### 8. 🌐 Public Careers Portal & Talent Rediscovery
- **Branded Careers Portal**:
  - Accessible via dedicated careers URL with real-time published job listings, position overviews, and responsibilities.
  - Direct resume file upload with real-time autofill of application forms.
- **Talent Pool Reserves**:
  - Archive silver-medalist and passive candidates with fast skill-based rediscovery.
  - 1-click re-engagement to link talent pool profiles into new active openings.
- **Employee Referral Program**:
  - Staff members can submit referrals, track candidate progress, and monitor referral bonus payout statuses.

---

### 9. 📈 Executive ATS Dashboard & Analytics
- **Live KPI Overview**:
  - Instant visibility into Published Openings, Talent Base, Active Pipeline, Scheduled Interviews, Pending Offers, and Hired Staff.
- **Recruitment Funnel Visualization**:
  - Visual conversion chart tracking volume and drop-off from initial application through final hire.
- **Analytics & Compliance Reports**:
  - **Source Attribution ROI Report**: Compares application volume and hire conversion rates across job boards, portals, agencies, and referrals.
  - **Pipeline Aging Bottlenecks Report**: Identifies applications stalled in review stages with CSV export support.

---

## 📋 Summary Comparison

| Capability | Previous System | Upgrade v2.15.0 |
| :--- | :--- | :--- |
| **Hiring Request** | None (direct unapproved posting) | Multi-level Manpower Requisition workflow |
| **Candidate Model** | Single row tied to one job | Central candidate profile with multi-application history |
| **Resume Handling** | Plain text URL field | Direct file upload with versioned document storage |
| **Resume Parsing** | None | 100% Deterministic non-AI extraction & classification |
| **Bulk Processing** | One-by-one manual input | Bulk drag-and-drop import wizard with duplicate checks |
| **Candidate Scoring** | None | Explainable weighted match algorithm (0–100%) |
| **Pipeline Workflow** | 6 static columns | 14 configurable stages with complete audit trail |
| **Interview Process** | Single notes field | Multi-round panels with weighted evaluation scorecards |
| **Offer Management** | None | Formal compensation breakdown and approval workflow |
| **HRMS Onboarding** | Blind auto-insert | Conflict-checked preview modal and employee conversion |
| **Talent Pool** | None | Passive talent reserves and employee referral registry |
| **Analytics** | None | Real-time ATS dashboard and source ROI reports |

---

## 📦 Deployment & Verification Details

- **Application Build:** Passed in 11.27s with **0 compilation errors**.
- **Production Data Safety:** Verified 100% intact across all live employee records, attendance punches, and payroll runs.
- **Multi-Tenant Security:** Company data isolation enforced with strict tenant security access controls.
- **Version Control:** Committed and synchronized across both primary and backup repositories.
- **Client Action Required:** Refresh your browser using **`Ctrl + F5`** (or **`Cmd + Shift + R`** on Mac) to load the updated application bundle.
