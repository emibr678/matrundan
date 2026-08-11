import type { NormalizedLocationSuggestion } from "./geoapify-normalize";
import { demoSearchAreaFromText } from "./places-provider";
import type { SearchAreaBoundaryGeometry } from "./types";

const DEMO_LOCATION_SUGGESTIONS: NormalizedLocationSuggestion[] = [
  {
    placeId: "demo-location-majorna",
    label: "Majorna, Göteborg",
    primaryLabel: "Majorna",
    secondaryLabel: "Stadsdel · Göteborg",
    name: "Majorna",
    city: "Göteborg",
    area: "Majorna",
    lat: 57.6969,
    lng: 11.9138,
    resultType: "suburb",
  },
  {
    placeId: "demo-location-sodermalm",
    label: "Södermalm, Stockholm",
    primaryLabel: "Södermalm",
    secondaryLabel: "Stadsdel · Stockholm",
    name: "Södermalm",
    city: "Stockholm",
    area: "Södermalm",
    lat: 59.3153,
    lng: 18.0711,
    resultType: "suburb",
  },
  {
    placeId: "demo-location-degvagen-47",
    label: "Degvägen 47, Stockholm",
    primaryLabel: "Degvägen 47",
    secondaryLabel: "Adress · Vasastan, Stockholm",
    name: "Degvägen 47",
    city: "Stockholm",
    area: "Vasastan",
    lat: 59.3406,
    lng: 18.0359,
    resultType: "building",
  },
  {
    placeId: "demo-location-stavnas",
    label: "Stavsnäs, Värmdö kommun",
    primaryLabel: "Stavsnäs",
    secondaryLabel: "Ort · Värmdö kommun",
    name: "Stavsnäs",
    city: "Stavsnäs",
    lat: 59.287,
    lng: 18.692,
    resultType: "city",
  },
  {
    placeId: "demo-location-skargardsvagen-8",
    label: "Skärgårdsvägen 8, Gustavsberg",
    primaryLabel: "Skärgårdsvägen 8",
    secondaryLabel: "Adress · Gustavsberg",
    name: "Skärgårdsvägen 8",
    city: "Gustavsberg",
    lat: 59.3264,
    lng: 18.3895,
    resultType: "building",
  },
  {
    placeId: "demo-location-varmdo-kommun",
    label: "Värmdö kommun, Stockholms län",
    primaryLabel: "Värmdö kommun",
    secondaryLabel: "Kommun · Stockholms län",
    name: "Värmdö kommun",
    city: "Värmdö kommun",
    lat: 59.316,
    lng: 18.52,
    resultType: "municipality",
  },
];

/**
 * Förenklade, avsiktligt deterministiska demoformer. De är inte officiella
 * administrativa gränser och används bara för att efterlikna boundary-UX utan
 * externa provideranrop.
 */
const DEMO_BOUNDARIES: Record<string, SearchAreaBoundaryGeometry> = {
  "demo-location-varmdo-kommun": {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [18.30, 59.23],
          [18.61, 59.22],
          [18.73, 59.33],
          [18.57, 59.43],
          [18.31, 59.38],
          [18.30, 59.23],
        ],
      ],
      [
        [
          [18.77, 59.25],
          [18.96, 59.24],
          [19.02, 59.34],
          [18.84, 59.37],
          [18.77, 59.25],
        ],
      ],
    ],
  },
  "demo-location-sodermalm": {
    type: "Polygon",
    coordinates: [
      [
        [18.018, 59.299],
        [18.111, 59.300],
        [18.111, 59.329],
        [18.032, 59.329],
        [18.018, 59.299],
      ],
    ],
  },
  "demo-location-majorna": {
    type: "Polygon",
    coordinates: [
      [
        [11.88, 57.682],
        [11.94, 57.682],
        [11.94, 57.711],
        [11.89, 57.711],
        [11.88, 57.682],
      ],
    ],
  },
};

export function demoBoundaryForPlaceId(placeId: string): SearchAreaBoundaryGeometry | null {
  return DEMO_BOUNDARIES[placeId] ?? null;
}

function searchableText(suggestion: NormalizedLocationSuggestion): string {
  return [suggestion.primaryLabel, suggestion.secondaryLabel, suggestion.label]
    .join(" ")
    .toLocaleLowerCase("sv-SE");
}

function matchesQuery(suggestion: NormalizedLocationSuggestion, query: string): boolean {
  const terms = query
    .toLocaleLowerCase("sv-SE")
    .split(/[\s,]+/)
    .filter(Boolean);
  const haystack = searchableText(suggestion);
  return terms.every((term) => haystack.includes(term));
}

/**
 * Lokal, deterministisk autocomplete-fixture för exempel/demo.
 * Den gör inga externa anrop men följer samma presentationskontrakt som live.
 */
export function demoAutocompleteLocations(
  text: string,
  fallbackCity = "Göteborg",
  limit = 6,
): NormalizedLocationSuggestion[] {
  const query = text.trim();
  if (query.length < 2) return [];

  const fixtures = DEMO_LOCATION_SUGGESTIONS.filter((suggestion) =>
    matchesQuery(suggestion, query),
  );
  if (fixtures.length > 0) return fixtures.slice(0, limit);

  const area = demoSearchAreaFromText(query, fallbackCity);
  if (!area) return [];
  const parts = query
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const primaryLabel = parts[0] ?? query;
  const contextLabel = parts[1] ?? fallbackCity;
  const broad = /(^region\s|\s(?:kommun|län|region)$)/iu.test(primaryLabel);
  const address = /\d/u.test(primaryLabel);
  const kindLabel = broad
    ? primaryLabel.endsWith("län")
      ? "Län"
      : "Kommun"
    : address
      ? "Adress"
      : "Ort";
  const resultType = broad
    ? primaryLabel.endsWith("län")
      ? "county"
      : "municipality"
    : address
      ? "building"
      : "city";
  const label =
    contextLabel && contextLabel !== primaryLabel
      ? `${primaryLabel}, ${contextLabel}`
      : primaryLabel;

  return [
    {
      placeId: area.placeId,
      label,
      primaryLabel,
      secondaryLabel: [kindLabel, contextLabel !== primaryLabel ? contextLabel : ""]
        .filter(Boolean)
        .join(" · "),
      name: primaryLabel,
      city: contextLabel,
      area: broad ? undefined : primaryLabel,
      lat: area.lat,
      lng: area.lng,
      resultType,
    },
  ];
}
