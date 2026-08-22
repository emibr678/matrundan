import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sessionSource = readFileSync(
  resolve(process.cwd(), "src/lib/matrundan/session.tsx"),
  "utf8",
);

describe("portabel Google-auth", () => {
  test("använder Supabase OAuth direkt utan Lovable Cloud-authadapter", () => {
    expect(sessionSource).toContain("supabase.auth.signInWithOAuth");
    expect(sessionSource).toContain('provider: "google"');
    expect(sessionSource).toContain("redirectTo: origin");
    expect(sessionSource).not.toContain("@/integrations/lovable");
    expect(sessionSource).not.toContain("@lovable.dev/cloud-auth-js");
  });

  test("bevarar aktuell origin och pending invite genom OAuth-redirecten", () => {
    expect(sessionSource).toContain(
      "if (opts?.redirectPath) setPendingInvitePath(opts.redirectPath)",
    );
    expect(sessionSource).toContain("redirectTo: origin");
  });
});
