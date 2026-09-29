import type {
  PersonalJourneyOverview,
  PersonalJourneyPlace,
  PersonalJourneyPlaceDetail,
  PersonalJourneyVisit,
  PersonalJourneyVisitDetail,
} from "./personal-journey";

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
    rating: null,
    reviewCount: 0,
    groups: [groups.friends],
  },
];

export const DEMO_PERSONAL_JOURNEY_VISITS: PersonalJourneyVisit[] = [
  {
    id: "10930000-0000-4000-8000-000000000001",
    placeId: DEMO_PERSONAL_JOURNEY_PLACES[0].id,
    placeName: DEMO_PERSONAL_JOURNEY_PLACES[0].name,
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
];

export const DEMO_PERSONAL_JOURNEY_OVERVIEW: PersonalJourneyOverview = {
  summary: {
    attendedVisitCount: 7,
    attendedPlaceCount: 6,
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
  favoritePlaces: DEMO_PERSONAL_JOURNEY_PLACES.filter((place) => place.isFavorite),
  recentVisits: DEMO_PERSONAL_JOURNEY_VISITS,
};

export function demoPersonalJourneyPlaces({
  query = "",
  favoritesOnly = false,
  visitedByMeOnly = false,
}: {
  query?: string;
  favoritesOnly?: boolean;
  visitedByMeOnly?: boolean;
}) {
  const normalized = query.trim().toLocaleLowerCase("sv-SE");
  const items = DEMO_PERSONAL_JOURNEY_PLACES.filter(
    (place) =>
      (!favoritesOnly || place.isFavorite) &&
      (!visitedByMeOnly || place.visitedByMe) &&
      (!normalized ||
        [place.name, place.address, place.area, place.city]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase("sv-SE").includes(normalized))),
  );
  return { items, nextCursor: null };
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
