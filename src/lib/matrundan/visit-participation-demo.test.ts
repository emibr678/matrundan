import { describe, expect, test } from "bun:test";
import {
  saveOwnDemoReviewForVisit,
  setOwnDemoVisitParticipation,
} from "./demo-visit-participation";
import { EXAMPLE_FIXTURE_REFERENCE_TIME, EXAMPLE_IDS, buildExampleState } from "./example-data";

const storeSource = await Bun.file("src/lib/matrundan/store.tsx").text();

describe("demo-paritet för gemensamma besök", () => {
  test("registreraromdömen filtreras bort när registreraren inte deltog", () => {
    expect(storeSource).toContain(
      "visit.participantIds.includes(review.userId)",
    );
    expect(storeSource).toContain("visibleReviews: reviews");
  });

  test("deltagare kan komplettera, korrigera och återställa samma besök", () => {
    const initial = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));
    const visitId = EXAMPLE_IDS.visits.guestReviews;

    const reviewed = saveOwnDemoReviewForVisit(initial, visitId, {
      overall: 5,
      taste: 5,
      value: 4,
      service: 4,
      comment: "Mitt eget omdöme",
    });
    const reviewedVisit = reviewed.visits.find((visit) => visit.id === visitId);
    const ownReview = reviewedVisit?.visibleReviews?.find(
      (review) => review.userId === reviewed.currentUserId,
    );
    expect(ownReview?.overall).toBe(5);
    expect(reviewedVisit?.currentUserParticipationStatus).toBe("participant");

    const declined = setOwnDemoVisitParticipation(reviewed, visitId, false);
    const declinedVisit = declined.visits.find((visit) => visit.id === visitId);
    expect(declinedVisit?.currentUserParticipationStatus).toBe("declined");
    expect(declinedVisit?.participantIds).not.toContain(declined.currentUserId);
    expect(
      declinedVisit?.visibleReviews?.find((review) => review.userId === declined.currentUserId)?.id,
    ).toBe(ownReview?.id);
    expect(
      declinedVisit?.visibleReviews?.find((review) => review.userId === declined.currentUserId)
        ?.ratingVisible,
    ).toBe(false);

    const restored = setOwnDemoVisitParticipation(declined, visitId, true);
    const restoredVisit = restored.visits.find((visit) => visit.id === visitId);
    const restoredReview = restoredVisit?.visibleReviews?.find(
      (review) => review.userId === restored.currentUserId,
    );
    expect(restoredVisit?.currentUserParticipationStatus).toBe("participant");
    expect(restoredVisit?.participantIds).toContain(restored.currentUserId);
    expect(restoredReview?.id).toBe(ownReview?.id);
    expect(restoredReview?.ratingVisible).toBe(true);
  });
});
