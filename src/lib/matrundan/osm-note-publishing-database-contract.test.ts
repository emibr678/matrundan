import { describe, expect, test } from "bun:test";

const migrationPath = "supabase/migrations/20260801150000_osm_note_publishing.sql";
const sql = await Bun.file(migrationPath).text();

describe("OSM-publiceringens databaskontrakt", () => {
  test("lagrar extern status separat på den gruppprivata rapporten", () => {
    for (const column of [
      "osm_submission_state",
      "osm_public_reference",
      "osm_public_text",
      "osm_note_id",
      "osm_note_url",
      "osm_note_status",
      "osm_note_last_checked_at",
      "osm_submitted_by",
    ]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(sql).toContain("place_data_reports_osm_note_id_uidx");
    expect(sql).toContain("place_data_reports_osm_public_reference_uidx");
  });

  test("endast ägare och admin kan reservera en granskad rapport med kartposition", () => {
    expect(sql).toContain("prepare_place_data_report_osm_submission_v1");
    expect(sql).toContain("public.has_group_role(_group_id, _uid, ARRAY['owner', 'admin'])");
    expect(sql).toContain("_report.status <> 'ready_for_osm'");
    expect(sql).toContain("_report.reported_lat IS NULL OR _report.reported_lng IS NULL");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("Publicering pågår redan");
  });

  test("begränsar mänsklig publicering och blockerar dubbelpublicering", () => {
    expect(sql).toContain("Högst 10 OSM-anteckningar kan publiceras per person och dygn");
    expect(sql).toContain("Gruppen har nått dygnsgränsen för OSM-anteckningar");
    expect(sql).toContain("Rapporten är redan publicerad till OpenStreetMap");
    expect(sql).toContain("osm_submission_attempts = osm_submission_attempts + 1");
  });

  test("bara service role får bekräfta note-id och extern status", () => {
    for (const signature of [
      "public.complete_place_data_report_osm_submission_v1(uuid, text, bigint, text, timestamptz, timestamptz, text)",
      "public.fail_place_data_report_osm_submission_v1(uuid, text, text)",
      "public.update_place_data_report_osm_status_v1(uuid, text, bigint, text, timestamptz)",
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION ${signature}`);
      expect(sql).toContain("FROM PUBLIC, anon, authenticated");
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION ${signature}`);
    }
    expect(sql.match(/TO service_role;/g)?.length).toBe(3);
  });

  test("v2-listan är fortsatt grupp- och rollskyddad", () => {
    expect(sql).toContain("list_group_place_data_reports_v2");
    expect(sql).toContain("'osmNoteId', r.osm_note_id::text");
    expect(sql).toContain("'osmNoteStatus', r.osm_note_status");
    expect(sql).toContain("'osmPublicText', r.osm_public_text");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.list_group_place_data_reports_v2(uuid)",
    );
  });

  test("kontoradering tar bort kopplingen till den som publicerade", () => {
    expect(sql).toContain("osm_submitted_by = NULL");
    expect(sql).toContain("WHERE osm_submitted_by = _uid");
    expect(sql).toContain("Kontoraderingen kunde inte utökas för OSM-publicering");
  });
});
