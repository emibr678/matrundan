BEGIN;

-- Issue #214 — multi-group-deduplicering för accepterad precis gästkoppling.
--
-- Varje accepterad guest_link ersätter exakt en registrerad gästrepresentation.
-- I delade grupper tas därför en accepterad gästplats bort ur den anonyma
-- räknaren oavsett om den identifierade medlemmen är synlig i just den gruppen.
-- I originalgruppen behålls ett privat gästnamn när kontot inte är synligt där,
-- medan den dubbla kanoniska externa deltagaren neutraliseras.

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5k(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _visits jsonb;
BEGIN
  _result := public.get_group_app_state_v5k_guest_identity_base(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN visit_row.is_original THEN
          jsonb_set(
            jsonb_set(
              visit_row.item,
              '{participants}',
              COALESCE((
                SELECT jsonb_agg(participant.item ORDER BY participant.ordinality)
                FROM jsonb_array_elements(
                  COALESCE(visit_row.item->'participants', '[]'::jsonb)
                ) WITH ORDINALITY AS participant(item, ordinality)
                WHERE NOT (
                  participant.item->>'status' = 'guest'
                  AND EXISTS (
                    SELECT 1
                    FROM public.visit_guest_member_proposals proposal
                    WHERE proposal.visit_id = visit_row.visit_id
                      AND proposal.proposal_kind = 'guest_link'
                      AND proposal.guest_id IS NOT NULL
                      AND proposal.status = 'accepted'
                      AND 'guest:' || proposal.guest_id::text = participant.item->>'id'
                      AND EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(
                          COALESCE(visit_row.item->'participants', '[]'::jsonb)
                        ) AS identified(item)
                        WHERE identified.item->>'id' = proposal.target_user_id::text
                      )
                  )
                )
              ), '[]'::jsonb),
              true
            ),
            '{externalParticipantCount}',
            to_jsonb(
              GREATEST(
                0,
                visit_row.external_count
                - GREATEST(0, visit_row.accepted_count - visit_row.accepted_visible_count)
              )
            ),
            true
          )
        ELSE
          jsonb_set(
            visit_row.item,
            '{externalParticipantCount}',
            to_jsonb(GREATEST(0, visit_row.external_count - visit_row.accepted_count)),
            true
          )
      END
      ORDER BY visit_row.ordinality
    ),
    '[]'::jsonb
  )
  INTO _visits
  FROM (
    SELECT
      visit_item.item,
      visit_item.ordinality,
      (visit_item.item->>'id')::uuid AS visit_id,
      COALESCE((visit_item.item->>'externalParticipantCount')::integer, 0) AS external_count,
      EXISTS (
        SELECT 1
        FROM public.visit_group_links original_link
        WHERE original_link.visit_id = (visit_item.item->>'id')::uuid
          AND original_link.group_id = _group_id
          AND original_link.link_type = 'original'
      ) AS is_original,
      (
        SELECT count(*)::integer
        FROM public.visit_guest_member_proposals proposal
        WHERE proposal.visit_id = (visit_item.item->>'id')::uuid
          AND proposal.proposal_kind = 'guest_link'
          AND proposal.guest_id IS NOT NULL
          AND proposal.status = 'accepted'
      ) AS accepted_count,
      (
        SELECT count(*)::integer
        FROM public.visit_guest_member_proposals proposal
        WHERE proposal.visit_id = (visit_item.item->>'id')::uuid
          AND proposal.proposal_kind = 'guest_link'
          AND proposal.guest_id IS NOT NULL
          AND proposal.status = 'accepted'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              COALESCE(visit_item.item->'participants', '[]'::jsonb)
            ) AS identified(item)
            WHERE identified.item->>'id' = proposal.target_user_id::text
          )
      ) AS accepted_visible_count
    FROM jsonb_array_elements(COALESCE(_result->'visits', '[]'::jsonb))
      WITH ORDINALITY AS visit_item(item, ordinality)
  ) AS visit_row;

  RETURN jsonb_set(_result, '{visits}', _visits, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5k(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5k(uuid) TO authenticated;

DO $assertions$
BEGIN
  IF position(
    'external_count - visit_row.accepted_count'
    IN pg_get_functiondef(to_regprocedure('public.get_group_app_state_v5k(uuid)'))
  ) = 0 THEN
    RAISE EXCEPTION 'Delade grupper måste ta bort en gästrepresentation per accepterad koppling';
  END IF;

  IF position(
    'visit_row.accepted_count - visit_row.accepted_visible_count'
    IN pg_get_functiondef(to_regprocedure('public.get_group_app_state_v5k(uuid)'))
  ) = 0 THEN
    RAISE EXCEPTION 'Originalgruppen måste neutralisera osynliga accepterade kontodubbletter';
  END IF;
END;
$assertions$;

NOTIFY pgrst, 'reload schema';

COMMIT;
