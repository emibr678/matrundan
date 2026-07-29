BEGIN;

-- Paket 6F: säker radering av originalbesök och redigering av datumförslag.

CREATE OR REPLACE FUNCTION public.can_delete_original_visit(
  _group_id uuid,
  _visit_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _group_id IS NOT NULL
    AND _visit_id IS NOT NULL
    AND _user_id IS NOT NULL
    AND (_user_id = auth.uid() OR auth.role() = 'service_role')
    AND public.group_is_active(_group_id)
    AND public.has_membership(_group_id, _user_id)
    AND EXISTS (
      SELECT 1
      FROM public.visit_group_links vgl
      JOIN public.visits v ON v.id = vgl.visit_id
      WHERE vgl.group_id = _group_id
        AND vgl.visit_id = _visit_id
        AND vgl.link_type = 'original'
        AND (
          v.created_by = _user_id
          OR public.has_group_role(_group_id, _user_id, ARRAY['owner','admin'])
        )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_delete_original_visit(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_delete_original_visit(uuid, uuid, uuid)
  TO authenticated, service_role;

-- Den som får radera hela originalbesöket måste även kunna städa dess privata
-- foto innan den kanoniska besöksraden tas bort.
CREATE OR REPLACE FUNCTION public.delete_visit_photo(_group_id uuid, _visit_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _previous_path text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_manage_visit_photo(_group_id, _visit_id, _uid)
     AND NOT public.can_delete_original_visit(_group_id, _visit_id, _uid) THEN
    RAISE EXCEPTION 'Du saknar behörighet att ta bort fotot för det här besöket';
  END IF;

  DELETE FROM public.visit_media
  WHERE visit_id = _visit_id AND group_id = _group_id
  RETURNING storage_path INTO _previous_path;

  RETURN _previous_path;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_visit_photo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_visit_photo(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "visit photos allowed delete" ON storage.objects;
CREATE POLICY "visit photos allowed delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'visit-photos'
    AND (
      public.can_manage_visit_photo(
        public.visit_photo_path_group(name),
        public.visit_photo_path_visit(name),
        auth.uid()
      )
      OR public.can_delete_original_visit(
        public.visit_photo_path_group(name),
        public.visit_photo_path_visit(name),
        auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.delete_original_visit(
  _group_id uuid,
  _visit_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_delete_original_visit(_group_id, _visit_id, _uid) THEN
    RAISE EXCEPTION 'Endast registreraren, ägare eller admin kan radera besöket';
  END IF;

  -- Lås den kanoniska raden så att delning och radering inte kan korsa varandra.
  PERFORM 1 FROM public.visits WHERE id = _visit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Besöket finns inte längre'; END IF;

  -- Aktivitet ska inte lämnas som en trasig historikpost. Övriga kanoniska och
  -- gruppspecifika rader försvinner via befintliga ON DELETE CASCADE-regler.
  DELETE FROM public.activity WHERE visit_id = _visit_id;
  DELETE FROM public.visits WHERE id = _visit_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_original_visit(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_original_visit(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_next_stop_date_proposal(
  _group_id uuid,
  _proposal_id uuid,
  _proposed_date date,
  _proposed_time time without time zone DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _proposal public.next_stop_date_proposals%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  IF _proposed_date IS NULL THEN RAISE EXCEPTION 'Välj ett datum'; END IF;
  IF _proposed_date < (now() AT TIME ZONE 'Europe/Stockholm')::date THEN
    RAISE EXCEPTION 'Datumet kan inte ligga i det förflutna';
  END IF;

  SELECT * INTO _proposal
  FROM public.next_stop_date_proposals p
  WHERE p.id = _proposal_id
    AND p.group_id = _group_id
    AND p.status IN ('active', 'confirmed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Datumförslaget är inte längre aktivt';
  END IF;
  IF _proposal.created_by <> _uid
     AND NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast förslagsställaren, ägare eller admin kan ändra datumet';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_next_place gnp
    WHERE gnp.group_id = _group_id
      AND gnp.place_id = _proposal.place_id
  ) THEN
    RAISE EXCEPTION 'Datumförslaget hör inte längre till nästa stopp';
  END IF;

  IF _proposal.proposed_date = _proposed_date
     AND _proposal.proposed_time IS NOT DISTINCT FROM _proposed_time THEN
    RETURN;
  END IF;

  UPDATE public.next_stop_date_proposals
  SET proposed_date = _proposed_date,
      proposed_time = _proposed_time,
      status = 'active',
      confirmed_at = NULL,
      confirmed_by = NULL,
      cancelled_at = NULL,
      cancelled_by = NULL,
      updated_at = now()
  WHERE id = _proposal_id;

  DELETE FROM public.next_stop_date_responses
  WHERE proposal_id = _proposal_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_next_stop_date_proposal(
  uuid, uuid, date, time without time zone
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_next_stop_date_proposal(
  uuid, uuid, date, time without time zone
) TO authenticated;

COMMIT;
