# KAA ERP System — Release Notes
**Release Version**: 2.21.0  
**Release Date**: 23 September 2026  
**Audience**: Executive Management, Finance & Accounts Team, Commercial, HR, and Operations Leaders  
**Classification**: Official Client Release Document  

---

## Executive Summary

We are pleased to announce the official release of **KAA ERP v2.21.0**, an enterprise-grade update focused on **system security, financial compliance, automated multi-stage governance, and operational resilience**.

This release introduces comprehensive architectural advancements designed to support multi-entity corporate operations with absolute data privacy, strict regulatory compliance with the State of Qatar's tax standards, automated double-entry ledger posting, and robust HR and project management governance.

### Highlights of This Release:
1. **Multi-Company Data Privacy & Enterprise Security** — Multi-tenant database isolation, automated privilege safeguards, and secure company workspace switching.
2. **Qatar Tax Compliance & Automated VAT Reporting** — Native line-level VAT accounting, automatic standard (5%), zero-rated, and exempt classification, and single-click Qatar VAT return generation.
3. **High-Concurrency Financial Protections** — Intelligent record locking on payment and journal vouchers preventing accidental double-posting, and fail-closed fiscal period enforcement.
4. **End-to-End CRM & Sales Transaction Integrity** — Single-transaction recalculation of quotations, sales invoices, and delivery notes with built-in duplicate conversion prevention.
5. **HR Governance, Overlap Prevention & Overnight Attendance** — Idempotent annual leave accruals, automated overtime and loan deduction processing, database-enforced leave overlap prevention, and support for cross-midnight overnight shifts.
6. **Integrated Manufacturing Stock Ledger** — Real-time component consumption and finished-goods receipt directly linked to live warehouse inventory with weighted unit cost calculation.
7. **Two-Stage Project Proposal Approval Workflow** — Rigorous commercial governance enforcing designated Stage 1 Technical Reviewers and Stage 2 Executive Approvers with post-approval document locking.
8. **Precision Timezone Localization & Disaster Recovery** — Local timezone alignment eliminating date-offset anomalies in morning financial reports, and non-destructive enterprise backup restoration.

---

## 1. Enterprise Security & Multi-Company Privacy

### 🛡️ Multi-Company Session Switching
* **Authorized Company Switching**: Users with access to multiple corporate entities can now switch their active operational workspace securely. The system validates company membership before updating the active session context.
* **Privilege & Role Protection**: Core security fields (such as user role, assigned employee identity, and primary company) are protected by database-level security triggers, ensuring role governance cannot be modified without administrative clearance.

### 🔒 Enterprise Data Isolation & Storage Governance
* **Row-Level Tenant Isolation**: All commercial, financial, project, and workflow data are strictly compartmentalized by company. Users can only access documents and records belonging to their active business entity.
* **Secure Storage Access**: Files uploaded to storage (contracts, payment attachments, project drawings, and company documents) are protected by tenant-scoped access policies that verify company ownership before granting access.
* **Public Recruitment Safe Channel**: Public applicants submitting resumes via the Careers portal can securely upload CVs through dedicated recruitment pipelines without accessing internal corporate documents.
* **Audit-Ready Database Views**: CRM operational views now inherit row-level security rules, ensuring sales performance reports maintain confidentiality across branch offices.

---

## 2. Financial Operations & Qatar Tax Compliance

### 🇶🇦 Automated Qatar VAT Engine & Canonical Tax Reporting
* **Line-Level VAT Tracking**: Added dedicated tax identification, rate percentages (0% – 5%), tax amounts, and taxable base fields directly on individual journal lines.
* **Official Qatar VAT Report**: A dedicated one-click VAT return engine generates compliant tax figures across any selected calendar or fiscal period:
  * **Output Tax**: Standard-rated sales (5%), zero-rated exports/services, and exempt sales.
  * **Input Tax**: Standard-rated business purchases (5%), zero-rated, and exempt expenses.
  * **Net Tax Balance**: Automatically computes Net VAT Payable or Refundable for official filing with the General Tax Authority (GTA).
  * **Historical Reconciliation**: Seamlessly incorporates legacy transactions alongside new canonical vouchers.

### ⚡ Financial Concurrency & Posting Safeguards
* **Concurrency Posting Protection**: Added row-level concurrency locks to payment vouchers and journal entries. When an accountant posts a voucher, concurrent actions (such as accidental double-clicks or multiple operators reviewing the same voucher) are locked to eliminate duplicate ledger postings.
* **Fiscal Period Lock Enforcement**: Financial vouchers can only be posted into open, defined fiscal periods. If an accounting period is locked or undefined for a given date, the system immediately guides the user, safeguarding finalized monthly books.
* **Double-Entry Balance Verification**: Built-in verification asserts total debits equal total credits before saving or posting financial vouchers.
* **Bank Statement Reconciliation**: Reconciling bank statements now requires exact amount matching and active company verification, locking both the statement line and payment voucher simultaneously upon reconciliation.

---

## 3. Commercial & Sales Workflow Management

### 📑 Transactional Sales Document Engine
* **Atomic Quotation & Invoice Updates**: Modifying line items on Quotations, Sales Invoices, or Delivery Notes now executes as an atomic database transaction. Subtotals, line discounts, VAT amounts, and grand totals recalculate instantaneously with guaranteed accuracy.
* **Settled Invoice Protection**: Sales invoices marked as `Paid` are automatically locked against line modifications, protecting issued client billing and customer statements.
* **Duplicate Conversion Prevention**: Quotations converted into Sales Invoices feature server-side duplicate prevention guards, ensuring a sales quotation cannot be accidentally billed twice.
* **Delivery Note Traceability**: Direct synchronization between ordered and delivered quantities provides clear visibility over partial deliveries and balance dispatches.

---

## 4. HR Management, Attendance & Payroll Precision

### ⏱️ Attendance Punch & Overnight Shift Accuracy
* **Overnight Shift Detection**: The attendance engine now intelligently recognizes overnight and cross-midnight shifts (e.g. 10:00 PM to 6:00 AM). Check-out times that fall on the following calendar day are accurately attributed without negative durations or chronology errors.
* **Punch Chronology Validation**: For standard day shifts, database-level rules guarantee that punch-out timestamps cannot precede punch-in timestamps.

### 🏖️ Annual Leave Accrual & Overlap Rejection
* **Idempotent Annual Accrual**: Annual leave allocation utilizes a centralized audit ledger (`leave_accrual_batches`). HR managers can safely run annual or monthly leave accruals knowing that rules will never execute twice for the same employee in a given fiscal year.
* **Zero-Overlap Leave Application Rules**: The system prevents employees from submitting overlapping leave applications. Any new leave request overlapping with an existing `Pending` or `Approved` leave record is immediately rejected with clear feedback.
* **Fiscal Year Balance Segregation**: Employee self-service portals display leave balances calculated strictly within the current calendar/fiscal year, keeping past-year records archived and distinct.

### 💵 Payroll Integrity & Automated Calculations
* **Finalized Payroll Protection**: Payroll runs marked `Approved`, `Processed`, or `Paid` are protected against accidental recalculation or overwrites.
* **Automated Overtime & Loan Deductions**: Overtime hours exceeding standard shifts automatically calculate at the statutory 1.5x daily rate. Active employee loan installments (EMI) are automatically factored into net salary calculations.

---

## 5. Integrated Manufacturing & Real-Time Warehouse Ledger

### 🏭 Automated Inventory Consumption & Goods Receipt
* **Closed-Loop Manufacturing**: Completing a Manufacturing Order (`MO`) now automatically executes real-time stock ledger movements:
  * **Raw Material Issue**: Automatically deducts component raw materials from warehouse stock based on the Bill of Materials (BOM), with live stock availability verification.
  * **Finished Goods Receipt**: Automatically receipts the manufactured product into the destination warehouse, calculating accurate weighted unit costs from component consumption.
* **Advisory Locked Order Numbering**: Manufacturing orders utilize transactional advisory locks to guarantee sequential order codes (`MO-00001`, `MO-00002`, etc.) without numbering gaps or conflicts.
* **Transactional BOM Management**: Bills of Materials and manufacturing routing steps save header and line definitions together, ensuring consistent engineering data.

---

## 6. Commercial Project Governance & Two-Stage Review

### 📋 Two-Stage Proposal Review & Approval Workflow
* **Tiered Authorization Verification**: Project commercial proposals feature strict multi-stage sign-offs:
  * **Stage 1 (Technical & Commercial Review)**: Restricted exclusively to the assigned First Reviewer or Senior Management.
  * **Stage 2 (Final Executive Approval)**: Restricted to the designated Final Approver or Managing Director.
* **Mandatory Review Feedback**: Returning or rejecting a proposal requires clear, recorded remarks to maintain a transparent audit trail.
* **Post-Approval Locking**: Approved proposals are automatically locked against revisions, protecting client-bound quotations and contract terms.
* **Atomic Proposal Creation**: Creating a new proposal simultaneously registers the proposal header, initial Revision 1, and audit trail in a single operation.

---

## 7. Precision Timezone Reporting & Disaster Recovery

### 🌐 Local Timezone Financial Alignment
* **Eliminated UTC Date-Rollback Anomalies**: Replaced UTC conversion with local timezone date formatting across all financial audit reports.
* **Impacted Reports**:
  * **Day Book**
  * **General Ledger**
  * **Profit & Loss / Balance Sheet**
  * **Daily Sales Reports**
  * **Cost Center Expense Reports**
* **Business Benefit**: Eliminates the previous early-morning date clipping where transactions recorded before 3:00 AM AST appeared under the prior day.

### 🛡️ Non-Destructive Backup & Recovery
* **Non-Destructive Restoration Architecture**: Completely eliminated destructive table wipe routines from the backup recovery utility.
* **Safe Upsert Engine**: Restoring database snapshots now uses safe record synchronization (`ON CONFLICT UPDATE`), guaranteeing that live business data cannot be erased during maintenance or recovery exercises.

---

## Summary of Feature Upgrades & Business Impact

| Operational Area | Upgrade Delivered | Direct Business Benefit |
| :--- | :--- | :--- |
| **Enterprise Security** | **Multi-Company Switching & Tenant RLS** | Absolute data confidentiality across entities with no risk of cross-company data leakage |
| **Tax Compliance** | **Qatar GTA VAT Return Engine** | Accurate, automated quarterly/annual VAT return generation with standard, zero, and exempt tiers |
| **Financial Operations** | **Row-Level Voucher Concurrency Locks** | Prevents double-posting of payments and journals caused by double-clicks or concurrent accountants |
| **Financial Operations** | **Fail-Closed Fiscal Period Enforcement** | Guarantees all ledger postings map to open periods and prevents posting into closed financial years |
| **Sales & CRM** | **Atomic Quotation & Invoice Engines** | Eliminates orphaned line items and protects settled invoices from accidental post-payment alteration |
| **Sales & CRM** | **Duplicate Conversion Prevention** | Prevents multiple sales invoices from being created against the same accepted quotation |
| **HR & Payroll** | **Idempotent Annual Leave Accrual** | Guarantees employee leave balances are never inflated by duplicate accrual runs |
| **HR & Attendance** | **Overnight Shift & Chronology Verification** | Eliminates attendance punch discrepancies and accurately records night shifts |
| **HR & Leave** | **Database-Level Leave Overlap Rejection** | Blocks conflicting or duplicate leave submissions across all departments |
| **HR & Payroll** | **Finalized Payroll Run Lock** | Protects approved and paid payroll periods from accidental modification or reset |
| **Manufacturing** | **Integrated Warehouse Stock Movements** | Automatically updates inventory upon production completion with real-time costing |
| **Project Management** | **Two-Stage Proposal Review & Locking** | Enforces technical and executive governance before client proposals can be approved |
| **Financial Reporting** | **Local Timezone Date Synchronization** | Accurate date representation across Day Book and GL with zero UTC offset errors |
| **System Reliability** | **Non-Destructive Backup & Restore** | Safe disaster recovery architecture preserving all active operational data |

---

## Deployment & Verification Details

* **Software Build**: Verified with full production bundle compilation (0 errors).
* **Database Deployment**: All 7 database upgrades applied live to Supabase production (`euoaoyzpurbvcoxydunl`) with **zero business data loss and zero downtime**.
* **Repository Synchronization**: Fully synchronized across Git branches (`main`, `master`, `KAA_ERP_SANBOX`) and remotes (`origin`, `backup`).

---

*For technical assistance, workflow inquiries, or user guidance, please contact your KAA ERP Account Lead or System Administrator.*
