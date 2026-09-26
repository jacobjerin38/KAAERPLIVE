-- Add employee and assigned_to columns to crm_customer_work_orders for employee-wise tracking
ALTER TABLE public.crm_customer_work_orders 
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id);

COMMENT ON COLUMN public.crm_customer_work_orders.assigned_to IS 'Assigned representative profile ID';
COMMENT ON COLUMN public.crm_customer_work_orders.employee_id IS 'Assigned employee record ID from employees table';
