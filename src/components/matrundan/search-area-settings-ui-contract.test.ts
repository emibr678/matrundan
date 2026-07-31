import { describe, expect, test } from "bun:test";

const settingsSource = await Bun.file(
  "src/components/matrundan/GroupSettingsSectionV16.tsx",
).text();
const searchSource = await Bun.file("src/components/matrundan/SearchAreaControlsV16.tsx").text();

describe("sökområden i gruppinställningar", () => {
  test("använder samma autocomplete-till-pill-mönster som sökdialogen", () => {
    expect(settingsSource).toContain("<GeoapifyLocationInput");
    expect(settingsSource).toContain("onSelect={addArea}");
    expect(settingsSource).toContain("<SearchAreaPill");
    expect(settingsSource).toContain("Spara ändringar");
    expect(settingsSource).not.toContain("<Plus");
    expect(settingsSource).not.toContain("<Trash2");
    expect(searchSource).toContain("<SearchAreaPill");
  });

  test("förklarar hur äldre kommun- och regionval ska bytas", () => {
    expect(settingsSource).toContain("isBroadAdministrativeSearchArea(undefined, area.label)");
    expect(settingsSource).toContain("motsvarar bara en punkt på");
    expect(settingsSource).toContain("Ta bort det och välj en ort, stadsdel eller adress");
  });
});
