import { normalizeOccasionClassification } from "./occasions";
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

export function reviewModelExplanation(model: ReviewModel): string | null {
  if (model === "food_v1_takeaway") {
    return "Atmosfär ingår inte för Hämtmat eftersom maten inte åts på plats.";
  }
  if (model === "food_v1_quick") {
    return "Atmosfär ingår inte när stället bara är markerat som Snabbt och enkelt.";
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
