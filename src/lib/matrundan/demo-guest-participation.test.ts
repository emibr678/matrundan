import { describe, expect, test } from "bun:test";

import { EXAMPLE_FIXTURE_REFERENCE_TIME, EXAMPLE_IDS, buildExampleState } from "./example-data";
import { acceptOwnDemoGuestParticipation } from "./demo-visit-participation";

describe("exempelgruppens deltagandebekräftelse för Issue #214", () => {
  test("det delade besöket börjar som anonym extern deltagare för exempelanvändaren", () => {
    const state = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));
    const visit = state.visits.find((item) => item.id === EXAMPLE_IDS.visits.sharedVisit);

    expect(visit?.linkType).toBe("shared");
    expect(visit?.participantIds).not.toContain(state.currentUserId);
    expect(visit?.externalParticipantCount).toBeGreaterThan(0);
  });

  test("accept ersätter en anonym extern person med samma användare på samma visit", () => {
    const state = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));
    const before = state.visits.find((item) => item.id === EXAMPLE_IDS.visits.sharedVisit);
    if (!before) throw new Error("Exempelbesöket saknas.");

    const next = acceptOwnDemoGuestParticipation(state, before.id);
    const after = next.visits.find((item) => item.id === before.id);

    expect(next.visits.filter((item) => item.id === before.id)).toHaveLength(1);
    expect(after?.participantIds).toContain(state.currentUserId);
    expect(after?.currentUserParticipationStatus).toBe("participant");
    expect(after?.participants?.some((participant) => participant.id === state.currentUserId)).toBe(
      true,
    );
    expect(after?.externalParticipantCount).toBe((before.externalParticipantCount ?? 0) - 1);
  });
});
