/**
 * Enkel plats-tolkning för det gemensamma "Plats"-fältet i utforskningen.
 *
 * Målet är att kännas mänskligt: användaren kan skriva
 *   - "Södermalm, Stockholm"  → område + stad
 *   - "Stockholm"             → stad (inget område)
 *   - "Södermalm"             → område i gruppens stad
 *
 * Den strukturerade uppdelningen i stad/område bevaras internt så att
 * datamodellen och en framtida geokodningsleverantör kan använda den.
 */

const KNOWN_CITIES = [
  "göteborg",
  "stockholm",
  "malmö",
  "malmo",
  "uppsala",
  "linköping",
  "linkoping",
  "helsingborg",
  "örebro",
  "orebro",
  "västerås",
  "vasteras",
  "norrköping",
  "norrkoping",
  "lund",
  "umeå",
  "umea",
];

export interface ParsedLocation {
  city: string;
  area?: string;
}

export function parseLocation(
  input: string,
  fallbackCity: string,
): ParsedLocation {
  const raw = input.trim();
  if (!raw) return { city: fallbackCity };

  if (raw.includes(",")) {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const [area, city] = parts;
      return { city: city || fallbackCity, area: area || undefined };
    }
    return { city: parts[0] || fallbackCity };
  }

  if (KNOWN_CITIES.includes(raw.toLowerCase())) {
    return { city: raw };
  }
  return { city: fallbackCity, area: raw };
}

export function formatLocation(loc: ParsedLocation): string {
  if (loc.area && loc.city) return `${loc.area}, ${loc.city}`;
  return loc.city;
}
