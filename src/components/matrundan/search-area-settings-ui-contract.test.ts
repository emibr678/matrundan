import { describe, expect, test } from "bun:test";

const settingsSource = await Bun.file(
  "src/components/matrundan/GroupSettingsSectionV16.tsx",
).text();
const searchSource = await Bun.file("src/components/matrundan/SearchAreaControlsV16.tsx").text();
const pillSource = await Bun.file("src/components/matrundan/SearchAreaPill.tsx").text();

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

  test("delar kompakta pills och döljer tilläggsfältet när fem områden är valda", () => {
    expect(pillSource).toContain('className="flex h-8');
    expect(pillSource).toContain("after:-inset-1.5");
    expect(settingsSource).toContain("{atAreaLimit ? (");
    expect(settingsSource).toContain("Fem områden är valda. Ta bort ett för att lägga till ett annat.");
    expect(settingsSource).not.toContain("Ta bort ett område för att lägga till ett nytt");
  });

  test("förklarar hur äldre kommun- och regionval ska bytas", () => {
    expect(settingsSource).toContain("isBroadAdministrativeSearchArea(undefined, area.label)");
    expect(settingsSource).toContain("motsvarar bara en punkt på");
    expect(settingsSource).toContain("Ta bort det och välj en ort, stadsdel eller adress");
  });
});
