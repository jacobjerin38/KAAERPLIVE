-- ==============================================================================
-- KAA ERP Phase 2.3 - Invoicing Logic
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Create Invoice (Auto-generate Journal Entry)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_create_invoice(
    p_partner_id UUID,
    p_journal_id UUID,
    p_date DATE,
    p_due_date DATE,
    p_move_type TEXT, -- 'out_invoice', 'in_invoice'
    p_lines JSONB -- Array of {item_id, quantity, unit_price, tax_id(optional)}
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_move_id UUID;
    v_company_id UUID;
    v_line JSONB;
    v_item RECORD;
    v_partner RECORD;
    v_account_id UUID; -- The income/expense account
    v_receivable_payable_account_id UUID; -- The AR/AP account
    v_total_amount NUMERIC := 0;
    v_sign INT; -- 1 or -1 based on invoice type
BEGIN
    v_company_id := get_my_company_id();
    
    -- 1. Get Partner Details & AR/AP Account
    SELECT * INTO v_partner FROM accounting_partners WHERE id = p_partner_id;
    IF p_move_type = 'out_invoice' THEN
        v_receivable_payable_account_id := v_partner.property_account_receivable_id;
        v_sign := 1; -- Income is Credit (negative in some systems, but here we explicitly set debit/credit cols)
                     -- Actually:
                     -- Invoice: Debit AR, Credit Income
                     -- Bill: Debit Expense, Credit AP
    ELSIF p_move_type = 'in_invoice' THEN
        v_receivable_payable_account_id := v_partner.property_account_payable_id;
        v_sign := -1; 
    END IF;

    IF v_receivable_payable_account_id IS NULL THEN
        RAISE EXCEPTION 'Partner % missing default Receivable/Payable account', v_partner.name;
    END IF;

    -- 2. Create Header (Draft State)
    INSERT INTO accounting_moves (
        company_id, journal_id, date, invoice_date, due_date, 
        partner_id, move_type, state, amount_total
    ) VALUES (
        v_company_id, p_journal_id, p_date, p_date, p_due_date,
        p_partner_id, p_move_type, 'Draft', 0
    ) RETURNING id INTO v_move_id;

    -- 3. Process Lines
    -- Loop through items
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        -- Get Item Accounts
        SELECT * INTO v_item FROM item_master WHERE id = (v_line->>'item_id')::UUID;
        
        IF p_move_type = 'out_invoice' THEN
            v_account_id := v_item.income_account_id;
            IF v_account_id IS NULL THEN RAISE EXCEPTION 'Item % missing Income Account', v_item.name; END IF;
            
            -- Credit Income
            INSERT INTO accounting_move_lines (
                move_id, journal_id, date, account_id, partner_id, name,
                debit, credit, check_balance
            ) VALUES (
                v_move_id, p_journal_id, p_date, v_account_id, p_partner_id, v_item.name,
                0, (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric, false 
            );
            
            v_total_amount := v_total_amount + ((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric);

        ELSIF p_move_type = 'in_invoice' THEN
            v_account_id := v_item.expense_account_id;
            IF v_account_id IS NULL THEN RAISE EXCEPTION 'Item % missing Expense Account', v_item.name; END IF;
             
            -- Debit Expense
            INSERT INTO accounting_move_lines (
                move_id, journal_id, date, account_id, partner_id, name,
                debit, credit, check_balance
            ) VALUES (
                v_move_id, p_journal_id, p_date, v_account_id, p_partner_id, v_item.name,
                (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric, 0, false
            );
             v_total_amount := v_total_amount + ((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric);
        END IF;

        -- TODO: Handle Taxes (add separate tax lines)
        
    END LOOP;

    -- 4. Create Balancing AR/AP Line
    IF p_move_type = 'out_invoice' THEN
        -- Debit AR
        INSERT INTO accounting_move_lines (
            move_id, journal_id, date, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_move_id, p_journal_id, p_date, v_receivable_payable_account_id, p_partner_id, 'Invoice/Bill',
            v_total_amount, 0
        );
    ELSIF p_move_type = 'in_invoice' THEN
         -- Credit AP
         INSERT INTO accounting_move_lines (
            move_id, journal_id, date, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_move_id, p_journal_id, p_date, v_receivable_payable_account_id, p_partner_id, 'Invoice/Bill',
            0, v_total_amount
        );
    END IF;

    -- Update Total
    UPDATE accounting_moves SET amount_total = v_total_amount WHERE id = v_move_id;

    RETURN v_move_id;
END;
$$;
