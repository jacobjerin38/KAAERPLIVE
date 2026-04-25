# KAA ERP Hub - Project Overview

## 1. Project Description
**KAA ERP Hub** is a comprehensive Enterprise Resource Planning (ERP) system designed to streamline business operations. It features a modular architecture, integrating key business functions into a unified platform. The application is built with a modern tech stack ensuring performance, scalability, and a premium user experience.

## 2. Technology Stack

### Project Phases & Roadmap
| Phase | Scope | Status |
| :--- | :--- | :--- |
| **Phase 1** | Core ERP, Org, HRMS, ESSP, CRM | ✅ Completed |
| **Phase 2** | Inventory + WMS + Accounting (Foundation) | ✅ Core Completed |
| **Phase 3** | Manufacturing (MRP) | 🔄 In Progress |
| **Phase 4** | Procurement & Sales | 📅 Planned |
| **Phase 5** | Advanced Finance, Analytics, Integrations | 📅 Planned |

### Key Architectural Highlights
- **Supabase RPC:** All critical business logic (Inventory moves, posting journals, payroll) resides in database functions for consistency and performance.
- **Strict RLS:** Multi-tenancy is enforced at the database row level.
- **Inventory-First Accounting:** Financial entries are downstream effects of operational actions (e.g., Goods Receipt triggers Asset recognition).
- **Deterministic Engines:** Payroll and Inventory Valuation (FIFO) are calculated typically, not heuristically.

## 3. Core Architectural Concepts

### A. Document Lifecycle Model
The ERP operates on documents, ensuring a clear audit trail. Most transactional documents follow this lifecycle:
- **Draft:** Editable, no impact on stock or ledger.
- **Confirmed:** Validated, reserves stock/budget.
- **Posted:** Finalized, updates ledgers/stock, immutable.
- **Locked/Closed:** Period closed, no further actions.
- **Reversed:** CORRECTING entry created (original never deleted).

### B. Module Contracts & Data Flow
To prevent circular dependencies and ensuring data integrity:
1.  **Manufacturing $\rightarrow$ Inventory:** MRP does *not* update stock directly. It calls Inventory RPCs (`issue_material`, `receive_finished_good`).
2.  **CRM $\rightarrow$ Inventory $\rightarrow$ Accounting:**
    - CRM (Sales Order) $\rightarrow$ Inventory (Reservation/Delivery) $\rightarrow$ Accounting (Invoice + COGS).
    - CRM never posts directly to accounting.
3.  **Inventory $\rightarrow$ Accounting:** Stock movements trigger financial journal entries automatically.

### C. Unified Workflow Engine (`lib/WorkflowEngine.ts`)
A centralized, multi-step approval engine that governs critical business actions:
- **Trigger-Based:** Workflows are matched by `trigger_type` (e.g., `LEAVE_REQUEST`, `RESIGNATION`, `EXPENSE_CLAIM`).
- **Multi-Step:** Supports sequential approval steps with `workflow_steps` ordering.
- **Smart Assignment:** Auto-assigns to the employee's `manager_id` for manager-level steps, or to a role for role-based steps.
- **Action Logging:** Every approve/reject action is recorded in `workflow_action_logs` for full audit trail.
- **Entity Finalization:** On completion, the engine automatically updates the source record (e.g., sets leave status to `Approved`).
- **Covers:** Leave Requests, Resignations, Expense Claims, Stock Adjustments, Journal Reversals, Production Orders, Vendor Bill Approvals.

### D. Reporting Platform
Reporting is metadata-driven, allowing for:
- Saved, reusable report configurations.
- Cross-module data blending.
- Dynamic date ranges and drill-down capabilities.

## 4. Project Structure

### Frontend
- **Framework:** [React](https://react.dev/) (v18.2.0)
- **Build Tool:** [Vite](https://vitejs.dev/) (v5.2.0)
- **Language:** [TypeScript](https://www.typescriptlang.org/) (v5.0.2)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) (v3.4.17) with PostCSS and Autoprefixer.
- **Icons:** [Lucide React](https://lucide.dev/)
- **Charts:** [Recharts](https://recharts.org/)
- **Routing:** [React Router DOM](https://reactrouter.com/) (v7.12.0)

### Backend & Database
- **Platform:** [Supabase](https://supabase.com/)
- **Database:** PostgreSQL
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **API Client:** `@supabase/supabase-js`

## 3. Project Structure

```
/
├── .env                  # Environment variables
├── App.tsx               # Main application component / Routing
├── components/           # UI Components and Modules
│   ├── crm/              # CRM specific components
│   ├── hrms/             # HRMS specific components
│   ├── modules/          # Business Logic Modules (CRM, HRMS, ESSP, etc.)
│   └── ui/               # Reusable UI components
├── contexts/             # React Contexts (e.g., Auth, Theme)
├── lib/                  # Library/Utility code (Supabase client, Helpers)
├── supabase/             # Supabase configurations and migrations
│   ├── migrations/       # Database migration files
│   ├── functions/        # Edge functions
│   └── supabase_schema.sql # Core database schema definition
├── types.ts              # Global TypeScript definitions
└── vite.config.ts        # Vite configuration
```

## 5. Key Modules

### A. Core & Organisation
- **Dashboard:** Central hub for widgets and key metrics.
- **Organisation:** Master data management.
    - **Masters:** Departments, Designations, Employment Types, Salary Components, etc.
    - **Company Profile:** Corporate identity and settings.
    - **User Management:** Profiles and RBAC.

### B. HRMS (Human Resource Management System)
- **Employees:** Comprehensive employee profiles with 6 tabs (Basic, Job, Payroll, Documents, Immigration, Overview). Includes DoB, age calculation, nationality (from `org_nationalities` master), memo/remarks fields, and profile photo upload.
- **Attendance (5 Sub-Tabs):**
    - **Overview:** Real-time dashboard with Present/Absent/Half Day/On Leave/Not Marked stats and avg hours.
    - **Daily:** Date-selectable daily log with manual punch add/edit, "Mark All Present", CSV export, and **Process/Unprocess Day** locking.
    - **Monthly:** Per-employee calendar view with color-coded day cells, inline edit modal, and month-level processing with `attendance_periods` integration.
    - **Shifts:** Full CRUD for `org_shift_timings` with start/end times and **per-shift weekly off-day configuration**.
    - **Duty Roster:** Drag-and-drop shift assignment per employee per date via `duty_roster` table.
- **Configurable Off-Days:** Multi-level hierarchy: Company default (`org_attendance_settings.default_weekly_off_days`) → Shift-level override (`org_shift_timings.weekly_off_days`) → Future: Duty roster override.
- **Leaves:** Leave request management with workflow-driven approvals via `WorkflowEngine`. Leave types and balances loaded dynamically from `org_leave_types`.
- **Payroll:**
    - Batch processing with Draft → Completed → Paid lifecycle.
    - Individual record adjustment (gross/deductions) in Draft mode.
    - **Full & Final Settlement** modal (Notice Pay, Leave Encashment, Gratuity, Loan Recovery).
    - **WPS Export (Qatar)** — CSV generation with Employee QID, Visa ID, Bank details.
    - Payslip modal with company logo branding and dynamic currency.
- **Settings Module (3 Tabs):**
    - **Attendance & Overtime:** Grace timing, minimum OT minutes, mobile attendance toggle.
    - **Holiday Calendar:** CRUD for `org_holidays` with date and description.
    - **Biometric Devices:** Device Integration Hub — webhook endpoint display, API key generation, enable/disable sync.

### C. ESSP (Employee Self-Service Portal)
Powered by a dedicated `ESSPContext` that auto-resolves the logged-in user's employee profile, manager, and role flags (`isManager`, `isHR`, `isApprover`).
- **Dashboard:** Punch In/Out with geolocation, leave balance (dynamic from `org_leave_types`), last salary, announcements feed, and upcoming holidays.
- **AI Assistant:** Chat-based "Super Agent" providing contextual answers about leaves, salary, and career data.
- **Skills & Growth:** Skill dashboard with gap analysis, readiness score, and integrated **Career Timeline** component (real data from `employee_transitions`).
- **My Approvals:** Unified approval inbox powered by `WorkflowEngine` — view pending requests with employee details, approve/reject with audit logging.
- **My Profile:** Full read-only profile view (Professional, Personal, Financial, Work Location details) with profile photo.
- **My Attendance / Team Attendance:** Personal attendance log and manager view for direct reports.
- **Missed Punch Requests:** Employees can submit correction requests with time details.
- **Leaves, Payslips, Assets, Support, Resignation, Announcements, Surveys, Kudos, Directory, Learning, Reports.**

### D. CRM (Customer Relationship Management)
- **Leads & Deals:** Pipeline management with stages (Open, Won, Lost).
- **Contacts:** Client and contact person database.
- **Tasks:** Activity tracking and task assignment.
- **Website Finder:** AI-powered tool to find company websites and details.
> **Note:** CRM does not post accounting directly. All financial impact flows through Inventory and Accounting modules.

### E. Inventory & Warehouse (Phase 2)
- **Inventory:**
    - Item Master with valuation methods (FIFO, Weighted Average).
    - Stock Ledger & FIFO Layer maintenance.
    - Reservation Engine to prevent overselling.
- **Warehouse (WMS):**
    - Multi-warehouse, Zone, and Bin management.
    - Stock movements (GRN, Putaway, Pick, Pack, Ship).
    - Inter-warehouse transfers (No accounting impact).

### F. Accounting (Phase 2.2 - Enterprise Upgrades Completed)
- **Chart of Accounts:** Hierarchy with Account Groups (Asset, Liability, Equity, Income, Expense).
- **Invoicing:** Customer Invoices (AR) & Vendor Bills (AP). Integrated with Inventory.
    - **Customer Credit Limits:** Enforced on `accounting_partners` — warns/blocks invoices exceeding `credit_limit`.
    - **Multi-Stage Bill Approval:** Vendor bills route through `WorkflowEngine` with configurable approval workflows.
- **Payments & Banking:** Payment registration and Reconciliation.
- **Fiscal Control:** Period Locking, Tax Engine, Multi-currency (QAR default).
- **Financial Reports (4 Reports):**
    - **Balance Sheet** (`rpc_get_balance_sheet`) — Assets vs Liabilities + Equity with account-level drill-down.
    - **Profit & Loss** (`rpc_get_profit_loss`) — Income vs Expense with date range filtering.
    - **Trial Balance** (`rpc_get_trial_balance`) — All accounts with Debit/Credit totals and balance verification.
    - **Aging Report** (`rpc_get_partner_aging`) — Receivables/Payables bucketed into Current, 1-30, 31-60, 61-90, 90+ days.
- **Cash Book** (`rpc_get_cash_book`) — Date-filtered ledger showing Cash In (Debit), Cash Out (Credit), and running balance.
*Pending: Localization packs, Deferred revenue, Advanced Assets.*

### G. Manufacturing (Phase 3 - In Progress)
- **Phase 3.1: Core Schema (Locked)**
    - `mrp_work_centers`, `mrp_routing`, `mrp_bom` (Header/Lines).
    - `mrp_production_orders`, `mrp_production_moves`.
    - Item Master extensions: `is_manufactured`, `default_bom_id`.
- **Phase 3.2: Logic (RPC-Driven)**
    - `rpc_create_production_order`: BOM explosion.
    - `rpc_reserve_raw_materials`: Hard allocation.
    - `rpc_consume_materials`: Triggers Inventory Issue.
    - `rpc_complete_production`: Triggers Inventory Receipt.
- **Phase 3.3: UI**: Dashboard, BOM Manager, Work Order Lifecycle.

### H. Procurement & Sales (Phase 4 - Planned)
- **Procurement:** Requisition $\rightarrow$ RFQ $\rightarrow$ PO $\rightarrow$ GRN $\rightarrow$ Bill.
- **Sales:** Quote $\rightarrow$ SO $\rightarrow$ Reservation $\rightarrow$ Delivery $\rightarrow$ Invoice.
- **Unified Partner Master:** Shared Customer/Vendor profiles with usage-specific settings.

## 6. Database Schema Overview

### Core Tables
- `profiles`: Extends Supabase auth.users with application-specific user data.
- `roles`: Role-based access control definitions.
- `companies`: Multi-tenancy support (Entity isolation).

### Organisation Masters
- `org_departments`, `org_designations`, `org_employment_types`
- `org_salary_components` (Earnings/Deductions)
- `org_leave_types`, `org_shift_timings` (with `weekly_off_days`)
- `org_nationalities`, `org_banks`
- `org_holidays`: Company holiday calendar
- `org_attendance_settings`: Grace timing, OT rules, mobile attendance, biometric config, default weekly off-days

### HRMS Tables
- `employees`: Central employee table with DoB, nationality_id FK, memo, remarks, profile_photo_url, and immigration fields.
- `attendance`: Daily attendance logs with `check_in`, `check_out`, `total_hours`, `source` (punch/manual/biometric), `is_processed` flag, `shift_id`, geo-location fields, and edit audit trail (`edited_by`, `edited_at`, `edit_reason`).
- `attendance_periods`: Monthly processing periods with lock status.
- `duty_roster`: Employee-shift-date assignments.
- `leaves`: Leave applications with workflow-driven status.
- `payroll_runs`, `payroll_records`: Batch payroll processing with Draft/Completed/Paid lifecycle.
- `employee_transitions`: Career timeline events (promotions, transfers, etc.).

### Workflow Tables
- `workflows`: Configurable approval workflows per trigger type.
- `workflow_steps`: Ordered approval steps within a workflow.
- `workflow_instances`: Active instances tracking current step, status, and assignee.
- `workflow_action_logs`: Full audit trail of approve/reject actions.

### CRM Tables
- `crm_deals`, `crm_contacts`, `crm_tasks`
- `crm_stages`, `crm_lead_sources`
- `crm_activities`: Audit log of CRM actions.

### Inventory & WMS Tables (Phase 2 & 2.1)
- `item_master`: Global item definitions.
- `inventory_transactions`: Central stock ledger.
- `inventory_reservations`: Stock blocking mechanism.
- `warehouses`, `warehouse_zones`, `warehouse_bins`: Physical storage structure.
- `stock_movements`: WMS movement logs.
- `putaway_rules`: Logic for auto-routing stock to bins.
- `inventory_adjustments`: Cycle counts and stock corrections.

### Accounting Tables (Phase 2.2 - 2.5)
- `chart_of_accounts`, `account_groups`: Core financial structure.
- `accounting_moves`, `accounting_move_lines`: Double-entry ledger.
- `accounting_partners`: Customer/Vendor centralized directory.
- `accounting_payments`: Money flow tracking.
- `bank_statements`, `bank_statement_lines`: Reconciliation data.
- `fiscal_years`, `accounting_periods`: Time-bound controls.
- `taxes`, `journals`: Configuration masters.

### Manufacturing Tables (Phase 3 - Upcoming)
- `mrp_bom`, `mrp_bom_lines`: Product structures.
- `mrp_work_centers`: Production locations.
- `mrp_production_orders`: Work order management.
- `mrp_production_moves`: Stock impact of production.

## 7. Setup & Installation

### Prerequisites
- Node.js (Latest LTS recommended)
- npm or yarn
- Supabase project credentials

### Installation
1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd kaa-erp-hub
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root directory:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```

5.  **Build for Production:**
    ```bash
    npm run build
    ```

## 8. Backend Logic (Supabase)
The project utilizes Supabase **RPC (Remote Procedure Calls)** for complex logic to ensure data integrity and performance.

- **RPC Functions:**
    - `rpc_punch_action`: Handles complex attendance logic (Check-in/Check-out validation).
    - `rpc_generate_payroll`: Automates payroll calculation based on attendance and salary structure.
    - `rpc_vote_poll`: Handles atomic voting logic for Buzz polls.
    - **Accounting:** `rpc_post_move`, `rpc_create_invoice`, `rpc_post_payment`, `rpc_get_balance_sheet`, `rpc_get_profit_loss`, `rpc_get_trial_balance`, `rpc_get_partner_aging`, `rpc_get_cash_book`.
    - **Inventory:** `rpc_process_putaway`, `rpc_approve_stock_adjustment`.

- **Edge Functions:**
    - `device-sync`: Biometric device webhook (POST). Authenticates via `x-api-key` header against `org_attendance_settings.biometric_api_key`. Accepts `PUNCH` payloads with `employee_code`, `timestamp`, `punch_type` (IN/OUT). Auto-creates or updates `attendance` records with duration calculation.
    - `gemini-ai`: AI-powered assistant for CRM website discovery.
    - `crm-website-finder`: Automated company website and details lookup.

- **RLS (Row Level Security):**
    - Strict policies are enforced on all tables to ensure users can only access data belonging to their assigned `company_id`.

## 9. Deployment API
- **Live Indexing:** Debugging endpoints available for checking live index values.
- **WebSockets:** Real-time updates for notifications and dashboard widgets.

## 10. Changelog & Recent Updates

### v2.2 — Advanced Accounting Enterprise Upgrades (Apr 21, 2026)
Enterprise-grade financial controls and reporting capabilities.

| Area | File(s) | Change |
|:---|:---|:---|
| **Trial Balance** | `FinancialReports.tsx` | New report tab calling `rpc_get_trial_balance` — shows all accounts with Debit/Credit columns and totals verification |
| **Aging Reports** | `FinancialReports.tsx` | New Aging Report tab with `rpc_get_partner_aging` — Receivables and Payables bucketed into Current, 1-30, 31-60, 61-90, 90+ day columns |
| **Cash Book** | `CashBook.tsx` [NEW] | Dedicated Cash Book component with date-range filter calling `rpc_get_cash_book` — shows Cash In/Out and running balance |
| **Credit Limits** | `Partners.tsx`, `Invoices.tsx` | `credit_limit` field on `accounting_partners`; invoice creation warns/blocks when limit exceeded |
| **Bill Approvals** | `Bills.tsx` | Vendor bills now route through multi-stage `WorkflowEngine` approval before posting |
| **Payroll WPS** | `PayrollDashboard.tsx` | WPS Export (Qatar format) CSV generation with Employee QID, Visa, Bank details |
| **Payroll Settlement** | `PayrollDashboard.tsx` | Full & Final Settlement modal — Notice Pay, Leave Encashment, Gratuity, Loan Recovery |
| **DB Migration** | `accounting_enterprise_upgrades.sql` | Schema for credit limits, bill approval fields, Trial Balance/Aging/Cash Book RPCs |

### v2.1 — Enterprise HRMS Phase 1 (Apr 20, 2026)
Biometric integration, workflow-driven leave approvals, and payroll enhancements.

| Area | File(s) | Change |
|:---|:---|:---|
| **Biometric Integration** | `device-sync/index.ts` [NEW] | Supabase Edge Function webhook for ZKTeco-style biometric devices — API key auth, auto punch IN/OUT with duration calc |
| **Biometric Settings** | `SettingsModule.tsx` | Device Integration Hub UI — webhook endpoint display, API key generation, enable/disable toggle |
| **Leave Approvals** | `ESSP.tsx`, `WorkflowEngine.ts` | Leave requests now route through unified `WorkflowEngine` with multi-step approval and audit logging |
| **Attendance Sub-tabs** | `AttendanceModule.tsx` | 5 sub-tabs: Overview, Daily, Monthly, Shifts, Duty Roster |
| **ESSP AI Assistant** | `ESSP.tsx` | "Super Agent" chat interface for leave/salary/career queries |
| **ESSP Skills & Growth** | `ESSP.tsx` | Skills dashboard with gap analysis, readiness score, and Career Timeline |
| **DB Migration** | `phase21_enterprise_hrms_upgrades.sql` | Schema for workflow instances, action logs, biometric settings, attendance periods |

### v2.0 — Go-Live Stabilization (Mar-Apr 2026)
Critical fixes and feature completions for production deployment.

| Area | File(s) | Change |
|:---|:---|:---|
| **5 Critical Fixes** | Multiple | Fixed biometric RLS policies, resolved report builder duplication in attendance, implemented inventory reports tab, configured leave policy settings CRUD, updated system currency to QAR |
| **Attendance Overhaul** | `AttendanceModule.tsx` | Complete rewrite with 3→5 sub-tabs, monthly calendar view, missed punch requests, configurable off-days (company → shift → roster hierarchy) |
| **Configurable Off-Days** | `AttendanceModule.tsx`, `SettingsModule.tsx` | `default_weekly_off_days` on `org_attendance_settings`, `weekly_off_days` on `org_shift_timings` — replaces hardcoded Fri/Sat weekends |
| **Device Integration Hub** | `SettingsModule.tsx` | Camera barcode scanning (WebRTC + BarcodeDetector API) for Inventory, biometric webhook configuration |
| **Warehouse Customization** | Inventory module | 11 warehouse customization features including zone/bin management enhancements |
| **Vercel Analytics** | `App.tsx` | Vercel Web Analytics integration for production monitoring |
| **QAR Currency** | CRM, Inventory, Dashboards | Replaced KSA/INR/KES with QAR across all modules |

### v1.5 — Employee & Infrastructure Hardening (Feb-Mar 2026)
Production hardening, employee profile expansion, and infrastructure stabilization.

| Area | File(s) | Change |
|:---|:---|:---|
| **Employee Profiles** | `EmployeeFormModal.tsx`, `EmployeeDetailModal.tsx` | Added DoB, Age (auto-calc), nationality (from `org_nationalities` dropdown), memo, remarks, air ticket, position column |
| **Immigration Tab** | `EmployeeFormModal.tsx` | New tab for visa/passport/Hamad Card details with `user_permissions` migration |
| **Documents Tab** | `EmployeeDocuments.tsx` | Now fetches from DB with view/download and dark mode support |
| **ESSPContext** | `ESSPContext.tsx` [NEW] | Dedicated context resolving employee profile, manager, and role flags from auth user |
| **Branded Login** | `Login.tsx` | ERP-style splash screen with client logo, 3-second loading animation |
| **Keep-Alive** | `App.tsx` | Session persistence with Super Admin role wildcard logic |
| **User Creation** | `Organisation.tsx` | Secure RPCs for user creation, permission matrix in Org users modal |
| **RLS Audit** | Multiple SQL files | Fixed `company_id` synchronization across all insert operations, recursive RLS policy fix |
| **Production Hardening** | Multiple | 100% stability audit, data isolation fixes in HRMS/Dashboard, branding verification |

### v1.4 — Hardcoded Values Audit (Feb 12, 2026)
A full codebase audit to eliminate hardcoded values and ensure data dynamism.

| Area | File | Change |
|:---|:---|:---|
| **Leave Balance** | `ESSP.tsx` | Replaced hardcoded `defaultBalance = 22` with dynamic sum from `org_leave_types` master table |
| **Leave Types** | `ESSP.tsx` | Leave type dropdown now loads dynamically from `org_leave_types`; falls back to defaults only if none configured |
| **Currency (Payroll)** | `PayrollDashboard.tsx` | Currency fetched from `companies.currency` instead of hardcoded `'USD'` |
| **Currency (Reports)** | `FinancialReports.tsx` | Same dynamic currency fetch with `'USD'` fallback |
| **Company Defaults** | `Organisation.tsx` | Removed hardcoded `'KES'`/`'Kenya'` fallback — new companies start with empty settings |
| **CRM Dashboard** | `CRM.tsx` | Metrics (`$267K`, `42%`, `14`, `18 Days`) now computed from actual `deals[]` state |
| **CRM Pipeline** | `CRM.tsx` | Funnel chart computed dynamically from `stages[]` + `deals[]` |
| **CRM Task Board** | `CRM.tsx` | Uses `taskStatuses[]` state instead of hardcoded `'To Do'/'In Progress'/'Done'` |
| **CRM Schedule** | `CRM.tsx` | Replaced fake events (`'Skyline Inc.'`, `'Sarah Connor'`) with proper empty state |
| **CRM Workflows** | `CRM.tsx` | Replaced static workflow cards with empty state |
| **CRM Updates** | `CRM.tsx` | Replaced fake activity feed with empty state |
| **CRM Documents** | `CRM.tsx` | Replaced fake document list with empty state |

### v1.3 — Multi-Module Bug Fixes (Feb 12, 2026)
Critical fixes across ESSP and Organisation modules.

| Area | File | Change |
|:---|:---|:---|
| **Leave Bug (Critical)** | `ESSP.tsx` | Fixed table mismatch: dashboard now queries `leaves` instead of `leave_applications` |
| **MyProfile** | `ESSP.tsx` | Replaced hardcoded profile values with actual `employeeProfile` data |
| **User Creation** | `Organisation.tsx` | Replaced `alert('coming soon')` with actual `supabase.auth.signUp()` + profile creation |
| **Reports Tab** | `ESSP.tsx` | Added `ReportsListView` import and `REPORTS` tab to ESSP sidebar |
| **Workflow Deletion** | `Organisation.tsx` | Added `handleDeleteWorkflow` with cascade deletion of levels |
| **User Deletion** | `Organisation.tsx` | Added `handleDeleteUser` with safety check against self-deletion |
| **RESIGNATION Trigger** | `Organisation.tsx` | Added `RESIGNATION` and `DOCUMENT_APPROVAL` to workflow trigger types |
| **Leave Error Handling** | `ESSP.tsx` | Added try/catch with user-friendly error messages for leave submission |

### v1.2 — Password Management (Feb 10-11, 2026)
- Admin Reset Password feature for administrators/HR to reset employee passwords to default
- Change Password feature for employees via top-right menu

### v1.1 — System Review & Security (Feb 8-9, 2026)
- Comprehensive RLS policy audit across all tables
- Gemini AI Edge Function authentication fix
- Employee UUID type mismatch fix
- Supabase 406 error fixes (unsafe `.single()` calls)

---
*Last Updated: April 25, 2026 — Generated by KAA ERP Documentation Agent*
