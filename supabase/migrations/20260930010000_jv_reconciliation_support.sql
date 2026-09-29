-- Migration: 20260930010000_jv_reconciliation_support.sql
-- Description: Adds reconciliation metadata to accounting_journal_lines and creates RPCs for JV/Ledger reconciliation

-- 1. Add reconciliation columns to accounting_journal_lines
ALTER TABLE public.accounting_journal_lines
ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reconciliation_ref TEXT,
ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;

-- 2. Indexes for fast filtering and batch actions
CREATE INDEX IF NOT EXISTS idx_journal_lines_reconciliation 
ON public.accounting_journal_lines (company_id, account_id, is_reconciled);

CREATE INDEX IF NOT EXISTS idx_journal_lines_reconciled_ref 
ON public.accounting_journal_lines (company_id, reconciliation_ref) 
WHERE reconciliation_ref IS NOT NULL;

-- 3. Reconcile Journal Lines RPC
CREATE OR REPLACE FUNCTION public.rpc_reconcile_journal_lines(
    p_company_id UUID,
    p_line_ids UUID[],
    p_reconciliation_ref TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_allow_unbalanced BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_debit NUMERIC := 0;
    v_total_credit NUMERIC := 0;
    v_count INT := 0;
    v_ref TEXT;
    v_account_ids UUID[];
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF p_line_ids IS NULL OR array_length(p_line_ids, 1) IS NULL OR array_length(p_line_ids, 1) = 0 THEN
        RAISE EXCEPTION 'No journal lines selected for reconciliation.';
    END IF;

    -- Verify that all selected lines exist, belong to this company, and are currently unreconciled
    SELECT 
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0),
        COUNT(*),
        array_agg(DISTINCT account_id)
    INTO 
        v_total_debit,
        v_total_credit,
        v_count,
        v_account_ids
    FROM public.accounting_journal_lines
    WHERE id = ANY(p_line_ids)
      AND company_id = p_company_id;

    IF v_count <> array_length(p_line_ids, 1) THEN
        RAISE EXCEPTION 'One or more selected lines do not exist or do not belong to the selected company.';
    END IF;

    -- Ensure lines belong to the same account (standard ledger reconciliation)
    IF array_length(v_account_ids, 1) > 1 THEN
        RAISE EXCEPTION 'Selected lines must belong to the same account for reconciliation.';
    END IF;

    -- Check if any are already reconciled
    IF EXISTS (
        SELECT 1 FROM public.accounting_journal_lines 
        WHERE id = ANY(p_line_ids) AND is_reconciled = true
    ) THEN
        RAISE EXCEPTION 'One or more selected lines are already reconciled.';
    END IF;

    -- Check balance (unless unbalanced override is explicitly allowed with permission)
    IF NOT p_allow_unbalanced AND ABS(v_total_debit - v_total_credit) > 0.001 THEN
        RAISE EXCEPTION 'Selected lines do not balance! Total Debit: %, Total Credit: %, Difference: %', 
            v_total_debit, v_total_credit, (v_total_debit - v_total_credit);
    END IF;

    -- Generate reference if not supplied
    v_ref := COALESCE(NULLIF(TRIM(p_reconciliation_ref), ''), 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS'));

    -- Update lines
    UPDATE public.accounting_journal_lines
    SET 
        is_reconciled = true,
        reconciled_at = NOW(),
        reconciled_by = v_user_id,
        reconciliation_ref = v_ref,
        reconciliation_notes = p_notes
    WHERE id = ANY(p_line_ids)
      AND company_id = p_company_id;

    RETURN jsonb_build_object(
        'success', true,
        'reconciliation_ref', v_ref,
        'line_count', v_count,
        'total_debit', v_total_debit,
        'total_credit', v_total_credit,
        'difference', ABS(v_total_debit - v_total_credit),
        'reconciled_at', NOW()
    );
END;
$$;

-- 4. Unreconcile Journal Lines RPC
CREATE OR REPLACE FUNCTION public.rpc_unreconcile_journal_lines(
    p_company_id UUID,
    p_line_ids UUID[] DEFAULT NULL,
    p_reconciliation_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    IF (p_line_ids IS NULL OR array_length(p_line_ids, 1) = 0) AND (p_reconciliation_ref IS NULL OR TRIM(p_reconciliation_ref) = '') THEN
        RAISE EXCEPTION 'Provide either line IDs or a reconciliation reference to unreconcile.';
    END IF;

    IF p_reconciliation_ref IS NOT NULL AND TRIM(p_reconciliation_ref) <> '' THEN
        UPDATE public.accounting_journal_lines
        SET 
            is_reconciled = false,
            reconciled_at = NULL,
            reconciled_by = NULL,
            reconciliation_ref = NULL,
            reconciliation_notes = NULL
        WHERE company_id = p_company_id
          AND reconciliation_ref = TRIM(p_reconciliation_ref);
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
        UPDATE public.accounting_journal_lines
        SET 
            is_reconciled = false,
            reconciled_at = NULL,
            reconciled_by = NULL,
            reconciliation_ref = NULL,
            reconciliation_notes = NULL
        WHERE company_id = p_company_id
          AND id = ANY(p_line_ids);

        GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'unreconciled_count', v_count
    );
END;
$$;

-- 5. Fetch Reconciliation Lines with Statistics
CREATE OR REPLACE FUNCTION public.rpc_get_reconciliation_lines(
    p_company_id UUID,
    p_account_id UUID,
    p_status TEXT DEFAULT 'unreconciled',
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL,
    p_reconciliation_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lines JSONB := '[]'::jsonb;
    v_account JSONB;
    v_total_unrec_debit NUMERIC := 0;
    v_total_unrec_credit NUMERIC := 0;
    v_total_rec_debit NUMERIC := 0;
    v_total_rec_credit NUMERIC := 0;
BEGIN
    -- Fetch account info
    SELECT jsonb_build_object(
        'id', a.id,
        'code', a.code,
        'name', a.name,
        'type', a.type,
        'subtype', a.subtype,
        'is_reconcilable', a.is_reconcilable
    ) INTO v_account
    FROM public.accounting_chart_of_accounts a
    WHERE a.id = p_account_id
      AND (a.company_id = p_company_id OR a.company_id IS NULL)
    LIMIT 1;

    -- Aggregate stats
    SELECT 
        COALESCE(SUM(CASE WHEN l.is_reconciled = false THEN l.debit ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN l.is_reconciled = false THEN l.credit ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN l.is_reconciled = true THEN l.debit ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN l.is_reconciled = true THEN l.credit ELSE 0 END), 0)
    INTO 
        v_total_unrec_debit,
        v_total_unrec_credit,
        v_total_rec_debit,
        v_total_rec_credit
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    WHERE l.company_id = p_company_id
      AND l.account_id = p_account_id
      AND e.state = 'Posted';

    -- Fetch lines matching filters
    WITH line_data AS (
        SELECT 
            l.id as line_id,
            l.entry_id,
            e.date,
            COALESCE(e.reference, 'JV') as voucher_ref,
            e.move_type,
            l.partner_id,
            COALESCE(p_line.name, p_entry.name, '') as partner_name,
            COALESCE(NULLIF(l.name, ''), NULLIF(e.notes, ''), e.reference, 'Journal Line') as description,
            l.debit,
            l.credit,
            l.is_reconciled,
            l.reconciled_at,
            l.reconciled_by,
            prof.name as reconciler_name,
            l.reconciliation_ref,
            l.reconciliation_notes,
            j.code as journal_code,
            j.name as journal_name
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        LEFT JOIN public.accounting_journals j ON j.id = e.journal_id
        LEFT JOIN public.accounting_partners p_line ON p_line.id = l.partner_id
        LEFT JOIN public.accounting_partners p_entry ON p_entry.id = e.partner_id
        LEFT JOIN public.profiles prof ON prof.id = l.reconciled_by
        WHERE l.company_id = p_company_id
          AND l.account_id = p_account_id
          AND e.state = 'Posted'
          AND (
              CASE 
                  WHEN p_status = 'unreconciled' THEN l.is_reconciled = false
                  WHEN p_status = 'reconciled' THEN l.is_reconciled = true
                  ELSE true
              END
          )
          AND (p_start_date IS NULL OR e.date >= p_start_date)
          AND (p_end_date IS NULL OR e.date <= p_end_date)
          AND (p_partner_id IS NULL OR l.partner_id = p_partner_id OR e.partner_id = p_partner_id)
          AND (p_reconciliation_ref IS NULL OR l.reconciliation_ref ILIKE '%' || p_reconciliation_ref || '%')
        ORDER BY e.date ASC, e.created_at ASC, l.id ASC
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(ld)), '[]'::jsonb)
    INTO v_lines
    FROM line_data ld;

    RETURN jsonb_build_object(
        'success', true,
        'account', v_account,
        'stats', jsonb_build_object(
            'unreconciled_debit', v_total_unrec_debit,
            'unreconciled_credit', v_total_unrec_credit,
            'unreconciled_balance', v_total_unrec_debit - v_total_unrec_credit,
            'reconciled_debit', v_total_rec_debit,
            'reconciled_credit', v_total_rec_credit
        ),
        'lines', v_lines
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_reconcile_journal_lines TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_unreconcile_journal_lines TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_reconciliation_lines TO authenticated, anon;
