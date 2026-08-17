import { describe, expect, test } from "bun:test";
import { DEMO_STATE } from "./demo-data";
import { buildExampleState } from "./example-scenarios";
import { canWithdrawNextStopProposal, deriveNextStopState } from "./next-stop-v2";
import type { AppState, NextStopPlaceProposal } from "./types";

function stateAsMember(memberId: string): AppState {
  return { ...DEMO_STATE, currentUserId: memberId, nextStop: undefined };
}

const proposal: NextStopPlaceProposal = {
  id: "proposal-1",
  placeId: "p1",
  proposedBy: "m3",
  createdAt: "2026-08-16T12:00:00.000Z",
  supports: [],
};

describe("Nästa stopp v2", () => {
  test("legacy-val normaliseras utan att uppfinna Går gärna hit-signaler", () => {
    const nextStop = deriveNextStopState({ ...DEMO_STATE, nextStop: undefined });
    expect(nextStop?.selectedPlaceId).toBe("p5");
    expect(nextStop?.proposals).toHaveLength(1);
    expect(nextStop?.proposals[0]?.placeId).toBe("p5");
    expect(nextStop?.proposals[0]?.supports).toEqual([]);
    expect(nextStop?.plannedTime).toBeNull();
  });

  test("v5k-state ignorerar klockslag i den slutliga dag-only-modellen", () => {
    const state: AppState = {
      ...DEMO_STATE,
      nextStop: {
        revision: 4,
        plannedDate: "2026-08-20",
        plannedTime: "18:30",
        selectedPlaceId: "p1",
        proposals: [proposal],
      },
    };
    expect(deriveNextStopState(state)?.plannedTime).toBeNull();
  });

  test("arkiverad grupp exponerar ingen aktiv planering", () => {
    const state: AppState = {
      ...DEMO_STATE,
      group: { ...DEMO_STATE.group, lifecycleStatus: "archived" },
      nextStop: {
        revision: 2,
        plannedDate: "2026-08-20",
        plannedTime: null,
        selectedPlaceId: "p5",
        proposals: [proposal],
      },
    };
    expect(deriveNextStopState(state)).toBeNull();
  });

  test("förslagsställare och owner/admin kan ta bort förslag", () => {
    expect(canWithdrawNextStopProposal(stateAsMember("m3"), proposal)).toBe(true);
    expect(canWithdrawNextStopProposal(stateAsMember("m1"), proposal)).toBe(true);
    expect(canWithdrawNextStopProposal(stateAsMember("m2"), proposal)).toBe(true);
    expect(canWithdrawNextStopProposal(stateAsMember("m4"), proposal)).toBe(false);
  });

  test("exempelgruppen har ett fokuserat nästa stopp och bevarade alternativ", () => {
    const now = new Date("2026-08-16T12:00:00.000Z");
    const first = deriveNextStopState(buildExampleState(now));
    const second = deriveNextStopState(buildExampleState(now));
    expect(first).toEqual(second);
    expect(first?.proposals.length).toBeGreaterThanOrEqual(2);
    expect(first?.selectedPlaceId).toBe(first?.proposals[0]?.placeId);
    expect(first?.plannedTime).toBeNull();
  });
});
