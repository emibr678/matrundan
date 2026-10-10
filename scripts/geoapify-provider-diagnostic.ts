import { appendFileSync } from "node:fs";
import { GEOAPIFY_DISCOVERY_CATEGORIES } from "../src/lib/matrundan/geoapify-place-search";
import { expandedNameRadiusKm } from "../src/lib/matrundan/place-search-expansion";
import { typoProviderSearchSeed } from "../src/lib/matrundan/place-search-typo";

/**
 * Read-only, bounded real-provider diagnostic for Issue #465.
 * Never prints the key, request URL, raw payload, place IDs or private data.
 * Run only with a separate staging server API key (not a browser maps key).
 */
const key = process.env.STAGING_GEOAPIFY_API_KEY;
if (!key) {
  console.error("Missing STAGING_GEOAPIFY_API_KEY in GitHub staging environment. No provider requests were made.");
  process.exit(2);
}

const latitude = 59.3251172;
const longitude = 18.0710935;
const allowedRadius = expandedNameRadiusKm(1);
if (allowedRadius !== 2) throw new Error("Unexpected nearby radius contract.");
const categories = GEOAPIFY_DISCOVERY_CATEGORIES.join(",");
const base = "https://api.geoapify.com";
const results = [];
let requests = 0;
const maxRequests = 10;

const scenarios = [
  { label: "Pelikan exact / allowed 2 km", kind: "places", name: "Pelikan", radius: 2000 },
  { label: "Pelikann exact / allowed 2 km", kind: "places", name: "Pelikann", radius: 2000 },
  { label: "Pelikann prefix / allowed 2 km", kind: "places", name: typoProviderSearchSeed("Pelikann"), radius: 2000 },
  { label: "Falloumi exact / allowed 2 km", kind: "places", name: "Falloumi", radius: 2000 },
  { label: "Falloumi prefix / allowed 2 km", kind: "places", name: typoProviderSearchSeed("Falloumi"), radius: 2000 },
  { label: "Falloumi exact / diagnostic 4 km", kind: "places", name: "Falloumi", radius: 4000 },
  { label: "Pelikan exact / proximity only", kind: "places", name: "Pelikan" },
  { label: "Falloumi exact / proximity only", kind: "places", name: "Falloumi" },
  { label: "Pelikann Geocoding / allowed 2 km", kind: "geocoding", name: "Pelikann", radius: 2000 },
  { label: "Falloumi Geocoding / allowed 2 km", kind: "geocoding", name: "Falloumi", radius: 2000 },
];

function kmBetween(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  const toRadians = Math.PI / 180;
  const a = Math.sin((lat - latitude) * toRadians / 2) ** 2 +
    Math.cos(latitude * toRadians) * Math.cos(lat * toRadians) *
    Math.sin((lon - longitude) * toRadians / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}
function normalized(value) {
  return String(value ?? "").toLocaleLowerCase("sv-SE").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim();
}
function isExpectedName(value, label) {
  const n = normalized(value);
  return (label.includes("Falloumi") && n.includes("falloumi")) ||
    (label.includes("Pelikan") && n.includes("pelikan")) ||
    (label.includes("Pelikann") && n.includes("pelikan"));
}

async function runScenario(scenario) {
  if (requests >= maxRequests) throw new Error("Provider request cap exceeded.");
  if (typeof scenario.name !== "string" || !scenario.name) throw new Error("Invalid scenario name.");
  const url = new URL(
    scenario.kind === "geocoding" ? "/v1/geocode/search" : "/v2/places",
    base,
  );
  url.searchParams.set("apiKey", key);
  url.searchParams.set("name", scenario.name);
  url.searchParams.set("lang", "sv");
  url.searchParams.set("bias", "proximity:" + longitude + "," + latitude);
  if (scenario.radius != null) {
    url.searchParams.set("filter", "circle:" + longitude + "," + latitude + "," + scenario.radius);
  }
  if (scenario.kind === "geocoding") {
    url.searchParams.set("type", "amenity");
    url.searchParams.set("format", "geojson");
    url.searchParams.set("limit", "5");
  } else {
    url.searchParams.set("categories", categories);
    url.searchParams.set("limit", "20");
  }

  ++requests;
  const begin = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const elapsedMs = Math.round(performance.now() - begin);
  if (!response.ok) {
    return { label: scenario.label, status: response.status, elapsedMs, features: 0, matches: [], error: "Provider HTTP error" };
  }
  const json = await response.json();
  const features = Array.isArray(json?.features) ? json.features : [];
  const matches = features
    .map((f) => {
      const p = f?.properties ?? {};
      return { name: p.name ?? p.address_line1 ?? "", km: kmBetween(p.lat, p.lon) };
    })
    .filter((r) => isExpectedName(r.name, scenario.label))
    .slice(0, 5);
  return { label: scenario.label, status: response.status, elapsedMs, features: features.length, matches };
}

for (const scenario of scenarios) {
  try {
    const result = await runScenario(scenario);
    results.push(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error("Scenario failed: " + scenario.label + " (no URL, key or raw payload logged)");
    results.push({ label: scenario.label, status: "error", elapsedMs: null, features: 0, matches: [], error: "Request/parse failure" });
  }
}

const report = [
  "## Read-only Geoapify staging diagnostic — Issue #465",
  "",
  "Exact public search center: Stockholm 59.3251172, 18.0710935. Boundaries and canonical identity not changed.",
  "",
  "| Scenario | HTTP | Features | Matching names (distance km) | Provider ms |",
  "|---|---:|---:|---|---:|",
  ...results.map((r) =>
    "| " + r.label + " | " + r.status + " | " + r.features + " | " +
    (r.matches.length ? r.matches.map((m) => m.name.replace(/[|]/g, "/") + " (" + (m.km ?? "?") + ")").join(", ") : "None") +
    " | " + (r.elapsedMs ?? "—") + " |",
  ),
  "",
  "Total actual calls: " + requests + " / " + maxRequests +
    ". Every Places call uses limit <=20; Geocoding uses limit 5. Credits are provider-billed separately and not inferred from this count.",
  "",
  "Diagnostic only: missing place does not cause false-success regression assertions. Raw API responses, provider IDs and credentials are not recorded.",
  "",
];
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.join("\n") + "\n");
if (results.some((r) => r.status !== 200)) process.exitCode = 1;
