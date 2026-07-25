-- Idempotent fix for validate_visit_participant() after canonical migration.
-- Also drops any leftover duplicate trg_activity_validate_refs trigger on activity.

CREATE OR REPLACE FUNCTION public.validate_visit_participant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_group uuid;
BEGIN
  SELECT vgl.group_id
    INTO v_group
  FROM public.visit_group_links vgl
  WHERE vgl.visit_id = NEW.visit_id
    AND vgl.link_type = 'original'
  LIMIT 1;

  IF v_group IS NULL THEN
    RAISE EXCEPTION 'unknown visit or missing original group %', NEW.visit_id;
  END IF;

  IF NOT public.has_membership(v_group, NEW.user_id) THEN
    RAISE EXCEPTION 'participant % is not an active member of visit''s original group %', NEW.user_id, v_group;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_activity_validate_refs ON public.activity;
