import { describe, expect, test } from "bun:test";
import {
  availableOwnVisits,
  defaultShareGroupIds,
  formatMealType,
  formatOwnVisitDate,
  toggleAllSelection,
} from "./sharing-selection";

describe("delningsurval", () => {
  test("förväljer bara andra grupper där stället redan finns", () => {
    expect(
      defaultShareGroupIds(
        [
          { groupId: "current", placeExistsInGroup: true },
          { groupId: "existing", placeExistsInGroup: true },
          { groupId: "new", placeExistsInGroup: false },
        ],
        "current",
      ),
    ).toEqual(["existing"]);
  });

  test("väljer alla och rensar när alla redan är valda", () => {
    expect(toggleAllSelection(["a", "b", "b"], [])).toEqual(["a", "b"]);
    expect(toggleAllSelection(["a", "b"], ["b", "a"])).toEqual([]);
    expect(toggleAllSelection([], [])).toEqual([]);
  });

  test("tidigare besök som redan är delade är inte valbara", () => {
    expect(
      availableOwnVisits([
        {
          visitId: "available",
          visitedOn: "2026-07-14",
          mealType: "middag",
          alreadySharedToTarget: false,
        },
        {
          visitId: "shared",
          visitedOn: "2026-07-15",
          mealType: "lunch",
          alreadySharedToTarget: true,
        },
      ]).map((visit) => visit.visitId),
    ).toEqual(["available"]);
  });

  test("formaterar datum och måltid med naturlig svensk copy", () => {
    expect(formatOwnVisitDate("2026-07-14")).toBe("14 juli 2026");
    expect(formatOwnVisitDate("okänt datum")).toBe("okänt datum");
    expect(formatMealType("middag")).toBe("Middag");
    expect(formatMealType("brunch")).toBe("brunch");
  });
});
