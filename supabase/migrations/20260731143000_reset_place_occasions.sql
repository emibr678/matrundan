BEGIN;

-- De användarsynliga Passar för-kategorierna har fått en ny innebörd.
-- Befintliga val kan därför inte översättas säkert och nollställs enligt
-- uttryckligt produktbeslut. Matställen, besök och övrig gruppmetadata bevaras.
UPDATE public.group_places
SET occasions = ARRAY[]::text[]
WHERE cardinality(occasions) > 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.group_places
    WHERE cardinality(occasions) > 0
  ) THEN
    RAISE EXCEPTION 'Kunde inte nollställa äldre Passar för-val';
  END IF;
END;
$$;

COMMIT;
