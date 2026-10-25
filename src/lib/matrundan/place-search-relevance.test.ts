import { expect, test } from "bun:test";
import { searchGeoapifyCatalogue } from "./geoapify-catalogue-search";
import { sourceSearchEvidence, relevantSourceSearchEvidence } from "./place-search-evidence";
import {
  resolveDiscoverySearchIntent,
  savedPlaceSearchEvidence,
  matchesPlaceSearchIntent,
} from "./place-search-intent";
import { rankNewPlaceSearchPage, mergePlaceSearchPages } from "./place-search-pagination";
import { normalizePlaceFeature } from "./geoapify-normalize";
import { adapter, type SearchInput } from "./testing/geoapify-adapter-fixture";

const url = new URL(
  "https://api.geoapify.com/v2/places?filter=circle:18,59,5000&bias=proximity:18,59",
);
const feature = (
  id: string,
  cuisine: string,
  category = "catering.restaurant",
  osmId?: number,
) => ({
  properties: {
    place_id: id,
    name: id,
    lat: 59,
    lon: 18,
    categories: [category],
    datasource: { raw: { cuisine, ...(osmId ? { osm_type: "node", osm_id: osmId } : {}) } },
  },
});

test.each([
  ["Pasta", "italian"],
  ["Falafel", "lebanese"],
  ["Kebab", "turkish"],
  ["Grillat/BBQ", "steak_house"],
  ["Tacos", "mexican"],
  ["Tacos", "tex-mex"],
  ["Japanskt", "sushi"],
  ["Japanskt", "ramen"],
  ["Nudlar", "ramen"],
])("%s får sannolika %s-kandidater utan att anta nya platsattribut", (query, cuisine) => {
  const intent = resolveDiscoverySearchIntent(query);
  const f = feature("oberoende namn", cuisine);
  expect(sourceSearchEvidence(f, intent)).toBeUndefined();
  expect(relevantSourceSearchEvidence(f, intent)?.kind).toBe("association");
  const place = normalizePlaceFeature(f)!;
  // Some legacy display labels collapse narrower kitchens. Preserve the raw
  // query evidence before normalization rather than infer from that old label.
  place.searchEvidence = relevantSourceSearchEvidence(f, intent);
  expect(matchesPlaceSearchIntent(place, intent)).toBe(true);
  expect(savedPlaceSearchEvidence(place, intent)?.kind).toBe("association");
  expect(place.cuisines).not.toContain(query);
  expect(JSON.parse(place.raw).cuisine).toBe(cuisine);
});

test.each([
  ["Ramen", "japanese"],
  ["Sushi", "japanese"],
  ["Pizza", "italian"],
  ["Falafel", "persian"],
  ["Falafel", "turkish"],
  ["Falafel", "arab"],
  ["Sallad", "italian"],
  ["Sallad", "greek"],
  ["Sallad", "sandwich"],
  ["Grillat/BBQ", "american"],
  ["Fisk och skaldjur", "japanese"],
])("%s breddas inte genom svag %s-association eller transitiva samband", (query, cuisine) => {
  const intent = resolveDiscoverySearchIntent(query);
  const f = feature("Pasta Sushi Sallad", cuisine);
  expect(relevantSourceSearchEvidence(f, intent)).toBeUndefined();
  expect(matchesPlaceSearchIntent(normalizePlaceFeature(f)!, intent)).toBe(false);
});

test("Pasta behåller sin enda exakta råström även när italienska kandidater fyller en sida", async () => {
  const calls: string[] = [];
  const page = await searchGeoapifyCatalogue({
    url,
    intent: resolveDiscoverySearchIntent("Pasta"),
    limit: 20,
    fetch: async (u) => {
      const category = u.searchParams.get("categories")!;
      calls.push(category);
      return {
        features:
          category === "catering.restaurant.italian"
            ? Array.from({ length: 20 }, (_, i) => feature(`italian-${i}`, "italian"))
            : [feature("exakt-pasta", "pasta")],
      };
    },
  });
  expect(calls).toEqual(["catering.restaurant.italian", "catering.restaurant"]);
  expect(page.results[0].externalId).toBe("exakt-pasta");
  expect(page.results).toHaveLength(21);
});

test("skyddad exakt hämtning, tioheuristik och uppskjuten metadata fortsätter på nästa klick", async () => {
  const calls: string[] = [];
  const fetch = async (u: URL) => {
    const category = u.searchParams.get("categories")!;
    calls.push(category);
    return {
      features:
        category === "catering.restaurant.barbecue"
          ? Array.from({ length: 10 }, (_, i) => feature(`exact-${i}`, "barbecue", category))
          : category === "catering.restaurant.steak_house"
            ? [feature("steak", "steak_house", category)]
            : [feature("metadata-only", "grill", "catering.fast_food")],
    };
  };
  const first = await searchGeoapifyCatalogue({
    url,
    intent: resolveDiscoverySearchIntent("Grillat/BBQ"),
    limit: 20,
    fetch,
  });
  expect(calls).toEqual(["catering.restaurant.barbecue", "catering.restaurant.steak_house"]);
  expect(first.cursor.metadata).toBe(0);
  expect(first.cursor.metadataDone).toBe(false);
  expect(first.cursor.nextStream).toBe("metadata");
  expect(first.results.at(-1)?.externalId).toBe("steak");
  const next = await searchGeoapifyCatalogue({
    url,
    intent: resolveDiscoverySearchIntent("Grillat/BBQ"),
    limit: 20,
    fetch,
    cursor: first.cursor,
  });
  expect(calls[2]).toBe("catering.fast_food");
  expect(next.results.some((p) => p.externalId === "metadata-only")).toBe(true);
});

test("starkare sökbevis uppgraderas utan ny identitet eller hopp i redan visad lista", () => {
  const related = {
    ...normalizePlaceFeature(feature("same", "italian"))!,
    searchEvidence: { intentId: "specialty:pasta", kind: "association" as const },
    distanceKm: 0.1,
  };
  const exact = {
    ...related,
    searchEvidence: { intentId: "specialty:pasta", kind: "metadata" as const },
    distanceKm: 1,
  };
  expect(
    rankNewPlaceSearchPage([related, { ...exact, externalId: "other" }], "")[0].externalId,
  ).toBe("other");
  const merged = mergePlaceSearchPages([related], [exact]);
  expect(merged).toHaveLength(1);
  expect(merged[0].externalId).toBe("same");
  expect(merged[0].searchEvidence?.kind).toBe("metadata");
  expect(merged[0].distanceKm).toBe(0.1);
});

test("tre ändliga strömmar över fem kalla områden uttöms rättvist med 5/20 utan upprepade sidor", async () => {
  const input: SearchInput = {
    text: "Grillat/BBQ",
    selectedFilter: { kind: "food-tag", id: "specialty:grill" },
    radiusKm: 5,
    searchPhase: "primary",
    centers: Array.from({ length: 5 }, (_, i) => ({
      id: `a${i}`,
      label: `Område ${i}`,
      lat: 59 + i / 100,
      lng: 18,
    })),
  };
  const urls = new Set<string>();
  const fixture = (u: URL) => {
    expect(urls.has(u.toString())).toBe(false);
    urls.add(u.toString());
    const category = u.searchParams.get("categories")!;
    const total =
      category === "catering.restaurant.barbecue" || category === "catering.restaurant.steak_house"
        ? 61
        : category === "catering.fast_food"
          ? 101
          : 0;
    const offset = Number(u.searchParams.get("offset") ?? 0);
    return {
      features: Array.from(
        { length: Math.max(0, Math.min(Number(u.searchParams.get("limit")), total - offset)) },
        (_, i) =>
          feature(
            `${u.searchParams.get("filter")}-${category}-${offset + i}`,
            category.endsWith("steak_house") ? "steak_house" : "grill",
            category,
          ),
      ),
    };
  };
  const context = { supabase: { rpc: async () => ({ data: [], error: null }) } };
  let page = await adapter(fixture, context).discovery(input);
  const ids = new Set(page.results.map((p) => p.externalId));
  let clicks = 0;
  while (page.hasMore && clicks++ < 25) {
    page = await adapter(fixture, context).discovery({
      ...input,
      streamCursors: page.streamCursors,
      areaOffsets: page.areaOffsets,
      exhaustedAreaIds: page.exhaustedAreaIds,
      providerRequestLimit: 5,
      providerCreditLimit: 20,
    });
    expect(page.budgetUsage.requests).toBeLessThanOrEqual(5);
    expect(page.budgetUsage.reservedCredits).toBeLessThanOrEqual(20);
    expect(page.failedAreaIds).toEqual([]);
    page.results.forEach((p) => ids.add(p.externalId));
  }
  expect(page.hasMore).toBe(false);
  expect(ids.size).toBe(5 * (61 + 61 + 101));
});

test.each([false, true])(
  "kanoniska exakta träffar skyddas och gruppen består vid kompletteringsfel=%s",
  async (failRelated) => {
    const canonical = {
      placeId: "38920000-0000-4000-8000-000000000001",
      name: "Exakt pasta",
      category: "restaurang",
      cuisines: ["Pasta"],
      address: "Testgatan 1",
      area: null,
      city: "Stockholm",
      lat: 59,
      lng: 18,
      groupStatus: "not_linked",
      version: "a".repeat(32),
    };
    const filters: string[][] = [];
    const a = adapter(() => ({ features: [] }), {
      supabase: {
        rpc: async (name, args) => {
          expect(args._group_id).toBe("38910000-0000-4000-8000-000000000001");
          if (name !== "search_canonical_places_v1") return { data: [], error: null };
          const cuisines = args._cuisines as string[];
          filters.push(cuisines);
          if (cuisines.includes("Italienskt")) {
            if (failRelated) throw new Error("related unavailable");
            return {
              data: [
                {
                  ...canonical,
                  placeId: "38920000-0000-4000-8000-000000000002",
                  name: "Italiensk kandidat",
                  cuisines: ["Italienskt"],
                },
              ],
              error: null,
            };
          }
          return { data: [canonical], error: null };
        },
      },
    });
    const page = await a.discovery({
      text: "Pasta",
      selectedFilter: { kind: "food-tag", id: "specialty:pasta" },
      radiusKm: 5,
      searchPhase: "primary",
      centers: [{ id: "a", label: "Stockholm", lat: 59, lng: 18 }],
    });
    expect(filters).toHaveLength(2);
    expect(filters[0]).not.toContain("Italienskt");
    expect(page.results.find((p) => p.name === "Exakt pasta")?.cuisines).toEqual(["Pasta"]);
    expect(page.canonicalIncomplete).toBe(failRelated);
    if (!failRelated) {
      const related = page.results.find((p) => p.name === "Italiensk kandidat")!;
      expect(related.cuisines).toEqual(["Italienskt"]);
      expect(related.searchEvidence?.kind).toBe("association");
    }
  },
);
