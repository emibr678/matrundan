import { describe, expect, test } from "bun:test";

import { verifySupabaseEmailConfirmationPolicy } from "../../../scripts/supabase-auth-policy-check.mjs";

function response(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

describe("Supabase Auth email-confirmation policy", () => {
  test("accepts mailer_autoconfirm=false and sends only the publishable key", async () => {
    let request = null;
    const publishableKey = "sb_publishable_test-value";

    const result = await verifySupabaseEmailConfirmationPolicy({
      supabaseUrl: "https://example.supabase.co",
      publishableKey,
      environment: "Test",
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return response({ mailer_autoconfirm: false });
      },
    });

    expect(result).toEqual({ mailerAutoconfirm: false });
    expect(request?.url).toBe("https://example.supabase.co/auth/v1/settings");
    expect(request?.init?.method).toBe("GET");
    expect(request?.init?.headers?.apikey).toBe(publishableKey);
  });

  test("blocks environments that auto-confirm password-account email addresses", async () => {
    await expect(
      verifySupabaseEmailConfirmationPolicy({
        supabaseUrl: "https://example.supabase.co",
        publishableKey: "sb_publishable_test-value",
        environment: "Staging",
        fetchImpl: async () => response({ mailer_autoconfirm: true }),
      }),
    ).rejects.toThrow("mailer_autoconfirm=false");
  });

  test("fails closed when the settings response cannot prove the policy", async () => {
    await expect(
      verifySupabaseEmailConfirmationPolicy({
        supabaseUrl: "https://example.supabase.co",
        publishableKey: "sb_publishable_test-value",
        environment: "Production",
        fetchImpl: async () => response({}),
      }),
    ).rejects.toThrow("could not verify Production mailer_autoconfirm");
  });

  test("reports HTTP failure without including the publishable key", async () => {
    const publishableKey = "sb_publishable_do-not-print-me";

    try {
      await verifySupabaseEmailConfirmationPolicy({
        supabaseUrl: "https://example.supabase.co",
        publishableKey,
        environment: "Production",
        fetchImpl: async () => response({ message: "forbidden" }, { ok: false, status: 403 }),
      });
      throw new Error("expected verification to fail");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("HTTP 403");
      expect(message).not.toContain(publishableKey);
    }
  });
});
