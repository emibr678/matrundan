import { z } from "zod";
import { rpcClient } from "./rpc-client";

export const personalJourneyGroupSchema = z.object({
  groupId: z.string().uuid(),
  groupName: z.string(),
  isArchived: z.boolean(),
  isWritable: z.boolean(),
  isFavorite: z.boolean().optional(),
});

export type PersonalJourneyGroup = z.infer<typeof personalJourneyGroupSchema>;

export const personalJourneyPlaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  address: z.string(),
  area: z.string().nullable(),
  city: z.string(),
  isFavorite: z.boolean(),
  visitedByMe: z.boolean().optional().default(false),
  rating: z.coerce.number().nullable(),
  reviewCount: z.number().int().nonnegative(),
  groups: z.array(personalJourneyGroupSchema),
});

export type PersonalJourneyPlace = z.infer<typeof personalJourneyPlaceSchema>;

const personalJourneyLeaderboardPlaceSchema = personalJourneyPlaceSchema.extend({
  rating: z.coerce.number(),
  visitCount: z.number().int().nonnegative(),
});

export type PersonalJourneyLeaderboardPlace = z.infer<
  typeof personalJourneyLeaderboardPlaceSchema
>;

const personalJourneyPlaceDetailSchema = personalJourneyPlaceSchema.extend({
  cuisines: z.array(z.string()).default([]),
  lat: z.coerce.number().nullable(),
  lng: z.coerce.number().nullable(),
});

export type PersonalJourneyPlaceDetail = z.infer<typeof personalJourneyPlaceDetailSchema>;

export const personalJourneyVisitSchema = z.object({
  id: z.string().uuid(),
  placeId: z.string().uuid(),
  placeName: z.string(),
  address: z.string(),
  area: z.string().nullable(),
  city: z.string(),
  visitedOn: z.string(),
  mealType: z.string(),
  isTakeaway: z.boolean(),
  participated: z.boolean(),
  ownReviewId: z.string().uuid().nullable(),
  reviewPending: z.boolean(),
  rating: z.coerce.number().nullable(),
  reviewCount: z.number().int().nonnegative(),
  groups: z.array(personalJourneyGroupSchema),
  photoDeliveryToken: z.string().uuid().nullable(),
});

export type PersonalJourneyVisit = z.infer<typeof personalJourneyVisitSchema>;

const personalJourneyReviewSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string(),
  overall: z.coerce.number().nullable(),
  taste: z.coerce.number().nullable(),
  value: z.coerce.number().nullable(),
  service: z.coerce.number().nullable(),
  atmosphere: z.coerce.number().nullable(),
  reviewModel: z.string().nullable(),
  comment: z.string().nullable(),
  ratingVisible: z.boolean(),
  commentVisible: z.boolean(),
  isOwn: z.boolean(),
});

const personalJourneyPhotoSchema = z.object({
  deliveryToken: z.string().uuid(),
  mimeType: z.string(),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  createdAt: z.string(),
  isOwn: z.boolean(),
});

const personalJourneyVisitDetailSchema = personalJourneyVisitSchema
  .omit({ rating: true, reviewCount: true, photoDeliveryToken: true })
  .extend({
    reviews: z.array(personalJourneyReviewSchema),
    photos: z.array(personalJourneyPhotoSchema),
  });

export type PersonalJourneyVisitDetail = z.infer<typeof personalJourneyVisitDetailSchema>;

const visitCursorSchema = z.object({ visitedOn: z.string(), id: z.string().uuid() });
const placeCursorSchema = z.object({
  rating: z.number().nullable(),
  reviewCount: z.number().int().nonnegative(),
  visitedOn: z.string().nullable(),
  name: z.string(),
  id: z.string().uuid(),
});

const visitPageSchema = z.object({
  items: z.array(personalJourneyVisitSchema),
  nextCursor: visitCursorSchema.nullable(),
});

const pendingReviewSchema = z.object({
  visitId: z.string().uuid(),
  placeId: z.string().uuid(),
  placeName: z.string(),
  visitedOn: z.string(),
  mealType: z.string(),
  isTakeaway: z.boolean(),
  groups: z.array(personalJourneyGroupSchema),
});

const overviewSchema = z.object({
  summary: z.object({
    attendedVisitCount: z.number().int().nonnegative(),
    attendedPlaceCount: z.number().int().nonnegative(),
    readableGroupCount: z.number().int().nonnegative(),
    activeGroupCount: z.number().int().nonnegative(),
  }),
  pendingReviews: z.array(pendingReviewSchema),
  topRatedPlaces: z.array(personalJourneyPlaceSchema),
  favoritePlaces: z.array(personalJourneyPlaceSchema),
  recentVisits: z.array(personalJourneyVisitSchema),
});

export type PersonalJourneyOverview = z.infer<typeof overviewSchema>;
export type PersonalJourneyPendingReview = z.infer<typeof pendingReviewSchema>;
export const personalJourneyPlaceSortSchema = z.enum(["rating", "recent", "name"]);
export type PersonalJourneyPlaceSort = z.infer<typeof personalJourneyPlaceSortSchema>;
export type PersonalJourneyPlaceCursor = z.infer<typeof placeCursorSchema>;
export type PersonalJourneyVisitCursor = z.infer<typeof visitCursorSchema>;

export async function loadPersonalJourneyOverview(): Promise<PersonalJourneyOverview> {
  return rpcClient.call(
    "get_personal_journey_overview_v2",
    {},
    overviewSchema,
    "Kunde inte läsa Min matresa. Försök igen.",
  );
}

export async function loadPersonalJourneyPlaces({
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
  sort?: PersonalJourneyPlaceSort;
  cursor?: PersonalJourneyPlaceCursor | null;
  limit?: number;
} = {}) {
  return rpcClient.call(
    "list_personal_journey_places_v2",
    {
      _query: query || null,
      _favorites_only: favoritesOnly,
      _visited_by_me_only: visitedByMeOnly,
      _sort: sort,
      _cursor: cursor,
      _limit: limit,
    },
    z.object({
      items: z.array(personalJourneyPlaceSchema),
      nextCursor: placeCursorSchema.nullable(),
    }),
    "Kunde inte läsa matställena i Min matresa. Försök igen.",
  );
}

export async function loadPersonalJourneyToplist({
  occasions = [],
  mealTypes = [],
  takeawayOnly = false,
  limit = 3,
}: {
  occasions?: string[];
  mealTypes?: string[];
  takeawayOnly?: boolean;
  limit?: number;
} = {}) {
  return rpcClient.call(
    "get_personal_journey_toplist_v1",
    {
      _occasions: occasions,
      _meal_types: mealTypes,
      _takeaway_only: takeawayOnly,
      _limit: limit,
    },
    z.object({
      leader: personalJourneyLeaderboardPlaceSchema.nullable(),
      items: z.array(personalJourneyLeaderboardPlaceSchema),
    }),
    "Kunde inte läsa Topplistan i Min matresa. Försök igen.",
  );
}

export async function loadPersonalJourneyPlace(
  placeId: string,
): Promise<PersonalJourneyPlaceDetail | null> {
  return rpcClient.call(
    "get_personal_journey_place_v1",
    { _place_id: placeId },
    personalJourneyPlaceDetailSchema.nullable(),
    "Kunde inte läsa matstället. Försök igen.",
  );
}

export async function loadPersonalJourneyVisits({
  participatedOnly = false,
  cursor = null,
  limit = 20,
}: {
  participatedOnly?: boolean;
  cursor?: PersonalJourneyVisitCursor | null;
  limit?: number;
} = {}) {
  return rpcClient.call(
    "list_personal_journey_visits_v1",
    {
      _participated_only: participatedOnly,
      _cursor_visited_on: cursor?.visitedOn ?? null,
      _cursor_id: cursor?.id ?? null,
      _limit: limit,
    },
    visitPageSchema,
    "Kunde inte läsa besöken i Min matresa. Försök igen.",
  );
}

export async function loadPersonalJourneyVisit(
  visitId: string,
): Promise<PersonalJourneyVisitDetail | null> {
  return rpcClient.call(
    "get_personal_journey_visit_v1",
    { _visit_id: visitId },
    personalJourneyVisitDetailSchema.nullable(),
    "Kunde inte läsa besöket. Försök igen.",
  );
}
