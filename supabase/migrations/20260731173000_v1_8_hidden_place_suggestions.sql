BEGIN;

-- Matrundan v1.8.0: gruppspecifik döljning av felaktiga eller inaktuella
-- providerträffar. Raderna påverkar endast sökningen i den aktuella gruppen.

CREATE TABLE IF NOT EXISTS public.group_hidden_place_suggestions (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_place_id text NOT NULL,
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  hidden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, provider, provider_place_id),
  CHECK (length(trim(provider)) BETWEEN 1 AND 40),
  CHECK (length(trim(provider_place_id)) BETWEEN 1 AND 500),
  CHECK (length(trim(name)) BETWEEN 1 AND 200),
  CHECK (length(address) <= 300),
  CHECK (length(city) <= 180)
);

CREATE INDEX IF NOT EXISTS group_hidden_place_suggestions_group_time_idx
  ON public.group_hidden_place_suggestions(group_id, hidden_at DESC);

ALTER TABLE public.group_hidden_place_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.group_hidden_place_suggestions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.group_hidden_place_suggestions TO service_role;

CREATE OR REPLACE FUNCTION public.list_group_hidden_place_suggestions(_group_id uuid)
RETURNS TABLE (
  provider text,
  provider_place_id text,
  name text,
  address text,
  city text,
  hidden_at timestamptz
)
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
    RAISE EXCEPTION 'Du saknar åtkomst till gruppen';
  END IF;

  RETURN QUERY
  SELECT
    h.provider,
    h.provider_place_id,
    h.name,
    h.address,
    h.city,
    h.hidden_at
  FROM public.group_hidden_place_suggestions h
  WHERE h.group_id = _group_id
  ORDER BY h.hidden_at DESC, h.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hide_group_place_suggestion(
  _group_id uuid,
  _provider text,
  _provider_place_id text,
  _name text,
  _address text DEFAULT '',
  _city text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _normalized_provider text := lower(trim(coalesce(_provider, '')));
  _normalized_place_id text := trim(coalesce(_provider_place_id, ''));
  _normalized_name text := trim(coalesce(_name, ''));
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du saknar åtkomst till gruppen';
  END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF length(_normalized_provider) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Ogiltig platsleverantör';
  END IF;
  IF length(_normalized_place_id) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Platsen saknar ett giltigt provider-ID';
  END IF;
  IF length(_normalized_name) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Platsen saknar ett giltigt namn';
  END IF;
  IF length(coalesce(_address, '')) > 300 OR length(coalesce(_city, '')) > 180 THEN
    RAISE EXCEPTION 'Platsinformationen är för lång';
  END IF;

  INSERT INTO public.group_hidden_place_suggestions (
    group_id,
    provider,
    provider_place_id,
    name,
    address,
    city,
    hidden_by,
    hidden_at
  ) VALUES (
    _group_id,
    _normalized_provider,
    _normalized_place_id,
    _normalized_name,
    trim(coalesce(_address, '')),
    trim(coalesce(_city, '')),
    _uid,
    now()
  )
  ON CONFLICT (group_id, provider, provider_place_id)
  DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    hidden_by = EXCLUDED.hidden_by,
    hidden_at = EXCLUDED.hidden_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_group_place_suggestion(
  _group_id uuid,
  _provider text,
  _provider_place_id text
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
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du saknar åtkomst till gruppen';
  END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;

  DELETE FROM public.group_hidden_place_suggestions
  WHERE group_id = _group_id
    AND provider = lower(trim(coalesce(_provider, '')))
    AND provider_place_id = trim(coalesce(_provider_place_id, ''));
END;
$function$;

REVOKE ALL ON FUNCTION public.list_group_hidden_place_suggestions(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_group_hidden_place_suggestions(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.hide_group_place_suggestion(uuid, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hide_group_place_suggestion(uuid, text, text, text, text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.restore_group_place_suggestion(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_group_place_suggestion(uuid, text, text)
  TO authenticated;

COMMIT;
