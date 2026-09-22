-- Efterkontroll för Issue #365 — stabil historisk reviewmodell.
WITH checks(name, ok) AS (
  VALUES
    (
      'historical-review:model-constraint',
      COALESCE((
        SELECT
          position('food_v0_3d' IN pg_get_constraintdef(constraint_row.oid)) > 0
          AND position('food_v0_overall' IN pg_get_constraintdef(constraint_row.oid)) > 0
        FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = 'public.reviews'::regclass
          AND constraint_row.conname = 'reviews_review_model_check'
      ), false)
    ),
    (
      'historical-review:no-scoreable-null-model',
      NOT EXISTS (
        SELECT 1
        FROM public.reviews review_row
        JOIN public.visits visit ON visit.id = review_row.visit_id
        WHERE visit.meal_type <> 'dryck'
          AND review_row.review_model IS NULL
      )
    ),
    (
      'historical-review:stable-3d-score',
      NOT EXISTS (
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
      )
    ),
    (
      'historical-review:stable-overall-only-score',
      NOT EXISTS (
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
      )
    ),
    (
      'historical-review:upgrade-rpc',
      to_regprocedure(
        'public.upgrade_own_review_model_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)'
      ) IS NOT NULL
    ),
    (
      'historical-review:authenticated-upgrade-grant',
      COALESCE(has_function_privilege(
        'authenticated',
        to_regprocedure(
          'public.upgrade_own_review_model_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)'
        ),
        'EXECUTE'
      ), false)
    ),
    (
      'historical-review:no-anon-upgrade-grant',
      COALESCE(NOT has_function_privilege(
        'anon',
        to_regprocedure(
          'public.upgrade_own_review_model_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)'
        ),
        'EXECUTE'
      ), false)
    )
)
SELECT name, ok
FROM checks
ORDER BY name;
