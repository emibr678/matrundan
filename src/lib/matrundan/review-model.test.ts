import { describe, expect, test } from "bun:test";

import {
  canUpgradeReviewModelWithAtmosphere,
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

    expect(effectiveReviewModel(fourDimensionalReview.reviewModel, true)).toBe("food_v1_takeaway");
    expect(effectiveReviewOverall(fourDimensionalReview, true)).toBe(3.67);
    expect(fourDimensionalReview.atmosphere).toBe(3);

    expect(effectiveReviewOverall(fourDimensionalReview, false)).toBe(3.5);
  });

  test("tre dimensioner ger samma matematik för Snabbt & enkelt och Hämtmat", () => {
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

  test("alla tredimensionella modeller kan kompletteras först när dagens modell har Atmosfär", () => {
    for (const storedModel of ["food_v0_3d", "food_v1_quick", "food_v1_takeaway"] as const) {
      expect(canUpgradeReviewModelWithAtmosphere(storedModel, "food_v1_atmosphere")).toBe(true);
      expect(canUpgradeReviewModelWithAtmosphere(storedModel, "food_v1_quick")).toBe(false);
      expect(canUpgradeReviewModelWithAtmosphere(storedModel, "food_v1_takeaway")).toBe(false);
    }

    expect(canUpgradeReviewModelWithAtmosphere("food_v1_atmosphere", "food_v1_atmosphere")).toBe(
      false,
    );
    expect(canUpgradeReviewModelWithAtmosphere("food_v0_overall", "food_v1_atmosphere")).toBe(
      false,
    );
    expect(canUpgradeReviewModelWithAtmosphere(null, "food_v1_atmosphere")).toBe(false);
  });

  test("historiska overall-only-omdömen behåller sitt frysta helhetsbetyg", () => {
    const historical = {
      overall: 4,
      taste: null,
      service: null,
      value: null,
      atmosphere: null,
      reviewModel: "food_v0_overall" as const,
    };

    expect(effectiveReviewModel(historical.reviewModel, false)).toBe("food_v0_overall");
    expect(effectiveReviewModel(historical.reviewModel, true)).toBe("food_v0_overall");
    expect(effectiveReviewOverall(historical, false)).toBe(4);
    expect(effectiveReviewOverall(historical, true)).toBe(4);
  });

  test("historiska 3D-omdömen härleds stabilt från sina tre dimensioner", () => {
    const historical = {
      overall: 4,
      taste: 4,
      service: 5,
      value: 5,
      atmosphere: null,
      reviewModel: "food_v0_3d" as const,
    };

    expect(effectiveReviewOverall(historical, false)).toBe(4.67);
    expect(effectiveReviewOverall(historical, true)).toBe(4.67);
    expect(reviewModelIncludesAtmosphere(historical.reviewModel)).toBe(false);
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
