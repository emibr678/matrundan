import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260909070000_visit_guest_member_confirmation_followup_v1.sql",
).text();
const preflight = await Bun.file("supabase/production-preflight-visit-guest-member.sql").text();

describe("uppföljande databaskontrakt för Issue #214", () => {
  test("deltagarvakten accepterar medlemskap i en länkad grupp utan originalgruppstvång", () => {
    const start = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.validate_visit_participant()",
    );
    const end = migration.indexOf("ALTER TABLE public.visit_guest_member_proposals", start);
    const body = migration.slice(start, end);

    expect(body).toContain("FROM public.visit_group_links link");
    expect(body).toContain("JOIN public.memberships membership");
    expect(body).toContain("membership.user_id = NEW.user_id");
    expect(body).toContain("membership.status = 'active'");
    expect(body).not.toContain("link_type = 'original'");
  });

  test("mottagargruppens kandidatlista är gruppbunden och läcker inget privat gästalias", () => {
    const start = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.list_visit_shared_member_candidates_v1(",
    );
    const end = migration.indexOf(
      "REVOKE ALL ON FUNCTION public.list_visit_shared_member_candidates_v1",
      start,
    );
    const body = migration.slice(start, end);

    expect(body).toContain("link.link_type = 'shared'");
    expect(body).toContain("candidate.group_id = _group_id");
    expect(body).toContain("candidate.status = 'active'");
    expect(body).toContain("candidate.user_id <> _uid");
    expect(body).not.toContain("guest.display_name");
    expect(body).not.toContain("guestName");
    expect(body).not.toContain("guestId");
    expect(body).not.toContain("source_group");
  });

  test("mottagarförslag kräver delat besök, annan aktiv medlem och en ledig gästplats", () => {
    const start = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.propose_shared_visit_member_v1(",
    );
    const end = migration.indexOf(
      "REVOKE ALL ON FUNCTION public.propose_shared_visit_member_v1",
      start,
    );
    const body = migration.slice(start, end);

    expect(body).toContain("link.link_type = 'shared'");
    expect(body).toContain("_target_user_id = _uid");
    expect(body).toContain("membership.user_id = _target_user_id");
    expect(body).toContain("membership.status = 'active'");
    expect(body).toContain("_reserved_count >= _guest_count");
    expect(body).toContain("'shared_member'");
    expect(body).toContain("_visit_id, NULL, _group_id, _target_user_id");
  });

  test("accept fungerar även för neutralt mottagarförslag och skriver samma kanoniska visit", () => {
    const start = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.respond_visit_guest_proposal_v1(",
    );
    const end = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.get_group_app_state_v5k(",
      start,
    );
    const body = migration.slice(start, end);

    expect(body).toContain("_proposal.guest_id IS NOT NULL AND EXISTS");
    expect(body).toContain("INSERT INTO public.visit_participants (visit_id, user_id)");
    expect(body).toContain("VALUES (_proposal.visit_id, _uid)");
    expect(body).toContain("proposal.target_user_id = _uid");
  });

  test("read-modellen minskar externantal bara när bekräftad användare faktiskt är synlig", () => {
    const start = migration.indexOf("CREATE OR REPLACE FUNCTION public.get_group_app_state_v5k(");
    const end = migration.indexOf("DO $assertions$", start);
    const body = migration.slice(start, end);

    expect(body).toContain("accepted_visible_count");
    expect(body).toContain("external_count - visit_row.accepted_visible_count");
    expect(body).toContain("proposal.guest_id IS NOT NULL");
    expect(body).not.toContain("external_count - visit_row.accepted_count");
  });

  test("slutpreflight täcker den symmetriska säkerhetsmodellen", () => {
    expect(preflight).toContain("guard:shared-candidates-current-group-only");
    expect(preflight).toContain("guard:shared-candidates-no-guest-alias");
    expect(preflight).toContain("guard:shared-proposal-target-member");
    expect(preflight).toContain("guard:shared-proposal-not-self");
    expect(preflight).toContain("guard:participant-linked-group-membership");
    expect(preflight).toContain("read-rpc:deduplicates-visible-accepted-person");
  });
});
