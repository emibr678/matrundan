import type {
  PersonalJourneyLeaderboardPlace,
  PersonalJourneyOverview,
  PersonalJourneyPlace,
  PersonalJourneyPlaceCursor,
  PersonalJourneyPlaceDetail,
  PersonalJourneyToplistCursor,
  PersonalJourneyStats,
  PersonalJourneyStatsMetric,
  PersonalJourneyVisit,
  PersonalJourneyVisitDetail,
} from "./personal-journey";
import type { Occasion } from "./types";
import type { RankableVisitMeal } from "./visit-context-ranking";

const groups = {
  friends: {
    groupId: "10910000-0000-4000-8000-000000000001",
    groupName: "Fredagsgänget",
    isArchived: false,
    isWritable: true,
    isFavorite: true,
  },
  family: {
    groupId: "10910000-0000-4000-8000-000000000002",
    groupName: "Familjen",
    isArchived: false,
    isWritable: true,
    isFavorite: false,
  },
  oldTrip: {
    groupId: "10910000-0000-4000-8000-000000000003",
    groupName: "Göteborgsresan",
    isArchived: true,
    isWritable: false,
    isFavorite: true,
  },
} as const;

export const DEMO_PERSONAL_JOURNEY_PLACES: PersonalJourneyPlace[] = [
  {
    id: "10920000-0000-4000-8000-000000000001",
    name: "Kvartersbordet",
    category: "restaurang",
    address: "Exempelgatan 12",
    area: "Södermalm",
    city: "Stockholm",
    isFavorite: true,
    visitedByMe: true,
    rating: 4.25,
    reviewCount: 4,
    groups: [groups.friends, groups.family],
  },
  {
    id: "10920000-0000-4000-8000-000000000002",
    name: "Bageri Solsidan",
    category: "bageri",
    address: "Provvägen 4",
    area: "Majorna",
    city: "Göteborg",
    isFavorite: true,
    visitedByMe: true,
    rating: 4.67,
    reviewCount: 3,
    groups: [groups.oldTrip],
  },
  {
    id: "10920000-0000-4000-8000-000000000003",
    name: "Nudelhörnan",
    category: "restaurang",
    address: "Testgränd 7",
    area: "Vasastan",
    city: "Stockholm",
    isFavorite: false,
    visitedByMe: false,
    rating: 4.1,
    reviewCount: 2,
    groups: [groups.friends],
  },
  {
    id: "10920000-0000-4000-8000-000000000004",
    name: "Ramenverket",
    category: "restaurang",
    address: "Norrtullsgatan 18",
    area: "Vasastan",
    city: "Stockholm",
    isFavorite: false,
    visitedByMe: true,
    rating: 4.0,
    reviewCount: 3,
    groups: [groups.friends],
  },
  {
    id: "10920000-0000-4000-8000-000000000005",
    name: "Café Lilla Torget",
    category: "café",
    address: "Torget 2",
    area: "Enskede",
    city: "Stockholm",
    isFavorite: false,
    visitedByMe: false,
    rating: 3.9,
    reviewCount: 1,
    groups: [groups.family],
  },
  {
    id: "10920000-0000-4000-8000-000000000006",
    name: "Torggrillen",
    category: "snabbmat",
    address: "Gatuköksvägen 6",
    area: "Enskede",
    city: "Stockholm",
    isFavorite: false,
    visitedByMe: true,
    rating: 3.8,
    reviewCount: 2,
    groups: [groups.family],
  },
  {
    id: "10920000-0000-4000-8000-000000000007",
    name: "Bryggpuben",
    category: "pub",
    address: "Kajen 14",
    area: "Södermalm",
    city: "Stockholm",
    isFavorite: false,
    visitedByMe: false,
    rating: 3.7,
    reviewCount: 2,
    groups: [groups.friends],
  },
];

export const DEMO_PERSONAL_JOURNEY_VISITS: PersonalJourneyVisit[] = [
  {
    id: "10930000-0000-4000-8000-000000000001",
    placeId: DEMO_PERSONAL_JOURNEY_PLACES[0].id,
    placeName: DEMO_PERSONAL_JOURNEY_PLACES[0].name,
    category: DEMO_PERSONAL_JOURNEY_PLACES[0].category,
    address: DEMO_PERSONAL_JOURNEY_PLACES[0].address,
    area: DEMO_PERSONAL_JOURNEY_PLACES[0].area,
    city: DEMO_PERSONAL_JOURNEY_PLACES[0].city,
    visitedOn: "2026-09-20",
    mealType: "middag",
    isTakeaway: false,
    participated: true,
    ownReviewId: null,
    reviewPending: true,
    rating: 4.25,
    reviewCount: 4,
    groups: [groups.friends, groups.family],
    photoDeliveryToken: null,
  },
  {
    id: "10930000-0000-4000-8000-000000000002",
    placeId: DEMO_PERSONAL_JOURNEY_PLACES[1].id,
    placeName: DEMO_PERSONAL_JOURNEY_PLACES[1].name,
    category: DEMO_PERSONAL_JOURNEY_PLACES[1].category,
    address: DEMO_PERSONAL_JOURNEY_PLACES[1].address,
    area: DEMO_PERSONAL_JOURNEY_PLACES[1].area,
    city: DEMO_PERSONAL_JOURNEY_PLACES[1].city,
    visitedOn: "2026-08-16",
    mealType: "fika",
    isTakeaway: false,
    participated: true,
    ownReviewId: "10940000-0000-4000-8000-000000000001",
    reviewPending: false,
    rating: 4.67,
    reviewCount: 3,
    groups: [groups.oldTrip],
    photoDeliveryToken: null,
  },
  {
    id: "10930000-0000-4000-8000-000000000003",
    placeId: DEMO_PERSONAL_JOURNEY_PLACES[2].id,
    placeName: DEMO_PERSONAL_JOURNEY_PLACES[2].name,
    category: DEMO_PERSONAL_JOURNEY_PLACES[2].category,
    address: DEMO_PERSONAL_JOURNEY_PLACES[2].address,
    area: DEMO_PERSONAL_JOURNEY_PLACES[2].area,
    city: DEMO_PERSONAL_JOURNEY_PLACES[2].city,
    visitedOn: "2026-07-12",
    mealType: "lunch",
    isTakeaway: false,
    participated: false,
    ownReviewId: null,
    reviewPending: false,
    rating: 4.1,
    reviewCount: 2,
    groups: [groups.friends],
    photoDeliveryToken: null,
  },
  {
    id: "10930000-0000-4000-8000-000000000004",
    placeId: DEMO_PERSONAL_JOURNEY_PLACES[3].id,
    placeName: DEMO_PERSONAL_JOURNEY_PLACES[3].name,
    category: DEMO_PERSONAL_JOURNEY_PLACES[3].category,
    address: DEMO_PERSONAL_JOURNEY_PLACES[3].address,
    area: DEMO_PERSONAL_JOURNEY_PLACES[3].area,
    city: DEMO_PERSONAL_JOURNEY_PLACES[3].city,
    visitedOn: "2026-06-28",
    mealType: "middag",
    isTakeaway: false,
    participated: true,
    ownReviewId: "10940000-0000-4000-8000-000000000004",
    reviewPending: false,
    rating: 4.0,
    reviewCount: 3,
    groups: [groups.friends],
    photoDeliveryToken: null,
  },
  {
    id: "10930000-0000-4000-8000-000000000005",
    placeId: DEMO_PERSONAL_JOURNEY_PLACES[4].id,
    placeName: DEMO_PERSONAL_JOURNEY_PLACES[4].name,
    category: DEMO_PERSONAL_JOURNEY_PLACES[4].category,
    address: DEMO_PERSONAL_JOURNEY_PLACES[4].address,
    area: DEMO_PERSONAL_JOURNEY_PLACES[4].area,
    city: DEMO_PERSONAL_JOURNEY_PLACES[4].city,
    visitedOn: "2026-06-08",
    mealType: "fika",
    isTakeaway: false,
    participated: false,
    ownReviewId: null,
    reviewPending: false,
    rating: 3.9,
    reviewCount: 1,
    groups: [groups.family],
    photoDeliveryToken: null,
  },
  {
    id: "10930000-0000-4000-8000-000000000006",
    placeId: DEMO_PERSONAL_JOURNEY_PLACES[5].id,
    placeName: DEMO_PERSONAL_JOURNEY_PLACES[5].name,
    category: DEMO_PERSONAL_JOURNEY_PLACES[5].category,
    address: DEMO_PERSONAL_JOURNEY_PLACES[5].address,
    area: DEMO_PERSONAL_JOURNEY_PLACES[5].area,
    city: DEMO_PERSONAL_JOURNEY_PLACES[5].city,
    visitedOn: "2026-05-17",
    mealType: "lunch",
    isTakeaway: false,
    participated: true,
    ownReviewId: "10940000-0000-4000-8000-000000000006",
    reviewPending: false,
    rating: 3.8,
    reviewCount: 2,
    groups: [groups.family],
    photoDeliveryToken: null,
  },
  {
    id: "10930000-0000-4000-8000-000000000007",
    placeId: DEMO_PERSONAL_JOURNEY_PLACES[6].id,
    placeName: DEMO_PERSONAL_JOURNEY_PLACES[6].name,
    category: DEMO_PERSONAL_JOURNEY_PLACES[6].category,
    address: DEMO_PERSONAL_JOURNEY_PLACES[6].address,
    area: DEMO_PERSONAL_JOURNEY_PLACES[6].area,
    city: DEMO_PERSONAL_JOURNEY_PLACES[6].city,
    visitedOn: "2026-04-25",
    mealType: "middag",
    isTakeaway: false,
    participated: false,
    ownReviewId: null,
    reviewPending: false,
    rating: 3.7,
    reviewCount: 2,
    groups: [groups.friends],
    photoDeliveryToken: null,
  },
];

const DEMO_PERSONAL_JOURNEY_OCCASIONS: Record<string, Occasion[]> = {
  [DEMO_PERSONAL_JOURNEY_PLACES[0].id]: ["avslappnat", "middag"],
  [DEMO_PERSONAL_JOURNEY_PLACES[1].id]: ["snabbt"],
  [DEMO_PERSONAL_JOURNEY_PLACES[2].id]: ["avslappnat"],
  [DEMO_PERSONAL_JOURNEY_PLACES[3].id]: ["avslappnat"],
  [DEMO_PERSONAL_JOURNEY_PLACES[4].id]: ["snabbt"],
  [DEMO_PERSONAL_JOURNEY_PLACES[5].id]: ["snabbt"],
  [DEMO_PERSONAL_JOURNEY_PLACES[6].id]: ["avslappnat"],
};

function toDemoLeaderboardPlace(
  place: PersonalJourneyPlace,
  rating: number,
  reviewCount: number,
  visitCount: number,
  rank: number,
): PersonalJourneyLeaderboardPlace {
  return { ...place, rating, reviewCount, visitCount, rank };
}

export function demoPersonalJourneyToplist({
  query = "",
  occasions = [],
  mealTypes = [],
  takeawayOnly = false,
  cursor = null,
  limit = 20,
}: {
  query?: string;
  occasions?: Occasion[];
  mealTypes?: RankableVisitMeal[];
  takeawayOnly?: boolean;
  cursor?: PersonalJourneyToplistCursor | null;
  limit?: number;
} = {}) {
  const normalized = query.trim().toLocaleLowerCase("sv-SE");
  const matching = [...DEMO_PERSONAL_JOURNEY_PLACES]
    .filter((place): place is PersonalJourneyPlace & { rating: number } => place.rating != null)
    .filter(
      (place) =>
        !normalized ||
        [place.name, place.address, place.area, place.city]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase("sv-SE").includes(normalized)),
    )
    .filter(
      (place) =>
        occasions.length === 0 ||
        occasions.some((occasion) => DEMO_PERSONAL_JOURNEY_OCCASIONS[place.id]?.includes(occasion)),
    )
    .flatMap((place) => {
      const relevantVisits = DEMO_PERSONAL_JOURNEY_VISITS.filter(
        (visit) =>
          visit.placeId === place.id &&
          (mealTypes.length === 0 || mealTypes.includes(visit.mealType as RankableVisitMeal)) &&
          (!takeawayOnly || visit.isTakeaway),
      );
      if (mealTypes.length === 0 && !takeawayOnly) {
        return [{ place, rating: place.rating, reviewCount: place.reviewCount, visitCount: relevantVisits.length }];
      }
      const scored = relevantVisits.filter(
        (visit): visit is typeof visit & { rating: number } =>
          visit.rating != null && visit.reviewCount > 0,
      );
      if (scored.length === 0) return [];
      const reviewCount = scored.reduce((sum, visit) => sum + visit.reviewCount, 0);
      const rating =
        scored.reduce((sum, visit) => sum + visit.rating * visit.reviewCount, 0) / reviewCount;
      return [{ place, rating, reviewCount, visitCount: scored.length }];
    })
    .sort(
      (left, right) =>
        right.rating - left.rating ||
        right.reviewCount - left.reviewCount ||
        left.place.name.localeCompare(right.place.name, "sv"),
    )
    .map((item, index) =>
      toDemoLeaderboardPlace(
        item.place,
        item.rating,
        item.reviewCount,
        item.visitCount,
        index + 1,
      ),
    );

  const cursorIndex = cursor ? matching.findIndex((place) => place.id === cursor.id) : -1;
  const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const items = matching.slice(startIndex, startIndex + limit);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor:
      lastItem && startIndex + limit < matching.length
        ? {
            rating: lastItem.rating,
            reviewCount: lastItem.reviewCount,
            name: lastItem.name,
            id: lastItem.id,
          }
        : null,
  };
}

const DEMO_GLOBAL_PEOPLE = [
  {
    displayName: "Alex",
    avatarEmoji: "😋",
    visits: 17,
    uniquePlaces: 12,
    uniqueCuisines: 8,
    groupCount: 3,
    isSelf: true,
  },
  {
    displayName: "Sam",
    avatarEmoji: "🍜",
    visits: 24,
    uniquePlaces: 18,
    uniqueCuisines: 11,
    groupCount: 4,
    isSelf: false,
  },
  {
    displayName: "Nora",
    avatarEmoji: "🥐",
    visits: 9,
    uniquePlaces: 8,
    uniqueCuisines: 6,
    groupCount: 2,
    isSelf: false,
  },
  { displayName: "Kim", avatarEmoji: "🍕", visits: 14, uniquePlaces: 10, uniqueCuisines: 7, groupCount: 2, isSelf: false },
  { displayName: "Robin", avatarEmoji: "☕", visits: 6, uniquePlaces: 6, uniqueCuisines: 4, groupCount: 1, isSelf: false },
  { displayName: "Noor", avatarEmoji: "🌮", visits: 11, uniquePlaces: 9, uniqueCuisines: 9, groupCount: 2, isSelf: false },
  { displayName: "Maja", avatarEmoji: "🍣", visits: 4, uniquePlaces: 4, uniqueCuisines: 4, groupCount: 1, isSelf: false },
];

export function demoPersonalJourneyStats(
  metric: PersonalJourneyStatsMetric = "visits",
): PersonalJourneyStats {
  const valueFor = (person: (typeof DEMO_GLOBAL_PEOPLE)[number]) =>
    metric === "visits"
      ? person.visits
      : metric === "places"
        ? person.uniquePlaces
        : person.uniqueCuisines;
  const sorted = DEMO_GLOBAL_PEOPLE.map((person) => ({ ...person, value: valueFor(person) })).sort(
    (left, right) =>
      right.value - left.value || left.displayName.localeCompare(right.displayName, "sv"),
  );
  let previousValue: number | null = null;
  let previousRank = 0;
  const leaderboard = sorted.map((person, index) => {
    const rank = previousValue !== null && person.value === previousValue ? previousRank : index + 1;
    previousValue = person.value;
    previousRank = rank;
    return { ...person, rank };
  });
  const self = leaderboard.find((person) => person.isSelf)!;
  return {
    self: {
      displayName: self.displayName,
      avatarEmoji: self.avatarEmoji,
      visits: self.visits,
      uniquePlaces: self.uniquePlaces,
      uniqueCuisines: self.uniqueCuisines,
      groupCount: self.groupCount,
    },
    leaderboard: leaderboard.map(({ groupCount: _groupCount, ...person }) => person),
  };
}

export const DEMO_PERSONAL_JOURNEY_OVERVIEW: PersonalJourneyOverview = {
  summary: {
    attendedVisitCount: 7,
    attendedPlaceCount: 7,
    readableGroupCount: 3,
    activeGroupCount: 2,
  },
  pendingReviews: [
    {
      visitId: DEMO_PERSONAL_JOURNEY_VISITS[0].id,
      placeId: DEMO_PERSONAL_JOURNEY_PLACES[0].id,
      placeName: DEMO_PERSONAL_JOURNEY_PLACES[0].name,
      visitedOn: DEMO_PERSONAL_JOURNEY_VISITS[0].visitedOn,
      mealType: "middag",
      isTakeaway: false,
      groups: [groups.friends, groups.family],
    },
  ],
  topRatedPlaces: [...DEMO_PERSONAL_JOURNEY_PLACES]
    .filter((place) => place.rating != null)
    .sort(
      (left, right) =>
        (right.rating ?? 0) - (left.rating ?? 0) ||
        right.reviewCount - left.reviewCount ||
        left.name.localeCompare(right.name, "sv"),
    )
    .slice(0, 3),
  favoritePlaces: DEMO_PERSONAL_JOURNEY_PLACES.filter((place) => place.isFavorite),
  recentVisits: DEMO_PERSONAL_JOURNEY_VISITS.slice(0, 3),
};

export function demoPersonalJourneyPlaces({
  query = "",
  favoritesOnly = false,
  visitedByMeOnly = false,
  sort = "rating",
  cursor = null,
  limit = 20,
}: {
  query?: string;
  favoritesOnly?: boolean;
  visitedByMeOnly?: boolean;
  sort?: "rating" | "recent" | "name";
  cursor?: PersonalJourneyPlaceCursor | null;
  limit?: number;
}) {
  const normalized = query.trim().toLocaleLowerCase("sv-SE");
  const latestVisitByPlace = new Map<string, string>();
  for (const visit of DEMO_PERSONAL_JOURNEY_VISITS) {
    const current = latestVisitByPlace.get(visit.placeId);
    if (!current || visit.visitedOn > current)
      latestVisitByPlace.set(visit.placeId, visit.visitedOn);
  }
  const matching = DEMO_PERSONAL_JOURNEY_PLACES.filter(
    (place) =>
      (!favoritesOnly || place.isFavorite) &&
      (!visitedByMeOnly || place.visitedByMe) &&
      (!normalized ||
        [place.name, place.address, place.area, place.city]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase("sv-SE").includes(normalized))),
  );
  matching.sort((left, right) => {
    if (sort === "rating") {
      return (
        (right.rating ?? -1) - (left.rating ?? -1) ||
        right.reviewCount - left.reviewCount ||
        left.name.localeCompare(right.name, "sv")
      );
    }
    if (sort === "recent") {
      return (
        (latestVisitByPlace.get(right.id) ?? "").localeCompare(
          latestVisitByPlace.get(left.id) ?? "",
        ) || left.name.localeCompare(right.name, "sv")
      );
    }
    return left.name.localeCompare(right.name, "sv");
  });
  const cursorIndex = cursor ? matching.findIndex((place) => place.id === cursor.id) : -1;
  const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const items = matching.slice(startIndex, startIndex + limit);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor:
      lastItem && startIndex + limit < matching.length
        ? {
            rating: lastItem.rating,
            reviewCount: lastItem.reviewCount,
            visitedOn: latestVisitByPlace.get(lastItem.id) ?? null,
            name: lastItem.name,
            id: lastItem.id,
          }
        : null,
  };
}

export function demoPersonalJourneyVisits(participatedOnly: boolean) {
  return {
    items: DEMO_PERSONAL_JOURNEY_VISITS.filter((visit) => !participatedOnly || visit.participated),
    nextCursor: null,
  };
}

export function demoPersonalJourneyPlace(placeId: string): PersonalJourneyPlaceDetail | null {
  const place = DEMO_PERSONAL_JOURNEY_PLACES.find((item) => item.id === placeId);
  return place ? { ...place, cuisines: ["Nordiskt", "Vegetariskt"], lat: null, lng: null } : null;
}

export function demoPersonalJourneyVisit(visitId: string): PersonalJourneyVisitDetail | null {
  const visit = DEMO_PERSONAL_JOURNEY_VISITS.find((item) => item.id === visitId);
  if (!visit) return null;
  return {
    ...visit,
    reviews: [
      {
        id: "10940000-0000-4000-8000-000000000002",
        authorId: "10900000-0000-4000-8000-000000000002",
        authorName: "Sam",
        overall: 4.5,
        taste: 5,
        value: 4,
        service: 4,
        atmosphere: 5,
        reviewModel: "food_v1_atmosphere",
        comment: "Varmt, avslappnat och väldigt gott.",
        ratingVisible: true,
        commentVisible: true,
        isOwn: false,
      },
    ],
    photos: [],
  };
}
