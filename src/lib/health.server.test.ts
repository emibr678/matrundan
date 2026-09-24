import { describe, expect, test } from "bun:test";

import { handleHealthRequest } from "./health.server";

const SUPABASE_URL = "https://example.supabase.co";
const PUBLISHABLE_KEY = "test-publishable-key";

type TestFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => Promise<Response>;

async function withHealthEnvironment<T>(fetchImpl: TestFetch, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const originalEnvironment = process.env.MATRUNDAN_ENVIRONMENT;

  globalThis.fetch = fetchImpl as typeof fetch;
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE_KEY;
  process.env.MATRUNDAN_ENVIRONMENT = "prod";

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl == null) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey == null) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
    if (originalEnvironment == null) delete process.env.MATRUNDAN_ENVIRONMENT;
    else process.env.MATRUNDAN_ENVIRONMENT = originalEnvironment;
  }
}

describe("platform health", () => {
  test("verifierar både Supabase Auth och en datalös Postgres-RPC", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch: TestFetch = async (input, init) => {
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
    expect(headers.get("authorization")).toBeNull();
  });

  test("rapporterar degraded om Postgres-proben misslyckas", async () => {
    let requestNumber = 0;
    const fakeFetch: TestFetch = async () => {
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
