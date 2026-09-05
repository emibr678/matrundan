import { environmentForRequestUrl } from "@/lib/observability";

const SUPABASE_HOST_BY_ENVIRONMENT = {
  staging: "wpihfmwbubvdiaavtpia.supabase.co",
  prod: "wsikirbxqejjwtgxcvjl.supabase.co",
} as const;

export function expectedSupabaseHostForBrowserUrl(browserUrl: string): string | null {
  const environment = environmentForRequestUrl(browserUrl);
  if (environment !== "staging" && environment !== "prod") return null;
  return SUPABASE_HOST_BY_ENVIRONMENT[environment];
}

export function hasSupabaseEnvironmentMismatch(browserUrl: string, supabaseUrl: string): boolean {
  const expectedHost = expectedSupabaseHostForBrowserUrl(browserUrl);
  if (!expectedHost) return false;

  try {
    return new URL(supabaseUrl).hostname.toLowerCase() !== expectedHost;
  } catch {
    return true;
  }
}

export function assertBrowserSupabaseEnvironment(supabaseUrl: string): void {
  if (typeof window === "undefined") return;
  if (!hasSupabaseEnvironmentMismatch(window.location.href, supabaseUrl)) return;

  const environment = environmentForRequestUrl(window.location.href);
  throw new Error(`MATRUNDAN_ENVIRONMENT_MISMATCH: ${environment} kör mot fel Supabase-miljö.`);
}
