/**
 * Autocomplete-vänlig platsmodell.
 *
 * Istället för att användaren själv formaterar ”Område, Stad” bygger vi
 * ett fält som föreslår kända platser (städer och stadsdelar) medan man
 * skriver. Varje förslag är en `LocationBias` som pekar ut ett center-
 * koordinat + en etikett. När Geoapify eller motsvarande kopplas på
 * ersätts `searchLocations()` med ett riktigt autocomplete-anrop – gränssnittet
 * är detsamma.
 */

export interface LocationBias {
  /** Unik nyckel, används som React key och för att jämföra val. */
  id: string;
  /** Läsbar etikett, ex. "Haga, Göteborg" eller "Stockholm". */
  label: string;
  /** Kortare beskrivning, ex. "Stadsdel i Göteborg". */
  hint?: string;
  city: string;
  area?: string;
  lat: number;
  lng: number;
}

const CITIES: LocationBias[] = [
  { id: "c-goteborg", label: "Göteborg", hint: "Stad", city: "Göteborg", lat: 57.7089, lng: 11.9746 },
  { id: "c-stockholm", label: "Stockholm", hint: "Stad", city: "Stockholm", lat: 59.3293, lng: 18.0686 },
  { id: "c-malmo", label: "Malmö", hint: "Stad", city: "Malmö", lat: 55.6049, lng: 13.0038 },
  { id: "c-uppsala", label: "Uppsala", hint: "Stad", city: "Uppsala", lat: 59.8586, lng: 17.6389 },
  { id: "c-lund", label: "Lund", hint: "Stad", city: "Lund", lat: 55.7047, lng: 13.191 },
  { id: "c-linkoping", label: "Linköping", hint: "Stad", city: "Linköping", lat: 58.4108, lng: 15.6214 },
  { id: "c-helsingborg", label: "Helsingborg", hint: "Stad", city: "Helsingborg", lat: 56.0465, lng: 12.6945 },
  { id: "c-orebro", label: "Örebro", hint: "Stad", city: "Örebro", lat: 59.2753, lng: 15.2134 },
  { id: "c-vasteras", label: "Västerås", hint: "Stad", city: "Västerås", lat: 59.6099, lng: 16.5448 },
  { id: "c-norrkoping", label: "Norrköping", hint: "Stad", city: "Norrköping", lat: 58.5877, lng: 16.1924 },
  { id: "c-umea", label: "Umeå", hint: "Stad", city: "Umeå", lat: 63.8258, lng: 20.263 },
];

const AREAS: LocationBias[] = [
  // Göteborg
  { id: "a-haga", label: "Haga, Göteborg", hint: "Stadsdel", city: "Göteborg", area: "Haga", lat: 57.6994, lng: 11.9536 },
  { id: "a-majorna", label: "Majorna, Göteborg", hint: "Stadsdel", city: "Göteborg", area: "Majorna", lat: 57.6969, lng: 11.9138 },
  { id: "a-linne", label: "Linné, Göteborg", hint: "Stadsdel", city: "Göteborg", area: "Linné", lat: 57.6963, lng: 11.9464 },
  { id: "a-vasastan-gbg", label: "Vasastan, Göteborg", hint: "Stadsdel", city: "Göteborg", area: "Vasastan", lat: 57.6975, lng: 11.9598 },
  { id: "a-centrum-gbg", label: "Centrum, Göteborg", hint: "Stadsdel", city: "Göteborg", area: "Centrum", lat: 57.7072, lng: 11.9668 },
  { id: "a-nordstan", label: "Nordstan, Göteborg", hint: "Kvarter", city: "Göteborg", area: "Nordstan", lat: 57.7089, lng: 11.9686 },
  { id: "a-avenyn", label: "Avenyn, Göteborg", hint: "Stråk", city: "Göteborg", area: "Avenyn", lat: 57.6994, lng: 11.9797 },
  // Stockholm
  { id: "a-sodermalm", label: "Södermalm, Stockholm", hint: "Stadsdel", city: "Stockholm", area: "Södermalm", lat: 59.3149, lng: 18.0721 },
  { id: "a-ostermalm", label: "Östermalm, Stockholm", hint: "Stadsdel", city: "Stockholm", area: "Östermalm", lat: 59.3374, lng: 18.0839 },
  { id: "a-vasastan-sthlm", label: "Vasastan, Stockholm", hint: "Stadsdel", city: "Stockholm", area: "Vasastan", lat: 59.3438, lng: 18.0517 },
  { id: "a-gamla-enskede", label: "Gamla Enskede, Stockholm", hint: "Stadsdel", city: "Stockholm", area: "Gamla Enskede", lat: 59.281, lng: 18.084 },
  { id: "a-kungsholmen", label: "Kungsholmen, Stockholm", hint: "Stadsdel", city: "Stockholm", area: "Kungsholmen", lat: 59.3316, lng: 18.032 },
  // Malmö
  { id: "a-mollan", label: "Möllevången, Malmö", hint: "Stadsdel", city: "Malmö", area: "Möllevången", lat: 55.5921, lng: 13.0138 },
  { id: "a-vhamnen", label: "Västra Hamnen, Malmö", hint: "Stadsdel", city: "Malmö", area: "Västra Hamnen", lat: 55.6144, lng: 12.9812 },
];

export const ALL_LOCATIONS: LocationBias[] = [...CITIES, ...AREAS];

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Autocomplete-sök. Returnerar max 8 träffar. Tomt q → topp 6 (städer först). */
export function searchLocations(q: string, limit = 8): LocationBias[] {
  const query = norm(q.trim());
  if (!query) {
    return [...CITIES.slice(0, 4), ...AREAS.slice(0, 2)];
  }
  const scored = ALL_LOCATIONS.map((loc) => {
    const label = norm(loc.label);
    const city = norm(loc.city);
    const area = loc.area ? norm(loc.area) : "";
    let score = -1;
    if (label.startsWith(query)) score = 3;
    else if (area && area.startsWith(query)) score = 3;
    else if (city.startsWith(query)) score = 2;
    else if (label.includes(query)) score = 1;
    return { loc, score };
  }).filter((x) => x.score >= 0);

  scored.sort((a, b) => b.score - a.score || a.loc.label.localeCompare(b.loc.label));
  return scored.slice(0, limit).map((x) => x.loc);
}

/** Slår upp en LocationBias exakt på stadsnamn (används som fallback för gruppens stad). */
export function locationForCity(city: string): LocationBias | undefined {
  const n = norm(city);
  return CITIES.find((c) => norm(c.city) === n);
}

export function formatLocation(loc: LocationBias): string {
  return loc.label;
}
