-- Paket 7: push-notiser

CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  push_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_type),
  CONSTRAINT notification_preferences_type_check CHECK (
    notification_type IN ('visit_registered','next_stop_changed','added_as_participant','member_joined')
  )
);

GRANT SELECT ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences self read"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  last_error text
);

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id);
GRANT SELECT ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions self read"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL DEFAULT '/',
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT notification_outbox_status_check CHECK (status IN ('pending','sent','failed','skipped'))
);

CREATE INDEX notification_outbox_pending_idx
  ON public.notification_outbox (created_at)
  WHERE status = 'pending';

GRANT ALL ON public.notification_outbox TO service_role;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
-- Ingen klientåtkomst: kön läses och skrivs enbart av serverrollen och SECURITY DEFINER-funktioner.

-- Köläggning ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notification_type_enabled(_user_id uuid, _type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.notification_preferences p
    WHERE p.user_id = _user_id
      AND p.notification_type = _type
      AND p.push_enabled = false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.notification_type_enabled(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_notification(
  _user_id uuid, _group_id uuid, _type text,
  _title text, _body text, _url text, _dedupe_key text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  IF NOT public.notification_type_enabled(_user_id, _type) THEN RETURN; END IF;

  INSERT INTO public.notification_outbox (user_id, group_id, notification_type, title, body, url, dedupe_key)
  VALUES (_user_id, _group_id, _type, _title, _body, coalesce(_url, '/'), _dedupe_key)
  ON CONFLICT (dedupe_key) DO NOTHING;
END $$;

REVOKE EXECUTE ON FUNCTION public.queue_notification(uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Trigger: aktivitetsrader --------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_activity_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _type text;
  _url text;
  _group_name text;
  _body text;
  _member record;
BEGIN
  IF NEW.kind = 'visited' THEN
    _type := 'visit_registered'; _url := '/gruppen';
  ELSIF NEW.kind = 'next-picked' THEN
    _type := 'next_stop_changed'; _url := '/';
  ELSIF NEW.kind = 'member-joined' THEN
    _type := 'member_joined'; _url := '/gruppen';
  ELSE
    RETURN NEW;
  END IF;

  SELECT g.name INTO _group_name FROM public.groups g WHERE g.id = NEW.group_id;
  _body := coalesce(NEW.payload ->> 'text', 'Något nytt har hänt i gruppen.');

  FOR _member IN
    SELECT m.user_id
    FROM public.memberships m
    WHERE m.group_id = NEW.group_id
      AND m.status = 'active'
      AND (NEW.actor_id IS NULL OR m.user_id <> NEW.actor_id)
  LOOP
    -- Deltagare i besöket får en egen, personlig notis i stället.
    IF _type = 'visit_registered' AND NEW.visit_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.visit_participants vp
      WHERE vp.visit_id = NEW.visit_id AND vp.user_id = _member.user_id
    ) THEN
      CONTINUE;
    END IF;

    PERFORM public.queue_notification(
      _member.user_id, NEW.group_id, _type,
      coalesce(_group_name, 'Matrundan'),
      _body, _url,
      _type || ':' || NEW.id::text || ':' || _member.user_id::text
    );
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER activity_enqueue_notifications
AFTER INSERT ON public.activity
FOR EACH ROW EXECUTE FUNCTION public.enqueue_activity_notifications();

-- Trigger: besöksdeltagare --------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_participant_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _visit record;
  _group_id uuid;
  _group_name text;
  _place_name text;
  _actor_name text;
BEGIN
  SELECT v.created_by, v.place_id INTO _visit FROM public.visits v WHERE v.id = NEW.visit_id;
  IF _visit.created_by IS NULL OR _visit.created_by = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT l.group_id INTO _group_id
  FROM public.visit_group_links l
  WHERE l.visit_id = NEW.visit_id AND l.link_type = 'original'
  LIMIT 1;

  IF _group_id IS NULL THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.group_id = _group_id AND m.user_id = NEW.user_id AND m.status = 'active'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT g.name INTO _group_name FROM public.groups g WHERE g.id = _group_id;
  SELECT p.name INTO _place_name FROM public.places p WHERE p.id = _visit.place_id;
  SELECT pr.display_name INTO _actor_name FROM public.profiles pr WHERE pr.id = _visit.created_by;

  PERFORM public.queue_notification(
    NEW.user_id, _group_id, 'added_as_participant',
    coalesce(_group_name, 'Matrundan'),
    coalesce(_actor_name, 'Någon') || ' la till dig som deltagare på besöket på '
      || coalesce(_place_name, 'ett ställe') || '.',
    '/gruppen',
    'added_as_participant:' || NEW.visit_id::text || ':' || NEW.user_id::text
  );

  RETURN NEW;
END $$;

CREATE TRIGGER visit_participants_enqueue_notification
AFTER INSERT ON public.visit_participants
FOR EACH ROW EXECUTE FUNCTION public.enqueue_participant_notification();

-- Klient-RPC:er --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  _endpoint text, _p256dh text, _auth text, _device_label text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _endpoint IS NULL OR length(_endpoint) < 10 OR length(_endpoint) > 2000 THEN
    RAISE EXCEPTION 'Ogiltig notisadress';
  END IF;
  IF _p256dh IS NULL OR _auth IS NULL THEN RAISE EXCEPTION 'Ogiltiga nycklar'; END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label, last_used_at)
  VALUES (_uid, _endpoint, _p256dh, _auth, nullif(left(coalesce(_device_label,''), 60), ''), now())
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = _uid,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        device_label = coalesce(EXCLUDED.device_label, public.push_subscriptions.device_label),
        last_used_at = now(),
        last_error = NULL
  RETURNING id INTO _id;

  RETURN _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_push_subscription(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.push_subscriptions WHERE id = _id AND user_id = _uid;
END $$;

REVOKE EXECUTE ON FUNCTION public.remove_push_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_push_subscription(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_notification_preference(_type text, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _type NOT IN ('visit_registered','next_stop_changed','added_as_participant','member_joined') THEN
    RAISE EXCEPTION 'Okänd notistyp';
  END IF;

  INSERT INTO public.notification_preferences (user_id, notification_type, push_enabled, updated_at)
  VALUES (_uid, _type, coalesce(_enabled, true), now())
  ON CONFLICT (user_id, notification_type) DO UPDATE
    SET push_enabled = EXCLUDED.push_enabled, updated_at = now();
END $$;

REVOKE EXECUTE ON FUNCTION public.set_notification_preference(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_notification_preference(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_notification_settings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _prefs jsonb;
  _devices jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT coalesce(jsonb_object_agg(t.notification_type, coalesce(p.push_enabled, true)), '{}'::jsonb)
  INTO _prefs
  FROM (VALUES ('visit_registered'), ('next_stop_changed'), ('added_as_participant'), ('member_joined'))
       AS t(notification_type)
  LEFT JOIN public.notification_preferences p
    ON p.user_id = _uid AND p.notification_type = t.notification_type;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'endpoint', s.endpoint,
    'device_label', s.device_label,
    'created_at', s.created_at,
    'last_used_at', s.last_used_at
  ) ORDER BY s.created_at), '[]'::jsonb)
  INTO _devices
  FROM public.push_subscriptions s
  WHERE s.user_id = _uid;

  RETURN jsonb_build_object('preferences', _prefs, 'devices', _devices);
END $$;

REVOKE EXECUTE ON FUNCTION public.get_notification_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_notification_settings() TO authenticated;