import { describe, expect, test } from "bun:test";
import {
  createPersonalJourneyReturnContext,
  getPersonalJourneyNavigationState,
  groupHomePath,
  isPersonalJourneyHref,
  isPersonalJourneyPath,
  isSafeInternalHref,
  personalJourneyDemoSearch,
} from "./personal-journey-routes";

describe("Min matresa-routes", () => {
  test("identifierar den personliga route-grenen utan att göra den till gruppscope", () => {
    expect(isPersonalJourneyPath("/min-matresa")).toBe(true);
    expect(isPersonalJourneyPath("/min-matresa/besok")).toBe(true);
    expect(isPersonalJourneyPath("/matstallen")).toBe(false);
  });

  test("accepterar bara säkra interna returadresser utanför Min matresa", () => {
    expect(isSafeInternalHref("/matstallen/p7?visit=v1")).toBe(true);
    expect(isSafeInternalHref("//example.com")).toBe(false);
    expect(isPersonalJourneyHref("/min-matresa/besok?visit=v1")).toBe(true);

    expect(createPersonalJourneyReturnContext("/matstallen/p7?visit=v1", "g1")).toEqual({
      href: "/matstallen/p7?visit=v1",
      groupId: "g1",
    });
    expect(createPersonalJourneyReturnContext("/min-matresa", "g1")).toBeNull();
    expect(createPersonalJourneyReturnContext("//example.com", "g1")).toBeNull();
  });

  test("sanerar history state för retur och tillfälligt review-handoff", () => {
    expect(
      getPersonalJourneyNavigationState({
        personalJourney: {
          returnContext: { href: "/gruppen?member=m1", groupId: "g1" },
          resumeHref: "/min-matresa/besok?visit=v1",
          sourceGroupId: "g1",
        },
      }),
    ).toEqual({
      returnContext: { href: "/gruppen?member=m1", groupId: "g1" },
      resumeHref: "/min-matresa/besok?visit=v1",
      sourceGroupId: "g1",
    });

    expect(
      getPersonalJourneyNavigationState({
        personalJourney: {
          returnContext: { href: "//evil.example", groupId: "g1" },
          resumeHref: "/besok",
        },
      }),
    ).toEqual({
      returnContext: undefined,
      resumeHref: undefined,
      sourceGroupId: undefined,
    });
  });

  test("behåller explicit demoläge och säker hemfallback", () => {
    expect(personalJourneyDemoSearch("demo")).toEqual({ demo: 1 });
    expect(personalJourneyDemoSearch("live")).toEqual({});
    expect(personalJourneyDemoSearch("landing")).toEqual({});
    expect(groupHomePath(true)).toBe("/exempel");
    expect(groupHomePath(false)).toBe("/");
  });
});
