import { describe, expect, test } from "bun:test";
import {
  DEMO_PERSONAL_JOURNEY_OVERVIEW,
  demoPersonalJourneyPlace,
  demoPersonalJourneyPlaces,
  demoPersonalJourneyVisit,
  demoPersonalJourneyVisits,
} from "./personal-journey-demo";

describe("Min matresa-demo", () => {
  test("täcker flera grupper, deduplicerad kontext och arkiverad historik", () => {
    expect(DEMO_PERSONAL_JOURNEY_OVERVIEW.summary.readableGroupCount).toBe(3);
    expect(DEMO_PERSONAL_JOURNEY_OVERVIEW.summary.activeGroupCount).toBe(2);
    expect(DEMO_PERSONAL_JOURNEY_OVERVIEW.topRatedPlaces.map((place) => place.name)).toEqual([
      "Bageri Solsidan",
      "Kvartersbordet",
      "Nudelhörnan",
    ]);
    expect(DEMO_PERSONAL_JOURNEY_OVERVIEW.favoritePlaces[0].groups.length).toBe(2);
    expect(
      DEMO_PERSONAL_JOURNEY_OVERVIEW.favoritePlaces.some((place) =>
        place.groups.some((group) => group.isArchived && !group.isWritable),
      ),
    ).toBe(true);
  });

  test("använder samma deterministiska data för filter och detaljer", () => {
    const favorites = demoPersonalJourneyPlaces({ favoritesOnly: true });
    expect(favorites.items).toHaveLength(2);
    expect(demoPersonalJourneyPlaces({ query: "Majorna" }).items).toHaveLength(1);
    expect(demoPersonalJourneyVisits(true).items.every((visit) => visit.participated)).toBe(true);
    expect(demoPersonalJourneyPlace(favorites.items[0].id)?.name).toBe(favorites.items[0].name);
    expect(demoPersonalJourneyVisit("10930000-0000-4000-8000-000000000001")?.reviews).toHaveLength(
      1,
    );
  });

  test("sorterar hela tvärgruppslistan begripligt", () => {
    expect(demoPersonalJourneyPlaces({ sort: "rating" }).items.map((place) => place.name)).toEqual([
      "Bageri Solsidan",
      "Kvartersbordet",
      "Nudelhörnan",
    ]);
    expect(demoPersonalJourneyPlaces({ sort: "recent" }).items.map((place) => place.name)).toEqual([
      "Kvartersbordet",
      "Bageri Solsidan",
      "Nudelhörnan",
    ]);
    expect(demoPersonalJourneyPlaces({ sort: "name" }).items.map((place) => place.name)).toEqual([
      "Bageri Solsidan",
      "Kvartersbordet",
      "Nudelhörnan",
    ]);
  });

  test("fortsätter sorterade listor från en stabil cursor", () => {
    const firstPage = demoPersonalJourneyPlaces({ sort: "rating", limit: 1 });
    expect(firstPage.items.map((place) => place.name)).toEqual(["Bageri Solsidan"]);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = demoPersonalJourneyPlaces({
      sort: "rating",
      cursor: firstPage.nextCursor,
      limit: 1,
    });
    expect(secondPage.items.map((place) => place.name)).toEqual(["Kvartersbordet"]);
  });
});
