import { describe, expect, test } from "bun:test";

import { deriveReviewOverall } from "./review-model";

describe("Issue #307 — aggregatsemantik", () => {
  test("olika modellgenerationer väger lika via respektive helhetsbetyg", () => {
    const historical = deriveReviewOverall("food_v0_3d", {
      taste: 4,
      service: 5,
      value: 5,
    });
    const modern = deriveReviewOverall("food_v1_atmosphere", {
      taste: 4,
      service: 5,
      value: 5,
      atmosphere: 3,
    });
    const additional = 4.5;

    expect(historical).toBe(4.67);
    expect(modern).toBe(4.25);
    expect(((historical as number) + (modern as number) + additional) / 3).toBeCloseTo(4.47, 2);
  });
});
