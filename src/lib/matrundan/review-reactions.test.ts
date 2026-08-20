import { describe, expect, test } from "bun:test";

import { buildExampleState, EXAMPLE_IDS } from "./example-scenarios";
import { getDemoReviewReactionStates, setOwnDemoReviewReaction } from "./review-reactions";

describe("privata omdömesreaktioner", () => {
  const now = new Date("2026-08-19T08:00:00+02:00");

  test("exempelgruppen visar varm men diskret reaktionsdata på en synlig kommentar", () => {
    const state = buildExampleState(now);
    const reactions = getDemoReviewReactionStates(state, EXAMPLE_IDS.visits.guestReviews);
    const sam = reactions.find((item) => item.reviewId === "review-v2-sam");

    expect(sam?.myReaction).toBe("drool");
    expect(sam?.reactions.map((bucket) => [bucket.reaction, bucket.count])).toEqual([
      ["heart", 1],
      ["drool", 1],
      ["celebrate", 1],
    ]);
  });

  test("egen reaktion kan bytas och tas bort utan att flera egna reaktioner blir kvar", () => {
    const state = buildExampleState(now);
    const heartState = setOwnDemoReviewReaction(
      state,
      EXAMPLE_IDS.visits.guestReviews,
      "review-v2-sam",
      "heart",
    );
    const heart = getDemoReviewReactionStates(heartState, EXAMPLE_IDS.visits.guestReviews).find(
      (item) => item.reviewId === "review-v2-sam",
    );

    expect(heart?.myReaction).toBe("heart");
    expect(heart?.reactions.find((bucket) => bucket.reaction === "heart")?.count).toBe(2);
    expect(heart?.reactions.find((bucket) => bucket.reaction === "drool")).toBeUndefined();

    const clearedState = setOwnDemoReviewReaction(
      heartState,
      EXAMPLE_IDS.visits.guestReviews,
      "review-v2-sam",
      null,
    );
    const cleared = getDemoReviewReactionStates(clearedState, EXAMPLE_IDS.visits.guestReviews).find(
      (item) => item.reviewId === "review-v2-sam",
    );
    expect(cleared?.myReaction).toBeNull();
    expect(
      cleared?.reactions.some((bucket) =>
        bucket.reactors.some((person) => person.userId === state.currentUserId),
      ),
    ).toBe(false);
  });

  test("aktiv gruppmedlem får reagera även utan att vara deltagare", () => {
    const state = buildExampleState(now);
    const nonParticipantState = {
      ...state,
      currentUserId: EXAMPLE_IDS.members.robin,
    };
    expect(
      state.visits
        .find((visit) => visit.id === EXAMPLE_IDS.visits.guestReviews)
        ?.participantIds.includes(EXAMPLE_IDS.members.robin),
    ).toBe(false);

    const next = setOwnDemoReviewReaction(
      nonParticipantState,
      EXAMPLE_IDS.visits.guestReviews,
      "review-v2-sam",
      "laugh",
    );
    const reaction = getDemoReviewReactionStates(next, EXAMPLE_IDS.visits.guestReviews).find(
      (item) => item.reviewId === "review-v2-sam",
    );
    expect(reaction?.myReaction).toBe("laugh");
  });

  test("dold eller tom kommentar kan inte reageras på", () => {
    const state = buildExampleState(now);
    const visits = state.visits.map((visit) =>
      visit.id !== EXAMPLE_IDS.visits.guestReviews
        ? visit
        : {
            ...visit,
            visibleReviews: visit.visibleReviews?.map((review) =>
              review.id === "review-v2-sam" ? { ...review, commentVisible: false } : review,
            ),
          },
    );
    const hiddenState = { ...state, visits };

    expect(() =>
      setOwnDemoReviewReaction(
        hiddenState,
        EXAMPLE_IDS.visits.guestReviews,
        "review-v2-sam",
        "heart",
      ),
    ).toThrow("Omdömet kan inte reageras på");
  });
});
