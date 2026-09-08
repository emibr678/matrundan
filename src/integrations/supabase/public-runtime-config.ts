import { environmentForRequestUrl } from "@/lib/observability";

const LOVABLE_PROJECT_ID = "d389634e-227c-4689-85ed-8714fdc602f7";
const LOVABLE_STABLE_PREVIEW_HOST = "preview--matrundan.lovable.app";

// Supabase publishable keys are intentionally browser-public. This fallback exists only
// because Lovable's hosted preview build currently omits the connected project's VITE_*
// values even though its sandbox runtime has them. Production and Cloudflare staging keep
// using deployment-provided configuration and never fall back here.
const LOVABLE_STAGING_SUPABASE_URL = "https://wpihfmwbubvdiaavtpia.supabase.co";
const LOVABLE_STAGING_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_waWGvTQMw5e1FXNEbKtF1A_lTPIh5OU";

type PublicSupabaseConfigInput = {
  configuredUrl?: string;
  configuredPublishableKey?: string;
  runtimeUrl?: string;
  lovableProjectId?: string;
  lovable?: string;
  lovableSandbox?: string;
  lovableDevServer?: string;
  lovablePreviewHost?: string;
};

export type PublicSupabaseConfig = {
  url?: string;
  publishableKey?: string;
  source: "configured" | "lovable-staging-fallback" | "missing";
};

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function flagEnabled(value: string | undefined): boolean {
  const normalized = clean(value)?.toLowerCase();
  return Boolean(normalized && !["0", "false", "off", "no"].includes(normalized));
}

function isMatrundanLovablePreviewUrl(value: string): boolean {
  try {
    const url = new URL(value, "https://preview.invalid");
    const hostname = url.hostname.toLowerCase();
    if (environmentForRequestUrl(url.href) !== "staging") return false;
    return hostname === LOVABLE_STABLE_PREVIEW_HOST || hostname.includes(LOVABLE_PROJECT_ID);
  } catch {
    return false;
  }
}

function isMatrundanLovableServerRuntime(input: PublicSupabaseConfigInput): boolean {
  if (clean(input.lovableProjectId)?.toLowerCase() !== LOVABLE_PROJECT_ID) return false;

  const previewHost = clean(input.lovablePreviewHost);
  if (previewHost && isMatrundanLovablePreviewUrl(`https://${previewHost}`)) return true;

  return [input.lovable, input.lovableSandbox, input.lovableDevServer].some(flagEnabled);
}

export function resolvePublicSupabaseConfig(
  input: PublicSupabaseConfigInput,
): PublicSupabaseConfig {
  const configuredUrl = clean(input.configuredUrl);
  const configuredPublishableKey = clean(input.configuredPublishableKey);

  // Never hide a partial or wrong explicit deployment configuration. The normal
  // environment contract must still fail closed outside the exact fallback case.
  if (configuredUrl || configuredPublishableKey) {
    return {
      url: configuredUrl,
      publishableKey: configuredPublishableKey,
      source: "configured",
    };
  }

  const lovablePreview =
    (input.runtimeUrl ? isMatrundanLovablePreviewUrl(input.runtimeUrl) : false) ||
    isMatrundanLovableServerRuntime(input);

  if (!lovablePreview) {
    return { source: "missing" };
  }

  return {
    url: LOVABLE_STAGING_SUPABASE_URL,
    publishableKey: LOVABLE_STAGING_SUPABASE_PUBLISHABLE_KEY,
    source: "lovable-staging-fallback",
  };
}
