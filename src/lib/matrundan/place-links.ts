export interface GoogleMapsPlaceLike {
  name: string;
  address?: string | null;
  area?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface GoogleMapsDisplayParts {
  prefix?: string;
  tail: string;
  hasStreetAddress: boolean;
}

const MAX_WEBSITE_LENGTH = 2048;
const STREET_ADDRESS_HINT =
  /(?:\d|(?:gata(?:n)?|väg(?:en)?|gränd(?:en)?|torg(?:et)?|allé(?:n)?|allen|aveny(?:n)?|kaj(?:en)?|backe(?:n)?|stig(?:en)?|stråk(?:et)?|terrass(?:en)?|esplanad(?:en)?|gång(?:en)?|led(?:en)?|plats(?:en)?|street|road)\b)/i;

function normalizedPart(value: string): string {
  return value.trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
}

/**
 * Avgör konservativt om en sträng kan visas som en faktisk gatuadress.
 * Leverantörers adressfält kan annars innehålla verksamhetsnamnet eller ett område.
 */
export function isCredibleStreetAddress(
  value: string | null | undefined,
  placeName?: string | null,
): boolean {
  const address = value?.trim();
  if (!address || !/[a-zåäö]/i.test(address)) return false;
  if (placeName?.trim() && normalizedPart(address) === normalizedPart(placeName)) return false;
  return STREET_ADDRESS_HINT.test(address);
}

/**
 * Visar gatuadress och ort när adressen är trovärdig. Annars beskriver länken
 * handlingen i stället för att presentera namn eller område som en adress.
 */
export function googleMapsDisplayParts(place: GoogleMapsPlaceLike): GoogleMapsDisplayParts {
  const address = place.address?.trim();
  const city = place.city?.trim();
  if (isCredibleStreetAddress(address, place.name)) {
    if (city) return { prefix: `${address}, `, tail: city, hasStreetAddress: true };
    return { tail: address ?? "Visa på karta", hasStreetAddress: true };
  }
  return { tail: "Visa på karta", hasStreetAddress: false };
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
