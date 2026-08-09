BEGIN;

ALTER TABLE public.place_improvement_candidates
  DROP CONSTRAINT IF EXISTS place_improvement_candidates_dismissal_reason_check;

ALTER TABLE public.place_improvement_candidates
  ADD CONSTRAINT place_improvement_candidates_dismissal_reason_check CHECK (
    (
      status = 'dismissed'
      AND dismissal_reason IN (
        'not_relevant',
        'insufficient_evidence',
        'not_food_place',
        'already_handled'
      )
    )
    OR (
      status <> 'dismissed'
      AND dismissal_reason IS NULL
    )
  );

CREATE OR REPLACE FUNCTION public.dismiss_place_improvement_candidate_v1(
  _candidate_id uuid,
  _reason text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.place_maintainers pm WHERE pm.user_id = _uid) THEN
    RAISE EXCEPTION 'Du har inte behörighet till Platsunderhåll';
  END IF;
  IF _reason IS NULL
     OR _reason NOT IN ('not_relevant', 'insufficient_evidence', 'not_food_place', 'already_handled') THEN
    RAISE EXCEPTION 'Ogiltig avfärdandeorsak';
  END IF;

  SELECT status INTO _status
  FROM public.place_improvement_candidates
  WHERE id = _candidate_id
  FOR UPDATE;

  IF _status IS NULL THEN RAISE EXCEPTION 'Underhållsärendet finns inte'; END IF;
  IF _status NOT IN ('open', 'needs_osm') THEN
    RAISE EXCEPTION 'Underhållsärendet är redan avslutat';
  END IF;

  UPDATE public.place_improvement_candidates
  SET status = 'dismissed',
      dismissal_reason = _reason,
      resolved_at = now(),
      resolution = NULL
  WHERE id = _candidate_id;

  INSERT INTO public.place_improvement_candidate_events(candidate_id, action, actor_id, metadata)
  VALUES (_candidate_id, 'dismissed', _uid, jsonb_build_object('reason', _reason));

  RETURN 'dismissed';
END;
$function$;

REVOKE ALL ON FUNCTION public.dismiss_place_improvement_candidate_v1(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_place_improvement_candidate_v1(uuid, text)
  TO authenticated;

COMMIT;
