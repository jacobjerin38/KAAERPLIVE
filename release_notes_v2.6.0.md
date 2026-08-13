# KAA ERP — Official Release Notes
**Version:** v2.6.0  
**Release Date:** August 14, 2026  
**Module Scope:** ESSP, HRMS & Attendance, Chart of Accounts, Financial Reporting, Access Control  

---

## Executive Summary
Version **v2.6.0** of KAA ERP introduces significant enhancements across **Employee Self-Service (ESSP)**, **HRMS Attendance & Overtime Governance**, **Night Shift / Cross-Midnight Processing**, and **Accounting Master Data Management**. 

Key highlights include real-time ESSP punch out stability, an integrated Missed Punch Request & HR Approval workflow, accessible Overtime Rules & 3-Level Approval Authorities, auto-linking for night shifts in Duty Rosters, and full support for importing company-customized **Chart of Accounts via Excel**.

---

## 🚀 What's New & Fixed

### 1. 📱 Employee Self-Service Portal (ESSP) & Attendance Punching
* **Reliable Punch Out Status Updates**: 
  - Fixed an issue where clicking *Punch Out* on mobile/web would occasionally revert the status back to *Checked In*. 
  - The system now performs a direct database validation across midnight sessions before refreshing, ensuring immediate status updates to **Checked Out**.
* **New "Request Missed Punch" Button**:
  - Prominently placed in the **ESSP → My Attendance** header (alongside *Request Overtime*).
  - Displays a real-time **Pending Request Badge Counter**.
  - Opens a dedicated application modal allowing employees to specify **Date**, **Punch Type** (*Check In 🟢 / Check Out 🔴*), **Time**, and mandatory **Reason**.

---

### 2. ⏱️ HRMS Attendance, Shift Timings & Duty Roster Overhaul
* **Night Shift (Cross-Midnight) Punch Calculation**:
  - Automatically handles shifts spanning across midnight (e.g., 10:00 PM Day 1 to 6:00 AM Day 2).
  - Check-out punches past midnight now correctly anchor to the **Shift Start Date**, preventing orphaned attendance logs or false absence records.
* **Auto-Detect Overnight Shifts**:
  - Creating or editing shift timings with `Start Time > End Time` automatically marks the shift as **🌙 NIGHT** type.
* **Duty Roster Visual Badges & Bulk Assignment**:
  - Added visual indicators for **☀️ Day Shifts** (Emerald) and **🌙 Night Shifts** (Indigo).
  - Enhanced Duty Roster with **Employee Search Filters** and **Excel / CSV Upload** capabilities for bulk roster assignments.
* **HR Missed Punch Approval Management**:
  - Located under **HRMS → Attendance → Missed Punch Applications**.
  - HR Administrators can review, approve, or reject pending requests with 1-click. Approvals automatically update employee attendance records and calculate net working hours.

---

### 3. ⚙️ Overtime Rules, Policy Controls & Approval Authority
* **"OT & Attendance Settings" Tab**:
  - Renamed and redesigned for instant access under **HRMS → Attendance → OT & Attendance Settings**.
* **Overtime Policy Configuration**:
  - **OT Threshold Hours** (e.g., standard 8.0 hrs).
  - **Multipliers**: Standard Day (1.5x), Weekend (2.0x), and Public Holiday (2.0x).
  - **Max OT Limit**: Daily overtime caps (e.g., max 4.0 hrs/day).
  - **Approval Toggle**: Enforce mandatory manager approval for overtime pay calculation.
* **3-Level Overtime Approval Authority**:
  - Multi-tier approval mapping per employee (Level 1, Level 2, Level 3).
  - Added complete mapping management with **Delete / Edit** controls.

---

### 4. 📊 Chart of Accounts (COA) & Financial Reporting
* **Full Support for PEC Chart of Accounts Excel Upload**:
  - Updated Excel import engine to seamlessly accept company Excel sheets with custom column headers:
    - `Account Code` (e.g., 1010, 1020)
    - `Type` (Assets, Liabilities, Equity, Incomes, Expenses — automatically normalized)
    - `Category` (Current Assets, Fixed Assets, Current Liabilities, Direct Expenses, etc.)
    - `Account Name` (Petty Cash, QIIB Bank, etc.)
    - `Balance Type` (Debit Balance / Credit Balance)
    - `Parent Account` (e.g., Cash on Hand, Cash in Bank, Accounts Receivables)
* **Automatic Parent-Child Hierarchy Linking**:
  - Uploading Excel files automatically resolves parent account names/codes and links `parent_id` sub-ledgers.
* **Database Schema Enhancement**:
  - Created migration `20260814_add_description_parent_to_coa.sql` adding `description` and `parent_id` to `accounting_chart_of_accounts`.
  - Added resilient fallback error handling to guarantee account creation without schema cache interruption.
* **Financial Reporting Alignment**:
  - Verified seamless alignment across **Balance Sheet**, **Profit & Loss**, **Trial Balance**, and **General Ledger** reports.

---

### 5. 🛡️ Access Control & System Permissions
* **PRO & Government Services Permissions**:
  - Added **PRO (Mandoob) & Government Services** to the Access Control matrix in **Organisation Settings**, enabling granular permission control for administrative staff.

---

## 🛠️ Summary of Database & Code Changes

| Area | Component / Script | Key Change |
| :--- | :--- | :--- |
| **ESSP** | `ESSP.tsx` | Active punch validation, Punch Out state fix, Request Missed Punch modal & header badge |
| **HRMS** | `AttendanceModule.tsx` | Renamed `OT & Attendance Settings` tab, added Day/Night badges to Duty Roster |
| **Settings** | `AttendanceSettings.tsx` | Overtime rules, multipliers, max daily OT, and 3-level authority mapping table actions |
| **Accounting** | `ChartOfAccounts.tsx` | PEC Excel parser, expanded category options, parent account auto-linking |
| **Database** | `20260814_add_description_parent_to_coa.sql` | Schema migration for COA `description` and `parent_id` columns |
| **Permissions**| `Organisation.tsx` | Added PRO & Government Services module access control |

---

## 🔒 Verification & Compliance
- **Build Status**: Fully compiled and verified with Zero TypeScript errors (`npx tsc --noEmit`).
- **Repositories**: All commits pushed cleanly to remotes (`backup/main` and `origin/main`).

---

*For technical assistance or deployment support, please contact the KAA ERP Systems Engineering Team.*
