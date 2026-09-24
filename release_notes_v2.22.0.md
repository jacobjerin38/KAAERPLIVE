# KAA ERP System — Release Notes
**Release Version**: 2.22.0  
**Release Date**: 24 September 2026  
**Audience**: Executive Management, HR & Operations Directors, Commercial & Sales Leaders, IT & Administration  
**Classification**: Official Client Release Document  

---

## Executive Summary

We are pleased to present the official release of **KAA ERP v2.22.0**, an enterprise update specifically centered on **operational field intelligence, administrative user governance, company attendance & biometric integration, CRM task execution, and comprehensive backend schema integrity**.

This release directly addresses operational feedback from client site operations, corporate administration, and commercial teams. Field engineers and off-site staff can now tag their exact project or customer site upon check-in, providing HR and project management with instantaneous location transparency. Simultaneously, critical administrative tools—including employee user profile management, biometric time-tracking hardware synchronization, CRM document attachments, and multi-module transactional stored procedures—have been hardened and verified against the live enterprise database.

### Key Highlights of This Release:
1. **Field & Site Attendance Tracking (ESSP & HRMS)** — Employees can now record their project name, job site, or client location directly when punching in, with immediate visual auditing in the HRMS Daily Attendance roster.
2. **Organisation & User Management Remediation** — Completely resolved the database schema mismatch preventing administrators from updating user profiles, job roles, and system access in the Organisation module.
3. **Company Attendance Policy & Biometric Device Integration** — Upgraded company-level attendance rules (grace periods, overtime thresholds, mobile check-in toggles, and biometric device integration keys) with full Supabase Edge Function synchronization.
4. **CRM Task Execution Hub & Pipeline Tracking** — Introduced an interactive CRM Tasks list with real-time status filtering (Pending, In Progress, Completed), priority badges, due-date tracking, and robust error validation.
5. **Commercial Attachment Stability & Upload Resilience** — Hardened file upload handlers across CRM deals, customer accounts, and proposals with explicit user feedback and network recovery guards.
6. **AI Website Finder & Corporate Intelligence Key Management** — Resolved constraint conflicts in AI settings, allowing seamless credential configuration for automated company website and regional branch intelligence lookups.
7. **Enterprise Transactional Stored Procedure Alignment** — Repaired and synchronized 7 core database RPCs across Quotation-to-Invoice conversion, sales line recalculation, manufacturing order completion, payroll generation, and MRP Bill of Materials (BOM) management.
8. **HR Leave Travel & Document Attachment Alignment** — Corrected employee leave travel ticket attachments to align directly with official document storage columns.

---

## 1. ESSP Field Operations & Project Attendance Tracking

### 📍 Site & Project Location Tagging on Punch-In
* **Client Request Fulfilled**: Off-site workers, service engineers, project supervisors, and traveling consultants can now specify which client project, job site, or location they are reporting to when checking in.
* **Streamlined Punch Modal**: The ESSP Attendance screen now provides an intuitive, non-intrusive **Site / Project Location Note** field directly within the Punch-In modal.
* **History & Transparency**: Location notes are securely recorded into attendance audit logs and displayed in the employee’s personal attendance history.

### 🏢 HRMS Centralized Location Auditing
* **Location Badges in Daily Attendance**: HR administrators and Operations Managers can now see the exact site or project note directly within the **Daily Attendance Log** and employee punch details.
* **Rapid Multi-Site Oversight**: Facilitates instant verification of field crew deployments across multiple concurrent projects without requiring separate site logbooks or phone calls.

---

## 2. Organisation Management & User Profile Administration

### 👥 Reliable User Profile & Role Updates
* **Zero-Error Profile Saving**: Eliminated the system error (`column "updated_at" does not exist`) that previously interrupted administrative updates when modifying employee profiles, assigned roles, or company affiliations.
* **Database Function Hardening**: The administrative user management database procedure (`admin_update_user`) has been updated and verified on the live database to match current production schema specifications.
* **Role Assignment Validation**: Added clear, friendly client-side validation to alert administrators immediately if role assignments or required company identifiers need adjustment.

---

## 3. HRMS Attendance Policy & Biometric Hardware Integration

### ⚙️ Company-Wide Attendance Policy Governance
* **Unified Policy Storage**: Added full support for company-level attendance rules within the HRMS Settings module:
  * **Grace Period Window**: Configurable late arrival grace time (e.g. 15 minutes) before mark-late triggers.
  * **Overtime Minimum Threshold**: Minimum continuous extra minutes required before overtime begins calculating (e.g. 60 minutes).
  * **Overtime Multiplier**: Statutory standard multiplier (1.5x) for authorized work hours beyond the standard shift.
  * **Mobile Attendance Toggle**: Administrative switch to permit or restrict smartphone check-ins per company policy.
* **Non-Destructive Coexistence**: Retains full compatibility with existing weekly off-day schedules (e.g. Friday/Saturday) set in Organisation Masters.

### 📟 Biometric Time-Tracking Hardware Integration
* **API Key Infrastructure**: Provides secure storage and generation of biometric device integration keys (`biometric_api_key`) directly under company attendance settings.
* **Live Edge Function Verification**: The biometric device synchronization engine (`device-sync` Edge Function) can now seamlessly authenticate physical biometric turnstiles and fingerprint scanners against active company settings.

---

## 4. Commercial CRM Enhancements & Task Management

### 📋 Interactive CRM Task Hub
* **Unified Task Overview**: The CRM module now features a dedicated, filterable **Task Management View** alongside Leads, Deals, and Pipelines.
* **Operational Controls**:
  * **Real-Time Search**: Search tasks by title, description, or assigned team member.
  * **Status & Priority Badges**: Visual indicators for `Pending`, `In Progress`, and `Completed` statuses, color-coded by priority (`High`, `Medium`, `Low`).
  * **Inline Status Updating**: Allows sales executives and relationship managers to update task progress with a single click.
* **Actionable Task Creation**: Hardened task modal creation with defensive validation and user-friendly error alerts.

### 📎 Commercial Attachment Reliability
* **Safe Document Uploads**: Hardened the CRM document upload panel (`AttachmentPanel`) with comprehensive exception handling.
* **Clear User Guidance**: If a network interruption or unsupported file format occurs during contract or quotation attachment uploads, the system provides actionable feedback rather than freezing or silently failing.

### 🌐 AI Website Finder & Market Intelligence
* **Automated Company Intelligence**: Resolved the configuration constraint issue in the CRM Website Finder. Commercial executives can now securely save their Gemini AI API key to enable automated corporate website discovery and regional branch mapping across GCC markets (Qatar, UAE, KSA, Kuwait, Bahrain, Oman).
* **Automatic Key Preloading**: The AI configuration modal automatically preloads the company's existing active credentials, eliminating the need to re-enter API keys during periodic configuration checks.

---

## 5. Core Financial, Production & Payroll Schema Integrity

### 🔧 Transactional Stored Procedure Maintenance
To guarantee operational reliability under high volume, seven critical database stored procedures (RPCs) were audited, repaired, and successfully deployed to the live database:
1. **`rpc_convert_quotation_to_invoice`** — Ensures accepted sales quotations cleanly generate draft sales invoices without column mismatches.
2. **`rpc_save_crm_quotation_lines`** — Guarantees atomic recalculation of line discounts, tax amounts, and subtotals on commercial quotations.
3. **`rpc_save_crm_sales_invoice_lines`** — Delivers instantaneous, error-free recalculation of sales invoice lines and grand totals.
4. **`rpc_complete_production`** — Verifies finished goods receipt and raw material stock ledger consumption upon manufacturing order completion.
5. **`rpc_generate_payroll`** — Protects automated monthly payroll generation across multi-department employee rosters.
6. **`rpc_switch_active_company`** — Guarantees safe session context transitions across multi-entity corporate workspaces.
7. **`rpc_save_mrp_bom`** — Harmonized Bill of Materials parameter signatures to ensure seamless engineering recipe creation.

---

## 6. Employee Travel & Leave Document Compliance

### ✈️ Travel Ticket Attachment Management
* **Leave Ticket URL Alignment**: Corrected the employee travel record management interface (`EmployeeDetailModal`) to store flight itineraries and electronic tickets directly into the designated `ticket_url` document repository.
* **Document Integrity**: Guarantees that travel bookings processed for overseas annual leave or business trips are permanently accessible to HR and accounts teams for audit and reimbursement purposes.

---

## Summary of Feature Upgrades & Business Impact

| Operational Domain | Feature Upgrade | Direct Business Value |
| :--- | :--- | :--- |
| **Field Operations / ESSP** | **Site & Project Punch-In Location Tagging** | Real-time visibility into employee field deployment across active client work sites |
| **HRMS / Attendance** | **Centralized Location Audit in Daily Logs** | Streamlines HR attendance verification for mobile and field engineering staff |
| **Organisation Admin** | **User Profile & Role Edit Remediation** | Eliminates administrative blockage when onboarding or modifying system users |
| **HR Policy & Compliance** | **Company Attendance Rules Engine** | Standardizes company grace periods, overtime minimums, and mobile check-in policies |
| **Hardware Integration** | **Biometric Device Synchronization** | Restores secure biometric device connectivity and turnstile integration |
| **Commercial CRM** | **Interactive Task Workbench** | Increases sales team productivity with real-time task status tracking and filtering |
| **Commercial CRM** | **Resilient Attachment Uploads** | Prevents file loss and provides clear error feedback during proposal document uploads |
| **Commercial Intelligence** | **AI Website Finder Key Management** | Enables automated corporate intelligence and GCC regional branch discovery |
| **Financial & Sales** | **Quotation & Invoice RPC Hardening** | Guarantees atomic sales document calculations and flawless conversion to billing |
| **Manufacturing / MRP** | **Production Completion & BOM RPC Alignment**| Flawless inventory movements upon assembly completion and reliable BOM authoring |
| **Payroll Management** | **Automated Payroll Generation Procedure** | High-precision payroll generation without column-level database execution errors |
| **HR Travel Management** | **Leave Ticket Attachment Compatibility** | Reliable archiving of employee travel bookings and annual leave air tickets |

---

## Deployment & Verification Details

* **Software Build Verification**: Passed full production bundle compilation (`vite build`) in **7.16 seconds** with **0 build errors**.
* **Live Supabase Database Migrations Applied & Verified**:
  * `20260924115503_fix_admin_update_user_profile_schema.sql` — User profile update repair.
  * `20260924133000_fix_schema_mismatched_rpc_columns.sql` — RPC column compatibility and BOM schema alignment.
  * `20260924190000_add_missing_org_attendance_settings_columns.sql` — Attendance policy and biometric configuration columns.
* **Data Safety Protocol**: All database operations executed via non-destructive DDL (`CREATE OR REPLACE FUNCTION` and `ADD COLUMN IF NOT EXISTS`). Zero records altered, zero data lost, zero downtime.
* **Multi-Repository Synchronization**: Fully synchronized across Git branches (`main`, `master`, `KAA_ERP_SANBOX`) on both GitHub remotes:
  * Primary: `https://github.com/jacobjerin38/KAAERPLIVE.git`
  * Redundant Backup: `https://github.com/jerinjacobdream11-lang/KAAERPLIVE.git`

---

*For technical assistance, workflow inquiries, or user guidance, please contact your KAA ERP Account Lead or System Administrator.*
