import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260819090000_review_reactions_and_review_notifications_v1.sql",
).text();
const preflight = await Bun.file("supabase/production-preflight-review-reactions.sql").text();

describe("databaskontrakt för privata omdömesreaktioner", () => {
  test("reaktioner är gruppscopade mot review-synligheten och råtabellen är server-only", () => {
    expect(migration).toContain("CREATE TABLE public.review_group_reactions");
    expect(migration).toContain("PRIMARY KEY (review_id, group_id, user_id)");
    expect(migration).toContain("REFERENCES public.review_group_visibility(review_id, group_id)");
    expect(migration).toContain("ON DELETE CASCADE");
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.review_group_reactions FROM PUBLIC, anon, authenticated",
    );
  });

  test("read och write kräver gruppkoppling och reagerbar synlig kommentar", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_visit_review_reactions_v1(");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_own_review_reaction_v1(");
    expect(migration).toContain("visibility.comment_visible = true");
    expect(migration).toContain("public.group_is_active(_group_id)");
    expect(migration).toContain("public.visit_group_links");
    expect(migration).toContain("reaction IN ('heart', 'drool', 'celebrate', 'laugh')");
    expect(migration).not.toContain("get_group_app_state_v5l");
  });

  test("kontoradering rensar reaktioner även när profilen mjukraderas", () => {
    expect(migration).toContain("clear_review_reactions_on_profile_soft_delete");
    expect(migration).toContain("AFTER UPDATE OF deleted_at ON public.profiles");
    expect(migration).toContain("DELETE FROM public.review_group_reactions");
  });

  test("ny deltagarreview använder befintlig outbox utan edit- eller reaktionsping", () => {
    expect(migration).toContain("'review_added'");
    expect(migration).toContain("IF _existing_review_id IS NULL THEN");
    expect(migration).toContain("PERFORM public.queue_notification(");
    expect(migration).toContain("'/besok?group='");
    expect(migration).toContain("membership.user_id <> _uid");
    expect(migration).not.toContain("queue_notification(\n        _uid");
  });

  test("produktionspreflight skyddar RPC-, grant- och isoleringsgränser", () => {
    expect(preflight).toContain("review_reactions:group-and-comment-guard");
    expect(preflight).toContain("review_reactions:no-client-table-read");
    expect(preflight).toContain("review_reactions:account-delete-cleanup");
    expect(preflight).toContain("review_notifications:first-later-review-only");
  });
});
