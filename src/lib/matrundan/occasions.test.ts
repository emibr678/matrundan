import { describe, expect, test } from "bun:test";
import { OCCASION_DESCRIPTION, OCCASION_LABEL, OCCASION_VALUES } from "@/lib/matrundan/types";

describe("sammanhangskategorier", () => {
  test("har tre tydliga och unika benämningar", () => {
    expect(OCCASION_VALUES).toEqual(["snabbt", "avslappnat", "middag"]);
    expect(OCCASION_VALUES.map((occasion) => OCCASION_LABEL[occasion])).toEqual([
      "Snabbt & enkelt",
      "Vardag & häng",
      "Middag & upplevelse",
    ]);
  });

  test("förklarar varje kategori som ett sammanhang", () => {
    for (const occasion of OCCASION_VALUES) {
      expect(OCCASION_DESCRIPTION[occasion].length).toBeGreaterThan(30);
    }
    expect(OCCASION_DESCRIPTION.avslappnat).toContain("kvarterskrog");
    expect(OCCASION_DESCRIPTION.middag).toContain("upplevelsen");
  });
});
