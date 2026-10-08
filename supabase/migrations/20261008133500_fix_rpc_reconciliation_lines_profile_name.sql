-- Migration: Fix rpc_get_reconciliation_lines profiles name column reference
-- Reason: public.profiles table has full_name and email columns, not 'name'.
-- Using COALESCE(prof.full_name, prof.email, 'User') avoids 'column prof.name does not exist' runtime errors.

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
            COALESCE(prof.full_name, prof.email, 'User') as reconciler_name,
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

GRANT EXECUTE ON FUNCTION public.rpc_get_reconciliation_lines TO authenticated, anon;
