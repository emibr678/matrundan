import { describe, expect, test } from "bun:test";
import { diagnostics464Allowed, summarizeDiagnostics464 } from "./geoapify-diagnostics-464";

const staging = "https://staging.matrundan.workers.dev";
const feature = (name: string) => ({
  properties: {
    name,
    place_id: name,
    categories: ["catering.restaurant"],
    city: "Stockholm",
    lat: 59.34,
    lon: 18.06,
    datasource: { raw: { private: "must-not-leak" } },
  },
});

describe("Tillfällig diagnostik #464", () => {
  test("tillåter endast konfigurerad Staging och dess HTTPS-preview", () => {
    expect(diagnostics464Allowed(staging, staging + "/matstallen")).toBe(true);
    expect(diagnostics464Allowed(staging, "https://123abc-staging.matrundan.workers.dev/x")).toBe(
      true,
    );
    for (const url of [
      "https://app.matrundan.workers.dev",
      "http://staging.matrundan.workers.dev",
      "https://staging.matrundan.workers.dev.evil.test",
      "invalid",
    ]) {
      expect(diagnostics464Allowed(staging, url)).toBe(false);
    }
    expect(diagnostics464Allowed("https://app.matrundan.workers.dev", staging)).toBe(false);
    expect(diagnostics464Allowed(undefined, staging)).toBe(false);
  });
  test("redovisar exakt request utan nycklar och rådatasource", () => {
    const url = new URL(
      "https://api.geoapify.com/v2/places?name=Ox%20lan&limit=20&apiKey=secret&unexpected=secret",
    );
    const result = summarizeDiagnostics464([feature("Ox Lan")], url, "Ox lan");
    expect(result.request.name).toBe("Ox lan");
    expect(result.request.limit).toBe("20");
    expect(result.candidates[0].disposition).toBe("accepted");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(JSON.stringify(result)).not.toContain("place_id");
  });
  test("skiljer normalisering, dubblett och intentfilter", () => {
    const rows = summarizeDiagnostics464(
      [null, {}, feature("Ox Lan"), feature("Ox Lan"), feature("Other")],
      new URL("https://api.geoapify.com/v2/places"),
      "Ox lan",
    );
    expect(rows.rawFeatureCount).toBe(5);
    expect(rows.candidates.map((r) => r.disposition)).toEqual([
      "normalization-rejected",
      "normalization-rejected",
      "accepted",
      "duplicate",
      "intent-rejected",
    ]);
  });
  test("behåller råantal och begränsar detaljprojektionen till 50", () => {
    const rows = summarizeDiagnostics464(
      Array.from({ length: 80 }, () => feature("Ox Lan")),
      new URL("https://api.geoapify.com/v2/places"),
      "Ox Lan",
    );
    expect(rows.rawFeatureCount).toBe(80);
    expect(rows.candidates.length).toBe(50);
  });
});
