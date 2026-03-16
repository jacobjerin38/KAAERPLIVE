-- Ensure CRM DEALS has employee_owner_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_deals' AND column_name = 'employee_owner_id') THEN
        ALTER TABLE crm_deals ADD COLUMN employee_owner_id UUID REFERENCES employees(id);
    END IF;
END $$;

-- Ensure CRM CONTACTS has owner_id referencing auth.users (if not already)
-- Code uses owner_id for contacts too.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contacts' AND column_name = 'owner_id') THEN
        ALTER TABLE crm_contacts ADD COLUMN owner_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Ensure CRM TASKS has owner_id referencing auth.users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_tasks' AND column_name = 'owner_id') THEN
        ALTER TABLE crm_tasks ADD COLUMN owner_id UUID REFERENCES auth.users(id);
    END IF;
END $$;
