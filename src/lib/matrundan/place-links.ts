export interface GoogleMapsPlaceLike {
  name: string;
  address?: string | null;
  area?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}

function normalizedPart(value: string): string {
  return value.trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
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
