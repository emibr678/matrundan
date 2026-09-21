import { normalizeOccasionClassification } from "./occasions";
import { OCCASION_LABEL } from "./types";
import type { Occasion, ReviewModel } from "./types";

export type { ReviewModel } from "./types";

export interface ReviewDimensionValues {
  taste: number;
  service: number;
  value: number;
  atmosphere?: number | null;
}

export function reviewModelForContext({
  isTakeaway,
  occasions,
}: {
  isTakeaway: boolean;
  occasions: readonly Occasion[];
}): ReviewModel | null {
  if (isTakeaway) return "food_v1_takeaway";

  const normalized = normalizeOccasionClassification(occasions);
  if (normalized.length === 0) return null;
  if (normalized.includes("avslappnat") || normalized.includes("middag")) {
    return "food_v1_atmosphere";
  }
  return "food_v1_quick";
}

export function reviewModelIncludesAtmosphere(model: ReviewModel | null | undefined): boolean {
  return model === "food_v1_atmosphere";
}

/**
 * Reviewmodellen lagras historiskt på reviewn, men Hämtmat är ett korrigerbart
 * faktum på besöket. När ett befintligt matomdöme i efterhand markeras som
 * Hämtmat blir därför den aktiva modellen tredimensionell utan att den lagrade
 * modellen eller Atmosfärsvärdet skrivs om.
 *
 * Om Hämtmat senare tas bort återgår reviewn till sin lagrade modell. En review
 * som skapades som Hämtmat får däremot inte Atmosfär fabricerad när markeringen
 * tas bort; dess lagrade food_v1_takeaway-modell ligger kvar tills en framtida
 * uttrycklig omvärdering kompletterar modellen.
 */
export function effectiveReviewModel(
  storedModel: ReviewModel | null | undefined,
  isTakeaway: boolean,
): ReviewModel | null {
  if (!storedModel) return null;
  return isTakeaway ? "food_v1_takeaway" : storedModel;
}

export function effectiveReviewOverall(
  review: {
    overall?: number | null;
    taste?: number | null;
    value?: number | null;
    service?: number | null;
    atmosphere?: number | null;
    reviewModel?: ReviewModel | null;
  },
  isTakeaway: boolean,
): number | null {
  if (!review.reviewModel) return review.overall ?? null;
  return deriveReviewOverall(effectiveReviewModel(review.reviewModel, isTakeaway), {
    taste: review.taste ?? 0,
    value: review.value ?? 0,
    service: review.service ?? 0,
    atmosphere: review.atmosphere ?? 0,
  });
}

export function reviewModelExplanation(model: ReviewModel): string | null {
  if (model === "food_v1_takeaway") {
    return "Atmosfär ingår inte vid Hämtmat.";
  }
  if (model === "food_v1_quick") {
    return `Atmosfär ingår inte för ${OCCASION_LABEL.snabbt}.`;
  }
  return null;
}

function isWholeStar(value: number | null | undefined): value is number {
  return value != null && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function reviewRatingsComplete(
  model: ReviewModel | null | undefined,
  ratings: ReviewDimensionValues,
): boolean {
  if (!model) return false;
  if (!isWholeStar(ratings.taste) || !isWholeStar(ratings.service) || !isWholeStar(ratings.value)) {
    return false;
  }
  return !reviewModelIncludesAtmosphere(model) || isWholeStar(ratings.atmosphere);
}

export function deriveReviewOverall(
  model: ReviewModel | null | undefined,
  ratings: ReviewDimensionValues,
): number | null {
  if (!reviewRatingsComplete(model, ratings) || !model) return null;
  const values = [ratings.taste, ratings.service, ratings.value];
  if (reviewModelIncludesAtmosphere(model)) values.push(ratings.atmosphere as number);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round((average + Number.EPSILON) * 100) / 100;
}
