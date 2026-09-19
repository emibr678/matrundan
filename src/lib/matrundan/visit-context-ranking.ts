import type { PlaceRating } from "./occasions";
import type { Visit, VisitMeal, VisibleReview } from "./types";
import { visitHasScore } from "./visit-context";

export const RANKABLE_VISIT_MEALS = [
  "frukost",
  "lunch",
  "fika",
  "middag",
] as const satisfies readonly VisitMeal[];

export type RankableVisitMeal = (typeof RANKABLE_VISIT_MEALS)[number];

export interface VisitRatingContext {
  meal: RankableVisitMeal | "alla";
  takeawayOnly?: boolean;
}

function relevantVisibleReviews(
  visit: Visit,
): Array<VisibleReview & { overall: number }> {
  return (visit.visibleReviews ?? []).filter(
    (review): review is VisibleReview & { overall: number } =>
      visit.participantIds.includes(review.userId) &&
      review.ratingVisible &&
      review.overall != null,
  );
}

/**
 * Härleder ett transparent betyg från verkliga besök i den aktiva gruppkontexten.
 *
 * Samma kanoniska visit får bara bidra en gång även om en defensiv dubblett
 * råkar finnas i state. Scorelösa besök (i dag Något att dricka) bidrar aldrig.
 */
export function ratingForPlaceInVisitContext(
  visits: readonly Visit[],
  placeId: string,
  context: VisitRatingContext,
): PlaceRating {
  const seenVisitIds = new Set<string>();
  const ratings: number[] = [];
  let visitCount = 0;

  for (const visit of visits) {
    if (visit.id && seenVisitIds.has(visit.id)) continue;
    if (visit.id) seenVisitIds.add(visit.id);

    if (visit.placeId !== placeId || !visitHasScore(visit)) continue;
    if (context.meal !== "alla" && visit.meal !== context.meal) continue;
    if (context.takeawayOnly && !visit.isTakeaway) continue;

    const reviews = relevantVisibleReviews(visit);
    if (!reviews.length) continue;

    visitCount += 1;
    ratings.push(...reviews.map((review) => review.overall));
  }

  if (!ratings.length) return { overall: 0, count: 0, visitCount: 0 };

  return {
    overall: ratings.reduce((sum, value) => sum + value, 0) / ratings.length,
    count: ratings.length,
    visitCount,
  };
}
