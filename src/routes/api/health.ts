import { createFileRoute } from "@tanstack/react-router";

import { RELEASE_SHA } from "@/lib/release-metadata";
import { logUnexpectedServerError } from "@/lib/server-observability";

const HEALTH_TIMEOUT_MS = 5_000;

async function checkSupabaseReachability(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("HEALTH_CONFIG_MISSING");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/groups?select=id&limit=1`, {
    headers: {
      accept: "application/json",
      apikey: publishableKey,
    },
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`SUPABASE_HEALTH_${response.status}`);
  }
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const startedAt = performance.now();

        try {
          await checkSupabaseReachability();
          return Response.json(
            { status: "ok", release: RELEASE_SHA },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (error) {
          logUnexpectedServerError(request, error, {
            operation: "/api/health",
            status: 503,
            durationMs: performance.now() - startedAt,
            dependency: "supabase",
            event: "health_check_failed",
          });
          return Response.json(
            { status: "degraded" },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
