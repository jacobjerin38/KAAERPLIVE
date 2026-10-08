-- Migration: 20261008120000_add_performance_and_foreign_key_indexes.sql
-- Description:
-- High-impact composite and foreign key indexes to eliminate full-table scans,
-- resolve PostgREST statement timeouts, and optimize dashboard/ESSP loading times.

-- 1. Attendance: covering index for active check_in sessions and company-wide daily attendance
CREATE INDEX IF NOT EXISTS idx_attendance_emp_active_checkin
  ON public.attendance (employee_id, check_in DESC)
  WHERE check_out IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_comp_date_status
  ON public.attendance (company_id, date, status);

-- 2. Duty Roster: covering indexes for employee and company-date queries
CREATE INDEX IF NOT EXISTS idx_duty_roster_comp_date
  ON public.duty_roster (company_id, date);

CREATE INDEX IF NOT EXISTS idx_duty_roster_emp_id
  ON public.duty_roster (employee_id);

CREATE INDEX IF NOT EXISTS idx_duty_roster_shift_id
  ON public.duty_roster (shift_id);

-- 3. Accounting Moves: covering index for company invoices & bills in dashboard
CREATE INDEX IF NOT EXISTS idx_accounting_moves_comp_type_state
  ON public.accounting_moves (company_id, move_type, state);

-- 4. Inventory & Stock: covering indexes for stock movements and transactions
CREATE INDEX IF NOT EXISTS idx_stock_movements_comp_item
  ON public.stock_movements (company_id, item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_txns_comp_id
  ON public.inventory_transactions (company_id);

-- 5. Sales Orders: covering index for company dashboard metrics
CREATE INDEX IF NOT EXISTS idx_sales_orders_comp_state
  ON public.sales_orders (company_id, state);

-- 6. PM Projects & Documents: company-wide lookups
CREATE INDEX IF NOT EXISTS idx_pm_projects_comp_status
  ON public.pm_projects (company_id, status);

CREATE INDEX IF NOT EXISTS idx_doc_documents_comp_id
  ON public.doc_documents (company_id);

-- 7. Tickets & Leaves: company status queries
CREATE INDEX IF NOT EXISTS idx_tickets_comp_status
  ON public.tickets (company_id, status);

CREATE INDEX IF NOT EXISTS idx_leaves_comp_status
  ON public.leaves (company_id, status);

-- 8. Employee Job Transitions
CREATE INDEX IF NOT EXISTS idx_emp_job_trans_comp_status
  ON public.employee_job_transitions (company_id, status);

-- 9. Announcements & Org Masters
CREATE INDEX IF NOT EXISTS idx_announcements_comp_created
  ON public.announcements (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_leave_types_comp_id
  ON public.org_leave_types (company_id);

-- 10. CRM Deals & Customers
CREATE INDEX IF NOT EXISTS idx_crm_deals_comp_id
  ON public.crm_deals (company_id);

CREATE INDEX IF NOT EXISTS idx_crm_customers_comp_id
  ON public.crm_customers (company_id);

-- 11. Employee Locations
CREATE INDEX IF NOT EXISTS idx_employee_locations_emp_id
  ON public.employee_locations (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_locations_comp_id
  ON public.employee_locations (company_id);
