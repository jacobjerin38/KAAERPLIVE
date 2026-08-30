# 🚀 KAA ERP Hub — Release Notes v2.13.0

**Release Date:** August 30, 2026  
**Target Environment:** Production Live (`kaaerp.com`)  
**Database:** Supabase PostgreSQL 17.6 (`euoaoyzpurbvcoxydunl`)  
**Git Commits:** `5c7e242` | `8465d92` | `d0d6f0d` | `b59a29b`  
**Git Remotes:** `origin/main` & `backup/main`

---

## 📌 Executive Summary

Release **v2.13.0** delivers a major upgrade to the **HRMS, Time & Attendance, Organisation Masters, and Project Reporting** suites in KAA ERP. This release resolves schema mismatches in Master configurations, activates a dynamic **Shift-Wise Attendance Evaluation Engine**, introduces granular **Overtime (OT) Formula Mapping**, resolves **Employee Salary Component Breakdowns**, and introduces an executive **Project Reports & Analytics Suite**.

---

## 🌟 Key Upgraded Features & Capabilities

### 1. ⏱️ Shift-Wise Attendance Rule Engine & Precision Punch Evaluation
* **Dynamic On-The-Fly Shift Evaluation (`rpc_get_monthly_attendance_report`):**
  * Evaluates raw biometric and online check-ins/outs in real time against shift schedules (e.g., `08:00 – 16:00`) and the active company grace period (15 minutes).
  * **Late Arrival Calculation:** Accurately flags and computes late minutes when check-in is past grace window (e.g., `09:00` check-in $\rightarrow$ `+60m Late`, `11:20` check-in $\rightarrow$ `+200m Late`).
  * **Early Departure Calculation:** Flags early departures when check-out precedes shift end (e.g., `14:00` check-out $\rightarrow$ `-120m Early`).
* **Intelligent Status Categorization:**
  * **0.0 to < 1.0 Hour:** Automatically marked as **Absent / Missing Punch** (prevents zero-minute punches from falsely appearing as "Present").
  * **1.0 to < 4.0 Hours:** Categorized as **Half Day**.
  * **$\ge$ 4.0 Hours:** Categorized as **Present**.
  * **$\ge$ 8.0 Hours:** Automatically calculates verified Overtime (OT) hours.
* **Abnormal Multi-Day Punch Guard:**
  * Fixes cross-day check-out anomalies where forgotten check-outs previously generated astronomical hours (e.g., `241.2h` or `49.2h`), safely capping single-day shifts at valid daily limits.
* **🔘 "Run Shift Evaluation" Action Button:**
  * Added a one-click **"Run Shift Evaluation"** button in the Monthly Attendance Report header to re-synchronize historical punches across the entire company in seconds.

---

### 2. 💵 Employee Master — Salary Components Allocation
* **`employee_salary_components` Provisioning:**
  * Provisioned the `public.employee_salary_components` table with tenant isolation (`company_id`), foreign key linkages to `org_salary_components`, and automated audit timestamps.
  * Allows HR administrators to map individual compensation packages per employee with custom:
    * **Basic Salary (Earning)**
    * **DA (Dearness Allowance)**
    * **HRA (House Rent Allowance)**
    * **Special & Transport Allowances**
    * **Statutory & Standard Deductions**
  * Updated `EmployeeFormModal.tsx` and `EmployeeDetailModal.tsx` for seamless allocation, editing, and deletion of components.

---

### 3. ⚙️ Granular Overtime (OT) Mapping & Calculation Basis
* **Employee vs OT Applicable Configuration:**
  * Enabled toggle in **Employee Master $\rightarrow$ Financial & Statutory** to designate OT eligibility.
* **Configurable OT Calculation Formula / Basis:**
  * **Basic Salary Only (Default):** $\text{Hourly Rate} = \frac{\text{Basic Salary}}{\text{Days in Month} \times 8}$
  * **Basic + DA:** $\text{Hourly Rate} = \frac{\text{Basic} + \text{Dearness Allowance}}{\text{Days in Month} \times 8}$
  * **Gross / CTC Salary:** $\text{Hourly Rate} = \frac{\text{Gross Salary}}{\text{Days in Month} \times 8}$
* **Configurable OT Multipliers:**
  * Support for **1.25x** (Standard Working Day OT), **1.50x** (Weekend / Off-Day OT), and **2.00x** (Public Holiday / Night OT).

---

### 4. 🏢 Organisation Masters Schema Synchronization
* **Pay Groups (`org_pay_groups`):**
  * Added missing schema columns: `attendance_required`, `salary_day`, `ot_calculation_basis`, and `ot_rate_multiplier`.
  * Allows creating customized pay cycles (Monthly, Weekly) and configuring default salary calculation rules without DDL errors.
* **Payroll Months (`org_payroll_months`):**
  * Enhanced Financial Year dropdown mapping to clearly render `Code (Start Date to End Date)` (e.g., `FY 2026 (2026-01-01 to 2026-12-31)`).
* **Leave Calendar (`org_leave_calendar_years`):**
  * Fully synchronized date pickers and annual cycle configurations.

---

### 5. 📑 Project Reports & Executive Analytics Suite
* **Integrated Reporting Suite (`ProjectReportsView.tsx`):**
  * Added dedicated **`Reports & Analytics`** primary tab under the Project Management module.
  * Includes 5 specialized executive reporting views:
    1. **Portfolio Master Status Report:** High-level project health, commercial margins, and progress milestones.
    2. **Project Executive Dossier:** Complete project summary with compliance tracking across 6/6 Mandatory Document Hold-Points.
    3. **Proposals & Commercial Bids Audit Log:** Technical & commercial proposal tracking and conversion rates.
    4. **Site Execution & Daily Activity Log:** Site activity journals, labor logs, and work progress.
    5. **Issues, Risks & HSE Safety Summary:** Hazard and incident reporting log with signoff blocks.
* **Print & PDF Handover Support:**
  * Formatted with clean print stylesheets (`@media print`) and formal executive signature blocks for client handovers.

---

### 6. 🔙 Proposal Navigation & Modal Controls
* **Modal Accessibility & Close Controls:**
  * Added top **`← Back to Proposals`** button, top-right **`[X] Close`** button, and bottom modal footer **`← Back to Proposals`** in `ProposalDetailModal.tsx` and `ProposalFormModal.tsx`.
  * Enabled backdrop click-to-dismiss.
  * Enhanced title typography with `break-words` for long commercial proposal headings.

---

## 🛠️ Summary of Technical Fixes

| Area | Component / Table | Description of Fix |
|---|---|---|
| **HRMS** | `employee_salary_components` | Created table with RLS tenant isolation, primary keys, and indexes to support multi-component salary breakdowns. |
| **HRMS** | `EmployeeDetailModal.tsx` | Updated `handleAddComponent` with `company_id` fallback to satisfy tenant RLS policies. |
| **HRMS** | `EmployeeFormModal.tsx` | Added `ot_calculation_basis` (`BASIC`, `BASIC_DA`, `GROSS`) and `ot_rate_multiplier` selectors. |
| **Attendance** | `rpc_get_monthly_attendance_report` | Replaced static 0-value returns with on-the-fly shift calculation (Late arrival, Early departure, Overtime, Absent/Half-day). |
| **Attendance** | `rpc_recalculate_attendance_shift_rules` | Built standalone batch evaluator function for company-wide punch recalculation against shift rules. |
| **Attendance** | `MonthlyAttendanceReport.tsx` | Added **"Run Shift Evaluation"** action button and real-time status badges. |
| **Organisation** | `org_pay_groups` | Added `attendance_required`, `salary_day`, `ot_calculation_basis`, and `ot_rate_multiplier` columns. |
| **Organisation** | `Organisation.tsx` | Formatted Financial Year labels in `PAYROLL_MONTHS` master creation. |
| **Projects** | `ProjectReportsView.tsx` | Created 5 executive project reports with PDF export and print formatting. |
| **Projects** | `ProposalDetailModal.tsx` | Added top & bottom Back to Proposals buttons and backdrop dismiss. |
| **Payroll** | `rpc_generate_payroll` | Integrated attendance LOP calculations, dynamic component allocations, and mapped OT formulas. |

---

## 🚀 Deployment & Verification

* **Database DDL & Functions:** Successfully deployed to Supabase PostgreSQL 17.6 (`euoaoyzpurbvcoxydunl`).
* **Frontend Build:** Vite production build verified with **0 errors**.
* **Git Branches:** Synchronized and pushed to `origin/main` and `backup/main`.
