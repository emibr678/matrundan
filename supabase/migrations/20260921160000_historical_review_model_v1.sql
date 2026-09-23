BEGIN;

-- Issue #365 — gör den tidigare tredimensionella matmodellen explicit och stabil.
--
-- Migrationen accepterar bara verifierade legacyformer:
-- 1) scorebara matomdömen med Smak, Service och Prisvärdhet men utan Atmosfär,
-- 2) äldre matomdömen där endast manuellt helhetsbetyg sparades.
-- Partiella detaljbetyg eller andra oväntade former stoppar hela transaktionen.

DO $guard$
DECLARE
  _unexpected_food integer;
  _unexpected_scoreless integer;
BEGIN
  SELECT count(*)
  INTO _unexpected_food
  FROM public.reviews review_row
  JOIN public.visits visit ON visit.id = review_row.visit_id
  WHERE review_row.review_model IS NULL
    AND visit.meal_type <> 'dryck'
    AND NOT (
      (
        review_row.overall BETWEEN 1 AND 5
        AND review_row.taste BETWEEN 1 AND 5
        AND review_row.value BETWEEN 1 AND 5
        AND review_row.service BETWEEN 1 AND 5
        AND review_row.atmosphere IS NULL
      )
      OR (
        review_row.overall BETWEEN 1 AND 5
        AND review_row.taste IS NULL
        AND review_row.value IS NULL
        AND review_row.service IS NULL
        AND review_row.atmosphere IS NULL
      )
    );

  SELECT count(*)
  INTO _unexpected_scoreless
  FROM public.reviews review_row
  JOIN public.visits visit ON visit.id = review_row.visit_id
  WHERE review_row.review_model IS NULL
    AND visit.meal_type = 'dryck'
    AND (
      review_row.overall IS NOT NULL
      OR review_row.taste IS NOT NULL
      OR review_row.value IS NOT NULL
      OR review_row.service IS NOT NULL
      OR review_row.atmosphere IS NOT NULL
    );

  IF _unexpected_food > 0 OR _unexpected_scoreless > 0 THEN
    RAISE EXCEPTION
      'Historiska omdömen har oväntad form (mat: %, scorelösa: %). Kör predeploy-historical-review-model.sql och bedöm datan manuellt.',
      _unexpected_food,
      _unexpected_scoreless;
  END IF;
END;
$guard$;

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_review_model_check;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_review_model_check
  CHECK (
    review_model IS NULL OR review_model IN (
      'food_v0_overall',
      'food_v0_3d',
      'food_v1_takeaway',
      'food_v1_quick',
      'food_v1_atmosphere'
    )
  );

CREATE OR REPLACE FUNCTION public.derive_review_overall_v1(
  _review_model text,
  _taste smallint,
  _value smallint,
  _service smallint,
  _atmosphere smallint DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  _sum numeric;
  _count integer;
BEGIN
  IF _review_model NOT IN (
    'food_v0_3d',
    'food_v1_takeaway',
    'food_v1_quick',
    'food_v1_atmosphere'
  ) THEN
    RAISE EXCEPTION 'Ogiltig reviewmodell';
  END IF;
  IF _taste IS NULL OR _taste < 1 OR _taste > 5 THEN
    RAISE EXCEPTION 'Smak måste vara 1–5';
  END IF;
  IF _value IS NULL OR _value < 1 OR _value > 5 THEN
    RAISE EXCEPTION 'Prisvärdhet måste vara 1–5';
  END IF;
  IF _service IS NULL OR _service < 1 OR _service > 5 THEN
    RAISE EXCEPTION 'Service måste vara 1–5';
  END IF;

  _sum := _taste + _value + _service;
  _count := 3;

  IF _review_model = 'food_v1_atmosphere' THEN
    IF _atmosphere IS NULL OR _atmosphere < 1 OR _atmosphere > 5 THEN
      RAISE EXCEPTION 'Atmosfär måste vara 1–5';
    END IF;
    _sum := _sum + _atmosphere;
    _count := 4;
  ELSIF _atmosphere IS NOT NULL THEN
    RAISE EXCEPTION 'Atmosfär ingår inte i den här reviewmodellen';
  END IF;

  RETURN round(_sum / _count, 2);
END;
$function$;

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

    IF TG_OP = 'UPDATE'
       AND OLD.review_model = 'food_v0_overall'
       AND (
         NEW.overall IS DISTINCT FROM OLD.overall
         OR NEW.taste IS DISTINCT FROM OLD.taste
         OR NEW.value IS DISTINCT FROM OLD.value
         OR NEW.service IS DISTINCT FROM OLD.service
         OR NEW.atmosphere IS DISTINCT FROM OLD.atmosphere
       ) THEN
      RAISE EXCEPTION 'Historiskt helhetsbetyg är låst';
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

-- Backfillen är en modell-/matematikmigrering, inte en användarredigering.
-- Därför bevaras reviewns tidigare updated_at samtidigt som derivationstriggern
-- räknar om overall och låser modellen.
ALTER TABLE public.reviews DISABLE TRIGGER trg_reviews_updated_at;

UPDATE public.reviews AS review_row
SET review_model = CASE
  WHEN review_row.taste IS NOT NULL
    AND review_row.value IS NOT NULL
    AND review_row.service IS NOT NULL
  THEN 'food_v0_3d'
  ELSE 'food_v0_overall'
END
FROM public.visits AS visit
WHERE visit.id = review_row.visit_id
  AND visit.meal_type <> 'dryck'
  AND review_row.review_model IS NULL;

ALTER TABLE public.reviews ENABLE TRIGGER trg_reviews_updated_at;

DO $assertions$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.reviews review_row
    JOIN public.visits visit ON visit.id = review_row.visit_id
    WHERE visit.meal_type <> 'dryck'
      AND review_row.review_model IS NULL
  ) THEN
    RAISE EXCEPTION 'Migrationen lämnade scorebara omdömen utan review_model';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reviews review_row
    WHERE review_row.review_model = 'food_v0_3d'
      AND (
        review_row.atmosphere IS NOT NULL
        OR review_row.overall IS DISTINCT FROM round(
          (review_row.taste + review_row.value + review_row.service)::numeric / 3,
          2
        )
      )
  ) THEN
    RAISE EXCEPTION 'Historisk 3D-modell eller härlett helhetsbetyg är inkonsekvent';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reviews review_row
    WHERE review_row.review_model = 'food_v0_overall'
      AND (
        review_row.overall IS NULL
        OR review_row.overall < 1
        OR review_row.overall > 5
        OR review_row.taste IS NOT NULL
        OR review_row.value IS NOT NULL
        OR review_row.service IS NOT NULL
        OR review_row.atmosphere IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Historisk overall-only-modell är inkonsekvent';
  END IF;
END;
$assertions$;

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
    IF _overall IS NOT NULL
       OR _taste IS NOT NULL
       OR _value IS NOT NULL
       OR _service IS NOT NULL
       OR _atmosphere IS NOT NULL THEN
      RAISE EXCEPTION 'Historiskt helhetsbetyg kan inte skrivas om utan en ny uttrycklig modell';
    END IF;

    UPDATE public.reviews
    SET comment = _normalized_comment,
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

CREATE OR REPLACE FUNCTION public.upgrade_own_review_model_v1(
  _group_id uuid,
  _review_id uuid,
  _taste smallint,
  _value smallint,
  _service smallint,
  _atmosphere smallint,
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
  _place_id uuid;
  _meal_type text;
  _is_takeaway boolean;
  _stored_model text;
  _target_model text;
  _previous_comment text;
  _derived_overall numeric(4,2);
  _normalized_comment text := NULLIF(trim(COALESCE(_comment, '')), '');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN RAISE EXCEPTION 'Du är inte medlem i gruppen'; END IF;

  SELECT
    review_row.visit_id,
    review_row.user_id,
    review_row.review_model,
    review_row.comment,
    visit.place_id,
    visit.meal_type,
    visit.is_takeaway
  INTO
    _visit_id,
    _author_id,
    _stored_model,
    _previous_comment,
    _place_id,
    _meal_type,
    _is_takeaway
  FROM public.reviews review_row
  JOIN public.visits visit ON visit.id = review_row.visit_id
  WHERE review_row.id = _review_id
  FOR UPDATE OF review_row;

  IF _visit_id IS NULL THEN RAISE EXCEPTION 'Omdömet finns inte'; END IF;
  IF _author_id <> _uid THEN RAISE EXCEPTION 'Du kan bara komplettera ditt eget omdöme'; END IF;
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
    RAISE EXCEPTION 'Endast faktiska deltagare kan komplettera ett omdöme';
  END IF;
  IF _meal_type = 'dryck' THEN
    RAISE EXCEPTION 'Något att dricka ska inte ha stjärnbetyg';
  END IF;
  IF _stored_model IS NULL
     OR _stored_model NOT IN ('food_v0_3d', 'food_v1_quick', 'food_v1_takeaway') THEN
    RAISE EXCEPTION 'Omdömet kan inte kompletteras från den här betygsmodellen';
  END IF;

  _target_model := public.resolve_new_review_model_v1(
    _group_id,
    _place_id,
    COALESCE(_is_takeaway, false),
    NULL
  );
  IF _target_model <> 'food_v1_atmosphere' THEN
    RAISE EXCEPTION 'Atmosfär ingår inte i den aktuella betygsmodellen';
  END IF;

  _derived_overall := public.derive_review_overall_v1(
    _target_model,
    _taste,
    _value,
    _service,
    _atmosphere
  );

  UPDATE public.reviews
  SET review_model = _target_model,
      overall = _derived_overall,
      taste = _taste,
      value = _value,
      service = _service,
      atmosphere = _atmosphere,
      comment = _normalized_comment,
      updated_at = now()
  WHERE id = _review_id
    AND user_id = _uid
    AND review_model = _stored_model;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Omdömet ändrades innan kompletteringen kunde sparas';
  END IF;

  IF NULLIF(trim(COALESCE(_previous_comment, '')), '') IS NULL
     AND _normalized_comment IS NOT NULL THEN
    UPDATE public.review_group_visibility
    SET comment_visible = true,
        updated_at = now()
    WHERE review_id = _review_id
      AND group_id = _group_id
      AND rating_visible = true
      AND comment_visible = false;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.upgrade_own_review_model_v1(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upgrade_own_review_model_v1(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
