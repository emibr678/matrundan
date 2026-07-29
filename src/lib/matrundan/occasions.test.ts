import { describe, expect, test } from "bun:test";
import {
  normalizeOccasionClassification,
  occasionClassification,
  primaryOccasion,
  rankPlacesForOccasion,
  secondaryOccasion,
} from "@/lib/matrundan/occasions";
import { OCCASION_DESCRIPTION, OCCASION_LABEL, OCCASION_VALUES } from "@/lib/matrundan/types";
import type { Place } from "@/lib/matrundan/types";

describe("sammanhangskategorier", () => {
  test("har tre tydliga och unika benämningar", () => {
    expect(OCCASION_VALUES).toEqual(["snabbt", "avslappnat", "middag"]);
    expect(OCCASION_VALUES.map((occasion) => OCCASION_LABEL[occasion])).toEqual([
      "Snabbt & smidigt",
      "Vardag & häng",
      "Något särskilt",
    ]);
  });

  test("förklarar varje kategori som ett sammanhang", () => {
    for (const occasion of OCCASION_VALUES) {
      expect(OCCASION_DESCRIPTION[occasion].length).toBeGreaterThan(30);
    }
    expect(OCCASION_DESCRIPTION.snabbt).toContain("takeaway");
    expect(OCCASION_DESCRIPTION.middag).toContain("upplevelsen");
  });

  test("tolkar första valet som primärt och högst ett val som sekundärt", () => {
    expect(normalizeOccasionClassification(["middag", "avslappnat", "snabbt", "middag"])).toEqual([
      "middag",
      "avslappnat",
    ]);
    expect(occasionClassification("snabbt", "snabbt")).toEqual(["snabbt"]);
    expect(occasionClassification("avslappnat", "middag")).toEqual(["avslappnat", "middag"]);
    expect(primaryOccasion(["avslappnat", "middag"])).toBe("avslappnat");
    expect(secondaryOccasion(["avslappnat", "middag"])).toBe("middag");
  });

  test("topplistan jämför bara ställen där sammanhanget är primärt", () => {
    const places = [
      place("Primär vardag", ["avslappnat"], "p1"),
      place("Sekundär vardag", ["snabbt", "avslappnat"], "p2"),
      place("Delad etta", ["avslappnat"], "p3"),
    ];
    const ratings = {
      p1: { overall: 4.5, count: 2 },
      p2: { overall: 5, count: 4 },
      p3: { overall: 4.5, count: 1 },
    };

    const ranked = rankPlacesForOccasion(places, "avslappnat", (id) => ratings[id]);

    expect(ranked.map(({ place: item, rank }) => [item.id, rank])).toEqual([
      ["p1", 1],
      ["p3", 1],
    ]);
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
