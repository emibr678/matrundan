BEGIN;

-- v1.21.0: besökslokala gäster, korrekt deltagarprogression och tydligare nästa stopp.
-- Befintliga besök och deltagarrader bevaras oförändrade.

CREATE TABLE IF NOT EXISTS public.visit_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  sort_order smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visit_guests_display_name_check CHECK (
    length(display_name) BETWEEN 1 AND 60
    AND display_name = trim(display_name)
  ),
  CONSTRAINT visit_guests_sort_order_check CHECK (sort_order BETWEEN 1 AND 10),
  CONSTRAINT visit_guests_visit_sort_order_unique UNIQUE (visit_id, sort_order)
);

CREATE INDEX IF NOT EXISTS visit_guests_visit_idx
  ON public.visit_guests(visit_id, sort_order);

ALTER TABLE public.visit_guests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visit_guests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.visit_guests TO service_role;

CREATE OR REPLACE FUNCTION public.create_visit_with_review_v2(
  _group_id uuid,
  _place_id uuid,
  _visited_on date,
  _meal_type text,
  _participant_ids uuid[],
  _overall smallint,
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

  INSERT INTO public.reviews (visit_id, user_id, overall, taste, value, service, comment)
  VALUES (_vid, _uid, _overall, _taste, _value, _service, NULLIF(trim(COALESCE(_comment, '')), ''))
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

REVOKE ALL ON FUNCTION public.create_visit_with_review_v2(
  uuid, uuid, date, text, uuid[], smallint, smallint, smallint, smallint, text, text[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_visit_with_review_v2(
  uuid, uuid, date, text, uuid[], smallint, smallint, smallint, smallint, text, text[]
) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_next_place(_group_id uuid, _place_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_name text;
  _current uuid;
  _actor_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;

  IF _place_id IS NULL THEN
    DELETE FROM public.group_next_place WHERE group_id = _group_id;
    RETURN;
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

  SELECT place_id INTO _current
  FROM public.group_next_place
  WHERE group_id = _group_id;

  IF _current IS NOT DISTINCT FROM _place_id THEN RETURN; END IF;

  INSERT INTO public.group_next_place (group_id, place_id, selected_by, selected_at)
  VALUES (_group_id, _place_id, _uid, now())
  ON CONFLICT (group_id) DO UPDATE
  SET place_id = EXCLUDED.place_id,
      selected_by = EXCLUDED.selected_by,
      selected_at = EXCLUDED.selected_at;

  SELECT name INTO _place_name FROM public.places WHERE id = _place_id;
  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;

  INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
  VALUES (
    _group_id,
    'next-picked',
    _uid,
    _place_id,
    jsonb_build_object(
      'text',
      COALESCE(_actor_name, 'Någon') || ' föreslog ' ||
        COALESCE(_place_name, 'ett ställe') || ' som nästa stopp'
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.set_next_place(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_next_place(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5h(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _visits jsonb;
BEGIN
  _result := public.get_group_app_state_v5g(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      visit_row.item
      || jsonb_build_object(
        'participants',
        CASE
          WHEN visit_row.is_original THEN
            COALESCE(visit_row.item->'participants', '[]'::jsonb) || visit_row.guests
          ELSE COALESCE(visit_row.item->'participants', '[]'::jsonb)
        END,
        'externalParticipantCount',
        COALESCE((visit_row.item->>'externalParticipantCount')::integer, 0)
        + CASE WHEN visit_row.is_original THEN 0 ELSE visit_row.guest_count END
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
        FROM public.visit_group_links original_link
        WHERE original_link.visit_id = (visit_item.item->>'id')::uuid
          AND original_link.group_id = _group_id
          AND original_link.link_type = 'original'
      ) AS is_original,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', 'guest:' || guest.id::text,
            'name', guest.display_name,
            'avatar', '👤',
            'avatarImage', NULL,
            'status', 'guest'
          )
          ORDER BY guest.sort_order
        )
        FROM public.visit_guests guest
        WHERE guest.visit_id = (visit_item.item->>'id')::uuid
      ), '[]'::jsonb) AS guests,
      (
        SELECT count(*)::integer
        FROM public.visit_guests guest
        WHERE guest.visit_id = (visit_item.item->>'id')::uuid
      ) AS guest_count
    FROM jsonb_array_elements(COALESCE(_result->'visits', '[]'::jsonb))
      WITH ORDINALITY AS visit_item(item, ordinality)
  ) AS visit_row;

  RETURN jsonb_set(_result, '{visits}', _visits, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5h(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5h(uuid)
  TO authenticated;

COMMIT;
