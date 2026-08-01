import { describe, expect, test } from "bun:test";

import {
  buildDefaultOsmPublicText,
  composeOsmNoteText,
  findOsmNoteByReference,
  normalizeOsmPublicText,
  parseOsmNoteFeature,
} from "./osm-notes";

describe("anonyma OSM-anteckningar", () => {
  test("bygger en neutral offentlig text utan grupp- eller medlemsuppgifter", () => {
    const text = buildDefaultOsmPublicText({
      placeName: "Testköket",
      placeAddress: "Testgatan 1",
      placeCity: "Stockholm",
      category: "wrong_website",
      description: "Verksamhetens skylt visar testkoket.example.",
    });

    expect(text).toContain("Webbplatsen i kartdatan verkar vara fel eller inaktuell.");
    expect(text).toContain("Testköket (Testgatan 1, Stockholm)");
    expect(text).toContain("Verksamhetens skylt visar testkoket.example.");
    expect(text).not.toContain("grupp");
    expect(text).not.toContain("rapportör");
  });

  test("normaliserar text och lägger till en icke-intern publik referens", () => {
    expect(normalizeOsmPublicText("  Första raden.\r\n\r\n\r\nAndra raden.  ")).toBe(
      "Första raden.\n\nAndra raden.",
    );
    expect(composeOsmNoteText("Platsinformationen behöver kontrolleras.", "MR-ABC123XYZ9")).toBe(
      "Platsinformationen behöver kontrolleras.\n\nRapporterat via Matrundan. Referens: MR-ABC123XYZ9",
    );
    expect(() => composeOsmNoteText("Platsinformationen behöver kontrolleras.", "intern-id")).toThrow(
      "Ogiltig offentlig OSM-referens.",
    );
  });

  test("tolkar OSM-svar och hittar samma note efter ett osäkert nätverksavbrott", () => {
    const feature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [18.071, 59.33] },
      properties: {
        id: 123456,
        status: "open",
        date_created: "2026-08-01T13:00:00Z",
        closed_at: null,
        comments: [{ text: "Rapporterat via Matrundan. Referens: MR-ABC123XYZ9" }],
      },
    };

    expect(parseOsmNoteFeature(feature)).toEqual({
      id: "123456",
      status: "open",
      createdAt: "2026-08-01T13:00:00Z",
      closedAt: null,
    });
    expect(
      findOsmNoteByReference(
        { type: "FeatureCollection", features: [feature] },
        "MR-ABC123XYZ9",
        59.33,
        18.071,
      ),
    ).toEqual({
      id: "123456",
      status: "open",
      createdAt: "2026-08-01T13:00:00Z",
      closedAt: null,
    });
    expect(
      findOsmNoteByReference(
        { type: "FeatureCollection", features: [feature] },
        "MR-ABC123XYZ9",
        58,
        18.071,
      ),
    ).toBeNull();
  });
});
