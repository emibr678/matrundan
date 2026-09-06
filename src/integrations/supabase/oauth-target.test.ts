import { describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";

import { shouldManuallyNavigateOAuth, validatedOAuthAuthorizeUrl } from "./oauth-target";

const PROD_BROWSER_URL = "https://app.matrundan.workers.dev";
const LOVABLE_PREVIEW_URL = "https://preview--matrundan.lovable.app";
const PROD_SUPABASE = "https://wsikirbxqejjwtgxcvjl.supabase.co";
const STAGING_SUPABASE = "https://wpihfmwbubvdiaavtpia.supabase.co";
const TEST_PUBLISHABLE_KEY = "sb_publishable_environment_contract_test";

async function googleOAuthTargetFor(
  supabaseUrl: string,
  browserUrl = PROD_BROWSER_URL,
): Promise<URL> {
  const client = createClient(supabaseUrl, TEST_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: browserUrl,
      skipBrowserRedirect: true,
    },
  });

  expect(error).toBeNull();
  expect(data.url).toBeTruthy();
  return new URL(data.url!);
}

describe("Google OAuth environment target", () => {
  test("production Supabase client targets production auth", async () => {
    const target = await googleOAuthTargetFor(PROD_SUPABASE);

    expect(target.hostname).toBe("wsikirbxqejjwtgxcvjl.supabase.co");
    expect(target.pathname).toBe("/auth/v1/authorize");
    expect(target.searchParams.get("provider")).toBe("google");
    expect(target.searchParams.get("redirect_to")).toBe(PROD_BROWSER_URL);
  });

  test("a staging-configured client would target staging auth", async () => {
    const target = await googleOAuthTargetFor(STAGING_SUPABASE);

    expect(target.hostname).toBe("wpihfmwbubvdiaavtpia.supabase.co");
    expect(target.hostname).not.toBe("wsikirbxqejjwtgxcvjl.supabase.co");
  });

  test("Lovable preview uses explicit browser navigation to staging Supabase auth", async () => {
    expect(shouldManuallyNavigateOAuth(LOVABLE_PREVIEW_URL)).toBe(true);
    expect(shouldManuallyNavigateOAuth(PROD_BROWSER_URL)).toBe(false);

    const target = await googleOAuthTargetFor(STAGING_SUPABASE, LOVABLE_PREVIEW_URL);
    expect(validatedOAuthAuthorizeUrl(LOVABLE_PREVIEW_URL, target.toString())).toBe(
      target.toString(),
    );
    expect(target.hostname).toBe("wpihfmwbubvdiaavtpia.supabase.co");
    expect(target.searchParams.get("redirect_to")).toBe(LOVABLE_PREVIEW_URL);
  });

  test("Lovable preview refuses OAuth navigation to production or legacy hosts", async () => {
    const prodTarget = await googleOAuthTargetFor(PROD_SUPABASE, LOVABLE_PREVIEW_URL);

    expect(() => validatedOAuthAuthorizeUrl(LOVABLE_PREVIEW_URL, prodTarget.toString())).toThrow(
      "MATRUNDAN_OAUTH_TARGET_MISMATCH",
    );
    expect(() =>
      validatedOAuthAuthorizeUrl(
        LOVABLE_PREVIEW_URL,
        "https://bkyzxkfrenbbkgiymofk.supabase.co/auth/v1/authorize?provider=google",
      ),
    ).toThrow("MATRUNDAN_OAUTH_TARGET_MISMATCH");
  });
});
