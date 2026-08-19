BEGIN;

-- Issue #101: privata, gruppscopade reaktioner på deltagarnas synliga
-- omdömeskommentarer samt pushnotis när en senare deltagare lämnar sitt första
-- omdöme på ett befintligt besök.

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_type_check;
ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_type_check CHECK (
    notification_type IN (
      'visit_registered',
      'next_stop_changed',
      'added_as_participant',
      'member_joined',
      'review_added'
    )
  );

CREATE TABLE public.review_group_reactions (
  review_id uuid NOT NULL,
  group_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('heart', 'drool', 'celebrate', 'laugh')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, group_id, user_id),
  CONSTRAINT review_group_reactions_visibility_fk
    FOREIGN KEY (review_id, group_id)
    REFERENCES public.review_group_visibility(review_id, group_id)
    ON DELETE CASCADE
);

CREATE INDEX review_group_reactions_group_review_idx
  ON public.review_group_reactions(group_id, review_id);

ALTER TABLE public.review_group_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.review_group_reactions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.review_group_reactions TO service_role;

CREATE OR REPLACE FUNCTION public.get_visit_review_reactions_v1(
  _group_id uuid,
  _visit_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links
    WHERE visit_id = _visit_id
      AND group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;

  WITH eligible_reviews AS (
    SELECT r.id AS review_id
    FROM public.reviews r
    JOIN public.visit_participants vp
      ON vp.visit_id = r.visit_id
     AND vp.user_id = r.user_id
    JOIN public.review_group_visibility rgv
      ON rgv.review_id = r.id
     AND rgv.group_id = _group_id
    WHERE r.visit_id = _visit_id
      AND rgv.rating_visible = true
      AND rgv.comment_visible = true
      AND NULLIF(trim(COALESCE(r.comment, '')), '') IS NOT NULL
  ),
  reaction_state AS (
    SELECT
      eligible.review_id,
      (
        SELECT own_reaction.reaction
        FROM public.review_group_reactions own_reaction
        WHERE own_reaction.review_id = eligible.review_id
          AND own_reaction.group_id = _group_id
          AND own_reaction.user_id = _uid
        LIMIT 1
      ) AS my_reaction,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'reaction', bucket.reaction,
            'count', bucket.reactor_count,
            'reactors', bucket.reactors
          )
          ORDER BY bucket.reaction_order
        )
        FROM (
          SELECT
            reaction_row.reaction,
            count(*)::int AS reactor_count,
            jsonb_agg(
              jsonb_build_object(
                'userId', reaction_row.user_id,
                'name', COALESCE(NULLIF(trim(profile.display_name), ''), 'Tidigare medlem'),
                'avatar', profile.avatar_emoji,
                'avatarImage', profile.avatar_url,
                'status', CASE
                  WHEN membership.status = 'active' THEN 'active'
                  ELSE 'left'
                END
              )
              ORDER BY
                CASE WHEN reaction_row.user_id = _uid THEN 0 ELSE 1 END,
                COALESCE(NULLIF(trim(profile.display_name), ''), 'Tidigare medlem'),
                reaction_row.user_id
            ) AS reactors,
            min(CASE reaction_row.reaction
              WHEN 'heart' THEN 1
              WHEN 'drool' THEN 2
              WHEN 'celebrate' THEN 3
              WHEN 'laugh' THEN 4
              ELSE 99
            END) AS reaction_order
          FROM public.review_group_reactions reaction_row
          JOIN public.memberships membership
            ON membership.group_id = _group_id
           AND membership.user_id = reaction_row.user_id
           AND membership.status IN ('active', 'left')
          LEFT JOIN public.profiles profile ON profile.id = reaction_row.user_id
          WHERE reaction_row.review_id = eligible.review_id
            AND reaction_row.group_id = _group_id
          GROUP BY reaction_row.reaction
        ) AS bucket
      ), '[]'::jsonb) AS reactions
    FROM eligible_reviews eligible
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'reviewId', state.review_id,
      'myReaction', state.my_reaction,
      'reactions', state.reactions
    )
    ORDER BY state.review_id
  ), '[]'::jsonb)
  INTO _result
  FROM reaction_state state;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_visit_review_reactions_v1(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visit_review_reactions_v1(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.set_own_review_reaction_v1(
  _group_id uuid,
  _visit_id uuid,
  _review_id uuid,
  _reaction text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links
    WHERE visit_id = _visit_id
      AND group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.reviews review
    JOIN public.visit_participants participant
      ON participant.visit_id = review.visit_id
     AND participant.user_id = review.user_id
    JOIN public.review_group_visibility visibility
      ON visibility.review_id = review.id
     AND visibility.group_id = _group_id
    WHERE review.id = _review_id
      AND review.visit_id = _visit_id
      AND visibility.rating_visible = true
      AND visibility.comment_visible = true
      AND NULLIF(trim(COALESCE(review.comment, '')), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Omdömet kan inte reageras på i den här gruppen';
  END IF;

  IF _reaction IS NULL THEN
    DELETE FROM public.review_group_reactions
    WHERE review_id = _review_id
      AND group_id = _group_id
      AND user_id = _uid;
    RETURN;
  END IF;

  IF _reaction NOT IN ('heart', 'drool', 'celebrate', 'laugh') THEN
    RAISE EXCEPTION 'Ogiltig reaktion';
  END IF;

  INSERT INTO public.review_group_reactions (
    review_id,
    group_id,
    user_id,
    reaction,
    created_at,
    updated_at
  ) VALUES (
    _review_id,
    _group_id,
    _uid,
    _reaction,
    now(),
    now()
  )
  ON CONFLICT (review_id, group_id, user_id) DO UPDATE
  SET reaction = EXCLUDED.reaction,
      updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.set_own_review_reaction_v1(uuid, uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_review_reaction_v1(uuid, uuid, uuid, text)
  TO authenticated;

-- prepare_own_account_deletion mjukraderar profilen i stället för att ta bort
-- profilraden. Reaktioner är inte historisk sifferdata och ska därför rensas
-- när deleted_at sätts.
CREATE OR REPLACE FUNCTION public.clear_review_reactions_on_profile_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.review_group_reactions
    WHERE user_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_review_reactions_on_profile_soft_delete()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_clear_review_reactions_on_soft_delete
  ON public.profiles;
CREATE TRIGGER profiles_clear_review_reactions_on_soft_delete
AFTER UPDATE OF deleted_at ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.clear_review_reactions_on_profile_soft_delete();

CREATE OR REPLACE FUNCTION public.set_notification_preference(_type text, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _type NOT IN (
    'visit_registered',
    'next_stop_changed',
    'added_as_participant',
    'member_joined',
    'review_added'
  ) THEN
    RAISE EXCEPTION 'Okänd notistyp';
  END IF;

  INSERT INTO public.notification_preferences (
    user_id,
    notification_type,
    push_enabled,
    updated_at
  ) VALUES (
    _uid,
    _type,
    COALESCE(_enabled, true),
    now()
  )
  ON CONFLICT (user_id, notification_type) DO UPDATE
  SET push_enabled = EXCLUDED.push_enabled,
      updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.set_notification_preference(text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_notification_preference(text, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_notification_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _prefs jsonb;
  _devices jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT COALESCE(
    jsonb_object_agg(t.notification_type, COALESCE(p.push_enabled, true)),
    '{}'::jsonb
  )
  INTO _prefs
  FROM (
    VALUES
      ('visit_registered'),
      ('next_stop_changed'),
      ('added_as_participant'),
      ('member_joined'),
      ('review_added')
  ) AS t(notification_type)
  LEFT JOIN public.notification_preferences p
    ON p.user_id = _uid
   AND p.notification_type = t.notification_type;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
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
END;
$function$;

REVOKE ALL ON FUNCTION public.get_notification_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_notification_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_own_review_for_visit_v1(
  _group_id uuid,
  _visit_id uuid,
  _overall smallint,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
  _comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _review_id uuid;
  _existing_review_id uuid;
  _place_name text;
  _author_name text;
  _recipient record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links
    WHERE visit_id = _visit_id
      AND group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_participants
    WHERE visit_id = _visit_id
      AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Endast faktiska deltagare kan lämna ett omdöme';
  END IF;

  IF _overall IS NULL OR _overall < 1 OR _overall > 5 THEN
    RAISE EXCEPTION 'Helhetsbetyg måste vara 1–5';
  END IF;
  IF _taste IS NOT NULL AND (_taste < 1 OR _taste > 5) THEN
    RAISE EXCEPTION 'Smakbetyg måste vara 1–5';
  END IF;
  IF _value IS NOT NULL AND (_value < 1 OR _value > 5) THEN
    RAISE EXCEPTION 'Prisvärdhet måste vara 1–5';
  END IF;
  IF _service IS NOT NULL AND (_service < 1 OR _service > 5) THEN
    RAISE EXCEPTION 'Servicebetyg måste vara 1–5';
  END IF;

  SELECT id
  INTO _existing_review_id
  FROM public.reviews
  WHERE visit_id = _visit_id
    AND user_id = _uid;

  INSERT INTO public.reviews (
    visit_id,
    user_id,
    overall,
    taste,
    value,
    service,
    comment
  ) VALUES (
    _visit_id,
    _uid,
    _overall,
    _taste,
    _value,
    _service,
    NULLIF(trim(COALESCE(_comment, '')), '')
  )
  ON CONFLICT (visit_id, user_id) DO UPDATE
  SET overall = EXCLUDED.overall,
      taste = EXCLUDED.taste,
      value = EXCLUDED.value,
      service = EXCLUDED.service,
      comment = EXCLUDED.comment,
      updated_at = now()
  RETURNING id INTO _review_id;

  INSERT INTO public.review_group_visibility (
    review_id,
    group_id,
    rating_visible,
    comment_visible
  ) VALUES (
    _review_id,
    _group_id,
    true,
    true
  )
  ON CONFLICT (review_id, group_id) DO NOTHING;

  INSERT INTO public.review_group_visibility (
    review_id,
    group_id,
    rating_visible,
    comment_visible
  )
  SELECT
    _review_id,
    link.group_id,
    true,
    false
  FROM public.visit_group_links link
  JOIN public.memberships membership
    ON membership.group_id = link.group_id
   AND membership.user_id = _uid
   AND membership.status = 'active'
  WHERE link.visit_id = _visit_id
    AND link.group_id <> _group_id
  ON CONFLICT (review_id, group_id) DO NOTHING;

  -- Registrerarens första review skapas av create_visit_with_review_v3 och
  -- täcks redan av besöks-/deltagarnotisen. Här köläggs därför bara den första
  -- review som en senare deltagare lägger till via denna RPC.
  IF _existing_review_id IS NULL THEN
    SELECT place.name
    INTO _place_name
    FROM public.visits visit
    JOIN public.places place ON place.id = visit.place_id
    WHERE visit.id = _visit_id;

    SELECT profile.display_name
    INTO _author_name
    FROM public.profiles profile
    WHERE profile.id = _uid;

    FOR _recipient IN
      SELECT
        visibility.group_id,
        membership.user_id,
        group_row.name AS group_name
      FROM public.review_group_visibility visibility
      JOIN public.visit_group_links link
        ON link.visit_id = _visit_id
       AND link.group_id = visibility.group_id
      JOIN public.groups group_row
        ON group_row.id = visibility.group_id
       AND group_row.lifecycle_status = 'active'
      JOIN public.memberships membership
        ON membership.group_id = visibility.group_id
       AND membership.status = 'active'
      WHERE visibility.review_id = _review_id
        AND visibility.rating_visible = true
        AND membership.user_id <> _uid
    LOOP
      PERFORM public.queue_notification(
        _recipient.user_id,
        _recipient.group_id,
        'review_added',
        COALESCE(_recipient.group_name, 'Matrundan'),
        COALESCE(NULLIF(trim(_author_name), ''), 'Någon')
          || ' har lämnat sitt omdöme om '
          || COALESCE(NULLIF(trim(_place_name), ''), 'ett matställe')
          || '.',
        '/besok?group=' || _recipient.group_id::text
          || '&visit=' || _visit_id::text
          || '&review=' || _review_id::text,
        'review_added:' || _review_id::text
          || ':' || _recipient.group_id::text
          || ':' || _recipient.user_id::text
      );
    END LOOP;
  END IF;

  RETURN _review_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_own_review_for_visit_v1(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_own_review_for_visit_v1(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) TO authenticated;

COMMIT;
