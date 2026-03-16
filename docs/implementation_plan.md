# Implementation Plan - Phase A: Stabilize (RLS Hardening)

## Goal Description
The goal of this phase is to strictly enforce multi-tenancy and security across the entire KAA ERP database. This involves ensuring every table has a `company_id` column and enabling Row Level Security (RLS) with policies that restrict access based on the authenticated user's `company_id`.

## User Review Required
> [!IMPORTANT]
> **Data Loss Warning**: If you have existing data in `crm_*` tables without `company_id`, they will become invisible or inaccessible after applying strict RLS. Since this is a dev/verification phase, we assume it's safe to clear/reset data or update it manually if needed.

> [!WARNING]
> **Schema Expansion**: This plan will expand `supabase_schema.sql` to include ALL tables (HRMS, Organisation, etc.) to serve as the Single Source of Truth, as many were missing from the previous schema file.

## Proposed Changes

### Database Schema (`supabase_schema.sql`)

#### [MODIFY] [supabase_schema.sql](file:///c:/Users/jacob/Downloads/KAA%20EPR%20hum%20v1/supabase_schema.sql)

I will rewrite this file to be the comprehensive schema definition.

1.  **Core Tables (New/Updated)**
    *   `profiles`: Link to `auth.users`, stores `company_id`.
    *   `roles`: Stores permissions, `company_id`.
    *   `departments`, `locations`: Structural entities, `company_id`.

2.  **HRMS Tables (New/Updated)**
    *   `employees`: Key entity, links to `profiles`, `company_id`.
    *   `attendance`, `leaves`, `payroll`, `assets`, `tickets`, `resignations`, `announcements`.
    *   **Action**: Create these tables if not existing, ensure `company_id` is present.

3.  **CRM Tables (Update)**
    *   `crm_contacts`, `crm_deals`, `crm_tasks`.
    *   **Action**: Add `company_id` column.

4.  **RLS Policies (Update)**
    *   **Strategy**: All tables MUST have RLS enabled.
    *   **Policy Pattern**:
        ```sql
        CREATE POLICY "Tenant Isolation" ON table_name
        USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
        -- OR if using custom claims later, but for now via profiles lookup or metadata
        ```
        *Better Approach (Optimization)*: To avoid recursive lookups on `profiles` (which has `company_id`), we can assume `auth.jwt()` contains `company_id` OR we treat `profiles` as the source of truth.
        *Selected Approach*: `USING (company_id = (select company_id from profiles where id = auth.uid()))` is safer but slower.
        *Alternative*: If we trust the blueprint "Supabase Auth ... Supabase is core backend", we can use a helper function `get_my_company_id()` to keep policies clean.

    *   **Helper Function**:
        ```sql
        CREATE OR REPLACE FUNCTION get_my_company_id()
        RETURNS UUID AS $$
          SELECT company_id FROM profiles WHERE id = auth.uid()
        $$ LANGUAGE sql SECURITY DEFINER;
        ```

    *   **Applied Policy**:
        `USING (company_id = get_my_company_id())` for ALL tables.
        `WITH CHECK (company_id = get_my_company_id())` for INSERT/UPDATE.

## Verification Plan

### Automated Tests
*   Since we don't have a test suite, strict "Automated Tests" are hard to define without writing a test runner.
*   **Alternative**: I will use the `mcp_supabase-mcp-server_execute_sql` tool (if available) or simply rely on Manual Verification via the UI. *Wait, I cannot use the `mcp` tool as it is not in my allowed tools list (I see `default_api` tools).* I only have `run_command` and `write_to_file`. I probably cannot "run" the SQL against the live DB from here unless `supabase` CLI is installed and configured.
    *   *Observation*: The user has `supabase` in `package.json` scripts? No, but `lib/supabase.ts` exists.
    *   *Assumption*: The user will apply the SQL manually or I will verify by checking the file content.
    *   *Constraint*: I cannot "Execute" the SQL. I can only "Write" the SQL file.

### Manual Verification
1.  **Code Review**: User must review `supabase_schema.sql` to ensure it matches the requirement.
2.  **Application Test**: User should reload the app.
    *   Login as a user.
    *   Create a record (e.g., Add CRM Contact).
    *   Verify it appears.
    *   (Optional) Login as a different user from a different company (if possible) and ensure isolation.

### Deployment Note
User will need to run the SQL query in their Supabase Dashboard's SQL Editor to apply these changes. I will provide the full SQL block.
