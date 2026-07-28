export type PlaceCategory = "restaurang" | "café" | "bageri" | "snabbmat" | "pub" | "matvagn";

export type Occasion = "snabbt" | "avslappnat" | "middag";

export type Role = "ägare" | "admin" | "medlem";
export type GroupLifecycleStatus = "active" | "archived";
export type PlaceCollectionStatus = "active" | "archived";

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
  /** Resolverad kategori för den aktiva gruppen. */
  category: PlaceCategory;
  /** Kanonisk kategori innan eventuell gruppspecifik korrigering. */
  canonicalCategory?: PlaceCategory;
  /** Null/undefined betyder att gruppen använder kanonisk kategori. */
  categoryOverride?: PlaceCategory | null;
  /** Resolverade kökstyper för den aktiva gruppen. */
  cuisines: string[];
  /** Kanoniska kökstyper innan eventuell gruppspecifik korrigering. */
  canonicalCuisines?: string[];
  /** Null/undefined betyder att gruppen använder kanoniska kökstyper. */
  cuisinesOverride?: string[] | null;
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
  collectionStatus?: PlaceCollectionStatus;
  archivedAt?: string | null;
  archivedBy?: string | null;
  /**
   * Ursprung för gruppens koppling till stället (`group_places.origin`):
   * - `manual`: skapat i denna grupp
   * - `provider`: importerat från extern källa (t.ex. Geoapify) i denna grupp
   * - `shared`: kopplat in via delning från en annan grupp
   * Används bl.a. för Fullträff-badgen som inte utlöses av delade platser.
   */
  origin?: "manual" | "provider" | "shared";
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

export interface VisitPhoto {
  /** Kortlivad signerad URL i live-läge eller data-/asset-URL i demo. */
  url?: string;
  storagePath?: string;
  uploadedBy: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  updatedAt: string;
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
  /** Privat foto för just den aktiva gruppens koppling till besöket. */
  photo?: VisitPhoto | null;
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
  lifecycleStatus?: GroupLifecycleStatus;
  archivedAt?: string | null;
  archivedBy?: string | null;
  /** Om delade besök räknas mot progression. */
  sharedVisitsCountForProgression?: boolean;
  /** Förvalt sökområde (valfritt). Null om ingen text finns sparad. */
  homeLocation?: HomeLocation | null;
}

export type NextStopDateResponseValue = "fits" | "not_fits" | "unsure";
export type NextStopDateProposalStatus = "active" | "confirmed" | "cancelled";

export interface NextStopDateResponse {
  memberId: string;
  response: NextStopDateResponseValue;
  updatedAt: string;
}

export interface NextStopDateProposal {
  id: string;
  placeId: string;
  /** Lokal kalenderdag i formatet YYYY-MM-DD. */
  date: string;
  /** Valfri lokal tid i formatet HH:mm. */
  time?: string | null;
  createdBy: string;
  status: NextStopDateProposalStatus;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  responses: NextStopDateResponse[];
}

export type ActivityKind = "added" | "visited" | "favorited" | "next-picked" | "member-joined";

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
  /** Ett öppet eller bekräftat datumförslag för gruppens aktuella nästa stopp. */
  nextStopDateProposal?: NextStopDateProposal | null;
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
  if ((a.kind === "added" || a.kind === "favorited" || a.kind === "next-picked") && a.placeId) {
    return { kind: "place", placeId: a.placeId };
  }
  if (a.kind === "member-joined" && a.memberId) {
    return { kind: "member", memberId: a.memberId };
  }
  return null;
}
