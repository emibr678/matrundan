import { describe, expect, test } from "bun:test";
import { searchGeoapifyCatalogue } from "./geoapify-catalogue-search";
import { sourceSearchEvidence, sourceIdentityKey } from "./place-search-evidence";
import { resolveDiscoverySearchIntent } from "./place-search-intent";
import { normalizePlaceFeature } from "./geoapify-normalize";
import { adapter, type SearchInput } from "./testing/geoapify-adapter-fixture";

const feature = (
  id: string,
  cuisine: string,
  categories = ["catering.fast_food"],
  raw: Record<string, unknown> = {},
) => ({
  properties: {
    place_id: id,
    name: "Källstödd verksamhet",
    lat: 59.31,
    lon: 18.07,
    categories,
    datasource: { raw: { cuisine, ...raw } },
  },
});
const url = new URL(
  "https://api.geoapify.com/v2/places?filter=circle:18,59,2000&bias=proximity:18,59&apiKey=fixture-only",
);
const intent = (word: string) => resolveDiscoverySearchIntent(word);
const run = (word: string, features: ReturnType<typeof feature>[]) =>
  searchGeoapifyCatalogue({
    url,
    intent: intent(word),
    limit: 20,
    fetch: async () => ({ features }),
  });
const area = { id: "a", label: "Område A", lat: 59.31, lng: 18.07 };
const input: SearchInput = {
  text: "Sushi",
  selectedFilter: { kind: "food-tag", id: "specialty:sushi" },
  centers: [area],
  radiusKm: 2,
  searchPhase: "primary",
};
const context = { supabase: { rpc: async () => ({ data: [], error: null }) } };

test("fem kalla områden ger båda strömmarna tur inom två Visa fler-klick med verklig 5/20-budget", async () => {
  const five = {
    ...input,
    centers: Array.from({ length: 5 }, (_, i) => ({
      ...area,
      id: `a${i}`,
      lat: area.lat + i * 0.01,
    })),
  };
  const fixture = (u: URL) => ({
    features: Array.from({ length: Number(u.searchParams.get("limit")) }, (_, i) =>
      feature(
        `${u.searchParams.get("filter")}-${u.searchParams.get("categories")}-${u.searchParams.get("offset") ?? 0}-${i}`,
        "sushi",
        [u.searchParams.get("categories")!],
      ),
    ),
  });
  let page = await adapter(fixture, context).discovery(five);
  const firstMetadata = Object.values(page.streamCursors!).map((c) => c.metadata);
  // New isolated adapters model cache eviction between clicks. Correctness must
  // not rely on a warm serverless instance keeping earlier requests free.
  for (let click = 0; click < 2; click++) {
    page = await adapter(fixture, context).discovery({
      ...five,
      streamCursors: page.streamCursors,
      areaOffsets: page.areaOffsets,
      exhaustedAreaIds: page.exhaustedAreaIds,
      providerRequestLimit: 5,
      providerCreditLimit: 20,
    });
    expect(page.budgetUsage.requests).toBeLessThanOrEqual(5);
    expect(page.budgetUsage.reservedCredits).toBeLessThanOrEqual(20);
    expect(page.failedAreaIds).toEqual([]);
  }
  expect(Object.values(page.streamCursors!).every((c, i) => c.metadata > firstMetadata[i])).toBe(
    true,
  );
  expect(Object.values(page.streamCursors!).every((c) => c.direct >= 40)).toBe(true);
});

test("kalla 5/20-klick når sista direkta och råa sidan utan upprepat arbete", async () => {
  const five = {
    ...input,
    centers: Array.from({ length: 5 }, (_, i) => ({
      ...area,
      id: `a${i}`,
      lat: area.lat + i * 0.01,
    })),
  };
  const urls = new Set<string>();
  const fixture = (u: URL) => {
    expect(urls.has(u.toString())).toBe(false);
    urls.add(u.toString());
    const category = u.searchParams.get("categories")!;
    const direct = category.endsWith(".sushi");
    const total = direct ? 61 : category === "catering.fast_food" ? 101 : 0;
    const offset = Number(u.searchParams.get("offset") ?? 0);
    return {
      features: Array.from(
        { length: Math.max(0, Math.min(Number(u.searchParams.get("limit")), total - offset)) },
        (_, i) =>
          feature(
            `${u.searchParams.get("filter")}-${direct ? "direct" : "raw"}-${offset + i}`,
            "sushi",
            [direct ? "catering.restaurant.sushi" : "catering.fast_food"],
          ),
      ),
    };
  };
  let page = await adapter(fixture, context).discovery(five);
  const ids = new Set(page.results.map((p) => p.externalId));
  let clicks = 0;
  while (page.hasMore && clicks++ < 12) {
    page = await adapter(fixture, context).discovery({
      ...five,
      streamCursors: page.streamCursors,
      areaOffsets: page.areaOffsets,
      exhaustedAreaIds: page.exhaustedAreaIds,
      providerRequestLimit: 5,
      providerCreditLimit: 20,
    });
    expect(page.budgetUsage.requests).toBeLessThanOrEqual(5);
    expect(page.budgetUsage.reservedCredits).toBeLessThanOrEqual(20);
    expect(page.failedAreaIds).toEqual([]);
    for (const p of page.results) ids.add(p.externalId);
  }
  expect(page.hasMore).toBe(false);
  expect(ids.size).toBe(5 * (61 + 101));
  expect(page.exhaustedAreaIds).toHaveLength(5);
});

test("verkligt providerfel behåller råcursor och återförsök tappar inte direktsidor", async () => {
  const a = adapter(
    (u) => ({
      features: Array.from({ length: Number(u.searchParams.get("limit")) }, (_, i) =>
        feature(`first-${i}`, "sushi"),
      ),
    }),
    context,
  );
  const first = await a.discovery(input);
  const failed = await adapter(
    (u) =>
      u.searchParams.get("categories") === "catering.fast_food"
        ? { features: [], status: 429 }
        : { features: [feature("direct-final", "sushi")] },
    context,
  ).discovery({
    ...input,
    streamCursors: first.streamCursors,
    providerRequestLimit: 5,
    providerCreditLimit: 20,
  });
  expect(failed.failedAreaIds).toEqual([area.id]);
  expect(failed.streamCursors![area.id].metadata).toBe(50);
  expect(failed.streamCursors![area.id].directDone).toBe(true);
  const retried = adapter((u) => {
    expect(u.searchParams.get("offset")).toBe("50");
    return { features: [feature("raw-recovered", "sushi")] };
  }, context);
  const recovered = await retried.discovery({
    ...input,
    streamCursors: failed.streamCursors,
    providerRequestLimit: 5,
    providerCreditLimit: 20,
  });
  expect(recovered.failedAreaIds).toEqual([]);
  expect(recovered.results.some((p) => p.externalId === "raw-recovered")).toBe(true);
  expect(retried.calls).toHaveLength(1);
});

test("ett område med en enda kall anropsplats kan fortsätta metadata utan felmarkering", async () => {
  let page = await adapter(() => ({ features: [] }), context).discovery({
    ...input,
    providerRequestLimit: 1,
    providerCreditLimit: 4,
  });
  expect(page.hasMore).toBe(true);
  expect(page.failedAreaIds).toEqual([]);
  expect(page.streamCursors![area.id].directDone).toBe(true);
  const cursor = page.streamCursors;
  page = await adapter(() => ({ features: [feature("last-raw", "sushi")] }), context).discovery({
    ...input,
    streamCursors: cursor,
    providerRequestLimit: 1,
    providerCreditLimit: 4,
  });
  expect(page.results.some((p) => p.externalId === "last-raw")).toBe(true);
  expect(page.failedAreaIds).toEqual([]);
});

test("ett område överlappar strömmarna men väljer alltid direktströmmens identitet först", async () => {
  const direct = feature("direct", "sushi", ["catering.restaurant.sushi"], {
    osm_type: "way",
    osm_id: 91,
  });
  const metadata = [
    feature("duplicate-provider-id", "sushi", ["catering.fast_food"], {
      osm_type: "way",
      osm_id: 91,
    }),
    feature("metadata-only", "sushi", ["catering.fast_food"], { osm_type: "node", osm_id: 92 }),
  ];
  let releaseDirect!: (payload: { features: ReturnType<typeof feature>[] }) => void;
  const calls: string[] = [];
  const pending = searchGeoapifyCatalogue({
    url,
    intent: intent("Sushi"),
    limit: 20,
    parallelStreams: true,
    fetch: async (request) => {
      const category = request.searchParams.get("categories")!;
      calls.push(category);
      return category === "catering.fast_food"
        ? { features: metadata }
        : new Promise((resolve) => {
            releaseDirect = resolve;
          });
    },
  });
  expect(calls).toEqual(["catering.restaurant.sushi", "catering.fast_food"]);
  await Promise.resolve(); // Metadata arrives before the direct response.
  releaseDirect({ features: [direct] });
  const parallel = await pending;
  const sequential = await searchGeoapifyCatalogue({
    url,
    intent: intent("Sushi"),
    limit: 20,
    fetch: async (request) => ({
      features:
        request.searchParams.get("categories") === "catering.fast_food" ? metadata : [direct],
    }),
  });
  expect(parallel).toEqual(sequential);
  expect(parallel.results.map((p) => p.externalId)).toEqual(["direct", "metadata-only"]);
});

test.each(["direct", "metadata"] as const)(
  "parallellt %s-fel behåller den felande cursorn och den andra strömmens träff",
  async (failed) => {
    const page = await searchGeoapifyCatalogue({
      url,
      intent: intent("Sushi"),
      limit: 20,
      parallelStreams: true,
      fetch: async (request) => {
        const stream =
          request.searchParams.get("categories") === "catering.fast_food" ? "metadata" : "direct";
        if (stream === failed) throw new Error("fixture failure");
        return {
          features: [
            feature(
              stream,
              "sushi",
              stream === "direct" ? ["catering.restaurant.sushi"] : ["catering.fast_food"],
            ),
          ],
        };
      },
    });
    expect(page.incomplete).toBe(true);
    expect(page.cursor[failed]).toBe(0);
    expect(page.results.map((p) => p.externalId)).toEqual([
      failed === "direct" ? "metadata" : "direct",
    ]);
  },
);

test("adaptern använder två samtidiga anrop för ett område och behåller områdesprioritet och tak för fem", async () => {
  for (const count of [1, 5]) {
    let active = 0;
    let maximum = 0;
    const a = adapter(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return { features: [feature("source", "sushi")] };
    }, context);
    const page = await a.discovery({
      ...input,
      centers: Array.from({ length: count }, (_, i) => ({
        ...area,
        id: `a${i}`,
        lat: area.lat + i * 0.01,
      })),
    });
    expect(maximum).toBe(2);
    expect(page.budgetUsage.requests).toBe(2 * count);
    expect(page.budgetUsage.reservedCredits).toBe(5 * count);
    expect(a.calls.slice(0, count).map((call) => call.searchParams.get("categories"))).toEqual(
      Array(count).fill("catering.restaurant.sushi"),
    );
  }
});

describe("gemensam källmatchning, ingen meny- eller namnklassificering", () => {
  test.each([
    ["Sushi", "sushi"],
    ["Thailändskt", "thai"],
    ["Grillat/BBQ", "grill"],
    ["Fisk och skaldjur", "fish"],
    ["Pasta", "pasta"],
    ["Falafel", "falafel"],
    ["Asiatiskt", "japanese"],
    ["Mellanöstern", "syrian"],
    ["Kebab", "kebab"],
    ["Kyckling", "chicken"],
    ["Danskt", "danish"],
    ["Dumplings", "dumplings"],
    ["Smörgåsar", "sandwich"],
    ["Sallad", "salad"],
    ["Libanesiskt", "lebanese"],
  ])("%s kan återfå explicit %s före normalisering", async (word, raw) => {
    const results = (await run(word, [feature("positive", raw), feature("irrelevant", "italian")]))
      .results;
    expect(results.map((p) => p.externalId)).toEqual(["positive"]);
    expect(results[0].searchEvidence?.intentId).toBe(
      intent(word).kind === "food-tag" ? (intent(word) as { tagId: string }).tagId : "",
    );
    if (word === "Danskt") expect(results[0].cuisines).not.toContain("Wienerbröd");
  });
  test("nationellt kök, namn och svag association skapar inte maträttsbevis", async () => {
    const named = feature("named", "italian");
    named.properties.name = "Pasta och falafel";
    for (const word of ["Pasta", "Falafel", "Sallad"])
      expect((await run(word, [named])).results).toHaveLength(0);
    expect(sourceSearchEvidence(feature("indian", "indian"), intent("Asiatiskt"))).toBeUndefined();
    expect(sourceSearchEvidence(feature("pizza", "pizza"), intent("Italienskt"))).toBeUndefined();
  });
  test("profiler kräver explicit only, inte yes, cuisine=vegan eller en annan profil", async () => {
    for (const [word, key] of [
      ["Helt vegetariskt", "vegetarian"],
      ["Helt veganskt", "vegan"],
    ]) {
      const page = await run(word, [
        feature("only", "", ["catering.restaurant"], { [`diet:${key}`]: "only" }),
        feature("yes", key, ["catering.restaurant"], { [`diet:${key}`]: "yes" }),
        feature("name", key),
      ]);
      expect(page.results.map((p) => p.externalId)).toEqual(["only"]);
      expect(page.results[0].cuisines).not.toContain(word);
      const wrong = key === "vegan" ? "vegetarian" : "vegan";
      expect(
        sourceSearchEvidence(feature("wrong", "", [], { [`diet:${wrong}`]: "only" }), intent(word)),
      ).toBeUndefined();
    }
  });
  test("Fika är en uttrycklig café/bageri-union och Pub inkluderar bar", async () => {
    expect(
      (
        await run("Fika", [
          feature("bakery", "", ["commercial.food_and_drink.bakery"]),
          feature("restaurant", "", ["catering.restaurant"]),
        ])
      ).results.map((p) => p.externalId),
    ).toEqual(["bakery"]);
    expect((await run("Pub och bar", [feature("bar", "", ["catering.bar"])])).results).toHaveLength(
      1,
    );
  });
});

describe("sidfortsättning, budget, fel och strikt identitet", () => {
  test("full råsida utan relevanta träffar behåller metadata-offset oberoende av direktström", async () => {
    const calls: URL[] = [];
    const fetch = async (u: URL) => {
      calls.push(u);
      const direct = u.searchParams.get("categories")?.includes(".sushi");
      return {
        features: direct
          ? []
          : u.searchParams.has("offset")
            ? [feature("later", "sushi")]
            : Array.from({ length: 50 }, (_, i) => feature(`no-${i}`, "burger")),
      };
    };
    const first = await searchGeoapifyCatalogue({ url, intent: intent("Sushi"), limit: 20, fetch });
    expect(first.results).toHaveLength(0);
    expect(first.hasMore).toBe(true);
    expect(first.cursor.directDone).toBe(true);
    expect(first.cursor.metadata).toBe(50);
    const second = await searchGeoapifyCatalogue({
      url,
      intent: intent("Sushi"),
      limit: 20,
      fetch,
      cursor: first.cursor,
    });
    expect(second.results.map((p) => p.externalId)).toEqual(["later"]);
    expect(calls[2].searchParams.get("offset")).toBe("50");
    expect(second.cursor.metadataType).toBe(1);
    expect(second.cursor.metadata).toBe(0);
    const changed = await searchGeoapifyCatalogue({
      url: new URL(url + "&filter=other"),
      intent: intent("Sushi"),
      limit: 20,
      fetch,
      cursor: first.cursor,
    });
    expect(changed.cursor.direct).toBe(20); // A cursor from another geography cannot skip its first page.
  });
  test("ett fel tappar inte andra strömmens träffar eller förskjuter felande cursor", async () => {
    const first = await searchGeoapifyCatalogue({
      url,
      intent: intent("Sushi"),
      limit: 20,
      fetch: async (u) => {
        if (u.searchParams.get("categories") === "catering.fast_food") throw new Error("429");
        return { features: [feature("direct", "sushi", ["catering.restaurant.sushi"])] };
      },
    });
    expect(first.results).toHaveLength(1);
    expect(first.incomplete).toBe(true);
    expect(first.cursor.metadata).toBe(0);
    expect(first.hasMore).toBe(true);
  });
  test("samma säkra OSM-objekt dedupliceras, olika identiteter på samma adress består", async () => {
    const same = { osm_type: "node", osm_id: 123 };
    const results = (
      await run("Sushi", [
        feature("provider-a", "sushi", [], same),
        feature("provider-b", "sushi", [], same),
        feature("provider-c", "sushi", [], { osm_type: "way", osm_id: 123 }),
        feature("unproven", "sushi"),
      ])
    ).results;
    expect(results.map((p) => p.externalId)).toEqual(["provider-a", "provider-c", "unproven"]);
    expect(sourceIdentityKey('{"osmType":"node","osmId":"123x"}')).toBeUndefined();
    expect(sourceIdentityKey("not-json")).toBeUndefined();
  });
  test("fem områden reserverar högst 10 missanrop/25 Places-krediter; varm cache kostar noll", async () => {
    const a = adapter(() => ({ features: [] }), context);
    const five = {
      ...input,
      centers: Array.from({ length: 5 }, (_, i) => ({
        ...area,
        id: `a${i}`,
        lat: 59.31 + i * 0.01,
      })),
    };
    const cold = await a.discovery(five);
    expect(cold.budgetUsage.requests).toBe(10);
    expect(cold.budgetUsage.reservedCredits).toBe(25);
    expect((await a.discovery(five)).budgetUsage.requests).toBe(0);
    expect(
      (await a.discovery({ ...input, providerRequestLimit: 0 })).budgetUsage.reservedCredits,
    ).toBe(0);
  });
  test("servern ger bara querybevis och presentation, aldrig råpayload, och använder lagrade SQL-etiketter", async () => {
    const rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];
    const a = adapter(
      (u) => ({
        features:
          u.searchParams.get("categories") === "catering.fast_food"
            ? [feature("sushi", "sushi")]
            : [],
      }),
      {
        supabase: {
          rpc: async (name, args) => {
            rpcs.push({ name, args });
            return { data: [], error: null };
          },
        },
      },
    );
    const found = await a.discovery(input);
    expect(found.results).toHaveLength(1);
    expect(found.results[0].raw).toBeUndefined();
    expect(rpcs.find((r) => r.name === "search_canonical_places_v1")?.args._cuisines).toContain(
      "Sushi",
    );
    expect(rpcs.find((r) => r.name === "search_canonical_places_v1")?.args._cuisines).not.toContain(
      "specialty:sushi",
    );
    expect(rpcs.every((r) => r.args._group_id === "38910000-0000-4000-8000-000000000001")).toBe(
      true,
    );
    expect(normalizePlaceFeature(feature("italian", "italian"))?.cuisines).not.toContain("Pasta");
  });
});

describe("fasta observationer ur den sparade liveexporten 23 oktober", () => {
  test("samma motor återfår uttrycklig råmatdata som normaliseringen tappar", async () => {
    const observations = (await import("./testing/search-observations-512.json")).default;
    const features = observations.places.map((p) =>
      feature(p.id, p.cuisine, p.categories, {
        "diet:vegetarian": p.dietVegetarian,
        "diet:vegan": p.dietVegan,
      }),
    );
    for (const [word, token] of [
      ["Sushi", "sushi"],
      ["Thailändskt", "thai"],
      ["Grillat/BBQ", "grill"],
      ["Fisk och skaldjur", "fish"],
      ["Pasta", "pasta"],
      ["Falafel", "falafel"],
      ["Kebab", "kebab"],
      ["Kyckling", "chicken"],
      ["Dumplings", "dumplings"],
    ]) {
      const expected = observations.places.filter((p) =>
        p.cuisine
          .split(/[;,]/)
          .map((t) => t.trim())
          .includes(token),
      );
      expect(expected.length, word).toBeGreaterThan(0);
      const page = await run(word, features);
      for (const p of expected)
        expect(
          page.results.some((result) => result.externalId === p.id),
          `${word}: ${p.name}`,
        ).toBe(true);
    }
  });
});

test.each([400, 401, 429, 500])(
  "HTTP %i är ofullständighet, inte en bekräftad nollträff",
  async (status) => {
    const a = adapter(() => ({ features: [], status }), context);
    const page = await a.discovery(input);
    expect(page.failedAreaIds).toEqual(["a"]);
    expect(page.budgetUsage.requests).toBe(2);
    expect(page.budgetUsage.reservedCredits).toBe(5);
    expect(page.areaOffsets.a).toBeUndefined();
  },
);
test("abort och gruppvägran ger inga falska tomma framgångar eller obehöriga anrop", async () => {
  const a = adapter(() => {
    throw new DOMException("timeout", "AbortError");
  }, context);
  const page = await a.discovery(input);
  expect(page.failedAreaIds).toEqual(["a"]);
  expect(page.results).toHaveLength(0);
  const denied = adapter(() => ({ features: [] }), {
    supabase: {
      rpc: async () => {
        throw new Error("membership denied");
      },
    },
  });
  await expect(denied.discovery(input)).rejects.toThrow("membership denied");
  expect(denied.calls).toHaveLength(0);
});
test("punkt och boundary behåller separata cursors, medlemskap och avstånd", async () => {
  const a = adapter(
    () => ({
      features: [
        feature("same", "sushi", ["catering.restaurant.sushi"], { osm_type: "way", osm_id: 987 }),
      ],
    }),
    context,
  );
  const page = await a.discovery({
    ...input,
    centers: [
      area,
      {
        ...area,
        id: "boundary",
        label: "Kommun",
        searchMode: "boundary",
        placeId: "verified-boundary",
      },
    ],
  });
  expect(page.results).toHaveLength(1);
  expect(page.results[0].matchingAreaIds).toEqual(["a", "boundary"]);
  expect(page.streamCursors?.a.scope).not.toBe(page.streamCursors?.boundary.scope);
  expect(
    a.calls
      .filter((u) => u.pathname === "/v2/places")
      .some((u) => u.searchParams.get("filter") === "place:verified-boundary"),
  ).toBe(true);
});
