import { describe, expect, test } from "bun:test";

import type { Visit, VisibleReview } from "./types";
import {
  getAttentionPendingVisitReviews,
  isVisitReviewInsideAttentionWindow,
  isVisitReviewPending,
  PENDING_REVIEW_ATTENTION_DAYS,
} from "./pending-visit-reviews";

const USER_ID = "user-1";
const OTHER_ID = "user-2";
const NOW = new Date("2026-08-16T12:00:00.000Z");

function ownReview(ratingVisible = true): VisibleReview {
  return {
    id: "review-own",
    userId: USER_ID,
    overall: 4,
    taste: 4,
    value: 4,
    service: 4,
    comment: null,
    ratingVisible,
    commentVisible: ratingVisible,
  };
}

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: "visit-1",
    placeId: "place-1",
    date: "2026-08-10",
    meal: "middag",
    participantIds: [USER_ID, OTHER_ID],
    currentUserParticipationStatus: "participant",
    overall: 4,
    createdBy: OTHER_ID,
    visibleReviews: [],
    ...overrides,
  };
}

describe("pending omdöme", () => {
  test("kräver faktisk aktiv deltagare utan eget kanoniskt omdöme", () => {
    expect(isVisitReviewPending(visit(), USER_ID)).toBe(true);
    expect(
      isVisitReviewPending(
        visit({ currentUserParticipationStatus: "declined", participantIds: [OTHER_ID] }),
        USER_ID,
      ),
    ).toBe(false);
    expect(
      isVisitReviewPending(
        visit({ currentUserParticipationStatus: "none", participantIds: [OTHER_ID] }),
        USER_ID,
      ),
    ).toBe(false);
    expect(isVisitReviewPending(visit({ visibleReviews: [ownReview()] }), USER_ID)).toBe(false);
  });

  test("eget kanoniskt omdöme räknas även om ett äldre gruppval döljer betyget", () => {
    expect(isVisitReviewPending(visit({ visibleReviews: [ownReview(false)] }), USER_ID)).toBe(
      false,
    );
  });

  test("behåller kompatibilitetsfallbacken till participantIds", () => {
    expect(
      isVisitReviewPending(
        visit({ currentUserParticipationStatus: undefined, participantIds: [USER_ID] }),
        USER_ID,
      ),
    ).toBe(true);
    expect(
      isVisitReviewPending(
        visit({ currentUserParticipationStatus: undefined, participantIds: [OTHER_ID] }),
        USER_ID,
      ),
    ).toBe(false);
  });

  test("särbehandlar inte registreraren utan följer samma participant/review-regel", () => {
    const registrarVisit = visit({ createdBy: USER_ID, visibleReviews: [ownReview()] });
    expect(isVisitReviewPending(registrarVisit, USER_ID)).toBe(false);

    const legacyInconsistentRegistrar = visit({ createdBy: USER_ID, visibleReviews: [] });
    expect(isVisitReviewPending(legacyInconsistentRegistrar, USER_ID)).toBe(true);
  });

  test("45-dagarsfönstret räknas i lokala kalenderdagar och utesluter framtid", () => {
    expect(PENDING_REVIEW_ATTENTION_DAYS).toBe(45);
    expect(isVisitReviewInsideAttentionWindow(visit({ date: "2026-07-02" }), NOW)).toBe(true);
    expect(isVisitReviewInsideAttentionWindow(visit({ date: "2026-07-01" }), NOW)).toBe(false);
    expect(isVisitReviewInsideAttentionWindow(visit({ date: "2026-08-17" }), NOW)).toBe(false);
    expect(isVisitReviewInsideAttentionWindow(visit({ date: "ogiltigt" }), NOW)).toBe(false);
  });

  test("sorterar nyast först och deduplicerar samma kanoniska visit-id", () => {
    const newest = visit({ id: "visit-new", date: "2026-08-15" });
    const duplicateNewest = visit({ id: "visit-new", date: "2026-08-15" });
    const older = visit({ id: "visit-old", date: "2026-08-05" });
    const tooOld = visit({ id: "visit-too-old", date: "2026-06-01" });

    expect(
      getAttentionPendingVisitReviews([older, newest, duplicateNewest, tooOld], USER_ID, NOW).map(
        (item) => item.id,
      ),
    ).toEqual(["visit-new", "visit-old"]);
  });
});
