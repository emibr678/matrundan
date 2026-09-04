import { describe, expect, test } from "bun:test";

const source = await Bun.file("src/lib/matrundan/osm-notes.functions.ts").text();

describe("OSM Notes-servergränsen", () => {
  test("är autentiserad och kör externa anrop endast från serverfunktioner", () => {
    expect(source.match(/\.middleware\(\[requireSupabaseAuth\]\)/g)?.length).toBe(2);
    expect(source).toContain('const OSM_API_BASE = "https://api.openstreetmap.org/api/0.6"');
    expect(source).toContain("fetchWithTimeout");
    expect(source).toContain("REQUEST_TIMEOUT_MS");
  });

  test("identifierar Matrundan med den aktuella produktionsadressen och använder JSON-formatet", () => {
    expect(source).toContain('const APP_URL = "https://app.matrundan.workers.dev"');
    expect(source).not.toContain("matrundan.lovable.app");
    expect(source).toContain('"user-agent": `Matrundan/${APP_VERSION} (+${APP_URL})`');
    expect(source).toContain("referer: APP_URL");
    expect(source).toContain("new URL(`${OSM_API_BASE}/notes.json`)");
    expect(source).toContain("JSON.stringify({ lat, lon: lng, text: publicText })");
  });

  test("söker efter neutral referens före POST för att minska dubblettrisken", () => {
    const searchPosition = source.indexOf("await searchExistingNote(");
    const createPosition = source.indexOf("await createAnonymousNote(");
    expect(searchPosition).toBeGreaterThan(-1);
    expect(createPosition).toBeGreaterThan(searchPosition);
    expect(source).toContain('url.searchParams.set("q", publicReference)');
    expect(source).toContain('url.searchParams.set("closed", "-1")');
  });

  test("låter bara serverrollen bekräfta extern status", () => {
    expect(source).toContain('import("@/integrations/supabase/client.server")');
    expect(source).toContain('"complete_place_data_report_osm_submission_v1"');
    expect(source).toContain('"fail_place_data_report_osm_submission_v1"');
    expect(source).toContain('"update_place_data_report_osm_status_v1"');
  });

  test("markerar bara definitiva fel som misslyckade", () => {
    expect(source).toContain("error instanceof OsmRequestError && error.definitive");
    expect(source).toContain('"moderation_zone"');
    expect(source).toContain('"rate_limit"');
    expect(source).toContain('"timeout"');
  });
});
