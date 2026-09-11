import { describe, expect, test } from "bun:test";
import { findLocalRegistrationVisitDuplicate } from "./visit-duplicates";

const visits = [
  {
    id: "v2",
    placeId: "p1",
    date: "2026-09-08T18:00:00.000Z",
    meal: "middag",
    participantIds: ["m1", "m2"],
  },
  {
    id: "v1",
    placeId: "p1",
    date: "2026-09-08T12:00:00.000Z",
    meal: "lunch",
    participantIds: ["m1"],
  },
  {
    id: "v3",
    placeId: "p1",
    date: "2026-09-09T18:00:00.000Z",
    meal: "middag",
    isTakeaway: true,
    participantIds: ["m1"],
  },
] satisfies Parameters<typeof findLocalRegistrationVisitDuplicate>[0];

describe("lokal dubblettkontroll för besök", () => {
  test("hittar samma plats, datum och tillfälle när aktuell användare deltog", () => {
    expect(findLocalRegistrationVisitDuplicate(visits, "m1", "p1", "2026-09-08", "middag")).toEqual(
      {
        visitId: "v2",
        visitedOn: "2026-09-08",
        mealType: "middag",
        alreadyVisibleInTargetGroup: true,
      },
    );
  });

  test("ignorerar besök där aktuell användare inte deltog", () => {
    expect(
      findLocalRegistrationVisitDuplicate(visits, "m3", "p1", "2026-09-08", "middag"),
    ).toBeNull();
  });

  test("samma dag men annat tillfälle räknas inte som stark dubblett", () => {
    expect(
      findLocalRegistrationVisitDuplicate(visits, "m1", "p1", "2026-09-08", "fika"),
    ).toBeNull();
  });

  test("På plats och Hämtmat räknas som olika verkliga besök", () => {
    expect(
      findLocalRegistrationVisitDuplicate(visits, "m1", "p1", "2026-09-09", "middag"),
    ).toBeNull();
    expect(
      findLocalRegistrationVisitDuplicate(visits, "m1", "p1", "2026-09-09", "middag", true),
    ).toEqual({
      visitId: "v3",
      visitedOn: "2026-09-09",
      mealType: "middag",
      alreadyVisibleInTargetGroup: true,
    });
  });
});
