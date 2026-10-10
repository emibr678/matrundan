import { describe, expect, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import type { MultiAreaSearchResponse } from "./geoapify.functions";
import { distanceKm } from "./manual-place-source-linking";
import { presentPlaceSearchResults, type CanonicalPlaceCandidate } from "./place-discovery";
import type { PlaceSuggestion } from "./places-provider";

const stockholm = { id: "stockholm", label: "Stockholm", lat: 59.3251172, lng: 18.0710935 };
const oxLan = { lat: 59.3409825, lng: 18.0587631 };
const centerBias = `proximity:${stockholm.lng},${stockholm.lat}`;
const oxBias = `proximity:${oxLan.lng},${oxLan.lat}`;
const area = { ...stockholm, searchMode: "point" as const };

function place(id = "places-ox", name = "Ox Lan", extra: Record<string, unknown> = {}) {
  return {
    properties: {
      place_id: id,
      name,
      lat: oxLan.lat,
      lon: oxLan.lng,
      distance: 0,
      street: "Sveavägen",
      housenumber: "86",
      city: "Stockholm",
      categories: ["catering.restaurant", "catering.restaurant.chinese"],
      datasource: { raw: { cuisine: "chinese", osm_type: "node", osm_id: 12345 } },
      ...extra,
    },
  };
}

function seed() {
  return place("geocoding-only-id", "Ox Lan", {
    result_type: "amenity",
    category: "catering.restaurant",
    categories: [],
    datasource: { raw: { cuisine: "coffee" } },
  });
}

type FixtureResponse = { features: unknown[]; status?: number };
type SearchInput = {
  text: string;
  centers: Array<typeof stockholm & { searchMode?: "point" | "boundary"; placeId?: string }>;
  radiusKm: 1 | 2 | 5 | 25 | null;
  limit?: number;
  offset?: number;
  areaOffsets?: Record<string, number>;
  exhaustedAreaIds?: string[];
  searchPhase?: "primary" | "recovery" | "complete";
  providerRequestLimit?: number;
  providerCreditLimit?: number;
};

/** Execute the actual server handlers with only framework/auth and HTTP stubs.
 * Each VM has its own provider caches and fixture-only environment; no global
 * mock.module or process.env mutation leaks into other tests. Auth is covered
 * by its own middleware tests, not by this provider contract suite.
 */
type FixtureContext = {
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>;
  };
};

function adapter(
  response: (url: URL) => FixtureResponse | Promise<FixtureResponse>,
  context?: FixtureContext,
) {
  const calls: URL[] = [];
  const modules = new Map<string, { exports: Record<string, unknown> }>();
  function load(file: string): Record<string, unknown> {
    const cached = modules.get(file);
    if (cached) return cached.exports;
    const module = { exports: {} as Record<string, unknown> };
    modules.set(file, module);
    const source = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(
      source,
      {
        module,
        exports: module.exports,
        URL,
        AbortController,
        DOMException,
        performance,
        setTimeout,
        clearTimeout,
        process: { env: { GEOAPIFY_API_KEY: "fixture-only-secret" } },
        fetch: async (input: URL) => {
          const url = new URL(input);
          const safe = new URL(url);
          safe.searchParams.delete("apiKey");
          calls.push(safe);
          const result = await response(url);
          const status = result.status ?? 200;
          return { status, ok: status === 200, json: async () => ({ features: result.features }) };
        },
        require: (specifier: string) => {
          if (specifier === "node:async_hooks") return { AsyncLocalStorage };
          if (specifier === "zod") return { z };
          if (specifier === "@/integrations/supabase/auth-middleware")
            return { requireSupabaseAuth: {} };
          if (specifier === "@tanstack/react-start")
            return {
              createServerFn: () => {
                let parse = (input: unknown) => input;
                const builder = {
                  middleware: () => builder,
                  validator: (validate: typeof parse) => {
                    parse = validate;
                    return builder;
                  },
                  handler:
                    (handle: (args: { data: unknown; context?: FixtureContext }) => unknown) =>
                    (args: { data: unknown }) =>
                      handle({ data: parse(args.data), context }),
                };
                return builder;
              },
            };
          if (!specifier.startsWith("."))
            throw new Error(`Unexpected test dependency: ${specifier}`);
          return load(resolve(dirname(file), specifier + ".ts"));
        },
      },
      { filename: file },
    );
    return module.exports;
  }
  const functions = load(resolve(import.meta.dir, "geoapify.functions.ts"));
  return {
    calls,
    multi: (input: SearchInput) =>
      (
        functions.geoapifySearchPlacesMulti as (args: {
          data: SearchInput;
        }) => Promise<MultiAreaSearchResponse>
      )({ data: input }),
    discovery: (input: SearchInput) =>
      (
        functions.searchPlaceDiscovery as (args: {
          data: SearchInput & { groupId: string };
        }) => Promise<
          Omit<MultiAreaSearchResponse, "results"> & {
            results: PlaceSuggestion[];
            canConfirm: boolean;
            budgetUsage: { requests: number; reservedCredits: number; limited: boolean };
          }
        >
      )({ data: { ...input, groupId: "38910000-0000-4000-8000-000000000001" } }),
  };
}

const basicInput: SearchInput = { text: "Ox lan", centers: [area], radiusKm: 5 };

function oxProvider(url: URL): FixtureResponse {
  if (url.pathname === "/v1/geocode/search") return { features: [seed()] };
  return { features: url.searchParams.get("bias") === centerBias ? [] : [place()] };
}

describe("namn-fallback genom verklig serveradapter (#464)", () => {
  test("återfår Places-ID, matmetadata och avstånd från ursprungligt centrum", async () => {
    const a = adapter(oxProvider);
    const page = await a.multi(basicInput);
    expect(page.results).toHaveLength(1);
    const result = page.results[0];
    expect(result.externalId).toBe("places-ox");
    expect(result.category).toBe("restaurang");
    expect(result.cuisines).toContain("Kinesiskt");
    expect(result.distanceKm).toBeCloseTo(distanceKm(stockholm, oxLan), 6);
    expect(result.distanceKm).toBeGreaterThan(1);
    expect(JSON.parse(result.raw).providerPlaceId).toBe("places-ox");
    expect(JSON.stringify(page)).not.toContain("geocoding-only-id");
    expect(JSON.stringify(page)).not.toContain("fixture-only-secret");
    expect(page.hasMore).toBe(false);
    expect(page.nextOffset).toBe(20);
    expect(a.calls.map((c) => c.pathname)).toEqual([
      "/v2/places",
      "/v1/geocode/search",
      "/v2/places",
    ]);
  });

  test("serverns normala paginering fortsätter vid samma ankare utan att börja om", async () => {
    const a = adapter((url) => {
      if (url.pathname === "/v1/geocode/search") return { features: [seed()] };
      if (url.searchParams.get("bias") === centerBias) return { features: [] };
      return {
        features:
          url.searchParams.get("offset") === "20"
            ? [place("places-next")]
            : Array.from({ length: 20 }, (_, i) => place(`places-${i}`, `Ox Lan ${i}`)),
      };
    });
    const first = await a.multi(basicInput);
    expect(first.results).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    expect(first.nextOffset).toBe(20);
    const next = await a.multi({ ...basicInput, offset: first.nextOffset });
    expect(next.results.map((p) => p.externalId)).toEqual(["places-next"]);
    expect(next.hasMore).toBe(false);
    expect(next.nextOffset).toBe(40);
    expect(a.calls).toHaveLength(4);
    expect(a.calls[3].searchParams.get("offset")).toBe("20");
    expect(a.calls[3].searchParams.get("bias")).toBe(oxBias);
    await a.multi(basicInput);
    expect(a.calls).toHaveLength(4);
  });

  test("behåller primär ström när bara dess fortsättningssida är tom", async () => {
    const a = adapter((url) => ({ features: url.searchParams.has("offset") ? [] : [place()] }));
    await a.multi(basicInput);
    const next = await a.multi({ ...basicInput, offset: 20 });
    expect(next.results).toHaveLength(0);
    expect(a.calls.map((c) => c.pathname)).toEqual(["/v2/places", "/v2/places"]);
    expect(a.calls[1].searchParams.get("bias")).toBe(centerBias);
  });

  test("full avvisad primärsida kan följas av en relevant primärträff", async () => {
    const a = adapter((url) => ({
      features: url.searchParams.has("offset")
        ? [place()]
        : Array.from({ length: 20 }, (_, i) => place(`other-${i}`, "Annan restaurang")),
    }));
    const first = await a.multi(basicInput);
    expect(first.results).toHaveLength(0);
    expect(first.hasMore).toBe(true);
    const next = await a.multi({ ...basicInput, offset: first.nextOffset });
    expect(next.results[0].externalId).toBe("places-ox");
    expect(a.calls.every((c) => c.pathname === "/v2/places")).toBe(true);
  });

  test("punkt + boundary dedupliceras på Places-ID och punktavståndet vinner", async () => {
    const a = adapter(oxProvider);
    const boundary = {
      ...area,
      id: "boundary",
      label: "Stockholms kommun",
      searchMode: "boundary" as const,
      placeId: "verified-boundary",
    };
    const page = await a.multi({ ...basicInput, centers: [boundary, area] });
    expect(page.results).toHaveLength(1);
    expect(page.results[0].matchingAreaLabels).toEqual(["Stockholms kommun", "Stockholm"]);
    expect(page.results[0].nearestAreaLabel).toBe("Stockholm");
    expect(page.results[0].distanceKm).toBeCloseTo(distanceKm(stockholm, oxLan), 6);
    const boundaryCalls = a.calls.filter(
      (c) => c.searchParams.get("filter") === "place:verified-boundary",
    );
    expect(boundaryCalls).toHaveLength(3);
  });

  test("boundary-only-träff visar inte avstånd till sökankaret", async () => {
    const a = adapter(oxProvider);
    const boundary = { ...area, searchMode: "boundary" as const, placeId: "verified-boundary" };
    const page = await a.multi({ ...basicInput, centers: [boundary] });
    expect(page.results[0].distanceKm).toBeUndefined();
  });

  test("saknade Places-koordinater får inte visa ankarets nollavstånd", async () => {
    const a = adapter((url) => {
      if (url.pathname === "/v1/geocode/search") return { features: [seed()] };
      return {
        features:
          url.searchParams.get("bias") === centerBias
            ? []
            : [place("places-ox", "Ox Lan", { lat: undefined })],
      };
    });
    const page = await a.multi(basicInput);
    expect(page.results[0].externalId).toBe("places-ox");
    expect(page.results[0].distanceKm).toBeUndefined();
  });

  test("samtidiga olika namn blandar inte cache eller avslutningsordning", async () => {
    let releaseOx: () => void = () => {};
    const delayedOx = new Promise<void>((resolve) => {
      releaseOx = resolve;
    });
    const a = adapter(async (url) => {
      const query = url.searchParams.get("name") ?? "";
      const bread = query === "Bröd & Salt";
      if (url.pathname === "/v1/geocode/search") {
        if (!bread) await delayedOx;
        return {
          features: [bread ? { properties: { ...seed().properties, name: query } } : seed()],
        };
      }
      return {
        features:
          url.searchParams.get("bias") === centerBias
            ? []
            : [place(bread ? "places-bread" : "places-ox", bread ? query : "Ox Lan")],
      };
    });
    const ox = a.multi(basicInput);
    const bread = await a.multi({ ...basicInput, text: "Bröd & Salt" });
    expect(bread.results.map((p) => p.externalId)).toEqual(["places-bread"]);
    releaseOx();
    expect((await ox).results.map((p) => p.externalId)).toEqual(["places-ox"]);
  });

  test("två punktområden delar identitet men behåller närmaste riktiga avstånd", async () => {
    const a = adapter(oxProvider);
    const nearby = { ...area, id: "near", label: "Sveavägen", ...oxLan };
    const page = await a.multi({ ...basicInput, centers: [area, nearby] });
    expect(page.results).toHaveLength(1);
    expect(page.results[0].nearestAreaLabel).toBe("Sveavägen");
    expect(page.results[0].distanceKm).toBe(0);
    expect(page.results[0].matchingAreaLabels).toEqual(["Stockholm", "Sveavägen"]);
  });

  test("radiegräns och verkligt okänt namn ger noll utan Places-följdanrop", async () => {
    const a = adapter(() => ({ features: [] }));
    expect((await a.multi({ ...basicInput, radiusKm: 1 })).results).toHaveLength(0);
    expect(
      (await a.multi({ ...basicInput, text: "Matrundan464zzIngenTräff" })).results,
    ).toHaveLength(0);
    expect(a.calls).toHaveLength(4);
    expect(a.calls[1].searchParams.get("filter")).toBe("circle:18.0710935,59.3251172,1000");
  });

  test("kategori och kök behåller sin primära providersemantik", async () => {
    const a = adapter(() => ({ features: [] }));
    for (const text of ["", "restaurang", "café", "sushi", "kinesiskt", "Pasta", "Ox"])
      await a.multi({ ...basicInput, text });
    expect(a.calls.every((c) => c.pathname === "/v2/places" && !c.searchParams.has("name"))).toBe(
      true,
    );
    expect(a.calls[3].searchParams.get("categories")).toBe("catering.restaurant.sushi");
  });

  test("fallbackens providerfel bevarar partial-failure-kontraktet", async () => {
    const a = adapter((url) => {
      if (url.pathname === "/v1/geocode/search") return { features: [], status: 429 };
      return { features: url.searchParams.get("bias") === centerBias ? [] : [place()] };
    });
    const nearby = { ...area, id: "near", label: "Sveavägen", ...oxLan };
    const page = await a.multi({ ...basicInput, centers: [area, nearby] });
    expect(page.results[0].externalId).toBe("places-ox");
    expect(page.failedAreaLabels).toEqual(["Stockholm"]);
    await expect(a.multi(basicInput)).rejects.toThrow("GEOAPIFY_RATE_LIMIT");
  });
});

describe("namn-fallback tillsammans med kanonisk discovery (#389 + #464)", () => {
  const canonical: CanonicalPlaceCandidate = {
    placeId: "38920000-0000-4000-8000-000000000001",
    name: "Ox Lan",
    category: "restaurang",
    cuisines: ["Kinesiskt"],
    address: "Sveavägen 86",
    city: "Stockholm",
    area: null,
    ...oxLan,
    groupStatus: "not_linked",
    version: "a".repeat(32),
  };

  function discoveryContext(canConfirm: boolean, unambiguous: boolean) {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const context: FixtureContext = {
      supabase: {
        rpc: async (name, args) => {
          calls.push({ name, args });
          if (name === "get_place_discovery_context_v1")
            return { data: { canConfirm }, error: null };
          if (name === "search_canonical_places_v1")
            return {
              data: [{ ...canonical, sourceGroupId: "private-fixture", visits: ["private"] }],
              error: null,
            };
          if (name === "match_place_discovery_candidates_v1")
            return {
              data: [
                {
                  providerPlaceId: "places-ox",
                  providerVersion: "b".repeat(32),
                  knownPlace: null,
                  candidates: [
                    {
                      ...canonical,
                      matchKind: "strong",
                      distanceKm: 0,
                      canConfirmSource: unambiguous,
                    },
                  ],
                  reviewRequired: true,
                  identityConflict: false,
                },
              ],
              error: null,
            };
          throw new Error(`Unexpected RPC ${name}`);
        },
      },
    };
    return { context, calls };
  }

  for (const canConfirm of [true, false]) {
    test(`återhämtad Places-identitet går genom discovery och förenas säkert för ${canConfirm ? "admin" : "medlem"}`, async () => {
      const db = discoveryContext(canConfirm, true);
      const a = adapter(oxProvider, db.context);
      const page = await a.discovery(basicInput);
      expect(page.canConfirm).toBe(canConfirm);
      expect(page.results).toHaveLength(2);
      const shown = presentPlaceSearchResults(page.results);
      expect(shown).toHaveLength(1);
      expect(shown[0].kind).toBe("provider");
      expect(shown[0].externalId).toBe("places-ox");
      expect(shown[0].identity?.candidates[0].placeId).toBe(canonical.placeId);
      expect(shown[0].distanceKm).toBeCloseTo(distanceKm(stockholm, oxLan), 6);
      const matched = db.calls.find((c) => c.name === "match_place_discovery_candidates_v1");
      expect(matched?.args._items).toMatchObject([
        { externalId: "places-ox", category: "restaurang" },
      ]);
      expect(JSON.stringify(page)).not.toContain("geocoding-only-id");
      expect(JSON.stringify(page)).not.toContain("private-fixture");
      expect(JSON.stringify(page)).not.toContain("visits");
      expect(page.results.every((r) => !("raw" in r))).toBe(true);
      await a.discovery(basicInput);
      expect(a.calls).toHaveLength(3);
      expect(
        db.calls.every((c) => c.args._group_id === "38910000-0000-4000-8000-000000000001"),
      ).toBe(true);
    });
  }

  test("osäker återhämtad identitet behåller båda alternativen för granskning", async () => {
    const db = discoveryContext(true, false);
    const page = await adapter(oxProvider, db.context).discovery(basicInput);
    expect(presentPlaceSearchResults(page.results)).toHaveLength(2);
    expect(page.results.find((r) => r.kind === "provider")?.identity?.reviewRequired).toBe(true);
  });

  test("intern namnträff breddar inte extern fallback utanför 1 km", async () => {
    const db = discoveryContext(true, true);
    const a = adapter(() => ({ features: [] }), db.context);
    const page = await a.discovery({ ...basicInput, radiusKm: 1 });
    expect(page.results).toHaveLength(1);
    expect(page.results[0].kind).toBe("canonical");
    expect(a.calls.map((c) => c.pathname)).toEqual(["/v2/places", "/v1/geocode/search"]);
    expect(
      a.calls.every(
        (c) => c.searchParams.get("filter") === `circle:${stockholm.lng},${stockholm.lat},1000`,
      ),
    ).toBe(true);
    expect(db.calls.some((c) => c.name === "match_place_discovery_candidates_v1")).toBe(false);
  });
});

test("multi-area continuation skips exhausted areas and preserves independent offsets", async () => {
  const other = { ...area, id: "other", label: "Norr", lat: 59.4 };
  const input: SearchInput = { text: "", centers: [area, other], radiusKm: 1 };
  const a = adapter((url) => {
    if (url.searchParams.get("filter")?.includes("59.4")) {
      return { features: [place("other-place", "Norrs restaurang")] };
    }
    return {
      features:
        url.searchParams.get("offset") === "20"
          ? [place("later-place", "Senare restaurang")]
          : Array.from({ length: 20 }, (_, i) => place("first-" + i, "Restaurang " + i)),
    };
  });
  const first = await a.multi(input);
  expect(first.results).toHaveLength(21);
  expect(first.exhaustedAreaIds).toContain("other");
  expect(first.areaOffsets[area.id]).toBe(20);
  const second = await a.multi({
    ...input,
    areaOffsets: first.areaOffsets,
    exhaustedAreaIds: first.exhaustedAreaIds,
  });
  expect(second.results.map((row) => row.externalId)).toEqual(["later-place"]);
  expect(second.exhaustedAreaIds).toEqual(expect.arrayContaining(["other", area.id]));
  expect(a.calls.filter((url) => url.searchParams.get("filter")?.includes("59.4"))).toHaveLength(1);
  expect(
    a.calls.find((url) => url.searchParams.get("offset") === "20")?.searchParams.get("filter"),
  ).toBe("circle:18.0710935,59.3251172,1000");
});

describe("begränsad namnsökning utan onödiga geocodingkedjor (#465)", () => {
  const context: FixtureContext = {
    supabase: {
      rpc: async (name) => {
        if (name === "get_place_discovery_context_v1")
          return { data: { canConfirm: true }, error: null };
        if (name === "search_canonical_places_v1" || name === "search_canonical_name_candidates_v1")
          return { data: [], error: null };
        if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
        throw new Error("Unexpected RPC: " + name);
      },
    },
  };

  test("prefixsökning används som reserv när Geocoding saknar kandidater", async () => {
    const a = adapter((url) => {
      if (url.pathname === "/v1/geocode/search") return { features: [] };
      return {
        features: url.searchParams.get("filter")?.endsWith(",2000")
          ? [place("pelikan-nearby", "Pelikan")]
          : [],
      };
    }, context);
    const result = await a.discovery({ text: "Pelikan", centers: [area], radiusKm: 1 });
    const recovered = result.results.find((row) => row.externalId === "pelikan-nearby");
    expect(recovered?.searchAreaGroup).toBe("nearby");
    expect(a.calls.map((url) => url.pathname)).toEqual([
      "/v2/places",
      "/v1/geocode/search",
      "/v2/places",
    ]);
    expect(a.calls[2].searchParams.get("filter")).toBe("circle:18.0710935,59.3251172,2000");
    expect(result.budgetUsage.requests).toBe(3);
  });

  test("stavfelsförslag behåller prefix som reserv efter tom Geocoding", async () => {
    const a = adapter((url) => {
      if (url.pathname === "/v1/geocode/search") return { features: [] };
      return {
        features:
          url.searchParams.get("name") === "pharma" ? [place("pharmarium-typo", "Pharmarium")] : [],
      };
    }, context);
    const result = await a.discovery({ text: "Pharmarim", centers: [area], radiusKm: 5 });
    expect(
      result.results.find((row) => row.externalId === "pharmarium-typo")?.searchMatchType,
    ).toBe("tolerant");
    // One inexpensive Geocoding probe precedes the single prefix request.
    expect(a.calls.filter((url) => url.pathname === "/v1/geocode/search")).toHaveLength(1);
    expect(result.budgetUsage.requests).toBe(3);
  });
});

// Geoapify may omit a known business in its first 2-km Places-name response.
// The expanded area must retain the narrow #464 Geocoding -> Places recovery.
test("Pelikan utanför 1 km återfinns även när utökad primär-Places är tom", async () => {
  const context: FixtureContext = {
    supabase: {
      rpc: async (name) => {
        if (name === "get_place_discovery_context_v1")
          return { data: { canConfirm: true }, error: null };
        if (name === "search_canonical_places_v1" || name === "search_canonical_name_candidates_v1")
          return { data: [], error: null };
        if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
        throw new Error("Unexpected RPC: " + name);
      },
    },
  };
  const a = adapter((url) => {
    if (url.pathname === "/v1/geocode/search") return { features: [seedWithName("Pelikan")] };
    return {
      features:
        url.searchParams.get("filter") === `circle:${oxLan.lng},${oxLan.lat},150`
          ? [place("pelikan-2km", "Pelikan")]
          : [],
    };
  }, context);
  const initial = await a.discovery({
    text: "Pelikan",
    centers: [area],
    radiusKm: 1,
    searchPhase: "primary",
  });
  expect((initial as typeof initial & { pendingRecovery: boolean }).pendingRecovery).toBe(true);
  const result = await a.discovery({
    text: "Pelikan",
    centers: [area],
    radiusKm: 1,
    searchPhase: "recovery",
    providerRequestLimit: 25 - initial.budgetUsage.requests,
    providerCreditLimit: 40 - initial.budgetUsage.reservedCredits,
  });
  expect(result.results.find((place) => place.externalId === "pelikan-2km")?.searchAreaGroup).toBe(
    "nearby",
  );
  expect(
    a.calls.some(
      (url) =>
        url.pathname === "/v1/geocode/search" &&
        url.searchParams.get("text") === "Pelikan" &&
        !url.searchParams.has("filter"),
    ),
  ).toBe(true);
  expect(
    a.calls.some(
      (url) =>
        url.pathname === "/v2/places" &&
        !url.searchParams.has("name") &&
        url.searchParams.get("filter") === `circle:${oxLan.lng},${oxLan.lat},150`,
    ),
  ).toBe(true);
  expect(
    a.calls.some(
      (url) => url.pathname === "/v2/places" && url.searchParams.get("name") === "pelika",
    ),
  ).toBe(false);
  expect(result.budgetUsage.requests + initial.budgetUsage.requests).toBe(3);
  expect(result.budgetUsage.requests + initial.budgetUsage.requests).toBeLessThanOrEqual(25);
  expect(
    result.budgetUsage.reservedCredits + initial.budgetUsage.reservedCredits,
  ).toBeLessThanOrEqual(40);
});

function seedWithName(name: string) {
  return place("pelikan-geocoding-anchor", name, {
    result_type: "amenity",
    category: "catering.restaurant",
    categories: [],
    datasource: { raw: { cuisine: "coffee" } },
  });
}

test("Falloumi hittas på 1,9 km när name+circle saknar kandidater", async () => {
  const context: FixtureContext = {
    supabase: {
      rpc: async (name) => {
        if (name === "get_place_discovery_context_v1")
          return { data: { canConfirm: true }, error: null };
        if (name === "search_canonical_places_v1" || name === "search_canonical_name_candidates_v1")
          return { data: [], error: null };
        if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
        throw new Error("Unexpected RPC: " + name);
      },
    },
  };
  const a = adapter((url) => {
    if (url.pathname === "/v1/geocode/search")
      return {
        features: url.searchParams.get("text") === "Falloumi" ? [seedWithName("Falloumi")] : [],
      };
    if (url.searchParams.get("filter") === `circle:${oxLan.lng},${oxLan.lat},150`)
      return { features: [place("places-falloumi", "Falloumi")] };
    return { features: [] };
  }, context);
  const first = await a.discovery({
    text: "Falloumi",
    centers: [area],
    radiusKm: 1,
    searchPhase: "primary",
  });
  expect(first.results).toHaveLength(0);
  const recovered = await a.discovery({
    text: "Falloumi",
    centers: [area],
    radiusKm: 1,
    searchPhase: "recovery",
    providerRequestLimit: 25 - first.budgetUsage.requests,
    providerCreditLimit: 40 - first.budgetUsage.reservedCredits,
  });
  const found = recovered.results.find((item) => item.externalId === "places-falloumi");
  expect(found?.searchAreaGroup).toBe("nearby");
  expect(found?.distanceKm).toBeGreaterThan(1);
  expect(found?.distanceKm).toBeLessThan(2);
  expect(JSON.stringify(recovered)).not.toContain("pelikan-geocoding-anchor");
  expect(
    a.calls.some((url) => url.pathname === "/v1/geocode/search" && !url.searchParams.has("filter")),
  ).toBe(true);
  expect(
    a.calls.some(
      (url) =>
        url.pathname === "/v2/places" &&
        !url.searchParams.has("name") &&
        url.searchParams.get("filter") === `circle:${oxLan.lng},${oxLan.lat},150`,
    ),
  ).toBe(true);
  expect(first.budgetUsage.requests + recovered.budgetUsage.requests).toBe(3);
  expect(
    a.calls.some(
      (url) => url.pathname === "/v2/places" && url.searchParams.get("name") === "fallou",
    ),
  ).toBe(false);
  expect(first.budgetUsage.requests + recovered.budgetUsage.requests).toBeLessThanOrEqual(25);
  expect(
    first.budgetUsage.reservedCredits + recovered.budgetUsage.reservedCredits,
  ).toBeLessThanOrEqual(40);
});

test("en tät Places-förstasida får en begränsad andra sida för att hitta rätt ställe", async () => {
  const context: FixtureContext = {
    supabase: {
      rpc: async (name) => {
        if (name === "get_place_discovery_context_v1")
          return { data: { canConfirm: true }, error: null };
        if (name === "search_canonical_places_v1" || name === "search_canonical_name_candidates_v1")
          return { data: [], error: null };
        if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
        throw new Error("Unexpected RPC: " + name);
      },
    },
  };
  const a = adapter((url) => {
    if (url.pathname === "/v1/geocode/search") return { features: [seedWithName("Falloumi")] };
    if (url.searchParams.get("filter") !== `circle:${oxLan.lng},${oxLan.lat},150`)
      return { features: [] };
    if (url.searchParams.get("offset") === "20")
      return { features: [place("verified-falloumi-page2", "Falloumi")] };
    return {
      features: Array.from({ length: 20 }, (_, i) => place(`other-venue-${i}`, "Annan restaurang")),
    };
  }, context);
  const first = await a.discovery({
    text: "Falloumi",
    centers: [area],
    radiusKm: 1,
    searchPhase: "primary",
  });
  const recovered = await a.discovery({
    text: "Falloumi",
    centers: [area],
    radiusKm: 1,
    searchPhase: "recovery",
    providerRequestLimit: 25 - first.budgetUsage.requests,
    providerCreditLimit: 40 - first.budgetUsage.reservedCredits,
  });
  expect(recovered.results.map((r) => r.externalId)).toContain("verified-falloumi-page2");
  const verification = a.calls.filter(
    (url) =>
      url.pathname === "/v2/places" &&
      url.searchParams.get("filter") === `circle:${oxLan.lng},${oxLan.lat},150`,
  );
  expect(verification).toHaveLength(2);
  expect(verification[1].searchParams.get("offset")).toBe("20");
  expect(first.budgetUsage.requests + recovered.budgetUsage.requests).toBeLessThanOrEqual(25);
});

test("två relevanta geoankare kan provas när det första saknar Places-matchning", async () => {
  const context: FixtureContext = {
    supabase: {
      rpc: async (name) => {
        if (name === "get_place_discovery_context_v1")
          return { data: { canConfirm: true }, error: null };
        if (name === "search_canonical_places_v1" || name === "search_canonical_name_candidates_v1")
          return { data: [], error: null };
        if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
        throw new Error("Unexpected RPC: " + name);
      },
    },
  };
  const firstPoint = { lat: oxLan.lat + 0.001, lng: oxLan.lng + 0.001 };
  const secondPoint = oxLan;
  const a = adapter((url) => {
    if (url.pathname === "/v1/geocode/search") {
      const firstSeed = seedWithName("Falloumi");
      return {
        features: [
          {
            ...firstSeed,
            properties: { ...firstSeed.properties, lat: firstPoint.lat, lon: firstPoint.lng },
          },
          seedWithName("Falloumi"),
        ],
      };
    }
    if (url.searchParams.get("filter") === `circle:${secondPoint.lng},${secondPoint.lat},150`)
      return { features: [place("verified-falloumi-second-anchor", "Falloumi")] };
    return { features: [] };
  }, context);
  const first = await a.discovery({
    text: "Falloumi",
    centers: [area],
    radiusKm: 1,
    searchPhase: "primary",
  });
  const recovered = await a.discovery({
    text: "Falloumi",
    centers: [area],
    radiusKm: 1,
    searchPhase: "recovery",
    providerRequestLimit: 25 - first.budgetUsage.requests,
    providerCreditLimit: 40 - first.budgetUsage.reservedCredits,
  });
  expect(recovered.results.map((r) => r.externalId)).toContain("verified-falloumi-second-anchor");
  expect(
    a.calls.filter(
      (url) => url.pathname === "/v2/places" && url.searchParams.get("filter")?.endsWith(",150"),
    ),
  ).toHaveLength(2);
});

test("geografisk sökledtråd styrs av koordinat, inte sökområdets visningsnamn", async () => {
  const context: FixtureContext = {
    supabase: {
      rpc: async (name) => {
        if (name === "get_place_discovery_context_v1")
          return { data: { canConfirm: true }, error: null };
        if (name === "search_canonical_places_v1" || name === "search_canonical_name_candidates_v1")
          return { data: [], error: null };
        if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
        throw new Error("Unexpected RPC: " + name);
      },
    },
  };
  const a = adapter(
    (url) =>
      url.pathname === "/v1/geocode/search"
        ? { features: [seedWithName("Falloumi")] }
        : { features: [] },
    context,
  );
  await a.discovery({
    text: "Falloumi",
    centers: [{ ...area, label: "En sökadress, okänd ort" }],
    radiusKm: 1,
    searchPhase: "recovery",
  });
  const geocoding = a.calls.find(
    (url) => url.pathname === "/v1/geocode/search" && !url.searchParams.has("filter"),
  );
  expect(geocoding?.searchParams.get("text")).toBe("Falloumi");
  expect(geocoding?.searchParams.get("bias")).toBe(centerBias);
});

test("blandade punkt- och boundaryområden håller point-recovery inom radie utan place:undefined", async () => {
  const context: FixtureContext = {
    supabase: {
      rpc: async (name) => {
        if (name === "get_place_discovery_context_v1")
          return { data: { canConfirm: true }, error: null };
        if (name === "search_canonical_places_v1" || name === "search_canonical_name_candidates_v1")
          return { data: [], error: null };
        if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
        throw new Error("Unexpected RPC " + name);
      },
    },
  };
  const boundary = {
    ...area,
    id: "boundary",
    label: "Stockholms kommun",
    searchMode: "boundary" as const,
    placeId: "verified-boundary",
  };
  const a = adapter((url) => {
    if (url.pathname === "/v1/geocode/search")
      return {
        features: url.searchParams.get("text") === "Falloumi" ? [seedWithName("Falloumi")] : [],
      };
    if (url.searchParams.get("filter") === `circle:${oxLan.lng},${oxLan.lat},150`)
      return { features: [place("mixed-area-falloumi", "Falloumi")] };
    return { features: [] };
  }, context);
  const recovered = await a.discovery({
    text: "Falloumi",
    centers: [area, boundary],
    radiusKm: 2,
    searchPhase: "recovery",
  });
  const match = recovered.results.find((result) => result.externalId === "mixed-area-falloumi");
  expect(match?.nearestAreaId).toBe(area.id);
  expect(match?.distanceKm).toBeGreaterThan(1);
  expect(match?.distanceKm).toBeLessThan(2);
  expect(a.calls.some((url) => url.searchParams.get("filter") === "place:undefined")).toBe(false);
  expect(
    a.calls.some(
      (url) =>
        url.pathname === "/v1/geocode/search" &&
        url.searchParams.get("text") === "Falloumi" &&
        !url.searchParams.has("filter"),
    ),
  ).toBe(true);
  expect(recovered.budgetUsage.requests).toBeLessThanOrEqual(25);
});

test("geokodningsledtråd kan inte ge träff utanför utökad radie eller utan verifierat Places-namn", async () => {
  const context: FixtureContext = {
    supabase: {
      rpc: async (name) => {
        if (name === "get_place_discovery_context_v1")
          return { data: { canConfirm: true }, error: null };
        if (name === "search_canonical_places_v1" || name === "search_canonical_name_candidates_v1")
          return { data: [], error: null };
        if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
        throw new Error("Unexpected RPC: " + name);
      },
    },
  };
  for (const variant of ["far", "wrong-name", "wrong-location"] as const) {
    const outside = { lat: 59.415, lng: 18.08 };
    const a = adapter((url) => {
      if (url.pathname === "/v1/geocode/search") {
        const seedFeature = seedWithName("Falloumi");
        return {
          features: [
            variant === "far"
              ? {
                  ...seedFeature,
                  properties: { ...seedFeature.properties, ...outside, lon: outside.lng },
                }
              : seedFeature,
          ],
        };
      }
      if (url.searchParams.get("filter")?.endsWith(",150"))
        return {
          features: [
            place(
              "unverified",
              variant === "wrong-name" ? "Annan restaurang" : "Falloumi",
              variant === "wrong-location" ? { lat: stockholm.lat, lon: stockholm.lng } : {},
            ),
          ],
        };
      return { features: [] };
    }, context);
    const first = await a.discovery({
      text: "Falloumi",
      centers: [area],
      radiusKm: 1,
      searchPhase: "primary",
    });
    const recovered = await a.discovery({
      text: "Falloumi",
      centers: [area],
      radiusKm: 1,
      searchPhase: "recovery",
      providerRequestLimit: 25 - first.budgetUsage.requests,
      providerCreditLimit: 40 - first.budgetUsage.reservedCredits,
    });
    expect(recovered.results).toHaveLength(0);
    expect(first.budgetUsage.requests + recovered.budgetUsage.requests).toBeLessThanOrEqual(25);
  }
});

test("primära sökresultat behöver inte invänta namnåterhämtning", async () => {
  let releaseGeocoding: () => void = () => {};
  const blockedGeocoding = new Promise<void>((resolve) => {
    releaseGeocoding = resolve;
  });
  const context: FixtureContext = {
    supabase: {
      rpc: async (name) => {
        if (name === "get_place_discovery_context_v1")
          return { data: { canConfirm: true }, error: null };
        if (name === "search_canonical_places_v1" || name === "search_canonical_name_candidates_v1")
          return { data: [], error: null };
        if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
        throw new Error("Unexpected RPC: " + name);
      },
    },
  };
  const a = adapter(async (url) => {
    if (url.pathname === "/v1/geocode/search") {
      await blockedGeocoding;
      return { features: [] };
    }
    return { features: [] };
  }, context);
  const input: SearchInput = { text: "Pelikan", centers: [area], radiusKm: 1 };
  const first = await a.discovery({ ...input, searchPhase: "primary" });
  expect(first.results).toEqual([]);
  expect((first as typeof first & { pendingRecovery: boolean }).pendingRecovery).toBe(true);
  expect(a.calls.map((url) => url.pathname)).toEqual(["/v2/places"]);
  expect(a.calls[0].searchParams.get("filter")).toBe("circle:18.0710935,59.3251172,2000");
  const finished = a.discovery({
    ...input,
    searchPhase: "recovery",
    providerRequestLimit: 25 - first.budgetUsage.requests,
    providerCreditLimit: 40 - first.budgetUsage.reservedCredits,
  });
  releaseGeocoding();
  const recovered = await finished;
  expect(a.calls.some((url) => url.pathname === "/v1/geocode/search")).toBe(true);
  expect(recovered.budgetUsage.requests + first.budgetUsage.requests).toBeLessThanOrEqual(25);
  expect(
    recovered.budgetUsage.reservedCredits + first.budgetUsage.reservedCredits,
  ).toBeLessThanOrEqual(40);
});

test("Pelikann hittar Pelikan 1,6 km bort med gemensam fuzzy/radie-kandidatsökning", async () => {
  const a = adapter(
    (url) => ({
      features:
        url.pathname === "/v2/places" &&
        url.searchParams.get("name") === "pelika" &&
        url.searchParams.get("filter")?.endsWith(",2000")
          ? [place("pelikan-typo-nearby", "Pelikan")]
          : [],
    }),
    {
      supabase: {
        rpc: async (name) => {
          if (name === "get_place_discovery_context_v1")
            return { data: { canConfirm: true }, error: null };
          if (
            name === "search_canonical_places_v1" ||
            name === "search_canonical_name_candidates_v1"
          )
            return { data: [], error: null };
          if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
          throw new Error("Unexpected RPC: " + name);
        },
      },
    },
  );
  const first = await a.discovery({
    text: "Pelikann",
    centers: [area],
    radiusKm: 1,
    searchPhase: "primary",
  });
  expect((first as typeof first & { pendingRecovery: boolean }).pendingRecovery).toBe(true);
  const recovered = await a.discovery({
    text: "Pelikann",
    centers: [area],
    radiusKm: 1,
    searchPhase: "recovery",
    providerRequestLimit: 25 - first.budgetUsage.requests,
    providerCreditLimit: 40 - first.budgetUsage.reservedCredits,
  });
  const hit = recovered.results.find((candidate) => candidate.externalId === "pelikan-typo-nearby");
  expect(hit?.searchMatchType).toBe("tolerant");
  expect(hit?.searchAreaGroup).toBe("nearby");
  expect(
    (recovered as typeof recovered & { observation: { candidates: { typo: number } } }).observation
      .candidates.typo,
  ).toBe(1);
  expect(first.budgetUsage.requests + recovered.budgetUsage.requests).toBeLessThanOrEqual(25);
  expect(a.calls.filter((url) => url.pathname === "/v1/geocode/search")).toHaveLength(1);
});

test("korrekt namn utanför 1 km levereras redan i primär sökning utan fallback", async () => {
  const a = adapter(
    (url) => ({
      features:
        url.pathname === "/v2/places" && url.searchParams.get("filter")?.endsWith(",2000")
          ? [place("pelikan-primary", "Pelikan")]
          : [],
    }),
    {
      supabase: {
        rpc: async (name) => {
          if (name === "get_place_discovery_context_v1")
            return { data: { canConfirm: true }, error: null };
          if (
            name === "search_canonical_places_v1" ||
            name === "search_canonical_name_candidates_v1"
          )
            return { data: [], error: null };
          if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
          throw new Error("Unexpected RPC: " + name);
        },
      },
    },
  );
  const response = await a.discovery({
    text: "Pelikan",
    centers: [area],
    radiusKm: 1,
    searchPhase: "primary",
  });
  expect(response.results.find((p) => p.externalId === "pelikan-primary")?.searchAreaGroup).toBe(
    "nearby",
  );
  expect((response as typeof response & { pendingRecovery: boolean }).pendingRecovery).toBe(false);
  expect(a.calls.filter((url) => url.pathname === "/v2/places")).toHaveLength(1);
});

test("Pel hittar Pelikan nära sökområdet medan användaren skriver", async () => {
  const a = adapter(
    (url) => ({
      features:
        url.pathname === "/v2/places" &&
        url.searchParams.get("name") === "Pel" &&
        url.searchParams.get("filter")?.endsWith(",2000")
          ? [place("pelikan-prefix", "Pelikan")]
          : [],
    }),
    {
      supabase: {
        rpc: async (name) => {
          if (name === "get_place_discovery_context_v1")
            return { data: { canConfirm: true }, error: null };
          if (name === "search_canonical_places_v1") return { data: [], error: null };
          if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
          throw new Error("Unexpected RPC: " + name);
        },
      },
    },
  );
  const first = await a.discovery({
    text: "Pel",
    centers: [area],
    radiusKm: 1,
    searchPhase: "primary",
  });
  expect(first.results.find((item) => item.externalId === "pelikan-prefix")?.searchAreaGroup).toBe(
    "nearby",
  );
  expect((first as typeof first & { pendingRecovery: boolean }).pendingRecovery).toBe(false);
  expect(a.calls.filter((url) => url.pathname === "/v2/places")).toHaveLength(1);
});

test("halvfärdigt generiskt ord startar inte dyr namnåterhämtning", async () => {
  const a = adapter(() => ({ features: [] }), {
    supabase: {
      rpc: async (name) => {
        if (name === "get_place_discovery_context_v1")
          return { data: { canConfirm: true }, error: null };
        if (name === "search_canonical_places_v1") return { data: [], error: null };
        if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
        throw new Error("Unexpected RPC: " + name);
      },
    },
  });
  const result = await a.discovery({
    text: "Restau",
    centers: [area],
    radiusKm: 1,
    searchPhase: "primary",
  });
  expect((result as typeof result & { pendingRecovery: boolean }).pendingRecovery).toBe(false);
  expect(a.calls.filter((url) => url.pathname === "/v1/geocode/search")).toHaveLength(0);
  expect(a.calls[0].searchParams.get("filter")).toBe("circle:18.0710935,59.3251172,1000");
});

test("geokodad korrigering av Pelikann måste verifieras med Places innan den visas", async () => {
  const context: FixtureContext = {
    supabase: {
      rpc: async (name) => {
        if (name === "get_place_discovery_context_v1")
          return { data: { canConfirm: true }, error: null };
        if (name === "search_canonical_places_v1" || name === "search_canonical_name_candidates_v1")
          return { data: [], error: null };
        if (name === "match_place_discovery_candidates_v1") return { data: [], error: null };
        throw new Error("Unexpected RPC: " + name);
      },
    },
  };
  const a = adapter((url) => {
    if (url.pathname === "/v1/geocode/search") return { features: [seedWithName("Pelikan")] };
    if (
      url.pathname === "/v2/places" &&
      !url.searchParams.has("name") &&
      url.searchParams.get("filter") === `circle:${oxLan.lng},${oxLan.lat},150`
    )
      return { features: [place("verified-pelikan", "Pelikan")] };
    return { features: [] };
  }, context);
  const primary = await a.discovery({
    text: "Pelikann",
    centers: [area],
    radiusKm: 1,
    searchPhase: "primary",
  });
  expect((primary as typeof primary & { pendingRecovery: boolean }).pendingRecovery).toBe(true);
  const recovery = await a.discovery({
    text: "Pelikann",
    centers: [area],
    radiusKm: 1,
    searchPhase: "recovery",
    providerRequestLimit: 25 - primary.budgetUsage.requests,
    providerCreditLimit: 40 - primary.budgetUsage.reservedCredits,
  });
  const verified = recovery.results.find(
    (candidate) => candidate.externalId === "verified-pelikan",
  );
  expect(verified?.searchMatchType).toBe("tolerant");
  expect(verified?.searchAreaGroup).toBe("nearby");
  expect(
    recovery.results.find((candidate) => candidate.externalId === "pelikan-geocoding-anchor"),
  ).toBeUndefined();
  expect(
    a.calls.some(
      (url) =>
        url.pathname === "/v2/places" &&
        !url.searchParams.has("name") &&
        url.searchParams.get("filter") === `circle:${oxLan.lng},${oxLan.lat},150`,
    ),
  ).toBe(true);
  expect(primary.budgetUsage.requests + recovery.budgetUsage.requests).toBeLessThanOrEqual(25);
});
