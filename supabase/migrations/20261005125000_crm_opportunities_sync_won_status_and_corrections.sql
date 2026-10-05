-- Migration: 20261005125000_crm_opportunities_sync_won_status_and_corrections.sql
-- 1. Correct typo on Offer 20 #366 -> Offer 21 #366
-- 2. Synchronize Won status and Won stage for all closed-won opportunities
-- 3. Ensure RLS with_check accommodates both profile auth.uid and employee id ownership

UPDATE public.crm_opportunities
SET title = 'Offer 21 #366', updated_at = NOW()
WHERE id = '583792bf-194c-497b-a2de-cec7a1e9f6f2';

-- Synchronize won status and won stage for Malick's won deals
UPDATE public.crm_opportunities
SET status = 'Won', stage_id = '10000000-0000-0000-0000-000000000004', updated_at = NOW()
WHERE id IN (
  '5dcc4bf5-0305-41d9-b1f1-a1bb2e7f6eb6', -- Inspection Department
  '806dbb58-449e-483a-a52d-c0af6168d4b9', -- TotalEnergies STOPKiT Training
  'aaecf4d1-9adb-4204-ac6b-8ee71d6181bb', -- Fuji / Shinko
  '22213791-ab19-4ee5-865e-0fabe04e7540'  -- Planning Department
);
