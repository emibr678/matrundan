export type AppEnvironment = "local" | "staging" | "prod" | "unknown";

export function normalizeAppEnvironment(value: string | undefined): AppEnvironment {
  const candidate = value?.trim().toLowerCase();
  if (candidate === "local" || candidate === "staging" || candidate === "prod") {
    return candidate;
  }
  return "unknown";
}

export const APP_ENVIRONMENT = normalizeAppEnvironment(import.meta.env.VITE_MATRUNDAN_ENVIRONMENT);
export const IS_STAGING = APP_ENVIRONMENT === "staging";
export const APP_DISPLAY_NAME = IS_STAGING ? "Matrundan Staging" : "Matrundan";
export const APP_MANIFEST_PATH = IS_STAGING
  ? "/manifest-staging.webmanifest"
  : "/manifest.webmanifest";
export const APP_ICON_PATH = IS_STAGING ? "/icons/matrundan-staging-192.png" : "/favicon.ico";
export const APP_ICON_TYPE = IS_STAGING ? "image/png" : "image/x-icon";
export const APPLE_TOUCH_ICON_PATH = IS_STAGING
  ? "/icons/apple-touch-icon-staging.png"
  : "/icons/apple-touch-icon.png";

const deployedAtCandidate = import.meta.env.VITE_MATRUNDAN_DEPLOYED_AT?.trim() ?? "";
export const APP_DEPLOYED_AT = Number.isNaN(Date.parse(deployedAtCandidate))
  ? null
  : deployedAtCandidate;

export function appPageTitle(page: string): string {
  return `${page} · ${APP_DISPLAY_NAME}`;
}

export function formatDeploymentTime(value: string | null): string {
  if (!value) return "Ej angiven";
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
    timeZoneName: "short",
  }).format(new Date(value));
}
