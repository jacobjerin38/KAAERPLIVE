-- Repair RPCs whose deployed bodies reference columns absent from the live schema.
-- This is function-only: it does not alter or delete application rows.
-- Fail closed if the expected deployed function body has drifted unexpectedly.
DO $migration$
DECLARE
    v_signature TEXT;
    v_definition TEXT;
    v_fixed TEXT;
BEGIN
    FOREACH v_signature IN ARRAY ARRAY[
        'public.rpc_convert_quotation_to_invoice(uuid, uuid)',
        'public.rpc_save_crm_quotation_lines(uuid, jsonb)',
        'public.rpc_save_crm_sales_invoice_lines(uuid, jsonb)',
        'public.rpc_complete_production(uuid, numeric)',
        'public.rpc_generate_payroll(uuid, date)',
        'public.rpc_switch_active_company(uuid)'
    ] LOOP
        SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_definition;
        IF v_definition IS NULL THEN
            RAISE EXCEPTION 'Expected function % was not found; stopping schema repair.', v_signature;
        END IF;

        v_fixed := regexp_replace(
            v_definition,
            ',[[:space:]]*updated_at[[:space:]]*=[[:space:]]*NOW\(\)',
            '',
            'gi'
        );
        IF v_fixed = v_definition THEN
            RAISE EXCEPTION 'Expected missing updated_at assignment was not found in %; stopping schema repair.', v_signature;
        END IF;
        EXECUTE v_fixed;
    END LOOP;

    -- The deployed BOM schema uses mrp_bom.name and has no header uom,
    -- updated_at, line scrap_percentage, or line sequence columns.
    v_signature := 'public.rpc_save_mrp_bom(uuid, uuid, text, numeric, text, boolean, jsonb)';
    SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_definition;
    IF v_definition IS NULL THEN
        RAISE EXCEPTION 'Expected function % was not found; stopping schema repair.', v_signature;
    END IF;
    v_fixed := replace(v_fixed, 'code = p_code,', 'name = p_code,');
    v_fixed := replace(v_fixed, '            uom = p_uom,', '');
    v_fixed := replace(v_fixed, E'            is_active = p_is_active,\n            updated_at = NOW()', '            is_active = p_is_active');
    v_fixed := replace(v_fixed,
        '            company_id, product_id, code, quantity, uom, is_active',
        '            company_id, product_id, name, quantity, is_active');
    v_fixed := replace(v_fixed,
        '            v_company_id, p_product_id, p_code, p_quantity, p_uom, p_is_active',
        '            v_company_id, p_product_id, p_code, p_quantity, p_is_active');
    v_fixed := replace(v_fixed,
        '                company_id, bom_id, item_id, quantity, uom, scrap_percentage, sequence',
        '                company_id, bom_id, item_id, quantity, uom');
    v_fixed := replace(v_fixed,
        '                COALESCE(v_line->>''uom'', ''pcs''),
                COALESCE((v_line->>''scrap_percentage'')::NUMERIC, 0),
                v_sort',
        '                COALESCE(v_line->>''uom'', ''pcs'')');
    IF v_fixed = v_definition OR position('code = p_code' in v_fixed) > 0
       OR position('scrap_percentage' in v_fixed) > 0
       OR position('sequence' in v_fixed) > 0
       OR position('updated_at = NOW()' in v_fixed) > 0 THEN
        RAISE EXCEPTION 'Could not safely reconcile % with the live BOM schema; stopping schema repair.', v_signature;
    END IF;
    EXECUTE v_fixed;
END;
$migration$;
