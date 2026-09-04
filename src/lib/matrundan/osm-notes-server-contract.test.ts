import { describe, expect, test } from "bun:test";

const source = await Bun.file("src/lib/matrundan/osm-notes.functions.ts").text();
const wrangler = JSON.parse(await Bun.file("wrangler.json").text());

describe("OSM Notes-servergränsen", () => {
  test("är autentiserad och kör externa anrop endast från serverfunktioner", () => {
    expect(source.match(/\.middleware\(\[requireSupabaseAuth\]\)/g)?.length).toBe(2);
    expect(source).toContain('const OSM_API_BASE = "https://api.openstreetmap.org/api/0.6"');
    expect(source).toContain("fetchWithTimeout");
    expect(source).toContain("REQUEST_TIMEOUT_MS");
  });

  test("identifierar Matrundan via portabel deploymentkonfiguration", () => {
    expect(source).toContain("process.env.MATRUNDAN_PUBLIC_URL");
    expect(source).not.toContain("matrundan.lovable.app");
    expect(source).not.toContain("workers.dev");
    expect(source).toContain('"user-agent": `Matrundan/${APP_VERSION} (+${appUrl})`');
    expect(source).toContain("referer: appUrl");
    expect(wrangler.vars?.MATRUNDAN_PUBLIC_URL).toBe("https://staging.matrundan.workers.dev");
    expect(wrangler.env?.staging?.vars?.MATRUNDAN_PUBLIC_URL).toBe(
      "https://staging.matrundan.workers.dev",
    );
    expect(wrangler.env?.prod?.vars?.MATRUNDAN_PUBLIC_URL).toBe(
      "https://app.matrundan.workers.dev",
    );
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
