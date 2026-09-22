# KAA ERP System — Release Notes
**Release Version**: 2.20.0  
**Release Date**: 23 September 2026  
**Audience**: Executive Management, Finance & Accounts Team, Commercial, HR & Operations Teams  

---

## Executive Summary

Release **v2.20.0** introduces significant operational, financial, and data-integrity advancements across the KAA ERP platform. 

Key milestones delivered in this release include:
1. **Granular Cost Center Allocation on Payment Vouchers** — allocating expenses per line item to specific drivers, staff, company vehicles, or client projects.
2. **Standardization to Qatari Riyals (QAR)** — complete elimination of foreign currency remnants (USD / INR) across pricing, Item Master, contracts, warehouse receipts, and employee portals.
3. **Client PO Reference & Date Integration** — comprehensive tracking of client Purchase Orders in Sales Invoices and the Day Book report.
4. **Enhanced Customer Management & Safe Deletion** — multi-table transaction validation, safe deletion of unused/duplicate records, and one-click deactivation.
5. **Day Book Interactive Drill-Down** — direct one-click navigation from financial ledger audit logs to original source vouchers.
6. **CRM Report Builder & Private View Isolation** — live interactive reporting and secure private workspace views for commercial teams.
7. **Streamlined ERP Navigation** — clean, role-focused navigation consolidating sales workflows and decluttering unused modules.

---

## 1. Accounting & Financial Operations

### 🎯 Line-Item Cost Center Allocation (Payment Vouchers)
Accounting officers can now record multi-expense payment vouchers where **each individual expense line** is tagged to a distinct cost center:
* **Dedicated Cost Center Selector**: Positioned right alongside the Account Ledger in the *Expense & Account Allocation* table.
* **Organized Categorization**: Options are intuitively categorized and searchable:
  * **`[Driver]`**: Muhammad Hafeez, Tika Ram Jaishi, Jabbar Karumkully, etc.
  * **`[Vehicle]`**: Toyota Corolla 587593, Toyota Corolla 155754, Pickup 291612, etc.
  * **`[Sales / Staff]`**: Business development officers, site supervisors, and technical staff.
  * **`[Project]`**: Dolphin Energy Call-Off, Q-CHEM Repair Services, Ras Laffan Petrochemicals, etc.
  * **`[Contract]`**: Gasal, QAFCO, DNV, Mimmar, and Malomatia contracts.
* **Inline Quick-Add Cost Center**: A dedicated `+ New Cost Center` button inside the voucher form allows adding a newly assigned vehicle, driver, project, or department on the fly without closing or losing the payment voucher draft.
* **General Ledger Synchronization**: When a payment voucher is posted, the backend RPC automatically propagates the line-item cost center (along with project and contract tags) directly to `accounting_journal_lines`, ensuring 100% accuracy in Cost Center P&L and Project profitability statements.
* **Register Visual Badge**: Payment vouchers on the main register now display a `🎯 [Cost Center]` badge for instant visual auditing.

### 📋 Client PO Reference Number & PO Date
* **Customer Invoices / Sales Vouchers**: Added dedicated input fields for **Client PO Reference Number** (e.g. `PO-443368`, `LPO-0922`) and **PO Date**.
* **Sales Register Visibility**: Added dedicated columns in the invoices table with formatted monospace badges and date stamps.
* **Day Book Synchronization**: Entries displayed in the Day Book audit report now feature a `PO: [Number]` badge and support instant search filtering by client PO number or date.

### 👥 Safe Customer Deletion & Duplicate Prevention
* **Multi-Table Transaction Check**: Added an 8-table database validation check before deleting any partner record. It inspects journal entries, invoice lines, payments, sales orders, purchase orders, bank statement lines, and project proposals.
* **Safe Deletion Modal**:
  * If a record has **0 transactions** (such as newly imported or duplicate records), it can be purged cleanly and safely with one click.
  * If a record **has existing transactions**, deletion is blocked to protect historical double-entry books, the exact transaction count is displayed, and a **Deactivate Customer Instead** alternative is offered.
* **Action Button Accessibility**: `Edit` and `Delete` action buttons are now always visible on partner cards and inside the `Edit Customer` modal.
* **Resolved Import Duplicates**: Fixed the root cause of duplicate customer entries stemming from inverted short-name batch imports.

### 🔍 Interactive Day Book Drill-Down
* **One-Click Navigation**: Clicking on any voucher number in the Day Book report instantly opens the corresponding edit/view modal (Payment Vouchers, Sales Invoices, Vendor Bills, and Manual Journal Entries).
* **Receipt Voucher Save Resolution**: Fixed balance assertion logic for single-party Customer Receipt vouchers, providing clear status guidance and seamless saving.

---

## 2. Currency Standardization (Dollar & INR to QAR)

### 🇶🇦 100% Qatari Riyal (QAR) Uniformity
The entire application has been standardized to **QAR (Qatari Riyals)**:
* **Item Master (`Item Master`)**:
  * Permanently removed Indian Rupee (`₹`) icons and replaced with standard currency indicators.
  * Price inputs and table headers updated to **`Selling Price (QAR)`** and **`Buying Price (QAR)`** with 2-decimal precision.
  * Excel item bulk-import parser updated to accept QAR pricing columns.
* **Call-Off Service Contracts & Work Orders**:
  * KPI summaries, logged contract values, work order schedules, and export templates locked to **QAR**.
  * Converted legacy USD contracts to QAR at the official fixed rate ($1\text{ USD} = 3.64\text{ QAR}$).
* **Warehouse & Goods Receipt**:
  * Unit cost inputs standardized from `Unit Cost ($)` to **`Unit Cost (QAR)`**.
* **Employee Self-Service (ESSP) & PRO Hub**:
  * Net salary payout displays in ESSP and Government Fees KPI in PRO Hub standardized from `$` to **`QAR`**.

---

## 3. CRM & Commercial Operations

### 📊 Report Builder Overhaul
* **Interactive Live Preview**: Replaced static report prompts with an interactive, click-to-run preview engine that executes queries instantly upon clicking.
* **Enriched Datasets**:
  * **Deals & Opportunities**: Displays deal title, readable sales stages, win probability (%), sales owner, customer name, and deal value in QAR.
  * **Leads & Inquiries**: Displays full contact names, company, lead status, lead source, industry, and owner.
  * **Customer Directory**: Displays company name, contact person, lifecycle stage, industry, website, and account owner.
* **Robust Error Handling**: Added clean loading spinners and informative error banners with "Try Again" recovery.

### 🔒 Privacy & Ownership Isolation
* **Sales Rep Data Isolation**: Sales team members now see their own assigned leads, deals, and activities by default, ensuring focused and confidential pipeline management.
* **Management Oversight**: Administrators and division managers retain full visibility across all team pipelines and organizational reports.
* **Smoother Interaction**: Eliminated disruptive whole-page reloads when closing CRM dialogs and drawer forms.

---

## 4. Navigation & Interface Decluttering

### 🧭 Streamlined Sidebar Navigation
* **Consolidated Sales Operations**: Relocated sales documents (Quotations, Sales Invoices, and Delivery Notes) exclusively under the dedicated **Sales** module, removing redundancy from the CRM menu.
* **Deactivated Unused Modules**: Hidden unconfigured modules (`Manufacturing`, `Marketing`, `Loans & Benefits`, and `Procurement`) from the left sidebar to provide users with a clean, focused, and intuitive workspace.

---

## Summary of Completed Upgrades

| Module / Area | Feature Delivered | Impact / Benefit |
| :--- | :--- | :--- |
| **Payment Vouchers** | **Cost Center Allocation per Line** | Accurate tracking of fuel, maintenance, driver, and project expenses |
| **Payment Vouchers** | **Quick Add Cost Center** | Create drivers/vehicles/projects directly inside voucher entry |
| **Sales Invoices** | **Client PO Ref # and Date** | Complete traceability from Client PO to invoice and Day Book |
| **Day Book** | **One-Click Voucher Navigation** | Audit transactions and jump directly to source documents |
| **Partner Master** | **Safe Delete & Transaction Check** | Purge duplicates safely without risking historical ledger integrity |
| **Receipt Vouchers** | **Receipt Voucher Save Fix** | Balanced allocation and smooth saving for customer collections |
| **Item Master** | **QAR Pricing & Rupee Removal** | Clean QAR pricing inputs, table columns, and Excel import |
| **Entire Platform** | **Currency Standardization to QAR** | Uniform Qatari Riyal figures across CRM, WMS, ESSP, and PRO |
| **CRM Module** | **Interactive Report Builder** | Instant click-to-run report generation with readable stage data |
| **CRM Security** | **Private Ownership Views** | Dedicated personal pipeline views for sales representatives |
| **Navigation** | **Sidebar Decluttering** | Consolidated sales workflows and hidden unused modules |

---

*For technical assistance, workflow inquiries, or user guidance, please reach out to the KAA ERP administrator.*
