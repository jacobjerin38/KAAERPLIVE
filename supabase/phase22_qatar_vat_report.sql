-- ==============================================================================
-- KAA ERP Phase 2.2 - Qatar VAT Filing Report Function
-- ==============================================================================

CREATE OR REPLACE FUNCTION rpc_get_qatar_vat_report(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_output_standard_base NUMERIC := 0;
    v_output_standard_vat NUMERIC := 0;
    v_output_zero_base NUMERIC := 0;
    v_output_exempt_base NUMERIC := 0;
    
    v_input_standard_base NUMERIC := 0;
    v_input_standard_vat NUMERIC := 0;
    v_input_zero_base NUMERIC := 0;
    v_input_exempt_base NUMERIC := 0;
    
    v_net_tax_payable NUMERIC := 0;
BEGIN
    v_company_id := get_my_company_id();

    -- ------------------------------------------------------------------------------
    -- 1. Output Tax (Sales / Supplies)
    -- ------------------------------------------------------------------------------
    
    -- Standard Rated VAT (5% output tax lines)
    SELECT 
        COALESCE(SUM(l.credit - l.debit), 0)
    INTO v_output_standard_vat
    FROM accounting_move_lines l
    JOIN accounting_moves m ON m.id = l.move_id
    JOIN taxes t ON t.id = l.tax_line_id
    WHERE m.company_id = v_company_id
      AND m.state = 'Posted'
      AND m.date BETWEEN p_start_date AND p_end_date
      AND (t.scope = 'sale' OR t.scope = 'both')
      AND t.amount = 5;

    -- Standard Rated Base (Income lines in moves that have a 5% output tax line)
    SELECT 
        COALESCE(SUM(l.credit - l.debit), 0)
    INTO v_output_standard_base
    FROM accounting_move_lines l
    JOIN accounting_moves m ON m.id = l.move_id
    JOIN chart_of_accounts a ON a.id = l.account_id
    WHERE m.company_id = v_company_id
      AND m.state = 'Posted'
      AND m.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Income'
      AND m.id IN (
          SELECT DISTINCT ml.move_id 
          FROM accounting_move_lines ml
          JOIN taxes tx ON tx.id = ml.tax_line_id
          WHERE tx.amount = 5 AND (tx.scope = 'sale' OR tx.scope = 'both')
      );

    -- Fallback to mathematical calculation if base is 0 but VAT is posted
    IF v_output_standard_base = 0 AND v_output_standard_vat > 0 THEN
        v_output_standard_base := v_output_standard_vat / 0.05;
    END IF;

    -- Zero-Rated Sales Base (Income lines in moves that have a zero-rated output tax line)
    SELECT 
        COALESCE(SUM(l.credit - l.debit), 0)
    INTO v_output_zero_base
    FROM accounting_move_lines l
    JOIN accounting_moves m ON m.id = l.move_id
    JOIN chart_of_accounts a ON a.id = l.account_id
    WHERE m.company_id = v_company_id
      AND m.state = 'Posted'
      AND m.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Income'
      AND m.id IN (
          SELECT DISTINCT ml.move_id 
          FROM accounting_move_lines ml
          JOIN taxes tx ON tx.id = ml.tax_line_id
          WHERE tx.amount = 0 AND tx.name ILIKE '%zero%' AND (tx.scope = 'sale' OR tx.scope = 'both')
      );

    -- Exempt Sales Base (Income lines in moves that have an exempt output tax line)
    SELECT 
        COALESCE(SUM(l.credit - l.debit), 0)
    INTO v_output_exempt_base
    FROM accounting_move_lines l
    JOIN accounting_moves m ON m.id = l.move_id
    JOIN chart_of_accounts a ON a.id = l.account_id
    WHERE m.company_id = v_company_id
      AND m.state = 'Posted'
      AND m.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Income'
      AND m.id IN (
          SELECT DISTINCT ml.move_id 
          FROM accounting_move_lines ml
          JOIN taxes tx ON tx.id = ml.tax_line_id
          WHERE tx.name ILIKE '%exempt%' AND (tx.scope = 'sale' OR tx.scope = 'both')
      );


    -- ------------------------------------------------------------------------------
    -- 2. Input Tax (Purchases / Expenses)
    -- ------------------------------------------------------------------------------
    
    -- Standard Rated Recoverable VAT (5% input tax lines)
    SELECT 
        COALESCE(SUM(l.debit - l.credit), 0)
    INTO v_input_standard_vat
    FROM accounting_move_lines l
    JOIN accounting_moves m ON m.id = l.move_id
    JOIN taxes t ON t.id = l.tax_line_id
    WHERE m.company_id = v_company_id
      AND m.state = 'Posted'
      AND m.date BETWEEN p_start_date AND p_end_date
      AND (t.scope = 'purchase' OR t.scope = 'both')
      AND t.amount = 5;

    -- Standard Rated Purchase Base (Expense/Asset lines in moves that have a 5% input tax line)
    SELECT 
        COALESCE(SUM(l.debit - l.credit), 0)
    INTO v_input_standard_base
    FROM accounting_move_lines l
    JOIN accounting_moves m ON m.id = l.move_id
    JOIN chart_of_accounts a ON a.id = l.account_id
    WHERE m.company_id = v_company_id
      AND m.state = 'Posted'
      AND m.date BETWEEN p_start_date AND p_end_date
      AND (a.type = 'Expense' OR a.type = 'Asset')
      AND a.subtype != 'Receivable' AND a.subtype != 'Payable' AND a.subtype != 'Bank' AND a.subtype != 'Cash'
      AND m.id IN (
          SELECT DISTINCT ml.move_id 
          FROM accounting_move_lines ml
          JOIN taxes tx ON tx.id = ml.tax_line_id
          WHERE tx.amount = 5 AND (tx.scope = 'purchase' OR tx.scope = 'both')
      );

    -- Fallback to mathematical calculation if base is 0 but VAT is posted
    IF v_input_standard_base = 0 AND v_input_standard_vat > 0 THEN
        v_input_standard_base := v_input_standard_vat / 0.05;
    END IF;

    -- Zero-Rated Purchase Base
    SELECT 
        COALESCE(SUM(l.debit - l.credit), 0)
    INTO v_input_zero_base
    FROM accounting_move_lines l
    JOIN accounting_moves m ON m.id = l.move_id
    JOIN chart_of_accounts a ON a.id = l.account_id
    WHERE m.company_id = v_company_id
      AND m.state = 'Posted'
      AND m.date BETWEEN p_start_date AND p_end_date
      AND (a.type = 'Expense' OR a.type = 'Asset')
      AND a.subtype != 'Receivable' AND a.subtype != 'Payable' AND a.subtype != 'Bank' AND a.subtype != 'Cash'
      AND m.id IN (
          SELECT DISTINCT ml.move_id 
          FROM accounting_move_lines ml
          JOIN taxes tx ON tx.id = ml.tax_line_id
          WHERE tx.amount = 0 AND tx.name ILIKE '%zero%' AND (tx.scope = 'purchase' OR tx.scope = 'both')
      );

    -- Exempt Purchase Base
    SELECT 
        COALESCE(SUM(l.debit - l.credit), 0)
    INTO v_input_exempt_base
    FROM accounting_move_lines l
    JOIN accounting_moves m ON m.id = l.move_id
    JOIN chart_of_accounts a ON a.id = l.account_id
    WHERE m.company_id = v_company_id
      AND m.state = 'Posted'
      AND m.date BETWEEN p_start_date AND p_end_date
      AND (a.type = 'Expense' OR a.type = 'Asset')
      AND a.subtype != 'Receivable' AND a.subtype != 'Payable' AND a.subtype != 'Bank' AND a.subtype != 'Cash'
      AND m.id IN (
          SELECT DISTINCT ml.move_id 
          FROM accounting_move_lines ml
          JOIN taxes tx ON tx.id = ml.tax_line_id
          WHERE tx.name ILIKE '%exempt%' AND (tx.scope = 'purchase' OR tx.scope = 'both')
      );


    -- ------------------------------------------------------------------------------
    -- 3. Grand Summary
    -- ------------------------------------------------------------------------------
    v_net_tax_payable := v_output_standard_vat - v_input_standard_vat;

    RETURN jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'output_tax', jsonb_build_object(
            'standard_rated_base', v_output_standard_base,
            'standard_rated_vat', v_output_standard_vat,
            'zero_rated_base', v_output_zero_base,
            'exempt_base', v_output_exempt_base,
            'total_base', v_output_standard_base + v_output_zero_base + v_output_exempt_base,
            'total_vat', v_output_standard_vat
        ),
        'input_tax', jsonb_build_object(
            'standard_rated_base', v_input_standard_base,
            'standard_rated_vat', v_input_standard_vat,
            'zero_rated_base', v_input_zero_base,
            'exempt_base', v_input_exempt_base,
            'total_base', v_input_standard_base + v_input_zero_base + v_input_exempt_base,
            'total_vat', v_input_standard_vat
        ),
        'net_tax_payable', v_net_tax_payable
    );
END;
$$;
