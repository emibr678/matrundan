BEGIN;

-- Issue #318: valfri kort gruppbeskrivning som privat gruppmetadata.
-- Additiv migration: befintliga grupper får NULL och all historik bevaras.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_description_length_check;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_description_length_check
  CHECK (description IS NULL OR char_length(description) <= 160);

COMMENT ON COLUMN public.groups.description IS
  'Valfri privat beskrivning av gruppens gemensamma syfte, högst 160 tecken.';

CREATE OR REPLACE FUNCTION public.update_group_identity_v1(
  _group_id uuid,
  _name text,
  _emoji text DEFAULT NULL,
  _description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _normalized_name text;
  _normalized_description text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan ändra gruppens uppgifter';
  END IF;

  _normalized_name := trim(coalesce(_name, ''));
  IF length(_normalized_name) < 2 OR length(_normalized_name) > 60 THEN
    RAISE EXCEPTION 'Gruppnamnet måste vara 2–60 tecken';
  END IF;

  _normalized_description := NULLIF(trim(coalesce(_description, '')), '');
  IF char_length(coalesce(_normalized_description, '')) > 160 THEN
    RAISE EXCEPTION 'Gruppbeskrivningen får vara högst 160 tecken';
  END IF;

  UPDATE public.groups
  SET name = _normalized_name,
      emoji = NULLIF(trim(coalesce(_emoji, '')), ''),
      description = _normalized_description,
      updated_at = now()
  WHERE id = _group_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_group_identity_v1(uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_group_identity_v1(uuid, text, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_group_with_owner_v3(
  _name text,
  _emoji text DEFAULT NULL,
  _description text DEFAULT NULL,
  _search_areas jsonb DEFAULT '[]'::jsonb,
  _default_radius_km integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _gid uuid;
  _normalized_description text;
BEGIN
  _normalized_description := NULLIF(trim(coalesce(_description, '')), '');
  IF char_length(coalesce(_normalized_description, '')) > 160 THEN
    RAISE EXCEPTION 'Gruppbeskrivningen får vara högst 160 tecken';
  END IF;

  _gid := public.create_group_with_owner_v2(
    _name,
    _emoji,
    coalesce(_search_areas, '[]'::jsonb),
    _default_radius_km
  );

  UPDATE public.groups
  SET description = _normalized_description,
      updated_at = now()
  WHERE id = _gid;

  RETURN _gid;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_group_with_owner_v3(text, text, text, jsonb, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_with_owner_v3(text, text, text, jsonb, integer)
  TO authenticated;

-- Samma medlemsscopade lista som tidigare, utökad med privat beskrivning och en liten
-- igenkänningspreview av andra aktiva medlemmar. Ingen data från andra grupper exponeras.
CREATE OR REPLACE FUNCTION public.list_user_groups_v4b()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'emoji', g.emoji,
        'description', g.description,
        'memberPreviewNames', COALESCE((
          SELECT jsonb_agg(preview.member_name ORDER BY lower(preview.member_name), preview.user_id)
          FROM (
            SELECT
              candidate.user_id,
              COALESCE(NULLIF(trim(profile.display_name), ''), 'Medlem') AS member_name
            FROM public.memberships candidate
            LEFT JOIN public.profiles profile ON profile.id = candidate.user_id
            WHERE candidate.group_id = g.id
              AND candidate.status = 'active'
              AND candidate.user_id <> auth.uid()
            ORDER BY
              lower(COALESCE(NULLIF(trim(profile.display_name), ''), 'Medlem')),
              candidate.user_id
            LIMIT 2
          ) preview
        ), '[]'::jsonb),
        'otherMemberCount', (
          SELECT count(*)
          FROM public.memberships candidate
          WHERE candidate.group_id = g.id
            AND candidate.status = 'active'
            AND candidate.user_id <> auth.uid()
        ),
        'role', m.role,
        'lifecycleStatus', g.lifecycle_status
      )
      ORDER BY
        CASE WHEN g.lifecycle_status = 'active' THEN 0 ELSE 1 END,
        lower(g.name),
        g.id
    ),
    '[]'::jsonb
  )
  FROM public.memberships m
  JOIN public.groups g ON g.id = m.group_id
  WHERE m.user_id = auth.uid()
    AND m.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.list_user_groups_v4b() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_user_groups_v4b() TO authenticated;

COMMIT;
