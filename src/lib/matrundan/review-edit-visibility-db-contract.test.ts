import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260908162707_fix_review_comment_visibility.sql",
).text();
const preflight = await Bun.file("supabase/production-preflight-review-reactions.sql").text();

describe("databaskontrakt för kommentarsynlighet vid reviewredigering", () => {
  test("behåller befintliga auth-, grupp- och deltagargränser", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_own_review(");
    expect(migration).toContain("public.group_is_active(_group_id)");
    expect(migration).toContain("public.has_membership(_group_id, _uid)");
    expect(migration).toContain("visit_id = _visit_id AND group_id = _group_id");
    expect(migration).toContain("visit_id = _visit_id AND user_id = _uid");
    expect(migration).toContain("_author_id <> _uid");
  });

  test("öppnar endast första nya kommentaren i den grupp där redigeringen sker", () => {
    expect(migration).toContain("_previous_comment text;");
    expect(migration).toContain(
      "_normalized_comment text := NULLIF(trim(COALESCE(_comment, '')), '');",
    );
    expect(migration).toContain(
      "IF NULLIF(trim(COALESCE(_previous_comment, '')), '') IS NULL\n     AND _normalized_comment IS NOT NULL THEN",
    );
    expect(migration).toContain("UPDATE public.review_group_visibility");
    expect(migration).toContain("group_id = _group_id");
    expect(migration).toContain("rating_visible = true");
    expect(migration).toContain("comment_visible = false");
    expect(migration).not.toContain("group_id <> _group_id");
  });

  test("senare redigering av en redan befintlig kommentar lämnar explicit synlighet orörd", () => {
    const visibilityUpdate = migration.slice(
      migration.indexOf("UPDATE public.review_group_visibility"),
    );

    expect(visibilityUpdate).toContain("comment_visible = true");
    expect(visibilityUpdate).not.toContain("INSERT INTO public.review_group_visibility");
    expect(migration).not.toContain("SET rating_visible = true");
  });

  test("RPC:n är endast exekverbar av authenticated", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.update_own_review(\n  uuid, uuid, smallint, smallint, smallint, smallint, text\n) FROM PUBLIC, anon;",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.update_own_review(\n  uuid, uuid, smallint, smallint, smallint, smallint, text\n) TO authenticated;",
    );
  });

  test("produktionspreflight verifierar den deployade övergångsregeln", () => {
    expect(preflight).toContain("review_reactions:edit-first-comment-visibility");
    expect(preflight).toContain(
      "public.update_own_review(uuid,uuid,smallint,smallint,smallint,smallint,text)",
    );
    expect(preflight).toContain("position('_previous_comment'");
    expect(preflight).toContain("position('group_id = _group_id'");
  });
});
