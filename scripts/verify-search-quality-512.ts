/** Offline verification of the existing Oct 23 export. No network or provider credentials.
 * bun scripts/verify-search-quality-512.ts <export.json> <main-checkout> <output.json>
 * Candidate pools are reconstructed from observed data, not new Geoapify responses.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SEARCH_CONCEPTS } from "../src/lib/matrundan/search-catalogue";
import { geoapifySearchRecipe } from "../src/lib/matrundan/geoapify-place-search";
import { resolveDiscoverySearchIntent } from "../src/lib/matrundan/place-search-intent";
import { sourceSearchEvidence } from "../src/lib/matrundan/place-search-evidence";
import { adapter, type SearchInput } from "../src/lib/matrundan/testing/geoapify-adapter-fixture";
import { createHash } from "node:crypto";

const [rawPath, mainPath, outPath] = process.argv.slice(2);
if (!rawPath || !mainPath || !outPath)
  throw new Error("Expected export, baseline checkout and output path");
const bytes = readFileSync(rawPath);
type Observation = {
  id: string;
  name: string;
  categories: string[];
  lat: number;
  lon: number;
  osm: Record<string, unknown>;
};
type Row = {
  status: number;
  job: {
    area: { id: string; label: string; lat: number; lon: number; radius: number };
    strategy: string;
    offset?: number;
  };
  places: Observation[];
};
const data = JSON.parse(bytes.toString()) as { rows: Row[] };
const rows = data.rows.filter((r) => r.status === 200 && r.job.area.radius === 2000);
const areaMap = new Map(rows.map((r) => [r.job.area.id, r.job.area]));
const areas = [...areaMap.values()];
const pools = new Map(
  areas.map((a) => [
    a.id,
    [
      ...new Map(
        rows
          .filter((r) => r.job.area.id === a.id)
          .flatMap((r) => r.places ?? [])
          .map((p) => [p.id, p]),
      ).values(),
    ]
      .map((p) => ({
        properties: {
          place_id: p.id,
          name: p.name,
          categories: p.categories,
          lat: p.lat,
          lon: p.lon,
          city: "Sverige",
          datasource: { raw: p.osm },
        },
      }))
      .sort((x, y) => {
        const distance = (p: typeof x) =>
          Math.hypot(
            (p.properties.lat - a.lat) * 111,
            (p.properties.lon - a.lon) * 111 * Math.cos((a.lat * Math.PI) / 180),
          );
        return distance(x) - distance(y);
      }),
  ]),
);
const context = { supabase: { rpc: async () => ({ data: [], error: null }) } };
function fixtureProvider(url: URL) {
  const area = areas.find(
    (a) => url.searchParams.get("filter") === `circle:${a.lon},${a.lat},2000`,
  )!;
  if (!area) throw new Error("Unexpected fixture geography: " + url.searchParams.get("filter"));
  if (url.pathname !== "/v2/places") return { features: [] };
  const categories = url.searchParams.get("categories")!.split(",");
  const condition = url.searchParams.get("conditions");
  const features = (pools.get(area.id) ?? [])
    .filter((f) =>
      categories.some((c) => f.properties.categories.some((v) => v === c || v.startsWith(c + "."))),
    )
    .filter(
      (f) =>
        !condition || f.properties.datasource.raw[`diet:${condition.split(".")[0]}`] === "only",
    );
  const offset = Number(url.searchParams.get("offset") ?? 0),
    limit = Number(url.searchParams.get("limit") ?? 20);
  return { features: features.slice(offset, offset + limit) };
}
const baseline = adapter(fixtureProvider, context, resolve(mainPath, "src/lib/matrundan"));
const candidate = adapter(fixtureProvider, context);
const quality = [];
for (const c of SEARCH_CONCEPTS) {
  const intent = resolveDiscoverySearchIntent(c.label, "auto", { kind: c.kind, id: c.id });
  const recipe = geoapifySearchRecipe(intent);
  const perArea = [];
  for (const area of areas) {
    const input: SearchInput = {
      text: c.label,
      selectedFilter: { kind: c.kind, id: c.id },
      centers: [{ id: area.id, label: area.label, lat: area.lat, lng: area.lon }],
      radiusKm: 2,
      searchPhase: "primary",
    };
    const expected = new Set(
      (pools.get(area.id) ?? [])
        .filter((f) => sourceSearchEvidence(f, intent))
        .map((f) => f.properties.place_id),
    );
    let base: string[] = [];
    let supported = true;
    try {
      base = (await baseline.discovery(input)).results.map((p) => p.externalId);
    } catch {
      supported = false;
    }
    const first = await candidate.discovery(input);
    const all = new Set(first.results.map((p) => p.externalId));
    let page = first;
    let pages = 1;
    while (page.hasMore && pages < 30) {
      page = await candidate.discovery({
        ...input,
        offset: page.nextOffset,
        areaOffsets: page.areaOffsets,
        streamCursors: page.streamCursors,
        exhaustedAreaIds: page.exhaustedAreaIds,
      });
      for (const p of page.results) all.add(p.externalId);
      pages++;
    }
    perArea.push({
      area: area.id,
      observedSupported: expected.size,
      mainSupported: supported,
      mainFirst: base.length,
      candidateFirst: first.results.length,
      candidateAll: all.size,
      firstMissed: [...expected].filter((id) => !first.results.some((p) => p.externalId === id))
        .length,
      allMissed: [...expected].filter((id) => !all.has(id)).length,
      firstUnproved: first.results.filter((p) => !expected.has(p.externalId)).length,
      pages,
      firstReserved: first.budgetUsage.reservedCredits,
    });
  }
  quality.push({ id: c.id, label: c.label, surface: c.surface, strategies: recipe, perArea });
}
const perf = [];
function percentiles(values: number[]) {
  const v = [...values].sort((a, b) => a - b);
  return {
    p50: v[Math.ceil(v.length * 0.5) - 1],
    p95: v[Math.ceil(v.length * 0.95) - 1],
    max: v.at(-1),
  };
}
// VM/module initialisation happens before timing. Timed code uses the actual server handlers,
// real normalization, serialization and cache, with deterministic zero-network HTTP/RPC fixtures.
for (const [version, dir] of [
  ["main", resolve(mainPath, "src/lib/matrundan")],
  ["candidate", undefined],
] as const) {
  for (const count of [1, 5])
    for (const cache of ["cold", "warm"])
      for (const action of ["search", "more"]) {
        const times: number[] = [],
          requests: number[] = [],
          credits: number[] = [],
          cacheHits: number[] = [];
        for (let i = 0; i < 30; i++) {
          const a = adapter(fixtureProvider, context, dir);
          const input: SearchInput = {
            text: "Sushi",
            selectedFilter: { kind: "food-tag", id: "specialty:sushi" },
            centers: areas
              .slice(0, count)
              .map((area) => ({ id: area.id, label: area.label, lat: area.lat, lng: area.lon })),
            radiusKm: 2,
            searchPhase: "primary",
          };
          if (action === "more") {
            const first = await a.discovery(input);
            Object.assign(input, {
              offset: first.nextOffset,
              areaOffsets: first.areaOffsets,
              streamCursors: first.streamCursors,
              exhaustedAreaIds: first.exhaustedAreaIds,
            });
          }
          if (cache === "warm") await a.discovery(input);
          const start = performance.now();
          const page = await a.discovery(input);
          JSON.stringify(page);
          times.push(performance.now() - start);
          requests.push(page.budgetUsage.requests);
          credits.push(page.budgetUsage.reservedCredits);
          cacheHits.push((page.budgetUsage as { cacheHits?: number }).cacheHits ?? 0);
        }
        perf.push({
          version,
          areas: count,
          cache,
          action,
          n: times.length,
          ms: percentiles(times),
          requests: percentiles(requests),
          reservedCredits: percentiles(credits),
          cacheHits: percentiles(cacheHits),
        });
      }
}
writeFileSync(
  outPath,
  JSON.stringify(
    {
      method:
        "Observed candidate-pool replay; zero HTTP/RPC network latency. Not measured edge/provider latency or global relevance/recall.",
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      baseline: "ead5a34a717004a22c60c4ab9dd57a81d201d34f",
      areas: areas.map((a) => a.id),
      quality,
      perf,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ output: outPath, concepts: quality.length, performanceCells: perf.length }),
);
