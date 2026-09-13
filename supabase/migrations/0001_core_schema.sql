CREATE SCHEMA IF NOT EXISTS micro_access;
CREATE TABLE IF NOT EXISTS micro_access.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());

CREATE FUNCTION micro_access.valid_windows(windows jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE w jsonb;
BEGIN
  IF jsonb_typeof(windows) <> 'array' THEN RETURN false; END IF;
  FOR w IN SELECT value FROM jsonb_array_elements(windows) LOOP
    IF jsonb_typeof(w) <> 'object' OR NOT (w ? 'start' AND w ? 'end') THEN RETURN false; END IF;
    IF (w->>'start') IS NULL OR (w->>'end') IS NULL OR
       (w->>'end')::timestamptz <= (w->>'start')::timestamptz THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

CREATE TABLE micro_access.write_lock (id integer PRIMARY KEY CHECK (id = 1));
INSERT INTO micro_access.write_lock VALUES (1);

CREATE TABLE micro_access.users (
  id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('participant','volunteer','facilitator','admin')),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
  email text,
  account_type text NOT NULL CHECK (account_type IN ('individual_18_plus','partner_managed')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE micro_access.participant_profiles (
  user_id uuid PRIMARY KEY REFERENCES micro_access.users(id),
  languages text[] NOT NULL DEFAULT '{}', topic_interests text[] NOT NULL DEFAULT '{}',
  industry_interests text[] NOT NULL DEFAULT '{}', preferred_modes text[] NOT NULL DEFAULT '{}'
    CHECK (preferred_modes <@ ARRAY['async','live_online','in_person','either']::text[]),
  access_preferences text[] NOT NULL DEFAULT '{}', time_constraints text
);
CREATE TABLE micro_access.volunteer_profiles (
  user_id uuid PRIMARY KEY REFERENCES micro_access.users(id), headline text NOT NULL DEFAULT '',
  organisation text NOT NULL DEFAULT '', industry_tags text[] NOT NULL DEFAULT '{}',
  expertise_tags text[] NOT NULL DEFAULT '{}', languages text[] NOT NULL DEFAULT '{}',
  supported_services text[] NOT NULL DEFAULT '{}'
    CHECK (supported_services <@ ARRAY['ask_me_anything','career_story','teach_me_something','review_my_work']::text[]),
  supported_access_preferences text[] NOT NULL DEFAULT '{}', lived_experience_tags text[] NOT NULL DEFAULT '{}',
  max_weekly_minutes integer NOT NULL DEFAULT 60 CHECK (max_weekly_minutes BETWEEN 0 AND 2400),
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  available_windows jsonb NOT NULL DEFAULT '[]' CHECK (micro_access.valid_windows(available_windows)),
  supported_modes text[] NOT NULL DEFAULT '{}' CHECK (supported_modes <@ ARRAY['async','live_online','in_person']::text[])
);
CREATE TABLE micro_access.service_requests (
  id uuid PRIMARY KEY, participant_id uuid NOT NULL REFERENCES micro_access.participant_profiles(user_id),
  service_type text NOT NULL CHECK (service_type IN ('ask_me_anything','teach_me_something','review_my_work')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160), details text NOT NULL CHECK (length(btrim(details)) > 0),
  topic_tags text[] NOT NULL DEFAULT '{}', industry_tags text[] NOT NULL DEFAULT '{}',
  preferred_mode text NOT NULL CHECK (preferred_mode IN ('async','live_online','in_person','either')),
  duration_minutes integer NOT NULL,
  availability_windows jsonb NOT NULL DEFAULT '[]' CHECK (micro_access.valid_windows(availability_windows)),
  access_preferences text[] NOT NULL DEFAULT '{}', artifact_text text, artifact_url text, deadline timestamptz,
  prior_knowledge text, desired_outcome text, review_goal text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','accepted','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((service_type = 'ask_me_anything' AND duration_minutes BETWEEN 5 AND 10) OR
         (service_type = 'teach_me_something' AND duration_minutes BETWEEN 20 AND 30) OR
         (service_type = 'review_my_work' AND duration_minutes BETWEEN 10 AND 15)),
  CHECK (service_type <> 'review_my_work' OR (nullif(btrim(artifact_text),'') IS NOT NULL OR nullif(btrim(artifact_url),'') IS NOT NULL)),
  CHECK (artifact_url IS NULL OR artifact_url ~* '^https?://[^[:space:]]+$'),
  CHECK (service_type <> 'review_my_work' OR nullif(btrim(review_goal),'') IS NOT NULL),
  CHECK (service_type <> 'teach_me_something' OR (preferred_mode IN ('live_online','in_person') AND nullif(btrim(prior_knowledge),'') IS NOT NULL AND nullif(btrim(desired_outcome),'') IS NOT NULL)),
  CHECK (preferred_mode NOT IN ('live_online','in_person') OR jsonb_array_length(availability_windows) > 0)
);
CREATE TABLE micro_access.volunteer_offers (
  id uuid PRIMARY KEY, volunteer_id uuid NOT NULL REFERENCES micro_access.volunteer_profiles(user_id),
  service_type text NOT NULL DEFAULT 'career_story' CHECK (service_type = 'career_story'),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160), description text NOT NULL CHECK (length(btrim(description)) > 0),
  industry_tags text[] NOT NULL DEFAULT '{}', topic_tags text[] NOT NULL DEFAULT '{}',
  mode text NOT NULL CHECK (mode IN ('live_online','in_person')),
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK (capacity >= 0), total_capacity integer NOT NULL CHECK (total_capacity BETWEEN 1 AND 100),
  access_features text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','full','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at = starts_at + interval '15 minutes'), CHECK (capacity <= total_capacity),
  CHECK (status <> 'open' OR capacity > 0), CHECK (status <> 'full' OR capacity = 0)
);
CREATE TABLE micro_access.matches (
  id uuid PRIMARY KEY, request_id uuid NOT NULL REFERENCES micro_access.service_requests(id),
  volunteer_id uuid NOT NULL REFERENCES micro_access.volunteer_profiles(user_id),
  score double precision NOT NULL CHECK (score BETWEEN 0 AND 100), reasons text[] NOT NULL CHECK (cardinality(reasons) > 0),
  suggested_windows jsonb NOT NULL DEFAULT '[]' CHECK (micro_access.valid_windows(suggested_windows)),
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','accepted','declined','expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE micro_access.engagements (
  id uuid PRIMARY KEY, participant_id uuid NOT NULL REFERENCES micro_access.participant_profiles(user_id),
  volunteer_id uuid NOT NULL REFERENCES micro_access.volunteer_profiles(user_id),
  service_type text NOT NULL CHECK (service_type IN ('ask_me_anything','career_story','teach_me_something','review_my_work')),
  request_id uuid REFERENCES micro_access.service_requests(id), offer_id uuid REFERENCES micro_access.volunteer_offers(id),
  scheduled_start timestamptz, scheduled_end timestamptz,
  mode text NOT NULL CHECK (mode IN ('async','live_online','in_person')), duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 30),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((request_id IS NOT NULL AND offer_id IS NULL AND service_type <> 'career_story') OR
         (offer_id IS NOT NULL AND request_id IS NULL AND service_type = 'career_story')),
  CHECK ((mode = 'async' AND scheduled_start IS NULL AND scheduled_end IS NULL) OR
         (mode <> 'async' AND scheduled_start IS NOT NULL AND scheduled_end IS NOT NULL AND scheduled_end = scheduled_start + duration_minutes * interval '1 minute'))
);
CREATE TABLE micro_access.feedback (
  id uuid PRIMARY KEY, engagement_id uuid NOT NULL REFERENCES micro_access.engagements(id),
  submitted_by uuid NOT NULL REFERENCES micro_access.users(id), helpful boolean NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5), comment text,
  follow_up_requested boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, submitted_by)
);
CREATE UNIQUE INDEX one_engagement_per_request ON micro_access.engagements(request_id) WHERE status <> 'cancelled';
CREATE UNIQUE INDEX one_seat_per_participant ON micro_access.engagements(offer_id, participant_id) WHERE status <> 'cancelled';
CREATE UNIQUE INDEX one_current_match ON micro_access.matches(request_id, volunteer_id) WHERE status IN ('suggested','accepted');
CREATE UNIQUE INDEX one_accepted_match ON micro_access.matches(request_id) WHERE status = 'accepted';
CREATE INDEX requests_participant_status ON micro_access.service_requests(participant_id, status);
CREATE INDEX matches_request ON micro_access.matches(request_id);
CREATE INDEX engagements_volunteer ON micro_access.engagements(volunteer_id, status);
CREATE INDEX engagements_participant ON micro_access.engagements(participant_id, status);
CREATE INDEX offers_status ON micro_access.volunteer_offers(status);
