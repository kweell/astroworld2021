-- Server-only persistence. Do not add micro_access to Supabase's exposed schemas.
-- No anonymous or authenticated Data API policies; API authorization lives in core.
REVOKE ALL ON SCHEMA micro_access FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA micro_access FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA micro_access FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA micro_access REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA micro_access REVOKE ALL ON FUNCTIONS FROM PUBLIC;
DO $$
DECLARE table_name text; client_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','participant_profiles','volunteer_profiles','service_requests','volunteer_offers','matches','engagements','feedback','write_lock','schema_migrations'] LOOP
    EXECUTE format('ALTER TABLE micro_access.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
  FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA micro_access FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA micro_access FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA micro_access FROM %I', client_role);
    END IF;
  END LOOP;
END $$;
