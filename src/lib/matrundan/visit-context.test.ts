import { describe, expect, test } from "bun:test";
import { formatVisitContext, VISIT_MEALS, visitMealLabel } from "./visit-context";

describe("besökskontext", () => {
  test("nya besök använder semantiska tillfällen utan legacy Kväll", () => {
    expect(VISIT_MEALS).toEqual(["frukost", "lunch", "fika", "middag", "dryck"]);
    expect(VISIT_MEALS).not.toContain("kväll");
    expect(visitMealLabel("dryck")).toBe("Något att dricka");
  });

  test("på plats är implicit medan Hämtmat visas uttryckligt", () => {
    expect(formatVisitContext({ meal: "middag" })).toBe("Middag");
    expect(formatVisitContext({ meal: "middag", isTakeaway: false })).toBe("Middag");
    expect(formatVisitContext({ meal: "middag", isTakeaway: true })).toBe("Middag · Hämtmat");
  });

  test("äldre Kväll-besök förblir läsbara", () => {
    expect(formatVisitContext({ meal: "kväll" })).toBe("Kväll");
  });
});
