import { describe, expect, test } from "bun:test";

const discoverySource = await Bun.file(
  "src/components/matrundan/PlaceDiscoveryV16.tsx",
).text();

describe("Lägg till ställens sökflöde", () => {
  test("etablerar Sök i före Sök matställen", () => {
    const searchAreaIndex = discoverySource.indexOf("<SearchAreaControlsV16");
    const placeSearchIndex = discoverySource.indexOf("Sök matställen");

    expect(searchAreaIndex).toBeGreaterThanOrEqual(0);
    expect(placeSearchIndex).toBeGreaterThan(searchAreaIndex);
    expect(discoverySource).toContain("Sök i");
    expect(discoverySource).toContain("Lägg till område eller adress");
  });

  test("skiljer generella typer från specifika matställen i autocomplete", () => {
    expect(discoverySource).toContain("genericPlaceSearchSuggestions");
    expect(discoverySource).toContain("Kök och typer");
    expect(discoverySource).toContain("Matställen");
    expect(discoverySource).toContain('role="listbox"');
  });

  test("behåller geografiskt scope separat från ett valt matställe", () => {
    expect(discoverySource).toContain("selectedAreaIds");
    expect(discoverySource).toContain("temporaryAreas");
    expect(discoverySource).toContain("radiusKm");
    expect(discoverySource).toContain("selectedId");
  });
});
