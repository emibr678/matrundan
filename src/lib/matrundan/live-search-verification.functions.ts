/** Temporary read-only harness. Never merge this diagnostics branch. */
import { createServerFn } from "@tanstack/react-start";
import { toJSONAsync, fromCrossJSON } from "seroval";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { APP_ENVIRONMENT } from "@/lib/app-environment";
import { environmentForRequestUrl } from "@/lib/observability";
import type { SearchStreamCursor } from "./geoapify-catalogue-search";

const TARGETS = {
  main: {
    origin: "https://staging.matrundan.workers.dev",
    sha: "ead5a34a717004a22c60c4ab9dd57a81d201d34f",
  },
  candidate: {
    origin: "https://e1b4fd09-staging.matrundan.workers.dev",
    sha: "6899af48af17e2c5f9fca97f56e68f816bfd6a4e",
  },
} as const;
// TanStack's stable ID for the existing, unchanged authenticated discovery RPC.
const DISCOVERY_ID = "46ee11758cde399e4866f83129f058bf90986535cf802cd2297ddeeaa8bc5d2c";
const progressSchema = z.object({
  nextOffset: z.number().int().min(0).max(10000),
  areaOffsets: z.record(z.number().int().min(0).max(10000)),
  exhaustedAreaIds: z.array(z.string().max(100)).max(5),
  streamCursors: z
    .record(
      z.object({
        scope: z.string().max(10000),
        direct: z.number().int().min(0).max(10000),
        metadata: z.number().int().min(0).max(10000),
        metadataType: z.number().int().min(0).max(10),
        directDone: z.boolean(),
        metadataDone: z.boolean(),
      }),
    )
    .optional(),
});
export type ProbeProgress = z.infer<typeof progressSchema>;
type DiscoveryPage = {
  results: Array<{ externalId: string }>;
  hasMore: boolean;
  nextOffset: number;
  areaOffsets: Record<string, number>;
  exhaustedAreaIds: string[];
  streamCursors?: Record<string, SearchStreamCursor>;
  failedAreaIds: string[];
  canonicalIncomplete: boolean;
  budgetUsage: { requests: number; cacheHits?: number; reservedCredits: number; limited: boolean };
};

export const measureLiveSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z
      .object({
        groupId: z.string().uuid(),
        target: z.enum(["main", "candidate"]),
        strategy: z.enum(["restaurant", "sushi"]),
        areas: z.union([z.literal(1), z.literal(5)]),
        sample: z.number().int().min(0).max(1),
        action: z.enum(["first", "more"]),
        remainingCredits: z.number().int().min(0).max(240),
        progress: progressSchema.optional(),
      })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    if (APP_ENVIRONMENT !== "staging" || environmentForRequestUrl(request.url) !== "staging")
      throw new Error("PROBE_ENVIRONMENT_REJECTED");
    const target = TARGETS[data.target];
    // Fail closed if main or the immutable candidate no longer has the declared SHA.
    const healthStart = performance.now();
    let health: Response;
    try {
      health = await fetch(target.origin + "/api/health", {
        signal: AbortSignal.timeout(5000),
        redirect: "manual",
      });
    } catch (error) {
      throw new Error(
        error instanceof Error && error.name === "TimeoutError"
          ? "PROBE_HEALTH_TIMEOUT"
          : "PROBE_HEALTH_FETCH_" +
              (error instanceof Error ? error.message : "FAILED")
                .replace(/https?:\/\/\S+/g, "PUBLIC_ENDPOINT")
                .replace(/[^a-zA-Z0-9]+/g, "_")
                .toUpperCase()
                .slice(0, 180),
      );
    }
    const healthText = await health.text();
    if (!health.ok) {
      const code = healthText.includes("1042") ? "_CLOUDFLARE_1042" : "";
      throw new Error(`PROBE_HEALTH_HTTP_${health.status}${code}`);
    }
    let identity: { release?: string };
    try {
      identity = JSON.parse(healthText);
    } catch {
      throw new Error("PROBE_HEALTH_INVALID_JSON");
    }
    if (identity.release !== target.sha) throw new Error("PROBE_RELEASE_MISMATCH");
    const healthMs = performance.now() - healthStart;
    if (data.action === "more" && !data.progress) throw new Error("Fortsättning saknas");
    // Tiny fixed public-coordinate variations distinguish intended cold app-cache keys.
    // No key flushing, user location or persistent group search-setting writes.
    const shift = (1 + data.sample + (data.areas === 5 ? 4 : 0)) * 0.000013;
    const centers = [
      { id: "probe-stockholm", label: "Stockholm", lat: 59.3293, lng: 18.0686 },
      { id: "probe-goteborg", label: "Göteborg", lat: 57.7089, lng: 11.9746 },
      { id: "probe-malmo", label: "Malmö", lat: 55.605, lng: 13.0038 },
      { id: "probe-uppsala", label: "Uppsala", lat: 59.8586, lng: 17.6389 },
      { id: "probe-enskede", label: "Enskede", lat: 59.2835, lng: 18.0688 },
    ]
      .slice(0, data.areas)
      .map((c) => ({ ...c, lat: c.lat + shift, searchMode: "point" as const }));
    const progress = data.action === "more" ? data.progress : undefined;
    const credits = Math.min(40, data.remainingCredits);
    let httpMs = 0;
    const started = performance.now();
    try {
      const payload = {
        data: {
          groupId: data.groupId,
          centers,
          radiusKm: 5,
          limit: 20,
          text: data.strategy === "sushi" ? "Sushi" : "Restaurang",
          intentMode: "auto",
          selectedFilter:
            data.strategy === "sushi"
              ? { kind: "food-tag", id: "specialty:sushi" }
              : { kind: "category", id: "category:restaurang" },
          searchPhase: "primary",
          offset: progress?.nextOffset ?? 0,
          areaOffsets: progress?.areaOffsets ?? {},
          exhaustedAreaIds: progress?.exhaustedAreaIds ?? [],
          streamCursors: progress?.streamCursors,
          providerRequestLimit: 25,
          providerCreditLimit: credits,
        },
      };
      const body = JSON.stringify(await toJSONAsync(payload));
      const timer = performance.now();
      // Only the existing session's authorization header is forwarded server-side.
      // No redirects and no destinations controlled by callers.
      const response = await fetch(target.origin + "/_serverFn/" + DISCOVERY_ID, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: {
          authorization: request.headers.get("authorization")!,
          // Synthetic first-party HTTP client; the target's CSRF, JWT and group checks still run.
          origin: target.origin,
          "content-type": "application/json",
          accept: "application/json",
          "x-tsr-serverFn": "true",
        },
        body,
      });
      const responseText = await response.text();
      httpMs = performance.now() - timer;
      if (!response.ok || !response.headers.get("x-tss-serialized"))
        throw new Error(`PROBE_RPC_HTTP_${response.status}`);
      const wire = JSON.parse(responseText);
      const reply = fromCrossJSON(wire, {}) as { result?: DiscoveryPage; error?: unknown };
      if (reply.error || !reply.result) throw new Error("Sökfunktionen returnerade fel");
      const page = reply.result;
      return {
        sha: target.sha,
        healthMs,
        httpMs,
        relayMs: performance.now() - started,
        count: page.results.length,
        failedAreas: page.failedAreaIds.length,
        canonicalIncomplete: page.canonicalIncomplete,
        budget: page.budgetUsage,
        hasMore: page.hasMore,
        progress: {
          nextOffset: page.nextOffset,
          areaOffsets: page.areaOffsets,
          exhaustedAreaIds: page.exhaustedAreaIds,
          streamCursors: page.streamCursors,
        },
        error: null,
      };
    } catch (error) {
      // If no reliable budget receipt arrives, conservatively book the whole allowed reservation.
      return {
        sha: target.sha,
        healthMs,
        httpMs,
        relayMs: performance.now() - started,
        count: 0,
        failedAreas: data.areas,
        canonicalIncomplete: true,
        budget: { requests: null, cacheHits: undefined, reservedCredits: credits, limited: false },
        hasMore: false,
        progress: undefined,
        error:
          error instanceof Error && /^PROBE_RPC_HTTP_\d+$/.test(error.message)
            ? error.message
            : "Målanropet misslyckades; kostnaden är osäker",
      };
    }
  });
