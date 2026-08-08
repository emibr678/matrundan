import { describe, expect, test } from "bun:test";

const migrationPath = "supabase/migrations/20260808210000_unified_place_maintenance_queue.sql";
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

describe("gemensam Platsunderhåll-projektion", () => {
  test("kön projicerar både förbättringskandidater och rapporterade fel", () => {
    const list = functionSql(
      "list_place_maintenance_work_items_v1",
      "mark_place_maintenance_work_item_needs_osm_v1",
    );
    expect(list).toContain("FROM public.place_improvement_candidates c");
    expect(list).toContain("FROM public.place_data_reports r");
    expect(list).toContain("'improvement_candidate'::text AS kind");
    expect(list).toContain("'reported_error'::text AS kind");
    expect(list).toContain("WHEN 'ready_for_osm' THEN 'needs_osm'");
  });

  test("rapportprojektionen exponerar inte grupp, rapportör eller privat fritext", () => {
    const list = functionSql(
      "list_place_maintenance_work_items_v1",
      "mark_place_maintenance_work_item_needs_osm_v1",
    );

    for (const forbidden of [
      "r.group_id",
      "r.created_by",
      "r.description",
      "r.resolution_note",
      "group_places",
      "website_override",
      "reporterName",
      "groupName",
      "sourceGroupId",
    ]) {
      expect(list).not.toContain(forbidden);
    }

    for (const allowed of [
      "'workItemId'",
      "'kind'",
      "'targetKind'",
      "'placeId'",
      "'issueCategory'",
      "'name'",
      "'address'",
      "'city'",
      "'activeSource'",
      "'externalReference'",
      "'osmNote'",
    ]) {
      expect(list).toContain(allowed);
    }
  });

  test("kanoniska rapporter använder places i stället för gruppens snapshot för platsdata", () => {
    const list = functionSql(
      "list_place_maintenance_work_items_v1",
      "mark_place_maintenance_work_item_needs_osm_v1",
    );
    expect(list).toContain("CASE WHEN r.place_id IS NULL THEN r.reported_name ELSE p.name END");
    expect(list).toContain(
      "CASE WHEN r.place_id IS NULL THEN r.reported_website ELSE p.website END",
    );
    expect(list).not.toContain("gp.website_override");
  });

  test("globala handlingar använder maintainerroll och skriver ingen privat rapporttext", () => {
    for (const [name, next] of [
      ["mark_place_maintenance_work_item_needs_osm_v1", "dismiss_place_maintenance_work_item_v1"],
      ["dismiss_place_maintenance_work_item_v1", "resolve_place_maintenance_work_item_v1"],
      [
        "resolve_place_maintenance_work_item_v1",
        "link_provider_source_for_maintenance_work_item_v1",
      ],
    ] as const) {
      const fn = functionSql(name, next);
      expect(fn).toContain("FROM public.place_maintainers pm");
      expect(fn).not.toContain("has_group_role");
      expect(fn).not.toContain("has_membership");
      expect(fn).not.toContain("description =");
    }
  });

  test("gemensam audit är privat och polymorf utan kopierad rapporttext", () => {
    expect(sql).toContain("CREATE TABLE public.place_maintenance_events");
    expect(sql).toContain("work_item_kind IN ('improvement_candidate', 'reported_error')");
    expect(sql).toContain("ALTER TABLE public.place_maintenance_events ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.place_maintenance_events FROM PUBLIC, anon, authenticated",
    );
    expect(sql).not.toContain(
      "INSERT INTO public.place_maintenance_events(work_item_kind, work_item_id, place_id, action, actor_id, description",
    );
  });
});
