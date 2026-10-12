import { describe, expect, test } from "bun:test";
import { createGeoapifyNameSearchAnchorResolver } from "./geoapify-name-search.server";
import { GEOAPIFY_DISCOVERY_CATEGORIES } from "./geoapify-place-search";
import { resolvePlaceSearchIntent } from "./place-search-intent";

const originBias = "proximity:18.0710935,59.3251172";
const anchor = { lat: 59.3409825, lng: 18.0587631 };
const anchorBias = `proximity:${anchor.lng},${anchor.lat}`;
const cacheOptions = { ttlMs: 300_000, maxEntries: 250 };

function request(name = "Ox lan", filter = "circle:18.0710935,59.3251172,5000") {
  const url = new URL("https://api.geoapify.com/v2/places");
  url.search = new URLSearchParams({
    name,
    filter,
    bias: originBias,
    lang: "sv",
    limit: "20",
    categories: GEOAPIFY_DISCOVERY_CATEGORIES.join(","),
    apiKey: "fixture-key",
  }).toString();
  return url;
}

function feature(name = "Ox Lan", id = "places-id", extra: Record<string, unknown> = {}) {
  return {
    properties: {
      name,
      place_id: id,
      lat: anchor.lat,
      lon: anchor.lng,
      categories: ["catering.restaurant", "catering.restaurant.chinese"],
      result_type: "amenity",
      category: "catering.restaurant",
      ...extra,
    },
  };
}

function provider(
  options: { name?: string; primary?: unknown[]; seeds?: unknown[]; placed?: unknown[] } = {},
) {
  const calls: URL[] = [];
  const load = async (url: URL) => {
    calls.push(new URL(url));
    if (url.pathname === "/v1/geocode/search") {
      return { features: options.seeds ?? [feature(options.name, "geocoding-id")] };
    }
    return {
      features:
        url.searchParams.get("bias") === originBias
          ? (options.primary ?? [])
          : (options.placed ?? [feature(options.name)]),
    };
  };
  return { calls, load };
}

describe("begränsad namn-fallback inom ursprungligt sökområde (#464)", () => {
  for (const query of ["Ox lan", "Ox Lan", "OX LAN", "Ox L", "x Lan", "Bröd & Salt"]) {
    test(`verifierar stöd för ${query} med Places före Geocoding`, async () => {
      const name = query === "Bröd & Salt" ? query : "Ox Lan";
      const p = provider({ name });
      const resolve = createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions);
      expect(await resolve(request(query), resolvePlaceSearchIntent(query))).toEqual(anchor);
      expect(p.calls.map((c) => c.pathname)).toEqual([
        "/v2/places",
        "/v1/geocode/search",
        "/v2/places",
      ]);
      expect(p.calls[2].searchParams.get("name")).toBe(query);
      expect(p.calls[2].searchParams.get("bias")).toBe(anchorBias);
      // The anchor contains no Geocoding identity or provider metadata.
    });
  }

  for (const radius of [1000, 2000, 5000, 25000, 50000]) {
    test(`bevarar cirkelfilter ${radius} meter i båda providerleden`, async () => {
      const p = provider();
      const url = request("Ox lan", `circle:18.0710935,59.3251172,${radius}`);
      await createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions)(
        url,
        resolvePlaceSearchIntent("Ox lan"),
      );
      expect(
        p.calls.every((c) => c.searchParams.get("filter") === url.searchParams.get("filter")),
      ).toBe(true);
      expect(p.calls[2].searchParams.get("categories")).toBe(url.searchParams.get("categories"));
    });
  }

  test("bevarar boundary-identitet i stället för att byta till en cirkel", async () => {
    const p = provider();
    await createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions)(
      request("Ox lan", "place:verified-boundary"),
      resolvePlaceSearchIntent("Ox lan"),
    );
    expect(p.calls.every((c) => c.searchParams.get("filter") === "place:verified-boundary")).toBe(
      true,
    );
  });

  test("fungerande primär namnsökning gör inget Geocoding-anrop", async () => {
    const p = provider({ primary: [feature()] });
    expect(
      await createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions)(
        request(),
        resolvePlaceSearchIntent("Ox lan"),
      ),
    ).toBeNull();
    expect(p.calls).toHaveLength(1);
  });

  test("full avvisad primärsida behåller sin paginering", async () => {
    const p = provider({
      primary: Array.from({ length: 20 }, (_, i) => feature("Annan restaurang", `other-${i}`)),
    });
    expect(
      await createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions)(
        request(),
        resolvePlaceSearchIntent("Ox lan"),
      ),
    ).toBeNull();
    expect(p.calls).toHaveLength(1);
  });

  test("en uttömd primärsida utan relevanta träffar får använda fallback", async () => {
    const p = provider({ primary: [feature("Annan restaurang")] });
    expect(
      await createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions)(
        request(),
        resolvePlaceSearchIntent("Ox lan"),
      ),
    ).toEqual(anchor);
  });

  test("browse, kategori, kök och kort fritext aktiverar inte namn-fallback", async () => {
    const p = provider();
    const resolve = createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions);
    for (const query of ["", "restaurang", "café", "kinesiskt", "sushi", "Pasta", "Ox"]) {
      const url = request(query);
      url.searchParams.delete("name");
      expect(await resolve(url, resolvePlaceSearchIntent(query))).toBeNull();
    }
    expect(p.calls).toHaveLength(0);
  });

  test("verkligt tom Geocoding ger ingen påhittad Places-träff", async () => {
    const p = provider({ seeds: [] });
    expect(
      await createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions)(
        request(),
        resolvePlaceSearchIntent("Ox lan"),
      ),
    ).toBeNull();
    expect(p.calls).toHaveLength(2);
  });

  test("Geocoding-position utan verifierad Places-verksamhet returneras inte", async () => {
    const p = provider({ placed: [] });
    expect(
      await createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions)(
        request(),
        resolvePlaceSearchIntent("Ox lan"),
      ),
    ).toBeNull();
  });

  test("ignorerar icke-mat, icke-verksamhet, fel namn och ogiltiga koordinater", async () => {
    const p = provider({
      seeds: [
        feature("Ox Lan", "non-food", { category: "tourism.attraction" }),
        feature("Ox Lan", "street", { result_type: "street" }),
        feature("Annan restaurang", "other"),
        feature("Ox Lan", "bad-lat", { lat: NaN }),
        feature("Ox Lan", "bad-lng", { lon: 181 }),
        feature("Ox Lan", "missing-lat", { lat: undefined }),
        feature("Ox Lan", "closed", { datasource: { raw: { disused: "yes" } } }),
      ],
    });
    expect(
      await createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions)(
        request(),
        resolvePlaceSearchIntent("Ox lan"),
      ),
    ).toBeNull();
    expect(p.calls).toHaveLength(2);
  });

  test("deduplicerar positioner och provar högst tre ankare", async () => {
    const same = feature();
    const p = provider({
      placed: [],
      seeds: [
        same,
        same,
        ...Array.from({ length: 8 }, (_, i) =>
          feature("Ox Lan", `seed-${i}`, { lon: anchor.lng + (i + 1) / 1000 }),
        ),
      ],
    });
    expect(
      await createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions)(
        request(),
        resolvePlaceSearchIntent("Ox lan"),
      ),
    ).toBeNull();
    expect(p.calls).toHaveLength(5);
    expect(new Set(p.calls.slice(2).map((c) => c.searchParams.get("bias"))).size).toBe(3);
  });

  test("nästa sida behåller första sidans ankare och ändrar inte offset", async () => {
    const p = provider();
    const resolve = createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions);
    const first = await resolve(request(), resolvePlaceSearchIntent("Ox lan"));
    const next = request();
    next.searchParams.set("offset", "20");
    expect(await resolve(next, resolvePlaceSearchIntent("Ox lan"))).toEqual(first);
    expect(next.searchParams.get("offset")).toBe("20");
    expect(p.calls).toHaveLength(3);
    expect(p.calls.every((c) => !c.searchParams.has("offset"))).toBe(true);
  });

  test("direkt fortsättningsanrop väljer samma ström från första sidan", async () => {
    const p = provider({ primary: [feature()] });
    const next = request();
    next.searchParams.set("offset", "20");
    expect(
      await createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions)(
        next,
        resolvePlaceSearchIntent("Ox lan"),
      ),
    ).toBeNull();
    expect(p.calls).toHaveLength(1);
    expect(p.calls[0].searchParams.has("offset")).toBe(false);
  });

  test("samtidiga identiska anrop dedupliceras, områden och radier hålls isär", async () => {
    const p = provider();
    const resolve = createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions);
    const intent = resolvePlaceSearchIntent("Ox lan");
    expect(await Promise.all([resolve(request(), intent), resolve(request(), intent)])).toEqual([
      anchor,
      anchor,
    ]);
    expect(p.calls).toHaveLength(3);
    await resolve(request("Ox lan", "circle:18.0710935,59.3251172,25000"), intent);
    await resolve(request("Ox lan", "place:boundary"), intent);
    await resolve(request("Ox Lan"), resolvePlaceSearchIntent("Ox Lan"));
    expect(p.calls).toHaveLength(12);
  });

  test("cacheförlust och TTL ändrar inte valet av ström", async () => {
    const p = provider();
    let now = 0;
    const resolve = createGeoapifyNameSearchAnchorResolver(p.load, {
      ...cacheOptions,
      now: () => now,
    });
    const intent = resolvePlaceSearchIntent("Ox lan");
    expect(await resolve(request(), intent)).toEqual(anchor);
    now = 300_001;
    expect(await resolve(request(), intent)).toEqual(anchor);
    expect(
      await createGeoapifyNameSearchAnchorResolver(p.load, cacheOptions)(request(), intent),
    ).toEqual(anchor);
    expect(p.calls).toHaveLength(9);
  });

  test("providerfel behandlas inte som nollträff och cacheas inte som lyckat svar", async () => {
    const p = provider();
    let fail = true;
    const resolve = createGeoapifyNameSearchAnchorResolver(async (url) => {
      if (fail && url.pathname === "/v1/geocode/search") throw new Error("GEOAPIFY_TIMEOUT");
      return p.load(url);
    }, cacheOptions);
    await expect(resolve(request(), resolvePlaceSearchIntent("Ox lan"))).rejects.toThrow(
      "GEOAPIFY_TIMEOUT",
    );
    fail = false;
    expect(await resolve(request(), resolvePlaceSearchIntent("Ox lan"))).toEqual(anchor);
  });
});
