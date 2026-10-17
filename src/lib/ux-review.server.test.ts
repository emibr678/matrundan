import { describe, expect, test } from "bun:test";
import { handleUxReviewRequest } from "./ux-review.server";

describe("UX-granskningens miljö- och inramningsgräns", () => {
  test.each(["prod", "unknown"] as const)("svarar 404 i %s", async (environment) => {
    const response = handleUxReviewRequest(environment);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("<iframe");
  });

  test.each(["local", "staging"] as const)(
    "serverar endast samma miljö i %s",
    async (environment) => {
      const response = handleUxReviewRequest(environment);
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
