import { describe, expect, test } from "bun:test";
import {
  isOsmPreviewFilter,
  mergeOsmPreviewPages,
  osmPreviewKey,
  osmPreviewSuggestion,
  osmPreviewTokens,
  type OsmPreviewRow,
} from "./osm-staging-preview";

const row: OsmPreviewRow = {
  osmType: "way",
  osmId: 123,
  name: "Exempel",
  amenity: "restaurant",
  cuisine: "italian;pasta",
  lat: 59.33,
  lng: 18.06,
  distanceM: 622,
};

describe("staging: OSM som skrivskyddad sökkälla (#512)", () => {
  test("endast tre uttryckligen provade filter tillåts", () => {
    expect(isOsmPreviewFilter("specialty:pasta")).toBe(true);
    expect(isOsmPreviewFilter("specialty:ramen")).toBe(true);
    expect(isOsmPreviewFilter("search:asiatiskt")).toBe(true);
    expect(isOsmPreviewFilter("specialty:falafel")).toBe(false);
    expect(osmPreviewTokens("specialty:pasta", "direct")).toEqual(["pasta"]);
    expect(osmPreviewTokens("specialty:pasta", "related")).toEqual(["italian"]);
    expect(osmPreviewTokens("specialty:ramen", "direct")).toEqual(["ramen"]);
    expect(osmPreviewTokens("specialty:ramen", "related")).toEqual([]);
    expect(osmPreviewTokens("search:asiatiskt", "direct")).toContain("japanese");
  });

  test("OSM-identiteten inkluderar objektstyp, aldrig fuzzy-namn", () => {
    expect(osmPreviewKey(row)).toBe("way:123");
    expect(osmPreviewKey({ osmType: "node", osmId: 123 })).toBe("node:123");
    const direct = osmPreviewSuggestion(row, "specialty:pasta", "direct", "a", "Stockholm");
    const related = osmPreviewSuggestion(row, "specialty:pasta", "related", "a", "Stockholm");
    expect(direct.provider).toBe("openstreetmap");
    expect(direct.distanceKm).toBeCloseTo(0.622);
    expect(direct.searchEvidence?.kind).toBe("metadata");
    expect(related.searchEvidence?.kind).toBe("association");
    expect(related.canonical).toBeUndefined();
    expect(related.identity).toBeUndefined();
    expect(mergeOsmPreviewPages([direct], [related])).toEqual([direct]);
  });

  test("olika OSM-typer med samma namn/id förblir separata träffar", () => {
    const way = osmPreviewSuggestion(row, "specialty:pasta", "direct", "a", "Stockholm");
    const node = osmPreviewSuggestion(
      { ...row, osmType: "node" },
      "specialty:pasta",
      "related",
      "a",
      "Stockholm",
    );
    expect(mergeOsmPreviewPages([way], [node])).toHaveLength(2);
  });
});
