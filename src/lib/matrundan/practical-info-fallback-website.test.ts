import { describe, expect, it } from "bun:test";

import { normalizeGroupPlacePracticalInfoUpdate } from "./practical-info";

describe("normalizeGroupPlacePracticalInfoUpdate", () => {
  it("använder webbplatsen som källänk när fallbacken saknar separat evidens", () => {
    expect(
      normalizeGroupPlacePracticalInfoUpdate({
        websiteOverride: "matstallet.se",
        openingHoursOverride: null,
        sourceUrl: null,
        sourceNote: null,
      }),
    ).toEqual({
      websiteOverride: "https://matstallet.se/",
      openingHoursOverride: null,
      sourceUrl: "https://matstallet.se/",
      sourceNote: null,
    });
  });

  it("behåller en uttrycklig källänk när en sådan finns", () => {
    expect(
      normalizeGroupPlacePracticalInfoUpdate({
        websiteOverride: "matstallet.se",
        openingHoursOverride: null,
        sourceUrl: "https://example.com/kalla",
        sourceNote: null,
      }).sourceUrl,
    ).toBe("https://example.com/kalla");
  });

  it("uppfinner ingen källänk när användaren i stället har lämnat en observation", () => {
    expect(
      normalizeGroupPlacePracticalInfoUpdate({
        websiteOverride: "matstallet.se",
        openingHoursOverride: null,
        sourceUrl: null,
        sourceNote: "Kontrollerat på restaurangens skylt.",
      }),
    ).toMatchObject({
      sourceUrl: null,
      sourceNote: "Kontrollerat på restaurangens skylt.",
    });
  });

  it("uppfinner inte evidens för öppettider utan webbplats", () => {
    expect(
      normalizeGroupPlacePracticalInfoUpdate({
        websiteOverride: null,
        openingHoursOverride: { days: [], partiallyParsed: false },
        sourceUrl: null,
        sourceNote: null,
      }),
    ).toMatchObject({
      websiteOverride: null,
      sourceUrl: null,
      sourceNote: null,
    });
  });
});
