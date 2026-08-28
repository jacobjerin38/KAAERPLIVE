# 🚀 KAA ERP Hub — Release Notes v2.12.0

**Release Date:** August 28, 2026  
**Target Environment:** Production Live (`kaaerp.com`)  
**Database:** Supabase PostgreSQL 17.6 (`euoaoyzpurbvcoxydunl`)  
**Git Commits:** `a188c42` | `bf2e423` | `4bb5b31` | `1e8312e`  
**Git Remotes:** `origin/main` & `backup/main`

---

## 📌 Executive Summary

Release **v2.12.0** introduces major financial accounting advancements designed for high-precision payables tracking, flexible voucher recording, and streamlined master data governance:

1. **Dual Reference & Dual Date Architecture for Vendor Bills:** Separation of internal PEC Purchase Voucher numbers / posting dates from external Vendor Supplier Invoice numbers / invoice dates.
2. **Supplier Invoice Date-Based Payables (AP) Aging:** Direct aging calculations from the supplier's actual invoice date, ensuring late-keyed bills reflect genuine credit age.
3. **Asset & Liability Line Selection in Vendor Bills:** Support for booking Employee Advances, Prepayments, Fixed Assets, and Due to/from Related Parties directly within Vendor Bills.
4. **Quick Multi-Line & Split Entry Tools:** One-click line duplication, multi-line adders, and dynamic split entries.
5. **Clean Account Dropdowns (Inactive & Group Header Exclusion):** Permanent removal of header groups and inactive accounts from all transaction dropdowns across the ERP.
6. **Centralized Accounting Masters Hub:** Integration of all 16 Accounting Masters (including Project Cost Centers, Purchase Ledgers, Sales Ledgers, and Currencies) directly into the Accounting module.

---

## 🌟 Key Upgraded Features

### 1. 🧾 Dual Reference & Dual Date Voucher Architecture
To handle real-world accounting scenarios where supplier bills are received late or across accounting period boundaries, Vendor Bills now separates the internal and external references and dates:

* **Section 1: PEC Internal Purchase Voucher**
  * **PEC Purchase Invoice / Voucher #:** Internal document number (e.g., `PINV-001`, `2`).
  * **Voucher Date (Posting Date):** The date the transaction is entered into the general ledger, controlling the active financial period.
  * **Purchase Journal:** Target journal (e.g., *Vendor Bills (BILL)* or *General Operations*).
* **Section 2: Vendor Supplier Invoice & Credit Terms**
  * **Vendor:** Supplier name & reference code.
  * **Supplier Invoice No.:** Physical invoice number printed on the vendor bill (e.g., `INV-9823`).
  * **Supplier Invoice Date:** The invoice issue date as stated by the supplier.
  * **Credit Period & Dynamic Due Date:** Quick selection of credit terms (*Immediate, 15, 30, 45, 60, 90, 120 Days, or Custom*), with automated calculation of:
    $$\text{Due Date} = \text{Supplier Invoice Date} + \text{Credit Period (Days)}$$
* **Late / Prior-Period Notification Banner:**
  * When a bill date belongs to a prior month compared to the voucher date, a helper notice automatically informs the user that the bill is recognized under the active entry period while preserving supplier terms.

---

### 2. ⏳ Payables (AP) Aging Calculated on Supplier Invoice Date
* **Accurate Credit Aging:**
  * The Accounts Payable (AP) Aging RPC (`rpc_get_accounting_partner_aging`) now counts aging days strictly from the **Supplier Invoice Date** (`invoice_date`):
    $$\text{Aging Days} = \text{Statement Date} - \text{Supplier Invoice Date}$$
  * Aging buckets (*Current, 1–30 Days, 31–60 Days, 61–90 Days, 90+ Days*) accurately reflect real vendor payment aging regardless of when the invoice was keyed into the system.

---

### 3. 💳 Multi-Account Line Selection in Vendor Bills
Vendor Bill lines are no longer restricted to just expense accounts. Users can select and allocate bill debits across all major account classes:

* **⚡ Expense:** For operational expenses, utilities, travel, office costs, and site expenditure.
* **🏢 Asset / Advance:** For **Employee Advances** (`[1140]`), **Prepaid Expenses** (`[1130]`), **Security Deposits**, or **Fixed Assets / Capital Purchases**.
* **⚖️ Liability / Related Party:** For **Due to Related Parties** (`[2020]`), **Intercompany Balances**, **Accrued Liabilities**, or **Provisions**.
* **🛒 Item Purchase:** For inventory catalog items mapped with designated Purchase Ledgers / COGS accounts.

---

### 4. ➕ Multi-Line & Split Entry Features
* **Top Quick-Add Action Buttons:** Instant addition of specific line categories (`+ Add Expense`, `+ Add Asset / Advance`, `+ Add Liability / Related Party`, `+ Add Item`).
* **One-Click Line Duplication (`Duplicate`):** Clone an existing line card with 1 click to split expenses or costs across multiple cost centers without retyping.
* **Bottom Multi-Line Quick-Adder Bar:** Dedicated bottom action bar for adding additional split lines without scrolling up.

---

### 5. 🚫 Dropdown Account Cleanliness (Inactive & Group Accounts Filtered)
* **Elimination of Duplicate Account Names:**
  * All transaction and setup dropdowns (**Bills**, **Invoices**, **Journal Entries**, **Payments**, **Fixed Assets**, **Journals**, **Taxes**, **Partners**, and **Accounting Masters**) now enforce:
    $$\text{is\_active} = \text{true} \quad \text{AND} \quad \text{is\_group} = \text{false}$$
  * Header/group accounts (e.g. `5200 Cost of Service-Projects`) and inactive accounts (e.g. `5211 COS - Projects [INACTIVE]`) are excluded from transaction selectors, preventing selection confusion and correcting journal entries.

---

### 6. 📚 All 16 Accounting Masters Hub in Accounting Module
* All Accounting Masters are now accessible directly within the **Accounting Module** under the **`📚 Masters`** tab:
  1. **Chart of Accounts** (Posting GL Accounts)
  2. **Account Groups** (Hierarchy & Balance Sheet Grouping)
  3. **Stock Categories** (Inventory & COGS Mapping)
  4. **Purchase Ledgers** (Bill & Item Expense Mapping)
  5. **Sales Ledgers** (Revenue & Trading Accounts)
  6. **Direct Expense Ledgers** (Cost of Sales / Logistics)
  7. **Indirect Expense Ledgers** (Admin & Overheads)
  8. **Bank Accounts Master** (Bank Configuration & GL Linking)
  9. **Cash Accounts Master** (Cash in Hand Ledgers)
  10. **Cost Centers** (Projects, Contracts, Departments)
  11. **Cost Categories**
  12. **Credit & Payment Terms** (Net 30, Net 45, etc.)
  13. **Taxes & VAT**
  14. **Currencies & Exchange Rates**
  15. **Fiscal Years**
  16. **Accounting Periods** (Monthly Closing Controls)

---

## 🛠️ Bug Fixes & Technical Improvements

| Area | Component / Table | Description of Fix |
| :--- | :--- | :--- |
| **Database Schema** | `accounting_journal_entries` | Added column `supplier_invoice_number TEXT` to track external vendor invoice numbers. |
| **Database RPCs** | `rpc_create_accounting_invoice` & `rpc_update_accounting_invoice` | Added support for `p_supplier_invoice_number` and `p_invoice_date` parameters. |
| **AP Aging RPC** | `rpc_get_accounting_partner_aging` | Updated aging logic to evaluate `p_date - COALESCE(e.invoice_date, e.date)` for vendor payables. |
| **Item Purchase Mapping** | `Bills.tsx` | Sanitized `coa:` prefixed values from purchase ledger dropdowns to prevent PostgreSQL UUID cast syntax errors. |
| **Cost Center Filters** | `Bills.tsx` & `Invoices.tsx` | Converted cost center type filtering to case-insensitive matching (`(type \|\| '').toUpperCase() === 'PROJECT'`). |
| **Account Dropdowns** | All Accounting Components | Filtered out `is_group = true` and `is_active = false` accounts across all transaction selectors. |
| **Module Navigation** | `AccountingDashboard.tsx` | Added `📚 All Masters Hub (16 Masters)` tab to the Accounting module header navigation. |

---

## 📦 Modified Files

1. `supabase/migrations/20260828_pec_purchase_and_supplier_invoice_support.sql` — Applied live database migration for dual references, dual dates, and aging logic.
2. `components/accounting/operations/Bills.tsx` — Dual reference/date forms, asset/liability line selection, multi-line adder, duplication, and table columns.
3. `components/accounting/AccountingDashboard.tsx` — Integrated 16-in-1 Accounting Masters Hub and updated sub-tabs.
4. `components/accounting/operations/Invoices.tsx` — Case-insensitive cost center filters and active account validation.
5. `components/accounting/operations/JournalEntries.tsx` — Active non-group account filtering.
6. `components/accounting/operations/Payments.tsx` — Active non-group account filtering.
7. `components/accounting/operations/FixedAssets.tsx` — Active non-group account filtering.
8. `components/accounting/masters/Journals.tsx` — Active non-group account filtering.
9. `components/accounting/masters/Taxes.tsx` — Active non-group account filtering.
10. `components/accounting/masters/Partners.tsx` — Active non-group account filtering.
11. `components/modules/organisation/AccountingMasters.tsx` — Active non-group account filtering.

---

## 🚀 Deployment & Verification

* **Live Database:** All SQL migrations and RPC updates applied to live Supabase (`euoaoyzpurbvcoxydunl`).
* **Build Status:** Verified clean production build (`npm run build` — 0 errors).
* **Git Repository:** Committed and pushed to `origin/main` & `backup/main` (commit `1e8312e`).
