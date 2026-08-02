BEGIN;

-- v1.16.3: den som har rapporterat en providerträff ska kunna se att den egna
-- rapporten väntar på granskning utan att andra medlemmars rapporter, texter,
-- identiteter eller interna ID:n exponeras.
CREATE OR REPLACE FUNCTION public.list_own_open_place_suggestion_report_keys_v1(
  _group_id uuid
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

  SELECT COALESCE(jsonb_agg(keys.target_key ORDER BY keys.target_key), '[]'::jsonb)
  INTO _result
  FROM (
    SELECT DISTINCT
      'provider:' || lower(trim(r.target_provider)) || ':' || trim(r.target_provider_place_id)
        AS target_key
    FROM public.place_data_reports r
    WHERE r.group_id = _group_id
      AND r.created_by = _uid
      AND r.place_id IS NULL
      AND r.target_provider IS NOT NULL
      AND r.target_provider_place_id IS NOT NULL
      AND r.status IN ('open', 'ready_for_osm')
  ) keys;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_own_open_place_suggestion_report_keys_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_own_open_place_suggestion_report_keys_v1(uuid)
  TO authenticated;

COMMIT;
