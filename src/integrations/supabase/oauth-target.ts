import { isMatrundanLovablePreviewUrl } from "@/lib/observability";

import { expectedSupabaseHostForBrowserUrl } from "./environment-contract";

export function shouldManuallyNavigateOAuth(browserUrl: string): boolean {
  return isMatrundanLovablePreviewUrl(browserUrl);
}

export function validatedOAuthAuthorizeUrl(
  browserUrl: string,
  candidateUrl: string | null | undefined,
): string {
  const expectedHost = expectedSupabaseHostForBrowserUrl(browserUrl);
  if (!candidateUrl || !expectedHost) {
    throw new Error("MATRUNDAN_OAUTH_TARGET_MISMATCH: OAuth-målet saknas eller miljön är okänd.");
  }

  let target: URL;
  try {
    target = new URL(candidateUrl);
  } catch {
    throw new Error("MATRUNDAN_OAUTH_TARGET_MISMATCH: OAuth-målet är inte en giltig URL.");
  }

  if (
    target.protocol !== "https:" ||
    target.hostname.toLowerCase() !== expectedHost ||
    target.pathname !== "/auth/v1/authorize"
  ) {
    throw new Error("MATRUNDAN_OAUTH_TARGET_MISMATCH: OAuth-målet pekar mot fel auth-miljö.");
  }

  return target.toString();
}
