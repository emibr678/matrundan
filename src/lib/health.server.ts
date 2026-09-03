import { RELEASE_SHA } from "./release-metadata";
import { logUnexpectedServerError, responseWithRequestId } from "./server-observability";

const HEALTH_TIMEOUT_MS = 5_000;

function supabaseHealthHeaders(publishableKey: string): HeadersInit {
  return {
    accept: "application/json",
    apikey: publishableKey,
  };
}

async function checkSupabaseReachability(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("HEALTH_CONFIG_MISSING");
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/health`, {
    headers: supabaseHealthHeaders(publishableKey),
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });

  if (!authResponse.ok) {
    throw new Error(`SUPABASE_HEALTH_${authResponse.status}`);
  }

  const databaseResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/health_probe_v1`, {
    method: "POST",
    headers: {
      ...supabaseHealthHeaders(publishableKey),
      "content-type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });

  if (!databaseResponse.ok) {
    throw new Error(`SUPABASE_DB_HEALTH_${databaseResponse.status}`);
  }

  const databaseHealthy = await databaseResponse.json().catch(() => null);
  if (databaseHealthy !== true) {
    throw new Error("SUPABASE_DB_HEALTH_INVALID_RESPONSE");
  }
}

export async function handleHealthRequest(request: Request): Promise<Response> {
  const startedAt = performance.now();

  try {
    await checkSupabaseReachability();
    return Response.json(
      { status: "ok", release: RELEASE_SHA },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const errorId = logUnexpectedServerError(request, error, {
      operation: "/api/health",
      status: 503,
      durationMs: performance.now() - startedAt,
      dependency: "supabase",
      event: "health_check_failed",
    });
    return responseWithRequestId(
      Response.json(
        { status: "degraded" },
        { status: 503, headers: { "cache-control": "no-store" } },
      ),
      errorId,
    );
  }
}
