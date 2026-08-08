import { describe, expect, test } from "bun:test";

const migrationPath = "supabase/migrations/20260808150000_place_maintenance.sql";
const sql = await Bun.file(migrationPath).text();

function functionSql(name: string, nextName?: string) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThan(-1);
  const end = nextName
    ? sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nextName}`, start + 1)
    : sql.length;
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("globalt Platsunderhåll", () => {
  test("maintainerrollen är privat och separat från grupproller", () => {
    expect(sql).toContain("CREATE TABLE public.place_maintainers");
    expect(sql).toContain("ALTER TABLE public.place_maintainers ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON TABLE public.place_maintainers FROM PUBLIC, anon, authenticated");

    const access = functionSql(
      "get_place_maintenance_access_v1",
      "list_place_improvement_candidates_for_maintenance_v1",
    );
    expect(access).toContain("FROM public.place_maintainers pm");
    expect(access).not.toContain("has_group_role");
    expect(access).not.toContain("has_membership");
  });

  test("underhållskön har needs_osm och privat append-only audit", () => {
    expect(sql).toContain("status IN ('open', 'needs_osm', 'resolved', 'dismissed')");
    expect(sql).toContain("CREATE TABLE public.place_improvement_candidate_events");
    expect(sql).toContain(
      "ALTER TABLE public.place_improvement_candidate_events ENABLE ROW LEVEL SECURITY",
    );
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.place_improvement_candidate_events FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain("actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL");
    expect(sql).toContain("user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE");
  });

  test("list-RPC returnerar bara neutral platsidentitet", () => {
    const list = functionSql(
      "list_place_improvement_candidates_for_maintenance_v1",
      "get_place_improvement_candidate_for_maintenance_v1",
    );
    for (const allowed of [
      "'candidateId'",
      "'placeId'",
      "'reason'",
      "'status'",
      "'name'",
      "'category'",
      "'address'",
      "'area'",
      "'city'",
      "'lat'",
      "'lng'",
      "'website'",
      "'activeSource'",
    ]) {
      expect(list).toContain(allowed);
    }
    for (const forbidden of [
      "'groupId'",
      "'groupName'",
      "'sourceGroupId'",
      "'createdBy'",
      "'memberId'",
      "'memberName'",
      "'notes'",
      "'websiteOverride'",
      "'groupCount'",
    ]) {
      expect(list).not.toContain(forbidden);
    }
    expect(list).not.toContain("group_places");
  });

  test("needs_osm är en intern statusövergång utan extern skrivning", () => {
    const mark = functionSql(
      "mark_place_improvement_candidate_needs_osm_v1",
      "dismiss_place_improvement_candidate_v1",
    );
    expect(mark).toContain("SET status = 'needs_osm'");
    expect(mark).toContain("'marked_needs_osm'");
    expect(mark).not.toContain("INSERT INTO public.place_sources");
    expect(mark).not.toContain("place_data_reports");
  });

  test("avfärdande kräver strukturerad orsak och auditeras", () => {
    const dismiss = functionSql(
      "dismiss_place_improvement_candidate_v1",
      "link_provider_source_for_maintenance_v1",
    );
    for (const reason of [
      "not_relevant",
      "insufficient_evidence",
      "not_food_place",
      "already_handled",
    ]) {
      expect(dismiss).toContain(`'${reason}'`);
    }
    expect(dismiss).toContain("'dismissed'");
    expect(dismiss).toContain("jsonb_build_object('reason', _reason)");
  });

  test("central källkoppling behåller kanoniskt placeId och säkra identitetsvakter", () => {
    const link = functionSql(
      "link_provider_source_for_maintenance_v1",
      "resolve_place_improvement_candidate_for_active_source_v1",
    );
    expect(link).toContain("FROM public.place_maintainers pm");
    expect(link).not.toContain("has_group_role");
    expect(link).not.toContain("group_places");
    expect(link).toContain("ps.status = 'active'");
    expect(link).toContain("ps.place_id <> _place_id");
    expect(link).toContain("pg_advisory_xact_lock");
    expect(link).toContain("INSERT INTO public.place_sources");
    expect(link).toContain("WHERE id = _place_id");
    expect(link).toContain("RETURN _place_id");
  });

  test("aktiv källa löser både open och needs_osm med audit", () => {
    const resolve = functionSql("resolve_place_improvement_candidate_for_active_source_v1");
    expect(resolve).toContain("status IN ('open', 'needs_osm')");
    expect(resolve).toContain("'resolved_active_source'");
    expect(resolve).toContain("NEW.provider");
    expect(resolve).toContain("NEW.provider_place_id");
  });

  test("alla publika maintenance-RPC:er kräver authenticated", () => {
    for (const name of [
      "get_place_maintenance_access_v1",
      "list_place_improvement_candidates_for_maintenance_v1",
      "get_place_improvement_candidate_for_maintenance_v1",
      "mark_place_improvement_candidate_needs_osm_v1",
      "dismiss_place_improvement_candidate_v1",
      "link_provider_source_for_maintenance_v1",
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${name}`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${name}`);
    }
  });
});
