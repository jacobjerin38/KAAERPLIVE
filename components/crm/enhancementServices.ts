import { supabase as supabaseClient } from "../../lib/supabase";
const supabase = supabaseClient as any;

export interface ToolLog {
    id: string;
    company_id: string;
    tool_name: string;
    item_code?: string;
    serial_number?: string;
    quantity_out: number;
    employee_id?: string;
    employee_name?: string;
    department_id?: number;
    department_name?: string;
    project_name?: string;
    date_out: string;
    expected_return_date?: string;
    remarks_out?: string;
    approval_status: string;
    quantity_returned: number;
    date_returned?: string;
    condition_status?: string;
    remarks_in?: string;
    created_at?: string;
}

export interface EmployeeTarget {
    id: string;
    company_id: string;
    employee_id: string;
    target_period: 'Monthly' | 'Quarterly' | 'Annual';
    target_year: number;
    target_period_val: number;
    target_amount: number;
    achieved_amount: number;
    incentive_rate: number;
    created_at?: string;
}

export interface ProposalRequest {
    id: string;
    company_id: string;
    requester_id?: string;
    customer_id?: string;
    customer_details?: any;
    requirements: string;
    requested_delivery_date?: string;
    status: string;
    created_at?: string;
    requester?: any;
    customer?: any;
}

export interface Proposal {
    id: string;
    company_id: string;
    request_id?: string;
    customer_id?: string;
    title: string;
    pricing_details: any;
    grand_total: number;
    terms_and_conditions?: string;
    status: string;
    is_locked: boolean;
    created_at?: string;
    customer?: any;
    request?: any;
}

export interface SLARecord {
    id: string;
    company_id: string;
    entity_type: 'LEAVE' | 'PROPOSAL' | 'TICKET';
    entity_id: string;
    sla_hours: number;
    start_time: string;
    due_time: string;
    completed_time?: string;
    status: 'Pending' | 'Completed' | 'Overdue';
    created_at?: string;
}

export interface ChatRoom {
    id: string;
    company_id: string;
    name?: string;
    type: 'direct' | 'group' | 'department';
    department_id?: number;
    created_at?: string;
    participants?: any[];
}

export interface ChatMessage {
    id: string;
    room_id: string;
    sender_id: string;
    message?: string;
    attachments: any[];
    created_at: string;
    sender?: any;
}

// --- SERVICES ---

// 1. Tool Tracking Services
export const getToolLogs = async (companyId: string): Promise<ToolLog[]> => {
    const { data, error } = await supabase
        .from('tool_tracking')
        .select(`
            *,
            employee:employees(id, name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching tool logs:', error);
        return [];
    }
    return data || [];
};

export const createToolLog = async (log: Partial<ToolLog>): Promise<ToolLog | null> => {
    const { data, error } = await supabase
        .from('tool_tracking')
        .insert([log])
        .select()
        .single();

    if (error) {
        console.error('Error creating tool log:', error);
        return null;
    }
    return data;
};

export const updateToolLog = async (id: string, updates: Partial<ToolLog>): Promise<ToolLog | null> => {
    const { data, error } = await supabase
        .from('tool_tracking')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating tool log:', error);
        return null;
    }
    return data;
};

// 2. Employee Targets Services
export const getEmployeeTargets = async (companyId: string): Promise<EmployeeTarget[]> => {
    const { data, error } = await supabase
        .from('employee_targets')
        .select(`
            *,
            employee:employees(id, name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching employee targets:', error);
        return [];
    }
    return data || [];
};

export const saveEmployeeTarget = async (target: Partial<EmployeeTarget>): Promise<EmployeeTarget | null> => {
    const { data, error } = await supabase
        .from('employee_targets')
        .upsert([target], { onConflict: 'company_id, employee_id, target_period, target_year, target_period_val' })
        .select()
        .single();

    if (error) {
        console.error('Error saving target:', error);
        return null;
    }
    return data;
};

// 3. Proposal Requests & Proposals Services
export const getProposalRequests = async (companyId: string): Promise<ProposalRequest[]> => {
    const { data, error } = await supabase
        .from('crm_proposal_requests')
        .select(`
            *,
            requester:employees(id, name),
            customer:crm_customers(*)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching proposal requests:', error);
        return [];
    }
    return data || [];
};

export const createProposalRequest = async (req: Partial<ProposalRequest>): Promise<ProposalRequest | null> => {
    const { data, error } = await supabase
        .from('crm_proposal_requests')
        .insert([req])
        .select()
        .single();

    if (error) {
        console.error('Error creating proposal request:', error);
        return null;
    }
    return data;
};

export const updateProposalRequest = async (id: string, status: string): Promise<boolean> => {
    const { error } = await supabase
        .from('crm_proposal_requests')
        .update({ status })
        .eq('id', id);

    if (error) {
        console.error('Error updating proposal request status:', error);
        return false;
    }
    return true;
};

export const getProposals = async (companyId: string): Promise<Proposal[]> => {
    const { data, error } = await supabase
        .from('crm_proposals')
        .select(`
            *,
            customer:crm_customers(*),
            request:crm_proposal_requests(*)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching proposals:', error);
        return [];
    }
    return data || [];
};

export const createProposal = async (prop: Partial<Proposal>): Promise<Proposal | null> => {
    const { data, error } = await supabase
        .from('crm_proposals')
        .insert([prop])
        .select()
        .single();

    if (error) {
        console.error('Error creating proposal:', error);
        return null;
    }
    return data;
};

export const updateProposal = async (id: string, updates: Partial<Proposal>): Promise<Proposal | null> => {
    const { data, error } = await supabase
        .from('crm_proposals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating proposal:', error);
        return null;
    }
    return data;
};

// 4. SLA & SLA Tracking Services
export const getSLARecords = async (companyId: string): Promise<SLARecord[]> => {
    const { data, error } = await supabase
        .from('sla_tracking')
        .select('*')
        .eq('company_id', companyId)
        .order('due_time', { ascending: true });

    if (error) {
        console.error('Error fetching SLA records:', error);
        return [];
    }
    return data || [];
};

export const createSLARecord = async (rec: Partial<SLARecord>): Promise<SLARecord | null> => {
    const { data, error } = await supabase
        .from('sla_tracking')
        .insert([rec])
        .select()
        .single();

    if (error) {
        console.error('Error creating SLA record:', error);
        return null;
    }
    return data;
};

export const completeSLARecord = async (entityType: string, entityId: string): Promise<void> => {
    const now = new Date().toISOString();
    await supabase
        .from('sla_tracking')
        .update({ status: 'Completed', completed_time: now })
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('status', 'Pending');
};

// 5. Chat System Services
export const getChatRooms = async (companyId: string, profileId: string): Promise<ChatRoom[]> => {
    // Fetch rooms where current user is participant
    const { data: participations, error: pErr } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('profile_id', profileId);

    if (pErr || !participations || participations.length === 0) return [];
    const roomIds = participations.map(p => p.room_id);

    const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
            *,
            participants:chat_participants(
                profile_id,
                profile:profiles(id, full_name, email, avatar_url)
            )
        `)
        .in('id', roomIds)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching chat rooms:', error);
        return [];
    }
    return data || [];
};

export const getDepartmentChatRoom = async (companyId: string, departmentId: number, name: string): Promise<ChatRoom | null> => {
    // Find department room
    const { data: existing, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('company_id', companyId)
        .eq('type', 'department')
        .eq('department_id', departmentId)
        .maybeSingle();

    if (existing) return existing;

    // Create new department room
    const { data: created, error: cErr } = await supabase
        .from('chat_rooms')
        .insert([{
            company_id: companyId,
            name,
            type: 'department',
            department_id: departmentId
        }])
        .select()
        .single();

    if (cErr) {
        console.error('Error creating department room:', cErr);
        return null;
    }
    return created;
};

export const getOrCreateDirectChatRoom = async (companyId: string, profile1: string, profile2: string): Promise<ChatRoom | null> => {
    // Fetch direct rooms of profile1
    const { data: p1Rooms } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('profile_id', profile1);

    if (p1Rooms && p1Rooms.length > 0) {
        const roomIds = p1Rooms.map(p => p.room_id);
        // Find if any of these rooms is direct and also has profile2
        const { data: matchingRooms } = await supabase
            .from('chat_rooms')
            .select(`
                id,
                chat_participants!inner(profile_id)
            `)
            .eq('type', 'direct')
            .in('id', roomIds)
            .eq('chat_participants.profile_id', profile2);

        if (matchingRooms && matchingRooms.length > 0) {
            const { data } = await supabase
                .from('chat_rooms')
                .select(`
                    *,
                    participants:chat_participants(
                        profile_id,
                        profile:profiles(id, full_name, email, avatar_url)
                    )
                `)
                .eq('id', matchingRooms[0].id)
                .single();
            return data;
        }
    }

    // Create room
    const { data: room, error: rErr } = await supabase
        .from('chat_rooms')
        .insert([{ company_id: companyId, type: 'direct' }])
        .select()
        .single();

    if (rErr || !room) return null;

    // Create participants
    await supabase.from('chat_participants').insert([
        { room_id: room.id, profile_id: profile1 },
        { room_id: room.id, profile_id: profile2 }
    ]);

    const { data } = await supabase
        .from('chat_rooms')
        .select(`
            *,
            participants:chat_participants(
                profile_id,
                profile:profiles(id, full_name, email, avatar_url)
            )
        `)
        .eq('id', room.id)
        .single();

    return data;
};

export const createGroupChatRoom = async (companyId: string, name: string, participants: string[]): Promise<ChatRoom | null> => {
    const { data: room, error: rErr } = await supabase
        .from('chat_rooms')
        .insert([{ company_id: companyId, name, type: 'group' }])
        .select()
        .single();

    if (rErr || !room) return null;

    const toInsert = participants.map(pid => ({ room_id: room.id, profile_id: pid }));
    await supabase.from('chat_participants').insert(toInsert);

    const { data } = await supabase
        .from('chat_rooms')
        .select(`
            *,
            participants:chat_participants(
                profile_id,
                profile:profiles(id, full_name, email, avatar_url)
            )
        `)
        .eq('id', room.id)
        .single();

    return data;
};

export const getChatMessages = async (roomId: string): Promise<ChatMessage[]> => {
    try {
        // 1. Fetch messages directly
        const { data: rawMsgs, error: mErr } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true });

        if (mErr || !rawMsgs) {
            console.error('Error fetching chat messages:', mErr);
            return [];
        }

        if (rawMsgs.length === 0) return [];

        // 2. Fetch profiles for distinct sender IDs
        const senderIds = Array.from(new Set(rawMsgs.map((m: any) => m.sender_id).filter(Boolean)));
        const profileMap = new Map<string, any>();

        if (senderIds.length > 0) {
            const { data: profs } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, email')
                .in('id', senderIds);
            if (profs) {
                profs.forEach((p: any) => profileMap.set(p.id, p));
            }
        }

        return rawMsgs.map((m: any) => ({
            ...m,
            sender: profileMap.get(m.sender_id) || { id: m.sender_id, full_name: 'Team Member' }
        }));
    } catch (err) {
        console.error('Unhandled error in getChatMessages:', err);
        return [];
    }
};

export const sendChatMessage = async (roomId: string, senderId: string, message?: string, attachments: any[] = []): Promise<ChatMessage | null> => {
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .insert([{
                room_id: roomId,
                sender_id: senderId,
                message: message || null,
                attachments: attachments || []
            }])
            .select('*')
            .single();

        if (error || !data) {
            console.error('Error sending message:', error);
            return null;
        }

        const { data: prof } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, email')
            .eq('id', senderId)
            .maybeSingle();

        return {
            ...data,
            sender: prof || { id: senderId, full_name: 'You' }
        };
    } catch (err) {
        console.error('Unhandled error in sendChatMessage:', err);
        return null;
    }
};
