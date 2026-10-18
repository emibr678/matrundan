import { describe, expect, test } from "bun:test";
import {
  materializeRelease,
  mergesFromLog,
  newerThan,
  nextPatch,
  notesFromPr,
  parseOptions,
  validDate,
} from "../../../scripts/release-prepare.mjs";

const SHA = "a".repeat(40);
const BASE_SOURCE =
  'import type { ChangelogEntry } from "./types";\n' +
  'export type { ChangelogEntry };\n\n' +
  'const VERSION_1_45_1_CHANGELOG: ChangelogEntry = {\n' +
  '  version: "1.45.1",\n' +
  '  date: "2026-10-17",\n' +
  '  summary: "Tidigare gäster",\n' +
  '  sections: [],\n};\n\n' +
  'export const CHANGELOG: ChangelogEntry[] = [\n' +
  '  VERSION_1_45_1_CHANGELOG,\n];\n';
const BASE_MARKDOWN =
  "# Changelog\n\n## [Unreleased]\n\nInga ändringar ännu.\n\n" +
  "## [1.45.1] – 2026-10-17\n\n### Rättat\n\n- Äldre fix.\n";

function pr(body, extra = {}) {
  return {
    number: 503,
    merged_at: "2026-10-18T06:04:51Z",
    base: { ref: "main" },
    merge_commit_sha: SHA,
    body,
    ...extra,
  };
}
const merge = { sha: SHA, number: 503 };
const body =
  "<!-- MATRUNDAN_RELEASE_NOTE_BEGIN -->\n" +
  "- Sökdialogen ligger stilla när resultat laddas.\n" +
  "<!-- MATRUNDAN_RELEASE_NOTE_END -->";

describe("portabel releaseförberedelse (#485)", () => {
  test("är skrivskyddad som standard och kräver sammanfattning", () => {
    expect(parseOptions(["--summary", "Stabilare sökning"]).write).toBe(false);
    expect(parseOptions(["--summary", "Stabilare sökning", "--write", "--kind", "Rättat"]).write)
      .toBe(true);
    expect(() => parseOptions([])).toThrow("--summary");
    expect(() => parseOptions(["--summary", "Stabilare sökning", "--oops"]))
      .toThrow("Okänt");
  });

  test("väljer korrekt patchversion och strikt ökande semver", () => {
    expect(nextPatch("1.45.1")).toBe("1.45.2");
    expect(newerThan("1.46.0", "1.45.9")).toBe(true);
    expect(newerThan("1.45.2", "1.45.1")).toBe(true);
    expect(newerThan("1.44.99", "1.45.1")).toBe(false);
    expect(newerThan("1.45.1", "1.45.1")).toBe(false);
  });

  test("validerar release-datum", () => {
    expect(validDate("2026-10-18")).toBe(true);
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2026-99-10")).toBe(false);
  });

  test("identifierar mergade PR:er på första föräldrakedjan", () => {
    const log =
      SHA + "\tMerge PR #503 — Förbättra mobilnavigation\n" +
      "b".repeat(40) + "\tMerge pull request #500 from feature";
    expect(mergesFromLog(log)).toEqual([
      { sha: "b".repeat(40), number: 500 },
      { sha: SHA, number: 503 },
    ]);
    expect(() => mergesFromLog(SHA + "\tDirektändring på main")).toThrow("saknar");
    expect(() => mergesFromLog("")).toThrow("Inga nya");
    expect(() => mergesFromLog(SHA + "\tMerge PR #503\n" + SHA + "\tMerge PR #503"))
      .toThrow("flera gånger");
  });

  test("hämtar bara en exakt verifierad mergad PR:s releasepunkter", () => {
    expect(notesFromPr(pr(body), merge)).toEqual([
      "Sökdialogen ligger stilla när resultat laddas.",
    ]);
    expect(() => notesFromPr(pr(body, { merge_commit_sha: "b".repeat(40) }), merge))
      .toThrow("inte verifierat mergad");
    expect(() => notesFromPr(pr(body, { merged_at: null }), merge))
      .toThrow("inte verifierat mergad");
    expect(() => notesFromPr(pr(body, { base: { ref: "develop" } }), merge))
      .toThrow("inte verifierat mergad");
  });

  test("kräver explicita användarsynliga releasepunkter men tillåter maintenance", () => {
    expect(() => notesFromPr(pr("Ingen releasepunkt"), merge)).toThrow("saknar");
    expect(() => notesFromPr(pr("<!-- MATRUNDAN_RELEASE_NOTE_BEGIN -->\n<!-- x -->\n<!-- MATRUNDAN_RELEASE_NOTE_END -->"), merge))
      .toThrow("tomt");
    expect(notesFromPr(pr("Version: inte relevant"), merge)).toEqual([]);
    expect(() => notesFromPr(pr("<!-- MATRUNDAN_RELEASE_NOTE_BEGIN -->\nText utan punkt\n<!-- MATRUNDAN_RELEASE_NOTE_END -->"), merge))
      .toThrow("ogiltig");
  });

  test("skapar samma version/datum/nyhet i båda releasefilerna", () => {
    const result = materializeRelease(
      BASE_SOURCE,
      BASE_MARKDOWN,
      "1.45.2",
      "2026-10-18",
      "Stabilare sökning på mobil.",
      "Rättat",
      ["Sökdialogen ligger stilla.", "Tillbakapilen går till sökresultaten."],
    );
    expect(result.version).toContain('version: "1.45.2"');
    expect(result.version).toContain('date: "2026-10-18"');
    expect(result.version).toContain("VERSION_1_45_2_CHANGELOG,");
    expect(result.version).toContain('kind: "Rättat"');
    expect(result.changelog).toContain("## [1.45.2] – 2026-10-18");
    expect(result.changelog).toContain("### Rättat");
    expect(result.changelog).toContain("- Sökdialogen ligger stilla.");
    expect(result.changelog.indexOf("[1.45.2]")).toBeLessThan(result.changelog.indexOf("[1.45.1]"));
    expect(BASE_SOURCE).not.toContain('version: "1.45.2"');
  });

  test("vägrar återanvända version, gå bakåt eller skapa tom release", () => {
    const make = (version, date, notes) =>
      materializeRelease(
        BASE_SOURCE,
        BASE_MARKDOWN,
        version,
        date,
        "Stabilare sökning.",
        "Rättat",
        notes,
      );
    const notes = ["Sökningen hoppar inte."];
    expect(() => make("1.45.1", "2026-10-18", notes)).toThrow("måste ligga efter");
    expect(() => make("1.45.2", "2026-10-16", notes)).toThrow("måste ligga efter");
    expect(() => make("1.45.2", "2026-10-18", [])).toThrow("saknar användarsynliga");
  });
});
