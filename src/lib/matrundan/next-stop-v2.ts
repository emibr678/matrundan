import { z } from "zod";
import { flushNotificationOutbox } from "./notifications.functions";
import { defaultNextStopDateValue } from "./next-stop-date";
import { rpcClient } from "./rpc-client";
import type { AppState, NextStopPlaceProposal, NextStopState, Role } from "./types";

const ID_SCHEMA = z.string().min(1);
const EXAMPLE_GROUP_ID = "example-stockholm";

export type NextStopDayResponseValue = "can" | "cannot";

function scheduleNotificationFlush(): void {
  void flushNotificationOutbox().catch(() => {
    /* Notiser får aldrig blockera själva skrivningen. */
  });
}

function legacyProposal(state: AppState, placeId: string): NextStopPlaceProposal {
  const activity = state.activity.find(
    (item) => item.kind === "next-picked" && item.placeId === placeId,
  );
  return {
    id: `legacy-next-stop:${placeId}`,
    placeId,
    proposedBy: activity?.memberId ?? null,
    createdAt: activity?.at ?? state.group.createdAt,
    supports: [],
  };
}

function exampleNextStopState(state: AppState): NextStopState | null {
  const primaryPlaceId = state.nextPlaceId ?? state.places.find((place) => place.id === "p5")?.id;
  const alternativePlaceId = state.places.find(
    (place) => place.id === "p1" && place.collectionStatus !== "archived",
  )?.id;
  if (!primaryPlaceId && !alternativePlaceId) return null;

  const createdAt = state.nextStopDateProposal?.createdAt ?? state.group.createdAt;
  const proposals: NextStopPlaceProposal[] = [];

  if (primaryPlaceId) {
    proposals.push({
      id: "example-next-stop-primary",
      placeId: primaryPlaceId,
      proposedBy: "m1",
      createdAt,
      supports: [],
    });
  }
  if (alternativePlaceId && alternativePlaceId !== primaryPlaceId) {
    proposals.push({
      id: "example-next-stop-alternative",
      placeId: alternativePlaceId,
      proposedBy: "m2",
      createdAt,
      supports: [],
    });
  }

  return {
    revision: 1,
    plannedDate: state.nextStopDateProposal?.date ?? defaultNextStopDateValue(),
    plannedTime: null,
    selectedPlaceId: primaryPlaceId ?? null,
    proposals,
  };
}

/**
 * Normaliserar v5j/demo till v2. Live-v5k lämnas orörd. Undefined på
 * state.nextStop betyder att databasen ännu inte har v5k.
 */
export function deriveNextStopState(state: AppState): NextStopState | null {
  if (state.group.lifecycleStatus === "archived") return null;
  if (state.nextStop !== undefined) {
    return state.nextStop ? { ...state.nextStop, plannedTime: null } : null;
  }
  if (state.group.id === EXAMPLE_GROUP_ID) return exampleNextStopState(state);

  if (!state.nextPlaceId) return null;
  return {
    revision: 0,
    plannedDate: state.nextStopDateProposal?.date ?? null,
    plannedTime: null,
    selectedPlaceId: state.nextPlaceId,
    proposals: [legacyProposal(state, state.nextPlaceId)],
  };
}

export function currentMemberRole(state: AppState): Role | undefined {
  return state.members.find((member) => member.id === state.currentUserId)?.role;
}

export function canWithdrawNextStopProposal(
  state: AppState,
  proposal: NextStopPlaceProposal,
): boolean {
  const role = currentMemberRole(state);
  return proposal.proposedBy === state.currentUserId || role === "ägare" || role === "admin";
}

export async function liveProposeNextStopPlaceV2(
  groupId: string,
  placeId: string,
): Promise<string> {
  const proposalId = await rpcClient.call(
    "propose_next_stop_place_v2",
    { _group_id: groupId, _place_id: placeId },
    ID_SCHEMA,
    "Kunde inte lägga till förslaget.",
  );
  scheduleNotificationFlush();
  return proposalId;
}

export async function liveSelectNextStopPlaceV2(
  groupId: string,
  proposalId: string,
  expectedRevision: number,
): Promise<void> {
  await rpcClient.callVoid("select_next_stop_place_v2", {
    _group_id: groupId,
    _proposal_id: proposalId,
    _expected_revision: expectedRevision,
  });
  scheduleNotificationFlush();
}

export async function liveWithdrawNextStopPlaceV2(
  groupId: string,
  proposalId: string,
): Promise<void> {
  await rpcClient.callVoid("withdraw_next_stop_place_v2", {
    _group_id: groupId,
    _proposal_id: proposalId,
  });
}

export async function liveSetNextStopDayV2(
  groupId: string,
  date: string | null,
  expectedRevision: number,
): Promise<void> {
  await rpcClient.callVoid("set_next_stop_schedule_v2", {
    _group_id: groupId,
    _planned_date: date,
    _planned_time: null,
    _expected_revision: expectedRevision,
  });
}

export async function liveSetNextStopDayResponseV2(
  groupId: string,
  response: NextStopDayResponseValue | null,
): Promise<void> {
  await rpcClient.callVoid("set_next_stop_day_response_v2", {
    _group_id: groupId,
    _response: response,
  });
}
