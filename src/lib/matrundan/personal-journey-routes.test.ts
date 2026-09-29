import { describe, expect, test } from "bun:test";
import {
  groupPathForPersonalJourney,
  isPersonalJourneyPath,
  personalJourneyDemoSearch,
  personalJourneyPathFor,
} from "./personal-journey-routes";

describe("Min matresa-routes", () => {
  test("identifierar bara den personliga route-grenen", () => {
    expect(isPersonalJourneyPath("/min-matresa")).toBe(true);
    expect(isPersonalJourneyPath("/min-matresa/besok")).toBe(true);
    expect(isPersonalJourneyPath("/matstallen")).toBe(false);
  });

  test("behåller användarens delvy vid byte från grupp till Min matresa", () => {
    expect(personalJourneyPathFor("/matstallen/abc")).toBe("/min-matresa/matstallen");
    expect(personalJourneyPathFor("/besok")).toBe("/min-matresa/besok");
    expect(personalJourneyPathFor("/gruppen")).toBe("/min-matresa/besok");
    expect(personalJourneyPathFor("/")).toBe("/min-matresa");
  });

  test("öppnar motsvarande riktiga gruppvy utan syntetiskt grupp-id", () => {
    expect(groupPathForPersonalJourney("/min-matresa/matstallen")).toBe("/matstallen");
    expect(groupPathForPersonalJourney("/min-matresa/besok")).toBe("/besok");
    expect(groupPathForPersonalJourney("/min-matresa")).toBe("/");
  });

  test("behåller explicit demoläge genom den personliga navigationen", () => {
    expect(personalJourneyDemoSearch("demo")).toEqual({ demo: 1 });
    expect(personalJourneyDemoSearch("live")).toEqual({});
    expect(personalJourneyDemoSearch("landing")).toEqual({});
  });
});
