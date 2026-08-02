BEGIN;

CREATE OR REPLACE FUNCTION public.get_group_place_practical_info_v1(
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
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;

  SELECT jsonb_build_object(
    'websiteOverride', gp.website_override,
    'openingHoursOverride', gp.opening_hours_override,
    'sourceUrl', gp.practical_info_source_url,
    'sourceNote', gp.practical_info_source_note,
    'updatedBy', gp.practical_info_updated_by,
    'updatedByName', CASE
      WHEN gp.practical_info_updated_by IS NULL THEN NULL
      ELSE COALESCE(profile.display_name, 'Tidigare medlem')
    END,
    'updatedAt', gp.practical_info_updated_at
  )
  INTO _result
  FROM public.group_places gp
  LEFT JOIN public.profiles profile ON profile.id = gp.practical_info_updated_by
  WHERE gp.group_id = _group_id
    AND gp.place_id = _place_id;

  IF _result IS NULL THEN RAISE EXCEPTION 'Matstället finns inte i gruppen'; END IF;
  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_place_practical_info_v1(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_place_practical_info_v1(uuid, uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
