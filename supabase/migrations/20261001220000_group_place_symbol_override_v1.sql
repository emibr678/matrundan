BEGIN;

ALTER TABLE public.group_places
  ADD COLUMN IF NOT EXISTS symbol_override text;

ALTER TABLE public.group_places
  DROP CONSTRAINT IF EXISTS group_places_symbol_override_check;

ALTER TABLE public.group_places
  ADD CONSTRAINT group_places_symbol_override_check
  CHECK (
    symbol_override IS NULL
    OR symbol_override IN (
      '🍽️','🍕','🍣','🍜','🍛','🍝','🍔','🌮','🥙','🧆','🥟','🥗','🥘',
      '🍲','🍤','🐟','🥩','🌭','🥐','🍞','☕','🍰','🍦','🌿','🔥','🫒'
    )
  );

CREATE OR REPLACE FUNCTION public.update_group_place_metadata_v2(
  _group_id uuid,
  _place_id uuid,
  _category_override text DEFAULT NULL,
  _cuisines_override text[] DEFAULT NULL,
  _symbol_override text DEFAULT NULL,
  _occasions text[] DEFAULT '{}',
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _occasion text;
  _normalized_cuisines text[];
  _normalized_symbol text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;

  IF _category_override IS NOT NULL
     AND _category_override NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn') THEN
    RAISE EXCEPTION 'Ogiltig kategori';
  END IF;

  _normalized_cuisines := CASE
    WHEN _cuisines_override IS NULL THEN NULL
    ELSE public.normalize_food_tags(_cuisines_override)
  END;

  IF COALESCE(cardinality(_normalized_cuisines), 0) > 20 THEN
    RAISE EXCEPTION 'Högst 20 val för kök och inriktning kan anges';
  END IF;
  IF COALESCE(cardinality(_occasions), 0) > 2 THEN
    RAISE EXCEPTION 'Högst två val för Typ av upplevelse kan anges';
  END IF;

  FOREACH _occasion IN ARRAY COALESCE(_occasions, ARRAY[]::text[])
  LOOP
    IF _occasion NOT IN ('snabbt','avslappnat','middag') THEN
      RAISE EXCEPTION 'Ogiltig etikett för Typ av upplevelse';
    END IF;
  END LOOP;

  _normalized_symbol := NULLIF(trim(COALESCE(_symbol_override, '')), '');
  IF _normalized_symbol IS NOT NULL
     AND _normalized_symbol NOT IN (
       '🍽️','🍕','🍣','🍜','🍛','🍝','🍔','🌮','🥙','🧆','🥟','🥗','🥘',
       '🍲','🍤','🐟','🥩','🌭','🥐','🍞','☕','🍰','🍦','🌿','🔥','🫒'
     ) THEN
    RAISE EXCEPTION 'Ogiltig symbol';
  END IF;

  UPDATE public.group_places
  SET category_override = _category_override,
      cuisines_override = _normalized_cuisines,
      symbol_override = _normalized_symbol,
      occasions = COALESCE(_occasions, ARRAY[]::text[]),
      notes = NULLIF(trim(COALESCE(_notes, '')), ''),
      updated_at = now()
  WHERE group_id = _group_id AND place_id = _place_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Matstället finns inte i gruppen'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5o(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
  _places jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Not a member of group';
  END IF;

  _result := public.get_group_app_state_v5n(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_set(
        place_item.item,
        '{symbolOverride}',
        COALESCE(to_jsonb(gp.symbol_override), 'null'::jsonb),
        true
      )
      ORDER BY place_item.ordinality
    ),
    '[]'::jsonb
  )
  INTO _places
  FROM jsonb_array_elements(COALESCE(_result->'places', '[]'::jsonb))
    WITH ORDINALITY AS place_item(item, ordinality)
  LEFT JOIN public.group_places gp
    ON gp.group_id = _group_id
   AND gp.place_id = (place_item.item->>'id')::uuid;

  RETURN jsonb_set(_result, '{places}', COALESCE(_places, '[]'::jsonb), true);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_group_place_metadata_v2(
  uuid, uuid, text, text[], text, text[], text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_group_app_state_v5o(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_group_place_metadata_v2(
  uuid, uuid, text, text[], text, text[], text
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5o(uuid)
  TO authenticated, service_role;

COMMIT;
