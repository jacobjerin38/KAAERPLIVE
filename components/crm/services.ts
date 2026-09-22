import { Deal, Contact, LeadAnalysis, Task, Stage, Lead, Customer, Opportunity, CRMCustomerWorkOrder } from "./types";
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

  if (error || !data || data.length === 0) {
    return [
      { id: '10000000-0000-0000-0000-000000000001', name: 'Qualification', position: 1, win_probability: 10, status: 'Active' },
      { id: '10000000-0000-0000-0000-000000000002', name: 'Proposal Sent', position: 2, win_probability: 50, status: 'Active' },
      { id: '10000000-0000-0000-0000-000000000003', name: 'Negotiation', position: 3, win_probability: 80, status: 'Active' },
      { id: '10000000-0000-0000-0000-000000000004', name: 'Won', position: 4, win_probability: 100, status: 'Active' },
      { id: '10000000-0000-0000-0000-000000000005', name: 'Lost', position: 5, win_probability: 0, status: 'Active' },
    ] as any;
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

// ACCESS CONTROL HELPERS
export const checkIsAdmin = (role?: string | null): boolean => {
  const r = (role || '').toLowerCase().trim();
  return ['admin', 'super admin', 'managing director', 'manager', 'general manager'].includes(r);
};

export const getLinkedEmployeeId = async (profileId: string): Promise<string | undefined> => {
  try {
    const { data } = await supabase
      .from('employees')
      .select('id')
      .eq('profile_id', profileId)
      .maybeSingle();
    return data?.id;
  } catch (e) {
    return undefined;
  }
};

export const getSalesReps = async (companyId: string): Promise<{ id: string; name: string; profileId?: string }[]> => {
  try {
    let query = (supabase as any)
      .from('employees')
      .select('id, name, profile_id')
      .order('name');

    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    query = query.neq('status', 'Resigned');

    const { data, error } = await query;
    if (error) {
      console.warn('Could not load employees for sales reps, falling back to profiles:', error);
      const { data: profs } = await supabase.from('profiles').select('id, full_name').order('full_name');
      return (profs || []).map((p: any) => ({ id: p.id, name: p.full_name || 'User', profileId: p.id }));
    }

    return (data || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      profileId: e.profile_id
    }));
  } catch (e) {
    console.error('Error fetching sales reps:', e);
    return [];
  }
};

export interface ResolvedPerson {
  id: string;
  name: string;
  email?: string;
}

export const getPersonResolver = async (companyId?: string): Promise<(idOrEmail?: string | null) => ResolvedPerson | undefined> => {
  try {
    let empQuery = (supabase as any)
      .from('employees')
      .select('id, name, profile_id, email, office_email, personal_email');
    if (companyId) empQuery = empQuery.eq('company_id', companyId);

    const [{ data: emps }, { data: profs }] = await Promise.all([
      empQuery,
      supabase.from('profiles').select('id, full_name, email, employee_id')
    ]);

    const map = new Map<string, ResolvedPerson>();

    (emps || []).forEach((e: any) => {
      const person: ResolvedPerson = { 
        id: e.id, 
        name: e.name || 'Employee', 
        email: e.email || e.office_email || e.personal_email 
      };
      map.set(e.id, person);
      if (e.profile_id) map.set(e.profile_id, person);
      if (e.email) map.set(e.email.toLowerCase(), person);
      if (e.office_email) map.set(e.office_email.toLowerCase(), person);
      if (e.personal_email) map.set(e.personal_email.toLowerCase(), person);
    });

    (profs || []).forEach((p: any) => {
      if (!map.has(p.id)) {
        const person: ResolvedPerson = { 
          id: p.id, 
          name: p.full_name || p.email?.split('@')[0] || 'User', 
          email: p.email 
        };
        map.set(p.id, person);
        if (p.email) map.set(p.email.toLowerCase(), person);
      }
      if (p.employee_id && map.has(p.employee_id)) {
        map.set(p.id, map.get(p.employee_id)!);
      }
    });

    return (idOrEmail?: string | null): ResolvedPerson | undefined => {
      if (!idOrEmail) return undefined;
      const key = idOrEmail.trim();
      return map.get(key) || map.get(key.toLowerCase());
    };
  } catch (err) {
    console.warn('Error creating person resolver:', err);
    return () => undefined;
  }
};

interface AccessFilter {
  isSalesRep: boolean;
  userId?: string;
  employeeId?: string;
}

const getAccessFilter = async (): Promise<AccessFilter> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isSalesRep: false };

  // Fetch role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = checkIsAdmin(profile?.role);

  if (isAdmin) {
    return { isSalesRep: false, userId: user.id };
  }

  // Get employee record linked to profile_id
  const empId = await getLinkedEmployeeId(user.id);

  return { 
    isSalesRep: true, 
    userId: user.id, 
    employeeId: empId 
  };
};

// LEADS
export const getLeads = async (
  userId?: string,
  userRole?: string | null,
  filterOwnerId?: string,
  companyId?: string
): Promise<Lead[]> => {
  let effectiveUserId = userId;
  let effectiveUserRole = userRole;
  let effectiveCompanyId = companyId;

  if (!effectiveUserId && effectiveUserId !== '') {
    const { data: { user } } = await supabase.auth.getUser();
    effectiveUserId = user?.id;
  }
  if ((effectiveUserRole === undefined || !effectiveCompanyId) && effectiveUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', effectiveUserId)
      .maybeSingle();
    if (effectiveUserRole === undefined) effectiveUserRole = profile?.role || null;
    if (!effectiveCompanyId) effectiveCompanyId = profile?.company_id || undefined;
  }

  const isAdmin = checkIsAdmin(effectiveUserRole);

  let query = (supabase as any).from('crm_leads')
    .select('*');

  if (effectiveCompanyId) {
    query = query.eq('company_id', effectiveCompanyId);
  }

  if (isAdmin) {
    if (filterOwnerId && filterOwnerId !== 'ALL') {
      query = query.or(`created_by.eq.${filterOwnerId},lead_owner_id.eq.${filterOwnerId}`);
    }
  } else if (effectiveUserId) {
    const empId = await getLinkedEmployeeId(effectiveUserId);
    const conditions = [
      `created_by.eq.${effectiveUserId}`,
      `lead_owner_id.eq.${effectiveUserId}`,
      `lead_owner_id.is.null`
    ];
    if (empId) {
      conditions.push(`lead_owner_id.eq.${empId}`);
      conditions.push(`created_by.eq.${empId}`);
    }
    query = query.or(conditions.join(','));
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching leads:', error);
    return [];
  }

  const leads = data || [];
  if (leads.length > 0) {
    const resolve = await getPersonResolver(effectiveCompanyId);
    leads.forEach((l: any) => {
      l.name = [l.first_name, l.last_name].filter(Boolean).join(' ') || l.organization_name || 'Unnamed Lead';
      l.company = l.organization_name;
      if (l.lead_owner_id) {
        l.lead_owner = resolve(l.lead_owner_id);
      }
      if (l.created_by) {
        l.creator = resolve(l.created_by);
      }
    });
  }

  return leads;
};

export const createLead = async (lead: Partial<Lead>): Promise<Lead | null> => {
  const cleanLead: any = { ...lead };
  delete cleanLead.creator;
  delete cleanLead.lead_owner;
  delete cleanLead.owner;

  // crm_leads.first_name is NOT NULL in database
  if (!cleanLead.first_name && cleanLead.last_name) {
    cleanLead.first_name = cleanLead.last_name;
  }
  if (!cleanLead.first_name && cleanLead.organization_name) {
    cleanLead.first_name = cleanLead.organization_name;
  }
  if (!cleanLead.first_name) {
    cleanLead.first_name = 'New Lead';
  }

  // Ensure company_id is populated
  if (!cleanLead.company_id && cleanLead.created_by) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', cleanLead.created_by)
      .maybeSingle();
    if (profile?.company_id) cleanLead.company_id = profile.company_id;
  }

  const { data, error } = await (supabase as any).from('crm_leads')
    .insert([cleanLead])
    .select()
    .single();

  if (error) {
    console.error('Error creating lead:', error);
    return null;
  }

  if (data) {
    const leadName = [data.first_name, data.last_name].filter(Boolean).join(' ');
    await logActivity({
      company_id: data.company_id,
      entity_type: 'lead',
      entity_id: data.id,
      action: 'created',
      description: `Added new lead "${leadName}"${data.organization_name ? ` (${data.organization_name})` : ''}`,
      performed_by: data.lead_owner_id || data.created_by
    });
  }

  return data;
};

export const updateLead = async (id: string, updates: Partial<Lead>): Promise<Lead | null> => {
  const cleanUpdates: any = { ...updates };
  delete cleanUpdates.creator;
  delete cleanUpdates.lead_owner;
  delete cleanUpdates.owner;
  delete cleanUpdates.id;

  const { data, error } = await (supabase as any).from('crm_leads')
    .update(cleanUpdates)
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
export const getCustomers = async (
  userId?: string,
  userRole?: string | null,
  filterOwnerId?: string,
  companyId?: string
): Promise<Customer[]> => {
  let effectiveUserId = userId;
  let effectiveUserRole = userRole;
  let effectiveCompanyId = companyId;

  if (!effectiveUserId && effectiveUserId !== '') {
    const { data: { user } } = await supabase.auth.getUser();
    effectiveUserId = user?.id;
  }
  if ((effectiveUserRole === undefined || !effectiveCompanyId) && effectiveUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', effectiveUserId)
      .maybeSingle();
    if (effectiveUserRole === undefined) {
      effectiveUserRole = profile?.role || null;
    }
    if (!effectiveCompanyId && profile?.company_id) {
      effectiveCompanyId = profile.company_id;
    }
  }

  const isAdmin = checkIsAdmin(effectiveUserRole);

  let query = (supabase as any).from('crm_customers').select(`*`);

  if (effectiveCompanyId) {
    query = query.eq('company_id', effectiveCompanyId);
  }

  if (isAdmin) {
    if (filterOwnerId && filterOwnerId !== 'ALL') {
      query = query.or(`created_by.eq.${filterOwnerId},owner_id.eq.${filterOwnerId}`);
    }
  } else if (effectiveUserId) {
    const empId = await getLinkedEmployeeId(effectiveUserId);
    const conditions = [
      `created_by.eq.${effectiveUserId}`,
      `owner_id.eq.${effectiveUserId}`,
      `owner_id.is.null`
    ];
    if (empId) {
      conditions.push(`owner_id.eq.${empId}`);
      conditions.push(`created_by.eq.${empId}`);
    }
    query = query.or(conditions.join(','));
  }

  const { data, error } = await query.order('name', { ascending: true });

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }

  const customers = data || [];
  if (customers.length > 0) {
    const resolve = await getPersonResolver(effectiveCompanyId);
    customers.forEach((c: any) => {
      if (c.owner_id) {
        c.owner = resolve(c.owner_id);
      }
      if (c.created_by) {
        c.creator = resolve(c.created_by);
      }
    });
  }

  return customers;
};

export const createCustomer = async (customer: Partial<Customer>): Promise<Customer | null> => {
  if (!customer.name || !customer.name.trim()) {
    throw new Error('Customer Name is required.');
  }

  let effectiveCompanyId = customer.company_id;
  let effectiveUserId = customer.owner_id || customer.created_by;

  if (!effectiveCompanyId || !effectiveUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (!effectiveUserId) effectiveUserId = user.id;
      if (!effectiveCompanyId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .maybeSingle();
        effectiveCompanyId = profile?.company_id;
      }
    }
  }

  if (!effectiveCompanyId) {
    throw new Error('Company context is required to create a CRM customer.');
  }

  const payload = {
    ...customer,
    name: customer.name.trim(),
    company_id: effectiveCompanyId,
    owner_id: customer.owner_id || effectiveUserId,
    created_by: customer.created_by || effectiveUserId,
    status: customer.status || 'Active',
    customer_type: customer.customer_type || 'Company',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await (supabase as any).from('crm_customers')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error creating customer:', error);
    throw error;
  }

  if (data) {
    await logActivity({
      company_id: data.company_id,
      entity_type: 'customer',
      entity_id: data.id,
      action: 'created',
      description: `Added customer "${data.name}"`,
      performed_by: data.owner_id || data.created_by
    });
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

// CUSTOMER WORK ORDERS & POs (Call-off contracts)
export const getCustomerWorkOrders = async (customerId: string): Promise<CRMCustomerWorkOrder[]> => {
  const { data, error } = await (supabase as any).from('crm_customer_work_orders')
    .select(`
      *,
      customer:crm_customers(id, name, contract_number, contract_title)
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching customer work orders:', error);
    return [];
  }
  return data || [];
};

export const getAllWorkOrders = async (companyId: string): Promise<CRMCustomerWorkOrder[]> => {
  const { data, error } = await (supabase as any).from('crm_customer_work_orders')
    .select(`
      *,
      customer:crm_customers(id, name, contract_number, contract_title)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all work orders:', error);
    return [];
  }
  return data || [];
};

export const createCustomerWorkOrder = async (wo: Partial<CRMCustomerWorkOrder>): Promise<CRMCustomerWorkOrder | null> => {
  if (!wo.customer_id || !wo.wo_number || !wo.description) {
    throw new Error('Customer, PO/WO Number, and Description are required.');
  }

  const { data, error } = await (supabase as any).from('crm_customer_work_orders')
    .insert([wo])
    .select(`
      *,
      customer:crm_customers(id, name, contract_number, contract_title)
    `)
    .single();

  if (error) {
    console.error('Error creating customer work order:', error);
    throw error;
  }
  return data;
};

export const updateCustomerWorkOrder = async (id: string, updates: Partial<CRMCustomerWorkOrder>): Promise<CRMCustomerWorkOrder | null> => {
  const { data, error } = await (supabase as any).from('crm_customer_work_orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      customer:crm_customers(id, name, contract_number, contract_title)
    `)
    .maybeSingle();

  if (error) {
    console.error('Error updating customer work order:', error);
    throw error;
  }
  return data;
};

export const deleteCustomerWorkOrder = async (id: string): Promise<boolean> => {
  const { error } = await (supabase as any).from('crm_customer_work_orders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting customer work order:', error);
    return false;
  }
  return true;
};

// OPPORTUNITIES
export const getOpportunities = async (
  userId?: string,
  userRole?: string | null,
  filterOwnerId?: string
): Promise<Opportunity[]> => {
  let effectiveUserId = userId;
  let effectiveUserRole = userRole;

  if (!effectiveUserId && effectiveUserId !== '') {
    const { data: { user } } = await supabase.auth.getUser();
    effectiveUserId = user?.id;
  }
  if (effectiveUserRole === undefined && effectiveUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', effectiveUserId)
      .maybeSingle();
    effectiveUserRole = profile?.role || null;
  }

  const isAdmin = checkIsAdmin(effectiveUserRole);

  let query = (supabase as any).from('crm_opportunities')
    .select(`
        *,
        customer:crm_customers(*),
        stage:org_crm_stages(*)
    `);

  if (isAdmin) {
    if (filterOwnerId && filterOwnerId !== 'ALL') {
      query = query.or(`created_by.eq.${filterOwnerId},owner_id.eq.${filterOwnerId}`);
    }
  } else if (effectiveUserId) {
    const empId = await getLinkedEmployeeId(effectiveUserId);
    const conditions = [
      `created_by.eq.${effectiveUserId}`,
      `owner_id.eq.${effectiveUserId}`
    ];
    if (empId) {
      conditions.push(`owner_id.eq.${empId}`);
      conditions.push(`created_by.eq.${empId}`);
    }
    query = query.or(conditions.join(','));
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching opportunities:', error);
    return [];
  }

  const opps = data || [];
  if (opps.length > 0) {
    const resolve = await getPersonResolver();
    opps.forEach((o: any) => {
      if (o.owner_id) {
        o.owner = resolve(o.owner_id);
      }
      if (o.created_by) {
        o.creator = resolve(o.created_by);
      }
    });
  }

  return opps;
};

export const createOpportunity = async (opp: Partial<Opportunity>): Promise<Opportunity | null> => {
  const { data, error } = await (supabase as any).from('crm_opportunities')
    .insert([opp])
    .select(`
      *,
      customer:crm_customers(*),
      stage:org_crm_stages(*)
    `)
    .maybeSingle();

  if (error) {
    console.error('Error creating opportunity:', error);
    return null;
  }

  if (data) {
    await logActivity({
      company_id: data.company_id,
      entity_type: 'opportunity',
      entity_id: data.id,
      action: 'created',
      description: `Created opportunity "${data.title}"${data.customer?.name ? ` for ${data.customer.name}` : ''} (${data.currency || 'QAR'} ${Number(data.amount || 0).toLocaleString()})`,
      performed_by: data.owner_id || data.created_by
    });
  }

  return data;
};

export const updateOpportunity = async (id: string, updates: Partial<Opportunity>): Promise<Opportunity | null> => {
  const { data, error } = await (supabase as any).from('crm_opportunities')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      customer:crm_customers(*),
      stage:org_crm_stages(*)
    `)
    .maybeSingle();

  if (error) {
    console.error('Error updating opportunity:', error);
    return null;
  }

  if (data) {
    let action = 'updated';
    let desc = `Updated opportunity "${data.title}"`;
    if (updates.status === 'Won' || data.status === 'Won') {
      action = 'won';
      desc = `Closed won opportunity "${data.title}"${data.customer?.name ? ` for ${data.customer.name}` : ''} (${data.currency || 'QAR'} ${Number(data.amount || 0).toLocaleString()})`;
    } else if (updates.status === 'Lost' || data.status === 'Lost') {
      action = 'lost';
      desc = `Marked opportunity "${data.title}" as lost`;
    }

    await logActivity({
      company_id: data.company_id,
      entity_type: 'opportunity',
      entity_id: data.id,
      action: action,
      description: desc,
      performed_by: data.owner_id || data.created_by
    });
  }

  return data;
};

// --- CONVERSION FLOW ---

// Lead → Opportunity
export const convertLeadToOpportunity = async (
  lead: Lead,
  companyId: string,
  firstStageId: string,
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
    currency: 'QAR',
    amount: lead.annual_revenue || 0,
    owner_id: ownerId || lead.lead_owner_id,
    created_by: ownerId || lead.created_by || lead.lead_owner_id,
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
    created_by: ownerId || opp.created_by || opp.owner_id,
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
export const getDeals = async (userId?: string, userRole?: string | null): Promise<Deal[]> => {
  try {
    const [opps, legacyDealsRes] = await Promise.all([
      getOpportunities(userId, userRole),
      (async () => {
        let query = (supabase as any).from('crm_deals').select('*');
        const { data } = await query.order('created_at', { ascending: false });
        return data || [];
      })()
    ]);

    const oppDeals: Deal[] = (opps || []).map((opp: any) => ({
      id: opp.id,
      title: opp.title || opp.name || 'Opportunity',
      value: Number(opp.amount || opp.value || 0),
      company: opp.customer?.name || opp.company || 'N/A',
      company_id: opp.company_id || '',
      currency: opp.currency || 'QAR',
      stage: opp.stage?.name || (opp.stage_id === '10000000-0000-0000-0000-000000000004' ? 'Won' : 'Qualification'),
      stage_id: opp.stage_id,
      owner_id: opp.owner_id,
      created_by: opp.created_by,
      created_at: opp.created_at,
      status: opp.status || 'Active'
    }));

    return [...oppDeals, ...legacyDealsRes];
  } catch (err) {
    console.error('Error fetching merged deals/opportunities:', err);
    return [];
  }
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

export const updateDealStage = async (id: number, stage_id: string, company_id?: string, owner_id?: string): Promise<{ success: boolean, pendingApproval?: boolean }> => {
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
  const filter = await getAccessFilter();
  let query = (supabase as any).from('crm_tasks')
    .select(`
        *,
        status_details:org_task_status(*),
        priority_details:org_task_priority(*),
        assignee:employees(*)
    `);

  if (filter.isSalesRep && filter.userId) {
    query = query.eq('owner_id', filter.userId);
  }

  const { data, error } = await query.order('due_date', { ascending: true });

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
  const filter = await getAccessFilter();
  let query = (supabase as any).from('crm_activity_log')
    .select(`*, performer:employees(*)`);

  if (filter.isSalesRep && filter.employeeId) {
    query = query.eq('performed_by', filter.employeeId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching activities:', error);
    return [];
  }

  const resolver = await getPersonResolver();
  const activities = (data || []).map((act: any) => {
    let perf = act.performer;
    if (!perf || !perf.name) {
      const resolved = resolver(act.performed_by);
      if (resolved) {
        perf = {
          id: resolved.id,
          name: resolved.name,
          email: resolved.email
        };
      }
    }
    return {
      ...act,
      performer: perf
    };
  });

  return activities;
};

export async function logActivity(activity: Partial<CRMActivity>): Promise<void> {
  // Get current user employee ID if not provided (best effort)
  let performerId = activity.performed_by;
  if (!performerId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // 1. Try to find employee by profile_id
      const { data: empByProfile } = await (supabase as any).from('employees').select('id').eq('profile_id', user.id).maybeSingle();
      if (empByProfile) {
        performerId = empByProfile.id;
      } else {
        // 2. Try to find employee by email
        const userEmail = user.email ? user.email.toLowerCase() : '';
        const { data: empByEmail } = await (supabase as any).from('employees').select('id')
          .or(`email.ilike.${userEmail},office_email.ilike.${userEmail},personal_email.ilike.${userEmail}`)
          .maybeSingle();
        if (empByEmail) {
          performerId = empByEmail.id;
        } else {
          // 3. Check profile.employee_id
          const { data: prof } = await supabase.from('profiles').select('employee_id').eq('id', user.id).maybeSingle();
          if (prof?.employee_id) {
            performerId = prof.employee_id;
          }
        }
      }
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
