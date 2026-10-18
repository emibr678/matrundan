import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

// Exercise the actual Cloudflare production bundle and TanStack routing over
// loopback HTTP. Bun hosts the Worker's fetch export; this is not an edge smoke.
const root = fileURLToPath(new URL("..", import.meta.url));
const identity = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: root });
assert.equal(identity.exitCode, 0, "Kunde inte läsa checkoutens head");
const release = identity.stdout.toString().trim();
const isolated = {
  MATRUNDAN_ENVIRONMENT: "prod",
  MATRUNDAN_RELEASE_SHA: release,
  WORKERS_CI_COMMIT_SHA: release,
  MATRUNDAN_PUBLIC_URL: "https://app.matrundan.workers.dev",
  SUPABASE_URL: "http://127.0.0.1:54321",
  VITE_SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ux_review_isolated",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ux_review_isolated",
  SUPABASE_SERVICE_ROLE_KEY: "ux-review-isolated-not-a-secret",
  GEOAPIFY_API_KEY: "ux-review-isolated-not-a-secret",
  VITE_GEOAPIFY_MAPS_KEY: "ux-review-isolated-not-a-secret",
  VAPID_PRIVATE_KEY: "ux-review-isolated-not-a-secret",
};

const build = Bun.spawn([process.execPath, "run", "cloudflare:build"], {
  cwd: root,
  env: { ...process.env, ...isolated },
  stdout: "inherit",
  stderr: "inherit",
});
assert.equal(await build.exited, 0, "Produktionsbygget misslyckades");

// Runtime bindings cannot enable a tool compiled for prod. Keep external
// services isolated as well; no staging/production credentials are needed.
Object.assign(process.env, isolated);
const { default: worker } = await import(new URL("../.output/server/index.mjs", import.meta.url));
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request) =>
    worker.fetch(request, isolated, {
      waitUntil: (promise) => promise.catch(() => {}),
      passThroughOnException() {},
    }),
});

try {
  const cases = [
    { path: "/ux-granskning" },
    { path: "/ux-granskning?demo=1&environment=staging" },
    {
      path: "/ux-granskning?environment=local&url=/exempel",
      headers: { Host: "app.matrundan.workers.dev" },
    },
    {
      path: "/ux-granskning",
      headers: {
        Host: "staging.matrundan.workers.dev",
        "X-Forwarded-Host": "staging.matrundan.workers.dev",
        "X-Forwarded-Proto": "https",
      },
    },
    { path: "/ux-granskning", headers: { Accept: "application/json" } },
    { path: "/ux-granskning", method: "HEAD" },
  ];
  for (const { path, method = "GET", headers } of cases) {
    const response = await fetch(new URL(path, server.url), {
      method,
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.text();
    assert.equal(response.status, 404, `${method} ${path}`);
    assert.equal(body, method === "HEAD" ? "" : "Sidan hittades inte");
    assert.equal(response.headers.get("cache-control"), "no-store");
    console.log(`${method} ${path}: 404`);
  }

  // Positive control: the built application runs; this is not a server that
  // returns a generic 404 for every path or an omitted review route.
  const app = await fetch(new URL("/?demo=1", server.url), {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(app.status, 200);
  const html = await app.text();
  assert.ok(html.includes("Matrundan"));
  assert.ok(!html.includes('href="/ux-granskning"'));
  console.log(`Produktionsbyggd app ${release}: 6/6 spärrprov, appkontroll 200.`);
} finally {
  await server.stop(true);
}
