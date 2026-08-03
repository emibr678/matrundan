import { describe, expect, test } from "bun:test";
import {
  normalizeOccasionClassification,
  rankPlacesForOccasion,
  toggleOccasionSelection,
} from "@/lib/matrundan/occasions";
import { OCCASION_DESCRIPTION, OCCASION_LABEL, OCCASION_VALUES } from "@/lib/matrundan/types";
import type { Place } from "@/lib/matrundan/types";

describe("sammanhangskategorier", () => {
  test("har tre tydliga och unika benämningar", () => {
    expect(OCCASION_VALUES).toEqual(["snabbt", "avslappnat", "middag"]);
    expect(OCCASION_VALUES.map((occasion) => OCCASION_LABEL[occasion])).toEqual([
      "Snabbt och enkelt",
      "Avslappnat",
      "Något extra",
    ]);
  });

  test("förklarar varje kategori som ett sammanhang", () => {
    for (const occasion of OCCASION_VALUES) {
      expect(OCCASION_DESCRIPTION[occasion].length).toBeGreaterThan(30);
    }
    expect(OCCASION_DESCRIPTION.snabbt).toContain("ta med maten");
    expect(OCCASION_DESCRIPTION.avslappnat).toContain("vänner eller familj");
    expect(OCCASION_DESCRIPTION.middag).toContain("finkrog");
  });

  test("normaliserar till högst två likvärdiga val i stabil ordning", () => {
    expect(normalizeOccasionClassification(["middag", "avslappnat", "snabbt", "middag"])).toEqual([
      "snabbt",
      "avslappnat",
    ]);
    expect(normalizeOccasionClassification(["middag", "avslappnat"])).toEqual([
      "avslappnat",
      "middag",
    ]);
  });

  test("direkt flerval lägger till, tar bort och stoppar ett tredje val", () => {
    expect(toggleOccasionSelection([], "avslappnat")).toEqual(["avslappnat"]);
    expect(toggleOccasionSelection(["avslappnat"], "middag")).toEqual(["avslappnat", "middag"]);
    expect(toggleOccasionSelection(["avslappnat", "middag"], "snabbt")).toEqual([
      "avslappnat",
      "middag",
    ]);
    expect(toggleOccasionSelection(["avslappnat", "middag"], "avslappnat")).toEqual(["middag"]);
  });

  test("topplistan inkluderar stället för vart och ett av dess val", () => {
    const places = [
      place("Bara avslappnat", ["avslappnat"], "p1"),
      place("Snabbt och avslappnat", ["snabbt", "avslappnat"], "p2"),
      place("Delad etta", ["avslappnat"], "p3"),
    ];
    const ratings: Record<string, { overall: number; count: number }> = {
      p1: { overall: 4.5, count: 2 },
      p2: { overall: 5, count: 4 },
      p3: { overall: 4.5, count: 1 },
    };

    const relaxed = rankPlacesForOccasion(places, "avslappnat", (id) => ratings[id]);
    const quick = rankPlacesForOccasion(places, "snabbt", (id) => ratings[id]);

    expect(relaxed.map(({ place: item, rank }) => [item.id, rank])).toEqual([
      ["p2", 1],
      ["p1", 2],
      ["p3", 2],
    ]);
    expect(quick.map(({ place: item, rank }) => [item.id, rank])).toEqual([["p2", 1]]);
  });
});

function place(name: string, occasions: Place["occasions"], id: string): Place {
  return {
    id,
    name,
    category: "restaurang",
    cuisines: [],
    occasions,
    address: "",
    city: "Stockholm",
    addedBy: "m1",
    addedAt: "2026-01-01T00:00:00.000Z",
  };
}
