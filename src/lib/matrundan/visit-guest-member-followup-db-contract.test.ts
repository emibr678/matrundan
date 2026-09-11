import { describe, expect, test } from "bun:test";

const followup = await Bun.file(
  "supabase/migrations/20260909070000_visit_guest_member_confirmation_followup_v1.sql",
).text();
const correction = await Bun.file(
  "supabase/migrations/20260910165000_visit_guest_member_precise_link_only_v1.sql",
).text();
const preflight = await Bun.file("supabase/production-preflight-visit-guest-member.sql").text();

describe("slutligt databaskontrakt för Issue #214", () => {
  test("deltagarvakten accepterar medlemskap i en länkad grupp utan originalgruppstvång", () => {
    const start = followup.indexOf(
      "CREATE OR REPLACE FUNCTION public.validate_visit_participant()",
    );
    const end = followup.indexOf("ALTER TABLE public.visit_guest_member_proposals", start);
    const body = followup.slice(start, end);

    expect(body).toContain("FROM public.visit_group_links link");
    expect(body).toContain("JOIN public.memberships membership");
    expect(body).toContain("membership.user_id = NEW.user_id");
    expect(body).toContain("membership.status = 'active'");
    expect(body).not.toContain("link_type = 'original'");
  });

  test("slutmodellen tar bort generella mottagar- och självvägar", () => {
    expect(correction).toContain("DROP FUNCTION IF EXISTS public.confirm_shared_visit_self_v1");
    expect(correction).toContain("DROP FUNCTION IF EXISTS public.propose_shared_visit_member_v1");
    expect(correction).toContain(
      "DROP FUNCTION IF EXISTS public.list_visit_shared_member_candidates_v1",
    );
    expect(correction).toContain("WHERE proposal_kind = 'shared_member'");
  });

  test("varje kvarvarande identitetsförslag måste peka på en specifik gäst", () => {
    expect(correction).toContain("ALTER COLUMN guest_id SET NOT NULL");
    expect(correction).toContain("proposal_kind = 'guest_link' AND guest_id IS NOT NULL");
  });

  test("stagingdata återställs säkert innan den felaktiga modellen tas bort", () => {
    expect(correction).toContain("JOIN public.reviews review");
    expect(correction).toContain("DELETE FROM public.visit_participants participant");
    expect(correction).toContain("public.visit_participation_self_corrections correction");
    expect(correction).toContain("precise.proposal_kind = 'guest_link'");
  });

  test("slutpreflight verifierar bara den precisa publika ytan", () => {
    expect(preflight).toContain("rpc:generic-recipient-paths-removed");
    expect(preflight).toContain("schema:guest-id-required");
    expect(preflight).toContain("schema:guest-link-only");
    expect(preflight).toContain("guard:targets-original-group-only");
    expect(preflight).toContain("guard:participant-linked-group-membership");
    expect(preflight).toContain("guard:response-owned-by-target-user");
  });
});
