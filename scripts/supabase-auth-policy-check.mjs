const DEFAULT_TIMEOUT_MS = 10_000;

function assertNonEmpty(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`supabase-auth-policy: missing ${name}`);
  }
  return value.trim();
}

export async function verifySupabaseEmailConfirmationPolicy({
  supabaseUrl,
  publishableKey,
  environment = "Supabase",
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const baseUrl = assertNonEmpty(supabaseUrl, "SUPABASE_URL");
  const apiKey = assertNonEmpty(publishableKey, "SUPABASE_PUBLISHABLE_KEY");
  const label = assertNonEmpty(environment, "MATRUNDAN_AUTH_ENVIRONMENT");
  const settingsUrl = new URL("/auth/v1/settings", baseUrl);

  let response;
  try {
    response = await fetchImpl(settingsUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        apikey: apiKey,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `supabase-auth-policy: could not read ${label} Auth settings (${reason})`,
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload.mailer_autoconfirm !== "boolean") {
    throw new Error(
      `supabase-auth-policy: could not verify ${label} mailer_autoconfirm (HTTP ${response.status})`,
    );
  }

  if (payload.mailer_autoconfirm !== false) {
    throw new Error(
      `supabase-auth-policy: ${label} auto-confirms password-account email addresses; required policy is mailer_autoconfirm=false`,
    );
  }

  console.log(
    `supabase-auth-policy: verified ${label} requires email confirmation for password accounts`,
  );

  return {
    mailerAutoconfirm: payload.mailer_autoconfirm,
  };
}

async function main() {
  await verifySupabaseEmailConfirmationPolicy({
    supabaseUrl: process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    environment: process.env.MATRUNDAN_AUTH_ENVIRONMENT ?? "Supabase",
  });
}

if (import.meta.main) {
  await main();
}
