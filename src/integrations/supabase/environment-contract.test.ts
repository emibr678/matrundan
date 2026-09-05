import { describe, expect, test } from "bun:test";
import {
  expectedSupabaseHostForBrowserUrl,
  hasSupabaseEnvironmentMismatch,
} from "./environment-contract";

const STAGING_SUPABASE = "https://wpihfmwbubvdiaavtpia.supabase.co";
const PROD_SUPABASE = "https://wsikirbxqejjwtgxcvjl.supabase.co";
const LEGACY_LOVABLE_CLOUD_SUPABASE = "https://bkyzxkfrenbbkgiymofk.supabase.co";
const LOVABLE_PREVIEW =
  "https://id-preview--d389634e-227c-4689-85ed-8714fdc602f7.lovable.app/";

describe("Supabase deployment environment contract", () => {
  test("maps stable and preview deployment hosts to the correct Supabase project", () => {
    expect(expectedSupabaseHostForBrowserUrl("https://app.matrundan.workers.dev/")).toBe(
      "wsikirbxqejjwtgxcvjl.supabase.co",
    );
    expect(
      expectedSupabaseHostForBrowserUrl("https://prod-candidate-app.matrundan.workers.dev/"),
    ).toBe("wsikirbxqejjwtgxcvjl.supabase.co");
    expect(expectedSupabaseHostForBrowserUrl("https://staging.matrundan.workers.dev/")).toBe(
      "wpihfmwbubvdiaavtpia.supabase.co",
    );
    expect(
      expectedSupabaseHostForBrowserUrl("https://feature-staging.matrundan.workers.dev/"),
    ).toBe("wpihfmwbubvdiaavtpia.supabase.co");
    expect(expectedSupabaseHostForBrowserUrl(LOVABLE_PREVIEW)).toBe(
      "wpihfmwbubvdiaavtpia.supabase.co",
    );
  });

  test("does not enforce a provider environment on local or unknown hosts", () => {
    expect(expectedSupabaseHostForBrowserUrl("http://localhost:3000/")).toBeNull();
    expect(expectedSupabaseHostForBrowserUrl("https://matrundan.lovable.app/")).toBeNull();
    expect(expectedSupabaseHostForBrowserUrl("https://example.com/")).toBeNull();
  });

  test("rejects staging Supabase from production and production Supabase from staging", () => {
    expect(
      hasSupabaseEnvironmentMismatch("https://app.matrundan.workers.dev/", STAGING_SUPABASE),
    ).toBe(true);
    expect(
      hasSupabaseEnvironmentMismatch("https://staging.matrundan.workers.dev/", PROD_SUPABASE),
    ).toBe(true);
  });

  test("rejects production and legacy Lovable Cloud backends from Lovable preview", () => {
    expect(hasSupabaseEnvironmentMismatch(LOVABLE_PREVIEW, PROD_SUPABASE)).toBe(true);
    expect(
      hasSupabaseEnvironmentMismatch(LOVABLE_PREVIEW, LEGACY_LOVABLE_CLOUD_SUPABASE),
    ).toBe(true);
  });

  test("accepts the matching Supabase project for each deployment", () => {
    expect(
      hasSupabaseEnvironmentMismatch("https://app.matrundan.workers.dev/", PROD_SUPABASE),
    ).toBe(false);
    expect(
      hasSupabaseEnvironmentMismatch("https://staging.matrundan.workers.dev/", STAGING_SUPABASE),
    ).toBe(false);
    expect(hasSupabaseEnvironmentMismatch(LOVABLE_PREVIEW, STAGING_SUPABASE)).toBe(false);
  });
});
