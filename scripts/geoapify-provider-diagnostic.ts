import { appendFileSync } from "node:fs";
import { GEOAPIFY_DISCOVERY_CATEGORIES } from "../src/lib/matrundan/geoapify-place-search";
import { expandedNameRadiusKm } from "../src/lib/matrundan/place-search-expansion";

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
const anchors = new Map();

// Controls distinguish a missing provider place from an invalid location or filter.
// No raw provider payloads or unrelated names are reported.
const scenarios = [
  { label: "Pelika partial Geocoding free text", kind: "geocoding", text: "Pelika Stockholm" },
  { label: "Pelika partial Geocoding structured", kind: "geocoding", name: "Pelika", city: "Stockholm" },
  { label: "Pelika partial Autocomplete", kind: "autocomplete", text: "Pelika Stockholm" },
  { label: "Pelikann typo Autocomplete", kind: "autocomplete", text: "Pelikann Stockholm" },
  { label: "Pelika partial Geocoding without city", kind: "geocoding", text: "Pelika" },
  { label: "Fallou partial Geocoding", kind: "geocoding", text: "Fallou Stockholm" },
  { label: "Fallou partial Autocomplete", kind: "autocomplete", text: "Fallou Stockholm" },
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
  const words = normalized(value).split(/[^a-zåäö0-9]+/u);
  const expected = label.includes("CONTROL Geocoding") ? "stockholm" :
    label.includes("Fallou") ? "falloumi" : "pelikan";
  return words.includes(expected);
}

async function runScenario(scenario) {
  if (requests >= maxRequests) throw new Error("Provider request cap exceeded.");
  if (!scenario.name && !scenario.text && !scenario.anchorKey) {
    throw new Error("Invalid diagnostic scenario.");
  }
  const anchor = scenario.anchorKey ? anchors.get(scenario.anchorKey) : null;
  if (scenario.anchorKey && !anchor) {
    return { label: scenario.label, status: "no verified Geocoding anchor", elapsedMs: 0, features: 0, matches: [] };
  }
  const center = anchor ?? { lat: latitude, lon: longitude };
  const url = new URL(
    scenario.kind === "autocomplete"
      ? "/v1/geocode/autocomplete"
      : scenario.kind === "geocoding"
        ? "/v1/geocode/search"
        : "/v2/places",
    base,
  );
  url.searchParams.set("apiKey", key);
  if (scenario.name) url.searchParams.set("name", scenario.name);
  if (scenario.text) url.searchParams.set("text", scenario.text);
  if (scenario.city) url.searchParams.set("city", scenario.city);
  url.searchParams.set("lang", "sv");
  url.searchParams.set("bias", "proximity:" + center.lon + "," + center.lat);
  if (scenario.radius != null) {
    url.searchParams.set("filter", "circle:" + center.lon + "," + center.lat + "," + scenario.radius);
  }
  if (scenario.kind === "geocoding" || scenario.kind === "autocomplete") {
    url.searchParams.set("type", scenario.type ?? "amenity");
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
  if (scenario.anchorFor) {
    const exact = features.map((feature) => feature?.properties ?? {}).find(
      (p) =>
        normalized(p.name) === scenario.anchorFor &&
        typeof p.lat === "number" &&
        typeof p.lon === "number" &&
        (kmBetween(p.lat, p.lon) ?? Infinity) <= 2,
    );
    if (exact) anchors.set(scenario.anchorFor, { lat: exact.lat, lon: exact.lon });
  }
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
    ". Each Places call uses limit <=20 and Geocoding uses limit 5. Credits are provider-billed separately and not inferred from this count.",
  "",
  "Diagnostic only: missing place does not cause false-success regression assertions. Raw API responses, provider IDs and credentials are not recorded.",
  "",
];
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.join("\n") + "\n");
if (results.some((r) => r.status !== 200)) process.exitCode = 1;
