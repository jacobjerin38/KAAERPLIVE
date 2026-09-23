# KAA ERP System — Release Notes
**Release Version**: 2.21.0  
**Release Date**: 23 September 2026  
**Audience**: Executive Management, System Administrators, Finance & Accounts Team, Commercial, HR & Operations Teams  

---

## Executive Summary

Release **v2.21.0** represents a landmark enterprise stabilization, security hardening, and data-integrity upgrade across the entire KAA ERP platform and its live Supabase production database. 

Carried out under strict **zero-data-loss safeguards**, this release closes every identified architectural, financial, transactional, and security risk point without modifying, resetting, or deleting a single live business record. All 7 enterprise database migrations were deployed live and verified with 100% backward compatibility.

### Key Milestones Delivered:
1. **Multi-Tenant Isolation & Privilege Lockdown** — Automated database triggers and verified RPCs prevent unauthorized company switching, privilege escalation, or cross-tenant exposure.
2. **Storage Security & Dual Path Compatibility** — Storage policies enforce strict tenant-level access on attachments and sensitive documents while supporting both legacy and module-prefixed paths.
3. **Financial Concurrency Locks & Qatar Tax Engine** — Row-level `FOR UPDATE` concurrency locking, fail-closed accounting period resolution, line-level VAT columns, and canonical Qatar VAT reporting.
4. **CRM Transactional Integrity & Idempotency** — Server-side transactional line persistence for quotations, sales invoices, and delivery notes with duplicate conversion guards.
5. **HR, Payroll & Attendance Safeguards** — Idempotent annual leave accrual batch auditing, payroll rerun locks on finalized runs, punch chronology triggers, and leave overlap rejection.
6. **Manufacturing Stock Ledger Integration** — Production order completion now automatically posts physical raw material consumption and finished goods receipt to the inventory ledger.
7. **Project Management Multi-Stage Governance** — Strict server-side authorization for Stage 1 reviewers and Stage 2 approvers, atomic proposal creation, and post-approval locking.
8. **Data Loss Prevention & Local Timezone Accuracy** — Completely removed destructive database wiping from backup restore utilities and fixed UTC rollback date clipping across all financial reporting modules.

---

## 1. Enterprise Tenant Isolation & Authorization Hardening (P0 & P1)

### 🛡️ Profile Privilege Protection Trigger
* **Immutable Privileged Columns**: Non-administrator users can no longer mutate `company_id`, `role`, or `employee_id` directly on the `profiles` table. An automated `BEFORE UPDATE` trigger (`trg_protect_profile_privileged_fields`) validates caller authority server-side.
* **Controlled Tenant Switch RPC**: Implemented `rpc_switch_active_company(p_company_id)`, which verifies that the user holds an active membership record in `user_company_access` before updating their active session tenant context.
* **Frontend Authentication Context**: Updated `AuthContext.tsx` to automatically invoke `rpc_switch_active_company` with graceful client fallbacks.

### 🔒 Access Lockdown & Security Definer Hardening
* **Revocation of Broad Public/Anon Grants**: Stripped excessive `anon` access grants across project management, MRP, CRM, and workflow tables.
* **Enforced Row Level Security (RLS)**: Enforced tenant-scoped RLS policies on `workflow_instances`, `workflow_requests`, `workflow_action_logs`, `workflows`, `workflow_steps`, and `workflow_levels`.
* **Secured Membership Management**: Locked down `user_company_access` mutations so that only authorized company administrators can grant or revoke tenant access.
* **RPC Search Path Hardening**: Pinned explicit immutable `search_path = public, pg_temp` and verified caller roles on sensitive administrative functions (`admin_update_user`, `admin_delete_user`, and `approve_job_transition`).
* **CRM Views Security Invoker**: Enabled `security_invoker = true` on CRM reporting views (`vw_crm_opportunities`, `vw_crm_leads`, `vw_crm_customers`, and `customers`), ensuring that underlying table RLS policies are strictly respected.

### 📁 Storage Bucket Policies & Dynamic Path Compatibility
* **Dual Path Resolution**: Developed `fn_storage_company_matches` to seamlessly recognize both root UUID paths (`<company_id>/...`) and module-prefixed paths (`crm/<company_id>/...`, `projects/<company_id>/...`).
* **Tenant Storage Isolation**: Enforced authenticated tenant isolation policies across `documents`, `attachments`, `company-assets`, and `employee-documents` storage buckets.
* **Public Careers Portal Safeguard**: Explicitly preserved candidate CV upload capabilities for the public recruitment portal under dedicated `recruitment/` and `careers/` path prefixes.

---

## 2. Financial Operations, Concurrency Locks & Qatar Tax Flow (P2)

### ⚡ Payment & Journal Entry Concurrency Protection
* **Row-Level Posting Locks**: Added `FOR UPDATE` row locks to `rpc_post_accounting_payment` and `rpc_post_accounting_entry`, preventing concurrent double-click race conditions from duplicating journal entries.
* **Fail-Closed Accounting Period Resolution**: Posting functions now strictly require a valid, active accounting period matching the voucher date. If an accounting period does not exist or is marked `locked`, posting is immediately rejected with an actionable error message rather than silently defaulting to an arbitrary period.
* **Real-Time Balance Verification**: Double-entry ledger balance assertion (`|Total Debit - Total Credit| <= 0.01`) enforced before committing any payment or journal voucher.

### 🇶🇦 Qatar VAT Tax Engine & Canonical Reporting
* **Line-Level Tax Tracking**: Added `tax_id`, `tax_rate`, `tax_amount`, and `taxable_amount` columns directly onto `accounting_journal_lines`.
* **Client PO Metadata on Entries**: Added `client_po_number` and `client_po_date` to `accounting_journal_entries`.
* **Canonical Qatar VAT Report Function**: Deployed `rpc_get_qatar_vat_report(p_start_date, p_end_date)`:
  * Computes standard-rated (5%), zero-rated, and exempt output VAT from posted sales invoices.
  * Computes standard-rated, zero-rated, and exempt input VAT from posted vendor bills.
  * Provides backward-compatible fallback for historical move lines.
  * Automatically calculates net VAT payable/refundable for tax compliance filing.

### 📦 Physical Stock Availability & Costing Checks
* **Real-Time Stock Availability Assertion**: Updated `rpc_process_stock_movement` so that all inventory `OUT` (Issue) movements verify that sufficient on-hand quantity exists before deducting stock.
* **Cost Valuation Resolution**: Replaced zero-cost issues with automated fallback to `standard_cost` or `purchase_price` from `item_master`.
* **Automated Order State Checks**: `rpc_receive_purchase_order` and `rpc_ship_sales_order` now lock and validate that the order is in `confirmed` status before applying line mutations.
* **Bank Reconciliation Hardening**: `rpc_reconcile_statement_line` now locks both the statement line and payment voucher rows `FOR UPDATE`, enforces tenant ownership matching, asserts exact amount equality, and marks both sides reconciled atomically.

---

## 3. CRM & Commercial Operations (P3)

### 📑 Transactional Line Persistence & Conversions
* **Atomic Quotation Line Replacement**: Deployed `rpc_save_crm_quotation_lines`, which locks the quotation header, updates line items, and atomically recalculates `subtotal`, `discount_amount`, `tax_amount`, and `grand_total` in a single database transaction.
* **Atomic Sales Invoice Line Replacement**: Deployed `rpc_save_crm_sales_invoice_lines` with built-in protection against modifying lines on settled (`Paid`) invoices.
* **Atomic Delivery Note Line Replacement**: Deployed `rpc_save_crm_delivery_note_lines` ensuring ordered vs. delivered quantity integrity.
* **Duplicate Conversion Guards**: Deployed `rpc_convert_quotation_to_invoice` with server-side checks that prevent converting the same quotation multiple times into redundant sales invoices.

---

## 4. HRMS, Attendance, Leave & Payroll Safety (P4)

### 🏖️ Idempotent Annual Leave Accrual
* **Accrual Batch Audit Ledger**: Created `leave_accrual_batches` with a unique constraint on `(company_id, year, rule_id)`.
* **Idempotent Accrual Execution**: `rpc_run_leave_accrual` now records batch runs and automatically skips rules already executed for the specified fiscal year, preventing accidental balance inflation.
* **Current-Year Leave Isolation**: Updated employee self-service leave balance calculations to filter leaves by application year, preventing prior-year requests from distorting current balances.

### ⏱️ Attendance Punch Chronology Trigger
* **Database Chronology Validation**: Added trigger `trg_validate_attendance_punches` on `attendance`. If `check_out` occurs earlier than `check_in`, the transaction is blocked unless the assigned shift is explicitly flagged as an overnight shift (`is_overnight = true`).
* **Workflow Finalization Resilience**: Hardened `WorkflowEngine.ts` to detect cross-midnight shift punches and prevent negative duration clamping.

### 🚫 Overlapping Leave Application Guard
* **Database Overlap Trigger**: Added trigger `trg_validate_leave_no_overlap` on `leaves`. Rejects any new or updated leave request whose date range overlaps with an existing `Pending` or `Approved` leave application for the same employee.
* **Client-Side Pre-Validation**: Added pre-submission overlap checks in the leave modal for immediate user feedback.

### 💵 Finalized Payroll Run Protection
* **Regeneration Lockdown**: `rpc_generate_payroll` now asserts row locks and strictly forbids regenerating or resetting payroll periods that have been marked `APPROVED`, `PROCESSED`, `PAID`, or `FINALIZED`.

---

## 5. Manufacturing & Inventory Integration (P5)

### 🏭 Automated Stock Ledger Integration
* **Production Completion Posting**: Updated `rpc_complete_production` to automatically post physical inventory movements upon completion:
  * Consumes component raw materials (`ISSUE` transaction and `OUT` stock movement) with stock availability checks.
  * Receipts the completed finished product (`GRN` transaction and `IN` stock movement) with accurate weighted component costing.
  * Synchronizes production move lines with inventory transaction IDs.
* **Advisory Locked Order Sequencing**: `rpc_create_production_order` uses PostgreSQL transaction-level advisory locks (`pg_advisory_xact_lock`) to guarantee sequential, gap-free manufacturing order numbers (`MO-XXXXX`) without race conditions.
* **Transactional BOM Persistence**: Deployed `rpc_save_mrp_bom` to atomically save BOM header and component lines.

---

## 6. Project Management Security & Governance (P6)

### 📑 Two-Stage Proposal Review & Approval Workflow
* **Server-Side Authorization Enforcement**: Deployed `rpc_review_project_proposal` to strictly enforce multi-stage governance:
  * **Stage 1 (`PENDING_FIRST_REVIEW`)**: Only the designated `first_reviewer_id` (or Super Administrator) can approve, return, or reject.
  * **Stage 2 (`PENDING_FINAL_APPROVAL`)**: Only the designated `final_approver_id` (or Super Administrator) can grant final approval.
* **Mandatory Return/Rejection Remarks**: Server-side validation requires explanatory remarks when returning or rejecting proposals.
* **Immutable Approved State**: Proposals are automatically locked (`is_locked = true`) upon final approval, preventing further modifications.
* **Atomic Proposal Creation**: Deployed `rpc_create_project_proposal` to insert the proposal header, initial Revision 1, and initial audit trail entry within a single atomic database transaction.

---

## 7. Data Loss Prevention & Local Timezone Accuracy (P7)

### 🛡️ Non-Destructive Backup & Restore Engine
* **Eliminated Destructive Deletion Loops**: Completely removed legacy `.delete()` loops from `backupRestore.ts` that previously wiped database tables before importing backup files.
* **Safe Format Validation**: Added schema structure checks (`validateBackupIntegrity`) before initiating restores.
* **Safe Upsert Architecture**: Restores now execute purely non-destructive upserts (`onConflict: 'id'`), preserving existing records and returning detailed table-by-table restore summaries.

### 🌐 Local Timezone Date Localization
* **Eliminated UTC Rollback Bugs**: Introduced `formatLocalDate()` in `lib/dateFormat.ts` to format dates according to the user's local timezone rather than UTC ISO strings.
* **Protected Financial Reports**: Applied local date formatting across:
  * `DayBook.tsx`
  * `GeneralLedger.tsx`
  * `FinancialReports.tsx`
  * `DailySalesReport.tsx`
  * `ExpenseReport.tsx`
* **Impact**: Eliminates the common Gulf/Asian (+03:00 / +05:30) morning issue where vouchers generated early in the day would roll back to the previous day's date.

---

## 8. Database Migrations & Verification Summary

All 7 remediation migrations were applied to the live production database (`euoaoyzpurbvcoxydunl`, project **KAA_ERP**):

| Migration File | Name in Database | Scope / Key Assets |
| :--- | :--- | :--- |
| `20260923180000` | `remediation_p0_tenant_isolation_and_security` | Profile triggers, switch RPC, anon revokes, RLS, search_path |
| `20260923190000` | `remediation_p1_storage_policies_and_crm_paths` | Storage bucket policies, dual path matching, recruitment bucket |
| `20260923200000` | `remediation_p2_accounting_locking_and_tax_flow` | Locking in post RPCs, line tax columns, Qatar VAT, stock validation |
| `20260923210000` | `remediation_p3_crm_transactional_operations` | Atomic quote/invoice/delivery note lines, duplicate conversion guards |
| `20260923220000` | `remediation_p4_payroll_idempotency_and_leave_safety` | Leave accrual batches, punch chronology trigger, leave overlap trigger |
| `20260923230000` | `remediation_p5_manufacturing_inventory_integration` | Stock ledger posting on MO completion, advisory locks, BOM RPC |
| `20260924000000` | `remediation_p6_project_management_security_and_workflows` | Server-side proposal review, 2-stage approval, atomic creation RPC |

### Quality & Build Verification
* **TypeScript & Bundler**: `npm.cmd run build` compiled cleanly in **7.11s** with **0 errors**.
* **Live Database Status**: 100% data preservation confirmed. Zero records deleted, truncated, or overwritten.
* **Git Synchronization**:
  * Head Commit: `ec41280`
  * Branches in Sync: `main`, `master`, `KAA_ERP_SANBOX`
  * Remotes in Sync: `origin` (jacobjerin38/KAAERPLIVE) & `backup` (jerinjacobdream11-lang/KAAERPLIVE)

---

*For further technical specifications, refer to [walkthrough.md](file:///c:/Users/jacob/OneDrive/Documents/KAA-ERP-Live1/walkthrough.md) and [implementation_plan.md](file:///c:/Users/jacob/OneDrive/Documents/KAA-ERP-Live1/implementation_plan.md).*
