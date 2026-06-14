import { Deal, Contact, LeadAnalysis, Task, Stage, Lead, Customer, Opportunity } from "./types";
import { supabase } from "../../lib/supabase";
import { CRMStage, CRMTaskStatus, CRMTaskPriority, CRMDocument, CRMActivity } from "../../types";

// --- Gemini Live API Client ---
// Live API Client Placeholder
export const getLiveClient = (): any => {
  throw new Error("Gemini Live API is not configured. Please install @google/genai package and set VITE_GEMINI_API_KEY.");
};

// --- Supabase Services ---

// MASTERS
export const getStages = async (): Promise<CRMStage[]> => {
  const { data, error } = await supabase
    .from('org_crm_stages')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching stages:', error);
    return [];
  }
  return (data || []) as any as CRMStage[];
}

export const getTaskStatuses = async (): Promise<CRMTaskStatus[]> => {
  const { data, error } = await (supabase as any).from('org_task_status')
    .select('*');
  if (error) return [];
  return (data || []) as any as CRMTaskStatus[];
}

export const getTaskPriorities = async (): Promise<CRMTaskPriority[]> => {
  const { data, error } = await (supabase as any).from('org_task_priority')
    .select('*');
  if (error) return [];
  return (data || []) as any as CRMTaskPriority[];
}

// LEADS
export const getLeads = async (): Promise<Lead[]> => {
  const { data, error } = await (supabase as any).from('crm_leads')
    .select(`
        *,
        lead_owner:employees!crm_leads_lead_owner_id_fkey(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching leads:', error);
    return [];
  }
  return data || [];
};

export const createLead = async (lead: Partial<Lead>): Promise<Lead | null> => {
  const { data, error } = await (supabase as any).from('crm_leads')
    .insert([lead])
    .select()
    .single();

  if (error) {
    console.error('Error creating lead:', error);
    return null;
  }
  return data;
};

export const updateLead = async (id: string, updates: Partial<Lead>): Promise<Lead | null> => {
  const { data, error } = await (supabase as any).from('crm_leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating lead:', error);
    return null;
  }
  return data;
};

// CUSTOMERS
export const getCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await (supabase as any).from('crm_customers')
    .select(`*`)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
  return data || [];
};

export const createCustomer = async (customer: Partial<Customer>): Promise<Customer | null> => {
  const { data, error } = await (supabase as any).from('crm_customers')
    .insert([customer])
    .select()
    .single();

  if (error) {
    console.error('Error creating customer:', error);
    return null;
  }
  return data;
};

export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<Customer | null> => {
  const { data, error } = await (supabase as any).from('crm_customers')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating customer:', error);
    return null;
  }
  return data;
};

// OPPORTUNITIES
export const getOpportunities = async (): Promise<Opportunity[]> => {
  const { data, error } = await (supabase as any).from('crm_opportunities')
    .select(`
        *,
        customer:crm_customers(*),
        stage:org_crm_stages(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching opportunities:', error);
    return [];
  }
  return data || [];
};

export const createOpportunity = async (opp: Partial<Opportunity>): Promise<Opportunity | null> => {
  const { data, error } = await (supabase as any).from('crm_opportunities')
    .insert([opp])
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating opportunity:', error);
    return null;
  }
  return data;
};

export const updateOpportunity = async (id: string, updates: Partial<Opportunity>): Promise<Opportunity | null> => {
  const { data, error } = await (supabase as any).from('crm_opportunities')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating opportunity:', error);
    return null;
  }
  return data;
};

// --- CONVERSION FLOW ---

// Lead → Opportunity
export const convertLeadToOpportunity = async (
  lead: Lead,
  companyId: string,
  firstStageId: number,
  ownerId?: string
): Promise<Opportunity | null> => {
  // 1. Create Opportunity from Lead data
  const oppPayload: Partial<Opportunity> = {
    company_id: companyId,
    title: `${lead.organization_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ')} - Opportunity`,
    lead_id: lead.id,
    stage_id: firstStageId,
    status: 'Open',
    probability: 20,
    currency: 'INR',
    amount: lead.annual_revenue || 0,
    owner_id: ownerId || lead.lead_owner_id,
    type: 'Sales',
  };

  const newOpp = await createOpportunity(oppPayload);
  if (!newOpp) return null;

  // 2. Mark Lead as Converted
  await updateLead(lead.id, {
    status: 'Converted',
    is_converted: true,
    converted_opportunity_id: newOpp.id,
  } as any);

  return newOpp;
};

// Opportunity → Customer (Won)
export const convertOpportunityToCustomer = async (
  opp: Opportunity,
  companyId: string,
  ownerId?: string
): Promise<Customer | null> => {
  // 1. Create Customer from Opportunity data
  const custPayload: Partial<Customer> = {
    company_id: companyId,
    name: opp.title.replace(/ - Opportunity$/, ''),
    customer_type: 'Company',
    lifecycle_stage: 'Converted from Opportunity',
    status: 'Active',
    owner_id: ownerId || opp.owner_id,
    // If opportunity has customer data already, use it
    primary_email: opp.customer?.primary_email,
    primary_phone: opp.customer?.primary_phone,
    industry: opp.customer?.industry,
    website: opp.customer?.website,
  };

  const newCust = await createCustomer(custPayload);
  if (!newCust) return null;

  // 2. Mark Opportunity as Won and link to customer
  await updateOpportunity(opp.id, {
    status: 'Won',
    customer_id: newCust.id,
  } as any);

  // 3. If this opp was from a lead, update the lead too
  if (opp.lead_id) {
    await (supabase as any)
      .from('crm_leads')
      .update({ converted_customer_id: newCust.id })
      .eq('id', opp.lead_id);
  }

  return newCust;
};

// DEALS (Legacy / To be migrated)
export const getDeals = async (): Promise<Deal[]> => {
  const { data, error } = await (supabase as any).from('crm_deals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching deals:', error);
    return [];
  }
  return data || [];
};

export const createDeal = async (deal: Partial<Deal>): Promise<Deal | null> => {
  console.log('Creating deal payload:', deal);
  const { data, error } = await (supabase as any).from('crm_deals')
    .insert([deal])
    .select();

  if (error) {
    console.error('Error creating deal (Supabase):', JSON.stringify(error, null, 2));
    return null;
  }

  const createdDeal = data?.[0] || null;

  // Log Activity
  if (createdDeal) {
    await logActivity({
      entity_type: 'DEAL',
      entity_id: createdDeal.id.toString(),
      action: 'CREATED',
      description: `Deal '${createdDeal.title}' created with value ${createdDeal.value}`
    });
  }

  return createdDeal;
};

// WORKFLOW HELPERS
export const checkWorkflowAvailability = async (companyId: string): Promise<string | null> => {
  const { data, error } = await (supabase as any).from('workflows')
    .select('id')
    .eq('module', 'CRM')
    .eq('trigger_type', 'DEAL_APPROVAL')
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data.id;
};

export const updateDealStage = async (id: number, stage_id: number, company_id?: string, owner_id?: string): Promise<{ success: boolean, pendingApproval?: boolean }> => {
  // 1. Check if a workflow applies
  let workflowId = null;
  if (company_id) {
    workflowId = await checkWorkflowAvailability(company_id);
  }

  // 2. If workflow exists, create a request instead of updating
  if (workflowId && owner_id) {
    const { error: wfError } = await supabase.rpc('rpc_submit_workflow_request', {
      p_workflow_id: workflowId,
      p_source_id: id.toString(),
      p_requester_id: owner_id // In a real app, this should be the current user's ID
    });

    if (!wfError) {
      // Set the pending target stage on the deal so UI knows
      await (supabase as any)
        .from('crm_deals')
        .update({ pending_target_stage_id: stage_id })
        .eq('id', id);

      return { success: true, pendingApproval: true };
    } else {
      console.error('Workflow submission failed', wfError);
      // Fallback to normal update if workflow fails? checking policy... no, secure default is fail.
      return { success: false };
    }
  }

  // 3. Normal Update
  const { error } = await (supabase as any).from('crm_deals')
    .update({ stage_id: stage_id, pending_target_stage_id: null }) // Clear pending if any
    .eq('id', id);

  if (error) {
    console.error('Error updating deal:', error);
    return { success: false };
  }
  // Log Activity
  const stageName = (await getStages()).find(s => s.id === stage_id)?.name;
  await logActivity({
    entity_type: 'DEAL',
    entity_id: id.toString(),
    action: 'STAGE_CHANGED',
    description: `Deal moved to stage ${stageName || stage_id}`
  });

  return { success: true };
};

// CONTACTS
export const getContacts = async (): Promise<Contact[]> => {
  const { data, error } = await (supabase as any).from('crm_contacts')
    .select(`
        *,
        assignee:employees(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }
  return data || [];
};

export const createContact = async (contact: Partial<Contact>): Promise<Contact | null> => {
  const { data, error } = await (supabase as any).from('crm_contacts')
    .insert([contact])
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating contact:', error);
    return null;
  }

  // Log Activity
  if (data) {
    await logActivity({
      entity_type: 'CONTACT',
      entity_id: data.id.toString(),
      action: 'CREATED',
      description: `Contact '${data.name}' created`
    });
  }
  return data;
};

// TASKS
export const getTasks = async (): Promise<Task[]> => {
  const { data, error } = await (supabase as any).from('crm_tasks')
    .select(`
        *,
        status_details:org_task_status(*),
        priority_details:org_task_priority(*),
        assignee:employees(*)
    `)
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
  return data || [];
};

export const createTask = async (task: Partial<Task>): Promise<Task | null> => {
  // For tasks, we need to handle reference IDs for status and priority
  // This helper assumes 'task' might contain direct 'status_id' etc. 
  // If the UI sends raw strings, we need lookup. But let's assume UI sends IDs for V1.2
  const { data, error } = await (supabase as any).from('crm_tasks')
    .insert([task])
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating task:', error);
    return null;
  }

  // Log Activity
  if (data) {
    await logActivity({
      entity_type: 'TASK',
      entity_id: data.id.toString(),
      action: 'CREATED',
      description: `Task '${data.title}' created`
    });
  }
  return data;
};

// --- AI Functions (Edge Function Calls) ---

export const analyzeLead = async (contact: Contact): Promise<LeadAnalysis | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-ai', {
      body: { action: 'analyze-lead', payload: { contact } }
    });

    if (error) throw error;
    if (!data) return null;

    // Edge function returns the JSON object directly
    return data as LeadAnalysis;
  } catch (error) {
    console.error("AI Analysis Failed (Edge):", error);
    return { score: 50, reasoning: "AI Service Unavailable (Check Edge Function)", suggestedAction: "Manual review required" };
  }
};

export const generatePipelineInsight = async (deals: Deal[]): Promise<string> => {
  try {
    const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    // Note: Assuming 'WON' stage name logic. Better to filter by stage type or specific ID if known.
    // For V1.2 we'll check if stage name is 'WON' via the joined object if available, or just fallback.
    // Since we joined stage, d.stage is an object now.
    const wonValue = deals.filter(d => d.stage?.name === 'WON').reduce((sum, d) => sum + (d.value || 0), 0);
    const openDeals = deals.filter(d => d.stage?.name !== 'WON').length;

    const payload = {
      stats: { totalValue, wonValue, openDeals }
    };

    const { data, error } = await supabase.functions.invoke('gemini-ai', {
      body: { action: 'pipeline-insight', payload }
    });

    if (error) throw error;
    return typeof data === 'string' ? data : JSON.stringify(data);

  } catch (error) {
    console.warn("Insight Generation Failed:", error);
    return "Pipeline analysis unavailable.";
  }
};

export const draftEmail = async (contact: Contact): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-ai', {
      body: { action: 'draft-email', payload: { contact } }
    });

    if (error) throw error;
    return typeof data === 'string' ? data : "";
  } catch (error) {
    return "Error drafting email.";
  }
};

// --- NEW V1.2 SERVICES (Documents & Activities) ---

// DOCUMENTS
export const getDocuments = async (): Promise<CRMDocument[]> => {
  const { data, error } = await (supabase as any).from('crm_documents')
    .select(`*, uploader:employees(*)`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
  return data || [];
};

export const createDocument = async (doc: Partial<CRMDocument>): Promise<CRMDocument | null> => {
  const { data, error } = await (supabase as any).from('crm_documents')
    .insert([doc])
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating document:', error);
    return null;
  }

  // Log Upload
  if (data) {
    await logActivity({
      entity_type: data.related_type,
      entity_id: data.related_id.toString(),
      action: 'DOCUMENT_UPLOADED',
      description: `Document '${data.name}' uploaded`
    });
  }

  return data;
};

// ACTIVITIES
export const getActivities = async (): Promise<CRMActivity[]> => {
  const { data, error } = await (supabase as any).from('crm_activity_log')
    .select(`*, performer:employees(*)`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
  return data || [];
};

export async function logActivity(activity: Partial<CRMActivity>): Promise<void> {
  // Get current user employee ID if not provided (best effort)
  let performerId = activity.performed_by;
  if (!performerId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Try to find employee linked to this user
      const { data: emp } = await (supabase as any).from('employees').select('id').eq('email', user.email).maybeSingle();
      if (emp) performerId = emp.id;
    }
  }

  const { error } = await (supabase as any).from('crm_activity_log').insert([{
    ...activity,
    performed_by: performerId
  }]);

  if (error) console.error('Error logging activity:', error);
};

export const getUserRole = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await (supabase as any).from('employees')
    .select(`
            role:roles(name)
        `)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (error || !data || !data.role) return null;

  // Supabase returns array if relational, but .single() on employee + object relation means role should be object
  // However, if roles() returns an array (one-to-many potentially), we handle it.
  // Given schema, employee -> role is Many-to-One, so it returns single object if not array mode.
  // Casting safely.
  return (data.role as any).name;
};

// --- ITEMS ---
import type { CRMItem, CRMQuotation, CRMQuotationLine, CRMSalesInvoice, CRMSalesInvoiceLine, CRMDeliveryNote, CRMDeliveryNoteLine, CRMAttachment } from './types';

export const getItems = async (): Promise<CRMItem[]> => {
  const { data, error } = await (supabase as any).from('item_master')
    .select('*')
    .order('name');
  if (error) { console.error('Error fetching items:', error); return []; }
  return data || [];
};

export const createItem = async (item: Partial<CRMItem>): Promise<CRMItem | null> => {
  const { data, error } = await (supabase as any).from('item_master').insert([item]).select().maybeSingle();
  if (error) { console.error('Error creating item:', error); return null; }
  return data;
};

export const updateItem = async (id: string, updates: Partial<CRMItem>): Promise<CRMItem | null> => {
  const { data, error } = await (supabase as any).from('item_master').update(updates).eq('id', id).select().maybeSingle();
  if (error) { console.error('Error updating item:', error); return null; }
  return data;
};

export const importItems = async (itemsList: Partial<CRMItem>[]): Promise<boolean> => {
  const { error } = await (supabase as any).from('item_master').insert(itemsList);
  if (error) {
    console.error('Error importing items:', error);
    return false;
  }
  return true;
};

// --- QUOTATIONS ---
export const getQuotations = async (): Promise<CRMQuotation[]> => {
  const { data, error } = await (supabase as any).from('crm_quotations')
    .select('*, customer:crm_customers(*)')
    .order('created_at', { ascending: false });
  if (error) { console.error('Error fetching quotations:', error); return []; }
  return data || [];
};

export const getQuotation = async (id: string): Promise<CRMQuotation | null> => {
  const { data, error } = await (supabase as any).from('crm_quotations')
    .select('*, customer:crm_customers(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) { console.error('Error fetching quotation:', error); return null; }
  return data;
};

export const getQuotationLines = async (quotationId: string): Promise<CRMQuotationLine[]> => {
  const { data, error } = await (supabase as any).from('crm_quotation_lines')
    .select('*')
    .eq('quotation_id', quotationId)
    .order('sort_order');
  if (error) { console.error('Error fetching quotation lines:', error); return []; }
  return data || [];
};

export const createQuotation = async (quot: Partial<CRMQuotation>): Promise<CRMQuotation | null> => {
  const { data, error } = await (supabase as any).from('crm_quotations').insert([quot]).select().maybeSingle();
  if (error) { console.error('Error creating quotation:', error); return null; }
  return data;
};

export const updateQuotation = async (id: string, updates: Partial<CRMQuotation>): Promise<CRMQuotation | null> => {
  const { data, error } = await (supabase as any).from('crm_quotations').update(updates).eq('id', id).select().maybeSingle();
  if (error) { console.error('Error updating quotation:', error); return null; }
  return data;
};

export const saveQuotationLines = async (quotationId: string, lines: CRMQuotationLine[]): Promise<boolean> => {
  // Delete existing lines, then insert new
  await (supabase as any).from('crm_quotation_lines').delete().eq('quotation_id', quotationId);
  if (lines.length === 0) return true;
  const toInsert = lines.map((l, i) => ({ ...l, quotation_id: quotationId, sort_order: i, id: undefined, amount: undefined }));
  const { error } = await (supabase as any).from('crm_quotation_lines').insert(toInsert);
  if (error) { console.error('Error saving quotation lines:', error); return false; }
  return true;
};

// --- SALES INVOICES ---
export const getSalesInvoices = async (): Promise<CRMSalesInvoice[]> => {
  const { data, error } = await (supabase as any).from('crm_sales_invoices')
    .select('*, customer:crm_customers(*)')
    .order('created_at', { ascending: false });
  if (error) { console.error('Error fetching invoices:', error); return []; }
  return data || [];
};

export const createSalesInvoice = async (inv: Partial<CRMSalesInvoice>): Promise<CRMSalesInvoice | null> => {
  const { data, error } = await (supabase as any).from('crm_sales_invoices').insert([inv]).select().maybeSingle();
  if (error) { console.error('Error creating invoice:', error); return null; }
  return data;
};

export const updateSalesInvoice = async (id: string, updates: Partial<CRMSalesInvoice>): Promise<CRMSalesInvoice | null> => {
  const { data, error } = await (supabase as any).from('crm_sales_invoices').update(updates).eq('id', id).select().maybeSingle();
  if (error) { console.error('Error updating invoice:', error); return null; }
  return data;
};

export const getSalesInvoiceLines = async (invoiceId: string): Promise<CRMSalesInvoiceLine[]> => {
  const { data, error } = await (supabase as any).from('crm_sales_invoice_lines').select('*').eq('invoice_id', invoiceId).order('sort_order');
  if (error) return [];
  return data || [];
};

export const saveSalesInvoiceLines = async (invoiceId: string, lines: CRMSalesInvoiceLine[]): Promise<boolean> => {
  await (supabase as any).from('crm_sales_invoice_lines').delete().eq('invoice_id', invoiceId);
  if (lines.length === 0) return true;
  const toInsert = lines.map((l, i) => ({ ...l, invoice_id: invoiceId, sort_order: i, id: undefined, amount: undefined }));
  const { error } = await (supabase as any).from('crm_sales_invoice_lines').insert(toInsert);
  if (error) { console.error('Error saving invoice lines:', error); return false; }
  return true;
};

// --- DELIVERY NOTES ---
export const getDeliveryNotes = async (): Promise<CRMDeliveryNote[]> => {
  const { data, error } = await (supabase as any).from('crm_delivery_notes')
    .select('*, customer:crm_customers(*)')
    .order('created_at', { ascending: false });
  if (error) { console.error('Error fetching delivery notes:', error); return []; }
  return data || [];
};

export const createDeliveryNote = async (dn: Partial<CRMDeliveryNote>): Promise<CRMDeliveryNote | null> => {
  const { data, error } = await (supabase as any).from('crm_delivery_notes').insert([dn]).select().maybeSingle();
  if (error) { console.error('Error creating delivery note:', error); return null; }
  return data;
};

export const updateDeliveryNote = async (id: string, updates: Partial<CRMDeliveryNote>): Promise<CRMDeliveryNote | null> => {
  const { data, error } = await (supabase as any).from('crm_delivery_notes').update(updates).eq('id', id).select().maybeSingle();
  if (error) { console.error('Error updating delivery note:', error); return null; }
  return data;
};

export const getDeliveryNoteLines = async (dnId: string): Promise<CRMDeliveryNoteLine[]> => {
  const { data, error } = await (supabase as any).from('crm_delivery_note_lines').select('*').eq('delivery_note_id', dnId).order('sort_order');
  if (error) return [];
  return data || [];
};

export const saveDeliveryNoteLines = async (dnId: string, lines: CRMDeliveryNoteLine[]): Promise<boolean> => {
  await (supabase as any).from('crm_delivery_note_lines').delete().eq('delivery_note_id', dnId);
  if (lines.length === 0) return true;
  const toInsert = lines.map((l, i) => ({ ...l, delivery_note_id: dnId, sort_order: i, id: undefined }));
  const { error } = await (supabase as any).from('crm_delivery_note_lines').insert(toInsert);
  if (error) { console.error('Error saving DN lines:', error); return false; }
  return true;
};

// --- ATTACHMENTS ---
export const getAttachments = async (module: string, recordId: string): Promise<CRMAttachment[]> => {
  const { data, error } = await (supabase as any).from('crm_attachments')
    .select('*')
    .eq('module', module)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
};

export const uploadAttachment = async (
  companyId: string,
  module: string,
  recordId: string,
  file: File,
  userId?: string
): Promise<CRMAttachment | null> => {
  const path = `crm/${companyId}/${module}/${recordId}/${Date.now()}_${file.name}`;
  const { error: uploadErr } = await supabase.storage.from('attachments').upload(path, file);
  if (uploadErr) { console.error('Upload error:', uploadErr); return null; }
  const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
  const { data, error } = await (supabase as any).from('crm_attachments').insert([{
    company_id: companyId,
    module,
    record_id: recordId,
    file_name: file.name,
    file_url: urlData.publicUrl,
    file_size: file.size,
    file_type: file.type,
    uploaded_by: userId
  }]).select().maybeSingle();
  if (error) { console.error('Error saving attachment:', error); return null; }
  return data;
};

export const deleteAttachment = async (id: string, fileUrl: string): Promise<boolean> => {
  // Extract path from URL for storage deletion
  const path = fileUrl.split('/storage/v1/object/public/attachments/')[1];
  if (path) await supabase.storage.from('attachments').remove([path]);
  const { error } = await (supabase as any).from('crm_attachments').delete().eq('id', id);
  return !error;
};

// --- CONVERSION: Quotation → Invoice ---
export const convertQuotationToInvoice = async (quotation: CRMQuotation, companyId: string, ownerId?: string): Promise<CRMSalesInvoice | null> => {
  const lines = await getQuotationLines(quotation.id);
  const inv = await createSalesInvoice({
    company_id: companyId,
    customer_id: quotation.customer_id,
    quotation_id: quotation.id,
    currency: quotation.currency,
    subtotal: quotation.subtotal,
    tax_amount: quotation.tax_amount,
    discount_amount: quotation.discount_amount,
    grand_total: quotation.grand_total,
    terms_and_conditions: quotation.terms_and_conditions,
    notes: quotation.notes,
    owner_id: ownerId,
    status: 'Unpaid',
  });
  if (!inv) return null;
  const invLines = lines.map(l => ({
    item_id: l.item_id,
    item_name: l.item_name,
    description: l.description,
    quantity: l.quantity,
    rate: l.rate,
    discount_percent: l.discount_percent,
    tax_percent: l.tax_percent,
  })) as CRMSalesInvoiceLine[];
  await saveSalesInvoiceLines(inv.id, invLines);
  await updateQuotation(quotation.id, { status: 'Accepted' } as any);
  return inv;
};

// --- CONVERSION: Invoice → Delivery Note ---
export const convertInvoiceToDeliveryNote = async (invoice: CRMSalesInvoice, companyId: string, ownerId?: string): Promise<CRMDeliveryNote | null> => {
  const lines = await getSalesInvoiceLines(invoice.id);
  const dn = await createDeliveryNote({
    company_id: companyId,
    customer_id: invoice.customer_id,
    invoice_id: invoice.id,
    quotation_id: invoice.quotation_id,
    owner_id: ownerId,
    status: 'Pending',
  });
  if (!dn) return null;
  const dnLines = lines.map(l => ({
    item_id: l.item_id,
    item_name: l.item_name,
    description: l.description,
    quantity_ordered: l.quantity,
    quantity_delivered: 0,
    uom: '',
  })) as CRMDeliveryNoteLine[];
  await saveDeliveryNoteLines(dn.id, dnLines);
  return dn;
};
