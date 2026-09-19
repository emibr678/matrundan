import { describe, expect, test } from "bun:test";

import {
  effectiveReviewModel,
  effectiveReviewOverall,
  reviewModelIncludesAtmosphere,
} from "./review-model";

const fourDimensionalReview = {
  overall: 3.5,
  taste: 5,
  service: 4,
  value: 2,
  atmosphere: 3,
  reviewModel: "food_v1_atmosphere" as const,
};

describe("aktiv reviewmodell efter korrigerad besökskontext", () => {
  test("Hämtmat döljer Atmosfär och räknar om utan att förlora det sparade värdet", () => {
    expect(effectiveReviewModel(fourDimensionalReview.reviewModel, false)).toBe(
      "food_v1_atmosphere",
    );
    expect(effectiveReviewOverall(fourDimensionalReview, false)).toBe(3.5);

    expect(effectiveReviewModel(fourDimensionalReview.reviewModel, true)).toBe(
      "food_v1_takeaway",
    );
    expect(effectiveReviewOverall(fourDimensionalReview, true)).toBe(3.67);
    expect(fourDimensionalReview.atmosphere).toBe(3);

    expect(effectiveReviewOverall(fourDimensionalReview, false)).toBe(3.5);
  });

  test("tre dimensioner ger samma matematik för Snabbt och enkelt och Hämtmat", () => {
    const quick = {
      overall: 4.33,
      taste: 5,
      service: 4,
      value: 4,
      atmosphere: null,
      reviewModel: "food_v1_quick" as const,
    };

    expect(effectiveReviewOverall(quick, false)).toBe(4.33);
    expect(effectiveReviewModel(quick.reviewModel, true)).toBe("food_v1_takeaway");
    expect(effectiveReviewOverall(quick, true)).toBe(4.33);
  });

  test("en review skapad som Hämtmat får inte Atmosfär fabricerad när markeringen tas bort", () => {
    const takeaway = {
      overall: 4,
      taste: 5,
      service: 4,
      value: 3,
      atmosphere: null,
      reviewModel: "food_v1_takeaway" as const,
    };

    expect(effectiveReviewModel(takeaway.reviewModel, false)).toBe("food_v1_takeaway");
    expect(effectiveReviewOverall(takeaway, false)).toBe(4);
    expect(reviewModelIncludesAtmosphere(effectiveReviewModel(takeaway.reviewModel, false))).toBe(
      false,
    );
  });

  test("legacyomdömen behåller sitt manuella helhetsbetyg", () => {
    const legacy = {
      overall: 4,
      taste: 5,
      service: 3,
      value: 2,
      atmosphere: null,
      reviewModel: null,
    };

    expect(effectiveReviewOverall(legacy, false)).toBe(4);
    expect(effectiveReviewOverall(legacy, true)).toBe(4);
  });

  test("ofullständiga moderna dimensioner ger inget fabricerat helhetsbetyg", () => {
    expect(
      effectiveReviewOverall(
        {
          overall: 4,
          taste: 5,
          service: null,
          value: 4,
          atmosphere: 3,
          reviewModel: "food_v1_atmosphere",
        },
        true,
      ),
    ).toBeNull();
  });
});
