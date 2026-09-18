import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260918064500_visit_edit_v1.sql",
).text();

describe("Issue #309 – serverkontrakt för besöksredigering", () => {
  test("är creator-only och kräver originalgruppen", () => {
    expect(migration).toContain("visit.created_by = _uid");
    expect(migration).toContain("link.link_type = 'original'");
    expect(migration).toContain("public.has_membership(_group_id, _uid)");
  });

  test("ersätter bara grupprelevanta deltagare och bevarar cross-group-identiteter", () => {
    expect(migration).toContain("public.memberships membership");
    expect(migration).toContain("membership.status IN ('active', 'left')");
    expect(migration).toContain("DELETE FROM public.visit_participants");
  });

  test("respekterar egen deltagarkorrigering och raderar inte reviews", () => {
    expect(migration).toContain("visit_participation_self_corrections");
    expect(migration).toContain("correction.status = 'declined'");
    expect(migration).not.toContain("DELETE FROM public.reviews");
  });

  test("gästredigering använder stabila id:n och explicit borttagning", () => {
    expect(migration).toContain("NULLIF(entry.item->>'id', '')::uuid");
    expect(migration).toContain("_removed_guest_ids uuid[]");
    expect(migration).toContain("visit_guest_member_proposals");
    expect(migration).toContain("proposal.status IN ('pending', 'deferred', 'accepted')");
    expect(migration).toContain("guest.id = ANY(COALESCE(_removed_guest_ids");
  });

  test("kontextkorrigering skapar ingen ny visit eller ny reviewmodell", () => {
    expect(migration).toContain("UPDATE public.visits");
    expect(migration).not.toContain("INSERT INTO public.visits");
    expect(migration).not.toContain("SET review_model");
    expect(migration).toContain("public.update_own_review_v3");
  });

  test("v3 bevarar ratingfält när ett historiskt matomdöme visas på scorelöst besök", () => {
    const v3 = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.update_own_review_v3"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.update_visit_v1"),
    );
    expect(v3).toContain("SET comment = _normalized_comment");
    expect(v3).toContain("rating_visible = false");
    expect(v3).not.toContain("WHEN _scoreless THEN NULL");
  });
});