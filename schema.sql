-- ==============================================================================
-- KAA ERP SCHEMA DUMP FROM REMOTE DATABASE
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- FUNCTIONS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_period_for_date(p_date date, p_company_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_period_id UUID;
BEGIN
    SELECT id INTO v_period_id
    FROM accounting_periods
    WHERE company_id = p_company_id
      AND p_date BETWEEN start_date AND end_date
      AND status = 'Open'
    LIMIT 1;
    RETURN v_period_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_user(p_email text, p_password text, p_full_name text, p_role text, p_company_id uuid, p_role_id uuid, p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_encrypted_pw TEXT;
  v_caller_company_id UUID;
BEGIN
  -- 1. Ensure caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Ensure caller belongs to the company (or is super admin)
  -- Assuming get_my_company_id() returns the company of the caller
  v_caller_company_id := public.get_my_company_id();
  IF v_caller_company_id != p_company_id THEN
    -- Try to fetch profile to see if they are a super admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Super Admin') THEN
      RAISE EXCEPTION 'Unauthorized to create user for this company';
    END IF;
  END IF;

  -- 3. Prepare user details
  v_user_id := gen_random_uuid();
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  -- 4. Insert into auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
  )
  VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, v_encrypted_pw, now(), 
    '{"provider":"email","providers":["email"]}', 
    jsonb_build_object('full_name', p_full_name), 
    now(), now(), '', '', '', ''
  );

  -- 5. Insert into auth.identities
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(), v_user_id, format('{"sub":"%s","email":"%s"}', v_user_id::text, p_email)::jsonb, 'email', v_user_id::text, now(), now(), now()
  );

  -- 6. Upsert public.profiles (in case a trigger already created it)
  INSERT INTO public.profiles (id, full_name, role, company_id, employee_id)
  VALUES (v_user_id, p_full_name, p_role, p_company_id, p_employee_id)
  ON CONFLICT (id) DO UPDATE 
  SET full_name = EXCLUDED.full_name, 
      role = EXCLUDED.role, 
      company_id = EXCLUDED.company_id, 
      employee_id = EXCLUDED.employee_id;

  -- 7. Upsert public.user_company_access
  INSERT INTO public.user_company_access (user_id, company_id, role_id, is_default, status)
  VALUES (v_user_id, p_company_id, p_role_id, true, 'active')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_user(p_user_id uuid, p_full_name text, p_role text, p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET full_name = COALESCE(p_full_name, full_name),
      role = COALESCE(p_role, role),
      employee_id = COALESCE(p_employee_id, employee_id)
  WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_post_payment(p_payment_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_payment RECORD; v_move_id UUID; v_partner RECORD; v_journal RECORD;
    v_liquidity_account_id UUID; v_counterpart_account_id UUID; v_company_id UUID;
BEGIN
    v_company_id := get_my_company_id();
    SELECT * INTO v_payment FROM accounting_payments WHERE id = p_payment_id;
    IF v_payment.state = 'posted' THEN RAISE EXCEPTION 'Payment already posted'; END IF;
    SELECT * INTO v_partner FROM accounting_partners WHERE id = v_payment.partner_id;
    SELECT * INTO v_journal FROM journals WHERE id = v_payment.journal_id;
    v_liquidity_account_id := v_journal.default_account_id;
    IF v_liquidity_account_id IS NULL THEN RAISE EXCEPTION 'Journal % has no default account', v_journal.name; END IF;
    IF v_payment.payment_type = 'inbound' THEN v_counterpart_account_id := v_partner.property_account_receivable_id;
    ELSE v_counterpart_account_id := v_partner.property_account_payable_id; END IF;
    IF v_counterpart_account_id IS NULL THEN RAISE EXCEPTION 'Partner % missing AR/AP account', v_partner.name; END IF;
    INSERT INTO accounting_moves (company_id, journal_id, date, partner_id, move_type, state, amount_total, reference, notes)
    VALUES (v_company_id, v_payment.journal_id, v_payment.date, v_payment.partner_id, 'entry', 'Posted', v_payment.amount, v_payment.name, v_payment.notes)
    RETURNING id INTO v_move_id;
    IF v_payment.payment_type = 'inbound' THEN
        INSERT INTO accounting_move_lines (move_id, journal_id, date, account_id, partner_id, name, debit, credit)
        VALUES (v_move_id, v_payment.journal_id, v_payment.date, v_liquidity_account_id, v_payment.partner_id, 'Payment Received', v_payment.amount, 0);
        INSERT INTO accounting_move_lines (move_id, journal_id, date, account_id, partner_id, name, debit, credit)
        VALUES (v_move_id, v_payment.journal_id, v_payment.date, v_counterpart_account_id, v_payment.partner_id, 'Payment Received', 0, v_payment.amount);
    ELSE
        INSERT INTO accounting_move_lines (move_id, journal_id, date, account_id, partner_id, name, debit, credit)
        VALUES (v_move_id, v_payment.journal_id, v_payment.date, v_counterpart_account_id, v_payment.partner_id, 'Payment Sent', v_payment.amount, 0);
        INSERT INTO accounting_move_lines (move_id, journal_id, date, account_id, partner_id, name, debit, credit)
        VALUES (v_move_id, v_payment.journal_id, v_payment.date, v_liquidity_account_id, v_payment.partner_id, 'Payment Sent', 0, v_payment.amount);
    END IF;
    UPDATE accounting_payments SET state = 'posted', move_id = v_move_id WHERE id = p_payment_id;
    RETURN v_move_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_reconcile_statement_line(p_statement_line_id uuid, p_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_line RECORD; v_payment RECORD;
BEGIN
    SELECT * INTO v_line FROM bank_statement_lines WHERE id = p_statement_line_id;
    SELECT * INTO v_payment FROM accounting_payments WHERE id = p_payment_id;
    IF v_line.is_reconciled THEN RAISE EXCEPTION 'Line already reconciled'; END IF;
    UPDATE bank_statement_lines SET is_reconciled = true, payment_id = p_payment_id WHERE id = p_statement_line_id;
    UPDATE accounting_payments SET state = 'reconciled' WHERE id = p_payment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_balance_sheet(p_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_company_id UUID; v_assets JSON; v_liabilities JSON; v_equity JSON; v_earnings NUMERIC;
BEGIN
    v_company_id := get_my_company_id();
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_earnings FROM accounting_move_lines l JOIN accounting_moves m ON m.id = l.move_id JOIN chart_of_accounts a ON a.id = l.account_id WHERE m.company_id = v_company_id AND m.state = 'Posted' AND m.date <= p_date AND a.type IN ('Income', 'Expense');
    SELECT json_agg(t) INTO v_assets FROM (SELECT a.code, a.name, a.subtype, SUM(l.debit - l.credit) as balance FROM accounting_move_lines l JOIN accounting_moves m ON m.id = l.move_id JOIN chart_of_accounts a ON a.id = l.account_id WHERE m.company_id = v_company_id AND m.state = 'Posted' AND m.date <= p_date AND a.type = 'Asset' GROUP BY a.code, a.name, a.subtype HAVING SUM(l.debit - l.credit) != 0 ORDER BY a.code) t;
    SELECT json_agg(t) INTO v_liabilities FROM (SELECT a.code, a.name, a.subtype, SUM(l.credit - l.debit) as balance FROM accounting_move_lines l JOIN accounting_moves m ON m.id = l.move_id JOIN chart_of_accounts a ON a.id = l.account_id WHERE m.company_id = v_company_id AND m.state = 'Posted' AND m.date <= p_date AND a.type = 'Liability' GROUP BY a.code, a.name, a.subtype HAVING SUM(l.credit - l.debit) != 0 ORDER BY a.code) t;
    SELECT json_agg(t) INTO v_equity FROM (SELECT a.code, a.name, a.subtype, SUM(l.credit - l.debit) as balance FROM accounting_move_lines l JOIN accounting_moves m ON m.id = l.move_id JOIN chart_of_accounts a ON a.id = l.account_id WHERE m.company_id = v_company_id AND m.state = 'Posted' AND m.date <= p_date AND a.type = 'Equity' GROUP BY a.code, a.name, a.subtype HAVING SUM(l.credit - l.debit) != 0 UNION ALL SELECT '999999' as code, 'Current Year Earnings' as name, 'Retained Earnings' as subtype, v_earnings as balance WHERE v_earnings != 0 ORDER BY code) t;
    RETURN json_build_object('date', p_date, 'assets', COALESCE(v_assets, '[]'::json), 'liabilities', COALESCE(v_liabilities, '[]'::json), 'equity', COALESCE(v_equity, '[]'::json));
END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_get_profit_loss(p_start_date date, p_end_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_company_id UUID; v_income JSON; v_expense JSON; v_net_profit NUMERIC;
BEGIN
    v_company_id := get_my_company_id();
    SELECT json_agg(t) INTO v_income FROM (SELECT a.code, a.name, a.subtype, SUM(l.credit - l.debit) as balance FROM accounting_move_lines l JOIN accounting_moves m ON m.id = l.move_id JOIN chart_of_accounts a ON a.id = l.account_id WHERE m.company_id = v_company_id AND m.state = 'Posted' AND m.date BETWEEN p_start_date AND p_end_date AND a.type = 'Income' GROUP BY a.code, a.name, a.subtype HAVING SUM(l.credit - l.debit) != 0 ORDER BY a.code) t;
    SELECT json_agg(t) INTO v_expense FROM (SELECT a.code, a.name, a.subtype, SUM(l.debit - l.credit) as balance FROM accounting_move_lines l JOIN accounting_moves m ON m.id = l.move_id JOIN chart_of_accounts a ON a.id = l.account_id WHERE m.company_id = v_company_id AND m.state = 'Posted' AND m.date BETWEEN p_start_date AND p_end_date AND a.type = 'Expense' GROUP BY a.code, a.name, a.subtype HAVING SUM(l.debit - l.credit) != 0 ORDER BY a.code) t;
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_net_profit FROM accounting_move_lines l JOIN accounting_moves m ON m.id = l.move_id JOIN chart_of_accounts a ON a.id = l.account_id WHERE m.company_id = v_company_id AND m.state = 'Posted' AND m.date BETWEEN p_start_date AND p_end_date AND a.type IN ('Income', 'Expense');
    RETURN json_build_object('start_date', p_start_date, 'end_date', p_end_date, 'income', COALESCE(v_income, '[]'::json), 'expense', COALESCE(v_expense, '[]'::json), 'net_profit', v_net_profit);
END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_generate_stock_alerts(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_item RECORD;
    v_stock_qty NUMERIC;
    v_last_movement TIMESTAMP;
    v_alert_count INT := 0;
BEGIN
    -- Clear old unresolved alerts for this company
    DELETE FROM stock_alerts WHERE company_id = p_company_id AND is_resolved = false;

    -- Scan all active items
    FOR v_item IN 
        SELECT id, code, name, reorder_level, reorder_qty, expiry_date
        FROM item_master 
        WHERE company_id = p_company_id AND status = 'Active' AND is_stockable = true
    LOOP
        -- Get current stock level
        SELECT COALESCE(SUM(quantity), 0) INTO v_stock_qty
        FROM inventory_transactions
        WHERE company_id = p_company_id AND item_id = v_item.id;

        -- Get last movement date
        SELECT MAX(created_at) INTO v_last_movement
        FROM inventory_transactions
        WHERE company_id = p_company_id AND item_id = v_item.id;

        -- OUT OF STOCK
        IF v_stock_qty <= 0 THEN
            INSERT INTO stock_alerts (company_id, item_id, alert_type, severity, message, current_qty, reorder_level)
            VALUES (p_company_id, v_item.id, 'OUT_OF_STOCK', 'CRITICAL',
                    v_item.name || ' (' || v_item.code || ') is out of stock',
                    v_stock_qty, COALESCE(v_item.reorder_level, 0));
            v_alert_count := v_alert_count + 1;

        -- LOW STOCK
        ELSIF v_item.reorder_level IS NOT NULL AND v_item.reorder_level > 0 AND v_stock_qty <= v_item.reorder_level THEN
            INSERT INTO stock_alerts (company_id, item_id, alert_type, severity, message, current_qty, reorder_level, metadata)
            VALUES (p_company_id, v_item.id, 'LOW_STOCK', 'WARNING',
                    v_item.name || ' (' || v_item.code || ') is below reorder level. Current: ' || v_stock_qty || ', Reorder at: ' || v_item.reorder_level,
                    v_stock_qty, v_item.reorder_level,
                    jsonb_build_object('suggested_reorder_qty', COALESCE(v_item.reorder_qty, v_item.reorder_level * 2)));
            v_alert_count := v_alert_count + 1;
        END IF;

        -- NON-MOVING (no transactions in 1 year)
        IF v_last_movement IS NOT NULL AND v_last_movement < now() - interval '1 year' THEN
            INSERT INTO stock_alerts (company_id, item_id, alert_type, severity, message, current_qty, metadata)
            VALUES (p_company_id, v_item.id, 'NON_MOVING', 'WARNING',
                    v_item.name || ' (' || v_item.code || ') has had no movement for over 1 year',
                    v_stock_qty,
                    jsonb_build_object('last_movement', v_last_movement));
            v_alert_count := v_alert_count + 1;
        END IF;

        -- NEAR EXPIRY (within 90 days)
        IF v_item.expiry_date IS NOT NULL AND v_item.expiry_date <= CURRENT_DATE + interval '90 days' THEN
            IF v_item.expiry_date < CURRENT_DATE THEN
                INSERT INTO stock_alerts (company_id, item_id, alert_type, severity, message, current_qty, metadata)
                VALUES (p_company_id, v_item.id, 'EXPIRED', 'CRITICAL',
                        v_item.name || ' (' || v_item.code || ') has EXPIRED on ' || v_item.expiry_date,
                        v_stock_qty,
                        jsonb_build_object('expiry_date', v_item.expiry_date));
            ELSE
                INSERT INTO stock_alerts (company_id, item_id, alert_type, severity, message, current_qty, metadata)
                VALUES (p_company_id, v_item.id, 'NEAR_EXPIRY', 'WARNING',
                        v_item.name || ' (' || v_item.code || ') expires on ' || v_item.expiry_date,
                        v_stock_qty,
                        jsonb_build_object('expiry_date', v_item.expiry_date, 'days_until_expiry', v_item.expiry_date - CURRENT_DATE));
            END IF;
            v_alert_count := v_alert_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'alerts_generated', v_alert_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_bulk_import_items(p_company_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_item JSONB;
    v_inserted INT := 0;
    v_skipped INT := 0;
    v_errors JSONB := '[]'::jsonb;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        BEGIN
            INSERT INTO item_master (
                company_id, code, name, description, category, uom,
                weight, expiry_date, barcode,
                reorder_level, reorder_qty,
                is_stockable, is_batch_tracked, is_serial_tracked,
                valuation_method, status
            ) VALUES (
                p_company_id,
                COALESCE(v_item->>'code', v_item->>'lat_code', ''),
                COALESCE(v_item->>'name', ''),
                v_item->>'description',
                v_item->>'category',
                COALESCE(v_item->>'uom', 'PCS'),
                COALESCE((v_item->>'weight')::numeric, 0),
                CASE WHEN v_item->>'expiry_date' IS NOT NULL AND v_item->>'expiry_date' != '' 
                     THEN (v_item->>'expiry_date')::date ELSE NULL END,
                v_item->>'barcode',
                COALESCE((v_item->>'reorder_level')::numeric, 0),
                COALESCE((v_item->>'reorder_qty')::numeric, 0),
                COALESCE((v_item->>'is_stockable')::boolean, true),
                COALESCE((v_item->>'is_batch_tracked')::boolean, false),
                COALESCE((v_item->>'is_serial_tracked')::boolean, false),
                COALESCE(v_item->>'valuation_method', 'FIFO'),
                'Active'
            );
            v_inserted := v_inserted + 1;
        EXCEPTION WHEN unique_violation THEN
            v_skipped := v_skipped + 1;
            v_errors := v_errors || jsonb_build_object('code', v_item->>'code', 'error', 'Duplicate LAT Code');
        WHEN OTHERS THEN
            v_skipped := v_skipped + 1;
            v_errors := v_errors || jsonb_build_object('code', v_item->>'code', 'error', SQLERRM);
        END;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'inserted', v_inserted, 'skipped', v_skipped, 'errors', v_errors);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_stock_level(p_company_id uuid)
 RETURNS TABLE(item_id uuid, item_code text, item_name text, uom text, warehouse_id uuid, warehouse_name text, current_qty numeric, reserved_qty numeric, available_qty numeric, reorder_level numeric, weight numeric, expiry_date date, barcode text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        im.id AS item_id,
        im.code AS item_code,
        im.name AS item_name,
        im.uom,
        w.id AS warehouse_id,
        w.name AS warehouse_name,
        COALESCE(SUM(it.quantity), 0) AS current_qty,
        COALESCE((
            SELECT SUM(ir.reserved_qty) 
            FROM inventory_reservations ir 
            WHERE ir.item_id = im.id AND ir.warehouse_id = w.id AND ir.status = 'Active'
        ), 0) AS reserved_qty,
        COALESCE(SUM(it.quantity), 0) - COALESCE((
            SELECT SUM(ir.reserved_qty) 
            FROM inventory_reservations ir 
            WHERE ir.item_id = im.id AND ir.warehouse_id = w.id AND ir.status = 'Active'
        ), 0) AS available_qty,
        COALESCE(im.reorder_level, 0) AS reorder_level,
        im.weight,
        im.expiry_date,
        im.barcode
    FROM item_master im
    CROSS JOIN warehouses w
    LEFT JOIN inventory_transactions it ON it.item_id = im.id AND it.warehouse_id = w.id AND it.company_id = p_company_id
    WHERE im.company_id = p_company_id AND im.status = 'Active' AND im.is_stockable = true
    AND w.company_id = p_company_id AND w.is_active = true
    GROUP BY im.id, im.code, im.name, im.uom, im.reorder_level, im.weight, im.expiry_date, im.barcode, w.id, w.name
    ORDER BY im.name, w.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_revenue_expense_trend(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN COALESCE(
        (SELECT jsonb_agg(row_to_json(t))
         FROM (
             WITH months AS (
                 SELECT generate_series(
                     date_trunc('month', CURRENT_DATE - interval '5 months'),
                     date_trunc('month', CURRENT_DATE),
                     '1 month'::interval
                 ) AS month_date
             ),
             monthly_data AS (
                 SELECT 
                     date_trunc('month', m.date) as month_date,
                     SUM(CASE WHEN a.type = 'Income' THEN (l.credit - l.debit) ELSE 0 END) as revenue,
                     SUM(CASE WHEN a.type = 'Expense' THEN (l.debit - l.credit) ELSE 0 END) as expense
                 FROM public.accounting_journal_lines l
                 JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
                 JOIN public.accounting_journal_entries m ON m.id = l.entry_id
                 WHERE m.company_id = p_company_id 
                   AND m.state = 'Posted'
                   AND m.date >= (CURRENT_DATE - interval '6 months')
                 GROUP BY date_trunc('month', m.date)
             )
             SELECT 
                 to_char(m.month_date, 'Mon') as month,
                 COALESCE(d.revenue, 0) as revenue,
                 COALESCE(d.expense, 0) as expense
             FROM months m
             LEFT JOIN monthly_data d ON m.month_date = d.month_date
             ORDER BY m.month_date
         ) t),
        '[]'::jsonb
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_sync_device_attendance(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_log RECORD;
  v_employee_id UUID;
  v_att_record_id UUID;
  v_synced INT := 0;
  v_failed INT := 0;
  v_skipped INT := 0;
  v_date DATE;
BEGIN
  FOR v_log IN
    SELECT * FROM device_attendance_logs
    WHERE company_id = p_company_id
      AND sync_status = 'pending'
    ORDER BY punch_time ASC
    LIMIT 500
  LOOP
    BEGIN
      -- Try to match employee by identifier (employee code, badge number, or name)
      SELECT e.id INTO v_employee_id
      FROM employees e
      WHERE e.company_id = p_company_id
        AND (
          e.employee_code = v_log.employee_identifier
          OR e.id::text = v_log.employee_identifier
          OR e.name ILIKE v_log.employee_identifier
        )
      LIMIT 1;

      IF v_employee_id IS NULL THEN
        UPDATE device_attendance_logs
        SET sync_status = 'failed',
            sync_error = 'Employee not found for identifier: ' || v_log.employee_identifier,
            synced_at = now()
        WHERE id = v_log.id;
        v_failed := v_failed + 1;
        CONTINUE;
      END IF;

      -- Update employee_id on the log
      UPDATE device_attendance_logs SET employee_id = v_employee_id WHERE id = v_log.id;

      v_date := (v_log.punch_time AT TIME ZONE 'UTC')::date;

      -- Check if attendance record already exists for this employee + date
      SELECT id INTO v_att_record_id
      FROM attendance_records
      WHERE company_id = p_company_id
        AND employee_id = v_employee_id
        AND date = v_date;

      IF v_att_record_id IS NULL THEN
        -- Create new attendance record
        INSERT INTO attendance_records (company_id, employee_id, date, check_in, status)
        VALUES (p_company_id, v_employee_id, v_date, v_log.punch_time::time, 'Present')
        RETURNING id INTO v_att_record_id;
      ELSE
        -- Update existing: if no check_out, set check_out; otherwise skip
        UPDATE attendance_records
        SET check_out = v_log.punch_time::time,
            status = 'Present'
        WHERE id = v_att_record_id
          AND (check_out IS NULL OR v_log.punch_time::time > check_out);
      END IF;

      UPDATE device_attendance_logs
      SET sync_status = 'synced',
          attendance_record_id = v_att_record_id,
          synced_at = now()
      WHERE id = v_log.id;

      v_synced := v_synced + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE device_attendance_logs
      SET sync_status = 'failed',
          sync_error = SQLERRM,
          synced_at = now()
      WHERE id = v_log.id;
      v_failed := v_failed + 1;
    END;
  END LOOP;

  -- Update device last_sync_at
  UPDATE device_integrations
  SET last_sync_at = now(),
      sync_count = sync_count + v_synced
  WHERE company_id = p_company_id
    AND device_type IN ('biometric', 'attendance_machine');

  RETURN jsonb_build_object(
    'synced', v_synced,
    'failed', v_failed,
    'skipped', v_skipped
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_device_sync_status(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_devices', (SELECT count(*) FROM device_integrations WHERE company_id = p_company_id),
    'active_devices', (SELECT count(*) FROM device_integrations WHERE company_id = p_company_id AND status = 'active'),
    'pending_logs', (SELECT count(*) FROM device_attendance_logs WHERE company_id = p_company_id AND sync_status = 'pending'),
    'synced_today', (SELECT count(*) FROM device_attendance_logs WHERE company_id = p_company_id AND sync_status = 'synced' AND synced_at::date = CURRENT_DATE),
    'failed_logs', (SELECT count(*) FROM device_attendance_logs WHERE company_id = p_company_id AND sync_status = 'failed'),
    'devices', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', di.id,
        'name', di.device_name,
        'type', di.device_type,
        'status', di.status,
        'last_sync', di.last_sync_at,
        'sync_count', di.sync_count,
        'pending', (SELECT count(*) FROM device_attendance_logs dal WHERE dal.device_id = di.id AND dal.sync_status = 'pending')
      )), '[]'::jsonb)
      FROM device_integrations di
      WHERE di.company_id = p_company_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_generate_payroll(p_company_id uuid, p_month_year date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_run_id UUID;
    v_start_date DATE := p_month_year;
    v_end_date DATE := (p_month_year + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    v_month_year_text TEXT := TO_CHAR(v_start_date, 'Mon YYYY');
    v_days_in_month NUMERIC;
    v_emp RECORD;
    v_payable_days NUMERIC;
    v_lop_days NUMERIC;
    v_gross_pay NUMERIC;
    v_base_salary NUMERIC;
    v_daily_rate NUMERIC;
    
    v_ot_hours NUMERIC;
    v_ot_amount NUMERIC;
    v_loan_deduction NUMERIC;
    v_record_id UUID;
BEGIN
    -- 1. Validate / Create Payroll Run
    v_days_in_month := DATE_PART('day', v_end_date);
    
    SELECT id INTO v_run_id FROM public.payroll_runs 
    WHERE company_id = p_company_id AND period_start = v_start_date AND period_end = v_end_date
    LIMIT 1;

    IF v_run_id IS NULL THEN
        INSERT INTO public.payroll_runs (company_id, name, period_start, period_end, status)
        VALUES (p_company_id, v_month_year_text || ' Payroll', v_start_date, v_end_date, 'DRAFT')
        RETURNING id INTO v_run_id;
    END IF;

    -- 2. Loop through active employees
    FOR v_emp IN 
        SELECT id, salary_amount, join_date 
        FROM public.employees 
        WHERE company_id = p_company_id 
        AND status = 'Active' 
        AND join_date <= v_end_date
    LOOP
        -- Calculate Payable Days
        SELECT COALESCE(COUNT(*), 0) INTO v_lop_days
        FROM public.attendance
        WHERE employee_id = v_emp.id 
        AND date BETWEEN v_start_date AND v_end_date
        AND status = 'Absent';

        IF v_emp.join_date > v_start_date THEN
            v_lop_days := v_lop_days + (DATE_PART('day', v_emp.join_date::timestamp) - 1);
        END IF;

        v_payable_days := v_days_in_month - v_lop_days;
        IF v_payable_days < 0 THEN v_payable_days := 0; END IF;

        -- Calculate Base Salary & Daily Rate
        v_base_salary := COALESCE(v_emp.salary_amount, 0);
        v_daily_rate := v_base_salary / v_days_in_month;
        
        -- OVERTIME AUTOMATION
        SELECT COALESCE(SUM(total_hours - 8), 0) INTO v_ot_hours
        FROM public.attendance
        WHERE employee_id = v_emp.id 
        AND date BETWEEN v_start_date AND v_end_date
        AND total_hours > 8;
        
        v_ot_amount := ROUND((v_ot_hours * (v_daily_rate / 8) * 1.5)::numeric, 2);

        -- LOAN DEDUCTION AUTOMATION
        SELECT COALESCE(SUM(LEAST(emi_amount, balance)), 0) INTO v_loan_deduction
        FROM public.payroll_loans
        WHERE employee_id = v_emp.id
        AND company_id = p_company_id
        AND status = 'Active'
        AND start_date <= v_end_date;

        -- Calculate Gross and Net
        v_gross_pay := ROUND((v_daily_rate * v_payable_days)::numeric, 2) + v_ot_amount;
        
        DECLARE
           v_net_pay NUMERIC := v_gross_pay - v_loan_deduction;
        BEGIN
            -- Check if record exists
            SELECT id INTO v_record_id FROM public.payroll_records
            WHERE company_id = p_company_id AND employee_id = v_emp.id AND month_year = v_month_year_text
            LIMIT 1;

            IF v_record_id IS NULL THEN
                INSERT INTO public.payroll_records (
                    company_id, employee_id, month_year,
                    basic_salary, gross_earning, total_deduction, net_pay,
                    status, ot_amount, loan_deduction,
                    payable_days, lop_days, fixed_allowance, variable_allowance
                )
                VALUES (
                    p_company_id, v_emp.id, v_month_year_text,
                    v_base_salary, v_gross_pay, v_loan_deduction, v_net_pay,
                    'CALCULATED', v_ot_amount, v_loan_deduction,
                    v_payable_days, v_lop_days, 0, 0
                );
            ELSE
                UPDATE public.payroll_records SET
                    basic_salary = v_base_salary,
                    gross_earning = v_gross_pay,
                    total_deduction = v_loan_deduction,
                    net_pay = v_net_pay,
                    ot_amount = v_ot_amount,
                    loan_deduction = v_loan_deduction,
                    payable_days = v_payable_days,
                    lop_days = v_lop_days,
                    fixed_allowance = 0,
                    variable_allowance = 0
                WHERE id = v_record_id;
            END IF;
        END;
            
    END LOOP;

    -- Update Total
    UPDATE public.payroll_runs 
    SET total_amount = (
        SELECT COALESCE(SUM(net_pay), 0) 
        FROM public.payroll_records 
        WHERE company_id = p_company_id AND month_year = v_month_year_text
    )
    WHERE id = v_run_id;

    RETURN v_run_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_seed_accounting_masters(v_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_group_asset UUID;
    v_group_liability UUID;
    v_group_equity UUID;
    v_group_income UUID;
    v_group_expense UUID;
    v_group_cogs UUID;
    
    v_acc_cash UUID;
    v_acc_bank UUID;
    v_acc_ar UUID;
    v_acc_ap UUID;
    v_acc_retained UUID;
    
    v_acc_pur_c1 UUID;
    v_acc_pur_c2 UUID;
    v_acc_pur_c3 UUID;
    
    v_acc_sales_m1 UUID;
    v_acc_sales_m2 UUID;
    v_acc_sales_m3 UUID;
    v_acc_sales_m4 UUID;
    v_acc_sales_m5 UUID;

    v_acc_exp_d1 UUID;
    v_acc_exp_d2 UUID;
    v_acc_exp_d3 UUID;
    v_acc_exp_d4 UUID;
    v_acc_exp_d5 UUID;

    v_acc_inc_i1 UUID;
    v_acc_inc_i2 UUID;
    v_acc_inc_i3 UUID;
    v_acc_inc_i4 UUID;
BEGIN
    RAISE NOTICE 'Seeding Accounting Masters for company_id: %', v_company_id;

    -- ------------------------------------------------------------------------------
    -- 1. Account Groups
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type) VALUES
    (v_company_id, 'Assets Group', '1000', '1999', 'Asset') ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_asset FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Assets Group';

    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type) VALUES
    (v_company_id, 'Liabilities Group', '2000', '2999', 'Liability') ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_liability FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Liabilities Group';

    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type) VALUES
    (v_company_id, 'Equity Group', '3000', '3999', 'Equity') ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_equity FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Equity Group';

    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type) VALUES
    (v_company_id, 'Income Group', '4000', '4999', 'Income') ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_income FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Income Group';

    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type) VALUES
    (v_company_id, 'Expenses Group', '5000', '5999', 'Expense') ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_expense FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Expenses Group';

    -- Cost of Goods Sold subgroup under Expense Group
    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type, parent_id) VALUES
    (v_company_id, 'Cost of Goods Sold (COGS)', '5100', '5199', 'Expense', v_group_expense) ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_cogs FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Cost of Goods Sold (COGS)';

    -- ------------------------------------------------------------------------------
    -- 2. Chart of Accounts (Default + Workbook Ledger Accounts)
    -- ------------------------------------------------------------------------------
    -- Bank and Cash Accounts
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id, is_reconcilable) VALUES
    (v_company_id, '1001', 'Petty Cash', 'Asset', 'Cash', v_group_asset, true),
    (v_company_id, '1002', 'QNB Main Bank Account', 'Asset', 'Bank', v_group_asset, true),
    -- AR & AP
    (v_company_id, '1100', 'Accounts Receivable', 'Asset', 'Receivable', v_group_asset, true),
    (v_company_id, '2001', 'Accounts Payable', 'Liability', 'Payable', v_group_liability, true),
    -- Equity
    (v_company_id, '3001', 'Retained Earnings', 'Equity', 'Other', v_group_equity, false)
    ON CONFLICT (company_id, code) DO NOTHING;

    -- Query created core IDs
    SELECT id INTO v_acc_cash FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1001';
    SELECT id INTO v_acc_bank FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1002';
    SELECT id INTO v_acc_ar FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1100';
    SELECT id INTO v_acc_ap FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '2001';
    SELECT id INTO v_acc_retained FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '3001';

    -- Workbook Purchase Accounts
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id, is_reconcilable) VALUES
    (v_company_id, '5010', 'Purchase – 3X Bobipreg & Consumables', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5011', 'Purchase – 3X Reinforcekit 4D', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5012', 'Purchase – CH ARC Industrial Coatings', 'Expense', 'COGS', v_group_cogs, false)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT id INTO v_acc_pur_c1 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5010';
    SELECT id INTO v_acc_pur_c2 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5011';
    SELECT id INTO v_acc_pur_c3 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5012';

    -- Workbook Sales Accounts
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id, is_reconcilable) VALUES
    (v_company_id, '4010', 'Manpower Contracts Income', 'Income', 'Revenue', v_group_income, false),
    (v_company_id, '4011', 'Projects Income', 'Income', 'Revenue', v_group_income, false),
    (v_company_id, '4012', 'Sales Discount / Rebate', 'Income', 'Revenue', v_group_income, false),
    (v_company_id, '4013', 'Trading – 3X Engineering Income', 'Income', 'Revenue', v_group_income, false),
    (v_company_id, '4014', 'Trading – Chesterton Income', 'Income', 'Revenue', v_group_income, false)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT id INTO v_acc_sales_m1 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4010';
    SELECT id INTO v_acc_sales_m2 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4011';
    SELECT id INTO v_acc_sales_m3 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4012';
    SELECT id INTO v_acc_sales_m4 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4013';
    SELECT id INTO v_acc_sales_m5 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4014';

    -- Workbook Direct Expenses
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id, is_reconcilable) VALUES
    (v_company_id, '5210', 'COS – Packaging', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5211', 'COS – Projects', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5212', 'Customs Duty & Legalization Charges', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5213', 'Freight Charges', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5214', 'Employee Benefit Related Costs', 'Expense', 'Other', v_group_expense, false)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT id INTO v_acc_exp_d1 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5210';
    SELECT id INTO v_acc_exp_d2 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5211';
    SELECT id INTO v_acc_exp_d3 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5212';
    SELECT id INTO v_acc_exp_d4 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5213';
    SELECT id INTO v_acc_exp_d5 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5214';

    -- Workbook Indirect Incomes
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id, is_reconcilable) VALUES
    (v_company_id, '4101', 'Exchange Gain', 'Income', 'Other', v_group_income, false),
    (v_company_id, '4102', 'Interest Income', 'Income', 'Other', v_group_income, false),
    (v_company_id, '4103', 'Other Indirect Income', 'Income', 'Other', v_group_income, false),
    (v_company_id, '4104', 'Rental Income', 'Income', 'Other', v_group_income, false)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT id INTO v_acc_inc_i1 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4101';
    SELECT id INTO v_acc_inc_i2 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4102';
    SELECT id INTO v_acc_inc_i3 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4103';
    SELECT id INTO v_acc_inc_i4 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4104';

    -- ------------------------------------------------------------------------------
    -- 3. Stock Categories (Linking Item Category name to default Asset/COGS/Adjustment COA accounts)
    -- ------------------------------------------------------------------------------
    -- Ensure Asset Accounts exist for Stock
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id) VALUES
    (v_company_id, '1210', 'Stock Inventory - Bobipreg', 'Asset', 'Other', v_group_asset),
    (v_company_id, '1211', 'Stock Inventory - Fillers & Primers', 'Asset', 'Other', v_group_asset),
    (v_company_id, '1212', 'Stock Inventory - Reinforcekit 4D', 'Asset', 'Other', v_group_asset),
    (v_company_id, '1213', 'Stock Inventory - Rollerkit', 'Asset', 'Other', v_group_asset)
    ON CONFLICT (company_id, code) DO NOTHING;

    INSERT INTO public.accounting_stock_categories (company_id, name, item_category, asset_account_id, cogs_account_id, adjustment_account_id) VALUES
    (v_company_id, '3X Bobipreg & Consumables', 'Bobipreg', 
     (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1210' LIMIT 1), v_acc_pur_c1, v_acc_pur_c1),
    (v_company_id, '3X Fillers & Primers', 'Fillers', 
     (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1211' LIMIT 1), v_acc_pur_c1, v_acc_pur_c1),
    (v_company_id, '3X Reinforcekit 4D', 'Reinforcekit', 
     (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1212' LIMIT 1), v_acc_pur_c2, v_acc_pur_c2),
    (v_company_id, '3X Rollerkit', 'Rollerkit', 
     (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1213' LIMIT 1), v_acc_pur_c1, v_acc_pur_c1)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 4. Purchase Ledger Masters
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_purchase_ledgers (company_id, name, account_id) VALUES
    (v_company_id, 'Purchase – 3X Bobipreg & Consumables', v_acc_pur_c1),
    (v_company_id, 'Purchase – 3X Reinforcekit 4D', v_acc_pur_c2),
    (v_company_id, 'Purchase – CH ARC Industrial Coatings', v_acc_pur_c3)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 5. Sales Ledger Masters
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_sales_ledgers (company_id, name, account_id) VALUES
    (v_company_id, 'Manpower Contracts Income', v_acc_sales_m1),
    (v_company_id, 'Projects Income', v_acc_sales_m2),
    (v_company_id, 'Sales Discount / Rebate', v_acc_sales_m3),
    (v_company_id, 'Trading – 3X Engineering Income', v_acc_sales_m4),
    (v_company_id, 'Trading – Chesterton Income', v_acc_sales_m5)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 6. Direct Expense Ledger Masters
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_direct_expense_ledgers (company_id, name, account_id) VALUES
    (v_company_id, 'COS – Packaging', v_acc_exp_d1),
    (v_company_id, 'COS – Projects', v_acc_exp_d2),
    (v_company_id, 'Customs Duty & Legalization Charges', v_acc_exp_d3),
    (v_company_id, 'Freight Charges', v_acc_exp_d4),
    (v_company_id, 'Employee Benefit Related Costs', v_acc_exp_d5)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 7. Indirect Income Ledger Masters
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_indirect_income_ledgers (company_id, name, account_id) VALUES
    (v_company_id, 'Exchange Gain', v_acc_inc_i1),
    (v_company_id, 'Interest Income', v_acc_inc_i2),
    (v_company_id, 'Other Indirect Income', v_acc_inc_i3),
    (v_company_id, 'Rental Income', v_acc_inc_i4)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 8. Cost Centers (Projects, Contracts, General)
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_cost_centers (company_id, code, name, type) VALUES
    (v_company_id, 'PROJECT-001', 'QP Industrial Project', 'PROJECT'),
    (v_company_id, 'PROJECT-002', 'RasGas Expansion', 'PROJECT'),
    (v_company_id, 'MANPOWER-QP', 'QP Manpower Deputation', 'CONTRACT'),
    (v_company_id, 'MANPOWER-RASGAS', 'RasGas Manpower Deputation', 'CONTRACT'),
    (v_company_id, 'GENERIC-ADMIN', 'General Administration Cost Center', 'GENERIC')
    ON CONFLICT (company_id, code) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 9. Journals (Link default accounts)
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_journals (company_id, name, code, type, default_account_id, sequence_prefix) VALUES
    (v_company_id, 'Customer Invoices', 'INV', 'Sale', v_acc_ar, 'INV/2026/'),
    (v_company_id, 'Vendor Bills', 'BILL', 'Purchase', v_acc_ap, 'BILL/2026/'),
    (v_company_id, 'Bank Journal', 'BNK1', 'Bank', v_acc_bank, 'BNK1/2026/'),
    (v_company_id, 'Cash Journal', 'CSH', 'Cash', v_acc_cash, 'CSH/2026/'),
    (v_company_id, 'General Operations', 'GEN', 'General', v_acc_retained, 'GEN/2026/')
    ON CONFLICT (company_id, code) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 10. Payment Terms
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_payment_terms (company_id, name, days) VALUES
    (v_company_id, 'Immediate Payment', 0),
    (v_company_id, '15 Days', 15),
    (v_company_id, '30 Days Net', 30),
    (v_company_id, '45 Days Net', 45),
    (v_company_id, '60 Days Net', 60)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 11. Taxes
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_taxes (company_id, name, type, scope, amount, account_id) VALUES
    (v_company_id, 'Zero VAT', 'Percent', 'Sales', 0.00, v_acc_retained),
    (v_company_id, 'Standard VAT 5%', 'Percent', 'Sales', 5.00, v_acc_retained),
    (v_company_id, 'Purchase VAT 5%', 'Percent', 'Purchase', 5.00, v_acc_retained)
    ON CONFLICT (company_id, name) DO NOTHING;

END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_apply_adjustment(p_adjustment_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_adj RECORD;
    v_line RECORD;
    v_account_config RECORD;
    v_total_value NUMERIC;
    v_unit_cost NUMERIC;
    v_txn_type TEXT;
    v_new_txn_id UUID;
BEGIN
    SELECT * INTO v_adj FROM inventory_adjustments WHERE id = p_adjustment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Adjustment not found');
    END IF;

    IF v_adj.status != 'DRAFT' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Adjustment is not in DRAFT status');
    END IF;

    FOR v_line IN SELECT * FROM inventory_adjustment_lines WHERE adjustment_id = p_adjustment_id LOOP
        
        IF v_line.difference_qty = 0 THEN
            CONTINUE;
        END IF;

        v_unit_cost := 10;
        
        INSERT INTO inventory_transactions (
            company_id, transaction_type, item_id, warehouse_id, 
            quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            v_adj.company_id, 'ADJUSTMENT', v_line.item_id, v_adj.warehouse_id,
            v_line.difference_qty, v_unit_cost, 'INV_ADJ', p_adjustment_id
        ) RETURNING id INTO v_new_txn_id;

        INSERT INTO stock_movements (
            company_id, item_id, movement_type, 
            from_bin_id, to_bin_id, quantity, 
            reference_type, reference_id, performed_by
        ) VALUES (
            v_adj.company_id, v_line.item_id, 
            CASE WHEN v_line.difference_qty > 0 THEN 'IN' ELSE 'OUT' END,
            CASE WHEN v_line.difference_qty < 0 THEN v_line.bin_id ELSE NULL END,
            CASE WHEN v_line.difference_qty > 0 THEN v_line.bin_id ELSE NULL END,
            ABS(v_line.difference_qty),
            'INV_ADJ', p_adjustment_id, p_user_id
        );

        SELECT * INTO v_account_config 
        FROM inventory_account_config 
        WHERE company_id = v_adj.company_id 
        LIMIT 1;

        IF FOUND AND v_unit_cost > 0 THEN
            v_total_value := ABS(v_line.difference_qty) * v_unit_cost;

            IF v_line.difference_qty > 0 THEN
                INSERT INTO accounting_entries (
                    company_id, transaction_date, description, reference_type, reference_id,
                    debit_account, credit_account, amount
                ) VALUES (
                    v_adj.company_id, CURRENT_DATE, 'Inventory Adjustment Gain', 'INV_TXN', v_new_txn_id,
                    v_account_config.inventory_asset_account, v_account_config.stock_adjustment_account, v_total_value
                );
            ELSE
                INSERT INTO accounting_entries (
                    company_id, transaction_date, description, reference_type, reference_id,
                    debit_account, credit_account, amount
                ) VALUES (
                    v_adj.company_id, CURRENT_DATE, 'Inventory Adjustment Loss', 'INV_TXN', v_new_txn_id,
                    v_account_config.stock_adjustment_account, v_account_config.inventory_asset_account, v_total_value
                );
            END IF;
        END IF;

    END LOOP;

    UPDATE inventory_adjustments 
    SET status = 'APPROVED', approved_by = p_user_id, approved_at = now() 
    WHERE id = p_adjustment_id;

    RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_trial_balance(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            a.code,
            a.name,
            a.type,
            SUM(l.debit) as total_debit,
            SUM(l.credit) as total_credit,
            SUM(l.debit - l.credit) as balance
        FROM accounting_move_lines l
        JOIN accounting_moves m ON m.id = l.move_id
        JOIN chart_of_accounts a ON a.id = l.account_id
        WHERE m.company_id = v_company_id
          AND m.state = 'Posted'
          AND m.date <= p_date
        GROUP BY a.code, a.name, a.type
        HAVING SUM(l.debit) != 0 OR SUM(l.credit) != 0
        ORDER BY a.code
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_partner_aging(p_partner_type text, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            p.name as partner_name,
            SUM(CASE WHEN (p_date - m.due_date) <= 0 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as current,
            SUM(CASE WHEN (p_date - m.due_date) BETWEEN 1 AND 30 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_30,
            SUM(CASE WHEN (p_date - m.due_date) BETWEEN 31 AND 60 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_60,
            SUM(CASE WHEN (p_date - m.due_date) BETWEEN 61 AND 90 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_90,
            SUM(CASE WHEN (p_date - m.due_date) > 90 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_90_plus,
            SUM(CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) as total_overdue
        FROM accounting_move_lines l
        JOIN accounting_moves m ON m.id = l.move_id
        JOIN accounting_partners p ON p.id = m.partner_id
        JOIN chart_of_accounts a ON a.id = l.account_id
        WHERE m.company_id = v_company_id
          AND m.state = 'Posted'
          AND m.date <= p_date
          AND a.subtype IN ('Receivable', 'Payable')
          AND p.partner_type IN (p_partner_type, 'Both')
        GROUP BY p.name
        HAVING SUM(CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) != 0
        ORDER BY p.name
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_seed_company_data_wrapper(v_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Call the original seeding function
    PERFORM rpc_seed_company_data(v_company_id);
    
    -- Call the new isolated accounting seeding function
    PERFORM rpc_seed_accounting_masters(v_company_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_seed_company_data(v_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RAISE NOTICE 'Triggering original seed + accounting seed...';
    -- Seeding attributes
    INSERT INTO org_faiths (code, name, company_id) VALUES
    ('HINDU', 'Hinduism', v_company_id), ('MUSLIM', 'Islam', v_company_id),
    ('CHRISTIAN', 'Christianity', v_company_id), ('SIKH', 'Sikhism', v_company_id),
    ('BUDDHIST', 'Buddhism', v_company_id), ('JAIN', 'Jainism', v_company_id),
    ('OTHER', 'Other', v_company_id), ('PREFER_NOT_TO_SAY', 'Prefer not to say', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_marital_status (code, name, company_id) VALUES
    ('SINGLE', 'Single', v_company_id), ('MARRIED', 'Married', v_company_id),
    ('DIVORCED', 'Divorced', v_company_id), ('WIDOWED', 'Widowed', v_company_id),
    ('SEPARATED', 'Separated', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_blood_groups (code, name, company_id) VALUES
    ('A_POSITIVE', 'A+', v_company_id), ('A_NEGATIVE', 'A-', v_company_id),
    ('B_POSITIVE', 'B+', v_company_id), ('B_NEGATIVE', 'B-', v_company_id),
    ('O_POSITIVE', 'O+', v_company_id), ('O_NEGATIVE', 'O-', v_company_id),
    ('AB_POSITIVE', 'AB+', v_company_id), ('AB_NEGATIVE', 'AB-', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_nationalities (code, name, company_id) VALUES
    ('IN', 'Indian', v_company_id), ('US', 'American', v_company_id),
    ('GB', 'British', v_company_id), ('CA', 'Canadian', v_company_id),
    ('AU', 'Australian', v_company_id), ('UAE', 'Emirati', v_company_id),
    ('SG', 'Singaporean', v_company_id), ('OTHER', 'Other', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;

    INSERT INTO org_designations (code, name, description, company_id) VALUES
    ('TL', 'Team Lead', 'Team leadership position', v_company_id),
    ('MGR', 'Manager', 'Department manager', v_company_id),
    ('SMGR', 'Senior Manager', 'Senior management role', v_company_id),
    ('DIR', 'Director', 'Directorial position', v_company_id),
    ('VP', 'Vice President', 'VP level position', v_company_id),
    ('SWE', 'Software Engineer', 'Software development role', v_company_id),
    ('SSWE', 'Senior Software Engineer', 'Senior software development role', v_company_id),
    ('ANALYST', 'Business Analyst', 'Business analysis role', v_company_id),
    ('HR', 'HR Executive', 'Human resources role', v_company_id),
    ('SALES', 'Sales Executive', 'Sales position', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_grades (code, name, description, company_id) VALUES
    ('G1', 'Grade 1', 'Entry level', v_company_id),
    ('G2', 'Grade 2', 'Junior level', v_company_id),
    ('G3', 'Grade 3', 'Mid level', v_company_id),
    ('G4', 'Grade 4', 'Senior level', v_company_id),
    ('G5', 'Grade 5', 'Principal level', v_company_id),
    ('G6', 'Grade 6', 'Director level', v_company_id),
    ('G7', 'Grade 7', 'Executive level', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_employment_types (code, name, description, company_id) VALUES
    ('FT', 'Full-time', 'Full-time permanent employee', v_company_id),
    ('PT', 'Part-time', 'Part-time employee', v_company_id),
    ('CONTRACT', 'Contract', 'Contract-based employment', v_company_id),
    ('INTERN', 'Intern', 'Internship position', v_company_id),
    ('CONSULTANT', 'Consultant', 'External consultant', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_probation_periods (code, name, duration_months, company_id) VALUES
    ('PROB_3', '3 Months', 3, v_company_id),
    ('PROB_6', '6 Months', 6, v_company_id),
    ('PROB_12', '12 Months', 12, v_company_id),
    ('NO_PROB', 'No Probation', 0, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_confirmation_status (code, name, company_id) VALUES
    ('PROBATION', 'On Probation', v_company_id),
    ('CONFIRMED', 'Confirmed', v_company_id),
    ('PENDING_CONF', 'Pending Confirmation', v_company_id),
    ('EXTENDED_PROB', 'Extended Probation', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_exit_reasons (code, name, company_id) VALUES
    ('RESIGNATION', 'Resignation', v_company_id),
    ('TERMINATION', 'Termination', v_company_id),
    ('RETIREMENT', 'Retirement', v_company_id),
    ('END_OF_CONTRACT', 'End of Contract', v_company_id),
    ('MUTUAL_SEPARATION', 'Mutual Separation', v_company_id),
    ('HEALTH_REASONS', 'Health Reasons', v_company_id),
    ('RELOCATION', 'Relocation', v_company_id),
    ('HIGHER_STUDIES', 'Higher Studies', v_company_id),
    ('BETTER_OPPORTUNITY', 'Better Opportunity', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_salary_components (code, name, component_type, is_taxable, company_id) VALUES
    ('BASIC', 'Basic Salary', 'EARNING', true, v_company_id),
    ('HRA', 'House Rent Allowance', 'EARNING', true, v_company_id),
    ('DA', 'Dearness Allowance', 'EARNING', true, v_company_id),
    ('TA', 'Transport Allowance', 'EARNING', false, v_company_id),
    ('MEDICAL', 'Medical Allowance', 'EARNING', false, v_company_id),
    ('SPECIAL', 'Special Allowance', 'EARNING', true, v_company_id),
    ('BONUS', 'Performance Bonus', 'EARNING', true, v_company_id),
    ('PF', 'Provident Fund', 'DEDUCTION', false, v_company_id),
    ('ESI', 'Employee State Insurance', 'DEDUCTION', false, v_company_id),
    ('PT', 'Professional Tax', 'DEDUCTION', false, v_company_id),
    ('TDS', 'Tax Deducted at Source', 'DEDUCTION', false, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_pay_groups (code, name, pay_frequency, company_id) VALUES
    ('MONTHLY', 'Monthly Payroll', 'MONTHLY', v_company_id),
    ('WEEKLY', 'Weekly Payroll', 'WEEKLY', v_company_id),
    ('BI_WEEKLY', 'Bi-weekly Payroll', 'BI_WEEKLY', v_company_id),
    ('CONTRACT', 'Contract Payroll', 'MONTHLY', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_bank_configs (code, name, bank_name, company_id) VALUES
    ('HDFC', 'HDFC Bank', 'HDFC Bank', v_company_id),
    ('ICICI', 'ICICI Bank', 'ICICI Bank', v_company_id),
    ('SBI', 'State Bank of India', 'State Bank of India', v_company_id),
    ('AXIS', 'Axis Bank', 'Axis Bank', v_company_id),
    ('KOTAK', 'Kotak Mahindra Bank', 'Kotak Mahindra Bank', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_leave_types (code, name, default_balance, is_paid, requires_approval, company_id) VALUES
    ('CL', 'Casual Leave', 12, true, true, v_company_id),
    ('SL', 'Sick Leave', 10, true, false, v_company_id),
    ('PL', 'Privilege Leave', 15, true, true, v_company_id),
    ('EL', 'Earned Leave', 15, true, true, v_company_id),
    ('ML', 'Maternity Leave', 180, true, true, v_company_id),
    ('PL_PATERNITY', 'Paternity Leave', 15, true, true, v_company_id),
    ('COMP_OFF', 'Compensatory Off', 0, true, true, v_company_id),
    ('LWP', 'Leave Without Pay', 0, false, true, v_company_id),
    ('BEREAVEMENT', 'Bereavement Leave', 5, true, false, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_leave_policies (code, name, leave_type_id, max_consecutive_days, can_carry_forward, company_id) 
    SELECT 'CL_POLICY', 'Casual Leave Policy', id, 3, false, v_company_id 
    FROM org_leave_types WHERE code = 'CL' AND company_id = v_company_id LIMIT 1
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_leave_policies (code, name, leave_type_id, max_consecutive_days, can_carry_forward, company_id) 
    SELECT 'PL_POLICY', 'Privilege Leave Policy', id, 15, true, v_company_id 
    FROM org_leave_types WHERE code = 'PL' AND company_id = v_company_id LIMIT 1
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_holiday_calendar (name, holiday_date, is_mandatory, company_id) VALUES
    ('Republic Day', '2026-01-26', true, v_company_id), ('Holi', '2026-03-14', true, v_company_id),
    ('Good Friday', '2026-04-03', false, v_company_id), ('Independence Day', '2026-08-15', true, v_company_id),
    ('Gandhi Jayanti', '2026-10-02', true, v_company_id), ('Diwali', '2026-10-20', true, v_company_id),
    ('Christmas', '2026-12-25', true, v_company_id)
    ON CONFLICT (company_id, holiday_date) DO NOTHING;
    
    INSERT INTO org_shift_timings (code, name, start_time, end_time, grace_period_minutes, company_id) VALUES
    ('GENERAL', 'General Shift (9 AM - 6 PM)', '09:00:00', '18:00:00', 15, v_company_id),
    ('MORNING', 'Morning Shift (7 AM - 4 PM)', '07:00:00', '16:00:00', 10, v_company_id),
    ('EVENING', 'Evening Shift (2 PM - 11 PM)', '14:00:00', '23:00:00', 10, v_company_id),
    ('NIGHT', 'Night Shift (10 PM - 7 AM)', '22:00:00', '07:00:00', 15, v_company_id),
    ('FLEXIBLE', 'Flexible Shift', '00:00:00', '23:59:59', 0, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_weekoff_rules (code, name, weekdays, company_id) VALUES
    ('SAT_SUN', 'Saturday & Sunday', ARRAY['SATURDAY', 'SUNDAY'], v_company_id),
    ('SUN_ONLY', 'Sunday Only', ARRAY['SUNDAY'], v_company_id),
    ('FRI_SAT', 'Friday & Saturday', ARRAY['FRIDAY', 'SATURDAY'], v_company_id),
    ('ALT_SAT', 'Alternate Saturdays', ARRAY['SUNDAY'], v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_attendance_status (code, name, affects_salary, company_id) VALUES
    ('PRESENT', 'Present', false, v_company_id), ('ABSENT', 'Absent', true, v_company_id),
    ('HALF_DAY', 'Half Day', true, v_company_id), ('ON_LEAVE', 'On Leave', false, v_company_id),
    ('WEEK_OFF', 'Week Off', false, v_company_id), ('HOLIDAY', 'Holiday', false, v_company_id),
    ('WORK_FROM_HOME', 'Work From Home', false, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_punch_rules (code, name, min_work_hours, overtime_threshold_hours, company_id) VALUES
    ('STANDARD', 'Standard 8-hour rule', 8.0, 9.0, v_company_id),
    ('RELAXED', 'Relaxed 7-hour rule', 7.0, 10.0, v_company_id),
    ('STRICT', 'Strict 9-hour rule', 9.0, 10.0, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;

    -- Call accounting seed function!
    PERFORM rpc_seed_accounting_masters(v_company_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_company_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    BEGIN
        DECLARE
            v_setting_text TEXT;
        BEGIN
            v_setting_text := current_setting('app.current_company', true);
            IF v_setting_text IS NOT NULL AND v_setting_text <> '' THEN
                RETURN v_setting_text::UUID;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END;

    DECLARE
        v_company_id UUID;
    BEGIN
        SELECT company_id INTO v_company_id FROM profiles WHERE id = auth.uid();
        RETURN v_company_id;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_post_move(p_move_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_move RECORD;
    v_total_debit NUMERIC;
    v_total_credit NUMERIC;
    v_period_id UUID;
BEGIN
    -- Get Move
    SELECT * INTO v_move FROM accounting_moves WHERE id = p_move_id;
    
    IF v_move.state = 'Posted' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Entry is already posted');
    END IF;

    -- Check Approval for Bills (in_invoice)
    IF v_move.move_type = 'in_invoice' AND v_move.approval_status != 'approved' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bill must be approved before posting');
    END IF;
    
    -- Check Balance
    SELECT SUM(debit), SUM(credit) INTO v_total_debit, v_total_credit
    FROM accounting_move_lines
    WHERE move_id = p_move_id;
    
    IF v_total_debit != v_total_credit THEN
        RETURN jsonb_build_object('success', false, 'message', 'Entry is not balanced (Debits != Credits)');
    END IF;
    
    -- Check Period
    v_period_id := get_period_for_date(v_move.date, v_move.company_id);
    
    IF v_period_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No open accounting period found for this date');
    END IF;
    
    -- Update Move
    UPDATE accounting_moves
    SET 
        state = 'Posted',
        period_id = v_period_id,
        amount_total = v_total_debit -- Store the balanced amount
    WHERE id = p_move_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Journal Entry Posted Successfully');
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_create_accounting_invoice(p_partner_id uuid, p_journal_id uuid, p_date date, p_due_date date, p_move_type text, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_entry_id UUID;
    v_company_id UUID;
    v_line JSONB;
    v_item RECORD;
    v_partner RECORD;
    v_account_id UUID; -- The income/expense account
    v_receivable_payable_account_id UUID; -- The AR/AP account
    v_total_amount NUMERIC := 0;
    v_line_name TEXT;
BEGIN
    v_company_id := get_my_company_id();
    
    -- 1. Get Partner Details & AR/AP Account in the new chart of accounts
    SELECT * INTO v_partner FROM accounting_partners WHERE id = p_partner_id;
    IF p_move_type = 'out_invoice' THEN
        -- Map partner's property_account_receivable_id to new accounting_chart_of_accounts by matching code
        SELECT new_acc.id INTO v_receivable_payable_account_id
        FROM public.accounting_chart_of_accounts new_acc
        JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
        WHERE old_acc.id = v_partner.property_account_receivable_id AND new_acc.company_id = v_company_id;
        
        -- Fallback if not configured or not found
        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id AND subtype = 'Receivable'
            LIMIT 1;
        END IF;
    ELSIF p_move_type = 'in_invoice' THEN
        -- Map partner's property_account_payable_id to new accounting_chart_of_accounts by matching code
        SELECT new_acc.id INTO v_receivable_payable_account_id
        FROM public.accounting_chart_of_accounts new_acc
        JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
        WHERE old_acc.id = v_partner.property_account_payable_id AND new_acc.company_id = v_company_id;
        
        -- Fallback if not configured or not found
        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id AND subtype = 'Payable'
            LIMIT 1;
        END IF;
    END IF;

    IF v_receivable_payable_account_id IS NULL THEN
        RAISE EXCEPTION 'Partner % missing default Receivable/Payable account in the new chart of accounts', v_partner.name;
    END IF;

    -- 2. Create Header (Draft State) in the new accounting_journal_entries
    INSERT INTO public.accounting_journal_entries (
        company_id, journal_id, date, invoice_date, due_date, 
        partner_id, move_type, state, amount_total
    ) VALUES (
        v_company_id, p_journal_id, p_date, p_date, p_due_date,
        p_partner_id, p_move_type, 'Draft', 0
    ) RETURNING id INTO v_entry_id;

    -- 3. Process Lines
    -- Loop through items
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_account_id := NULL;
        v_line_name := NULL;

        -- A. Try to resolve ledger account directly first
        IF p_move_type = 'out_invoice' AND NULLIF(v_line->>'sales_ledger_id', '') IS NOT NULL THEN
            SELECT account_id, name INTO v_account_id, v_line_name
            FROM public.accounting_sales_ledgers
            WHERE id = (v_line->>'sales_ledger_id')::UUID;
        ELSIF p_move_type = 'in_invoice' AND NULLIF(v_line->>'purchase_ledger_id', '') IS NOT NULL THEN
            SELECT account_id, name INTO v_account_id, v_line_name
            FROM public.accounting_purchase_ledgers
            WHERE id = (v_line->>'purchase_ledger_id')::UUID;
        END IF;

        -- B. Fallback to Item matching if not provided or resolved
        IF v_account_id IS NULL AND NULLIF(v_line->>'item_id', '') IS NOT NULL THEN
            SELECT * INTO v_item FROM item_master WHERE id = (v_line->>'item_id')::UUID;
            IF FOUND THEN
                v_line_name := v_item.name;
                IF p_move_type = 'out_invoice' THEN
                    SELECT new_acc.id INTO v_account_id
                    FROM public.accounting_chart_of_accounts new_acc
                    JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
                    WHERE old_acc.id = v_item.income_account_id AND new_acc.company_id = v_company_id;
                ELSIF p_move_type = 'in_invoice' THEN
                    SELECT new_acc.id INTO v_account_id
                    FROM public.accounting_chart_of_accounts new_acc
                    JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
                    WHERE old_acc.id = v_item.expense_account_id AND new_acc.company_id = v_company_id;
                END IF;
            END IF;
        END IF;

        -- C. Absolute fallbacks
        IF v_account_id IS NULL THEN
            IF p_move_type = 'out_invoice' THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND subtype = 'Revenue'
                LIMIT 1;
                v_line_name := COALESCE(v_line_name, 'Sales Line');
            ELSIF p_move_type = 'in_invoice' THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND type = 'Expense'
                ORDER BY code ASC
                LIMIT 1;
                v_line_name := COALESCE(v_line_name, 'Purchase Line');
            END IF;
        END IF;

        IF v_account_id IS NULL THEN 
            RAISE EXCEPTION 'Failed to determine accounting ledger account for line'; 
        END IF;

        -- E. Override description/narration if passed explicitly in JSON line
        IF NULLIF(v_line->>'description', '') IS NOT NULL THEN
            v_line_name := v_line->>'description';
        END IF;
        
        -- D. Insert Journal Line
        IF p_move_type = 'out_invoice' THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name,
                debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id,
                item_id, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_account_id, p_partner_id, v_line_name,
                0, (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric,
                NULLIF(v_line->>'cost_center_id', '')::uuid, 
                NULLIF(v_line->>'project_cost_center_id', '')::uuid, 
                NULLIF(v_line->>'contract_cost_center_id', '')::uuid,
                NULLIF(v_line->>'item_id', '')::uuid,
                COALESCE((v_line->>'quantity')::numeric, 0),
                COALESCE((v_line->>'unit_price')::numeric, 0)
            );
        ELSIF p_move_type = 'in_invoice' THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name,
                debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id,
                item_id, quantity, unit_price
            ) VALUES (
                v_company_id, v_entry_id, v_account_id, p_partner_id, v_line_name,
                (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric, 0,
                NULLIF(v_line->>'cost_center_id', '')::uuid, 
                NULLIF(v_line->>'project_cost_center_id', '')::uuid, 
                NULLIF(v_line->>'contract_cost_center_id', '')::uuid,
                NULLIF(v_line->>'item_id', '')::uuid,
                COALESCE((v_line->>'quantity')::numeric, 0),
                COALESCE((v_line->>'unit_price')::numeric, 0)
            );
        END IF;

        v_total_amount := v_total_amount + ((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric);
    END LOOP;

    -- 4. Create Balancing AR/AP Line in new accounting_journal_lines
    IF p_move_type = 'out_invoice' THEN
        -- Debit AR
        INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 'Invoice/Bill',
            v_total_amount, 0
        );
    ELSIF p_move_type = 'in_invoice' THEN
         -- Credit AP
         INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 'Invoice/Bill',
            0, v_total_amount
        );
    END IF;

    -- Update Total
    UPDATE public.accounting_journal_entries SET amount_total = v_total_amount WHERE id = v_entry_id;

    RETURN v_entry_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_create_invoice(p_partner_id uuid, p_journal_id uuid, p_date date, p_due_date date, p_move_type text, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
        v_sign := 1; 
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
        partner_id, move_type, state, amount_total,
        approval_status
    ) VALUES (
        v_company_id, p_journal_id, p_date, p_date, p_due_date,
        p_partner_id, p_move_type, 'Draft', 0,
        CASE WHEN p_move_type = 'in_invoice' THEN 'pending' ELSE 'approved' END
    ) RETURNING id INTO v_move_id;

    -- 3. Process Lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_item FROM item_master WHERE id = (v_line->>'item_id')::UUID;
        
        IF p_move_type = 'out_invoice' THEN
            v_account_id := v_item.income_account_id;
            IF v_account_id IS NULL THEN RAISE EXCEPTION 'Item % missing Income Account', v_item.name; END IF;
            
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
             
            INSERT INTO accounting_move_lines (
                move_id, journal_id, date, account_id, partner_id, name,
                debit, credit, check_balance
            ) VALUES (
                v_move_id, p_journal_id, p_date, v_account_id, p_partner_id, v_item.name,
                (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric, 0, false
            );
             v_total_amount := v_total_amount + ((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric);
        END IF;
    END LOOP;

    -- 4. Create Balancing AR/AP Line
    IF p_move_type = 'out_invoice' THEN
        INSERT INTO accounting_move_lines (
            move_id, journal_id, date, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_move_id, p_journal_id, p_date, v_receivable_payable_account_id, p_partner_id, 'Invoice/Bill',
            v_total_amount, 0
        );
    ELSIF p_move_type = 'in_invoice' THEN
         INSERT INTO accounting_move_lines (
            move_id, journal_id, date, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_move_id, p_journal_id, p_date, v_receivable_payable_account_id, p_partner_id, 'Invoice/Bill',
            0, v_total_amount
        );
    END IF;

    UPDATE accounting_moves SET amount_total = v_total_amount WHERE id = v_move_id;

    RETURN v_move_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_accounting_account_balance(p_account_id uuid, p_date date)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_balance NUMERIC;
BEGIN
    SELECT COALESCE(SUM(debit - credit), 0) INTO v_balance
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON l.entry_id = e.id
    WHERE l.account_id = p_account_id AND e.date <= p_date AND e.state = 'Posted';
    
    RETURN v_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_job_transition(p_transition_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_transition RECORD;
    v_new_data JSONB;
BEGIN
    SELECT * INTO v_transition FROM employee_job_transitions WHERE id = p_transition_id;
    
    IF v_transition.status != 'APPROVED' THEN
        RETURN FALSE;
    END IF;
    
    v_new_data := v_transition.new_data;
    
    -- Update Employee Master
    -- Note: We use COALESCE to only update fields that are present in the new_data JSON
    -- Casting JSONB values to text/int requires care.
    
    UPDATE employees
    SET 
        designation_id = COALESCE((v_new_data->>'designation_id')::BIGINT, designation_id),
        department_id = COALESCE((v_new_data->>'department_id')::BIGINT, department_id),
        manager_id = COALESCE((v_new_data->>'manager_id')::UUID, manager_id),
        location_id = COALESCE((v_new_data->>'location_id')::BIGINT, location_id),
        employment_type_id = COALESCE((v_new_data->>'employment_type_id')::BIGINT, employment_type_id)
    WHERE id = v_transition.employee_id;
    
    -- Create Timeline Entry
    INSERT INTO employee_career_timeline (
        company_id,
        employee_id,
        event_date,
        event_type,
        title,
        description,
        metadata
    ) VALUES (
        v_transition.company_id,
        v_transition.employee_id,
        v_transition.effective_date,
        v_transition.transition_type,
        CASE 
            WHEN v_transition.transition_type = 'PROMOTION' THEN 'Promoted'
            WHEN v_transition.transition_type = 'TRANSFER' THEN 'Department Transfer'
            ELSE initcap(replace(v_transition.transition_type, '_', ' '))
        END,
        v_transition.reason,
        jsonb_build_object(
            'from', v_transition.current_data,
            'to', v_transition.new_data
        )
    );
    
    -- Update Transition Status
    UPDATE employee_job_transitions
    SET status = 'APPLIED'
    WHERE id = p_transition_id;
    
    RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_update_accounting_invoice(p_entry_id uuid, p_partner_id uuid, p_journal_id uuid, p_date date, p_due_date date, p_lines jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_state TEXT;
    v_line JSONB;
    v_item RECORD;
    v_partner RECORD;
    v_account_id UUID;
    v_receivable_payable_account_id UUID;
    v_total_amount NUMERIC := 0;
    v_line_name TEXT;
    v_move_type TEXT;
BEGIN
    v_company_id := get_my_company_id();
    
    -- Check if entry exists, matches company, and is in Draft state
    SELECT state, move_type INTO v_state, v_move_type 
    FROM public.accounting_journal_entries 
    WHERE id = p_entry_id AND company_id = v_company_id;
    
    IF v_state IS NULL THEN
        RAISE EXCEPTION 'Invoice/Bill not found';
    END IF;
    
    IF v_state != 'Draft' THEN
        RAISE EXCEPTION 'Only Draft entries can be edited';
    END IF;
    
    -- Get Partner Details & AR/AP Account
    SELECT * INTO v_partner FROM accounting_partners WHERE id = p_partner_id;
    IF v_move_type = 'out_invoice' THEN
        SELECT new_acc.id INTO v_receivable_payable_account_id
        FROM public.accounting_chart_of_accounts new_acc
        JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
        WHERE old_acc.id = v_partner.property_account_receivable_id AND new_acc.company_id = v_company_id;
        
        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id AND subtype = 'Receivable'
            LIMIT 1;
        END IF;
    ELSIF v_move_type = 'in_invoice' THEN
        SELECT new_acc.id INTO v_receivable_payable_account_id
        FROM public.accounting_chart_of_accounts new_acc
        JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
        WHERE old_acc.id = v_partner.property_account_payable_id AND new_acc.company_id = v_company_id;
        
        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id AND subtype = 'Payable'
            LIMIT 1;
        END IF;
    END IF;
    
    IF v_receivable_payable_account_id IS NULL THEN
        RAISE EXCEPTION 'Partner % missing default Receivable/Payable account', v_partner.name;
    END IF;
    
    -- Delete existing lines
    DELETE FROM public.accounting_journal_lines WHERE entry_id = p_entry_id;
    
    -- Process and Insert new Lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_account_id := NULL;
        v_line_name := NULL;

        -- Try ledger account directly
        IF v_move_type = 'out_invoice' AND NULLIF(v_line->>'sales_ledger_id', '') IS NOT NULL THEN
            SELECT account_id, name INTO v_account_id, v_line_name
            FROM public.accounting_sales_ledgers
            WHERE id = (v_line->>'sales_ledger_id')::UUID;
        ELSIF v_move_type = 'in_invoice' AND NULLIF(v_line->>'purchase_ledger_id', '') IS NOT NULL THEN
            SELECT account_id, name INTO v_account_id, v_line_name
            FROM public.accounting_purchase_ledgers
            WHERE id = (v_line->>'purchase_ledger_id')::UUID;
        END IF;

        -- Fallback to Item
        IF v_account_id IS NULL AND NULLIF(v_line->>'item_id', '') IS NOT NULL THEN
            SELECT * INTO v_item FROM item_master WHERE id = (v_line->>'item_id')::UUID;
            IF FOUND THEN
                v_line_name := v_item.name;
                IF v_move_type = 'out_invoice' THEN
                    SELECT new_acc.id INTO v_account_id
                    FROM public.accounting_chart_of_accounts new_acc
                    JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
                    WHERE old_acc.id = v_item.income_account_id AND new_acc.company_id = v_company_id;
                ELSIF v_move_type = 'in_invoice' THEN
                    SELECT new_acc.id INTO v_account_id
                    FROM public.accounting_chart_of_accounts new_acc
                    JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
                    WHERE old_acc.id = v_item.expense_account_id AND new_acc.company_id = v_company_id;
                END IF;
            END IF;
        END IF;

        -- Fallbacks
        IF v_account_id IS NULL THEN
            IF v_move_type = 'out_invoice' THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND subtype = 'Revenue'
                LIMIT 1;
                v_line_name := COALESCE(v_line_name, 'Sales Line');
            ELSIF v_move_type = 'in_invoice' THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND type = 'Expense'
                ORDER BY code ASC
                LIMIT 1;
                v_line_name := COALESCE(v_line_name, 'Purchase Line');
            END IF;
        END IF;

        IF v_account_id IS NULL THEN 
            RAISE EXCEPTION 'Failed to determine accounting ledger account for line'; 
        END IF;

        -- Narration override
        IF NULLIF(v_line->>'description', '') IS NOT NULL THEN
            v_line_name := v_line->>'description';
        END IF;
        
        -- Insert Journal Line
        IF v_move_type = 'out_invoice' THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name,
                debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id,
                item_id, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_account_id, p_partner_id, v_line_name,
                0, (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric,
                NULLIF(v_line->>'cost_center_id', '')::uuid, 
                NULLIF(v_line->>'project_cost_center_id', '')::uuid, 
                NULLIF(v_line->>'contract_cost_center_id', '')::uuid,
                NULLIF(v_line->>'item_id', '')::uuid,
                COALESCE((v_line->>'quantity')::numeric, 0),
                COALESCE((v_line->>'unit_price')::numeric, 0)
            );
        ELSIF v_move_type = 'in_invoice' THEN
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name,
                debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id,
                item_id, quantity, unit_price
            ) VALUES (
                v_company_id, p_entry_id, v_account_id, p_partner_id, v_line_name,
                (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric, 0,
                NULLIF(v_line->>'cost_center_id', '')::uuid, 
                NULLIF(v_line->>'project_cost_center_id', '')::uuid, 
                NULLIF(v_line->>'contract_cost_center_id', '')::uuid,
                NULLIF(v_line->>'item_id', '')::uuid,
                COALESCE((v_line->>'quantity')::numeric, 0),
                COALESCE((v_line->>'unit_price')::numeric, 0)
            );
        END IF;

        v_total_amount := v_total_amount + ((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric);
    END LOOP;

    -- Balancing Line
    IF v_move_type = 'out_invoice' THEN
        INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, 'Invoice/Bill',
            v_total_amount, 0
        );
    ELSIF v_move_type = 'in_invoice' THEN
         INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_company_id, p_entry_id, v_receivable_payable_account_id, p_partner_id, 'Invoice/Bill',
            0, v_total_amount
        );
    END IF;

    -- Update Header
    UPDATE public.accounting_journal_entries 
    SET partner_id = p_partner_id,
        journal_id = p_journal_id,
        date = p_date,
        invoice_date = p_date,
        due_date = p_due_date,
        amount_total = v_total_amount
    WHERE id = p_entry_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_run_leave_accrual(p_company_id uuid, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_rule RECORD;
    v_emp RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_rule IN
        SELECT * FROM leave_accrual_rules WHERE company_id = p_company_id AND is_active = true
    LOOP
        FOR v_emp IN
            SELECT id FROM employees WHERE company_id = p_company_id AND status = 'Active'
        LOOP
            INSERT INTO leave_balances (company_id, employee_id, leave_type_id, year, accrued)
            VALUES (p_company_id, v_emp.id, v_rule.leave_type_id, p_year, v_rule.accrual_amount)
            ON CONFLICT (company_id, employee_id, leave_type_id, year)
            DO UPDATE SET accrued = leave_balances.accrued + v_rule.accrual_amount,
                         updated_at = now();
            v_count := v_count + 1;
        END LOOP;
    END LOOP;
    RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_fix_my_access()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID;
BEGIN
    SELECT company_id INTO v_company_id FROM profiles WHERE id = v_user_id;
    IF v_company_id IS NULL THEN
        RETURN 'Error: No profile found or no company linked in profile.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM companies WHERE id = v_company_id) THEN
        RETURN 'Error: Linked company does not exist in database.';
    END IF;
    INSERT INTO user_company_access (user_id, company_id, is_default, status)
    VALUES (v_user_id, v_company_id, true, 'active')
    ON CONFLICT (user_id, company_id) 
    DO UPDATE SET status = 'active';
    UPDATE companies SET status = 'active' WHERE id = v_company_id AND (status IS NULL OR status != 'active');
    RETURN 'Success: Access repaired. Please reload.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_finance_dashboard_summary(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_receivables NUMERIC := 0;
    v_payables NUMERIC := 0;
    v_bank NUMERIC := 0;
    v_revenue NUMERIC := 0;
    v_expenses NUMERIC := 0;
BEGIN
    -- Receivables (Out invoices where state is Posted)
    SELECT COALESCE(SUM(amount_residual), 0) INTO v_receivables 
    FROM public.accounting_journal_entries 
    WHERE company_id = p_company_id 
      AND move_type = 'out_invoice' 
      AND state = 'Posted';

    -- Payables (In invoices where state is Posted)
    SELECT COALESCE(SUM(amount_residual), 0) INTO v_payables 
    FROM public.accounting_journal_entries 
    WHERE company_id = p_company_id 
      AND move_type = 'in_invoice' 
      AND state = 'Posted';
    
    -- Bank/Cash balance (Debit - Credit)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_bank 
    FROM public.accounting_journal_lines l 
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id 
    JOIN public.accounting_journal_entries m ON m.id = l.entry_id 
    WHERE m.company_id = p_company_id 
      AND m.state = 'Posted' 
      AND a.type = 'Asset' 
      AND a.subtype IN ('Bank', 'Cash');
    
    -- Revenue for Current Year (Income type)
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_revenue 
    FROM public.accounting_journal_lines l 
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id 
    JOIN public.accounting_journal_entries m ON m.id = l.entry_id 
    WHERE m.company_id = p_company_id 
      AND m.state = 'Posted' 
      AND a.type = 'Income' 
      AND EXTRACT(YEAR FROM m.date) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Expenses for Current Year (Expense type)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_expenses 
    FROM public.accounting_journal_lines l 
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id 
    JOIN public.accounting_journal_entries m ON m.id = l.entry_id 
    WHERE m.company_id = p_company_id 
      AND m.state = 'Posted' 
      AND a.type = 'Expense' 
      AND EXTRACT(YEAR FROM m.date) = EXTRACT(YEAR FROM CURRENT_DATE);

    RETURN jsonb_build_object(
        'receivables', v_receivables,
        'payables', v_payables,
        'bank_balance', v_bank,
        'revenue', v_revenue,
        'expenses', v_expenses,
        'net_profit', v_revenue - v_expenses
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_ship_sales_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_cid UUID := get_my_company_id();
BEGIN
  UPDATE sales_order_lines SET quantity_delivered=quantity WHERE order_id=p_order_id AND company_id=v_cid;
  UPDATE sales_orders SET state='shipped' WHERE id=p_order_id AND company_id=v_cid AND state='confirmed';
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','Order not confirmed.'); END IF;
  RETURN jsonb_build_object('success',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'message',SQLERRM);
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_ar_aging(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_now DATE := CURRENT_DATE;
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'current', COALESCE(SUM(CASE WHEN due_date >= v_now THEN amount_residual ELSE 0 END), 0),
            'days_1_30', COALESCE(SUM(CASE WHEN v_now - due_date BETWEEN 1 AND 30 THEN amount_residual ELSE 0 END), 0),
            'days_31_60', COALESCE(SUM(CASE WHEN v_now - due_date BETWEEN 31 AND 60 THEN amount_residual ELSE 0 END), 0),
            'days_61_90', COALESCE(SUM(CASE WHEN v_now - due_date BETWEEN 61 AND 90 THEN amount_residual ELSE 0 END), 0),
            'days_over_90', COALESCE(SUM(CASE WHEN v_now - due_date > 90 THEN amount_residual ELSE 0 END), 0),
            'total', COALESCE(SUM(amount_residual), 0)
        )
        FROM public.accounting_journal_entries
        WHERE company_id = p_company_id 
          AND move_type = 'out_invoice' 
          AND state = 'Posted' 
          AND amount_residual > 0
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_stock_movement_trend(p_company_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN COALESCE(
        (SELECT json_agg(row_to_json(t))
         FROM (
             SELECT 
                 to_char(date_trunc('day', created_at), 'DD Mon') as date,
                 SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END) as in_qty,
                 SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END) as out_qty
             FROM stock_movements
             WHERE company_id = p_company_id AND created_at >= CURRENT_DATE - interval '30 days'
             GROUP BY date_trunc('day', created_at)
             ORDER BY date_trunc('day', created_at)
         ) t),
        '[]'::json
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_start_resignation_workflow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_workflow_id UUID;
BEGIN
    SELECT id INTO v_workflow_id FROM workflows 
    WHERE (module = 'Resignation' OR module = 'Exit') 
      AND company_id = NEW.company_id 
      AND is_active = true 
    LIMIT 1;

    IF v_workflow_id IS NOT NULL THEN
        PERFORM rpc_submit_workflow_request(v_workflow_id, NEW.id::text, NEW.employee_id);
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_my_approvals(p_user_id uuid)
 RETURNS TABLE(request_id uuid, workflow_name text, module text, source_id text, status text, requester_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        wr.id AS request_id,
        w.name AS workflow_name,
        w.module,
        wr.source_id,
        wr.status,
        p.full_name AS requester_name,
        wr.created_at
    FROM workflow_requests wr
    JOIN workflows w ON wr.workflow_id = w.id
    JOIN workflow_levels wl ON w.id = wl.workflow_id AND wr.current_step = wl.level_order
    JOIN profiles p ON wr.requester_id = p.id
    WHERE wr.status = 'PENDING'
      AND (
          -- 1. Direct User Assignment
          (wl.approver_type = 'USER' AND p_user_id::text = ANY(wl.approver_ids))
          OR
          -- 2. Role Assignment
          (wl.approver_type = 'ROLE' AND EXISTS (
              SELECT 1 FROM profiles up 
              WHERE up.id = p_user_id AND up.role = ANY(wl.approver_ids)
          ))
          OR
          -- 3. Reporting Manager (Dynamic)
          (wl.approver_type = 'MANAGER' AND EXISTS (
               SELECT 1 FROM employees requester_emp 
               WHERE requester_emp.profile_id = p.id -- requester's employee record
                 AND requester_emp.manager_id = (
                     SELECT cur_emp.id FROM employees cur_emp WHERE cur_emp.profile_id = p_user_id LIMIT 1
                 )
          ))
      );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_start_leave_workflow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_workflow_id UUID;
BEGIN
    -- Attempt to find a workflow for 'Leaves'
    SELECT id INTO v_workflow_id FROM workflows 
    WHERE (module = 'Leaves' OR module = 'HRMS') 
      AND company_id = NEW.company_id 
      AND is_active = true 
    LIMIT 1;

    IF v_workflow_id IS NOT NULL THEN
        PERFORM rpc_submit_workflow_request(v_workflow_id, NEW.id::text, NEW.employee_id);
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_invoice_sales_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_cid UUID := get_my_company_id(); v_so RECORD;
BEGIN
  SELECT * INTO v_so FROM sales_orders WHERE id=p_order_id AND company_id=v_cid AND state='shipped';
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','Order must be shipped first.'); END IF;
  UPDATE sales_orders SET state='invoiced' WHERE id=p_order_id AND company_id=v_cid;
  RETURN jsonb_build_object('success',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'message',SQLERRM);
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_process_stock_movement(p_company_id uuid, p_item_id uuid, p_movement_type text, p_from_bin_id uuid, p_to_bin_id uuid, p_qty numeric, p_ref_type text, p_ref_id uuid, p_unit_cost numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_warehouse_id UUID;
    v_inv_txn_id UUID;
    v_total_value NUMERIC;
    v_acct_config RECORD;
BEGIN
    -- Validate Bins & Get Warehouse
    -- Fetch Warehouse ID from Bin
    IF p_to_bin_id IS NOT NULL THEN
        SELECT warehouse_id INTO v_warehouse_id 
        FROM warehouse_zones z JOIN warehouse_bins b ON b.zone_id = z.id 
        WHERE b.id = p_to_bin_id;
    ELSIF p_from_bin_id IS NOT NULL THEN
        SELECT warehouse_id INTO v_warehouse_id 
        FROM warehouse_zones z JOIN warehouse_bins b ON b.zone_id = z.id 
        WHERE b.id = p_from_bin_id;
    END IF;

    -- 1. Log Physical Movement
    INSERT INTO stock_movements (
        company_id, item_id, movement_type, from_bin_id, to_bin_id, quantity, reference_type, reference_id, performed_by
    ) VALUES (
        p_company_id, p_item_id, p_movement_type, p_from_bin_id, p_to_bin_id, p_qty, p_ref_type, p_ref_id, auth.uid()
    );

    -- 2. Inventory Transaction & Accounting
    -- Only for IN (GRN/Return) or OUT (Ship/Usage). TRANSFER (Bin-Bin) has no value impact.
    
    -- Get Account Config
    SELECT * INTO v_acct_config FROM inventory_account_config WHERE company_id = p_company_id LIMIT 1;
    
    IF p_movement_type = 'IN' THEN
        -- Increase Stock
        INSERT INTO inventory_transactions (
            company_id, item_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            p_company_id, p_item_id, v_warehouse_id, 'GRN', p_qty, p_unit_cost, p_ref_type, p_ref_id
        ) RETURNING id INTO v_inv_txn_id;
        
        -- Accounting: Dr Inventory, Cr GRNI
        IF found AND v_acct_config IS NOT NULL THEN
             INSERT INTO accounting_entries (
                company_id, transaction_date, reference_type, reference_id,
                debit_account, credit_account, amount, description
            ) VALUES (
                p_company_id, CURRENT_DATE, 'INV_TXN', v_inv_txn_id,
                v_acct_config.inventory_asset_account, v_acct_config.grni_account,
                (p_qty * p_unit_cost), 'Goods Receipt - ' || p_ref_type
            );
        END IF;

    ELSIF p_movement_type = 'OUT' THEN
        -- Decrease Stock
        -- Note: Costing for OUT is simplified here. In prod, need FIFO/Avg engine.
        -- Assuming p_unit_cost is passed (e.g. Current Avg Cost).
        
        INSERT INTO inventory_transactions (
            company_id, item_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id
        ) VALUES (
            p_company_id, p_item_id, v_warehouse_id, 'ISSUE', -p_qty, p_unit_cost, p_ref_type, p_ref_id
        ) RETURNING id INTO v_inv_txn_id;

        -- Accounting: Dr COGS, Cr Inventory
        IF found AND v_acct_config IS NOT NULL THEN
             INSERT INTO accounting_entries (
                company_id, transaction_date, reference_type, reference_id,
                debit_account, credit_account, amount, description
            ) VALUES (
                p_company_id, CURRENT_DATE, 'INV_TXN', v_inv_txn_id,
                v_acct_config.cogs_account, v_acct_config.inventory_asset_account,
                (p_qty * p_unit_cost), 'Stock Issue - ' || p_ref_type
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_create_production_order(p_product_id uuid, p_bom_id uuid, p_quantity numeric, p_date_planned date, p_work_center_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_company_id UUID := get_my_company_id();
  v_order_id   UUID;
  v_order_name TEXT;
  v_bom_line   RECORD;
BEGIN
  -- Generate order name
  SELECT 'MO-' || LPAD(COALESCE((SELECT COUNT(*) FROM mrp_production_orders WHERE company_id = v_company_id), 0) + 1, 5, '0') INTO v_order_name;

  -- Insert production order
  INSERT INTO mrp_production_orders (company_id, name, product_id, bom_id, quantity_to_produce, date_planned, work_center_id, state, notes)
  VALUES (v_company_id, v_order_name, p_product_id, p_bom_id, p_quantity, p_date_planned, p_work_center_id, 'draft', p_notes)
  RETURNING id INTO v_order_id;

  -- Explode BOM → create component demand moves
  FOR v_bom_line IN
    SELECT bl.item_id, bl.quantity, bl.uom
    FROM mrp_bom_lines bl
    WHERE bl.bom_id = p_bom_id AND bl.company_id = v_company_id
  LOOP
    INSERT INTO mrp_production_moves (company_id, production_order_id, item_id, move_type, quantity_demand, quantity_done)
    VALUES (v_company_id, v_order_id, v_bom_line.item_id, 'consume', v_bom_line.quantity * p_quantity, 0);
  END LOOP;

  -- Create finished goods move
  INSERT INTO mrp_production_moves (company_id, production_order_id, item_id, move_type, quantity_demand, quantity_done)
  VALUES (v_company_id, v_order_id, p_product_id, 'produce', p_quantity, 0);

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'order_name', v_order_name);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_confirm_production_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_company_id UUID := get_my_company_id();
BEGIN
  UPDATE mrp_production_orders
  SET state = 'confirmed', date_start = NOW()
  WHERE id = p_order_id AND company_id = v_company_id AND state = 'draft';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found or already confirmed.');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_start_production_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_company_id UUID := get_my_company_id();
BEGIN
  UPDATE mrp_production_orders
  SET state = 'in_progress'
  WHERE id = p_order_id AND company_id = v_company_id AND state = 'confirmed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not in confirmed state.');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_complete_production(p_order_id uuid, p_qty_produced numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_company_id UUID := get_my_company_id();
  v_order      RECORD;
  v_qty        NUMERIC;
BEGIN
  SELECT * INTO v_order FROM mrp_production_orders
  WHERE id = p_order_id AND company_id = v_company_id AND state IN ('confirmed','in_progress');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found or not in producible state.');
  END IF;

  v_qty := COALESCE(p_qty_produced, v_order.quantity_to_produce);

  -- Update moves with done quantities
  UPDATE mrp_production_moves
  SET quantity_done = quantity_demand
  WHERE production_order_id = p_order_id AND company_id = v_company_id;

  -- Mark order as done
  UPDATE mrp_production_orders
  SET state = 'done', quantity_produced = v_qty, date_finished = NOW()
  WHERE id = p_order_id AND company_id = v_company_id;

  RETURN jsonb_build_object('success', true, 'qty_produced', v_qty);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_cancel_production_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_company_id UUID := get_my_company_id();
BEGIN
  UPDATE mrp_production_orders
  SET state = 'cancelled'
  WHERE id = p_order_id AND company_id = v_company_id AND state NOT IN ('done','cancelled');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order cannot be cancelled.');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_cancel_sales_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_cid UUID := get_my_company_id();
BEGIN
  UPDATE sales_orders SET state='cancelled' WHERE id=p_order_id AND company_id=v_cid AND state NOT IN ('invoiced','shipped','cancelled');
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','Cannot cancel.'); END IF;
  RETURN jsonb_build_object('success',true);
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_seed_vat_demo_data(p_target_company_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_acc_rec_id UUID;
    v_acc_pay_id UUID;
    v_input_vat_id UUID;
    v_output_vat_id UUID;
    v_sales_id UUID;
    v_purchases_id UUID;
    v_bank_id UUID;
    
    v_tax_sale_5 UUID;
    v_tax_purch_5 UUID;
    v_tax_sale_0 UUID;
    v_tax_purch_0 UUID;
    v_tax_sale_ex UUID;
    v_tax_purch_ex UUID;
    
    v_journal_sale UUID;
    v_journal_purch UUID;
    
    v_move_id UUID;
    v_moves_created INT := 0;
    v_date DATE;
BEGIN
    -- Determine company_id: prioritizes p_target_company_id, then get_my_company_id(), falls back to Power Engineering Corp
    IF p_target_company_id IS NOT NULL THEN
        v_company_id := p_target_company_id;
    ELSE
        v_company_id := get_my_company_id();
        IF v_company_id IS NULL THEN
            v_company_id := '0c0b0d78-4531-412e-8fa3-bbc74b7145ae'; -- Power Engineering Corporation
        END IF;
    END IF;

    -- Safety check: Ensure no posted accounting moves exist for this company
    IF EXISTS (
        SELECT 1 FROM accounting_moves 
        WHERE company_id = v_company_id 
          AND state = 'Posted'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Demo seeding aborted: Company already has posted accounting entries in the database.'
        );
    END IF;

    -- --------------------------------------------------------------------------
    -- 1. Provision standard Accounts in Chart of Accounts
    -- --------------------------------------------------------------------------
    
    -- Accounts Receivable (Asset)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '110000', 'Accounts Receivable', 'Asset', 'Receivable', true, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_acc_rec_id;

    -- Main Bank Account (Asset)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '100100', 'Main Bank Account', 'Asset', 'Bank', true, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_bank_id;

    -- Input VAT Receivable (Asset)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '120300', 'Input VAT Receivable', 'Asset', 'Other', false, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_input_vat_id;

    -- Accounts Payable (Liability)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '210000', 'Accounts Payable', 'Liability', 'Payable', true, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_acc_pay_id;

    -- Output VAT Payable (Liability)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '220300', 'Output VAT Payable', 'Liability', 'Other', false, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_output_vat_id;

    -- Product Sales Revenue (Income)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '400000', 'Product Sales Revenue', 'Income', 'Revenue', false, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_sales_id;

    -- Purchases / Cost of Goods Sold (Expense)
    INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, is_reconcilable, is_active)
    VALUES (v_company_id, '500000', 'Cost of Goods Sold / Purchases', 'Expense', 'COGS', false, true)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_purchases_id;

    -- --------------------------------------------------------------------------
    -- 2. Provision standard VAT Tax Codes
    -- --------------------------------------------------------------------------
    
    -- VAT 5% (Standard Sales)
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT 5% (Standard Sales)', 'Percent', 'sale', 5.0, v_output_vat_id, true)
    RETURNING id INTO v_tax_sale_5;

    -- VAT 5% (Standard Purchases)
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT 5% (Standard Purchases)', 'Percent', 'purchase', 5.0, v_input_vat_id, true)
    RETURNING id INTO v_tax_purch_5;

    -- VAT 0% (Zero-Rated Sales)
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT 0% (Zero-Rated Sales)', 'Percent', 'sale', 0.0, NULL, true)
    RETURNING id INTO v_tax_sale_0;

    -- VAT 0% (Zero-Rated Purchases)
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT 0% (Zero-Rated Purchases)', 'Percent', 'purchase', 0.0, NULL, true)
    RETURNING id INTO v_tax_purch_0;

    -- VAT Exempt Sales
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT Exempt Sales', 'Percent', 'sale', 0.0, NULL, true)
    RETURNING id INTO v_tax_sale_ex;

    -- VAT Exempt Purchases
    INSERT INTO taxes (company_id, name, type, scope, amount, account_id, is_active)
    VALUES (v_company_id, 'VAT Exempt Purchases', 'Percent', 'purchase', 0.0, NULL, true)
    RETURNING id INTO v_tax_purch_ex;

    -- --------------------------------------------------------------------------
    -- 3. Provision standard Journals
    -- --------------------------------------------------------------------------
    
    INSERT INTO journals (company_id, name, code, type, default_account_id)
    VALUES (v_company_id, 'Customer Invoices', 'INV', 'Sale', v_acc_rec_id)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_journal_sale;

    INSERT INTO journals (company_id, name, code, type, default_account_id)
    VALUES (v_company_id, 'Vendor Bills', 'BILL', 'Purchase', v_acc_pay_id)
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_journal_purch;

    -- --------------------------------------------------------------------------
    -- 4. Seed realistic transactions for VAT visual validation
    -- --------------------------------------------------------------------------
    
    v_date := CURRENT_DATE;

    -- Transaction A: Standard Sale (QAR 10,000 Base, QAR 500 VAT)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_sale, v_date - 15, 'INV/2026/001', 'Sale to Doha Trading Co.', 'Posted', 10500)
    RETURNING id INTO v_move_id;
    
    -- Debit Receivables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 15, v_acc_rec_id, 'Receivable - Doha Trading Co.', 10500, 0);
    
    -- Credit Income
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 15, v_sales_id, 'Standard Product Sales', 0, 10000);
    
    -- Credit Tax
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 15, v_output_vat_id, 'VAT 5% Sales', 0, 500, v_tax_sale_5);
    
    v_moves_created := v_moves_created + 1;


    -- Transaction B: Zero-Rated Export Sale (QAR 5,000 Base)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_sale, v_date - 10, 'INV/2026/002', 'Export Sale to Riyadh Ent.', 'Posted', 5000)
    RETURNING id INTO v_move_id;
    
    -- Debit Receivables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 10, v_acc_rec_id, 'Receivable - Riyadh Ent.', 5000, 0);
    
    -- Credit Income
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 10, v_sales_id, 'Zero-Rated Export Sales', 0, 5000);
    
    -- Tax reference line (Credit 0)
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 10, v_output_vat_id, 'VAT 0% Zero-Rated Sales Link', 0, 0, v_tax_sale_0);

    v_moves_created := v_moves_created + 1;


    -- Transaction C: Exempt Medical Services Sale (QAR 3,000 Base)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_sale, v_date - 5, 'INV/2026/003', 'Exempt Sale to Qatar Health', 'Posted', 3000)
    RETURNING id INTO v_move_id;
    
    -- Debit Receivables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 5, v_acc_rec_id, 'Receivable - Qatar Health', 3000, 0);
    
    -- Credit Income
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 5, v_sales_id, 'Exempt Local Services Sales', 0, 3000);
    
    -- Tax reference line (Credit 0)
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_sale, v_date - 5, v_output_vat_id, 'VAT Exempt Sales Link', 0, 0, v_tax_sale_ex);

    v_moves_created := v_moves_created + 1;


    -- Transaction D: Standard Purchase / Supplies (QAR 6,000 Base, QAR 300 VAT)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_purch, v_date - 12, 'BILL/2026/001', 'Supplies from Qatar Steel', 'Posted', 6300)
    RETURNING id INTO v_move_id;
    
    -- Credit Payables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 12, v_acc_pay_id, 'Payable - Qatar Steel', 0, 6300);
    
    -- Debit Expenses
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 12, v_purchases_id, 'Standard Rated Raw Materials', 6000, 0);
    
    -- Debit Tax
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 12, v_input_vat_id, 'VAT 5% Purchases', 300, 0, v_tax_purch_5);

    v_moves_created := v_moves_created + 1;


    -- Transaction E: Zero-Rated Import Purchase (QAR 2,500 Base)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_purch, v_date - 8, 'BILL/2026/002', 'Imported Tools from Global Tech', 'Posted', 2500)
    RETURNING id INTO v_move_id;
    
    -- Credit Payables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 8, v_acc_pay_id, 'Payable - Global Tech', 0, 2500);
    
    -- Debit Expenses
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 8, v_purchases_id, 'Zero-Rated Imported Supplies', 2500, 0);
    
    -- Tax reference line (Debit 0)
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 8, v_input_vat_id, 'VAT 0% Zero-Rated Purchases Link', 0, 0, v_tax_purch_0);

    v_moves_created := v_moves_created + 1;


    -- Transaction F: Exempt Financial Services Purchase (QAR 1,500 Base)
    INSERT INTO accounting_moves (company_id, journal_id, date, reference, notes, state, amount_total)
    VALUES (v_company_id, v_journal_purch, v_date - 4, 'BILL/2026/003', 'Exempt Services from QNB', 'Posted', 1500)
    RETURNING id INTO v_move_id;
    
    -- Credit Payables
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 4, v_acc_pay_id, 'Payable - QNB', 0, 1500);
    
    -- Debit Expenses
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 4, v_purchases_id, 'Exempt Financial Service Fees', 1500, 0);
    
    -- Tax reference line (Debit 0)
    INSERT INTO accounting_move_lines (company_id, move_id, journal_id, date, account_id, name, debit, credit, tax_line_id)
    VALUES (v_company_id, v_move_id, v_journal_purch, v_date - 4, v_input_vat_id, 'VAT Exempt Purchases Link', 0, 0, v_tax_purch_ex);

    v_moves_created := v_moves_created + 1;


    RETURN jsonb_build_object(
        'success', true,
        'message', format('Successfully provisioned accounts, taxes, journals, and seeded %s posted double-entry moves.', v_moves_created)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_database_schema_info()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT json_build_object(
    'tables', (
      SELECT json_agg(table_name)
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ),
    'foreign_keys', (
      SELECT json_agg(json_build_object('child', tc.table_name, 'parent', ccu.table_name))
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.submit_job_transition(p_employee_id uuid, p_transition_type text, p_current_data jsonb, p_new_data jsonb, p_effective_date date, p_reason text, p_remarks text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_transition_id UUID;
    v_company_id UUID;
BEGIN
    -- Get Company ID
    SELECT company_id INTO v_company_id FROM employees WHERE id = p_employee_id;
    
    INSERT INTO employee_job_transitions (
        company_id,
        employee_id,
        transition_type,
        current_data,
        new_data,
        effective_date,
        reason,
        remarks,
        requester_id,
        status
    ) VALUES (
        v_company_id,
        p_employee_id,
        p_transition_type,
        p_current_data,
        p_new_data,
        p_effective_date,
        p_reason,
        p_remarks,
        (SELECT id FROM employees WHERE profile_id = auth.uid() LIMIT 1),
        'PENDING'
    ) RETURNING id INTO v_transition_id;
    
    RETURN v_transition_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_job_transition(p_transition_id uuid, p_approver_notes text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE employee_job_transitions
    SET 
        status = 'APPROVED',
        approver_id = (SELECT id FROM employees WHERE profile_id = auth.uid() LIMIT 1),
        approval_date = now(),
        remarks = COALESCE(remarks, '') || E'\nApprover Note: ' || p_approver_notes
    WHERE id = p_transition_id AND status = 'PENDING';
    
    RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = (select auth.uid());
  RETURN v_company_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_user_companies()
 RETURNS TABLE(company_id uuid, company_name text, company_code text, group_name text, role_name text, is_default boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.code,
        g.name,
        r.name,
        uca.is_default
    FROM 
        user_company_access uca
    JOIN companies c ON c.id = uca.company_id
    LEFT JOIN group_companies g ON g.id = c.group_company_id
    LEFT JOIN roles r ON r.id = uca.role_id
    WHERE 
        uca.user_id = auth.uid() 
        AND uca.status = 'active'
        AND c.status = 'active';
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_find_putaway_bin(p_item_id uuid, p_warehouse_id uuid, p_qty numeric DEFAULT 1)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_storage_category_id UUID;
    v_target_bin_id UUID;
    v_rule RECORD;
BEGIN
    SELECT storage_category_id INTO v_storage_category_id
    FROM item_master
    WHERE id = p_item_id;

    FOR v_rule IN
        SELECT target_zone_id
        FROM putaway_rules
        WHERE warehouse_id = p_warehouse_id
        AND (storage_category_id = v_storage_category_id OR storage_category_id IS NULL)
        AND is_active = true
        ORDER BY priority ASC
    LOOP
        SELECT id INTO v_target_bin_id
        FROM warehouse_bins
        WHERE zone_id = v_rule.target_zone_id
        AND is_active = true
        LIMIT 1;

        IF v_target_bin_id IS NOT NULL THEN
            RETURN v_target_bin_id;
        END IF;
    END LOOP;

    SELECT b.id INTO v_target_bin_id
    FROM warehouse_bins b
    JOIN warehouse_zones z ON b.zone_id = z.id
    WHERE z.warehouse_id = p_warehouse_id
    AND z.zone_type = 'STORAGE'
    LIMIT 1;

    IF v_target_bin_id IS NULL THEN
        SELECT b.id INTO v_target_bin_id
        FROM warehouse_bins b
        JOIN warehouse_zones z ON b.zone_id = z.id
        WHERE z.warehouse_id = p_warehouse_id
        LIMIT 1;
    END IF;

    RETURN v_target_bin_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_inventory_dashboard_summary(p_company_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_stock_value NUMERIC := 0;
    v_reserved NUMERIC := 0;
    v_scrap NUMERIC := 0;
    v_low_stock_items INT := 0;
BEGIN
    -- Value
    SELECT COALESCE(SUM(total_value), 0) INTO v_stock_value
    FROM inventory_transactions
    WHERE company_id = p_company_id;

    -- Reserved
    SELECT COALESCE(SUM(reserved_qty), 0) INTO v_reserved
    FROM inventory_reservations
    WHERE company_id = p_company_id AND status = 'Active';

    -- Low Stock
    SELECT COUNT(*) INTO v_low_stock_items
    FROM (
        SELECT sm.item_id, SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE -sm.quantity END) AS net_qty
        FROM stock_movements sm
        WHERE sm.company_id = p_company_id
        GROUP BY sm.item_id
    ) inventory
    JOIN item_master im ON inventory.item_id = im.id
    WHERE inventory.net_qty <= COALESCE(im.reorder_level, 10);

    -- Scrap
    SELECT COALESCE(SUM(quantity), 0) INTO v_scrap
    FROM stock_movements
    WHERE company_id = p_company_id AND movement_type = 'SCRAP';

    RETURN json_build_object(
        'stockValue', v_stock_value,
        'lowStock', v_low_stock_items,
        'reserved', v_reserved,
        'scrap', v_scrap
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_inventory_valuation(p_company_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_valuation json;
BEGIN
    SELECT json_agg(t) INTO v_valuation
    FROM (
        SELECT 
            i.code,
            i.name,
            i.category,
            COALESCE(SUM(t.quantity), 0) as quantity_on_hand,
            COALESCE(AVG(t.unit_cost), 0) as avg_unit_cost,
            COALESCE(SUM(t.total_value), 0) as total_value
        FROM item_master i
        LEFT JOIN inventory_transactions t ON i.id = t.item_id
        WHERE i.company_id = p_company_id
        GROUP BY i.id, i.code, i.name, i.category
        HAVING COALESCE(SUM(t.quantity), 0) != 0 OR COALESCE(SUM(t.total_value), 0) != 0
    ) t;

    RETURN COALESCE(v_valuation, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_punch_action(p_employee_id uuid, p_company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_active_record_id UUID;
    v_current_status TEXT;
BEGIN
    -- Check for an open session (checked in but not checked out) for today
    SELECT id INTO v_active_record_id
    FROM attendance
    WHERE employee_id = p_employee_id
      AND date = v_today
      AND check_out IS NULL
    LIMIT 1;

    IF v_active_record_id IS NOT NULL THEN
        -- CLOCK OUT
        UPDATE attendance
        SET check_out = NOW(),
            total_hours = ROUND(EXTRACT(EPOCH FROM (NOW() - check_in))::numeric / 3600, 2)
        WHERE id = v_active_record_id;
        
        RETURN 'OUT';
    ELSE
        -- CLOCK IN
        INSERT INTO attendance (company_id, employee_id, date, check_in, status)
        VALUES (p_company_id, p_employee_id, v_today, NOW(), 'Present');
        
        RETURN 'IN';
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_mark_all_present(p_date date, p_company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Insert for employees who don't have a record for p_date
    WITH active_employees AS (
        SELECT id FROM employees
        WHERE company_id = p_company_id 
          AND status = 'Active'
    ),
    missing_attendance AS (
        SELECT ae.id 
        FROM active_employees ae
        WHERE NOT EXISTS (
            SELECT 1 FROM attendance a 
            WHERE a.employee_id = ae.id 
              AND a.date = p_date
        )
    )
    INSERT INTO attendance (company_id, employee_id, date, check_in, check_out, status, total_hours)
    SELECT 
        p_company_id,
        id,
        p_date,
        (p_date || ' 09:00:00')::TIMESTAMP WITH TIME ZONE, -- Default 9 AM
        (p_date || ' 18:00:00')::TIMESTAMP WITH TIME ZONE, -- Default 6 PM
        'Present',
        9.0
    FROM missing_attendance;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN 'Marked ' || v_count || ' employees as Present.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_leave_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_days INTEGER;
    v_leave_type TEXT;
BEGIN
    -- Only proceed if status changed to Approved
    IF NEW.status = 'Approved' AND OLD.status != 'Approved' THEN
        
        -- simple calc: include start and end date
        v_days := (NEW.end_date - NEW.start_date) + 1;
        v_leave_type := LOWER(NEW.type); -- assuming 'casual', 'sick', 'privilege'

        -- Validate positive days
        IF v_days <= 0 THEN v_days := 1; END IF;

        -- Update Employee Balance
        -- Note: This assumes leave_balance is JSONB like {"casual": 10, ...}
        UPDATE employees
        SET leave_balance = jsonb_set(
            leave_balance,
            ARRAY[v_leave_type], 
            (COALESCE((leave_balance->>v_leave_type)::int, 0) - v_days)::text::jsonb
        )
        WHERE id = NEW.employee_id;
        
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_submit_workflow_request(p_workflow_id uuid, p_source_id text, p_requester_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_req_id UUID;
    v_company_id UUID;
BEGIN
    SELECT company_id INTO v_company_id FROM workflows WHERE id = p_workflow_id;

    INSERT INTO workflow_requests (
        workflow_id, source_id, current_step, status, requester_id, company_id
    )
    VALUES (
        p_workflow_id, p_source_id, 1, 'PENDING', p_requester_id, v_company_id
    )
    RETURNING id INTO v_req_id;

    RETURN v_req_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_workflow_action(p_request_id uuid, p_action text, p_comment text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_req RECORD;
    v_module TEXT;
    v_source_id UUID;
BEGIN
    SELECT * INTO v_req FROM workflow_requests WHERE id = p_request_id;
    
    IF v_req IS NULL THEN RETURN 'Request not found'; END IF;
    
    -- Update Workflow Request
    UPDATE workflow_requests 
    SET status = p_action 
    WHERE id = p_request_id;
    
    -- Sync to Source Table
    SELECT module INTO v_module FROM workflows WHERE id = v_req.workflow_id;
    v_source_id := v_req.source_id::UUID;

    IF v_module = 'Leaves' OR v_module = 'HRMS' THEN
        -- Try updating leaves first (if it matches)
        UPDATE leaves SET status = p_action, manager_comment = p_comment WHERE id = v_source_id;
    END IF;
    
    IF v_module = 'Resignation' OR v_module = 'Resignations' OR v_module = 'Exit' THEN
        UPDATE resignations SET status = p_action, manager_comment = p_comment WHERE id = v_source_id;
    END IF;

    RETURN 'Success';
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_create_purchase_order(p_partner_id uuid, p_expected_date date, p_warehouse_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_lines jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_cid UUID := get_my_company_id();
  v_oid UUID; v_name TEXT; v_line JSONB; v_total NUMERIC := 0; v_sub NUMERIC;
BEGIN
  SELECT 'PO-' || LPAD(COALESCE((SELECT COUNT(*) FROM purchase_orders WHERE company_id=v_cid),0)+1,5,'0') INTO v_name;
  INSERT INTO purchase_orders(company_id,name,partner_id,expected_date,warehouse_id,notes,state,total_amount)
  VALUES(v_cid,v_name,p_partner_id,p_expected_date,p_warehouse_id,p_notes,'draft',0) RETURNING id INTO v_oid;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_sub := (v_line->>'quantity')::NUMERIC * (v_line->>'unit_price')::NUMERIC;
    v_total := v_total + v_sub;
    INSERT INTO purchase_order_lines(company_id,order_id,item_id,quantity,unit_price,subtotal)
    VALUES(v_cid,v_oid,(v_line->>'item_id')::UUID,(v_line->>'quantity')::NUMERIC,(v_line->>'unit_price')::NUMERIC,v_sub);
  END LOOP;
  UPDATE purchase_orders SET total_amount=v_total WHERE id=v_oid;
  RETURN jsonb_build_object('success',true,'order_id',v_oid,'name',v_name);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'message',SQLERRM);
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_confirm_purchase_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_cid UUID := get_my_company_id();
BEGIN
  UPDATE purchase_orders SET state='confirmed' WHERE id=p_order_id AND company_id=v_cid AND state='draft';
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','Order not found or not in draft state.'); END IF;
  RETURN jsonb_build_object('success',true);
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_receive_purchase_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_cid UUID := get_my_company_id(); v_line RECORD;
BEGIN
  -- Mark all lines as fully received
  UPDATE purchase_order_lines SET quantity_received=quantity WHERE order_id=p_order_id AND company_id=v_cid;
  UPDATE purchase_orders SET state='received' WHERE id=p_order_id AND company_id=v_cid AND state='confirmed';
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','Order not confirmed.'); END IF;
  RETURN jsonb_build_object('success',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'message',SQLERRM);
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_cancel_purchase_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_cid UUID := get_my_company_id();
BEGIN
  UPDATE purchase_orders SET state='cancelled' WHERE id=p_order_id AND company_id=v_cid AND state NOT IN ('received','cancelled');
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','Cannot cancel.'); END IF;
  RETURN jsonb_build_object('success',true);
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_create_sales_order(p_partner_id uuid, p_commitment_date date DEFAULT NULL::date, p_warehouse_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_lines jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_cid UUID := get_my_company_id();
  v_oid UUID; v_name TEXT; v_line JSONB; v_total NUMERIC := 0; v_sub NUMERIC;
BEGIN
  SELECT 'SO-' || LPAD(COALESCE((SELECT COUNT(*) FROM sales_orders WHERE company_id=v_cid),0)+1,5,'0') INTO v_name;
  INSERT INTO sales_orders(company_id,name,partner_id,commitment_date,warehouse_id,notes,state,total_amount)
  VALUES(v_cid,v_name,p_partner_id,p_commitment_date,p_warehouse_id,p_notes,'draft',0) RETURNING id INTO v_oid;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_sub := (v_line->>'quantity')::NUMERIC * (v_line->>'unit_price')::NUMERIC;
    v_total := v_total + v_sub;
    INSERT INTO sales_order_lines(company_id,order_id,item_id,quantity,unit_price,subtotal)
    VALUES(v_cid,v_oid,(v_line->>'item_id')::UUID,(v_line->>'quantity')::NUMERIC,(v_line->>'unit_price')::NUMERIC,v_sub);
  END LOOP;
  UPDATE sales_orders SET total_amount=v_total WHERE id=v_oid;
  RETURN jsonb_build_object('success',true,'order_id',v_oid,'name',v_name);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'message',SQLERRM);
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_confirm_sales_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_cid UUID := get_my_company_id();
BEGIN
  UPDATE sales_orders SET state='confirmed' WHERE id=p_order_id AND company_id=v_cid AND state='draft';
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','Order not found or not draft.'); END IF;
  RETURN jsonb_build_object('success',true);
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_procurement_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_cid UUID := get_my_company_id();
BEGIN
  RETURN jsonb_build_object(
    'po_total',     (SELECT COUNT(*) FROM purchase_orders WHERE company_id=v_cid),
    'po_draft',     (SELECT COUNT(*) FROM purchase_orders WHERE company_id=v_cid AND state='draft'),
    'po_confirmed', (SELECT COUNT(*) FROM purchase_orders WHERE company_id=v_cid AND state='confirmed'),
    'po_received',  (SELECT COUNT(*) FROM purchase_orders WHERE company_id=v_cid AND state='received'),
    'so_total',     (SELECT COUNT(*) FROM sales_orders WHERE company_id=v_cid),
    'so_draft',     (SELECT COUNT(*) FROM sales_orders WHERE company_id=v_cid AND state='draft'),
    'so_confirmed', (SELECT COUNT(*) FROM sales_orders WHERE company_id=v_cid AND state='confirmed'),
    'so_shipped',   (SELECT COUNT(*) FROM sales_orders WHERE company_id=v_cid AND state='shipped'),
    'so_invoiced',  (SELECT COUNT(*) FROM sales_orders WHERE company_id=v_cid AND state='invoiced'),
    'po_value',     (SELECT COALESCE(SUM(total_amount),0) FROM purchase_orders WHERE company_id=v_cid AND state != 'cancelled'),
    'so_value',     (SELECT COALESCE(SUM(total_amount),0) FROM sales_orders WHERE company_id=v_cid AND state != 'cancelled')
  );
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_manufacturing_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_cid UUID := get_my_company_id();
BEGIN
  RETURN jsonb_build_object(
    'total_orders',    (SELECT COUNT(*) FROM mrp_production_orders WHERE company_id=v_cid),
    'draft',           (SELECT COUNT(*) FROM mrp_production_orders WHERE company_id=v_cid AND state='draft'),
    'confirmed',       (SELECT COUNT(*) FROM mrp_production_orders WHERE company_id=v_cid AND state='confirmed'),
    'in_progress',     (SELECT COUNT(*) FROM mrp_production_orders WHERE company_id=v_cid AND state='in_progress'),
    'done',            (SELECT COUNT(*) FROM mrp_production_orders WHERE company_id=v_cid AND state='done'),
    'cancelled',       (SELECT COUNT(*) FROM mrp_production_orders WHERE company_id=v_cid AND state='cancelled'),
    'total_boms',      (SELECT COUNT(*) FROM mrp_bom WHERE company_id=v_cid),
    'total_workcenters',(SELECT COUNT(*) FROM mrp_work_centers WHERE company_id=v_cid AND is_active=true),
    'total_routings',  (SELECT COUNT(*) FROM mrp_routing WHERE company_id=v_cid AND is_active=true)
  );
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_dispose_asset(p_asset_id uuid, p_disposal_date date, p_disposal_value numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_cid UUID := get_my_company_id();
BEGIN
  UPDATE fixed_assets SET status = 'disposed', disposal_date = p_disposal_date, disposal_value = p_disposal_value
  WHERE id = p_asset_id AND company_id = v_cid AND status = 'active';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Asset not found or already disposed.'); END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_fixed_assets_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_cid UUID := get_my_company_id();
BEGIN
  RETURN jsonb_build_object(
    'total_assets',       (SELECT COUNT(*) FROM fixed_assets WHERE company_id = v_cid AND status = 'active'),
    'total_cost',         (SELECT COALESCE(SUM(purchase_value),0) FROM fixed_assets WHERE company_id = v_cid AND status = 'active'),
    'total_depreciation', (SELECT COALESCE(SUM(accumulated_depreciation),0) FROM fixed_assets WHERE company_id = v_cid AND status = 'active'),
    'total_nbv',          (SELECT COALESCE(SUM(net_book_value),0) FROM fixed_assets WHERE company_id = v_cid AND status = 'active'),
    'disposed',           (SELECT COUNT(*) FROM fixed_assets WHERE company_id = v_cid AND status = 'disposed')
  );
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_qatar_vat_report(p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_caller_company_id UUID;
  v_target_company_id UUID;
  v_is_super_admin BOOLEAN;
BEGIN
  -- 1. Ensure caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Prevent deleting own account
  IF auth.uid() = p_user_id THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  -- 3. Fetch company associations
  v_caller_company_id := public.get_my_company_id();
  SELECT company_id INTO v_target_company_id FROM public.profiles WHERE id = p_user_id;
  
  -- Check if caller is super admin
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (lower(role) = 'super admin' OR lower(role) = 'superadmin')
  ) INTO v_is_super_admin;

  -- 4. Authorization check
  IF NOT v_is_super_admin THEN
    IF v_target_company_id IS NULL OR v_caller_company_id IS NULL OR v_target_company_id != v_caller_company_id THEN
      RAISE EXCEPTION 'Unauthorized to delete this user';
    END IF;
  END IF;

  -- 5. Delete dependencies in public schema
  DELETE FROM public.user_permissions WHERE user_id = p_user_id;
  DELETE FROM public.user_company_access WHERE user_id = p_user_id;
  
  -- Unlink from employees if linked
  UPDATE public.employees SET profile_id = NULL WHERE profile_id = p_user_id;
  
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- 6. Delete from auth schema (fully deletes auth credentials)
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_user_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_user_email VARCHAR(255);
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_record_id VARCHAR(100);
    v_description TEXT;
    v_action VARCHAR(50);
BEGIN
    -- Exception block to ensure logging errors NEVER block the original transaction
    BEGIN
        -- Determine user_id
        v_user_id := auth.uid();
        
        -- Fetch email if user exists
        IF v_user_id IS NOT NULL THEN
            SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
        END IF;
        -- Determine company_id from row or fallback
        IF TG_OP = 'DELETE' THEN
            BEGIN
                v_company_id := OLD.company_id;
            EXCEPTION WHEN OTHERS THEN
                v_company_id := get_my_company_id();
            END;
        ELSE
            BEGIN
                v_company_id := NEW.company_id;
            EXCEPTION WHEN OTHERS THEN
                v_company_id := get_my_company_id();
            END;
        END IF;
        -- Fallback if company_id is still null
        IF v_company_id IS NULL THEN
            v_company_id := get_my_company_id();
        END IF;
        -- Determine record ID
        IF TG_OP = 'DELETE' THEN
            BEGIN
                v_record_id := OLD.id::TEXT;
            EXCEPTION WHEN OTHERS THEN
                v_record_id := NULL;
            END;
        ELSE
            BEGIN
                v_record_id := NEW.id::TEXT;
            EXCEPTION WHEN OTHERS THEN
                v_record_id := NULL;
            END;
        END IF;
        -- Setup old and new JSON data
        IF TG_OP = 'INSERT' THEN
            v_action := 'INSERT';
            v_new_data := to_jsonb(NEW);
            
            -- Table-specific description formatting
            IF TG_TABLE_NAME = 'employees' THEN
                v_description := 'Added employee: ' || COALESCE(NEW.name, 'Unknown');
            ELSIF TG_TABLE_NAME = 'leaves' THEN
                v_description := 'Submitted leave request for type: ' || COALESCE(NEW.type, 'Leave');
            ELSIF TG_TABLE_NAME = 'crm_deals' THEN
                v_description := 'Created deal: ' || COALESCE(NEW.title, 'New Deal');
            ELSIF TG_TABLE_NAME = 'crm_contacts' THEN
                v_description := 'Added contact: ' || COALESCE(NEW.name, 'New Contact');
            ELSIF TG_TABLE_NAME = 'crm_tasks' THEN
                v_description := 'Added CRM task: ' || COALESCE(NEW.title, 'New Task');
            ELSIF TG_TABLE_NAME = 'attendance' THEN
                v_description := 'Marked attendance';
            ELSIF TG_TABLE_NAME = 'payroll' THEN
                v_description := 'Created payroll draft for employee';
            ELSIF TG_TABLE_NAME = 'assets' THEN
                v_description := 'Registered asset: ' || COALESCE(NEW.name, 'New Asset');
            ELSIF TG_TABLE_NAME = 'tickets' THEN
                v_description := 'Created support ticket: ' || COALESCE(NEW.subject, 'New Ticket');
            ELSIF TG_TABLE_NAME = 'announcements' THEN
                v_description := 'Published announcement: ' || COALESCE(NEW.title, 'New Announcement');
            ELSE
                v_description := 'Added new record to ' || TG_TABLE_NAME;
            END IF;
            
        ELSIF TG_OP = 'UPDATE' THEN
            v_action := 'UPDATE';
            v_old_data := to_jsonb(OLD);
            v_new_data := to_jsonb(NEW);
            
            -- Table-specific description formatting
            IF TG_TABLE_NAME = 'employees' THEN
                v_description := 'Updated employee details: ' || COALESCE(NEW.name, 'Unknown');
            ELSIF TG_TABLE_NAME = 'leaves' THEN
                v_description := 'Updated leave request status: ' || COALESCE(NEW.type, 'Leave') || ' (Status: ' || COALESCE(NEW.status, 'Pending') || ')';
            ELSIF TG_TABLE_NAME = 'crm_deals' THEN
                v_description := 'Updated deal: ' || COALESCE(NEW.title, 'Deal') || ' (Stage: ' || COALESCE(NEW.stage, 'Stage') || ')';
            ELSIF TG_TABLE_NAME = 'attendance' THEN
                v_description := 'Updated attendance record';
            ELSIF TG_TABLE_NAME = 'payroll' THEN
                v_description := 'Updated payroll record (Status: ' || COALESCE(NEW.status, 'Draft') || ')';
            ELSIF TG_TABLE_NAME = 'assets' THEN
                v_description := 'Updated asset: ' || COALESCE(NEW.name, 'Asset') || ' (Status: ' || COALESCE(NEW.status, 'Available') || ')';
            ELSIF TG_TABLE_NAME = 'tickets' THEN
                v_description := 'Updated ticket: ' || COALESCE(NEW.subject, 'Ticket') || ' (Status: ' || COALESCE(NEW.status, 'Open') || ')';
            ELSE
                v_description := 'Updated record in ' || TG_TABLE_NAME;
            END IF;
            
        ELSIF TG_OP = 'DELETE' THEN
            v_action := 'DELETE';
            v_old_data := to_jsonb(OLD);
            
            -- Table-specific description formatting
            IF TG_TABLE_NAME = 'employees' THEN
                v_description := 'Removed employee: ' || COALESCE(OLD.name, 'Unknown');
            ELSIF TG_TABLE_NAME = 'leaves' THEN
                v_description := 'Deleted leave request';
            ELSIF TG_TABLE_NAME = 'crm_deals' THEN
                v_description := 'Deleted deal: ' || COALESCE(OLD.title, 'Deal');
            ELSIF TG_TABLE_NAME = 'crm_contacts' THEN
                v_description := 'Deleted contact: ' || COALESCE(OLD.name, 'Contact');
            ELSIF TG_TABLE_NAME = 'assets' THEN
                v_description := 'Removed asset: ' || COALESCE(OLD.name, 'Asset');
            ELSIF TG_TABLE_NAME = 'announcements' THEN
                v_description := 'Removed announcement: ' || COALESCE(OLD.title, 'Announcement');
            ELSE
                v_description := 'Deleted record from ' || TG_TABLE_NAME;
            END IF;
        END IF;
        -- Insert the audit log row
        IF v_company_id IS NOT NULL THEN
            INSERT INTO activity_logs (
                company_id,
                user_id,
                user_email,
                action,
                table_name,
                record_id,
                old_data,
                new_data,
                description
            ) VALUES (
                v_company_id,
                v_user_id,
                v_user_email,
                v_action,
                TG_TABLE_NAME,
                v_record_id,
                v_old_data,
                v_new_data,
                v_description
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Fail silently to prevent original transaction from failing
        NULL;
    END;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$;

CREATE OR REPLACE PROCEDURE public.create_audit_trigger(IN p_table_name text)
 LANGUAGE plpgsql
AS $procedure$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', p_table_name, p_table_name);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION log_user_activity()', p_table_name, p_table_name);
END;
$procedure$;

CREATE OR REPLACE FUNCTION public.rpc_get_accounting_balance_sheet(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_assets JSONB;
    v_liabilities JSONB;
    v_equity JSONB;
    v_current_year_earnings NUMERIC;
BEGIN
    v_company_id := get_my_company_id();

    -- Calculate Current Year Earnings (Net Profit/Loss up to p_date)
    SELECT COALESCE(SUM(l.credit - l.debit), 0)
    INTO v_current_year_earnings
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date <= p_date
      AND a.type IN ('Income', 'Expense');

    -- Assets (Debit - Credit)
    SELECT jsonb_agg(t) INTO v_assets FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Asset'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    -- Liabilities (Credit - Debit)
    SELECT jsonb_agg(t) INTO v_liabilities FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Liability'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- Equity (Credit - Debit)
    SELECT jsonb_agg(t) INTO v_equity FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Equity'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        
        UNION ALL
        
        SELECT 
            '999999' as code, 
            'Current Year Earnings' as name, 
            'Retained Earnings' as subtype, 
            v_current_year_earnings as balance
        WHERE v_current_year_earnings != 0
        
        ORDER BY code
    ) t;

    RETURN jsonb_build_object(
        'date', p_date,
        'assets', COALESCE(v_assets, '[]'::jsonb),
        'liabilities', COALESCE(v_liabilities, '[]'::jsonb),
        'equity', COALESCE(v_equity, '[]'::jsonb)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_accounting_profit_loss(p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_revenue JSONB;
    v_cogs JSONB;
    v_indirect_income JSONB;
    v_indirect_expense JSONB;
    v_total_revenue NUMERIC := 0;
    v_total_cogs NUMERIC := 0;
    v_total_indirect_income NUMERIC := 0;
    v_total_indirect_expense NUMERIC := 0;
    v_gross_profit NUMERIC := 0;
    v_net_profit NUMERIC := 0;
BEGIN
    v_company_id := get_my_company_id();

    -- 1. Revenue (Credit - Debit)
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_total_revenue
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Income' AND a.subtype = 'Revenue';

    SELECT jsonb_agg(t) INTO v_revenue FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Income' AND a.subtype = 'Revenue'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- 2. Cost of Sales (Debit - Credit)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_total_cogs
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Expense' AND a.subtype = 'COGS';

    SELECT jsonb_agg(t) INTO v_cogs FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Expense' AND a.subtype = 'COGS'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    v_gross_profit := v_total_revenue - v_total_cogs;

    -- 3. Indirect Income (Credit - Debit)
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_total_indirect_income
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Income' AND a.subtype != 'Revenue';

    SELECT jsonb_agg(t) INTO v_indirect_income FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Income' AND a.subtype != 'Revenue'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- 4. Indirect Expenses (Debit - Credit)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_total_indirect_expense
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Expense' AND a.subtype != 'COGS';

    SELECT jsonb_agg(t) INTO v_indirect_expense FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Expense' AND a.subtype != 'COGS'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    v_net_profit := v_gross_profit + v_total_indirect_income - v_total_indirect_expense;

    RETURN jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'revenue', COALESCE(v_revenue, '[]'::jsonb),
        'cogs', COALESCE(v_cogs, '[]'::jsonb),
        'indirect_income', COALESCE(v_indirect_income, '[]'::jsonb),
        'indirect_expense', COALESCE(v_indirect_expense, '[]'::jsonb),
        'total_revenue', v_total_revenue,
        'total_cogs', v_total_cogs,
        'gross_profit', v_gross_profit,
        'total_indirect_income', v_total_indirect_income,
        'total_indirect_expense', v_total_indirect_expense,
        'net_profit', v_net_profit
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_accounting_trial_balance(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            a.code,
            a.name,
            a.type,
            SUM(l.debit) as total_debit,
            SUM(l.credit) as total_credit,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
        GROUP BY a.code, a.name, a.type
        HAVING SUM(l.debit) != 0 OR SUM(l.credit) != 0
        ORDER BY a.code
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_accounting_partner_aging(p_partner_type text, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            p.name as partner_name,
            SUM(CASE WHEN (p_date - e.due_date) <= 0 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as current,
            SUM(CASE WHEN (p_date - e.due_date) BETWEEN 1 AND 30 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_30,
            SUM(CASE WHEN (p_date - e.due_date) BETWEEN 31 AND 60 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_60,
            SUM(CASE WHEN (p_date - e.due_date) BETWEEN 61 AND 90 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_90,
            SUM(CASE WHEN (p_date - e.due_date) > 90 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_90_plus,
            SUM(CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) as total_overdue
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_partners p ON p.id = e.partner_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.subtype IN ('Receivable', 'Payable')
          AND p.partner_type IN (p_partner_type, 'Both')
        GROUP BY p.name
        HAVING SUM(CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) != 0
        ORDER BY p.name
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_accounting_sales_ledger_report(p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            sl.name as ledger_name,
            a.code as account_code,
            a.name as account_name,
            COALESCE(SUM(l.credit - l.debit), 0) as total_amount,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'date', e.date,
                        'reference', e.reference,
                        'partner_name', p.name,
                        'description', l.name,
                        'amount', l.credit - l.debit
                    ) ORDER BY e.date DESC
                ) FILTER (WHERE l.id IS NOT NULL AND e.id IS NOT NULL),
                '[]'::jsonb
            ) as transactions
        FROM public.accounting_sales_ledgers sl
        JOIN public.accounting_chart_of_accounts a ON a.id = sl.account_id
        LEFT JOIN public.accounting_journal_lines l ON l.account_id = a.id
        LEFT JOIN public.accounting_journal_entries e ON e.id = l.entry_id AND e.state = 'Posted' AND e.date BETWEEN p_start_date AND p_end_date
        LEFT JOIN public.accounting_partners p ON p.id = e.partner_id
        WHERE sl.company_id = v_company_id
        GROUP BY sl.name, a.code, a.name
        ORDER BY sl.name
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_accounting_purchase_ledger_report(p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            pl.name as ledger_name,
            a.code as account_code,
            a.name as account_name,
            COALESCE(SUM(l.debit - l.credit), 0) as total_amount,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'date', e.date,
                        'reference', e.reference,
                        'partner_name', p.name,
                        'description', l.name,
                        'amount', l.debit - l.credit
                    ) ORDER BY e.date DESC
                ) FILTER (WHERE l.id IS NOT NULL AND e.id IS NOT NULL),
                '[]'::jsonb
            ) as transactions
        FROM public.accounting_purchase_ledgers pl
        JOIN public.accounting_chart_of_accounts a ON a.id = pl.account_id
        LEFT JOIN public.accounting_journal_lines l ON l.account_id = a.id
        LEFT JOIN public.accounting_journal_entries e ON e.id = l.entry_id AND e.state = 'Posted' AND e.date BETWEEN p_start_date AND p_end_date
        LEFT JOIN public.accounting_partners p ON p.id = e.partner_id
        WHERE pl.company_id = v_company_id
        GROUP BY pl.name, a.code, a.name
        ORDER BY pl.name
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_accounting_expense_analysis(p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        -- Direct Expenses
        SELECT 
            del.name as category,
            a.code as account_code,
            a.name as account_name,
            COALESCE(SUM(l.debit - l.credit), 0) as amount,
            'Direct' as type
        FROM public.accounting_direct_expense_ledgers del
        JOIN public.accounting_chart_of_accounts a ON a.id = del.account_id
        LEFT JOIN public.accounting_journal_lines l ON l.account_id = a.id
        LEFT JOIN public.accounting_journal_entries e ON e.id = l.entry_id AND e.state = 'Posted' AND e.date BETWEEN p_start_date AND p_end_date
        WHERE del.company_id = v_company_id
        GROUP BY del.name, a.code, a.name
        
        UNION ALL
        
        -- Indirect Expenses
        SELECT 
            'Indirect Expense' as category,
            a.code as account_code,
            a.name as account_name,
            COALESCE(SUM(l.debit - l.credit), 0) as amount,
            'Indirect' as type
        FROM public.accounting_chart_of_accounts a
        LEFT JOIN public.accounting_journal_lines l ON l.account_id = a.id
        LEFT JOIN public.accounting_journal_entries e ON e.id = l.entry_id AND e.state = 'Posted' AND e.date BETWEEN p_start_date AND p_end_date
        WHERE a.company_id = v_company_id
          AND a.type = 'Expense'
          AND a.subtype != 'COGS'
          AND a.id NOT IN (SELECT account_id FROM public.accounting_direct_expense_ledgers WHERE company_id = v_company_id)
        GROUP BY a.code, a.name
        
        ORDER BY type, category, account_code
    ) t WHERE t.amount != 0;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_cash_book(p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            e.date,
            l.name as description,
            a.name as account_name,
            l.debit,
            l.credit,
            SUM(l.debit - l.credit) OVER (ORDER BY e.date, l.created_at) as running_balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.subtype = 'Cash'
        ORDER BY e.date, l.created_at
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_global_dashboard(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_hr JSON;
    v_finance JSON;
    v_inventory JSON;
    v_approvals JSON;

    -- HR Variables
    v_active_employees INT := 0;
    v_attendance_pct INT := 0;
    v_present_today INT := 0;

    -- Finance Variables
    v_receivables NUMERIC := 0;
    v_payables NUMERIC := 0;
    v_overdue_invoices INT := 0;

    -- Inventory Variables
    v_stock_value NUMERIC := 0;
    v_low_stock_items INT := 0;
    
    -- Approvals Variables
    v_pending_leaves INT := 0;
    v_pending_transitions INT := 0;
BEGIN
    -- HR
    SELECT COUNT(*) INTO v_active_employees 
    FROM public.employees 
    WHERE company_id = p_company_id AND status = 'Active';

    SELECT COUNT(*) INTO v_present_today
    FROM public.attendance
    WHERE company_id = p_company_id AND date = CURRENT_DATE AND status = 'Present';

    IF v_active_employees > 0 THEN
        v_attendance_pct := ROUND((v_present_today::NUMERIC / v_active_employees::NUMERIC) * 100);
    END IF;

    v_hr := json_build_object(
        'active_employees', v_active_employees,
        'attendance_pct', v_attendance_pct
    );

    -- Finance (Using new isolated double entry journal entries)
    SELECT COALESCE(SUM(amount_residual), 0) INTO v_receivables
    FROM public.accounting_journal_entries
    WHERE company_id = p_company_id AND move_type = 'out_invoice' AND state = 'Posted' AND amount_residual > 0;

    SELECT COALESCE(SUM(amount_residual), 0) INTO v_payables
    FROM public.accounting_journal_entries
    WHERE company_id = p_company_id AND move_type = 'in_invoice' AND state = 'Posted' AND amount_residual > 0;

    SELECT COUNT(*) INTO v_overdue_invoices
    FROM public.accounting_journal_entries
    WHERE company_id = p_company_id AND move_type = 'out_invoice' AND state = 'Posted' AND due_date < CURRENT_DATE AND amount_residual > 0;

    v_finance := json_build_object(
        'receivables', v_receivables,
        'payables', v_payables,
        'overdue_invoices', v_overdue_invoices
    );

    -- Inventory
    SELECT COALESCE(SUM(sm.quantity * COALESCE(im.buying_price, 0)), 0) INTO v_stock_value
    FROM public.stock_movements sm
    JOIN public.item_master im ON sm.item_id = im.id
    WHERE sm.company_id = p_company_id;

    SELECT COUNT(*) INTO v_low_stock_items
    FROM (
        SELECT sm.item_id, SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE -sm.quantity END) AS net_qty
        FROM public.stock_movements sm
        WHERE sm.company_id = p_company_id
        GROUP BY sm.item_id
    ) inventory
    JOIN public.item_master im ON inventory.item_id = im.id
    WHERE inventory.net_qty <= COALESCE(im.reorder_level, 10);

    v_inventory := json_build_object(
        'stock_value', v_stock_value,
        'low_stock_items', v_low_stock_items
    );

    -- Approvals
    SELECT COUNT(*) INTO v_pending_leaves
    FROM public.leaves
    WHERE company_id = p_company_id AND status = 'Pending';
    
    SELECT COUNT(*) INTO v_pending_transitions
    FROM public.employee_job_transitions
    WHERE company_id = p_company_id AND status = 'Pending';

    v_approvals := json_build_object(
        'pending_leaves', v_pending_leaves,
        'pending_transitions', v_pending_transitions
    );

    RETURN json_build_object(
        'hr', v_hr,
        'finance', v_finance,
        'inventory', v_inventory,
        'approvals', v_approvals
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_run_depreciation(p_period_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_cid   UUID := get_my_company_id();
  v_asset RECORD;
  v_annual_dep NUMERIC;
  v_monthly_dep NUMERIC;
  v_count INTEGER := 0;
  v_journal_id UUID;
  v_entry_id UUID;
BEGIN
  -- Get or Create Miscellaneous Journal
  SELECT id INTO v_journal_id FROM public.accounting_journals 
  WHERE company_id = v_cid AND type = 'Miscellaneous' LIMIT 1;
  
  IF v_journal_id IS NULL THEN
      SELECT id INTO v_journal_id FROM public.accounting_journals 
      WHERE company_id = v_cid LIMIT 1;
  END IF;
  
  IF v_journal_id IS NULL THEN
      INSERT INTO public.accounting_journals (company_id, name, code, type, is_active)
      VALUES (v_cid, 'Miscellaneous Journal', 'MISC', 'Miscellaneous', true)
      RETURNING id INTO v_journal_id;
  END IF;

  FOR v_asset IN
    SELECT fa.* FROM fixed_assets fa
    WHERE fa.company_id = v_cid AND fa.status = 'active'
      AND fa.purchase_date <= p_period_date
      AND fa.accumulated_depreciation < (fa.purchase_value - fa.salvage_value)
      AND NOT EXISTS (
        SELECT 1 FROM fixed_asset_depreciation fad
        WHERE fad.asset_id = fa.id
          AND date_trunc('month', fad.period_date) = date_trunc('month', p_period_date)
          AND fad.company_id = v_cid
      )
  LOOP
    -- Verify linking accounts are present
    IF v_asset.account_id IS NULL OR v_asset.depreciation_account_id IS NULL THEN
        RAISE EXCEPTION 'Asset "%" is not linked to GL accounts. Please edit the asset and select both Asset Account and Depreciation Account.', v_asset.name;
    END IF;

    v_annual_dep  := (v_asset.purchase_value - v_asset.salvage_value) / NULLIF(v_asset.useful_life_years, 0);
    v_monthly_dep := ROUND(v_annual_dep / 12, 2);
    v_monthly_dep := LEAST(v_monthly_dep, v_asset.purchase_value - v_asset.salvage_value - v_asset.accumulated_depreciation);
    
    IF v_monthly_dep <= 0 THEN CONTINUE; END IF;

    -- Create Journal Entry for Depreciation
    INSERT INTO public.accounting_journal_entries (
        company_id, journal_id, date, invoice_date, 
        reference, move_type, state, amount_total
    ) VALUES (
        v_cid, v_journal_id, p_period_date, p_period_date,
        COALESCE(v_asset.asset_code, 'DEP-' || v_asset.name), 'entry', 'Posted', v_monthly_dep
    ) RETURNING id INTO v_entry_id;

    -- Debit Depreciation Expense
    INSERT INTO public.accounting_journal_lines (
        company_id, entry_id, account_id, name, debit, credit
    ) VALUES (
        v_cid, v_entry_id, v_asset.depreciation_account_id, 'Depreciation Expense - ' || v_asset.name, v_monthly_dep, 0
    );

    -- Credit Accumulated Depreciation / Asset Account
    INSERT INTO public.accounting_journal_lines (
        company_id, entry_id, account_id, name, debit, credit
    ) VALUES (
        v_cid, v_entry_id, v_asset.account_id, 'Accumulated Depreciation - ' || v_asset.name, 0, v_monthly_dep
    );

    -- Record Depreciation Log
    INSERT INTO fixed_asset_depreciation(company_id, asset_id, period_date, amount, notes, journal_entry_id)
    VALUES(v_cid, v_asset.id, p_period_date, v_monthly_dep, 'Auto depreciation', v_entry_id);

    -- Update Asset
    UPDATE fixed_assets SET accumulated_depreciation = accumulated_depreciation + v_monthly_dep WHERE id = v_asset.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'assets_processed', v_count, 'period', p_period_date);
EXCEPTION WHEN OTHERS THEN 
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_emp_id UUID;
    v_company_id UUID;
    v_role TEXT := 'Employee';
    v_role_id UUID;
BEGIN
    SELECT id, company_id, role
    INTO v_emp_id, v_company_id, v_role
    FROM public.employees
    WHERE lower(office_email) = lower(NEW.email) OR lower(personal_email) = lower(NEW.email) OR lower(email) = lower(NEW.email)
    LIMIT 1;

    IF v_company_id IS NOT NULL THEN
        SELECT id INTO v_role_id FROM public.roles WHERE company_id = v_company_id AND lower(name) = lower(COALESCE(v_role, 'Employee')) LIMIT 1;
        IF v_role_id IS NULL THEN
            SELECT id INTO v_role_id FROM public.roles WHERE company_id = v_company_id LIMIT 1;
        END IF;

        INSERT INTO public.user_company_access (user_id, company_id, is_default, status, role_id)
        VALUES (NEW.id, v_company_id, true, 'active', v_role_id)
        ON CONFLICT (user_id, company_id) DO NOTHING;

        UPDATE public.employees
        SET profile_id = NEW.id
        WHERE id = v_emp_id;
    END IF;

    INSERT INTO public.profiles (id, email, role, employee_id, company_id)
    VALUES (NEW.id, NEW.email, COALESCE(v_role, 'Employee'), v_emp_id, v_company_id)
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        employee_id = COALESCE(public.profiles.employee_id, EXCLUDED.employee_id),
        company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id);

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_and_process_overdue_slas()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    rec RECORD;
    v_recipient_id UUID;
BEGIN
    -- Find pending SLAs that have passed their due_time
    FOR rec IN 
        SELECT s.*, w.assigned_to_user_id, w.requester_id
        FROM public.sla_tracking s
        LEFT JOIN public.workflow_instances w ON w.entity_id = s.entity_id
        WHERE s.status = 'Pending' AND s.due_time < now()
    LOOP
        -- 1. Update SLA status to Overdue
        UPDATE public.sla_tracking SET status = 'Overdue' WHERE id = rec.id;

        -- 2. Determine recipient (default to requester if no assignee)
        v_recipient_id := COALESCE(rec.assigned_to_user_id, rec.requester_id);

        -- 3. Insert notification for recipient
        IF v_recipient_id IS NOT NULL THEN
            INSERT INTO public.notifications (company_id, user_id, title, message, type, link)
            VALUES (
                rec.company_id,
                v_recipient_id,
                'SLA OVERDUE Alert',
                'The ' || rec.entity_type || ' request is overdue. Action is required immediately.',
                'ALERT',
                CASE 
                    WHEN rec.entity_type = 'LEAVE' THEN '/essp'
                    WHEN rec.entity_type = 'TICKET' THEN '/help_desk'
                    ELSE '/crm'
                END
            );
        END IF;
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_set_accounting_entry_period()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_period_id UUID;
BEGIN
    SELECT id INTO v_period_id
    FROM public.accounting_periods
    WHERE company_id = NEW.company_id
      AND NEW.date BETWEEN start_date AND end_date
    LIMIT 1;
    
    NEW.period_id := v_period_id;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_post_accounting_entry(p_entry_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_entry RECORD;
    v_total_debit NUMERIC;
    v_total_credit NUMERIC;
    v_period_id UUID;
    v_period_status TEXT;
    v_line RECORD;
    v_transaction_type TEXT;
    v_movement_type TEXT;
    v_reference_type TEXT;
BEGIN
    SELECT * INTO v_entry FROM public.accounting_journal_entries WHERE id = p_entry_id;
    
    IF v_entry.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Journal Entry not found');
    END IF;

    IF v_entry.state = 'Posted' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Entry is already posted');
    END IF;

    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0) INTO v_total_debit, v_total_credit
    FROM public.accounting_journal_lines
    WHERE entry_id = p_entry_id;

    IF v_total_debit != v_total_credit THEN
        RETURN jsonb_build_object('success', false, 'message', 'Journal Entry is unbalanced. Debits (' || v_total_debit::TEXT || ') != Credits (' || v_total_credit::TEXT || ')');
    END IF;

    IF v_total_debit = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot post an empty journal entry');
    END IF;

    -- Lookup period
    SELECT id, status INTO v_period_id, v_period_status
    FROM public.accounting_periods
    WHERE company_id = v_entry.company_id
      AND v_entry.date BETWEEN start_date AND end_date
    LIMIT 1;

    IF v_period_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No accounting period defined for this date (' || v_entry.date::TEXT || ')');
    END IF;

    IF v_period_status = 'locked' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot post to a locked accounting period');
    END IF;

    -- Update Entry (with period_id)
    UPDATE public.accounting_journal_entries
    SET 
        state = 'Posted',
        period_id = v_period_id,
        amount_total = v_total_debit,
        amount_residual = v_total_debit
    WHERE id = p_entry_id;

    -- Generate Inventory & Stock Movements if this is a Customer Invoice or Vendor Bill
    IF v_entry.move_type IN ('out_invoice', 'in_invoice') THEN
        IF v_entry.move_type = 'out_invoice' THEN
            v_transaction_type := 'DELIVERY';
            v_movement_type := 'OUT';
            v_reference_type := 'INV';
        ELSE
            v_transaction_type := 'GRN';
            v_movement_type := 'IN';
            v_reference_type := 'BILL';
        END IF;

        FOR v_line IN 
            SELECT * FROM public.accounting_journal_lines 
            WHERE entry_id = p_entry_id AND item_id IS NOT NULL AND quantity > 0
        LOOP
            -- Insert Inventory Transaction
            INSERT INTO public.inventory_transactions (
                company_id, transaction_type, item_id, quantity, unit_cost, total_value, reference_type, reference_id, posting_date
            ) VALUES (
                v_entry.company_id, v_transaction_type, v_line.item_id, v_line.quantity, v_line.unit_price, 
                v_line.quantity * v_line.unit_price, v_reference_type, p_entry_id, v_entry.date
            );

            -- Insert Stock Movement
            INSERT INTO public.stock_movements (
                company_id, item_id, movement_type, quantity, reference_type, reference_id
            ) VALUES (
                v_entry.company_id, v_line.item_id, v_movement_type, v_line.quantity, v_reference_type, p_entry_id
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Journal Entry Posted Successfully');
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_post_accounting_payment(p_payment_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_payment RECORD;
    v_entry_id UUID;
    v_partner RECORD;
    v_journal RECORD;
    v_liquidity_account_id UUID; -- Bank/Cash Account
    v_counterpart_account_id UUID; -- AR/AP Account
    v_company_id UUID;
    v_period_id UUID;
    v_period_status TEXT;
BEGIN
    v_company_id := get_my_company_id();
    
    -- 1. Fetch Payment
    SELECT * INTO v_payment FROM accounting_payments WHERE id = p_payment_id;
    IF v_payment.state = 'posted' THEN RAISE EXCEPTION 'Payment already posted'; END IF;

    -- 2. Fetch Partner & new Journal
    SELECT * INTO v_partner FROM accounting_partners WHERE id = v_payment.partner_id;
    SELECT * INTO v_journal FROM accounting_journals WHERE id = COALESCE(v_payment.accounting_journal_id, v_payment.journal_id);
    
    IF v_journal.id IS NULL THEN
        -- Fallback: try to find the new journal by code
        SELECT new_j.* INTO v_journal 
        FROM public.accounting_journals new_j
        JOIN public.journals old_j ON old_j.code = new_j.code
        WHERE old_j.id = v_payment.journal_id AND new_j.company_id = v_company_id;
    END IF;
    
    v_liquidity_account_id := v_journal.default_account_id;
    IF v_liquidity_account_id IS NULL THEN RAISE EXCEPTION 'Journal % has no default account in the new chart of accounts', v_journal.name; END IF;

    -- 3. Determine Counterpart Account (AR/AP in the new chart of accounts)
    IF v_payment.payment_type = 'inbound' THEN
        SELECT new_acc.id INTO v_counterpart_account_id
        FROM public.accounting_chart_of_accounts new_acc
        JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
        WHERE old_acc.id = v_partner.property_account_receivable_id AND new_acc.company_id = v_company_id;
        
        -- Fallback
        IF v_counterpart_account_id IS NULL THEN
            SELECT id INTO v_counterpart_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id AND subtype = 'Receivable'
            LIMIT 1;
        END IF;
    ELSE
        SELECT new_acc.id INTO v_counterpart_account_id
        FROM public.accounting_chart_of_accounts new_acc
        JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
        WHERE old_acc.id = v_partner.property_account_payable_id AND new_acc.company_id = v_company_id;
        
        -- Fallback
        IF v_counterpart_account_id IS NULL THEN
            SELECT id INTO v_counterpart_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id AND subtype = 'Payable'
            LIMIT 1;
        END IF;
    END IF;
    
    IF v_counterpart_account_id IS NULL THEN RAISE EXCEPTION 'Partner % missing AR/AP account in the new chart of accounts', v_partner.name; END IF;

    -- Find and validate period
    SELECT id, status INTO v_period_id, v_period_status
    FROM public.accounting_periods
    WHERE company_id = v_company_id
      AND v_payment.date BETWEEN start_date AND end_date
    LIMIT 1;

    IF v_period_id IS NULL THEN
        RAISE EXCEPTION 'No open accounting period defined for date %', v_payment.date;
    END IF;

    IF v_period_status = 'locked' THEN
        RAISE EXCEPTION 'Cannot post to a locked accounting period';
    END IF;

    -- 4. Create Journal Entry Header (with period_id)
    INSERT INTO public.accounting_journal_entries (
        company_id, journal_id, date, partner_id, move_type, state, amount_total, reference, notes, period_id
    ) VALUES (
        v_company_id, v_journal.id, v_payment.date, v_payment.partner_id, 'entry', 'Posted', v_payment.amount, v_payment.name, v_payment.notes, v_period_id
    ) RETURNING id INTO v_entry_id;

    -- 5. Create Lines
    IF v_payment.payment_type = 'inbound' THEN
        -- Customer Pays Us:
        -- Dr Bank (Liquidity)
        INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
        VALUES (v_company_id, v_entry_id, v_liquidity_account_id, v_payment.partner_id, 'Payment Received', v_payment.amount, 0);
        
        -- Cr AR (Counterpart)
        INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
        VALUES (v_company_id, v_entry_id, v_counterpart_account_id, v_payment.partner_id, 'Payment Received', 0, v_payment.amount);
        
    ELSE
        -- We Pay Vendor:
        -- Dr AP (Counterpart)
        INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
        VALUES (v_company_id, v_entry_id, v_counterpart_account_id, v_payment.partner_id, 'Payment Sent', v_payment.amount, 0);

        -- Cr Bank (Liquidity)
        INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
        VALUES (v_company_id, v_entry_id, v_liquidity_account_id, v_payment.partner_id, 'Payment Sent', 0, v_payment.amount);
    END IF;

    -- 6. Update Payment Record
    UPDATE public.accounting_payments 
    SET state = 'posted', 
        accounting_journal_id = v_journal.id,
        accounting_entry_id = v_entry_id 
    WHERE id = p_payment_id;

    RETURN v_entry_id;
END;
$function$;

-- ------------------------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.account_groups (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    code_prefix_start text,
    code_prefix_end text,
    type text,
    parent_id uuid,
    CONSTRAINT account_groups_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.accounting_account_groups (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    code_prefix_start text,
    code_prefix_end text,
    type text NOT NULL,
    parent_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_account_groups_pkey PRIMARY KEY (id),
    CONSTRAINT accounting_account_groups_type_check CHECK ((type = ANY (ARRAY['Asset'::text, 'Liability'::text, 'Equity'::text, 'Income'::text, 'Expense'::text]))),
    CONSTRAINT uk_accounting_account_group_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.accounting_chart_of_accounts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    subtype text,
    account_group_id uuid,
    currency_id uuid,
    is_reconcilable boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_chart_of_accounts_pkey PRIMARY KEY (id),
    CONSTRAINT accounting_chart_of_accounts_subtype_check CHECK ((subtype = ANY (ARRAY['Receivable'::text, 'Payable'::text, 'Bank'::text, 'Cash'::text, 'COGS'::text, 'Revenue'::text, 'Other'::text]))),
    CONSTRAINT accounting_chart_of_accounts_type_check CHECK ((type = ANY (ARRAY['Asset'::text, 'Liability'::text, 'Equity'::text, 'Income'::text, 'Expense'::text]))),
    CONSTRAINT uk_accounting_coa_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS public.accounting_cost_centers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    parent_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_cost_centers_pkey PRIMARY KEY (id),
    CONSTRAINT accounting_cost_centers_type_check CHECK ((type = ANY (ARRAY['PROJECT'::text, 'CONTRACT'::text, 'GENERIC'::text]))),
    CONSTRAINT uk_accounting_cost_center_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS public.accounting_direct_expense_ledgers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    account_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_direct_expense_ledgers_pkey PRIMARY KEY (id),
    CONSTRAINT uk_accounting_direct_expense_ledger_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.accounting_entries (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    transaction_date date NOT NULL,
    description text,
    reference_type text,
    reference_id uuid,
    debit_account text NOT NULL,
    credit_account text NOT NULL,
    amount numeric NOT NULL,
    status text DEFAULT 'POSTED'::text,
    is_reversed boolean DEFAULT false,
    reversal_reason text,
    CONSTRAINT accounting_entries_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT accounting_entries_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.accounting_fiscal_years (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_closed boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_fiscal_years_pkey PRIMARY KEY (id),
    CONSTRAINT uk_accounting_fiscal_year_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.accounting_indirect_income_ledgers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    account_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_indirect_income_ledgers_pkey PRIMARY KEY (id),
    CONSTRAINT uk_accounting_indirect_income_ledger_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.accounting_journal_entries (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    journal_id uuid NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    period_id uuid,
    reference text,
    notes text,
    partner_id uuid,
    state text NOT NULL DEFAULT 'Draft'::text,
    move_type text NOT NULL DEFAULT 'entry'::text,
    invoice_date date,
    due_date date,
    amount_total numeric NOT NULL DEFAULT 0,
    amount_residual numeric NOT NULL DEFAULT 0,
    approval_status text NOT NULL DEFAULT 'approved'::text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_journal_entries_move_type_check CHECK ((move_type = ANY (ARRAY['entry'::text, 'out_invoice'::text, 'in_invoice'::text, 'out_refund'::text, 'in_refund'::text]))),
    CONSTRAINT accounting_journal_entries_pkey PRIMARY KEY (id),
    CONSTRAINT accounting_journal_entries_state_check CHECK ((state = ANY (ARRAY['Draft'::text, 'Posted'::text, 'Cancelled'::text])))
);

CREATE TABLE IF NOT EXISTS public.accounting_journal_lines (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    entry_id uuid NOT NULL,
    account_id uuid NOT NULL,
    partner_id uuid,
    name text,
    debit numeric NOT NULL DEFAULT 0,
    credit numeric NOT NULL DEFAULT 0,
    balance numeric,
    cost_center_id uuid,
    project_cost_center_id uuid,
    contract_cost_center_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    item_id uuid,
    quantity numeric DEFAULT 0,
    unit_price numeric DEFAULT 0,
    CONSTRAINT accounting_journal_lines_credit_check CHECK ((credit >= (0)::numeric)),
    CONSTRAINT accounting_journal_lines_debit_check CHECK ((debit >= (0)::numeric)),
    CONSTRAINT accounting_journal_lines_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.accounting_journals (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    default_account_id uuid,
    sequence_prefix text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_journals_pkey PRIMARY KEY (id),
    CONSTRAINT accounting_journals_type_check CHECK ((type = ANY (ARRAY['Sale'::text, 'Purchase'::text, 'Cash'::text, 'Bank'::text, 'General'::text]))),
    CONSTRAINT uk_accounting_journal_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS public.accounting_move_lines (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    move_id uuid,
    journal_id uuid,
    date date NOT NULL,
    account_id uuid NOT NULL,
    partner_id uuid,
    name text,
    debit numeric DEFAULT 0,
    credit numeric DEFAULT 0,
    balance numeric,
    amount_currency numeric,
    currency_id uuid,
    full_reconcile_id uuid,
    tax_line_id uuid,
    analytic_account_id uuid,
    CONSTRAINT accounting_move_lines_credit_check CHECK ((credit >= (0)::numeric)),
    CONSTRAINT accounting_move_lines_debit_check CHECK ((debit >= (0)::numeric)),
    CONSTRAINT accounting_move_lines_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.accounting_moves (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    journal_id uuid NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    period_id uuid,
    reference text,
    notes text,
    partner_id uuid,
    state text DEFAULT 'Draft'::text,
    amount_total numeric DEFAULT 0,
    invoice_id uuid,
    payment_id uuid,
    inventory_txn_id uuid,
    auto_generated boolean DEFAULT false,
    move_type text DEFAULT 'entry'::text,
    invoice_date date,
    due_date date,
    approval_status text DEFAULT 'approved'::text,
    amount_residual numeric DEFAULT 0,
    CONSTRAINT accounting_moves_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.accounting_partners (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    email text,
    phone text,
    tax_id text,
    street text,
    city text,
    state text,
    postal_code text,
    country text,
    partner_type text DEFAULT 'Customer'::text,
    property_account_receivable_id uuid,
    property_account_payable_id uuid,
    is_active boolean DEFAULT true,
    credit_limit numeric DEFAULT 0,
    payment_term_days integer DEFAULT 30,
    CONSTRAINT accounting_partners_company_id_name_key UNIQUE (company_id, name),
    CONSTRAINT accounting_partners_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.accounting_payment_terms (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    days integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_payment_terms_days_check CHECK ((days >= 0)),
    CONSTRAINT accounting_payment_terms_pkey PRIMARY KEY (id),
    CONSTRAINT uk_accounting_payment_term_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.accounting_payments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text,
    payment_type text NOT NULL,
    partner_type text NOT NULL,
    partner_id uuid,
    amount numeric NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    journal_id uuid,
    payment_method_line_id uuid,
    state text DEFAULT 'draft'::text,
    move_id uuid,
    notes text,
    accounting_journal_id uuid,
    accounting_entry_id uuid,
    CONSTRAINT accounting_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT accounting_payments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    fiscal_year_id uuid,
    name text NOT NULL,
    code text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'Open'::text,
    accounting_fiscal_year_id uuid,
    CONSTRAINT accounting_periods_company_id_code_key UNIQUE (company_id, code),
    CONSTRAINT accounting_periods_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.accounting_purchase_ledgers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    account_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_purchase_ledgers_pkey PRIMARY KEY (id),
    CONSTRAINT uk_accounting_purchase_ledger_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.accounting_sales_ledgers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    account_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_sales_ledgers_pkey PRIMARY KEY (id),
    CONSTRAINT uk_accounting_sales_ledger_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.accounting_stock_categories (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    item_category text NOT NULL,
    asset_account_id uuid,
    cogs_account_id uuid,
    adjustment_account_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_stock_categories_pkey PRIMARY KEY (id),
    CONSTRAINT uk_accounting_stock_category_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.accounting_taxes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL DEFAULT 'Percent'::text,
    scope text NOT NULL DEFAULT 'Sales'::text,
    amount numeric NOT NULL,
    account_id uuid,
    refund_account_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT accounting_taxes_pkey PRIMARY KEY (id),
    CONSTRAINT accounting_taxes_scope_check CHECK ((scope = ANY (ARRAY['Sales'::text, 'Purchase'::text, 'None'::text]))),
    CONSTRAINT accounting_taxes_type_check CHECK ((type = ANY (ARRAY['Percent'::text, 'Fixed'::text, 'Group'::text]))),
    CONSTRAINT uk_accounting_taxes_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid,
    user_id uuid,
    user_email character varying(255),
    action character varying(50) NOT NULL,
    table_name character varying(100),
    record_id character varying(100),
    old_data jsonb,
    new_data jsonb,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT activity_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    title text NOT NULL,
    content text,
    type text DEFAULT 'News'::text,
    is_active boolean DEFAULT true,
    CONSTRAINT announcements_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.assets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    type text NOT NULL,
    serial_number text,
    assigned_to uuid,
    status text DEFAULT 'Available'::text,
    purchase_date date,
    warranty_expiry date,
    CONSTRAINT assets_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    employee_id uuid,
    date date NOT NULL,
    check_in timestamp with time zone,
    check_out timestamp with time zone,
    status text DEFAULT 'Present'::text,
    total_hours numeric DEFAULT 0,
    notes text,
    edited_by uuid,
    edited_at timestamp with time zone,
    edit_reason text,
    source text DEFAULT 'manual'::text,
    attendance_period_id uuid,
    shift_id bigint,
    is_processed boolean DEFAULT false,
    check_in_location text,
    check_out_location text,
    CONSTRAINT attendance_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.attendance_periods (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    code text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text NOT NULL DEFAULT 'OPEN'::text,
    processed_by uuid,
    processed_at timestamp with time zone,
    CONSTRAINT attendance_periods_company_id_code_key UNIQUE (company_id, code),
    CONSTRAINT attendance_periods_pkey PRIMARY KEY (id),
    CONSTRAINT attendance_periods_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'PROCESSED'::text, 'LOCKED'::text])))
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    employee_id uuid,
    date date NOT NULL,
    check_in timestamp with time zone,
    check_out timestamp with time zone,
    status text DEFAULT 'present'::text,
    notes text,
    CONSTRAINT attendance_records_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.attendance_settings (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    grace_minutes_late integer DEFAULT 15,
    grace_minutes_early integer DEFAULT 15,
    standard_hours numeric DEFAULT 8.00,
    ot_threshold_hours numeric DEFAULT 8.00,
    ot_multiplier numeric DEFAULT 1.50,
    half_day_hours numeric DEFAULT 4.00,
    auto_absent_if_no_punch boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT attendance_settings_company_id_key UNIQUE (company_id),
    CONSTRAINT attendance_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    statement_id uuid,
    date date NOT NULL,
    payment_ref text,
    partner_name text,
    partner_id uuid,
    amount numeric NOT NULL,
    is_reconciled boolean DEFAULT false,
    payment_id uuid,
    CONSTRAINT bank_statement_lines_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.bank_statements (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    date date NOT NULL,
    journal_id uuid NOT NULL,
    balance_start numeric DEFAULT 0,
    balance_end_real numeric DEFAULT 0,
    balance_end_calculated numeric DEFAULT 0,
    state text DEFAULT 'open'::text,
    CONSTRAINT bank_statements_company_id_name_key UNIQUE (company_id, name),
    CONSTRAINT bank_statements_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.buzz_likes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    post_id uuid,
    user_id uuid,
    CONSTRAINT buzz_likes_pkey PRIMARY KEY (id),
    CONSTRAINT buzz_likes_post_id_user_id_key UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.buzz_posts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    author_id uuid,
    content text,
    type text DEFAULT 'post'::text,
    parent_id uuid,
    likes_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    CONSTRAINT buzz_posts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.career_paths (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    steps jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT career_paths_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    subtype text,
    account_group_id uuid,
    currency_id uuid,
    is_reconcilable boolean DEFAULT false,
    is_active boolean DEFAULT true,
    CONSTRAINT chart_of_accounts_company_id_code_key UNIQUE (company_id, code),
    CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    room_id uuid,
    sender_id uuid,
    message text,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chat_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    room_id uuid,
    profile_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chat_participants_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text,
    type text NOT NULL,
    department_id bigint,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chat_rooms_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.companies (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    name text NOT NULL,
    code text,
    display_name text,
    legal_name text,
    email text,
    phone text,
    website text,
    address_line_1 text,
    address_line_2 text,
    city text,
    state text,
    country text,
    zip_code text,
    tax_id text,
    currency text DEFAULT 'USD'::text,
    timezone text,
    logo_url text,
    theme_color text,
    status text DEFAULT 'active'::text,
    subscription_status text DEFAULT 'active'::text,
    group_company_id uuid,
    CONSTRAINT companies_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_attachments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    module text NOT NULL,
    record_id text NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_size integer,
    file_type text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_attachments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_automations (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    trigger_event text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb,
    action_type text NOT NULL,
    action_config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_automations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_contacts (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    email text,
    phone text,
    role text,
    company text,
    status text DEFAULT 'Active'::text,
    notes text,
    last_contact timestamp with time zone,
    owner_id uuid,
    CONSTRAINT crm_contacts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_customers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    customer_type text DEFAULT 'Company'::text,
    lifecycle_stage text DEFAULT 'Customer'::text,
    primary_email text,
    primary_phone text,
    billing_address_line_1 text,
    billing_address_line_2 text,
    billing_city text,
    billing_state text,
    billing_country text,
    billing_zip_code text,
    website text,
    industry text,
    tax_id text,
    owner_id uuid,
    status text DEFAULT 'Active'::text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT crm_customers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_deals (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    title text NOT NULL,
    company text NOT NULL,
    value numeric DEFAULT 0,
    stage text DEFAULT 'LEAD'::text,
    due_date date,
    owner_id uuid,
    tag text,
    tag_color text,
    employee_owner_id uuid,
    CONSTRAINT crm_deals_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_documents (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid,
    name text NOT NULL,
    file_url text NOT NULL,
    document_type_id integer,
    uploaded_by uuid,
    related_type text,
    related_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_documents_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_leads (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    series text,
    status text DEFAULT 'New'::text,
    salutation text,
    first_name text NOT NULL,
    middle_name text,
    last_name text,
    gender text,
    job_title text,
    email text,
    mobile text,
    phone text,
    phone_ext text,
    whatsapp text,
    website text,
    lead_type text,
    request_type text,
    lead_source_id uuid,
    lead_owner_id uuid,
    organization_name text,
    no_of_employees text,
    annual_revenue numeric,
    industry text,
    market_segment text,
    territory text,
    fax text,
    address_line_1 text,
    address_line_2 text,
    city text,
    state text,
    country text,
    zip_code text,
    qualification_notes text,
    is_converted boolean DEFAULT false,
    converted_customer_id uuid,
    converted_opportunity_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT crm_leads_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_opportunities (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    title text NOT NULL,
    series text,
    customer_id uuid,
    lead_id uuid,
    stage_id uuid,
    status text DEFAULT 'Open'::text,
    probability numeric DEFAULT 0,
    type text DEFAULT 'Sales'::text,
    source_id uuid,
    expected_closing_date date,
    currency text DEFAULT 'USD'::text,
    amount numeric DEFAULT 0,
    owner_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT crm_opportunities_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_proposal_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    requester_id uuid,
    customer_id uuid,
    customer_details jsonb,
    requirements text NOT NULL,
    requested_delivery_date date,
    status text DEFAULT 'Pending Proposal Creation'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_proposal_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_proposals (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    request_id uuid,
    customer_id uuid,
    title text NOT NULL,
    pricing_details jsonb DEFAULT '[]'::jsonb,
    grand_total numeric DEFAULT 0.00,
    terms_and_conditions text,
    status text DEFAULT 'Draft'::text,
    is_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_proposals_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_quotation_lines (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    quotation_id uuid,
    item_id uuid,
    item_name text NOT NULL,
    description text,
    quantity numeric NOT NULL DEFAULT 1,
    rate numeric NOT NULL DEFAULT 0.00,
    discount_percent numeric DEFAULT 0.00,
    tax_percent numeric DEFAULT 0.00,
    sort_order integer DEFAULT 0,
    CONSTRAINT crm_quotation_lines_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_quotations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    series text,
    customer_id uuid,
    quotation_date date,
    valid_until date,
    status text DEFAULT 'Draft'::text,
    currency text DEFAULT 'QAR'::text,
    subtotal numeric DEFAULT 0.00,
    tax_amount numeric DEFAULT 0.00,
    discount_amount numeric DEFAULT 0.00,
    grand_total numeric DEFAULT 0.00,
    terms_and_conditions text,
    notes text,
    opportunity_id uuid,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_quotations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_tasks (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    title text NOT NULL,
    description text,
    status text DEFAULT 'To Do'::text,
    priority text DEFAULT 'Medium'::text,
    due_date date,
    assignee text,
    owner_id uuid,
    CONSTRAINT crm_tasks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_website_finder_jobs (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    created_by uuid,
    status text DEFAULT 'DRAFT'::text,
    countries_checked jsonb DEFAULT '[]'::jsonb,
    total_records integer DEFAULT 0,
    processed_records integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT crm_website_finder_jobs_pkey PRIMARY KEY (id),
    CONSTRAINT crm_website_finder_jobs_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'RUNNING'::text, 'COMPLETED'::text, 'FAILED'::text])))
);

CREATE TABLE IF NOT EXISTS public.crm_website_finder_results (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    job_id uuid NOT NULL,
    company_name text NOT NULL,
    website_url text,
    branch_presence jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'PENDING'::text,
    attempts integer DEFAULT 0,
    raw_response text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT crm_website_finder_results_pkey PRIMARY KEY (id),
    CONSTRAINT crm_website_finder_results_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'SUCCESS'::text, 'FAILED'::text, 'RATE_LIMITED'::text])))
);

CREATE TABLE IF NOT EXISTS public.delete_audit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    deleted_by_email text NOT NULL,
    deleted_by_uid uuid NOT NULL,
    record_type text NOT NULL,
    record_id text NOT NULL,
    record_name text,
    deleted_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT delete_audit_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.departments (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'Active'::text,
    head_of_department_id uuid,
    CONSTRAINT departments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.device_attendance_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    device_id uuid,
    employee_identifier text NOT NULL,
    employee_id uuid,
    punch_time timestamp with time zone NOT NULL,
    punch_type text DEFAULT 'auto'::text,
    raw_data jsonb,
    sync_status text DEFAULT 'pending'::text,
    sync_error text,
    synced_at timestamp with time zone,
    attendance_record_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT device_attendance_logs_pkey PRIMARY KEY (id),
    CONSTRAINT device_attendance_logs_punch_type_check CHECK ((punch_type = ANY (ARRAY['check_in'::text, 'check_out'::text, 'auto'::text]))),
    CONSTRAINT device_attendance_logs_sync_status_check CHECK ((sync_status = ANY (ARRAY['pending'::text, 'synced'::text, 'failed'::text, 'skipped'::text])))
);

CREATE TABLE IF NOT EXISTS public.device_integrations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    device_name text NOT NULL,
    device_type text NOT NULL,
    connection_type text NOT NULL,
    ip_address text,
    port integer,
    api_key text DEFAULT encode(gen_random_bytes(32), 'hex'::text),
    status text DEFAULT 'active'::text,
    last_sync_at timestamp with time zone,
    sync_count integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT device_integrations_api_key_key UNIQUE (api_key),
    CONSTRAINT device_integrations_connection_type_check CHECK ((connection_type = ANY (ARRAY['usb'::text, 'camera'::text, 'network'::text, 'webhook'::text]))),
    CONSTRAINT device_integrations_device_type_check CHECK ((device_type = ANY (ARRAY['barcode_scanner'::text, 'camera'::text, 'biometric'::text, 'attendance_machine'::text]))),
    CONSTRAINT device_integrations_pkey PRIMARY KEY (id),
    CONSTRAINT device_integrations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'error'::text])))
);

CREATE TABLE IF NOT EXISTS public.doc_documents (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    file_url text NOT NULL,
    expiry_date date,
    access_level text DEFAULT 'All'::text,
    last_updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT doc_documents_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.duty_roster (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    employee_id uuid NOT NULL,
    shift_id bigint NOT NULL,
    date date NOT NULL,
    notes text,
    CONSTRAINT duty_roster_company_id_employee_id_date_key UNIQUE (company_id, employee_id, date),
    CONSTRAINT duty_roster_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.employee_career_timeline (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    employee_id uuid NOT NULL,
    event_date date NOT NULL,
    event_type text NOT NULL,
    title text NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    visibility text DEFAULT 'ALL'::text,
    CONSTRAINT employee_career_timeline_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.employee_compensation_versions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    employee_id uuid NOT NULL,
    effective_date date NOT NULL,
    ctc numeric NOT NULL DEFAULT 0,
    currency text DEFAULT 'INR'::text,
    component_breakdown jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT false,
    reason text,
    transition_id uuid,
    CONSTRAINT employee_compensation_versions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.employee_documents (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    document_type text NOT NULL DEFAULT 'Other'::text,
    document_name text NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size bigint DEFAULT 0,
    mime_type text,
    issue_date date,
    expiry_date date,
    notes text,
    is_active boolean DEFAULT true,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT employee_documents_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.employee_insights (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    employee_id uuid,
    type text NOT NULL,
    score numeric,
    status text DEFAULT 'ACTIVE'::text,
    data jsonb DEFAULT '{}'::jsonb,
    generated_at timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    CONSTRAINT employee_insights_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.employee_job_transitions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    employee_id uuid NOT NULL,
    transition_type text NOT NULL,
    current_data jsonb DEFAULT '{}'::jsonb,
    new_data jsonb DEFAULT '{}'::jsonb,
    effective_date date NOT NULL,
    reason text,
    remarks text,
    status text DEFAULT 'PENDING'::text,
    requester_id uuid,
    approver_id uuid,
    approval_date timestamp with time zone,
    rejection_reason text,
    CONSTRAINT employee_job_transitions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.employee_leave_balances (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    leave_type_id uuid NOT NULL,
    calendar_year_id uuid,
    total_balance numeric DEFAULT 0,
    used numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT employee_leave_balances_employee_id_leave_type_id_calendar__key UNIQUE (employee_id, leave_type_id, calendar_year_id),
    CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.employee_skills (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    employee_id uuid,
    skill_id uuid,
    proficiency_level integer,
    verification_status text DEFAULT 'Self-Declared'::text,
    verified_by uuid,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT employee_skills_employee_id_skill_id_key UNIQUE (employee_id, skill_id),
    CONSTRAINT employee_skills_pkey PRIMARY KEY (id),
    CONSTRAINT employee_skills_proficiency_level_check CHECK (((proficiency_level >= 1) AND (proficiency_level <= 5)))
);

CREATE TABLE IF NOT EXISTS public.employee_targets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    employee_id uuid NOT NULL,
    target_period text NOT NULL,
    target_year integer NOT NULL,
    target_period_val integer NOT NULL,
    target_amount numeric NOT NULL DEFAULT 0.00,
    achieved_amount numeric DEFAULT 0.00,
    incentive_rate numeric DEFAULT 0.00,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT employee_targets_company_id_employee_id_target_period_targe_key UNIQUE (company_id, employee_id, target_period, target_year, target_period_val),
    CONSTRAINT employee_targets_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.employees (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    profile_id uuid,
    user_account_linked boolean DEFAULT false,
    role_id uuid,
    employee_code text,
    name text NOT NULL,
    date_of_birth date,
    age integer,
    gender text,
    faith_id bigint,
    blood_group_id bigint,
    marital_status_id bigint,
    personal_mobile text,
    office_mobile text,
    personal_email text,
    office_email text,
    phone text,
    current_address text,
    permanent_address text,
    department_id bigint,
    designation_id bigint,
    grade_id bigint,
    location_id bigint,
    employment_type_id bigint,
    join_date date,
    manager_id uuid,
    department text,
    designation text,
    role text,
    pay_group_id bigint,
    salary_amount numeric,
    bank_name text,
    account_number text,
    ifsc_code text,
    profile_photo_url text,
    documents jsonb DEFAULT '[]'::jsonb,
    leave_balance jsonb DEFAULT '{"sick": 10, "casual": 12, "privilege": 15}'::jsonb,
    status text DEFAULT 'Active'::text,
    passport_number text,
    passport_expiry date,
    visa_number text,
    visa_expiry date,
    visa_sponsor text,
    visa_type text,
    client_name text,
    email text,
    shift_timing_id bigint,
    weekoff_rule_id bigint,
    nationality text,
    hamad_card_expiry date,
    air_ticket text,
    annual_leave_duration_policy text,
    memo text,
    remarks text,
    nationality_id bigint,
    visa_type_id bigint,
    employee_status_id bigint,
    leave_plan_id bigint,
    ticket_frequency text,
    CONSTRAINT employees_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.financial_masters_cost_centers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    is_active boolean DEFAULT true,
    CONSTRAINT financial_masters_cost_centers_company_id_code_key UNIQUE (company_id, code),
    CONSTRAINT financial_masters_cost_centers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.financial_masters_currencies (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    symbol text,
    is_active boolean DEFAULT true,
    CONSTRAINT financial_masters_currencies_company_id_code_key UNIQUE (company_id, code),
    CONSTRAINT financial_masters_currencies_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.financial_masters_exchange_rates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    from_currency text NOT NULL,
    to_currency text NOT NULL,
    rate numeric NOT NULL,
    effective_date date NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT financial_masters_exchange_rates_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fiscal_years (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_closed boolean DEFAULT false,
    CONSTRAINT fiscal_years_company_id_name_key UNIQUE (company_id, name),
    CONSTRAINT fiscal_years_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fixed_asset_depreciation (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    asset_id uuid NOT NULL,
    period_date date NOT NULL,
    amount numeric NOT NULL,
    notes text,
    journal_entry_id uuid,
    CONSTRAINT fixed_asset_depreciation_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fixed_assets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    asset_code text,
    category text NOT NULL DEFAULT 'equipment'::text,
    description text,
    purchase_date date NOT NULL,
    purchase_value numeric NOT NULL DEFAULT 0,
    salvage_value numeric NOT NULL DEFAULT 0,
    useful_life_years numeric NOT NULL DEFAULT 5,
    depreciation_method text NOT NULL DEFAULT 'straight_line'::text,
    accumulated_depreciation numeric NOT NULL DEFAULT 0,
    net_book_value numeric,
    status text NOT NULL DEFAULT 'active'::text,
    disposal_date date,
    disposal_value numeric,
    location text,
    supplier text,
    warranty_expiry date,
    account_id uuid,
    depreciation_account_id uuid,
    CONSTRAINT fixed_assets_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.grni_reconciliation (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    po_reference text NOT NULL,
    grn_reference_id uuid,
    invoice_reference_id uuid,
    amount numeric NOT NULL,
    status text DEFAULT 'OPEN'::text,
    CONSTRAINT grni_reconciliation_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.group_companies (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    name text NOT NULL,
    code text NOT NULL,
    status text DEFAULT 'active'::text,
    logo_url text,
    description text,
    CONSTRAINT group_companies_code_key UNIQUE (code),
    CONSTRAINT group_companies_pkey PRIMARY KEY (id),
    CONSTRAINT group_companies_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);

CREATE TABLE IF NOT EXISTS public.holidays (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    date date NOT NULL,
    type text NOT NULL DEFAULT 'Public'::text,
    applicable_to text DEFAULT 'All'::text,
    is_recurring boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT holidays_company_id_date_key UNIQUE (company_id, date),
    CONSTRAINT holidays_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.hrms_benefit_claims (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    benefit_id uuid,
    claim_date date NOT NULL DEFAULT CURRENT_DATE,
    claim_amount numeric NOT NULL,
    receipt_url text,
    description text,
    status text NOT NULL DEFAULT 'PENDING'::text,
    approved_by uuid,
    approved_at timestamp with time zone,
    workflow_instance_id uuid,
    CONSTRAINT hrms_benefit_claims_pkey PRIMARY KEY (id),
    CONSTRAINT hrms_benefit_claims_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'PAID'::text])))
);

CREATE TABLE IF NOT EXISTS public.hrms_benefits (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    benefit_type text NOT NULL,
    tier_name text NOT NULL,
    coverage_details jsonb DEFAULT '{}'::jsonb,
    company_contribution numeric DEFAULT 0.00,
    employee_contribution numeric DEFAULT 0.00,
    annual_limit numeric,
    balance numeric,
    status text NOT NULL DEFAULT 'ACTIVE'::text,
    CONSTRAINT hrms_benefits_benefit_type_check CHECK ((benefit_type = ANY (ARRAY['MEDICAL_INSURANCE'::text, 'AIR_TICKET'::text, 'HOUSING'::text, 'TRANSPORT'::text, 'OTHER'::text]))),
    CONSTRAINT hrms_benefits_pkey PRIMARY KEY (id),
    CONSTRAINT hrms_benefits_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'SUSPENDED'::text, 'EXPIRED'::text])))
);

CREATE TABLE IF NOT EXISTS public.hrms_perf_cycles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT'::text,
    CONSTRAINT hrms_perf_cycles_pkey PRIMARY KEY (id),
    CONSTRAINT hrms_perf_cycles_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'COMPLETED'::text])))
);

CREATE TABLE IF NOT EXISTS public.hrms_perf_goals (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    target_value numeric NOT NULL,
    current_value numeric DEFAULT 0.00,
    unit text DEFAULT '%'::text,
    due_date date NOT NULL,
    weightage numeric DEFAULT 1.00,
    status text NOT NULL DEFAULT 'NOT_STARTED'::text,
    CONSTRAINT hrms_perf_goals_pkey PRIMARY KEY (id),
    CONSTRAINT hrms_perf_goals_status_check CHECK ((status = ANY (ARRAY['NOT_STARTED'::text, 'IN_PROGRESS'::text, 'ACHIEVED'::text, 'MISSED'::text])))
);

CREATE TABLE IF NOT EXISTS public.hrms_perf_reviews (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL,
    cycle_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    self_rating numeric,
    self_comments text,
    manager_rating numeric,
    manager_comments text,
    final_rating numeric,
    status text NOT NULL DEFAULT 'PENDING_SELF'::text,
    CONSTRAINT hrms_perf_reviews_pkey PRIMARY KEY (id),
    CONSTRAINT hrms_perf_reviews_status_check CHECK ((status = ANY (ARRAY['PENDING_SELF'::text, 'PENDING_MANAGER'::text, 'COMPLETED'::text])))
);

CREATE TABLE IF NOT EXISTS public.hrms_travel_expenses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL,
    travel_request_id uuid,
    expense_date date NOT NULL DEFAULT CURRENT_DATE,
    category text NOT NULL,
    amount numeric NOT NULL,
    currency text DEFAULT 'QAR'::text,
    exchange_rate numeric DEFAULT 1.000000,
    receipt_url text,
    description text,
    status text NOT NULL DEFAULT 'PENDING'::text,
    CONSTRAINT hrms_travel_expenses_category_check CHECK ((category = ANY (ARRAY['FLIGHT'::text, 'HOTEL'::text, 'MEAL'::text, 'LOCAL_TRANSPORT'::text, 'PER_DIEM'::text, 'MISC'::text]))),
    CONSTRAINT hrms_travel_expenses_pkey PRIMARY KEY (id),
    CONSTRAINT hrms_travel_expenses_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'PAID'::text])))
);

CREATE TABLE IF NOT EXISTS public.hrms_travel_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    purpose text NOT NULL,
    destination text NOT NULL,
    departure_date date NOT NULL,
    return_date date NOT NULL,
    estimated_cost numeric DEFAULT 0.00,
    need_flight boolean DEFAULT false,
    need_hotel boolean DEFAULT false,
    flight_details text,
    hotel_details text,
    status text NOT NULL DEFAULT 'PENDING'::text,
    workflow_instance_id uuid,
    CONSTRAINT hrms_travel_requests_pkey PRIMARY KEY (id),
    CONSTRAINT hrms_travel_requests_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'COMPLETED'::text])))
);

CREATE TABLE IF NOT EXISTS public.inventory_account_config (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    category text,
    inventory_asset_account text NOT NULL,
    cogs_account text NOT NULL,
    stock_adjustment_account text NOT NULL,
    grni_account text NOT NULL,
    CONSTRAINT inventory_account_config_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.inventory_adjustment_lines (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    adjustment_id uuid,
    item_id uuid NOT NULL,
    bin_id uuid,
    batch_number text,
    system_qty numeric NOT NULL DEFAULT 0,
    counted_qty numeric NOT NULL DEFAULT 0,
    difference_qty numeric,
    justification text,
    CONSTRAINT inventory_adjustment_lines_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    warehouse_id uuid NOT NULL,
    reason_id uuid NOT NULL,
    reference_number text,
    adjustment_date date DEFAULT CURRENT_DATE,
    status text DEFAULT 'DRAFT'::text,
    approved_by uuid,
    approved_at timestamp with time zone,
    notes text,
    CONSTRAINT inventory_adjustments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.inventory_reasons (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    type text NOT NULL,
    description text,
    CONSTRAINT inventory_reasons_company_id_name_key UNIQUE (company_id, name),
    CONSTRAINT inventory_reasons_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    item_id uuid,
    warehouse_id uuid,
    reserved_qty numeric NOT NULL,
    reference_type text NOT NULL,
    reference_id uuid NOT NULL,
    status text DEFAULT 'Active'::text,
    CONSTRAINT inventory_reservations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    posting_date date DEFAULT CURRENT_DATE,
    transaction_type text NOT NULL,
    item_id uuid,
    warehouse_id uuid,
    quantity numeric NOT NULL,
    unit_cost numeric DEFAULT 0,
    total_value numeric,
    reference_type text,
    reference_id uuid,
    batch_number text,
    serial_number text,
    CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.item_master (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    uom text NOT NULL,
    valuation_method text DEFAULT 'FIFO'::text,
    is_stockable boolean DEFAULT true,
    is_batch_tracked boolean DEFAULT false,
    is_serial_tracked boolean DEFAULT false,
    status text DEFAULT 'Active'::text,
    storage_category_id uuid,
    putaway_strategy text DEFAULT 'FIFO'::text,
    picking_method text DEFAULT 'FIFO'::text,
    income_account_id uuid,
    expense_account_id uuid,
    is_manufactured boolean DEFAULT false,
    is_subcontracted boolean DEFAULT false,
    default_bom_id uuid,
    weight numeric DEFAULT 0,
    expiry_date date,
    barcode text,
    reorder_level numeric DEFAULT 0,
    reorder_qty numeric DEFAULT 0,
    photo_url text,
    image_urls jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT item_master_company_id_code_key UNIQUE (company_id, code),
    CONSTRAINT item_master_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.journals (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    default_account_id uuid,
    sequence_prefix text,
    CONSTRAINT journals_company_id_code_key UNIQUE (company_id, code),
    CONSTRAINT journals_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.kudos_rewards (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    sender_id uuid,
    receiver_id uuid,
    category_id bigint,
    message text,
    is_public boolean DEFAULT true,
    CONSTRAINT kudos_rewards_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.learning_courses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    title text NOT NULL,
    description text,
    thumbnail_url text,
    total_modules integer DEFAULT 0,
    is_published boolean DEFAULT true,
    CONSTRAINT learning_courses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.learning_modules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    course_id uuid,
    title text NOT NULL,
    description text,
    video_url text,
    duration_minutes integer,
    CONSTRAINT learning_modules_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.learning_progress (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    course_id uuid,
    employee_id uuid,
    progress_percentage integer DEFAULT 0,
    completed_module_ids jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'Not Started'::text,
    CONSTRAINT learning_progress_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.leave_accrual_rules (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    leave_type_id bigint NOT NULL,
    accrual_frequency text NOT NULL DEFAULT 'Monthly'::text,
    accrual_amount numeric NOT NULL DEFAULT 1.50,
    max_balance numeric DEFAULT 30.00,
    carry_forward boolean DEFAULT false,
    carry_forward_max numeric DEFAULT 5.00,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT leave_accrual_rules_company_id_leave_type_id_key UNIQUE (company_id, leave_type_id),
    CONSTRAINT leave_accrual_rules_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.leave_applications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    employee_id uuid,
    leave_type_id bigint,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    status text DEFAULT 'Pending'::text,
    applied_on timestamp with time zone DEFAULT now(),
    rejection_reason text,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT leave_applications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.leave_balances (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    leave_type_id bigint NOT NULL,
    year integer NOT NULL DEFAULT EXTRACT(year FROM CURRENT_DATE),
    opening_balance numeric DEFAULT 0,
    accrued numeric DEFAULT 0,
    used numeric DEFAULT 0,
    adjusted numeric DEFAULT 0,
    closing_balance numeric,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT leave_balances_company_id_employee_id_leave_type_id_year_key UNIQUE (company_id, employee_id, leave_type_id, year),
    CONSTRAINT leave_balances_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.leaves (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    employee_id uuid,
    type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    status text DEFAULT 'Pending'::text,
    manager_comment text,
    approved_by uuid,
    level1_status text DEFAULT 'Pending'::text,
    level2_status text DEFAULT 'Pending'::text,
    attachment_url text,
    attachment_name text,
    CONSTRAINT leaves_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.locations (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    address text,
    head_of_location_id uuid,
    status text DEFAULT 'Active'::text,
    CONSTRAINT locations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.master_kudos_categories (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    description text,
    icon text,
    points integer DEFAULT 0,
    status text DEFAULT 'Active'::text,
    CONSTRAINT master_kudos_categories_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.missed_punch_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    request_date date NOT NULL,
    punch_type text NOT NULL,
    requested_time timestamp with time zone NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'Pending'::text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    is_active boolean DEFAULT true,
    CONSTRAINT missed_punch_requests_pkey PRIMARY KEY (id),
    CONSTRAINT missed_punch_requests_punch_type_check CHECK ((punch_type = ANY (ARRAY['check_in'::text, 'check_out'::text]))),
    CONSTRAINT missed_punch_requests_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text])))
);

CREATE TABLE IF NOT EXISTS public.mrp_bom (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric DEFAULT 1,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    CONSTRAINT mrp_bom_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mrp_bom_lines (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    bom_id uuid,
    item_id uuid NOT NULL,
    quantity numeric NOT NULL,
    uom text,
    CONSTRAINT mrp_bom_lines_pkey PRIMARY KEY (id),
    CONSTRAINT mrp_bom_lines_quantity_check CHECK ((quantity > (0)::numeric))
);

CREATE TABLE IF NOT EXISTS public.mrp_production_moves (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    production_order_id uuid,
    item_id uuid NOT NULL,
    move_type text NOT NULL,
    quantity_demand numeric DEFAULT 0,
    quantity_done numeric DEFAULT 0,
    stock_move_id uuid,
    CONSTRAINT mrp_production_moves_move_type_check CHECK ((move_type = ANY (ARRAY['consumed'::text, 'produced'::text]))),
    CONSTRAINT mrp_production_moves_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mrp_production_orders (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    product_id uuid NOT NULL,
    bom_id uuid,
    quantity_to_produce numeric NOT NULL,
    quantity_produced numeric DEFAULT 0,
    date_planned date DEFAULT CURRENT_DATE,
    date_start timestamp with time zone,
    date_finished timestamp with time zone,
    work_center_id uuid,
    warehouse_id uuid,
    state text DEFAULT 'draft'::text,
    notes text,
    CONSTRAINT mrp_production_orders_pkey PRIMARY KEY (id),
    CONSTRAINT mrp_production_orders_quantity_to_produce_check CHECK ((quantity_to_produce > (0)::numeric)),
    CONSTRAINT mrp_production_orders_state_check CHECK ((state = ANY (ARRAY['draft'::text, 'confirmed'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text])))
);

CREATE TABLE IF NOT EXISTS public.mrp_routing (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    code text,
    product_id uuid,
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT mrp_routing_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mrp_routing_lines (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    routing_id uuid,
    sequence integer NOT NULL DEFAULT 10,
    operation_name text NOT NULL,
    work_center_id uuid,
    duration_hours numeric NOT NULL DEFAULT 0,
    notes text,
    CONSTRAINT mrp_routing_lines_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mrp_work_centers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    code text,
    capacity_per_day numeric DEFAULT 8,
    cost_per_hour numeric DEFAULT 0,
    is_active boolean DEFAULT true,
    CONSTRAINT mrp_work_centers_company_id_name_key UNIQUE (company_id, name),
    CONSTRAINT mrp_work_centers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notification_settings (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    event_type text NOT NULL,
    module text NOT NULL,
    email_enabled boolean DEFAULT true,
    in_app_enabled boolean DEFAULT true,
    notify_roles text[],
    CONSTRAINT notification_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    user_id uuid,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'INFO'::text,
    link text,
    is_read boolean DEFAULT false,
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_ai_settings (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    provider text NOT NULL,
    api_key_encrypted text NOT NULL,
    model text DEFAULT 'gemini-2.5-flash'::text,
    status text DEFAULT 'ACTIVE'::text,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT org_ai_settings_company_id_provider_key UNIQUE (company_id, provider),
    CONSTRAINT org_ai_settings_pkey PRIMARY KEY (id),
    CONSTRAINT org_ai_settings_provider_check CHECK ((provider = 'GEMINI'::text)),
    CONSTRAINT org_ai_settings_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'DISABLED'::text])))
);

CREATE TABLE IF NOT EXISTS public.org_attendance_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    default_weekly_off_days text DEFAULT '5,6'::text,
    notes text,
    CONSTRAINT org_attendance_settings_company_id_key UNIQUE (company_id),
    CONSTRAINT org_attendance_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_attendance_status (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    affects_salary boolean DEFAULT true,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_attendance_status_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_bank_configs (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    bank_name text NOT NULL,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_bank_configs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_blood_groups (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_blood_groups_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_confirmation_status (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_confirmation_status_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_crm_stages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    position integer NOT NULL DEFAULT 1,
    win_probability numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'Active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT org_crm_stages_pkey PRIMARY KEY (id),
    CONSTRAINT org_crm_stages_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])))
);

CREATE TABLE IF NOT EXISTS public.org_designations (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_designations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_employee_statuses (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    code text,
    name text NOT NULL,
    company_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT org_employee_statuses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_employment_types (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_employment_types_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_exit_reasons (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_exit_reasons_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_faiths (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_faiths_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_financial_years (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    code text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT org_financial_years_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_grades (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_grades_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_holiday_calendar (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    holiday_date date NOT NULL,
    is_mandatory boolean DEFAULT true,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_holiday_calendar_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_holidays (
    id serial,
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    date date NOT NULL,
    description text,
    is_recurring boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT org_holidays_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_lead_sources (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'Active'::text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT org_lead_sources_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_leave_calendar_years (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    year integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT org_leave_calendar_years_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_leave_plans (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    code text,
    name text NOT NULL,
    description text,
    company_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT org_leave_plans_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_leave_policies (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    leave_type_id bigint,
    max_consecutive_days integer,
    can_carry_forward boolean DEFAULT false,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_leave_policies_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_leave_types (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    default_balance integer DEFAULT 0,
    is_paid boolean DEFAULT true,
    requires_approval boolean DEFAULT true,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_leave_types_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_marital_status (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_marital_status_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_marital_statuses (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    name text NOT NULL,
    company_id uuid,
    code text,
    CONSTRAINT org_marital_statuses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_nationalities (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_nationalities_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_pay_groups (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    pay_frequency text NOT NULL,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_pay_groups_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_payroll_months (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    financial_year_id uuid,
    month_year date NOT NULL,
    status text DEFAULT 'OPEN'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT org_payroll_months_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_probation_periods (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    duration_months integer NOT NULL,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_probation_periods_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_punch_rules (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    min_work_hours numeric DEFAULT 8.0,
    overtime_threshold_hours numeric DEFAULT 9.0,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_punch_rules_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_salary_components (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    component_type text NOT NULL,
    is_taxable boolean DEFAULT true,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_salary_components_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_shift_timings (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    grace_period_minutes integer DEFAULT 0,
    status text DEFAULT 'Active'::text,
    weekly_off_days text DEFAULT '5,6'::text,
    CONSTRAINT org_shift_timings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_skills (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    category text,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT org_skills_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_task_priority (
    id bigserial,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT '0c0b0d78-4531-412e-8fa3-bbc74b7145ae'::uuid,
    name text NOT NULL,
    level integer DEFAULT 0,
    color text,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_task_priority_company_id_name_key UNIQUE (company_id, name),
    CONSTRAINT org_task_priority_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_task_status (
    id bigserial,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT '0c0b0d78-4531-412e-8fa3-bbc74b7145ae'::uuid,
    name text NOT NULL,
    is_closed boolean DEFAULT false,
    color text,
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_task_status_company_id_name_key UNIQUE (company_id, name),
    CONSTRAINT org_task_status_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_visa_types (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    code text,
    name text NOT NULL,
    company_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT org_visa_types_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.org_weekoff_rules (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    code text NOT NULL,
    name text NOT NULL,
    weekdays text[],
    status text DEFAULT 'Active'::text,
    CONSTRAINT org_weekoff_rules_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payroll (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    employee_id uuid,
    month text NOT NULL,
    gross_salary numeric NOT NULL,
    deductions numeric DEFAULT 0,
    net_salary numeric NOT NULL,
    status text DEFAULT 'Draft'::text,
    payment_date date,
    CONSTRAINT payroll_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payroll_loans (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    loan_type text NOT NULL,
    amount numeric NOT NULL,
    emi_amount numeric NOT NULL,
    balance numeric NOT NULL,
    status text NOT NULL DEFAULT 'Active'::text,
    start_date date NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT payroll_loans_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payroll_records (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    employee_id uuid,
    month_year text NOT NULL,
    basic_salary numeric DEFAULT 0,
    net_pay numeric DEFAULT 0,
    gross_earning numeric DEFAULT 0,
    total_deduction numeric DEFAULT 0,
    status text DEFAULT 'DRAFT'::text,
    created_at timestamp with time zone DEFAULT now(),
    payment_date date,
    ot_amount numeric DEFAULT 0,
    loan_deduction numeric DEFAULT 0,
    payable_days numeric DEFAULT 0,
    lop_days numeric DEFAULT 0,
    fixed_allowance numeric DEFAULT 0,
    variable_allowance numeric DEFAULT 0,
    CONSTRAINT payroll_records_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text,
    period_start date,
    period_end date,
    status text DEFAULT 'draft'::text,
    total_amount numeric DEFAULT 0,
    CONSTRAINT payroll_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payslips (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    payroll_run_id uuid,
    employee_id uuid,
    basic_salary numeric DEFAULT 0,
    gross_salary numeric DEFAULT 0,
    net_salary numeric DEFAULT 0,
    status text DEFAULT 'draft'::text,
    CONSTRAINT payslips_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.pm_projects (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'Planning'::text,
    budget numeric DEFAULT 0,
    start_date date,
    end_date date,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT pm_projects_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.pm_tasks (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    assignee_id uuid,
    status text NOT NULL DEFAULT 'To Do'::text,
    progress_pct integer DEFAULT 0,
    due_date date,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT pm_tasks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.pm_timesheets (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    task_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    hours numeric NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT pm_timesheets_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.poll_options (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    poll_id uuid,
    option_text text NOT NULL,
    vote_count integer DEFAULT 0,
    CONSTRAINT poll_options_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.polls (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    company_id uuid DEFAULT get_my_company_id(),
    question text NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_by uuid,
    CONSTRAINT polls_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.print_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT print_templates_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    email text,
    full_name text,
    company_id uuid,
    role text DEFAULT 'user'::text,
    employee_id uuid,
    avatar_url text,
    CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    order_id uuid,
    item_id uuid NOT NULL,
    quantity numeric NOT NULL,
    unit_price numeric DEFAULT 0,
    quantity_received numeric DEFAULT 0,
    subtotal numeric,
    CONSTRAINT purchase_order_lines_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_order_lines_quantity_check CHECK ((quantity > (0)::numeric))
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    partner_id uuid NOT NULL,
    order_date date DEFAULT CURRENT_DATE,
    expected_date date,
    warehouse_id uuid,
    state text DEFAULT 'draft'::text,
    notes text,
    total_amount numeric DEFAULT 0,
    CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_orders_state_check CHECK ((state = ANY (ARRAY['draft'::text, 'confirmed'::text, 'received'::text, 'cancelled'::text])))
);

CREATE TABLE IF NOT EXISTS public.putaway_rules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    warehouse_id uuid NOT NULL,
    storage_category_id uuid,
    target_zone_id uuid NOT NULL,
    priority integer DEFAULT 1,
    is_active boolean DEFAULT true,
    CONSTRAINT putaway_rules_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.recruitment_applicants (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL,
    job_id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    resume_url text NOT NULL,
    cover_letter text,
    stage text NOT NULL DEFAULT 'APPLIED'::text,
    interview_date timestamp with time zone,
    interviewer_notes text,
    rating integer,
    CONSTRAINT recruitment_applicants_pkey PRIMARY KEY (id),
    CONSTRAINT recruitment_applicants_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT recruitment_applicants_stage_check CHECK ((stage = ANY (ARRAY['APPLIED'::text, 'SCREENING'::text, 'INTERVIEW'::text, 'OFFER_MADE'::text, 'HIRED'::text, 'REJECTED'::text])))
);

CREATE TABLE IF NOT EXISTS public.recruitment_jobs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL,
    title text NOT NULL,
    department_id bigint,
    location text NOT NULL,
    employment_type text NOT NULL,
    description text NOT NULL,
    requirements text,
    salary_range_min numeric,
    salary_range_max numeric,
    status text NOT NULL DEFAULT 'DRAFT'::text,
    views integer DEFAULT 0,
    CONSTRAINT recruitment_jobs_pkey PRIMARY KEY (id),
    CONSTRAINT recruitment_jobs_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'CLOSED'::text])))
);

CREATE TABLE IF NOT EXISTS public.reminders (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    type text NOT NULL,
    target_filter jsonb DEFAULT '{}'::jsonb,
    schedule_config jsonb DEFAULT '{}'::jsonb,
    recipients_config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    CONSTRAINT reminders_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.report_definitions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    module text NOT NULL,
    config jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT report_definitions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.report_schema_registry (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    module text NOT NULL,
    field_key text NOT NULL,
    field_label text NOT NULL,
    data_type text NOT NULL,
    is_filterable boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    source_table text,
    is_sortable boolean DEFAULT true,
    CONSTRAINT report_schema_registry_module_field_key_unique UNIQUE (module, field_key),
    CONSTRAINT report_schema_registry_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.resignations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    employee_id uuid,
    reason_text text,
    reason_category text,
    proposed_last_working_date date,
    status text DEFAULT 'Pending'::text,
    manager_comment text,
    attachment_url text,
    attachment_name text,
    CONSTRAINT resignations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.roles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    description text,
    permissions text[],
    status text DEFAULT 'Active'::text,
    scope text DEFAULT 'COMPANY'::text,
    CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.sales_order_lines (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    order_id uuid,
    item_id uuid NOT NULL,
    quantity numeric NOT NULL,
    unit_price numeric DEFAULT 0,
    quantity_delivered numeric DEFAULT 0,
    reservation_id uuid,
    subtotal numeric,
    CONSTRAINT sales_order_lines_pkey PRIMARY KEY (id),
    CONSTRAINT sales_order_lines_quantity_check CHECK ((quantity > (0)::numeric))
);

CREATE TABLE IF NOT EXISTS public.sales_orders (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    partner_id uuid NOT NULL,
    order_date date DEFAULT CURRENT_DATE,
    commitment_date date,
    warehouse_id uuid,
    state text DEFAULT 'draft'::text,
    notes text,
    total_amount numeric DEFAULT 0,
    CONSTRAINT sales_orders_pkey PRIMARY KEY (id),
    CONSTRAINT sales_orders_state_check CHECK ((state = ANY (ARRAY['draft'::text, 'confirmed'::text, 'shipped'::text, 'invoiced'::text, 'cancelled'::text])))
);

CREATE TABLE IF NOT EXISTS public.sla_tracking (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    sla_hours integer NOT NULL DEFAULT 48,
    start_time timestamp with time zone DEFAULT now(),
    due_time timestamp with time zone NOT NULL,
    completed_time timestamp with time zone,
    status text DEFAULT 'Pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sla_tracking_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.stock_alerts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    item_id uuid,
    warehouse_id uuid,
    alert_type text NOT NULL,
    severity text DEFAULT 'WARNING'::text,
    message text NOT NULL,
    current_qty numeric DEFAULT 0,
    reorder_level numeric DEFAULT 0,
    is_resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT stock_alerts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    item_id uuid,
    movement_type text NOT NULL,
    from_bin_id uuid,
    to_bin_id uuid,
    quantity numeric NOT NULL,
    reference_type text,
    reference_id uuid,
    performed_by uuid,
    CONSTRAINT stock_movements_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.storage_categories (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    CONSTRAINT storage_categories_company_id_name_key UNIQUE (company_id, name),
    CONSTRAINT storage_categories_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.survey_questions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    survey_id uuid,
    question_text text NOT NULL,
    question_type text NOT NULL,
    options jsonb DEFAULT '[]'::jsonb,
    is_required boolean DEFAULT true,
    CONSTRAINT survey_questions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.survey_responses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    survey_id uuid,
    employee_id uuid,
    responses jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT survey_responses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.surveys (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    title text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    expiration_date date,
    CONSTRAINT surveys_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.taxes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    type text DEFAULT 'Percent'::text,
    scope text DEFAULT 'Sales'::text,
    amount numeric NOT NULL,
    account_id uuid,
    refund_account_id uuid,
    is_active boolean DEFAULT true,
    CONSTRAINT taxes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tickets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    employee_id uuid,
    subject text NOT NULL,
    description text,
    category text DEFAULT 'General'::text,
    priority text DEFAULT 'Medium'::text,
    status text DEFAULT 'Open'::text,
    assigned_to uuid,
    attachment_url text,
    attachment_name text,
    CONSTRAINT tickets_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_company_access (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    role_id uuid,
    is_default boolean DEFAULT false,
    status text DEFAULT 'active'::text,
    CONSTRAINT user_company_access_pkey PRIMARY KEY (id),
    CONSTRAINT user_company_access_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
    CONSTRAINT user_company_access_user_id_company_id_key UNIQUE (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
    id bigserial,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    permission text NOT NULL,
    granted boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_permissions_pkey PRIMARY KEY (id),
    CONSTRAINT user_permissions_user_id_company_id_permission_key UNIQUE (user_id, company_id, permission)
);

CREATE TABLE IF NOT EXISTS public.warehouse_bins (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    zone_id uuid,
    name text NOT NULL,
    code text NOT NULL,
    capacity numeric,
    is_active boolean DEFAULT true,
    CONSTRAINT warehouse_bins_pkey PRIMARY KEY (id),
    CONSTRAINT warehouse_bins_zone_id_code_key UNIQUE (zone_id, code)
);

CREATE TABLE IF NOT EXISTS public.warehouse_zones (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    warehouse_id uuid,
    name text NOT NULL,
    code text NOT NULL,
    zone_type text DEFAULT 'STORAGE'::text,
    CONSTRAINT warehouse_zones_pkey PRIMARY KEY (id),
    CONSTRAINT warehouse_zones_warehouse_id_code_key UNIQUE (warehouse_id, code)
);

CREATE TABLE IF NOT EXISTS public.warehouses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    code text NOT NULL,
    address text,
    is_active boolean DEFAULT true,
    CONSTRAINT warehouses_company_id_code_key UNIQUE (company_id, code),
    CONSTRAINT warehouses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workflow_action_logs (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    instance_id uuid,
    step_id uuid,
    actor_id uuid,
    action text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_action_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workflow_instances (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_id uuid NOT NULL,
    workflow_id uuid,
    module text NOT NULL,
    trigger_type text NOT NULL,
    entity_id uuid NOT NULL,
    current_step_id uuid,
    status text NOT NULL DEFAULT 'PENDING'::text,
    requester_id uuid,
    assigned_to_user_id uuid,
    assigned_to_role_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_instances_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workflow_levels (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    workflow_id uuid,
    level_order integer NOT NULL,
    level_name text NOT NULL,
    approver_type text NOT NULL,
    approver_ids text[],
    approver_logic text DEFAULT 'ANY'::text,
    CONSTRAINT workflow_levels_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workflow_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    workflow_id uuid,
    source_id text NOT NULL,
    current_step integer DEFAULT 1,
    status text DEFAULT 'PENDING'::text,
    requester_id uuid,
    CONSTRAINT workflow_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workflow_steps (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    workflow_id uuid,
    step_order integer NOT NULL,
    name text NOT NULL,
    approver_role_id uuid,
    is_final_step boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_steps_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workflows (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    company_id uuid NOT NULL DEFAULT get_my_company_id(),
    name text NOT NULL,
    description text,
    module text NOT NULL,
    trigger_type text NOT NULL,
    is_active boolean DEFAULT true,
    level_order_type text DEFAULT 'SEQUENTIAL'::text,
    criteria jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT workflows_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------------------------
-- FOREIGN KEY CONSTRAINTS
-- ------------------------------------------------------------------------------

ALTER TABLE ONLY public.companies ADD CONSTRAINT companies_group_company_id_fkey FOREIGN KEY (group_company_id) REFERENCES group_companies(id);
ALTER TABLE ONLY public.missed_punch_requests ADD CONSTRAINT missed_punch_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE ONLY public.missed_punch_requests ADD CONSTRAINT missed_punch_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.missed_punch_requests ADD CONSTRAINT missed_punch_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES employees(id);
ALTER TABLE ONLY public.crm_automations ADD CONSTRAINT crm_automations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.payroll_records ADD CONSTRAINT payroll_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.crm_documents ADD CONSTRAINT crm_documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE ONLY public.crm_documents ADD CONSTRAINT crm_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES employees(id);
ALTER TABLE ONLY public.purchase_orders ADD CONSTRAINT purchase_orders_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES accounting_partners(id);
ALTER TABLE ONLY public.purchase_orders ADD CONSTRAINT purchase_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE ONLY public.purchase_order_lines ADD CONSTRAINT purchase_order_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.purchase_order_lines ADD CONSTRAINT purchase_order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sales_orders ADD CONSTRAINT sales_orders_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES accounting_partners(id);
ALTER TABLE ONLY public.sales_orders ADD CONSTRAINT sales_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE ONLY public.sales_order_lines ADD CONSTRAINT sales_order_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.sales_order_lines ADD CONSTRAINT sales_order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.activity_logs ADD CONSTRAINT activity_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.report_definitions ADD CONSTRAINT report_definitions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.financial_masters_cost_centers ADD CONSTRAINT financial_masters_cost_centers_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES financial_masters_cost_centers(id);
ALTER TABLE ONLY public.hrms_benefits ADD CONSTRAINT hrms_benefits_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hrms_benefits ADD CONSTRAINT hrms_benefits_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hrms_travel_expenses ADD CONSTRAINT hrms_travel_expenses_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hrms_travel_expenses ADD CONSTRAINT hrms_travel_expenses_travel_request_id_fkey FOREIGN KEY (travel_request_id) REFERENCES hrms_travel_requests(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.crm_proposal_requests ADD CONSTRAINT crm_proposal_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES crm_customers(id);
ALTER TABLE ONLY public.crm_proposal_requests ADD CONSTRAINT crm_proposal_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES employees(id);
ALTER TABLE ONLY public.hrms_benefit_claims ADD CONSTRAINT hrms_benefit_claims_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id);
ALTER TABLE ONLY public.hrms_benefit_claims ADD CONSTRAINT hrms_benefit_claims_benefit_id_fkey FOREIGN KEY (benefit_id) REFERENCES hrms_benefits(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.hrms_benefit_claims ADD CONSTRAINT hrms_benefit_claims_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hrms_benefit_claims ADD CONSTRAINT hrms_benefit_claims_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hrms_travel_requests ADD CONSTRAINT hrms_travel_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hrms_travel_requests ADD CONSTRAINT hrms_travel_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.chat_messages ADD CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.chat_messages ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.crm_proposals ADD CONSTRAINT crm_proposals_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES crm_customers(id);
ALTER TABLE ONLY public.crm_proposals ADD CONSTRAINT crm_proposals_request_id_fkey FOREIGN KEY (request_id) REFERENCES crm_proposal_requests(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.buzz_posts ADD CONSTRAINT buzz_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.buzz_posts ADD CONSTRAINT buzz_posts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES buzz_posts(id);
ALTER TABLE ONLY public.buzz_likes ADD CONSTRAINT buzz_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES buzz_posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.buzz_likes ADD CONSTRAINT buzz_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.attendance_records ADD CONSTRAINT attendance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.payslips ADD CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.payslips ADD CONSTRAINT payslips_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.mrp_routing ADD CONSTRAINT mrp_routing_product_id_fkey FOREIGN KEY (product_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.mrp_routing_lines ADD CONSTRAINT mrp_routing_lines_routing_id_fkey FOREIGN KEY (routing_id) REFERENCES mrp_routing(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.mrp_routing_lines ADD CONSTRAINT mrp_routing_lines_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES mrp_work_centers(id);
ALTER TABLE ONLY public.duty_roster ADD CONSTRAINT duty_roster_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.duty_roster ADD CONSTRAINT duty_roster_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES org_shift_timings(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_attendance_period_id_fkey FOREIGN KEY (attendance_period_id) REFERENCES attendance_periods(id);
ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES org_shift_timings(id);
ALTER TABLE ONLY public.org_crm_stages ADD CONSTRAINT org_crm_stages_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_company_access ADD CONSTRAINT fk_uca_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_company_access ADD CONSTRAINT user_company_access_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id);
ALTER TABLE ONLY public.user_company_access ADD CONSTRAINT user_company_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fixed_assets ADD CONSTRAINT fixed_assets_account_id_fkey FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id);
ALTER TABLE ONLY public.fixed_assets ADD CONSTRAINT fixed_assets_depreciation_account_id_fkey FOREIGN KEY (depreciation_account_id) REFERENCES chart_of_accounts(id);
ALTER TABLE ONLY public.hrms_perf_goals ADD CONSTRAINT hrms_perf_goals_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hrms_perf_goals ADD CONSTRAINT hrms_perf_goals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fixed_asset_depreciation ADD CONSTRAINT fixed_asset_depreciation_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES fixed_assets(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fixed_asset_depreciation ADD CONSTRAINT fixed_asset_depreciation_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.hrms_perf_cycles ADD CONSTRAINT hrms_perf_cycles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_periods ADD CONSTRAINT accounting_periods_accounting_fiscal_year_id_fkey FOREIGN KEY (accounting_fiscal_year_id) REFERENCES accounting_fiscal_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_periods ADD CONSTRAINT accounting_periods_fiscal_year_id_fkey FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.account_groups ADD CONSTRAINT account_groups_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES account_groups(id);
ALTER TABLE ONLY public.chart_of_accounts ADD CONSTRAINT chart_of_accounts_account_group_id_fkey FOREIGN KEY (account_group_id) REFERENCES account_groups(id);
ALTER TABLE ONLY public.journals ADD CONSTRAINT journals_default_account_id_fkey FOREIGN KEY (default_account_id) REFERENCES chart_of_accounts(id);
ALTER TABLE ONLY public.taxes ADD CONSTRAINT taxes_account_id_fkey FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id);
ALTER TABLE ONLY public.taxes ADD CONSTRAINT taxes_refund_account_id_fkey FOREIGN KEY (refund_account_id) REFERENCES chart_of_accounts(id);
ALTER TABLE ONLY public.accounting_move_lines ADD CONSTRAINT accounting_move_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id);
ALTER TABLE ONLY public.accounting_move_lines ADD CONSTRAINT accounting_move_lines_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES journals(id);
ALTER TABLE ONLY public.accounting_move_lines ADD CONSTRAINT accounting_move_lines_move_id_fkey FOREIGN KEY (move_id) REFERENCES accounting_moves(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_move_lines ADD CONSTRAINT accounting_move_lines_tax_line_id_fkey FOREIGN KEY (tax_line_id) REFERENCES taxes(id);
ALTER TABLE ONLY public.accounting_move_lines ADD CONSTRAINT fk_move_line_partner FOREIGN KEY (partner_id) REFERENCES accounting_partners(id);
ALTER TABLE ONLY public.hrms_perf_reviews ADD CONSTRAINT hrms_perf_reviews_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hrms_perf_reviews ADD CONSTRAINT hrms_perf_reviews_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES hrms_perf_cycles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hrms_perf_reviews ADD CONSTRAINT hrms_perf_reviews_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.recruitment_jobs ADD CONSTRAINT recruitment_jobs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.recruitment_jobs ADD CONSTRAINT recruitment_jobs_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_moves ADD CONSTRAINT accounting_moves_inventory_txn_id_fkey FOREIGN KEY (inventory_txn_id) REFERENCES inventory_transactions(id);
ALTER TABLE ONLY public.accounting_moves ADD CONSTRAINT accounting_moves_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES journals(id);
ALTER TABLE ONLY public.accounting_moves ADD CONSTRAINT accounting_moves_period_id_fkey FOREIGN KEY (period_id) REFERENCES accounting_periods(id);
ALTER TABLE ONLY public.accounting_moves ADD CONSTRAINT fk_move_partner FOREIGN KEY (partner_id) REFERENCES accounting_partners(id);
ALTER TABLE ONLY public.org_leave_policies ADD CONSTRAINT org_leave_policies_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES org_leave_types(id);
ALTER TABLE ONLY public.payroll ADD CONSTRAINT payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.accounting_partners ADD CONSTRAINT accounting_partners_property_account_payable_id_fkey FOREIGN KEY (property_account_payable_id) REFERENCES chart_of_accounts(id);
ALTER TABLE ONLY public.accounting_partners ADD CONSTRAINT accounting_partners_property_account_receivable_id_fkey FOREIGN KEY (property_account_receivable_id) REFERENCES chart_of_accounts(id);
ALTER TABLE ONLY public.leaves ADD CONSTRAINT leaves_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.leaves ADD CONSTRAINT leaves_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.crm_contacts ADD CONSTRAINT crm_contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.crm_tasks ADD CONSTRAINT crm_tasks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.workflow_levels ADD CONSTRAINT workflow_levels_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.workflow_requests ADD CONSTRAINT workflow_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.workflow_requests ADD CONSTRAINT workflow_requests_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflows(id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.stock_alerts ADD CONSTRAINT stock_alerts_item_id_fkey FOREIGN KEY (item_id) REFERENCES item_master(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.stock_alerts ADD CONSTRAINT stock_alerts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.crm_deals ADD CONSTRAINT crm_deals_employee_owner_id_fkey FOREIGN KEY (employee_owner_id) REFERENCES employees(id);
ALTER TABLE ONLY public.crm_deals ADD CONSTRAINT crm_deals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.kudos_rewards ADD CONSTRAINT kudos_rewards_category_id_fkey FOREIGN KEY (category_id) REFERENCES master_kudos_categories(id);
ALTER TABLE ONLY public.kudos_rewards ADD CONSTRAINT kudos_rewards_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES employees(id);
ALTER TABLE ONLY public.kudos_rewards ADD CONSTRAINT kudos_rewards_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES employees(id);
ALTER TABLE ONLY public.recruitment_applicants ADD CONSTRAINT recruitment_applicants_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.recruitment_applicants ADD CONSTRAINT recruitment_applicants_job_id_fkey FOREIGN KEY (job_id) REFERENCES recruitment_jobs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resignations ADD CONSTRAINT resignations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.survey_questions ADD CONSTRAINT survey_questions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.survey_responses ADD CONSTRAINT survey_responses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.survey_responses ADD CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id);
ALTER TABLE ONLY public.learning_modules ADD CONSTRAINT learning_modules_course_id_fkey FOREIGN KEY (course_id) REFERENCES learning_courses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.learning_progress ADD CONSTRAINT learning_progress_course_id_fkey FOREIGN KEY (course_id) REFERENCES learning_courses(id);
ALTER TABLE ONLY public.learning_progress ADD CONSTRAINT learning_progress_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.org_ai_settings ADD CONSTRAINT org_ai_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.workflow_steps ADD CONSTRAINT workflow_steps_approver_role_id_fkey FOREIGN KEY (approver_role_id) REFERENCES roles(id);
ALTER TABLE ONLY public.workflow_steps ADD CONSTRAINT workflow_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.crm_website_finder_jobs ADD CONSTRAINT crm_website_finder_jobs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.crm_website_finder_jobs ADD CONSTRAINT crm_website_finder_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE ONLY public.crm_website_finder_results ADD CONSTRAINT crm_website_finder_results_job_id_fkey FOREIGN KEY (job_id) REFERENCES crm_website_finder_jobs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.bank_statements ADD CONSTRAINT bank_statements_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES accounting_journals(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.bank_statement_lines ADD CONSTRAINT bank_statement_lines_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES accounting_partners(id);
ALTER TABLE ONLY public.bank_statement_lines ADD CONSTRAINT bank_statement_lines_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES accounting_payments(id);
ALTER TABLE ONLY public.bank_statement_lines ADD CONSTRAINT bank_statement_lines_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES bank_statements(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.workflow_instances ADD CONSTRAINT workflow_instances_assigned_to_role_id_fkey FOREIGN KEY (assigned_to_role_id) REFERENCES roles(id);
ALTER TABLE ONLY public.workflow_instances ADD CONSTRAINT workflow_instances_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.workflow_instances ADD CONSTRAINT workflow_instances_current_step_id_fkey FOREIGN KEY (current_step_id) REFERENCES workflow_steps(id);
ALTER TABLE ONLY public.workflow_instances ADD CONSTRAINT workflow_instances_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.workflow_instances ADD CONSTRAINT workflow_instances_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflows(id);
ALTER TABLE ONLY public.workflow_action_logs ADD CONSTRAINT workflow_action_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.workflow_action_logs ADD CONSTRAINT workflow_action_logs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.workflow_action_logs ADD CONSTRAINT workflow_action_logs_step_id_fkey FOREIGN KEY (step_id) REFERENCES workflow_steps(id);
ALTER TABLE ONLY public.device_integrations ADD CONSTRAINT device_integrations_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE ONLY public.accounting_payments ADD CONSTRAINT accounting_payments_accounting_entry_id_fkey FOREIGN KEY (accounting_entry_id) REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_payments ADD CONSTRAINT accounting_payments_accounting_journal_id_fkey FOREIGN KEY (accounting_journal_id) REFERENCES accounting_journals(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_payments ADD CONSTRAINT accounting_payments_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES journals(id);
ALTER TABLE ONLY public.accounting_payments ADD CONSTRAINT accounting_payments_move_id_fkey FOREIGN KEY (move_id) REFERENCES accounting_moves(id);
ALTER TABLE ONLY public.accounting_payments ADD CONSTRAINT accounting_payments_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES accounting_partners(id);
ALTER TABLE ONLY public.employee_skills ADD CONSTRAINT employee_skills_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.employee_skills ADD CONSTRAINT employee_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES org_skills(id);
ALTER TABLE ONLY public.employee_skills ADD CONSTRAINT employee_skills_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.employee_insights ADD CONSTRAINT employee_insights_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.employee_job_transitions ADD CONSTRAINT employee_job_transitions_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES employees(id);
ALTER TABLE ONLY public.employee_job_transitions ADD CONSTRAINT employee_job_transitions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.employee_job_transitions ADD CONSTRAINT employee_job_transitions_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES employees(id);
ALTER TABLE ONLY public.employee_compensation_versions ADD CONSTRAINT employee_compensation_versions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.employee_compensation_versions ADD CONSTRAINT employee_compensation_versions_transition_id_fkey FOREIGN KEY (transition_id) REFERENCES employee_job_transitions(id);
ALTER TABLE ONLY public.employee_career_timeline ADD CONSTRAINT employee_career_timeline_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.device_attendance_logs ADD CONSTRAINT device_attendance_logs_attendance_record_id_fkey FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id);
ALTER TABLE ONLY public.device_attendance_logs ADD CONSTRAINT device_attendance_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE ONLY public.device_attendance_logs ADD CONSTRAINT device_attendance_logs_device_id_fkey FOREIGN KEY (device_id) REFERENCES device_integrations(id);
ALTER TABLE ONLY public.device_attendance_logs ADD CONSTRAINT device_attendance_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.leave_applications ADD CONSTRAINT leave_applications_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.leave_applications ADD CONSTRAINT leave_applications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.leave_applications ADD CONSTRAINT leave_applications_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES org_leave_types(id);
ALTER TABLE ONLY public.assets ADD CONSTRAINT assets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES employees(id);
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id);
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.org_financial_years ADD CONSTRAINT org_financial_years_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.org_payroll_months ADD CONSTRAINT org_payroll_months_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.org_payroll_months ADD CONSTRAINT org_payroll_months_financial_year_id_fkey FOREIGN KEY (financial_year_id) REFERENCES org_financial_years(id);
ALTER TABLE ONLY public.org_leave_calendar_years ADD CONSTRAINT org_leave_calendar_years_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payroll_loans ADD CONSTRAINT payroll_loans_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payroll_loans ADD CONSTRAINT payroll_loans_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inventory_transactions ADD CONSTRAINT fk_inv_txn_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE ONLY public.inventory_transactions ADD CONSTRAINT inventory_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.inventory_reservations ADD CONSTRAINT fk_inv_res_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE ONLY public.inventory_reservations ADD CONSTRAINT inventory_reservations_item_id_fkey FOREIGN KEY (item_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.warehouse_zones ADD CONSTRAINT warehouse_zones_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.warehouse_bins ADD CONSTRAINT warehouse_bins_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES warehouse_zones(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.stock_movements ADD CONSTRAINT stock_movements_from_bin_id_fkey FOREIGN KEY (from_bin_id) REFERENCES warehouse_bins(id);
ALTER TABLE ONLY public.stock_movements ADD CONSTRAINT stock_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.stock_movements ADD CONSTRAINT stock_movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.stock_movements ADD CONSTRAINT stock_movements_to_bin_id_fkey FOREIGN KEY (to_bin_id) REFERENCES warehouse_bins(id);
ALTER TABLE ONLY public.mrp_bom ADD CONSTRAINT mrp_bom_product_id_fkey FOREIGN KEY (product_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.accounting_entries ADD CONSTRAINT accounting_entries_reference_id_fkey FOREIGN KEY (reference_id) REFERENCES inventory_transactions(id);
ALTER TABLE ONLY public.grni_reconciliation ADD CONSTRAINT grni_reconciliation_grn_reference_id_fkey FOREIGN KEY (grn_reference_id) REFERENCES inventory_transactions(id);
ALTER TABLE ONLY public.mrp_bom_lines ADD CONSTRAINT mrp_bom_lines_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES mrp_bom(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.mrp_bom_lines ADD CONSTRAINT mrp_bom_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.mrp_production_orders ADD CONSTRAINT mrp_production_orders_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES mrp_bom(id);
ALTER TABLE ONLY public.mrp_production_orders ADD CONSTRAINT mrp_production_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.mrp_production_orders ADD CONSTRAINT mrp_production_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE ONLY public.mrp_production_orders ADD CONSTRAINT mrp_production_orders_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES mrp_work_centers(id);
ALTER TABLE ONLY public.mrp_production_moves ADD CONSTRAINT mrp_production_moves_item_id_fkey FOREIGN KEY (item_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.mrp_production_moves ADD CONSTRAINT mrp_production_moves_production_order_id_fkey FOREIGN KEY (production_order_id) REFERENCES mrp_production_orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.doc_documents ADD CONSTRAINT doc_documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.doc_documents ADD CONSTRAINT doc_documents_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES profiles(id);
ALTER TABLE ONLY public.item_master ADD CONSTRAINT item_master_default_bom_id_fkey FOREIGN KEY (default_bom_id) REFERENCES mrp_bom(id);
ALTER TABLE ONLY public.item_master ADD CONSTRAINT item_master_expense_account_id_fkey FOREIGN KEY (expense_account_id) REFERENCES chart_of_accounts(id);
ALTER TABLE ONLY public.item_master ADD CONSTRAINT item_master_income_account_id_fkey FOREIGN KEY (income_account_id) REFERENCES chart_of_accounts(id);
ALTER TABLE ONLY public.item_master ADD CONSTRAINT item_master_storage_category_id_fkey FOREIGN KEY (storage_category_id) REFERENCES storage_categories(id);
ALTER TABLE ONLY public.inventory_adjustment_lines ADD CONSTRAINT inventory_adjustment_lines_adjustment_id_fkey FOREIGN KEY (adjustment_id) REFERENCES inventory_adjustments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inventory_adjustment_lines ADD CONSTRAINT inventory_adjustment_lines_bin_id_fkey FOREIGN KEY (bin_id) REFERENCES warehouse_bins(id);
ALTER TABLE ONLY public.inventory_adjustment_lines ADD CONSTRAINT inventory_adjustment_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.employee_leave_balances ADD CONSTRAINT employee_leave_balances_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.employee_leave_balances ADD CONSTRAINT employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.putaway_rules ADD CONSTRAINT putaway_rules_storage_category_id_fkey FOREIGN KEY (storage_category_id) REFERENCES storage_categories(id);
ALTER TABLE ONLY public.putaway_rules ADD CONSTRAINT putaway_rules_target_zone_id_fkey FOREIGN KEY (target_zone_id) REFERENCES warehouse_zones(id);
ALTER TABLE ONLY public.putaway_rules ADD CONSTRAINT putaway_rules_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE ONLY public.inventory_adjustments ADD CONSTRAINT inventory_adjustments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.inventory_adjustments ADD CONSTRAINT inventory_adjustments_reason_id_fkey FOREIGN KEY (reason_id) REFERENCES inventory_reasons(id);
ALTER TABLE ONLY public.inventory_adjustments ADD CONSTRAINT inventory_adjustments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE ONLY public.user_permissions ADD CONSTRAINT user_permissions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_permissions ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pm_projects ADD CONSTRAINT pm_projects_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.polls ADD CONSTRAINT polls_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE ONLY public.polls ADD CONSTRAINT polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.poll_options ADD CONSTRAINT poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pm_tasks ADD CONSTRAINT pm_tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.pm_tasks ADD CONSTRAINT pm_tasks_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pm_tasks ADD CONSTRAINT pm_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES pm_projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pm_timesheets ADD CONSTRAINT pm_timesheets_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pm_timesheets ADD CONSTRAINT pm_timesheets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pm_timesheets ADD CONSTRAINT pm_timesheets_task_id_fkey FOREIGN KEY (task_id) REFERENCES pm_tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.holidays ADD CONSTRAINT holidays_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.employee_documents ADD CONSTRAINT employee_documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE ONLY public.employee_documents ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.employee_documents ADD CONSTRAINT employee_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_blood_group_id_fkey FOREIGN KEY (blood_group_id) REFERENCES org_blood_groups(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES org_designations(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_employee_status_id_fkey FOREIGN KEY (employee_status_id) REFERENCES org_employee_statuses(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_employment_type_id_fkey FOREIGN KEY (employment_type_id) REFERENCES org_employment_types(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_faith_id_fkey FOREIGN KEY (faith_id) REFERENCES org_faiths(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES org_grades(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_leave_plan_id_fkey FOREIGN KEY (leave_plan_id) REFERENCES org_leave_plans(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_marital_status_id_fkey FOREIGN KEY (marital_status_id) REFERENCES org_marital_status(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_nationality_id_fkey FOREIGN KEY (nationality_id) REFERENCES org_nationalities(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_pay_group_id_fkey FOREIGN KEY (pay_group_id) REFERENCES org_pay_groups(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id);
ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_visa_type_id_fkey FOREIGN KEY (visa_type_id) REFERENCES org_visa_types(id);
ALTER TABLE ONLY public.attendance_settings ADD CONSTRAINT attendance_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.org_visa_types ADD CONSTRAINT org_visa_types_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.org_employee_statuses ADD CONSTRAINT org_employee_statuses_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.org_leave_plans ADD CONSTRAINT org_leave_plans_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.leave_accrual_rules ADD CONSTRAINT leave_accrual_rules_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.leave_balances ADD CONSTRAINT leave_balances_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.leave_balances ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_fiscal_years ADD CONSTRAINT accounting_fiscal_years_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_account_groups ADD CONSTRAINT accounting_account_groups_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_account_groups ADD CONSTRAINT accounting_account_groups_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES accounting_account_groups(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_chart_of_accounts ADD CONSTRAINT accounting_chart_of_accounts_account_group_id_fkey FOREIGN KEY (account_group_id) REFERENCES accounting_account_groups(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_chart_of_accounts ADD CONSTRAINT accounting_chart_of_accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_chart_of_accounts ADD CONSTRAINT accounting_chart_of_accounts_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES financial_masters_currencies(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_cost_centers ADD CONSTRAINT accounting_cost_centers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_cost_centers ADD CONSTRAINT accounting_cost_centers_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES accounting_cost_centers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_journals ADD CONSTRAINT accounting_journals_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_journals ADD CONSTRAINT accounting_journals_default_account_id_fkey FOREIGN KEY (default_account_id) REFERENCES accounting_chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_taxes ADD CONSTRAINT accounting_taxes_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounting_chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_taxes ADD CONSTRAINT accounting_taxes_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_taxes ADD CONSTRAINT accounting_taxes_refund_account_id_fkey FOREIGN KEY (refund_account_id) REFERENCES accounting_chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_payment_terms ADD CONSTRAINT accounting_payment_terms_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_stock_categories ADD CONSTRAINT accounting_stock_categories_adjustment_account_id_fkey FOREIGN KEY (adjustment_account_id) REFERENCES accounting_chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_stock_categories ADD CONSTRAINT accounting_stock_categories_asset_account_id_fkey FOREIGN KEY (asset_account_id) REFERENCES accounting_chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_stock_categories ADD CONSTRAINT accounting_stock_categories_cogs_account_id_fkey FOREIGN KEY (cogs_account_id) REFERENCES accounting_chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_stock_categories ADD CONSTRAINT accounting_stock_categories_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_purchase_ledgers ADD CONSTRAINT accounting_purchase_ledgers_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounting_chart_of_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_purchase_ledgers ADD CONSTRAINT accounting_purchase_ledgers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_sales_ledgers ADD CONSTRAINT accounting_sales_ledgers_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounting_chart_of_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_sales_ledgers ADD CONSTRAINT accounting_sales_ledgers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_direct_expense_ledgers ADD CONSTRAINT accounting_direct_expense_ledgers_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounting_chart_of_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_direct_expense_ledgers ADD CONSTRAINT accounting_direct_expense_ledgers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_indirect_income_ledgers ADD CONSTRAINT accounting_indirect_income_ledgers_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounting_chart_of_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_indirect_income_ledgers ADD CONSTRAINT accounting_indirect_income_ledgers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_journal_entries ADD CONSTRAINT accounting_journal_entries_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_journal_entries ADD CONSTRAINT accounting_journal_entries_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES accounting_journals(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_journal_entries ADD CONSTRAINT accounting_journal_entries_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES accounting_partners(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_journal_entries ADD CONSTRAINT accounting_journal_entries_period_id_fkey FOREIGN KEY (period_id) REFERENCES accounting_periods(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_journal_lines ADD CONSTRAINT accounting_journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounting_chart_of_accounts(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.accounting_journal_lines ADD CONSTRAINT accounting_journal_lines_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_journal_lines ADD CONSTRAINT accounting_journal_lines_contract_cost_center_id_fkey FOREIGN KEY (contract_cost_center_id) REFERENCES accounting_cost_centers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_journal_lines ADD CONSTRAINT accounting_journal_lines_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES accounting_cost_centers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_journal_lines ADD CONSTRAINT accounting_journal_lines_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES accounting_journal_entries(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.accounting_journal_lines ADD CONSTRAINT accounting_journal_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.accounting_journal_lines ADD CONSTRAINT accounting_journal_lines_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES accounting_partners(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.accounting_journal_lines ADD CONSTRAINT accounting_journal_lines_project_cost_center_id_fkey FOREIGN KEY (project_cost_center_id) REFERENCES accounting_cost_centers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.org_lead_sources ADD CONSTRAINT org_lead_sources_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.crm_leads ADD CONSTRAINT crm_leads_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.crm_leads ADD CONSTRAINT crm_leads_lead_owner_id_fkey FOREIGN KEY (lead_owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.crm_leads ADD CONSTRAINT crm_leads_lead_source_id_fkey FOREIGN KEY (lead_source_id) REFERENCES org_lead_sources(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.crm_customers ADD CONSTRAINT crm_customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.crm_customers ADD CONSTRAINT crm_customers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.crm_opportunities ADD CONSTRAINT crm_opportunities_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.crm_opportunities ADD CONSTRAINT crm_opportunities_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.crm_opportunities ADD CONSTRAINT crm_opportunities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.crm_opportunities ADD CONSTRAINT crm_opportunities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.crm_opportunities ADD CONSTRAINT crm_opportunities_source_id_fkey FOREIGN KEY (source_id) REFERENCES org_lead_sources(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.crm_opportunities ADD CONSTRAINT crm_opportunities_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES org_crm_stages(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.crm_attachments ADD CONSTRAINT crm_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id);
ALTER TABLE ONLY public.crm_quotations ADD CONSTRAINT crm_quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES crm_customers(id);
ALTER TABLE ONLY public.crm_quotations ADD CONSTRAINT crm_quotations_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES crm_opportunities(id);
ALTER TABLE ONLY public.crm_quotations ADD CONSTRAINT crm_quotations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id);
ALTER TABLE ONLY public.crm_quotation_lines ADD CONSTRAINT crm_quotation_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES item_master(id);
ALTER TABLE ONLY public.crm_quotation_lines ADD CONSTRAINT crm_quotation_lines_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES crm_quotations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.employee_targets ADD CONSTRAINT employee_targets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE ONLY public.chat_rooms ADD CONSTRAINT chat_rooms_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id);
ALTER TABLE ONLY public.chat_participants ADD CONSTRAINT chat_participants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.chat_participants ADD CONSTRAINT chat_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------

ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_direct_expense_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_indirect_income_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_move_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_purchase_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_sales_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buzz_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buzz_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_proposal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_website_finder_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_website_finder_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delete_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_career_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_compensation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_job_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_masters_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_masters_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_masters_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_asset_depreciation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grni_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_benefit_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_perf_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_perf_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_perf_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_travel_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_travel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_account_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kudos_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_accrual_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_kudos_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missed_punch_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrp_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrp_bom_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrp_production_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrp_production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrp_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrp_routing_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrp_work_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_attendance_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_bank_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_blood_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_confirmation_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_employee_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_employment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_exit_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_faiths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_financial_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_holiday_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_leave_calendar_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_leave_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_marital_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_marital_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_nationalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_pay_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_payroll_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_probation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_punch_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_shift_timings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_visa_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_weekoff_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.putaway_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resignations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- POLICIES
-- ------------------------------------------------------------------------------

CREATE POLICY "Public Read Companies" ON public.companies FOR SELECT TO public USING (true);
CREATE POLICY "Tenant Isolation" ON public.companies FOR ALL TO public USING ((id = get_my_company_id())) WITH CHECK ((id = get_my_company_id()));
CREATE POLICY "Users can create companies" ON public.companies FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Managers can update missed punch requests" ON public.missed_punch_requests FOR UPDATE TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Users can insert own missed punch requests" ON public.missed_punch_requests FOR INSERT TO public WITH CHECK ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.profile_id = auth.uid()))));
CREATE POLICY "Users can view own missed punch requests" ON public.missed_punch_requests FOR SELECT TO public USING (((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.profile_id = auth.uid()))) OR (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Employees can view own payroll" ON public.payroll_records FOR SELECT TO public USING ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.profile_id = auth.uid()))));
CREATE POLICY "Tenant Isolation" ON public.payroll_records FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "crm_documents_access" ON public.crm_documents FOR ALL TO public USING (true);
CREATE POLICY "Tenant Isolation" ON public.purchase_orders FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.purchase_order_lines FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.sales_orders FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.sales_order_lines FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.activity_logs FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.financial_masters_exchange_rates FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.financial_masters_cost_centers FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.financial_masters_currencies FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company benefits" ON public.hrms_benefits FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company benefits" ON public.hrms_benefits FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company benefits" ON public.hrms_benefits FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company benefits" ON public.hrms_benefits FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation Holidays" ON public.org_holidays FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company travel expenses" ON public.hrms_travel_expenses FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company travel expenses" ON public.hrms_travel_expenses FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company travel expenses" ON public.hrms_travel_expenses FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company travel expenses" ON public.hrms_travel_expenses FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation crm_proposal_requests" ON public.crm_proposal_requests FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company benefit claims" ON public.hrms_benefit_claims FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company benefit claims" ON public.hrms_benefit_claims FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company benefit claims" ON public.hrms_benefit_claims FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company benefit claims" ON public.hrms_benefit_claims FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company travel requests" ON public.hrms_travel_requests FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company travel requests" ON public.hrms_travel_requests FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company travel requests" ON public.hrms_travel_requests FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company travel requests" ON public.hrms_travel_requests FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation chat_messages" ON public.chat_messages FOR ALL TO public USING ((room_id IN ( SELECT chat_rooms.id
   FROM chat_rooms
  WHERE (chat_rooms.company_id = get_my_company_id()))));
CREATE POLICY "Tenant Isolation crm_proposals" ON public.crm_proposals FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.buzz_posts FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can like" ON public.buzz_likes FOR ALL TO public USING (true);
CREATE POLICY "Tenant Isolation" ON public.attendance_records FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.payroll_runs FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.payslips FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "company_routing" ON public.mrp_routing FOR ALL TO authenticated USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "company_routing_lines" ON public.mrp_routing_lines FOR ALL TO authenticated USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.duty_roster FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.attendance_periods FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.attendance FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_crm_stages FOR ALL TO public USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_crm_stages" ON public.org_crm_stages FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Public Read Active Groups" ON public.group_companies FOR SELECT TO public USING ((status = 'active'::text));
CREATE POLICY "Tenant Isolation" ON public.group_companies FOR ALL TO public USING (true);
CREATE POLICY "Users can delete own access" ON public.user_company_access FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own access" ON public.user_company_access FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Users can see own access" ON public.user_company_access FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own access" ON public.user_company_access FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "company_fixed_assets" ON public.fixed_assets FOR ALL TO authenticated USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_attendance_settings FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation Settings" ON public.org_attendance_settings FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company perf goals" ON public.hrms_perf_goals FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company perf goals" ON public.hrms_perf_goals FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company perf goals" ON public.hrms_perf_goals FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company perf goals" ON public.hrms_perf_goals FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "company_asset_depreciation" ON public.fixed_asset_depreciation FOR ALL TO authenticated USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company perf cycles" ON public.hrms_perf_cycles FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company perf cycles" ON public.hrms_perf_cycles FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company perf cycles" ON public.hrms_perf_cycles FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company perf cycles" ON public.hrms_perf_cycles FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_periods FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.fiscal_years FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.account_groups FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.chart_of_accounts FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.journals FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.taxes FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_move_lines FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company perf reviews" ON public.hrms_perf_reviews FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company perf reviews" ON public.hrms_perf_reviews FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company perf reviews" ON public.hrms_perf_reviews FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company perf reviews" ON public.hrms_perf_reviews FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company jobs" ON public.recruitment_jobs FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company jobs" ON public.recruitment_jobs FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company jobs" ON public.recruitment_jobs FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company jobs" ON public.recruitment_jobs FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_moves FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.departments FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.locations FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_probation_periods FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_confirmation_status FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_exit_reasons FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_leave_policies FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_holiday_calendar FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.roles FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tenant Isolation" ON public.org_weekoff_rules FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_attendance_status FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_punch_rules FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.payroll FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_designations FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_designations" ON public.org_designations FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_designations" ON public.org_designations FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_designations" ON public.org_designations FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_designations" ON public.org_designations FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_grades FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_grades" ON public.org_grades FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_grades" ON public.org_grades FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_grades" ON public.org_grades FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_grades" ON public.org_grades FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_employment_types FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_employment_types" ON public.org_employment_types FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_employment_types" ON public.org_employment_types FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_employment_types" ON public.org_employment_types FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_employment_types" ON public.org_employment_types FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_salary_components FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_salary_components" ON public.org_salary_components FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_salary_components" ON public.org_salary_components FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_salary_components" ON public.org_salary_components FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_salary_components" ON public.org_salary_components FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_pay_groups FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_pay_groups" ON public.org_pay_groups FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_pay_groups" ON public.org_pay_groups FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_pay_groups" ON public.org_pay_groups FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_pay_groups" ON public.org_pay_groups FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_bank_configs FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_bank_configs" ON public.org_bank_configs FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_bank_configs" ON public.org_bank_configs FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_bank_configs" ON public.org_bank_configs FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_bank_configs" ON public.org_bank_configs FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_partners FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.leaves FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Anon can insert unlinked profile" ON public.profiles FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anon can update unlinked profile" ON public.profiles FOR UPDATE TO public USING ((company_id IS NULL)) WITH CHECK (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO public WITH CHECK ((id = auth.uid()));
CREATE POLICY "Users can see colleagues" ON public.profiles FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can see own profile" ON public.profiles FOR SELECT TO public USING ((id = auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO public USING ((auth.uid() = id));
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY "Tenant Isolation" ON public.crm_contacts FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.crm_tasks FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.workflows FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.workflow_levels FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.workflow_requests FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.notification_settings FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.reminders FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.notifications FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.master_kudos_categories FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete master_kudos_categories" ON public.master_kudos_categories FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert master_kudos_categories" ON public.master_kudos_categories FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update master_kudos_categories" ON public.master_kudos_categories FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view master_kudos_categories" ON public.master_kudos_categories FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.stock_alerts FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.crm_deals FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.kudos_rewards FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.announcements FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company applicants" ON public.recruitment_applicants FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company applicants" ON public.recruitment_applicants FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company applicants" ON public.recruitment_applicants FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company applicants" ON public.recruitment_applicants FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.resignations FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.surveys FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete surveys" ON public.surveys FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert surveys" ON public.surveys FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update surveys" ON public.surveys FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view surveys" ON public.surveys FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.survey_questions FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.survey_responses FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.learning_courses FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.learning_modules FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.learning_progress FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Admins can manage AI settings" ON public.org_ai_settings FOR ALL TO public USING ((auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE ((profiles.company_id = org_ai_settings.company_id) AND (profiles.role = ANY (ARRAY['Bit'::text, 'Admin'::text, 'Super Admin'::text]))))));
CREATE POLICY "Users can create jobs for their company" ON public.crm_website_finder_jobs FOR INSERT TO public WITH CHECK ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Users can update their own jobs" ON public.crm_website_finder_jobs FOR UPDATE TO public USING ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Users can view jobs for their company" ON public.crm_website_finder_jobs FOR SELECT TO public USING ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Users can insert results for their company jobs" ON public.crm_website_finder_results FOR INSERT TO public WITH CHECK ((job_id IN ( SELECT crm_website_finder_jobs.id
   FROM crm_website_finder_jobs
  WHERE (crm_website_finder_jobs.company_id = ( SELECT profiles.company_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));
CREATE POLICY "Users can update results for their company jobs" ON public.crm_website_finder_results FOR UPDATE TO public USING ((job_id IN ( SELECT crm_website_finder_jobs.id
   FROM crm_website_finder_jobs
  WHERE (crm_website_finder_jobs.company_id = ( SELECT profiles.company_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));
CREATE POLICY "Users can view results for their company jobs" ON public.crm_website_finder_results FOR SELECT TO public USING ((job_id IN ( SELECT crm_website_finder_jobs.id
   FROM crm_website_finder_jobs
  WHERE (crm_website_finder_jobs.company_id = ( SELECT profiles.company_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));
CREATE POLICY "Tenant Isolation" ON public.bank_statements FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.bank_statement_lines FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "device_integrations_tenant_isolation" ON public.device_integrations FOR ALL TO public USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_payments FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Employees can view their own transitions" ON public.employee_job_transitions FOR SELECT TO public USING ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.profile_id = auth.uid()))));
CREATE POLICY "Tenant Isolation" ON public.employee_job_transitions FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Employees can view their own compensation history" ON public.employee_compensation_versions FOR SELECT TO public USING ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.profile_id = auth.uid()))));
CREATE POLICY "Tenant Isolation" ON public.employee_compensation_versions FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Employees can view their own timeline" ON public.employee_career_timeline FOR SELECT TO public USING ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.profile_id = auth.uid()))));
CREATE POLICY "Tenant Isolation" ON public.employee_career_timeline FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "device_attendance_logs_tenant_isolation" ON public.device_attendance_logs FOR ALL TO public USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Global Read" ON public.org_marital_statuses FOR ALL TO public USING (true);
CREATE POLICY "Employees can view own leaves" ON public.leave_applications FOR SELECT TO public USING ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.profile_id = auth.uid()))));
CREATE POLICY "Tenant Isolation" ON public.leave_applications FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Employees can view own assets" ON public.assets FOR SELECT TO public USING ((assigned_to IN ( SELECT employees.id
   FROM employees
  WHERE (employees.profile_id = auth.uid()))));
CREATE POLICY "Tenant Isolation" ON public.assets FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Employees can view own tickets" ON public.tickets FOR SELECT TO public USING ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.profile_id = auth.uid()))));
CREATE POLICY "Tenant Isolation" ON public.tickets FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_financial_years" ON public.org_financial_years FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_financial_years" ON public.org_financial_years FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_financial_years" ON public.org_financial_years FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_financial_years" ON public.org_financial_years FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_payroll_months" ON public.org_payroll_months FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_payroll_months" ON public.org_payroll_months FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_payroll_months" ON public.org_payroll_months FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_payroll_months" ON public.org_payroll_months FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_leave_calendar_years" ON public.org_leave_calendar_years FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_leave_calendar_years" ON public.org_leave_calendar_years FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_leave_calendar_years" ON public.org_leave_calendar_years FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_leave_calendar_years" ON public.org_leave_calendar_years FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_leave_types FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_leave_types" ON public.org_leave_types FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_leave_types" ON public.org_leave_types FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_leave_types" ON public.org_leave_types FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_leave_types" ON public.org_leave_types FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Global Read" ON public.org_faiths FOR ALL TO public USING (true);
CREATE POLICY "Tenant Isolation" ON public.org_faiths FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_faiths" ON public.org_faiths FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_faiths" ON public.org_faiths FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_faiths" ON public.org_faiths FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_faiths" ON public.org_faiths FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_marital_status FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_marital_status" ON public.org_marital_status FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_marital_status" ON public.org_marital_status FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_marital_status" ON public.org_marital_status FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_marital_status" ON public.org_marital_status FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Global Read" ON public.org_blood_groups FOR ALL TO public USING (true);
CREATE POLICY "Tenant Isolation" ON public.org_blood_groups FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_blood_groups" ON public.org_blood_groups FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_blood_groups" ON public.org_blood_groups FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_blood_groups" ON public.org_blood_groups FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_blood_groups" ON public.org_blood_groups FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_nationalities FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_nationalities" ON public.org_nationalities FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_nationalities" ON public.org_nationalities FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_nationalities" ON public.org_nationalities FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_nationalities" ON public.org_nationalities FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_shift_timings FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete org_shift_timings" ON public.org_shift_timings FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert org_shift_timings" ON public.org_shift_timings FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update org_shift_timings" ON public.org_shift_timings FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view org_shift_timings" ON public.org_shift_timings FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company loans" ON public.payroll_loans FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company loans" ON public.payroll_loans FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company loans" ON public.payroll_loans FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company loans" ON public.payroll_loans FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.inventory_transactions FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.inventory_reservations FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.warehouses FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.warehouse_zones FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.warehouse_bins FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.stock_movements FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.mrp_work_centers FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.mrp_bom FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.inventory_account_config FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_entries FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.grni_reconciliation FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.mrp_bom_lines FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.mrp_production_orders FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.mrp_production_moves FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company documents" ON public.doc_documents FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company documents" ON public.doc_documents FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company documents" ON public.doc_documents FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company documents" ON public.doc_documents FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.item_master FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.inventory_adjustment_lines FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Allow authenticated inserts" ON public.delete_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated select" ON public.delete_audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can delete employee_leave_balances" ON public.employee_leave_balances FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert employee_leave_balances" ON public.employee_leave_balances FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update employee_leave_balances" ON public.employee_leave_balances FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view employee_leave_balances" ON public.employee_leave_balances FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.storage_categories FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.inventory_reasons FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.putaway_rules FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.inventory_adjustments FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation sla_tracking" ON public.sla_tracking FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Company admin manages permissions" ON public.user_permissions FOR ALL TO public USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company projects" ON public.pm_projects FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company projects" ON public.pm_projects FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company projects" ON public.pm_projects FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company projects" ON public.pm_projects FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation Polls" ON public.polls FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation Poll Options" ON public.poll_options FOR ALL TO public USING ((poll_id IN ( SELECT polls.id
   FROM polls)));
CREATE POLICY "Tenant Isolation" ON public.print_templates FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company tasks" ON public.pm_tasks FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company tasks" ON public.pm_tasks FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company tasks" ON public.pm_tasks FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company tasks" ON public.pm_tasks FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can delete their company timesheets" ON public.pm_timesheets FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can insert their company timesheets" ON public.pm_timesheets FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Users can update their company timesheets" ON public.pm_timesheets FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Users can view their company timesheets" ON public.pm_timesheets FOR SELECT TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "holidays_delete" ON public.holidays FOR DELETE TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "holidays_insert" ON public.holidays FOR INSERT TO public WITH CHECK ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "holidays_select" ON public.holidays FOR SELECT TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "holidays_update" ON public.holidays FOR UPDATE TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "employee_documents_delete" ON public.employee_documents FOR DELETE TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "employee_documents_insert" ON public.employee_documents FOR INSERT TO public WITH CHECK ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "employee_documents_select" ON public.employee_documents FOR SELECT TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "employee_documents_update" ON public.employee_documents FOR UPDATE TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Tenant Isolation" ON public.employees FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "att_settings_insert" ON public.attendance_settings FOR INSERT TO public WITH CHECK ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "att_settings_select" ON public.attendance_settings FOR SELECT TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "att_settings_update" ON public.attendance_settings FOR UPDATE TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Allow all for company admins" ON public.org_visa_types FOR ALL TO public USING ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Allow select for company members" ON public.org_visa_types FOR SELECT TO public USING ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Allow all for company admins" ON public.org_employee_statuses FOR ALL TO public USING ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Allow select for company members" ON public.org_employee_statuses FOR SELECT TO public USING ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Allow all for company admins" ON public.org_leave_plans FOR ALL TO public USING ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Allow select for company members" ON public.org_leave_plans FOR SELECT TO public USING ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "accrual_delete" ON public.leave_accrual_rules FOR DELETE TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "accrual_insert" ON public.leave_accrual_rules FOR INSERT TO public WITH CHECK ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "accrual_select" ON public.leave_accrual_rules FOR SELECT TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "accrual_update" ON public.leave_accrual_rules FOR UPDATE TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "lb_insert" ON public.leave_balances FOR INSERT TO public WITH CHECK ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "lb_select" ON public.leave_balances FOR SELECT TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "lb_update" ON public.leave_balances FOR UPDATE TO public USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_fiscal_years FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_fiscal_years FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_fiscal_years FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_fiscal_years FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_account_groups FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_account_groups FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_account_groups FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_account_groups FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_chart_of_accounts FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_chart_of_accounts FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_chart_of_accounts FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_chart_of_accounts FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_cost_centers FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_cost_centers FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_cost_centers FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_cost_centers FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_journals FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_journals FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_journals FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_journals FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_taxes FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_taxes FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_taxes FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_taxes FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_payment_terms FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_payment_terms FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_payment_terms FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_payment_terms FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_stock_categories FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_stock_categories FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_stock_categories FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_stock_categories FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_purchase_ledgers FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_purchase_ledgers FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_purchase_ledgers FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_purchase_ledgers FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_sales_ledgers FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_sales_ledgers FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_sales_ledgers FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_sales_ledgers FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_direct_expense_ledgers FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_direct_expense_ledgers FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_direct_expense_ledgers FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_direct_expense_ledgers FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_indirect_income_ledgers FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_indirect_income_ledgers FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_indirect_income_ledgers FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_indirect_income_ledgers FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_journal_entries FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_journal_entries FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_journal_entries FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_journal_entries FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_journal_lines FOR DELETE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_journal_lines FOR INSERT TO public WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Permissive Tenant Update" ON public.accounting_journal_lines FOR UPDATE TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.accounting_journal_lines FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.org_lead_sources FOR ALL TO public USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.crm_leads FOR ALL TO public USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.crm_customers FOR ALL TO public USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation" ON public.crm_opportunities FOR ALL TO public USING ((company_id = get_my_company_id())) WITH CHECK ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation crm_attachments" ON public.crm_attachments FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation crm_quotations" ON public.crm_quotations FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation employee_targets" ON public.employee_targets FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation chat_rooms" ON public.chat_rooms FOR ALL TO public USING ((company_id = get_my_company_id()));
CREATE POLICY "Tenant Isolation chat_participants" ON public.chat_participants FOR ALL TO public USING ((room_id IN ( SELECT chat_rooms.id
   FROM chat_rooms
  WHERE (chat_rooms.company_id = get_my_company_id()))));

-- ------------------------------------------------------------------------------
-- TRIGGERS
-- ------------------------------------------------------------------------------

CREATE TRIGGER update_companies_timestamp BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_audit_attendance AFTER INSERT OR DELETE OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_accounting_moves AFTER INSERT OR DELETE OR UPDATE ON public.accounting_moves FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_payroll AFTER INSERT OR DELETE OR UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_leaves AFTER INSERT OR DELETE OR UPDATE ON public.leaves FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_start_leave_workflow AFTER INSERT ON public.leaves FOR EACH ROW EXECUTE FUNCTION trigger_start_leave_workflow();
CREATE TRIGGER trigger_update_leave_balance AFTER UPDATE ON public.leaves FOR EACH ROW EXECUTE FUNCTION handle_leave_approval();
CREATE TRIGGER trg_audit_crm_contacts AFTER INSERT OR DELETE OR UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_crm_tasks AFTER INSERT OR DELETE OR UPDATE ON public.crm_tasks FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_workflows AFTER INSERT OR DELETE OR UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_crm_deals AFTER INSERT OR DELETE OR UPDATE ON public.crm_deals FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_announcements AFTER INSERT OR DELETE OR UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_resignations AFTER INSERT OR DELETE OR UPDATE ON public.resignations FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_start_resignation_workflow AFTER INSERT ON public.resignations FOR EACH ROW EXECUTE FUNCTION trigger_start_resignation_workflow();
CREATE TRIGGER trg_audit_accounting_payments AFTER INSERT OR DELETE OR UPDATE ON public.accounting_payments FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_assets AFTER INSERT OR DELETE OR UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_tickets AFTER INSERT OR DELETE OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_warehouses AFTER INSERT OR DELETE OR UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_item_master AFTER INSERT OR DELETE OR UPDATE ON public.item_master FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER trg_audit_employees AFTER INSERT OR DELETE OR UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION log_user_activity();
CREATE TRIGGER set_accounting_entry_period_trigger BEFORE INSERT OR UPDATE OF date ON public.accounting_journal_entries FOR EACH ROW EXECUTE FUNCTION trigger_set_accounting_entry_period();

-- ------------------------------------------------------------------------------
-- VIEWS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vw_hr_payroll_reports AS
SELECT pr.id,
    pr.company_id,
    pr.month_year,
    e.employee_code,
    e.name AS employee_name,
    d.name AS department_name,
    pr.payable_days,
    pr.lop_days,
    pr.basic_salary,
    pr.fixed_allowance,
    pr.variable_allowance,
    pr.ot_amount,
    pr.gross_earning,
    pr.loan_deduction,
    pr.total_deduction,
    pr.net_pay,
    pr.status
   FROM ((payroll_records pr
     LEFT JOIN employees e ON ((pr.employee_id = e.id)))
     LEFT JOIN departments d ON ((e.department_id = d.id)));
