import { describe, expect, test } from "bun:test";

const migration = (
  await Promise.all([
    Bun.file("supabase/migrations/20260801190000_osm_submission_hardening.sql").text(),
    Bun.file("supabase/migrations/20260801190500_osm_trigger_function_grants.sql").text(),
  ])
).join("\n");

describe("OSM-publicering och källkoppling håller samma aktuella sanning", () => {
  test("ett saknas-i-OSM-underlag kan inte reserveras efter aktiv källkoppling", () => {
    expect(migration).toContain("_report.category = 'missing_in_osm'");
    expect(migration).toContain("ps.provider = 'openstreetmap'");
    expect(migration).toContain("ps.status = 'active'");
    expect(migration).toContain(
      "Matstället har redan en aktiv OpenStreetMap-koppling. Rapporten ska inte publiceras",
    );
  });

  test("en aktiv OSM-källa avslutar opublicerade underlag men blockerar pågående publicering", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.resolve_missing_in_osm_reports_for_active_source_v1",
    );
    expect(migration).toContain("place_sources_resolve_missing_in_osm_reports");
    expect(migration).toContain("r.category = 'missing_in_osm'");
    expect(migration).toContain("r.osm_submission_state = 'submitting'");
    expect(migration).toContain("r.osm_submission_started_at > now() - interval '5 minutes'");
    expect(migration).toContain("SET status = 'resolved'");
    expect(migration).toContain("Ingen OSM-anteckning behöver publiceras");
    expect(migration).toContain("osm_submission_state = 'not_submitted'");
  });

  test("försök loggas append-only och dygnskvoter räknar även misslyckade försök", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.place_data_report_osm_submission_attempts",
    );
    expect(migration).toContain("INSERT INTO public.place_data_report_osm_submission_attempts");
    expect(migration).toContain("FROM public.place_data_report_osm_submission_attempts a");
    expect(migration).toContain("a.submitted_by = _uid");
    expect(migration).toContain("a.group_id = _group_id");
    expect(migration).toContain("a.attempted_at >= now() - interval '24 hours'");
    expect(migration).toContain("osm_submission_attempts = _attempt_number");
  });

  test("samtidiga försök kan inte passera samma användar- eller gruppkvot", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("'osm-submit-user:' || _uid::text");
    expect(migration).toContain("'osm-submit-group:' || _group_id::text");
  });

  test("försöksloggen och triggerfunktionen är privata", () => {
    expect(migration).toContain(
      "ALTER TABLE public.place_data_report_osm_submission_attempts ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.place_data_report_osm_submission_attempts",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.resolve_missing_in_osm_reports_for_active_source_v1()",
    );
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
  });

  test("försöksloggen anonymiseras vid kontoradering", () => {
    expect(migration).toContain("UPDATE public.place_data_report_osm_submission_attempts");
    expect(migration).toContain("SET submitted_by = NULL");
  });
});
