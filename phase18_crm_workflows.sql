-- ==============================================================================
-- KAA ERP V1.2 - CRM WORKFLOWS MIGRATION
-- PHASE C: WORKFLOW INTEGRATION
-- ==============================================================================

-- 1. Add pending_target_stage_id to crm_deals
-- This column holds the stage ID the deal will move to upon approval.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_deals' AND column_name = 'pending_target_stage_id') THEN
        ALTER TABLE crm_deals ADD COLUMN pending_target_stage_id BIGINT REFERENCES org_crm_stages(id);
    END IF;
END $$;

-- 2. Update rpc_workflow_action to handle CRM Deal approvals
CREATE OR REPLACE FUNCTION rpc_workflow_action(
    p_request_id UUID,
    p_action TEXT, -- 'APPROVED' or 'REJECTED'
    p_comment TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_req RECORD;
    v_module TEXT;
    v_source_id_text TEXT;
    v_deal_id BIGINT;
BEGIN
    SELECT * INTO v_req FROM workflow_requests WHERE id = p_request_id;
    
    IF v_req IS NULL THEN RETURN 'Request not found'; END IF;
    
    -- Update Workflow Request
    UPDATE workflow_requests 
    SET status = p_action 
    WHERE id = p_request_id;
    
    -- Sync to Source Table
    SELECT module INTO v_module FROM workflows WHERE id = v_req.workflow_id;
    v_source_id_text := v_req.source_id;

    -- HRMS / LEAVES
    IF v_module = 'Leaves' OR v_module = 'HRMS' THEN
        UPDATE leaves SET status = p_action, manager_comment = p_comment WHERE id = v_source_id_text::UUID;
    END IF;
    
    -- EXIT MGMT
    IF v_module = 'Resignation' OR v_module = 'Resignations' OR v_module = 'Exit' THEN
        UPDATE resignations SET status = p_action, manager_comment = p_comment WHERE id = v_source_id_text::UUID;
    END IF;

    -- CRM DEALS
    IF v_module = 'CRM' THEN
        v_deal_id := v_source_id_text::BIGINT;
        
        IF p_action = 'APPROVED' THEN
            -- Move deal to the pending target stage
            UPDATE crm_deals 
            SET stage_id = pending_target_stage_id,
                pending_target_stage_id = NULL
            WHERE id = v_deal_id AND pending_target_stage_id IS NOT NULL;
        ELSE
            -- Rejected: Just clear the pending target stage so it stays in current stage
            UPDATE crm_deals 
            SET pending_target_stage_id = NULL
            WHERE id = v_deal_id;
        END IF;
    END IF;

    RETURN 'Success';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
