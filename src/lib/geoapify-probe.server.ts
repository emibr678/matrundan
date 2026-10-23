// TEMPORARY RESEARCH ONLY. Do not merge diagnostics/geoapify-search-probe.
import { createClient } from "@supabase/supabase-js";
import { APP_ENVIRONMENT } from "./app-environment";
import { RELEASE_SHA } from "./release-metadata";
import { PROBE_JOBS, STUDY_ID, STUDY_CATALOGUE_SIZE, STUDY_LOCATIONS, PROBE_LIMIT, PROBE_MAX_NEW_CALLS, PROBE_MAX_NEW_RESERVED_CREDITS, type ProbeJob } from "./geoapify-probe-plan";
import { probeDocument } from "./geoapify-probe-document";

// Fail closed until the existing operator signs in and their verified subject
// fingerprint is deliberately pinned in this server-only file. No email export.
const OPERATOR_SUB_SHA256: readonly string[] = ["03cc6c266baf3cfc7f99643126866a643ff664132e6fa870e917e1f181c22aa6"];
const EXPIRES_AT = Date.parse("2026-11-03T00:00:00Z");
// Independent new study; earlier consumed attempts remain recorded in older exports.
// Per-isolate server guard and per-browser durable budget are complementary,
// not a globally transactional provider-credit limit.
const MAX_NEW_CALLS = PROBE_MAX_NEW_CALLS;
const MAX_NEW_CREDIT_RESERVATION = PROBE_MAX_NEW_RESERVED_CREDITS;
const LIMIT = PROBE_LIMIT;
type Job = ProbeJob & { offset?: number; limit?: number };
type Place = { id: string; name: string; address: string; categories: string[]; lat?: number; lon?: number; osm: Record<string, string> };
type Row = { job: Job; at: string; status: number | null; durationMs: number; count: number; capped: boolean; places: Place[]; error?: string; credits: null };
// Process-local cache only; avoids reissuing an identical request in the same
// isolate. Durability and resume belong to the user's IndexedDB store.
const inFlightOrComplete = new Map<string, Promise<Row>>();
let isolateCalls = 0;
let isolateCreditsReserved = 0;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" } });
}
function allowedHost(request: Request) {
  const url = new URL(request.url);
  return APP_ENVIRONMENT === "staging" && url.protocol === "https:" && /^[a-z0-9-]+-staging\.matrundan\.workers\.dev$/.test(url.hostname) && Date.now() < EXPIRES_AT;
}
async function operatorFingerprint(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer ([^.]+\.[^.]+\.[^.]+)$/.exec(header)?.[1];
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const authFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_publishable_") && headers.get("authorization") === `Bearer ${key}`) headers.delete("authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  }) as typeof fetch;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: authFetch } });
  try {
    const { data, error } = await client.auth.getClaims(token);
    if (error || !data?.claims?.sub || data.claims.role !== "authenticated") return null;
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data.claims.sub));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}
const safeText = (value: unknown, max = 500): string => typeof value === "string" ? value.slice(0, max) : "";
function placeFrom(value: unknown): Place {
  const feature = value as { properties?: Record<string, unknown> };
  const p = feature.properties ?? {};
  const raw = (p.datasource as { raw?: Record<string, unknown> } | undefined)?.raw ?? {};
  // Explicit public OSM food tags only. Never return raw provider payloads.
  const osm: Record<string, string> = {};
  for (const field of ["amenity", "shop", "cuisine", "diet:vegetarian", "diet:vegan", "breakfast", "brunch", "lunch", "food", "takeaway"]) {
    if (typeof raw[field] === "string") osm[field] = safeText(raw[field]);
  }
  return { id: safeText(p.place_id), name: safeText(p.name), address: safeText(p.formatted), categories: Array.isArray(p.categories) ? p.categories.filter((c): c is string => typeof c === "string").slice(0, 50) : [], lat: typeof p.lat === "number" ? p.lat : undefined, lon: typeof p.lon === "number" ? p.lon : undefined, osm };
}
async function call(job: Job): Promise<Row> {
  // Reserve before await: overlapping requests and failures cannot reuse budget.
  const requestedLimit = job.limit ?? LIMIT;
  const estimatedCreditsUpperBound = Math.ceil(requestedLimit / 20);
  if (requestedLimit < 1 || requestedLimit > LIMIT ||
      isolateCalls >= MAX_NEW_CALLS ||
      isolateCreditsReserved + estimatedCreditsUpperBound > MAX_NEW_CREDIT_RESERVATION) {
    throw new Error("BUDGET_EXHAUSTED");
  }
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) throw new Error("KEY_MISSING");
  isolateCalls += 1;
  isolateCreditsReserved += estimatedCreditsUpperBound;
  const start = performance.now();
  const row: Row = { job, at: new Date().toISOString(), status: null, durationMs: 0, count: 0, capped: false, places: [], credits: null };
  try {
    const response = await fetch("https://api.geoapify.com/v2/places", {
      method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ categories: [...job.categories], ...(job.conditions.length ? { conditions: [...job.conditions] } : {}), filter: { type: "circle", lat: job.area.lat, lon: job.area.lon, radius: job.area.radius }, bias: { type: "proximity", lat: job.area.lat, lon: job.area.lon }, limit: job.limit ?? LIMIT, offset: job.offset ?? 0, lang: "sv" }),
      signal: AbortSignal.timeout(15_000), redirect: "manual",
    });
    row.status = response.status;
    if (response.ok) {
      const payload = await response.json() as { features?: unknown[] };
      if (!Array.isArray(payload.features)) row.error = "INVALID_RESPONSE";
      else { row.count = payload.features.length; row.capped = row.count === (job.limit ?? LIMIT); row.places = payload.features.map(placeFrom); }
    } else row.error = "GEOAPIFY_HTTP_" + response.status;
  } catch { row.error = "NETWORK_OR_TIMEOUT"; }
  row.durationMs = Math.round(performance.now() - start);
  return row;
}
export async function handleGeoapifyProbe(request: Request): Promise<Response> {
  if (!allowedHost(request)) return new Response("Sidan hittades inte", { status: 404 });
  if (request.method === "GET" && new URL(request.url).searchParams.get("compat") === "1") {
    // Zero network calls: isolate Request-constructor compatibility only.
    const supported = (redirect: RequestRedirect) => {
      try { new Request("https://api.geoapify.com/v2/places", { redirect }); return true; }
      catch { return false; }
    };
    return json({ release: RELEASE_SHA, networkCalls: 0, requestRedirectErrorSupported: supported("error"), requestRedirectManualSupported: supported("manual") });
  }
  if (request.method === "GET") {
    const nonce = crypto.randomUUID();
    return new Response(probeDocument(nonce, RELEASE_SHA, PROBE_JOBS, STUDY_ID, MAX_NEW_CALLS, MAX_NEW_CREDIT_RESERVATION), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` } });
  }
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("content-type") !== "application/json") return json({ error: "ORIGIN_REJECTED" }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 2000) return json({ error: "INVALID_INPUT" }, 400);
  const input = await request.json().catch(() => null) as {
    action?: string; index?: number; offset?: number
  } | null;
  if (!input || !["status", "query"].includes(input.action ?? "")) return json({ error: "INVALID_INPUT" }, 400);
  const configured = Boolean(process.env.GEOAPIFY_API_KEY?.trim());
  const operator = await operatorFingerprint(request);
  const authorized = !!operator && OPERATOR_SUB_SHA256.includes(operator);
  if (input.action === "status") return json({
    configured, authenticated: !!operator, authorized, release: RELEASE_SHA,
    studyId: STUDY_ID, jobCount: PROBE_JOBS.length,
    catalogueSize: STUDY_CATALOGUE_SIZE, locations: STUDY_LOCATIONS,
    maxFurtherCalls: MAX_NEW_CALLS, maxFurtherReservedCredits: MAX_NEW_CREDIT_RESERVATION,
    expiresAt: new Date(EXPIRES_AT).toISOString(),
  });
  if (!configured) return json({ error: "KEY_MISSING" }, 503);
  if (!authorized) return json({ error: "OPERATOR_REQUIRED" }, 403);
  // Strict, fixed allowlist: clients cannot supply coordinates, provider keys,
  // categories, unplanned pagination or arbitrary API requests.
  if (!Number.isInteger(input.index) || input.index! < 0 || input.index! >= PROBE_JOBS.length ||
      !Number.isInteger(input.offset) || input.offset! < 0 || input.offset! % LIMIT !== 0) {
    return json({ error: "JOB_NOT_ALLOWED" }, 400);
  }
  const job = PROBE_JOBS[input.index!];
  if (input.offset! >= job.maxPages * LIMIT) return json({ error: "PAGE_NOT_ALLOWED" }, 400);
  const id = input.index + ":" + input.offset;
  let work = inFlightOrComplete.get(id);
  if (!work) {
    // Only one in-flight request per isolate. No automatic retries.
    work = call({ ...job, offset: input.offset }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "UNKNOWN";
      return { job: { ...job, offset: input.offset }, at: new Date().toISOString(),
        status: null, durationMs: 0, count: 0, capped: false, places: [], credits: null,
        error: message };
    });
    inFlightOrComplete.set(id, work);
  }
  const row = await work;
  return json({ row, callsInCurrentIsolate: isolateCalls,
    reservedCreditsInCurrentIsolate: isolateCreditsReserved });
}
