export interface JobTransition {
    id: string;
    created_at: string;
    company_id: string;
    employee_id: string;
    transition_type: 'PROMOTION' | 'TRANSFER' | 'ROLE_CHANGE' | 'EXIT' | 'CONFIRMATION';
    current_data: any;
    new_data: any;
    effective_date: string;
    reason: string;
    remarks?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'CANCELLED';
    requester_id: string;
    approver_id?: string;
    approval_date?: string;
    rejection_reason?: string;

    // Relations
    employee?: {
        name: string;
        email: string;
        avatar?: string;
    };
    requester?: {
        name: string;
    };
}

export interface CareerTimelineEvent {
    id: string;
    created_at: string;
    company_id: string;
    employee_id: string;
    event_date: string;
    event_type: string;
    title: string;
    description: string;
    metadata: any;
}
