-- ====================================================
-- Performance Optimization Migration
-- Date: 2026-06-29
-- Purpose: Add missing FK indexes, optimize RLS function,
--          and refresh table statistics
-- ====================================================

-- ====================================================
-- PART 1: CORE HIGH-TRAFFIC TABLE INDEXES
-- ====================================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles (employee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles (company_id);

-- employees
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON public.employees (department_id);
CREATE INDEX IF NOT EXISTS idx_employees_designation_id ON public.employees (designation_id);
CREATE INDEX IF NOT EXISTS idx_employees_employment_type_id ON public.employees (employment_type_id);
CREATE INDEX IF NOT EXISTS idx_employees_grade_id ON public.employees (grade_id);
CREATE INDEX IF NOT EXISTS idx_employees_location_id ON public.employees (location_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON public.employees (manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_profile_id ON public.employees (profile_id);
CREATE INDEX IF NOT EXISTS idx_employees_role_id ON public.employees (role_id);
CREATE INDEX IF NOT EXISTS idx_employees_pay_group_id ON public.employees (pay_group_id);
CREATE INDEX IF NOT EXISTS idx_employees_leave_plan_id ON public.employees (leave_plan_id);
CREATE INDEX IF NOT EXISTS idx_employees_blood_group_id ON public.employees (blood_group_id);
CREATE INDEX IF NOT EXISTS idx_employees_faith_id ON public.employees (faith_id);
CREATE INDEX IF NOT EXISTS idx_employees_marital_status_id ON public.employees (marital_status_id);
CREATE INDEX IF NOT EXISTS idx_employees_nationality_id ON public.employees (nationality_id);
CREATE INDEX IF NOT EXISTS idx_employees_visa_type_id ON public.employees (visa_type_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_status_id ON public.employees (employee_status_id);

-- attendance
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON public.attendance (employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_attendance_period_id ON public.attendance (attendance_period_id);
CREATE INDEX IF NOT EXISTS idx_attendance_shift_id ON public.attendance (shift_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_id ON public.attendance_records (employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_settings_company_id ON public.attendance_settings (company_id);

-- activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON public.activity_logs (company_id);

-- ====================================================
-- PART 2: ACCOUNTING TABLE INDEXES
-- ====================================================

CREATE INDEX IF NOT EXISTS idx_acct_journal_entries_company_id ON public.accounting_journal_entries (company_id);
CREATE INDEX IF NOT EXISTS idx_acct_journal_entries_journal_id ON public.accounting_journal_entries (journal_id);
CREATE INDEX IF NOT EXISTS idx_acct_journal_entries_period_id ON public.accounting_journal_entries (period_id);
CREATE INDEX IF NOT EXISTS idx_acct_journal_entries_partner_id ON public.accounting_journal_entries (partner_id);
CREATE INDEX IF NOT EXISTS idx_acct_journal_lines_company_id ON public.accounting_journal_lines (company_id);
CREATE INDEX IF NOT EXISTS idx_acct_journal_lines_entry_id ON public.accounting_journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS idx_acct_journal_lines_account_id ON public.accounting_journal_lines (account_id);
CREATE INDEX IF NOT EXISTS idx_acct_journal_lines_partner_id ON public.accounting_journal_lines (partner_id);
CREATE INDEX IF NOT EXISTS idx_acct_journal_lines_cost_center_id ON public.accounting_journal_lines (cost_center_id);
CREATE INDEX IF NOT EXISTS idx_acct_journal_lines_project_cc_id ON public.accounting_journal_lines (project_cost_center_id);
CREATE INDEX IF NOT EXISTS idx_acct_journal_lines_contract_cc_id ON public.accounting_journal_lines (contract_cost_center_id);
CREATE INDEX IF NOT EXISTS idx_acct_journal_lines_item_id ON public.accounting_journal_lines (item_id);
CREATE INDEX IF NOT EXISTS idx_acct_moves_journal_id ON public.accounting_moves (journal_id);
CREATE INDEX IF NOT EXISTS idx_acct_moves_period_id ON public.accounting_moves (period_id);
CREATE INDEX IF NOT EXISTS idx_acct_moves_partner_id ON public.accounting_moves (partner_id);
CREATE INDEX IF NOT EXISTS idx_acct_moves_inventory_txn_id ON public.accounting_moves (inventory_txn_id);
CREATE INDEX IF NOT EXISTS idx_acct_move_lines_move_id ON public.accounting_move_lines (move_id);
CREATE INDEX IF NOT EXISTS idx_acct_move_lines_journal_id ON public.accounting_move_lines (journal_id);
CREATE INDEX IF NOT EXISTS idx_acct_move_lines_account_id ON public.accounting_move_lines (account_id);
CREATE INDEX IF NOT EXISTS idx_acct_move_lines_partner_id ON public.accounting_move_lines (partner_id);
CREATE INDEX IF NOT EXISTS idx_acct_move_lines_tax_line_id ON public.accounting_move_lines (tax_line_id);
CREATE INDEX IF NOT EXISTS idx_acct_payments_partner_id ON public.accounting_payments (partner_id);
CREATE INDEX IF NOT EXISTS idx_acct_payments_journal_id ON public.accounting_payments (journal_id);
CREATE INDEX IF NOT EXISTS idx_acct_payments_move_id ON public.accounting_payments (move_id);
CREATE INDEX IF NOT EXISTS idx_acct_payments_acct_journal_id ON public.accounting_payments (accounting_journal_id);
CREATE INDEX IF NOT EXISTS idx_acct_payments_acct_entry_id ON public.accounting_payments (accounting_entry_id);
CREATE INDEX IF NOT EXISTS idx_acct_periods_fy_id ON public.accounting_periods (fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_acct_periods_acct_fy_id ON public.accounting_periods (accounting_fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_acct_partners_payable_id ON public.accounting_partners (property_account_payable_id);
CREATE INDEX IF NOT EXISTS idx_acct_partners_receivable_id ON public.accounting_partners (property_account_receivable_id);
CREATE INDEX IF NOT EXISTS idx_acct_coa_group_id ON public.accounting_chart_of_accounts (account_group_id);
CREATE INDEX IF NOT EXISTS idx_acct_coa_currency_id ON public.accounting_chart_of_accounts (currency_id);
CREATE INDEX IF NOT EXISTS idx_acct_journals_default_acct ON public.accounting_journals (default_account_id);
CREATE INDEX IF NOT EXISTS idx_acct_taxes_account_id ON public.accounting_taxes (account_id);
CREATE INDEX IF NOT EXISTS idx_acct_taxes_refund_account_id ON public.accounting_taxes (refund_account_id);
CREATE INDEX IF NOT EXISTS idx_acct_entries_reference_id ON public.accounting_entries (reference_id);
CREATE INDEX IF NOT EXISTS idx_acct_account_groups_parent_id ON public.accounting_account_groups (parent_id);
CREATE INDEX IF NOT EXISTS idx_acct_cost_centers_parent_id ON public.accounting_cost_centers (parent_id);
CREATE INDEX IF NOT EXISTS idx_acct_del_ledgers_account_id ON public.accounting_direct_expense_ledgers (account_id);
CREATE INDEX IF NOT EXISTS idx_acct_iil_account_id ON public.accounting_indirect_income_ledgers (account_id);
CREATE INDEX IF NOT EXISTS idx_acct_pl_account_id ON public.accounting_purchase_ledgers (account_id);
CREATE INDEX IF NOT EXISTS idx_acct_sl_account_id ON public.accounting_sales_ledgers (account_id);
CREATE INDEX IF NOT EXISTS idx_acct_sc_asset_acct ON public.accounting_stock_categories (asset_account_id);
CREATE INDEX IF NOT EXISTS idx_acct_sc_cogs_acct ON public.accounting_stock_categories (cogs_account_id);
CREATE INDEX IF NOT EXISTS idx_acct_sc_adj_acct ON public.accounting_stock_categories (adjustment_account_id);

-- ====================================================
-- PART 3: CRM TABLE INDEXES
-- ====================================================

CREATE INDEX IF NOT EXISTS idx_crm_leads_company_id ON public.crm_leads (company_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_owner_id ON public.crm_leads (lead_owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_source_id ON public.crm_leads (lead_source_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_company_id ON public.crm_opportunities (company_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_customer_id ON public.crm_opportunities (customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_lead_id ON public.crm_opportunities (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_owner_id ON public.crm_opportunities (owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage_id ON public.crm_opportunities (stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_source_id ON public.crm_opportunities (source_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_owner_id ON public.crm_deals (owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_emp_owner_id ON public.crm_deals (employee_owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_owner_id ON public.crm_contacts (owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_owner_id ON public.crm_tasks (owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_proposals_customer_id ON public.crm_proposals (customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_proposals_request_id ON public.crm_proposals (request_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotations_customer_id ON public.crm_quotations (customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotations_opportunity_id ON public.crm_quotations (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotations_owner_id ON public.crm_quotations (owner_id);

-- ====================================================
-- PART 4: HR, PAYROLL, RECRUITMENT INDEXES
-- ====================================================

CREATE INDEX IF NOT EXISTS idx_hrms_benefits_employee_id ON public.hrms_benefits (employee_id);
CREATE INDEX IF NOT EXISTS idx_hrms_benefit_claims_employee_id ON public.hrms_benefit_claims (employee_id);
CREATE INDEX IF NOT EXISTS idx_hrms_benefit_claims_benefit_id ON public.hrms_benefit_claims (benefit_id);
CREATE INDEX IF NOT EXISTS idx_hrms_benefit_claims_approved_by ON public.hrms_benefit_claims (approved_by);
CREATE INDEX IF NOT EXISTS idx_hrms_perf_reviews_employee_id ON public.hrms_perf_reviews (employee_id);
CREATE INDEX IF NOT EXISTS idx_hrms_perf_reviews_cycle_id ON public.hrms_perf_reviews (cycle_id);
CREATE INDEX IF NOT EXISTS idx_hrms_perf_goals_employee_id ON public.hrms_perf_goals (employee_id);
CREATE INDEX IF NOT EXISTS idx_hrms_travel_requests_employee_id ON public.hrms_travel_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_hrms_travel_expenses_request_id ON public.hrms_travel_expenses (travel_request_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON public.employee_documents (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_job_transitions_employee_id ON public.employee_job_transitions (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_career_timeline_employee_id ON public.employee_career_timeline (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_comp_versions_employee_id ON public.employee_compensation_versions (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_employee_id ON public.employee_leave_balances (employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_employee_id ON public.leaves (employee_id);
CREATE INDEX IF NOT EXISTS idx_resignations_employee_id ON public.resignations (employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employee_id ON public.payroll (employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_loans_employee_id ON public.payroll_loans (employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee_id ON public.payslips (employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_run_id ON public.payslips (payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_applicants_job_id ON public.recruitment_applicants (job_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_jobs_department_id ON public.recruitment_jobs (department_id);

-- ====================================================
-- PART 5: PROCUREMENT, INVENTORY, PM, MISC INDEXES
-- ====================================================

-- Purchase/Sales
CREATE INDEX IF NOT EXISTS idx_po_partner_id ON public.purchase_orders (partner_id);
CREATE INDEX IF NOT EXISTS idx_po_warehouse_id ON public.purchase_orders (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_order_id ON public.purchase_order_lines (order_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_item_id ON public.purchase_order_lines (item_id);
CREATE INDEX IF NOT EXISTS idx_so_partner_id ON public.sales_orders (partner_id);
CREATE INDEX IF NOT EXISTS idx_so_warehouse_id ON public.sales_orders (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_so_lines_order_id ON public.sales_order_lines (order_id);
CREATE INDEX IF NOT EXISTS idx_so_lines_item_id ON public.sales_order_lines (item_id);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inv_txns_item_id ON public.inventory_transactions (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_txns_warehouse_id ON public.inventory_transactions (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_reservations_item_id ON public.inventory_reservations (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_reservations_warehouse_id ON public.inventory_reservations (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_lines_adjustment_id ON public.inventory_adjustment_lines (adjustment_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_lines_item_id ON public.inventory_adjustment_lines (item_id);

-- Project Management
CREATE INDEX IF NOT EXISTS idx_pm_tasks_project_id ON public.pm_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_assignee_id ON public.pm_tasks (assignee_id);
CREATE INDEX IF NOT EXISTS idx_pm_timesheets_task_id ON public.pm_timesheets (task_id);
CREATE INDEX IF NOT EXISTS idx_pm_timesheets_employee_id ON public.pm_timesheets (employee_id);

-- Chat
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages (room_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_room_id ON public.chat_participants (room_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_profile_id ON public.chat_participants (profile_id);

-- Tickets
CREATE INDEX IF NOT EXISTS idx_tickets_employee_id ON public.tickets (employee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets (assigned_to);

-- Bank statements
CREATE INDEX IF NOT EXISTS idx_bank_stmts_journal_id ON public.bank_statements (journal_id);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_lines_stmt_id ON public.bank_statement_lines (statement_id);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_lines_partner_id ON public.bank_statement_lines (partner_id);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_lines_payment_id ON public.bank_statement_lines (payment_id);

-- Fixed assets
CREATE INDEX IF NOT EXISTS idx_fixed_assets_account_id ON public.fixed_assets (account_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_depr_account_id ON public.fixed_assets (depreciation_account_id);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_depr_asset_id ON public.fixed_asset_depreciation (asset_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);

-- Workflows
CREATE INDEX IF NOT EXISTS idx_wf_instances_workflow_id ON public.workflow_instances (workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_instances_requester_id ON public.workflow_instances (requester_id);
CREATE INDEX IF NOT EXISTS idx_wf_action_logs_instance_id ON public.workflow_action_logs (instance_id);

-- ====================================================
-- PART 6: OPTIMIZE get_my_company_id() FUNCTION
-- Mark as STABLE so Postgres caches the result within
-- a single query instead of re-evaluating per row.
-- ====================================================

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = (select auth.uid());
  RETURN v_company_id;
END;
$function$;

-- ====================================================
-- PART 7: REFRESH TABLE STATISTICS
-- ====================================================

ANALYZE public.profiles;
ANALYZE public.employees;
ANALYZE public.departments;
ANALYZE public.attendance;
ANALYZE public.attendance_records;
ANALYZE public.accounting_journal_entries;
ANALYZE public.accounting_journal_lines;
ANALYZE public.accounting_moves;
ANALYZE public.accounting_move_lines;
ANALYZE public.accounting_payments;
ANALYZE public.accounting_periods;
ANALYZE public.accounting_partners;
ANALYZE public.accounting_chart_of_accounts;
ANALYZE public.crm_leads;
ANALYZE public.crm_opportunities;
ANALYZE public.crm_deals;
ANALYZE public.crm_contacts;
ANALYZE public.crm_tasks;
ANALYZE public.crm_documents;
ANALYZE public.purchase_orders;
ANALYZE public.sales_orders;
ANALYZE public.item_master;
ANALYZE public.inventory_transactions;
ANALYZE public.leaves;
ANALYZE public.tickets;
ANALYZE public.payroll;
ANALYZE public.payslips;
ANALYZE public.pm_projects;
ANALYZE public.pm_tasks;
ANALYZE public.pm_timesheets;
ANALYZE public.doc_documents;
ANALYZE public.chat_messages;
ANALYZE public.notifications;
ANALYZE public.activity_logs;
ANALYZE public.employee_job_transitions;
ANALYZE public.resignations;
