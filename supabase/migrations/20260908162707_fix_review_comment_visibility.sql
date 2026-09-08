BEGIN;

-- Issue #244: när en deltagare lägger till den första kommentaren i efterhand
-- ska kommentaren bli synlig i den grupp där redigeringen sker. Befintliga
-- explicita synlighetsval för kommentarer som redan fanns får inte skrivas över,
-- och andra grupper får aldrig påverkas av redigeringen.
CREATE OR REPLACE FUNCTION public.update_own_review(
  _group_id uuid,
  _review_id uuid,
  _overall smallint,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
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
  _normalized_comment text := NULLIF(trim(COALESCE(_comment, '')), '');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;

  SELECT visit_id, user_id, comment
    INTO _visit_id, _author_id, _previous_comment
  FROM public.reviews
  WHERE id = _review_id;

  IF _visit_id IS NULL THEN RAISE EXCEPTION 'Omdömet finns inte'; END IF;
  IF _author_id <> _uid THEN RAISE EXCEPTION 'Du kan bara redigera ditt eget omdöme'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.visit_group_links
    WHERE visit_id = _visit_id AND group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.visit_participants
    WHERE visit_id = _visit_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Endast faktiska deltagare kan ha ett omdöme';
  END IF;

  IF _overall IS NULL OR _overall < 1 OR _overall > 5 THEN
    RAISE EXCEPTION 'Helhetsbetyg måste vara 1–5';
  END IF;
  IF _taste IS NOT NULL AND (_taste < 1 OR _taste > 5) THEN RAISE EXCEPTION 'Smakbetyg måste vara 1–5'; END IF;
  IF _value IS NOT NULL AND (_value < 1 OR _value > 5) THEN RAISE EXCEPTION 'Prisvärdhet måste vara 1–5'; END IF;
  IF _service IS NOT NULL AND (_service < 1 OR _service > 5) THEN RAISE EXCEPTION 'Service måste vara 1–5'; END IF;

  UPDATE public.reviews
    SET overall = _overall,
        taste = _taste,
        value = _value,
        service = _service,
        comment = _normalized_comment,
        updated_at = now()
    WHERE id = _review_id AND user_id = _uid;

  -- Endast övergången från ingen kommentar till första kommentaren får öppna
  -- kommentaren automatiskt. En redan befintlig men explicit dold kommentar
  -- förblir dold vid senare text-/betygsredigeringar.
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

REVOKE ALL ON FUNCTION public.update_own_review(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_review(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) TO authenticated;

DO $assertions$
BEGIN
  IF NOT has_function_privilege(
    'authenticated',
    'public.update_own_review(uuid,uuid,smallint,smallint,smallint,smallint,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.update_own_review(uuid,uuid,smallint,smallint,smallint,smallint,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'update_own_review has incorrect execute grants';
  END IF;
END;
$assertions$;

COMMIT;
