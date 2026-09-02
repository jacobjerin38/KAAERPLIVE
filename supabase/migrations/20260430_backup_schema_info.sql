-- Adds a function to get all tables and foreign keys to dynamically determine topological order for backup/restore
-- Optimized with pg_catalog to prevent statement timeouts on large database schemas

CREATE OR REPLACE FUNCTION get_database_schema_info()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT json_build_object(
    'tables', COALESCE((
      SELECT json_agg(c.relname ORDER BY c.relname)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    ), '[]'::json),
    'foreign_keys', COALESCE((
      SELECT json_agg(json_build_object('child', child.relname, 'parent', parent.relname))
      FROM pg_constraint con
      JOIN pg_class child ON child.oid = con.conrelid
      JOIN pg_class parent ON parent.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = child.relnamespace
      WHERE con.contype = 'f' AND n.nspname = 'public'
    ), '[]'::json)
  );
$$;

-- Ensure authenticated and anon users can execute the function
GRANT EXECUTE ON FUNCTION get_database_schema_info() TO authenticated, anon, service_role;
