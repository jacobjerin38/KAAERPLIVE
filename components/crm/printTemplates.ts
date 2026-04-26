import { supabase } from '../../lib/supabase';
import { CRMQuotation, CRMQuotationLine, CRMSalesInvoice, CRMSalesInvoiceLine, CRMDeliveryNote, CRMDeliveryNoteLine, CRMCustomer } from './types';

// ─── HTML Escape (XSS Prevention) ───
function escapeHtml(str: string | null | undefined): string {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─── Company Profile ───
export interface CompanyProfile {
    id: string;
    name: string;
    display_name?: string;
    legal_name?: string;
    email?: string;
    phone?: string;
    website?: string;
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    country?: string;
    zip_code?: string;
    tax_id?: string;
    currency?: string;
    logo_url?: string;
}

export async function fetchCompanyProfile(companyId: string): Promise<CompanyProfile | null> {
    const { data } = await supabase
        .from('companies')
        .select('id, name, display_name, legal_name, email, phone, website, address_line_1, address_line_2, city, state, country, zip_code, tax_id, currency, logo_url')
        .eq('id', companyId)
        .maybeSingle();
    return data;
}

// ─── Print Template Config ───
export interface PrintTemplateConfig {
    id?: string;
    name: string;
    show_logo: boolean;
    header_color: string;
    accent_color: string;
    font_family: string;
    show_tax_breakdown: boolean;
    show_terms: boolean;
    show_amount_in_words: boolean;
    footer_text: string;
    paper_size: 'A4' | 'Letter';
}

export function getDefaultTemplate(): PrintTemplateConfig {
    return {
        name: 'Default',
        show_logo: true,
        header_color: '#1e293b',
        accent_color: '#3b82f6',
        font_family: "'Inter', 'Segoe UI', sans-serif",
        show_tax_breakdown: true,
        show_terms: true,
        show_amount_in_words: true,
        footer_text: 'Thank you for your business!',
        paper_size: 'A4',
    };
}

export async function fetchCustomTemplates(companyId: string): Promise<PrintTemplateConfig[]> {
    const { data } = await supabase
        .from('print_templates')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
    if (!data || data.length === 0) return [];
    return data.map((t: any) => ({
        id: t.id,
        name: t.name,
        ...(t.config || {}),
    }));
}

// ─── Currency helpers ───
const CURRENCY_SYMBOLS: Record<string, string> = {
    QAR: 'QAR', INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SAR: '﷼', JPY: '¥',
};

function getCurrencySymbol(currency?: string): string {
    return CURRENCY_SYMBOLS[currency || 'QAR'] || (currency || 'QAR');
}

function formatMoney(amount: number, currency?: string): string {
    const sym = getCurrencySymbol(currency);
    return `${sym} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Number to words (Indian) ───
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numberToWordsHelper(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numberToWordsHelper(n % 100) : '');
    if (n < 100000) return numberToWordsHelper(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numberToWordsHelper(n % 1000) : '');
    if (n < 10000000) return numberToWordsHelper(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numberToWordsHelper(n % 100000) : '');
    return numberToWordsHelper(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numberToWordsHelper(n % 10000000) : '');
}

function amountInWords(amount: number, currency?: string): string {
    const cur = currency || 'QAR';
    const wholePart = Math.floor(Math.abs(amount));
    const fractionPart = Math.round((Math.abs(amount) - wholePart) * 100);
    const currencyWord = cur === 'QAR' ? 'Qatari Riyals' : cur === 'INR' ? 'Rupees' : cur === 'USD' ? 'Dollars' : cur === 'EUR' ? 'Euros' : cur === 'GBP' ? 'Pounds' : cur;
    const subUnit = cur === 'QAR' ? 'Dirhams' : cur === 'INR' ? 'Paise' : 'Cents';
    let result = `${currencyWord} ${numberToWordsHelper(wholePart)}`;
    if (fractionPart > 0) result += ` and ${numberToWordsHelper(fractionPart)} ${subUnit}`;
    return result + ' Only';
}

// ─── Main HTML Generator ───
export type DocumentType = 'quotation' | 'invoice' | 'delivery_note';

interface GenerateHTMLOptions {
    documentType: DocumentType;
    document: CRMQuotation | CRMSalesInvoice | CRMDeliveryNote;
    lines: CRMQuotationLine[] | CRMSalesInvoiceLine[] | CRMDeliveryNoteLine[];
    customer?: CRMCustomer;
    company: CompanyProfile;
    template: PrintTemplateConfig;
}

function getDocTitle(type: DocumentType): string {
    switch (type) {
        case 'quotation': return 'QUOTATION';
        case 'invoice': return 'TAX INVOICE';
        case 'delivery_note': return 'DELIVERY NOTE';
    }
}

function getDocDate(type: DocumentType, doc: any): string {
    switch (type) {
        case 'quotation': return doc.quotation_date || '';
        case 'invoice': return doc.invoice_date || '';
        case 'delivery_note': return doc.delivery_date || '';
    }
}

function calcLineAmount(l: any): number {
    const qty = l.quantity ?? l.quantity_ordered ?? 0;
    const rate = l.rate ?? 0;
    const disc = l.discount_percent ?? 0;
    return qty * rate * (1 - disc / 100);
}

export function generateDocumentHTML(opts: GenerateHTMLOptions): string {
    const { documentType, document: doc, lines, customer, company, template } = opts;
    const currency = (doc as any).currency || company.currency || 'QAR';
    const docTitle = getDocTitle(documentType);
    const docDate = getDocDate(documentType, doc);
    const isDeliveryNote = documentType === 'delivery_note';
    const isInvoice = documentType === 'invoice';

    const companyName = escapeHtml(company.display_name || company.legal_name || company.name || '');
    const companyAddr = escapeHtml([company.address_line_1, company.address_line_2, company.city, company.state, company.zip_code, company.country].filter(Boolean).join(', '));
    const custAddr = customer ? escapeHtml([customer.billing_address_line_1, customer.billing_address_line_2, customer.billing_city, customer.billing_state, customer.billing_zip_code, customer.billing_country].filter(Boolean).join(', ')) : '';

    // Totals
    let subtotal = 0, taxTotal = 0;
    if (!isDeliveryNote) {
        subtotal = (doc as any).subtotal ?? lines.reduce((s: number, l: any) => s + calcLineAmount(l), 0);
        taxTotal = (doc as any).tax_amount ?? lines.reduce((s: number, l: any) => s + calcLineAmount(l) * ((l.tax_percent || 0) / 100), 0);
    }
    const grandTotal = (doc as any).grand_total ?? (subtotal + taxTotal);

    const logoHTML = template.show_logo && company.logo_url
        ? `<img src="${company.logo_url}" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;" />`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${docTitle} - ${companyName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: ${template.font_family}; font-size:12px; color:#1e293b; background:#fff; }
  .page { width:210mm; min-height:297mm; margin:0 auto; padding:20mm 15mm; position:relative; }
  @media print { .page { padding:12mm 10mm; margin:0; width:100%; } .no-print { display:none !important; } @page { margin:8mm; size:A4; } }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:3px solid ${template.accent_color}; }
  .company-info h1 { font-size:22px; font-weight:700; color:${template.header_color}; margin-bottom:4px; }
  .company-info p { font-size:11px; color:#64748b; line-height:1.6; }

  /* Doc Title */
  .doc-title { text-align:center; margin:16px 0; }
  .doc-title h2 { font-size:18px; font-weight:700; color:${template.accent_color}; letter-spacing:2px; }

  /* Info Grid */
  .info-grid { display:flex; justify-content:space-between; margin-bottom:20px; gap:24px; }
  .info-block { flex:1; }
  .info-block h4 { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:${template.accent_color}; margin-bottom:8px; }
  .info-block p { font-size:11px; line-height:1.6; color:#334155; }
  .info-block .value { font-weight:600; color:#0f172a; }

  /* Table */
  .items-table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  .items-table thead th { background:${template.header_color}; color:#fff; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:1px; padding:10px 12px; text-align:left; }
  .items-table thead th:first-child { border-radius:6px 0 0 0; }
  .items-table thead th:last-child { border-radius:0 6px 0 0; text-align:right; }
  .items-table tbody td { padding:10px 12px; font-size:11px; border-bottom:1px solid #e2e8f0; }
  .items-table tbody tr:hover { background:#f8fafc; }
  .items-table .num { text-align:center; color:#94a3b8; }
  .items-table .qty { text-align:center; }
  .items-table .money { text-align:right; font-variant-numeric:tabular-nums; }

  /* Totals */
  .totals-section { display:flex; justify-content:flex-end; margin-bottom:20px; }
  .totals-table { width:280px; }
  .totals-table .row { display:flex; justify-content:space-between; padding:6px 0; font-size:12px; color:#475569; }
  .totals-table .row.grand { border-top:2px solid ${template.header_color}; padding-top:10px; margin-top:4px; font-size:14px; font-weight:700; color:${template.header_color}; }
  .totals-table .row.paid { color:#059669; }
  .totals-table .row.balance { color:#dc2626; font-weight:600; }

  /* Amount in words */
  .amount-words { background:#f1f5f9; border-radius:6px; padding:10px 14px; margin-bottom:16px; font-size:11px; color:#334155; }
  .amount-words strong { color:#0f172a; }

  /* Terms */
  .terms { margin-top:16px; padding-top:12px; border-top:1px solid #e2e8f0; }
  .terms h4 { font-size:10px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:6px; }
  .terms p { font-size:10px; color:#64748b; line-height:1.5; white-space:pre-wrap; }

  /* Footer */
  .footer { margin-top:auto; padding-top:16px; border-top:1px solid #e2e8f0; text-align:center; font-size:10px; color:#94a3b8; }

  /* Print button bar */
  .print-bar { position:fixed; top:0; left:0; right:0; background:${template.header_color}; color:#fff; padding:12px 24px; display:flex; align-items:center; justify-content:space-between; z-index:9999; box-shadow:0 2px 12px rgba(0,0,0,.15); }
  .print-bar button { padding:8px 24px; border:none; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; transition: all 0.2s; }
  .print-bar .btn-print { background:${template.accent_color}; color:#fff; }
  .print-bar .btn-print:hover { opacity:.9; }
  .print-bar .btn-close { background:transparent; color:#fff; border:1px solid rgba(255,255,255,.3); }
  .print-bar .btn-close:hover { background:rgba(255,255,255,.1); }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <span style="font-weight:600;font-size:14px;">${docTitle} Preview</span>
    <div style="display:flex;gap:10px;">
      <button class="btn-close" onclick="window.close()">Close</button>
      <button class="btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
    </div>
  </div>

  <div class="page" style="margin-top:60px;">
    <!-- Header -->
    <div class="header">
      <div class="company-info">
        <h1>${companyName}</h1>
        ${companyAddr ? `<p>${companyAddr}</p>` : ''}
        ${company.phone ? `<p>Phone: ${escapeHtml(company.phone)}</p>` : ''}
        ${company.email ? `<p>Email: ${escapeHtml(company.email)}</p>` : ''}
        ${company.tax_id ? `<p style="font-weight:600;">GSTIN: ${escapeHtml(company.tax_id)}</p>` : ''}
      </div>
      <div style="text-align:right;">
        ${logoHTML}
      </div>
    </div>

    <!-- Document Title -->
    <div class="doc-title">
      <h2>${docTitle}</h2>
    </div>

    <!-- Info Grid -->
    <div class="info-grid">
      <div class="info-block">
        <h4>Bill To</h4>
        <p class="value">${escapeHtml(customer?.name) || 'N/A'}</p>
        ${custAddr ? `<p>${custAddr}</p>` : ''}
        ${customer?.primary_phone ? `<p>Phone: ${escapeHtml(customer.primary_phone)}</p>` : ''}
        ${customer?.primary_email ? `<p>Email: ${escapeHtml(customer.primary_email)}</p>` : ''}
        ${customer?.tax_id ? `<p>GSTIN: ${escapeHtml(customer.tax_id)}</p>` : ''}
      </div>
      <div class="info-block" style="text-align:right;">
        <h4>Document Details</h4>
        ${(doc as any).series ? `<p><span style="color:#64748b;">No:</span> <span class="value">${escapeHtml((doc as any).series)}</span></p>` : ''}
        <p><span style="color:#64748b;">Date:</span> <span class="value">${escapeHtml(docDate)}</span></p>
        ${documentType === 'quotation' && (doc as any).valid_until ? `<p><span style="color:#64748b;">Valid Until:</span> <span class="value">${escapeHtml((doc as any).valid_until)}</span></p>` : ''}
        ${isInvoice && (doc as any).due_date ? `<p><span style="color:#64748b;">Due Date:</span> <span class="value">${escapeHtml((doc as any).due_date)}</span></p>` : ''}
        ${isDeliveryNote && (doc as any).transporter ? `<p><span style="color:#64748b;">Transporter:</span> <span class="value">${escapeHtml((doc as any).transporter)}</span></p>` : ''}
        ${isDeliveryNote && (doc as any).tracking_number ? `<p><span style="color:#64748b;">Tracking #:</span> <span class="value">${escapeHtml((doc as any).tracking_number)}</span></p>` : ''}
        <p><span style="color:#64748b;">Status:</span> <span class="value">${escapeHtml((doc as any).status)}</span></p>
      </div>
    </div>

    <!-- Line Items -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:5%">#</th>
          <th style="width:${isDeliveryNote ? '40%' : '30%'}">Item</th>
          ${!isDeliveryNote ? `
          <th style="width:10%;text-align:center;">Qty</th>
          <th style="width:12%;text-align:right;">Rate</th>
          <th style="width:8%;text-align:center;">Disc%</th>
          <th style="width:8%;text-align:center;">Tax%</th>
          <th style="width:15%;text-align:right;">Amount</th>
          ` : `
          <th style="width:15%;text-align:center;">Ordered</th>
          <th style="width:15%;text-align:center;">Delivered</th>
          <th style="width:15%;text-align:center;">Remaining</th>
          `}
        </tr>
      </thead>
      <tbody>
        ${lines.map((line: any, idx: number) => {
        if (isDeliveryNote) {
            const rem = (line.quantity_ordered || 0) - (line.quantity_delivered || 0);
            return `<tr>
              <td class="num">${idx + 1}</td>
              <td><strong>${escapeHtml(line.item_name)}</strong>${line.description ? `<br/><span style="color:#64748b;font-size:10px;">${escapeHtml(line.description)}</span>` : ''}</td>
              <td class="qty">${line.quantity_ordered || 0}</td>
              <td class="qty">${line.quantity_delivered || 0}</td>
              <td class="qty" style="color:${rem > 0 ? '#d97706' : '#059669'};font-weight:600;">${rem}</td>
            </tr>`;
        } else {
            const amt = calcLineAmount(line);
            return `<tr>
              <td class="num">${idx + 1}</td>
              <td><strong>${escapeHtml(line.item_name)}</strong>${line.description ? `<br/><span style="color:#64748b;font-size:10px;">${escapeHtml(line.description)}</span>` : ''}</td>
              <td class="qty">${line.quantity || 0}</td>
              <td class="money">${formatMoney(line.rate || 0, currency)}</td>
              <td class="qty">${line.discount_percent || 0}%</td>
              <td class="qty">${line.tax_percent || 0}%</td>
              <td class="money">${formatMoney(amt, currency)}</td>
            </tr>`;
        }
    }).join('')}
      </tbody>
    </table>

    ${!isDeliveryNote ? `
    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-table">
        <div class="row"><span>Subtotal</span><span>${formatMoney(subtotal, currency)}</span></div>
        ${template.show_tax_breakdown ? `<div class="row"><span>Tax</span><span>${formatMoney(taxTotal, currency)}</span></div>` : ''}
        <div class="row grand"><span>Grand Total</span><span>${formatMoney(grandTotal, currency)}</span></div>
        ${isInvoice && (doc as any).amount_paid > 0 ? `
          <div class="row paid"><span>Amount Paid</span><span>${formatMoney((doc as any).amount_paid, currency)}</span></div>
          <div class="row balance"><span>Balance Due</span><span>${formatMoney(grandTotal - ((doc as any).amount_paid || 0), currency)}</span></div>
        ` : ''}
      </div>
    </div>

    ${template.show_amount_in_words ? `
    <div class="amount-words">
      <strong>Amount in Words:</strong> ${amountInWords(grandTotal, currency)}
    </div>
    ` : ''}
    ` : ''}

    ${isDeliveryNote && (doc as any).shipping_address ? `
    <div class="amount-words">
      <strong>Shipping Address:</strong> ${escapeHtml((doc as any).shipping_address)}
    </div>
    ` : ''}

    ${template.show_terms && ((doc as any).terms_and_conditions || (doc as any).notes) ? `
    <div class="terms">
      ${(doc as any).terms_and_conditions ? `<h4>Terms & Conditions</h4><p>${escapeHtml((doc as any).terms_and_conditions)}</p>` : ''}
      ${(doc as any).notes ? `<h4 style="margin-top:8px;">Notes</h4><p>${escapeHtml((doc as any).notes)}</p>` : ''}
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer" style="margin-top:40px;">
      <p>${escapeHtml(template.footer_text)}</p>
      ${company.website ? `<p>${escapeHtml(company.website)}</p>` : ''}
    </div>
  </div>
</body>
</html>`;
}
