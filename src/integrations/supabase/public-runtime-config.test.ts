import { describe, expect, test } from "bun:test";
import { resolvePublicSupabaseConfig } from "./public-runtime-config";

const LOVABLE_PREVIEW = "https://id-preview--d389634e-227c-4689-85ed-8714fdc602f7.lovable.app/";
const STABLE_LOVABLE_PREVIEW = "https://preview--matrundan.lovable.app/";
const STAGING_SUPABASE = "https://wpihfmwbubvdiaavtpia.supabase.co";
const PROD_SUPABASE = "https://wsikirbxqejjwtgxcvjl.supabase.co";

describe("Lovable public Supabase runtime config", () => {
  test("falls back to Matrundan Staging only for known Lovable preview hosts", () => {
    for (const runtimeUrl of [LOVABLE_PREVIEW, STABLE_LOVABLE_PREVIEW]) {
      const resolved = resolvePublicSupabaseConfig({ runtimeUrl });
      expect(resolved.source).toBe("lovable-staging-fallback");
      expect(resolved.url).toBe(STAGING_SUPABASE);
      expect(resolved.publishableKey?.startsWith("sb_publishable_")).toBe(true);
    }
  });

  test("does not fall back for production, Cloudflare staging, local or unrelated Lovable hosts", () => {
    for (const runtimeUrl of [
      "https://app.matrundan.workers.dev/",
      "https://staging.matrundan.workers.dev/",
      "http://localhost:3000/",
      "https://another-project.lovable.app/",
    ]) {
      expect(resolvePublicSupabaseConfig({ runtimeUrl })).toEqual({ source: "missing" });
    }
  });

  test("keeps explicit configuration so the deployment environment contract can reject mismatches", () => {
    expect(
      resolvePublicSupabaseConfig({
        runtimeUrl: LOVABLE_PREVIEW,
        configuredUrl: PROD_SUPABASE,
        configuredPublishableKey: "sb_publishable_prod",
      }),
    ).toEqual({
      url: PROD_SUPABASE,
      publishableKey: "sb_publishable_prod",
      source: "configured",
    });
  });

  test("does not hide partial explicit configuration with the preview fallback", () => {
    expect(
      resolvePublicSupabaseConfig({
        runtimeUrl: LOVABLE_PREVIEW,
        configuredUrl: STAGING_SUPABASE,
      }),
    ).toEqual({
      url: STAGING_SUPABASE,
      publishableKey: undefined,
      source: "configured",
    });
  });

  test("supports the server-side Lovable sandbox only for the exact Matrundan project", () => {
    const resolved = resolvePublicSupabaseConfig({
      runtimeUrl: "http://localhost:8080/",
      lovableProjectId: "d389634e-227c-4689-85ed-8714fdc602f7",
      lovableSandbox: "1",
    });
    expect(resolved.source).toBe("lovable-staging-fallback");
    expect(resolved.url).toBe(STAGING_SUPABASE);

    expect(
      resolvePublicSupabaseConfig({
        runtimeUrl: "http://localhost:8080/",
        lovableProjectId: "00000000-0000-4000-8000-000000000000",
        lovableSandbox: "1",
      }),
    ).toEqual({ source: "missing" });
  });
});
