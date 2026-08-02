BEGIN;

-- v1.16.0: gruppprivat evidens får hjälpa andra grupper endast genom en
-- neutral, härledd signal. Ursprunglig grupp, användare, rapporttext, antal och
-- interna ID:n lämnas aldrig av läs-RPC:n.

CREATE TABLE IF NOT EXISTS public.place_data_signal_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid REFERENCES public.places(id) ON DELETE CASCADE,
  target_provider text,
  target_provider_place_id text,
  signal_kind text NOT NULL DEFAULT 'permanent_closure',
  verdict text NOT NULL,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT place_data_signal_confirmations_target_check CHECK (
    (
      place_id IS NOT NULL
      AND target_provider IS NULL
      AND target_provider_place_id IS NULL
    )
    OR
    (
      place_id IS NULL
      AND length(trim(COALESCE(target_provider, ''))) BETWEEN 1 AND 40
      AND length(trim(COALESCE(target_provider_place_id, ''))) BETWEEN 1 AND 500
    )
  ),
  CONSTRAINT place_data_signal_confirmations_kind_check CHECK (
    signal_kind = 'permanent_closure'
  ),
  CONSTRAINT place_data_signal_confirmations_verdict_check CHECK (
    verdict IN ('closed_permanently', 'appears_open')
  )
);

ALTER TABLE public.place_data_signal_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.place_data_signal_confirmations
  FROM PUBLIC, anon, authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS place_data_signal_confirmations_user_place_uidx
  ON public.place_data_signal_confirmations(user_id, place_id, signal_kind)
  WHERE place_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS place_data_signal_confirmations_user_provider_uidx
  ON public.place_data_signal_confirmations(
    user_id,
    target_provider,
    target_provider_place_id,
    signal_kind
  )
  WHERE place_id IS NULL;

CREATE INDEX IF NOT EXISTS place_data_signal_confirmations_place_idx
  ON public.place_data_signal_confirmations(place_id, updated_at DESC)
  WHERE place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS place_data_signal_confirmations_provider_idx
  ON public.place_data_signal_confirmations(
    target_provider,
    target_provider_place_id,
    updated_at DESC
  )
  WHERE place_id IS NULL;

CREATE OR REPLACE FUNCTION public.confirm_place_data_signal_v1(
  _group_id uuid,
  _place_id uuid,
  _provider text,
  _provider_place_id text,
  _verdict text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _provider_normalized text := NULLIF(lower(trim(COALESCE(_provider, ''))), '');
  _provider_place_id_normalized text := NULLIF(trim(COALESCE(_provider_place_id, '')), '');
  _target_lock text;
  _existing_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _verdict NOT IN ('closed_permanently', 'appears_open') THEN
    RAISE EXCEPTION 'Ogiltig bekräftelse';
  END IF;
  IF (_place_id IS NULL) = (_provider_normalized IS NULL OR _provider_place_id_normalized IS NULL) THEN
    RAISE EXCEPTION 'Ange exakt ett kanoniskt ställe eller en providerträff';
  END IF;

  IF _place_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.group_places gp
      WHERE gp.group_id = _group_id
        AND gp.place_id = _place_id
    ) THEN
      RAISE EXCEPTION 'Matstället finns inte i gruppens historik';
    END IF;
    _target_lock := 'place:' || _place_id::text;
  ELSE
    IF length(_provider_normalized) > 40 OR length(_provider_place_id_normalized) > 500 THEN
      RAISE EXCEPTION 'Provideridentiteten är ogiltig';
    END IF;
    _target_lock := 'provider:' || _provider_normalized || ':' || _provider_place_id_normalized;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('place-data-confirmation:' || _uid::text || ':' || _target_lock, 0)
  );

  SELECT c.id
  INTO _existing_id
  FROM public.place_data_signal_confirmations c
  WHERE c.user_id = _uid
    AND c.signal_kind = 'permanent_closure'
    AND (
      (_place_id IS NOT NULL AND c.place_id = _place_id)
      OR
      (
        _place_id IS NULL
        AND c.place_id IS NULL
        AND c.target_provider = _provider_normalized
        AND c.target_provider_place_id = _provider_place_id_normalized
      )
    )
  FOR UPDATE;

  IF _existing_id IS NULL
     AND (
       SELECT count(*)
       FROM public.place_data_signal_confirmations c
       WHERE c.user_id = _uid
         AND c.created_at >= now() - interval '24 hours'
     ) >= 50 THEN
    RAISE EXCEPTION 'Du har nått dygnsgränsen för platsdatabekräftelser';
  END IF;

  IF _existing_id IS NULL
     AND (
       SELECT count(*)
       FROM public.place_data_signal_confirmations c
       WHERE c.group_id = _group_id
         AND c.created_at >= now() - interval '24 hours'
     ) >= 200 THEN
    RAISE EXCEPTION 'Gruppen har nått dygnsgränsen för platsdatabekräftelser';
  END IF;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.place_data_signal_confirmations
    SET verdict = _verdict,
        group_id = _group_id,
        updated_at = now()
    WHERE id = _existing_id;
  ELSE
    INSERT INTO public.place_data_signal_confirmations (
      place_id,
      target_provider,
      target_provider_place_id,
      signal_kind,
      verdict,
      group_id,
      user_id
    ) VALUES (
      _place_id,
      CASE WHEN _place_id IS NULL THEN _provider_normalized ELSE NULL END,
      CASE WHEN _place_id IS NULL THEN _provider_place_id_normalized ELSE NULL END,
      'permanent_closure',
      _verdict,
      _group_id,
      _uid
    );
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_place_data_signals_v1(
  _group_id uuid,
  _targets jsonb
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
    RAISE EXCEPTION 'Du saknar åtkomst till gruppen';
  END IF;
  IF jsonb_typeof(_targets) <> 'array' THEN
    RAISE EXCEPTION 'Signalmålen måste vara en lista';
  END IF;
  IF jsonb_array_length(_targets) > 100 THEN
    RAISE EXCEPTION 'Högst 100 signalmål kan kontrolleras per anrop';
  END IF;

  WITH requested AS (
    SELECT
      ordinality,
      NULLIF(trim(target ->> 'key'), '') AS target_key,
      CASE
        WHEN COALESCE(target ->> 'placeId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (target ->> 'placeId')::uuid
        ELSE NULL
      END AS requested_place_id,
      NULLIF(lower(trim(target ->> 'provider')), '') AS provider,
      NULLIF(trim(target ->> 'providerPlaceId'), '') AS provider_place_id,
      COALESCE((target ->> 'hasWebsite')::boolean, false) AS has_website,
      CASE
        WHEN jsonb_typeof(target -> 'hasOpeningHours') = 'boolean'
        THEN (target ->> 'hasOpeningHours')::boolean
        ELSE NULL
      END AS has_opening_hours
    FROM jsonb_array_elements(_targets) WITH ORDINALITY AS items(target, ordinality)
  ),
  authorized AS (
    SELECT r.*
    FROM requested r
    WHERE r.target_key IS NOT NULL
      AND (
        (
          r.requested_place_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.group_places gp
            WHERE gp.group_id = _group_id
              AND gp.place_id = r.requested_place_id
          )
        )
        OR (r.provider IS NOT NULL AND r.provider_place_id IS NOT NULL)
      )
  ),
  resolved AS (
    SELECT
      r.*,
      COALESCE(
        r.requested_place_id,
        (
          SELECT ps.place_id
          FROM public.place_sources ps
          WHERE ps.provider = r.provider
            AND ps.provider_place_id = r.provider_place_id
            AND ps.status = 'active'
          ORDER BY ps.last_seen_at DESC NULLS LAST, ps.id
          LIMIT 1
        )
      ) AS resolved_place_id
    FROM authorized r
  ),
  evidence AS (
    SELECT
      r.*,
      EXISTS (
        SELECT 1
        FROM public.place_data_reports report
        WHERE report.group_id <> _group_id
          AND report.category = 'closed_or_replaced'
          AND report.created_at >= now() - interval '90 days'
          AND report.status = 'open'
          AND (
            (r.resolved_place_id IS NOT NULL AND report.place_id = r.resolved_place_id)
            OR
            (
              report.place_id IS NULL
              AND report.target_provider = r.provider
              AND report.target_provider_place_id = r.provider_place_id
            )
            OR
            (
              r.resolved_place_id IS NOT NULL
              AND report.place_id IS NULL
              AND EXISTS (
                SELECT 1
                FROM public.place_sources ps
                WHERE ps.place_id = r.resolved_place_id
                  AND ps.status = 'active'
                  AND ps.provider = report.target_provider
                  AND ps.provider_place_id = report.target_provider_place_id
              )
            )
          )
      ) AS has_unreviewed_report,
      EXISTS (
        SELECT 1
        FROM public.place_data_reports report
        WHERE report.group_id <> _group_id
          AND report.category = 'closed_or_replaced'
          AND report.created_at >= now() - interval '365 days'
          AND (
            report.status = 'ready_for_osm'
            OR report.osm_submission_state = 'published'
          )
          AND (
            (r.resolved_place_id IS NOT NULL AND report.place_id = r.resolved_place_id)
            OR
            (
              report.place_id IS NULL
              AND report.target_provider = r.provider
              AND report.target_provider_place_id = r.provider_place_id
            )
            OR
            (
              r.resolved_place_id IS NOT NULL
              AND report.place_id IS NULL
              AND EXISTS (
                SELECT 1
                FROM public.place_sources ps
                WHERE ps.place_id = r.resolved_place_id
                  AND ps.status = 'active'
                  AND ps.provider = report.target_provider
                  AND ps.provider_place_id = report.target_provider_place_id
              )
            )
          )
      ) AS has_reviewed_report,
      (
        SELECT count(DISTINCT confirmation.group_id)
        FROM public.place_data_signal_confirmations confirmation
        WHERE confirmation.group_id <> _group_id
          AND confirmation.signal_kind = 'permanent_closure'
          AND confirmation.verdict = 'closed_permanently'
          AND confirmation.updated_at >= now() - interval '180 days'
          AND (
            (r.resolved_place_id IS NOT NULL AND confirmation.place_id = r.resolved_place_id)
            OR
            (
              confirmation.place_id IS NULL
              AND confirmation.target_provider = r.provider
              AND confirmation.target_provider_place_id = r.provider_place_id
            )
            OR
            (
              r.resolved_place_id IS NOT NULL
              AND confirmation.place_id IS NULL
              AND EXISTS (
                SELECT 1
                FROM public.place_sources ps
                WHERE ps.place_id = r.resolved_place_id
                  AND ps.status = 'active'
                  AND ps.provider = confirmation.target_provider
                  AND ps.provider_place_id = confirmation.target_provider_place_id
              )
            )
          )
      ) AS closed_group_count,
      (
        SELECT count(DISTINCT confirmation.group_id)
        FROM public.place_data_signal_confirmations confirmation
        WHERE confirmation.group_id <> _group_id
          AND confirmation.signal_kind = 'permanent_closure'
          AND confirmation.verdict = 'appears_open'
          AND confirmation.updated_at >= now() - interval '180 days'
          AND (
            (r.resolved_place_id IS NOT NULL AND confirmation.place_id = r.resolved_place_id)
            OR
            (
              confirmation.place_id IS NULL
              AND confirmation.target_provider = r.provider
              AND confirmation.target_provider_place_id = r.provider_place_id
            )
            OR
            (
              r.resolved_place_id IS NOT NULL
              AND confirmation.place_id IS NULL
              AND EXISTS (
                SELECT 1
                FROM public.place_sources ps
                WHERE ps.place_id = r.resolved_place_id
                  AND ps.status = 'active'
                  AND ps.provider = confirmation.target_provider
                  AND ps.provider_place_id = confirmation.target_provider_place_id
              )
            )
          )
      ) AS open_group_count,
      EXISTS (
        SELECT 1
        FROM public.visits visit
        WHERE visit.place_id = r.resolved_place_id
          AND visit.visited_on >= current_date - 90
      ) AS has_recent_visit
    FROM resolved r
  ),
  classified AS (
    SELECT
      e.*,
      (e.has_reviewed_report OR e.closed_group_count >= 2) AS has_strong_positive,
      (
        e.has_reviewed_report
        OR e.has_unreviewed_report
        OR e.closed_group_count >= 1
      ) AS has_any_positive,
      (e.open_group_count >= 1 OR e.has_recent_visit) AS has_counter_evidence
    FROM evidence e
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', c.target_key,
        'closureStatus', CASE
          WHEN c.has_any_positive AND c.has_counter_evidence THEN 'uncertain'
          WHEN c.has_strong_positive THEN 'reviewed'
          WHEN c.has_any_positive THEN 'unverified'
          ELSE 'none'
        END,
        'limitedInformation', NOT c.has_website AND c.has_opening_hours IS FALSE,
        'recentlyConfirmedOpen', c.has_recent_visit OR c.open_group_count >= 2
      )
      ORDER BY c.ordinality
    ),
    '[]'::jsonb
  )
  INTO _result
  FROM classified c;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_place_data_signal_v1(uuid, uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_place_data_signal_v1(uuid, uuid, text, text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.get_place_data_signals_v1(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_place_data_signals_v1(uuid, jsonb)
  TO authenticated;

-- Självbetjänad kontoradering tar bort användarens aktiva bekräftelser. En
-- raderad användare ska inte fortsätta påverka andra gruppers platsdatasignal.
DO $do$
DECLARE
  _source text;
  _patched text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO _source
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'prepare_own_account_deletion';

  IF _source IS NULL THEN
    RAISE EXCEPTION 'prepare_own_account_deletion saknas';
  END IF;

  IF position('place_data_signal_confirmations' IN _source) = 0 THEN
    _patched := replace(
      _source,
      'WHERE submitted_by = _uid;',
      'WHERE submitted_by = _uid;' || E'\n\n' ||
      '  DELETE FROM public.place_data_signal_confirmations' || E'\n' ||
      '  WHERE user_id = _uid;'
    );

    IF _patched = _source THEN
      RAISE EXCEPTION 'Kontoraderingen kunde inte utökas för platsdatasignaler';
    END IF;

    EXECUTE _patched;
  END IF;
END
$do$;

COMMIT;
