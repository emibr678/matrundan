import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const authAdapterSource = readFileSync(
  resolve(process.cwd(), "src/integrations/lovable/index.ts"),
  "utf8",
);
const sessionSource = readFileSync(resolve(process.cwd(), "src/lib/matrundan/session.tsx"), "utf8");

describe("portabel Google-auth", () => {
  test("använder Supabase OAuth utan Lovable Cloud-authruntime", () => {
    expect(authAdapterSource).toContain("supabase.auth.signInWithOAuth");
    expect(authAdapterSource).toContain('provider: "google"');
    expect(authAdapterSource).toContain("redirectTo: opts?.redirect_uri");
    expect(authAdapterSource).not.toContain("@lovable.dev/cloud-auth-js");
    expect(authAdapterSource).not.toContain("createLovableAuth");
  });

  test("bevarar aktuell origin och pending invite genom OAuth-redirecten", () => {
    expect(sessionSource).toContain("if (opts?.redirectPath) setPendingInvitePath(opts.redirectPath)");
    expect(sessionSource).toContain("redirect_uri: origin");
  });
});
