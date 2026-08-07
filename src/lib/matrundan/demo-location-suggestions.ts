import type { NormalizedLocationSuggestion } from "./geoapify-normalize";
import { demoSearchAreaFromText } from "./places-provider";

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
  const kindLabel = broad ? (primaryLabel.endsWith("län") ? "Län" : "Kommun") : address ? "Adress" : "Ort";
  const resultType = broad ? (primaryLabel.endsWith("län") ? "county" : "municipality") : address ? "building" : "city";
  const label = contextLabel && contextLabel !== primaryLabel ? `${primaryLabel}, ${contextLabel}` : primaryLabel;

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
