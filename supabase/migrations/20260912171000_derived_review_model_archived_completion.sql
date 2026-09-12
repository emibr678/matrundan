BEGIN;

-- Issue #307 — komplettering av historiska besök ska inte bero på om stället
-- fortfarande ligger i gruppens aktiva lista. Själva besöksregistreringen
-- fortsätter att kräva collection_status = 'active' i create_visit_with_review_v5.
CREATE OR REPLACE FUNCTION public.resolve_new_review_model_v1(
  _group_id uuid,
  _place_id uuid,
  _is_takeaway boolean,
  _review_occasions text[] DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _occasions text[];
  _provided text[];
BEGIN
  IF COALESCE(_is_takeaway, false) THEN
    RETURN 'food_v1_takeaway';
  END IF;

  SELECT ARRAY(
    SELECT value
    FROM unnest(ARRAY['snabbt', 'avslappnat', 'middag']::text[]) WITH ORDINALITY allowed(value, ord)
    WHERE value = ANY(COALESCE(gp.occasions, '{}'::text[]))
    ORDER BY ord
    LIMIT 2
  )
  INTO _occasions
  FROM public.group_places gp
  WHERE gp.group_id = _group_id
    AND gp.place_id = _place_id;

  IF _occasions IS NULL THEN
    RAISE EXCEPTION 'Matstället finns inte i gruppen';
  END IF;

  IF cardinality(_occasions) = 0 THEN
    SELECT ARRAY(
      SELECT value
      FROM unnest(ARRAY['snabbt', 'avslappnat', 'middag']::text[]) WITH ORDINALITY allowed(value, ord)
      WHERE value = ANY(COALESCE(_review_occasions, '{}'::text[]))
      ORDER BY ord
      LIMIT 2
    ) INTO _provided;

    IF cardinality(COALESCE(_provided, '{}'::text[])) = 0 THEN
      RAISE EXCEPTION 'Välj vad stället passar för innan omdömet sparas';
    END IF;
    IF cardinality(COALESCE(_review_occasions, '{}'::text[])) <> cardinality(_provided) THEN
      RAISE EXCEPTION 'Passar för innehåller ogiltiga eller för många val';
    END IF;

    UPDATE public.group_places
    SET occasions = _provided,
        updated_at = now()
    WHERE group_id = _group_id
      AND place_id = _place_id
      AND cardinality(occasions) = 0;

    SELECT occasions
    INTO _occasions
    FROM public.group_places
    WHERE group_id = _group_id
      AND place_id = _place_id;
  END IF;

  IF 'avslappnat' = ANY(_occasions) OR 'middag' = ANY(_occasions) THEN
    RETURN 'food_v1_atmosphere';
  END IF;
  RETURN 'food_v1_quick';
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_new_review_model_v1(uuid, uuid, boolean, text[])
  FROM PUBLIC, anon, authenticated;

COMMIT;