import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260908190000_visit_guest_member_confirmation_v1.sql",
).text();
const dedupMigration = await Bun.file(
  "supabase/migrations/20260910171500_visit_guest_member_multi_group_dedup_v1.sql",
).text();
const preflight = await Bun.file("supabase/production-preflight-visit-guest-member.sql").text();

describe("databaskontrakt för cross-group gäst till medlem", () => {
  test("förslag ligger server-only och har tydliga svarsstates", () => {
    expect(migration).toContain("CREATE TABLE public.visit_guest_member_proposals");
    expect(migration).toContain("'pending', 'deferred', 'declined', 'accepted', 'cancelled'");
    expect(migration).toContain(
      "ALTER TABLE public.visit_guest_member_proposals ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.visit_guest_member_proposals FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE",
    );
    expect(migration).toContain(
      "proposed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL",
    );
  });

  test("kandidatlistan är bunden till originalgrupp och redan länkat besök", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.list_visit_guest_member_targets_v1(",
    );
    expect(migration).toContain("source_link.link_type = 'original'");
    expect(migration).toContain("JOIN public.visit_group_links target_link");
    expect(migration).toContain("actor_membership.status = 'active'");
    expect(migration).toContain("candidate.status = 'active'");
    expect(migration).toContain("participant.user_id = candidate.user_id");
  });

  test("förslag kan inte skapas mot olänkad grupp eller godtycklig användare", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.propose_visit_guest_member_v1(");
    expect(migration).toContain("Besöket måste först läggas till i målgruppen");
    expect(migration).toContain("membership.user_id = _target_user_id");
    expect(migration).toContain("membership.status = 'active'");
    expect(migration).toContain("guest.id = _guest_id");
    expect(migration).toContain("guest.visit_id = _visit_id");
  });

  test("målmedlemmen får ett minimerat eget förslag utan source-data", () => {
    const start = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.get_own_visit_guest_proposal_v1(",
    );
    const end = migration.indexOf(
      "REVOKE ALL ON FUNCTION public.get_own_visit_guest_proposal_v1",
      start,
    );
    const body = migration.slice(start, end);

    expect(body).toContain("proposal.target_user_id = _uid");
    expect(body).toContain("'proposalId'");
    expect(body).toContain("'status'");
    expect(body).not.toContain("guest.display_name");
    expect(body).not.toContain("proposed_by");
    expect(body).not.toContain("source_group");
  });

  test("endast målmedlemmen kan acceptera och accept använder samma kanoniska visit", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.respond_visit_guest_proposal_v1(",
    );
    expect(migration).toContain("proposal.target_user_id = _uid");
    expect(migration).toContain("_response NOT IN ('accept', 'decline', 'defer')");
    expect(migration).toContain("INSERT INTO public.visit_participants (visit_id, user_id)");
    expect(migration).toContain("VALUES (_proposal.visit_id, _uid)");
    expect(migration).toContain("status = 'accepted'");
  });

  test("read-modellen deduplicerar flera accepterade gäster i flera gruppkontexter", () => {
    expect(dedupMigration).toContain("CREATE OR REPLACE FUNCTION public.get_group_app_state_v5k(");
    expect(dedupMigration).toContain("proposal.proposal_kind = 'guest_link'");
    expect(dedupMigration).toContain("accepted_count");
    expect(dedupMigration).toContain("accepted_visible_count");
    expect(dedupMigration).toContain("external_count - visit_row.accepted_count");
    expect(dedupMigration).toContain(
      "visit_row.accepted_count - visit_row.accepted_visible_count",
    );
    expect(dedupMigration).toContain("'guest:' || proposal.guest_id::text");
  });

  test("preflight skyddar grants, ägarskap och minimerad output", () => {
    expect(preflight).toContain("guard:targets-original-group-only");
    expect(preflight).toContain("guard:targets-require-linked-target");
    expect(preflight).toContain("guard:response-owned-by-target-user");
    expect(preflight).toContain("guard:accept-writes-canonical-participation");
    expect(preflight).toContain("guard:own-proposal-minimized");
    expect(preflight).toContain("read-rpc:deduplicates-accepted-guests-in-every-group-context");
    expect(preflight).toContain("isolation:no-authenticated-table-read");
    expect(preflight).toContain("isolation:no-client-v5k-base");
  });
});
