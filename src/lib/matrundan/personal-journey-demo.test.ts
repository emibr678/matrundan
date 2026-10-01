import { describe, expect, test } from "bun:test";
import { EXAMPLE_IDS } from "./example-scenarios";
import {
  DEMO_PERSONAL_JOURNEY_OVERVIEW,
  demoPersonalJourneyPlace,
  demoPersonalJourneyPlaces,
  demoPersonalJourneyStats,
  demoPersonalJourneyToplist,
  demoPersonalJourneyVisit,
  demoPersonalJourneyVisits,
  isNavigableDemoPersonalJourneyGroup,
} from "./personal-journey-demo";

describe("Min matresa-demo", () => {
  test("täcker flera grupper, deduplicerad kontext och arkiverad historik", () => {
    expect(DEMO_PERSONAL_JOURNEY_OVERVIEW.summary.readableGroupCount).toBe(3);
    expect(DEMO_PERSONAL_JOURNEY_OVERVIEW.summary.activeGroupCount).toBe(2);
    expect(DEMO_PERSONAL_JOURNEY_OVERVIEW.topRatedPlaces.map((place) => place.name)).toEqual([
      "Bageri Solsidan",
      "Kardemummaköket",
      "Rundans Bistro",
    ]);
    expect(DEMO_PERSONAL_JOURNEY_OVERVIEW.favoritePlaces[0].groups.length).toBe(2);
    expect(
      DEMO_PERSONAL_JOURNEY_OVERVIEW.favoritePlaces.some((place) =>
        place.groups.some((group) => group.isArchived && !group.isWritable),
      ),
    ).toBe(true);
  });

  test("återanvänder Fredagsgängets kanoniska exempel-ID:n för navigerbara objekt", () => {
    const fredagsgruppen = DEMO_PERSONAL_JOURNEY_OVERVIEW.topRatedPlaces
      .flatMap((place) => place.groups)
      .find((group) => group.groupName === "Fredagsgänget");
    expect(fredagsgruppen?.groupId).toBe(EXAMPLE_IDS.group);
    expect(isNavigableDemoPersonalJourneyGroup(EXAMPLE_IDS.group)).toBe(true);
    expect(DEMO_PERSONAL_JOURNEY_OVERVIEW.pendingReviews[0].visitId).toBe(
      EXAMPLE_IDS.visits.repeatCafeEarlier,
    );
    expect(
      demoPersonalJourneyPlaces({ query: "Kvartersbordet" }).items[0]?.id,
    ).toBe(EXAMPLE_IDS.places.sharedVisit);
  });

  test("använder samma deterministiska data för filter och detaljer", () => {
    const favorites = demoPersonalJourneyPlaces({ favoritesOnly: true });
    expect(favorites.items).toHaveLength(2);
    expect(demoPersonalJourneyPlaces({ query: "Majorna" }).items).toHaveLength(1);
    expect(demoPersonalJourneyVisits(true).items.every((visit) => visit.participated)).toBe(true);
    expect(demoPersonalJourneyPlace(favorites.items[0].id)?.name).toBe(favorites.items[0].name);
    expect(
      demoPersonalJourneyVisit(DEMO_PERSONAL_JOURNEY_OVERVIEW.pendingReviews[0].visitId)?.reviews,
    ).toHaveLength(1);
  });

  test("sorterar hela tvärgruppslistan begripligt", () => {
    expect(demoPersonalJourneyPlaces({ sort: "rating" }).items.map((place) => place.name)).toEqual([
      "Bageri Solsidan",
      "Kardemummaköket",
      "Rundans Bistro",
      "Kvartersbordet",
      "Tacoateljén",
      "Café Lilla Torget",
      "Torggrillen",
    ]);
    expect(demoPersonalJourneyPlaces({ sort: "recent" }).items.map((place) => place.name)).toEqual([
      "Rundans Bistro",
      "Tacoateljén",
      "Kvartersbordet",
      "Bageri Solsidan",
      "Kardemummaköket",
      "Café Lilla Torget",
      "Torggrillen",
    ]);
    expect(demoPersonalJourneyPlaces({ sort: "name" }).items.map((place) => place.name)).toEqual([
      "Bageri Solsidan",
      "Café Lilla Torget",
      "Kardemummaköket",
      "Kvartersbordet",
      "Rundans Bistro",
      "Tacoateljén",
      "Torggrillen",
    ]);
  });

  test(
    "filtrerar Topplistan på upplevelse och besökstillfälle utan att skapa global metadata",
    () => {
      const relaxed = demoPersonalJourneyToplist({ occasions: ["avslappnat"] });
      expect(relaxed.items.map((place) => place.name)).toEqual([
        "Kardemummaköket",
        "Kvartersbordet",
        "Tacoateljén",
      ]);

      const relaxedDinner = demoPersonalJourneyToplist({
        occasions: ["avslappnat"],
        mealTypes: ["middag"],
      });
      expect(relaxedDinner.items.map((place) => place.name)).toEqual(["Tacoateljén"]);
      expect(relaxedDinner.items[0]?.rating).toBe(4.2);
      expect(relaxedDinner.items[0]?.reviewCount).toBe(4);

      expect(demoPersonalJourneyToplist({ takeawayOnly: true }).items).toEqual([]);
    },
  );

  test("har fler än tre rankade demoställen och inga rankade ställen utan verkligt besök", () => {
    const result = demoPersonalJourneyToplist();
    expect(result.items.length).toBeGreaterThan(3);
    expect(result.items.every((place) => place.visitCount > 0)).toBe(true);
    expect(DEMO_PERSONAL_JOURNEY_OVERVIEW.topRatedPlaces).toHaveLength(3);
  });

  test("visar global statistik och rankar personer med samma återanvända kontrakt", () => {
    const visits = demoPersonalJourneyStats("visits");
    expect(visits.self.visits).toBe(17);
    expect(visits.self.groupCount).toBe(3);
    expect(visits.leaderboard.map((person) => person.displayName)).toEqual([
      "Sam",
      "Alex",
      "Kim",
      "Noor",
      "Nora",
      "Robin",
      "Maja",
    ]);
    expect(visits.leaderboard.find((person) => person.isSelf)?.rank).toBe(2);

    const cuisines = demoPersonalJourneyStats("cuisines");
    expect(cuisines.leaderboard[0]?.displayName).toBe("Sam");
    expect(cuisines.leaderboard[0]?.value).toBe(11);
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
    expect(secondPage.items.map((place) => place.name)).toEqual(["Kardemummaköket"]);
  });
});
