CREATE OR REPLACE FUNCTION public.activity_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION 'activity.group_id is immutable';
  END IF;
  IF NEW.actor_id IS DISTINCT FROM OLD.actor_id THEN
    -- Endast anonymisering (actor_id -> NULL) under pågående kontoradering.
    IF NOT (
      NEW.actor_id IS NULL
      AND current_setting('matrundan.allow_actor_anonymization', true) = 'on'
    ) THEN
      RAISE EXCEPTION 'activity.actor_id is immutable';
    END IF;
  END IF;
  IF NEW.place_id IS DISTINCT FROM OLD.place_id THEN
    RAISE EXCEPTION 'activity.place_id is immutable';
  END IF;
  IF NEW.visit_id IS DISTINCT FROM OLD.visit_id THEN
    RAISE EXCEPTION 'activity.visit_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DO $do$
DECLARE
  _src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO _src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'prepare_own_account_deletion';

  _src := replace(
    _src,
    'UPDATE public.activity' || E'\n' || '  SET actor_id = NULL,',
    'PERFORM set_config(''matrundan.allow_actor_anonymization'', ''on'', true);' || E'\n' ||
    '  UPDATE public.activity' || E'\n' || '  SET actor_id = NULL,'
  );

  _src := replace(
    _src,
    'PERFORM set_config(''matrundan.allow_owner_change'', ''off'', true);',
    'PERFORM set_config(''matrundan.allow_owner_change'', ''off'', true);' || E'\n' ||
    '  PERFORM set_config(''matrundan.allow_actor_anonymization'', ''off'', true);'
  );

  EXECUTE _src;
END
$do$;