-- ==============================================================================
-- KAA ERP - Seed PRO (Mandoob) Roles and Update Admin Permissions
-- Migration: 20260814_add_pro_roles_and_permissions.sql
-- ==============================================================================

-- 1. Update SUPER ADMIN role permissions array to include PRO and all module permissions
UPDATE public.roles
SET permissions = ARRAY[
    'hrms.employees.view', 'hrms.employees.manage', 'hrms.attendance.view', 'hrms.attendance.manage', 
    'hrms.leave.view', 'hrms.leave.manage', 'hrms.payroll.manage', 'hrms.assets.view', 'hrms.assets.manage', 
    'hrms.helpdesk.view', 'hrms.helpdesk.manage', 'hrms.reports.view',
    'essp.view', 'essp.profile.manage', 'essp.leaves.view', 'essp.attendance.view', 'essp.approvals.view',
    'crm.dashboard.view', 'crm.leads.view', 'crm.leads.manage', 'crm.deals.view', 'crm.deals.manage', 
    'crm.tasks.manage', 'crm.contacts.manage', 'crm.pipeline.manage', 'crm.settings.manage',
    'sales.view', 'sales.manage',
    'org.structure.view', 'org.company.manage', 'org.masters.manage', 'org.roles.manage', 
    'org.users.manage', 'org.workflows.manage', 'org.settings.manage',
    'finance.dashboard.view', 'finance.setup.manage', 'finance.payroll.manage', 'finance.invoices.manage', 'finance.expenses.manage',
    'inventory.view', 'inventory.manage',
    'projects.view', 'projects.manage',
    'documents.view', 'documents.manage',
    'manufacturing.view', 'manufacturing.manage',
    'procurement.view', 'procurement.manage',
    'marketing.view', 'marketing.manage',
    'recruitment.view', 'recruitment.manage',
    'loans.view', 'loans.manage',
    'performance.view', 'performance.manage',
    'travel.view', 'travel.manage',
    'pro.view', 'pro.requests.create', 'pro.requests.view', 'pro.tasks.manage', 'pro.documents.manage', 'pro.renewals.view', 'pro.reports.view'
]::text[]
WHERE UPPER(name) IN ('SUPER ADMIN', 'ADMIN');

-- 2. Create PRO (Mandoob) Agent Role for every company if not exists
INSERT INTO public.roles (company_id, name, description, permissions, status)
SELECT 
    c.id, 
    'PRO (Mandoob) Agent', 
    'Public Relations Officer responsible for handling govt services, visas, QID & license renewals.', 
    ARRAY['pro.view', 'pro.requests.view', 'pro.tasks.manage', 'pro.documents.manage', 'pro.renewals.view', 'pro.reports.view', 'essp.view']::text[],
    'Active'
FROM public.companies c
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles r WHERE r.company_id = c.id AND r.name ILIKE '%Mandoob%'
);
