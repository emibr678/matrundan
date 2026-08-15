import { describe, expect, test } from "bun:test";

import type { Visit, VisibleReview } from "./types";
import { getVisitReviewSummary, visitReviewProgressLabel } from "./visit-reviews";

function visibleReview(
  id: string,
  userId: string,
  overall: number,
  overrides: Partial<VisibleReview> = {},
): VisibleReview {
  return {
    id,
    userId,
    overall,
    taste: overall,
    value: overall,
    service: overall,
    comment: `${userId} kommentar`,
    ratingVisible: true,
    commentVisible: true,
    ...overrides,
  };
}

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: "visit-1",
    placeId: "place-1",
    date: "2026-08-15T12:00:00.000Z",
    meal: "middag",
    participantIds: ["me", "sam", "kim"],
    currentUserParticipationStatus: "participant",
    overall: 4,
    taste: 4,
    value: 4,
    service: 4,
    createdBy: "sam",
    visibleReviews: [
      visibleReview("review-sam", "sam", 4),
      visibleReview("review-me", "me", 5),
      visibleReview("review-kim", "kim", 3),
    ],
    ...overrides,
  };
}

describe("reviewunderlag för besöksvyn", () => {
  test("räknar bara synliga omdömen från faktiska deltagare och visar eget först", () => {
    const input = visit({
      visibleReviews: [
        visibleReview("review-sam", "sam", 4),
        visibleReview("review-outsider", "registrar", 5),
        visibleReview("review-hidden", "kim", 3, { ratingVisible: false }),
        visibleReview("review-me", "me", 5),
      ],
      createdBy: "registrar",
    });

    const summary = getVisitReviewSummary(input, "me");

    expect(summary.participantCount).toBe(3);
    expect(summary.reviewCount).toBe(2);
    expect(summary.reviews.map((review) => review.userId)).toEqual(["me", "sam"]);
    expect(summary.ownReview?.id).toBe("review-me");
  });

  test("räknar varje deltagare högst en gång även om ett trasigt payload duplicerar review", () => {
    const input = visit({
      participantIds: ["me", "me", "sam"],
      visibleReviews: [
        visibleReview("review-me-1", "me", 5),
        visibleReview("review-me-2", "me", 1),
        visibleReview("review-sam", "sam", 4),
      ],
    });

    const summary = getVisitReviewSummary(input, "me");

    expect(summary.participantCount).toBe(2);
    expect(summary.reviewCount).toBe(2);
    expect(summary.reviews.map((review) => review.id)).toEqual(["review-me-1", "review-sam"]);
  });

  test("duplicerar inte en reviewkommentar som separat minnesnotering", () => {
    const input = visit({
      comment: "Samma gemensamma minne",
      visibleReviews: [
        visibleReview("review-sam", "sam", 4, { comment: "Samma gemensamma minne" }),
      ],
    });

    expect(getVisitReviewSummary(input, "me").legacyComment).toBeUndefined();
  });

  test("bevarar en äldre unik besöksnotering utan att kalla den gängets kommentar", () => {
    const input = visit({
      comment: "Äldre notering från besöket",
      visibleReviews: [visibleReview("review-sam", "sam", 4, { comment: "Sams eget minne" })],
    });

    expect(getVisitReviewSummary(input, "me").legacyComment).toBe("Äldre notering från besöket");
  });

  test("formulerar inkomna omdömen transparent", () => {
    expect(visitReviewProgressLabel(3, 4)).toBe(
      "3 av 4 deltagare i gruppen har lämnat omdöme",
    );
    expect(visitReviewProgressLabel(0, 4)).toBe(
      "0 av 4 deltagare i gruppen har lämnat omdöme",
    );
    expect(visitReviewProgressLabel(0, 0)).toBe("Inga omdömen ännu");
  });
});
