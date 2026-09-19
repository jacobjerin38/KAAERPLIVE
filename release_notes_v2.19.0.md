# KAA ERP System — Release Notes
**Release Version**: 2.19.0  
**Release Date**: 19 September 2026  
**Audience**: Executive Management, Finance & Accounts Team, Commercial & CRM Operations  

---

## Overview

Today's release delivers major functional upgrades requested for the **Accounts & Financial Migration** and **CRM & Commercial Call-Off Contract Management** modules. 

Key milestones include the deployment of the new **Excel Migration & Opening Balances Hub** (enabling live operations cutover from 01-August-2026 with 100% mathematically balanced accounts), complete management of **Call-Off Service Contracts & Work Orders** (including Contract QCTCM2922 for Q-CHEM / RLOC), and enhanced document management provisions.

---

## 1. Accounts & Financial Operations

### 📥 Opening Balances & Excel Migration Hub
A unified financial migration center has been introduced to transition legacy financial data into the ERP seamlessly:
* **Excel & CSV Direct Upload**: Drag-and-drop or upload standard `.xlsx` spreadsheets for automatic parsing and verification.
* **Downloadable Migration Templates**: Pre-structured Excel templates available with one click for General Ledger accounts, Customer Debtors, Vendor Creditors, and Opening Stock.
* **Balanced General Ledger Voucher**:
  * Carries forward the audited financial close as of **31-July-2026** with a **01-August-2026 cutover date**.
  * Reconciled down to **0.00 QAR variance**:
    * **Total Assets (Debits)**: `QAR 10,645,784.79`
    * **Total Liabilities & Equity (Credits)**: `QAR 10,645,784.79`
    * **Net Difference**: `QAR 0.00`
  * Official opening balance voucher is posted and reflected across all financial ledgers, balance sheets, and reports.

### 👥 Sundry Debtors (Customer Sub-Ledgers)
* **25 Active Corporate Clients Synchronized**: Pre-loaded all customer receivables totaling **QAR 3,017,107.64** matching the General Ledger.
* **Client Profile Detail Provisions**: Each client profile now captures Commercial Registration (CR) / Tax numbers, dedicated finance contact persons, email/phone details, and payment credit terms (30, 45, 60 days).

### 🏢 Sundry Creditors (Vendor Sub-Ledgers)
* **6 Approved Suppliers Synchronized**: Pre-loaded all vendor payables totaling **QAR 355,331.67** matching the General Ledger.
* Captures vendor payment credit terms and links directly to Accounts Payable for billing and settlement.

### 📦 Inventory Opening Stock Register
* Initialized stock register with item numbers, detailed descriptions, product categories (Trading, Piping, PPE, MRO Fasteners), units of measure, quantities on hand, and unit costs.
* Fully reconciled to match the General Ledger Opening Stock target of **QAR 2,818,696.38**.

---

## 2. CRM, Call-Off Contracts & Work Order Management

### 📋 Call-Off Contracts Architecture (Contract QCTCM2922)
Corporate contracts that operate on a "call-on" or "call-off" basis are now fully supported:
* Enables running **multiple individual Work Orders (WO) and Purchase Orders (PO)** under a single master corporate service agreement (e.g. *GRP FRP AND PROCESS PIPING repair services at Q-CHEM, Q-CHEM II AND RLOC*).
* **Call-Off Work Order & PO Register**: A dedicated view displaying all active, in-progress, and completed work orders across all corporate contracts.
* **Contract Overview Metrics**: Real-time KPI summaries tracking Total Orders, In-Progress Orders, Completed Orders, and Total Logged Contract Value in QAR and USD.

### 🗂️ Client Management & Document Provisions
* **Client Onboarding / Start Date**: Added dedicated tracking for client operational start dates (`Client Since: YYYY-MM-DD`).
* **Remarks & Operational Notes**: Provision to record commercial notes, contract execution terms, and site-specific instructions.
* **Document & Contract Uploads**: Direct attachment upload feature on customer profiles and work orders to store signed contracts, scopes of work (SOW), purchase orders, and technical specifications.
* **Export & Print Ready**: One-click **Print Official Report** layout and **Export to CSV** for commercial and management reporting.

---

## 3. User Interface & Display Enhancements

* **Clear View Counters**: Navigation badges have been clarified to display record counts explicitly (e.g. `5 Clients` and `6 Orders`) with hover tooltips.
* **Accurate Terminology**: Corrected dynamic labels to properly reflect singular and plural states (e.g., `1 Work Order` vs `5 Work Orders`).
* **Multi-Currency Support**: All pipeline metrics, revenue summaries, and deal cards accurately display in Qatari Riyals (QAR) and USD.

---

## Summary of Completed Deliverables

| Feature Area | Description | Status |
| :--- | :--- | :--- |
| **Financial Cutover Baseline** | 31-Jul-2026 closing balances posted for 01-Aug-2026 live system start | **Active & Reconciled** |
| **Excel Migration Hub** | Excel template download, drag-and-drop file upload, and live validation | **Deployed** |
| **Debtors Reconciliation** | 25 corporate clients keyed with QAR 3,017,107.64 balance & CR details | **Synced** |
| **Creditors Reconciliation** | 6 vendors keyed with QAR 355,331.67 balance & payment terms | **Synced** |
| **Inventory Stock Register** | Item numbers, quantities & unit costs matching QAR 2.81M valuation | **Initialized** |
| **Call-Off Contract System** | Support for master call-off contracts with multiple child Work Orders | **Deployed** |
| **Contract QCTCM2922 Register** | Pre-loaded Q-CHEM / RLOC repair service orders with print & export | **Active** |
| **Document & Remarks Provision** | File upload, remarks field, and client onboarding start date | **Available** |
| **Repository Synchronization** | All updates pushed to primary and backup cloud repositories | **100% Synced** |

---
*For any questions or additional feature requests, please contact the KAA ERP support and implementation team.*
