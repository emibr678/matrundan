import { describe, expect, test } from "bun:test";
import {
  EXAMPLE_FIXTURE_REFERENCE_TIME,
  EXAMPLE_IDS,
  buildExampleState,
} from "./example-data";

describe("exempelgruppens deltagarscenarier", () => {
  const state = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));

  test("visar en faktisk deltagare som saknar eget omdöme", () => {
    const visit = state.visits.find((item) => item.id === EXAMPLE_IDS.visits.guestReviews);
    expect(visit).toBeDefined();
    expect(visit?.currentUserParticipationStatus).toBe("participant");
    expect(visit?.participantIds).toContain(state.currentUserId);
    expect(
      visit?.visibleReviews?.some((review) => review.userId === state.currentUserId),
    ).toBe(false);
    expect(visit?.visibleReviews).toHaveLength(2);
  });

  test("visar självkorrigerat deltagande utan registreraromdöme", () => {
    const visit = state.visits.find((item) => item.id === EXAMPLE_IDS.visits.archivedHistory);
    expect(visit).toBeDefined();
    expect(visit?.currentUserParticipationStatus).toBe("declined");
    expect(visit?.participantIds).not.toContain(state.currentUserId);
    expect(visit?.participantIds).not.toContain(visit?.createdBy);
    expect(
      visit?.visibleReviews?.some((review) => review.userId === visit?.createdBy),
    ).toBe(false);
  });
});
