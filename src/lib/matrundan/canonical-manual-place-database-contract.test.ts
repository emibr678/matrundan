import { describe, expect, test } from "bun:test";

const migrationPath = "supabase/migrations/20260808064500_canonical_manual_place_fallback.sql";
const sql = (await Bun.file(migrationPath).text()).replace(/\\r\\n/g, "\\n");

describe("kanonisk återanvändning och manuell fallback", () => {
  test("den interna förbättringskön saknar direkt klientåtkomst och kopplas inte till OSM-rapporttabellen", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.place_improvement_candidates");
    expect(sql).toContain(
      "ALTER TABLE public.place_improvement_candidates ENABLE ROW LEVEL SECURITY",
    );
    expect(sql).toContain("REVOKE ALL ON TABLE public.place_improvement_candidates");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).not.toMatch(
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER\s+TABLE|JOIN|FROM)\s+public\.place_data_reports\b/i,
    );
  });

  test("aktiv extern källa löser öppna neutrala förbättringskandidater", () => {
    expect(sql).toContain("resolve_place_improvement_candidate_for_active_source_v1");
    expect(sql).toContain("IF NEW.status <> 'active'");
    expect(sql).toContain("WHERE place_id = NEW.place_id");
    expect(sql).toContain("AND status = 'open'");
    expect(sql).toContain("place_sources_resolve_improvement_candidates");
  });

  test("kandidat-RPC kräver aktiv grupp och medlemskap", () => {
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.find_reusable_manual_place_candidates_v1",
    );
    expect(sql).toContain("public.group_is_active(_group_id)");
    expect(sql).toContain("public.has_membership(_group_id, _uid)");
    expect(sql).toContain(
      "AND NOT EXISTS (\n        SELECT 1\n        FROM public.place_sources ps",
    );
  });

  test("kandidatpayloaden är neutral och innehåller ingen cross-group-metadata", () => {
    for (const key of [
      "'placeId'",
      "'name'",
      "'category'",
      "'address'",
      "'area'",
      "'city'",
      "'lat'",
      "'lng'",
      "'distanceKm'",
      "'matchKind'",
      "'groupStatus'",
    ]) {
      expect(sql).toContain(key);
    }
    for (const forbiddenKey of [
      "'groupId'",
      "'groupName'",
      "'sourceGroupId'",
      "'memberId'",
      "'memberName'",
      "'notes'",
      "'groupCount'",
    ]) {
      expect(sql).not.toContain(forbiddenKey);
    }
  });

  test("återanvändning länkar samma placeId utan att kopiera källgrupp", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.link_reusable_manual_place_v1");
    expect(sql).toContain("WHERE candidate->>'placeId' = _place_id::text");
    expect(sql).toContain("INSERT INTO public.group_places");
    expect(sql).toContain("source_group_id");
    expect(sql).toContain("'manual'");
    expect(sql).toContain("RETURN jsonb_build_object('placeId', _place_id, 'status', 'linked')");
  });

  test("ny fallback serialiseras och kandidatkontrolleras igen före create_place_v4b", () => {
    const lock = sql.indexOf("pg_advisory_xact_lock");
    const candidateCheck = sql.indexOf(
      "_candidates := public.find_reusable_manual_place_candidates_v1",
      lock,
    );
    const create = sql.indexOf("_place_id := public.create_place_v4b", candidateCheck);

    expect(lock).toBeGreaterThan(-1);
    expect(candidateCheck).toBeGreaterThan(lock);
    expect(create).toBeGreaterThan(candidateCheck);
    expect(sql).toContain("_declined_place_ids uuid[] DEFAULT '{}'");
    expect(sql).toContain("RAISE EXCEPTION 'REUSABLE_PLACE_FOUND'");
  });

  test("endast uttryckligt avböjda aktuella kandidater får passera till nytt ställe", () => {
    expect(sql).toContain("jsonb_array_elements(_candidates) AS candidates(candidate)");
    expect(sql).toContain("ANY(COALESCE(_declined_place_ids, ARRAY[]::uuid[]))");
    expect(sql).toContain("IF _unresolved_candidate_count > 0");
  });

  test("alla klient-RPC:er är låsta till authenticated", () => {
    for (const functionName of [
      "find_reusable_manual_place_candidates_v1",
      "link_reusable_manual_place_v1",
      "create_manual_place_fallback_v1",
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${functionName}`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${functionName}`);
    }
    expect(sql.match(/TO authenticated;/g)?.length).toBe(3);
  });
});
