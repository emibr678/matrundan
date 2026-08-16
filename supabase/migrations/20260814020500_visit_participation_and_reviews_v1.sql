BEGIN;

-- Issue #169, första leveransen:
-- - registreraren behöver inte själv vara deltagare;
-- - faktiska deltagare kan komplettera samma kanoniska besök med eget omdöme;
-- - en användare kan självkorrigera sitt eget deltagande utan att skapa ett nytt besök;
-- - reviews från personer som inte längre är faktiska deltagare exponeras inte i read-modellen.
--
-- Migrationen är additiv. Befintliga visits, visit_participants, reviews,
-- review_group_visibility och visit_group_links bevaras.

CREATE TABLE IF NOT EXISTS public.visit_participation_self_corrections (
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('declined', 'restored')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, user_id)
);

ALTER TABLE public.visit_participation_self_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visit_participation_self_corrections
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.visit_participation_self_corrections TO service_role;

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

  -- Den grupp där omdömet lämnas får både betyg och kommentar synliga.
  -- Ett tidigare explicit synlighetsval skrivs aldrig över.
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

  -- Om samma kanoniska besök redan är länkat i andra grupper där författaren
  -- själv är aktiv medlem får betyget bli synligt där. Kommentaren korsdelas
  -- aldrig automatiskt och befintliga uttryckliga val bevaras.
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

  RETURN _review_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_own_review_for_visit_v1(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_own_review_for_visit_v1(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_own_visit_participation_v1(
  _group_id uuid,
  _visit_id uuid,
  _participating boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _correction_status text;
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

  PERFORM pg_advisory_xact_lock(
    hashtextextended('visit-participation:' || _visit_id::text || ':' || _uid::text, 0)
  );

  SELECT status
  INTO _correction_status
  FROM public.visit_participation_self_corrections
  WHERE visit_id = _visit_id
    AND user_id = _uid
  FOR UPDATE;

  IF _participating THEN
    IF _correction_status IS DISTINCT FROM 'declined' THEN
      RAISE EXCEPTION 'Deltagandet kan bara återställas efter en egen korrigering';
    END IF;

    INSERT INTO public.visit_participants (visit_id, user_id)
    VALUES (_visit_id, _uid)
    ON CONFLICT (visit_id, user_id) DO NOTHING;

    UPDATE public.visit_participation_self_corrections
    SET status = 'restored',
        updated_at = now()
    WHERE visit_id = _visit_id
      AND user_id = _uid;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visit_participants
    WHERE visit_id = _visit_id
      AND user_id = _uid
  ) THEN
    INSERT INTO public.visit_participation_self_corrections (
      visit_id,
      user_id,
      status,
      updated_at
    ) VALUES (
      _visit_id,
      _uid,
      'declined',
      now()
    )
    ON CONFLICT (visit_id, user_id) DO UPDATE
    SET status = 'declined',
        updated_at = now();

    DELETE FROM public.visit_participants
    WHERE visit_id = _visit_id
      AND user_id = _uid;
    RETURN;
  END IF;

  IF _correction_status = 'declined' THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Du är inte registrerad som deltagare på besöket';
END;
$function$;

REVOKE ALL ON FUNCTION public.set_own_visit_participation_v1(uuid, uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_visit_participation_v1(uuid, uuid, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_visit_with_review_v3(
  _group_id uuid,
  _place_id uuid,
  _visited_on date,
  _meal_type text,
  _participant_ids uuid[],
  _overall smallint DEFAULT NULL,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
  _comment text DEFAULT NULL,
  _guest_names text[] DEFAULT '{}'::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _vid uuid;
  _rid uuid;
  _place_name text;
  _actor_name text;
  _participant_count integer := 0;
  _guest_count integer := 0;
  _registrar_participates boolean := false;
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
    FROM public.group_places
    WHERE group_id = _group_id
      AND place_id = _place_id
      AND collection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matstället finns inte i gruppens aktiva lista';
  END IF;
  IF _meal_type NOT IN ('frukost','lunch','fika','middag','kväll') THEN
    RAISE EXCEPTION 'Ogiltigt tillfälle';
  END IF;

  SELECT count(*)
  INTO _guest_count
  FROM unnest(COALESCE(_guest_names, '{}'::text[])) AS guest(name)
  WHERE NULLIF(regexp_replace(trim(guest.name), '[[:space:]]+', ' ', 'g'), '') IS NOT NULL;

  IF _guest_count > 10 THEN
    RAISE EXCEPTION 'Högst 10 gäster kan läggas till på ett besök';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_guest_names, '{}'::text[])) AS guest(name)
    WHERE length(regexp_replace(trim(guest.name), '[[:space:]]+', ' ', 'g')) > 60
  ) THEN
    RAISE EXCEPTION 'Gästnamn får vara högst 60 tecken';
  END IF;

  SELECT name INTO _place_name FROM public.places WHERE id = _place_id;

  INSERT INTO public.visits (place_id, visited_on, meal_type, created_by)
  VALUES (_place_id, _visited_on, _meal_type, _uid)
  RETURNING id INTO _vid;

  INSERT INTO public.visit_group_links (visit_id, group_id, link_type, linked_by)
  VALUES (_vid, _group_id, 'original', _uid);

  INSERT INTO public.visit_participants (visit_id, user_id)
  SELECT _vid, participant.user_id
  FROM (
    SELECT DISTINCT unnest(COALESCE(_participant_ids, '{}'::uuid[])) AS user_id
  ) AS participant
  WHERE public.has_membership(_group_id, participant.user_id);
  GET DIAGNOSTICS _participant_count = ROW_COUNT;

  IF _participant_count = 0 THEN
    RAISE EXCEPTION 'Välj minst en gruppmedlem som faktiskt deltog';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.visit_participants
    WHERE visit_id = _vid
      AND user_id = _uid
  ) INTO _registrar_participates;

  INSERT INTO public.visit_guests (visit_id, display_name, sort_order)
  SELECT
    _vid,
    normalized.display_name,
    row_number() OVER (ORDER BY normalized.input_order)::smallint
  FROM (
    SELECT
      guest.ordinality AS input_order,
      NULLIF(regexp_replace(trim(guest.name), '[[:space:]]+', ' ', 'g'), '') AS display_name
    FROM unnest(COALESCE(_guest_names, '{}'::text[])) WITH ORDINALITY AS guest(name, ordinality)
  ) AS normalized
  WHERE normalized.display_name IS NOT NULL;

  IF _registrar_participates THEN
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

    INSERT INTO public.reviews (visit_id, user_id, overall, taste, value, service, comment)
    VALUES (
      _vid,
      _uid,
      _overall,
      _taste,
      _value,
      _service,
      NULLIF(trim(COALESCE(_comment, '')), '')
    )
    RETURNING id INTO _rid;

    INSERT INTO public.review_group_visibility (
      review_id,
      group_id,
      rating_visible,
      comment_visible
    ) VALUES (
      _rid,
      _group_id,
      true,
      true
    );
  END IF;

  DELETE FROM public.group_next_place
  WHERE group_id = _group_id AND place_id = _place_id;

  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, place_id, visit_id, payload)
  VALUES (
    _group_id,
    'visited',
    _uid,
    _place_id,
    _vid,
    jsonb_build_object(
      'text',
      COALESCE(_actor_name, 'Någon') || ' registrerade ett besök på ' ||
        COALESCE(_place_name, 'ett ställe')
    )
  );

  RETURN _vid;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_visit_with_review_v3(
  uuid, uuid, date, text, uuid[], smallint, smallint, smallint, smallint, text, text[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_visit_with_review_v3(
  uuid, uuid, date, text, uuid[], smallint, smallint, smallint, smallint, text, text[]
) TO authenticated;

-- Bevara v5i-kontraktet för redan publicerade klienter, men lägg den tidigare
-- implementationen bakom en serverintern bas. Därmed får även v5i-klienter den
-- nya review-invarianten efter databasutrullning.
ALTER FUNCTION public.get_group_app_state_v5i(uuid)
  RENAME TO get_group_app_state_v5i_participation_base;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5i_participation_base(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5i(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
  _visits jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  _result := public.get_group_app_state_v5i_participation_base(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_set(
        visit_row.item,
        '{reviews}',
        COALESCE(visit_row.active_reviews, '[]'::jsonb),
        true
      ) || jsonb_build_object(
        'currentUserParticipationStatus',
        CASE
          WHEN visit_row.current_user_participates THEN 'participant'
          WHEN visit_row.current_user_declined THEN 'declined'
          ELSE 'none'
        END
      )
      ORDER BY visit_row.ordinality
    ),
    '[]'::jsonb
  )
  INTO _visits
  FROM (
    SELECT
      visit_item.item,
      visit_item.ordinality,
      EXISTS (
        SELECT 1
        FROM public.visit_participants vp
        WHERE vp.visit_id = (visit_item.item->>'id')::uuid
          AND vp.user_id = _uid
      ) AS current_user_participates,
      EXISTS (
        SELECT 1
        FROM public.visit_participation_self_corrections correction
        WHERE correction.visit_id = (visit_item.item->>'id')::uuid
          AND correction.user_id = _uid
          AND correction.status = 'declined'
      ) AS current_user_declined,
      COALESCE((
        SELECT jsonb_agg(review_item.review)
        FROM jsonb_array_elements(COALESCE(visit_item.item->'reviews', '[]'::jsonb))
          AS review_item(review)
        WHERE EXISTS (
          SELECT 1
          FROM public.visit_participants vp
          WHERE vp.visit_id = (visit_item.item->>'id')::uuid
            AND vp.user_id = NULLIF(review_item.review->>'userId', '')::uuid
        )
      ), '[]'::jsonb) AS active_reviews
    FROM jsonb_array_elements(COALESCE(_result->'visits', '[]'::jsonb))
      WITH ORDINALITY AS visit_item(item, ordinality)
  ) AS visit_row;

  RETURN jsonb_set(_result, '{visits}', _visits, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5i(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5i(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5j(_group_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.get_group_app_state_v5i(_group_id);
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5j(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5j(uuid)
  TO authenticated;

DO $assertions$
BEGIN
  IF has_table_privilege(
    'authenticated',
    'public.visit_participation_self_corrections',
    'SELECT'
  ) OR has_table_privilege(
    'anon',
    'public.visit_participation_self_corrections',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'participation corrections are directly readable by client roles';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.get_group_app_state_v5i_participation_base(uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.get_group_app_state_v5i_participation_base(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'v5i participation base is directly executable by client roles';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.get_group_app_state_v5j(uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.get_group_app_state_v5j(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'v5j has incorrect execute grants';
  END IF;
END;
$assertions$;

COMMIT;
