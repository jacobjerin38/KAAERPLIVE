import { CRMDeal, CRMContact, CRMTask, CRMStage, CRMTaskStatus, CRMTaskPriority, CRMLeadSource, CRMActivity, CRMDocument } from '../../types';

export type { CRMDeal, CRMContact, CRMTask, CRMStage, CRMTaskStatus, CRMTaskPriority, CRMLeadSource, CRMActivity, CRMDocument };

export type CRMViewMode =
  | 'DASHBOARD'
  | 'LEADS'
  | 'OPPORTUNITIES'
  | 'CUSTOMERS'
  | 'PIPELINE'
  | 'TASKS'
  | 'SCHEDULE'
  | 'DOCUMENTS'
  | 'CONTACTS'
  | 'WORKFLOWS'
  | 'ASSISTANT'
  | 'UPDATES'
  | 'LIVE'
  | 'WEBSITE_FINDER'
  | 'REPORTS'
  | 'ITEMS'
  | 'QUOTATIONS'
  | 'SALES_INVOICES'
  | 'DELIVERY_NOTES';

// Alias strict types to module types for ease of use
export type Deal = CRMDeal;
export type Contact = CRMContact;
export type Task = CRMTask;
export type Stage = CRMStage;

// Restructured Interfaces

export interface CRMLead {
  id: string;
  company_id: string;
  series?: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Disqualified';

  // Personal
  salutation?: string;
  first_name: string;
  middle_name?: string;
  last_name?: string;
  gender?: string;
  job_title?: string;

  // Contact
  email?: string;
  mobile?: string;
  phone?: string;
  phone_ext?: string;
  whatsapp?: string;
  website?: string;

  // Class
  lead_type?: string;
  request_type?: string;
  lead_source_id?: number;
  lead_owner_id?: string;

  // Org
  organization_name?: string;
  no_of_employees?: string;
  annual_revenue?: number;
  industry?: string;
  market_segment?: string;
  territory?: string;
  fax?: string;

  // Address
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  zip_code?: string;

  // Conversion tracking
  is_converted?: boolean;
  converted_opportunity_id?: string;
  converted_customer_id?: string;
  qualification_notes?: string;

  created_at: string;
}

export interface CRMCustomer {
  id: string;
  company_id: string;
  name: string;
  customer_type: 'Company' | 'Individual';
  lifecycle_stage?: string;

  primary_email?: string;
  primary_phone?: string;

  billing_address_line_1?: string;
  billing_address_line_2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_country?: string;
  billing_zip_code?: string;

  website?: string;
  industry?: string;
  tax_id?: string;
  owner_id?: string;
  status: 'Active' | 'Inactive';
  created_at: string;
}

export interface CRMOpportunity {
  id: string;
  company_id: string;
  title: string;
  series?: string;

  customer_id?: string;
  customer?: CRMCustomer; // Joined
  lead_id?: string;

  stage_id: number;
  stage?: CRMStage; // Joined
  status: 'Open' | 'Won' | 'Lost';
  probability: number;

  type?: string;
  source_id?: number;
  expected_closing_date?: string;

  currency: string;
  amount: number;

  owner_id?: string;
  created_at: string;
}

// Aliases
export type Lead = CRMLead;
export type Opportunity = CRMOpportunity;
export type Customer = CRMCustomer;

export interface LeadAnalysis {
  score: number;
  reasoning: string;
  suggestedAction: string;
  suggestedTask?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}
export interface CRMStats {
  totalRevenue: number;
  activeDeals: number;
  totalContacts: number;
  conversionRate: number;
}

// --- Sales Module Types ---

export interface CRMItem {
  id: string;
  company_id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  uom: string;
  selling_price: number;
  buying_price: number;
  is_stockable?: boolean;
  status?: string;
  weight?: number;
  expiry_date?: string;
  created_at: string;
}

export interface CRMQuotation {
  id: string;
  company_id: string;
  series?: string;
  customer_id?: string;
  customer?: CRMCustomer;
  quotation_date?: string;
  valid_until?: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Cancelled';
  currency: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  terms_and_conditions?: string;
  notes?: string;
  opportunity_id?: string;
  owner_id?: string;
  created_at: string;
  lines?: CRMQuotationLine[];
}

export interface CRMQuotationLine {
  id?: string;
  quotation_id?: string;
  item_id?: string;
  item_name: string;
  description?: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  amount?: number;
  sort_order?: number;
}

export interface CRMSalesInvoice {
  id: string;
  company_id: string;
  series?: string;
  customer_id?: string;
  customer?: CRMCustomer;
  quotation_id?: string;
  invoice_date?: string;
  due_date?: string;
  status: 'Draft' | 'Unpaid' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Cancelled';
  currency: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  amount_paid: number;
  terms_and_conditions?: string;
  notes?: string;
  owner_id?: string;
  created_at: string;
  lines?: CRMSalesInvoiceLine[];
}

export interface CRMSalesInvoiceLine {
  id?: string;
  invoice_id?: string;
  item_id?: string;
  item_name: string;
  description?: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  amount?: number;
  sort_order?: number;
}

export interface CRMDeliveryNote {
  id: string;
  company_id: string;
  series?: string;
  customer_id?: string;
  customer?: CRMCustomer;
  invoice_id?: string;
  quotation_id?: string;
  delivery_date?: string;
  status: 'Draft' | 'Pending' | 'Delivered' | 'Returned' | 'Cancelled';
  shipping_address?: string;
  transporter?: string;
  tracking_number?: string;
  notes?: string;
  owner_id?: string;
  created_at: string;
  lines?: CRMDeliveryNoteLine[];
}

export interface CRMDeliveryNoteLine {
  id?: string;
  delivery_note_id?: string;
  item_id?: string;
  item_name: string;
  description?: string;
  quantity_ordered: number;
  quantity_delivered: number;
  uom?: string;
  sort_order?: number;
}

export interface CRMAttachment {
  id: string;
  company_id: string;
  module: string;
  record_id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  uploaded_by?: string;
  created_at: string;
}
