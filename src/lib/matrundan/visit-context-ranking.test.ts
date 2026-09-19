import { describe, expect, test } from "bun:test";

import type { Visit, VisibleReview } from "./types";
import { ratingForPlaceInVisitContext } from "./visit-context-ranking";

function review(
  id: string,
  userId: string,
  overall: number | null,
  ratingVisible = true,
): VisibleReview {
  return {
    id,
    userId,
    overall,
    ratingVisible,
    commentVisible: true,
  };
}

function visit(
  id: string,
  meal: Visit["meal"],
  overall: number,
  options: {
    placeId?: string;
    isTakeaway?: boolean;
    participantIds?: string[];
    visibleReviews?: VisibleReview[];
  } = {},
): Visit {
  return {
    id,
    placeId: options.placeId ?? "p1",
    date: "2026-09-01T00:00:00.000Z",
    meal,
    isTakeaway: options.isTakeaway,
    participantIds: options.participantIds ?? ["m1"],
    overall,
    createdBy: "m1",
    visibleReviews: options.visibleReviews ?? [review(`r-${id}`, "m1", overall)],
  };
}

describe("historikbaserat topplistebetyg", () => {
  test("håller lunch och middag separata men kan visa transparent totalsnitt", () => {
    const visits = [visit("v-lunch", "lunch", 5), visit("v-dinner", "middag", 3)];

    expect(ratingForPlaceInVisitContext(visits, "p1", { meals: ["lunch"] })).toEqual({
      overall: 5,
      count: 1,
      visitCount: 1,
    });
    expect(ratingForPlaceInVisitContext(visits, "p1", { meals: ["middag"] })).toEqual({
      overall: 3,
      count: 1,
      visitCount: 1,
    });
    expect(ratingForPlaceInVisitContext(visits, "p1", { meals: [] })).toEqual({
      overall: 4,
      count: 2,
      visitCount: 2,
    });
    expect(
      ratingForPlaceInVisitContext(visits, "p1", { meals: ["lunch", "middag"] }),
    ).toEqual({
      overall: 4,
      count: 2,
      visitCount: 2,
    });
  });

  test("räknar bara faktiska deltagares synliga numeriska omdömen", () => {
    const visits = [
      visit("v1", "lunch", 5, {
        participantIds: ["m1", "m2"],
        visibleReviews: [
          review("visible", "m1", 5),
          review("hidden", "m2", 1, false),
          review("not-participant", "m3", 1),
          review("comment-only", "m2", null),
        ],
      }),
    ];

    expect(ratingForPlaceInVisitContext(visits, "p1", { meals: ["lunch"] })).toEqual({
      overall: 5,
      count: 1,
      visitCount: 1,
    });
  });

  test("samma kanoniska besök räknas aldrig två gånger", () => {
    const canonical = visit("v1", "fika", 4);
    const duplicate = {
      ...canonical,
      visibleReviews: [review("duplicate", "m1", 1)],
    };

    expect(ratingForPlaceInVisitContext([canonical, duplicate], "p1", { meals: ["fika"] })).toEqual({
      overall: 4,
      count: 1,
      visitCount: 1,
    });
  });

  test("hämtmat kan kombineras med ett tillfälle", () => {
    const visits = [
      visit("takeaway", "lunch", 5, { isTakeaway: true }),
      visit("onsite", "lunch", 2, { isTakeaway: false }),
      visit("takeaway-dinner", "middag", 3, { isTakeaway: true }),
    ];

    expect(
      ratingForPlaceInVisitContext(visits, "p1", {
        meals: ["lunch"],
        takeawayOnly: true,
      }),
    ).toEqual({
      overall: 5,
      count: 1,
      visitCount: 1,
    });
  });

  test("Något att dricka är ett besök men aldrig rankingunderlag", () => {
    const visits = [visit("drink", "dryck", 5)];

    expect(ratingForPlaceInVisitContext(visits, "p1", { meals: [] })).toEqual({
      overall: 0,
      count: 0,
      visitCount: 0,
    });
  });
});
