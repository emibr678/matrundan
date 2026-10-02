import { describe, expect, test } from "bun:test";

import { EXAMPLE_FIXTURE_REFERENCE_TIME, EXAMPLE_IDS } from "./example-data";
import { getPersonalJourneyAttentionGroupIds } from "./group-attention";
import type { PersonalJourneyOverview } from "./personal-journey";
import { DEMO_PERSONAL_JOURNEY_OVERVIEW } from "./personal-journey-demo";

const NOW = new Date("2026-10-02T12:00:00+02:00");

function overview(
  pendingReviews: PersonalJourneyOverview["pendingReviews"],
): PersonalJourneyOverview {
  return {
    summary: {
      attendedVisitCount: 0,
      attendedPlaceCount: 0,
      readableGroupCount: 0,
      activeGroupCount: 0,
    },
    pendingReviews,
    topRatedPlaces: [],
    favoritePlaces: [],
    recentVisits: [],
  };
}

function pending({
  visitId = "11111111-1111-4111-8111-111111111111",
  visitedOn = "2026-10-01",
  groups,
}: {
  visitId?: string;
  visitedOn?: string;
  groups: PersonalJourneyOverview["pendingReviews"][number]["groups"];
}): PersonalJourneyOverview["pendingReviews"][number] {
  return {
    visitId,
    placeId: "22222222-2222-4222-8222-222222222222",
    placeName: "Teststället",
    visitedOn,
    mealType: "middag",
    isTakeaway: false,
    groups,
  };
}

const activeGroup = {
  groupId: "33333333-3333-4333-8333-333333333333",
  groupName: "Aktiv grupp",
  isArchived: false,
  isWritable: true,
};

describe("group attention", () => {
  test("markerar alla aktiva grupper för samma kanoniska pending-besök utan räknare", () => {
    const secondGroup = {
      ...activeGroup,
      groupId: "44444444-4444-4444-8444-444444444444",
      groupName: "Andra gruppen",
    };

    expect([
      ...getPersonalJourneyAttentionGroupIds(
        overview([pending({ groups: [activeGroup, secondGroup] })]),
        NOW,
      ),
    ]).toEqual([activeGroup.groupId, secondGroup.groupId]);
  });

  test("ignorerar arkiverade och icke skrivbara gruppvägar", () => {
    const archived = { ...activeGroup, isArchived: true };
    const readOnly = {
      ...activeGroup,
      groupId: "55555555-5555-4555-8555-555555555555",
      isWritable: false,
    };

    expect(
      getPersonalJourneyAttentionGroupIds(
        overview([pending({ groups: [archived, readOnly] })]),
        NOW,
      ).size,
    ).toBe(0);
  });

  test("följer det kanoniska 45-dagarsfönstret", () => {
    const inside = pending({ visitedOn: "2026-08-18", groups: [activeGroup] });
    const outside = pending({
      visitId: "66666666-6666-4666-8666-666666666666",
      visitedOn: "2026-08-17",
      groups: [
        {
          ...activeGroup,
          groupId: "77777777-7777-4777-8777-777777777777",
        },
      ],
    });

    expect([...getPersonalJourneyAttentionGroupIds(overview([inside, outside]), NOW)]).toEqual([
      activeGroup.groupId,
    ]);
  });

  test("utan pending finns ingen samlad signal", () => {
    expect(getPersonalJourneyAttentionGroupIds(overview([]), NOW).size).toBe(0);
  });

  test("exempelkontraktet har en synlig attention-signal vid sin fasta referenstid", () => {
    const groupIds = getPersonalJourneyAttentionGroupIds(
      DEMO_PERSONAL_JOURNEY_OVERVIEW,
      new Date(EXAMPLE_FIXTURE_REFERENCE_TIME),
    );

    expect(groupIds.has(EXAMPLE_IDS.group)).toBe(true);
    expect(groupIds.size).toBe(2);
  });
});
