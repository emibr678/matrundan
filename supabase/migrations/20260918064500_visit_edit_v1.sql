BEGIN;

-- Issue #309 — korrigera ett redan kanoniskt besök utan att skapa en ny visit.
-- Reviews och cross-group-identiteter bevaras när händelsen rättas.

CREATE OR REPLACE FUNCTION public.update_own_review_v3(
  _group_id uuid,
  _review_id uuid,
  _overall numeric DEFAULT NULL,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
  _atmosphere smallint DEFAULT NULL,
  _comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _visit_id uuid;
  _author_id uuid;
  _previous_comment text;
  _meal_type text;
  _review_model text;
  _scoreless boolean;
  _derived_overall numeric(4,2);
  _normalized_comment text := NULLIF(trim(COALESCE(_comment, '')), '');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN RAISE EXCEPTION 'Du är inte medlem i gruppen'; END IF;

  SELECT review.visit_id, review.user_id, review.comment, review.review_model, visit.meal_type
  INTO _visit_id, _author_id, _previous_comment, _review_model, _meal_type
  FROM public.reviews review
  JOIN public.visits visit ON visit.id = review.visit_id
  WHERE review.id = _review_id;

  IF _visit_id IS NULL THEN RAISE EXCEPTION 'Omdömet finns inte'; END IF;
  IF _author_id <> _uid THEN RAISE EXCEPTION 'Du kan bara redigera ditt eget omdöme'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.visit_group_links WHERE visit_id = _visit_id AND group_id = _group_id) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.visit_participants WHERE visit_id = _visit_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Endast faktiska deltagare kan ha ett omdöme eller en kommentar';
  END IF;

  _scoreless := _meal_type = 'dryck';
  IF _scoreless THEN
    IF _overall IS NOT NULL OR _taste IS NOT NULL OR _value IS NOT NULL OR _service IS NOT NULL OR _atmosphere IS NOT NULL THEN
      RAISE EXCEPTION 'Något att dricka ska inte ha stjärnbetyg';
    END IF;
    IF _normalized_comment IS NULL THEN RAISE EXCEPTION 'Kommentaren kan inte vara tom'; END IF;

    UPDATE public.reviews
    SET comment = _normalized_comment,
        updated_at = now()
    WHERE id = _review_id AND user_id = _uid;
  ELSIF _review_model IS NULL THEN
    IF _overall IS NULL OR _overall < 1 OR _overall > 5 THEN RAISE EXCEPTION 'Helhetsbetyg måste vara 1–5 för äldre omdömen'; END IF;
    IF _taste IS NOT NULL AND (_taste < 1 OR _taste > 5) THEN RAISE EXCEPTION 'Smak måste vara 1–5'; END IF;
    IF _value IS NOT NULL AND (_value < 1 OR _value > 5) THEN RAISE EXCEPTION 'Prisvärdhet måste vara 1–5'; END IF;
    IF _service IS NOT NULL AND (_service < 1 OR _service > 5) THEN RAISE EXCEPTION 'Service måste vara 1–5'; END IF;
    IF _atmosphere IS NOT NULL THEN RAISE EXCEPTION 'Äldre omdömen kan inte få Atmosfär utan uttrycklig omvärdering'; END IF;

    UPDATE public.reviews
    SET overall = _overall,
        taste = _taste,
        value = _value,
        service = _service,
        atmosphere = NULL,
        comment = _normalized_comment,
        updated_at = now()
    WHERE id = _review_id AND user_id = _uid;
  ELSE
    IF _overall IS NOT NULL THEN RAISE EXCEPTION 'Helhetsbetyget härleds automatiskt för det här omdömet'; END IF;
    _derived_overall := public.derive_review_overall_v1(_review_model, _taste, _value, _service, _atmosphere);

    UPDATE public.reviews
    SET overall = _derived_overall,
        taste = _taste,
        value = _value,
        service = _service,
        atmosphere = _atmosphere,
        comment = _normalized_comment,
        updated_at = now()
    WHERE id = _review_id AND user_id = _uid;
  END IF;

  IF NULLIF(trim(COALESCE(_previous_comment, '')), '') IS NULL AND _normalized_comment IS NOT NULL THEN
    UPDATE public.review_group_visibility
    SET comment_visible = true, updated_at = now()
    WHERE review_id = _review_id
      AND group_id = _group_id
      AND (rating_visible = true OR _scoreless)
      AND comment_visible = false;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_visit_v1(
  _group_id uuid,
  _visit_id uuid,
  _visited_on date,
  _meal_type text,
  _participant_ids uuid[],
  _is_takeaway boolean DEFAULT false,
  _guests jsonb DEFAULT '[]'::jsonb,
  _removed_guest_ids uuid[] DEFAULT '{}'::uuid[],
  _update_own_review boolean DEFAULT false,
  _review_id uuid DEFAULT NULL,
  _review_overall numeric DEFAULT NULL,
  _review_taste smallint DEFAULT NULL,
  _review_value smallint DEFAULT NULL,
  _review_service smallint DEFAULT NULL,
  _review_atmosphere smallint DEFAULT NULL,
  _review_comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_id uuid;
  _old_meal_type text;
  _normalized_takeaway boolean;
  _guest_count integer;
  _old_scoreless boolean;
  _new_scoreless boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('visit-edit:' || _visit_id::text, 0));

  SELECT visit.place_id, visit.meal_type INTO _place_id, _old_meal_type
  FROM public.visits visit
  WHERE visit.id = _visit_id
  FOR UPDATE;

  IF _place_id IS NULL THEN RAISE EXCEPTION 'Besök saknas'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.visits visit WHERE visit.id = _visit_id AND visit.created_by = _uid) THEN
    RAISE EXCEPTION 'Bara den som registrerade besöket kan redigera det';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.visit_group_links link
    WHERE link.visit_id = _visit_id AND link.group_id = _group_id AND link.link_type = 'original'
  ) THEN
    RAISE EXCEPTION 'Besöket kan bara redigeras från sin originalgrupp';
  END IF;

  IF _meal_type NOT IN ('frukost', 'lunch', 'fika', 'middag', 'dryck', 'kväll')
     OR (_meal_type = 'kväll' AND _old_meal_type <> 'kväll') THEN
    RAISE EXCEPTION 'Ogiltigt tillfälle';
  END IF;

  _normalized_takeaway := CASE WHEN _meal_type = 'dryck' THEN false ELSE COALESCE(_is_takeaway, false) END;
  _old_scoreless := _old_meal_type = 'dryck';
  _new_scoreless := _meal_type = 'dryck';

  IF NOT (_uid = ANY(COALESCE(_participant_ids, '{}'::uuid[]))) THEN
    RAISE EXCEPTION 'Den som registrerade besöket måste vara deltagare';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_participant_ids, '{}'::uuid[])) AS participant(user_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.memberships membership
      WHERE membership.group_id = _group_id
        AND membership.user_id = participant.user_id
        AND membership.status IN ('active', 'left')
    )
  ) THEN
    RAISE EXCEPTION 'Deltagarlistan innehåller en person som inte hör till gruppen';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_participant_ids, '{}'::uuid[])) AS participant(user_id)
    JOIN public.visit_participation_self_corrections correction
      ON correction.visit_id = _visit_id
     AND correction.user_id = participant.user_id
     AND correction.status = 'declined'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.visit_participants current_participant
      WHERE current_participant.visit_id = _visit_id AND current_participant.user_id = participant.user_id
    )
  ) THEN
    RAISE EXCEPTION 'En vald deltagare har själv markerat att hen inte var med';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visits candidate
    WHERE candidate.id <> _visit_id
      AND candidate.place_id = _place_id
      AND candidate.visited_on = _visited_on
      AND candidate.meal_type = _meal_type
      AND candidate.is_takeaway = _normalized_takeaway
      AND EXISTS (
        SELECT 1 FROM public.visit_participants participant
        WHERE participant.visit_id = candidate.id AND participant.user_id = _uid
      )
      AND EXISTS (
        SELECT 1
        FROM public.visit_group_links access_link
        JOIN public.groups access_group ON access_group.id = access_link.group_id AND access_group.lifecycle_status = 'active'
        JOIN public.memberships access_membership
          ON access_membership.group_id = access_link.group_id
         AND access_membership.user_id = _uid
         AND access_membership.status = 'active'
        WHERE access_link.visit_id = candidate.id
      )
  ) THEN
    RAISE EXCEPTION 'Det finns redan ett annat besök med samma datum, tillfälle och besökskontext';
  END IF;

  IF jsonb_typeof(COALESCE(_guests, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Ogiltig gästlista'; END IF;
  _guest_count := jsonb_array_length(COALESCE(_guests, '[]'::jsonb));
  IF _guest_count > 10 THEN RAISE EXCEPTION 'Högst 10 gäster kan finnas på ett besök'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(_guests, '[]'::jsonb)) AS entry(item)
    WHERE NULLIF(regexp_replace(trim(COALESCE(entry.item->>'name', '')), '[[:space:]]+', ' ', 'g'), '') IS NULL
  ) THEN RAISE EXCEPTION 'Gästnamn kan inte vara tomt'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(_guests, '[]'::jsonb)) AS entry(item)
    WHERE length(regexp_replace(trim(COALESCE(entry.item->>'name', '')), '[[:space:]]+', ' ', 'g')) > 60
  ) THEN RAISE EXCEPTION 'Gästnamn får vara högst 60 tecken'; END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT NULLIF(entry.item->>'id', '')::uuid AS guest_id, count(*) AS occurrences
      FROM jsonb_array_elements(COALESCE(_guests, '[]'::jsonb)) AS entry(item)
      WHERE NULLIF(entry.item->>'id', '') IS NOT NULL
      GROUP BY NULLIF(entry.item->>'id', '')::uuid
    ) duplicate
    WHERE duplicate.occurrences > 1
  ) THEN RAISE EXCEPTION 'Samma gäst kan bara förekomma en gång'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(_guests, '[]'::jsonb)) AS entry(item)
    WHERE NULLIF(entry.item->>'id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.visit_guests guest
        WHERE guest.id = NULLIF(entry.item->>'id', '')::uuid AND guest.visit_id = _visit_id
      )
  ) THEN RAISE EXCEPTION 'Gästlistan innehåller en okänd gäst'; END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_removed_guest_ids, '{}'::uuid[])) AS removed(guest_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.visit_guests guest
      WHERE guest.id = removed.guest_id
        AND guest.visit_id = _visit_id
    )
  ) THEN
    RAISE EXCEPTION 'Listan över borttagna gäster innehåller en okänd gäst';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_removed_guest_ids, '{}'::uuid[])) AS removed(guest_id)
    JOIN public.visit_guest_member_proposals proposal
      ON proposal.guest_id = removed.guest_id
     AND proposal.status IN ('pending', 'deferred', 'accepted')
  ) THEN
    RAISE EXCEPTION 'En gäst med pågående eller bekräftad medlemskoppling kan inte tas bort här';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_removed_guest_ids, '{}'::uuid[])) AS removed(guest_id)
    JOIN jsonb_array_elements(COALESCE(_guests, '[]'::jsonb)) AS entry(item)
      ON NULLIF(entry.item->>'id', '')::uuid = removed.guest_id
  ) THEN
    RAISE EXCEPTION 'Samma gäst kan inte både behållas och tas bort';
  END IF;

  IF _update_own_review THEN
    IF _review_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.reviews review
      WHERE review.id = _review_id AND review.visit_id = _visit_id AND review.user_id = _uid
    ) THEN RAISE EXCEPTION 'Ditt omdöme hittades inte'; END IF;
    IF _old_scoreless IS DISTINCT FROM _new_scoreless THEN
      RAISE EXCEPTION 'Omdömet kan inte redigeras samtidigt som besöket byter mellan mat och Något att dricka';
    END IF;
  END IF;

  UPDATE public.visits
  SET visited_on = _visited_on,
      meal_type = _meal_type,
      is_takeaway = _normalized_takeaway
  WHERE id = _visit_id AND created_by = _uid;

  DELETE FROM public.visit_participants participant
  USING public.memberships membership
  WHERE participant.visit_id = _visit_id
    AND membership.group_id = _group_id
    AND membership.user_id = participant.user_id
    AND membership.status IN ('active', 'left')
    AND NOT (participant.user_id = ANY(COALESCE(_participant_ids, '{}'::uuid[])));

  INSERT INTO public.visit_participants (visit_id, user_id)
  SELECT _visit_id, participant.user_id
  FROM (SELECT DISTINCT unnest(COALESCE(_participant_ids, '{}'::uuid[])) AS user_id) participant
  WHERE EXISTS (
    SELECT 1 FROM public.memberships membership
    WHERE membership.group_id = _group_id
      AND membership.user_id = participant.user_id
      AND membership.status IN ('active', 'left')
  )
  ON CONFLICT (visit_id, user_id) DO NOTHING;

  WITH desired AS (
    SELECT
      NULLIF(entry.item->>'id', '')::uuid AS guest_id,
      regexp_replace(trim(entry.item->>'name'), '[[:space:]]+', ' ', 'g') AS display_name,
      entry.ordinality::smallint AS sort_order
    FROM jsonb_array_elements(COALESCE(_guests, '[]'::jsonb)) WITH ORDINALITY AS entry(item, ordinality)
  )
  UPDATE public.visit_guests guest
  SET display_name = desired.display_name,
      sort_order = desired.sort_order
  FROM desired
  WHERE desired.guest_id IS NOT NULL AND guest.id = desired.guest_id AND guest.visit_id = _visit_id;

  DELETE FROM public.visit_guests guest
  WHERE guest.visit_id = _visit_id
    AND guest.id = ANY(COALESCE(_removed_guest_ids, '{}'::uuid[]));

  INSERT INTO public.visit_guests (visit_id, display_name, sort_order)
  SELECT _visit_id, desired.display_name, desired.sort_order
  FROM (
    SELECT
      NULLIF(entry.item->>'id', '')::uuid AS guest_id,
      regexp_replace(trim(entry.item->>'name'), '[[:space:]]+', ' ', 'g') AS display_name,
      entry.ordinality::smallint AS sort_order
    FROM jsonb_array_elements(COALESCE(_guests, '[]'::jsonb)) WITH ORDINALITY AS entry(item, ordinality)
  ) desired
  WHERE desired.guest_id IS NULL;

  IF _update_own_review THEN
    PERFORM public.update_own_review_v3(
      _group_id, _review_id, _review_overall, _review_taste, _review_value,
      _review_service, _review_atmosphere, _review_comment
    );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_own_review_v3(
  uuid, uuid, numeric, smallint, smallint, smallint, smallint, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_review_v3(
  uuid, uuid, numeric, smallint, smallint, smallint, smallint, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.update_visit_v1(
  uuid, uuid, date, text, uuid[], boolean, jsonb, uuid[], boolean, uuid, numeric,
  smallint, smallint, smallint, smallint, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_visit_v1(
  uuid, uuid, date, text, uuid[], boolean, jsonb, uuid[], boolean, uuid, numeric,
  smallint, smallint, smallint, smallint, text
) TO authenticated;

DO $assertions$
DECLARE
  _visit_definition text := pg_get_functiondef(
    'public.update_visit_v1(uuid,uuid,date,text,uuid[],boolean,jsonb,uuid[],boolean,uuid,numeric,smallint,smallint,smallint,smallint,text)'::regprocedure
  );
  _review_definition text := pg_get_functiondef(
    'public.update_own_review_v3(uuid,uuid,numeric,smallint,smallint,smallint,smallint,text)'::regprocedure
  );
BEGIN
  IF position('created_by = _uid' IN _visit_definition) = 0
     OR position('link_type = ''original''' IN _visit_definition) = 0 THEN
    RAISE EXCEPTION 'update_visit_v1 saknar creator/original-guard';
  END IF;
  IF position('public.memberships membership' IN _visit_definition) = 0 THEN
    RAISE EXCEPTION 'update_visit_v1 får inte ersätta osynliga cross-group-deltagare';
  END IF;
  IF position('update_own_review_v3' IN _visit_definition) = 0 THEN
    RAISE EXCEPTION 'update_visit_v1 måste återanvända den frysta reviewmodellen';
  END IF;
  IF position('visit_guest_member_proposals' IN _visit_definition) = 0 THEN
    RAISE EXCEPTION 'update_visit_v1 saknar skydd för gästidentitetskopplingar';
  END IF;
  IF position('SET comment = _normalized_comment' IN _review_definition) = 0 THEN
    RAISE EXCEPTION 'update_own_review_v3 måste bevara historiska ratings på scorelösa besök';
  END IF;
END;
$assertions$;

NOTIFY pgrst, 'reload schema';

COMMIT;