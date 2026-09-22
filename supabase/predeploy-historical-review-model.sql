\set ON_ERROR_STOP on

-- Read-only förkontroll för Issue #365.
-- Körs mot målmiljön före databasdriftsättning. Resultatet redovisar exakt
-- legacyomfattning och migrationens väntade scoreförändring. DO-blocket stoppar
-- på varje form som kräver manuell bedömning.
BEGIN TRANSACTION READ ONLY;

SELECT
  count(*) FILTER (WHERE review_row.review_model IS NULL) AS review_model_null_total,
  count(*) FILTER (
    WHERE review_row.review_model IS NULL
      AND visit.meal_type <> 'dryck'
  ) AS legacy_food_reviews,
  count(*) FILTER (
    WHERE review_row.review_model IS NULL
      AND visit.meal_type <> 'dryck'
      AND review_row.taste IS NOT NULL
      AND review_row.value IS NOT NULL
      AND review_row.service IS NOT NULL
      AND review_row.atmosphere IS NULL
  ) AS legacy_food_3d_reviews,
  count(*) FILTER (
    WHERE review_row.review_model IS NULL
      AND visit.meal_type <> 'dryck'
      AND review_row.overall IS NOT NULL
      AND review_row.taste IS NULL
      AND review_row.value IS NULL
      AND review_row.service IS NULL
      AND review_row.atmosphere IS NULL
  ) AS legacy_food_overall_only_reviews,
  count(*) FILTER (
    WHERE review_row.review_model IS NULL
      AND visit.meal_type = 'dryck'
  ) AS scoreless_reviews,
  count(*) FILTER (
    WHERE review_row.review_model IS NULL
      AND visit.meal_type <> 'dryck'
      AND review_row.taste IS NOT NULL
      AND review_row.value IS NOT NULL
      AND review_row.service IS NOT NULL
      AND review_row.atmosphere IS NULL
      AND review_row.overall IS DISTINCT FROM round(
        (review_row.taste + review_row.value + review_row.service)::numeric / 3,
        2
      )
  ) AS rows_whose_overall_changes
FROM public.reviews review_row
JOIN public.visits visit ON visit.id = review_row.visit_id;

DO $preflight$
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
      'Preflight stoppad: oväntade historiska omdömen (mat: %, scorelösa: %)',
      _unexpected_food,
      _unexpected_scoreless;
  END IF;
END;
$preflight$;

ROLLBACK;
