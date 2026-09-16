# KAA ERP — Release Notes v2.18.0

**Release Date:** September 16, 2026  
**Scope:** Voucher Mode Switcher (Item Invoice vs. Accounting Invoice), Duplicate Reference & Supplier Invoice Validation, Bill Sorting, CRM Document Uploads, and Customer Management

---

## 🌟 Executive Summary

Release **v2.18.0** introduces major financial workflow flexibility, audit controls, and usability improvements across **Customer Invoices, Vendor Bills, and CRM Operations**.

Following standard ERP practices (such as TallyPrime), Customer Invoices now feature a dedicated **Voucher Mode Switcher**, allowing your accounting team to toggle seamlessly between **Item Invoice Mode** (for catalog goods and stock sales) and **Accounting Invoice Mode** (for services, asset disposals, client advance recoveries, and retainage deductions directly booked to general ledger accounts).

Additionally, this release incorporates crucial operational safeguards requested by your team: **automated duplicate checks** for purchase references and supplier invoice numbers, **smart reference sorting** for purchase bills, **document upload fixes in CRM**, and **enhanced customer management**.

---

## 🚀 What’s New & Enhanced

### 1. 📑 Voucher Modes for Customer Invoices (Tally-Standard)

Finance teams now have the flexibility to create two types of customer invoices depending on the nature of the transaction:

* **Item Invoice Mode (Commercial & Inventory Sales)**:
  * Designed for standard billing of physical products, materials, and inventory items.
  * Allows selecting catalog items, specifying quantities, unit rates, sales revenue accounts, and project cost centers.

* **Accounting Invoice Mode (Services, Assets & Liabilities)**:
  * Designed for financial billing without requiring an inventory catalog item.
  * Enables direct allocation against Chart of Accounts ledgers:
    * **💼 Asset Accounts**: Used for billing the sale or disposal of company fixed assets, machinery, vehicles, or equipment.
    * **⚖️ Liability Accounts**: Used for deducting client mobilization advances, adjusting customer deposits, or billing/releasing retainage and retention amounts under contract terms.
    * **📈 Income Accounts**: Used for professional fees, engineering services, consulting, and maintenance contracts.
    * **📉 Expense Accounts**: Used for reimbursable expenses or client recharge allocations.
  * **Category Filter Pills**: Quickly filter accounts by *All*, *Asset*, *Liability*, *Income*, or *Expense* with one click.
  * **Quick Line Shortcuts**: Fast-action buttons to add specialized lines (`+ Asset Line`, `+ Liability Line`, `+ Income Line`).
  * **Smart Mode Detection**: When viewing or editing an existing invoice, the system automatically detects whether it was recorded as an Item Invoice or an Accounting Invoice and loads the appropriate view.
  * **Line Duplication**: A dedicated *Duplicate* button to quickly clone lines during multi-item data entry.

---

### 2. 🛡️ Duplicate Reference Number & Supplier Invoice Validation

To eliminate human error, accidental re-entry, and duplicate bill processing:

* **Purchase Reference Duplicate Control**:
  * As soon as a purchase reference number is entered or typed, the system validates it against all existing records.
  * If a duplicate is detected, an immediate prompt notifies the user:
    > *"Duplicate Reference Number! Purchase Reference is already assigned to an existing bill. Please enter a unique Reference Number."*
* **Supplier Invoice # Duplicate Control**:
  * Protects against entering the same vendor bill twice.
  * Alerts the accountant immediately if a supplier's invoice number has already been booked.

---

### 3. 🔢 Arranged & Sorted Purchase Bills (PI.2026.69 Onwards)

* Purchase bills are now logically sorted by reference number in clean chronological and numeric sequence (e.g. `PI.2026.69`, `PI.2026.70`, `PI.2026.71`, etc.).
* Accountants can effortlessly find, verify, and track purchase vouchers in the exact order they were registered.

---

### 4. 📁 CRM Document Management & Uploads

* Fixed document selector and file upload controls in the CRM module.
* Sales and administrative personnel can now select document categories, attach PDF/image files, and upload customer agreements, commercial proposals, and trade licenses without interruptions.

---

### 5. 👥 Customer Listing & New Customer Onboarding

* Enhanced customer directories to ensure all active clients and accounts appear immediately in customer selection dropdowns across CRM, Sales, and Invoicing.
* Streamlined the provision to onboard new independent customers directly, ensuring distinct partner records and smooth credit management.

---

## 📋 Summary of Operational Benefits

| Feature | Operational Benefit |
| :--- | :--- |
| **Voucher Modes** | Direct booking for asset sales, retainage, and service invoices without creating inventory dummy items. |
| **Duplicate Alerts** | Prevents duplicate bill entries and double payments to suppliers. |
| **Bill Sorting** | Fast, organized reference lookup matching daily register order. |
| **CRM Documents** | Reliable client document archiving and quick contract access. |
| **Customer Provision** | Fast client registration without duplicate customer confusion. |
