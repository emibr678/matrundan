// Read-only live-provider diagnostic for Issue #465; no app writes or credentials in output.
// The adapter leg runs production search server functions with mocked auth/DB,
// so it is NOT a full authenticated browser/database E2E test.
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { GEOAPIFY_DISCOVERY_CATEGORIES } from "../src/lib/matrundan/geoapify-place-search.ts";

const secret = process.env.GEOAPIFY_DIAGNOSTIC_KEY?.trim();
if (!secret) throw new Error("Staging Geoapify key unavailable: no requests made.");
const requestedCredits = Number(process.env.MAX_DIAGNOSTIC_CREDITS || 250);
if (!Number.isInteger(requestedCredits) || requestedCredits < 1) throw new Error("Invalid positive integer diagnostic budget.");
const maxCredits = Math.min(500, requestedCredits);
const maxCalls = 120;
const center = { id: "stockholm", label: "Stockholm", lat: 59.3251172, lng: 18.0710935, searchMode: "point" };
const sample = [
  ["Ox Lan", 5], ["Pelikan", 1], ["Falloumi", 1], ["Pharmarium", 3],
  ["Pel", 1], ["Pelikann", 1], ["MatrundanzzIngenRiktigRestaurang", 3], ["restaurang", 1],
];
const kinds = ["places", "geocoding", "autocomplete"];
const categories = GEOAPIFY_DISCOVERY_CATEGORIES.join(",");
const measurements = [];
const calls = [];
let reserved = 0;
let count = 0;
let nextTime = 0;
let waiting = Promise.resolve();
let halted = false;

function normalize(v) {
  return String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("sv-SE");
}
function apiKind(url) {
  if (url.pathname === "/v2/places") return "places";
  if (url.pathname === "/v1/geocode/search") return "geocoding";
  if (url.pathname === "/v1/geocode/autocomplete") return "autocomplete";
  return "other";
}
async function pace() {
  let release;
  const before = waiting;
  waiting = new Promise((resolve) => { release = resolve; });
  await before;
  const delay = Math.max(0, nextTime - Date.now());
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  nextTime = Date.now() + 550; // fewer than two requests/s
  release();
}
async function providerFetch(rawUrl) {
  const url = new URL(rawUrl);
  const kind = apiKind(url);
  const creditEstimate = kind === "places"
    ? Math.max(1, Math.ceil(Number(url.searchParams.get("limit") || 20) / 20))
    : 1;
  if (halted || count >= maxCalls || reserved + creditEstimate > maxCredits) {
    halted = true;
    throw new Error("Diagnostic request/credit ceiling reached");
  }
  count++;
  reserved += creditEstimate; // conservative reservation, not actual billing
  await pace();
  url.searchParams.set("apiKey", secret);
  const started = performance.now();
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  } catch {
    calls.push({ kind, ms: Math.round(performance.now() - started), status: "network error", reserved: creditEstimate });
    throw new Error("Provider network failure or timeout");
  }
  const ms = Math.round(performance.now() - started);
  if ([401, 403, 429].includes(response.status)) halted = true;
  if (!response.ok) {
    calls.push({ kind, ms, status: response.status, reserved: creditEstimate });
    throw new Error("Provider HTTP " + response.status);
  }
  let json;
  try {
    json = await response.json();
  } catch {
    calls.push({ kind, ms, status: "invalid JSON", reserved: creditEstimate });
    throw new Error("Provider invalid JSON");
  }
  calls.push({ kind, ms, status: response.status, candidates: Array.isArray(json?.features) ? json.features.length : 0, reserved: creditEstimate });
  return json;
}
function makeUrl(kind, text, radiusKm, bias = center) {
  const url = new URL(
    kind === "places" ? "https://api.geoapify.com/v2/places" :
    kind === "geocoding" ? "https://api.geoapify.com/v1/geocode/search" :
    "https://api.geoapify.com/v1/geocode/autocomplete",
  );
  if (kind === "places") {
    url.searchParams.set("categories", text === "restaurang" ? "catering.restaurant" : categories);
    if (text !== "restaurang") url.searchParams.set("name", text);
    url.searchParams.set("filter", "circle:" + center.lng + "," + center.lat + "," + radiusKm * 1000);
  } else {
    url.searchParams.set("text", text);
    url.searchParams.set("type", "amenity");
    url.searchParams.set("format", "geojson");
  }
  url.searchParams.set("bias", "proximity:" + bias.lng + "," + bias.lat);
  url.searchParams.set("lang", "sv");
  url.searchParams.set("limit", kind === "places" ? "20" : "10");
  return url;
}
function names(json) {
  return (Array.isArray(json?.features) ? json.features : []).map((x) => x?.properties?.name).filter((x) => typeof x === "string");
}
async function direct(kind, text, radiusKm, label = "") {
  const before = calls.length;
  const started = performance.now();
  try {
    const found = names(await providerFetch(makeUrl(kind, text, radiusKm,
      label === "Ox Lan venue bias" ? { lng: 18.0587631, lat: 59.3409825 } : center)));
    measurements.push({
      mode: "direct", label: label || text, kind, radiusKm,
      ms: Math.round(performance.now() - started),
      total: found.length, matches: found.filter((name) => normalize(name).includes(normalize(text))).length,
      exampleNames: found.slice(0, 3), calls: calls.slice(before),
    });
  } catch (error) {
    measurements.push({
      mode: "direct", label: label || text, kind, radiusKm,
      ms: Math.round(performance.now() - started), error: String(error?.message || error),
      calls: calls.slice(before),
    });
  }
}
function makeServerAdapter() {
  const modules = new Map();
  const rpc = async (name) => {
    if (name === "get_place_discovery_context_v1") return { data: { canConfirm: false }, error: null };
    if (["search_canonical_places_v1", "search_canonical_name_candidates_v1", "match_place_discovery_candidates_v1"].includes(name))
      return { data: [], error: null };
    throw new Error("Unexpected diagnostic RPC: " + name);
  };
  function load(path) {
    if (modules.has(path)) return modules.get(path).exports;
    const module = { exports: {} };
    modules.set(path, module);
    const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(compiled, {
      module, exports: module.exports, URL, AbortController, DOMException,
      performance, setTimeout, clearTimeout,
      process: { env: { GEOAPIFY_API_KEY: secret } },
      fetch: async (url) => ({ ok: true, status: 200, json: async () => providerFetch(url) }),
      require: (moduleName) => {
        if (moduleName === "node:async_hooks") return { AsyncLocalStorage };
        if (moduleName === "zod") return { z };
        if (moduleName === "@/integrations/supabase/auth-middleware") return { requireSupabaseAuth: {} };
        if (moduleName === "@tanstack/react-start") return {
          createServerFn: () => {
            let parse = (data) => data;
            const chain = {
              middleware: () => chain,
              validator: (fn) => { parse = fn; return chain; },
              handler: (fn) => ({ data }) => fn({ data: parse(data), context: { supabase: { rpc } } }),
            };
            return chain;
          },
        };
        if (!moduleName.startsWith(".")) throw new Error("Unexpected import: " + moduleName);
        return load(resolve(dirname(path), moduleName + ".ts"));
      },
    }, { filename: path });
    return module.exports;
  }
  return load(resolve("src/lib/matrundan/geoapify.functions.ts")).searchPlaceDiscovery;
}
async function appTest(search, text, radiusKm) {
  const before = calls.length;
  const started = performance.now();
  const input = {
    groupId: "38910000-0000-4000-8000-000000000001", text, centers: [center],
    radiusKm, offset: 0, limit: 20, providerRequestLimit: 25, providerCreditLimit: 40,
  };
  try {
    const first = await search({ data: { ...input, searchPhase: "primary" } });
    const primaryMs = Math.round(performance.now() - started);
    const second = first.pendingRecovery ? await search({ data: {
      ...input, searchPhase: "recovery",
      providerRequestLimit: Math.max(0, 25 - (first.budgetUsage?.requests ?? 0)),
      providerCreditLimit: Math.max(0, 40 - (first.budgetUsage?.reservedCredits ?? 0)),
    } }) : null;
    const results = [...first.results, ...(second?.results ?? [])].map((place) => place.name);
    measurements.push({
      mode: "actual-server-adapter-stubbed-db", label: text, kind: "searchPlaceDiscovery", radiusKm,
      ms: Math.round(performance.now() - started), primaryMs,
      extraRoundtrip: Boolean(second), total: results.length,
      matches: results.filter((name) => normalize(name).includes(normalize(text))).length,
      exampleNames: results.slice(0, 3), primaryObservation: first.observation || null,
      recoveryObservation: second?.observation || null, calls: calls.slice(before),
    });
  } catch (error) {
    measurements.push({
      mode: "actual-server-adapter-stubbed-db", label: text, kind: "searchPlaceDiscovery", radiusKm,
      ms: Math.round(performance.now() - started), error: String(error?.message || error),
      calls: calls.slice(before),
    });
  }
}
function report() {
  const outputDir = process.env.DIAGNOSTIC_OUTPUT_DIR || "search-diagnostic";
  mkdirSync(outputDir, { recursive: true });
  const summary = {
    commit: process.env.GITHUB_SHA || "local",
    scope: "Live provider HTTP and actual server adapter with mocked auth/DB; no live browser/database.",
    budget: { creditLimit: maxCredits, reservedUpperBound: reserved, requests: count, maxCalls, halted },
    measurements,
  };
  writeFileSync(resolve(outputDir, "results.json"), JSON.stringify(summary, null, 2));
  const lines = [
    "# Geoapify – samlad sökdiagnostik",
    "",
    "Read-only provideranrop och faktisk serveradapter med mockad auth/databas. **Inte autentiserat E2E-test.**",
    "",
    "Anrop: " + count + ". Reserverade krediter (konservativ uppskattning): " + reserved + ".",
    "",
    "| Test | Väg | Radie | Totalt ms | Primär ms | Träffar | Namnmatch | Anrop | Status |",
    "|---|---|---:|---:|---:|---:|---:|---:|---|",
    ...measurements.map((m) => "| " + [
      m.label, m.mode === "direct" ? m.kind : "appadapter", m.radiusKm, m.ms,
      m.primaryMs ?? "-", m.total ?? "-", m.matches ?? "-", m.calls.length, m.error || "ok",
    ].join(" | ") + " |"),
  ];
  writeFileSync(resolve(outputDir, "summary.md"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}
try {
  for (const [text, radius] of sample) {
    if (halted) break;
    for (const kind of kinds) {
      if (halted) break;
      await direct(kind, text, radius);
    }
  }
  if (!halted) await direct("places", "Ox Lan", 5, "Ox Lan venue bias");
  if (!halted) {
    const search = makeServerAdapter();
    for (const [text, radius] of sample) {
      if (halted) break;
      await appTest(search, text, radius);
    }
  }
} finally {
  report();
}
if (halted) throw new Error("Provider authentication/rate limit or diagnostic budget stopped the study.");
const brokenDirectPlaces = measurements.filter((m) => m.mode === "direct" && m.kind === "places" && m.error);
if (brokenDirectPlaces.length) {
  throw new Error("Direct Places contract failures: " + brokenDirectPlaces.map((m) => m.label).join(", ") + ". Review diagnostic artifact.");
}
if (!measurements.some((m) => !m.error)) throw new Error("All probes failed. Check staging key and provider access.");
