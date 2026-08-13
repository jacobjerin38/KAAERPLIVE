# KAA ERP Hub — Comprehensive Project Documentation & Architecture (v2.6.0)

> **Current Version:** `v2.6.0` (Production Live Ready)  
> **Live Supabase Project Ref:** `euoaoyzpurbvcoxydunl`  
> **Repository:** GitHub (`origin/main` & `backup/main`)  
> **System Architecture:** React 18 + Vite 5 + TypeScript + Tailwind CSS + Supabase PostgreSQL (Strict RLS & RPC Logic)

---

## 1. Executive Summary & Production Status

**KAA ERP Hub** is a multi-tenant, enterprise-grade Enterprise Resource Planning system. It unifies 22 core business modules under a single responsive web interface with row-level security (RLS), deterministic database RPC logic, and a dynamic trigger-based Workflow Approval Engine.

### 🌟 Key Live Milestones (v2.6.0 Release)
- **Authoritative Client Chart of Accounts (PEC)**: Idempotently seeded 130 accounts (24 Header/Group Accounts + 106 Posting Accounts) with parent-child tree hierarchy, debit/credit balance types, and transaction posting safeguards.
- **PRO (Mandoob) Government Services Hub**: Dedicated module for Qatar/GCC government service requests, visa/QID renewals, CR renewals, and PRO agent task dispatching.
- **Overtime Rules & 3-Level Approval Authority**: Multi-level overtime multipliers (1.5x standard, 2.0x weekend/holiday), daily OT caps, and per-employee 3-tier approval authority mapping (`employee_ot_authority`).
- **ESSP Missed Punch Workflow**: Request Missed Punch modal with live open-session verification (`check_out IS NULL`) and HR Attendance approval inbox.
- **Night Shift Cross-Midnight Punch Processing**: Support for 16-hour overnight shifts (`is_overnight = true`) with auto-pairing of hardware biometric logs.
- **Dynamic Roles & Permissions Matrix**: 17 module permission categories with real-time permission filter search, role creation modal, and wildcard admin bypass (`*`).

---

## 2. Technology Stack & Architectural Principles

### A. Core Stack
- **Frontend Framework:** React 18.2.0 + TypeScript 5.0.2 + Vite 5.4.21
- **Styling:** Tailwind CSS 3.4.17 (Light/Dark theme support)
- **Icons & Charts:** Lucide React + Recharts
- **State & Router:** Context API + React Router DOM 7.12.0
- **Database & Auth:** Supabase PostgreSQL 17.6 + Supabase Auth + Supabase Storage

### B. Architectural Guarantees
1. **Multi-Tenancy Isolation:** Every database table includes `company_id UUID REFERENCES public.companies(id)`. Row Level Security (RLS) policies enforce multi-tenant isolation.
2. **Database Business Logic (RPC):** All critical computations (FIFO inventory valuation, payroll calculations, ledger posting, stock putaway) are executed inside PostgreSQL PL/pgSQL functions for sub-millisecond atomic transactions.
3. **Audit Trail & Document Lifecycle:** Transactional documents transition through `Draft` $\rightarrow$ `Confirmed` $\rightarrow$ `Posted` $\rightarrow$ `Locked/Closed`. Posted entries generate correcting entries rather than destructive deletions.
4. **On-Demand Module Mount (Keep-Alive):** Modules mount on demand when first visited, reducing initial startup network concurrency while preserving full component state in memory.

---

## 3. System Navigation & Route Map

Below is the complete registry of all 22 system modules registered in [`types.ts`](file:///c:/Users/jacob/OneDrive/Documents/KAA-ERP-Live1/types.ts), [`constants.tsx`](file:///c:/Users/jacob/OneDrive/Documents/KAA-ERP-Live1/constants.tsx), and [`App.tsx`](file:///c:/Users/jacob/OneDrive/Documents/KAA-ERP-Live1/App.tsx):

| Module Name | Route | Permission Key | Category / Scope |
|---|---|---|---|
| 🏢 **Organisation** | `/organisation` | `org.structure.view` | Structure, Masters, Roles, Workflows, Settings |
| 👥 **Employees** | `/employees` | `hrms.employees.view` | Directory, Profiles, Geolocation, Immigration |
| ⏱️ **Attendance** | `/attendance` | `hrms.attendance.view` | Daily/Monthly Logs, Shifts, Duty Roster, OT Rules |
| 📅 **Leave** | `/leave` | `hrms.leave.view` | Leave Applications, Accruals, Balances, Calendar |
| 💰 **Payroll** | `/payroll` | `finance.payroll.view` | Salary Runs, WPS Export, Payslips, Settlements |
| 👤 **ESSP** | `/essp` | `essp.view` | Self-Service, Punch In/Out, Missed Punch, Approvals |
| 🛡️ **PRO (Mandoob)** | `/pro` | `pro.view` | Govt Services, QID/Visa Renewals, Agent Tasks |
| 🤝 **CRM** | `/crm` | `crm.dashboard.view` | Leads, Deals, Pipelines, Contacts, AI Finder |
| 🛒 **Sales** | `/sales` | `sales.view` | Quotations, Sales Orders, Credit Limits, Invoices |
| 🧮 **Accounting** | `/accounting` | `finance.dashboard.view` | Chart of Accounts, Ledgers, Payments, Financial Reports |
| 📦 **Inventory** | `/inventory` | `inventory.view` | Item Master, Warehouses, Stock Ledger, Reservations |
| 🛍️ **Procurement** | `/procurement` | `procurement.view` | Requisitions, POs, GRNs, Vendor Bills |
| 🏭 **Manufacturing** | `/manufacturing` | `manufacturing.view` | BOM, Work Centers, Production Orders |
| 📋 **Projects** | `/projects` | `projects.view` | Task Boards, Milestones, Timesheets |
| 🎧 **Help Desk** | `/help_desk` | `hrms.helpdesk.view` | Support Tickets, SLAs, Customer Escalations |
| 📢 **Marketing** | `/marketing` | `marketing.view` | Campaigns, Leads Automation, Analytics |
| 📄 **Documents** | `/documents` | `documents.view` | Policies, Contracts, Document Vault |
| 💼 **Recruitment** | `/recruitment` | `recruitment.view` | ATS, Job Postings, Public Careers Portal (`/careers`) |
| 💵 **Loans & Benefits**| `/loans` | `loans.view` | Advances, Loan Repayment, Insurance Claims |
| 🏆 **Performance** | `/performance` | `performance.view` | Goals, OKRs, Performance Appraisals |
| ✈️ **Travel & Expenses**| `/travel` | `travel.view` | Trip Requests, Expense Claims, Receipts |
| 💬 **Team Chat** | `/chat` | Open for All | Real-Time Direct & Channel Messaging |

---

## 4. Module Specifications, Forms & Workflows

### A. 🛡️ PRO (Mandoob) Module (`/pro`)
Designed specifically for GCC/Qatar corporate public relations officer operations.
- **Government Service Requests**: Submit, track, and process Visa Applications, QID Renewals, Passport Renewals, Commercial Registration (CR) Renewals, Computer Card Updates, Trade License Renewals, and Work Permits.
- **Workflow Lifecycle**: `Draft` $\rightarrow$ `Submitted` $\rightarrow$ `PRO Agent Assigned` $\rightarrow$ `In Progress` $\rightarrow$ `Govt Approved` $\rightarrow$ `Completed`.
- **Renewal Tracker**: Automated expiry alert dashboard displaying upcoming document expirations (30, 60, 90 days).
- **Task & Expense Management**: Assign tasks to PRO agents with document attachment upload and government fee expense logging.

### B. 🧮 Accounting Module (`/accounting`)
Complete double-entry accounting engine fully integrated with operational modules.
- **Authoritative Chart of Accounts (PEC)**:
  - 24 Structural Header/Group Accounts (`is_group = true`) e.g. `1005 - Cash in Bank`, `1100 - Accounts Receivables`, `1500 - Fixed Assets`, `2000 - Accounts Payables`, `5000 - Cost of Sales`.
  - 106 Posting Accounts (`is_group = false`) relationally linked via `parent_id` (e.g. `1020 - Cash in Bank - QIIB`, `1021 - Cash in Bank - CBQ`).
  - **Posting Restriction**: Journal entry posting screens automatically restrict selection to `is_group = false` accounts.
- **Excel COA Import Engine**: Flexible column mapping parser for bulk importing client account structures.
- **Financial Reports**:
  1. **Balance Sheet**: Assets vs. Liabilities + Equity with drill-down (`rpc_get_accounting_balance_sheet`).
  2. **Profit & Loss**: Operating Revenue vs. Operating/Non-Operating Expenses (`rpc_get_accounting_profit_loss`).
  3. **Trial Balance**: Debit/Credit validation report (`rpc_get_accounting_trial_balance`).
  4. **Aging Report**: Partner Receivables & Payables bucketed into Current, 1-30, 31-60, 61-90, 90+ days (`rpc_get_accounting_partner_aging`).
  5. **Cash Book**: Running cash balance log (`rpc_get_cash_book`).
  6. **Qatar VAT Report**: Tax output vs. input VAT calculations (`rpc_get_qatar_vat_report`).

### C. ⏱️ Attendance & Overtime Engine (`/attendance`)
- **Punch Modes & Geolocation**: Supports Web, Mobile GPS Geofencing (latitude, longitude, radius in meters), and Biometric Hardware Webhook sync.
- **Night Shift Engine**: Supports 16-hour overnight shifts (`is_overnight = true`) where `start_time > end_time`. Automatically pairs check-in and check-out logs spanning midnight.
- **Overtime Rules & Authority**:
  - Configurable OT threshold hours, standard OT multiplier (1.5x), weekend multiplier (2.0x), holiday multiplier (2.0x), and max daily OT cap.
  - Per-employee 3-tier OT Approval Authority mapping (`approver_level_1`, `approver_level_2`, `approver_level_3`).

### D. 👤 ESSP (Employee Self-Service Portal) (`/essp`)
- **Punch Widget**: Real-time Punch In/Out with open session query (`check_out IS NULL`).
- **Missed Punch Application**: Employees submit missed punch correction requests. Appears in HR Attendance approval tab (`missed_punch_requests`).
- **Unified Approvals Inbox**: Managers and HR review leave requests, missed punches, expense claims, and PRO requests with one-click approval/rejection.

### E. 🏢 Organisation, Roles & Permissions (`/organisation`)
- **Roles & Permissions Matrix**: Central RBAC editor featuring 17 module permission categories (`PRO (Mandoob)`, `HRMS`, `ESSP`, `CRM`, `Sales`, `Organisation`, `Finance`, `Inventory`, etc.).
- **Permission Search Filter**: Real-time search bar inside the Role Editor modal to instantly locate permissions.
- **Unified Workflow Engine (`lib/WorkflowEngine.ts`)**: Governs sequential approvals with audit logs in `workflow_action_logs`.

---

## 5. Master Database Schema Overview

```
public.companies                    (Entity isolation for multi-tenancy)
public.profiles                     (User accounts, roles, company linkage)
public.roles                        (Role definitions & text[] permissions)
public.user_permissions             (Per-user permission overrides)
public.employees                    (Master employee records, punch mode, geo fields)
public.attendance                   (Daily attendance logs, check-in/out, lat/lng, duration)
public.org_shift_timings            (Shifts, shift_type, is_overnight, weekly_off_days)
public.attendance_settings          (Grace periods, OT multipliers, max OT hours)
public.employee_ot_authority        (3-tier OT approver mappings per employee)
public.missed_punch_requests        (Employee missed punch requests & approval status)
public.pro_service_requests         (PRO govt service requests, status, agent ID)
public.accounting_chart_of_accounts (COA accounts, code, name, type, subtype, is_group, parent_id)
public.accounting_moves             (Journal entry headers)
public.accounting_move_lines        (Double-entry ledger lines)
public.accounting_payments          (Payment records, payment_category, bank details)
public.item_master                  (Global inventory items, valuation method)
public.inventory_transactions       (Central stock movement ledger)
public.workflows                    (Approval workflow headers)
public.workflow_levels              (Sequential approval steps per workflow)
public.workflow_instances           (Active approval instances)
```

---

## 6. Verification & Build Integrity

- **TypeScript Compilation**: `npx tsc --noEmit` (**0 Errors**).
- **Production Bundle**: `npm run build` (**Vite 5.4.21 Build Verified**).
- **Live Database Audit**: All 60 database migrations applied and verified on live Supabase project `euoaoyzpurbvcoxydunl`.
- **Git Repository**: Synced to both GitHub remotes (`origin/main` & `backup/main`).

---
*Documentation updated: August 14, 2026 — Verified by Senior ERP Database & Accounting Architect.*
