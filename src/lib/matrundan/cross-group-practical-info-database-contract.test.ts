import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260802194000_cross_group_practical_info_suggestions.sql",
  ),
  "utf8",
);

describe("anonyma förslag för praktisk information", () => {
  test("markerar fältvis och tidsbegränsad delningsbarhet utan ny offentlig tabell", () => {
    expect(migration).toContain("website_cross_group_proposal_at timestamptz");
    expect(migration).toContain("opening_hours_cross_group_proposal_at timestamptz");
    expect(migration).toContain("interval '90 days'");
    expect(migration).not.toContain("CREATE TABLE IF NOT EXISTS public.place_practical_info_proposals");
  });

  test("delar bara källstödda fält och lämnar privat källa på servern", () => {
    expect(migration).toContain("_source_website IS NOT NULL");
    expect(migration).toContain("public.safe_cross_group_website_v1(_website)");
    expect(migration).toContain("gp.group_id <> _group_id");
    expect(migration).not.toContain("'sourceUrl',");
    expect(migration).not.toContain("'sourceNote',");
    expect(migration).not.toContain("'groupId',");
    expect(migration).not.toContain("'userId',");
    expect(migration).not.toContain("'count',");
  });

  test("ger endast neutral status eller ett fältvärde och stoppar motstridiga uppgifter", () => {
    expect(migration).toContain("jsonb_build_object('status', 'none')");
    expect(migration).toContain("jsonb_build_object('status', 'conflicting')");
    expect(migration).toContain("'status', 'available'");
    expect(migration).toContain("count(DISTINCT md5('website:'");
    expect(migration).toContain("count(DISTINCT md5('opening_hours:'");
  });

  test("kräver aktivt medlemskap och ny granskning före tillämpning", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.get_cross_group_practical_info_suggestions_v1",
    );
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.apply_cross_group_practical_info_suggestion_v1",
    );
    expect(migration).toContain("public.has_membership(_group_id, _uid)");
    expect(migration).toContain("Förslaget har ändrats. Ladda om och granska det igen");
    expect(migration).toContain("_candidate->>'fingerprint' IS DISTINCT FROM _fingerprint");
    expect(migration).toContain("FROM PUBLIC, anon");
  });

  test("låser globala Geoapify-snapshots till serverrollen", () => {
    expect(migration).toContain(
      "FROM PUBLIC, anon, authenticated;\nGRANT EXECUTE ON FUNCTION public.save_place_external_info_snapshot_v1",
    );
    expect(migration).toContain("TO service_role;");
    expect(migration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.save_place_external_info_snapshot_v1(\n  uuid, uuid, text, text, jsonb, text, timestamptz\n) TO authenticated",
    );
  });
});
