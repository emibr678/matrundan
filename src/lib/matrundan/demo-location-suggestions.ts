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
          [18.29, 59.235],
          [18.34, 59.225],
          [18.4, 59.232],
          [18.47, 59.224],
          [18.54, 59.235],
          [18.6, 59.245],
          [18.66, 59.255],
          [18.715, 59.275],
          [18.735, 59.31],
          [18.72, 59.345],
          [18.68, 59.372],
          [18.63, 59.402],
          [18.56, 59.425],
          [18.49, 59.421],
          [18.43, 59.405],
          [18.37, 59.398],
          [18.32, 59.37],
          [18.3, 59.33],
          [18.285, 59.285],
          [18.29, 59.235],
        ],
      ],
      [
        [
          [18.78, 59.255],
          [18.82, 59.245],
          [18.88, 59.25],
          [18.94, 59.265],
          [18.98, 59.295],
          [19, 59.33],
          [18.97, 59.355],
          [18.92, 59.375],
          [18.86, 59.37],
          [18.81, 59.35],
          [18.78, 59.32],
          [18.77, 59.285],
          [18.78, 59.255],
        ],
      ],
    ],
  },
  "demo-location-sodermalm": {
    type: "Polygon",
    coordinates: [
      [
        [18.018, 59.299],
        [18.111, 59.3],
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
