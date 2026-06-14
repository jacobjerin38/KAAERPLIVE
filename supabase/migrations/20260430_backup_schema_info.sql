-- Adds a function to get all tables and foreign keys to dynamically determine topological order for backup/restore

CREATE OR REPLACE FUNCTION get_database_schema_info()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
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
$$;

-- Ensure authenticated users can execute the function
GRANT EXECUTE ON FUNCTION get_database_schema_info() TO authenticated;
