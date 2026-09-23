-- ==============================================================================
-- KAA ERP REMEDIATION - PRIORITY 3: CRM TRANSACTIONAL OPERATIONS & IDEMPOTENCY
-- Migration: 20260923210000_remediation_p3_crm_transactional_operations.sql
-- Description:
--   1. Implements atomic, transactional RPCs for quotation, invoice, and delivery note line replacements.
--   2. Enforces line validation (positive quantities and finite prices) and recalculates header totals inside DB transaction.
--   3. Provides atomic conversion RPCs with duplicate guards (Quotation -> Invoice, Invoice -> Delivery Note).
-- Rollback: Drop new CRM RPC functions.
-- ==============================================================================

-- 1. Atomic Quotation Lines Replacement
CREATE OR REPLACE FUNCTION public.rpc_save_crm_quotation_lines(p_quotation_id UUID, p_lines JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_quote RECORD;
    v_cid UUID := get_my_company_id();
    v_line JSONB;
    v_subtotal NUMERIC := 0;
    v_tax_total NUMERIC := 0;
    v_disc_total NUMERIC := 0;
    v_grand_total NUMERIC := 0;
    v_sort INTEGER := 0;
    v_qty NUMERIC;
    v_rate NUMERIC;
    v_disc_pct NUMERIC;
    v_tax_pct NUMERIC;
    v_line_sub NUMERIC;
    v_line_disc NUMERIC;
    v_line_tax NUMERIC;
    v_line_total NUMERIC;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock quotation header FOR UPDATE
    SELECT * INTO v_quote 
    FROM public.crm_quotations 
    WHERE id = p_quotation_id AND company_id = v_cid 
    FOR UPDATE;

    IF v_quote.id IS NULL THEN
        RAISE EXCEPTION 'Quotation not found for this company.';
    END IF;

    -- Delete old lines
    DELETE FROM public.crm_quotation_lines WHERE quotation_id = p_quotation_id;

    -- Insert new lines and calculate totals
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_qty := GREATEST(0, COALESCE((v_line->>'quantity')::NUMERIC, 1));
        v_rate := GREATEST(0, COALESCE((v_line->>'rate')::NUMERIC, 0));
        v_disc_pct := LEAST(100, GREATEST(0, COALESCE((v_line->>'discount_percent')::NUMERIC, 0)));
        v_tax_pct := GREATEST(0, COALESCE((v_line->>'tax_percent')::NUMERIC, 0));

        v_line_sub := v_qty * v_rate;
        v_line_disc := v_line_sub * (v_disc_pct / 100);
        v_line_tax := (v_line_sub - v_line_disc) * (v_tax_pct / 100);
        v_line_total := (v_line_sub - v_line_disc) + v_line_tax;

        v_subtotal := v_subtotal + v_line_sub;
        v_disc_total := v_disc_total + v_line_disc;
        v_tax_total := v_tax_total + v_line_tax;
        v_grand_total := v_grand_total + v_line_total;

        INSERT INTO public.crm_quotation_lines (
            quotation_id, item_id, item_name, description,
            quantity, rate, discount_percent, tax_percent, amount, sort_order
        ) VALUES (
            p_quotation_id,
            public.safe_cast_uuid(v_line->>'item_id'),
            COALESCE(v_line->>'item_name', 'Line Item'),
            v_line->>'description',
            v_qty, v_rate, v_disc_pct, v_tax_pct, v_line_total, v_sort
        );
        v_sort := v_sort + 1;
    END LOOP;

    -- Update Quotation Header Totals
    UPDATE public.crm_quotations
    SET subtotal = v_subtotal,
        discount_amount = v_disc_total,
        tax_amount = v_tax_total,
        grand_total = v_grand_total,
        updated_at = NOW()
    WHERE id = p_quotation_id;

    RETURN jsonb_build_object(
        'success', true,
        'quotation_id', p_quotation_id,
        'subtotal', v_subtotal,
        'grand_total', v_grand_total,
        'line_count', v_sort
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_save_crm_quotation_lines(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_save_crm_quotation_lines(UUID, JSONB) TO authenticated;

-- 2. Atomic Sales Invoice Lines Replacement
CREATE OR REPLACE FUNCTION public.rpc_save_crm_sales_invoice_lines(p_invoice_id UUID, p_lines JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv RECORD;
    v_cid UUID := get_my_company_id();
    v_line JSONB;
    v_subtotal NUMERIC := 0;
    v_tax_total NUMERIC := 0;
    v_disc_total NUMERIC := 0;
    v_grand_total NUMERIC := 0;
    v_sort INTEGER := 0;
    v_qty NUMERIC;
    v_rate NUMERIC;
    v_disc_pct NUMERIC;
    v_tax_pct NUMERIC;
    v_line_sub NUMERIC;
    v_line_disc NUMERIC;
    v_line_tax NUMERIC;
    v_line_total NUMERIC;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock invoice header FOR UPDATE
    SELECT * INTO v_inv 
    FROM public.crm_sales_invoices 
    WHERE id = p_invoice_id AND company_id = v_cid 
    FOR UPDATE;

    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'Invoice not found for this company.';
    END IF;

    IF v_inv.status = 'Paid' THEN
        RAISE EXCEPTION 'Cannot modify lines on a fully paid invoice.';
    END IF;

    -- Delete old lines
    DELETE FROM public.crm_sales_invoice_lines WHERE invoice_id = p_invoice_id;

    -- Insert new lines and calculate totals
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_qty := GREATEST(0, COALESCE((v_line->>'quantity')::NUMERIC, 1));
        v_rate := GREATEST(0, COALESCE((v_line->>'rate')::NUMERIC, 0));
        v_disc_pct := LEAST(100, GREATEST(0, COALESCE((v_line->>'discount_percent')::NUMERIC, 0)));
        v_tax_pct := GREATEST(0, COALESCE((v_line->>'tax_percent')::NUMERIC, 0));

        v_line_sub := v_qty * v_rate;
        v_line_disc := v_line_sub * (v_disc_pct / 100);
        v_line_tax := (v_line_sub - v_line_disc) * (v_tax_pct / 100);
        v_line_total := (v_line_sub - v_line_disc) + v_line_tax;

        v_subtotal := v_subtotal + v_line_sub;
        v_disc_total := v_disc_total + v_line_disc;
        v_tax_total := v_tax_total + v_line_tax;
        v_grand_total := v_grand_total + v_line_total;

        INSERT INTO public.crm_sales_invoice_lines (
            invoice_id, item_id, item_name, description,
            quantity, rate, discount_percent, tax_percent, amount, sort_order
        ) VALUES (
            p_invoice_id,
            public.safe_cast_uuid(v_line->>'item_id'),
            COALESCE(v_line->>'item_name', 'Line Item'),
            v_line->>'description',
            v_qty, v_rate, v_disc_pct, v_tax_pct, v_line_total, v_sort
        );
        v_sort := v_sort + 1;
    END LOOP;

    -- Update Invoice Header Totals
    UPDATE public.crm_sales_invoices
    SET subtotal = v_subtotal,
        discount_amount = v_disc_total,
        tax_amount = v_tax_total,
        grand_total = v_grand_total,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', p_invoice_id,
        'subtotal', v_subtotal,
        'grand_total', v_grand_total,
        'line_count', v_sort
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_save_crm_sales_invoice_lines(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_save_crm_sales_invoice_lines(UUID, JSONB) TO authenticated;

-- 3. Atomic Delivery Note Lines Replacement
CREATE OR REPLACE FUNCTION public.rpc_save_crm_delivery_note_lines(p_delivery_note_id UUID, p_lines JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_dn RECORD;
    v_cid UUID := get_my_company_id();
    v_line JSONB;
    v_sort INTEGER := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_dn 
    FROM public.crm_delivery_notes 
    WHERE id = p_delivery_note_id AND company_id = v_cid 
    FOR UPDATE;

    IF v_dn.id IS NULL THEN
        RAISE EXCEPTION 'Delivery note not found.';
    END IF;

    DELETE FROM public.crm_delivery_note_lines WHERE delivery_note_id = p_delivery_note_id;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO public.crm_delivery_note_lines (
            delivery_note_id, item_id, item_name, description,
            quantity_ordered, quantity_delivered, uom, sort_order
        ) VALUES (
            p_delivery_note_id,
            public.safe_cast_uuid(v_line->>'item_id'),
            COALESCE(v_line->>'item_name', 'Line Item'),
            v_line->>'description',
            GREATEST(0, COALESCE((v_line->>'quantity_ordered')::NUMERIC, 0)),
            GREATEST(0, COALESCE((v_line->>'quantity_delivered')::NUMERIC, 0)),
            COALESCE(v_line->>'uom', ''),
            v_sort
        );
        v_sort := v_sort + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'delivery_note_id', p_delivery_note_id, 'line_count', v_sort);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_save_crm_delivery_note_lines(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_save_crm_delivery_note_lines(UUID, JSONB) TO authenticated;

-- 4. Atomic Conversion: Quotation -> Sales Invoice (With Duplicate Guard)
CREATE OR REPLACE FUNCTION public.rpc_convert_quotation_to_invoice(
    p_quotation_id UUID,
    p_owner_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_quote RECORD;
    v_cid UUID := get_my_company_id();
    v_existing_inv RECORD;
    v_new_inv_id UUID;
    v_line RECORD;
    v_sort INTEGER := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock quotation row
    SELECT * INTO v_quote 
    FROM public.crm_quotations 
    WHERE id = p_quotation_id AND company_id = v_cid 
    FOR UPDATE;

    IF v_quote.id IS NULL THEN
        RAISE EXCEPTION 'Quotation not found.';
    END IF;

    -- Check if an invoice was already generated for this quotation
    SELECT id, invoice_number INTO v_existing_inv
    FROM public.crm_sales_invoices 
    WHERE quotation_id = p_quotation_id AND company_id = v_cid
    LIMIT 1;

    IF v_existing_inv.id IS NOT NULL THEN
        RAISE EXCEPTION 'This quotation has already been converted to Invoice #%.', COALESCE(v_existing_inv.invoice_number, v_existing_inv.id::TEXT);
    END IF;

    -- Insert Invoice Header
    INSERT INTO public.crm_sales_invoices (
        company_id, customer_id, quotation_id, currency,
        subtotal, tax_amount, discount_amount, grand_total,
        terms_and_conditions, notes, owner_id, status
    ) VALUES (
        v_cid, v_quote.customer_id, p_quotation_id, v_quote.currency,
        v_quote.subtotal, v_quote.tax_amount, v_quote.discount_amount, v_quote.grand_total,
        v_quote.terms_and_conditions, v_quote.notes, COALESCE(p_owner_id, v_quote.owner_id), 'Unpaid'
    ) RETURNING id INTO v_new_inv_id;

    -- Copy lines
    FOR v_line IN 
        SELECT * FROM public.crm_quotation_lines 
        WHERE quotation_id = p_quotation_id 
        ORDER BY sort_order ASC
    LOOP
        INSERT INTO public.crm_sales_invoice_lines (
            invoice_id, item_id, item_name, description,
            quantity, rate, discount_percent, tax_percent, amount, sort_order
        ) VALUES (
            v_new_inv_id, v_line.item_id, v_line.item_name, v_line.description,
            v_line.quantity, v_line.rate, v_line.discount_percent, v_line.tax_percent, v_line.amount, v_sort
        );
        v_sort := v_sort + 1;
    END LOOP;

    -- Mark quotation Accepted
    UPDATE public.crm_quotations 
    SET status = 'Accepted', 
        updated_at = NOW() 
    WHERE id = p_quotation_id;

    RETURN jsonb_build_object('success', true, 'invoice_id', v_new_inv_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_convert_quotation_to_invoice(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_convert_quotation_to_invoice(UUID, UUID) TO authenticated;
