-- Business services coordinate linked rows in one transaction. These guards also
-- reject individual invalid state jumps made through SQL by a trusted operator.
CREATE FUNCTION micro_access.guard_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  CASE TG_TABLE_NAME
  WHEN 'service_requests' THEN
    allowed := (OLD.status = 'open' AND NEW.status IN ('matched','cancelled')) OR
      (OLD.status = 'matched' AND NEW.status IN ('open','accepted','cancelled')) OR
      (OLD.status = 'accepted' AND NEW.status IN ('completed','cancelled'));
  WHEN 'volunteer_offers' THEN
    allowed := (OLD.status = 'draft' AND NEW.status IN ('open','cancelled')) OR
      (OLD.status = 'open' AND NEW.status IN ('full','completed','cancelled')) OR
      (OLD.status = 'full' AND NEW.status IN ('open','completed','cancelled'));
  WHEN 'matches' THEN allowed := OLD.status = 'suggested' AND NEW.status IN ('accepted','declined','expired');
  WHEN 'engagements' THEN allowed := OLD.status = 'confirmed' AND NEW.status IN ('completed','cancelled');
  END CASE;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid lifecycle transition' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER request_transition BEFORE UPDATE ON micro_access.service_requests FOR EACH ROW EXECUTE FUNCTION micro_access.guard_transition();
CREATE TRIGGER offer_transition BEFORE UPDATE ON micro_access.volunteer_offers FOR EACH ROW EXECUTE FUNCTION micro_access.guard_transition();
CREATE TRIGGER match_transition BEFORE UPDATE ON micro_access.matches FOR EACH ROW EXECUTE FUNCTION micro_access.guard_transition();
CREATE TRIGGER engagement_transition BEFORE UPDATE ON micro_access.engagements FOR EACH ROW EXECUTE FUNCTION micro_access.guard_transition();

CREATE FUNCTION micro_access.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER users_updated BEFORE UPDATE ON micro_access.users FOR EACH ROW EXECUTE FUNCTION micro_access.touch_updated_at();
CREATE TRIGGER requests_updated BEFORE UPDATE ON micro_access.service_requests FOR EACH ROW EXECUTE FUNCTION micro_access.touch_updated_at();
CREATE TRIGGER offers_updated BEFORE UPDATE ON micro_access.volunteer_offers FOR EACH ROW EXECUTE FUNCTION micro_access.touch_updated_at();
CREATE TRIGGER engagements_updated BEFORE UPDATE ON micro_access.engagements FOR EACH ROW EXECUTE FUNCTION micro_access.touch_updated_at();

CREATE FUNCTION micro_access.guard_profile_role() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_role text;
BEGIN
  expected_role := CASE TG_TABLE_NAME WHEN 'participant_profiles' THEN 'participant' ELSE 'volunteer' END;
  IF NOT EXISTS (SELECT 1 FROM micro_access.users WHERE id = NEW.user_id AND role = expected_role) THEN
    RAISE EXCEPTION 'Profile role mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER participant_role BEFORE INSERT OR UPDATE ON micro_access.participant_profiles FOR EACH ROW EXECUTE FUNCTION micro_access.guard_profile_role();
CREATE TRIGGER volunteer_role BEFORE INSERT OR UPDATE ON micro_access.volunteer_profiles FOR EACH ROW EXECUTE FUNCTION micro_access.guard_profile_role();
