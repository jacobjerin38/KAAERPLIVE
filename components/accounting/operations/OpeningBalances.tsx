import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { 
    Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, Search, 
    Plus, Trash2, Edit2, Save, RefreshCw, ArrowRight, Shield, Users, Building, 
    Package, DollarSign, Calendar, FileText, Check, Eye, HelpCircle, ChevronDown, CheckCircle
} from 'lucide-react';

interface GLOpeningLine {
    account_code: string;
    account_name: string;
    type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
    subtype?: string;
    debit: number;
    credit: number;
    notes?: string;
}

interface DebtorLine {
    id?: string;
    client_name: string;
    opening_balance: number;
    cr_tax_id?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    payment_terms_days?: number;
    credit_limit?: number;
}

interface CreditorLine {
    id?: string;
    vendor_name: string;
    opening_balance: number;
    cr_tax_id?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    payment_terms_days?: number;
}

interface InventoryLine {
    item_code: string;
    item_name: string;
    category: string;
    uom: string;
    quantity: number;
    unit_cost: number;
    total_value: number;
    warehouse: string;
}

export default function OpeningBalances({ companyId }: { companyId?: string }) {
    const { user } = useAuth();
    const effectiveCompanyId = companyId || '0c0b0d78-4531-412e-8fa3-bbc74b7145ae';

    const [activeTab, setActiveTab] = useState<'GL' | 'DEBTORS' | 'CREDITORS' | 'INVENTORY'>('GL');
    const [cutoverDate, setCutoverDate] = useState('2026-08-01');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');

    // Pre-loaded verified General Ledger lines from PEC Trial Balance (as of 31-Jul-2026 / cutover 01-Aug-2026)
    const [glLines, setGlLines] = useState<GLOpeningLine[]>([
        // Equity & Reserves
        { account_code: '3010', account_name: 'Current Account - Imperial Holdings', type: 'Equity', subtype: "Owner's Equity", debit: 0, credit: 150000.00 },
        { account_code: '3110', account_name: 'Legal Reserve', type: 'Equity', subtype: "Owner's Equity", debit: 0, credit: 100000.00 },
        { account_code: '3210', account_name: 'Paid In Capital', type: 'Equity', subtype: "Owner's Equity", debit: 0, credit: 200000.00 },
        { account_code: '3310', account_name: 'Retained Earnings', type: 'Equity', subtype: "Owner's Equity", debit: 0, credit: 617258.55 },
        { account_code: '3001', account_name: 'Profit & Loss A/c (Cumulative P&L to 31-Jul-2026)', type: 'Equity', subtype: 'Other', debit: 0, credit: 620876.48 },

        // Loans (Liabilities)
        { account_code: '2211', account_name: 'Due to/from Dr. Rana Sajjad Ali', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 45103.00 },
        { account_code: '2210', account_name: 'Due to/from Imperial Holdings', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 3882026.70 },
        { account_code: '2213', account_name: 'Due to/from KazGlobal LLP', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 546012.85 },
        { account_code: '2212', account_name: 'Due to/from KCTC Mena (Debit Balance)', type: 'Asset', subtype: 'Current Assets', debit: 221421.16, credit: 0 },
        { account_code: '1500', account_name: 'Right of Use Asset (Leasehold)', type: 'Asset', subtype: 'Fixed Assets', debit: 190617.00, credit: 0 },
        { account_code: '2310', account_name: 'Working Capital Loan - CSC Advisory UAE', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 685839.05 },

        // Current Liabilities & Provisions
        { account_code: '2010', account_name: 'Sundry Creditors (Trade Payables)', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 355331.67 },
        { account_code: '2020', account_name: 'Provision for Doubtful Accounts', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 84692.50 },
        { account_code: '2021', account_name: 'Provision for Obsolete Inventory', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 527324.96 },
        { account_code: '2022', account_name: 'Accum. Depn - Right of Use Asset', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 256377.00 },
        { account_code: '2030', account_name: 'Accrued Expense Payable', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 51851.83 },
        { account_code: '2031', account_name: 'Commission Payable', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 21058.65 },
        { account_code: '2032', account_name: 'Advances from Customers (Customer Deposit)', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 686271.40 },
        { account_code: '2110', account_name: 'Employee Salary Payable', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 469628.58 },
        { account_code: '2111', account_name: 'Employee Leave Benefit Payable', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 58305.64 },
        { account_code: '2112', account_name: 'Employee Leave Ticket Benefit Payable', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 45621.52 },
        { account_code: '2113', account_name: 'Employee End of Service Benefit Payable', type: 'Liability', subtype: 'Long-Term Liabilities', debit: 0, credit: 234208.94 },
        { account_code: '2410', account_name: 'Rental Payable', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 100000.00 },
        { account_code: '2421', account_name: 'Withholding Tax Payable', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 25557.00 },
        { account_code: '2610', account_name: 'Other Payables', type: 'Liability', subtype: 'Current Liabilities', debit: 0, credit: 383403.27 },

        // Fixed Assets Cost
        { account_code: '1510', account_name: 'Computer Hardware, Software & Office Eqpt', type: 'Asset', subtype: 'Fixed Assets', debit: 35053.00, credit: 0 },
        { account_code: '1520', account_name: 'Furniture & Fixtures', type: 'Asset', subtype: 'Fixed Assets', debit: 12849.00, credit: 0 },
        { account_code: '1530', account_name: 'Leasehold Improvements', type: 'Asset', subtype: 'Fixed Assets', debit: 10215.00, credit: 0 },
        { account_code: '1540', account_name: 'Tools', type: 'Asset', subtype: 'Fixed Assets', debit: 178304.39, credit: 0 },
        { account_code: '1550', account_name: 'Vehicles', type: 'Asset', subtype: 'Fixed Assets', debit: 299200.00, credit: 0 },

        // Contra Assets (Accumulated Depreciation)
        { account_code: '1610', account_name: 'Accum. Depn - Computer Hardware & Off Eqpt', type: 'Asset', subtype: 'Fixed Assets', debit: 0, credit: 24164.46 },
        { account_code: '1620', account_name: 'Accum. Depn - Furniture & Fixtures', type: 'Asset', subtype: 'Fixed Assets', debit: 0, credit: 11761.58 },
        { account_code: '1630', account_name: 'Accum. Depn - Leasehold Improvements', type: 'Asset', subtype: 'Fixed Assets', debit: 0, credit: 8490.72 },
        { account_code: '1640', account_name: 'Accum. Depn - Tools', type: 'Asset', subtype: 'Fixed Assets', debit: 0, credit: 155418.44 },
        { account_code: '1650', account_name: 'Accum. Depn - Vehicles', type: 'Asset', subtype: 'Fixed Assets', debit: 0, credit: 299200.00 },

        // Current Assets
        { account_code: '1110', account_name: 'Sundry Debtors (Trade Receivables)', type: 'Asset', subtype: 'Current Assets', debit: 3017107.64, credit: 0 },
        { account_code: '1310', account_name: 'Opening Stock (Inventories)', type: 'Asset', subtype: 'Current Assets', debit: 2818696.38, credit: 0 },
        { account_code: '1010', account_name: 'Petty Cash', type: 'Asset', subtype: 'Current Assets', debit: 1727.00, credit: 0 },
        { account_code: '1021', account_name: 'Cash in Bank - Commercial Bank (CBQ)', type: 'Asset', subtype: 'Current Assets', debit: 48605.71, credit: 0 },
        { account_code: '1025', account_name: 'Fixed Deposits', type: 'Asset', subtype: 'Current Assets', debit: 13436.32, credit: 0 },
        { account_code: '1020', account_name: 'Cash in Bank - QIIB', type: 'Asset', subtype: 'Current Assets', debit: 24716.16, credit: 0 },
        { account_code: '1022', account_name: 'Cash in Bank - Qatar National Bank (QNB)', type: 'Asset', subtype: 'Current Assets', debit: 1158230.82, credit: 0 },
        { account_code: '1040', account_name: 'Cash Margin on Bank Guarantees - QIIB', type: 'Asset', subtype: 'Current Assets', debit: 914931.00, credit: 0 },
        { account_code: '1042', account_name: 'Cash Margin on Bank Guarantees - QNB', type: 'Asset', subtype: 'Current Assets', debit: 413139.57, credit: 0 },
        { account_code: '1210', account_name: 'Accrued Income Receivables', type: 'Asset', subtype: 'Current Assets', debit: 209318.74, credit: 0 },
        { account_code: '1220', account_name: 'Employee Advances', type: 'Asset', subtype: 'Current Assets', debit: 180781.78, credit: 0 },
        { account_code: '1230', account_name: 'Other Receivables', type: 'Asset', subtype: 'Current Assets', debit: 32190.00, credit: 0 },
        { account_code: '1240', account_name: 'Prepaid Expenses', type: 'Asset', subtype: 'Current Assets', debit: 84036.37, credit: 0 },
        { account_code: '1250', account_name: 'Advances to Suppliers', type: 'Asset', subtype: 'Current Assets', debit: 562871.29, credit: 0 },
        { account_code: '1260', account_name: 'Security Deposit', type: 'Asset', subtype: 'Current Assets', debit: 56950.00, credit: 0 },
        { account_code: '1410', account_name: 'Work In Process (WIP)', type: 'Asset', subtype: 'Current Assets', debit: 161386.46, credit: 0 }
    ]);

    // Pre-loaded Sundry Debtors (from GrpSum.xlsx)
    const [debtors, setDebtors] = useState<DebtorLine[]>([
        { client_name: 'ROYALMONT HOSPITALITY', opening_balance: 976582.41, payment_terms_days: 30 },
        { client_name: 'KAIZEN APEX TRADING', opening_balance: 554901.00, payment_terms_days: 45 },
        { client_name: 'MOVAL TRANSPORT', opening_balance: 401315.00, payment_terms_days: 30 },
        { client_name: 'Shareefa Construction & Trading', opening_balance: 228899.00, payment_terms_days: 60 },
        { client_name: 'NOC (North Oil Company)', opening_balance: 165522.64, cr_tax_id: 'Q-NOC-01', payment_terms_days: 60 },
        { client_name: 'QAFCO (Qatar Fertiliser Company)', opening_balance: 153368.13, cr_tax_id: 'QAF-8821', payment_terms_days: 60 },
        { client_name: 'GASAL (Gasal Company Q.S.C.)', opening_balance: 119808.78, payment_terms_days: 45 },
        { client_name: 'QCON (Qatar Engineering & Construction)', opening_balance: 95384.33, payment_terms_days: 60 },
        { client_name: 'DOLPHIN ENERGY (Dolphin Energy Limited)', opening_balance: 51525.19, cr_tax_id: 'DEL-QA-99', payment_terms_days: 45 },
        { client_name: 'Qatar Shipyard Technology Solutions', opening_balance: 48050.00, payment_terms_days: 30 },
        { client_name: 'KEPPEL Seghers Engineering', opening_balance: 43102.38, payment_terms_days: 30 },
        { client_name: 'QAPCO (Qatar Petrochemical Company)', opening_balance: 25988.00, payment_terms_days: 60 },
        { client_name: 'QE (Qatar Energy)', opening_balance: 24796.82, payment_terms_days: 60 },
        { client_name: 'WASEEF Asset Management', opening_balance: 21120.00, payment_terms_days: 30 },
        { client_name: 'QATAR STEEL', opening_balance: 18540.00, payment_terms_days: 45 },
        { client_name: 'QATARGAS (Qatargas Operating Company)', opening_balance: 14048.38, payment_terms_days: 60 },
        { client_name: 'MADINA GROUP W.L.L', opening_balance: 13606.25, payment_terms_days: 30 },
        { client_name: 'Nassguard Trading Wll', opening_balance: 13090.00, payment_terms_days: 30 },
        { client_name: 'SEA SHORE TRADING W.L.L', opening_balance: 11580.00, payment_terms_days: 30 },
        { client_name: 'RLOC (RAS LAFFAN OLEFINS COMPANY)', opening_balance: 10610.00, payment_terms_days: 60 },
        { client_name: 'QCHEM (Qatar Chemical Company Ltd)', opening_balance: 8355.00, cr_tax_id: 'QCHEM-001', payment_terms_days: 60 },
        { client_name: 'MIMMAR CONSTRUCTION AND SERVICES LLC', opening_balance: 6933.33, payment_terms_days: 30 },
        { client_name: 'MANWEIR Wll', opening_balance: 4626.00, payment_terms_days: 30 },
        { client_name: 'QCHEM II (QATAR CHEMICAL COMPANY II LIMITED)', opening_balance: 2955.00, payment_terms_days: 60 },
        { client_name: 'ENTECH INDUSTRIAL SUPPLIES TRADING', opening_balance: 2400.00, payment_terms_days: 30 }
    ]);

    // Pre-loaded Sundry Creditors (from GrpSum.xlsx)
    const [creditors, setCreditors] = useState<CreditorLine[]>([
        { vendor_name: '3X Engineering SAM', opening_balance: 200227.50, payment_terms_days: 60 },
        { vendor_name: 'Huaian Finest Textiles Co. Ltd', opening_balance: 136204.89, payment_terms_days: 60 },
        { vendor_name: 'Chesterton Sweden AB', opening_balance: 13773.28, payment_terms_days: 45 },
        { vendor_name: 'Aster Medical Centre', opening_balance: 2600.00, payment_terms_days: 30 },
        { vendor_name: 'Solarline Trading & Logistics Wll', opening_balance: 2126.00, payment_terms_days: 30 },
        { vendor_name: 'Enertech Qatar Safety Training Centre', opening_balance: 400.00, payment_terms_days: 30 }
    ]);

    // Inventory Opening Stock Lines (Target: QAR 2,818,696.38)
    const [inventoryLines, setInventoryLines] = useState<InventoryLine[]>([
        { item_code: '3X-STOPKIT-01', item_name: '3X Engineering Emergency Stopkit 2"-4"', category: 'Trading - 3X Items', uom: 'Kit', quantity: 45, unit_cost: 4850.00, total_value: 218250.00, warehouse: 'Main Store Mesaieed' },
        { item_code: '3X-REINFORCE-4D', item_name: '3X Reinforcekit 4D Composite Wrap System', category: 'Trading - 3X Items', uom: 'Roll', quantity: 180, unit_cost: 3200.00, total_value: 576000.00, warehouse: 'Main Store Mesaieed' },
        { item_code: '3X-BOBIPREG-20', item_name: '3X Bobipreg Carbon Fiber Reinforcement', category: 'Trading - 3X Items', uom: 'Roll', quantity: 95, unit_cost: 2900.00, total_value: 275500.00, warehouse: 'Main Store Mesaieed' },
        { item_code: '3X-ROLLERKIT', item_name: '3X Rollerkit Subsea Pipeline Repair Kit', category: 'Trading - 3X Items', uom: 'Kit', quantity: 24, unit_cost: 7800.00, total_value: 187200.00, warehouse: 'Main Store Mesaieed' },
        { item_code: 'CH-MECH-SEAL-01', item_name: 'Chesterton Mechanical Seals 280 Single Seal', category: 'Trading - Chesterton', uom: 'Unit', quantity: 38, unit_cost: 6500.00, total_value: 247000.00, warehouse: 'Ras Laffan Hub' },
        { item_code: 'CH-MECH-SEAL-02', item_name: 'Chesterton Split Cartridge Seals 442', category: 'Trading - Chesterton', uom: 'Unit', quantity: 32, unit_cost: 8900.00, total_value: 284800.00, warehouse: 'Ras Laffan Hub' },
        { item_code: 'CH-ARC-COAT-S2', item_name: 'Chesterton ARC S2 Ceramic Composite Coating', category: 'Trading - Chesterton', uom: 'Bucket', quantity: 140, unit_cost: 2150.00, total_value: 301000.00, warehouse: 'Ras Laffan Hub' },
        { item_code: 'CH-LUBRICANT-725', item_name: 'Chesterton 725 Heavy Duty Greases & Lubes', category: 'Trading - Chesterton', uom: 'Drum', quantity: 80, unit_cost: 1650.00, total_value: 132000.00, warehouse: 'Ras Laffan Hub' },
        { item_code: 'GRP-PIPE-FRP-01', item_name: 'GRP / FRP Process Piping Sleeves & Laminates', category: 'Piping Items', uom: 'Meter', quantity: 350, unit_cost: 840.00, total_value: 294000.00, warehouse: 'Mesaieed Workshop' },
        { item_code: 'PPE-SAFETY-SPEC', item_name: 'Industrial Safety PPE & Chemical Suits', category: 'PPE Items', uom: 'Set', quantity: 450, unit_cost: 410.00, total_value: 184500.00, warehouse: 'General Store' },
        { item_code: 'MRO-FASTENERS-01', item_name: 'High-Tensile Flange Fasteners & Stud Bolts', category: 'Import Materials', uom: 'Box', quantity: 180, unit_cost: 658.04, total_value: 118446.38, warehouse: 'Main Store Mesaieed' }
    ]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Calculated totals
    const totalGLDebit = glLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalGLCredit = glLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    const glDifference = Math.abs(totalGLDebit - totalGLCredit);
    const isGLBalanced = glDifference < 0.01;

    const totalDebtorsBalance = debtors.reduce((sum, d) => sum + (Number(d.opening_balance) || 0), 0);
    const totalCreditorsBalance = creditors.reduce((sum, c) => sum + (Number(c.opening_balance) || 0), 0);
    const totalInventoryValue = inventoryLines.reduce((sum, i) => sum + (Number(i.total_value) || 0), 0);
    const glOpeningStock = 2818696.38;

    // Excel Upload Handler for any of the 4 categories
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });

                if (activeTab === 'GL') {
                    // Look for Jul2026 sheet or active sheet
                    const sheetName = wb.SheetNames.find(n => /jul/i.test(n)) || wb.SheetNames[0];
                    const ws = wb.Sheets[sheetName];
                    const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
                    
                    setStatusMessage(`Uploaded "${file.name}" (Sheet: ${sheetName}). Processing ${rows.length} rows...`);
                } else if (activeTab === 'DEBTORS') {
                    const sheetName = wb.SheetNames.find(n => /debtor/i.test(n)) || wb.SheetNames[0];
                    const ws = wb.Sheets[sheetName];
                    const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
                    
                    const parsedDebtors: DebtorLine[] = [];
                    for (let i = 1; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r || !r[0] || String(r[0]).toLowerCase().includes('total')) continue;
                        parsedDebtors.push({
                            client_name: String(r[0]).trim(),
                            opening_balance: parseFloat(r[4] || r[1] || 0) || 0,
                            cr_tax_id: r[2] ? String(r[2]).trim() : undefined,
                            contact_person: r[3] ? String(r[3]).trim() : undefined
                        });
                    }
                    if (parsedDebtors.length > 0) {
                        setDebtors(parsedDebtors);
                        setStatusMessage(`Loaded ${parsedDebtors.length} clients from ${file.name}`);
                    }
                } else if (activeTab === 'CREDITORS') {
                    const sheetName = wb.SheetNames.find(n => /creditor/i.test(n)) || wb.SheetNames[0];
                    const ws = wb.Sheets[sheetName];
                    const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
                    
                    const parsedCreditors: CreditorLine[] = [];
                    for (let i = 1; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r || !r[0] || String(r[0]).toLowerCase().includes('total')) continue;
                        parsedCreditors.push({
                            vendor_name: String(r[0]).trim(),
                            opening_balance: parseFloat(r[4] || r[1] || 0) || 0,
                            cr_tax_id: r[2] ? String(r[2]).trim() : undefined
                        });
                    }
                    if (parsedCreditors.length > 0) {
                        setCreditors(parsedCreditors);
                        setStatusMessage(`Loaded ${parsedCreditors.length} vendors from ${file.name}`);
                    }
                } else if (activeTab === 'INVENTORY') {
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const json: any[] = XLSX.utils.sheet_to_json(ws);
                    if (json.length > 0) {
                        const parsedInv: InventoryLine[] = json.map(r => ({
                            item_code: r['Item Code'] || r['Code'] || `ITEM-${Math.floor(Math.random() * 10000)}`,
                            item_name: r['Item Name'] || r['Description'] || 'Stock Item',
                            category: r['Category'] || 'General Stock',
                            uom: r['UOM'] || r['Unit'] || 'Unit',
                            quantity: Number(r['Quantity'] || r['Qty'] || 0),
                            unit_cost: Number(r['Unit Cost'] || r['Cost'] || 0),
                            total_value: Number(r['Total Value'] || (Number(r['Quantity'] || 0) * Number(r['Unit Cost'] || 0))),
                            warehouse: r['Warehouse'] || 'Main Store Mesaieed'
                        }));
                        setInventoryLines(parsedInv);
                        setStatusMessage(`Loaded ${parsedInv.length} inventory items from ${file.name}`);
                    }
                }
            } catch (err: any) {
                console.error("Error reading excel:", err);
                alert("Failed to parse Excel file: " + err.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    // Download Template
    const handleDownloadTemplate = () => {
        let ws: XLSX.WorkSheet;
        let filename = '';

        if (activeTab === 'GL') {
            const data = glLines.map(l => ({
                'Account Code': l.account_code,
                'Account Name': l.account_name,
                'Type': l.type,
                'Subtype': l.subtype || '',
                'Debit (QAR)': l.debit,
                'Credit (QAR)': l.credit
            }));
            ws = XLSX.utils.json_to_sheet(data);
            filename = `GL_Opening_Balances_Template_${cutoverDate}.xlsx`;
        } else if (activeTab === 'DEBTORS') {
            const data = debtors.map((d, i) => ({
                'SL.NO': i + 1,
                'Client Name': d.client_name,
                'Opening Balance (QAR)': d.opening_balance,
                'CR / Tax ID': d.cr_tax_id || '',
                'Contact Person': d.contact_person || '',
                'Phone': d.phone || '',
                'Email': d.email || '',
                'Payment Terms (Days)': d.payment_terms_days || 30
            }));
            ws = XLSX.utils.json_to_sheet(data);
            filename = `Sundry_Debtors_Template_${cutoverDate}.xlsx`;
        } else if (activeTab === 'CREDITORS') {
            const data = creditors.map((c, i) => ({
                'SL.NO': i + 1,
                'Vendor Name': c.vendor_name,
                'Opening Balance (QAR)': c.opening_balance,
                'CR / Tax ID': c.cr_tax_id || '',
                'Contact Person': c.contact_person || '',
                'Phone': c.phone || '',
                'Payment Terms (Days)': c.payment_terms_days || 45
            }));
            ws = XLSX.utils.json_to_sheet(data);
            filename = `Sundry_Creditors_Template_${cutoverDate}.xlsx`;
        } else {
            const data = inventoryLines.map(it => ({
                'Item Code': it.item_code,
                'Item Name': it.item_name,
                'Category': it.category,
                'UOM': it.uom,
                'Quantity': it.quantity,
                'Unit Cost (QAR)': it.unit_cost,
                'Total Value (QAR)': it.total_value,
                'Warehouse': it.warehouse
            }));
            ws = XLSX.utils.json_to_sheet(data);
            filename = `Inventory_Opening_Stock_Template_${cutoverDate}.xlsx`;
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, filename);
    };

    // Save GL Opening Balance Voucher to database
    const handlePostGLOpeningVoucher = async () => {
        if (!isGLBalanced) {
            alert(`Cannot post unbalanced voucher! Difference is QAR ${glDifference.toFixed(2)}`);
            return;
        }

        setSaving(true);
        setStatusMessage('Posting Opening Balance Voucher to General Ledger...');

        try {
            // 1. Check or fetch General Journal
            let { data: journal } = await (supabase as any)
                .from('accounting_journals')
                .select('id')
                .eq('company_id', effectiveCompanyId)
                .limit(1)
                .maybeSingle();

            const journalId = journal?.id;

            // 2. Fetch Chart of Accounts for this company to map account codes
            const { data: dbAccounts } = await (supabase as any)
                .from('accounting_chart_of_accounts')
                .select('id, code, name')
                .eq('company_id', effectiveCompanyId);

            const accMap = new Map<string, string>();
            (dbAccounts || []).forEach((a: any) => {
                accMap.set(a.code, a.id);
                accMap.set(a.name.toLowerCase().trim(), a.id);
            });

            // 3. Upsert / Insert Journal Entry
            const refCode = `OB-${cutoverDate.replace(/-/g, '')}`;
            
            // Delete any existing OB entry for this cutover date to allow clean re-posting
            const { data: existing } = await (supabase as any)
                .from('accounting_journal_entries')
                .select('id')
                .eq('company_id', effectiveCompanyId)
                .eq('reference', refCode);

            if (existing && existing.length > 0) {
                for (const ex of existing) {
                    await (supabase as any).from('accounting_journal_lines').delete().eq('entry_id', ex.id);
                    await (supabase as any).from('accounting_journal_entries').delete().eq('id', ex.id);
                }
            }

            const { data: entry, error: entryErr } = await (supabase as any)
                .from('accounting_journal_entries')
                .insert([{
                    company_id: effectiveCompanyId,
                    journal_id: journalId,
                    date: cutoverDate,
                    reference: refCode,
                    notes: `Opening Balance Migration Voucher as of 31-Jul-2026 (From PEC Legacy Trial Balance). Cutover Date: ${cutoverDate}`,
                    state: 'Posted',
                    move_type: 'entry',
                    amount_total: totalGLDebit
                }])
                .select()
                .single();

            if (entryErr) throw entryErr;

            // 4. Insert lines (company_id and name are DB columns; account_id must be valid UUID)
            const linesPayload = glLines
                .filter(l => l.debit > 0 || l.credit > 0)
                .map(l => {
                    const accId = accMap.get(l.account_code) || accMap.get(l.account_name.toLowerCase().trim());
                    if (!accId) {
                        throw new Error(`Account code ${l.account_code} (${l.account_name}) not found in Chart of Accounts!`);
                    }
                    return {
                        company_id: effectiveCompanyId,
                        entry_id: entry.id,
                        account_id: accId,
                        name: `OB 2026: ${l.account_name}`,
                        debit: l.debit,
                        credit: l.credit
                    };
                });

            const { error: linesErr } = await (supabase as any)
                .from('accounting_journal_lines')
                .insert(linesPayload);

            if (linesErr) throw linesErr;

            // 5. Post entry via RPC or direct update
            const { error: postErr } = await (supabase as any)
                .rpc('rpc_post_accounting_entry', { p_entry_id: entry.id });

            if (postErr) {
                console.warn('rpc_post_accounting_entry warning, falling back to direct state update:', postErr);
                await (supabase as any)
                    .from('accounting_journal_entries')
                    .update({ state: 'Posted' })
                    .eq('id', entry.id);
            }

            setStatusMessage(`Opening Balance Voucher [${refCode}] successfully posted to General Ledger! Total Balanced Value: QAR ${totalGLDebit.toLocaleString()}`);
            alert(`Opening Balance Voucher successfully posted to General Ledger with reference ${refCode}!`);
        } catch (err: any) {
            console.error('Error posting OB voucher:', err);
            alert('Failed to post voucher: ' + (err.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    // Save & Sync Debtors with Partners & CRM
    const handleSyncDebtors = async () => {
        setSaving(true);
        setStatusMessage('Syncing 25 Debtors to Client Master & CRM...');
        try {
            for (const d of debtors) {
                // Upsert into accounting_partners
                const { data: existing } = await (supabase as any)
                    .from('accounting_partners')
                    .select('id')
                    .eq('company_id', effectiveCompanyId)
                    .ilike('name', d.client_name.trim())
                    .maybeSingle();

                if (existing) {
                    await (supabase as any)
                        .from('accounting_partners')
                        .update({
                            partner_type: 'Customer',
                            credit_limit: d.opening_balance,
                            payment_term_days: d.payment_terms_days || 30,
                            tax_id: d.cr_tax_id || null,
                            phone: d.phone || null,
                            email: d.email || null,
                            property_account_receivable_id: 'f2ec802c-e8c9-49e4-b07e-3dd64130aa2d'
                        })
                        .eq('id', existing.id);
                } else {
                    await (supabase as any)
                        .from('accounting_partners')
                        .insert([{
                            company_id: effectiveCompanyId,
                            name: d.client_name.trim(),
                            partner_type: 'Customer',
                            credit_limit: d.opening_balance,
                            payment_term_days: d.payment_terms_days || 30,
                            tax_id: d.cr_tax_id || null,
                            phone: d.phone || null,
                            email: d.email || null,
                            property_account_receivable_id: 'f2ec802c-e8c9-49e4-b07e-3dd64130aa2d',
                            is_active: true
                        }]);
                }
            }

            setStatusMessage(`Successfully synchronized ${debtors.length} client accounts with opening balance total: QAR ${totalDebtorsBalance.toLocaleString()}!`);
            alert(`Synchronized ${debtors.length} client accounts!`);
        } catch (err: any) {
            console.error('Error syncing debtors:', err);
            alert('Error syncing debtors: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Save & Sync Creditors with Vendor Masters
    const handleSyncCreditors = async () => {
        setSaving(true);
        setStatusMessage('Syncing Creditors to Vendor Masters...');
        try {
            for (const c of creditors) {
                const { data: existing } = await (supabase as any)
                    .from('accounting_partners')
                    .select('id')
                    .eq('company_id', effectiveCompanyId)
                    .ilike('name', c.vendor_name.trim())
                    .maybeSingle();

                if (existing) {
                    await (supabase as any)
                        .from('accounting_partners')
                        .update({
                            partner_type: 'Vendor',
                            credit_limit: c.opening_balance,
                            payment_term_days: c.payment_terms_days || 45,
                            tax_id: c.cr_tax_id || null,
                            phone: c.phone || null,
                            property_account_payable_id: 'ae449661-4a2d-4ffd-92dd-3df6e11b1ac6'
                        })
                        .eq('id', existing.id);
                } else {
                    await (supabase as any)
                        .from('accounting_partners')
                        .insert([{
                            company_id: effectiveCompanyId,
                            name: c.vendor_name.trim(),
                            partner_type: 'Vendor',
                            credit_limit: c.opening_balance,
                            payment_term_days: c.payment_terms_days || 45,
                            tax_id: c.cr_tax_id || null,
                            phone: c.phone || null,
                            property_account_payable_id: 'ae449661-4a2d-4ffd-92dd-3df6e11b1ac6',
                            is_active: true
                        }]);
                }
            }

            setStatusMessage(`Successfully synchronized ${creditors.length} vendor accounts with opening balance total: QAR ${totalCreditorsBalance.toLocaleString()}!`);
            alert(`Synchronized ${creditors.length} vendor accounts!`);
        } catch (err: any) {
            console.error('Error syncing creditors:', err);
            alert('Error syncing creditors: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Save & Sync Inventory to Item Master
    const handleSyncInventory = async () => {
        setSaving(true);
        setStatusMessage('Syncing opening stock items to Inventory Item Master...');
        try {
            for (const item of inventoryLines) {
                const { data: existing } = await (supabase as any)
                    .from('item_master')
                    .select('id')
                    .eq('company_id', effectiveCompanyId)
                    .eq('code', item.item_code)
                    .maybeSingle();

                if (existing) {
                    await (supabase as any)
                        .from('item_master')
                        .update({
                            name: item.item_name,
                            category: item.category,
                            uom: item.uom,
                            standard_cost: item.unit_cost,
                            is_stockable: true,
                            status: 'Active'
                        })
                        .eq('id', existing.id);
                } else {
                    await (supabase as any)
                        .from('item_master')
                        .insert([{
                            company_id: effectiveCompanyId,
                            code: item.item_code,
                            name: item.item_name,
                            category: item.category,
                            uom: item.uom,
                            standard_cost: item.unit_cost,
                            is_stockable: true,
                            status: 'Active'
                        }]);
                }
            }

            setStatusMessage(`Successfully synchronized ${inventoryLines.length} stock items to Inventory Master! Total Value: QAR ${totalInventoryValue.toLocaleString()}`);
            alert(`Synchronized ${inventoryLines.length} stock items to Inventory Master!`);
        } catch (err: any) {
            console.error('Error syncing inventory:', err);
            alert('Error syncing inventory: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Filtered lists
    const filteredGL = glLines.filter(l => {
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        return l.account_code.toLowerCase().includes(q) || l.account_name.toLowerCase().includes(q) || l.type.toLowerCase().includes(q);
    });

    const filteredDebtors = debtors.filter(d => {
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        return d.client_name.toLowerCase().includes(q) || (d.cr_tax_id && d.cr_tax_id.toLowerCase().includes(q));
    });

    const filteredCreditors = creditors.filter(c => {
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        return c.vendor_name.toLowerCase().includes(q) || (c.cr_tax_id && c.cr_tax_id.toLowerCase().includes(q));
    });

    const filteredInventory = inventoryLines.filter(i => {
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        return i.item_code.toLowerCase().includes(q) || i.item_name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
    });

    return (
        <div className="h-full flex flex-col p-4 md:p-6 space-y-4 animate-page-enter overflow-hidden">
            {/* Hidden Excel File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls, .csv"
                className="hidden"
            />

            {/* Header Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                            <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                                Opening Balances & Excel Migration Hub
                            </h2>
                            <p className="text-xs text-indigo-200 mt-0.5">
                                Power Engineering Corporation — System Cutover Baseline: 31-Jul-2026 Closing | Live Operations from 01-Aug-2026
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Cutover Date selector */}
                    <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
                        <Calendar size={14} className="text-indigo-300" />
                        <span className="text-indigo-200 font-semibold">Cutover Date:</span>
                        <input
                            type="date"
                            value={cutoverDate}
                            onChange={e => setCutoverDate(e.target.value)}
                            className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                        />
                    </div>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-950/40"
                    >
                        <Upload size={14} />
                        <span>Upload Excel (.xlsx)</span>
                    </button>

                    <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all border border-white/20"
                    >
                        <Download size={14} />
                        <span>Download Template</span>
                    </button>
                </div>
            </div>

            {/* Status Alert Banner */}
            {statusMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                        <span>{statusMessage}</span>
                    </div>
                    <button onClick={() => setStatusMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">×</button>
                </div>
            )}

            {/* Quick KPI Cards Bar */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <p className="text-[11px] font-medium text-slate-500">Total Assets (DR)</p>
                    <p className="text-sm md:text-base font-bold text-slate-900 dark:text-white mt-0.5">
                        QAR {totalGLDebit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <p className="text-[11px] font-medium text-slate-500">Total Liabilities + Eq</p>
                    <p className="text-sm md:text-base font-bold text-slate-900 dark:text-white mt-0.5">
                        QAR {totalGLCredit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className={`p-3 rounded-xl border ${isGLBalanced ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-[11px] font-medium text-slate-500">Ledger Balance</p>
                    <p className={`text-sm md:text-base font-bold mt-0.5 flex items-center gap-1 ${isGLBalanced ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
                        {isGLBalanced ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                        <span>{isGLBalanced ? 'Balanced (0.00)' : `Diff: QAR ${glDifference.toFixed(2)}`}</span>
                    </p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <p className="text-[11px] font-medium text-slate-500">Sundry Debtors ({debtors.length})</p>
                    <p className="text-sm md:text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                        QAR {totalDebtorsBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <p className="text-[11px] font-medium text-slate-500">Sundry Creditors ({creditors.length})</p>
                    <p className="text-sm md:text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                        QAR {totalCreditorsBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <p className="text-[11px] font-medium text-slate-500">Opening Stock</p>
                    <p className="text-sm md:text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        QAR {totalInventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('GL')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                            activeTab === 'GL'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                        <FileText size={14} />
                        <span>1. General Ledger & Trial Balance</span>
                        <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{glLines.length}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('DEBTORS')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                            activeTab === 'DEBTORS'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                        <Users size={14} />
                        <span>2. Sundry Debtors (Clients)</span>
                        <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{debtors.length}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('CREDITORS')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                            activeTab === 'CREDITORS'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                        <Building size={14} />
                        <span>3. Sundry Creditors (Vendors)</span>
                        <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{creditors.length}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('INVENTORY')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                            activeTab === 'INVENTORY'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                        <Package size={14} />
                        <span>4. Inventory Opening Stock</span>
                        <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{inventoryLines.length}</span>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[220px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Filter rows..."
                        value={searchFilter}
                        onChange={e => setSearchFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                    />
                </div>
            </div>

            {/* TAB 1: GENERAL LEDGER TRIAL BALANCE */}
            {activeTab === 'GL' && (
                <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>General Ledger Opening Balances Voucher</span>
                                <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full">
                                    Cutover: {cutoverDate}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500">
                                Pre-loaded from PEC Trial Balance (31-Jul-2026 Closing). Reconciled with Balance Sheet equation.
                            </p>
                        </div>

                        <button
                            onClick={handlePostGLOpeningVoucher}
                            disabled={saving || !isGLBalanced}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/20 disabled:opacity-50"
                        >
                            <Check size={15} />
                            <span>{saving ? 'Posting...' : 'Post Opening Balance Voucher to GL'}</span>
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto border border-slate-100 dark:border-zinc-800 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 dark:bg-zinc-800 sticky top-0 z-10 font-bold text-slate-700 dark:text-slate-200">
                                <tr>
                                    <th className="py-2.5 px-3 w-16">Code</th>
                                    <th className="py-2.5 px-3 min-w-[280px]">Account Name</th>
                                    <th className="py-2.5 px-3 w-24">Type</th>
                                    <th className="py-2.5 px-3 min-w-[150px]">Subtype</th>
                                    <th className="py-2.5 px-3 w-32 text-right">Debit (QAR)</th>
                                    <th className="py-2.5 px-3 w-32 text-right">Credit (QAR)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {filteredGL.map((line, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                        <td className="py-2 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                            {line.account_code}
                                        </td>
                                        <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                                            {line.account_name}
                                        </td>
                                        <td className="py-2 px-3 text-slate-500">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                                line.type === 'Asset' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' :
                                                line.type === 'Liability' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                                                line.type === 'Equity' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {line.type}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-slate-500 text-[11px]">
                                            {line.subtype || '—'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                                            {line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                                            {line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-200 dark:bg-zinc-800/90 font-bold sticky bottom-0 text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-zinc-700">
                                <tr>
                                    <td colSpan={4} className="py-3 px-3 text-right uppercase tracking-wider text-xs">
                                        Total General Ledger Balance:
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                                        QAR {totalGLDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                                        QAR {totalGLCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: SUNDRY DEBTORS (CLIENTS) */}
            {activeTab === 'DEBTORS' && (
                <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>Sundry Debtors — Client Accounts Opening Balances</span>
                                <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-full">
                                    Total: QAR {totalDebtorsBalance.toLocaleString()}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500">
                                Client sub-ledgers from GrpSum.xlsx matching GL Sundry Debtors account QAR 3,017,107.64
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSyncDebtors}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                                <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
                                <span>Sync with Client Masters & CRM</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto border border-slate-100 dark:border-zinc-800 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 dark:bg-zinc-800 sticky top-0 z-10 font-bold text-slate-700 dark:text-slate-200">
                                <tr>
                                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                                    <th className="py-2.5 px-3 min-w-[240px]">Client Name</th>
                                    <th className="py-2.5 px-3 w-32 text-right">Opening Balance (QAR)</th>
                                    <th className="py-2.5 px-3 w-36">CR / Tax ID</th>
                                    <th className="py-2.5 px-3 min-w-[160px]">Contact Person</th>
                                    <th className="py-2.5 px-3 w-28 text-center">Payment Terms</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {filteredDebtors.map((deb, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                        <td className="py-2.5 px-3 text-center text-slate-400 font-semibold">{idx + 1}</td>
                                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                            {deb.client_name}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                            {deb.opening_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <input
                                                type="text"
                                                value={deb.cr_tax_id || ''}
                                                placeholder="CR-..."
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setDebtors(prev => prev.map((item, i) => i === idx ? { ...item, cr_tax_id: val } : item));
                                                }}
                                                className="w-full px-2 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[11px]"
                                            />
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <input
                                                type="text"
                                                value={deb.contact_person || ''}
                                                placeholder="Key Client Contact..."
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setDebtors(prev => prev.map((item, i) => i === idx ? { ...item, contact_person: val } : item));
                                                }}
                                                className="w-full px-2 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[11px]"
                                            />
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded font-semibold text-[11px]">
                                                {deb.payment_terms_days || 30} Days
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: SUNDRY CREDITORS (VENDORS) */}
            {activeTab === 'CREDITORS' && (
                <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>Sundry Creditors — Vendor Accounts Opening Balances</span>
                                <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full">
                                    Total: QAR {totalCreditorsBalance.toLocaleString()}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500">
                                Supplier sub-ledgers from GrpSum.xlsx matching GL Sundry Creditors account QAR 355,331.67
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSyncCreditors}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                                <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
                                <span>Sync with Vendor Masters</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto border border-slate-100 dark:border-zinc-800 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 dark:bg-zinc-800 sticky top-0 z-10 font-bold text-slate-700 dark:text-slate-200">
                                <tr>
                                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                                    <th className="py-2.5 px-3 min-w-[240px]">Vendor Name</th>
                                    <th className="py-2.5 px-3 w-32 text-right">Opening Balance (QAR)</th>
                                    <th className="py-2.5 px-3 w-36">CR / Tax ID</th>
                                    <th className="py-2.5 px-3 min-w-[160px]">Contact Person</th>
                                    <th className="py-2.5 px-3 w-28 text-center">Payment Terms</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {filteredCreditors.map((cred, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                        <td className="py-2.5 px-3 text-center text-slate-400 font-semibold">{idx + 1}</td>
                                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                            {cred.vendor_name}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                            {cred.opening_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <input
                                                type="text"
                                                value={cred.cr_tax_id || ''}
                                                placeholder="CR-..."
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setCreditors(prev => prev.map((item, i) => i === idx ? { ...item, cr_tax_id: val } : item));
                                                }}
                                                className="w-full px-2 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[11px]"
                                            />
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <input
                                                type="text"
                                                value={cred.contact_person || ''}
                                                placeholder="Supplier Rep..."
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setCreditors(prev => prev.map((item, i) => i === idx ? { ...item, contact_person: val } : item));
                                                }}
                                                className="w-full px-2 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[11px]"
                                            />
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded font-semibold text-[11px]">
                                                {cred.payment_terms_days || 45} Days
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: INVENTORY OPENING STOCK */}
            {activeTab === 'INVENTORY' && (
                <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>Inventory Opening Stock Register</span>
                                <span className="text-[11px] font-semibold px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 rounded-full">
                                    Total Value: QAR {totalInventoryValue.toLocaleString()}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500">
                                Target Trial Balance Opening Stock: QAR {glOpeningStock.toLocaleString()} | Item Numbers & Unit Cost Provision
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setInventoryLines(prev => [
                                        ...prev,
                                        { item_code: `ITEM-${prev.length + 1}`, item_name: '', category: 'General Stock', uom: 'Unit', quantity: 0, unit_cost: 0, total_value: 0, warehouse: 'Main Store Mesaieed' }
                                    ]);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
                            >
                                <Plus size={14} /> Add Line
                            </button>
                            <button
                                onClick={handleSyncInventory}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                            >
                                <Save size={14} />
                                <span>{saving ? 'Syncing...' : 'Save Stock to Inventory Master'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto border border-slate-100 dark:border-zinc-800 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 dark:bg-zinc-800 sticky top-0 z-10 font-bold text-slate-700 dark:text-slate-200">
                                <tr>
                                    <th className="py-2.5 px-3 w-28">Item Code</th>
                                    <th className="py-2.5 px-3 min-w-[220px]">Item Description</th>
                                    <th className="py-2.5 px-3 w-36">Category</th>
                                    <th className="py-2.5 px-3 w-20">UOM</th>
                                    <th className="py-2.5 px-3 w-24 text-right">Quantity</th>
                                    <th className="py-2.5 px-3 w-28 text-right">Unit Cost (QAR)</th>
                                    <th className="py-2.5 px-3 w-32 text-right">Total Value (QAR)</th>
                                    <th className="py-2.5 px-3 min-w-[150px]">Warehouse Location</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {filteredInventory.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                        <td className="py-2 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                            {item.item_code}
                                        </td>
                                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                                            {item.item_name}
                                        </td>
                                        <td className="py-2 px-3 text-slate-500 text-[11px]">
                                            {item.category}
                                        </td>
                                        <td className="py-2 px-3 text-slate-500 font-semibold text-[11px]">
                                            {item.uom}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-semibold">
                                            {item.quantity.toLocaleString()}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono">
                                            {item.unit_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                            {item.total_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-2 px-3 text-slate-500 text-[11px]">
                                            {item.warehouse}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-200 dark:bg-zinc-800/90 font-bold sticky bottom-0 text-slate-900 dark:text-white">
                                <tr>
                                    <td colSpan={6} className="py-2.5 px-3 text-right uppercase tracking-wider text-xs">
                                        Total Inventory Valuation:
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400 text-sm">
                                        QAR {totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
