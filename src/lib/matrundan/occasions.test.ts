import { describe, expect, test } from "bun:test";
import {
  normalizeOccasionClassification,
  rankPlacesForOccasion,
  rankPlacesForOccasions,
  rankPlacesOverall,
  toggleOccasionSelection,
} from "@/lib/matrundan/occasions";
import { OCCASION_DESCRIPTION, OCCASION_LABEL, OCCASION_VALUES } from "@/lib/matrundan/types";
import type { Place } from "@/lib/matrundan/types";

describe("sammanhangskategorier", () => {
  test("har tre tydliga och unika benämningar", () => {
    expect(OCCASION_VALUES).toEqual(["snabbt", "avslappnat", "middag"]);
    expect(OCCASION_VALUES.map((occasion) => OCCASION_LABEL[occasion])).toEqual([
      "Snabbt & enkelt",
      "Avslappnat",
      "Något extra",
    ]);
  });

  test("förklarar varje kategori som ett sammanhang", () => {
    for (const occasion of OCCASION_VALUES) {
      expect(OCCASION_DESCRIPTION[occasion].length).toBeGreaterThan(30);
    }
    expect(OCCASION_DESCRIPTION.snabbt).toContain("enkelt och smidigt att äta");
    expect(OCCASION_DESCRIPTION.snabbt).toContain("själva besöket behöver stå i centrum");
    expect(OCCASION_DESCRIPTION.snabbt).not.toContain("ta med maten");
    expect(OCCASION_DESCRIPTION.avslappnat).toContain("slå er ner och umgås");
    expect(OCCASION_DESCRIPTION.middag).toContain("måltiden ska kännas lite mer speciell");
    expect(OCCASION_DESCRIPTION.middag).not.toContain("finkrog");
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

  test("topplistan för alla inkluderar betygsatta ställen utan Passar för", () => {
    const places = [
      place("Utan val", [], "p0"),
      place("Bara avslappnat", ["avslappnat"], "p1"),
      place("Arkiverat", [], "p4", "archived"),
    ];
    const ratings: Record<string, { overall: number; count: number }> = {
      p0: { overall: 5, count: 1 },
      p1: { overall: 4.5, count: 2 },
      p4: { overall: 5, count: 9 },
    };

    expect(
      rankPlacesOverall(places, (id) => ratings[id]).map(({ place: item }) => item.id),
    ).toEqual(["p0", "p1"]);
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

  test("flera Passar för-val är OR medan inget val betyder alla", () => {
    const places = [
      place("Bara snabbt", ["snabbt"], "p1"),
      place("Bara avslappnat", ["avslappnat"], "p2"),
      place("Något extra", ["middag"], "p3"),
    ];
    const ratings: Record<string, { overall: number; count: number }> = {
      p1: { overall: 4.2, count: 1 },
      p2: { overall: 4.8, count: 1 },
      p3: { overall: 5, count: 1 },
    };

    expect(
      rankPlacesForOccasions(places, ["snabbt", "avslappnat"], (id) => ratings[id]).map(
        ({ place: item }) => item.id,
      ),
    ).toEqual(["p2", "p1"]);

    expect(
      rankPlacesForOccasions(places, [], (id) => ratings[id]).map(({ place: item }) => item.id),
    ).toEqual(["p3", "p2", "p1"]);
  });
});

function place(
  name: string,
  occasions: Place["occasions"],
  id: string,
  collectionStatus: Place["collectionStatus"] = "active",
): Place {
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
    collectionStatus,
  };
}
