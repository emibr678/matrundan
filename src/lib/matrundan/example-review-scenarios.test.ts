import { describe, expect, test } from "bun:test";

import { EXAMPLE_FIXTURE_REFERENCE_TIME, EXAMPLE_IDS, buildExampleState } from "./example-data";

describe("exempelgruppens omdömesscenarier", () => {
  test("Tacoateljén visar 3 av 4 identifierade deltagare med omdöme", () => {
    const state = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));
    const visit = state.visits.find((item) => item.id === EXAMPLE_IDS.visits.guestReviews);

    expect(visit).toBeDefined();
    expect(visit?.currentUserParticipationStatus).toBe("participant");
    expect(visit?.participantIds).toEqual([
      EXAMPLE_IDS.members.alex,
      EXAMPLE_IDS.members.sam,
      EXAMPLE_IDS.members.kim,
      EXAMPLE_IDS.members.noor,
    ]);
    expect(visit?.visibleReviews).toHaveLength(3);
    expect(visit?.visibleReviews?.map((review) => review.userId)).toEqual([
      EXAMPLE_IDS.members.sam,
      EXAMPLE_IDS.members.kim,
      EXAMPLE_IDS.members.noor,
    ]);
    expect(
      visit?.participants?.some(
        (participant) =>
          participant.id === EXAMPLE_IDS.members.guestAya && participant.status === "guest",
      ),
    ).toBe(true);
  });

  test("dold deltagarkommentar finns som integritetsfixture men får inte markeras synlig", () => {
    const state = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));
    const visit = state.visits.find((item) => item.id === EXAMPLE_IDS.visits.guestReviews);
    const noorReview = visit?.visibleReviews?.find(
      (review) => review.userId === EXAMPLE_IDS.members.noor,
    );

    expect(noorReview?.ratingVisible).toBe(true);
    expect(noorReview?.commentVisible).toBe(false);
    expect(noorReview?.comment).toContain("dolda kommentaren");
  });

  test("Rundans Bistros första besök har inget aktivt synligt omdöme", () => {
    const state = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));
    const visit = state.visits.find((item) => item.id === EXAMPLE_IDS.visits.providerBistroFirst);

    expect(visit?.visibleReviews).toHaveLength(1);
    expect(visit?.visibleReviews?.every((review) => !review.ratingVisible)).toBe(true);
  });

  test("Rundans Bistro har separat synligt underlag för lunch och middag", () => {
    const state = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));
    const lunch = state.visits.find((item) => item.id === EXAMPLE_IDS.visits.providerBistroLunch);
    const dinner = state.visits.find((item) => item.id === EXAMPLE_IDS.visits.providerBistroReturn);

    expect(lunch?.meal).toBe("lunch");
    expect(lunch?.visibleReviews?.filter((review) => review.ratingVisible)).toHaveLength(2);
    expect(dinner?.meal).toBe("middag");
    expect(dinner?.visibleReviews?.filter((review) => review.ratingVisible)).toHaveLength(1);
  });

  test("visar både historisk 3D-modell och modern Atmosfär-modell", () => {
    const state = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));
    const historical = state.visits
      .find((item) => item.id === EXAMPLE_IDS.visits.providerBistroLunch)
      ?.visibleReviews?.find((review) => review.userId === state.currentUserId);
    const modern = state.visits
      .find((item) => item.id === EXAMPLE_IDS.visits.repeatCafeLatest)
      ?.visibleReviews?.find((review) => review.userId === state.currentUserId);

    expect(historical).toMatchObject({
      overall: 4.67,
      taste: 4,
      value: 5,
      service: 5,
      atmosphere: null,
      reviewModel: "food_v0_3d",
    });
    expect(modern?.reviewModel).toBe("food_v1_atmosphere");
  });

  test("självkorrigerad deltagare lämnar registreraren kvar på besöket", () => {
    const state = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));
    const visit = state.visits.find((item) => item.id === EXAMPLE_IDS.visits.archivedHistory);

    expect(visit?.currentUserParticipationStatus).toBe("declined");
    expect(visit?.participantIds).not.toContain(state.currentUserId);
    expect(visit?.participantIds).toContain(visit?.createdBy);
    expect(visit?.visibleReviews?.some((review) => review.userId === visit?.createdBy)).toBe(true);
  });
});
