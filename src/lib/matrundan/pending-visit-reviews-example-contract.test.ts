import { describe, expect, test } from "bun:test";

import { EXAMPLE_FIXTURE_REFERENCE_TIME, EXAMPLE_IDS, buildExampleState } from "./example-data";
import {
  getAttentionPendingVisitReviews,
  isVisitReviewInsideAttentionWindow,
  isVisitReviewPending,
} from "./pending-visit-reviews";

describe("exempelgruppens pending-omdömen", () => {
  test("har två aktuella deltagarbesök utan eget omdöme men inga falska registrar-pending", () => {
    const now = new Date(EXAMPLE_FIXTURE_REFERENCE_TIME);
    const state = buildExampleState(now);
    const pending = getAttentionPendingVisitReviews(state.visits, state.currentUserId, now);

    expect(pending.map((visit) => visit.id)).toEqual([
      EXAMPLE_IDS.visits.guestReviews,
      EXAMPLE_IDS.visits.formerMemberHistory,
    ]);

    const latestRegisteredByAlex = state.visits.find(
      (visit) => visit.id === EXAMPLE_IDS.visits.repeatCafeLatest,
    );
    const returnRegisteredByAlex = state.visits.find(
      (visit) => visit.id === EXAMPLE_IDS.visits.providerBistroReturn,
    );

    expect(latestRegisteredByAlex?.createdBy).toBe(state.currentUserId);
    expect(returnRegisteredByAlex?.createdBy).toBe(state.currentUserId);
    expect(isVisitReviewPending(latestRegisteredByAlex!, state.currentUserId)).toBe(false);
    expect(isVisitReviewPending(returnRegisteredByAlex!, state.currentUserId)).toBe(false);
  });

  test("håller Tacoateljéns aggregat begripligt när Alex review saknas", () => {
    const state = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));
    const pendingVisit = state.visits.find((visit) => visit.id === EXAMPLE_IDS.visits.guestReviews);

    expect(pendingVisit?.visibleReviews?.map((review) => review.overall)).toEqual([4, 4, 5]);
    expect(pendingVisit?.overall).toBeCloseTo(13 / 3);
    expect(pendingVisit?.taste).toBeCloseTo(13 / 3);
    expect(pendingVisit?.value).toBe(4);
    expect(pendingVisit?.service).toBe(4);
  });

  test("behåller äldre kanoniskt pending utan att göra det framträdande", () => {
    const now = new Date(EXAMPLE_FIXTURE_REFERENCE_TIME);
    const state = buildExampleState(now);
    const older = state.visits.find((visit) => visit.id === EXAMPLE_IDS.visits.repeatCafeEarlier);

    expect(older).toBeDefined();
    expect(isVisitReviewPending(older!, state.currentUserId)).toBe(true);
    expect(isVisitReviewInsideAttentionWindow(older!, now)).toBe(false);
  });

  test("självkorrigerat deltagande är inte pending", () => {
    const now = new Date(EXAMPLE_FIXTURE_REFERENCE_TIME);
    const state = buildExampleState(now);
    const corrected = state.visits.find((visit) => visit.id === EXAMPLE_IDS.visits.archivedHistory);

    expect(corrected?.currentUserParticipationStatus).toBe("declined");
    expect(isVisitReviewPending(corrected!, state.currentUserId)).toBe(false);
  });
});
