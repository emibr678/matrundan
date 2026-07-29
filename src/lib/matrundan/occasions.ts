import { OCCASION_VALUES, type Occasion, type Place } from "@/lib/matrundan/types";

export interface PlaceRating {
  overall: number;
  count: number;
}

export interface RankedOccasionPlace {
  place: Place;
  rating: PlaceRating;
  rank: number;
}

export function normalizeOccasionClassification(value: readonly unknown[]): Occasion[] {
  const valid = value.filter(
    (item): item is Occasion =>
      typeof item === "string" && OCCASION_VALUES.includes(item as Occasion),
  );
  return [...new Set(valid)].slice(0, 2);
}

export function primaryOccasion(value: readonly Occasion[]): Occasion | undefined {
  return normalizeOccasionClassification(value)[0];
}

export function secondaryOccasion(value: readonly Occasion[]): Occasion | undefined {
  return normalizeOccasionClassification(value)[1];
}

export function occasionClassification(
  primary: Occasion | undefined,
  secondary?: Occasion,
): Occasion[] {
  if (!primary) return [];
  return secondary && secondary !== primary ? [primary, secondary] : [primary];
}

export function rankPlacesForOccasion(
  places: readonly Place[],
  occasion: Occasion,
  ratingOf: (placeId: string) => PlaceRating,
  limit = 3,
): RankedOccasionPlace[] {
  const sorted = places
    .filter(
      (place) =>
        place.collectionStatus !== "archived" && primaryOccasion(place.occasions) === occasion,
    )
    .map((place) => ({ place, rating: ratingOf(place.id) }))
    .filter(({ rating }) => rating.count > 0)
    .sort(
      (a, b) =>
        b.rating.overall - a.rating.overall ||
        b.rating.count - a.rating.count ||
        a.place.name.localeCompare(b.place.name, "sv"),
    );

  let previousScore: number | undefined;
  let previousRank = 0;
  return sorted.slice(0, limit).map((item, index) => {
    const rank =
      previousScore != null && item.rating.overall === previousScore ? previousRank : index + 1;
    previousScore = item.rating.overall;
    previousRank = rank;
    return { ...item, rank };
  });
}
