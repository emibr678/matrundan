import { describe, expect, test } from "vitest";

import {
  deriveReviewOverall,
  reviewModelExplanation,
  reviewModelForContext,
  reviewModelIncludesAtmosphere,
  reviewRatingsComplete,
} from "./review-model";

describe("reviewModelForContext", () => {
  test("Hämtmat använder tre dimensioner oavsett Passar för", () => {
    expect(
      reviewModelForContext({ isTakeaway: true, occasions: ["avslappnat", "middag"] }),
    ).toBe("food_v1_takeaway");
  });

  test("endast Snabbt och enkelt använder tre dimensioner", () => {
    expect(reviewModelForContext({ isTakeaway: false, occasions: ["snabbt"] })).toBe(
      "food_v1_quick",
    );
  });

  test.each([
    [["avslappnat"]],
    [["middag"]],
    [["snabbt", "avslappnat"]],
    [["snabbt", "middag"]],
  ] as const)("På plats med %j kräver Atmosfär", ([occasions]) => {
    expect(reviewModelForContext({ isTakeaway: false, occasions })).toBe(
      "food_v1_atmosphere",
    );
  });

  test("saknat Passar för lämnar modellen olöst för På plats", () => {
    expect(reviewModelForContext({ isTakeaway: false, occasions: [] })).toBeNull();
  });
});

describe("deriveReviewOverall", () => {
  test("tre dimensioner ger enkelt aritmetiskt medelvärde", () => {
    expect(
      deriveReviewOverall("food_v1_quick", {
        taste: 5,
        service: 4,
        value: 4,
        atmosphere: null,
      }),
    ).toBe(4.33);
  });

  test("fyra dimensioner inkluderar Atmosfär utan viktning", () => {
    expect(
      deriveReviewOverall("food_v1_atmosphere", {
        taste: 5,
        service: 4,
        value: 4,
        atmosphere: 2,
      }),
    ).toBe(3.75);
  });

  test("ofullständiga relevanta dimensioner ger inget helhetsbetyg", () => {
    expect(
      deriveReviewOverall("food_v1_atmosphere", {
        taste: 5,
        service: 4,
        value: 4,
        atmosphere: 0,
      }),
    ).toBeNull();
  });

  test("Atmosfär ignoreras inte tyst i en tredimensionell modell", () => {
    expect(
      reviewRatingsComplete("food_v1_quick", {
        taste: 5,
        service: 4,
        value: 4,
        atmosphere: 2,
      }),
    ).toBe(true);
    expect(reviewModelIncludesAtmosphere("food_v1_quick")).toBe(false);
  });
});

describe("reviewModelExplanation", () => {
  test("förklarar varför Atmosfär inte ingår när det kan vara oväntat", () => {
    expect(reviewModelExplanation("food_v1_takeaway")).toMatch(/Hämtmat/);
    expect(reviewModelExplanation("food_v1_quick")).toMatch(/Snabbt och enkelt/);
    expect(reviewModelExplanation("food_v1_atmosphere")).toBeNull();
  });
});
