export interface GoogleMapsPlaceLike {
  name: string;
  address?: string | null;
  area?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}

const MAX_WEBSITE_LENGTH = 2048;

function normalizedPart(value: string): string {
  return value.trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
}

/**
 * Normaliserar användar- och leverantörsdata till en säker extern webbplatslänk.
 * Bara vanliga HTTP(S)-adresser accepteras; credentials och övriga protokoll
 * avvisas. En domän utan protokoll kompletteras med https://.
 */
export function normalizeWebsiteUrl(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_WEBSITE_LENGTH || /\s/.test(trimmed)) return undefined;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (!url.hostname || url.username || url.password) return undefined;
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

export function websiteLabel(value: string | null | undefined): string | undefined {
  const normalized = normalizeWebsiteUrl(value);
  if (!normalized) return undefined;
  try {
    return new URL(normalized).hostname.replace(/^www\./i, "");
  } catch {
    return undefined;
  }
}

export function googleMapsSearchParts(place: GoogleMapsPlaceLike): string[] {
  const candidates = [place.name, place.address, place.area, place.city]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());
  const seen = new Set<string>();
  const unique = candidates.filter((value) => {
    const normalized = normalizedPart(value);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  if (unique.length > 1) return unique;
  if (place.lat != null && place.lng != null) {
    return [...unique, `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`];
  }
  return unique;
}

export function googleMapsSearchUrl(place: GoogleMapsPlaceLike): string {
  const query = googleMapsSearchParts(place).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
