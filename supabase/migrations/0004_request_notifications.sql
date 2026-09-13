CREATE TABLE micro_access.notifications (
  id uuid PRIMARY KEY,
  recipient_id uuid NOT NULL REFERENCES micro_access.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES micro_access.service_requests(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES micro_access.matches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (recipient_id, request_id)
);
CREATE INDEX notifications_recipient_idx ON micro_access.notifications(recipient_id, created_at DESC);
ALTER TABLE micro_access.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON micro_access.notifications FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON micro_access.notifications FROM %I', client_role);
    END IF;
  END LOOP;
END $$;
