import { describe, expect, test } from "bun:test";
import { handleUxReviewRequest } from "./ux-review.server";

const local = "http://127.0.0.1:4173/ux-granskning";
const staging =
  "https://spike-500-work-viewport-review-staging.matrundan.workers.dev/ux-granskning";

describe("UX-granskningens miljö- och inramningsgräns", () => {
  test.each(["prod", "unknown"] as const)(
    "svarar 404 i %s även på tillåten origin",
    async (environment) => {
      for (const url of [local, staging]) {
        const response = handleUxReviewRequest(new Request(url), environment);
        expect(response.status).toBe(404);
        expect(await response.text()).not.toContain("<iframe");
      }
    },
  );

  test.each(["local", "staging"] as const)(
    "nekar produktions- och okända origins även med %s-bygge",
    (environment) => {
      for (const host of [
        "app.matrundan.workers.dev",
        "prod-candidate-app.matrundan.workers.dev",
        "example.com",
      ]) {
        const request = new Request(`https://${host}/ux-granskning?environment=staging&demo=1`, {
          headers: { "x-forwarded-host": "staging.matrundan.workers.dev" },
        });
        expect(handleUxReviewRequest(request, environment).status).toBe(404);
      }
    },
  );

  test("nekar blandade lokala och stagingidentiteter", () => {
    expect(handleUxReviewRequest(new Request(local), "staging").status).toBe(404);
    expect(handleUxReviewRequest(new Request(staging), "local").status).toBe(404);
  });

  test.each(["local", "staging"] as const)(
    "serverar endast samma miljö i %s",
    async (environment) => {
      const response = handleUxReviewRequest(
        new Request(environment === "local" ? local : staging),
        environment,
      );
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      const csp = response.headers.get("content-security-policy")!;
      expect(csp).toContain("frame-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
      expect(nonce).toBeTruthy();
      expect(html).toContain(`<script nonce="${nonce}">`);
      expect(html).toContain('title="Matrundan i granskningsvy" src="/exempel"');
    },
  );
});
