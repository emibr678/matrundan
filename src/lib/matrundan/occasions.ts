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
  const selected = new Set(
    value.filter(
      (item): item is Occasion =>
        typeof item === "string" && OCCASION_VALUES.includes(item as Occasion),
    ),
  );

  return OCCASION_VALUES.filter((occasion) => selected.has(occasion)).slice(0, 2);
}

export function toggleOccasionSelection(
  value: readonly Occasion[],
  occasion: Occasion,
): Occasion[] {
  const selected = normalizeOccasionClassification(value);
  if (selected.includes(occasion)) {
    return selected.filter((item) => item !== occasion);
  }
  if (selected.length >= 2) return selected;
  return normalizeOccasionClassification([...selected, occasion]);
}

/** @deprecated Använd normalizeOccasionClassification; valens ordning har ingen produktsemantik. */
export function primaryOccasion(value: readonly Occasion[]): Occasion | undefined {
  return normalizeOccasionClassification(value)[0];
}

/** @deprecated Använd normalizeOccasionClassification; valens ordning har ingen produktsemantik. */
export function secondaryOccasion(value: readonly Occasion[]): Occasion | undefined {
  return normalizeOccasionClassification(value)[1];
}

/** @deprecated Använd ett direkt flerval och normalizeOccasionClassification. */
export function occasionClassification(
  first: Occasion | undefined,
  second?: Occasion,
): Occasion[] {
  return normalizeOccasionClassification([first, second]);
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
        place.collectionStatus !== "archived" &&
        normalizeOccasionClassification(place.occasions).includes(occasion),
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
