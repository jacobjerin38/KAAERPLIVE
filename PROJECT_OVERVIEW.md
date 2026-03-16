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

### C. Approval Engine
A centralized approval system governs critical actions:
- Leave Requests & Payroll
- Stock Adjustments & Transfers
- Journal Reversals
- Production Orders & Purchase Orders

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
- **Employees:** Comprehensive employee profiles (Basic, Job, Payroll, Documents).
- **Attendance:** Punch-in/out tracking, shift management, and attendance records.
- **Leaves:** Leave request management, types, and balances.
- **Payroll:** Salary structure, processing, and payslip generation.

### C. ESSP (Employee Self-Service Portal)
- **Self Service:** Employees can view their own attendance, apply for leave, and view payslips.
- **Buzz:** Company-wide announcements and polls.
- **Kudos:** Peer-to-peer recognition system.

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

### F. Accounting (Phase 2.2 - Core Completed, Advanced in Progress)
- **Chart of Accounts:** Hierarchy with Account Groups (Asset, Liability, Equity, Income, Expense).
- **Invoicing:** Customer Invoices (AR) & Vendor Bills (AP). Integrated with Inventory.
- **Payments & Banking:** Payment registration and Reconciliation.
- **Fiscal Control:** Period Locking, Tax Engine, Multi-currency.
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
- `org_leave_types`, `org_shift_timings`
- `org_nationalities`, `org_banks`

### HRMS Tables
- `employees`: Central employee table linking to masters.
- `attendance_records`: Daily attendance logs.
- `leave_requests`: Leave applications and status.
- `payroll_runs`, `payslips`: Payroll processing data.

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
    - **Accounting:** `rpc_post_move`, `rpc_create_invoice`, `rpc_post_payment`, `rpc_get_balance_sheet`.
    - **Inventory:** `rpc_process_putaway`, `rpc_approve_stock_adjustment`.

- **RLS (Row Level Security):**
    - Strict policies are enforced on all tables to ensure users can only access data belonging to their assigned `company_id`.

## 9. Deployment API
- **Live Indexing:** Debugging endpoints available for checking live index values.
- **WebSockets:** Real-time updates for notifications and dashboard widgets.

## 10. Changelog & Recent Updates

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
*Generated by KAA ERP Documentation Agent*
