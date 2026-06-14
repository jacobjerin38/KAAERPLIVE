-- ==============================================================================
-- KAA ERP V2.3 - USER ACTIVITY AUDIT LOGS
-- ==============================================================================

-- 1. Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID,
    user_email VARCHAR(255),
    action VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'
    table_name VARCHAR(100),
    record_id VARCHAR(100),
    old_data JSONB,
    new_data JSONB,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for Tenant Isolation
DROP POLICY IF EXISTS "Tenant Isolation" ON activity_logs;
CREATE POLICY "Tenant Isolation" ON activity_logs
    USING (company_id = get_my_company_id());

-- Grant access to authenticated users and service_role
GRANT ALL ON activity_logs TO authenticated;
GRANT ALL ON activity_logs TO service_role;

-- 2. Create trigger function for automatic user activity logging
CREATE OR REPLACE FUNCTION log_user_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_user_email VARCHAR(255);
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_record_id VARCHAR(100);
    v_description TEXT;
    v_action VARCHAR(50);
BEGIN
    -- Exception block to ensure logging errors NEVER block the original transaction
    BEGIN
        -- Determine user_id
        v_user_id := auth.uid();
        
        -- Fetch email if user exists
        IF v_user_id IS NOT NULL THEN
            SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
        END IF;

        -- Determine company_id from row or fallback
        IF TG_OP = 'DELETE' THEN
            BEGIN
                v_company_id := OLD.company_id;
            EXCEPTION WHEN OTHERS THEN
                v_company_id := get_my_company_id();
            END;
        ELSE
            BEGIN
                v_company_id := NEW.company_id;
            EXCEPTION WHEN OTHERS THEN
                v_company_id := get_my_company_id();
            END;
        END IF;

        -- Fallback if company_id is still null
        IF v_company_id IS NULL THEN
            v_company_id := get_my_company_id();
        END IF;

        -- Determine record ID
        IF TG_OP = 'DELETE' THEN
            BEGIN
                v_record_id := OLD.id::TEXT;
            EXCEPTION WHEN OTHERS THEN
                v_record_id := NULL;
            END;
        ELSE
            BEGIN
                v_record_id := NEW.id::TEXT;
            EXCEPTION WHEN OTHERS THEN
                v_record_id := NULL;
            END;
        END IF;

        -- Setup old and new JSON data
        IF TG_OP = 'INSERT' THEN
            v_action := 'INSERT';
            v_new_data := to_jsonb(NEW);
            
            -- Table-specific description formatting
            IF TG_TABLE_NAME = 'employees' THEN
                v_description := 'Added employee: ' || COALESCE(NEW.name, 'Unknown');
            ELSIF TG_TABLE_NAME = 'leaves' THEN
                v_description := 'Submitted leave request for type: ' || COALESCE(NEW.type, 'Leave');
            ELSIF TG_TABLE_NAME = 'crm_deals' THEN
                v_description := 'Created deal: ' || COALESCE(NEW.title, 'New Deal');
            ELSIF TG_TABLE_NAME = 'crm_contacts' THEN
                v_description := 'Added contact: ' || COALESCE(NEW.name, 'New Contact');
            ELSIF TG_TABLE_NAME = 'crm_tasks' THEN
                v_description := 'Added CRM task: ' || COALESCE(NEW.title, 'New Task');
            ELSIF TG_TABLE_NAME = 'attendance' THEN
                v_description := 'Marked attendance';
            ELSIF TG_TABLE_NAME = 'payroll' THEN
                v_description := 'Created payroll draft for employee';
            ELSIF TG_TABLE_NAME = 'assets' THEN
                v_description := 'Registered asset: ' || COALESCE(NEW.name, 'New Asset');
            ELSIF TG_TABLE_NAME = 'tickets' THEN
                v_description := 'Created support ticket: ' || COALESCE(NEW.subject, 'New Ticket');
            ELSIF TG_TABLE_NAME = 'announcements' THEN
                v_description := 'Published announcement: ' || COALESCE(NEW.title, 'New Announcement');
            ELSE
                v_description := 'Added new record to ' || TG_TABLE_NAME;
            END IF;
            
        ELSIF TG_OP = 'UPDATE' THEN
            v_action := 'UPDATE';
            v_old_data := to_jsonb(OLD);
            v_new_data := to_jsonb(NEW);
            
            -- Table-specific description formatting
            IF TG_TABLE_NAME = 'employees' THEN
                v_description := 'Updated employee details: ' || COALESCE(NEW.name, 'Unknown');
            ELSIF TG_TABLE_NAME = 'leaves' THEN
                v_description := 'Updated leave request status: ' || COALESCE(NEW.type, 'Leave') || ' (Status: ' || COALESCE(NEW.status, 'Pending') || ')';
            ELSIF TG_TABLE_NAME = 'crm_deals' THEN
                v_description := 'Updated deal: ' || COALESCE(NEW.title, 'Deal') || ' (Stage: ' || COALESCE(NEW.stage, 'Stage') || ')';
            ELSIF TG_TABLE_NAME = 'attendance' THEN
                v_description := 'Updated attendance record';
            ELSIF TG_TABLE_NAME = 'payroll' THEN
                v_description := 'Updated payroll record (Status: ' || COALESCE(NEW.status, 'Draft') || ')';
            ELSIF TG_TABLE_NAME = 'assets' THEN
                v_description := 'Updated asset: ' || COALESCE(NEW.name, 'Asset') || ' (Status: ' || COALESCE(NEW.status, 'Available') || ')';
            ELSIF TG_TABLE_NAME = 'tickets' THEN
                v_description := 'Updated ticket: ' || COALESCE(NEW.subject, 'Ticket') || ' (Status: ' || COALESCE(NEW.status, 'Open') || ')';
            ELSE
                v_description := 'Updated record in ' || TG_TABLE_NAME;
            END IF;
            
        ELSIF TG_OP = 'DELETE' THEN
            v_action := 'DELETE';
            v_old_data := to_jsonb(OLD);
            
            -- Table-specific description formatting
            IF TG_TABLE_NAME = 'employees' THEN
                v_description := 'Removed employee: ' || COALESCE(OLD.name, 'Unknown');
            ELSIF TG_TABLE_NAME = 'leaves' THEN
                v_description := 'Deleted leave request';
            ELSIF TG_TABLE_NAME = 'crm_deals' THEN
                v_description := 'Deleted deal: ' || COALESCE(OLD.title, 'Deal');
            ELSIF TG_TABLE_NAME = 'crm_contacts' THEN
                v_description := 'Deleted contact: ' || COALESCE(OLD.name, 'Contact');
            ELSIF TG_TABLE_NAME = 'assets' THEN
                v_description := 'Removed asset: ' || COALESCE(OLD.name, 'Asset');
            ELSIF TG_TABLE_NAME = 'announcements' THEN
                v_description := 'Removed announcement: ' || COALESCE(OLD.title, 'Announcement');
            ELSE
                v_description := 'Deleted record from ' || TG_TABLE_NAME;
            END IF;
        END IF;

        -- Insert the audit log row
        IF v_company_id IS NOT NULL THEN
            INSERT INTO activity_logs (
                company_id,
                user_id,
                user_email,
                action,
                table_name,
                record_id,
                old_data,
                new_data,
                description
            ) VALUES (
                v_company_id,
                v_user_id,
                v_user_email,
                v_action,
                TG_TABLE_NAME,
                v_record_id,
                v_old_data,
                v_new_data,
                v_description
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Fail silently to prevent original transaction from failing
        NULL;
    END;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Procedure to helper create audit triggers
CREATE OR REPLACE PROCEDURE create_audit_trigger(p_table_name TEXT) AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', p_table_name, p_table_name);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION log_user_activity()', p_table_name, p_table_name);
END;
$$ LANGUAGE plpgsql;

-- 4. Apply triggers to target tables
DO $$
BEGIN
    CALL create_audit_trigger('employees');
    CALL create_audit_trigger('attendance');
    CALL create_audit_trigger('leaves');
    CALL create_audit_trigger('payroll');
    CALL create_audit_trigger('assets');
    CALL create_audit_trigger('tickets');
    CALL create_audit_trigger('resignations');
    CALL create_audit_trigger('crm_contacts');
    CALL create_audit_trigger('crm_deals');
    CALL create_audit_trigger('crm_tasks');
    CALL create_audit_trigger('announcements');
    CALL create_audit_trigger('item_master');
    CALL create_audit_trigger('accounting_moves');
    CALL create_audit_trigger('accounting_payments');
    CALL create_audit_trigger('warehouses');
    CALL create_audit_trigger('workflows');
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Some tables could not have triggers applied: %', SQLERRM;
END $$;
