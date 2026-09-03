import { describe, expect, test } from "bun:test";

import { handleHealthRequest } from "./health.server";

const SUPABASE_URL = "https://example.supabase.co";
const PUBLISHABLE_KEY = "test-publishable-key";

async function withHealthEnvironment<T>(
  fetchImpl: typeof fetch,
  run: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  globalThis.fetch = fetchImpl;
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE_KEY;

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl == null) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey == null) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
}

describe("platform health", () => {
  test("verifierar både Supabase Auth och en datalös Postgres-RPC", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.endsWith("/auth/v1/health")) return Response.json({ status: "ok" });
      if (url.endsWith("/rest/v1/rpc/health_probe_v1")) return Response.json(true);
      return new Response(null, { status: 404 });
    };

    const response = await withHealthEnvironment(fakeFetch, () =>
      handleHealthRequest(new Request("https://app.matrundan.workers.dev/api/health")),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
    expect(requests.map(({ url }) => url)).toEqual([
      `${SUPABASE_URL}/auth/v1/health`,
      `${SUPABASE_URL}/rest/v1/rpc/health_probe_v1`,
    ]);

    const databaseRequest = requests[1];
    expect(databaseRequest?.init?.method).toBe("POST");
    expect(databaseRequest?.init?.body).toBe("{}");
    const headers = new Headers(databaseRequest?.init?.headers);
    expect(headers.get("apikey")).toBe(PUBLISHABLE_KEY);
    expect(headers.get("authorization")).toBe(`Bearer ${PUBLISHABLE_KEY}`);
  });

  test("rapporterar degraded om Postgres-proben misslyckas", async () => {
    let requestNumber = 0;
    const fakeFetch: typeof fetch = async () => {
      requestNumber += 1;
      if (requestNumber === 1) return Response.json({ status: "ok" });
      return Response.json({ message: "unavailable" }, { status: 503 });
    };

    const response = await withHealthEnvironment(fakeFetch, () =>
      handleHealthRequest(new Request("https://app.matrundan.workers.dev/api/health")),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded" });
    expect(response.headers.get("x-matrundan-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
