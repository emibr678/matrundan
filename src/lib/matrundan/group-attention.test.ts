import { describe, expect, test } from "bun:test";

import { EXAMPLE_FIXTURE_REFERENCE_TIME, EXAMPLE_IDS } from "./example-data";
import {
  getPersonalJourneyAttentionGroupIds,
  loadPersonalJourneyAttentionGroupIds,
} from "./group-attention";
import type { PersonalJourneyGroup, PersonalJourneyVisit } from "./personal-journey";
import { DEMO_PERSONAL_JOURNEY_VISITS } from "./personal-journey-demo";

const NOW = new Date("2026-10-02T12:00:00+02:00");

const activeGroup: PersonalJourneyGroup = {
  groupId: "33333333-3333-4333-8333-333333333333",
  groupName: "Aktiv grupp",
  isArchived: false,
  isWritable: true,
};

function visit({
  id = "11111111-1111-4111-8111-111111111111",
  visitedOn = "2026-10-01",
  participated = true,
  reviewPending = true,
  groups = [activeGroup],
}: {
  id?: string;
  visitedOn?: string;
  participated?: boolean;
  reviewPending?: boolean;
  groups?: PersonalJourneyGroup[];
} = {}): PersonalJourneyVisit {
  return {
    id,
    placeId: "22222222-2222-4222-8222-222222222222",
    placeName: "Teststället",
    category: "restaurang",
    address: "Testgatan 1",
    area: null,
    city: "Stockholm",
    visitedOn,
    mealType: "middag",
    isTakeaway: false,
    participated,
    ownReviewId: reviewPending ? null : "88888888-8888-4888-8888-888888888888",
    reviewPending,
    rating: 4.2,
    reviewCount: 2,
    groups,
    photoDeliveryToken: null,
  };
}

describe("group attention", () => {
  test("markerar alla aktiva grupper för samma kanoniska pending-besök utan räknare", () => {
    const secondGroup: PersonalJourneyGroup = {
      ...activeGroup,
      groupId: "44444444-4444-4444-8444-444444444444",
      groupName: "Andra gruppen",
    };

    const groupIds = getPersonalJourneyAttentionGroupIds(
      [visit({ groups: [activeGroup, secondGroup] })],
      NOW,
    );

    expect([...groupIds]).toEqual([activeGroup.groupId, secondGroup.groupId]);
  });

  test("flera pending-besök i samma grupp ger fortfarande bara en binär signal", () => {
    const visits = Array.from({ length: 6 }, (_, index) =>
      visit({
        id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
      }),
    );

    expect([...getPersonalJourneyAttentionGroupIds(visits, NOW)]).toEqual([activeGroup.groupId]);
  });

  test("ignorerar arkiverade och icke skrivbara gruppvägar", () => {
    const archived = { ...activeGroup, isArchived: true };
    const readOnly = {
      ...activeGroup,
      groupId: "55555555-5555-4555-8555-555555555555",
      isWritable: false,
    };

    const groupIds = getPersonalJourneyAttentionGroupIds(
      [visit({ groups: [archived, readOnly] })],
      NOW,
    );

    expect(groupIds.size).toBe(0);
  });

  test("följer det kanoniska 45-dagarsfönstret", () => {
    const inside = visit({ visitedOn: "2026-08-18" });
    const outside = visit({
      id: "66666666-6666-4666-8666-666666666666",
      visitedOn: "2026-08-17",
      groups: [
        {
          ...activeGroup,
          groupId: "77777777-7777-4777-8777-777777777777",
        },
      ],
    });

    expect([...getPersonalJourneyAttentionGroupIds([inside, outside], NOW)]).toEqual([
      activeGroup.groupId,
    ]);
  });

  test("kräver faktiskt deltagande och kanoniskt pending-review-state", () => {
    const groupIds = getPersonalJourneyAttentionGroupIds(
      [
        visit({ participated: false }),
        visit({
          id: "99999999-9999-4999-8999-999999999999",
          reviewPending: false,
        }),
      ],
      NOW,
    );

    expect(groupIds.size).toBe(0);
  });

  test("exempelkontraktet har attention i två grupper vid sin fasta referenstid", () => {
    const groupIds = getPersonalJourneyAttentionGroupIds(
      DEMO_PERSONAL_JOURNEY_VISITS,
      new Date(EXAMPLE_FIXTURE_REFERENCE_TIME),
    );

    expect(groupIds.has(EXAMPLE_IDS.group)).toBe(true);
    expect(groupIds.size).toBe(2);
  });

  test("paginerar vidare inom 45 dagar så grupper efter de första fem inte tappas", async () => {
    const secondGroup: PersonalJourneyGroup = {
      ...activeGroup,
      groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      groupName: "Grupp på nästa sida",
    };
    const calls: Array<string | null> = [];

    const result = await loadPersonalJourneyAttentionGroupIds(NOW, async ({ cursor }) => {
      calls.push(cursor?.id ?? null);
      if (!cursor) {
        return {
          items: [
            visit({ visitedOn: "2026-10-01" }),
            visit({
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              visitedOn: "2026-09-20",
            }),
          ],
          nextCursor: {
            visitedOn: "2026-09-20",
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          },
        };
      }

      return {
        items: [
          visit({
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            visitedOn: "2026-09-01",
            groups: [secondGroup],
          }),
        ],
        nextCursor: null,
      };
    });

    expect(new Set(result)).toEqual(new Set([activeGroup.groupId, secondGroup.groupId]));
    expect(calls).toHaveLength(2);
  });

  test("slutar paginera när sorteringen passerat 45-dagarsfönstret", async () => {
    let calls = 0;

    const result = await loadPersonalJourneyAttentionGroupIds(NOW, async () => {
      calls += 1;
      return {
        items: [
          visit({ visitedOn: "2026-10-01" }),
          visit({
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            visitedOn: "2026-08-17",
          }),
        ],
        nextCursor: {
          visitedOn: "2026-08-17",
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        },
      };
    });

    expect(result).toEqual([activeGroup.groupId]);
    expect(calls).toBe(1);
  });
});
