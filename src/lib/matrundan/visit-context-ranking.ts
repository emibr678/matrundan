import type { PlaceRating } from "./occasions";
import { effectiveReviewOverall } from "./review-model";
import type { Visit, VisitMeal } from "./types";
import { visitHasScore } from "./visit-context";

export const RANKABLE_VISIT_MEALS = [
  "frukost",
  "lunch",
  "fika",
  "middag",
] as const satisfies readonly VisitMeal[];

export type RankableVisitMeal = (typeof RANKABLE_VISIT_MEALS)[number];

export interface VisitRatingContext {
  /** Tom lista betyder alla scorebara tillfällen, inklusive historisk legacy-kontext. */
  meals?: readonly RankableVisitMeal[];
  takeawayOnly?: boolean;
}

function relevantVisibleRatings(visit: Visit): number[] {
  return (visit.visibleReviews ?? []).flatMap((review) => {
    if (!visit.participantIds.includes(review.userId) || !review.ratingVisible) return [];
    const overall = effectiveReviewOverall(review, visit.isTakeaway === true);
    return overall == null ? [] : [overall];
  });
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
  const selectedMeals = context.meals ?? [];
  const ratings: number[] = [];
  let visitCount = 0;

  for (const visit of visits) {
    if (visit.id && seenVisitIds.has(visit.id)) continue;
    if (visit.id) seenVisitIds.add(visit.id);

    if (visit.placeId !== placeId || !visitHasScore(visit)) continue;
    if (selectedMeals.length > 0 && !selectedMeals.includes(visit.meal as RankableVisitMeal)) {
      continue;
    }
    if (context.takeawayOnly && !visit.isTakeaway) continue;

    const visitRatings = relevantVisibleRatings(visit);
    if (!visitRatings.length) continue;

    visitCount += 1;
    ratings.push(...visitRatings);
  }

  if (!ratings.length) return { overall: 0, count: 0, visitCount: 0 };

  return {
    overall: ratings.reduce((sum, value) => sum + value, 0) / ratings.length,
    count: ratings.length,
    visitCount,
  };
}
