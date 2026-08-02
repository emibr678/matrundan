BEGIN;

-- v1.19.0: anonyma, fältvisa förslag mellan grupper som redan delar samma
-- kanoniska matställe. Ursprunglig grupp, medlem, privat källa och anteckning
-- lämnar aldrig servergränsen. Samma migration stänger den tidigare direkta
-- authenticated-skrivvägen till den globala Geoapify-snapshoten.

ALTER TABLE public.group_places
  ADD COLUMN IF NOT EXISTS website_cross_group_proposal_at timestamptz,
  ADD COLUMN IF NOT EXISTS opening_hours_cross_group_proposal_at timestamptz;

CREATE INDEX IF NOT EXISTS group_places_cross_group_practical_info_idx
  ON public.group_places(
    place_id,
    website_cross_group_proposal_at,
    opening_hours_cross_group_proposal_at
  )
  WHERE collection_status = 'active';

CREATE OR REPLACE FUNCTION public.safe_cross_group_website_v1(_value text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH normalized AS (
    SELECT public.normalize_place_website(_value) AS value
  )
  SELECT value IS NOT NULL
    AND lower(value) !~ '^https?://(localhost([:/]|$)|0\.0\.0\.0([:/]|$)|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[::1\]([:/]|$)|[^/]+\.local([:/]|$)|[^/]+\.internal([:/]|$))'
  FROM normalized;
$function$;

REVOKE ALL ON FUNCTION public.safe_cross_group_website_v1(text)
  FROM PUBLIC, anon, authenticated;

-- Externa snapshots är kanonisk providerdata. En vanlig klient får läsa dem
-- endast genom gruppverifierad kontext men får aldrig skriva en global snapshot.
CREATE OR REPLACE FUNCTION public.save_place_external_info_snapshot_v1(
  _group_id uuid,
  _place_id uuid,
  _provider_place_id text,
  _website text,
  _opening_hours jsonb,
  _timezone text,
  _fetched_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _website_normalized text := public.normalize_place_website(_website);
  _payload jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_places gp
    JOIN public.place_sources ps ON ps.place_id = gp.place_id
    WHERE gp.group_id = _group_id
      AND gp.place_id = _place_id
      AND ps.provider = 'geoapify'
      AND ps.provider_place_id = trim(_provider_place_id)
      AND ps.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matställets externa källa kunde inte verifieras';
  END IF;
  IF NOT public.valid_opening_hours_schedule_v1(_opening_hours) THEN
    RAISE EXCEPTION 'Öppettiderna har ett ogiltigt format';
  END IF;
  IF _fetched_at IS NULL
     OR _fetched_at > now() + interval '5 minutes'
     OR _fetched_at < now() - interval '1 day' THEN
    RAISE EXCEPTION 'Ogiltig hämtningstid';
  END IF;

  _payload := jsonb_build_object(
    'website', _website_normalized,
    'openingHours', _opening_hours,
    'timezone', NULLIF(trim(COALESCE(_timezone, '')), '')
  );

  INSERT INTO public.place_external_info_snapshots (
    place_id,
    provider,
    provider_place_id,
    website,
    opening_hours,
    timezone,
    fetched_at,
    fingerprint,
    updated_at
  ) VALUES (
    _place_id,
    'geoapify',
    trim(_provider_place_id),
    _website_normalized,
    _opening_hours,
    NULLIF(trim(COALESCE(_timezone, '')), ''),
    _fetched_at,
    md5(_payload::text),
    now()
  )
  ON CONFLICT (place_id) DO UPDATE
  SET provider = EXCLUDED.provider,
      provider_place_id = EXCLUDED.provider_place_id,
      website = EXCLUDED.website,
      opening_hours = EXCLUDED.opening_hours,
      timezone = EXCLUDED.timezone,
      fetched_at = EXCLUDED.fetched_at,
      fingerprint = EXCLUDED.fingerprint,
      updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.save_place_external_info_snapshot_v1(
  uuid, uuid, text, text, jsonb, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_place_external_info_snapshot_v1(
  uuid, uuid, text, text, jsonb, text, timestamptz
) TO service_role;

-- En vanlig gruppändring blir bara möjlig att föreslå anonymt när den har en
-- uttrycklig publik källänk. Själva källänken och den privata observationen
-- delas aldrig till en annan grupp.
CREATE OR REPLACE FUNCTION public.update_group_place_practical_info_v1(
  _group_id uuid,
  _place_id uuid,
  _website_override text DEFAULT NULL,
  _opening_hours_override jsonb DEFAULT NULL,
  _source_url text DEFAULT NULL,
  _source_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _website text := public.normalize_place_website(_website_override);
  _source_website text := public.normalize_place_website(_source_url);
  _source_note_normalized text := NULLIF(
    regexp_replace(trim(COALESCE(_source_note, '')), '[[:space:]]+', ' ', 'g'),
    ''
  );
  _current public.group_places%ROWTYPE;
  _website_changed boolean;
  _opening_hours_changed boolean;
  _source_changed boolean;
  _website_proposal_at timestamptz;
  _opening_hours_proposal_at timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _website_override IS NOT NULL AND trim(_website_override) <> '' AND _website IS NULL THEN
    RAISE EXCEPTION 'Ange en giltig webbplats';
  END IF;
  IF _source_url IS NOT NULL AND trim(_source_url) <> '' AND _source_website IS NULL THEN
    RAISE EXCEPTION 'Ange en giltig källänk';
  END IF;
  IF NOT public.valid_opening_hours_schedule_v1(_opening_hours_override) THEN
    RAISE EXCEPTION 'Öppettiderna har ett ogiltigt format';
  END IF;
  IF _source_note_normalized IS NOT NULL AND length(_source_note_normalized) > 1000 THEN
    RAISE EXCEPTION 'Källanteckningen får vara högst 1000 tecken';
  END IF;
  IF (_website IS NOT NULL OR _opening_hours_override IS NOT NULL)
     AND _source_website IS NULL
     AND COALESCE(length(_source_note_normalized), 0) < 10 THEN
    RAISE EXCEPTION 'Ange en källänk eller en kort observation med minst 10 tecken';
  END IF;

  SELECT * INTO _current
  FROM public.group_places
  WHERE group_id = _group_id AND place_id = _place_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Matstället finns inte i gruppen'; END IF;

  _website_changed := _current.website_override IS DISTINCT FROM _website;
  _opening_hours_changed :=
    _current.opening_hours_override IS DISTINCT FROM _opening_hours_override;
  _source_changed :=
    _current.practical_info_source_url IS DISTINCT FROM _source_website;

  IF NOT _website_changed
     AND NOT _opening_hours_changed
     AND NOT _source_changed
     AND _current.practical_info_source_note IS NOT DISTINCT FROM _source_note_normalized THEN
    RETURN;
  END IF;

  _website_proposal_at := CASE
    WHEN _website IS NULL THEN NULL
    WHEN _website_changed OR _source_changed THEN
      CASE
        WHEN _source_website IS NOT NULL
          AND public.safe_cross_group_website_v1(_website)
        THEN now()
        ELSE NULL
      END
    ELSE _current.website_cross_group_proposal_at
  END;

  _opening_hours_proposal_at := CASE
    WHEN _opening_hours_override IS NULL THEN NULL
    WHEN _opening_hours_changed OR _source_changed THEN
      CASE WHEN _source_website IS NOT NULL THEN now() ELSE NULL END
    ELSE _current.opening_hours_cross_group_proposal_at
  END;

  UPDATE public.group_places
  SET website_override = _website,
      opening_hours_override = _opening_hours_override,
      practical_info_source_url = _source_website,
      practical_info_source_note = _source_note_normalized,
      practical_info_updated_by = _uid,
      practical_info_updated_at = now(),
      website_cross_group_proposal_at = _website_proposal_at,
      opening_hours_cross_group_proposal_at = _opening_hours_proposal_at,
      updated_at = now()
  WHERE group_id = _group_id AND place_id = _place_id;

  INSERT INTO public.group_place_practical_info_history (
    group_id,
    place_id,
    website_override,
    opening_hours_override,
    source_url,
    source_note,
    changed_by
  ) VALUES (
    _group_id,
    _place_id,
    _website,
    _opening_hours_override,
    _source_website,
    _source_note_normalized,
    _uid
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.update_group_place_practical_info_v1(
  uuid, uuid, text, jsonb, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_group_place_practical_info_v1(
  uuid, uuid, text, jsonb, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.cross_group_practical_info_candidate_v1(
  _group_id uuid,
  _place_id uuid,
  _field text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _distinct_values integer := 0;
  _fingerprint text;
  _website text;
  _opening_hours jsonb;
  _changed_at timestamptz;
  _current_website text;
  _current_opening_hours jsonb;
BEGIN
  IF _field = 'website' THEN
    SELECT count(DISTINCT md5('website:' || gp.website_override))
    INTO _distinct_values
    FROM public.group_places gp
    JOIN public.groups g ON g.id = gp.group_id
    WHERE gp.place_id = _place_id
      AND gp.group_id <> _group_id
      AND gp.collection_status = 'active'
      AND g.lifecycle_status = 'active'
      AND gp.website_cross_group_proposal_at >= now() - interval '90 days'
      AND gp.website_override IS NOT NULL
      AND public.safe_cross_group_website_v1(gp.website_override);

    IF _distinct_values = 0 THEN
      RETURN jsonb_build_object('status', 'none');
    END IF;
    IF _distinct_values > 1 THEN
      RETURN jsonb_build_object('status', 'conflicting');
    END IF;

    SELECT
      gp.website_override,
      md5('website:' || gp.website_override),
      gp.website_cross_group_proposal_at
    INTO _website, _fingerprint, _changed_at
    FROM public.group_places gp
    JOIN public.groups g ON g.id = gp.group_id
    WHERE gp.place_id = _place_id
      AND gp.group_id <> _group_id
      AND gp.collection_status = 'active'
      AND g.lifecycle_status = 'active'
      AND gp.website_cross_group_proposal_at >= now() - interval '90 days'
      AND gp.website_override IS NOT NULL
      AND public.safe_cross_group_website_v1(gp.website_override)
    ORDER BY gp.website_cross_group_proposal_at DESC
    LIMIT 1;

    SELECT COALESCE(target.website_override, place.website, snapshot.website)
    INTO _current_website
    FROM public.group_places target
    JOIN public.places place ON place.id = target.place_id
    LEFT JOIN public.place_external_info_snapshots snapshot
      ON snapshot.place_id = target.place_id
    WHERE target.group_id = _group_id
      AND target.place_id = _place_id;

    IF _current_website IS NOT DISTINCT FROM _website THEN
      RETURN jsonb_build_object('status', 'none');
    END IF;

    RETURN jsonb_build_object(
      'status', 'available',
      'fingerprint', _fingerprint,
      'website', _website,
      'changedAt', _changed_at
    );
  END IF;

  IF _field = 'opening_hours' THEN
    SELECT count(DISTINCT md5('opening_hours:' || gp.opening_hours_override::text))
    INTO _distinct_values
    FROM public.group_places gp
    JOIN public.groups g ON g.id = gp.group_id
    WHERE gp.place_id = _place_id
      AND gp.group_id <> _group_id
      AND gp.collection_status = 'active'
      AND g.lifecycle_status = 'active'
      AND gp.opening_hours_cross_group_proposal_at >= now() - interval '90 days'
      AND gp.opening_hours_override IS NOT NULL
      AND public.valid_opening_hours_schedule_v1(gp.opening_hours_override);

    IF _distinct_values = 0 THEN
      RETURN jsonb_build_object('status', 'none');
    END IF;
    IF _distinct_values > 1 THEN
      RETURN jsonb_build_object('status', 'conflicting');
    END IF;

    SELECT
      gp.opening_hours_override,
      md5('opening_hours:' || gp.opening_hours_override::text),
      gp.opening_hours_cross_group_proposal_at
    INTO _opening_hours, _fingerprint, _changed_at
    FROM public.group_places gp
    JOIN public.groups g ON g.id = gp.group_id
    WHERE gp.place_id = _place_id
      AND gp.group_id <> _group_id
      AND gp.collection_status = 'active'
      AND g.lifecycle_status = 'active'
      AND gp.opening_hours_cross_group_proposal_at >= now() - interval '90 days'
      AND gp.opening_hours_override IS NOT NULL
      AND public.valid_opening_hours_schedule_v1(gp.opening_hours_override)
    ORDER BY gp.opening_hours_cross_group_proposal_at DESC
    LIMIT 1;

    SELECT COALESCE(target.opening_hours_override, snapshot.opening_hours)
    INTO _current_opening_hours
    FROM public.group_places target
    LEFT JOIN public.place_external_info_snapshots snapshot
      ON snapshot.place_id = target.place_id
    WHERE target.group_id = _group_id
      AND target.place_id = _place_id;

    IF _current_opening_hours IS NOT DISTINCT FROM _opening_hours THEN
      RETURN jsonb_build_object('status', 'none');
    END IF;

    RETURN jsonb_build_object(
      'status', 'available',
      'fingerprint', _fingerprint,
      'openingHours', _opening_hours,
      'changedAt', _changed_at
    );
  END IF;

  RAISE EXCEPTION 'Okänt förslagsfält';
END;
$function$;

REVOKE ALL ON FUNCTION public.cross_group_practical_info_candidate_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_cross_group_practical_info_suggestions_v1(
  _group_id uuid,
  _place_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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
    RAISE EXCEPTION 'Matstället finns inte aktivt i gruppen';
  END IF;

  RETURN jsonb_build_object(
    'website', public.cross_group_practical_info_candidate_v1(
      _group_id, _place_id, 'website'
    ),
    'openingHours', public.cross_group_practical_info_candidate_v1(
      _group_id, _place_id, 'opening_hours'
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_cross_group_practical_info_suggestions_v1(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cross_group_practical_info_suggestions_v1(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_cross_group_practical_info_suggestion_v1(
  _group_id uuid,
  _place_id uuid,
  _field text,
  _fingerprint text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _candidate jsonb;
  _current public.group_places%ROWTYPE;
  _updated public.group_places%ROWTYPE;
  _note text := 'Godkänt anonymt förslag från andra grupper i Matrundan.';
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _field NOT IN ('website', 'opening_hours') THEN
    RAISE EXCEPTION 'Okänt förslagsfält';
  END IF;
  IF _fingerprint IS NULL OR _fingerprint !~ '^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'Förslaget har ett ogiltigt fingeravtryck';
  END IF;

  SELECT * INTO _current
  FROM public.group_places
  WHERE group_id = _group_id
    AND place_id = _place_id
    AND collection_status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Matstället finns inte aktivt i gruppen'; END IF;

  _candidate := public.cross_group_practical_info_candidate_v1(
    _group_id,
    _place_id,
    _field
  );

  IF COALESCE(_candidate->>'status', 'none') <> 'available'
     OR _candidate->>'fingerprint' IS DISTINCT FROM _fingerprint THEN
    RAISE EXCEPTION 'Förslaget har ändrats. Ladda om och granska det igen';
  END IF;

  IF _field = 'website' THEN
    UPDATE public.group_places
    SET website_override = public.normalize_place_website(_candidate->>'website'),
        practical_info_source_url = NULL,
        practical_info_source_note = _note,
        practical_info_updated_by = _uid,
        practical_info_updated_at = now(),
        website_cross_group_proposal_at = NULL,
        updated_at = now()
    WHERE group_id = _group_id AND place_id = _place_id
    RETURNING * INTO _updated;
  ELSE
    IF NOT public.valid_opening_hours_schedule_v1(_candidate->'openingHours') THEN
      RAISE EXCEPTION 'Förslagets öppettider har ett ogiltigt format';
    END IF;
    UPDATE public.group_places
    SET opening_hours_override = _candidate->'openingHours',
        practical_info_source_url = NULL,
        practical_info_source_note = _note,
        practical_info_updated_by = _uid,
        practical_info_updated_at = now(),
        opening_hours_cross_group_proposal_at = NULL,
        updated_at = now()
    WHERE group_id = _group_id AND place_id = _place_id
    RETURNING * INTO _updated;
  END IF;

  INSERT INTO public.group_place_practical_info_history (
    group_id,
    place_id,
    website_override,
    opening_hours_override,
    source_url,
    source_note,
    changed_by
  ) VALUES (
    _group_id,
    _place_id,
    _updated.website_override,
    _updated.opening_hours_override,
    NULL,
    _note,
    _uid
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_cross_group_practical_info_suggestion_v1(
  uuid, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_cross_group_practical_info_suggestion_v1(
  uuid, uuid, text, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
