# KAA ERP — Release Notes v2.17.0

**Release Date:** September 12, 2026  
**Scope:** Tally-Style Day Book Register, 2-Stage Project Approval Workflow & Notifications, Advanced Payment Voucher Controls & Type-to-Search Dropdowns

---

## 🌟 Executive Summary

Release **v2.17.0** delivers major functional expansions and usability upgrades across **Financial Accounting, Audit Compliance, and Project Governance**.

This release introduces a dedicated **Tally-Standard Day Book** designed specifically to provide seamless operational parity for accounting teams familiar with TallyPrime Gold. It features instant single-row and detailed multi-leg transaction views, rapid period filters, multi-column sorting, live type-to-search, and audit-ready printable layouts.

In addition, this update implements a **Sequential 2-Stage Project Approval Workflow** ensuring project proposals are systematically reviewed by the Project Lead/Engineer and signed off by Executive Management with automated notification dispatch at every step. Finally, the **Payment Voucher** module has been significantly enhanced with **Debit/Credit line selectors, negative deduction support, and intelligent type-to-search dropdowns** for rapid data entry.

All updates are live, fully verified, and synchronized across both corporate repositories.

---

## 🚀 Key Features & Enhancements Delivered Today

### 1. 📅 Tally-Style Day Book (Daily Transaction Register)

A dedicated, high-speed transaction register built to match the layout, ergonomics, and reporting standards of **TallyPrime Gold**:

- **Exact Tally-Standard Layout (Condensed View)**:
  - Chronological transaction register with standardized columns:
    - **Date**: Formatted in standard accounting notation (e.g. `1-Aug-2026`).
    - **Particulars**: Intelligent derivation of the primary debited/credited ledger or business partner (e.g. *Warehouse Charges*, *Accommodation*, *Petty Cash*, *Vendor Names*, *Customer Accounts*).
    - **Voucher Type**: Color-coded badges for *Payment*, *Receipt*, *Sales*, *Purchase*, *Journal*, and *Contra*.
    - **Voucher Number**: Prominent reference code formatting (e.g. `PBV.3920.8`, `PI.2026.69`).
    - **Debit Amount**: Right-aligned, formatted with thousands separators and two decimals.
    - **Credit Amount**: Right-aligned, formatted with thousands separators and two decimals.
    - **Status**: Live status badge (*Posted*, *Draft*, *Cancelled*).
  - Single-row presentation for quick daily auditing and bookkeeping reviews.

- **Detailed Double-Entry View (`Alt + F1`)**:
  - Global toggle button + keyboard shortcut (`Alt + F1`) to switch between Condensed and Detailed views.
  - Interactive row accordion (`>` / `v`) allows expanding any individual voucher on demand.
  - Reveals complete double-entry accounting legs showing:
    - Debit and Credit lines with account codes, account names, and partner tags.
    - Transaction narration and remarks.

- **Comprehensive Period Presets & Custom Range**:
  - One-click period selector chips:
    - **Today**
    - **Yesterday**
    - **This Week**
    - **This Month**
    - **Last Month**
    - **August 2026 (Live Historical Data)**
    - **All Dates**
  - Interactive **From** and **To** calendar date pickers for customized audit intervals.

- **Voucher Type & Status Filtering**:
  - Filter by transaction category: *All Types*, *Payment*, *Receipt*, *Sales*, *Purchase*, *Journal*, *Contra*.
  - Filter by approval state: *All*, *Posted Only*, *Draft Only*, *Cancelled*.

- **Live Type-to-Search**:
  - Instant live filtering as you type across Voucher Numbers, Particulars, Ledger Names, Business Partners, Amounts, and Narration notes.

- **Multi-Column Sorting**:
  - Sort by **Date**, **Voucher Number**, **Particulars (A-Z)**, or **Amount** with Ascending / Descending toggle.

- **Financial Totals & Summary Dashboard**:
  - Real-time KPI summary banner highlighting **Total Vouchers Count**, **Total Debits**, **Total Credits**, and **Net Surplus / Movement**.
  - Prominent table footer totals summing debits and credits across all filtered vouchers.

- **Audit-Ready Print & Spreadsheet Export**:
  - **Print Layout**: Clean, border-formatted print engine displaying corporate header, period range, full voucher ledger, and official 3-tier corporate signoff blocks (*Prepared By*, *Verified By*, *Approved By*).
  - **CSV Export**: Instant download of the filtered register into standard CSV/Excel format.

- **Navigation**:
  - Accessible directly from the main Accounting top bar (**📅 Day Book**) and under the **Reporting** sub-menu.

---

### 2. 📋 2-Stage Sequential Project Approval Workflow & Notification Routing

A robust approval pipeline ensuring strict governance for project proposals and commercial bids:

- **Sequential Review Hierarchy**:
  - **Stage 1 (First Review)**: Project Lead / Technical Reviewer conducts technical and operational vetting.
  - **Stage 2 (Final Approval)**: Managing Director / Operations Head conducts financial and commercial authorization.
- **Automated Routing & Handoff**:
  - When a proposal is submitted, Stage 1 Reviewer receives an immediate alert.
  - Upon Stage 1 approval, the proposal automatically advances to *Pending Final Approval*, and the Stage 2 Approver is notified immediately.
  - Submitter and Reviewer are kept informed of progress at each milestone.
- **Role-Based Sign-Off Gates**:
  - Dynamic action controls ensure only the assigned reviewer can approve their respective stage.
  - "Your Turn to Approve" visual badge highlights proposals awaiting action by the logged-in manager.
- **Document Locking**:
  - Once final approval is granted, the proposal is locked to prevent unapproved edits to scope, deliverables, or cost estimates.
- **Reassignment & Delegation**:
  - Dedicated tools for Project Directors to reassign reviewers or designate final approvers on both new and existing proposals.

---

### 3. 💳 Payment Voucher Enhancements & Multi-Line Accounting Controls

Upgraded the Payment Voucher interface to handle real-world commercial disbursements, retentions, and deductions:

- **Debit / Credit (Dr/Cr) Dropdown Selector**:
  - Each line item now features an explicit **Dr / Cr** dropdown selector, giving accountants full manual control over multi-split disbursements.
- **Negative Entry & Deduction Handling**:
  - Full support for entering negative amounts and deduction lines (e.g. advance adjustments, retention money, discounts, tax deductions).
  - Totals calculation dynamically incorporates credits and deductions to reflect the true net payment amount.
- **Intelligent Type-to-Search Dropdowns**:
  - Account and partner dropdowns now include instant type-ahead filtering.
  - As the user types, the list filters in real time.
  - Full keyboard navigation (Up/Down arrow keys + Enter) allows accountants to select ledger accounts without using the mouse, drastically accelerating voucher entry.

---

## 🛡️ Verification, Build & Deployment Summary

| Verification Check | Result | Details |
| :--- | :--- | :--- |
| **Production Build** | ✅ Passed | `vite build` completed in **7.07s** with **0 errors** |
| **Live Data Reconciliation** | ✅ Verified | August 2026 Day Book validated against Tally source records |
| **Workflow Integrity** | ✅ Verified | Sequential notification handoff tested from Reviewer to Approver |
| **Primary Repository (origin)** | ✅ Pushed | `https://github.com/jacobjerin38/KAAERPLIVE.git` (main) |
| **Backup Repository (backup)** | ✅ Pushed | `https://github.com/jerinjacobdream11-lang/KAAERPLIVE.git` (main) |
