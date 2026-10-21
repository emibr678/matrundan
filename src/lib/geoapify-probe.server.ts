// TEMPORARY RESEARCH ONLY. Do not merge diagnostics/geoapify-search-probe.
import { createClient } from "@supabase/supabase-js";
import { APP_ENVIRONMENT } from "./app-environment";
import { RELEASE_SHA } from "./release-metadata";
import { PROBE_JOBS } from "./geoapify-probe-plan";
import { probeDocument } from "./geoapify-probe-document";

// Fail closed until the existing operator signs in and their verified subject
// fingerprint is deliberately pinned in this server-only file. No email export.
const OPERATOR_SUB_SHA256: readonly string[] = ["03cc6c266baf3cfc7f99643126866a643ff664132e6fa870e917e1f181c22aa6"];
const EXPIRES_AT = Date.parse("2026-10-23T00:00:00Z");
const MAX_CALLS = 60;
const LIMIT = 100;
type Job = { id: string; area: { id: string; label: string; lat: number; lon: number; radius: number }; strategy: string; categories: readonly string[]; conditions: readonly string[]; offset?: number; limit?: number };
type Place = { id: string; name: string; address: string; categories: string[]; lat?: number; lon?: number; osm: Record<string, string> };
type Row = { job: Job; at: string; status: number | null; durationMs: number; count: number; capped: boolean; places: Place[]; error?: string; credits: null };
type Run = { operator: string; busy: boolean; cursor: number; calls: number; queue: Job[]; rows: Row[]; startedAt: number };
const runs = new Map<string, Run>();
// Conservatively carry the one failed attempt from head 12ca7298.
let isolateCalls = 1;
let smoke: { operator: string; row: Row } | undefined;
let activeRun: string | undefined;
let busy = false;

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
async function call(job: Job, run: Run | undefined): Promise<Row> {
  // Reserve before await: overlapping requests and failures cannot reuse budget.
  if (isolateCalls >= MAX_CALLS || (run && run.calls >= MAX_CALLS)) throw new Error("BUDGET_EXHAUSTED");
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) throw new Error("KEY_MISSING");
  isolateCalls += 1;
  if (run) run.calls += 1;
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
    return new Response(probeDocument(nonce, RELEASE_SHA, PROBE_JOBS), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` } });
  }
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("content-type") !== "application/json") return json({ error: "ORIGIN_REJECTED" }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 2000) return json({ error: "INVALID_INPUT" }, 400);
  const input = await request.json().catch(() => null) as { action?: string; runId?: string; cursor?: number } | null;
  if (!input || !["status", "smoke", "start", "next"].includes(input.action ?? "")) return json({ error: "INVALID_INPUT" }, 400);
  // A manual zero-call readiness check exposes only presence, never key values.
  const configured = Boolean(process.env.GEOAPIFY_API_KEY?.trim());
  const operator = await operatorFingerprint(request);
  if (input.action === "status") return json({ configured, authenticated: !!operator, authorized: !!operator && OPERATOR_SUB_SHA256.includes(operator), operatorFingerprint: operator, release: RELEASE_SHA, calls: isolateCalls, expiresAt: new Date(EXPIRES_AT).toISOString(), credits: "Not verified: no account billing access" });
  if (!configured) return json({ error: "KEY_MISSING", calls: 0 }, 503);
  if (!operator || !OPERATOR_SUB_SHA256.includes(operator)) return json({ error: "OPERATOR_REQUIRED" }, 403);
  if (input.action === "smoke") {
    if (smoke || busy || activeRun) return json({ error: "SMOKE_ALREADY_ATTEMPTED", calls: isolateCalls }, 409);
    busy = true;
    // Failed smoke consumes the one opportunity too. No automatic retry.
    smoke = { operator, row: { job: PROBE_JOBS[0], at: new Date().toISOString(), status: null, durationMs: 0, count: 0, capped: false, places: [], credits: null, error: "IN_PROGRESS" } };
    try { smoke.row = await call({ ...PROBE_JOBS[3], id: "smoke/sodermalm", limit: 1 }, undefined); return json({ row: smoke.row, calls: isolateCalls }); }
    finally { busy = false; }
  }
  if (input.action === "start") {
    if (busy || activeRun || !smoke || smoke.operator !== operator || smoke.row.status !== 200 || smoke.row.error) return json({ error: "SUCCESSFUL_SMOKE_REQUIRED_OR_ALREADY_STARTED" }, 409);
    const runId = crypto.randomUUID();
    activeRun = runId;
    runs.set(runId, { operator, busy: false, cursor: 0, calls: 1, queue: [...PROBE_JOBS], rows: [], startedAt: Date.now() });
    return json({ runId, cursor: 0, planned: PROBE_JOBS.length, calls: isolateCalls });
  }
  const run = runs.get(input.runId ?? "");
  if (!run || run.operator !== operator || Date.now() - run.startedAt > 3_600_000) return json({ error: "RUN_LOST_OR_EXPIRED_STOP_NO_RETRY" }, 410);
  if (run.busy || input.cursor !== run.cursor) return json({ error: "CURSOR_OR_CONCURRENCY_REJECTED" }, 409);
  if (run.cursor >= run.queue.length || isolateCalls >= MAX_CALLS) return json({ done: true, calls: isolateCalls, cursor: run.cursor });
  run.busy = true;
  const job = run.queue[run.cursor];
  run.cursor += 1;
  try {
    const row = await call(job, run);
    run.rows.push(row);
    // Nine extra pages maximum: 1 smoke + 50 fixed jobs + 9 pages = 60.
    if (row.capped && run.queue.length < 59) run.queue.push({ ...job, offset: (job.offset ?? 0) + LIMIT });
    const stop = !!row.error;
    if (stop) run.queue.length = run.cursor;
    return json({ row, calls: isolateCalls, cursor: run.cursor, planned: run.queue.length, done: stop || run.cursor >= run.queue.length || isolateCalls >= MAX_CALLS });
  } finally { run.busy = false; }
}
