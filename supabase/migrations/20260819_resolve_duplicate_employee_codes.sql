-- ==============================================================================
-- Migration: 20260819_resolve_duplicate_employee_codes.sql
-- Description: Resolve duplicate employee codes from legacy draft imports,
--              archive inactive placeholder records, and ensure uniqueness.
-- ==============================================================================

-- 1. Resolve PEC011 Billy Joseph duplicate
UPDATE public.employees 
SET employee_code = 'PEC011-OLD' 
WHERE id = '132ef4c4-72ec-4b28-96bd-3618202a32e1'
  AND employee_code = 'PEC011';

-- 2. Resolve PEC020 Bineesh duplicate
UPDATE public.employees 
SET employee_code = 'PEC020-OLD' 
WHERE id = 'c86b548b-d2a9-411b-8028-aa7f410af972'
  AND employee_code = 'PEC020';

-- 3. Resolve PEC042 Rupesh duplicate
UPDATE public.employees 
SET employee_code = 'PEC042-OLD' 
WHERE id = 'de7538ee-5281-46b1-8ca5-4d076c4db2bf'
  AND employee_code = 'PEC042';

-- 4. Delete unlinked duplicate for PEC059
DELETE FROM public.employees 
WHERE id = 'd36c6c80-21aa-4a2c-a190-d4e17742cc17'
  AND employee_code = 'PEC059';

-- 5. Add a unique index on (company_id, LOWER(employee_code)) for active non-null codes to prevent future collisions
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_employee_code_per_company 
ON public.employees (company_id, LOWER(TRIM(employee_code))) 
WHERE employee_code IS NOT NULL AND employee_code != '';
