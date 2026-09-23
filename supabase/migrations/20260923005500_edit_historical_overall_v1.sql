BEGIN;

-- Issue #385: food_v0_overall är en historisk modell vars enda betygsfält var
-- ett manuellt helhetsbetyg. Vanlig redigering får därför ändra overall inom
-- samma modell, men får aldrig fabricera detaljbetyg eller byta review_model.
CREATE OR REPLACE FUNCTION public.enforce_derived_review_model_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.review_model IS NOT NULL
     AND NEW.review_model IS DISTINCT FROM OLD.review_model
     AND NOT (
       OLD.review_model IN ('food_v0_3d', 'food_v1_quick', 'food_v1_takeaway')
       AND NEW.review_model = 'food_v1_atmosphere'
     ) THEN
    RAISE EXCEPTION 'Reviewmodellen är historiskt låst';
  END IF;

  IF NEW.review_model = 'food_v0_overall' THEN
    IF NEW.overall IS NULL
       OR NEW.overall < 1
       OR NEW.overall > 5
       OR NEW.taste IS NOT NULL
       OR NEW.value IS NOT NULL
       OR NEW.service IS NOT NULL
       OR NEW.atmosphere IS NOT NULL THEN
      RAISE EXCEPTION 'Historiskt helhetsbetyg har ogiltig form';
    END IF;
  ELSIF NEW.review_model IS NOT NULL THEN
    NEW.overall := public.derive_review_overall_v1(
      NEW.review_model,
      NEW.taste,
      NEW.value,
      NEW.service,
      NEW.atmosphere
    );
  END IF;
  RETURN NEW;
END;
$function$;

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

  SELECT review_row.visit_id, review_row.user_id, review_row.comment, review_row.review_model, visit.meal_type
  INTO _visit_id, _author_id, _previous_comment, _review_model, _meal_type
  FROM public.reviews review_row
  JOIN public.visits visit ON visit.id = review_row.visit_id
  WHERE review_row.id = _review_id;

  IF _visit_id IS NULL THEN RAISE EXCEPTION 'Omdömet finns inte'; END IF;
  IF _author_id <> _uid THEN RAISE EXCEPTION 'Du kan bara redigera ditt eget omdöme'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links
    WHERE visit_id = _visit_id AND group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_participants
    WHERE visit_id = _visit_id AND user_id = _uid
  ) THEN
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
  ELSIF _review_model = 'food_v0_overall' THEN
    IF _overall IS NULL
       OR _overall < 1
       OR _overall > 5
       OR _overall <> trunc(_overall) THEN
      RAISE EXCEPTION 'Helhetsbetyg måste vara ett heltal 1–5 för äldre omdömen';
    END IF;
    IF _taste IS NOT NULL
       OR _value IS NOT NULL
       OR _service IS NOT NULL
       OR _atmosphere IS NOT NULL THEN
      RAISE EXCEPTION 'Historiskt helhetsbetyg saknar detaljbetyg';
    END IF;

    UPDATE public.reviews
    SET overall = _overall,
        comment = _normalized_comment,
        updated_at = now()
    WHERE id = _review_id AND user_id = _uid;
  ELSE
    IF _review_model IS NULL THEN
      RAISE EXCEPTION 'Omdömets betygsmodell saknas';
    END IF;
    IF _overall IS NOT NULL THEN
      RAISE EXCEPTION 'Helhetsbetyget härleds automatiskt för det här omdömet';
    END IF;

    _derived_overall := public.derive_review_overall_v1(
      _review_model,
      _taste,
      _value,
      _service,
      _atmosphere
    );

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

  IF NULLIF(trim(COALESCE(_previous_comment, '')), '') IS NULL
     AND _normalized_comment IS NOT NULL THEN
    UPDATE public.review_group_visibility
    SET comment_visible = true,
        updated_at = now()
    WHERE review_id = _review_id
      AND group_id = _group_id
      AND (rating_visible = true OR _scoreless)
      AND comment_visible = false;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_own_review_v3(
  uuid, uuid, numeric, smallint, smallint, smallint, smallint, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_review_v3(
  uuid, uuid, numeric, smallint, smallint, smallint, smallint, text
) TO authenticated;

COMMIT;
