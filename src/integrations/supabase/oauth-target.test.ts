import { describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";

const PROD_BROWSER_URL = "https://app.matrundan.workers.dev";
const PROD_SUPABASE = "https://wsikirbxqejjwtgxcvjl.supabase.co";
const STAGING_SUPABASE = "https://wpihfmwbubvdiaavtpia.supabase.co";
const TEST_PUBLISHABLE_KEY = "sb_publishable_environment_contract_test";

async function googleOAuthTargetFor(supabaseUrl: string): Promise<URL> {
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
      redirectTo: PROD_BROWSER_URL,
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
});
