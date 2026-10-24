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
