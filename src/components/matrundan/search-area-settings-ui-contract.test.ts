import { describe, expect, test } from "bun:test";

const settingsSource = await Bun.file(
  "src/components/matrundan/GroupSearchSettingsSection.tsx",
).text();
const searchSource = await Bun.file("src/components/matrundan/SearchAreaControlsV16.tsx").text();
const pillSource = await Bun.file("src/components/matrundan/SearchAreaPill.tsx").text();

describe("sökområden i gruppinställningar", () => {
  test("använder samma autocomplete-till-pill-mönster som sökdialogen", () => {
    expect(settingsSource).toContain("<GeoapifyLocationInput");
    expect(settingsSource).toContain("onSelect={addArea}");
    expect(settingsSource).toContain("allowBoundaryAreas");
    expect(settingsSource).toContain("<SearchAreaPill");
    expect(settingsSource).toContain("Spara ändringar");
    expect(settingsSource).not.toContain("<Plus");
    expect(settingsSource).not.toContain("<Trash2");
    expect(searchSource).toContain("<SearchAreaPill");
  });

  test("delar kompakta pills och döljer tilläggsfältet när fem områden är valda", () => {
    expect(pillSource).toContain('className="flex h-8');
    expect(pillSource).toContain("after:-inset-1.5");
    expect(settingsSource).toContain("{atAreaLimit ? (");
    expect(settingsSource).toContain(
      "Fem områden är valda. Ta bort ett för att lägga till ett annat.",
    );
    expect(settingsSource).not.toContain("Ta bort ett område för att lägga till ett nytt");
  });

  test("bevarar äldre breda punktval men förklarar hur de uppgraderas till boundary", () => {
    expect(settingsSource).toContain("broadLegacyPoints");
    expect(settingsSource).toContain(
      'area.searchMode !== "boundary" &&\n      isBroadAdministrativeSearchArea(area.resultType, area.label)',
    );
    expect(settingsSource).toContain("behåller sitt tidigare punktbeteende");
    expect(settingsSource).toContain("Ta bort och välj området");
    expect(settingsSource).toContain("verifierade geografiska gräns");
  });

  test("beskriver avstånd som punkt-specifikt när boundaryområden finns", () => {
    expect(settingsSource).toContain("Avstånd runt adresser och platser");
    expect(settingsSource).toContain(
      "Gäller punktbaserade val som adresser. Boundaryområden söks inom sin egen gräns.",
    );
    expect(settingsSource).toContain("boundaryCount");
  });
});
