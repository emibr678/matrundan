// TEMPORARY #464. Raw provider objects and credentials never leave the server.
import { normalizePlaceFeature } from "./geoapify-normalize";
import { matchesPlaceSearchIntent, resolvePlaceSearchIntent } from "./place-search-intent";

export function diagnostics464Allowed(configuredUrl: string | undefined, requestUrl: string) {
  if (configuredUrl !== "https://staging.matrundan.workers.dev") return false;
  try {
    const url = new URL(requestUrl);
    return (
      url.protocol === "https:" &&
      (url.hostname === "staging.matrundan.workers.dev" ||
        /^[a-z0-9-]+-staging\.matrundan\.workers\.dev$/.test(url.hostname))
    );
  } catch {
    return false;
  }
}

function publicText(value: unknown): string | null {
  return typeof value === "string" ? value.slice(0, 200) : null;
}

export function summarizeDiagnostics464(features: unknown[], url: URL, query: string) {
  const intent = resolvePlaceSearchIntent(query);
  const seen = new Set<string>();
  return {
    intent: intent.kind,
    request: Object.fromEntries(
      ["categories", "filter", "bias", "lang", "limit", "offset", "name"].map((key) => [
        key,
        url.searchParams.get(key),
      ]),
    ),
    rawFeatureCount: features.length,
    candidates: features.slice(0, 50).map((feature, index) => {
      const properties =
        feature && typeof feature === "object" && "properties" in feature
          ? (feature as { properties?: Record<string, unknown> }).properties
          : undefined;
      const place =
        feature && typeof feature === "object"
          ? normalizePlaceFeature(feature as Parameters<typeof normalizePlaceFeature>[0])
          : null;
      const duplicate = Boolean(place && seen.has(place.externalId));
      if (place) seen.add(place.externalId);
      return {
        index,
        providerName: publicText(properties?.name),
        providerStreet: publicText(properties?.street),
        providerCity: publicText(properties?.city),
        providerCategories: Array.isArray(properties?.categories)
          ? properties.categories.filter((v): v is string => typeof v === "string").slice(0, 20)
          : [],
        normalizedName: place?.name ?? null,
        disposition: !place
          ? "normalization-rejected"
          : duplicate
            ? "duplicate"
            : matchesPlaceSearchIntent(place, intent)
              ? "accepted"
              : "intent-rejected",
      };
    }),
  };
}

export type Diagnostic464Summary = ReturnType<typeof summarizeDiagnostics464>;
