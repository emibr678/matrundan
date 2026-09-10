import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260910063000_visit_guest_member_self_confirmation_v1.sql",
).text();
const preflight = await Bun.file("supabase/production-preflight-visit-guest-member.sql").text();

describe("egen deltagarbekräftelse för Issue #214", () => {
  test("mottagarlistan får inkludera aktuell medlem utan att exponera privat gästdata", () => {
    const start = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.list_visit_shared_member_candidates_v1(",
    );
    const end = migration.indexOf(
      "REVOKE ALL ON FUNCTION public.list_visit_shared_member_candidates_v1",
      start,
    );
    const body = migration.slice(start, end);

    expect(body).toContain("candidate.group_id = _group_id");
    expect(body).toContain("link.link_type = 'shared'");
    expect(body).not.toContain("candidate.user_id <> _uid");
    expect(body).not.toContain("guest.display_name");
    expect(body).not.toContain("guestId");
    expect(body).not.toContain("source_group");
  });

  test("egen bekräftelse kräver aktivt gruppmedlemskap, delat besök och ledig gästkapacitet", () => {
    const start = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.confirm_shared_visit_self_v1(",
    );
    const end = migration.indexOf(
      "REVOKE ALL ON FUNCTION public.confirm_shared_visit_self_v1",
      start,
    );
    const body = migration.slice(start, end);

    expect(body).toContain("public.has_membership(_group_id, _uid)");
    expect(body).toContain("link.link_type = 'shared'");
    expect(body).toContain("participant.user_id = _uid");
    expect(body).toContain("_reserved_count >= _guest_count");
    expect(body).toContain("pg_advisory_xact_lock");
  });

  test("egen bekräftelse skriver accepted-identitet och samma kanoniska deltagande atomärt", () => {
    const start = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.confirm_shared_visit_self_v1(",
    );
    const end = migration.indexOf(
      "REVOKE ALL ON FUNCTION public.confirm_shared_visit_self_v1",
      start,
    );
    const body = migration.slice(start, end);

    expect(body).toContain("'accepted'");
    expect(body).toContain("'shared_member'");
    expect(body).toContain("INSERT INTO public.visit_participants (visit_id, user_id)");
    expect(body).toContain("VALUES (_visit_id, _uid)");
    expect(body).toContain("public.visit_participation_self_corrections");
  });

  test("RPC:n är endast klientkörbar för authenticated och täcks av slutpreflight", () => {
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.confirm_shared_visit_self_v1(uuid, uuid)\n  TO authenticated;",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.confirm_shared_visit_self_v1(uuid, uuid)\n  FROM PUBLIC, anon;",
    );
    expect(preflight).toContain("rpc:confirm-shared-self");
    expect(preflight).toContain("guard:shared-self-active-member");
    expect(preflight).toContain("guard:shared-self-free-slot");
    expect(preflight).toContain("guard:shared-self-canonical-participation");
  });
});
