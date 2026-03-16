-- ==============================================================================
-- KAA ERP V1.1 - NOTIFICATION LOGIC
-- ==============================================================================

-- 1. RPC: Create Notification (Helper)
CREATE OR REPLACE FUNCTION rpc_create_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'INFO',
    p_link TEXT DEFAULT NULL,
    p_company_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
    v_comp_id UUID;
BEGIN
    -- Fallback to user's company if not provided (optional, requires lookup)
    -- For now assume p_company_id is passed or handled by RLS if inserted directly.
    -- But since this is SECURITY DEFINER, we should be explicit.
    
    INSERT INTO notifications (company_id, user_id, title, message, type, link, is_read)
    VALUES (
        COALESCE(p_company_id, (SELECT company_id FROM profiles WHERE id = p_user_id)),
        p_user_id,
        p_title,
        p_message,
        p_type,
        p_link,
        false
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. TRIGGER: Notify on Ticket Update
CREATE OR REPLACE FUNCTION trigger_notify_ticket_update()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Notify Employee on Status Change
    IF NEW.status != OLD.status THEN
        SELECT profile_id INTO v_user_id FROM employees WHERE id = NEW.employee_id;
        
        IF v_user_id IS NOT NULL THEN
            PERFORM rpc_create_notification(
                v_user_id,
                'Ticket Updated',
                'Your ticket "' || NEW.subject || '" is now ' || NEW.status || '.',
                'INFO',
                '/hrms?tab=HELPDESK',
                NEW.company_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_ticket_update ON tickets;
CREATE TRIGGER trg_notify_ticket_update
AFTER UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_ticket_update();


-- 3. TRIGGER: Notify on Leave Update
CREATE OR REPLACE FUNCTION trigger_notify_leave_update()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_msg TEXT;
    v_type TEXT := 'INFO';
BEGIN
    -- Notify Employee on Status Change
    IF NEW.status != OLD.status THEN
        SELECT profile_id INTO v_user_id FROM employees WHERE id = NEW.employee_id;
        
        IF NEW.status = 'Approved' THEN v_type := 'SUCCESS'; END IF;
        IF NEW.status = 'Rejected' THEN v_type := 'ERROR'; END IF;

        IF v_user_id IS NOT NULL THEN
            PERFORM rpc_create_notification(
                v_user_id,
                'Leave Request ' || NEW.status,
                'Your ' || NEW.type || ' leave request (' || NEW.start_date || ') has been ' || NEW.status || '.',
                v_type,
                '/hrms?tab=LEAVES', -- Assuming mapping
                NEW.company_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_leave_update ON leaves;
CREATE TRIGGER trg_notify_leave_update
AFTER UPDATE ON leaves
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_leave_update();


-- 4. TRIGGER: Notify on Resignation Update
CREATE OR REPLACE FUNCTION trigger_notify_resignation_update()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_type TEXT := 'INFO';
BEGIN
    IF NEW.status != OLD.status THEN
        SELECT profile_id INTO v_user_id FROM employees WHERE id = NEW.employee_id;
        
        IF NEW.status = 'Approved' THEN v_type := 'SUCCESS'; END IF;
        IF NEW.status = 'Rejected' THEN v_type := 'ERROR'; END IF;

        IF v_user_id IS NOT NULL THEN
            PERFORM rpc_create_notification(
                v_user_id,
                'Resignation Status: ' || NEW.status,
                'Your resignation request status is now ' || NEW.status || '.',
                v_type,
                '/hrms?tab=EXIT',
                NEW.company_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_resignation_update ON resignations;
CREATE TRIGGER trg_notify_resignation_update
AFTER UPDATE ON resignations
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_resignation_update();


-- 5. TRIGGER: Notify on Asset Assignment
CREATE OR REPLACE FUNCTION trigger_notify_asset_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- If assigned_to changed and is not null
    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
        SELECT profile_id INTO v_user_id FROM employees WHERE id = NEW.assigned_to;
        
        IF v_user_id IS NOT NULL THEN
            PERFORM rpc_create_notification(
                v_user_id,
                'New Asset Assigned',
                'You have been assigned: ' || NEW.name || ' (' || NEW.type || ')',
                'INFO',
                '/hrms?tab=ASSETS',
                NEW.company_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_asset_assignment ON assets;
CREATE TRIGGER trg_notify_asset_assignment
AFTER UPDATE ON assets
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_asset_assignment();
