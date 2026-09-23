# Remediation Prompt: KAA ERP Live System

You are working on the KAA ERP codebase, which is connected to a **live production system and live database**. Review and remediate the issues below carefully.

## Non-negotiable live-data safeguards

1. **Do not delete, truncate, overwrite, reset, or bulk-modify any existing database data.** Do not clean up, deduplicate, normalize, or “repair” live records by deleting or replacing them.
2. Do not run migrations, SQL writes, seed scripts, RPCs, or application workflows against production. Do not test by creating or editing live business records.
3. Do not use `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, cascading deletes, destructive resets, or data-loss migrations. Preserve all existing records and identifiers.
4. Make code changes and additive, backward-compatible migration files only. The human operator must review migrations and choose a safe deployment window. If a change cannot be implemented without changing live data, stop and explain the tradeoff; do not perform it.
5. Keep production behavior safe during rollout: use additive schema changes, compatibility reads/writes where needed, feature flags or staged rollout for workflow changes, and rollback plans that do not erase newly created or existing records.
6. Never expose secrets, service-role credentials, personal data, payroll details, resumes, or document URLs in logs, generated reports, or test fixtures.
7. Do not claim an issue is fixed merely because the UI hides a button. Enforce authorization and data integrity in Postgres/server-side code as well as the client.
8. Do not run tests or write to a database unless explicitly asked. You may inspect source and migrations, add/update tests without running them if appropriate, and run safe static checks only when they do not touch live data.

## How to work

- First inspect the repository, current migrations, RLS policies, grants, RPC definitions, frontend service code, and relevant documentation. Confirm exact current behavior before editing; the findings below are audit leads, not permission to make assumptions.
- Prepare a prioritized remediation plan, then implement the changes in the repository. Preserve unrelated local changes.
- Treat existing production data as immutable during implementation. For every proposed constraint or policy, check how it behaves with existing rows without changing those rows. Prefer `NOT VALID` constraints followed by an explicitly reviewed validation plan when appropriate.
- For every security-sensitive workflow, establish identity from the verified server-side session (`auth.uid()` and trusted profile/company membership), not caller-supplied actor/company IDs. Enforce company ownership and role/assignment rules in RLS or RPCs. Apply least privilege to `anon` and `authenticated` grants.
- Make multi-record operations atomic with transactional database functions/RPCs. Check every Supabase error and report failure truthfully; do not report success after partial failure.
- Add regression tests for the bugs and authorization boundaries, but do not run tests that connect to production. Use mocks/local disposable fixtures or a local test database only when clearly isolated from live credentials.
- At completion, provide: (a) changed files, (b) each issue fixed or deferred, (c) migration and rollout order, (d) any manual decisions required, (e) tests/static checks performed and their environment, and (f) explicit confirmation that no live data was altered.

## Priority 0 — Cross-cutting tenant isolation and authorization

### 0.1 Company identity can be user-controlled

- Audit finding: `profiles` users can update their own profile without a restrictive `WITH CHECK`; the UI also changes `profiles.company_id`. `get_my_company_id()` derives tenant scope from the profile. This risks allowing a user to change their company context and cross tenant boundaries.
- Remediation: prevent ordinary users from changing `company_id`, role, employee linkage, and other privileged profile fields. Add restrictive RLS `USING` and `WITH CHECK` policies and/or a narrow server-side profile-update function that allowlists safe fields. Derive company membership from a trusted membership relation and authenticated identity. Define a controlled admin process for legitimate transfers. Preserve existing profile and membership records; do not mass-update company IDs.

### 0.2 Public/anonymous grants and RLS policies are too broad

- Audit findings include public/anon-executable `SECURITY DEFINER` RPCs, tables with RLS disabled, broadly granted CRUD, and policies using unconditional `true`. Live project-management tables have RLS enabled but permissive `USING (true) WITH CHECK (true)` policies, and `anon` has CRUD grants. Project category/type tables and manufacturing `mrp_*` tables also have `anon` CRUD grants; manufacturing policies are company-scoped but depend on the vulnerable company resolver. `workflow_instances` was found to allow anon CRUD. Several other tables/policies were found with public inserts or open policies, including `crm_documents`, `project_proposals`, `project_issues`, and `user_company_access`.
- Remediation: inventory all public schemas, tables, views, functions, policies, and grants. Revoke `anon` privileges by default; grant only explicitly required public access. Replace unconditional policies with authenticated, company-scoped policies tied to verified membership, and separate SELECT/INSERT/UPDATE/DELETE policies with suitable checks. Enable RLS where needed. Do not break intended public portal flows; model them explicitly with restricted RPCs, narrowly scoped tokens, or dedicated views. Preserve rows and verify current application flows before tightening.

### 0.3 `SECURITY DEFINER` RPCs lack server-side authorization

- Audit findings: numerous privileged RPCs are executable by `PUBLIC`/`anon` and/or do not check authentication, role, company ownership, approver assignment, or workflow state. Examples include `admin_update_user`, `admin_delete_user`, `approve_job_transition`, payroll operations, accounting operations, stock operations, attendance/leave operations, project proposal/completion workflows, and manufacturing production workflows.
- Remediation: for every definer function, set a safe fixed `search_path`, revoke default `PUBLIC`/`anon` execute rights, grant execute only to required roles, require a verified `auth.uid()`, and validate company membership, record ownership, actor role, assigned approver, and legal state transition inside the function. Do not trust `actor_id`, `company_id`, role, or approval stage supplied by the client. Return errors rather than silently succeeding. Audit intended service-role/background paths separately.

### 0.4 Security-definer views and mutable search paths

- Audit findings: four `SECURITY DEFINER` views with anon SELECT (`vw_crm_leads`, `vw_crm_customers`, `customers`, `vw_crm_opportunities`) may expose CRM contacts; 116 functions had mutable `search_path` settings.
- Remediation: remove public access or replace with safe invoker views and properly scoped access. Review columns for personal/contact data. Set explicit safe search paths on privileged functions and schema-qualify objects. Avoid blanket changes without checking dependencies.

## Priority 1 — Live data and document security

### 1.1 Storage bucket visibility and object policies

- Audit findings: `documents` is public, and it contains CRM documents and candidate resumes; public reads may expose sensitive files. Authenticated upload/update/delete policies are not owner/company scoped. `company-assets` is public and contains employee profile photos, with mutation policies not tenant-scoped. `employee-documents` is private, but company profile weaknesses undermine the boundary. Project file upload paths use `projects/${companyId}/...`, while the reviewed CRM attachment policy expects the first path segment to be the company UUID and CRM code uses `crm/${companyId}/...`; the CRM attachment upload path therefore appears incompatible with that policy.
- Remediation: classify every bucket and file type. Make sensitive buckets private; use authenticated tenant/owner checks for list/read/write/update/delete; issue short-lived signed URLs only after authorization. Fix path convention and policy together. Do not move, delete, rewrite, or bulk-change existing objects or stored URLs. Provide a compatibility plan so existing documents remain accessible after policy tightening. Never log signed URLs or file contents.

### 1.2 Upload helpers falsely report success

- Audit finding in project service: upload errors are only logged; `uploadProjectFile` still returns a public URL/path, allowing workflows to persist a broken document reference.
- Remediation: throw/return a typed failure when upload fails; persist a document reference only after confirmed upload. Clean up only a newly uploaded object if a subsequent operation fails, and only when it is unquestionably the object created by that same request. Never delete pre-existing files as compensation.

## Priority 2 — Accounting, invoices, payments, banking, and reports

### 2.1 Posting safety, locking, and authorization

- Audit findings: `rpc_post_accounting_entry` and `rpc_post_accounting_payment` do not lock the target row before validating state. Concurrent requests may both pass and post duplicate entries/movements. Payment posting may silently select the latest non-locked period when the payment date has no matching period. Privileged RPCs are public-executable and lack adequate actor/company checks.
- Remediation: require verified authenticated authorization; lock target rows (`SELECT ... FOR UPDATE`) or use an atomic conditional state transition; enforce idempotency and unique posting references; resolve periods strictly by transaction date and fail closed if no valid open period exists. Do not auto-reassign existing posted entries. Preserve posted records and use explicit reversal/correction entries for accounting corrections.

### 2.2 Invoice/bill tax and VAT-report data flow

- Audit findings: active `rpc_create_accounting_invoice` / `rpc_update_accounting_invoice` do not create tax lines and are publicly executable definer functions. The active UI omits tax fields. Qatar VAT report reads the legacy `accounting_moves` / `accounting_move_lines.tax_line_id` / `taxes` model, while the active invoice flow writes `accounting_journal_entries` / `accounting_journal_lines`; invoice/bill activity may not appear in the VAT report. VAT base classification uses move-level tax presence and can place a whole mixed-tax move into multiple categories.
- Remediation: define one canonical tax model and explicitly map invoice/bill line taxes into it. Update VAT reporting to calculate from line-level taxable bases/tax codes and handle mixed rates, exemptions, credit notes, and refunds correctly. Add reconciliation/preview tooling. Do not rewrite historic accounting rows automatically; produce read-only discrepancy reports and an approved migration plan if legacy records need mapping.

### 2.3 Inventory posting signs and cost handling

- Audit findings: accounting journal posting writes positive inventory quantity for all item lines, including outbound movement; stock-level/valuation sums signed quantities. Sales invoices and vendor credit notes can therefore increase on-hand quantity. `OutboundProcess.tsx` sends unit cost `0`, so outbound valuation/COGS may be zero. Outbound flow lacks an available-stock check. GoodsReceipt/Outbound user-entered reference is discarded by sending `p_ref_id: null`.
- Remediation: define consistent movement signs by movement type, model returns/credits correctly, derive validated cost from inventory valuation/cost layers rather than zero, enforce stock availability or explicit backorder/negative-stock rules, and persist the intended reference. Use atomic stock ledger posting and idempotency. Do not rewrite historic movements or balances; provide read-only impact reports and approved compensating entries if needed.

### 2.4 Purchase/sales order state checks

- Audit finding: receive/ship RPCs update quantities before checking order state, then return an error JSON (not a raised exception); earlier updates can commit despite apparent failure.
- Remediation: validate existence, tenant, status, quantities, and remaining balance before writes; perform validation and mutation in one transaction; raise an exception or return a consistent failure without committing partial changes. Add row locks and prevent over-receipt/over-shipment. Current live database had no purchase or sales order rows, so data behavior remains unverified.

### 2.5 Bank statement reconciliation

- Audit findings: `rpc_reconcile_statement_line` is a public-executable definer function with no sufficient company, amount, direction, date, or relationship validation. UI permits pairing any non-reconciled payment with any statement line, including draft payments; it does not verify amount/date/direction or journal state.
- Remediation: require actor/company authorization; validate company, posted state, currency, amount, direction, date tolerance, and that neither side is already matched; lock both records and make the operation atomic/idempotent. Keep a reversible reconciliation/unreconciliation audit. Existing aggregate checks found no orphan bank lines, company mismatches, zero amounts, duplicate payment links, or flag/link mismatches.

### 2.6 Invoice/bill UI reliability and duplicate prevention

- Audit findings: invoice/bill follow-up direct updates write metadata after RPC calls, ignore update errors, and can report success even when metadata persistence failed. Bills use unescaped `ILIKE` duplicate prechecks, ignore lookup errors, treat `%` and `_` as wildcards, and have no matching unique index; concurrent requests can create duplicate refs. Invoice credit-limit check ignores balance RPC errors and defaults to zero, bypassing the limit; credit notes may be treated as positive receivables and trigger false warnings.
- Remediation: persist metadata in the same authorized transaction as the record; surface and recover from errors. Use normalized exact comparisons and a database uniqueness strategy that respects company/journal/document semantics; first report existing conflicts read-only and do not delete duplicates. Fail closed if credit/balance lookup fails, and calculate credit-note impact with correct signs.

### 2.7 Date/time boundaries in reports

- Audit finding: several date fields use UTC `.toISOString().split('T')[0]` for local business dates. In Asia/Calcutta early morning this can select the prior day. DayBook constructs local month boundaries then converts to UTC, shifting the range and potentially including/excluding the wrong days. Similar logic exists in GeneralLedger, FinancialReports, ExpenseReport, and DailySalesReport.
- Remediation: treat date-only values as date strings without UTC conversion; compute inclusive/exclusive boundaries in the business timezone with tested month/year/leap-day cases. Avoid changing historical stored dates automatically.

### 2.8 Existing accounting data observations to review, not auto-fix

- Current audit found 11 of 20 posted general journal entries without an accounting period; posted invoices/bills had periods. One posted payment linked to a general journal entry has an amount differing from the entry total (could be intentional, requires review). Do not modify automatically.
- Other checks were clean: no orphan journal lines, header/line company mismatches, account/partner/journal mismatches, negative invoice/bill quantity/price, duplicate vendor invoice refs or voucher refs, invalid/overlapping periods, payment-company mismatches, missing accounting entries, or invalid payment amounts. Seven posted invoices with positive residual may be legitimate open balances.

## Priority 3 — CRM conversion and line integrity

### 3.1 CRM line replacement is destructive and non-atomic

- Audit findings: CRM invoice/quotation and delivery-note `save*Lines` helpers delete existing rows before inserting replacements; they ignore delete failure, are non-transactional, and callers ignore Boolean failures. Insert failure can leave no lines; delete failure can duplicate lines; UI can close/report success. CRM invoice editing can save an empty line list as a zero header while skipping line persistence, leaving old lines.
- Remediation: use a transactional RPC or safe staged replacement that validates all lines first, atomically replaces them, updates header totals, and returns an error that prevents closing the form. Decide and enforce whether zero-line documents are allowed. Do not delete or recalculate existing production invoices automatically.

### 3.2 CRM conversion duplication and incorrect customer linkage

- Audit findings: quotations in Sent or Accepted state can be converted repeatedly; conversion does not check for an existing linked invoice and leaves status Accepted, so duplicate invoices can be created. Invoice-to-delivery-note conversion is available on every non-cancelled invoice, has no duplicate/remaining-quantity guard, and copies full original quantities each time, risking duplicated fulfillment. Opportunity-to-customer conversion always creates a new customer even if `customer_id` already exists, then overwrites the link. Lead-to-opportunity conversion inserts the opportunity then ignores lead-update errors, permitting retries and duplicates. Live data checks found no current duplicate conversions by these measures, but there are 8 open opportunities already carrying a customer ID.
- Remediation: add server-side idempotency keys and unique conversion links; lock source records; validate allowed states and remaining quantities; update source and destination atomically; reuse an existing linked customer or require explicit user resolution. Surface failures. Do not merge/delete existing customer or invoice records automatically.

### 3.3 Other CRM UI failure handling and validation

- Audit findings: mark-paid action ignores update failure and closes; invoice credit limit can be bypassed on balance query failure (covered above); line inputs have no bounds validation, though no invalid line data was found live. Attachment upload path appears incompatible with storage policy (covered above).
- Remediation: validate positive, finite quantities/prices and document totals; fail closed on balance queries; keep forms open on failures and show actionable errors.

### 3.4 CRM live data observations

- CRM quote/invoice aggregate header/line totals, dates, company/customer links were consistent. No current amount-paid/status anomalies were found. No quotations currently link to multiple CRM invoices; no invoices link to multiple delivery notes; no delivery-quantity/company mismatches. These clean snapshots do not remove the workflow risks above.

## Priority 4 — HR, attendance, leave, and payroll

### 4.1 Payroll RPC authorization and rerun safety

- Audit findings: payroll RPCs are public-executable definer functions without adequate role/company/actor checks. `rpc_generate_payroll` can reset an existing payroll run’s records to DRAFT on rerun. Finalize/process functions accept caller-provided company/user identifiers without authorization; attendance transfer is public-executable.
- Remediation: restrict execution, derive actor/company from verified auth context, require payroll roles and explicit period scope, lock payroll runs, and make generation idempotent. Never reset or overwrite finalized/approved/pay-paid records. For existing runs, use a new version/revision with audit and explicit approval rather than destructive regeneration. Protect payroll data from logs and broad reads.

### 4.2 Leave accrual and generic workflow RPC

- Audit findings: `rpc_run_leave_accrual(company, year)` increments balances each invocation without dedupe/guard, so repeat runs inflate balances. `rpc_workflow_action` can update workflow and linked record statuses without actor/approver authorization.
- Remediation: create idempotent accrual batches with unique company/year/policy keys and a preview; lock balances and post once; corrections must be explicit reversal/adjustment entries. Validate transition, assigned approver, company, and role server-side in workflow RPC.

### 4.3 Attendance data and missed-punch handling

- Audit findings: live attendance had 19 rows with checkout earlier than check-in (12 from missed-punch approval, others including punches; some may be overnight shifts). Approval writes a missed-punch time without validating it against the other punch, and negative duration is clamped to zero, hiding bad pairs. Also 9 past `punch` Present rows lack checkout, and 26 past manual Present rows have checkout but no check-in. Manual attendance allows one-sided times; daily save handler ignores Supabase errors and closes. Many >5-minute duration mismatches were caused by an intentional 16-hour cap and should not be treated as defects without domain review.
- Remediation: model overnight shifts explicitly; validate punch chronology against shift rules on server; do not silently clamp invalid intervals; require both punches or an explicit missing-punch reason/status; keep correction audit history. Check every save error and leave the UI open on failure. Review flagged rows without bulk correction/deletion.

### 4.4 Leave request balance and overlap logic

- Audit findings: ESSP uses the first matching balance row, derives remaining from total balance minus all approved leave without filtering by year, and ignores stored `used`; pending leave is displayed but not reserved/deducted. Overage confirmation fails to show at zero balance because condition requires balance > 0. Overlapping leave ranges are not validated, permitting double booking/double-counting. Legacy `employee_leave_balances` has 189 rows, all with null `calendar_year_id`; one duplicate balance group and one row with used > total. Modern balance formula/duplicates/negative balances were clean.
- Remediation: define authoritative balance source and year/accrual policy; select an unambiguous employee/type/year row; derive approved and pending reservations consistently; always warn/block at zero/insufficient balance per policy; enforce overlap checks under transaction/lock to avoid concurrent requests. Do not delete duplicate legacy balances or assign calendar years automatically. Generate a read-only reconciliation report and get business approval for any data correction.

### 4.5 HR/payroll live data checks

- Payroll checks found no employee/company mismatch, duplicate employee in a run, net formula mismatch, run total mismatch, duplicate company/month runs, cross-run duplicate, month/date mismatch, or finalized status/variable-input lock inconsistency. Leave date-range and employee/company mismatch checks were clean. Preserve these records.

## Priority 5 — Manufacturing and inventory

### 5.1 Manufacturing production completion does not post inventory

- Audit finding: live `rpc_complete_production` updates production moves’ `quantity_done` and marks the order done, but does not create or link stock movements or adjust inventory. No triggers exist on `mrp_*` tables to do this elsewhere. The `stock_move_id` field is not used by the inspected completion flow.
- Remediation: design an atomic production-posting workflow that consumes components and produces finished goods in the same inventory ledger, validates stock/cost/company/warehouse, links every move idempotently, and rolls back the whole operation on error. Define reversal/cancellation behavior. Do not alter historical production or inventory rows automatically.

### 5.2 Production order validation and numbering

- Audit findings: `rpc_create_production_order` does not visibly validate positive quantity, BOM/product match, BOM active status, or work-center ownership; order name is generated using `COUNT(*) + 1`, which races under concurrent creation. Production RPCs are `SECURITY DEFINER`, executable by anon, and have no explicit auth/role check (they rely on company resolution).
- Remediation: validate trusted tenant ownership and all references/quantities server-side; use a database sequence or atomic per-company numbering allocator with a unique constraint; add idempotency for retries. Check auth/role independently from company context.

### 5.3 BOM/routing edits and work-center validation

- Audit findings: BOM and routing editors update headers, delete existing detail rows, and reinsert in separate calls. Routing edit ignores header-update and delete errors; BOM ignores delete error. Partial failure can silently erase/duplicate/partially replace detail lines. The BOM UI validates only that at least one line has an item ID; numeric quantities are not robustly validated.
- Remediation: replace header+lines in one transaction/RPC, validate positive finite quantities/durations and same-company item/work-center/product references, and enforce line ordering/uniqueness as appropriate. Keep existing rows intact on failure.

### 5.4 Manufacturing live observations

- All `mrp_*` operational tables currently have zero records. RLS is enabled, but anon CRUD grants exist on manufacturing tables; policies are company-scoped and rely on `get_my_company_id()`. No test should create live manufacturing data.

## Priority 6 — Projects and proposals

### 6.1 Project RLS is effectively open

- Audit finding: migration `20260825_enterprise_project_management.sql` creates `FOR ALL USING (true) WITH CHECK (true)` policies for project workflow tables. Live grants provide anon CRUD on project proposals, revisions, audit, activities, issues, risks, safety observations, completion requests, supervisors, required documents, and categories/types; `pm_projects` also has anon CRUD grants. RLS on its own does not protect against a true policy.
- Remediation: revoke anon table privileges and replace open policies with authenticated tenant-scoped policies and role-specific writes. Add server-side authorization to all approval/completion/reopen actions. Preserve rows and legitimate public functions.

### 6.2 Project workflow partial writes and error handling

- Audit findings: project proposal creation inserts a header then revision separately; revision submission inserts revision then updates proposal counter/status without checking update error. Completion request insert then project status update is unchecked. Completion review ignores both request and project update errors; reopen ignores project update errors. Document initialization for new projects ignores individual insert errors. `uploadProjectFile` ignores storage failure (also in Priority 1).
- Remediation: use transactional RPCs for related writes, check/propagate every error, use row locks and valid status transitions, and avoid success notifications/audit claims until commit succeeds. Audit records should be part of the transaction where possible.

### 6.3 Proposal reviewer authorization

- Audit finding: proposal review authorization is performed in client/service code using a caller-provided `actorId` and optionally caller-selected `currentStage`; role/assignment checks in the browser are bypassable and cannot secure the workflow.
- Remediation: derive actor from `auth.uid()` in a server-side function, derive stage from locked proposal state, enforce assigned reviewer/approver and permitted admin exceptions server-side, and reject stale or invalid transitions. Preserve current proposal state/history.

### 6.4 Project live data observations

- `pm_projects` and project activity/issue/risk/safety/completion/document/supervisor tables currently have no rows. There are 3 project proposal headers, 3 linked revisions with matching counters, and 7 correctly linked audit rows. Basic tested date, company-link, budget, quantity, and percentage checks flagged no records. Do not infer from this empty snapshot that the workflows are safe.

## Priority 7 — Backup/restore behavior

- Audit finding: `lib/backupRestore.ts` continues after delete/upsert failures, may leave a partial restore, and Settings can report restore success despite failure.
- Remediation: make restore staged and verifiable. Restore into isolated staging tables/database or a new versioned dataset, validate counts/relationships, then provide an explicit reviewed cutover. Never delete or overwrite live rows as part of restore. Return a clear partial/failure state and an operator-readable recovery plan. Do not execute restore against production during this task.

## Acceptance criteria

- No live database row, storage object, or production business record was deleted, overwritten, or changed during implementation.
- No production SQL migration/RPC/business workflow was executed.
- All privileged operations enforce identity, company, role, assignment, and state checks on the server/database; anonymous access is limited to explicitly required safe endpoints.
- Multi-row business operations are atomic and idempotent where retries/concurrency matter.
- UI reports failures accurately and does not close or show success when persistence failed.
- Existing records remain readable and preserved through additive, staged changes; any necessary data repair is presented as a read-only report and separate human-approved plan.
- The final report separates confirmed code/security defects, live-data observations, assumptions, deferred items, and rollout dependencies.
