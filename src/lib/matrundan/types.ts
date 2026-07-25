export type PlaceCategory =
  | "restaurang"
  | "café"
  | "bageri"
  | "snabbmat"
  | "pub"
  | "matvagn";

export type Occasion = "snabbt" | "avslappnat" | "middag";

export type Role = "ägare" | "admin" | "medlem";

export interface Member {
  id: string;
  name: string;
  /** Emoji-avatar (default). Rendreras som text i MemberAvatar. */
  avatar?: string;
  /** Valfri bildavatar (t.ex. Google-profilbild). Prioriteras när emoji saknas. */
  avatarImage?: string;
  role: Role;
}

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  cuisines: string[];
  occasions: Occasion[];
  address: string;
  city: string;
  area?: string;
  lat?: number;
  lng?: number;
  addedBy: string;
  addedAt: string;
  notes?: string;
  photo?: string;
}

export interface VisibleReview {
  id: string;
  userId: string;
  overall: number;
  taste?: number | null;
  value?: number | null;
  service?: number | null;
  comment?: string | null;
  ratingVisible: boolean;
  commentVisible: boolean;
}

export interface VisitParticipant {
  id: string;
  name: string;
  avatar?: string | null;
  avatarImage?: string | null;
  /** active = fortfarande medlem i gruppen; left = tidigare medlem. */
  status: "active" | "left";
}

export interface Visit {
  id: string;
  placeId: string;
  date: string;
  meal: "frukost" | "lunch" | "fika" | "middag" | "kväll";
  participantIds: string[];
  overall: number;
  taste?: number;
  value?: number;
  service?: number;
  comment?: string;
  createdBy: string;
  /** original = besöket registrerades i denna grupp; shared = tillagt från annan grupp. */
  linkType?: "original" | "shared";
  linkedBy?: string;
  linkedAt?: string;
  /** Antal deltagare helt utan medlemskapsrad i denna grupp. Visas anonymt. */
  externalParticipantCount?: number;
  /** Räknas mot progression i denna grupp (alltid true för original). */
  countsForProgression?: boolean;
  /** Recensioner som är synliga för denna grupp – bas för aggregat och synlighets-UI. */
  visibleReviews?: VisibleReview[];
  /** Grupprelevanta deltagare (aktiv eller tidigare medlem) med profildata. */
  participants?: VisitParticipant[];
}

export interface Favorite {
  memberId: string;
  placeId: string;
}

/**
 * Gruppens förvalda sökområde. Endast `verified=true` (dvs. ett val från
 * Geoapify med både koordinater och place_id) får användas som sökcentrum.
 */
export interface HomeLocation {
  label: string;
  verified: boolean;
  lat?: number;
  lng?: number;
  provider?: "geoapify";
  placeId?: string;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  /** Legacy: används fortfarande av demo-läget för fallback-stad. */
  city: string;
  createdAt: string;
  ownerId: string;
  /** Om delade besök räknas mot progression. */
  sharedVisitsCountForProgression?: boolean;
  /** Förvalt sökområde (valfritt). Null om ingen text finns sparad. */
  homeLocation?: HomeLocation | null;
}

export type ActivityKind =
  | "added"
  | "visited"
  | "favorited"
  | "next-picked"
  | "member-joined";

export type ActivityTarget =
  | { kind: "place"; placeId: string }
  | { kind: "visit"; placeId: string; visitId: string }
  | { kind: "member"; memberId: string };

export interface Activity {
  id: string;
  kind: ActivityKind;
  memberId: string;
  placeId?: string;
  visitId?: string;
  at: string;
  text: string;
  target?: ActivityTarget;
}

export interface AppState {
  version: string;
  currentUserId: string;
  group: Group;
  members: Member[];
  places: Place[];
  visits: Visit[];
  favorites: Favorite[];
  activity: Activity[];
  nextPlaceId: string | null;
}

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  restaurang: "Restaurang",
  café: "Café",
  bageri: "Bageri",
  snabbmat: "Snabbmat",
  pub: "Pub",
  matvagn: "Matvagn",
};

export const OCCASION_LABEL: Record<Occasion, string> = {
  snabbt: "Snabbt & enkelt",
  avslappnat: "Avslappnat",
  middag: "Trevlig middag",
};

export function resolveActivityTarget(a: Activity): ActivityTarget | null {
  if (a.target) return a.target;
  if (a.kind === "visited" && a.placeId && a.visitId) {
    return { kind: "visit", placeId: a.placeId, visitId: a.visitId };
  }
  if (
    (a.kind === "added" || a.kind === "favorited" || a.kind === "next-picked") &&
    a.placeId
  ) {
    return { kind: "place", placeId: a.placeId };
  }
  if (a.kind === "member-joined" && a.memberId) {
    return { kind: "member", memberId: a.memberId };
  }
  return null;
}
