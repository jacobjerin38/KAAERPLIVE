# KAA ERP System — Release Notes
**Release Version**: 2.23.0  
**Release Date**: 26 September 2026  
**Audience**: Executive Management, Chief Financial Officers, Finance & Accounts Controllers, Commercial & Sales Leaders, Project Managers, IT Administrators  
**Classification**: Official Client Release Document  

---

## Executive Summary

We are pleased to announce the release of **KAA ERP v2.23.0**, a comprehensive enterprise update delivering substantial enhancements across **Financial Accounting, Vendor Bill Double-Entry Mechanics, Interactive Financial Reporting, Party Payment Settlement, Accounts Aging Auditing, Multi-Page Document Printing, and Commercial CRM Employee-Wise Reporting**.

This release brings together several major workflow improvements developed in close alignment with corporate accounting standards, commercial sales management requirements, and auditor expectations. Highlights include automated **Double-Entry (DR / CR)** journal generation for complex vendor bills containing combinations of catalog items, expenses, assets, and deductions; Tally-style **"Against Ref" party payment invoice settlements**; clickable **account composition drill-downs** across Balance Sheet and Profit & Loss reports; complete **multi-page Day Book printing**; and high-visibility **Employee-Wise CRM sales performance reporting**.

---

### Key Highlights of Release v2.23.0:

1. **Vendor Bills: Mixed Line-Type Double-Entry (DR / CR) Architecture**  
   Auto-generates balanced double-entry General Ledger journal lines for vendor bills containing mixed line types: Item Purchases (with Project/Contract Cost Centers), Direct Expenses, Assets/Advances, and Liabilities. Introduces native handling for negative amounts (e.g. customs duty charges, discounts, credit adjustments), flipping deductions to credits (`CR`) rather than invalid negative debits.

2. **Live DR/CR Accounting Preview & Bill Inspection Modal**  
   Added a real-time **Double-Entry Accounting Preview** directly inside the bill creation/edit modal showing exact accounts, narrations, cost centers, debits, credits, and balance status (`✓ Balanced (DR = CR)`). Also added a quick **`DR/CR`** action button to the bills table for one-click journal inspection.

3. **Employee-Wise CRM Commercial Performance Reporting**  
   Introduced a dedicated **Employee-Wise CRM Report** in the Reports module and an **Employee / Account Manager filter** in the CRM Accounts view. Aggregates live lead volumes, pipeline deal values, won revenue, conversion win rates, stage distribution, and average deal sizes per commercial team member, with instant CSV export and print capabilities.

4. **Interactive Financial Statement Account Composition Drill-Down**  
   All account rows in the **Balance Sheet**, **Profit & Loss**, **Trial Balance**, and **Expense Analysis** are now interactive. Clicking any account opens a detailed transactional ledger drill-down featuring running balances, opening balance, periodic debits/credits, net closing balance, date filters, search, and CSV export.

5. **Tally-Style Party Payment Invoice Settlement ("Against Ref")**  
   Payments can now be allocated directly against specific outstanding invoices or bills via an intuitive settlement allocation modal. Automatically updates outstanding balance aging, prevents over-allocation, and establishes an immutable link between payments and invoices.

6. **Dedicated Bank Charges Line Entry in Payments**  
   Outbound payments now support an atomic **Bank Charges** line entry, ensuring bank transaction fees are routed directly to the designated bank charges expense account while the vendor liability is cleared for the exact gross bill amount.

7. **AR / AP Aging Invoice Breakdown Drill-Down**  
   Accounts Receivable and Accounts Payable aging reports now feature expandable drill-downs. Clicking on any aging bucket (0–30, 31–60, 61–90, 90+ days) instantly displays the specific unpaid invoices and bills comprising that exposure.

8. **Full Multi-Page Day Book & Financial Reporting Print Fix**  
   Resolved print stylesheet overflow clipping that previously restricted Day Book and financial statement printouts to a single page. Day Book and financial reports now paginate cleanly across multiple pages with repeated headers and running totals.

9. **Global Standardized Period Preset Filter Bar**  
   Deployed an ergonomic Period Filter component across Bills, Invoices, Payments, Day Book, General Ledger, and Financial Reports supporting `Today`, `Yesterday`, `This Week`, `This Month`, `This Quarter`, `This Year`, `Last Month`, and `Custom Date Range`.

---

## 1. Vendor Bills: Combined Line Types & DR/CR Setup

### ⚙️ The Double-Entry Challenge Addressed
In enterprise operations, vendor invoices frequently combine inventory items, project-specific materials, landed freight charges, customs duty clearances, and debit deductions. Previously:
- Negative charges (e.g. `QAR -3,489.00` for customs duty deductions) were recorded as negative debits (`debit = -3489.00`), causing distortions in trial balances and ledger audit trails.
- Bill re-opening filters inadvertently dropped negative-debit rows upon editing.
- Unit price inputs enforced `min="0"`, causing browser validation friction for valid negative deductions.

### 💡 The Complete Architectural Solution
1. **Server-Side RPC Modernization (`rpc_create_accounting_invoice` & `rpc_update_accounting_invoice`)**:
   - Upgraded to canonical 10-argument signatures supporting client reference numbers, supplier invoice numbers, and custom billing dates.
   - **Intelligent DR/CR Routing**:
     - **Item Purchases**: Debits purchase/COGS ledgers or item accounts, binding Project Cost Centers, Contract Cost Centers, and Cost Centers.
     - **Positive Expenses / Assets**: Debited (DR) to the respective account.
     - **Negative Expenses / Deductions**: Automatically flipped via `ABS()` to Credit (CR) the deduction account.
     - **Balancing Accounts Payable (AP)**: Credits the net payable balance:
       $$\sum \text{Debits } (45,082.49) = \text{Credits } (3,489.00 \text{ Deduction} + 41,593.49 \text{ AP}) = 45,082.49\text{ QAR}$$
2. **Frontend Line Filtering & Reconstruction (`Bills.tsx`)**:
   - Replaced old `l.debit > 0` filter with explicit balancing-line detection, ensuring all breakdown lines (positive or negative) are fully preserved when re-opening or modifying bills.
   - Removed `min="0"` constraints on price fields and added amber highlight tags for deduction lines.
3. **Interactive Double-Entry Preview & Quick Inspection**:
   - Added a real-time **DR / CR Setup & Preview** card inside the bill modal.
   - Added a **`DR/CR`** action button to the Bills list table for rapid journal auditing without leaving the operational view.

---

## 2. Commercial CRM: Employee-Wise Reporting & Filtering

### 📊 Comprehensive Employee-Wise CRM Report
* **Dedicated Analytics View**: Introduced the **Employee-Wise CRM Report** (`EmployeeWiseCrmReport.tsx`) accessible directly within the CRM and Reports navigation.
* **Key Performance Metrics Computed per Employee**:
  * **Assigned Leads Count**: Total active and historical leads managed.
  * **Total Pipeline Value**: Aggregate deal value across all open pipeline stages.
  * **Won Value & Win Rate %**: Total revenue closed and percentage conversion rate.
  * **Stage Distribution Funnel**: Breakdown across New, Contacted, Qualified, Proposal, Negotiation, Won, and Lost.
  * **Average Deal Value**: Average value per opportunity.
* **Period Presets & Quick Filtering**: Filter by commercial periods (`This Month`, `This Quarter`, `This Year`, or Custom) with real-time employee search.
* **Export & Print**: Full support for Excel-compatible CSV download and clean printed performance scorecards.

### 🔍 Account Manager Filter in CRM Customer View
* **Account Manager Dropdown**: Added an interactive employee filter in the CRM Accounts/Customers directory (`CustomersView.tsx`).
* **Instant Account Isolation**: Commercial directors can now isolate all customer accounts and active pipelines assigned to a specific account manager with a single click.

---

## 3. Financial Statements: Interactive Account Drill-Down

### 🔍 Ledger Breakdown Composition Modal
* **Interactive Statement Rows**: Clicking any account row in the **Balance Sheet**, **Profit & Loss**, **Trial Balance**, or **Expense Analysis** opens an interactive ledger breakdown modal (`FinancialReports.tsx`).
* **KPI Header Cards**: Displays Opening Balance, Total Debits, Total Credits, and Net Closing Balance.
* **Chronological Transaction Ledger**: Lists date, voucher reference, journal name, counterparty, narration, debit, credit, and running balance.
* **Dual Timeframe Toggle**: Easily switch between the statement's **Report Cut-off Date** and the **All-Time** complete historical ledger.
* **High-Performance RPC (`rpc_get_accounting_account_breakdown`)**: Server-side procedure resolving accounts by UUID or code, respecting normal balances (`Debit-normal` for Assets/Expenses, `Credit-normal` for Liabilities/Equity/Income), with windowed running balance computation.

---

## 4. Operational Finance: Party Payment Settlement & AR/AP Aging

### 🤝 Tally-Style "Against Ref" Invoice Settlement
* **Allocation Modal in Payments**: When creating an inbound (customer receipt) or outbound (vendor payment) payment, accountants can click **"Settle Against Invoices / Bills"**.
* **Outstanding Invoice Ledger**: Fetches unpaid invoices/bills for the selected partner, displaying date, invoice reference, total amount, previously settled amount, and remaining unpaid balance.
* **Auto-Settlement & Manual Allocation**: Users can click "Auto Allocate" to settle oldest invoices first or manually distribute payment amounts across specific bills.
* **Audit Trail**: Recorded in `accounting_payment_allocations` to maintain exact invoice aging integrity.

### 🏦 Dedicated Bank Charges Line Entry
* Outbound payment vouchers now include an option for **Bank Charges / Transfer Fees**.
* The vendor payable is debited for the full gross bill amount, the bank account is credited for the total cash outlay, and bank charges are automatically debited to the company’s bank charges expense account in a single atomic transaction.

### ⏳ AR / AP Aging Invoice-Level Drill-Down
* Expandable rows in Accounts Receivable and Accounts Payable aging reports.
* Clicking on any aging bucket (e.g., 31–60 days) immediately displays the specific invoices comprising that total, including customer reference numbers, due dates, and days overdue.

---

## 5. Document Management: Full Multi-Page Printing

### 🖨️ Day Book & Statement Multi-Page Pagination Fix
* **Problem Resolved**: Print stylesheets previously used CSS flex/overflow rules that caused browser print dialogs to truncate long reports after the first page.
* **Enhancement**: Refactored print container styles across **Day Book**, **General Ledger**, and all financial statements to use clean CSS page-break rules (`break-inside: avoid`, `@media print { overflow: visible; height: auto; }`).
* Long transaction journals spanning tens or hundreds of pages now print cleanly with repeating table headers, running totals, and consistent page numbering.

---

## Summary of Feature Upgrades & Business Value

| Module | Feature Upgrade | Direct Operational & Business Value |
| :--- | :--- | :--- |
| **Vendor Bills** | **Mixed Line DR/CR Double-Entry Setup** | Flawless general ledger posting for combined item purchases, expenses, and negative deductions |
| **Vendor Bills** | **Live DR/CR Preview & Table Inspection** | Real-time accounting transparency and instant verification of balanced journal lines before posting |
| **CRM Module** | **Employee-Wise Commercial Report** | Comprehensive visibility into sales rep productivity, pipeline volume, win rates, and closed revenue |
| **CRM Module** | **Account Manager Filter in Accounts View**| Allows commercial directors to isolate client portfolios by assigned relationship manager |
| **Financial Reporting**| **Account Composition Drill-Down** | Enables CFOs and auditors to click any statement row to inspect underlying ledger transactions |
| **Payments** | **"Against Ref" Invoice Settlement** | Precise matching of payments against invoices, preventing unallocated cash and inaccurate aging |
| **Payments** | **Bank Charges Line Entry** | Correct accounting for wire fees without distorting vendor settlement amounts |
| **Aging Reports** | **AR / AP Aging Invoice Drill-Down** | Instant identification of specific overdue invoices behind outstanding debtor/creditor balances |
| **Day Book & Reports** | **Multi-Page Print & Pagination Fix** | Complete, unclipped physical printing and PDF export for large transaction day books |
| **Accounting Common** | **Standardized Period Preset Filter Bar**| Consistent date filtering across all operational accounting screens |

---

## Database Migrations Applied & Verified

| Migration File | Description | Status |
| :--- | :--- | :--- |
| `20260926150000_accounting_account_breakdown_drilldown.sql` | Server-side RPC for account composition drill-down with running balances | **Applied & Verified** |
| `20260926160000_vendor_bill_dr_cr_negative_amounts.sql` | Initial DR/CR sign flipping for negative line amounts | **Applied & Verified** |
| `20260926163000_fix_10arg_accounting_invoice_dr_cr.sql` | Dropped 7-arg overloads; canonical 10-arg RPC with PO, ref, and invoice date | **Applied & Verified** |

---

## Build & Repository Deployment Details

* **Software Build Verification**: Passed full Vite production build (`cmd /c "npm run build"`) in **10.57 seconds** with **0 errors**.
* **Live Supabase Environment**: Project `euoaoyzpurbvcoxydunl` verified active and healthy.
* **Git Synchronization**: Synchronized across `main`, `master`, and `KAA_ERP_SANBOX` on both GitHub remotes:
  * Primary Remote: `https://github.com/jacobjerin38/KAAERPLIVE.git`
  * Backup Remote: `https://github.com/jerinjacobdream11-lang/KAAERPLIVE.git`
* **Release Commit**: `3bcb2db` (`feat: setup DR and CR journal entries for combined item purchase and expense lines in vendor bills`)

---

*For technical inquiries or workflow demonstrations, please consult the KAA ERP System Administration Team.*
