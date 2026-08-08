import { describe, expect, test } from "bun:test";

const discoverySource = await Bun.file("src/components/matrundan/PlaceDiscoveryV16.tsx").text();
const areaControlsSource = await Bun.file(
  "src/components/matrundan/SearchAreaControlsV16.tsx",
).text();

describe("Lägg till ställens sökflöde", () => {
  test("etablerar Sök i före Sök matställen", () => {
    const searchAreaIndex = discoverySource.indexOf("<SearchAreaControlsV16");
    const placeSearchIndex = discoverySource.indexOf("Sök matställen");

    expect(searchAreaIndex).toBeGreaterThanOrEqual(0);
    expect(placeSearchIndex).toBeGreaterThan(searchAreaIndex);
    expect(discoverySource).toContain("Sök i");
  });

  test("visar geografifältet direkt under rubriken och pills därunder", () => {
    const headingIndex = areaControlsSource.indexOf("{heading}");
    const fieldIndex = areaControlsSource.indexOf("<SearchAreaField");
    const pillsIndex = areaControlsSource.indexOf("<SelectedAreas");

    expect(headingIndex).toBeGreaterThanOrEqual(0);
    expect(fieldIndex).toBeGreaterThan(headingIndex);
    expect(pillsIndex).toBeGreaterThan(fieldIndex);
    expect(areaControlsSource).not.toContain("Ändringar här gäller bara den här sökningen.");
    expect(areaControlsSource).not.toContain("Lägg till område eller adress</span>");
  });

  test("använder sökavståndscopy och beskrivande aria-label", () => {
    expect(areaControlsSource).toContain("Sök inom ${value} km");
    expect(areaControlsSource).toContain("Sökavstånd runt valda platser");
    expect(areaControlsSource).not.toContain("Avstånd ${value} km");
  });

  test("behåller resultatytan vid omladdning och visar diskret status", () => {
    expect(discoverySource).toContain("isReloadingResults");
    expect(discoverySource).toContain("isInitialSearchLoading");
    expect(discoverySource).toContain('aria-live="polite"');
    expect(discoverySource).toContain("Söker…");
    expect(discoverySource).not.toContain("loading || hiddenLoading ?");
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

  test("paginerar resultat med Visar-copy och Visa fler", () => {
    expect(discoverySource).toContain("RESULT_PAGE_SIZE = 20");
    expect(discoverySource).toContain("Visar {actionableResultCount}");
    expect(discoverySource).toContain("Visa fler");
    expect(discoverySource).toContain("Laddar fler…");
    expect(discoverySource).toContain("displayLimit");
    expect(discoverySource).toContain("hasMore");
    expect(discoverySource).toContain("nextOffset");
  });
});

describe("Fyllnad till hela listsidor", () => {
  test("läser vidare tills sidan har 20 handlingsbara träffar", () => {
    expect(discoverySource).toContain("MAX_PROVIDER_PAGES_PER_ACTION = 5");
    expect(discoverySource).toContain("fillProviderPages");
    expect(discoverySource).toContain("targetActionable");
    expect(discoverySource).toContain("countActionableSuggestions");
    expect(discoverySource).toContain("actionableSliceIndex");
    expect(discoverySource).toContain("isStale");
  });

  test("räknar Visar-copy på faktiskt visade handlingsbara träffar", () => {
    expect(discoverySource).toContain("Visar {actionableResultCount}");
    expect(discoverySource).toContain("shownActionableCount + RESULT_PAGE_SIZE");
  });

  test("startar inte sökningen förrän gömda förslag är inlästa", () => {
    const effectIndex = discoverySource.indexOf("React.useEffect(() => {\n    // Vänta in gömda");
    expect(effectIndex).toBeGreaterThanOrEqual(0);

    const effectSource = discoverySource.slice(effectIndex);
    const gateIndex = effectSource.indexOf("if (hiddenLoading) return;");
    const skipIndex = effectSource.indexOf("if (skipInitialSearchRef.current)");

    expect(gateIndex).toBeGreaterThanOrEqual(0);
    // Gaten måste ligga före snapshot-skippen så en återställd snapshot bara
    // skippar den första sökningen efter att hidden-data är känd.
    expect(skipIndex).toBeGreaterThan(gateIndex);

    const dependencyIndex = effectSource.indexOf(
      "[activeAreas, fillProviderPages, hiddenLoading, isLive, query, radiusKm, retry]",
    );
    expect(dependencyIndex).toBeGreaterThan(skipIndex);
  });
});

const dialogSource = await Bun.file("src/components/matrundan/AddPlaceDialogImplV16.tsx").text();

describe("Flikväxlaren i Lägg till matställe", () => {
  test("byter flik bara vid egen pekning eller tangentbord", () => {
    expect(dialogSource).toContain("onPointerDown");
    expect(dialogSource).toContain("pointerTabRef");
    expect(dialogSource).toContain("event.detail === 0");
  });
});
