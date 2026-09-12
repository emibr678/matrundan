import { describe, expect, test } from "bun:test";

import { deriveReviewOverall } from "./review-model";

describe("Issue #307 — aggregatsemantik", () => {
  test("tre- och fyrdimensionella reviews väger lika i ställets snitt", () => {
    const fourDimensions = deriveReviewOverall("food_v1_atmosphere", {
      taste: 5,
      service: 4,
      value: 4,
      atmosphere: 2,
    });
    const threeDimensions = deriveReviewOverall("food_v1_quick", {
      taste: 5,
      service: 4,
      value: 4,
    });

    expect(fourDimensions).toBe(3.75);
    expect(threeDimensions).toBe(4.33);
    expect(((fourDimensions as number) + (threeDimensions as number)) / 2).toBeCloseTo(4.04, 2);
  });
});
