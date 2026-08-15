import { describe, expect, test } from "bun:test";
import {
  EXAMPLE_FIXTURE_REFERENCE_TIME,
  EXAMPLE_IDS,
  EXAMPLE_STATE,
  buildExampleState,
} from "./example-data";
import { exampleExternalInfoForPlace } from "./example-place-external-info";
import type { ActivityTarget, AppState } from "./types";

const FIXED_NOW = new Date(EXAMPLE_FIXTURE_REFERENCE_TIME);

const FORMER_REAL_PLACE_NAMES = [
  "Pelikan",
  "Café Pascal",
  "La Neta City",
  "Lillebrors Bageri",
  "Hermans",
  "Meatballs for the People",
  "Falloumi",
  "K25",
  "Restaurang Kvarnen",
];

function expectUnique(values: string[], label: string) {
  expect(new Set(values).size, `${label} ska ha unika ID:n`).toBe(values.length);
}

function expectValidTarget(
  target: ActivityTarget,
  state: AppState,
  placeIds: Set<string>,
  visitIds: Set<string>,
  memberIds: Set<string>,
) {
  if (target.kind === "place") {
    expect(placeIds.has(target.placeId)).toBe(true);
  } else if (target.kind === "visit") {
    expect(placeIds.has(target.placeId)).toBe(true);
    expect(visitIds.has(target.visitId)).toBe(true);
    expect(state.visits.find((visit) => visit.id === target.visitId)?.placeId).toBe(target.placeId);
  } else {
    expect(memberIds.has(target.memberId)).toBe(true);
  }
}

describe("publik exempeldata", () => {
  test("är deterministisk för samma referenstid och rörlig för en ny session", () => {
    const first = buildExampleState(FIXED_NOW);
    const second = buildExampleState(new Date(FIXED_NOW));
    const later = buildExampleState(new Date(FIXED_NOW.getTime() + 24 * 60 * 60 * 1000));

    expect(second).toEqual(first);
    expect(later.group.createdAt).not.toBe(first.group.createdAt);
    expect(later.nextStopDateProposal?.date).not.toBe(first.nextStopDateProposal?.date);
  });

  test("använder enbart fiktiva matställen och både manuellt och providerbaserat ursprung", () => {
    const names = EXAMPLE_STATE.places.map((place) => place.name);
    expect(EXAMPLE_STATE.places).toHaveLength(10);
    expect(EXAMPLE_STATE.places.some((place) => place.origin === "provider")).toBe(true);
    expect(EXAMPLE_STATE.places.some((place) => place.origin === "manual")).toBe(true);
    expect(EXAMPLE_STATE.places.some((place) => place.origin === "shared")).toBe(true);

    for (const realName of FORMER_REAL_PLACE_NAMES) {
      expect(names).not.toContain(realName);
    }
  });

  test("har sammanhängande referenser mellan medlemmar, ställen, besök och aktivitet", () => {
    const state = buildExampleState(FIXED_NOW);
    const memberIds = new Set(state.members.map((member) => member.id));
    const placeIds = new Set(state.places.map((place) => place.id));
    const visitIds = new Set(state.visits.map((visit) => visit.id));

    expectUnique([...memberIds], "Medlemmar");
    expectUnique([...placeIds], "Matställen");
    expectUnique([...visitIds], "Besök");
    expectUnique(
      state.activity.map((activity) => activity.id),
      "Aktivitet",
    );

    for (const visit of state.visits) {
      expect(placeIds.has(visit.placeId)).toBe(true);
      expectUnique(visit.participantIds, `Deltagare i ${visit.id}`);

      const participants = new Map(
        (visit.participants ?? []).map((participant) => [participant.id, participant]),
      );
      for (const participantId of visit.participantIds) {
        const historical = participants.get(participantId);
        expect(memberIds.has(participantId) || historical?.status === "left").toBe(true);
        expect(historical?.status).not.toBe("guest");
      }
      for (const participant of participants.values()) {
        if (participant.status === "guest") {
          expect(memberIds.has(participant.id)).toBe(false);
          expect(visit.participantIds).not.toContain(participant.id);
        }
      }
      for (const visibleReview of visit.visibleReviews ?? []) {
        expect(memberIds.has(visibleReview.userId)).toBe(true);
      }
    }

    for (const favorite of state.favorites) {
      expect(memberIds.has(favorite.memberId)).toBe(true);
      expect(placeIds.has(favorite.placeId)).toBe(true);
    }

    for (const activity of state.activity) {
      expect(memberIds.has(activity.memberId)).toBe(true);
      if (activity.placeId) expect(placeIds.has(activity.placeId)).toBe(true);
      if (activity.visitId) expect(visitIds.has(activity.visitId)).toBe(true);
      if (activity.target) {
        expectValidTarget(activity.target, state, placeIds, visitIds, memberIds);
      }
    }
  });

  test("täcker scenariokatalogen utan att bryta deltagar- och integritetsregler", () => {
    const state = buildExampleState(FIXED_NOW);
    const { places, visits, members } = EXAMPLE_IDS;

    const newLongPlace = state.places.find((place) => place.id === places.longLayout);
    expect(newLongPlace?.name.length ?? 0).toBeGreaterThan(40);
    expect(newLongPlace?.address.length ?? 0).toBeGreaterThan(45);
    expect(state.visits.some((visit) => visit.placeId === places.longLayout)).toBe(false);

    const repeatVisits = state.visits.filter((visit) => visit.placeId === places.repeatCafe);
    expect(repeatVisits).toHaveLength(2);
    expectUnique(
      repeatVisits.map((visit) => visit.id),
      "Återbesök",
    );
    expect(repeatVisits.some((visit) => Boolean(visit.photo?.url))).toBe(true);

    const guestVisit = state.visits.find((visit) => visit.id === visits.guestReviews);
    const guest = guestVisit?.participants?.find((participant) => participant.status === "guest");
    expect(guest?.id).toBe(members.guestAya);
    expect(guestVisit?.participantIds).not.toContain(members.guestAya);
    expect(guestVisit?.visibleReviews).toHaveLength(3);

    const formerVisit = state.visits.find((visit) => visit.id === visits.formerMemberHistory);
    const former = formerVisit?.participants?.find((participant) => participant.status === "left");
    expect(former?.id).toBe(members.formerLina);
    expect(state.members.some((member) => member.id === members.formerLina)).toBe(false);
    expect(formerVisit?.participantIds).toContain(members.formerLina);

    const delegatedVisit = state.visits.find((visit) => visit.id === visits.archivedHistory);
    expect(delegatedVisit?.participantIds).not.toContain(delegatedVisit?.createdBy);

    const archived = state.places.find((place) => place.id === places.archivedBakery);
    expect(archived?.collectionStatus).toBe("archived");
    expect(state.visits.some((visit) => visit.placeId === archived?.id)).toBe(true);
    expect(state.nextPlaceId).not.toBe(archived?.id);

    const shared = state.visits.find((visit) => visit.id === visits.sharedVisit);
    expect(shared?.linkType).toBe("shared");
    expect(shared?.countsForProgression).toBe(false);
    expect(state.group.sharedVisitsCountForProgression).toBe(false);
    expect(shared?.externalParticipantCount).toBe(2);
    expect(shared?.photo).toBeUndefined();
    expect(
      shared?.participants?.every(
        (participant) =>
          participant.status === "active" &&
          state.members.some((member) => member.id === participant.id),
      ),
    ).toBe(true);
    expect(state.visits.filter((visit) => visit.id === visits.sharedVisit)).toHaveLength(1);

    const responses = new Set(
      state.nextStopDateProposal?.responses.map((response) => response.response),
    );
    expect(state.nextPlaceId).toBe(places.nextStop);
    expect(state.nextStopDateProposal?.placeId).toBe(places.nextStop);
    expect(responses).toEqual(new Set(["fits", "unsure", "not_fits"]));
    expect(
      state.nextStopDateProposal?.responses.every((response) =>
        state.members.some((member) => member.id === response.memberId),
      ),
    ).toBe(true);

    expect(
      state.favorites.filter((favorite) => favorite.placeId === places.repeatCafe),
    ).toHaveLength(2);
  });

  test("har fullständig, begränsad och felande extern exempelinfo utan nätverksanrop", () => {
    const state = buildExampleState(FIXED_NOW);
    const fullPlace = state.places.find((place) => place.id === EXAMPLE_IDS.places.providerBistro);
    const limitedPlace = state.places.find((place) => place.id === EXAMPLE_IDS.places.limitedInfo);
    const errorPlace = state.places.find((place) => place.id === EXAMPLE_IDS.places.externalError);

    expect(fullPlace).toBeDefined();
    expect(limitedPlace).toBeDefined();
    expect(errorPlace).toBeDefined();

    const full = exampleExternalInfoForPlace(fullPlace!, FIXED_NOW);
    expect(full?.error).toBeNull();
    expect(full?.details?.website).toBe("https://rundans-bistro.example/");
    expect(full?.details?.openingHours).not.toBeNull();
    expect(full?.details?.location?.address).toBe("Exempelgatan 12");
    expect(full?.details?.fetchedAt).toBe(EXAMPLE_FIXTURE_REFERENCE_TIME);

    const limited = exampleExternalInfoForPlace(limitedPlace!, FIXED_NOW);
    expect(limited?.error).toBeNull();
    expect(limited?.details?.website).toBeNull();
    expect(limited?.details?.openingHours).toBeNull();
    expect(limited?.details?.location).toBeNull();

    const failed = exampleExternalInfoForPlace(errorPlace!, FIXED_NOW);
    expect(failed?.details).toBeNull();
    expect(failed?.error).toContain("kunde inte kontrolleras");
  });

  test("aktivitet, kommentarer och omdömen nämner inte tidigare verkliga namn", () => {
    const text = [
      ...EXAMPLE_STATE.activity.map((activity) => activity.text),
      ...EXAMPLE_STATE.visits.map((visit) => visit.comment ?? ""),
      ...EXAMPLE_STATE.visits.flatMap((visit) =>
        (visit.visibleReviews ?? []).map((review) => review.comment ?? ""),
      ),
    ].join(" ");

    for (const realName of FORMER_REAL_PLACE_NAMES) {
      expect(text).not.toContain(realName);
    }
  });
});
